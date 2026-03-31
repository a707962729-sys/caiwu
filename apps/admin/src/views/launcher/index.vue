<template>
  <div class="launcher-page">
    <el-card class="launcher-card">
      <template #header>
        <div class="card-header">
          <el-icon size="20"><Setting /></el-icon>
          <span>财务管家 - 服务管理器</span>
        </div>
      </template>

      <!-- 服务状态列表 -->
      <div class="services-list">
        <div v-for="service in services" :key="service.port" class="service-item">
          <div class="service-info">
            <span class="service-status-dot" :class="service.status"></span>
            <span class="service-name">{{ service.name }}</span>
            <span class="service-port">({{ service.port }})</span>
          </div>
          <div class="service-actions">
            <el-tag v-if="service.status === 'running'" type="success" size="small">运行中</el-tag>
            <el-tag v-else-if="service.status === 'error'" type="danger" size="small">异常</el-tag>
            <el-tag v-else type="info" size="small">已停止</el-tag>
            <el-button
              size="small"
              :type="service.status === 'running' ? 'danger' : 'primary'"
              :loading="service.loading"
              @click="toggleService(service)"
              style="margin-left: 8px"
            >
              {{ service.status === 'running' ? '停止' : '启动' }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 批量操作 -->
      <div class="batch-actions">
        <el-button type="success" :loading="allStarting" @click="startAll">
          <el-icon><VideoPlay /></el-icon> 启动全部服务
        </el-button>
        <el-button type="danger" :loading="allStopping" @click="stopAll">
          <el-icon><VideoPause /></el-icon> 停止全部服务
        </el-button>
        <el-button @click="checkAllStatus">
          <el-icon><Refresh /></el-icon> 刷新状态
        </el-button>
      </div>

      <!-- 日志输出 -->
      <div class="log-section">
        <div class="log-header">
          <span>日志输出</span>
          <el-button size="small" text @click="clearLogs">
            <el-icon><Delete /></el-icon> 清空
          </el-button>
        </div>
        <div class="log-output" ref="logContainer">
          <div v-for="(log, index) in logs" :key="index" class="log-line" :class="log.type">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-msg">{{ log.msg }}</span>
          </div>
          <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay, VideoPause, Refresh, Delete, Setting } from '@element-plus/icons-vue'

const logContainer = ref(null)
const logs = ref([])
const allStarting = ref(false)
const allStopping = ref(false)

const services = ref([
  { name: '主API服务', port: 3000, status: 'stopped', loading: false, key: 'api' },
  { name: 'AI服务', port: 3001, status: 'stopped', loading: false, key: 'ai' },
  { name: '前端服务', port: 5174, status: 'stopped', loading: false, key: 'frontend' }
])

function addLog(msg, type = 'info') {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  logs.value.push({ time, msg, type })
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

function clearLogs() {
  logs.value = []
}

async function checkPort(port) {
  try {
    const res = await fetch(`http://localhost:${port}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    })
    return true
  } catch {
    // no-cors mode always "succeeds" even if server is down, so we check differently
    return await checkPortTCP(port)
  }
}

async function checkPortTCP(port) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    xhr.open('GET', `http://localhost:${port}/health`, true)
    xhr.onload = () => resolve(true)
    xhr.onerror = () => resolve(false)
    xhr.ontimeout = () => resolve(false)
    xhr.send()
  })
}

async function checkAllStatus() {
  addLog('正在检查所有服务状态...', 'info')
  for (const svc of services.value) {
    const ok = await checkPortTCP(svc.port)
    svc.status = ok ? 'running' : 'stopped'
  }
  addLog('状态检查完成', 'success')
}

async function toggleService(service) {
  if (service.status === 'running') {
    await stopService(service)
  } else {
    await startService(service)
  }
}

async function startService(service) {
  service.loading = true
  addLog(`正在启动 ${service.name}...`, 'info')
  try {
    const res = await fetch('/api/launcher/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: service.key, port: service.port })
    })
    const data = await res.json()
    if (data.success) {
      addLog(`${service.name} 启动命令已发送`, 'success')
      // 轮询等待服务就绪
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const ok = await checkPortTCP(service.port)
        if (ok) {
          service.status = 'running'
          addLog(`${service.name} 已就绪 (端口 ${service.port})`, 'success')
          break
        }
      }
    } else {
      addLog(`启动失败: ${data.error || '未知错误'}`, 'error')
      service.status = 'error'
    }
  } catch (e) {
    addLog(`启动异常: ${e.message}`, 'error')
    service.status = 'error'
  }
  service.loading = false
}

async function stopService(service) {
  service.loading = true
  addLog(`正在停止 ${service.name}...`, 'info')
  try {
    const res = await fetch('/api/launcher/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: service.key, port: service.port })
    })
    const data = await res.json()
    if (data.success) {
      addLog(`${service.name} 停止命令已发送`, 'success')
      await new Promise(r => setTimeout(r, 2000))
      const ok = await checkPortTCP(service.port)
      service.status = ok ? 'error' : 'stopped'
      if (!ok) {
        addLog(`${service.name} 已停止`, 'success')
      }
    } else {
      addLog(`停止失败: ${data.error || '未知错误'}`, 'error')
    }
  } catch (e) {
    addLog(`停止异常: ${e.message}`, 'error')
  }
  service.loading = false
}

async function startAll() {
  allStarting.value = true
  addLog('正在按顺序启动全部服务...', 'info')
  // 先启动API，再启动AI，最后启动前端
  for (const svc of services.value) {
    if (svc.status !== 'running') {
      await startService(svc)
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  allStarting.value = false
  addLog('全部服务启动流程完成', 'success')
}

async function stopAll() {
  allStopping.value = true
  addLog('正在停止全部服务...', 'info')
  // 倒序停止
  for (const svc of [...services.value].reverse()) {
    if (svc.status === 'running') {
      await stopService(svc)
      await new Promise(r => setTimeout(r, 500))
    }
  }
  allStopping.value = false
  addLog('全部服务已停止', 'success')
}

onMounted(() => {
  checkAllStatus()
})
</script>

<style scoped>
.launcher-page {
  padding: 20px;
}

.launcher-card {
  max-width: 700px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.services-list {
  margin-bottom: 20px;
}

.service-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid #f0f0f0;
}

.service-item:last-child {
  border-bottom: none;
}

.service-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ccc;
}

.service-status-dot.running {
  background: #67c23a;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.service-status-dot.error {
  background: #f56c6c;
}

.service-status-dot.stopped {
  background: #ccc;
}

.service-name {
  font-weight: 500;
}

.service-port {
  color: #888;
  font-size: 13px;
}

.service-actions {
  display: flex;
  align-items: center;
}

.batch-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.log-section {
  border: 1px solid #e4e4e4;
  border-radius: 6px;
  overflow: hidden;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  font-size: 13px;
  font-weight: 500;
}

.log-output {
  height: 200px;
  overflow-y: auto;
  background: #1e1e1e;
  padding: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-line {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}

.log-time {
  color: #888;
  flex-shrink: 0;
}

.log-msg {
  color: #d4d4d4;
  word-break: break-all;
}

.log-line.success .log-msg { color: #67c23a; }
.log-line.error .log-msg { color: #f56c6c; }
.log-line.info .log-msg { color: #909399; }

.log-empty {
  color: #555;
  text-align: center;
  padding-top: 60px;
}
</style>
