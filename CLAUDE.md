# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

信用卡与银行电子账户管理桌面应用（卡包管家）：年费周期提醒、非柜风险预警。

## 常用命令

```bash
npm install                # 安装依赖（postinstall 自动跑 electron-builder install-app-deps）
npm run dev                # 开发模式启动（带热更新）
npm run typecheck          # 类型检查（node + web 两个 tsconfig）
npm run lint               # ESLint 检查（--cache）
npm run build              # typecheck + electron-vite build
npm run build:win          # 打包 Windows 安装包（electron-builder）
npm run dev                # 也可先 build 再 preview 验证产物
```

无单测框架，验证靠 `typecheck` + `lint` + 手动 `dev` 运行。

## 数据流架构（核心）

数据只存在一个 JSON 文件（`app.getPath('userData')/data.json`），整个应用是**单用户、本地、无后端**的桌面应用。数据流的唯一通道是 IPC：

```
Vue 视图 <-> store/data.ts (响应式 state)
             ├─ window.api.getData()  -> ipc invoke 'data:get'  -> 主进程读文件
             ├─ window.api.setData()  -> ipc invoke 'data:set'  -> 主进程写文件
             ├─ window.api.flushData()-> ipc send  'data:flush' -> 同步兜底写盘
             └─ window.api.exportData/importData -> 备份导出/导入
```

- **所有文件读写只在主进程** `src/main/index.ts` 里，渲染进程一律通过 `window.api` 和 `store/data.ts`，绝不直接碰文件系统。
- **保存策略（关键，勿破坏）**：渲染进程所有增删改只改内存里的响应式 `state`，然后走 `scheduleSave()` —— 500ms 防抖后调 `setData` 落盘。关窗前用 `flushSave()`（`beforeunload` 触发）走同步单向 `data:flush` 兜底，避免防抖窗口内退出丢失数据。
- **`snapshot()` 必须把 `reactive` Proxy 转成普通对象再传 IPC**：直接传 Proxy 会因结构化克隆失败抛 "An object could not be cloned"，导致保存静默失败（这是数据丢失的根因，注释中已说明）。

## 数据模型与共享类型

类型定义集中在 `src/shared/types.ts`，主进程、预加载、渲染进程都从这里导入（渲染进程经 `src/renderer/src/types/index.ts` 再导出）。核心契约是 `AppData`（cards/accounts/transactions/settings 四个数组/对象）。

- 预警阈值默认值 `DEFAULT_SETTINGS`（年费提醒 30 天、账户预警 120 天、非柜风险 150 天）在 shared/types.ts，主进程 `normalize()` 用它对旧数据做字段级容错，UI 设置的备案也以它为准。
- **敏感数据**：卡号只存后 4 位（`cardNoTail`/`accountNoTail`），不存完整卡号。
- 卡片免年费方式 `feeFreeType`：`count`（按笔数）/ `countAmount`（笔数+金额）/ `lifetime`（终身），提交数据时 `?? 'count'` 兜底兼容旧数据。

## 业务计算逻辑

纯函数集中在 `src/renderer/src/utils/card.ts`，由各视图的 computed 调用，不直接操作 store：

- `getCardCycleInfo(card, transactions, remindDays)` —— 12 个月一个年费周期，返回周期起止、剩余天数、笔数/金额达标进度、level（safe/ok/danger）。金额用 `Math.round(x*100)/100` 避免浮点误差。
- `getAccountRiskInfo(account, warnDays, dangerDays)` —— 按 `lastTxDate ?? openedAt` 计算无交易天数，划为 safe/warn/danger 三级。

## 视图与路由

- 路由用 `vue-router` **hash 模式**（`createWebHashHistory`），Electron 内不能用 browser history。路由在 `src/renderer/src/router/index.ts`，`meta.title` 是中文页面标题。
- 五个视图在 `src/renderer/src/views/`：Dashboard（看板）、CreditCards（信用卡）、BankAccounts（银行账户）、Transactions（交易记录）、Statistics（统计报表，ECharts）。
- 每个视图模式统一：`useData()` 取 `state` 和操作方法，computed 里用 utils 计算展示数据，ElMessage/ElMessageBox 做反馈和确认。
- 外层壳 `App.vue`：左侧 el-menu 导航，底部有「预警设置」和「数据备份」（导出/导入 JSON，导入有覆盖确认）。

## 开发环境注意事项

- `.npmrc` 已配置 electron 国内镜像（npmmirror），打包时避免 GitHub 直连超时。
- 开发模式下主进程把 userData 指向项目内 `dev-user-data/`（`src/main/index.ts`），避免污染正式数据。调试数据改动看这里。
- UI 文案和标签用中文，与现有命名一致。
