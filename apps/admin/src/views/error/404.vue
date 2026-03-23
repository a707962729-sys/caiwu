<template>
  <div class="error-page">
    <div class="error-content">
      <h1>404</h1>
      <h2>页面不存在</h2>
      <p>抱歉，您访问的页面不存在</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/dashboard')
}
</script>

<style lang="scss" scoped>
.error-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.error-content {
  text-align: center;
  
  h1 {
    font-size: 120px;
    font-weight: 700;
    color: #667eea;
    margin: 0;
    line-height: 1;
  }
  
  h2 {
    font-size: 24px;
    color: #1a1a2e;
    margin: 20px 0 10px;
  }
  
  p {
    color: #909399;
    margin-bottom: 30px;
  }
}
</style>