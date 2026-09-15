<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useData, getTargetName } from '../store/data'
import { today } from '../utils/card'

const { state, addTransaction, removeTransaction } = useData()

const filterTarget = ref('')
const targetOptions = computed(() => [
  ...state.cards.map((c) => ({ value: `card:${c.id}`, label: `信用卡 - ${c.bank} ${c.cardName}` })),
  ...state.accounts.map((a) => ({
    value: `account:${a.id}`,
    label: `账户 - ${a.bank} ${a.accountName}`
  }))
])

const rows = computed(() => {
  let list = [...state.transactions]
  if (filterTarget.value) {
    const [type, id] = filterTarget.value.split(':')
    list = list.filter((t) => t.targetType === type && t.targetId === id)
  }
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
})

const dialogVisible = ref(false)
const form = reactive({
  targetType: 'card' as 'card' | 'account',
  targetId: '',
  amount: 0,
  date: '',
  description: ''
})

const targetList = computed(() =>
  form.targetType === 'card'
    ? state.cards.map((c) => ({
        value: c.id,
        label: `${c.bank} ${c.cardName}（${c.cardNoTail}）`
      }))
    : state.accounts.map((a) => ({
        value: a.id,
        label: `${a.bank} ${a.accountName}（${a.accountNoTail}）`
      }))
)

function openCreate(): void {
  Object.assign(form, {
    targetType: 'card',
    targetId: '',
    amount: 0,
    date: today(),
    description: ''
  })
  dialogVisible.value = true
}

function onTypeChange(): void {
  form.targetId = ''
}

function submitForm(): void {
  if (!form.targetId) {
    ElMessage.warning(form.targetType === 'card' ? '请选择信用卡' : '请选择账户')
    return
  }
  if (!form.amount || form.amount <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  if (!form.date) {
    ElMessage.warning('请选择交易日期')
    return
  }
  addTransaction({
    targetType: form.targetType,
    targetId: form.targetId,
    amount: Number(form.amount),
    date: form.date,
    description: form.description.trim() || (form.targetType === 'card' ? '信用卡消费' : '账户动账')
  })
  dialogVisible.value = false
  ElMessage.success('已记录')
}

async function handleRemove(row: { id: string }): Promise<void> {
  await ElMessageBox.confirm('确定删除这条交易记录吗？', '删除确认', { type: 'warning' })
  removeTransaction(row.id)
  ElMessage.success('已删除')
}

function targetTypeLabel(type: 'card' | 'account'): string {
  return type === 'card' ? '信用卡' : '账户'
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">交易记录</h2>
      <el-button type="primary" @click="openCreate">记一笔</el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-select
          v-model="filterTarget"
          placeholder="输入名称搜索（全部）"
          clearable
          filterable
          style="width: 280px"
        >
          <el-option
            v-for="opt in targetOptions"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          />
        </el-select>
        <span class="filter-summary">共 {{ rows.length }} 条</span>
      </div>
      <el-table :data="rows" style="width: 100%">
        <el-table-column label="日期" prop="date" width="120" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.targetType === 'card' ? 'primary' : 'success'">
              {{ targetTypeLabel(row.targetType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对象" min-width="180">
          <template #default="{ row }">
            {{ getTargetName(row.targetType, row.targetId) }}
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="备注" prop="description" min-width="140" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="rows.length === 0" description="暂无交易记录" />
    </el-card>

    <el-dialog v-model="dialogVisible" title="记一笔交易" width="460px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.targetType" @change="onTypeChange">
            <el-radio value="card">信用卡刷卡</el-radio>
            <el-radio value="account">账户动账</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="对象">
          <el-select v-model="form.targetId" placeholder="请选择" style="width: 100%">
            <el-option
              v-for="opt in targetList"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="form.date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.description" placeholder="可留空" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.filter-summary {
  font-size: 13px;
  color: #909399;
}
</style>
