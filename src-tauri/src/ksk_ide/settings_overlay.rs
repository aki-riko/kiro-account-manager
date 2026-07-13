use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const JOURNAL_VERSION: u8 = 1;
const JOURNAL_FILE_NAME: &str = "settings-recovery.json";
const BACKUP_FILE_NAME: &str = "settings.backup";
const ENDPOINT_KEYS: [&str; 3] = [
    "codewhisperer.config.endpoints",
    "codewhisperer.config.krsEndpoints",
    "codewhisperer.config.cpsEndpoints",
];

#[derive(Debug, Serialize, Deserialize)]
struct OriginalSetting {
    present: bool,
    value: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SettingsRecoveryJournal {
    version: u8,
    session_id: String,
    settings_path: PathBuf,
    settings_existed: bool,
    original_sha256: Option<String>,
    overlay_sha256: String,
    original_settings: BTreeMap<String, OriginalSetting>,
}

struct SettingsSnapshot {
    existed: bool,
    bytes: Vec<u8>,
    object: Map<String, Value>,
}

pub(super) fn apply_settings_overlay(
    session_root: &Path,
    session_id: Uuid,
    settings_path: &Path,
    overlay: &Value,
) -> Result<(), String> {
    let (snapshot, overlay_bytes, original_settings) =
        prepare_settings_overlay(settings_path, overlay)?;
    let journal = build_journal(
        session_id,
        settings_path,
        &snapshot,
        &overlay_bytes,
        original_settings,
    );
    write_recovery_artifacts(session_root, &snapshot, &journal)?;
    if let Err(error) = write_bytes_atomic(settings_path, &overlay_bytes) {
        let cleanup_error = cleanup_recovery_artifacts(session_root).err();
        return Err(match cleanup_error {
            Some(cleanup) => format!("{error}; 清理恢复文件失败: {cleanup}"),
            None => error,
        });
    }
    Ok(())
}

fn prepare_settings_overlay(
    settings_path: &Path,
    overlay: &Value,
) -> Result<(SettingsSnapshot, Vec<u8>, BTreeMap<String, OriginalSetting>), String> {
    let snapshot = read_settings_snapshot(settings_path)?;
    let overlay_object = overlay
        .as_object()
        .ok_or_else(|| "KSK endpoint overlay 必须是 JSON 对象".to_string())?;
    validate_endpoint_keys(overlay_object.keys().map(String::as_str))?;
    let mut merged = snapshot.object.clone();
    let original_settings = capture_original_settings(&merged);
    merged.extend(overlay_object.clone());
    let overlay_bytes = serde_json::to_vec_pretty(&Value::Object(merged))
        .map_err(|error| format!("序列化 KSK endpoint overlay 失败: {error}"))?;
    Ok((snapshot, overlay_bytes, original_settings))
}

pub(super) fn restore_settings_overlay(
    session_root: &Path,
    expected_settings_path: &Path,
) -> Result<bool, String> {
    let journal_path = session_root.join(JOURNAL_FILE_NAME);
    if !journal_path.exists() {
        return Ok(false);
    }
    let journal = read_journal(&journal_path)?;
    validate_journal(&journal, session_root, expected_settings_path)?;
    restore_settings(&journal, session_root)?;
    cleanup_recovery_artifacts(session_root)?;
    Ok(true)
}

pub(crate) fn recover_stale_settings(
    isolation_root: &Path,
    expected_settings_path: &Path,
) -> Result<usize, String> {
    if !isolation_root.exists() {
        return Ok(0);
    }
    ensure_regular_directory(isolation_root, "隔离根目录")?;
    let mut recovered = 0;
    let mut errors = Vec::new();
    for entry in
        fs::read_dir(isolation_root).map_err(|error| format!("读取隔离根目录失败: {error}"))?
    {
        let entry = entry.map_err(|error| format!("读取隔离会话目录项失败: {error}"))?;
        if !is_recoverable_session(&entry)? {
            continue;
        }
        match restore_settings_overlay(&entry.path(), expected_settings_path) {
            Ok(true) => recovered += 1,
            Ok(false) => {}
            Err(error) => errors.push(format!("{}: {error}", entry.path().display())),
        }
    }
    if errors.is_empty() {
        Ok(recovered)
    } else {
        Err(format!("恢复 KSK settings 失败: {}", errors.join("; ")))
    }
}

fn build_journal(
    session_id: Uuid,
    settings_path: &Path,
    snapshot: &SettingsSnapshot,
    overlay_bytes: &[u8],
    original_settings: BTreeMap<String, OriginalSetting>,
) -> SettingsRecoveryJournal {
    SettingsRecoveryJournal {
        version: JOURNAL_VERSION,
        session_id: session_id.to_string(),
        settings_path: settings_path.to_path_buf(),
        settings_existed: snapshot.existed,
        original_sha256: snapshot.existed.then(|| sha256_hex(&snapshot.bytes)),
        overlay_sha256: sha256_hex(overlay_bytes),
        original_settings,
    }
}

fn capture_original_settings(settings: &Map<String, Value>) -> BTreeMap<String, OriginalSetting> {
    ENDPOINT_KEYS
        .into_iter()
        .map(|key| {
            let value = settings.get(key).cloned();
            (
                key.to_string(),
                OriginalSetting {
                    present: value.is_some(),
                    value,
                },
            )
        })
        .collect()
}

fn write_recovery_artifacts(
    session_root: &Path,
    snapshot: &SettingsSnapshot,
    journal: &SettingsRecoveryJournal,
) -> Result<(), String> {
    if snapshot.existed {
        write_new_private_file(&session_root.join(BACKUP_FILE_NAME), &snapshot.bytes)?;
    }
    let journal_bytes = serde_json::to_vec_pretty(journal)
        .map_err(|error| format!("序列化 settings 恢复 journal 失败: {error}"))?;
    if let Err(error) =
        write_new_private_file(&session_root.join(JOURNAL_FILE_NAME), &journal_bytes)
    {
        let _ = cleanup_recovery_artifacts(session_root);
        return Err(error);
    }
    Ok(())
}

fn read_settings_snapshot(path: &Path) -> Result<SettingsSnapshot, String> {
    if !path.exists() {
        return Ok(SettingsSnapshot {
            existed: false,
            bytes: Vec::new(),
            object: Map::new(),
        });
    }
    ensure_regular_file(path, "Kiro settings")?;
    let bytes = fs::read(path).map_err(|error| format!("读取 Kiro settings 失败: {error}"))?;
    let object = parse_settings_object(&bytes)?;
    Ok(SettingsSnapshot {
        existed: true,
        bytes,
        object,
    })
}

fn parse_settings_object(bytes: &[u8]) -> Result<Map<String, Value>, String> {
    if bytes.iter().all(u8::is_ascii_whitespace) {
        return Ok(Map::new());
    }
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|error| format!("Kiro settings 不是有效 JSON，拒绝覆盖: {error}"))?;
    value
        .as_object()
        .cloned()
        .ok_or_else(|| "Kiro settings 顶层必须是 JSON 对象".to_string())
}

fn restore_settings(journal: &SettingsRecoveryJournal, session_root: &Path) -> Result<(), String> {
    let current = read_settings_snapshot(&journal.settings_path)?;
    let current_hash = current.existed.then(|| sha256_hex(&current.bytes));
    if current_hash == journal.original_sha256 {
        return Ok(());
    }
    if current_hash.as_deref() == Some(journal.overlay_sha256.as_str()) {
        return restore_exact_original(journal, session_root);
    }
    restore_merged_settings(journal, current)
}

fn restore_exact_original(
    journal: &SettingsRecoveryJournal,
    session_root: &Path,
) -> Result<(), String> {
    if !journal.settings_existed {
        return remove_settings_if_present(&journal.settings_path);
    }
    let backup_path = session_root.join(BACKUP_FILE_NAME);
    ensure_regular_file(&backup_path, "settings 备份")?;
    let original =
        fs::read(&backup_path).map_err(|error| format!("读取 settings 备份失败: {error}"))?;
    if Some(sha256_hex(&original)) != journal.original_sha256 {
        return Err("settings 备份完整性校验失败".to_string());
    }
    write_bytes_atomic(&journal.settings_path, &original)
}

fn restore_merged_settings(
    journal: &SettingsRecoveryJournal,
    current: SettingsSnapshot,
) -> Result<(), String> {
    let mut merged = current.object;
    for key in ENDPOINT_KEYS {
        let original = journal
            .original_settings
            .get(key)
            .ok_or_else(|| format!("settings journal 缺少 {key}"))?;
        if original.present {
            let value = original
                .value
                .clone()
                .ok_or_else(|| format!("settings journal 的 {key} 缺少原值"))?;
            merged.insert(key.to_string(), value);
        } else {
            merged.remove(key);
        }
    }
    if !journal.settings_existed && merged.is_empty() {
        return remove_settings_if_present(&journal.settings_path);
    }
    let bytes = serde_json::to_vec_pretty(&Value::Object(merged))
        .map_err(|error| format!("序列化恢复后的 Kiro settings 失败: {error}"))?;
    write_bytes_atomic(&journal.settings_path, &bytes)
}

fn read_journal(path: &Path) -> Result<SettingsRecoveryJournal, String> {
    ensure_regular_file(path, "settings 恢复 journal")?;
    let bytes =
        fs::read(path).map_err(|error| format!("读取 settings 恢复 journal 失败: {error}"))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("解析 settings 恢复 journal 失败: {error}"))
}

fn validate_journal(
    journal: &SettingsRecoveryJournal,
    session_root: &Path,
    expected_settings_path: &Path,
) -> Result<(), String> {
    if journal.version != JOURNAL_VERSION {
        return Err(format!(
            "不支持的 settings journal 版本: {}",
            journal.version
        ));
    }
    let directory_id = session_root
        .file_name()
        .and_then(|value| value.to_str())
        .and_then(|value| Uuid::parse_str(value).ok());
    let journal_id = Uuid::parse_str(&journal.session_id).ok();
    if directory_id.is_none() || directory_id != journal_id {
        return Err("settings journal 会话标识校验失败".to_string());
    }
    if journal.settings_path != expected_settings_path {
        return Err("settings journal 指向了非预期 Kiro 配置路径".to_string());
    }
    validate_endpoint_keys(journal.original_settings.keys().map(String::as_str))
}

fn validate_endpoint_keys<'a>(keys: impl Iterator<Item = &'a str>) -> Result<(), String> {
    let mut keys = keys.collect::<Vec<_>>();
    keys.sort_unstable();
    let mut expected = ENDPOINT_KEYS.to_vec();
    expected.sort_unstable();
    if keys == expected {
        Ok(())
    } else {
        Err("settings overlay 只能修改三个已验证的 endpoint 键".to_string())
    }
}

fn is_recoverable_session(entry: &fs::DirEntry) -> Result<bool, String> {
    let file_type = entry
        .file_type()
        .map_err(|error| format!("读取隔离会话类型失败: {error}"))?;
    if file_type.is_symlink() || !file_type.is_dir() {
        return Ok(false);
    }
    let is_uuid = entry
        .file_name()
        .to_str()
        .and_then(|value| Uuid::parse_str(value).ok())
        .is_some();
    Ok(is_uuid && entry.path().join(JOURNAL_FILE_NAME).is_file())
}

fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Kiro settings 缺少父目录".to_string())?;
    ensure_regular_directory(parent, "Kiro settings 父目录")?;
    if path.exists() {
        ensure_regular_file(path, "Kiro settings")?;
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Kiro settings 文件名无效".to_string())?;
    let temp_path = parent.join(format!(".{file_name}.kam-{}.tmp", Uuid::new_v4()));
    write_new_private_file(&temp_path, bytes)?;
    if let Err(error) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("原子替换 Kiro settings 失败: {error}"));
    }
    Ok(())
}

fn write_new_private_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    configure_private_file_mode(&mut options);
    let mut file = options
        .open(path)
        .map_err(|error| format!("创建恢复文件 {} 失败: {error}", path.display()))?;
    file.write_all(bytes)
        .map_err(|error| format!("写入恢复文件 {} 失败: {error}", path.display()))?;
    file.sync_all()
        .map_err(|error| format!("同步恢复文件 {} 失败: {error}", path.display()))
}

fn cleanup_recovery_artifacts(session_root: &Path) -> Result<(), String> {
    let mut errors = Vec::new();
    for path in [
        session_root.join(JOURNAL_FILE_NAME),
        session_root.join(BACKUP_FILE_NAME),
    ] {
        if path.exists() {
            if let Err(error) = ensure_regular_file(&path, "恢复文件")
                .and_then(|()| fs::remove_file(&path).map_err(|error| error.to_string()))
            {
                errors.push(format!("清理 {} 失败: {error}", path.display()));
            }
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn remove_settings_if_present(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    ensure_regular_file(path, "Kiro settings")?;
    fs::remove_file(path).map_err(|error| format!("移除临时 Kiro settings 失败: {error}"))
}

fn ensure_regular_directory(path: &Path, label: &str) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("读取{label}元数据失败: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!("{label}必须是普通目录"));
    }
    Ok(())
}

fn ensure_regular_file(path: &Path, label: &str) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("读取{label}元数据失败: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!("{label}必须是普通文件"));
    }
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

#[cfg(unix)]
fn configure_private_file_mode(options: &mut OpenOptions) {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
}

#[cfg(not(unix))]
fn configure_private_file_mode(_options: &mut OpenOptions) {}
