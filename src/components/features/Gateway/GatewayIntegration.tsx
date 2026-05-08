import { Check, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { invoke } from '@tauri-apps/api/core'
import { GatewayCodeCard, GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'

interface GatewayIntegrationProps {
  colors: any;
  integrationGuidance: any[];
  integrationSummary: any;
  effectiveConnectHost: string;
  clientSamples: any;
  copyText: (text: string, msg: string) => Promise<void>;
  copySuccess: string;
  effectiveConfig: any;
  status: any;
}

function GatewayIntegration({
  colors,
  integrationGuidance,
  integrationSummary,
  effectiveConnectHost,
  clientSamples,
  copyText,
  copySuccess,
  effectiveConfig,
  status}: GatewayIntegrationProps) {
  
  // 构建完整的 baseUrl
  const port = (status?.running ? status?.port : null) || effectiveConfig?.port || status?.port || 8765
  const needsBrackets = effectiveConnectHost.includes(':') && !effectiveConnectHost.startsWith('[')
  const normalizedHost = needsBrackets ? `[${effectiveConnectHost}]` : effectiveConnectHost
  const fullBaseUrl = `http://${normalizedHost}:${port}`
  return (
    <div className="grid grid-cols-1 gap-4">
      <GatewaySurfaceCard colors={colors}>
        <div className="flex flex-col gap-3">
          <GatewaySectionHeader
            colors={colors}
            title="接入指南"
            badge={<Badge variant="secondary" className="">客户端接入</Badge>}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {integrationGuidance.map((item) => (
              <GatewayStatCard
                key={item.label}
                colors={colors}
                label={item.label}
                value={item.value}
                detail={item.detail}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GatewayStatCard
              colors={colors}
              label="接入地址"
              value={integrationSummary.endpointLabel}
              detail={`客户端应连接 ${effectiveConnectHost}`}
            />
            <GatewayStatCard colors={colors} label="认证头" value={integrationSummary.authLabel} />
          </div>

          <GatewaySubCard>
            <div className="flex flex-col gap-3">
              <GatewaySectionHeader
                colors={colors}
                title="兼容能力矩阵"
                badge={<Badge variant="secondary" className="">Protocol Surface</Badge>}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <GatewayStatCard colors={colors} label="Anthropic" value="Messages / 流式事件" detail="支持 Claude 兼容接入、消息级流式返回、账号路由与本地鉴权。" />
                <GatewayStatCard colors={colors} label="OpenAI" value="Chat Completions / Responses" detail="支持 /v1/chat/completions（传统 OpenAI 格式）、/v1/responses、function call、流式 delta、done 与 completed 事件，并透传 tool_choice。" />
                <GatewayStatCard colors={colors} label="反代边界" value="本地入口 + 上游凭证托管" detail="客户端只接触本地反代客户端 Key（命中任意已配置 Key 即可）；Kiro access token 与区域信息由反代自动管理。" />
                <GatewayStatCard colors={colors} label="排障支持" value="日志 / 错误 / 请求元数据" detail="默认记录端点、状态码、耗时、模型、Region、上游来源等元数据；如旧日志里仍有 body，这里也会兼容展示。" />
              </div>
            </div>
          </GatewaySubCard>

          <GatewayCodeCard
            title="Claude / Anthropic"
            code={clientSamples.anthropic.env}
            actions={(
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyText(clientSamples.anthropic.env, 'Claude / Anthropic 配置已复制')}
                className="gap-1"
              >
                <Copy size={14} />
                复制 Claude / Anthropic 配置
              </Button>
            )}
          />

          <GatewayCodeCard
            title="OpenAI Responses 兼容"
            code={clientSamples.openai.env}
            actions={(
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(clientSamples.openai.env, 'OpenAI 兼容配置已复制')}
                  className="gap-1"
                >
                  <Copy size={14} />
                  复制 OpenAI 兼容配置
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(clientSamples.openai.curl, '兼容 Responses curl 已复制')}
                  className="gap-1"
                >
                  <Copy size={14} />
                  复制兼容 Responses curl
                </Button>
                {copySuccess ? (
                  <Badge variant="default" className="gap-1">
                    <Check size={12} />
                    {copySuccess}
                  </Badge>
                ) : null}
              </>
            )}
          >
            <p className={`text-xs mt-2 text-muted-foreground`}>
              OpenAI 兼容客户端支持 <code className="bg-muted px-1 py-0.5 rounded text-xs">/v1/responses</code>（Kiro 扩展格式）和 <code className="bg-muted px-1 py-0.5 rounded text-xs">/v1/chat/completions</code>（传统 OpenAI 格式），示例 model 可替换为任意反代支持的模型。
            </p>
            <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono mt-2">
              <code>{clientSamples.openai.curl}</code>
            </pre>
          </GatewayCodeCard>

          <GatewayCodeCard
            title="OpenAI Chat Completions"
            code={clientSamples.openaiChat.env}
            actions={(
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(clientSamples.openaiChat.env, 'Chat Completions 配置已复制')}
                  className="gap-1"
                >
                  <Copy size={14} />
                  复制 Chat Completions 配置
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(clientSamples.openaiChat.curl, 'Chat Completions curl 已复制')}
                  className="gap-1"
                >
                  <Copy size={14} />
                  复制 Chat Completions curl
                </Button>
                {copySuccess ? (
                  <Badge variant="default" className="gap-1">
                    <Check size={12} />
                    {copySuccess}
                  </Badge>
                ) : null}
              </>
            )}
          >
            <p className={`text-xs mt-2 text-muted-foreground`}>
              传统 OpenAI Chat Completions 格式，兼容标准 OpenAI 客户端库（如 openai-python、openai-node）。
            </p>
            <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono mt-2">
              <code>{clientSamples.openaiChat.curl}</code>
            </pre>
          </GatewayCodeCard>

          <GatewayCodeCard
            title="Claude Code CLI"
            code={clientSamples.claudeCode.config}
            actions={(
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(clientSamples.claudeCode.config, 'Claude Code 配置已复制')}
                  className="gap-1"
                >
                  <Copy size={14} />
                  复制配置
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await invoke('write_claude_code_config', {
                        baseUrl: fullBaseUrl,
                        apiKey: clientSamples.claudeCode.apiKey
                      })
                      await copyText(result as string, '配置成功')
                    } catch (e) {
                      await copyText(String(e), '配置失败')
                    }
                  }}
                  className="gap-1"
                >
                  直接配置
                </Button>
              </>
            )}
          >
            <p className={`text-xs mt-2 text-muted-foreground`}>
              Claude Code CLI 工具，点击"直接配置"自动写入 <code className="bg-muted px-1 py-0.5 rounded text-xs">~/.claude/settings.json</code>
            </p>
          </GatewayCodeCard>

          <GatewayCodeCard
            title="Codex CLI"
            code={clientSamples.codex.config}
            actions={(
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyText(clientSamples.codex.config, 'Codex CLI 配置已复制')}
                  className="gap-1"
                >
                  <Copy size={14} />
                  复制配置
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await invoke('write_codex_cli_config', {
                        baseUrl: fullBaseUrl,
                        apiKey: clientSamples.codex.apiKey,
                        model: 'claude-sonnet-4-5-20250929'
                      })
                      await copyText(result as string, '配置成功')
                    } catch (e) {
                      await copyText(String(e), '配置失败')
                    }
                  }}
                  className="gap-1"
                >
                  直接配置
                </Button>
              </>
            )}
          >
            <p className={`text-xs mt-2 text-muted-foreground`}>
              OpenAI 官方 CLI 工具，点击"直接配置"自动写入 <code className="bg-muted px-1 py-0.5 rounded text-xs">~/.codex/config.toml</code> 和 <code className="bg-muted px-1 py-0.5 rounded text-xs">~/.codex/auth.json</code>
            </p>
          </GatewayCodeCard>

          <GatewayCodeCard title="凭证口径">
            <div className="flex flex-col gap-1.5 mt-2">
              <p className={`text-xs text-muted-foreground`}>客户端 {'->'} 本地反代 使用 API Key</p>
              <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono">
                <code>{integrationSummary.authLabel}</code>
              </pre>
              <p className={`text-xs text-muted-foreground`}>本地反代 {'->'} Kiro API 使用本地 access token</p>
              <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs font-mono">
                <code>Authorization: Bearer &lt;local kiro access token&gt;</code>
              </pre>
            </div>
          </GatewayCodeCard>
        </div>
      </GatewaySurfaceCard>
    </div>
  )
}

export default GatewayIntegration
