<template>
  <div class="password">
    <van-nav-bar title="修改密码" left-arrow @click-left="$router.back()" />
    <van-form>
      <van-field label="原密码" type="password" placeholder="请输入原密码" />
      <van-field label="新密码" type="password" placeholder="请输入新密码" />
      <van-field label="确认密码" type="password" placeholder="请确认新密码" />
      <div style="padding: 16px;">
        <van-button type="primary" block>确认修改</van-button>
      </div>
    </van-form>
  </div>
</template>
<script setup lang="ts">
</script>
