"""
Amazon Q Developer 批量自动注册脚本 (DrissionPage 版本)
DrissionPage 结合了 Selenium 和 requests，反检测能力强

依赖安装:
    pip install DrissionPage

使用方法:
    python amazonq_auto_register_drission.py           # 默认注册 1 个账号
    python amazonq_auto_register_drission.py 5         # 注册 5 个账号
"""

import json
import time
import uuid
import os
import sys
import random
import threading
from typing import Dict, Tuple, Optional

import requests
from DrissionPage import ChromiumOptions
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
    """发送JSON POST请求"""
    payload_str = json.dumps(payload, ensure_ascii=False)
    for attempt in range(max_retries):
        try:
            headers = make_headers()
            resp = requests.post(url, headers=headers, data=payload_str, timeout=(15, 60))
            return resp
        except (requests.exceptions.ConnectionError, ConnectionResetError) as e:
            if attempt < max_retries - 1:
                time.sleep((attempt + 1) * 2)
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


def get_current_page_type(url: str) -> str:
    """通过 URL 判断当前页面类型"""
    url = url.lower()
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


def human_type(element, text: str):
    """模拟人类打字"""
    element.click()
    time.sleep(random.uniform(0.1, 0.3))
    for char in text:
        element.input(char, clear=False)
        time.sleep(random.uniform(0.05, 0.15))
    time.sleep(random.uniform(0.2, 0.5))


def check_page_error(page) -> bool:
    """检查页面错误"""
    error_selectors = [
        "css:[data-analytics-alert='error']",
        "css:[data-testid*='error-alert']",
        "css:[class*='type-error']",
    ]
    for selector in error_selectors:
        try:
            ele = page.ele(selector, timeout=0.5)
            if ele and str(type(ele).__name__) != 'NoneElement':
                error_text = ele.text
                print(f"   ❌ 检测到错误弹窗: {selector}")
                print(f"   ❌ 错误内容: {error_text}")
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
    """注册单个账号 (DrissionPage 版本)"""
    mail_handler = None
    page = None
    
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
    log("步骤3: 启动浏览器 (DrissionPage)")
    try:
        # 配置浏览器选项
        co = ChromiumOptions()
        co.auto_port()  # 自动分配端口
        if HEADLESS_MODE:
            co.headless()
        
        # 反检测参数
        co.set_argument('--disable-blink-features=AutomationControlled')
        co.set_argument('--disable-infobars')
        co.set_argument('--no-sandbox')
        co.set_argument('--disable-dev-shm-usage')
        co.set_argument('--disable-web-security')
        co.set_argument('--disable-features=IsolateOrigins,site-per-process')
        co.set_argument('--hide-crash-restore-bubble')
        co.set_argument(f'--window-size={random.randint(1200, 1920)},{random.randint(700, 1080)}')
        
        # 禁用密码保存提示
        co.set_pref('credentials_enable_service', False)
        
        # 隐身模式
        co.incognito()
        
        from DrissionPage import Chromium
        browser = Chromium(co)
        page = browser.latest_tab
        log("✅ 浏览器启动成功")

        log(f"⏳ 打开授权链接: {verification_uri_complete}")
        page.get(verification_uri_complete)
        time.sleep(3)

        # 等待邮箱页面加载完成
        log("⏳ 等待页面加载...")
        log(f"   当前 URL: {page.url}")
        
        # 等待页面 DOM 加载完成
        page.wait.doc_loaded(timeout=30)
        time.sleep(2)
        
        # 查找邮箱输入框 - DrissionPage 用 @ 语法查属性
        email_input = page.ele("@placeholder=username@example.com", timeout=10)
        if str(type(email_input).__name__) == 'NoneElement':
            log(f"❌ 无法找到邮箱输入框")
            return False
        
        log(f"✅ 找到邮箱输入框")

        # 页面1: 输入邮箱
        log("📧 页面1: 输入邮箱")
        human_type(email_input, email)
        log(f"✅ 已输入邮箱: {email}")
        time.sleep(0.5)
        # 用 css: 前缀强制使用 CSS 选择器
        continue_btn = page.ele("css:[data-testid='test-primary-button']", timeout=10)
        if not continue_btn:
            log("❌ 找不到继续按钮")
            return False
        continue_btn.click()
        log("✅ 已点击'继续'")
        time.sleep(2)
        if check_page_error(page):
            log("❌ 邮箱提交失败")
            return False
        
        # 等待跳转
        for i in range(30):
            if get_current_page_type(page.url) == 'name':
                log("✅ 已跳转到姓名页")
                break
            time.sleep(1)

        # 页面2: 输入用户名
        log("👤 页面2: 输入用户名")
        name_input = page.ele("css:[data-testid='signup-full-name-input'] input", timeout=15)
        human_type(name_input, username)
        log(f"✅ 已输入用户名: {username}")
        time.sleep(0.5)
        page.ele("css:[data-testid='signup-next-button']", timeout=10).click()
        log("✅ 已点击'继续'")
        time.sleep(2)
        if check_page_error(page):
            log("❌ 用户名提交失败")
            return False

        # 等待验证码页
        for i in range(30):
            if get_current_page_type(page.url) == 'verification':
                log("✅ 已跳转到验证码页")
                break
            time.sleep(1)

        # 页面3: 输入验证码
        log("🔢 页面3: 输入邮箱验证码")
        code_input = page.ele("css:[data-testid='email-verification-form-code-input'] input", timeout=30)
        log("⏳ 等待验证码...")
        verification_code = mail_handler.get_verification_code(email, timeout=120, min_wait=10)
        if not verification_code:
            log("❌ 未能获取验证码")
            return False
        human_type(code_input, verification_code)
        log(f"✅ 已输入验证码: {verification_code}")
        page.ele("css:[data-testid='email-verification-verify-button']", timeout=10).click()
        log("✅ 已点击'继续'")
        time.sleep(2)
        if check_page_error(page):
            log("❌ 验证码提交失败")
            return False

        # 页面4: 设置密码
        log("🔐 页面4: 设置密码")
        pwd_inputs = page.eles("css:input[type='password']", timeout=20)
        time.sleep(1)
        for inp in pwd_inputs:
            inp.click()
            time.sleep(0.1)
            for char in password:
                inp.input(char, clear=False)
                time.sleep(random.uniform(0.03, 0.08))
        log("✅ 已输入密码")
        page.ele("css:[data-testid='test-primary-button']", timeout=10).click()
        log("✅ 已点击'继续'")
        time.sleep(3)

        # 页面5: 确认
        log("🔢 页面5: 确认并继续")
        if get_current_page_type(page.url) == 'confirm':
            time.sleep(2)
            try:
                page.ele("css:#cli_verification_btn", timeout=5).click()
                log("✅ 已点击确认按钮")
            except:
                pass
            time.sleep(3)

        # 页面6: 允许访问
        log("✅ 页面6: 允许访问")
        for _ in range(30):
            time.sleep(1)
            try:
                btn = page.ele("css:[data-testid='allow-access-button']", timeout=1)
                if btn and str(type(btn).__name__) != 'NoneElement':
                    btn.click()
                    log("✅ 已点击'允许访问'")
                    time.sleep(1.5)
                    break
            except:
                pass

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
        if page:
            try:
                browser.quit()
                log("✅ 浏览器已关闭")
            except:
                pass


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
    print("  Amazon Q Developer 批量自动注册 (DrissionPage)")
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
