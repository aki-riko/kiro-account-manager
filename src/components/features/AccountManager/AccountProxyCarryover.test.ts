import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const accountCmd = await readFile(new URL('../../../../src-tauri/src/commands/account_cmd.rs', import.meta.url), 'utf8')
const accountCore = await readFile(new URL('../../../../src-tauri/src/core/account.rs', import.meta.url), 'utf8')
const accountList = await readFile(new URL('./AccountListView.tsx', import.meta.url), 'utf8')
const editModal = await readFile(new URL('./EditAccountModal.tsx', import.meta.url), 'utf8')

assert.match(accountCmd, /let has_proxy_values = !proxy_config\.host\.trim\(\)\.is_empty\(\)/)
assert.match(accountCmd, /let next_proxy_config = if proxy_config\.enabled \|\| has_proxy_values \{[\s\S]*?Some\(proxy_config\)[\s\S]*?\} else \{[\s\S]*?None/)
assert.match(accountCmd, /if store\.accounts\[idx\]\.proxy_config != next_proxy_config \{[\s\S]*?store\.accounts\[idx\]\.proxy_config = next_proxy_config;[\s\S]*?clear_available_models_cache\(&mut store\.accounts\[idx\]\);/)

assert.match(accountCore, /fn account_proxy_config_uses_remote_dns_for_socks5\(\)/)
assert.match(accountCore, /assert_eq!\(proxy\.to_proxy_url\(\)\.unwrap\(\), "socks5h:\/\/127\.0\.0\.1:1080"\)/)
assert.match(accountCore, /fn account_proxy_config_includes_auth_when_configured\(\)/)

assert.match(accountList, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); onEditLabel\(account\) \}\}/)
assert.match(accountList, /title=\{t\('accountCard\.editRemark'\)\}/)

assert.match(editModal, /const \[proxyQuickInputError, setProxyQuickInputError\] = useState\(''\)/)
assert.match(editModal, /const handleProxyQuickInputChange = \(value: string\) => \{/)
assert.match(editModal, /setProxyConfig\(parseProxyUrl\(value\)\)/)
assert.match(editModal, /proxyQuickInputError \|\| t\('editAccount\.proxyQuickInputHint'\)/)

console.log('PR #127 carry-over behavior is covered')
