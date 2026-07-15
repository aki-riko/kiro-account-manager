use std::path::Path;

use super::super::{
    format_browser_command, has_chromium_runtime_markers, prepare_custom_browser_command,
    private_arg_for_detected_executable, private_arg_for_executable,
};
use super::{
    deduplicate_browser_candidates, default_https_browser_candidate, detect_browsers,
    expand_environment_variables_with, normalize_browser_name, parse_registered_browser_command,
    BrowserCandidate,
};

#[test]
fn parses_thorium_registered_command() {
    assert_eq!(
        parse_registered_browser_command(
            r#""C:\Users\Example\AppData\Local\Thorium\Application\thorium.exe" --single-argument %1"#,
        ),
        Some((
            r"C:\Users\Example\AppData\Local\Thorium\Application\thorium.exe".to_string(),
            vec!["--single-argument".to_string()]
        ))
    );
}

#[test]
fn parses_unquoted_registered_command_with_spaces() {
    assert_eq!(
        parse_registered_browser_command(
            r"C:\Program Files\Chromium\Application\chrome.exe --single-argument %1",
        ),
        Some((
            r"C:\Program Files\Chromium\Application\chrome.exe".to_string(),
            vec!["--single-argument".to_string()]
        ))
    );
}

#[test]
fn preserves_fixed_registered_arguments_and_removes_url_placeholder() {
    assert_eq!(
        parse_registered_browser_command(
            r#""C:\Browsers\browser.exe" "--profile-directory=Portable User" --single-argument "%L""#,
        ),
        Some((
            r"C:\Browsers\browser.exe".to_string(),
            vec![
                "--profile-directory=Portable User".to_string(),
                "--single-argument".to_string()
            ]
        ))
    );
}

#[test]
fn expands_environment_variables_without_touching_unknown_values() {
    let expanded = expand_environment_variables_with(
        r"%BROWSER_HOME%\Application\browser.exe %UNKNOWN%",
        |name| (name == "BROWSER_HOME").then(|| r"D:\Portable Browser".to_string()),
    );

    assert_eq!(
        expanded,
        r"D:\Portable Browser\Application\browser.exe %UNKNOWN%"
    );
}

#[test]
fn environment_expansion_keeps_url_placeholder_before_later_variables() {
    let expanded = expand_environment_variables_with(
        r#""C:\Browser\browser.exe" "%1" --cache-dir="%BROWSER_CACHE%""#,
        |name| (name == "BROWSER_CACHE").then(|| r"D:\Browser Cache".to_string()),
    );

    assert_eq!(
        expanded,
        r#""C:\Browser\browser.exe" "%1" --cache-dir="D:\Browser Cache""#
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
        BrowserCandidate {
            name: "Chrome".to_string(),
            path: r"C:\Browsers\chrome.exe".to_string(),
            args: vec!["--first".to_string()],
        },
        BrowserCandidate {
            name: "Chrome Duplicate".to_string(),
            path: r"c:\BROWSERS\CHROME.EXE".to_string(),
            args: vec!["--second".to_string()],
        },
    ]);

    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].name, "Chrome");
    assert_eq!(candidates[0].args, vec!["--first"]);
}

#[test]
fn live_default_private_capable_browser_is_detected() {
    let Some(candidate) = default_https_browser_candidate() else {
        return;
    };
    let expected_args = candidate.args;
    let path = candidate.path;

    let private_arg = private_arg_for_detected_executable(&path);
    if has_chromium_runtime_markers(Path::new(&path)) {
        assert_eq!(private_arg, Some("--incognito"));
    } else if private_arg.is_none() {
        return;
    }

    let browser = detect_browsers()
        .into_iter()
        .find(|browser| browser.path.eq_ignore_ascii_case(&path))
        .unwrap_or_else(|| panic!("default browser should be included: {path}"));

    let private_arg = private_arg.unwrap();
    assert_eq!(browser.incognito_arg, private_arg);
    assert!(browser.command.contains(private_arg));
    for arg in expected_args {
        assert!(browser.command.contains(&arg));
    }
    if browser.command.contains("--single-argument") {
        assert!(browser.command.find(private_arg) < browser.command.find("--single-argument"));
    }
}

#[test]
fn live_missing_executable_next_to_thorium_runtime_is_rejected() {
    let Some(candidate) = default_https_browser_candidate() else {
        return;
    };
    if !has_chromium_runtime_markers(Path::new(&candidate.path)) {
        return;
    }

    let missing_path = Path::new(&candidate.path)
        .with_file_name("kam-missing-browser.exe")
        .to_string_lossy()
        .to_string();
    if Path::new(&missing_path).exists() {
        return;
    }
    let command = format_browser_command(&missing_path, &["--incognito".to_string()]);

    assert!(prepare_custom_browser_command(&command, true).is_err());
}

#[test]
fn live_non_browser_cef_executables_are_not_treated_as_browsers() {
    for path in [
        r"C:\Program Files\NVIDIA Corporation\NVIDIA App\CEF\NVIDIA App.exe",
        r"C:\Program Files\NVIDIA Corporation\NVIDIA App\CEF\NVIDIA Overlay.exe",
    ] {
        if Path::new(path).is_file() && has_chromium_runtime_markers(Path::new(path)) {
            assert_eq!(private_arg_for_executable(path), None);
        }
    }
}
