// 账号统计计算工具函数
import { isActiveStatus, isBannedStatus, isCappedStatus, isUnavailableStatus } from './accountStatus'
import { getSafeAccountDisplayName } from '../components/features/AccountManager/utils/accountRuntime'

// 获取账号显示名称（email 或 userId）
export const getAccountDisplayName = (account) => {
  return getSafeAccountDisplayName(account)
}

// 智能格式化使用量：整数显示整数，小数保留2位（去掉末尾0）
const formatUsage = (value) => {
  if (value == null) return '0'
  if (Number.isInteger(value)) return value.toString()
  return parseFloat(value.toFixed(2)).toString()
}

// 从 account 获取 breakdown（API 返回 camelCase）
const getBreakdown = (a) => {
  return a.usageData?.usageBreakdownList?.[0] || null
}

// 获取总配额（主配额 + 未过期的试用 + 未过期的奖励）
const getQuota = (a) => {
  if (isUnavailableStatus(a) && !isCappedStatus(a)) return 0

  const breakdown = getBreakdown(a)
  if (!breakdown) return 0

  const now = Date.now()
  const main = breakdown.usageLimit ?? 0

  // 检查试用是否激活（只看状态，不看日期）
  const trialInfo = breakdown.freeTrialInfo
  const trialActive = trialInfo?.freeTrialStatus === 'ACTIVE'
  const freeTrial = trialActive ? (trialInfo?.usageLimit ?? 0) : 0

  // 检查每个奖励配额（只计入未过期且状态为 ACTIVE 的奖励）
  const bonuses = Array.isArray(breakdown.bonuses) ? breakdown.bonuses : []
  let bonus = 0
  bonuses.forEach(b => {
    const expiry = b.expiresAt ? b.expiresAt * 1000 : Infinity
    if (expiry > now && b.status === 'ACTIVE') {
      bonus += b.usageLimit ?? 0
    }
  })

  return main + freeTrial + bonus
}

// 获取已使用量（主配额 + 未过期的试用 + 未过期的奖励）
const getUsed = (a) => {
  if (isUnavailableStatus(a) && !isCappedStatus(a)) return 0

  const breakdown = getBreakdown(a)
  if (!breakdown) return 0

  const now = Date.now()
  const main = breakdown.currentUsage ?? 0

  // 检查试用是否激活（只看状态，不看日期）
  const trialInfo = breakdown.freeTrialInfo
  const trialActive = trialInfo?.freeTrialStatus === 'ACTIVE'
  const freeTrial = trialActive ? (trialInfo?.currentUsage ?? 0) : 0

  // 检查每个奖励配额（只计入未过期且状态为 ACTIVE 的奖励）
  const bonuses = Array.isArray(breakdown.bonuses) ? breakdown.bonuses : []
  let bonus = 0
  bonuses.forEach(b => {
    const expiry = b.expiresAt ? b.expiresAt * 1000 : Infinity
    if (expiry > now && b.status === 'ACTIVE') {
      bonus += b.currentUsage ?? 0
    }
  })

  return main + freeTrial + bonus
}
const getSubType = (a) => a.usageData?.subscriptionInfo?.type ?? a.subscriptionType ?? ''
const getSubPlan = (a) => a.usageData?.subscriptionInfo?.subscriptionTitle ?? a.subscriptionPlan ?? ''

export function calcAccountStats(accounts) {
  const total = accounts.length
  const active = accounts.filter(a => isActiveStatus(a)).length
  const banned = accounts.filter(a => isBannedStatus(a)).length
  const unavailable = accounts.filter(a => isUnavailableStatus(a)).length
  // 保留精确值，不再取整
  const totalQuota = accounts.reduce((sum, a) => sum + getQuota(a), 0)
  const totalUsed = accounts.reduce((sum, a) => sum + getUsed(a), 0)
  const proPlus = accounts.filter(a => getSubType(a).includes('PRO+') || getSubPlan(a).includes('PRO+')).length
  const pro = accounts.filter(a =>
    (getSubType(a).includes('PRO') || getSubPlan(a).includes('PRO')) &&
    !(getSubType(a).includes('PRO+') || getSubPlan(a).includes('PRO+'))
  ).length
  const usagePercent = totalQuota > 0 ? Number((totalUsed / totalQuota * 100).toFixed(1)) : 0

  return {
    total, active, banned, unavailable, proPlus, pro, usagePercent,
    totalQuota, totalUsed, remaining: totalQuota - totalUsed,
    // 格式化后的显示值
    totalQuotaStr: formatUsage(totalQuota),
    totalUsedStr: formatUsage(totalUsed),
    remainingStr: formatUsage(totalQuota - totalUsed)
  }
}

export function getUsagePercent(used, quota) {
  return quota === 0 ? 0 : Math.min(100, (used / quota) * 100)
}

// 计算总配额和使用量（基于表单值 + usageData 中的额外配额）
// 用于编辑表单中实时计算
export function calcTotalUsageWithExtras(baseQuota, baseUsed, usageData) {
  const breakdown = usageData?.usageBreakdownList?.[0]
  if (!breakdown) {
    return {
      totalQuota: baseQuota,
      totalUsed: baseUsed,
      totalPercent: getUsagePercent(baseUsed, baseQuota),
      freeTrialQuota: 0,
      freeTrialUsed: 0,
      bonusQuota: 0,
      bonusUsed: 0
    }
  }

  const now = Date.now()

  // 检查试用是否激活
  const trialInfo = breakdown.freeTrialInfo
  const trialActive = trialInfo?.freeTrialStatus === 'ACTIVE'
  const freeTrialQuota = trialActive ? (trialInfo?.usageLimit ?? 0) : 0
  const freeTrialUsed = trialActive ? (trialInfo?.currentUsage ?? 0) : 0

  // 检查每个奖励配额（只计入未过期且状态为 ACTIVE 的奖励）
  const bonuses = Array.isArray(breakdown.bonuses) ? breakdown.bonuses : []
  let bonusQuota = 0
  let bonusUsed = 0
  bonuses.forEach(b => {
    const expiry = b.expiresAt ? b.expiresAt * 1000 : Infinity
    if (expiry > now && b.status === 'ACTIVE') {
      bonusQuota += b.usageLimit ?? 0
      bonusUsed += b.currentUsage ?? 0
    }
  })

  const totalQuota = baseQuota + freeTrialQuota + bonusQuota
  const totalUsed = baseUsed + freeTrialUsed + bonusUsed
  const totalPercent = getUsagePercent(totalUsed, totalQuota)

  return {
    totalQuota,
    totalUsed,
    totalPercent,
    freeTrialQuota,
    freeTrialUsed,
    bonusQuota,
    bonusUsed
  }
}

// 直接从 account 对象计算百分比
// 用于列表排序等场景
export function calcAccountUsagePercent(account) {
  const breakdown = account.usageData?.usageBreakdownList?.[0]
  if (!breakdown) return 0

  const mainUsed = breakdown.currentUsage ?? 0
  const mainQuota = breakdown.usageLimit ?? 0
  const { totalUsed, totalQuota } = calcTotalUsageWithExtras(mainQuota, mainUsed, account.usageData)
  return getUsagePercent(totalUsed, totalQuota)
}

export { getQuota, getUsed, getSubType, getSubPlan, formatUsage }
