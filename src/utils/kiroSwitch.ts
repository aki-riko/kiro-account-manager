import { invoke } from '@tauri-apps/api/core'

export async function applyMachineGuid(account, _settings: Record<string, any> = {}) {
  try {
    let machineId = account.machineId

    if (!machineId) {
      machineId = await invoke('generate_machine_guid')
      await invoke('update_account', {
        params: {
          id: account.id,
          machine_id: machineId
        }
      })
    }

    return await setCustomMachineGuid(account, machineId)
  } catch {
    // 机器码操作失败不阻断切换流程
  }

  return account
}

async function setCustomMachineGuid(account, machineId) {
  await invoke('set_custom_machine_guid', { newGuid: machineId })
  return { ...account, machineId }
}

export function buildSwitchParams(account) {
  const isIdC = account.provider === 'BuilderId' || account.provider === 'Enterprise' || account.clientIdHash
  const authMethod = isIdC ? 'IdC' : 'social'

  const params: Record<string, any> = {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    provider: account.provider || 'Google',
    authMethod
  }

  if (isIdC) {
    params.region = account.region || 'us-east-1'
    params.clientId = account.clientId
    params.clientSecret = account.clientSecret

    // clientIdHash 是 token 文件名的真实来源（IDE 登录产物里直接存了它）。
    // 优先把它传给后端，避免后端用 start_url 重算时因 start_url 缺失/错误而文件名错位。
    if (account.clientIdHash) {
      params.clientIdHash = account.clientIdHash
    }

    // Enterprise 仍透传 startUrl 作为后端兜底（clientIdHash 缺失时才用它重算）。
    if (account.provider === 'Enterprise') {
      params.startUrl = account.startUrl
    }

    // BuilderId 真实缓存带 profileArn（实测 IDE 源码 FixedProfileArns 里 BuilderId 固定
    // arn:...:638616132270:profile/AAAACCCCXXXX）。透传账号自带值，让后端"账号自带优先、
    // 否则默认常量兜底"生效；缺它会导致 IDE 调 Q API 时无 profile，BuilderId 账号失效。
    // Enterprise 不带 profileArn（与真实缓存一致），故只对 BuilderId 透传。
    if (account.provider === 'BuilderId' && account.profileArn) {
      params.profileArn = account.profileArn
    }
  } else {
    params.profileArn = account.profileArn || 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
  }

  return params
}
