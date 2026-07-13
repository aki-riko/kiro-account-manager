use std::{fs, net::SocketAddr, path::PathBuf};

use chrono::Duration;
use serde_json::{json, Value};
use uuid::Uuid;

use super::{recover_stale_settings, IsolatedIdeEndpoints, IsolatedIdeProfile, KiroUserDataPaths};

struct TestLayout {
    root: PathBuf,
    isolation_root: PathBuf,
    shared: KiroUserDataPaths,
}

impl TestLayout {
    fn create(label: &str, settings: Value) -> Self {
        let root =
            std::env::temp_dir().join(format!("kam-ksk-shared-profile-{label}-{}", Uuid::new_v4()));
        let user_data = root.join("formal-user-data");
        let extensions = root.join("formal-extensions");
        fs::create_dir_all(user_data.join("User")).expect("create formal user data");
        fs::create_dir_all(&extensions).expect("create formal extensions");
        fs::write(
            user_data.join("User/settings.json"),
            serde_json::to_vec_pretty(&settings).expect("serialize settings"),
        )
        .expect("write formal settings");
        let isolation_root = root.join("isolated");
        let shared =
            KiroUserDataPaths::new(user_data, extensions).expect("create shared Kiro data paths");
        Self {
            root,
            isolation_root,
            shared,
        }
    }

    fn cleanup(self) {
        fs::remove_dir_all(self.root).expect("remove shared profile test root");
    }
}

fn loopback_endpoints() -> IsolatedIdeEndpoints {
    IsolatedIdeEndpoints {
        generic: SocketAddr::from(([127, 0, 0, 1], 33_001)),
        runtime: SocketAddr::from(([127, 0, 0, 1], 33_002)),
        management: SocketAddr::from(([127, 0, 0, 1], 33_003)),
    }
}

fn read_settings(layout: &TestLayout) -> Value {
    let content = fs::read_to_string(layout.shared.settings_path()).expect("read settings");
    serde_json::from_str(&content).expect("parse settings")
}

#[test]
fn reuses_formal_user_data_and_extensions_but_keeps_token_in_isolated_home() {
    let layout = TestLayout::create("reuse", json!({ "editor.fontSize": 14 }));
    let original_settings =
        fs::read(layout.shared.settings_path()).expect("snapshot original settings bytes");
    let profile = IsolatedIdeProfile::create(
        &layout.isolation_root,
        &layout.shared,
        "us-east-1",
        loopback_endpoints(),
        Duration::hours(1),
    )
    .expect("create shared-data profile");

    assert_eq!(profile.user_data_dir(), layout.shared.user_data_dir());
    assert_eq!(profile.extensions_dir(), layout.shared.extensions_dir());
    assert!(profile.token_path().starts_with(profile.home_dir()));
    assert!(!profile.token_path().starts_with(profile.user_data_dir()));
    assert_eq!(read_settings(&layout)["editor.fontSize"], 14);
    assert_eq!(
        read_settings(&layout)["codewhisperer.config.krsEndpoints"][0]["endpoint"],
        "http://127.0.0.1:33002"
    );

    profile
        .cleanup()
        .expect("restore settings and cleanup profile");
    let restored = read_settings(&layout);
    assert_eq!(restored, json!({ "editor.fontSize": 14 }));
    assert_eq!(
        fs::read(layout.shared.settings_path()).expect("read restored settings bytes"),
        original_settings
    );
    assert!(layout.shared.user_data_dir().exists());
    assert!(layout.shared.extensions_dir().exists());
    layout.cleanup();
}

#[test]
fn restore_preserves_unrelated_settings_changed_while_ksk_ide_runs() {
    let layout = TestLayout::create("merge", json!({ "editor.fontSize": 14 }));
    let profile = IsolatedIdeProfile::create(
        &layout.isolation_root,
        &layout.shared,
        "us-east-1",
        loopback_endpoints(),
        Duration::hours(1),
    )
    .expect("create shared-data profile");
    let mut during_run = read_settings(&layout);
    during_run["workbench.colorTheme"] = json!("Kiro Dark");
    fs::write(
        layout.shared.settings_path(),
        serde_json::to_vec_pretty(&during_run).expect("serialize changed settings"),
    )
    .expect("write changed settings");

    profile.cleanup().expect("restore endpoint keys");

    let restored = read_settings(&layout);
    assert_eq!(restored["editor.fontSize"], 14);
    assert_eq!(restored["workbench.colorTheme"], "Kiro Dark");
    assert!(restored.get("codewhisperer.config.endpoints").is_none());
    assert!(restored.get("codewhisperer.config.krsEndpoints").is_none());
    assert!(restored.get("codewhisperer.config.cpsEndpoints").is_none());
    layout.cleanup();
}

#[test]
fn stale_journal_restores_settings_after_unclean_shutdown() {
    let layout = TestLayout::create("recovery", json!({ "editor.fontSize": 16 }));
    let profile = IsolatedIdeProfile::create(
        &layout.isolation_root,
        &layout.shared,
        "us-east-1",
        loopback_endpoints(),
        Duration::hours(1),
    )
    .expect("create shared-data profile");
    assert!(read_settings(&layout)
        .get("codewhisperer.config.krsEndpoints")
        .is_some());
    std::mem::forget(profile);

    let recovered = recover_stale_settings(&layout.isolation_root, &layout.shared.settings_path())
        .expect("recover stale settings journal");

    assert_eq!(recovered, 1);
    assert_eq!(read_settings(&layout), json!({ "editor.fontSize": 16 }));
    layout.cleanup();
}
