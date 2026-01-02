"""测试完整的注册流程：从 portal.sso 到发送 OTP"""
import requests
import json
import uuid
import time
import base64
import random
from urllib.parse import urlparse, parse_qs
from fingerprint import generate_fingerprint, generate_visitor_id, generate_ubid
from gptmail_service import GPTMailHandler

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
PORTAL_BASE = "https://portal.sso.us-east-1.amazonaws.com"
SIGNIN_BASE = "https://us-east-1.signin.aws"
PROFILE_BASE = "https://profile.aws.amazon.com"
DIRECTORY_ID = "d-9067642ac7"

def get_amz_date():
    return time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())

# 配置 session，使用更完整的浏览器请求头
session = requests.Session()
session.headers.update({
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
})

def make_headers(referer):
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': SIGNIN_BASE,
        'Referer': referer,
        'x-amzn-requestid': str(uuid.uuid4()),
        'x-amz-date': get_amz_date(),
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
    }

print("=" * 60)
print("完整注册流程测试（使用 GPTMail 真实邮箱）")
print("=" * 60)

# 生成真实邮箱
mail_handler = GPTMailHandler()
test_email = mail_handler.generate_email()
if not test_email:
    print("❌ 无法生成邮箱")
    exit(1)

visitor_id = generate_visitor_id()
ubid = generate_ubid()
print(f"测试邮箱: {test_email}")
print(f"visitorId: {visitor_id}")
print(f"ubid: {ubid}")

workflow_id = None  # 最终目标

# Step 1: 获取 workflowStateHandle
print("\n[Step 1] 获取 workflowStateHandle:")
r = session.get(f"{PORTAL_BASE}/login", params={'directory_id': 'view'}, 
                headers={'Origin': 'https://view.awsapps.com'}, timeout=30)
data = r.json()
wsh = parse_qs(urlparse(data['redirectUrl']).query)['workflowStateHandle'][0]
print(f"   ✅ workflowStateHandle: {wsh}")

# Step 2: 访问 signin 页面
print("\n[Step 2] 访问 signin 页面:")
login_url = f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/login?workflowStateHandle={wsh}"
r = session.get(login_url, timeout=30)
print(f"   ✅ Cookies: {list(session.cookies.keys())}")

# Step 2.5: 获取 signin 域的 awsd2c-token-c 并设置 awsccc
print("\n[Step 2.5] 获取 signin 域的 awsd2c-token-c 并设置 awsccc:")
signin_vid = None  # 初始化

# 先设置 awsccc cookie 到 signin.aws 域（在 token 请求之前）
from fingerprint import generate_awsccc_cookie
awsccc_value = generate_awsccc_cookie()
session.cookies.set('awsccc', awsccc_value, domain='us-east-1.signin.aws')
print(f"   ✅ awsccc 已设置到 signin.aws 域")

r = session.post("https://vs.aws.amazon.com/token", json={}, 
                 headers={
                     'Origin': SIGNIN_BASE, 
                     'Referer': login_url,
                     'Content-Type': 'application/json'
                 }, timeout=30)
if r.status_code == 200:
    token_data = r.json()
    signin_token = token_data.get('token', '')
    if signin_token:
        # 设置 awsd2c-token-c 到 signin.aws 域
        session.cookies.set('awsd2c-token-c', signin_token, domain='us-east-1.signin.aws')
        # 解析 token 获取 vid
        parts = signin_token.split('.')
        if len(parts) >= 2:
            payload = parts[1] + '=' * (4 - len(parts[1]) % 4)
            try:
                decoded = json.loads(base64.urlsafe_b64decode(payload))
                signin_vid = decoded.get('vid')
                print(f"   ✅ signin token vid: {signin_vid}")
            except:
                pass
        print(f"   ✅ awsd2c-token-c 已设置")
else:
    print(f"   ⚠️ 获取 signin token 失败: {r.status_code}")

# Step 3: 初始化 login 工作流
print("\n[Step 3] 初始化 login 工作流:")
headers = make_headers(login_url)
payload = {
    "stepId": "",
    "workflowStateHandle": wsh,
    "inputs": [{"input_type": "FingerPrintRequestInput", "fingerPrint": generate_fingerprint()}],
    "requestId": str(uuid.uuid4())
}
r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/api/execute",
                 headers=headers, json=payload, timeout=30)
data = r.json()
wsh = data['workflowStateHandle']
print(f"   ✅ stepId: {data['stepId']}, 新 wsh: {wsh[:30]}...")

# Step 4: 提交邮箱到 login
print("\n[Step 4] 提交邮箱到 login:")
payload = {
    "stepId": "start",
    "workflowStateHandle": wsh,
    "inputs": [
        {"input_type": "UserRequestInput", "username": test_email},
        {"input_type": "FingerPrintRequestInput", "fingerPrint": generate_fingerprint()}
    ],
    "requestId": str(uuid.uuid4())
}
headers = make_headers(login_url)
r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/api/execute",
                 headers=headers, json=payload, timeout=30)
data = r.json()
wsh = data['workflowStateHandle']
step_id = data['stepId']
action_list = data.get('actionIdList', [])
print(f"   ✅ stepId: {step_id}, actionIdList: {action_list}")

if 'SIGNUP' not in action_list:
    print("   ❌ 不是新用户，无法继续注册流程")
    exit(1)

# Step 5: 选择 SIGNUP 动作
print("\n[Step 5] 选择 SIGNUP 动作:")
payload = {
    "stepId": step_id,  # get-identity-user
    "workflowStateHandle": wsh,
    "actionId": "SIGNUP",
    "inputs": [
        {"input_type": "UserRequestInput", "username": test_email},
        {"input_type": "FingerPrintRequestInput", "fingerPrint": generate_fingerprint()}
    ],
    "visitorId": visitor_id,
    "requestId": str(uuid.uuid4())
}
headers = make_headers(login_url)
r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/api/execute",
                 headers=headers, json=payload, timeout=30)
print(f"   状态码: {r.status_code}")
print(f"   响应: {r.text[:500]}")

if r.status_code != 200:
    print("   ❌ 选择 SIGNUP 失败")
    exit(1)

data = r.json()
print(f"   完整响应: {json.dumps(data, indent=2)[:800]}")

# 检查 redirect 对象
redirect_obj = data.get('redirect', {})
redirect_url = redirect_obj.get('url') or data.get('postCreateRedirectUrl') or data.get('redirectUrl')
signup_wsh = None

if redirect_url:
    # 从 redirect URL 中提取 workflowStateHandle
    parsed = urlparse(redirect_url)
    params = parse_qs(parsed.query)
    if 'workflowStateHandle' in params:
        signup_wsh = params['workflowStateHandle'][0]
        print(f"   ✅ 从 redirect URL 提取 workflowStateHandle: {signup_wsh[:30]}...")
    elif 'workflowID' in params:
        workflow_id = params['workflowID'][0]
        print(f"   ✅ 从 redirect URL 提取 workflowID: {workflow_id}")

# 检查是否直接获取到 workflowID
if redirect_url and 'workflowID=' in redirect_url:
    parsed = urlparse(redirect_url)
    params = parse_qs(parsed.query)
    workflow_id = params.get('workflowID', [None])[0]
    print(f"   ✅ 直接获取到 workflowID: {workflow_id}")
elif signup_wsh:
    print(f"   ✅ 获取到 signup workflowStateHandle: {signup_wsh[:30]}...")
    wsh = signup_wsh
    
    # Step 6: 访问 signup 页面
    print("\n[Step 6] 访问 signup 页面:")
    signup_url = f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup?workflowStateHandle={wsh}"
    r = session.get(signup_url, timeout=30)
    print(f"   ✅ 访问成功")

    # Step 7: 初始化 signup 工作流
    print("\n[Step 7] 初始化 signup 工作流:")
    headers = make_headers(signup_url)
    payload = {
        "stepId": "",
        "workflowStateHandle": wsh,
        "inputs": [{"input_type": "FingerPrintRequestInput", "fingerPrint": generate_fingerprint()}],
        "requestId": str(uuid.uuid4())
    }
    r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup/api/execute",
                     headers=headers, json=payload, timeout=30)
    print(f"   状态码: {r.status_code}")
    print(f"   响应: {r.text[:500]}")

    if r.status_code == 200:
        data = r.json()
        if 'workflowStateHandle' in data:
            wsh = data['workflowStateHandle']
            print(f"   ✅ stepId: {data.get('stepId')}, 新 wsh: {wsh[:30]}...")

    # Step 8: 提交邮箱到 signup
    print("\n[Step 8] 提交邮箱到 signup:")
    payload = {
        "stepId": "start",
        "workflowStateHandle": wsh,
        "inputs": [
            {"input_type": "UserRequestInput", "username": test_email},
            {"input_type": "FingerPrintRequestInput", "fingerPrint": generate_fingerprint()}
        ],
        "visitorId": visitor_id,
        "requestId": str(uuid.uuid4())
    }
    headers = make_headers(signup_url)
    r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup/api/execute",
                     headers=headers, json=payload, timeout=30)
    print(f"   状态码: {r.status_code}")
    print(f"   响应: {r.text[:500]}")

    if r.status_code == 200:
        data = r.json()
        print(f"   完整响应: {json.dumps(data, indent=2)[:600]}")
        
        # 从 redirect 对象或直接字段中提取 URL
        redirect_obj = data.get('redirect', {})
        redirect_url = redirect_obj.get('url') or data.get('postCreateRedirectUrl') or data.get('redirectUrl')
        
        if redirect_url and 'workflowID=' in redirect_url:
            # URL 可能包含 # fragment，需要特殊处理
            # 例如: https://profile.aws.amazon.com/#/signup/start?workflowID=xxx
            import re
            match = re.search(r'workflowID=([a-f0-9-]+)', redirect_url)
            if match:
                workflow_id = match.group(1)
                print(f"   ✅ 获取到 workflowID: {workflow_id}")
        else:
            print(f"   ⚠️ 未找到 workflowID，redirect_url: {redirect_url}")
else:
    print(f"   ⚠️ 未获取到 workflowStateHandle 或 workflowID")
    print(f"   响应: {json.dumps(data)[:500]}")
    exit(1)

# 如果获取到 workflowID，继续后续流程
if workflow_id:
    # Step 9: 获取 awsd2c-token
    print("\n[Step 9] 获取 awsd2c-token:")
    
    # 先访问 profile 页面获取必要的 cookies
    profile_url = f"{PROFILE_BASE}/?workflowID={workflow_id}#/signup/start"
    r = session.get(profile_url, headers={
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': signup_url
    }, timeout=30)
    print(f"   访问 profile 页面: {r.status_code}")
    print(f"   当前 Cookies: {dict(session.cookies)}")
    
    # 获取 token
    r = session.post("https://vs.aws.amazon.com/token", json={}, 
                     headers={
                         'Origin': PROFILE_BASE, 
                         'Referer': profile_url,
                         'Content-Type': 'application/json'
                     }, timeout=30)
    print(f"   token 请求状态码: {r.status_code}")
    # 打印所有 Set-Cookie 响应头
    print(f"   token 响应头 (所有):")
    for key, value in r.headers.items():
        if 'cookie' in key.lower():
            print(f"      {key}: {value[:150]}...")
    # 检查 raw headers
    print(f"   token 响应 raw headers:")
    if hasattr(r.raw, '_original_response'):
        for header in r.raw._original_response.headers.items():
            if 'cookie' in header[0].lower():
                print(f"      {header[0]}: {header[1][:150]}...")
    token_vid = None
    awsd2c_token_value = None
    if r.status_code == 200:
        token_data = r.json()
        print(f"   ✅ 获取 token 成功")
        print(f"   token 响应: {json.dumps(token_data)[:300]}")
        # 解析 JWT token 获取 vid
        import base64
        token = token_data.get('token', '')
        awsd2c_token_value = token  # 保存 token 值
        if token:
            parts = token.split('.')
            if len(parts) >= 2:
                # 解码 payload
                payload = parts[1]
                # 添加 padding
                payload += '=' * (4 - len(payload) % 4)
                try:
                    decoded = json.loads(base64.urlsafe_b64decode(payload))
                    token_vid = decoded.get('vid')
                    print(f"   token 中的 vid: {token_vid}")
                except:
                    pass
        print(f"   更新后 Cookies: {list(session.cookies.keys())}")
        
        # 注意：不再设置 awsd2c-token-c，因为 Step 2.5 已经设置了正确的 signin.aws 域的 cookie
    
    # Step 10: 启动 profile 注册流程
    print("\n[Step 10] 启动 profile 注册流程:")
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    
    # 使用 token 中的 vid 作为 visitorId
    actual_visitor_id = token_vid if token_vid else visitor_id
    print(f"   使用 visitorId: {actual_visitor_id}")
    
    browser_data = {
        "attributes": {
            "fingerprint": generate_fingerprint(workflow_id=workflow_id, ubid=ubid),
            "eventTimestamp": timestamp,
            "timeSpentOnPage": "60",
            "eventType": "PageLoad",
            "ubid": ubid,
            "visitorId": actual_visitor_id
        },
        "cookies": {}
    }
    
    payload = {
        "workflowID": workflow_id,
        "browserData": browser_data
    }
    
    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'Origin': PROFILE_BASE,
        'Referer': f"{PROFILE_BASE}/?workflowID={workflow_id}",
    }
    
    r = session.post(f"{PROFILE_BASE}/api/start", headers=headers, json=payload, timeout=30)
    print(f"   状态码: {r.status_code}")
    print(f"   响应: {r.text[:500]}")
    
    if r.status_code == 200:
        data = r.json()
        workflow_state = data.get('workflowState')
        print(f"   ✅ workflowState: {workflow_state[:50] if workflow_state else 'N/A'}...")
        
        # Step 11: 发送 OTP
        print("\n[Step 11] 发送 OTP:")
        print(f"   当前 Cookies: {list(session.cookies.keys())}")
        
        # 重新构造 browserData，使用正确的 eventType 和 pageName
        time_spent = random.randint(5000, 8000)
        otp_browser_data = {
            "attributes": {
                "fingerprint": generate_fingerprint(workflow_id=workflow_id, ubid=ubid, time_spent=time_spent),
                "eventTimestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "timeSpentOnPage": str(time_spent),
                "pageName": "EMAIL_COLLECTION",
                "eventType": "PageSubmit",
                "ubid": ubid,
                "visitorId": actual_visitor_id
            },
            "cookies": {}
        }
        
        # 添加缺失的 cookies（awsccc 已在 Step 2.5 设置到 signin.aws 域）
        session.cookies.set('i18next', 'zh-CN', domain='profile.aws.amazon.com')
        session.cookies.set('aws-user-profile-ubid', ubid, domain='profile.aws.amazon.com')
        # 同时设置 awsccc 到 profile 域（用于 profile.aws.amazon.com 请求）
        session.cookies.set('awsccc', awsccc_value, domain='profile.aws.amazon.com')
        
        payload = {
            "workflowState": workflow_state,
            "email": test_email,
            "browserData": otp_browser_data
        }
        
        # 使用更完整的请求头
        otp_headers = {
            'Content-Type': 'application/json;charset=UTF-8',
            'Origin': PROFILE_BASE,
            'Referer': f"{PROFILE_BASE}/?workflowID={workflow_id}",
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        }
        r = session.post(f"{PROFILE_BASE}/api/send-otp", headers=otp_headers, json=payload, timeout=30)
        print(f"   状态码: {r.status_code}")
        print(f"   响应: {r.text[:500]}")
        
        if r.status_code == 200:
            print(f"\n   🎉 OTP 已发送到 {test_email}")
            
            # Step 12: 等待并获取验证码
            print("\n[Step 12] 等待验证码:")
            print(f"   等待邮件到达...")
            otp_code = mail_handler.get_verification_code(test_email, timeout=120)
            
            if not otp_code:
                print("   ❌ 未能获取验证码")
                exit(1)
            
            print(f"   ✅ 获取到验证码: {otp_code}")
            
            # Step 13: 创建账号 (create-identity)
            print("\n[Step 13] 创建账号:")
            
            # 生成随机用户名
            full_name = f"User{random.randint(1000, 9999)}"
            
            time_spent = random.randint(10000, 20000)
            create_browser_data = {
                "attributes": {
                    "fingerprint": generate_fingerprint(workflow_id=workflow_id, ubid=ubid, time_spent=time_spent),
                    "eventTimestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                    "timeSpentOnPage": str(time_spent),
                    "pageName": "EMAIL_VERIFICATION",
                    "eventType": "EmailVerification",
                    "ubid": ubid,
                    "visitorId": actual_visitor_id
                },
                "cookies": {}
            }
            
            create_payload = {
                "workflowState": workflow_state,
                "userData": {
                    "email": test_email,
                    "fullName": full_name
                },
                "otpCode": otp_code,
                "browserData": create_browser_data
            }
            
            r = session.post(f"{PROFILE_BASE}/api/create-identity", 
                           headers=otp_headers, json=create_payload, timeout=30)
            print(f"   状态码: {r.status_code}")
            print(f"   响应: {r.text[:500]}")
            
            if r.status_code == 200:
                create_data = r.json()
                registration_code = create_data.get('registrationCode')
                sign_in_state = create_data.get('signInState')
                print(f"   ✅ registrationCode: {registration_code}")
                print(f"   ✅ signInState: {sign_in_state[:50] if sign_in_state else 'N/A'}...")
                
                # Step 14: 访问注册完成页面并提交 registrationCode
                print("\n[Step 14] 提交 registrationCode:")
                
                # 访问 signup 页面（包含 state 参数）
                from urllib.parse import quote
                signup_complete_url = f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup?registrationCode={registration_code}&state={quote(sign_in_state)}"
                r = session.get(signup_complete_url, timeout=30)
                print(f"   访问 signup 页面: {r.status_code}")
                
                # 提交 registrationCode
                signup_headers = make_headers(signup_complete_url)
                signup_payload = {
                    "stepId": "",
                    "state": sign_in_state,
                    "inputs": [
                        {
                            "input_type": "UserRegistrationRequestInput",
                            "registrationCode": registration_code,
                            "state": sign_in_state
                        },
                        {
                            "input_type": "FingerPrintRequestInput",
                            "fingerPrint": generate_fingerprint()
                        }
                    ],
                    "requestId": str(uuid.uuid4())
                }
                
                r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup/api/execute",
                               headers=signup_headers, json=signup_payload, timeout=30)
                print(f"   状态码: {r.status_code}")
                print(f"   响应: {r.text[:800]}")
                
                if r.status_code == 200:
                    pwd_data = r.json()
                    pwd_step_id = pwd_data.get('stepId')
                    pwd_wsh = pwd_data.get('workflowStateHandle')
                    
                    # 获取 RSA 公钥和加密上下文
                    encryption_context = pwd_data.get('workflowResponseData', {}).get('encryptionContextResponse', {})
                    public_key = encryption_context.get('publicKey', {})
                    enc_issuer = encryption_context.get('issuer', 'signin')
                    enc_region = encryption_context.get('region', 'us-east-1')
                    enc_audience = encryption_context.get('audience', 'AWSPasswordService')
                    
                    print(f"   ✅ stepId: {pwd_step_id}")
                    print(f"   ✅ 获取到 RSA 公钥: kid={public_key.get('kid')}")
                    n_value = public_key.get('n', '')
                    print(f"   公钥 n 长度: {len(n_value)}")
                    print(f"   公钥 n 前50字符: {n_value[:50]}")
                    print(f"   公钥 n 后50字符: {n_value[-50:]}")
                    print(f"   加密上下文: issuer={enc_issuer}, region={enc_region}, audience={enc_audience}")
                    
                    if pwd_step_id == 'get-new-password-for-password-creation' and public_key:
                        # Step 14.5: 发送中间请求（send-event 和 fingerprint）
                        print("\n[Step 14.5] 发送中间请求:")
                        
                        # 14.5a: 发送 PAGE_LOAD 事件
                        event_payload = {
                            "inputs": [
                                {
                                    "input_type": "UserEventRequestInput",
                                    "directoryId": DIRECTORY_ID,
                                    "userName": test_email,
                                    "userEvents": [
                                        {
                                            "input_type": "UserEvent",
                                            "eventType": "PAGE_LOAD",
                                            "pageName": "CREDENTIAL_COLLECTION"
                                        }
                                    ]
                                },
                                {
                                    "input_type": "FingerPrintRequestInput",
                                    "fingerPrint": generate_fingerprint(workflow_id=workflow_id, ubid=ubid)
                                }
                            ],
                            "requestId": str(uuid.uuid4())
                        }
                        
                        event_headers = {
                            'Content-Type': 'application/json; charset=UTF-8',
                            'Accept': 'application/json, text/plain, */*',
                            'Origin': SIGNIN_BASE,
                            'Referer': signup_complete_url,
                        }
                        
                        r = session.post(f"{SIGNIN_BASE}/platform/user-event/send-event",
                                       headers=event_headers, json=event_payload, timeout=30)
                        print(f"   send-event 状态码: {r.status_code}")
                        
                        # 14.5b: 发送 fingerprint 指标
                        fp_value = generate_fingerprint(workflow_id=workflow_id, ubid=ubid)
                        fp_data = f"name=IsFingerprintGenerated:Success&value={fp_value}"
                        
                        fp_headers = {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'Accept': '*/*',
                            'Origin': SIGNIN_BASE,
                            'Referer': signup_complete_url,
                        }
                        
                        r = session.post(f"{SIGNIN_BASE}/metrics/fingerprint",
                                       headers=fp_headers, data=fp_data, timeout=30)
                        print(f"   fingerprint 状态码: {r.status_code}")
                        
                        # Step 15: 设置密码
                        print("\n[Step 15] 设置密码:")
                        
                        # 生成随机密码（格式：Xxx-xxx-xxx-xXx）
                        import string
                        def gen_part(length, has_upper=False):
                            chars = string.ascii_lowercase + string.digits
                            part = ''.join(random.choice(chars) for _ in range(length))
                            if has_upper:
                                # 随机位置替换为大写
                                pos = random.randint(0, length-1)
                                part = part[:pos] + part[pos].upper() + part[pos+1:]
                            return part
                        
                        password = f"{gen_part(3, True)}-enc-{gen_part(3)}-{gen_part(3, True)}"
                        print(f"   生成密码: {password}")
                        
                        # 加密密码（使用 JWE，JWT 格式明文）
                        from password_encrypt import encrypt_password_jwe
                        encrypted_password = encrypt_password_jwe(
                            password, 
                            public_key,
                            issuer=enc_issuer,
                            audience=enc_audience,
                            region=enc_region
                        )
                        
                        if not encrypted_password:
                            print("   ❌ 密码加密失败")
                            exit(1)
                        
                        print(f"   ✅ 密码已加密")
                        print(f"   JWE 长度: {len(encrypted_password)}")
                        jwe_parts = encrypted_password.split('.')
                        print(f"   JWE 各部分长度: Header={len(jwe_parts[0])}, EncKey={len(jwe_parts[1])}, IV={len(jwe_parts[2])}, CT={len(jwe_parts[3])}, Tag={len(jwe_parts[4])}")
                        
                        # 更新请求头，使用正确的 Referer
                        pwd_headers = make_headers(signup_complete_url)
                        
                        # 提交密码
                        pwd_payload = {
                            "stepId": pwd_step_id,
                            "workflowStateHandle": pwd_wsh,
                            "actionId": "SUBMIT",
                            "inputs": [
                                {
                                    "input_type": "PasswordRequestInput",
                                    "password": encrypted_password,
                                    "successfullyEncrypted": "SUCCESSFUL",
                                    "errorLog": ""
                                },
                                {
                                    "input_type": "UserEventRequestInput",
                                    "directoryId": DIRECTORY_ID,
                                    "userName": test_email,
                                    "userEvents": [
                                        {
                                            "input_type": "UserEvent",
                                            "eventType": "PAGE_SUBMIT",
                                            "pageName": "CREDENTIAL_COLLECTION",
                                            "timeSpentOnPage": random.randint(5000, 10000)
                                        }
                                    ]
                                },
                                {
                                    "input_type": "UserRequestInput",
                                    "username": test_email
                                },
                                {
                                    "input_type": "FingerPrintRequestInput",
                                    "fingerPrint": generate_fingerprint(workflow_id=workflow_id, ubid=ubid)
                                }
                            ],
                            "visitorId": signin_vid if signin_vid else actual_visitor_id,
                            "requestId": str(uuid.uuid4())
                        }
                        
                        # 调试：打印请求体（不含长字符串）
                        print(f"   visitorId: {pwd_payload['visitorId']}")
                        print(f"   signin_vid: {signin_vid}")
                        print(f"   Cookies: {list(session.cookies.keys())}")
                        
                        # 使用紧凑格式的 JSON（无空格），与浏览器行为一致
                        pwd_headers['Content-Type'] = 'application/json; charset=UTF-8'
                        pwd_body = json.dumps(pwd_payload, separators=(',', ':'))
                        
                        r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/signup/api/execute",
                                       headers=pwd_headers, data=pwd_body, timeout=30)
                        print(f"   状态码: {r.status_code}")
                        # 解码响应（处理 UTF-8）
                        try:
                            resp_text = r.text
                            print(f"   响应: {resp_text[:800]}")
                        except:
                            print(f"   响应 (bytes): {r.content[:500]}")
                        
                        if r.status_code == 200:
                            final_data = r.json()
                            final_step_id = final_data.get('stepId')
                            
                            if final_step_id == 'end-of-user-registration-success':
                                print(f"\n   🎉🎉🎉 注册成功！")
                                print(f"   邮箱: {test_email}")
                                print(f"   密码: {password}")
                                print(f"   用户名: {full_name}")
                                
                                # 立即保存账号信息（不等 Token）
                                import os
                                accounts_file = "registered_accounts.json"
                                accounts = []
                                if os.path.exists(accounts_file):
                                    with open(accounts_file, 'r', encoding='utf-8') as f:
                                        accounts = json.load(f)
                                
                                account_info = {
                                    "email": test_email,
                                    "password": password,
                                    "full_name": full_name,
                                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
                                }
                                accounts.append(account_info)
                                
                                with open(accounts_file, 'w', encoding='utf-8') as f:
                                    json.dump(accounts, f, indent=2, ensure_ascii=False)
                                print(f"   ✅ 账号已保存到 {accounts_file}")
                                
                                # Step 16: 完成登录流程（获取 Token）
                                print("\n[Step 16] 完成登录流程:")
                                login_redirect = final_data.get('redirect', {}).get('url')
                                if login_redirect:
                                    print(f"   redirect URL: {login_redirect[:100]}...")
                                    
                                    # 从 URL 提取参数
                                    parsed = urlparse(login_redirect)
                                    params = parse_qs(parsed.query)
                                    login_wsh = params.get('workflowStateHandle', [None])[0]
                                    workflow_result_handle = params.get('workflowResultHandle', [None])[0]
                                    state_param = params.get('state', [None])[0]
                                    
                                    print(f"   login_wsh: {login_wsh[:30] if login_wsh else 'N/A'}...")
                                    print(f"   workflowResultHandle: {workflow_result_handle[:30] if workflow_result_handle else 'N/A'}...")
                                    print(f"   state: {state_param[:30] if state_param else 'N/A'}...")
                                    
                                    # 访问登录 redirect（让浏览器设置 cookies）
                                    r = session.get(login_redirect, timeout=30)
                                    print(f"   访问 redirect: {r.status_code}")
                                    
                                    if login_wsh and workflow_result_handle:
                                        # 一次性完成登录（HAR 显示所有参数一起发送）
                                        login_headers = make_headers(login_redirect)
                                        login_payload = {
                                            "stepId": "",
                                            "workflowStateHandle": login_wsh,
                                            "workflowResultHandle": workflow_result_handle,
                                            "inputs": [
                                                {"input_type": "UserRequestInput", "username": test_email},
                                                {"input_type": "FingerPrintRequestInput", "fingerPrint": generate_fingerprint()}
                                            ],
                                            "visitorId": signin_vid if signin_vid else actual_visitor_id,
                                            "requestId": str(uuid.uuid4())
                                        }
                                        # 添加 state 参数
                                        if state_param:
                                            login_payload["state"] = state_param
                                        
                                        print(f"   登录请求 payload: stepId='', wsh={login_wsh[:20]}..., wrh={workflow_result_handle[:20]}...")
                                        
                                        r = session.post(f"{SIGNIN_BASE}/platform/{DIRECTORY_ID}/api/execute",
                                                       headers=login_headers, json=login_payload, timeout=30)
                                        print(f"   登录请求: {r.status_code}")
                                        print(f"   响应: {r.text[:500]}")
                                        
                                        if r.status_code == 200:
                                            token_data = r.json()
                                            
                                            # 检查是否有 token
                                            workflow_response = token_data.get('workflowResponseData', {})
                                            sso_token = workflow_response.get('ssoToken', {})
                                            
                                            if sso_token:
                                                access_token = sso_token.get('accessToken')
                                                refresh_token = sso_token.get('refreshToken')
                                                expires_in = sso_token.get('expiresIn')
                                                
                                                print(f"\n   🎉 获取到 Token！")
                                                print(f"   accessToken: {access_token[:50] if access_token else 'N/A'}...")
                                                print(f"   refreshToken: {refresh_token[:50] if refresh_token else 'N/A'}...")
                                                print(f"   expiresIn: {expires_in}")
                                                
                                                # 更新已保存的账号信息（添加 Token）
                                                print("\n[Step 17] 更新账号 Token:")
                                                accounts = []
                                                if os.path.exists(accounts_file):
                                                    with open(accounts_file, 'r', encoding='utf-8') as f:
                                                        accounts = json.load(f)
                                                
                                                # 找到刚保存的账号并更新
                                                for acc in accounts:
                                                    if acc.get('email') == test_email:
                                                        acc['access_token'] = access_token
                                                        acc['refresh_token'] = refresh_token
                                                        acc['expires_in'] = expires_in
                                                        break
                                                
                                                with open(accounts_file, 'w', encoding='utf-8') as f:
                                                    json.dump(accounts, f, indent=2, ensure_ascii=False)
                                                
                                                print(f"   ✅ Token 已更新到 {accounts_file}")
                                            else:
                                                # 可能需要继续其他步骤
                                                print(f"   响应中无 ssoToken，可能需要继续流程")
                                                print(f"   stepId: {token_data.get('stepId')}")
                                                
                                                # 检查是否有 redirect
                                                next_redirect = token_data.get('redirect', {}).get('url')
                                                if next_redirect:
                                                    print(f"   下一步 redirect: {next_redirect[:80]}...")
                            else:
                                print(f"   ⚠️ 意外的 stepId: {final_step_id}")
                        else:
                            print(f"   ❌ 设置密码失败")
                    else:
                        print(f"   ⚠️ 意外的 stepId: {pwd_step_id}")
            else:
                print(f"   ❌ 创建账号失败")
else:
    print("\n   ❌ 未能获取 workflowID，流程终止")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
