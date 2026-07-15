// 浏览器打开工具

use crate::commands::app_settings_cmd::get_browser_launch_preferences;
use serde::Serialize;

const PRIVATE_BROWSER_ARGS: [&str; 3] = ["--incognito", "--inprivate", "-private-window"];

/// 打开浏览器访问指定 URL
/// 如果用户配置了自定义浏览器路径，则使用自定义浏览器
/// 否则按无痕偏好自动选择受支持的浏览器，或使用系统默认浏览器
pub fn open_browser(url: &str) -> Result<(), String> {
    let (browser_path, use_incognito) = get_browser_launch_preferences();
    match (browser_path, use_incognito) {
        (Some(browser_path), use_incognito) => {
            open_with_custom_browser(&browser_path, url, use_incognito)
        }
        (None, true) => open_with_detected_private_browser(url),
        (None, false) => open_with_default_browser(url),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedBrowser {
    pub name: String,
    pub path: String,
    pub incognito_arg: String,
}

/// 检测系统中安装的浏览器
#[cfg(target_os = "windows")]
pub fn detect_browsers() -> Vec<DetectedBrowser> {
    use std::path::Path;

    let browsers = vec![
        (
            "Chrome",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            "--incognito",
        ),
        (
            "Chrome (x86)",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            "--incognito",
        ),
        (
            "Edge",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            "--inprivate",
        ),
        (
            "Edge",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            "--inprivate",
        ),
        (
            "Firefox",
            r"C:\Program Files\Mozilla Firefox\firefox.exe",
            "-private-window",
        ),
        (
            "Firefox (x86)",
            r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe",
            "-private-window",
        ),
        (
            "Brave",
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
            "--incognito",
        ),
        (
            "Brave (x86)",
            r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
            "--incognito",
        ),
    ];

    let mut detected = Vec::new();
    for (name, path, incognito_arg) in browsers {
        if Path::new(path).exists() {
            detected.push(DetectedBrowser {
                name: name.to_string(),
                path: path.to_string(),
                incognito_arg: incognito_arg.to_string(),
            });
        }
    }
    detected
}

#[cfg(target_os = "macos")]
pub fn detect_browsers() -> Vec<DetectedBrowser> {
    use std::path::Path;

    let browsers = vec![
        (
            "Chrome",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "--incognito",
        ),
        (
            "Firefox",
            "/Applications/Firefox.app/Contents/MacOS/firefox",
            "-private-window",
        ),
        (
            "Safari",
            "/Applications/Safari.app/Contents/MacOS/Safari",
            "",
        ),
        (
            "Edge",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "--inprivate",
        ),
        (
            "Brave",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "--incognito",
        ),
    ];

    let mut detected = Vec::new();
    for (name, path, incognito_arg) in browsers {
        if Path::new(path).exists() {
            detected.push(DetectedBrowser {
                name: name.to_string(),
                path: path.to_string(),
                incognito_arg: incognito_arg.to_string(),
            });
        }
    }
    detected
}

#[cfg(target_os = "linux")]
pub fn detect_browsers() -> Vec<DetectedBrowser> {
    use std::path::Path;

    let browsers = vec![
        ("Chrome", "/usr/bin/google-chrome", "--incognito"),
        ("Chrome", "/usr/bin/google-chrome-stable", "--incognito"),
        ("Chromium", "/usr/bin/chromium", "--incognito"),
        ("Chromium", "/usr/bin/chromium-browser", "--incognito"),
        ("Firefox", "/usr/bin/firefox", "-private-window"),
        ("Edge", "/usr/bin/microsoft-edge", "--inprivate"),
        ("Edge", "/usr/bin/microsoft-edge-stable", "--inprivate"),
        ("Brave", "/usr/bin/brave-browser", "--incognito"),
        ("Brave", "/usr/bin/brave", "--incognito"),
    ];

    let mut detected = Vec::new();
    for (name, path, incognito_arg) in browsers {
        if Path::new(path).exists() {
            detected.push(DetectedBrowser {
                name: name.to_string(),
                path: path.to_string(),
                incognito_arg: incognito_arg.to_string(),
            });
        }
    }
    detected
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub fn detect_browsers() -> Vec<DetectedBrowser> {
    Vec::new()
}

/// 使用自定义浏览器打开 URL
/// `browser_path` 格式: "路径" 参数1 参数2... 或 路径 参数1 参数2...
/// 例如: "C:\Program Files\Google\Chrome\Application\chrome.exe" --incognito
fn open_with_custom_browser(
    browser_path: &str,
    url: &str,
    use_incognito: bool,
) -> Result<(), String> {
    let (exe_path, args) = parse_browser_command(browser_path)?;
    let args = prepare_browser_args(&exe_path, args, use_incognito)?;
    spawn_browser(&exe_path, args, url)
}

fn open_with_detected_private_browser(url: &str) -> Result<(), String> {
    let browser = select_detected_private_browser(detect_browsers()).ok_or_else(|| {
        "未找到支持命令行无痕模式的浏览器；请在设置中选择 Chrome、Edge、Firefox 或 Brave，或关闭“使用无痕浏览器”"
            .to_string()
    })?;

    spawn_browser(&browser.path, vec![browser.incognito_arg], url)
}

fn spawn_browser(exe_path: &str, mut args: Vec<String>, url: &str) -> Result<(), String> {
    args.push(url.to_string());

    std::process::Command::new(exe_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("打开浏览器失败: {e} (路径: {exe_path})"))?;

    Ok(())
}

fn select_detected_private_browser(browsers: Vec<DetectedBrowser>) -> Option<DetectedBrowser> {
    browsers
        .into_iter()
        .find(|browser| !browser.incognito_arg.trim().is_empty())
}

fn private_browser_supported() -> bool {
    let (browser_path, _) = get_browser_launch_preferences();
    match browser_path {
        Some(browser_path) => parse_browser_command(&browser_path)
            .and_then(|(exe_path, args)| prepare_browser_args(&exe_path, args, true))
            .is_ok(),
        None => select_detected_private_browser(detect_browsers()).is_some(),
    }
}

fn prepare_browser_args(
    exe_path: &str,
    args: Vec<String>,
    use_incognito: bool,
) -> Result<Vec<String>, String> {
    let existing_private_arg = args.iter().find(|arg| is_private_arg(arg)).cloned();
    let mut normalized_args = args
        .into_iter()
        .filter(|arg| !is_private_arg(arg))
        .collect::<Vec<_>>();

    if use_incognito {
        let private_arg = private_arg_for_executable(exe_path)
            .map(str::to_string)
            .or(existing_private_arg)
            .ok_or_else(|| {
                format!(
                    "当前浏览器不支持自动无痕启动: {exe_path}；请更换浏览器或关闭“使用无痕浏览器”"
                )
            })?;
        normalized_args.push(private_arg);
    }

    Ok(normalized_args)
}

fn is_private_arg(arg: &str) -> bool {
    PRIVATE_BROWSER_ARGS
        .iter()
        .any(|candidate| arg.eq_ignore_ascii_case(candidate))
}

fn private_arg_for_executable(exe_path: &str) -> Option<&'static str> {
    let file_name = exe_path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(exe_path)
        .to_ascii_lowercase();

    if file_name.contains("firefox") {
        Some("-private-window")
    } else if file_name.contains("msedge") || file_name.contains("microsoft-edge") {
        Some("--inprivate")
    } else if file_name.contains("chrome")
        || file_name.contains("chromium")
        || file_name.contains("brave")
    {
        Some("--incognito")
    } else {
        None
    }
}

fn parse_browser_command(browser_path: &str) -> Result<(String, Vec<String>), String> {
    let browser_path = browser_path.trim();
    if browser_path.is_empty() {
        return Err("浏览器路径为空".to_string());
    }

    if let Some(stripped) = browser_path.strip_prefix('"') {
        if let Some(end_quote) = stripped.find('"') {
            let path = stripped[..end_quote].to_string();
            let remaining = stripped[end_quote + 1..].trim();
            let args = if remaining.is_empty() {
                Vec::new()
            } else {
                remaining.split_whitespace().map(str::to_string).collect()
            };
            return Ok((path, args));
        }

        return Ok((browser_path.trim_matches('"').to_string(), Vec::new()));
    }

    let parts: Vec<&str> = browser_path.split_whitespace().collect();
    if parts.is_empty() {
        return Err("浏览器路径为空".to_string());
    }

    let arg_start = parts
        .iter()
        .position(|part| part.starts_with('-'))
        .unwrap_or(parts.len());
    let exe_path = parts[..arg_start].join(" ");
    let args = parts[arg_start..]
        .iter()
        .map(|part| (*part).to_string())
        .collect();

    Ok((exe_path, args))
}

/// 使用系统默认浏览器打开 URL
fn open_with_default_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {e}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        open::that(url).map_err(|e| format!("打开浏览器失败: {e}"))?;
    }

    Ok(())
}

// ===== Tauri Command =====

#[tauri::command]
pub async fn detect_installed_browsers() -> Vec<DetectedBrowser> {
    detect_browsers()
}

#[tauri::command]
pub async fn check_private_browser_support() -> bool {
    private_browser_supported()
}

#[cfg(test)]
mod tests {
    use super::{
        parse_browser_command, prepare_browser_args, private_arg_for_executable,
        select_detected_private_browser, DetectedBrowser,
    };

    fn detected_browser(name: &str, path: &str, incognito_arg: &str) -> DetectedBrowser {
        DetectedBrowser {
            name: name.to_string(),
            path: path.to_string(),
            incognito_arg: incognito_arg.to_string(),
        }
    }

    #[test]
    fn parse_browser_command_keeps_unquoted_windows_path_with_spaces() {
        let (path, args) =
            parse_browser_command(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
                .expect("path should parse");

        assert_eq!(
            path,
            r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        );
        assert!(args.is_empty());
    }

    #[test]
    fn parse_browser_command_splits_flags_after_unquoted_path() {
        let (path, args) = parse_browser_command(
            r"C:\Program Files\Google\Chrome\Application\chrome.exe --incognito --profile-directory=Default",
        )
        .expect("path with args should parse");

        assert_eq!(
            path,
            r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        );
        assert_eq!(args, vec!["--incognito", "--profile-directory=Default"]);
    }

    #[test]
    fn parse_browser_command_supports_quoted_path_and_flags() {
        let (path, args) = parse_browser_command(
            r#""C:\Program Files\Google\Chrome\Application\chrome.exe" --incognito"#,
        )
        .expect("quoted path should parse");

        assert_eq!(
            path,
            r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        );
        assert_eq!(args, vec!["--incognito"]);
    }

    #[test]
    fn private_arg_matches_supported_browser_families() {
        assert_eq!(
            private_arg_for_executable(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
            Some("--incognito")
        );
        assert_eq!(
            private_arg_for_executable(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
            Some("--inprivate")
        );
        assert_eq!(
            private_arg_for_executable(r"C:\Program Files\Mozilla Firefox\firefox.exe"),
            Some("-private-window")
        );
    }

    #[test]
    fn enabling_incognito_replaces_stale_private_flags_without_duplication() {
        let args = prepare_browser_args(
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            vec![
                "--profile-directory=Default".to_string(),
                "--inprivate".to_string(),
            ],
            true,
        )
        .expect("Chrome should support incognito mode");

        assert_eq!(args, vec!["--profile-directory=Default", "--incognito"]);
    }

    #[test]
    fn disabling_incognito_removes_known_private_flags() {
        let args = prepare_browser_args(
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            vec![
                "--incognito".to_string(),
                "--profile-directory=Default".to_string(),
            ],
            false,
        )
        .expect("normal browser launch should be supported");

        assert_eq!(args, vec!["--profile-directory=Default"]);
    }

    #[test]
    fn explicit_private_flag_supports_unknown_custom_browser() {
        let args = prepare_browser_args(
            r"D:\PortableBrowser\browser.exe",
            vec!["--incognito".to_string()],
            true,
        )
        .expect("explicit private flag should be preserved");

        assert_eq!(args, vec!["--incognito"]);
    }

    #[test]
    fn unknown_browser_without_private_flag_is_rejected_when_enabled() {
        let result = prepare_browser_args(r"D:\PortableBrowser\browser.exe", Vec::new(), true);

        assert!(result.is_err());
    }

    #[test]
    fn safari_only_candidates_do_not_claim_private_browser_support() {
        let browser = select_detected_private_browser(vec![detected_browser(
            "Safari",
            "/Applications/Safari.app/Contents/MacOS/Safari",
            "",
        )]);

        assert!(browser.is_none());
    }

    #[test]
    fn first_private_capable_candidate_is_selected() {
        let browser = select_detected_private_browser(vec![
            detected_browser(
                "Safari",
                "/Applications/Safari.app/Contents/MacOS/Safari",
                "",
            ),
            detected_browser(
                "Chrome",
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "--incognito",
            ),
        ])
        .expect("Chrome should be selected after unsupported Safari");

        assert_eq!(browser.name, "Chrome");
        assert_eq!(browser.incognito_arg, "--incognito");
    }
}
