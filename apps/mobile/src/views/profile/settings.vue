<template>
  <div class="settings">
    <van-nav-bar title="设置" left-arrow @click-left="$router.back()" />
    <van-cell-group>
      <van-cell title="通知设置" is-link />
      <van-cell title="隐私设置" is-link />
      <van-cell title="关于我们" is-link />
    </van-cell-group>
  </div>
</template>
<script setup lang="ts">
</script>
