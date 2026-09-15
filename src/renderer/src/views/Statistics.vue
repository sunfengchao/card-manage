<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { useData } from '../store/data'
import { getCardCycleInfo } from '../utils/card'

const { state } = useData()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

// 近 6 个月信用卡刷卡统计
const monthlyData = computed(() => {
  const months: { label: string; key: string; count: number; amount: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const m = dayjs().subtract(i, 'month')
    months.push({ label: m.format('YYYY-MM'), key: m.format('YYYY-MM'), count: 0, amount: 0 })
  }
  for (const t of state.transactions) {
    if (t.targetType !== 'card') continue
    const idx = months.findIndex((m) => t.date.startsWith(m.key))
    if (idx >= 0) {
      months[idx].count++
      months[idx].amount += t.amount
    }
  }
  return months
})

function renderChart(): void {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  const data = monthlyData.value
  chart.setOption({
    title: { text: '近 6 个月信用卡刷卡统计', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params) {
        const list = params as { name: string; seriesName: string; value: number }[]
        let html = `${list[0].name}<br/>`
        for (const p of list) {
          html += `${p.seriesName}：${p.value}<br/>`
        }
        return html
      }
    },
    legend: { data: ['笔数', '金额（元）'], top: 30 },
    grid: { top: 70, left: 50, right: 50, bottom: 30 },
    xAxis: { type: 'category', data: data.map((m) => m.label) },
    yAxis: [
      { type: 'value', name: '笔数', minInterval: 1 },
      { type: 'value', name: '金额（元）' }
    ],
    series: [
      {
        name: '笔数',
        type: 'bar',
        data: data.map((m) => m.count),
        itemStyle: { color: '#409eff' },
        barWidth: 24
      },
      {
        name: '金额（元）',
        type: 'bar',
        yAxisIndex: 1,
        data: data.map((m) => Math.round(m.amount * 100) / 100),
        itemStyle: { color: '#67c23a' },
        barWidth: 24
      }
    ]
  })
}

function handleResize(): void {
  chart?.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

const cardRows = computed(() =>
  state.cards.map((card) => {
    const info = getCardCycleInfo(card, state.transactions, state.settings.cardRemindDays)
    return {
      name: `${card.bank} ${card.cardName}（${card.cardNoTail}）`,
      done: info.doneCount,
      required: info.requiredCount,
      doneAmount: info.doneAmount,
      requiredAmount: info.requiredAmount,
      countAmount: info.countAmount,
      lifetime: info.lifetime,
      cycleEnd: info.cycleEnd,
      daysLeft: info.daysLeft,
      reached: info.reached
    }
  })
)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">统计报表</h2>
    </div>

    <el-card shadow="never" class="chart-card">
      <div ref="chartRef" class="chart-box" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="table-title">各卡当前年费周期进度</span>
      </template>
      <el-table :data="cardRows" style="width: 100%">
        <el-table-column label="卡片" prop="name" min-width="200" />
        <el-table-column label="免年费进度" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.lifetime" type="success" size="small">终身免年费</el-tag>
            <el-progress
              v-else
              :percentage="
                row.countAmount
                  ? Math.min(
                      row.required > 0 ? Math.min(100, Math.round((row.done / row.required) * 100)) : 100,
                      row.requiredAmount > 0
                        ? Math.min(100, Math.round((row.doneAmount / row.requiredAmount) * 100))
                        : 100
                    )
                  : row.required > 0
                    ? Math.min(100, Math.round((row.done / row.required) * 100))
                    : 100
              "
              :status="row.reached ? 'success' : undefined"
            />
          </template>
        </el-table-column>
        <el-table-column label="笔数" width="90">
          <template #default="{ row }">
            {{ row.lifetime ? '—' : row.required > 0 ? `${row.done} / ${row.required}` : '无笔数要求' }}
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }">
            <template v-if="row.lifetime">—</template>
            <template v-else-if="row.countAmount">
              {{ row.requiredAmount > 0 ? `¥${row.doneAmount} / ¥${row.requiredAmount}` : '无金额要求' }}
            </template>
            <template v-else>—</template>
          </template>
        </el-table-column>
        <el-table-column label="周期到期日" width="120">
          <template #default="{ row }">{{ row.lifetime ? '—' : row.cycleEnd }}</template>
        </el-table-column>
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">{{ row.lifetime ? '—' : `${row.daysLeft} 天` }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.reached ? 'success' : 'info'" size="small">
              {{ row.reached ? '已达标' : '进行中' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="cardRows.length === 0" description="暂无信用卡数据" />
    </el-card>
  </div>
</template>

<style scoped>
.chart-card {
  margin-bottom: 16px;
}
.chart-box {
  width: 100%;
  height: 320px;
}
.table-title {
  font-weight: 600;
}
</style>
