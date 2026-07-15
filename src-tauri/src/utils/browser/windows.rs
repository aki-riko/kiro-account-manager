use super::{
    format_browser_command, is_private_arg, is_url_argument_prefix, parse_browser_command,
    private_arg_for_detected_executable, DetectedBrowser,
};
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;

#[derive(Debug, Clone, PartialEq, Eq)]
struct BrowserCandidate {
    name: String,
    path: String,
    args: Vec<String>,
}

pub(super) fn detect_browsers() -> Vec<DetectedBrowser> {
    let mut candidates = Vec::new();

    if let Some(candidate) = default_https_browser_candidate() {
        candidates.push(candidate);
    }
    candidates.extend(start_menu_browser_candidates());
    candidates.extend(fallback_browser_candidates());

    build_detected_browsers(candidates)
}

fn build_detected_browsers(candidates: Vec<BrowserCandidate>) -> Vec<DetectedBrowser> {
    let mut detected = Vec::new();

    for candidate in deduplicate_browser_candidates(candidates) {
        let path = candidate.path.trim();
        if path.is_empty() || !Path::new(path).is_file() {
            continue;
        }

        let Some(private_arg) = private_arg_for_detected_executable(path) else {
            continue;
        };

        let url_argument_prefixes = candidate
            .args
            .iter()
            .filter(|arg| is_url_argument_prefix(arg))
            .cloned()
            .collect::<Vec<_>>();
        let mut command_args = candidate
            .args
            .into_iter()
            .filter(|arg| !is_private_arg(arg) && !is_url_argument_prefix(arg))
            .collect::<Vec<_>>();
        command_args.push(private_arg.to_string());
        command_args.extend(url_argument_prefixes);

        detected.push(DetectedBrowser {
            name: normalize_browser_name(&candidate.name, path),
            path: path.to_string(),
            command: format_browser_command(path, &command_args),
            incognito_arg: private_arg.to_string(),
        });
    }

    detected
}

fn deduplicate_browser_candidates(candidates: Vec<BrowserCandidate>) -> Vec<BrowserCandidate> {
    let mut seen_paths = HashSet::new();
    let mut unique = Vec::new();

    for mut candidate in candidates {
        let path = candidate.path.trim().trim_matches('"').to_string();
        let normalized_path = path.replace('/', "\\").to_ascii_lowercase();
        if path.is_empty() || !seen_paths.insert(normalized_path) {
            continue;
        }
        candidate.path = path;
        unique.push(candidate);
    }

    unique
}

fn default_https_browser_candidate() -> Option<BrowserCandidate> {
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
    let (path, args) = parse_registered_browser_command(&command)?;

    Some(BrowserCandidate {
        name: prog_id,
        path,
        args,
    })
}

fn start_menu_browser_candidates() -> Vec<BrowserCandidate> {
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
    candidates: &mut Vec<BrowserCandidate>,
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
        let Some((path, args)) = parse_registered_browser_command(&command) else {
            continue;
        };
        candidates.push(BrowserCandidate {
            name: client_name,
            path,
            args,
        });
    }
}

fn fallback_browser_candidates() -> Vec<BrowserCandidate> {
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
    candidates: &mut Vec<BrowserCandidate>,
    root: Option<PathBuf>,
    relative_paths: &[(&str, &str)],
) {
    let Some(root) = root else {
        return;
    };

    for (name, relative_path) in relative_paths {
        candidates.push(BrowserCandidate {
            name: (*name).to_string(),
            path: root.join(relative_path).to_string_lossy().to_string(),
            args: Vec::new(),
        });
    }
}

fn parse_registered_browser_command(command: &str) -> Option<(String, Vec<String>)> {
    let expanded = expand_environment_variables(command);
    let (path, args) = parse_browser_command(&expanded).ok()?;
    let args = args
        .into_iter()
        .filter(|arg| !is_url_placeholder(arg))
        .collect();
    Some((path, args))
}

fn is_url_placeholder(arg: &str) -> bool {
    matches!(arg.to_ascii_lowercase().as_str(), "%1" | "%l" | "%u" | "%*")
}

fn expand_environment_variables(input: &str) -> String {
    expand_environment_variables_with(input, |name| env::var(name).ok())
}

fn expand_environment_variables_with<F>(input: &str, lookup: F) -> String
where
    F: Fn(&str) -> Option<String>,
{
    let mut result = String::new();
    let mut remaining = input;

    while let Some(start) = remaining.find('%') {
        result.push_str(&remaining[..start]);
        let after_start = &remaining[start + 1..];
        if let Some(placeholder) = url_placeholder_prefix(after_start) {
            result.push('%');
            result.push(placeholder);
            remaining = &after_start[placeholder.len_utf8()..];
            continue;
        }
        let Some(end) = after_start.find('%') else {
            result.push_str(&remaining[start..]);
            return result;
        };

        let name = &after_start[..end];
        if name.is_empty() {
            result.push_str("%%");
        } else if let Some(value) = lookup(name) {
            result.push_str(&value);
        } else {
            result.push('%');
            result.push_str(name);
            result.push('%');
        }

        remaining = &after_start[end + 1..];
    }

    result.push_str(remaining);
    result
}

fn url_placeholder_prefix(value: &str) -> Option<char> {
    let mut chars = value.chars();
    let placeholder = chars.next()?;
    if !matches!(placeholder, '1' | 'l' | 'L' | 'u' | 'U' | '*') {
        return None;
    }

    match chars.next() {
        None => Some(placeholder),
        Some(next) if next.is_whitespace() || matches!(next, '"' | '\'') => Some(placeholder),
        Some(_) => None,
    }
}

pub(super) fn is_registered_browser_executable(exe_path: &str) -> bool {
    let expected = normalize_path_for_comparison(exe_path);
    default_https_browser_candidate()
        .into_iter()
        .chain(start_menu_browser_candidates())
        .any(|candidate| normalize_path_for_comparison(&candidate.path) == expected)
}

fn normalize_path_for_comparison(path: &str) -> String {
    path.trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_ascii_lowercase()
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
mod tests;
