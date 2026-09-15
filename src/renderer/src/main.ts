import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { state, initDataStore, flushSave } from './store/data'
import './assets/main.css'

const app = createApp(App)

async function bootstrap(): Promise<void> {
  await initDataStore()
  app.use(ElementPlus, { locale: zhCn })
  app.use(router)
  app.mount('#app')
  // 关窗兜底：确保防抖窗口内的变更也能落盘
  window.addEventListener('beforeunload', flushSave)
}

bootstrap()

export { state }
