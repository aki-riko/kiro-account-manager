use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::path::Path;

#[cfg(target_os = "windows")]
const KIRO_EXECUTABLE_NAME: &str = "Kiro.exe";

pub fn resolve_kiro_executable() -> Result<PathBuf, String> {
    discover_kiro_executable().ok_or_else(|| {
        "未找到 Kiro IDE 可执行文件；已检查自定义路径、系统安装信息、默认用户目录和本地磁盘。请在 KSK 隔离页面或「设置」→「通用」中选择 Kiro.exe"
            .to_string()
    })
}

pub fn discover_kiro_executable() -> Option<PathBuf> {
    kiro_executable_candidates()
        .into_iter()
        .find(|path| is_kiro_install(path))
}

pub fn validate_custom_kiro_path(raw_path: &str) -> Result<PathBuf, String> {
    let path =
        normalize_configured_path(raw_path).ok_or_else(|| "Kiro IDE 路径不能为空".to_string())?;

    #[cfg(target_os = "windows")]
    {
        let is_kiro_executable = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case(KIRO_EXECUTABLE_NAME));
        if !is_kiro_executable || !path.is_file() {
            return Err(format!(
                "请选择真实存在的 Kiro.exe 文件: {}",
                path.display()
            ));
        }
    }

    #[cfg(target_os = "macos")]
    if !path.is_dir() || path.extension().and_then(|value| value.to_str()) != Some("app") {
        return Err(format!("请选择真实存在的 Kiro.app: {}", path.display()));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    if !path.is_file() {
        return Err(format!(
            "请选择真实存在的 Kiro 可执行文件: {}",
            path.display()
        ));
    }

    Ok(path)
}

pub fn kiro_executable_candidates() -> Vec<PathBuf> {
    let configured_path = crate::commands::app_settings_cmd::get_app_settings_inner()
        .ok()
        .and_then(|settings| settings.custom_kiro_path)
        .and_then(|path| normalize_configured_path(&path));

    #[cfg(target_os = "windows")]
    {
        return windows_candidates(configured_path);
    }

    #[cfg(target_os = "macos")]
    {
        let mut paths = Vec::new();
        push_unique(&mut paths, configured_path);
        push_unique(&mut paths, Some(PathBuf::from("/Applications/Kiro.app")));
        return paths;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let mut paths = Vec::new();
        push_unique(&mut paths, configured_path);
        push_unique(&mut paths, Some(PathBuf::from("/usr/bin/kiro")));
        if let Ok(home) = std::env::var("HOME") {
            push_unique(
                &mut paths,
                Some(PathBuf::from(home).join(".local").join("bin").join("kiro")),
            );
        }
        paths
    }
}

fn normalize_configured_path(raw_path: &str) -> Option<PathBuf> {
    let trimmed = raw_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    #[cfg(target_os = "windows")]
    if path.is_dir() {
        return Some(path.join(KIRO_EXECUTABLE_NAME));
    }
    Some(path)
}

fn push_unique(paths: &mut Vec<PathBuf>, candidate: Option<PathBuf>) {
    let Some(candidate) = candidate else {
        return;
    };
    let duplicate = paths.iter().any(|path| {
        path.to_string_lossy()
            .eq_ignore_ascii_case(&candidate.to_string_lossy())
    });
    if duplicate {
        return;
    }
    paths.push(candidate);
}

fn is_kiro_install(path: &PathBuf) -> bool {
    #[cfg(target_os = "macos")]
    {
        return path.is_dir();
    }
    #[cfg(not(target_os = "macos"))]
    {
        path.is_file()
    }
}

#[cfg(target_os = "windows")]
fn windows_candidates(configured_path: Option<PathBuf>) -> Vec<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok().map(PathBuf::from);
    windows_candidates_from_parts(
        configured_path,
        windows_registry_candidates(),
        local_app_data,
        existing_windows_drive_roots(),
    )
}

#[cfg(target_os = "windows")]
fn windows_candidates_from_parts(
    configured_path: Option<PathBuf>,
    registry_paths: Vec<PathBuf>,
    local_app_data: Option<PathBuf>,
    drive_roots: Vec<PathBuf>,
) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    push_unique(&mut paths, configured_path);
    for path in registry_paths {
        push_unique(&mut paths, Some(path));
    }
    if let Some(local_app_data) = local_app_data {
        push_unique(
            &mut paths,
            Some(
                local_app_data
                    .join("Programs")
                    .join("Kiro")
                    .join(KIRO_EXECUTABLE_NAME),
            ),
        );
    }
    for root in drive_roots {
        push_unique(
            &mut paths,
            Some(root.join("Kiro").join(KIRO_EXECUTABLE_NAME)),
        );
    }
    paths
}

#[cfg(target_os = "windows")]
fn existing_windows_drive_roots() -> Vec<PathBuf> {
    (b'C'..=b'Z')
        .map(|letter| PathBuf::from(format!("{}:\\", char::from(letter))))
        .filter(|root| root.is_dir())
        .collect()
}

#[cfg(target_os = "windows")]
fn windows_registry_candidates() -> Vec<PathBuf> {
    use winreg::{
        enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
        RegKey,
    };

    let mut paths = Vec::new();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    collect_registry_candidates(&hkcu, &mut paths, false);

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    collect_registry_candidates(&hklm, &mut paths, true);
    paths
}

#[cfg(target_os = "windows")]
fn collect_registry_candidates(
    hive: &winreg::RegKey,
    paths: &mut Vec<PathBuf>,
    include_wow6432: bool,
) {
    if let Ok(app_path) =
        hive.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\App Paths\Kiro.exe")
    {
        if let Ok(value) = app_path.get_value::<String, _>("") {
            push_unique(paths, normalize_configured_path(&value));
        }
    }

    collect_uninstall_candidates(
        hive,
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        paths,
    );
    if include_wow6432 {
        collect_uninstall_candidates(
            hive,
            r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            paths,
        );
    }
}

#[cfg(target_os = "windows")]
fn collect_uninstall_candidates(
    hive: &winreg::RegKey,
    uninstall_path: &str,
    paths: &mut Vec<PathBuf>,
) {
    let Ok(uninstall) = hive.open_subkey(uninstall_path) else {
        return;
    };
    for key_name in uninstall.enum_keys().filter_map(Result::ok) {
        let Ok(entry) = uninstall.open_subkey(key_name) else {
            continue;
        };
        let Ok(display_name) = entry.get_value::<String, _>("DisplayName") else {
            continue;
        };
        if !is_official_kiro_display_name(&display_name) {
            continue;
        }
        if let Ok(display_icon) = entry.get_value::<String, _>("DisplayIcon") {
            push_unique(paths, parse_display_icon_path(&display_icon));
        }
        if let Ok(install_location) = entry.get_value::<String, _>("InstallLocation") {
            let install_location = install_location.trim().trim_matches('"');
            if !install_location.is_empty() {
                let install_location = Path::new(install_location);
                let candidate = if install_location
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.eq_ignore_ascii_case(KIRO_EXECUTABLE_NAME))
                {
                    install_location.to_path_buf()
                } else {
                    install_location.join(KIRO_EXECUTABLE_NAME)
                };
                push_unique(paths, Some(candidate));
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn is_official_kiro_display_name(display_name: &str) -> bool {
    let normalized = display_name.trim().to_ascii_lowercase();
    normalized == "kiro"
        || normalized == "kiro ide"
        || normalized.starts_with("kiro (")
        || normalized.starts_with("kiro ide (")
}

#[cfg(target_os = "windows")]
fn parse_display_icon_path(display_icon: &str) -> Option<PathBuf> {
    let value = display_icon.trim();
    let path = if let Some(quoted) = value.strip_prefix('"') {
        quoted.split_once('"').map_or(quoted, |(path, _)| path)
    } else {
        value.split_once(',').map_or(value, |(path, _)| path)
    };
    normalize_configured_path(path)
}

#[cfg(test)]
mod tests {
    use super::normalize_configured_path;
    use std::path::PathBuf;

    #[test]
    fn configured_path_trims_quotes_and_whitespace() {
        assert_eq!(
            normalize_configured_path(r#"  "C:\Program Files\Kiro\Kiro.exe"  "#),
            Some(PathBuf::from(r"C:\Program Files\Kiro\Kiro.exe"))
        );
        assert_eq!(normalize_configured_path("   "), None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn portable_candidates_include_reported_secondary_drive_layout() {
        let candidates = super::windows_candidates_from_parts(
            None,
            Vec::new(),
            None,
            vec![PathBuf::from(r"D:\")],
        );
        assert!(candidates.contains(&PathBuf::from(r"D:\Kiro\Kiro.exe")));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn configured_path_has_priority_over_registry_and_defaults() {
        let configured = PathBuf::from(r"D:\Kiro\Kiro.exe");
        let candidates = super::windows_candidates_from_parts(
            Some(configured.clone()),
            vec![PathBuf::from(r"C:\Registry\Kiro.exe")],
            Some(PathBuf::from(r"C:\Users\Tester\AppData\Local")),
            vec![PathBuf::from(r"C:\"), PathBuf::from(r"D:\")],
        );
        assert_eq!(candidates.first(), Some(&configured));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn display_icon_parser_removes_quotes_and_resource_index() {
        assert_eq!(
            super::parse_display_icon_path(r#""D:\Kiro\Kiro.exe",0"#),
            Some(PathBuf::from(r"D:\Kiro\Kiro.exe"))
        );
        assert_eq!(
            super::parse_display_icon_path(r"D:\Kiro\Kiro.exe,0"),
            Some(PathBuf::from(r"D:\Kiro\Kiro.exe"))
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn live_windows_discovery_finds_the_installed_kiro_when_present() {
        let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") else {
            return;
        };
        let installed = PathBuf::from(local_app_data)
            .join("Programs")
            .join("Kiro")
            .join("Kiro.exe");
        if !installed.is_file() {
            return;
        }
        let discovered = super::discover_kiro_executable().expect("discover installed Kiro");
        assert_eq!(discovered, installed);
    }
}
