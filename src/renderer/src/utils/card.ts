import dayjs from 'dayjs'
import { DEFAULT_SETTINGS } from '../types'
import type { Card, Account, Transaction } from '../types'

export interface CardCycleInfo {
  /** 是否终身免年费 */
  lifetime: boolean
  /** 是否笔数+金额组合达标方式 */
  countAmount: boolean
  cycleStart: string
  cycleEnd: string
  daysLeft: number
  doneCount: number
  requiredCount: number
  /** 周期内已刷金额 */
  doneAmount: number
  /** 免年费所需金额（仅组合方式参与判断，其余为 0） */
  requiredAmount: number
  reached: boolean
  level: 'safe' | 'ok' | 'danger'
}

function fullMonthsSince(start: dayjs.Dayjs, now: dayjs.Dayjs): number {
  let months = (now.year() - start.year()) * 12 + (now.month() - start.month())
  if (now.date() < start.date()) months -= 1
  return Math.max(0, months)
}

/** 计算信用卡当前年费周期（12 个月一个周期）与达标进度 */
export function getCardCycleInfo(
  card: Card,
  transactions: Transaction[],
  /** 年费周期到期前 N 天提醒，默认取全局设置 */
  remindDays: number = DEFAULT_SETTINGS.cardRemindDays
): CardCycleInfo {
  const start = dayjs(card.cycleStartDate)
  const now = dayjs()
  const cycleIndex = Math.floor(fullMonthsSince(start, now) / 12)
  const cycleStart = start.add(cycleIndex * 12, 'month')
  const cycleEnd = cycleStart.add(12, 'month')
  const cycleTxs = transactions.filter((t) => {
    if (t.targetType !== 'card' || t.targetId !== card.id) return false
    const d = dayjs(t.date)
    return !d.isBefore(cycleStart) && d.isBefore(cycleEnd)
  })
  const doneCount = cycleTxs.length
  // 金额保留两位小数，避免浮点误差影响达标判断
  const doneAmount = Math.round(cycleTxs.reduce((sum, t) => sum + t.amount, 0) * 100) / 100
  const daysLeft = cycleEnd.diff(now, 'day')
  const feeFreeType = card.feeFreeType ?? 'count'
  const isCountAmount = feeFreeType === 'countAmount'
  const requiredCount = card.requiredTxCount ?? 0
  // 仅组合方式参与金额判断，其他方式 requiredAmount 为 0（金额条件恒满足）
  const requiredAmount = isCountAmount ? card.requiredAmount ?? 0 : 0
  const lifetime = feeFreeType === 'lifetime'
  // 终身免年费、或笔数与金额（组合方式）均达标视为达标
  const reached = lifetime || (doneCount >= requiredCount && doneAmount >= requiredAmount)
  let level: CardCycleInfo['level'] = 'ok'
  if (reached) {
    level = 'safe'
  } else if (daysLeft <= remindDays) {
    level = 'danger'
  }
  return {
    lifetime,
    countAmount: isCountAmount,
    cycleStart: cycleStart.format('YYYY-MM-DD'),
    cycleEnd: cycleEnd.format('YYYY-MM-DD'),
    daysLeft,
    doneCount,
    requiredCount,
    doneAmount,
    requiredAmount,
    reached,
    level
  }
}

export interface AccountRiskInfo {
  baseDate: string | null
  daysSince: number
  level: 'safe' | 'warn' | 'danger'
}

/** 计算银行账户非柜风险（超期无交易） */
export function getAccountRiskInfo(
  account: Account,
  /** 近 N 天无交易进入预警，默认取全局设置 */
  warnDays: number = DEFAULT_SETTINGS.accountWarnDays,
  /** 近 N 天无交易视为非柜风险，默认取全局设置 */
  dangerDays: number = DEFAULT_SETTINGS.accountDangerDays
): AccountRiskInfo {
  const base = account.lastTxDate ?? account.openedAt
  const daysSince = dayjs().diff(dayjs(base), 'day')
  let level: AccountRiskInfo['level'] = 'safe'
  if (daysSince >= dangerDays) {
    level = 'danger'
  } else if (daysSince >= warnDays) {
    level = 'warn'
  }
  return { baseDate: base, daysSince, level }
}

export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}
