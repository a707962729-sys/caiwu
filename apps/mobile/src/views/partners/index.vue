<template>
  <div class="page">
    <van-nav-bar title="合作伙伴">
      <template #right><van-icon name="plus" size="20" /></template>
    </van-nav-bar>
    <van-search v-model="search" placeholder="搜索客户/供应商" />
    <van-tabs v-model:active="activeTab">
      <van-tab title="全部" />
      <van-tab title="客户" />
      <van-tab title="供应商" />
    </van-tabs>
    <div class="partner-list">
      <div class="partner-card" v-for="item in list" :key="item.id">
        <div class="avatar">{{ item.name.charAt(0) }}</div>
        <div class="info">
          <div class="name">{{ item.name }}</div>
          <div class="type">{{ item.type === 'customer' ? '客户' : item.type === 'supplier' ? '供应商' : '客户&供应商' }}</div>
          <div class="contact">{{ item.contact_person }} · {{ item.phone }}</div>
        </div>
        <van-icon name="arrow" color="#999" />
      </div>
    </div>
    <van-empty v-if="list.length === 0" description="暂无合作伙伴" />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { partnerApi } from '@/api'
const search = ref('')
const activeTab = ref(0)
const list = ref<any[]>([])

onMounted(async () => {
  try { list.value = (await partnerApi.getList()).list || [] } catch (e) {}
})
</script>
<style scoped>
.page { background: #f5f7fa; min-height: 100vh; }
.partner-list { padding: 12px; }
.partner-card { display: flex; align-items: center; background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.avatar { width: 44px; height: 44px; border-radius: 8px; background: linear-gradient(135deg, #1989fa, #4facfe); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; margin-right: 12px; }
.info { flex: 1; }
.info .name { font-size: 15px; font-weight: 500; }
.info .type { font-size: 12px; color: #1989fa; margin-top: 2px; }
.info .contact { font-size: 12px; color: #999; margin-top: 4px; }
</style>
