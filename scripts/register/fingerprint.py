"""
AWS fwcim 指纹生成模块 v4.0.0
逆向自 profile.aws.amazon.com 的 fwcim 库

加密流程:
1. 收集浏览器指纹数据
2. JSON 序列化
3. UTF-8 编码
4. 计算 CRC32
5. 格式化为 CRC32_HEX#JSON
6. XXTEA 加密
7. Base64 编码
8. 添加前缀 ECdITeCs:
"""

import base64
import json
import time
import random
import binascii
import uuid
from typing import List, Dict, Any


# XXTEA 加密密钥
FWCIM_KEY_IDENTIFIER = "ECdITeCs"
FWCIM_KEY_MATERIAL = [1888420705, 2576816180, 2347232058, 874813317]
FWCIM_VERSION = "4.0.0"


def xxtea_encrypt(data: str, key: List[int]) -> bytes:
    """XXTEA 加密算法"""
    if not data:
        return b""
    
    data_bytes = data.encode('utf-8')
    padding = (4 - len(data_bytes) % 4) % 4
    data_bytes = data_bytes + b'\x00' * padding
    
    n = len(data_bytes) // 4
    v = []
    for i in range(n):
        val = (data_bytes[i*4] | 
               (data_bytes[i*4+1] << 8) | 
               (data_bytes[i*4+2] << 16) | 
               (data_bytes[i*4+3] << 24))
        v.append(val & 0xFFFFFFFF)
    
    if n < 2:
        v.append(0)
        n = 2
    
    delta = 0x9E3779B9
    rounds = 6 + 52 // n
    sum_val = 0
    z = v[n - 1]
    
    for _ in range(rounds):
        sum_val = (sum_val + delta) & 0xFFFFFFFF
        e = (sum_val >> 2) & 3
        for p in range(n):
            y = v[(p + 1) % n]
            mx = ((((z >> 5) ^ (y << 2)) + ((y >> 3) ^ (z << 4))) ^ ((sum_val ^ y) + (key[(p & 3) ^ e] ^ z))) & 0xFFFFFFFF
            v[p] = (v[p] + mx) & 0xFFFFFFFF
            z = v[p]
    
    result = bytearray()
    for val in v:
        result.append(val & 0xFF)
        result.append((val >> 8) & 0xFF)
        result.append((val >> 16) & 0xFF)
        result.append((val >> 24) & 0xFF)
    
    return bytes(result)


def crc32(data: bytes) -> int:
    """计算 CRC32"""
    return binascii.crc32(data) & 0xFFFFFFFF


def encode_with_crc(data: Dict[str, Any]) -> str:
    """编码数据（带 CRC32 校验）"""
    json_str = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    json_bytes = json_str.encode('utf-8')
    crc = crc32(json_bytes)
    crc_hex = format(crc, '08X')
    return f"{crc_hex}#{json_str}"


def encrypt_fingerprint(data: Dict[str, Any]) -> str:
    """加密指纹数据"""
    encoded_data = encode_with_crc(data)
    encrypted = xxtea_encrypt(encoded_data, FWCIM_KEY_MATERIAL)
    b64_encoded = base64.b64encode(encrypted).decode('ascii')
    return f"{FWCIM_KEY_IDENTIFIER}:{b64_encoded}"


def generate_visitor_id() -> str:
    """生成 visitorId（UUID v4 格式）"""
    return str(uuid.uuid4())


def generate_ubid() -> str:
    """生成 ubid（AWS 用户标识格式）"""
    part1 = random.randint(100, 999)
    part2 = random.randint(1000000, 9999999)
    part3 = random.randint(1000000, 9999999)
    return f"{part1}-{part2}-{part3}"


def generate_awsccc_cookie() -> str:
    """生成 awsccc cookie（Cookie 同意设置）"""
    data = {
        "e": 1,
        "p": 1,
        "f": 1,
        "a": 1,
        "i": str(uuid.uuid4()),
        "v": "1"
    }
    # 使用紧凑格式（无空格），与浏览器行为一致
    return base64.b64encode(json.dumps(data, separators=(',', ':')).encode()).decode()


def collect_browser_fingerprint(
    workflow_id: str = None,
    ubid: str = None,
    time_spent: int = None
) -> Dict[str, Any]:
    """
    收集完整的浏览器指纹数据（v4.0.0 格式）
    模拟真实浏览器的 fwcim 库收集的数据
    """
    now = int(time.time() * 1000)
    start_time = now - random.randint(5000, 8000)
    
    if time_spent is None:
        time_spent = random.randint(5000, 8000)
    
    if ubid is None:
        ubid = generate_ubid()
    
    # 生成随机的用户交互数据
    clicks = random.randint(2, 5)
    key_presses = random.randint(5, 15)
    
    # 生成按键时间间隔
    key_intervals = [random.randint(80, 700) for _ in range(key_presses - 1)]
    key_cycles = [random.randint(70, 400) for _ in range(key_presses)]
    
    # 生成鼠标点击位置
    mouse_positions = []
    for _ in range(clicks):
        x = random.randint(400, 900)
        y = random.randint(300, 500)
        mouse_positions.append(f"{x},{y}")
    
    mouse_cycles = [random.randint(80, 150) for _ in range(clicks - 1)]
    
    # 页面性能计时
    nav_start = start_time - random.randint(3000, 5000)
    
    data = {
        "metrics": {
            "el": 1,
            "script": 0,
            "h": 0,
            "batt": 0,
            "perf": 0,
            "auto": 0,
            "tz": 1,
            "fp2": 0,
            "lsubid": 0,
            "browser": 0,
            "capabilities": 0,
            "gpu": 0,
            "dnt": 0,
            "math": 0,
            "tts": 0,
            "input": 1,
            "canvas": 0,
            "captchainput": 0,
            "pow": 0
        },
        "start": start_time,
        "interaction": {
            "clicks": clicks,
            "touches": 0,
            "keyPresses": key_presses,
            "cuts": 0,
            "copies": 0,
            "pastes": 0,
            "keyPressTimeIntervals": key_intervals,
            "mouseClickPositions": mouse_positions,
            "keyCycles": key_cycles,
            "mouseCycles": mouse_cycles,
            "touchCycles": []
        },
        "scripts": {
            "dynamicUrls": ["/dist/main/app_5c1efae0049a1b0fdc4d.min.js"],
            "inlineHashes": [],
            "elapsed": 0,
            "dynamicUrlCount": 1,
            "inlineHashesCount": 0
        },
        "history": {
            "length": random.randint(5, 10)
        },
        "performance": {
            "timing": {
                "navigationStart": nav_start,
                "unloadEventStart": 0,
                "unloadEventEnd": 0,
                "redirectStart": 0,
                "redirectEnd": 0,
                "fetchStart": nav_start + 1,
                "domainLookupStart": nav_start + 20,
                "domainLookupEnd": nav_start + 20,
                "connectStart": nav_start + 21,
                "connectEnd": nav_start + 214,
                "secureConnectionStart": nav_start + 21,
                "requestStart": nav_start + 214,
                "responseStart": nav_start + 785,
                "responseEnd": nav_start + 785,
                "domLoading": nav_start + 813,
                "domInteractive": nav_start + 2562,
                "domContentLoadedEventStart": nav_start + 2566,
                "domContentLoadedEventEnd": nav_start + 2578,
                "domComplete": nav_start + 2578,
                "loadEventStart": nav_start + 2578,
                "loadEventEnd": nav_start + 2578
            }
        },
        "automation": {
            "wd": {
                "properties": {
                    "document": [],
                    "window": [],
                    "navigator": []
                }
            },
            "phantom": {
                "properties": {
                    "window": []
                }
            }
        },
        "end": now,
        "timeZone": 8,
        "flashVersion": None,
        "plugins": "PDF Viewer Chrome PDF Viewer Chromium PDF Viewer Microsoft Edge PDF Viewer WebKit built-in PDF ||1920-1080-1040-24-*-*-*",
        "dupedPlugins": "PDF Viewer Chrome PDF Viewer Chromium PDF Viewer Microsoft Edge PDF Viewer WebKit built-in PDF ||1920-1080-1040-24-*-*-*",
        "screenInfo": "1920-1080-1040-24-*-*-*",
        "lsUbid": f"{ubid}:{now // 1000}",
        "referrer": "",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "location": f"https://profile.aws.amazon.com/?workflowID={workflow_id}#/signup/enter-email" if workflow_id else "https://profile.aws.amazon.com/",
        "webDriver": False,
        "capabilities": {
            "css": {
                "textShadow": 1,
                "WebkitTextStroke": 1,
                "boxShadow": 1,
                "borderRadius": 1,
                "borderImage": 1,
                "opacity": 1,
                "transform": 1,
                "transition": 1
            },
            "js": {
                "audio": True,
                "geolocation": True,
                "localStorage": "supported",
                "touch": False,
                "video": True,
                "webWorker": True
            },
            "elapsed": 2
        },
        "gpu": {
            "vendor": "Google Inc. (Intel)",
            "model": "ANGLE (Intel, Intel(R) HD Graphics Direct3D11 vs_5_0 ps_5_0), or similar",
            "extensions": [
                "ANGLE_instanced_arrays",
                "EXT_blend_minmax",
                "EXT_color_buffer_half_float",
                "EXT_float_blend",
                "EXT_frag_depth",
                "EXT_shader_texture_lod",
                "EXT_sRGB",
                "EXT_texture_compression_bptc",
                "EXT_texture_compression_rgtc",
                "EXT_texture_filter_anisotropic",
                "OES_element_index_uint",
                "OES_fbo_render_mipmap",
                "OES_standard_derivatives",
                "OES_texture_float",
                "OES_texture_float_linear",
                "OES_texture_half_float",
                "OES_texture_half_float_linear",
                "OES_vertex_array_object",
                "WEBGL_color_buffer_float",
                "WEBGL_compressed_texture_s3tc",
                "WEBGL_compressed_texture_s3tc_srgb",
                "WEBGL_debug_renderer_info",
                "WEBGL_debug_shaders",
                "WEBGL_depth_texture",
                "WEBGL_draw_buffers",
                "WEBGL_lose_context",
                "WEBGL_provoking_vertex"
            ]
        },
        "dnt": None,
        "math": {
            "tan": "-1.4214488238747245",
            "sin": "0.8178819121159085",
            "cos": "-0.5753861119575491"
        },
        "form": {},
        "canvas": {
            "hash": random.randint(100000000, 999999999),
            "emailHash": None,
            "histogramBins": [random.randint(5, 100) for _ in range(255)] + [random.randint(10000, 15000)]
        },
        "token": {
            "isCompatible": True,
            "pageHasCaptcha": 0
        },
        "auth": {
            "form": {
                "method": "get"
            }
        },
        "errors": [],
        "version": FWCIM_VERSION
    }
    
    return data


def generate_fingerprint(workflow_id: str = None, ubid: str = None, time_spent: int = None) -> str:
    """生成完整的浏览器指纹"""
    data = collect_browser_fingerprint(workflow_id, ubid, time_spent)
    return encrypt_fingerprint(data)


if __name__ == "__main__":
    print("测试指纹生成 v4.0.0:")
    fp = generate_fingerprint(workflow_id="test-workflow-id", ubid="123-4567890-1234567")
    print(f"指纹长度: {len(fp)}")
    print(f"前 100 字符: {fp[:100]}...")
