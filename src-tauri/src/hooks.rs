// Hooks 管理（与 Kiro IDE 0.10.32 对齐：仅支持 <project>/.kiro/hooks/）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookFile {
    pub file_name: String,
    pub content: String,
    pub size: u64,
    pub modified_at: Option<String>,
    /// 当前固定为 "project"
    pub scope: String,
}

pub struct HooksManager;

impl HooksManager {
    pub fn project_dir(project_dir: &str) -> PathBuf {
        PathBuf::from(project_dir).join(".kiro").join("hooks")
    }

    fn require_project_dir(project_dir: Option<&str>) -> Result<PathBuf, String> {
        let pd = project_dir.ok_or("Hooks 仅支持项目级，请先选择项目目录")?;
        Ok(Self::project_dir(pd))
    }

    fn load_from_dir(dir: &PathBuf) -> Result<Vec<HookFile>, String> {
        if !dir.exists() {
            return Ok(vec![]);
        }

        let mut files = vec![];
        for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败: {e}"))? {
            let entry = entry.map_err(|e| format!("读取条目失败: {e}"))?;
            let path = entry.path();

            if !path.is_file() {
                continue;
            }

            let file_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if !file_name.ends_with(".kiro.hook") {
                continue;
            }

            let metadata = fs::metadata(&path).ok();
            let size = metadata.as_ref().map_or(0, std::fs::Metadata::len);
            let modified_at = metadata
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Local> = t.into();
                    datetime.format("%Y/%m/%d %H:%M:%S").to_string()
                });

            let content = fs::read_to_string(&path).unwrap_or_default();
            files.push(HookFile {
                file_name,
                content,
                size,
                modified_at,
                scope: "project".to_string(),
            });
        }

        files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
        Ok(files)
    }

    fn validate_file_name(file_name: &str) -> Result<(), String> {
        if file_name.is_empty() {
            return Err("文件名不能为空".to_string());
        }
        if file_name.contains('/') || file_name.contains('\\') {
            return Err("文件名不能包含路径分隔符".to_string());
        }
        if file_name.contains("..") {
            return Err("文件名不能包含 ..".to_string());
        }

        let path = Path::new(file_name);
        for comp in path.components() {
            if !matches!(comp, Component::Normal(_)) {
                return Err("文件名非法".to_string());
            }
        }
        Ok(())
    }

    fn safe_hook_path(base_dir: &Path, file_name: &str) -> Result<PathBuf, String> {
        Self::validate_file_name(file_name)?;
        let candidate = base_dir.join(file_name);
        if !candidate.starts_with(base_dir) {
            return Err("非法路径".to_string());
        }
        Ok(candidate)
    }

    pub fn load_all(project_dir: Option<&str>) -> Result<Vec<HookFile>, String> {
        let dir = Self::require_project_dir(project_dir)?;
        Self::load_from_dir(&dir)
    }

    pub fn load(file_name: &str, project_dir: Option<&str>) -> Result<HookFile, String> {
        let dir = Self::require_project_dir(project_dir)?;
        let path = Self::safe_hook_path(&dir, file_name)?;
        if !path.exists() {
            return Err(format!("Hook 文件不存在: {file_name}"));
        }

        let content = fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {e}"))?;
        let metadata = fs::metadata(&path).ok();
        let size = metadata.as_ref().map_or(0, std::fs::Metadata::len);
        let modified_at = metadata
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y/%m/%d %H:%M:%S").to_string()
            });

        Ok(HookFile {
            file_name: file_name.to_string(),
            content,
            size,
            modified_at,
            scope: "project".to_string(),
        })
    }

    pub fn save(file_name: &str, content: &str, project_dir: Option<&str>) -> Result<(), String> {
        let dir = Self::require_project_dir(project_dir)?;
        fs::create_dir_all(&dir).ok();
        let path = Self::safe_hook_path(&dir, file_name)?;
        fs::write(&path, content).map_err(|e| format!("写入失败: {e}"))
    }

    pub fn delete(file_name: &str, project_dir: Option<&str>) -> Result<(), String> {
        let dir = Self::require_project_dir(project_dir)?;
        let path = Self::safe_hook_path(&dir, file_name)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("删除失败: {e}"))?;
        }
        Ok(())
    }

    pub fn create(file_name: &str, content: &str, project_dir: Option<&str>) -> Result<HookFile, String> {
        let dir = Self::require_project_dir(project_dir)?;
        fs::create_dir_all(&dir).ok();
        let path = Self::safe_hook_path(&dir, file_name)?;
        if path.exists() {
            return Err(format!("文件已存在: {file_name}"));
        }
        fs::write(&path, content).map_err(|e| format!("写入失败: {e}"))?;
        Self::load(file_name, project_dir)
    }
}
