<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useData } from '../store/data'
import { getAccountRiskInfo, today } from '../utils/card'
import type { Account } from '../types'

const { state, addAccount, updateAccount, removeAccount, addTransaction } = useData()

const rows = computed(() =>
  state.accounts.map((account) => ({
    account,
    info: getAccountRiskInfo(
      account,
      state.settings.accountWarnDays,
      state.settings.accountDangerDays
    )
  }))
)

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  bank: '',
  accountName: '',
  accountType: 'II' as 'II' | 'III',
  accountNoTail: '',
  openedAt: '',
  lastTxDate: ''
})

const rules = {
  bank: [{ required: true, message: '请输入银行名称', trigger: 'blur' }],
  accountName: [{ required: true, message: '请输入账户备注名', trigger: 'blur' }],
  accountNoTail: [
    { required: true, message: '请输入账号后4位', trigger: 'blur' },
    { pattern: /^\d{4}$/, message: '仅支持4位数字', trigger: 'blur' }
  ],
  openedAt: [{ required: true, message: '请选择开户日期', trigger: 'change' }]
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    bank: '',
    accountName: '',
    accountType: 'II',
    accountNoTail: '',
    openedAt: today(),
    lastTxDate: ''
  })
  dialogVisible.value = true
}

function openEdit(row: { account: Account }): void {
  editingId.value = row.account.id
  Object.assign(form, {
    bank: row.account.bank,
    accountName: row.account.accountName,
    accountType: row.account.accountType,
    accountNoTail: row.account.accountNoTail,
    openedAt: row.account.openedAt,
    lastTxDate: row.account.lastTxDate ?? ''
  })
  dialogVisible.value = true
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const data = {
    bank: form.bank.trim(),
    accountName: form.accountName.trim(),
    accountType: form.accountType,
    accountNoTail: form.accountNoTail.trim(),
    openedAt: form.openedAt,
    lastTxDate: form.lastTxDate || null
  }
  if (editingId.value) {
    updateAccount(editingId.value, data)
    ElMessage.success('已保存')
  } else {
    addAccount(data)
    ElMessage.success('已添加')
  }
  dialogVisible.value = false
}

async function handleRemove(row: { account: Account }): Promise<void> {
  await ElMessageBox.confirm(
    `确定删除「${row.account.bank} ${row.account.accountName}」吗？其关联交易记录也会一并删除。`,
    '删除确认',
    { type: 'warning' }
  )
  removeAccount(row.account.id)
  ElMessage.success('已删除')
}

// ---------- 记一笔动账 ----------
const txDialogVisible = ref(false)
const txForm = reactive({ accountId: '', amount: 0, date: '', description: '' })
const txAccountLabel = ref('')

function openTx(row: { account: Account }): void {
  txAccountLabel.value = `${row.account.bank} ${row.account.accountName}`
  Object.assign(txForm, { accountId: row.account.id, amount: 0, date: today(), description: '' })
  txDialogVisible.value = true
}

function submitTx(): void {
  if (!txForm.amount || txForm.amount <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  addTransaction({
    targetType: 'account',
    targetId: txForm.accountId,
    amount: Number(txForm.amount),
    date: txForm.date,
    description: txForm.description.trim() || '账户动账'
  })
  txDialogVisible.value = false
  ElMessage.success('已记录一笔')
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">银行电子账户</h2>
      <el-button type="primary" @click="openCreate">添加账户</el-button>
    </div>

    <el-card shadow="never">
      <el-alert
        :title="`银行规则：连续 ${state.settings.accountDangerDays} 天（约6个月）无交易会被非柜，请保持动账频率`"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-table :data="rows" style="width: 100%">
        <el-table-column label="银行 / 账户" min-width="170">
          <template #default="{ row }">
            <div class="card-cell">
              <span class="card-bank">{{ row.account.bank }}</span>
              <span class="card-name">
                {{ row.account.accountName }}（{{ row.account.accountNoTail }}）
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.account.accountType === 'II' ? 'primary' : 'warning'">
              {{ row.account.accountType === 'II' ? '二类户' : '三类户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开户日期" width="110">
          <template #default="{ row }">{{ row.account.openedAt }}</template>
        </el-table-column>
        <el-table-column label="最近交易" width="110">
          <template #default="{ row }">{{ row.account.lastTxDate ?? '从未交易' }}</template>
        </el-table-column>
        <el-table-column label="无交易天数" width="110">
          <template #default="{ row }">{{ row.info.daysSince }} 天</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.info.level === 'danger'" type="danger">非柜风险</el-tag>
            <el-tag v-else-if="row.info.level === 'warn'" type="warning">临近风险</el-tag>
            <el-tag v-else type="success">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openTx(row)">记一笔</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="rows.length === 0" description="还没有账户，点击右上角添加" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账户' : '添加账户'" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="银行名称" prop="bank">
          <el-input v-model="form.bank" placeholder="如：工商银行" />
        </el-form-item>
        <el-form-item label="账户备注名" prop="accountName">
          <el-input v-model="form.accountName" placeholder="如：零钱宝电子户" />
        </el-form-item>
        <el-form-item label="账户类型">
          <el-radio-group v-model="form.accountType">
            <el-radio value="II">二类户</el-radio>
            <el-radio value="III">三类户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="账号后4位" prop="accountNoTail">
          <el-input v-model="form.accountNoTail" maxlength="4" placeholder="如：5678" />
        </el-form-item>
        <el-form-item label="开户日期" prop="openedAt">
          <el-date-picker
            v-model="form.openedAt"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="最近交易日期">
          <el-date-picker
            v-model="form.lastTxDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可留空，留空则按开户日计算"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="txDialogVisible" :title="`记一笔动账 - ${txAccountLabel}`" width="420px">
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
          <el-input v-model="txForm.description" placeholder="如：转出1元保活跃（可留空）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="txDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTx">保存</el-button>
      </template>
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
</style>
