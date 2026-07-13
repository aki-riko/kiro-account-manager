use std::{
    path::{Path, PathBuf},
    process::{Child, Command},
    thread,
    time::{Duration, Instant},
};

use super::profile::IsolatedIdeProfile;

#[cfg(target_os = "windows")]
use crate::utils::cmd_output::decode_cmd_output;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const PROCESS_POLL_INTERVAL: Duration = Duration::from_millis(100);
const GRACEFUL_STOP_WINDOW: Duration = Duration::from_secs(5);
pub const PROCESS_STOP_TIMEOUT: Duration = Duration::from_secs(45);
const INHERITED_AWS_CREDENTIAL_ENV: &[&str] = &[
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_PROFILE",
    "AWS_DEFAULT_PROFILE",
    "AWS_SHARED_CREDENTIALS_FILE",
    "AWS_CONFIG_FILE",
    "AWS_WEB_IDENTITY_TOKEN_FILE",
    "AWS_ROLE_ARN",
    "AWS_CONTAINER_CREDENTIALS_FULL_URI",
    "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
];

pub struct KiroIsolatedProcess {
    child: Child,
    pid: u32,
}

impl KiroIsolatedProcess {
    pub fn launch(profile: &IsolatedIdeProfile) -> Result<Self, String> {
        ensure_isolated_launch_available()?;
        let executable = discover_kiro_executable()?;
        Self::launch_with_executable(&executable, profile)
    }

    pub fn launch_with_executable(
        executable: &Path,
        profile: &IsolatedIdeProfile,
    ) -> Result<Self, String> {
        if !executable.is_file() {
            return Err(format!(
                "Kiro IDE 可执行文件不存在: {}",
                executable.display()
            ));
        }
        let child = build_launch_command(executable, profile)
            .spawn()
            .map_err(|error| format!("启动隔离 Kiro IDE 失败: {error}"))?;
        let pid = child.id();
        Ok(Self { child, pid })
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }

    pub fn is_running(&mut self) -> Result<bool, String> {
        self.child
            .try_wait()
            .map(|status| status.is_none())
            .map_err(|error| format!("检查隔离 Kiro 进程失败: {error}"))
    }

    pub fn stop(&mut self, total_timeout: Duration) -> Result<(), String> {
        if !self.is_running()? {
            return Ok(());
        }
        let deadline = Instant::now() + total_timeout;
        request_process_tree_stop(self.pid, false).unwrap_or_else(|error| {
            log::warn!(
                "[KskIdeLauncher] 请求 PID {} 优雅退出失败: {error}",
                self.pid
            );
        });
        let graceful_deadline = (Instant::now() + GRACEFUL_STOP_WINDOW).min(deadline);
        if wait_for_exit_until(&mut self.child, graceful_deadline)? {
            return Ok(());
        }
        request_process_tree_stop(self.pid, true)?;
        if wait_for_exit_until(&mut self.child, deadline)? {
            return Ok(());
        }
        Err(format!("隔离 Kiro 进程树未在期限内退出，PID={}", self.pid))
    }
}

pub fn ensure_isolated_launch_available() -> Result<(), String> {
    validate_no_existing_kiro(crate::kiro::process::check_kiro_running())
}

fn validate_no_existing_kiro(kiro_running: bool) -> Result<(), String> {
    if kiro_running {
        return Err(
            "检测到正式 Kiro IDE 正在运行；官方单实例行为可能影响现有进程，请先完全退出正式 Kiro 后再启动 KSK 隔离实例"
                .to_string(),
        );
    }
    Ok(())
}

pub fn discover_kiro_executable() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        return crate::kiro::ide::get_kiro_ide_paths()
            .into_iter()
            .find(|path| path.is_file())
            .ok_or_else(|| "未找到 Kiro IDE 可执行文件".to_string());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("KSK 隔离 IDE 首版仅支持 Windows".to_string())
    }
}

pub fn build_launch_command(executable: &Path, profile: &IsolatedIdeProfile) -> Command {
    let mut command = Command::new(executable);
    command
        .arg("--user-data-dir")
        .arg(profile.user_data_dir())
        .arg("--extensions-dir")
        .arg(profile.extensions_dir())
        .arg("--new-window")
        .env("USERPROFILE", profile.home_dir())
        .env("HOME", profile.home_dir());
    for name in INHERITED_AWS_CREDENTIAL_ENV {
        command.env_remove(name);
    }
    command
}

fn wait_for_exit_until(child: &mut Child, deadline: Instant) -> Result<bool, String> {
    loop {
        if child
            .try_wait()
            .map_err(|error| format!("等待隔离 Kiro 退出失败: {error}"))?
            .is_some()
        {
            return Ok(true);
        }
        if Instant::now() >= deadline {
            return Ok(false);
        }
        thread::sleep(PROCESS_POLL_INTERVAL);
    }
}

#[cfg(target_os = "windows")]
fn request_process_tree_stop(pid: u32, force: bool) -> Result<(), String> {
    let pid = pid.to_string();
    let mut command = Command::new("taskkill");
    command.args(["/PID", &pid, "/T"]);
    if force {
        command.arg("/F");
    }
    let output = command
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("执行 PID 定向 taskkill 失败: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stdout = decode_cmd_output(&output.stdout);
    let stderr = decode_cmd_output(&output.stderr);
    let message = format!("{} {}", stdout.trim(), stderr.trim());
    if taskkill_reports_missing_process(&message) {
        return Ok(());
    }
    Err(format!("PID 定向 taskkill 失败: {}", message.trim()))
}

fn taskkill_reports_missing_process(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("there is no running instance of the task")
        || normalized.contains("no running instance")
        || message.contains("没有运行的任务实例")
}

#[cfg(not(target_os = "windows"))]
fn request_process_tree_stop(_pid: u32, _force: bool) -> Result<(), String> {
    Err("KSK 隔离 IDE 首版仅支持 Windows PID 树停止".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        build_launch_command, taskkill_reports_missing_process, validate_no_existing_kiro,
        INHERITED_AWS_CREDENTIAL_ENV,
    };
    use crate::ksk_ide::profile::{IsolatedIdeEndpoints, IsolatedIdeProfile, KiroUserDataPaths};
    use chrono::Duration;
    use std::{
        collections::HashMap,
        ffi::{OsStr, OsString},
        net::SocketAddr,
        path::PathBuf,
    };
    use uuid::Uuid;

    fn test_profile() -> (PathBuf, IsolatedIdeProfile) {
        let root = std::env::temp_dir().join(format!("kam-ksk-launcher-{}", Uuid::new_v4()));
        let user_data = root.join("formal-user-data");
        let extensions = root.join("formal-extensions");
        std::fs::create_dir_all(user_data.join("User")).expect("create user data");
        std::fs::create_dir_all(&extensions).expect("create extensions");
        std::fs::write(user_data.join("User/settings.json"), "{}").expect("write settings");
        let shared = KiroUserDataPaths::new(user_data, extensions).expect("create shared paths");
        let isolation_root = root.join("isolated");
        let endpoints = IsolatedIdeEndpoints {
            generic: SocketAddr::from(([127, 0, 0, 1], 32_001)),
            runtime: SocketAddr::from(([127, 0, 0, 1], 32_002)),
            management: SocketAddr::from(([127, 0, 0, 1], 32_003)),
        };
        let profile = IsolatedIdeProfile::create(
            &isolation_root,
            &shared,
            "us-east-1",
            endpoints,
            Duration::hours(1),
        )
        .expect("create launcher profile");
        (root, profile)
    }

    #[test]
    fn command_uses_isolated_paths_and_removes_inherited_aws_credentials() {
        let (root, profile) = test_profile();
        let executable = PathBuf::from(r"C:\Program Files\Kiro\Kiro.exe");
        let command = build_launch_command(&executable, &profile);
        let args = command.get_args().collect::<Vec<_>>();
        let env = command
            .get_envs()
            .map(|(key, value)| (key.to_os_string(), value.map(OsStr::to_os_string)))
            .collect::<HashMap<OsString, Option<OsString>>>();

        assert_eq!(command.get_program(), executable.as_os_str());
        assert_eq!(args[0], "--user-data-dir");
        assert_eq!(args[1], profile.user_data_dir().as_os_str());
        assert_eq!(args[2], "--extensions-dir");
        assert_eq!(args[3], profile.extensions_dir().as_os_str());
        assert_eq!(args[4], "--new-window");
        assert_eq!(
            env.get(OsStr::new("USERPROFILE")).and_then(Option::as_ref),
            Some(&profile.home_dir().as_os_str().to_os_string())
        );
        assert_eq!(
            env.get(OsStr::new("HOME")).and_then(Option::as_ref),
            Some(&profile.home_dir().as_os_str().to_os_string())
        );
        for name in INHERITED_AWS_CREDENTIAL_ENV {
            assert_eq!(env.get(OsStr::new(name)), Some(&None));
        }
        assert!(!args
            .iter()
            .any(|arg| arg.to_string_lossy().contains("ksk_")));

        profile.cleanup().expect("cleanup launcher profile");
        std::fs::remove_dir_all(&root).expect("remove launcher test root");
    }

    #[test]
    fn parallel_launch_requires_formal_kiro_to_be_closed() {
        assert!(validate_no_existing_kiro(false).is_ok());
        let error = validate_no_existing_kiro(true).expect_err("parallel Kiro must be rejected");
        assert!(error.contains("请先完全退出正式 Kiro"));
    }

    #[test]
    fn taskkill_missing_process_output_is_not_a_hard_failure() {
        assert!(taskkill_reports_missing_process(
            "ERROR: The process with PID 41416 could not be terminated.\nReason: There is no running instance of the task."
        ));
        assert!(!taskkill_reports_missing_process(
            "ERROR: Access is denied."
        ));
    }
}
