use std::{
    fs::{self, OpenOptions},
    io::Write,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
};

use chrono::{Duration, SecondsFormat, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::clients::http_client::is_supported_kiro_region;

use super::settings_overlay::{apply_settings_overlay, restore_settings_overlay};

pub(crate) use super::settings_overlay::recover_stale_settings;

const MIN_PLACEHOLDER_TTL_MINUTES: i64 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IsolatedIdeEndpoints {
    pub generic: SocketAddr,
    pub runtime: SocketAddr,
    pub management: SocketAddr,
}

impl IsolatedIdeEndpoints {
    fn validate(self) -> Result<Self, String> {
        validate_loopback_endpoint("generic", self.generic)?;
        validate_loopback_endpoint("runtime", self.runtime)?;
        validate_loopback_endpoint("management", self.management)?;
        Ok(self)
    }
}

#[derive(Debug)]
pub struct IsolatedIdeProfile {
    session_id: Uuid,
    isolation_root: PathBuf,
    session_root: PathBuf,
    home_dir: PathBuf,
    user_data_dir: PathBuf,
    extensions_dir: PathBuf,
    token_path: PathBuf,
    settings_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KiroUserDataPaths {
    user_data_dir: PathBuf,
    extensions_dir: PathBuf,
}

impl KiroUserDataPaths {
    pub fn new(user_data_dir: PathBuf, extensions_dir: PathBuf) -> Result<Self, String> {
        let paths = Self {
            user_data_dir,
            extensions_dir,
        };
        paths.validate()?;
        Ok(paths)
    }

    pub fn discover() -> Result<Self, String> {
        let user_data_dir = dirs::config_dir()
            .ok_or_else(|| "无法获取 Kiro user-data 根目录".to_string())?
            .join("Kiro");
        let extensions_dir = dirs::home_dir()
            .ok_or_else(|| "无法获取 Kiro 扩展根目录".to_string())?
            .join(".kiro")
            .join("extensions");
        if !extensions_dir.exists() {
            fs::create_dir_all(&extensions_dir)
                .map_err(|error| format!("创建 Kiro 扩展目录失败: {error}"))?;
        }
        Self::new(user_data_dir, extensions_dir)
    }

    pub fn default_settings_path() -> Result<PathBuf, String> {
        dirs::config_dir()
            .ok_or_else(|| "无法获取 Kiro user-data 根目录".to_string())
            .map(|path| path.join("Kiro").join("User").join("settings.json"))
    }

    pub fn user_data_dir(&self) -> &Path {
        &self.user_data_dir
    }

    pub fn extensions_dir(&self) -> &Path {
        &self.extensions_dir
    }

    pub fn settings_path(&self) -> PathBuf {
        self.user_data_dir.join("User").join("settings.json")
    }

    fn validate(&self) -> Result<(), String> {
        for (label, path) in [
            ("Kiro user-data", self.user_data_dir.as_path()),
            ("Kiro 扩展", self.extensions_dir.as_path()),
        ] {
            if !path.is_absolute() {
                return Err(format!("{label}目录必须是绝对路径"));
            }
            if !path.is_dir() {
                return Err(format!("{label}目录不存在或不是目录: {}", path.display()));
            }
        }
        if !self.user_data_dir.join("User").is_dir() {
            return Err("Kiro user-data 缺少 User 目录".to_string());
        }
        Ok(())
    }
}

impl IsolatedIdeProfile {
    pub fn create(
        isolation_root: &Path,
        shared_data: &KiroUserDataPaths,
        region: &str,
        endpoints: IsolatedIdeEndpoints,
        placeholder_ttl: Duration,
    ) -> Result<Self, String> {
        validate_profile_inputs(
            isolation_root,
            shared_data,
            region,
            endpoints,
            placeholder_ttl,
        )?;
        let profile = create_profile_layout(isolation_root, shared_data)?;
        if let Err(error) = profile.initialize(region, endpoints, placeholder_ttl) {
            return Err(profile.cleanup_after_failure(error));
        }
        Ok(profile)
    }

    fn initialize(
        &self,
        region: &str,
        endpoints: IsolatedIdeEndpoints,
        placeholder_ttl: Duration,
    ) -> Result<(), String> {
        write_new_json(
            &self.token_path,
            &placeholder_token(self.session_id, region, placeholder_ttl)?,
        )?;
        apply_settings_overlay(
            &self.session_root,
            self.session_id,
            &self.settings_path,
            &endpoint_settings(region, endpoints),
        )
    }

    fn cleanup_after_failure(&self, error: String) -> String {
        match self.cleanup() {
            Ok(()) => error,
            Err(cleanup_error) => format!("{error}; 清理失败的隔离目录时出错: {cleanup_error}"),
        }
    }

    pub fn session_id(&self) -> Uuid {
        self.session_id
    }

    pub fn session_root(&self) -> &Path {
        &self.session_root
    }

    pub fn home_dir(&self) -> &Path {
        &self.home_dir
    }

    pub fn user_data_dir(&self) -> &Path {
        &self.user_data_dir
    }

    pub fn extensions_dir(&self) -> &Path {
        &self.extensions_dir
    }

    pub fn token_path(&self) -> &Path {
        &self.token_path
    }

    pub fn settings_path(&self) -> &Path {
        &self.settings_path
    }

    pub fn cleanup(&self) -> Result<(), String> {
        validate_cleanup_target(self)?;
        restore_settings_overlay(&self.session_root, &self.settings_path)?;
        if !self.session_root.exists() {
            return Ok(());
        }
        let metadata = fs::symlink_metadata(&self.session_root)
            .map_err(|error| format!("读取隔离目录元数据失败: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("拒绝清理符号链接形式的隔离目录".to_string());
        }
        fs::remove_dir_all(&self.session_root)
            .map_err(|error| format!("清理隔离 Kiro 目录失败: {error}"))
    }
}

fn validate_profile_inputs(
    isolation_root: &Path,
    shared_data: &KiroUserDataPaths,
    region: &str,
    endpoints: IsolatedIdeEndpoints,
    placeholder_ttl: Duration,
) -> Result<(), String> {
    if !isolation_root.is_absolute() {
        return Err("隔离 Kiro 根目录必须是绝对路径".to_string());
    }
    shared_data.validate()?;
    if !is_supported_kiro_region(region.trim()) {
        return Err(format!("隔离 Kiro 不支持区域: {}", region.trim()));
    }
    endpoints.validate()?;
    if placeholder_ttl <= Duration::minutes(MIN_PLACEHOLDER_TTL_MINUTES) {
        return Err("占位登录态有效期必须超过 10 分钟".to_string());
    }
    Ok(())
}

fn validate_loopback_endpoint(label: &str, endpoint: SocketAddr) -> Result<(), String> {
    if endpoint.ip() != IpAddr::V4(Ipv4Addr::LOCALHOST) || endpoint.port() == 0 {
        return Err(format!("{label} endpoint 必须使用 127.0.0.1 动态有效端口"));
    }
    Ok(())
}

fn create_profile_layout(
    isolation_root: &Path,
    shared_data: &KiroUserDataPaths,
) -> Result<IsolatedIdeProfile, String> {
    ensure_private_directory(isolation_root)?;
    let session_id = Uuid::new_v4();
    let session_root = isolation_root.join(session_id.to_string());
    fs::create_dir(&session_root).map_err(|error| format!("创建隔离会话目录失败: {error}"))?;
    let home_dir = session_root.join("home");
    let user_data_dir = shared_data.user_data_dir().to_path_buf();
    let extensions_dir = shared_data.extensions_dir().to_path_buf();
    let profile = IsolatedIdeProfile {
        session_id,
        isolation_root: isolation_root.to_path_buf(),
        token_path: home_dir.join(".aws/sso/cache/kiro-auth-token.json"),
        settings_path: shared_data.settings_path(),
        session_root,
        home_dir,
        user_data_dir,
        extensions_dir,
    };
    let layout_result = set_private_directory_permissions(&profile.session_root)
        .and_then(|()| create_session_directories(&profile.home_dir));
    match layout_result {
        Ok(()) => Ok(profile),
        Err(error) => Err(profile.cleanup_after_failure(error)),
    }
}

fn ensure_private_directory(path: &Path) -> Result<(), String> {
    if path.exists() {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| format!("读取隔离根目录元数据失败: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("隔离根路径必须是普通目录".to_string());
        }
    } else {
        fs::create_dir_all(path).map_err(|error| format!("创建隔离根目录失败: {error}"))?;
    }
    set_private_directory_permissions(path)
}

fn create_session_directories(home: &Path) -> Result<(), String> {
    for path in [home.to_path_buf(), home.join(".aws/sso/cache")] {
        fs::create_dir_all(&path)
            .map_err(|error| format!("创建隔离目录 {} 失败: {error}", path.display()))?;
        set_private_directory_permissions(&path)?;
    }
    Ok(())
}

fn placeholder_token(session_id: Uuid, region: &str, ttl: Duration) -> Result<Value, String> {
    let expires_at = Utc::now()
        .checked_add_signed(ttl)
        .ok_or_else(|| "计算占位登录态过期时间失败".to_string())?;
    Ok(json!({
        "accessToken": format!("kam-local-access-{}", Uuid::new_v4()),
        "refreshToken": format!("kam-local-refresh-{}", Uuid::new_v4()),
        "expiresAt": expires_at.to_rfc3339_opts(SecondsFormat::Millis, true),
        "authMethod": "social",
        "provider": "Github",
        "profileArn": format!(
            "arn:aws:codewhisperer:{region}:000000000000:profile/KAM-LOCAL-{}",
            session_id.simple()
        )
    }))
}

fn endpoint_settings(region: &str, endpoints: IsolatedIdeEndpoints) -> Value {
    json!({
        "codewhisperer.config.endpoints": [endpoint_entry(region, endpoints.generic)],
        "codewhisperer.config.krsEndpoints": [endpoint_entry(region, endpoints.runtime)],
        "codewhisperer.config.cpsEndpoints": [endpoint_entry(region, endpoints.management)]
    })
}

fn endpoint_entry(region: &str, endpoint: SocketAddr) -> Value {
    json!({
        "region": region,
        "endpoint": format!("http://{endpoint}")
    })
}

fn write_new_json(path: &Path, value: &Value) -> Result<(), String> {
    let content =
        serde_json::to_vec_pretty(value).map_err(|error| format!("序列化隔离配置失败: {error}"))?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    configure_private_file_mode(&mut options);
    let mut file = options
        .open(path)
        .map_err(|error| format!("创建隔离配置 {} 失败: {error}", path.display()))?;
    file.write_all(&content)
        .map_err(|error| format!("写入隔离配置 {} 失败: {error}", path.display()))?;
    file.sync_all()
        .map_err(|error| format!("同步隔离配置 {} 失败: {error}", path.display()))
}

fn validate_cleanup_target(profile: &IsolatedIdeProfile) -> Result<(), String> {
    if profile.session_root.parent() != Some(profile.isolation_root.as_path()) {
        return Err("隔离会话目录超出允许清理范围".to_string());
    }
    let directory_id = profile
        .session_root
        .file_name()
        .and_then(|value| value.to_str())
        .and_then(|value| Uuid::parse_str(value).ok());
    if directory_id != Some(profile.session_id) {
        return Err("隔离会话目录标识校验失败".to_string());
    }
    Ok(())
}

#[cfg(unix)]
fn configure_private_file_mode(options: &mut OpenOptions) {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
}

#[cfg(not(unix))]
fn configure_private_file_mode(_options: &mut OpenOptions) {}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("设置隔离目录权限失败: {error}"))
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{IsolatedIdeEndpoints, IsolatedIdeProfile, KiroUserDataPaths};
    use chrono::Duration;
    use serde_json::Value;
    use std::{fs, net::SocketAddr, path::PathBuf};
    use uuid::Uuid;

    struct TestLayout {
        root: PathBuf,
        isolation_root: PathBuf,
        shared: KiroUserDataPaths,
    }

    fn test_layout(label: &str) -> TestLayout {
        let root = std::env::temp_dir().join(format!("kam-ksk-profile-{label}-{}", Uuid::new_v4()));
        let user_data = root.join("formal-user-data");
        let extensions = root.join("formal-extensions");
        fs::create_dir_all(user_data.join("User")).expect("create user data");
        fs::create_dir_all(&extensions).expect("create extensions");
        fs::write(user_data.join("User/settings.json"), "{}").expect("write settings");
        let shared = KiroUserDataPaths::new(user_data, extensions).expect("create shared paths");
        TestLayout {
            isolation_root: root.join("isolated"),
            root,
            shared,
        }
    }

    fn loopback_endpoints() -> IsolatedIdeEndpoints {
        IsolatedIdeEndpoints {
            generic: SocketAddr::from(([127, 0, 0, 1], 31_001)),
            runtime: SocketAddr::from(([127, 0, 0, 1], 31_002)),
            management: SocketAddr::from(([127, 0, 0, 1], 31_003)),
        }
    }

    #[test]
    fn creates_isolated_profile_without_ksk_or_real_user_paths() {
        let layout = test_layout("create");
        let profile = IsolatedIdeProfile::create(
            &layout.isolation_root,
            &layout.shared,
            "us-east-1",
            loopback_endpoints(),
            Duration::hours(1),
        )
        .expect("create isolated profile");

        let token = fs::read_to_string(profile.token_path()).expect("read placeholder token");
        let settings = fs::read_to_string(profile.settings_path()).expect("read settings");
        let token_json: Value = serde_json::from_str(&token).expect("parse token");
        let settings_json: Value = serde_json::from_str(&settings).expect("parse settings");

        assert!(profile.home_dir().starts_with(profile.session_root()));
        assert_eq!(profile.user_data_dir(), layout.shared.user_data_dir());
        assert_eq!(profile.extensions_dir(), layout.shared.extensions_dir());
        assert!(!token.contains("ksk_"));
        assert_eq!(token_json["authMethod"], "social");
        assert_eq!(token_json["provider"], "Github");
        assert_eq!(
            settings_json["codewhisperer.config.krsEndpoints"][0]["endpoint"],
            "http://127.0.0.1:31002"
        );

        profile.cleanup().expect("cleanup isolated profile");
        assert!(!profile.session_root().exists());
        fs::remove_dir_all(&layout.root).expect("remove test root");
    }

    #[test]
    fn rejects_non_loopback_endpoint_before_creating_files() {
        let layout = test_layout("reject");
        let mut endpoints = loopback_endpoints();
        endpoints.runtime = SocketAddr::from(([0, 0, 0, 0], 31_002));

        let error = IsolatedIdeProfile::create(
            &layout.isolation_root,
            &layout.shared,
            "us-east-1",
            endpoints,
            Duration::hours(1),
        )
        .expect_err("non-loopback endpoint should fail");

        assert!(error.contains("127.0.0.1"));
        assert!(!layout.isolation_root.exists());
        fs::remove_dir_all(&layout.root).expect("remove test root");
    }

    #[test]
    fn cleanup_preserves_siblings_outside_the_session_directory() {
        let layout = test_layout("cleanup");
        let profile = IsolatedIdeProfile::create(
            &layout.isolation_root,
            &layout.shared,
            "us-east-1",
            loopback_endpoints(),
            Duration::hours(1),
        )
        .expect("create isolated profile");
        let sibling = layout.isolation_root.join("keep.txt");
        fs::write(&sibling, "keep").expect("write sibling marker");

        profile.cleanup().expect("cleanup isolated profile");

        assert!(sibling.exists());
        fs::remove_dir_all(&layout.root).expect("remove test root");
    }
}

#[cfg(test)]
mod shared_data_tests;
