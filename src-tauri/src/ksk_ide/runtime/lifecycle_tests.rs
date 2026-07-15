use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

use chrono::Duration as ChronoDuration;
use tokio::{net::TcpStream, sync::broadcast};
use uuid::Uuid;

use super::KskIdeRuntime;
use crate::ksk_ide::{
    config::{KiroService, KskProxyOperation},
    launcher::PROCESS_STOP_TIMEOUT,
    profile::KiroUserDataPaths,
    proxy::{subscribe_forwarded_request_observations, ForwardedRequestObservation},
};

const MODEL_HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(30);

#[tokio::test]
#[ignore = "launches the installed Kiro IDE; run only for explicit local lifecycle validation"]
async fn installed_kiro_lifecycle_with_fake_ksk() {
    assert_eq!(
        std::env::var("KAM_RUN_KSK_IDE_LIFECYCLE").as_deref(),
        Ok("1"),
        "set KAM_RUN_KSK_IDE_LIFECYCLE=1 to run this local lifecycle test"
    );
    assert!(
        !crate::kiro::process::check_kiro_running(),
        "close formal Kiro before running the isolated lifecycle test"
    );
    let formal_state = FormalStateSnapshot::capture();
    let root = std::env::temp_dir().join(format!("kam-ksk-lifecycle-{}", Uuid::new_v4()));
    let fake_ksk = "ksk_kam-lifecycle-fixture-not-a-real-key";
    let mut observations = subscribe_forwarded_request_observations();
    let executable = crate::kiro::executable::resolve_kiro_executable()
        .expect("discover installed Kiro executable");
    let mut runtime = KskIdeRuntime::start(
        &root,
        &executable,
        "us-east-1",
        fake_ksk,
        ChronoDuration::hours(1),
    )
    .await
    .expect("start installed Kiro with isolated lifecycle fixture");

    let verification = verify_running_lifecycle(&mut runtime, fake_ksk, &mut observations).await;
    let process_stop_result = runtime.stop_process(PROCESS_STOP_TIMEOUT);
    let leak_scan_result = lifecycle_leak_scan(&verification, &process_stop_result, fake_ksk);
    let stop_result = runtime.stop(PROCESS_STOP_TIMEOUT).await;
    let remove_root_result = fs::remove_dir(&root);
    assert_lifecycle_cleanup(
        process_stop_result,
        leak_scan_result,
        stop_result,
        remove_root_result,
    );
    let snapshot = verification.expect("verify running isolated lifecycle");

    formal_state.assert_unchanged();
    assert!(!snapshot.session_root.exists());
    for endpoint in snapshot.endpoints {
        assert!(TcpStream::connect(endpoint).await.is_err());
    }
    assert!(!process_exists(snapshot.pid));
}

struct LifecycleSnapshot {
    pid: u32,
    session_root: PathBuf,
    endpoints: [std::net::SocketAddr; 3],
}

struct FormalStateSnapshot {
    settings_path: PathBuf,
    settings_bytes: Option<Vec<u8>>,
    token_path: PathBuf,
    token_bytes: Option<Vec<u8>>,
}

impl FormalStateSnapshot {
    fn capture() -> Self {
        let shared = KiroUserDataPaths::discover().expect("discover formal Kiro user data");
        let sessions = shared
            .user_data_dir()
            .join("User/globalStorage/kiro.kiroagent/sessions");
        assert!(
            sessions.is_dir(),
            "formal Kiro sessions directory must exist"
        );
        assert!(
            shared.extensions_dir().is_dir(),
            "formal Kiro extensions directory must exist"
        );
        let settings_path = shared.settings_path();
        let token_path = dirs::home_dir()
            .expect("discover formal home")
            .join(".aws/sso/cache/kiro-auth-token.json");
        Self {
            settings_bytes: read_optional(&settings_path),
            token_bytes: read_optional(&token_path),
            settings_path,
            token_path,
        }
    }

    fn assert_unchanged(&self) {
        assert_eq!(
            read_optional(&self.settings_path),
            self.settings_bytes,
            "formal Kiro settings must be restored byte-for-byte"
        );
        assert_eq!(
            read_optional(&self.token_path),
            self.token_bytes,
            "formal Kiro token must remain untouched"
        );
    }
}

async fn verify_running_lifecycle(
    runtime: &mut KskIdeRuntime,
    fake_ksk: &str,
    observations: &mut broadcast::Receiver<ForwardedRequestObservation>,
) -> Result<LifecycleSnapshot, String> {
    tokio::time::sleep(Duration::from_secs(2)).await;
    let status = runtime.status()?;
    if !status.running {
        return Err("隔离 Kiro 根进程未保持运行".to_string());
    }
    let profile = runtime
        .profile
        .as_ref()
        .ok_or_else(|| "隔离 profile 不存在".to_string())?;
    let shared = KiroUserDataPaths::discover()?;
    if profile.user_data_dir() != shared.user_data_dir()
        || profile.extensions_dir() != shared.extensions_dir()
        || !profile
            .user_data_dir()
            .join("User/globalStorage/kiro.kiroagent/sessions")
            .is_dir()
    {
        return Err("隔离 Kiro 未复用正式对话或插件数据目录".to_string());
    }
    let endpoints = runtime.proxies.endpoints()?;
    let addresses = [endpoints.generic, endpoints.runtime, endpoints.management];
    for endpoint in addresses {
        TcpStream::connect(endpoint)
            .await
            .map_err(|error| format!("连接 lifecycle loopback {endpoint} 失败: {error}"))?;
    }
    verify_endpoint_overlay(profile.settings_path(), endpoints)?;
    let pid = status.pid.ok_or_else(|| "隔离 Kiro PID 缺失".to_string())?;
    let command_line = process_command_line(pid)?;
    if command_line.contains(fake_ksk)
        || !command_line.contains(&profile.user_data_dir().to_string_lossy().to_string())
        || !command_line.contains(&profile.extensions_dir().to_string_lossy().to_string())
    {
        return Err("隔离 Kiro 命令行边界验证失败".to_string());
    }
    let model_status = wait_for_model_handshake(observations).await?;
    if model_status.is_success() {
        return Err(format!(
            "生命周期假 KSK 不应被模型上游接受，实际状态: {model_status}"
        ));
    }
    Ok(LifecycleSnapshot {
        pid,
        session_root: profile.session_root().to_path_buf(),
        endpoints: addresses,
    })
}

async fn wait_for_model_handshake(
    observations: &mut broadcast::Receiver<ForwardedRequestObservation>,
) -> Result<axum::http::StatusCode, String> {
    tokio::time::timeout(MODEL_HANDSHAKE_TIMEOUT, async {
        loop {
            match observations.recv().await {
                Ok(observation)
                    if observation.service == KiroService::Management
                        && observation.operation == KskProxyOperation::ListAvailableModels =>
                {
                    return Ok(observation.status);
                }
                Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {}
                Err(broadcast::error::RecvError::Closed) => {
                    return Err("模型握手观测通道提前关闭".to_string());
                }
            }
        }
    })
    .await
    .map_err(|_| {
        format!(
            "等待官方 Kiro 模型握手超时（{} 秒）",
            MODEL_HANDSHAKE_TIMEOUT.as_secs()
        )
    })?
}

fn verify_endpoint_overlay(
    settings_path: &Path,
    endpoints: crate::ksk_ide::profile::IsolatedIdeEndpoints,
) -> Result<(), String> {
    let content = fs::read(settings_path)
        .map_err(|error| format!("读取运行中 Kiro settings 失败: {error}"))?;
    let settings: serde_json::Value = serde_json::from_slice(&content)
        .map_err(|error| format!("解析运行中 Kiro settings 失败: {error}"))?;
    let expected = [
        ("codewhisperer.config.endpoints", endpoints.generic),
        ("codewhisperer.config.krsEndpoints", endpoints.runtime),
        ("codewhisperer.config.cpsEndpoints", endpoints.management),
    ];
    for (key, endpoint) in expected {
        let actual = settings[key][0]["endpoint"].as_str();
        let expected = format!("http://{endpoint}");
        if actual != Some(expected.as_str()) {
            return Err(format!("运行中 Kiro settings 的 {key} 未指向当前 loopback"));
        }
    }
    Ok(())
}

fn read_optional(path: &Path) -> Option<Vec<u8>> {
    path.exists()
        .then(|| fs::read(path).expect("read formal Kiro state file"))
}

fn lifecycle_leak_scan(
    verification: &Result<LifecycleSnapshot, String>,
    process_stop_result: &Result<(), String>,
    fake_ksk: &str,
) -> Result<(), String> {
    match (verification, process_stop_result) {
        (Ok(snapshot), Ok(())) => assert_tree_excludes(&snapshot.session_root, fake_ksk.as_bytes()),
        (_, Err(error)) => Err(format!("隔离进程未停止，跳过泄漏扫描: {error}")),
        (Err(error), _) => Err(format!("运行态验证失败，跳过泄漏扫描: {error}")),
    }
}

fn assert_lifecycle_cleanup(
    process_stop_result: Result<(), String>,
    leak_scan_result: Result<(), String>,
    stop_result: Result<(), String>,
    remove_root_result: std::io::Result<()>,
) {
    assert!(
        process_stop_result.is_ok(),
        "stop isolated process tree: {process_stop_result:?}"
    );
    assert!(
        leak_scan_result.is_ok(),
        "scan stopped lifecycle profile: {leak_scan_result:?}"
    );
    assert!(
        stop_result.is_ok(),
        "stop isolated lifecycle: {stop_result:?}"
    );
    assert!(
        remove_root_result.is_ok(),
        "remove empty lifecycle root: {remove_root_result:?}"
    );
}

fn assert_tree_excludes(path: &Path, needle: &[u8]) -> Result<(), String> {
    for entry in fs::read_dir(path)
        .map_err(|error| format!("读取生命周期目录 {} 失败: {error}", path.display()))?
    {
        let entry = entry.map_err(|error| format!("读取生命周期目录项失败: {error}"))?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            assert_tree_excludes(&entry_path, needle)?;
            continue;
        }
        let content = fs::read(&entry_path)
            .map_err(|error| format!("读取生命周期文件 {} 失败: {error}", entry_path.display()))?;
        if content.windows(needle.len()).any(|window| window == needle) {
            return Err(format!("生命周期文件包含假 KSK: {}", entry_path.display()));
        }
    }
    Ok(())
}

fn process_command_line(pid: u32) -> Result<String, String> {
    let script = format!("(Get-CimInstance Win32_Process -Filter 'ProcessId = {pid}').CommandLine");
    let output = Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-Command", &script])
        .output()
        .map_err(|error| format!("查询隔离 Kiro 命令行失败: {error}"))?;
    if !output.status.success() {
        return Err("查询隔离 Kiro 命令行失败".to_string());
    }
    String::from_utf8(output.stdout).map_err(|error| format!("解析隔离 Kiro 命令行失败: {error}"))
}

fn process_exists(pid: u32) -> bool {
    process_command_line(pid)
        .map(|command_line| !command_line.trim().is_empty())
        .unwrap_or(false)
}
