import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
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
  writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2), 'utf-8')
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
