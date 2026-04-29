// Token 限制功能测试
// 这个测试文件验证网关的 Token 估算和 Payload 裁剪功能

use serde_json::json;

#[derive(Debug, Clone, Copy)]
enum TokenizerType {
    Claude,
    OpenAI,
    Llama,
    Generic,
}

impl TokenizerType {
    fn from_model_id(model_id: &str) -> Self {
        let model_lower = model_id.to_lowercase();

        if model_lower.contains("claude") {
            TokenizerType::Claude
        } else if model_lower.contains("gpt") || model_lower.contains("o1") || model_lower.contains("o3") {
            TokenizerType::OpenAI
        } else if model_lower.contains("llama") {
            TokenizerType::Llama
        } else {
            TokenizerType::Generic
        }
    }
}

fn estimate_text_tokens(text: &str, tokenizer_type: TokenizerType) -> usize {
    if text.is_empty() {
        return 0;
    }

    match tokenizer_type {
        TokenizerType::Claude => {
            (text.len() + 3) / 4
        }
        TokenizerType::OpenAI => {
            estimate_generic_tokens(text)
        }
        TokenizerType::Llama => {
            ((text.len() as f64 / 3.5).ceil() as usize).max(1)
        }
        TokenizerType::Generic => {
            estimate_generic_tokens(text)
        }
    }
}

fn estimate_generic_tokens(text: &str) -> usize {
    let base_tokens = (text.len() + 3) / 4;
    let lines = text.lines().count();
    let newline_tokens = (lines + 1) / 2;
    let code_blocks = text.matches("```").count();
    let code_block_tokens = code_blocks * 2;

    base_tokens + newline_tokens + code_block_tokens
}

fn check_payload_size(payload: &serde_json::Value) -> usize {
    serde_json::to_string(payload)
        .map(|s| s.len())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenizer_type_from_model_id() {
        assert!(matches!(
            TokenizerType::from_model_id("claude-3-7-sonnet-20250219"),
            TokenizerType::Claude
        ));
        assert!(matches!(
            TokenizerType::from_model_id("gpt-4"),
            TokenizerType::OpenAI
        ));
        assert!(matches!(
            TokenizerType::from_model_id("o1-preview"),
            TokenizerType::OpenAI
        ));
        assert!(matches!(
            TokenizerType::from_model_id("llama-3-70b"),
            TokenizerType::Llama
        ));
        assert!(matches!(
            TokenizerType::from_model_id("unknown-model"),
            TokenizerType::Generic
        ));
    }

    #[test]
    fn test_estimate_text_tokens_claude() {
        let text = "Hello, world!";
        let tokens = estimate_text_tokens(text, TokenizerType::Claude);
        assert_eq!(tokens, (text.len() + 3) / 4);
        println!("Claude tokens for '{}': {}", text, tokens);
    }

    #[test]
    fn test_estimate_text_tokens_llama() {
        let text = "Hello, world!";
        let tokens = estimate_text_tokens(text, TokenizerType::Llama);
        assert_eq!(tokens, ((text.len() as f64 / 3.5).ceil() as usize).max(1));
        println!("Llama tokens for '{}': {}", text, tokens);
    }

    #[test]
    fn test_estimate_text_tokens_generic() {
        let text = "Hello\nWorld\n```rust\nfn main() {}\n```";
        let tokens = estimate_text_tokens(text, TokenizerType::Generic);

        let base_tokens = (text.len() + 3) / 4;
        let lines = text.lines().count();
        let newline_tokens = (lines + 1) / 2;
        let code_blocks = text.matches("```").count();
        let code_block_tokens = code_blocks * 2;
        let expected = base_tokens + newline_tokens + code_block_tokens;

        assert_eq!(tokens, expected);
        println!("Generic tokens for code block: {}", tokens);
    }

    #[test]
    fn test_large_text_estimation() {
        // 模拟一个大约 160k tokens 的文本（640k 字符）
        let large_text = "a".repeat(640_000);
        let tokens = estimate_text_tokens(&large_text, TokenizerType::Claude);

        println!("Large text ({} chars) estimated tokens: {}", large_text.len(), tokens);
        assert!(tokens > 150_000);
        assert!(tokens < 170_000);
    }

    #[test]
    fn test_check_payload_size() {
        let payload = json!({
            "model": "claude-3-7-sonnet-20250219",
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        });

        let size = check_payload_size(&payload);
        assert!(size > 0);
        println!("Payload size: {} bytes", size);
    }

    #[test]
    fn test_large_payload_size() {
        // 创建一个接近 615KB 的 payload
        let large_content = "x".repeat(600_000);
        let payload = json!({
            "model": "claude-3-7-sonnet-20250219",
            "conversationState": {
                "history": [
                    {
                        "user_input_message": {
                            "user_input_message_context": {
                                "text": large_content
                            }
                        }
                    }
                ]
            }
        });

        let size = check_payload_size(&payload);
        println!("Large payload size: {} bytes ({} KB)", size, size / 1024);
        assert!(size > 600_000);
    }

    #[test]
    fn test_empty_text() {
        let tokens = estimate_text_tokens("", TokenizerType::Claude);
        assert_eq!(tokens, 0);
    }

    #[test]
    fn test_multiline_text() {
        let text = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
        let tokens = estimate_text_tokens(text, TokenizerType::Generic);

        println!("Multiline text tokens: {}", tokens);
        assert!(tokens > 0);
    }

    #[test]
    fn test_code_with_backticks() {
        let text = "Here is some code:\n```rust\nfn main() {\n    println!(\"Hello\");\n}\n```\nAnd more text.";
        let tokens = estimate_text_tokens(text, TokenizerType::Generic);

        println!("Code with backticks tokens: {}", tokens);

        // 验证代码块增加了额外的 tokens
        let text_without_backticks = text.replace("```", "");
        let tokens_without_backticks = estimate_text_tokens(&text_without_backticks, TokenizerType::Generic);

        assert!(tokens > tokens_without_backticks);
    }
}
