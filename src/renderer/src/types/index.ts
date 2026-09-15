// 渲染进程使用的类型统一从 shared 导出
export type {
  AppData,
  Card,
  Account,
  Transaction,
  FeeFreeType,
  AppSettings
} from '../../../shared/types'

// 预警设置默认值（值导出）
export { DEFAULT_SETTINGS } from '../../../shared/types'
