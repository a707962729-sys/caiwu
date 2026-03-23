<template>
  <div class="not-found">
    <van-empty description="页面不存在" />
    <van-button type="primary" @click="$router.push('/')">返回首页</van-button>
  </div>
</template>
<script setup lang="ts">
</script>
<style scoped>
.not-found { padding: 50px 20px; text-align: center; }
</style>
