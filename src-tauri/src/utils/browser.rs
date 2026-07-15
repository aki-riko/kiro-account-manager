// 浏览器打开工具

use crate::commands::app_settings_cmd::get_browser_launch_preferences;
use serde::Serialize;
use std::path::Path;

mod command;
#[cfg(target_os = "windows")]
mod windows;

use command::{format_browser_command, parse_browser_command};

const PRIVATE_BROWSER_ARGS: [&str; 4] =
    ["--incognito", "--inprivate", "--private", "-private-window"];
const URL_ARGUMENT_PREFIXES: [&str; 1] = ["--single-argument"];

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
    pub command: String,
    pub incognito_arg: String,
}

/// 检测系统中安装的浏览器
#[cfg(target_os = "windows")]
pub fn detect_browsers() -> Vec<DetectedBrowser> {
    windows::detect_browsers()
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
            let command_args = if incognito_arg.is_empty() {
                Vec::new()
            } else {
                vec![incognito_arg.to_string()]
            };
            detected.push(DetectedBrowser {
                name: name.to_string(),
                path: path.to_string(),
                command: format_browser_command(path, &command_args),
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
            let command_args = if incognito_arg.is_empty() {
                Vec::new()
            } else {
                vec![incognito_arg.to_string()]
            };
            detected.push(DetectedBrowser {
                name: name.to_string(),
                path: path.to_string(),
                command: format_browser_command(path, &command_args),
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
    let (exe_path, args) = prepare_custom_browser_command(browser_path, use_incognito)?;
    spawn_browser(&exe_path, args, url)
}

fn open_with_detected_private_browser(url: &str) -> Result<(), String> {
    let browser = select_detected_private_browser(detect_browsers()).ok_or_else(|| {
        "未找到支持命令行隐私窗口的浏览器；请在设置中选择受支持的浏览器，或关闭“使用无痕浏览器”"
            .to_string()
    })?;

    let (exe_path, args) = parse_browser_command(&browser.command)?;
    let args = prepare_browser_args(&exe_path, args, true)?;
    spawn_browser(&exe_path, args, url)
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
        Some(browser_path) => prepare_custom_browser_command(&browser_path, true).is_ok(),
        None => select_detected_private_browser(detect_browsers()).is_some(),
    }
}

fn prepare_custom_browser_command(
    browser_command: &str,
    use_incognito: bool,
) -> Result<(String, Vec<String>), String> {
    let (exe_path, args) = parse_browser_command(browser_command)?;
    if !Path::new(&exe_path).is_file() {
        return Err(format!("浏览器可执行文件不存在: {exe_path}"));
    }

    let args = prepare_browser_args(&exe_path, args, use_incognito)?;
    Ok((exe_path, args))
}

fn prepare_browser_args(
    exe_path: &str,
    args: Vec<String>,
    use_incognito: bool,
) -> Result<Vec<String>, String> {
    let existing_private_arg = args.iter().find(|arg| is_private_arg(arg)).cloned();
    let url_argument_prefixes = args
        .iter()
        .filter(|arg| is_url_argument_prefix(arg))
        .cloned()
        .collect::<Vec<_>>();
    let mut normalized_args = args
        .into_iter()
        .filter(|arg| !is_private_arg(arg) && !is_url_argument_prefix(arg))
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
    normalized_args.extend(url_argument_prefixes);

    Ok(normalized_args)
}

pub(super) fn is_private_arg(arg: &str) -> bool {
    PRIVATE_BROWSER_ARGS
        .iter()
        .any(|candidate| arg.eq_ignore_ascii_case(candidate))
}

pub(super) fn is_url_argument_prefix(arg: &str) -> bool {
    URL_ARGUMENT_PREFIXES
        .iter()
        .any(|candidate| arg.eq_ignore_ascii_case(candidate))
}

fn private_arg_for_executable(exe_path: &str) -> Option<&'static str> {
    #[cfg(target_os = "windows")]
    let allow_runtime_markers = Path::new(exe_path).is_file()
        && windows::is_registered_browser_executable(exe_path)
        && has_chromium_runtime_markers(Path::new(exe_path));

    #[cfg(not(target_os = "windows"))]
    let allow_runtime_markers = false;

    private_arg_for_browser_identity(exe_path, allow_runtime_markers)
}

pub(super) fn private_arg_for_detected_executable(exe_path: &str) -> Option<&'static str> {
    private_arg_for_browser_identity(exe_path, has_chromium_runtime_markers(Path::new(exe_path)))
}

fn private_arg_for_browser_identity(
    exe_path: &str,
    allow_runtime_markers: bool,
) -> Option<&'static str> {
    let file_name = exe_path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(exe_path)
        .to_ascii_lowercase();
    let executable_stem = file_name.strip_suffix(".exe").unwrap_or(&file_name);

    if executable_stem == "firefox" {
        Some("-private-window")
    } else if matches!(executable_stem, "msedge" | "microsoft-edge") {
        Some("--inprivate")
    } else if executable_stem == "opera" {
        Some("--private")
    } else if matches!(
        executable_stem,
        "chrome"
            | "chromium"
            | "chromium-browser"
            | "google chrome"
            | "google-chrome"
            | "google-chrome-stable"
            | "brave"
            | "brave browser"
            | "brave-browser"
    ) || allow_runtime_markers
    {
        Some("--incognito")
    } else {
        None
    }
}

fn has_chromium_runtime_markers(exe_path: &Path) -> bool {
    let Some(application_dir) = exe_path.parent() else {
        return false;
    };

    if directory_has_chromium_runtime_markers(application_dir) {
        return true;
    }

    let Ok(entries) = std::fs::read_dir(application_dir) else {
        return false;
    };

    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .any(|path| directory_has_chromium_runtime_markers(&path))
}

fn directory_has_chromium_runtime_markers(directory: &Path) -> bool {
    directory.join("chrome_elf.dll").is_file()
        && directory.join("icudtl.dat").is_file()
        && (directory.join("chrome.dll").is_file() || directory.join("resources.pak").is_file())
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
mod tests;
