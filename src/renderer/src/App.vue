<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Wallet,
  Monitor,
  CreditCard,
  List,
  DataAnalysis,
  Setting,
  FolderOpened
} from '@element-plus/icons-vue'
import { useData } from './store/data'

const route = useRoute()
const activeMenu = computed(() => route.path)
const { state, updateSettings, exportDataToFile, importDataFromFile, replaceAllData } = useData()

// ---------- 预警设置 ----------
const settingsVisible = ref(false)
const settingsForm = reactive({ cardRemindDays: 30, accountWarnDays: 120, accountDangerDays: 150 })

function openSettings(): void {
  Object.assign(settingsForm, state.settings)
  settingsVisible.value = true
}

function saveSettings(): void {
  if (settingsForm.accountWarnDays > settingsForm.accountDangerDays) {
    ElMessage.warning('账户预警天数不能大于非柜风险天数')
    return
  }
  updateSettings({ ...settingsForm })
  settingsVisible.value = false
  ElMessage.success('预警设置已保存')
}

// ---------- 数据备份（导出/导入） ----------
const backupVisible = ref(false)

// 导出全部数据到 JSON 文件，用于在其它电脑上导入
async function handleExport(): Promise<void> {
  const path = await exportDataToFile()
  if (path) {
    backupVisible.value = false
    ElMessage.success(`已导出到：${path}`)
  }
}

// 从 JSON 备份文件导入，确认后完全覆盖当前数据
async function handleImport(): Promise<void> {
  const data = await importDataFromFile()
  if (!data) return
  try {
    await ElMessageBox.confirm(
      `将导入 ${data.cards.length} 张信用卡、${data.accounts.length} 个账户、${data.transactions.length} 笔交易，并完全覆盖当前全部数据，此操作不可恢复。`,
      '确认导入',
      {
        type: 'warning',
        confirmButtonText: '覆盖导入',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return // 用户取消导入
  }
  const ok = await replaceAllData(data)
  backupVisible.value = false
  if (ok) {
    ElMessage.success('数据导入成功')
  } else {
    ElMessage.error('数据导入失败！无法写入数据文件，请检查磁盘权限后重试')
  }
}
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="200px" class="app-aside">
      <div class="app-logo">
        <el-icon :size="22"><Wallet /></el-icon>
        <span class="app-title">卡包管家</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#1d2530"
        text-color="#a3b1c4"
        active-text-color="#409eff"
        class="app-menu"
      >
        <el-menu-item index="/">
          <el-icon><Monitor /></el-icon>
          <span>看板首页</span>
        </el-menu-item>
        <el-menu-item index="/cards">
          <el-icon><CreditCard /></el-icon>
          <span>信用卡管理</span>
        </el-menu-item>
        <el-menu-item index="/accounts">
          <el-icon><Wallet /></el-icon>
          <span>银行账户</span>
        </el-menu-item>
        <el-menu-item index="/transactions">
          <el-icon><List /></el-icon>
          <span>交易记录</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <el-icon><DataAnalysis /></el-icon>
          <span>统计报表</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer">
        <el-button text class="settings-btn" @click="openSettings">
          <el-icon><Setting /></el-icon>
          <span>预警设置</span>
        </el-button>
        <el-button text class="settings-btn" @click="backupVisible = true">
          <el-icon><FolderOpened /></el-icon>
          <span>数据备份</span>
        </el-button>
      </div>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>

    <el-dialog v-model="settingsVisible" title="预警设置" width="460px">
      <el-form label-width="150px">
        <el-form-item label="信用卡到期提醒">
          <el-input-number
            v-model="settingsForm.cardRemindDays"
            :min="1"
            :max="365"
            style="width: 100%"
          />
          <div class="settings-tip">年费周期到期前 N 天开始提醒，默认 30 天</div>
        </el-form-item>
        <el-form-item label="账户无交易预警">
          <el-input-number
            v-model="settingsForm.accountWarnDays"
            :min="1"
            :max="365"
            style="width: 100%"
          />
          <div class="settings-tip">银行账户近 N 天无交易进入预警，默认 120 天</div>
        </el-form-item>
        <el-form-item label="账户非柜风险">
          <el-input-number
            v-model="settingsForm.accountDangerDays"
            :min="1"
            :max="365"
            style="width: 100%"
          />
          <div class="settings-tip">银行账户近 N 天无交易视为非柜风险，默认 150 天</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="backupVisible" title="数据备份" width="460px">
      <div class="backup-tip">
        在其它电脑上使用本应用时：先在旧电脑导出备份文件，通过 U
        盘或聊天工具传输后，再在新电脑上导入即可。
      </div>
      <div class="backup-actions">
        <el-button type="primary" @click="handleExport">导出到文件</el-button>
        <el-button type="danger" plain @click="handleImport">从文件导入</el-button>
      </div>
      <div class="backup-warning">导入会完全覆盖当前全部数据，请谨慎操作。</div>
    </el-dialog>
  </el-container>
</template>

<style scoped>
.aside-footer {
  padding: 12px 16px;
}
.settings-btn {
  color: #a3b1c4;
  width: 100%;
  justify-content: flex-start;
}
.settings-btn:hover {
  color: #409eff;
}
/* 覆盖 Element Plus 相邻按钮默认的 margin-left，保持纵向排列对齐 */
.settings-btn + .settings-btn {
  margin-left: 0;
  margin-top: 4px;
}
.backup-tip {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
.backup-actions {
  margin-top: 16px;
}
.backup-warning {
  margin-top: 12px;
  font-size: 12px;
  color: #f56c6c;
}
.settings-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 2px;
  width: 100%;
}
</style>
