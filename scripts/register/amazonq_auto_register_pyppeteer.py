"""
Amazon Q Developer 批量自动注册脚本 (Pyppeteer 版本)
使用 Pyppeteer (Puppeteer Python 版) 实现

依赖安装:
    pip install pyppeteer pyppeteer-stealth

注意: Pyppeteer 项目已停止维护，推荐使用 Playwright 版本
如果遇到 Chromium 下载问题，脚本会自动使用本地 Chrome

使用方法:
    python amazonq_auto_register_pyppeteer.py           # 默认注册 1 个账号
    python amazonq_auto_register_pyppeteer.py 5         # 注册 5 个账号
"""

import json
import time
import uuid
import os
import re
import sys
import random
import asyncio
import threading
import shutil
from typing import Dict, Tuple, Optional

import requests
from pyppeteer import launch
from pyppeteer_stealth import stealth
from gptmail_service import GPTMailHandler


# ========== Chrome 路径查找 ==========
def find_chrome_executable() -> Optional[str]:
    """查找本地 Chrome 可执行文件路径"""
    # 尝试 PATH 中的 chrome
    chrome_path = shutil.which('chrome') or shutil.which('google-chrome')
    if chrome_path and os.path.exists(chrome_path):
        return chrome_path
    
    # Windows 常见路径
    if sys.platform == 'win32':
        paths = [
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
            os.path.expandvars(r'%PROGRAMFILES%\Google\Chrome\Application\chrome.exe'),
            os.path.expandvars(r'%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe'),
        ]
    # macOS 常见路径
    elif sys.platform == 'darwin':
        paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            os.path.expanduser('~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
        ]
    # Linux 常见路径
    else:
        paths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
        ]
    
    for p in paths:
        if os.path.exists(p):
            return p
    
    return None


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


async def human_type(page, selector: str, text: str):
    """模拟人类打字"""
    await page.click(selector)
    await asyncio.sleep(random.uniform(0.1, 0.3))
    for char in text:
        await page.type(selector, char, {'delay': random.randint(50, 150)})
    await asyncio.sleep(random.uniform(0.2, 0.5))


async def random_delay(min_sec: float = 0.5, max_sec: float = 2.0):
    """随机延迟"""
    await asyncio.sleep(random.uniform(min_sec, max_sec))


async def move_mouse_to_element(page, selector: str):
    """模拟鼠标移动到元素"""
    try:
        element = await page.querySelector(selector)
        if element:
            box = await element.boundingBox()
            if box:
                # 随机偏移到元素内部某点
                x = box['x'] + random.uniform(5, box['width'] - 5)
                y = box['y'] + random.uniform(5, box['height'] - 5)
                await page.mouse.move(x, y, {'steps': random.randint(10, 25)})
                await asyncio.sleep(random.uniform(0.1, 0.3))
    except:
        pass


async def human_click(page, selector: str, timeout: int = 10000):
    """模拟人类点击（先移动鼠标再点击）"""
    await move_mouse_to_element(page, selector)
    await random_delay(0.1, 0.3)
    await page.click(selector, {'timeout': timeout})


# 继续按钮选择器（按页面类型）
CONTINUE_BTN_SELECTORS = {
    'email': "[data-testid='test-primary-button']",
    'name': "[data-testid='signup-next-button']",
    'verification': "[data-testid='email-verification-verify-button']",
    'password': "[data-testid='test-primary-button']",
    'confirm': "#cli_verification_btn",
    'allow': "[data-testid='allow-access-button']",
}


async def click_continue_button(page, page_type: str = None, timeout: int = 5000) -> bool:
    """点击继续按钮"""
    if page_type and page_type in CONTINUE_BTN_SELECTORS:
        selector = CONTINUE_BTN_SELECTORS[page_type]
        try:
            await page.click(selector, {'timeout': timeout})
            return True
        except:
            pass
    # 备选：尝试所有选择器
    for selector in CONTINUE_BTN_SELECTORS.values():
        try:
            element = await page.querySelector(selector)
            if element:
                await page.click(selector, {'timeout': timeout})
                return True
        except:
            continue
    return False


async def check_page_error(page) -> bool:
    """检查页面错误"""
    error_selectors = [
        '[data-analytics-alert="error"]',
        '[data-testid*="error-alert"]',
        '[class*="type-error"]',
    ]
    for selector in error_selectors:
        try:
            element = await page.querySelector(selector)
            if element:
                is_visible = await page.evaluate('(el) => el.offsetParent !== null', element)
                if is_visible:
                    error_text = await page.evaluate('(el) => el.textContent', element)
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



async def register_single_account_async(account_num, total_accounts):
    """注册单个账号 (Pyppeteer 版本)"""
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
    log("步骤3: 启动浏览器 (Pyppeteer + Stealth)")
    try:
        # 查找本地 Chrome（Pyppeteer 内置 Chromium 下载已失效）
        chrome_path = find_chrome_executable()
        if not chrome_path:
            log("❌ 未找到 Chrome，请安装 Google Chrome")
            log("   或使用 Playwright 版本: amazonq_auto_register_playwright.py")
            return False
        
        # 随机视口大小
        viewports = [
            (1920, 1080), (1366, 768), (1536, 864), (1440, 900),
            (1280, 720), (1600, 900), (1280, 800), (1680, 1050),
        ]
        width, height = random.choice(viewports)
        
        launch_options = {
            'headless': HEADLESS_MODE,
            'executablePath': chrome_path,
            'args': [
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                f'--window-size={width},{height}',
                '--disable-extensions',
                '--disable-plugins-discovery',
                '--disable-default-apps',
            ],
            'ignoreDefaultArgs': ['--enable-automation'],
            'autoClose': False,
            'handleSIGINT': False,  # 禁用信号处理，避免子线程报错
            'handleSIGTERM': False,
            'handleSIGHUP': False,
        }
        log(f"   使用 Chrome: {chrome_path}")
        log(f"   视口大小: {width}x{height}")
        
        browser = await launch(**launch_options)
        page = await browser.newPage()
        
        # 设置更真实的 User-Agent
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]
        await page.setUserAgent(random.choice(user_agents))
        
        # 应用 stealth 反检测（完整配置）
        await stealth(
            page,
            languages=["zh-CN", "zh", "en-US", "en"],
            vendor="Google Inc.",
            webgl_vendor="Intel Inc.",
            renderer="Intel Iris OpenGL Engine",
            run_on_insecure_origins=True,
        )
        
        # 注入更多反检测脚本
        await page.evaluateOnNewDocument('''() => {
            // 隐藏 webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // 隐藏自动化标志
            window.chrome = { runtime: {} };
            // 隐藏 Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        }''')
        
        await page.setViewport({'width': width, 'height': height})
        log("✅ 浏览器启动成功")

        log(f"⏳ 打开授权链接: {verification_uri_complete}")
        await page.goto(verification_uri_complete, {'waitUntil': 'networkidle0', 'timeout': 60000})
        await asyncio.sleep(3)

        # 等待邮箱页面
        log("⏳ 等待页面加载...")
        for i in range(60):
            if get_current_page_type(page.url) == 'email':
                log("✅ 已到达邮箱页面")
                break
            await asyncio.sleep(1)

        # 页面1: 输入邮箱
        log("📧 页面1: 输入邮箱")
        await page.waitForSelector("input[placeholder='username@example.com']", {'timeout': 20000})
        await random_delay(0.5, 1.5)
        await human_type(page, "input[placeholder='username@example.com']", email)
        log(f"✅ 已输入邮箱: {email}")
        await random_delay(0.3, 0.8)
        await human_click(page, "[data-testid='test-primary-button']")
        log("✅ 已点击'继续'")
        await random_delay(1.5, 3.0)
        if await check_page_error(page):
            log("❌ 邮箱提交失败")
            return False
        await page.waitForNavigation({'timeout': 30000})
        log("✅ 已跳转到姓名页")

        # 页面2: 输入用户名
        log("👤 页面2: 输入用户名")
        await page.waitForSelector("[data-testid='signup-full-name-input'] input", {'timeout': 15000})
        await random_delay(0.5, 1.5)
        await human_type(page, "[data-testid='signup-full-name-input'] input", username)
        log(f"✅ 已输入用户名: {username}")
        await random_delay(0.3, 0.8)
        await human_click(page, "[data-testid='signup-next-button']")
        log("✅ 已点击'继续'")
        await random_delay(1.5, 3.0)
        if await check_page_error(page):
            log("❌ 用户名提交失败")
            return False

        # 等待验证码页
        for i in range(30):
            if get_current_page_type(page.url) == 'verification':
                log("✅ 已跳转到验证码页")
                break
            await asyncio.sleep(1)

        # 页面3: 输入验证码
        log("🔢 页面3: 输入邮箱验证码")
        await page.waitForSelector("[data-testid='email-verification-form-code-input'] input", {'timeout': 30000})
        log("⏳ 等待验证码...")
        verification_code = mail_handler.get_verification_code(email, timeout=120, min_wait=10)
        if not verification_code:
            log("❌ 未能获取验证码")
            return False
        await random_delay(0.5, 1.5)
        await human_type(page, "[data-testid='email-verification-form-code-input'] input", verification_code)
        log(f"✅ 已输入验证码: {verification_code}")
        await random_delay(0.3, 0.8)
        await human_click(page, "[data-testid='email-verification-verify-button']")
        log("✅ 已点击'继续'")
        await random_delay(1.5, 3.0)
        if await check_page_error(page):
            log("❌ 验证码提交失败")
            return False

        # 页面4: 设置密码
        log("🔐 页面4: 设置密码")
        await page.waitForSelector("input[type='password']", {'timeout': 20000})
        await random_delay(0.5, 1.5)
        pwd_inputs = await page.querySelectorAll("input[type='password']")
        for inp in pwd_inputs:
            await inp.click()
            await asyncio.sleep(random.uniform(0.1, 0.3))
            await inp.type(password, {'delay': random.randint(30, 80)})
        log("✅ 已输入密码")
        await random_delay(0.3, 0.8)
        await human_click(page, "[data-testid='test-primary-button']")
        log("✅ 已点击'继续'")
        await random_delay(2.0, 4.0)

        # 页面5: 确认
        log("🔢 页面5: 确认并继续")
        for _ in range(30):
            try:
                btn = await page.querySelector("#cli_verification_btn")
                if btn:
                    await move_mouse_to_element(page, "#cli_verification_btn")
                    await random_delay(0.2, 0.5)
                    await btn.click()
                    log("✅ 已点击确认按钮")
                    break
            except:
                pass
            await asyncio.sleep(1)
        await random_delay(2.0, 4.0)

        # 页面6: 允许访问
        log("✅ 页面6: 允许访问")
        for _ in range(30):
            try:
                btn = await page.querySelector("[data-testid='allow-access-button']")
                if btn:
                    await move_mouse_to_element(page, "[data-testid='allow-access-button']")
                    await random_delay(0.2, 0.5)
                    await btn.click()
                    log("✅ 已点击'允许访问'")
                    await asyncio.sleep(1.5)  # 等待后端处理
                    break
            except:
                pass
            await asyncio.sleep(1)

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
                await browser.close()
                log("✅ 浏览器已关闭")
            except:
                pass


def register_single_account(account_num, total_accounts):
    """同步包装器"""
    # 在线程池中需要创建新的事件循环
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            register_single_account_async(account_num, total_accounts)
        )
    finally:
        loop.close()


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
    print("  Amazon Q Developer 批量自动注册 (Pyppeteer)")
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
