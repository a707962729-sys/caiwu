<template>
  <div class="login-page">
    <!-- 装饰性背景 -->
    <div class="bg-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
      <div class="wave"></div>
    </div>
    
    <!-- Logo 区域 -->
    <div class="login-header">
      <div class="logo-wrap">
        <div class="logo">
          <span class="logo-icon">💰</span>
        </div>
        <div class="logo-glow"></div>
      </div>
      <h1 class="title">财务管家</h1>
      <p class="subtitle">企业智能财务管理平台</p>
    </div>

    <!-- 登录卡片 -->
    <div class="login-card glass-effect">
      <van-form @submit="handleLogin">
        <div class="form-header">
          <span class="form-title">账号登录</span>
        </div>
        
        <div class="form-body">
          <div class="input-group" :class="{ 'has-error': errors.username }">
            <div class="input-icon">
              <van-icon name="user-o" />
            </div>
            <input 
              v-model="form.username"
              type="text" 
              placeholder="请输入用户名"
              class="input-field"
              @blur="validateField('username')"
              @input="errors.username = ''"
            />
          </div>
          <div v-if="errors.username" class="error-tip">{{ errors.username }}</div>
          
          <div class="input-group" :class="{ 'has-error': errors.password }">
            <div class="input-icon">
              <van-icon name="lock" />
            </div>
            <input 
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'" 
              placeholder="请输入密码"
              class="input-field"
              @blur="validateField('password')"
              @input="errors.password = ''"
              @keyup.enter="handleLogin"
            />
            <div class="input-action" @click="showPassword = !showPassword">
              <van-icon :name="showPassword ? 'eye-o' : 'closed-eye'" />
            </div>
          </div>
          <div v-if="errors.password" class="error-tip">{{ errors.password }}</div>
          
          <div class="form-options">
            <label class="remember-me">
              <input type="checkbox" v-model="rememberMe" />
              <span class="checkbox-custom"></span>
              <span>记住用户名</span>
            </label>
          </div>
        </div>
        
        <div class="form-actions">
          <button 
            type="submit" 
            class="login-btn"
            :class="{ loading: isLoading }"
            :disabled="isLoading"
          >
            <span v-if="!isLoading">登 录</span>
            <span v-else class="loading-text">
              <van-loading size="18" color="#fff" />
              <span>登录中...</span>
            </span>
          </button>
        </div>
      </van-form>
    </div>
    
    <!-- 底部 -->
    <div class="login-footer">
      <p>© 2026 财务管家 · 让财务管理更简单</p>
      <p class="version">v1.0.0</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { TokenManager, RememberMeManager } from '@/utils/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 表单数据
const form = reactive({
  username: '',
  password: ''
})

// 错误信息
const errors = reactive({
  username: '',
  password: ''
})

// 状态
const isLoading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)

/**
 * 表单验证
 */
function validateField(field: string): boolean {
  switch (field) {
    case 'username':
      if (!form.username.trim()) {
        errors.username = '请输入用户名'
        return false
      }
      errors.username = ''
      return true
    case 'password':
      if (!form.password) {
        errors.password = '请输入密码'
        return false
      }
      if (form.password.length < 4) {
        errors.password = '密码至少4位'
        return false
      }
      errors.password = ''
      return true
  }
  return true
}

function validateForm(): boolean {
  const usernameValid = validateField('username')
  const passwordValid = validateField('password')
  return usernameValid && passwordValid
}

/**
 * 填充演示账号
 */
function fillDemo(username: string, password: string) {
  form.username = username
  form.password = password
  errors.username = ''
  errors.password = ''
  rememberMe.value = true
}

/**
 * 处理登录
 */
async function handleLogin() {
  if (!validateForm()) {
    return
  }
  
  isLoading.value = true
  
  try {
    await userStore.login(form.username, form.password, rememberMe.value)
    
    showSuccessToast('登录成功')
    
    // 跳转到目标页面或首页
    const redirect = route.query.redirect as string
    router.replace(redirect || '/home')
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
    
    showFailToast(errorMsg)
    
    // 清除密码
    form.password = ''
  } finally {
    isLoading.value = false
  }
}

/**
 * 初始化 - 检查登录状态和恢复记住的用户名
 */
onMounted(async () => {
  // 1. 检查是否已登录且 Token 有效
  if (TokenManager.isTokenValid() && userStore.isLoggedIn) {
    router.replace('/home')
    return
  }
  
  // 2. 恢复记住的用户名
  const rememberedUsername = RememberMeManager.getUsername()
  if (rememberedUsername) {
    form.username = rememberedUsername
    rememberMe.value = true
  }
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 装饰性背景 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  right: -50px;
  animation: float 8s ease-in-out infinite;
}

.circle-2 {
  width: 200px;
  height: 200px;
  bottom: 20%;
  left: -50px;
  animation: float 6s ease-in-out infinite reverse;
}

.circle-3 {
  width: 150px;
  height: 150px;
  top: 40%;
  right: -30px;
  animation: float 7s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}

.wave {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 100'%3E%3Cpath fill='rgba(255,255,255,0.1)' d='M0,50 C360,100 1080,0 1440,50 L1440,100 L0,100 Z'/%3E%3C/svg%3E") no-repeat bottom;
  background-size: cover;
}

/* Logo 区域 */
.login-header {
  text-align: center;
  margin-bottom: 30px;
  position: relative;
  z-index: 1;
}

.logo-wrap {
  position: relative;
  display: inline-block;
}

.logo {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 2;
}

.logo-icon {
  font-size: 40px;
}

.logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  filter: blur(20px);
  z-index: 1;
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin: 20px 0 8px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  letter-spacing: 2px;
}

/* 登录卡片 */
.login-card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 32px 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
  backdrop-filter: blur(20px);
}

.glass-effect {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.form-header {
  text-align: center;
  margin-bottom: 24px;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.form-body {
  margin-bottom: 24px;
}

.input-group {
  display: flex;
  align-items: center;
  background: #f5f6fa;
  border-radius: 12px;
  padding: 0 16px;
  margin-bottom: 16px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.input-group:focus-within {
  border-color: #667eea;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.input-group.has-error {
  border-color: #ee0a24;
  background: #fff5f5;
}

.input-icon {
  color: #999;
  font-size: 18px;
  margin-right: 12px;
}

.input-field {
  flex: 1;
  border: none;
  background: transparent;
  padding: 16px 0;
  font-size: 15px;
  color: #333;
  outline: none;
}

.input-field::placeholder {
  color: #bbb;
}

.input-action {
  padding: 8px;
  color: #999;
  cursor: pointer;
}

.error-tip {
  color: #ee0a24;
  font-size: 12px;
  margin-top: -12px;
  margin-bottom: 12px;
  padding-left: 16px;
}

.form-options {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.remember-me input {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.remember-me input:checked + .checkbox-custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
}

.remember-me input:checked + .checkbox-custom::after {
  content: '✓';
  color: #fff;
  font-size: 12px;
  font-weight: bold;
}

.form-actions {
  margin-bottom: 0;
}

.login-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
}

.login-btn:active {
  transform: translateY(0);
}

.login-btn.loading {
  opacity: 0.8;
  pointer-events: none;
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 底部 */
.login-footer {
  text-align: center;
  margin-top: 30px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  position: relative;
  z-index: 1;
}

.login-footer p {
  margin: 4px 0;
}

.version {
  opacity: 0.6;
}
</style>