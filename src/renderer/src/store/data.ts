import { reactive } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import type { AppData, Card, Account, Transaction, AppSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

// 全局共享的响应式数据
const state = reactive<AppData>({
  cards: [],
  accounts: [],
  transactions: [],
  settings: { ...DEFAULT_SETTINGS }
})
let loaded = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saveFailed = false
// 是否存在未落盘的变更，避免关窗时用旧内存覆盖磁盘数据
let dirty = false

function snapshot(): AppData {
  // 必须转为普通对象：reactive 的 Proxy 无法通过 IPC 结构化克隆，
  // 直接传输会抛 "An object could not be cloned"，导致保存静默失败（数据丢失的根因）
  return JSON.parse(
    JSON.stringify({
      cards: state.cards,
      accounts: state.accounts,
      transactions: state.transactions,
      settings: state.settings
    })
  )
}

// 保存失败时立即向用户提示（例如无磁盘写入权限时），避免数据静默丢失
function reportSaveFailure(): void {
  if (!saveFailed) {
    saveFailed = true
    ElMessage.error('数据保存失败！请勿直接关闭应用，检查磁盘权限后重试')
  }
}

async function persistData(): Promise<void> {
  try {
    await window.api.setData(snapshot())
    saveFailed = false
    dirty = false
  } catch {
    reportSaveFailure()
  }
}

// 500ms 防抖保存，合并连续操作
function scheduleSave(): void {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    persistData()
  }, 500)
}

// 关窗兜底：仅在有未落盘变更时立即保存，防止防抖窗口内退出导致丢失
function flushSave(): void {
  if (!dirty) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  try {
    window.api.flushData(snapshot())
    dirty = false
  } catch {
    // 兜底通道失败时不阻塞关闭流程
  }
}

async function initDataStore(): Promise<void> {
  if (loaded) return
  const data = await window.api.getData()
  state.cards = data.cards
  state.accounts = data.accounts
  state.transactions = data.transactions
  state.settings = data.settings ?? { ...DEFAULT_SETTINGS }
  loaded = true
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// useData 返回的数据与操作方法集合
interface UseDataResult {
  state: AppData
  addCard: (card: Omit<Card, 'id' | 'createdAt'>) => void
  updateCard: (id: string, patch: Partial<Card>) => void
  removeCard: (id: string) => void
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  removeAccount: (id: string) => void
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void
  removeTransaction: (id: string) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  exportDataToFile: () => Promise<string | null>
  importDataFromFile: () => Promise<AppData | null>
  replaceAllData: (data: AppData) => Promise<boolean>
}

export function useData(): UseDataResult {
  function addCard(card: Omit<Card, 'id' | 'createdAt'>): void {
    state.cards.push({ ...card, id: genId(), createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
    scheduleSave()
  }

  function updateCard(id: string, patch: Partial<Card>): void {
    const idx = state.cards.findIndex((c) => c.id === id)
    if (idx >= 0) {
      state.cards[idx] = { ...state.cards[idx], ...patch }
      scheduleSave()
    }
  }

  function removeCard(id: string): void {
    const i = state.cards.findIndex((c) => c.id === id)
    if (i >= 0) state.cards.splice(i, 1)
    state.transactions = state.transactions.filter(
      (t) => !(t.targetType === 'card' && t.targetId === id)
    )
    scheduleSave()
  }

  function addAccount(account: Omit<Account, 'id' | 'createdAt'>): void {
    state.accounts.push({
      ...account,
      lastTxDate: account.lastTxDate ?? null,
      id: genId(),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    })
    scheduleSave()
  }

  function updateAccount(id: string, patch: Partial<Account>): void {
    const idx = state.accounts.findIndex((a) => a.id === id)
    if (idx >= 0) {
      state.accounts[idx] = { ...state.accounts[idx], ...patch }
      scheduleSave()
    }
  }

  function removeAccount(id: string): void {
    const i = state.accounts.findIndex((a) => a.id === id)
    if (i >= 0) state.accounts.splice(i, 1)
    state.transactions = state.transactions.filter(
      (t) => !(t.targetType === 'account' && t.targetId === id)
    )
    scheduleSave()
  }

  function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): void {
    state.transactions.push({
      ...tx,
      id: genId(),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    })
    if (tx.targetType === 'account') {
      const acc = state.accounts.find((a) => a.id === tx.targetId)
      if (acc && (!acc.lastTxDate || tx.date > acc.lastTxDate)) {
        acc.lastTxDate = tx.date
      }
    }
    scheduleSave()
  }

  function removeTransaction(id: string): void {
    const idx = state.transactions.findIndex((t) => t.id === id)
    if (idx < 0) return
    const removed = state.transactions[idx]
    state.transactions.splice(idx, 1)
    if (removed.targetType === 'account') {
      recalcAccountLastTxDate(removed.targetId)
    }
    scheduleSave()
  }

  function recalcAccountLastTxDate(accountId: string): void {
    const acc = state.accounts.find((a) => a.id === accountId)
    if (!acc) return
    const dates = state.transactions
      .filter((t) => t.targetType === 'account' && t.targetId === accountId)
      .map((t) => t.date)
      .sort()
    acc.lastTxDate = dates.length > 0 ? dates[dates.length - 1] : null
  }

  function updateSettings(patch: Partial<AppSettings>): void {
    state.settings = { ...state.settings, ...patch }
    scheduleSave()
  }

  // 导出全部数据到 JSON 备份文件，返回保存路径（用户取消返回 null）
  async function exportDataToFile(): Promise<string | null> {
    try {
      // snapshot() 已转为普通对象，可直接通过 IPC 结构化克隆
      return await window.api.exportData(snapshot())
    } catch {
      ElMessage.error('导出失败！请检查保存路径或磁盘权限后重试')
      return null
    }
  }

  // 从 JSON 备份文件读取数据（用户取消或读取失败返回 null）
  async function importDataFromFile(): Promise<AppData | null> {
    try {
      return await window.api.importData()
    } catch {
      ElMessage.error('导入失败！文件不存在或格式不正确')
      return null
    }
  }

  // 用备份数据完全覆盖当前数据并立即落盘（导入确认后调用），返回是否写盘成功
  async function replaceAllData(data: AppData): Promise<boolean> {
    state.cards = data.cards
    state.accounts = data.accounts
    state.transactions = data.transactions
    state.settings = data.settings ?? { ...DEFAULT_SETTINGS }
    // 取消防抖定时器并立即持久化，避免“先提示成功、后写盘失败”的误导
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    dirty = true
    try {
      await window.api.setData(snapshot())
      saveFailed = false
      dirty = false
      return true
    } catch {
      return false
    }
  }

  return {
    state,
    addCard,
    updateCard,
    removeCard,
    addAccount,
    updateAccount,
    removeAccount,
    addTransaction,
    removeTransaction,
    updateSettings,
    exportDataToFile,
    importDataFromFile,
    replaceAllData
  }
}

export function getTargetName(targetType: 'card' | 'account', targetId: string): string {
  const { state: s } = useData()
  if (targetType === 'card') {
    const c = s.cards.find((x) => x.id === targetId)
    return c ? `${c.bank} ${c.cardName}` : '（已删除）'
  }
  const a = s.accounts.find((x) => x.id === targetId)
  return a ? `${a.bank} ${a.accountName}` : '（已删除）'
}

export { state, initDataStore, flushSave }
