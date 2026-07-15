use super::{private_arg_for_executable, DetectedBrowser};
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;

pub(super) fn detect_browsers() -> Vec<DetectedBrowser> {
    let mut candidates = Vec::new();

    if let Some(candidate) = default_https_browser_candidate() {
        candidates.push(candidate);
    }
    candidates.extend(start_menu_browser_candidates());
    candidates.extend(fallback_browser_candidates());

    build_detected_browsers(candidates)
}

fn build_detected_browsers(candidates: Vec<(String, String)>) -> Vec<DetectedBrowser> {
    let mut detected = Vec::new();

    for (name, path) in deduplicate_browser_candidates(candidates) {
        let path = path.trim();
        if path.is_empty() || !Path::new(path).is_file() {
            continue;
        }

        let Some(private_arg) = private_arg_for_executable(path) else {
            continue;
        };

        detected.push(DetectedBrowser {
            name: normalize_browser_name(&name, path),
            path: path.to_string(),
            incognito_arg: private_arg.to_string(),
        });
    }

    detected
}

fn deduplicate_browser_candidates(candidates: Vec<(String, String)>) -> Vec<(String, String)> {
    let mut seen_paths = HashSet::new();
    let mut unique = Vec::new();

    for (name, path) in candidates {
        let path = path.trim().trim_matches('"').to_string();
        let normalized_path = path.replace('/', "\\").to_ascii_lowercase();
        if path.is_empty() || !seen_paths.insert(normalized_path) {
            continue;
        }
        unique.push((name, path));
    }

    unique
}

fn default_https_browser_candidate() -> Option<(String, String)> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let user_choice = hkcu
        .open_subkey(
            r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice",
        )
        .ok()?;
    let prog_id: String = user_choice.get_value("ProgId").ok()?;

    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    let command_key = hkcr
        .open_subkey(format!(r"{}\shell\open\command", prog_id))
        .ok()?;
    let command: String = command_key.get_value("").ok()?;
    let path = parse_registered_browser_command(&command)?;

    Some((prog_id, path))
}

fn start_menu_browser_candidates() -> Vec<(String, String)> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let mut candidates = Vec::new();

    collect_start_menu_browser_candidates(
        &hkcu,
        r"Software\Clients\StartMenuInternet",
        &mut candidates,
    );
    collect_start_menu_browser_candidates(
        &hklm,
        r"Software\Clients\StartMenuInternet",
        &mut candidates,
    );
    collect_start_menu_browser_candidates(
        &hklm,
        r"Software\WOW6432Node\Clients\StartMenuInternet",
        &mut candidates,
    );

    candidates
}

fn collect_start_menu_browser_candidates(
    hive: &RegKey,
    registry_path: &str,
    candidates: &mut Vec<(String, String)>,
) {
    let Ok(root) = hive.open_subkey(registry_path) else {
        return;
    };

    for client_name in root.enum_keys().filter_map(Result::ok) {
        let command_path = format!(r"{}\shell\open\command", client_name);
        let Ok(command_key) = root.open_subkey(command_path) else {
            continue;
        };
        let Ok(command) = command_key.get_value::<String, _>("") else {
            continue;
        };
        let Some(path) = parse_registered_browser_command(&command) else {
            continue;
        };
        candidates.push((client_name, path));
    }
}

fn fallback_browser_candidates() -> Vec<(String, String)> {
    let mut candidates = Vec::new();

    append_candidates_from_root(
        &mut candidates,
        env::var_os("ProgramFiles").map(PathBuf::from),
        &[
            ("Chrome", r"Google\Chrome\Application\chrome.exe"),
            ("Edge", r"Microsoft\Edge\Application\msedge.exe"),
            (
                "Brave",
                r"BraveSoftware\Brave-Browser\Application\brave.exe",
            ),
            ("Firefox", r"Mozilla Firefox\firefox.exe"),
            ("Vivaldi", r"Vivaldi\Application\vivaldi.exe"),
        ],
    );
    append_candidates_from_root(
        &mut candidates,
        env::var_os("ProgramFiles(x86)").map(PathBuf::from),
        &[
            ("Chrome", r"Google\Chrome\Application\chrome.exe"),
            ("Edge", r"Microsoft\Edge\Application\msedge.exe"),
            (
                "Brave",
                r"BraveSoftware\Brave-Browser\Application\brave.exe",
            ),
            ("Firefox", r"Mozilla Firefox\firefox.exe"),
            ("Vivaldi", r"Vivaldi\Application\vivaldi.exe"),
        ],
    );
    append_candidates_from_root(
        &mut candidates,
        env::var_os("LOCALAPPDATA").map(PathBuf::from),
        &[
            ("Chrome", r"Google\Chrome\Application\chrome.exe"),
            ("Chromium", r"Chromium\Application\chrome.exe"),
            ("Edge", r"Microsoft\Edge\Application\msedge.exe"),
            (
                "Brave",
                r"BraveSoftware\Brave-Browser\Application\brave.exe",
            ),
            ("Thorium", r"Thorium\Application\thorium.exe"),
            ("Vivaldi", r"Vivaldi\Application\vivaldi.exe"),
            ("Yandex", r"Yandex\YandexBrowser\Application\browser.exe"),
            (
                "CatsXP",
                r"CatsxpSoftware\Catsxp-Browser\Application\catsxp.exe",
            ),
            ("CentBrowser", r"CentBrowser\Application\chrome.exe"),
            ("Opera", r"Programs\Opera\opera.exe"),
            ("Opera GX", r"Programs\Opera GX\opera.exe"),
        ],
    );

    candidates
}

fn append_candidates_from_root(
    candidates: &mut Vec<(String, String)>,
    root: Option<PathBuf>,
    relative_paths: &[(&str, &str)],
) {
    let Some(root) = root else {
        return;
    };

    for (name, relative_path) in relative_paths {
        candidates.push((
            (*name).to_string(),
            root.join(relative_path).to_string_lossy().to_string(),
        ));
    }
}

fn parse_registered_browser_command(command: &str) -> Option<String> {
    let command = command.trim();
    if command.is_empty() {
        return None;
    }

    if let Some(stripped) = command.strip_prefix('"') {
        let end_quote = stripped.find('"')?;
        return Some(stripped[..end_quote].to_string());
    }

    let lower = command.to_ascii_lowercase();
    let exe_end = lower.find(".exe")? + 4;
    Some(command[..exe_end].trim().to_string())
}

fn normalize_browser_name(registry_name: &str, path: &str) -> String {
    let mut name = registry_name
        .split('.')
        .next()
        .unwrap_or(registry_name)
        .trim()
        .to_string();

    for suffix in ["HTML", "HTM", "URL", ".EXE"] {
        if name.to_ascii_uppercase().ends_with(suffix) {
            name.truncate(name.len().saturating_sub(suffix.len()));
            break;
        }
    }

    if !name.is_empty() {
        return name;
    }

    Path::new(path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Browser")
        .to_string()
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::super::has_chromium_runtime_markers;
    use super::{
        deduplicate_browser_candidates, default_https_browser_candidate, detect_browsers,
        normalize_browser_name, parse_registered_browser_command, private_arg_for_executable,
    };

    #[test]
    fn parses_thorium_registered_command() {
        assert_eq!(
            parse_registered_browser_command(
                r#""C:\Users\Example\AppData\Local\Thorium\Application\thorium.exe" --single-argument %1"#,
            ),
            Some(r"C:\Users\Example\AppData\Local\Thorium\Application\thorium.exe".to_string())
        );
    }

    #[test]
    fn parses_unquoted_registered_command_with_spaces() {
        assert_eq!(
            parse_registered_browser_command(
                r"C:\Program Files\Chromium\Application\chrome.exe --single-argument %1",
            ),
            Some(r"C:\Program Files\Chromium\Application\chrome.exe".to_string())
        );
    }

    #[test]
    fn normalizes_registry_browser_names() {
        assert_eq!(
            normalize_browser_name("ThoriumHTM.123", "thorium.exe"),
            "Thorium"
        );
        assert_eq!(normalize_browser_name("ChromeHTML", "chrome.exe"), "Chrome");
        assert_eq!(
            normalize_browser_name("FirefoxURL", "firefox.exe"),
            "Firefox"
        );
    }

    #[test]
    fn candidate_builder_deduplicates_paths_case_insensitively() {
        let candidates = deduplicate_browser_candidates(vec![
            ("Chrome".to_string(), r"C:\Browsers\chrome.exe".to_string()),
            (
                "Chrome Duplicate".to_string(),
                r"c:\BROWSERS\CHROME.EXE".to_string(),
            ),
        ]);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].0, "Chrome");
    }

    #[test]
    fn live_default_private_capable_browser_is_detected() {
        let Some((_, path)) = default_https_browser_candidate() else {
            return;
        };

        let private_arg = private_arg_for_executable(&path);
        if has_chromium_runtime_markers(Path::new(&path)) {
            assert_eq!(private_arg, Some("--incognito"));
        } else if private_arg.is_none() {
            return;
        }

        let browser = detect_browsers()
            .into_iter()
            .find(|browser| browser.path.eq_ignore_ascii_case(&path))
            .unwrap_or_else(|| panic!("default browser should be included: {path}"));

        assert_eq!(browser.incognito_arg, private_arg.unwrap());
    }
}
