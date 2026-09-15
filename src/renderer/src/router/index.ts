import { createRouter, createWebHashHistory } from 'vue-router'

// Electron 环境必须使用 hash 模式
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/Dashboard.vue'),
      meta: { title: '看板首页' }
    },
    {
      path: '/cards',
      name: 'cards',
      component: () => import('../views/CreditCards.vue'),
      meta: { title: '信用卡管理' }
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('../views/BankAccounts.vue'),
      meta: { title: '银行账户' }
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('../views/Transactions.vue'),
      meta: { title: '交易记录' }
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('../views/Statistics.vue'),
      meta: { title: '统计报表' }
    }
  ]
})

export default router
