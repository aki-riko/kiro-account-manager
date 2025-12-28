// 自动换号策略模块
#![allow(dead_code)]

use crate::account::Account;
use rand::seq::SliceRandom;

/// 换号策略枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SwitchStrategy {
    /// 轮询：按顺序依次选择账号
    #[default]
    RoundRobin,
    /// 最多配额：选择剩余配额最多的账号
    MostQuota,
    /// 随机：随机选择一个可用账号
    Random,
}

impl SwitchStrategy {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "most_quota" => Self::MostQuota,
            "random" => Self::Random,
            _ => Self::RoundRobin,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RoundRobin => "round_robin",
            Self::MostQuota => "most_quota",
            Self::Random => "random",
        }
    }
}

/// 自动换号选择器
pub struct AccountSwitcher {
    strategy: SwitchStrategy,
    round_robin_index: usize,
    threshold: i32,
    group_id: Option<String>,
}

impl AccountSwitcher {
    pub fn new(strategy: SwitchStrategy, threshold: i32, group_id: Option<String>) -> Self {
        Self {
            strategy,
            round_robin_index: 0,
            threshold: threshold.clamp(0, 100),
            group_id,
        }
    }

    pub fn from_settings(
        strategy_str: Option<&str>,
        threshold: Option<i32>,
        group_id: Option<String>,
    ) -> Self {
        Self::new(
            strategy_str.map(SwitchStrategy::from_str).unwrap_or_default(),
            threshold.unwrap_or(90),
            group_id,
        )
    }

    /// 检查账号是否需要切换
    pub fn should_switch(&self, account: &Account) -> bool {
        if account.status == "已封禁" || account.status == "已过期" {
            return true;
        }

        if let Some(ref breakdown) = account.usage_breakdown {
            let total = breakdown.total_limit();
            let used = breakdown.total_current();
            if total > 0 {
                let usage_percent = (used as f32 / total as f32) * 100.0;
                return usage_percent >= self.threshold as f32;
            }
        }

        false
    }

    /// 选择下一个可用账号
    pub fn select_next<'a>(&mut self, accounts: &'a [Account], current_id: &str) -> Option<&'a Account> {
        let available: Vec<&Account> = accounts.iter()
            .filter(|a| {
                if a.id == current_id { return false; }
                if !a.is_available() { return false; }
                if let Some(ref gid) = self.group_id {
                    if a.group_id.as_ref() != Some(gid) { return false; }
                }
                true
            })
            .collect();

        if available.is_empty() { return None; }

        match self.strategy {
            SwitchStrategy::RoundRobin => {
                self.round_robin_index = (self.round_robin_index + 1) % available.len();
                Some(available[self.round_robin_index])
            }
            SwitchStrategy::MostQuota => {
                available.iter()
                    .max_by_key(|a| a.remaining_quota().unwrap_or(0))
                    .copied()
            }
            SwitchStrategy::Random => {
                let mut rng = rand::thread_rng();
                available.choose(&mut rng).copied()
            }
        }
    }
}

/// 换号结果
#[derive(Debug, Clone)]
pub struct SwitchResult {
    pub success: bool,
    pub new_account_id: Option<String>,
    pub new_account_email: Option<String>,
    pub message: String,
}

impl SwitchResult {
    pub fn success(account: &Account) -> Self {
        Self {
            success: true,
            new_account_id: Some(account.id.clone()),
            new_account_email: Some(account.email.clone()),
            message: format!("已切换到账号: {}", account.email),
        }
    }

    pub fn no_available() -> Self {
        Self {
            success: false,
            new_account_id: None,
            new_account_email: None,
            message: "没有可用的账号可切换".to_string(),
        }
    }

    pub fn not_needed() -> Self {
        Self {
            success: false,
            new_account_id: None,
            new_account_email: None,
            message: "当前账号配额充足，无需切换".to_string(),
        }
    }
}
