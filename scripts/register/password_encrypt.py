"""
AWS 密码加密模块
使用 JWE (JSON Web Encryption) 格式加密密码
算法: RSA-OAEP-256 + AES-256-GCM
"""

import json
import base64
import os
from typing import Dict, Optional

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    import struct
except ImportError:
    print("需要安装 cryptography 库: pip install cryptography")
    exit(1)


def base64url_encode(data: bytes) -> str:
    """Base64 URL 安全编码（无填充）"""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def base64url_decode(data: str) -> bytes:
    """Base64 URL 安全解码"""
    # 添加填充
    padding_needed = 4 - len(data) % 4
    if padding_needed != 4:
        data += '=' * padding_needed
    return base64.urlsafe_b64decode(data)


def jwk_to_rsa_public_key(jwk: Dict):
    """将 JWK 格式的公钥转换为 RSA 公钥对象"""
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    
    # 解码 n 和 e
    n_bytes = base64url_decode(jwk['n'])
    e_bytes = base64url_decode(jwk['e'])
    
    # 转换为整数
    n = int.from_bytes(n_bytes, 'big')
    e = int.from_bytes(e_bytes, 'big')
    
    # 创建公钥
    public_numbers = RSAPublicNumbers(e, n)
    return public_numbers.public_key(default_backend())


def encrypt_password_jwe(
    password: str, 
    public_key_jwk: Dict, 
    issuer: str = "signin",
    audience: str = "AWSPasswordService",
    region: str = "us-east-1"
) -> Optional[str]:
    """
    使用 JWE 格式加密密码（JWT 明文格式）
    
    算法:
    - alg: RSA-OAEP-256 (密钥加密)
    - enc: A256GCM (内容加密)
    
    明文格式（JWT claims）:
    {
      "iss": "us-east-1.signin",
      "iat": 当前时间戳（秒）,
      "nbf": 当前时间戳（秒）,
      "jti": UUID,
      "exp": 当前时间戳 + 300（秒）,
      "aud": "us-east-1.AWSPasswordService",
      "password": 密码
    }
    
    Args:
        password: 明文密码
        public_key_jwk: JWK 格式的 RSA 公钥
        issuer: 发行者（默认 signin）
        audience: 受众（默认 AWSPasswordService）
        region: 区域（默认 us-east-1）
    
    Returns:
        JWE 紧凑序列化格式的加密密码
    """
    try:
        import time
        import uuid
        
        # 1. 构建 JWE Header
        header = {
            "alg": "RSA-OAEP-256",
            "kid": public_key_jwk.get('kid', ''),
            "enc": "A256GCM",
            "cty": "enc",
            "typ": "application/aws+signin+jwe"
        }
        header_b64 = base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
        
        # 2. 生成随机 CEK (Content Encryption Key) - 256 bits for AES-256
        cek = os.urandom(32)
        
        # 3. 使用 RSA-OAEP-256 加密 CEK
        rsa_public_key = jwk_to_rsa_public_key(public_key_jwk)
        encrypted_key = rsa_public_key.encrypt(
            cek,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        encrypted_key_b64 = base64url_encode(encrypted_key)
        
        # 4. 生成随机 IV (96 bits for GCM)
        iv = os.urandom(12)
        iv_b64 = base64url_encode(iv)
        
        # 5. 构建 JWT 格式的明文
        current_time = int(time.time())
        password_period = 300  # 5 分钟有效期
        
        # 构建 issuer 和 audience（带 region 前缀）
        iss = f"{region}.{issuer}" if region else issuer
        aud = f"{region}.{audience}" if region else audience
        
        plaintext_obj = {
            "iss": iss,
            "iat": current_time,
            "nbf": current_time,
            "jti": str(uuid.uuid4()),
            "exp": current_time + password_period,
            "aud": aud,
            "password": password
        }
        # 使用紧凑格式（无空格）
        plaintext = json.dumps(plaintext_obj, separators=(',', ':'))
        
        # 6. 使用 AES-256-GCM 加密
        # AAD (Additional Authenticated Data) = ASCII(BASE64URL(Header))
        aad = header_b64.encode('ascii')
        
        aesgcm = AESGCM(cek)
        ciphertext_and_tag = aesgcm.encrypt(iv, plaintext.encode('utf-8'), aad)
        
        # 分离 ciphertext 和 tag
        ciphertext = ciphertext_and_tag[:-16]
        tag = ciphertext_and_tag[-16:]
        
        ciphertext_b64 = base64url_encode(ciphertext)
        tag_b64 = base64url_encode(tag)
        
        # 7. 组装 JWE 紧凑序列化格式
        jwe = f"{header_b64}.{encrypted_key_b64}.{iv_b64}.{ciphertext_b64}.{tag_b64}"
        
        return jwe
        
    except Exception as e:
        print(f"密码加密失败: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    # 测试加密
    test_public_key = {
        "kty": "RSA",
        "use": "enc",
        "alg": "RSA-OAEP-256",
        "kid": "test-key-id",
        "e": "AQAB",
        "n": "ic3SWG6TBvWBi6KkrbdeuCQ_3t7Hsium5DMVCQxZ3fZyvM5ltNlCc6jdM5RolLUFPYckHGJEyy9nElRPqQ1BBjHoLw4Qejky0ah64dLJFqny45q6nyfwmLb7FYXQRsz-QGS_q5LLJbKr"
    }
    
    password = "TestPassword123!"
    encrypted = encrypt_password_jwe(password, test_public_key)
    
    if encrypted:
        print(f"加密成功!")
        print(f"JWE 长度: {len(encrypted)}")
        print(f"JWE 前 100 字符: {encrypted[:100]}...")
    else:
        print("加密失败")
