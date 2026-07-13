use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

use chrono::Duration as ChronoDuration;
use tokio::net::TcpStream;
use uuid::Uuid;

use super::KskIdeRuntime;

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
    let root = std::env::temp_dir().join(format!("kam-ksk-lifecycle-{}", Uuid::new_v4()));
    let fake_ksk = "ksk_kam-lifecycle-fixture-not-a-real-key";
    let mut runtime = KskIdeRuntime::start(
        &root,
        "us-east-1",
        fake_ksk,
        ChronoDuration::hours(1),
    )
    .await
    .expect("start installed Kiro with isolated lifecycle fixture");

    let verification = verify_running_lifecycle(&mut runtime, fake_ksk).await;
    let process_stop_result = runtime.stop_process(Duration::from_secs(5));
    let leak_scan_result = lifecycle_leak_scan(&verification, &process_stop_result, fake_ksk);
    let stop_result = runtime.stop(Duration::from_secs(5)).await;
    let remove_root_result = fs::remove_dir(&root);
    assert_lifecycle_cleanup(process_stop_result, leak_scan_result, stop_result, remove_root_result);
    let snapshot = verification.expect("verify running isolated lifecycle");

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

async fn verify_running_lifecycle(
    runtime: &mut KskIdeRuntime,
    fake_ksk: &str,
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
    let endpoints = runtime.proxies.endpoints()?;
    let addresses = [endpoints.generic, endpoints.runtime, endpoints.management];
    for endpoint in addresses {
        TcpStream::connect(endpoint)
            .await
            .map_err(|error| format!("连接 lifecycle loopback {endpoint} 失败: {error}"))?;
    }
    let pid = status.pid.ok_or_else(|| "隔离 Kiro PID 缺失".to_string())?;
    let command_line = process_command_line(pid)?;
    if command_line.contains(fake_ksk)
        || !command_line.contains(&profile.user_data_dir().to_string_lossy().to_string())
        || !command_line.contains(&profile.extensions_dir().to_string_lossy().to_string())
    {
        return Err("隔离 Kiro 命令行边界验证失败".to_string());
    }
    Ok(LifecycleSnapshot {
        pid,
        session_root: profile.session_root().to_path_buf(),
        endpoints: addresses,
    })
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
    assert!(stop_result.is_ok(), "stop isolated lifecycle: {stop_result:?}");
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
        let content = fs::read(&entry_path).map_err(|error| {
            format!(
                "读取生命周期文件 {} 失败: {error}",
                entry_path.display()
            )
        })?;
        if content.windows(needle.len()).any(|window| window == needle) {
            return Err(format!("生命周期文件包含假 KSK: {}", entry_path.display()));
        }
    }
    Ok(())
}

fn process_command_line(pid: u32) -> Result<String, String> {
    let script = format!(
        "(Get-CimInstance Win32_Process -Filter 'ProcessId = {pid}').CommandLine"
    );
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
