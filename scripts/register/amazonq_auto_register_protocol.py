"""
Amazon Q Developer 批量自动注册脚本 (纯协议版本)
不使用浏览器，直接通过 HTTP 请求模拟注册流程

依赖安装:
    pip install requests

使用方法:
    python amazonq_auto_register_protocol.py           # 默认注册 1 个账号
    python amazonq_auto_register_protocol.py 5         # 注册 5 个账号
"""

import json
import time
import uuid
import os
import sys
import random
import threading
from typing import Dict, Tuple, Optional
from urllib.parse import urlparse, parse_qs, urlencode

import requests
from gptmail_service import GPTMailHandler
from config import DEFAULT_BATCH_COUNT
from fingerprint import generate_fingerprint, generate_visitor_id, generate_ubid, generate_awsccc_cookie

# 常量
OIDC_BASE = "https://oidc.us-east-1.amazonaws.com"
START_URL = "https://view.awsapps.com/start"
SIGNIN_BASE = "https://us-east-1.signin.aws"
PROFILE_BASE = "https://profile.aws.amazon.com"
DIRECTORY_ID = "d-9067642ac7"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def make_oidc_headers() -> Dict[str, str]:
    return {
        "content-type": "application/json",
        "user-agent": "aws-sdk-rust/1.3.9 os/windows lang/rust/1.87.0",
        "amz-sdk-request": "attempt=1; max=3",
        "amz-sdk-invocation-id": str(uuid.uuid4()),
    }


def register_oidc_client() -> Tuple[str, str]:
    """注册 OIDC 客户端"""
    payload = {
        "clientName": "Amazon Q Developer for command line",
        "clientType": "public",
        "scopes": ["codewhisperer:completions", "codewhisperer:analysis", "codewhisperer:conversations"],
    }
    r = requests.post(f"{OIDC_BASE}/client/register", headers=make_oidc_headers(), json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["clientId"], data["clientSecret"]


def device_authorize(client_id: str, client_secret: str) -> Dict:
    """设备授权"""
    payload = {"clientId": client_id, "clientSecret": client_secret, "startUrl": START_URL}
    r = requests.post(f"{OIDC_BASE}/device_authorization", headers=make_oidc_headers(), json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


def poll_token(client_id, client_secret, device_code, interval, expires_in, max_timeout=300) -> Dict:
    """轮询获取 Token"""
    payload = {
        "clientId": client_id,
        "clientSecret": client_secret,
        "deviceCode": device_code,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
    }
    deadline = time.time() + min(expires_in, max_timeout)
    while time.time() < deadline:
        r = requests.post(f"{OIDC_BASE}/token", headers=make_oidc_headers(), json=payload, timeout=30)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 400:
            err = r.json()
            if err.get("error") == "authorization_pending":
                time.sleep(interval)
                continue
        r.raise_for_status()
    raise TimeoutError("Token 轮询超时")


class AWSBuilderIDSession:
    """AWS Builder ID 注册会话（纯协议）"""
    
    def __init__(self, log_func=print):
        self.session = requests.Session()
        self.log = log_func
        self.visitor_id = generate_visitor_id()
        self.ubid = generate_ubid()
        self.workflow_id = None
        self.workflow_state_handle = None
        self._init_session()
    
    def _init_session(self):
        """初始化会话"""
        self.session.headers.update({
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })
        # 设置基础 cookies
        self.session.cookies.set('awsccc', generate_awsccc_cookie(), domain='.aws.amazon.com')
        self.session.cookies.set('i18next', 'zh-CN', domain='.aws.amazon.com')
    
    def _make_request_id(self) -> str:
        return str(uuid.uuid4())
    
    def _get_amz_date(self) -> str:
        return time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    
    def start_signin_workflow(self, workflow_state_handle: str) -> bool:
        """启动 signin 工作流"""
        self.log("📋 启动 signin 工作流...")
        self.workflow_state_handle = workflow_state_handle
        
        # 访问 signin 页面获取 cookies
        url = f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/login?workflowStateHandle={workflow_state_handle}"
        r = self.session.get(url, timeout=30)
        if r.status_code != 200:
            self.log(f"   ❌ 访问 signin 页面失败: {r.status_code}")
            return False
        
        self.log(f"   ✅ 获取 signin cookies")
        
        # 调用 /api/execute 初始化工作流
        fingerprint = generate_fingerprint()
        payload = {
            "stepId": "",
            "workflowStateHandle": workflow_state_handle,
            "inputs": [
                {"input_type": "FingerPrintRequestInput", "fingerPrint": fingerprint}
            ],
            "requestId": self._make_request_id()
        }
        
        headers = {
            'Content-Type': 'application/json; charset=UTF-8',
            'Origin': SIGNIN_BASE,
            'Referer': url,
            'x-amzn-requestid': self._make_request_id(),
            'x-amz-date': self._get_amz_date(),
        }
        
        r = self.session.post(
            f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/api/execute",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if r.status_code != 200:
            self.log(f"   ❌ 初始化工作流失败: {r.status_code} - {r.text[:200]}")
            return False
        
        self.log(f"   ✅ 工作流初始化成功")
        return True
    
    def start_signup_workflow(self, email: str) -> Optional[str]:
        """启动注册工作流，返回 workflowID"""
        self.log(f"📝 启动注册工作流: {email}")
        
        # 获取新的 workflowStateHandle（用于 signup）
        # 先访问 signup 页面
        signup_url = f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup?workflowStateHandle={self.workflow_state_handle}"
        r = self.session.get(signup_url, timeout=30)
        
        # 调用 signup/api/execute 提交邮箱
        fingerprint = generate_fingerprint()
        payload = {
            "stepId": "",
            "workflowStateHandle": self.workflow_state_handle,
            "inputs": [
                {"input_type": "UserRequestInput", "username": email},
                {"input_type": "FingerPrintRequestInput", "fingerPrint": fingerprint}
            ],
            "visitorId": self.visitor_id,
            "requestId": self._make_request_id()
        }
        
        headers = {
            'Content-Type': 'application/json; charset=UTF-8',
            'Origin': SIGNIN_BASE,
            'Referer': signup_url,
            'x-amzn-requestid': self._make_request_id(),
            'x-amz-date': self._get_amz_date(),
        }
        
        r = self.session.post(
            f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup/api/execute",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if r.status_code != 200:
            self.log(f"   ❌ 提交邮箱失败: {r.status_code} - {r.text[:300]}")
            return None
        
        # 解析响应获取 workflowID
        try:
            data = r.json()
            self.log(f"   响应: {json.dumps(data)[:300]}")
            
            # 查找重定向 URL 中的 workflowID
            redirect_url = data.get('redirectUrl') or data.get('postCreateRedirectUrl')
            if redirect_url and 'workflowID=' in redirect_url:
                parsed = urlparse(redirect_url)
                params = parse_qs(parsed.query)
                self.workflow_id = params.get('workflowID', [None])[0]
                if self.workflow_id:
                    self.log(f"   ✅ 获取 workflowID: {self.workflow_id}")
                    return self.workflow_id
            
            # 尝试从响应中直接获取
            if 'workflowID' in data:
                self.workflow_id = data['workflowID']
                self.log(f"   ✅ 获取 workflowID: {self.workflow_id}")
                return self.workflow_id
                
        except Exception as e:
            self.log(f"   ❌ 解析响应失败: {e}")
        
        return None


file_lock = threading.Lock()
oidc_lock = threading.Lock()


def set_headless_mode(enabled: bool):
    print("🖥️  协议模式: 无需浏览器")


def save_account(email, password, client_id, client_secret, refresh_token, access_token):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_file = os.path.join(script_dir, "registered_accounts.json")
    account = {
        "email": email, "password": password, "accessToken": access_token,
        "refreshToken": refresh_token, "clientId": client_id, "clientSecret": client_secret,
        "region": "us-east-1", "provider": "BuilderId", "machineId": str(uuid.uuid4())
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
    mail_handler = None
    def log(msg):
        print(f"[窗口 {account_num}] {msg}")
    
    log("=" * 50)
    log(f"🎯 开始注册账号 {account_num}/{total_accounts}")
    log("=" * 50)

    log("步骤1: 创建临时邮箱...")
    mail_handler = GPTMailHandler(log_prefix=f"[窗口 {account_num}]")
    email = mail_handler.generate_email()
    if not email:
        log("❌ 创建邮箱失败")
        return False
    log(f"✅ 邮箱: {email}")

    first_names = ["James", "John", "Robert", "Michael", "David"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones"]
    username = f"{random.choice(first_names)} {random.choice(last_names)}"
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*'
    password = random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + random.choice('abcdefghijklmnopqrstuvwxyz') + random.choice('0123456789') + random.choice('!@#$%&*') + ''.join(random.choices(chars, k=8))
    log(f"👤 用户名: {username}, 🔑 密码: {password}")

    log("步骤2: 调用 AWS Device Authorization API")
    try:
        with oidc_lock:
            client_id, client_secret = register_oidc_client()
            device_auth = device_authorize(client_id, client_secret)
        device_code = device_auth['deviceCode']
        user_code = device_auth['userCode']
        interval = device_auth.get('interval', 5)
        expires_in = device_auth.get('expiresIn', 600)
        verification_uri = device_auth['verificationUriComplete']
        log(f"✅ 设备授权成功, 用户代码: {user_code}")
        log(f"   验证 URL: {verification_uri}")
    except Exception as e:
        log(f"❌ Device Authorization 失败: {e}")
        return False

    log("步骤3: 开始协议注册流程")
    try:
        session = AWSBuilderIDSession(log)
        
        # 从 verification URL 中提取 user_code
        # 需要模拟访问 view.awsapps.com 获取 workflowStateHandle
        # 这是一个 SPA，需要分析其 API
        
        # 暂时使用随机 workflowStateHandle 测试
        workflow_state_handle = str(uuid.uuid4())
        
        if not session.start_signin_workflow(workflow_state_handle):
            log("❌ 启动 signin 工作流失败")
            return False
        
        workflow_id = session.start_signup_workflow(email)
        if not workflow_id:
            log("❌ 获取 workflowID 失败")
            return False
        
        # TODO: 继续完成后续步骤
        log("⚠️ 协议版本开发中，后续步骤待实现")
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


def main():
    batch_count = DEFAULT_BATCH_COUNT
    if len(sys.argv) > 1:
        try:
            batch_count = int(sys.argv[1])
        except:
            print(f"使用方法: python {sys.argv[0]} [数量]")
            return

    print("\n" + "🤖" * 30)
    print("  Amazon Q Developer 批量自动注册 (协议版本)")
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
            time.sleep(2)

    print(f"\n📊 完成: 成功 {success_count}, 失败 {fail_count}")


if __name__ == "__main__":
    main()
