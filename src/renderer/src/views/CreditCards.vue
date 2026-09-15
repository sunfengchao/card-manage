<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useData } from '../store/data'
import { getCardCycleInfo, today } from '../utils/card'
import type { Card, FeeFreeType } from '../types'

const { state, addCard, updateCard, removeCard, addTransaction } = useData()

const rows = computed(() =>
  state.cards.map((card) => ({
    card,
    info: getCardCycleInfo(card, state.transactions, state.settings.cardRemindDays)
  }))
)

/** 计算达标进度百分比（要求为 0 视为 100%） */
function calcPct(done: number, required: number): number {
  return required > 0 ? Math.min(100, Math.round((done / required) * 100)) : 100
}

// ---------- 添加 / 编辑 ----------
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  bank: '',
  cardName: '',
  cardNoTail: '',
  cycleStartDate: '',
  annualFeeAmount: 0,
  requiredTxCount: 6,
  requiredAmount: 0,
  feeFreeType: 'count' as FeeFreeType
})

const rules = {
  bank: [{ required: true, message: '请输入银行名称', trigger: 'blur' }],
  cardName: [{ required: true, message: '请输入卡片名称', trigger: 'blur' }],
  cardNoTail: [
    { required: true, message: '请输入卡号后4位', trigger: 'blur' },
    { pattern: /^\d{4}$/, message: '仅支持4位数字', trigger: 'blur' }
  ],
  cycleStartDate: [{ required: true, message: '请选择年费周期开始日期', trigger: 'change' }],
  annualFeeAmount: [{ required: true, message: '请输入年费金额', trigger: 'blur' }],
  requiredTxCount: [{ required: true, message: '请输入免年费所需笔数', trigger: 'blur' }]
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    bank: '',
    cardName: '',
    cardNoTail: '',
    cycleStartDate: today(),
    annualFeeAmount: 0,
    requiredTxCount: 6,
    requiredAmount: 0,
    feeFreeType: 'count'
  })
  dialogVisible.value = true
}

function openEdit(row: { card: Card }): void {
  editingId.value = row.card.id
  Object.assign(form, {
    bank: row.card.bank,
    cardName: row.card.cardName,
    cardNoTail: row.card.cardNoTail,
    cycleStartDate: row.card.cycleStartDate,
    annualFeeAmount: row.card.annualFeeAmount,
    requiredTxCount: row.card.requiredTxCount,
    requiredAmount: row.card.requiredAmount ?? 0,
    feeFreeType: row.card.feeFreeType ?? 'count'
  })
  dialogVisible.value = true
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const data = {
    bank: form.bank.trim(),
    cardName: form.cardName.trim(),
    cardNoTail: form.cardNoTail.trim(),
    cycleStartDate: form.cycleStartDate,
    annualFeeAmount: Number(form.annualFeeAmount),
    requiredTxCount: Number(form.requiredTxCount),
    // 仅组合方式保留金额要求，其余方式清零避免残留
    requiredAmount: form.feeFreeType === 'countAmount' ? Number(form.requiredAmount) : 0,
    feeFreeType: form.feeFreeType
  }
  if (editingId.value) {
    updateCard(editingId.value, data)
    ElMessage.success('已保存')
  } else {
    addCard(data)
    ElMessage.success('已添加')
  }
  dialogVisible.value = false
}

async function handleRemove(row: { card: Card }): Promise<void> {
  await ElMessageBox.confirm(
    `确定删除「${row.card.bank} ${row.card.cardName}」吗？其关联交易记录也会一并删除。`,
    '删除确认',
    { type: 'warning' }
  )
  removeCard(row.card.id)
  ElMessage.success('已删除')
}

// ---------- 快速记一笔 ----------
const txDialogVisible = ref(false)
const txForm = reactive({ cardId: '', amount: 0, date: '', description: '' })
const txCardLabel = ref('')

function openQuickTx(row: { card: Card }): void {
  txCardLabel.value = `${row.card.bank} ${row.card.cardName}`
  Object.assign(txForm, { cardId: row.card.id, amount: 0, date: today(), description: '' })
  txDialogVisible.value = true
}

function submitQuickTx(): void {
  if (!txForm.amount || txForm.amount <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  addTransaction({
    targetType: 'card',
    targetId: txForm.cardId,
    amount: Number(txForm.amount),
    date: txForm.date,
    description: txForm.description.trim() || '信用卡消费'
  })
  txDialogVisible.value = false
  ElMessage.success('已记录一笔')
}

// ---------- 历史交易明细 ----------
const detailDialogVisible = ref(false)
const detailCardId = ref('')

const detailCard = computed(() => state.cards.find((c) => c.id === detailCardId.value) ?? null)

/** 当前卡的交易明细（按日期倒序） */
const detailTransactions = computed(() =>
  detailCardId.value
    ? state.transactions
        .filter((t) => t.targetType === 'card' && t.targetId === detailCardId.value)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    : []
)

const detailTotalAmount = computed(() =>
  detailTransactions.value.reduce((sum, t) => sum + t.amount, 0)
)

function openDetail(row: { card: Card }): void {
  detailCardId.value = row.card.id
  detailDialogVisible.value = true
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">信用卡管理</h2>
      <el-button type="primary" @click="openCreate">添加信用卡</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="rows" style="width: 100%">
        <el-table-column label="银行 / 卡片" min-width="160">
          <template #default="{ row }">
            <div class="card-cell">
              <span class="card-bank">{{ row.card.bank }}</span>
              <span class="card-name">{{ row.card.cardName }}（{{ row.card.cardNoTail }}）</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="免年费进度" min-width="220">
          <template #default="{ row }">
            <template v-if="row.info.lifetime">
              <el-tag type="success" size="small">终身免年费</el-tag>
            </template>
            <template v-else-if="row.info.countAmount">
              <div class="dual-row">
                <span class="progress-text">
                  笔数：{{
                    row.info.requiredCount > 0
                      ? `${row.info.doneCount} / ${row.info.requiredCount} 笔`
                      : '无笔数要求'
                  }}
                </span>
                <el-progress
                  :percentage="calcPct(row.info.doneCount, row.info.requiredCount)"
                  :stroke="8"
                  :show-text="false"
                  :status="row.info.reached ? 'success' : undefined"
                />
              </div>
              <div class="dual-row">
                <span class="progress-text">
                  金额：{{
                    row.info.requiredAmount > 0
                      ? `¥${row.info.doneAmount} / ¥${row.info.requiredAmount}`
                      : '无金额要求'
                  }}
                </span>
                <el-progress
                  :percentage="calcPct(row.info.doneAmount, row.info.requiredAmount)"
                  :stroke="8"
                  :show-text="false"
                  :status="row.info.reached ? 'success' : undefined"
                />
              </div>
            </template>
            <template v-else>
              <el-progress
                :percentage="calcPct(row.info.doneCount, row.info.requiredCount)"
                :status="row.info.reached ? 'success' : undefined"
              />
              <span class="progress-text">
                {{
                  row.info.requiredCount > 0
                    ? `${row.info.doneCount} / ${row.info.requiredCount} 笔`
                    : '无笔数要求'
                }}
              </span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="周期到期日" width="120">
          <template #default="{ row }">
            {{ row.info.lifetime ? '—' : row.info.cycleEnd }}
          </template>
        </el-table-column>
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            {{ row.info.lifetime ? '—' : `${row.info.daysLeft} 天` }}
          </template>
        </el-table-column>
        <el-table-column label="年费" width="90">
          <template #default="{ row }"> ¥{{ row.card.annualFeeAmount }} </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.info.level === 'safe'" type="success">已达标</el-tag>
            <el-tag v-else-if="row.info.level === 'danger'" type="danger">即将到期</el-tag>
            <el-tag v-else type="info">进行中</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">明细</el-button>
            <el-button link type="primary" size="small" @click="openQuickTx(row)">记一笔</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="rows.length === 0" description="还没有信用卡，点击右上角添加" />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑信用卡' : '添加信用卡'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="银行名称" prop="bank">
          <el-input v-model="form.bank" placeholder="如：招商银行" />
        </el-form-item>
        <el-form-item label="卡片名称" prop="cardName">
          <el-input v-model="form.cardName" placeholder="如：YOUNG卡" />
        </el-form-item>
        <el-form-item label="卡号后4位" prop="cardNoTail">
          <el-input v-model="form.cardNoTail" maxlength="4" placeholder="如：1234" />
        </el-form-item>
        <el-form-item label="周期开始日期" prop="cycleStartDate">
          <el-date-picker
            v-model="form.cycleStartDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="年费周期起算日（通常为开卡日）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="年费金额" prop="annualFeeAmount">
          <el-input-number
            v-model="form.annualFeeAmount"
            :min="0"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="免年费方式">
          <el-radio-group v-model="form.feeFreeType">
            <el-radio value="count">按笔数</el-radio>
            <el-radio value="countAmount">笔数+金额</el-radio>
            <el-radio value="lifetime">终身免年费</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="form.feeFreeType !== 'lifetime'"
          label="免年费笔数"
          prop="requiredTxCount"
        >
          <el-input-number v-model="form.requiredTxCount" :min="0" :max="999" style="width: 100%" />
          <div class="form-tip">0 表示无笔数要求</div>
        </el-form-item>
        <el-form-item
          v-if="form.feeFreeType === 'countAmount'"
          label="免年费金额"
          prop="requiredAmount"
        >
          <el-input-number
            v-model="form.requiredAmount"
            :min="0"
            :precision="2"
            style="width: 100%"
          />
          <div class="form-tip">周期内累计消费满该金额且笔数达标，两者需同时满足</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="txDialogVisible" :title="`记一笔消费 - ${txCardLabel}`" width="420px">
      <el-form label-width="90px">
        <el-form-item label="金额">
          <el-input-number v-model="txForm.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="txForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="txForm.description" placeholder="如：超市购物（可留空）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="txDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickTx">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailDialogVisible"
      :title="`交易明细 - ${detailCard ? `${detailCard.bank} ${detailCard.cardName}` : ''}`"
      width="560px"
    >
      <div class="detail-summary">
        <span>共 {{ detailTransactions.length }} 笔</span>
        <span>合计 ¥{{ detailTotalAmount.toFixed(2) }}</span>
      </div>
      <el-table :data="detailTransactions" style="width: 100%" max-height="400">
        <el-table-column label="日期" prop="date" width="110" />
        <el-table-column label="金额" width="110">
          <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="备注" prop="description" min-width="160" />
      </el-table>
      <el-empty v-if="detailTransactions.length === 0" description="暂无交易记录" />
    </el-dialog>
  </div>
</template>

<style scoped>
.card-cell {
  display: flex;
  flex-direction: column;
}
.card-bank {
  font-weight: 600;
  color: #303133;
}
.card-name {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.progress-text {
  font-size: 12px;
  color: #909399;
}
.dual-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dual-row + .dual-row {
  margin-top: 6px;
}
.dual-row .progress-text {
  flex-shrink: 0;
}
.dual-row .el-progress {
  flex: 1;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 2px;
}
.detail-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
}
</style>
