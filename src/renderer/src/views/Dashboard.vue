<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useData } from '../store/data'
import { getCardCycleInfo, getAccountRiskInfo } from '../utils/card'
import type { Card, Account, Transaction } from '../types'

interface AlertItem {
  key: string
  type: 'danger' | 'warning'
  title: string
  detail: string
  goto: string
}

const router = useRouter()
const { state } = useData()

const cardInfos = computed(() =>
  state.cards.map((card: Card) => ({
    card,
    info: getCardCycleInfo(card, state.transactions, state.settings.cardRemindDays)
  }))
)
const accountInfos = computed(() =>
  state.accounts.map((account: Account) => ({
    account,
    info: getAccountRiskInfo(
      account,
      state.settings.accountWarnDays,
      state.settings.accountDangerDays
    )
  }))
)

const monthStats = computed(() => {
  const monthStart = dayjs().format('YYYY-MM-01')
  const list = state.transactions.filter(
    (t: Transaction) =>
      t.targetType === 'card' && t.date >= monthStart && t.date <= dayjs().format('YYYY-MM-DD')
  )
  return {
    count: list.length,
    amount: list.reduce((sum: number, t: Transaction) => sum + t.amount, 0)
  }
})

const alerts = computed<AlertItem[]>(() => {
  const items: AlertItem[] = []
  for (const { card, info } of cardInfos.value) {
    if (info.level === 'danger') {
      // 组合方式需同时展示笔数与金额进度
      const progress = info.countAmount
        ? `已刷 ${info.doneCount}/${info.requiredCount} 笔、¥${info.doneAmount}/¥${info.requiredAmount}`
        : `已刷 ${info.doneCount}/${info.requiredCount} 笔`
      items.push({
        key: `card-${card.id}`,
        type: 'danger',
        title: `${card.bank} ${card.cardName}（尾号${card.cardNoTail}）`,
        detail: `年费周期 ${dayjs(info.cycleEnd).format('YYYY年MM月DD日')} 到期，剩 ${info.daysLeft} 天，${progress}，未达标将产生年费 ¥${card.annualFeeAmount}`,
        goto: '/cards'
      })
    }
  }
  for (const { account, info } of accountInfos.value) {
    if (info.level === 'danger') {
      items.push({
        key: `acc-${account.id}`,
        type: 'danger',
        title: `${account.bank} ${account.accountName}（尾号${account.accountNoTail}）`,
        detail: `已 ${info.daysSince} 天无交易（基准日 ${info.baseDate}），超过 ${state.settings.accountDangerDays} 天将被银行非柜，请尽快动账一笔`,
        goto: '/accounts'
      })
    } else if (info.level === 'warn') {
      items.push({
        key: `acc-${account.id}`,
        type: 'warning',
        title: `${account.bank} ${account.accountName}（尾号${account.accountNoTail}）`,
        detail: `已 ${info.daysSince} 天无交易（基准日 ${info.baseDate}），临近非柜风险线（${state.settings.accountDangerDays} 天），建议安排一笔交易`,
        goto: '/accounts'
      })
    }
  }
  return items.sort((a, b) => (a.type === 'danger' ? -1 : 1) - (b.type === 'danger' ? -1 : 1))
})

const dangerCount = computed(() => alerts.value.filter((a) => a.type === 'danger').length)
const warnCount = computed(() => alerts.value.filter((a) => a.type === 'warning').length)

const cardReachStats = computed(() => {
  const reached = cardInfos.value.filter((x) => x.info.reached).length
  return { total: cardInfos.value.length, reached, unreached: cardInfos.value.length - reached }
})

const accountStats = computed(() => {
  const safe = accountInfos.value.filter((x) => x.info.level === 'safe').length
  const warn = accountInfos.value.filter((x) => x.info.level === 'warn').length
  const danger = accountInfos.value.filter((x) => x.info.level === 'danger').length
  return { total: accountInfos.value.length, safe, warn, danger }
})

function goto(path: string): void {
  router.push(path)
}
</script>

<template>
  <div class="page">
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-label">信用卡</div>
          <div class="stat-value">{{ cardReachStats.total }}</div>
          <div class="stat-sub">
            <span class="text-success">达标 {{ cardReachStats.reached }}</span>
            <span class="text-danger">未达标 {{ cardReachStats.unreached }}</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-label">银行电子账户</div>
          <div class="stat-value">{{ accountStats.total }}</div>
          <div class="stat-sub">
            <span class="text-success">正常 {{ accountStats.safe }}</span>
            <span class="text-warning">预警 {{ accountStats.warn }}</span>
            <span class="text-danger">风险 {{ accountStats.danger }}</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-label">本月刷卡笔数</div>
          <div class="stat-value">{{ monthStats.count }}</div>
          <div class="stat-sub text-muted">全部信用卡合计</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-label">本月刷卡金额</div>
          <div class="stat-value">¥{{ monthStats.amount.toFixed(2) }}</div>
          <div class="stat-sub text-muted">全部信用卡合计</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="alert-panel">
      <template #header>
        <div class="panel-header">
          <span>到期提醒</span>
          <span class="panel-summary">
            <el-tag type="danger" effect="dark" size="small">紧急 {{ dangerCount }}</el-tag>
            <el-tag type="warning" effect="dark" size="small">预警 {{ warnCount }}</el-tag>
          </span>
        </div>
      </template>
      <el-empty v-if="alerts.length === 0" description="暂无提醒，一切正常" :image-size="80" />
      <div
        v-for="item in alerts"
        :key="item.key"
        class="alert-item"
        :class="`alert-${item.type}`"
        @click="goto(item.goto)"
      >
        <div class="alert-title">
          <el-tag :type="item.type === 'danger' ? 'danger' : 'warning'" size="small" effect="dark">
            {{ item.type === 'danger' ? '紧急' : '预警' }}
          </el-tag>
          <span>{{ item.title }}</span>
        </div>
        <div class="alert-detail">{{ item.detail }}</div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.stat-label {
  font-size: 13px;
  color: #909399;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 6px 0;
}
.stat-sub {
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.text-success {
  color: #67c23a;
}
.text-warning {
  color: #e6a23c;
}
.text-danger {
  color: #f56c6c;
}
.text-muted {
  color: #909399;
}
.alert-panel :deep(.el-card__body) {
  padding-top: 8px;
  padding-bottom: 8px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
.panel-summary {
  display: flex;
  gap: 8px;
}
.alert-item {
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.alert-item:hover {
  background: #f5f7fa;
}
.alert-danger {
  background: #fef0f0;
  border: 1px solid #fde2e2;
}
.alert-warning {
  background: #fdf6ec;
  border: 1px solid #faecd8;
}
.alert-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}
.alert-detail {
  margin-top: 4px;
  padding-left: 2px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
</style>
