<template>
  <div class="upload-page">
    <van-nav-bar title="票据识别" left-arrow @click-left="$router.back()" />
    
    <div class="upload-area">
      <van-uploader
        v-model="fileList"
        :max-count="5"
        accept="image/*"
        :after-read="handleUpload"
      >
        <div class="upload-box">
          <van-icon name="photograph" size="48" color="#667eea" />
          <div class="upload-text">点击上传票据图片</div>
          <div class="upload-tip">支持发票、收据、小票等</div>
        </div>
      </van-uploader>
    </div>
    
    <!-- 识别结果列表 -->
    <div class="result-list" v-if="results.length > 0">
      <div class="result-title">识别结果</div>
      <div class="result-item" v-for="(item, index) in results" :key="index">
        <div class="result-image">
          <img :src="item.image" @click="previewImage(item.image)" />
        </div>
        <div class="result-info">
          <div class="result-row">
            <span class="label">类型：</span>
            <span>{{ item.type }}</span>
          </div>
          <div class="result-row">
            <span class="label">金额：</span>
            <span class="amount">¥{{ item.amount }}</span>
          </div>
          <div class="result-row">
            <span class="label">日期：</span>
            <span>{{ item.date }}</span>
          </div>
          <div class="result-actions">
            <van-button size="small" type="primary" @click="confirmEntry(item, index)" :loading="item.loading">
              确认入账
            </van-button>
            <van-button size="small" @click="editItem(item, index)">
              修改
            </van-button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 使用说明 -->
    <div class="tips" v-if="results.length === 0">
      <div class="tips-title">💡 使用说明</div>
      <div class="tips-list">
        <p>1. 拍摄或选择票据图片</p>
        <p>2. AI 自动识别票据信息</p>
        <p>3. 确认后自动入账</p>
        <p>4. 原始票据妥善保存</p>
      </div>
    </div>
    
    <div style="height: 60px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { showImagePreview, showSuccessToast, showToast } from 'vant'
import { aiApi, transactionApi } from '@/api'

const fileList = ref<any[]>([])
const results = ref<any[]>([])

const handleUpload = async (file: any) => {
  file.status = 'uploading'
  
  try {
    const result = await aiApi.recognizeInvoice({ image: file.content })
    
    results.value.push({
      image: file.content,
      type: result.type || '增值税发票',
      amount: result.amount || 0,
      date: result.date || new Date().toISOString().split('T')[0],
      category: result.category || '办公费用',
      loading: false
    })
    
    file.status = 'done'
  } catch (e) {
    file.status = 'failed'
    showToast('识别失败')
  }
}

const confirmEntry = async (item: any, index: number) => {
  item.loading = true
  
  try {
    await transactionApi.create({
      transaction_type: 'expense',
      amount: item.amount,
      category: item.category,
      transaction_date: item.date,
      description: `${item.type} - AI识别入账`
    })
    
    showSuccessToast('入账成功！')
    results.value.splice(index, 1)
  } catch (e: any) {
    showToast(e.message || '入账失败')
  } finally {
    item.loading = false
  }
}

const editItem = (item: any, index: number) => {
  showToast('编辑功能开发中')
}

const previewImage = (url: string) => {
  showImagePreview([url])
}
</script>

<style scoped>
.upload-page {
  min-height: 100vh;
  background: #f5f6fa;
}

.upload-area {
  padding: 20px;
}

.upload-box {
  background: #fff;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  border: 2px dashed #ddd;
}

.upload-text {
  font-size: 16px;
  color: #333;
  margin-top: 12px;
}

.upload-tip {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

.result-list {
  padding: 0 16px;
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.result-item {
  display: flex;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
}

.result-image img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}

.result-info {
  flex: 1;
  margin-left: 12px;
}

.result-row {
  font-size: 13px;
  padding: 4px 0;
}

.result-row .label {
  color: #999;
}

.result-row .amount {
  color: #ee0a24;
  font-weight: 600;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.tips {
  padding: 20px 16px;
}

.tips-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.tips-list p {
  font-size: 13px;
  color: #666;
  line-height: 2;
}
</style>