//! clientIdHash 计算 —— Kiro IDE / CLI 共用的唯一算法
//!
//! 之前这段逻辑在 `kiro/ide.rs`、`commands/account_cmd.rs`、`auth/providers/idc.rs`
//! 各有一份拷贝，容易漂移。收敛成纯函数放在 utils（无业务依赖），三处共用。

use sha1::{Digest, Sha1};

/// 规范化 startUrl：去首尾空白 + 去尾部斜杠 —— Kiro IDE / CLI 共用的唯一规范形。
///
/// 这是 startUrl 的**唯一真相形**：IDE 登录算 hash、写 `{hash}.json` 文件名，以及
/// 真实 kiro-cli token 里存的 `start_url`，用的都是无尾斜杠版本。但 AWS 在 clientSecret
/// JWT 的 `initiateLoginUri` 里返回的常带尾斜杠（实测：`https://d-xxx.awsapps.com/start/`）。
/// 凡是要落进 `account.start_url` 或写进 CLI token 的 startUrl，都先过这里规范化，
/// 避免脏值流进存储 —— 否则切号时文件名错位、CLI 格式与实测不符（issue #119）。
pub fn normalize_start_url(start_url: &str) -> String {
    start_url.trim().trim_end_matches('/').to_string()
}

/// 按 Kiro IDE 源码计算 clientIdHash：`sha1(JSON.stringify({ startUrl }))`。
///
/// 算的是紧凑 JSON 串（`{"startUrl":"..."}`），不是裸 URL。startUrl 先经
/// `normalize_start_url` 去尾斜杠 —— IDE 登录用的就是去斜杠版本，不规范化会导致
/// 文件名与 IDE 查找路径错位，进而切号失败（issue #119）。
pub fn calculate_client_id_hash(start_url: &str) -> String {
    let normalized = normalize_start_url(start_url);
    let input = serde_json::json!({ "startUrl": normalized }).to_string();
    let mut hasher = Sha1::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// 从 clientSecret（JWT）的 payload 里提取真实 startUrl。
///
/// clientSecret 是 JWT，payload 里有 `serialized` 字段（本身是 JSON 字符串），
/// 其中 `initiateLoginUri` 就是签发时的 startUrl —— 跟着 secret 走，是最可靠的
/// startUrl 真相源。常用于账号只存了 clientSecret、没单独存 startUrl 的场景
/// （如从 kiro-cli / IDE 导入）。
///
/// JWT 里的值常带尾斜杠（实测 `https://d-90660ceab3.awsapps.com/start/`），这里
/// 在真相源就 `normalize_start_url` 规范化掉，保证所有下游拿到的都是无斜杠的规范形，
/// 不必各自再去斜杠。
pub fn extract_start_url_from_client_secret(client_secret: &str) -> Option<String> {
    use base64::{engine::general_purpose, Engine as _};

    // JWT 格式：header.payload.signature
    let parts: Vec<&str> = client_secret.split('.').collect();
    if parts.len() < 2 {
        return None;
    }

    // Base64 解码 payload
    let decoded = general_purpose::URL_SAFE_NO_PAD.decode(parts[1]).ok()?;
    let payload_str = String::from_utf8(decoded).ok()?;

    // payload.serialized 本身是 JSON 字符串，再解一层
    let payload_json: serde_json::Value = serde_json::from_str(&payload_str).ok()?;
    let serialized_str = payload_json.get("serialized")?.as_str()?;
    let serialized: serde_json::Value = serde_json::from_str(serialized_str).ok()?;

    serialized
        .get("initiateLoginUri")?
        .as_str()
        .map(normalize_start_url)
}

/// 检查 clientSecret（JWT）是否带 REFRESH_TOKEN grant —— 切号前防呆。
///
/// AWS SSO OIDC 的 `/client/register` 行为：传 `redirectUris=["http://127.0.0.1/oauth/callback"]`
/// （不带端口）才会开 REFRESH_TOKEN grant；带端口或被外部工具（如 Amazon Q CLI 注册的
/// `clientName=Amazon Q Developer for command line` 客户端）注册的 client，
/// `enabledGrants` 是空的。这种 client 只能登录一次拿 access_token，**不能 refresh**。
///
/// 切号到这种账号 → IDE 把它当 IdC 凭证用 → token 一过期 IDE 用 refresh_token + clientId/clientSecret
/// 调 SSO `/token grant_type=refresh_token` → AWS 校验 enabledGrants 没 REFRESH_TOKEN → 拒
/// → IDE 报 `Unable to fetch account usage data: Invalid token`。
///
/// 切号前先用本函数判一下，没 grant 就给用户清晰错误，避免 IDE 那边一头雾水。
pub fn client_supports_refresh_token(client_secret: &str) -> bool {
    use base64::{engine::general_purpose, Engine as _};

    let parts: Vec<&str> = client_secret.split('.').collect();
    if parts.len() < 2 {
        // 不是 JWT 格式 —— 无法判断，保守允许（切号继续走，让 IDE 自己报）
        return true;
    }

    let Some(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(parts[1]).ok() else {
        return true;
    };
    let Some(payload_str) = String::from_utf8(decoded).ok() else {
        return true;
    };
    let Ok(payload_json) = serde_json::from_str::<serde_json::Value>(&payload_str) else {
        return true;
    };
    let Some(serialized_str) = payload_json.get("serialized").and_then(|v| v.as_str()) else {
        return true;
    };
    let Ok(serialized) = serde_json::from_str::<serde_json::Value>(serialized_str) else {
        return true;
    };

    // enabledGrants 是 object，含 AUTH_CODE / REFRESH_TOKEN 两个 key 才算完整。
    // 实测 Q CLI 注册的 client `enabledGrants` 是 null；带端口 redirect_uri 注册的也是 null。
    // 真实 Kiro IDE 注册的：{ AUTH_CODE: {...}, REFRESH_TOKEN: {...} }。
    serialized
        .get("enabledGrants")
        .and_then(|g| g.get("REFRESH_TOKEN"))
        .is_some()
}

#[cfg(test)]
mod tests {
    use super::{calculate_client_id_hash, client_supports_refresh_token, normalize_start_url};

    #[test]
    fn normalize_strips_trailing_slash_and_whitespace() {
        // 实测：JWT initiateLoginUri 带尾斜杠，规范化后应与无斜杠版本一致
        assert_eq!(
            normalize_start_url("https://d-90660ceab3.awsapps.com/start/"),
            "https://d-90660ceab3.awsapps.com/start"
        );
        assert_eq!(
            normalize_start_url("  https://d-90660ceab3.awsapps.com/start/  "),
            "https://d-90660ceab3.awsapps.com/start"
        );
        // 无斜杠的输入保持不变（幂等）
        assert_eq!(
            normalize_start_url("https://d-90660ceab3.awsapps.com/start"),
            "https://d-90660ceab3.awsapps.com/start"
        );
    }

    #[test]
    fn matches_real_enterprise_filename() {
        // 实测：备份目录里真实 IDE 登录产物的文件名
        assert_eq!(
            calculate_client_id_hash("https://d-90660ceab3.awsapps.com/start"),
            "a96ec6ff09e0c558ceca191cdaa0ff2b0e4e3e35"
        );
    }

    #[test]
    fn matches_builder_id() {
        assert_eq!(
            calculate_client_id_hash("https://view.awsapps.com/start"),
            "e909a0580879b06ece1202964fbe9dda95ea4ce3"
        );
    }

    #[test]
    fn trailing_slash_is_normalized_away() {
        // 带尾斜杠必须算出与不带斜杠相同的 hash
        assert_eq!(
            calculate_client_id_hash("https://d-90660ceab3.awsapps.com/start/"),
            calculate_client_id_hash("https://d-90660ceab3.awsapps.com/start")
        );
    }

    #[test]
    fn malformed_client_secret_treated_as_supporting() {
        // 非 JWT 格式 —— 保守允许，让切号继续走（不替 IDE 当法官）
        assert!(client_supports_refresh_token(""));
        assert!(client_supports_refresh_token("not-a-jwt"));
        assert!(client_supports_refresh_token("only.two"));
    }
}
