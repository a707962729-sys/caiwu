<template>
  <div class="login-container">
    <!-- 左侧装饰区域 -->
    <div class="login-left">
      <div class="decoration">
        <div class="logo-section">
          <div class="logo">
            <el-icon :size="48" color="#667eea"><Wallet /></el-icon>
          </div>
          <h1 class="title">财务管家</h1>
          <p class="subtitle">企业智能财务管理平台</p>
        </div>
        <div class="features">
          <div class="feature-item">
            <el-icon :size="24"><DataAnalysis /></el-icon>
            <span>智能财务分析</span>
          </div>
          <div class="feature-item">
            <el-icon :size="24"><Document /></el-icon>
            <span>票据智能识别</span>
          </div>
          <div class="feature-item">
            <el-icon :size="24"><TrendCharts /></el-icon>
            <span>实时数据报表</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录区域 -->
    <div class="login-right">
      <div class="login-card">
        <div class="card-header">
          <h2>账号登录</h2>
          <p>欢迎回来，请登录您的账号</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="User"
              clearable
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <div class="form-options">
            <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
            <el-checkbox v-model="autoLoginEnabled">自动登录</el-checkbox>
          </div>

          <el-form-item>
            <el-button
              type="primary"
              :loading="isLoading"
              class="login-btn"
              @click="handleLogin"
            >
              {{ isLoading ? '登录中...' : '登 录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <!-- 演示账号 -->
        <div class="demo-section">
          <div class="demo-title">快速体验</div>
          <div class="demo-accounts">
            <el-button
              v-for="account in demoAccounts"
              :key="account.username"
              @click="fillDemo(account.username, account.password)"
            >
              <span class="demo-icon">{{ account.icon }}</span>
              {{ account.role }}
            </el-button>
          </div>
        </div>

        <div class="card-footer">
          <p>© 2026 财务管家 · 让财务管理更简单</p>
        </div>
      </div>
    </div>

    <!-- 自动登录提示 -->
    <el-overlay v-show="showAutoLoginTip" class="auto-login-overlay">
      <div class="auto-login-loading">
        <el-icon class="is-loading" :size="32" color="#667eea"><Loading /></el-icon>
        <span>正在自动登录...</span>
      </div>
    </el-overlay>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSafeNavigate } from '@/composables/useNavigation'
import { ElMessage } from 'element-plus'
import { User, Lock, Wallet, DataAnalysis, Document, TrendCharts, Loading } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { TokenManager } from '@/utils/auth'

const router = useRouter()
const route = useRoute()
const { safeNavigate } = useSafeNavigate()
const userStore = useUserStore()

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const form = reactive({
  username: '',
  password: ''
})

// 验证规则
const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 4, message: '密码至少4位', trigger: 'blur' }
  ]
}

// 演示账号
const demoAccounts = [
  { username: 'admin', password: 'admin123', role: '管理员', icon: '👔' },
  { username: 'accountant', password: 'admin123', role: '会计', icon: '📊' },
  { username: 'employee', password: 'admin123', role: '员工', icon: '👤' }
]

// 状态
const isLoading = ref(false)
const rememberMe = ref(false)
const autoLoginEnabled = ref(false)
const showAutoLoginTip = ref(false)

/**
 * 填充演示账号
 */
function fillDemo(username: string, password: string) {
  form.username = username
  form.password = password
  rememberMe.value = true
}

/**
 * 处理登录
 */
async function handleLogin() {
  if (!formRef.value) return
  
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  
  isLoading.value = true
  
  try {
    await userStore.login(form.username, form.password, rememberMe.value)
    
    // 保存自动登录设置
    if (autoLoginEnabled.value) {
      localStorage.setItem('caiwu_auto_login', 'true')
    } else {
      localStorage.removeItem('caiwu_auto_login')
    }
    
    ElMessage.success('登录成功')
    
    // 跳转到目标页面或首页
    // 使用 router.replace 直接导航，避免 safeNavigate 的锁机制可能导致的阻塞
    const redirect = route.query.redirect as string
    const targetPath = redirect || '/dashboard'
    
    try {
      await router.replace(targetPath)
    } catch (error: any) {
      // 忽略重复导航错误
      if (error.name !== 'NavigationDuplicated' && error.name !== 'NavigationCancelled') {
        console.error('[Login] Navigation error:', error)
        ElMessage.error('页面跳转失败，请手动刷新')
      }
    }
  } catch (error: any) {
    // 根据错误类型显示不同的提示
    let errorMsg = '登录失败'
    
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          errorMsg = '用户名或密码错误'
          break
        case 403:
          errorMsg = '账号已被禁用'
          break
        case 429:
          errorMsg = '登录尝试过多，请稍后再试'
          break
        default:
          errorMsg = data?.message || `登录失败 (${status})`
      }
    } else if (error.message) {
      if (error.message.includes('Network')) {
        errorMsg = '网络错误，请检查网络连接'
      } else if (error.message.includes('timeout')) {
        errorMsg = '请求超时，请重试'
      } else {
        errorMsg = error.message
      }
    }
    
    ElMessage.error(errorMsg)
    
    // 清除密码
    if (!rememberMe.value) {
      form.password = ''
    }
  } finally {
    isLoading.value = false
  }
}

/**
 * 初始化 - 检查自动登录和恢复记住的用户
 */
onMounted(async () => {
  // 1. 检查是否已登录且 Token 有效
  if (TokenManager.isTokenValid() && userStore.isLoggedIn) {
    await router.replace('/dashboard').catch(() => {})
    return
  }
  
  // 2. 检查自动登录设置
  const autoLoginSetting = localStorage.getItem('caiwu_auto_login')
  if (autoLoginSetting === 'true' && userStore.hasRememberedUser()) {
    showAutoLoginTip.value = true
    try {
      const success = await userStore.autoLogin()
      if (success) {
        ElMessage.success('自动登录成功')
        const redirect = route.query.redirect as string
        await router.replace(redirect || '/dashboard').catch(() => {})
        return
      }
    } catch {
      // 自动登录失败，显示登录表单
    } finally {
      showAutoLoginTip.value = false
    }
  }
  
  // 3. 恢复记住的用户信息
  const rememberedUser = userStore.getRememberedUser()
  if (rememberedUser) {
    form.username = rememberedUser.username
    form.password = rememberedUser.password
    rememberMe.value = true
  }
})
</script>

<style lang="scss" scoped>
.login-container {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

// 左侧装饰区域
.login-left {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='1'/%3E%3C/svg%3E") repeat;
    animation: rotate 60s linear infinite;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.decoration {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff;
  padding: 40px;
}

.logo-section {
  margin-bottom: 60px;

  .logo {
    width: 100px;
    height: 100px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .title {
    font-size: 48px;
    font-weight: 700;
    margin: 0 0 16px;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .subtitle {
    font-size: 18px;
    opacity: 0.9;
    letter-spacing: 4px;
    margin: 0;
  }
}

.features {
  display: flex;
  flex-direction: column;
  gap: 24px;

  .feature-item {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.1);
    padding: 16px 24px;
    border-radius: 12px;
    backdrop-filter: blur(10px);
    transition: transform 0.3s;

    &:hover {
      transform: translateX(8px);
    }

    span {
      font-size: 16px;
    }
  }
}

// 右侧登录区域
.login-right {
  width: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.card-header {
  margin-bottom: 32px;
  text-align: center;

  h2 {
    font-size: 28px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 8px;
  }

  p {
    font-size: 14px;
    color: #666;
    margin: 0;
  }
}

.form-options {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
  }
}

// 演示账号
.demo-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.demo-title {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 16px;
}

.demo-accounts {
  display: flex;
  justify-content: center;
  gap: 12px;

  .el-button {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .demo-icon {
    font-size: 16px;
  }
}

.card-footer {
  margin-top: 32px;
  text-align: center;

  p {
    font-size: 12px;
    color: #999;
    margin: 0;
  }
}

// 自动登录遮罩
.auto-login-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}

.auto-login-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);

  span {
    color: #333;
    font-size: 14px;
  }
}

// 响应式
@media (max-width: 900px) {
  .login-left {
    display: none;
  }

  .login-right {
    width: 100%;
  }
}
</style>