import type { Account } from '../types/account'

export interface ManagedKskEligibility {
  eligible: boolean
  reason: string
}

export function getManagedKskEligibility(account: Account): ManagedKskEligibility {
  const authMethod = account.authMethod?.trim().toLowerCase() || ''
  if (authMethod === 'external_idp') {
    return {
      eligible: false,
      reason: 'external_idp 账号不能签发 KSK，请使用手工高级入口',
    }
  }
  if (!account.refreshToken?.trim()) {
    return {
      eligible: false,
      reason: '账号缺少 refresh token，无法签发 KSK',
    }
  }
  return { eligible: true, reason: '' }
}
