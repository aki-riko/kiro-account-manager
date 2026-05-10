# API 格式规范参考

> 本文档整理了从官方文档查询到的三种 API 的正确格式规范
>
> **数据来源**：官方文档（2026-05-11 查询）

---

## 1. Anthropic Messages API - Content 格式

### 官方文档

- **文档地址**：https://docs.anthropic.com/en/api/messages-examples
- **API 版本**：Messages API

### Content 数组格式

Anthropic Messages API 的 `content` 字段应该是**数组格式**，支持多种类型的 content block：

```json
{
    "role": "user",
    "content": [
        {
            "type": "text",
            "text": "What is in the above image?"
        },
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": "base64_encoded_image_data"
            }
        }
    ]
}
```

### 支持的 Content Block 类型

#### 1. Text Block
```json
{
    "type": "text",
    "text": "Hello, Claude"
}
```

#### 2. Image Block (Base64)
```json
{
    "type": "image",
    "source": {
        "type": "base64",
        "media_type": "image/jpeg",  // 或 image/png, image/gif, image/webp
        "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."
    }
}
```

#### 3. Image Block (URL)
```json
{
    "type": "image",
    "source": {
        "type": "url",
        "url": "https://example.com/image.jpg"
    }
}
```

#### 4. Document Block
```json
{
    "type": "document",
    "source": {
        "type": "base64",
        "media_type": "application/pdf",
        "data": "base64_encoded_pdf_data"
    },
    "title": "Document Title"
}
```

### 完整请求示例

```python
import anthropic
import base64
import httpx

# Base64 编码的图片
image_url = "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg"
image_media_type = "image/jpeg"
image_data = base64.standard_b64encode(httpx.get(image_url).content).decode("utf-8")

message = anthropic.Anthropic().messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image_media_type,
                        "data": image_data,
                    },
                },
                {"type": "text", "text": "What is in the above image?"},
            ],
        }
    ],
)
```

### 响应格式

```json
{
    "id": "msg_01EcyWo6m4hyW8KHs2y2pei5",
    "type": "message",
    "role": "assistant",
    "content": [
        {
            "type": "text",
            "text": "This image shows an ant..."
        }
    ],
    "model": "claude-opus-4-7",
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "usage": {
        "input_tokens": 1551,
        "output_tokens": 71
    }
}
```

### 关键要点

1. **Content 必须是数组**：即使只有一个文本，也应该用数组包裹
2. **支持混合类型**：可以在同一个 content 数组中混合文本、图片、文档
3. **图片支持两种来源**：base64 编码或 URL
4. **支持的图片格式**：JPEG、PNG、GIF、WebP
5. **文档支持**：PDF 等文档类型

---

## 2. OpenAI Responses API - Compaction 格式

### 官方文档

- **文档地址**：https://developers.openai.com/api/docs/guides/compaction
- **API 版本**：Responses API

### Compaction 概述

Compaction 用于在长对话中减少上下文大小，同时保留必要的状态信息。有两种方式：

1. **Server-side compaction**：自动压缩
2. **Standalone compact endpoint**：手动压缩

### 方式 1: Server-side Compaction

在 `responses.create` 请求中启用自动压缩：

```python
conversation = [
    {
        "type": "message",
        "role": "user",
        "content": "Let's begin a long coding task.",
    }
]

while keep_going:
    response = client.responses.create(
        model="gpt-5.3-codex",
        input=conversation,
        store=False,
        context_management=[{
            "type": "compaction",
            "compact_threshold": 200000  # Token 阈值
        }],
    )

    # 将输出（包括 compaction item）追加到对话
    conversation.extend(response.output)

    # 添加新的用户消息
    conversation.append({
        "type": "message",
        "role": "user",
        "content": get_next_user_input(),
    })
```

**工作原理**：
- 当 token 数超过 `compact_threshold` 时，服务器自动触发压缩
- 响应流中会包含一个 `compaction` 类型的 output item
- 将这个 item 追加到下一次请求的 input 中

### 方式 2: Standalone Compact Endpoint

手动调用 `/responses/compact` 端点：

```python
# 1. 当前对话窗口
long_input_items_array = [
    {"type": "message", "role": "user", "content": "..."},
    {"type": "message", "role": "assistant", "content": "..."},
    # ... 更多消息
]

# 2. 调用 compact 端点
compacted = client.responses.compact(
    model="gpt-5.5",
    input=long_input_items_array,
)

# 3. 使用压缩后的窗口
next_input = [
    *compacted.output,  # 原样使用压缩输出
    {
        "type": "message",
        "role": "user",
        "content": user_input_message(),
    },
]

# 4. 继续对话
next_response = client.responses.create(
    model="gpt-5.5",
    input=next_input,
    store=False,
)
```

### Compaction Item 格式

Compaction item 是**加密的、不透明的**数据结构：

```json
{
    "type": "compaction",
    "data": "encrypted_compaction_data_here"
}
```

**关键特性**：
- **加密内容**：data 字段包含加密的上下文信息
- **不可解析**：不应该尝试解析或修改内容
- **必须原样保留**：必须完整传递到下一次请求
- **携带状态**：包含了之前对话的关键信息和推理过程

### 完整示例

```json
{
    "model": "gpt-5",
    "input": [
        {
            "type": "message",
            "role": "user",
            "content": "Hello"
        },
        {
            "type": "message",
            "role": "assistant",
            "content": "Hi there!"
        },
        {
            "type": "compaction",
            "data": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        },
        {
            "type": "message",
            "role": "user",
            "content": "Continue our conversation"
        }
    ]
}
```

### 关键要点

1. **Compaction item 是不透明的**：不要尝试解析或修改
2. **必须原样传递**：完整保留 type 和 data 字段
3. **ZDR 友好**：设置 `store=False` 保持零数据保留
4. **减少延迟**：可以删除 compaction item 之前的消息（但保留 compaction item）
5. **Compact 输出包含多个 item**：不仅仅是 compaction item，还可能包含保留的消息

---

## 3. OpenAI Chat Completions API - 工具调用格式

### 官方文档

- **文档地址**：https://developers.openai.com/api/docs/guides/function-calling
- **API 版本**：Chat Completions API

### 工具调用流程

工具调用是一个多步骤的对话流程：

1. 发送带有 tools 定义的请求
2. 接收模型的 tool_call 响应
3. 执行工具并获取结果
4. 将结果发送回模型
5. 接收最终响应

### 1. 定义工具

```json
{
    "type": "function",
    "name": "get_weather",
    "description": "Retrieves current weather for the given location.",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City and country e.g. Bogotá, Colombia"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Units the temperature will be returned in."
            }
        },
        "required": ["location", "units"],
        "additionalProperties": false
    },
    "strict": true
}
```

**关键字段**：
- `type`: 固定为 "function"
- `name`: 函数名称
- `description`: 何时以及如何使用该函数
- `parameters`: JSON Schema 定义的输入参数
- `strict`: 是否启用严格模式（推荐 true）

### 2. 发送请求

```python
response = client.responses.create(
    model="gpt-5",
    tools=[
        {
            "type": "function",
            "name": "get_horoscope",
            "description": "Get today's horoscope for an astrological sign.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sign": {
                        "type": "string",
                        "description": "An astrological sign like Taurus or Aquarius",
                    },
                },
                "required": ["sign"],
            },
        }
    ],
    input=[
        {"role": "user", "content": "What is my horoscope? I am an Aquarius."}
    ],
)
```

### 3. 接收工具调用

响应中的 `output` 数组包含 `function_call` 类型的 item：

```json
[
    {
        "id": "fc_12345xyz",
        "call_id": "call_12345xyz",
        "type": "function_call",
        "name": "get_weather",
        "arguments": "{\"location\":\"Paris, France\"}"
    },
    {
        "id": "fc_67890abc",
        "call_id": "call_67890abc",
        "type": "function_call",
        "name": "get_weather",
        "arguments": "{\"location\":\"Bogotá, Colombia\"}"
    }
]
```

**关键字段**：
- `id`: 函数调用的唯一标识
- `call_id`: 用于关联工具结果的 ID
- `type`: 固定为 "function_call"
- `name`: 被调用的函数名
- `arguments`: JSON 编码的参数字符串

### 4. 执行工具并返回结果

```python
for tool_call in response.output:
    if tool_call.type != "function_call":
        continue

    name = tool_call.name
    args = json.loads(tool_call.arguments)

    # 执行函数
    result = call_function(name, args)
    
    # 添加结果到输入
    input_messages.append({
        "type": "function_call_output",
        "call_id": tool_call.call_id,
        "output": str(result)
    })
```

**工具结果格式**：
```json
{
    "type": "function_call_output",
    "call_id": "call_12345xyz",
    "output": "The temperature in Paris is 15°C"
}
```

### 5. 获取最终响应

```python
response = client.responses.create(
    model="gpt-4.1",
    input=input_messages,  # 包含工具结果
    tools=tools,
)

# 最终响应
print(response.output_text)
# "It's about 15°C in Paris, 18°C in Bogotá, and I've sent that email to Bob."
```

### Chat Completions API 格式（传统）

对于传统的 Chat Completions API：

#### 工具调用响应
```json
{
    "role": "assistant",
    "content": null,
    "tool_calls": [
        {
            "id": "call_abc123",
            "type": "function",
            "function": {
                "name": "get_weather",
                "arguments": "{\"location\":\"Paris\"}"
            }
        }
    ]
}
```

#### 工具结果消息
```json
{
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": "The temperature in Paris is 15°C"
}
```

### 工具选择（Tool Choice）

控制模型如何使用工具：

```python
# 1. Auto（默认）：模型自动决定
tool_choice = "auto"

# 2. Required：必须调用至少一个工具
tool_choice = "required"

# 3. 强制调用特定工具
tool_choice = {
    "type": "function",
    "name": "get_weather"
}

# 4. 限制可用工具
tool_choice = {
    "type": "allowed_tools",
    "mode": "auto",
    "tools": [
        {"type": "function", "name": "get_weather"},
        {"type": "function", "name": "search_docs"}
    ]
}

# 5. None：不使用工具
tool_choice = "none"
```

### 并行工具调用

模型可以在一次响应中调用多个工具：

```json
[
    {
        "id": "fc_1",
        "call_id": "call_1",
        "type": "function_call",
        "name": "get_weather",
        "arguments": "{\"location\":\"Paris\"}"
    },
    {
        "id": "fc_2",
        "call_id": "call_2",
        "type": "function_call",
        "name": "get_weather",
        "arguments": "{\"location\":\"Tokyo\"}"
    },
    {
        "id": "fc_3",
        "call_id": "call_3",
        "type": "function_call",
        "name": "send_email",
        "arguments": "{\"to\":\"bob@email.com\",\"body\":\"Hi\"}"
    }
]
```

禁用并行调用：
```python
parallel_tool_calls = False
```

### 严格模式（Strict Mode）

启用严格模式确保工具调用严格遵循 schema：

```json
{
    "type": "function",
    "name": "get_weather",
    "strict": true,
    "parameters": {
        "type": "object",
        "properties": {
            "location": {"type": "string"},
            "units": {
                "type": ["string", "null"],  // 可选字段用 null
                "enum": ["celsius", "fahrenheit"]
            }
        },
        "required": ["location", "units"],
        "additionalProperties": false  // 必须设置
    }
}
```

**严格模式要求**：
1. `additionalProperties` 必须为 `false`
2. 所有字段必须在 `required` 中
3. 可选字段使用 `["type", "null"]`

### 流式工具调用

```python
stream = client.responses.create(
    model="gpt-4.1",
    input=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
    stream=True
)

for event in stream:
    if event.type == "response.output_item.added":
        # 新的工具调用开始
        print(f"Tool call: {event.item.name}")
    elif event.type == "response.function_call_arguments.delta":
        # 参数增量
        print(event.delta, end="")
    elif event.type == "response.function_call_arguments.done":
        # 参数完成
        print(f"\nFinal arguments: {event.arguments}")
```

### 关键要点

1. **工具定义使用 JSON Schema**：支持丰富的类型系统
2. **严格模式推荐启用**：确保参数格式正确
3. **支持并行调用**：一次可以调用多个工具
4. **工具结果必须关联 call_id**：确保结果对应正确的调用
5. **支持流式响应**：可以实时显示工具调用进度
6. **工具选择灵活**：可以强制、限制或禁用工具使用

---

## 对比总结

| 特性 | Anthropic Messages | OpenAI Responses | OpenAI Chat Completions |
|------|-------------------|------------------|------------------------|
| **Content 格式** | 数组（支持混合类型） | 数组或字符串 | 字符串或数组 |
| **图片支持** | ✅ Base64/URL | ✅ Base64/URL | ✅ Base64/URL |
| **文档支持** | ✅ PDF 等 | ✅ | ✅ |
| **工具调用** | tool_use block | function_call item | tool_calls 数组 |
| **工具结果** | tool_result block | function_call_output | role: "tool" |
| **Compaction** | ❌ | ✅ | ❌ |
| **流式支持** | ✅ | ✅ | ✅ |
| **严格模式** | ❌ | ✅ | ✅ |

---

## 参考链接

1. **Anthropic Messages API**
   - 官方文档：https://docs.anthropic.com/en/api/messages-examples
   - Vision 指南：https://platform.claude.com/docs/en/build-with-claude/vision
   - API 参考：https://platform.claude.com/docs/en/api/messages/create

2. **OpenAI Responses API**
   - Compaction 指南：https://developers.openai.com/api/docs/guides/compaction
   - Responses API 迁移：https://developers.openai.com/api/docs/guides/migrate-to-responses
   - 对话状态管理：https://developers.openai.com/api/docs/guides/conversation-state

3. **OpenAI Chat Completions API**
   - Function Calling 指南：https://developers.openai.com/api/docs/guides/function-calling
   - Structured Outputs：https://developers.openai.com/api/docs/guides/structured-outputs
   - API 参考：https://platform.openai.com/docs/api-reference/chat

---

**文档更新日期**：2026-05-11
