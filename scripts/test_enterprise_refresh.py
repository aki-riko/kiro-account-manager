#!/usr/bin/env python3
"""测试 Enterprise Token 刷新"""

import json
import requests
from pathlib import Path

# 读取测试数据
token_file = Path(__file__).parent.parent / "docs/templates/Enterprise/kiro-auth-token.json"
client_file = Path(__file__).parent.parent / "docs/templates/Enterprise/9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53.json"

with open(token_file, 'r', encoding='utf-8') as f:
    token_data = json.load(f)

with open(client_file, 'r', encoding='utf-8') as f:
    client_data = json.load(f)

# 提取参数
refresh_token = token_data['refreshToken']
region = token_data['region']
client_id = client_data['clientId']
client_secret = client_data['clientSecret']

print(f"Region: {region}")
print(f"Client ID: {client_id[:20]}...")
print(f"Refresh Token: {refresh_token[:50]}...")
print()

# 构建请求
url = f"https://oidc.{region}.amazonaws.com/token"
headers = {
    "Content-Type": "application/json",
    "x-amz-user-agent": "aws-sdk-js/3.738.0 KiroIDE",
    "user-agent": "aws-sdk-js/3.738.0 ua/2.1 os/win32#10.0.26100 lang/js md/nodejs#22.21.1 api/sso-oidc#3.738.0 m/E KiroIDE"
}

# 使用驼峰命名（与 Kiro IDE 一致）
body = {
    "clientId": client_id,
    "clientSecret": client_secret,
    "grantType": "refresh_token",
    "refreshToken": refresh_token
}

print("发送请求...")
print(f"URL: {url}")
print(f"Body: {json.dumps(body, indent=2)}")
print()

try:
    response = requests.post(url, headers=headers, json=body, timeout=30)
    
    print(f"状态码: {response.status_code}")
    print(f"响应头: {dict(response.headers)}")
    print()
    
    if response.status_code == 200:
        result = response.json()
        print("✅ 刷新成功！")
        print(f"Access Token: {result.get('accessToken', '')[:50]}...")
        print(f"Refresh Token: {result.get('refreshToken', '')[:50]}...")
        print(f"Expires In: {result.get('expiresIn')} 秒")
    else:
        print("❌ 刷新失败！")
        print(f"响应内容: {response.text}")
        
except Exception as e:
    print(f"❌ 请求失败: {e}")
