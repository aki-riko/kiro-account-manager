import { useApp } from '../../hooks/useApp'
import { useAppSettings } from '../../contexts/AppSettingsContext'

function UsageGuide() {
  const { colors } = useApp()
  const { settings } = useAppSettings()
  
  const port = settings?.kiroGatePort || 8000
  const serverUrl = `http://127.0.0.1:${port}`

  return (
    <div className="space-y-5">
      {/* 快速开始 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🚀</span>
          <h3 className={`font-semibold ${colors.text}`}>快速开始</h3>
        </div>
        <ol className={`text-sm space-y-2 ${colors.textMuted}`}>
          <li>1. 在「服务器」页配置 PROXY_API_KEY 并启动服务</li>
          <li>2. 在「Token 管理」页添加 Refresh Token</li>
          <li>3. 选择 Token 并生成 API Key</li>
          <li>4. 使用生成的 API Key 调用 API</li>
        </ol>
      </div>

      {/* OpenAI 格式 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded bg-green-500/20 text-green-400 flex items-center justify-center text-xs">🐍</span>
          <h3 className={`font-semibold ${colors.text}`}>OpenAI 格式</h3>
        </div>
        <pre className={`text-xs ${colors.text} bg-black/30 p-4 rounded-xl overflow-x-auto`}>
{`from openai import OpenAI

client = OpenAI(
    base_url="${serverUrl}/v1",
    api_key="<API Key>"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")`}
        </pre>
      </div>

      {/* Anthropic 格式 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">🤖</span>
          <h3 className={`font-semibold ${colors.text}`}>Anthropic 格式</h3>
        </div>
        <pre className={`text-xs ${colors.text} bg-black/30 p-4 rounded-xl overflow-x-auto`}>
{`from anthropic import Anthropic

client = Anthropic(
    base_url="${serverUrl}",
    api_key="<API Key>"
)

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(message.content[0].text)`}
        </pre>
      </div>

      {/* cURL 示例 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">$</span>
          <h3 className={`font-semibold ${colors.text}`}>cURL</h3>
        </div>
        <pre className={`text-xs ${colors.text} bg-black/30 p-4 rounded-xl overflow-x-auto`}>
{`curl ${serverUrl}/v1/chat/completions \\
  -H "Authorization: Bearer <API Key>" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "claude-sonnet-4-5", "messages": [{"role": "user", "content": "Hello!"}]}'`}
        </pre>
      </div>

      {/* 支持的模型 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📋</span>
          <h3 className={`font-semibold ${colors.text}`}>支持的模型</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {['claude-sonnet-4-5', 'claude-sonnet-4', 'claude-opus-4-5', 'claude-haiku-4-5'].map(m => (
            <span key={m} className={`px-3 py-1.5 rounded-lg text-sm ${colors.card} border ${colors.cardBorder}`}>{m}</span>
          ))}
        </div>
      </div>

      {/* API Key 格式说明 */}
      <div className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔑</span>
          <h3 className={`font-semibold ${colors.text}`}>API Key 格式</h3>
        </div>
        <p className={`text-sm ${colors.textMuted} mb-2`}>API Key = PROXY_API_KEY:REFRESH_TOKEN</p>
        <pre className={`text-xs ${colors.text} bg-black/30 p-3 rounded-xl overflow-x-auto`}>
{`my-proxy-key:aorAAAAAGnRJvMd...`}
        </pre>
        <p className={`text-xs ${colors.textMuted} mt-2`}>
          💡 在「Token 管理」页选择 Token 后点击「生成 API Key」自动生成
        </p>
      </div>
    </div>
  )
}

export default UsageGuide
