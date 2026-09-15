<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Wallet, Monitor, CreditCard, List, DataAnalysis, Setting } from '@element-plus/icons-vue'
import { useData } from './store/data'

const route = useRoute()
const activeMenu = computed(() => route.path)
const { state, updateSettings } = useData()

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
.settings-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 2px;
  width: 100%;
}
</style>
