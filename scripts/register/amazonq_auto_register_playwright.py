"""
Amazon Q Developer 批量自动注册脚本 (Playwright 版本)
使用 Playwright 实现，反检测能力更强

依赖安装:
    pip install playwright
    playwright install chromium

使用方法:
    python amazonq_auto_register_playwright.py           # 默认注册 1 个账号
    python amazonq_auto_register_playwright.py 5         # 注册 5 个账号
"""

import json
import time
import uuid
import os
import re
import sys
import random
import threading
from typing import Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from playwright.sync_api import sync_playwright, Page, Browser
from playwright_stealth import Stealth
from gptmail_service import GPTMailHandler


# ========== 无头模式配置 ==========
from config import HEADLESS_MODE as _DEFAULT_HEADLESS
HEADLESS_MODE = _DEFAULT_HEADLESS


def set_headless_mode(enabled: bool):
    """设置无头模式"""
    global HEADLESS_MODE
    HEADLESS_MODE = enabled
    print(f"🖥️  无头模式: {'开启' if enabled else '关闭'}")


# ========== User-Agent 池配置 ==========
AWS_SDK_VERSIONS = ["1.3.9", "1.3.8", "1.3.7", "1.4.0", "1.4.1"]
RUST_VERSIONS = ["1.87.0", "1.86.0", "1.85.0", "1.84.0", "1.83.0"]
OS_TYPES = ["windows", "macos", "linux"]
SSOOIDC_VERSIONS = ["1.88.0", "1.87.0", "1.86.0", "1.85.0", "1.89.0"]
UA_MODE = ["m/E", "m/F", "m/D", "m/G"]


def generate_auth_user_agent():
    """生成OIDC认证用的User-Agent"""
    sdk_version = random.choice(AWS_SDK_VERSIONS)
    os_type = random.choice(OS_TYPES)
    rust_version = random.choice(RUST_VERSIONS)
    ssooidc_version = random.choice(SSOOIDC_VERSIONS)
    mode = random.choice(UA_MODE)
    user_agent = f"aws-sdk-rust/{sdk_version} os/{os_type} lang/rust/{rust_version}"
    x_amz_user_agent = (
        f"aws-sdk-rust/{sdk_version} ua/2.1 api/ssooidc/{ssooidc_version} "
        f"os/{os_type} lang/rust/{rust_version} {mode} app/AmazonQ-For-CLI"
    )
    return user_agent, x_amz_user_agent


# ========== OIDC 认证配置 ==========
OIDC_BASE = "https://oidc.us-east-1.amazonaws.com"
REGISTER_URL = f"{OIDC_BASE}/client/register"
DEVICE_AUTH_URL = f"{OIDC_BASE}/device_authorization"
TOKEN_URL = f"{OIDC_BASE}/token"
START_URL = "https://view.awsapps.com/start"
AMZ_SDK_REQUEST = "attempt=1; max=3"


def make_headers() -> Dict[str, str]:
    """生成请求头"""
    user_agent, x_amz_user_agent = generate_auth_user_agent()
    return {
        "content-type": "application/json",
        "user-agent": user_agent,
        "x-amz-user-agent": x_amz_user_agent,
        "amz-sdk-request": AMZ_SDK_REQUEST,
        "amz-sdk-invocation-id": str(uuid.uuid4()),
    }


def post_json(url: str, payload: Dict, max_retries: int = 3) -> requests.Response:
    """发送JSON POST请求，带重试机制"""
    payload_str = json.dumps(payload, ensure_ascii=False)
    for attempt in range(max_retries):
        try:
            headers = make_headers()
            resp = requests.post(url, headers=headers, data=payload_str, timeout=(15, 60))
            return resp
        except (requests.exceptions.ConnectionError, ConnectionResetError) as e:
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 2
                print(f"   ⚠️ 连接被重置，{wait_time}秒后重试 ({attempt + 1}/{max_retries})...")
                time.sleep(wait_time)
            else:
                raise e
    raise requests.exceptions.ConnectionError("重试次数已用尽")


def register_client_min() -> Tuple[str, str]:
    """注册OIDC客户端"""
    payload = {
        "clientName": "Amazon Q Developer for command line",
        "clientType": "public",
        "scopes": ["codewhisperer:completions", "codewhisperer:analysis", "codewhisperer:conversations"],
    }
    r = post_json(REGISTER_URL, payload)
    r.raise_for_status()
    data = r.json()
    return data["clientId"], data["clientSecret"]


def device_authorize(client_id: str, client_secret: str) -> Dict:
    """发起设备授权"""
    payload = {"clientId": client_id, "clientSecret": client_secret, "startUrl": START_URL}
    r = post_json(DEVICE_AUTH_URL, payload)
    r.raise_for_status()
    return r.json()


def poll_token_device_code(client_id, client_secret, device_code, interval, expires_in, max_timeout_sec=300) -> Dict:
    """轮询获取token"""
    payload = {
        "clientId": client_id,
        "clientSecret": client_secret,
        "deviceCode": device_code,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
    }
    now = time.time()
    deadline = min(now + max(1, int(expires_in)), now + max_timeout_sec)
    poll_interval = max(1, int(interval or 1))

    while time.time() < deadline:
        r = post_json(TOKEN_URL, payload)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 400:
            try:
                err = r.json()
            except:
                err = {"error": r.text}
            if str(err.get("error")) == "authorization_pending":
                time.sleep(poll_interval)
                continue
            r.raise_for_status()
        r.raise_for_status()
    raise TimeoutError("Device authorization expired")


# ========== 配置 ==========
DEFAULT_BATCH_COUNT = 1
file_lock = threading.Lock()
oidc_lock = threading.Lock()


def get_current_page_type(page: Page) -> str:
    """通过 URL 判断当前页面类型"""
    try:
        url = page.url.lower()
        if '127.0.0.1' in url and 'callback' in url:
            return 'callback'
        if 'view.awsapps.com' in url:
            if 'user_code=' in url:
                return 'confirm'
            if 'clientid=' in url:
                return 'allow'
            return 'confirm'
        if 'registrationcode=' in url:
            return 'password'
        if 'signin.aws' in url and '/login' in url:
            return 'email'
        if 'profile.aws' in url:
            if 'verify-otp' in url:
                return 'verification'
            return 'name'
        return 'unknown'
    except:
        return 'unknown'


def random_viewport():
    """生成随机 viewport 尺寸"""
    widths = [1280, 1366, 1440, 1536, 1600, 1920]
    heights = [720, 768, 800, 864, 900, 1080]
    return {'width': random.choice(widths), 'height': random.choice(heights)}


def random_delay(min_sec=0.5, max_sec=2.0):
    """随机延迟"""
    time.sleep(random.uniform(min_sec, max_sec))


def move_mouse_to_element(page: Page, selector: str):
    """模拟鼠标移动到元素"""
    try:
        element = page.locator(selector).first
        box = element.bounding_box()
        if box:
            # 随机偏移，不要正中心
            x = box['x'] + box['width'] * random.uniform(0.3, 0.7)
            y = box['y'] + box['height'] * random.uniform(0.3, 0.7)
            page.mouse.move(x, y, steps=random.randint(5, 15))
            random_delay(0.1, 0.3)
    except:
        pass


def human_type(page: Page, selector: str, text: str):
    """模拟人类打字"""
    move_mouse_to_element(page, selector)
    page.click(selector)
    random_delay(0.2, 0.5)
    # 使用 press_sequentially 模拟逐字输入
    page.locator(selector).press_sequentially(text, delay=random.randint(50, 150))
    random_delay(0.3, 0.8)


# 继续按钮选择器（按页面类型）
CONTINUE_BTN_SELECTORS = {
    'email': "[data-testid='test-primary-button']",
    'name': "[data-testid='signup-next-button']",
    'verification': "[data-testid='email-verification-verify-button']",
    'password': "[data-testid='test-primary-button']",
    'confirm': "#cli_verification_btn",  # 确认页面的按钮
    'allow': "[data-testid='allow-access-button']",  # 允许访问页面的按钮
}


def click_continue_button(page: Page, page_type: str = None, timeout: int = 5000) -> bool:
    """点击继续按钮（带鼠标移动）"""
    if page_type and page_type in CONTINUE_BTN_SELECTORS:
        selector = CONTINUE_BTN_SELECTORS[page_type]
        try:
            move_mouse_to_element(page, selector)
            random_delay(0.2, 0.5)
            page.locator(selector).first.click(timeout=timeout)
            return True
        except:
            pass
    # 备选：尝试所有选择器
    for selector in CONTINUE_BTN_SELECTORS.values():
        try:
            locator = page.locator(selector)
            if locator.count() > 0 and locator.first.is_visible():
                move_mouse_to_element(page, selector)
                random_delay(0.2, 0.5)
                locator.first.click(timeout=timeout)
                return True
        except:
            continue
    return False


def check_page_error(page: Page) -> bool:
    """检查页面错误"""
    error_selectors = [
        '[data-analytics-alert="error"]',
        '[data-testid*="error-alert"]',
        '[class*="type-error"]',
    ]
    for selector in error_selectors:
        try:
            if page.is_visible(selector, timeout=500):
                try:
                    error_text = page.text_content(selector)
                    print(f"   ❌ 检测到错误弹窗: {selector}")
                    print(f"   ❌ 错误内容: {error_text}")
                except:
                    print(f"   ❌ 检测到错误弹窗: {selector}")
                return True
        except:
            pass
    return False


def save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token):
    """保存账号信息"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_file = os.path.join(script_dir, "registered_accounts.json")
    machine_id = str(uuid.uuid4())
    account = {
        "email": email, "password": password, "accessToken": access_token,
        "refreshToken": refresh_token, "clientId": client_id, "clientSecret": client_secret,
        "region": "us-east-1", "provider": "BuilderId", "machineId": machine_id
    }
    with file_lock:
        accounts = []
        if os.path.exists(json_file):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    accounts = json.load(f)
            except:
                pass
        accounts.append(account)
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(accounts, f, ensure_ascii=False, indent=2)
    print(f"✅ 账号已保存到: {json_file}")



def register_single_account(account_num, total_accounts):
    """注册单个账号 (Playwright 版本)"""
    mail_handler = None
    browser = None
    
    def log(msg):
        print(f"[窗口 {account_num}] {msg}")
    
    log("=" * 50)
    log(f"🎯 开始注册账号 {account_num}/{total_accounts}")
    log("=" * 50)

    # 步骤1: 创建邮箱
    log("步骤1: 创建临时邮箱...")
    mail_handler = GPTMailHandler(log_prefix=f"[窗口 {account_num}]")
    email = mail_handler.generate_email()
    if not email:
        log("❌ 创建邮箱失败")
        return False
    log(f"✅ 邮箱: {email}")

    # 生成用户名和密码
    first_names = ["James", "John", "Robert", "Michael", "David", "William", "Mary", "Patricia", "Jennifer", "Linda"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    username = f"{random.choice(first_names)} {random.choice(last_names)}"
    log(f"👤 用户名: {username}")

    upper, lower, digits, symbols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789', '!@#$%&*'
    password = [random.choice(upper), random.choice(lower), random.choice(digits), random.choice(symbols)]
    password += [random.choice(upper + lower + digits + symbols) for _ in range(8)]
    random.shuffle(password)
    password = ''.join(password)
    log(f"🔑 密码: {password}")

    # 步骤2: 获取设备授权
    log("步骤2: 调用 AWS Device Authorization API")
    try:
        with oidc_lock:
            log("⏳ 正在注册 OIDC 客户端...")
            client_id, client_secret = register_client_min()
            log(f"✅ 客户端注册成功")
            log("⏳ 正在获取设备授权...")
            device_auth = device_authorize(client_id, client_secret)
            time.sleep(0.5)
        device_code = device_auth.get('deviceCode')
        verification_uri_complete = device_auth.get('verificationUriComplete')
        user_code = device_auth.get('userCode')
        interval = device_auth.get('interval', 5)
        expires_in = device_auth.get('expiresIn', 600)
        log(f"✅ 设备授权成功, 用户代码: {user_code}")
    except Exception as e:
        log(f"❌ Device Authorization 失败: {e}")
        return False

    # 步骤3: 启动浏览器
    log("步骤3: 启动浏览器 (Playwright + Stealth)")
    playwright = None
    stealth_instance = Stealth(
        navigator_languages_override=('zh-CN', 'zh', 'en-US', 'en'),
    )
    try:
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=HEADLESS_MODE,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        # 随机 viewport
        viewport = random_viewport()
        context = browser.new_context(
            viewport=viewport,
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        # 手动应用 stealth 到 context
        stealth_instance.apply_stealth_sync(context)
        page = context.new_page()
        log("✅ 浏览器启动成功 (Stealth 已启用)")

        log(f"⏳ 打开授权链接: {verification_uri_complete}")
        page.goto(verification_uri_complete, wait_until='networkidle', timeout=60000)
        time.sleep(3)
        
        # 处理 Cookie 弹窗
        try:
            cookie_btn = page.locator('[data-id="awsccc-cb-btn-accept"]')
            if cookie_btn.is_visible(timeout=2000):
                cookie_btn.click()
                log("✅ 已接受 Cookie")
                time.sleep(1)
        except:
            pass

        # 等待邮箱页面
        log("⏳ 等待页面加载...")
        for i in range(60):
            if get_current_page_type(page) == 'email':
                log("✅ 已到达邮箱页面")
                break
            time.sleep(1)

        # 页面1: 输入邮箱
        log("📧 页面1: 输入邮箱")
        page.wait_for_selector("input[placeholder='username@example.com']", timeout=20000)
        human_type(page, "input[placeholder='username@example.com']", email)
        log(f"✅ 已输入邮箱: {email}")
        time.sleep(0.5)
        click_continue_button(page, 'email')
        log("✅ 已点击'继续'")
        time.sleep(2)
        if check_page_error(page):
            log("❌ 邮箱提交失败")
            return False
        page.wait_for_url("**/profile.aws**", timeout=30000)
        log("✅ 已跳转到姓名页")

        # 页面2: 输入用户名
        log("👤 页面2: 输入用户名")
        
        # 调试：等待页面稳定后保存截图和 HTML
        time.sleep(2)
        debug_dir = os.path.join(os.path.dirname(__file__), 'debug')
        os.makedirs(debug_dir, exist_ok=True)
        page.screenshot(path=os.path.join(debug_dir, 'name_page.png'))
        with open(os.path.join(debug_dir, 'name_page.html'), 'w', encoding='utf-8') as f:
            f.write(page.content())
        log(f"📸 已保存调试截图到 debug/name_page.png")
        log(f"📄 当前 URL: {page.url}")
        
        # 尝试多种选择器
        name_selectors = [
            "[data-testid='signup-full-name-input'] input",
            "input[name='fullName']",
            "input[placeholder*='name' i]",
            "input[placeholder*='姓名']",
            "#fullName",
            "[data-testid='full-name-input'] input",
            "form input[type='text']",
        ]
        
        name_input_found = False
        for selector in name_selectors:
            try:
                if page.locator(selector).first.is_visible(timeout=2000):
                    log(f"✅ 找到姓名输入框: {selector}")
                    name_input_found = True
                    human_type(page, selector, username)
                    break
            except:
                continue
        
        if not name_input_found:
            log("❌ 未找到姓名输入框，尝试的选择器都失败了")
            # 列出页面上所有 input 元素
            inputs = page.query_selector_all("input")
            log(f"📋 页面上共有 {len(inputs)} 个 input 元素:")
            for i, inp in enumerate(inputs):
                try:
                    attrs = {
                        'type': inp.get_attribute('type'),
                        'name': inp.get_attribute('name'),
                        'placeholder': inp.get_attribute('placeholder'),
                        'data-testid': inp.get_attribute('data-testid'),
                    }
                    log(f"  [{i}] {attrs}")
                except:
                    pass
            return False
        log(f"✅ 已输入用户名: {username}")
        time.sleep(0.5)
        click_continue_button(page, 'name')
        log("✅ 已点击'继续'")
        time.sleep(2)
        if check_page_error(page):
            log("❌ 用户名提交失败")
            return False

        # 等待验证码页
        for i in range(30):
            if get_current_page_type(page) == 'verification':
                log("✅ 已跳转到验证码页")
                break
            time.sleep(1)

        # 页面3: 输入验证码
        log("🔢 页面3: 输入邮箱验证码")
        page.wait_for_selector("[data-testid='email-verification-form-code-input'] input", timeout=30000)
        log("⏳ 等待验证码...")
        verification_code = mail_handler.get_verification_code(email, timeout=120, min_wait=10)
        if not verification_code:
            log("❌ 未能获取验证码")
            return False
        human_type(page, "[data-testid='email-verification-form-code-input'] input", verification_code)
        log(f"✅ 已输入验证码: {verification_code}")
        click_continue_button(page, 'verification')
        log("✅ 已点击'继续'")
        time.sleep(2)
        if check_page_error(page):
            log("❌ 验证码提交失败")
            return False

        # 页面4: 设置密码
        log("🔐 页面4: 设置密码")
        page.wait_for_selector("input[type='password']", timeout=20000)
        time.sleep(1)
        pwd_inputs = page.query_selector_all("input[type='password']")
        for inp in pwd_inputs:
            inp.click()
            time.sleep(0.1)
            inp.type(password, delay=random.randint(30, 80))
        log("✅ 已输入密码")
        click_continue_button(page, 'password')
        log("✅ 已点击'继续'")
        random_delay(2, 4)

        # 页面5: 确认并继续
        log("🔢 页面5: 确认并继续")
        # 等待确认按钮出现
        for _ in range(30):
            try:
                if page.locator("#cli_verification_btn").is_visible(timeout=1000):
                    move_mouse_to_element(page, "#cli_verification_btn")
                    random_delay(0.3, 0.8)
                    page.locator("#cli_verification_btn").click()
                    log("✅ 已点击确认按钮")
                    break
            except:
                pass
            time.sleep(1)
        random_delay(2, 4)

        # 页面6: 允许访问
        log("✅ 页面6: 允许访问")
        # 等待允许按钮出现并点击
        for _ in range(30):
            try:
                if page.locator("[data-testid='allow-access-button']").is_visible(timeout=1000):
                    move_mouse_to_element(page, "[data-testid='allow-access-button']")
                    random_delay(0.3, 0.8)
                    page.locator("[data-testid='allow-access-button']").click()
                    log("✅ 已点击'允许访问'")
                    random_delay(1, 2)  # 等待后端处理
                    break
            except:
                pass
            time.sleep(1)

        # 点击后立即轮询获取 tokens
        log("🔄 轮询获取 Tokens...")
        tokens = poll_token_device_code(client_id, client_secret, device_code, interval, expires_in, 300)
        access_token = tokens.get('accessToken')
        refresh_token = tokens.get('refreshToken')
        if access_token and refresh_token:
            log("🎉 账号注册成功！")
            save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token)
            return True
        else:
            log("❌ Token 数据不完整")
            return False

    except Exception as e:
        log(f"❌ 注册过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if mail_handler:
            try:
                mail_handler.close()
            except:
                pass
        if browser:
            try:
                browser.close()
            except:
                pass
        if playwright:
            try:
                playwright.stop()
            except:
                pass
            log("✅ 浏览器已关闭")


def main():
    """主函数"""
    batch_count = DEFAULT_BATCH_COUNT
    if len(sys.argv) > 1:
        try:
            batch_count = int(sys.argv[1])
        except:
            print(f"使用方法: python {sys.argv[0]} [数量]")
            return

    print("\n" + "🤖" * 30)
    print("  Amazon Q Developer 批量自动注册 (Playwright)")
    print("🤖" * 30 + "\n")

    success_count = 0
    fail_count = 0
    for i in range(1, batch_count + 1):
        result = register_single_account(i, batch_count)
        if result:
            success_count += 1
        else:
            fail_count += 1
        if i < batch_count:
            time.sleep(3)

    print(f"\n📊 完成: 成功 {success_count}, 失败 {fail_count}")


if __name__ == "__main__":
    main()
