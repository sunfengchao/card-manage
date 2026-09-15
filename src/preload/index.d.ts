import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppData } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getData: () => Promise<AppData>
      setData: (data: AppData) => Promise<void>
      flushData: (data: AppData) => void
    }
  }
}
