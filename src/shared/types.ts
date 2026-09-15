// 跨进程共享的数据类型定义

/** 免年费方式：按笔数达标 / 笔数+金额同时达标 / 终身免年费 */
export type FeeFreeType = 'count' | 'countAmount' | 'lifetime'

/** 信用卡 */
export interface Card {
  id: string
  bank: string
  cardName: string
  cardNoTail: string
  /** 年费周期起算日（通常为开卡日） */
  cycleStartDate: string
  annualFeeAmount: number
  /** 免年费所需笔数，0 表示无笔数要求 */
  requiredTxCount: number
  /** 免年费所需金额（笔数+金额方式），0 表示无金额要求 */
  requiredAmount?: number
  /** 免年费方式，旧数据缺省视为按笔数 */
  feeFreeType?: FeeFreeType
  createdAt: string
}

/** 银行电子账户 */
export interface Account {
  id: string
  bank: string
  accountName: string
  /** 账户类型：II 类 / III 类 */
  accountType: 'II' | 'III'
  accountNoTail: string
  openedAt: string
  lastTxDate: string | null
  createdAt: string
}

/** 交易记录 */
export interface Transaction {
  id: string
  targetType: 'card' | 'account'
  targetId: string
  amount: number
  date: string
  description: string
  createdAt: string
}

/** 预警设置（天数阈值可由用户配置） */
export interface AppSettings {
  /** 信用卡年费周期到期前 N 天开始提醒 */
  cardRemindDays: number
  /** 银行账户近 N 天无交易进入预警 */
  accountWarnDays: number
  /** 银行账户近 N 天无交易视为非柜风险 */
  accountDangerDays: number
}

/** 预警设置默认值 */
export const DEFAULT_SETTINGS: AppSettings = {
  cardRemindDays: 30,
  accountWarnDays: 120,
  accountDangerDays: 150
}

/** 应用数据文件结构 */
export interface AppData {
  cards: Card[]
  accounts: Account[]
  transactions: Transaction[]
  settings: AppSettings
}
