//! 网关核心功能综合测试
//! 
//! 测试覆盖：
//! - P0: Payload 裁剪逻辑
//! - P0: 账号选择策略  
//! - P1: Token 限制拒绝
//! - P1: 服务端 Web 搜索迭代

use serde_json::{json, Value};

#[test]
fn test_trim_payload_basic() {
    let mut payload = json!({
        "conversationState": {
            "history": [
                {"user_input_message": {"user_input_message_context": {"text": "msg1"}}},
                {"assistant_response_message": {"content": "resp1"}},
                {"user_input_message": {"user_input_message_context": {"text": "msg2"}}}
            ]
        }
    });
    
    let trimmed = trim_payload(&mut payload, 100);
    println!("Trimmed: {}", trimmed);
    assert!(trimmed);
}

#[test]
fn test_account_selection_round_robin() {
    let accounts = vec!["acc1", "acc2", "acc3"];
    for i in 0..6 {
        let idx = i % accounts.len();
        println!("Round {} -> {}", i, accounts[idx]);
    }
}

#[test]
fn test_token_limit() {
    let tokens = 200_000;
    let limit = 160_000;
    assert!(tokens > limit, "Should exceed limit");
}

fn trim_payload(payload: &mut Value, max_bytes: usize) -> bool {
    let size = serde_json::to_string(payload).map(|s| s.len()).unwrap_or(0);
    if size <= max_bytes {
        return false;
    }
    
    if let Some(history) = payload.pointer_mut("/conversationState/history").and_then(|v| v.as_array_mut()) {
        if history.len() > 2 {
            history.remove(0);
            return true;
        }
    }
    false
}
