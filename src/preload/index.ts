import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppData } from '../shared/types'

// 暴露给渲染进程的数据读写 API
const api = {
  // 读取本地数据文件
  getData: (): Promise<AppData> => ipcRenderer.invoke('data:get'),
  // 异步保存（带异常回传，便于渲染进程提示保存失败）
  setData: (data: AppData): Promise<void> => ipcRenderer.invoke('data:set', data),
  // 关窗前同步兜底保存（单向消息，不等结果）
  flushData: (data: AppData): void => {
    ipcRenderer.send('data:flush', data)
  },
  // 导出全部数据到 JSON 备份文件，返回保存路径（用户取消返回 null）
  exportData: (data: AppData): Promise<string | null> => ipcRenderer.invoke('data:export', data),
  // 从 JSON 备份文件读取数据（用户取消返回 null）
  importData: (): Promise<AppData | null> => ipcRenderer.invoke('data:import')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
