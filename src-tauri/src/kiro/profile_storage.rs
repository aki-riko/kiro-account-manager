use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KiroIdeProfile {
    pub arn: String,
    pub name: String,
}

fn assert_not_symlink(path: &Path) -> Result<(), String> {
    if path.exists() {
        let metadata = std::fs::symlink_metadata(path)
            .map_err(|error| format!("读取 Kiro profile 路径元数据失败: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "Kiro profile 路径不能是符号链接: {}",
                path.display()
            ));
        }
    }
    Ok(())
}

#[cfg(unix)]
fn set_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = std::fs::metadata(path)
        .map_err(|error| format!("读取 Kiro profile 权限失败: {error}"))?
        .permissions();
    permissions.set_mode(0o600);
    std::fs::set_permissions(path, permissions)
        .map_err(|error| format!("设置 Kiro profile 权限失败: {error}"))
}

#[cfg(not(unix))]
fn set_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn profile_path_for_platform(
    platform: &str,
    appdata: Option<&Path>,
    home: Option<&Path>,
) -> Result<PathBuf, String> {
    let base = match platform {
        "windows" => appdata.ok_or("无法读取 APPDATA")?.join("Kiro").join("User"),
        "macos" => home
            .ok_or("无法读取 HOME")?
            .join("Library")
            .join("Application Support")
            .join("Kiro")
            .join("User"),
        "linux" => home
            .ok_or("无法读取 HOME")?
            .join(".config")
            .join("Kiro")
            .join("User"),
        other => return Err(format!("不支持的操作系统: {other}")),
    };

    Ok(base
        .join("globalStorage")
        .join("kiro.kiroagent")
        .join("profile.json"))
}

pub fn profile_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
        return profile_path_for_platform("windows", appdata.as_deref(), None);
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME").map(PathBuf::from);
        return profile_path_for_platform("macos", None, home.as_deref());
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var_os("HOME").map(PathBuf::from);
        return profile_path_for_platform("linux", None, home.as_deref());
    }

    #[allow(unreachable_code)]
    Err("当前平台不支持 Kiro profile 存储".to_string())
}

pub fn read_profile() -> Result<Option<KiroIdeProfile>, String> {
    let path = profile_path()?;
    if !path.exists() {
        return Ok(None);
    }
    assert_not_symlink(&path)?;
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("读取 Kiro profile 失败: {error}"))?;
    let profile = serde_json::from_str::<KiroIdeProfile>(&content)
        .map_err(|error| format!("解析 Kiro profile 失败: {error}"))?;
    if profile.arn.trim().is_empty() || profile.name.trim().is_empty() {
        return Err("Kiro profile 缺少 arn 或 name".to_string());
    }
    Ok(Some(profile))
}

pub fn write_profile(profile: &KiroIdeProfile) -> Result<(), String> {
    if profile.arn.trim().is_empty() || profile.name.trim().is_empty() {
        return Err("Kiro profile 的 arn 和 name 不能为空".to_string());
    }

    let path = profile_path()?;
    let parent = path.parent().ok_or("Kiro profile 路径缺少父目录")?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("创建 Kiro profile 目录失败: {error}"))?;
    assert_not_symlink(parent)?;
    assert_not_symlink(&path)?;

    let temp_path = parent.join("profile.json.tmp");
    if temp_path.exists() {
        assert_not_symlink(&temp_path)?;
        std::fs::remove_file(&temp_path)
            .map_err(|error| format!("清理 Kiro profile 临时文件失败: {error}"))?;
    }
    let content = serde_json::to_string_pretty(profile)
        .map_err(|error| format!("序列化 Kiro profile 失败: {error}"))?;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|error| format!("创建 Kiro profile 临时文件失败: {error}"))?;
    file.write_all(content.as_bytes())
        .map_err(|error| format!("写入 Kiro profile 临时文件失败: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("同步 Kiro profile 临时文件失败: {error}"))?;
    drop(file);
    std::fs::rename(&temp_path, &path)
        .map_err(|error| format!("替换 Kiro profile 失败: {error}"))?;
    set_file_permissions(&path)?;
    Ok(())
}

pub fn remove_profile() -> Result<(), String> {
    let path = profile_path()?;
    if !path.exists() {
        return Ok(());
    }
    assert_not_symlink(&path)?;
    std::fs::remove_file(&path).map_err(|error| format!("删除 Kiro profile 失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{profile_path_for_platform, KiroIdeProfile};
    use std::path::Path;

    #[test]
    fn builds_official_profile_paths_for_supported_platforms() {
        assert_eq!(
            profile_path_for_platform(
                "windows",
                Some(Path::new("C:/Users/test/AppData/Roaming")),
                None
            )
            .unwrap(),
            Path::new(
                "C:/Users/test/AppData/Roaming/Kiro/User/globalStorage/kiro.kiroagent/profile.json"
            )
        );
        assert_eq!(
            profile_path_for_platform("macos", None, Some(Path::new("/Users/test"))).unwrap(),
            Path::new("/Users/test/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/profile.json")
        );
        assert_eq!(
            profile_path_for_platform("linux", None, Some(Path::new("/home/test"))).unwrap(),
            Path::new("/home/test/.config/Kiro/User/globalStorage/kiro.kiroagent/profile.json")
        );
    }

    #[test]
    fn serializes_official_profile_shape() {
        let profile = KiroIdeProfile {
            arn: "arn:aws:codewhisperer:us-east-1:123456789012:profile/test".to_string(),
            name: "Azure Profile".to_string(),
        };
        assert_eq!(
            serde_json::to_value(profile).unwrap(),
            serde_json::json!({
                "arn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/test",
                "name": "Azure Profile"
            })
        );
    }
}
