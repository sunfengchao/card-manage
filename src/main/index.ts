import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, chmodSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { AppData } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

// 应用数据文件路径：保存在系统用户数据目录，随应用升级保留
function getDataFilePath(): string {
  return join(app.getPath('userData'), 'data.json')
}

// 规范化数据结构，避免脏数据导致页面崩溃
function normalize(raw: unknown): AppData {
  const obj = (raw ?? {}) as Partial<AppData>
  const settings =
    obj.settings && typeof obj.settings === 'object' ? obj.settings : {}
  return {
    cards: Array.isArray(obj.cards) ? obj.cards : [],
    accounts: Array.isArray(obj.accounts) ? obj.accounts : [],
    transactions: Array.isArray(obj.transactions) ? obj.transactions : [],
    // 旧数据无 settings 时补全默认值，字段级容错
    settings: { ...DEFAULT_SETTINGS, ...settings }
  }
}

// 空数据（文件不存在或读取失败时的兜底）
function emptyData(): AppData {
  return { cards: [], accounts: [], transactions: [], settings: { ...DEFAULT_SETTINGS } }
}

function loadData(): AppData {
  const file = getDataFilePath()
  if (!existsSync(file)) {
    return emptyData()
  }
  try {
    return normalize(JSON.parse(readFileSync(file, 'utf-8')))
  } catch {
    return emptyData()
  }
}

// 写盘失败时抛出异常，由渲染进程捕获并向用户提示
function saveData(data: unknown): void {
  const file = getDataFilePath()
  // 确保数据目录存在（例如开发模式的 dev-user-data 目录在首次写入前可能不存在）
  mkdirSync(dirname(file), { recursive: true })
  // Windows 下数据文件可能因外部原因（如从备份复制而来）被标记为只读，
  // 写入前清除只读属性，避免 EPERM 导致保存失败
  if (process.platform === 'win32' && existsSync(file)) {
    const mode = statSync(file).mode
    if ((mode & 0o200) === 0) {
      try {
        chmodSync(file, mode | 0o200)
      } catch {
        // 清除只读失败时继续尝试写入，由 writeFileSync 报告真实错误
      }
    }
  }
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// 生成备份文件名时间戳，如 20260908-153000
function formatBackupStamp(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

// 导出全部数据到用户选择的 JSON 文件，返回保存路径（取消返回 null）
async function exportDataToFile(
  event: Electron.IpcMainInvokeEvent,
  data: unknown
): Promise<string | null> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const options = {
    title: '导出数据',
    defaultPath: `卡包备份-${formatBackupStamp()}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  }
  // 挂到父窗口上显示模态对话框；极端情况下窗口已销毁则退化为独立对话框
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  // 写入失败会抛出异常，由渲染进程捕获并提示
  writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
  return result.filePath
}

// 从用户选择的 JSON 文件读取备份数据（取消返回 null）
async function importDataFromFile(event: Electron.IpcMainInvokeEvent): Promise<AppData | null> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const options = {
    title: '导入数据',
    properties: ['openFile'] as Array<'openFile'>,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  const file = result.filePaths[0]
  if (!file) return null
  // 解析失败（文件损坏/格式不对）会抛出异常，由渲染进程捕获并提示
  const raw = JSON.parse(readFileSync(file, 'utf-8'))
  // 与 loadData 相同的容错处理，避免导入脏数据导致页面崩溃
  return normalize(raw)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 开发模式把用户数据固定到项目目录，避免污染正式数据
if (is.dev) {
  app.setPath('userData', join(__dirname, '../../dev-user-data'))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cardmanage.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('data:get', () => loadData())
  ipcMain.handle('data:set', (_event, data) => saveData(data))
  // 关窗兜底：渲染进程在卸载前用同步单向消息立即落盘
  ipcMain.on('data:flush', (_event, data) => saveData(data))
  // 数据导出/导入，用于跨机器迁移与备份
  ipcMain.handle('data:export', (event, data) => exportDataToFile(event, data))
  ipcMain.handle('data:import', (event) => importDataFromFile(event))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
