<template>
  <div class="page">
    <van-nav-bar title="报表中心" left-arrow @click-left="$router.back()" />
    <div class="report-grid">
      <div class="report-card" @click="$router.push('/dashboard')">
        <div class="icon">📊</div>
        <div class="name">数据大屏</div>
        <div class="desc">收支趋势、费用构成</div>
      </div>
      <div class="report-card">
        <div class="icon">📈</div>
        <div class="name">收支报表</div>
        <div class="desc">月度/年度收支统计</div>
      </div>
      <div class="report-card">
        <div class="icon">📄</div>
        <div class="name">合同报表</div>
        <div class="desc">合同执行情况</div>
      </div>
      <div class="report-card">
        <div class="icon">💰</div>
        <div class="name">应收应付</div>
        <div class="desc">账龄分析报表</div>
      </div>
      <div class="report-card">
        <div class="icon">📋</div>
        <div class="name">费用报表</div>
        <div class="desc">费用分类统计</div>
      </div>
      <div class="report-card">
        <div class="icon">📉</div>
        <div class="name">现金流报表</div>
        <div class="desc">资金流入流出</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
</script>
<style scoped>
.page { background: #f5f7fa; min-height: 100vh; padding: 12px; }
.report-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.report-card { background: #fff; border-radius: 12px; padding: 16px; }
.report-card .icon { font-size: 32px; margin-bottom: 8px; }
.report-card .name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.report-card .desc { font-size: 12px; color: #999; }
</style>
