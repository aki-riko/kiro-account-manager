use super::{
    format_browser_command, prepare_browser_args, prepare_custom_browser_command,
    private_arg_for_browser_identity, private_arg_for_executable, select_detected_private_browser,
    DetectedBrowser,
};

fn detected_browser(name: &str, path: &str, incognito_arg: &str) -> DetectedBrowser {
    let command_args = if incognito_arg.is_empty() {
        Vec::new()
    } else {
        vec![incognito_arg.to_string()]
    };
    DetectedBrowser {
        name: name.to_string(),
        path: path.to_string(),
        command: format_browser_command(path, &command_args),
        incognito_arg: incognito_arg.to_string(),
    }
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
    assert_eq!(
        private_arg_for_executable(r"C:\Users\Example\AppData\Local\Programs\Opera\opera.exe"),
        Some("--private")
    );
}

#[test]
fn runtime_markers_require_trusted_browser_evidence() {
    assert_eq!(
        private_arg_for_browser_identity("NVIDIA App.exe", false),
        None
    );
    assert_eq!(
        private_arg_for_browser_identity("NVIDIA Overlay.exe", false),
        None
    );
    assert_eq!(
        private_arg_for_browser_identity("thorium.exe", true),
        Some("--incognito")
    );
    assert_eq!(
        private_arg_for_browser_identity("chromedriver.exe", false),
        None
    );
}

#[test]
fn custom_browser_command_rejects_missing_executable() {
    let missing = std::env::temp_dir().join("kam-browser-tests-missing.exe");
    let command = format_browser_command(&missing.to_string_lossy(), &["--incognito".to_string()]);

    assert!(prepare_custom_browser_command(&command, true).is_err());
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
fn single_argument_prefix_is_kept_immediately_before_the_url_slot() {
    let args = prepare_browser_args(
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        vec![
            "--single-argument".to_string(),
            "--profile-directory=Default".to_string(),
        ],
        true,
    )
    .expect("Chrome should support incognito mode");

    assert_eq!(
        args,
        vec![
            "--profile-directory=Default",
            "--incognito",
            "--single-argument"
        ]
    );
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
fn browser_without_private_mode_does_not_receive_empty_command_argument() {
    let browser = detected_browser(
        "Safari",
        "/Applications/Safari.app/Contents/MacOS/Safari",
        "",
    );

    assert_eq!(
        browser.command,
        r#"/Applications/Safari.app/Contents/MacOS/Safari"#
    );
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
