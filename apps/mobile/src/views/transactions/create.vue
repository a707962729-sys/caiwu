<template>
  <div class="create-page">
    <van-nav-bar title="记一笔" left-arrow @click-left="confirmBack">
      <template #right>
        <van-icon name="scan" size="20" @click="scanInvoice" class="scan-btn" />
      </template>
    </van-nav-bar>
    
    <!-- 类型切换 -->
    <div class="type-tabs">
      <div 
        class="tab ripple" 
        :class="{ active: form.type === 'expense' }" 
        @click="switchType('expense')"
      >
        <span>支出</span>
        <div class="tab-indicator" v-if="form.type === 'expense'"></div>
      </div>
      <div 
        class="tab ripple" 
        :class="{ active: form.type === 'income' }" 
        @click="switchType('income')"
      >
        <span>收入</span>
        <div class="tab-indicator" v-if="form.type === 'income'"></div>
      </div>
    </div>
    
    <!-- 分类选择 -->
    <div class="category-section">
      <div class="section-header">
        <span class="section-title">选择分类</span>
        <span class="section-more ripple" @click="showCategoryManager">管理</span>
      </div>
      <div class="category-grid">
        <div 
          class="category-item ripple" 
          v-for="(cat, index) in currentCategories" 
          :key="cat.name"
          :class="{ active: form.category === cat.name }"
          :style="{ animationDelay: index * 0.03 + 's' }"
          @click="selectCategory(cat.name)"
        >
          <div class="cat-icon-wrapper">
            <div class="cat-icon">
              {{ cat.icon }}
            </div>
            <div class="cat-ring" v-if="form.category === cat.name"></div>
            <div class="cat-glow" v-if="form.category === cat.name"></div>
          </div>
          <span>{{ cat.name }}</span>
          <div class="cat-check" v-if="form.category === cat.name">
            <van-icon name="success" />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 金额输入 -->
    <div class="amount-section">
      <div class="amount-label">金额</div>
      <div class="amount-input">
        <span class="currency">¥</span>
        <span class="amount-value" :class="{ 'bounce': amountBouncing }">
          <span v-for="(char, index) in amountChars" :key="index" class="amount-char" :style="{ animationDelay: index * 0.02 + 's' }">{{ char }}</span>
        </span>
      </div>
      <div class="amount-hint" v-if="!form.amount">请输入金额</div>
    </div>
    
    <!-- 数字键盘 -->
    <div class="numpad">
      <div class="numpad-row">
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '7' }" @click="inputNumber('7')" @touchstart="keyPressed = '7'" @touchend="keyPressed = ''">7</div>
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '8' }" @click="inputNumber('8')" @touchstart="keyPressed = '8'" @touchend="keyPressed = ''">8</div>
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '9' }" @click="inputNumber('9')" @touchstart="keyPressed = '9'" @touchend="keyPressed = ''">9</div>
        <div class="numpad-key action ripple" :class="{ 'press': keyPressed === 'back' }" @click="backspace" @touchstart="keyPressed = 'back'" @touchend="keyPressed = ''">
          <van-icon name="arrow-left" />
        </div>
      </div>
      <div class="numpad-row">
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '4' }" @click="inputNumber('4')" @touchstart="keyPressed = '4'" @touchend="keyPressed = ''">4</div>
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '5' }" @click="inputNumber('5')" @touchstart="keyPressed = '5'" @touchend="keyPressed = ''">5</div>
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '6' }" @click="inputNumber('6')" @touchstart="keyPressed = '6'" @touchend="keyPressed = ''">6</div>
        <div class="numpad-key action ripple" :class="{ 'press': keyPressed === 'clear' }" @click="clearAmount" @touchstart="keyPressed = 'clear'" @touchend="keyPressed = ''">C</div>
      </div>
      <div class="numpad-row">
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '1' }" @click="inputNumber('1')" @touchstart="keyPressed = '1'" @touchend="keyPressed = ''">1</div>
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '2' }" @click="inputNumber('2')" @touchstart="keyPressed = '2'" @touchend="keyPressed = ''">2</div>
        <div class="numpad-key ripple" :class="{ 'press': keyPressed === '3' }" @click="inputNumber('3')" @touchstart="keyPressed = '3'" @touchend="keyPressed = ''">3</div>
        <div class="numpad-key action ripple" :class="{ 'press': keyPressed === '.' }" @click="inputNumber('.')" @touchstart="keyPressed = '.'" @touchend="keyPressed = ''">.</div>
      </div>
      <div class="numpad-row">
        <div class="numpad-key wide ripple" :class="{ 'press': keyPressed === '0' }" @click="inputNumber('0')" @touchstart="keyPressed = '0'" @touchend="keyPressed = ''">0</div>
        <div class="numpad-key save ripple" :class="{ disabled: saving, 'press': keyPressed === 'save' }" @click="saveTransaction" @touchstart="keyPressed = 'save'" @touchend="keyPressed = ''">
          <van-loading v-if="saving" size="18" color="#fff" />
          <span v-else>保存</span>
          <div class="save-glow" v-if="!saving"></div>
        </div>
      </div>
    </div>
    
    <!-- 更多选项 -->
    <div class="options-section">
      <!-- 日期选择 -->
      <div class="option-item ripple" @click="showDatePicker = true">
        <div class="option-left">
          <span class="option-icon">📅</span>
          <span class="option-label">日期</span>
        </div>
        <div class="option-right">
          <span class="option-value">{{ form.date }}</span>
          <van-icon name="arrow" />
        </div>
      </div>
      
      <!-- 账户选择 -->
      <div class="option-item ripple" @click="showAccountPicker = true">
        <div class="option-left">
          <span class="option-icon">💳</span>
          <span class="option-label">账户</span>
        </div>
        <div class="option-right">
          <span class="option-value">{{ form.accountName || '默认账户' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>
      
      <!-- 备注 -->
      <div class="option-item ripple" @click="showRemarkInput">
        <div class="option-left">
          <span class="option-icon">📝</span>
          <span class="option-label">备注</span>
        </div>
        <div class="option-right">
          <span class="option-value">{{ form.description || '添加备注' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>
      
      <!-- 图片附件 -->
      <div class="option-item ripple" @click="chooseImage">
        <div class="option-left">
          <span class="option-icon">📷</span>
          <span class="option-label">图片</span>
        </div>
        <div class="option-right">
          <span class="option-value">{{ form.images.length > 0 ? `${form.images.length}张` : '添加图片' }}</span>
          <van-icon name="arrow" />
        </div>
      </div>
    </div>
    
    <!-- 图片预览 -->
    <div class="image-preview" v-if="form.images.length > 0">
      <div class="image-item fade-in" v-for="(img, idx) in form.images" :key="idx" :style="{ animationDelay: idx * 0.05 + 's' }">
        <img :src="img" alt="附件" />
        <div class="image-remove ripple" @click="removeImage(idx)">×</div>
      </div>
    </div>
    
    <!-- 日期选择器 -->
    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="selectedDate"
        title="选择日期"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
    
    <!-- 账户选择器 -->
    <van-action-sheet
      v-model:show="showAccountPicker"
      :actions="accountActions"
      cancel-text="取消"
      @select="onAccountSelect"
    />
    
    <!-- 备注输入 -->
    <van-dialog
      v-model:show="showRemarkDialog"
      title="添加备注"
      show-cancel-button
      @confirm="onRemarkConfirm"
    >
      <van-field
        v-model="remarkInput"
        placeholder="请输入备注内容"
        type="textarea"
        rows="3"
        autosize
      />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showSuccessToast, showToast, showLoadingToast } from 'vant'
import { transactionApi } from '@/api'

const router = useRouter()

const form = ref({
  type: 'expense',
  amount: '',
  category: '',
  date: new Date().toISOString().split('T')[0],
  account: '',
  accountName: '',
  description: '',
  images: [] as string[]
})

const saving = ref(false)
const showDatePicker = ref(false)
const showAccountPicker = ref(false)
const showRemarkDialog = ref(false)
const remarkInput = ref('')
const keyPressed = ref('')
const amountBouncing = ref(false)

const selectedDate = ref([
  new Date().getFullYear().toString(),
  (new Date().getMonth() + 1).toString().padStart(2, '0'),
  new Date().getDate().toString().padStart(2, '0')
])

const minDate = new Date(2020, 0, 1)
const maxDate = new Date(2030, 11, 31)

const expenseCategories = [
  { name: '餐饮', icon: '🍜' },
  { name: '交通', icon: '🚗' },
  { name: '购物', icon: '🛒' },
  { name: '办公', icon: '📋' },
  { name: '差旅', icon: '✈️' },
  { name: '工资', icon: '👥' },
  { name: '采购', icon: '📦' },
  { name: '房租', icon: '🏢' },
  { name: '其他', icon: '📌' }
]

const incomeCategories = [
  { name: '销售收入', icon: '💵' },
  { name: '服务收入', icon: '💼' },
  { name: '利息', icon: '🏦' },
  { name: '投资', icon: '📈' },
  { name: '其他收入', icon: '📌' }
]

const accounts = [
  { id: '1', name: '招商银行', type: 'bank' },
  { id: '2', name: '支付宝', type: 'alipay' },
  { id: '3', name: '现金', type: 'cash' }
]

const currentCategories = computed(() => {
  return form.value.type === 'expense' ? expenseCategories : incomeCategories
})

const accountActions = computed(() => 
  accounts.map(acc => ({ name: acc.name, value: acc.id }))
)

// 金额字符数组，用于逐字动画
const amountChars = computed(() => {
  return (form.value.amount || '0.00').split('')
})

// 切换类型
const switchType = (type: string) => {
  form.value.type = type
  form.value.category = '' // 清空已选分类
}

// 选择分类
const selectCategory = (name: string) => {
  form.value.category = name
}

// 输入数字
const inputNumber = (num: string) => {
  // 触发金额动画
  amountBouncing.value = true
  setTimeout(() => amountBouncing.value = false, 100)
  
  if (num === '.' && form.value.amount.includes('.')) return
  if (form.value.amount.includes('.') && form.value.amount.split('.')[1]?.length >= 2) return
  if (form.value.amount === '0' && num !== '.') {
    form.value.amount = num
  } else {
    form.value.amount += num
  }
}

const backspace = () => {
  form.value.amount = form.value.amount.slice(0, -1)
}

const clearAmount = () => {
  form.value.amount = ''
}

const onDateConfirm = ({ selectedValues }: any) => {
  form.value.date = selectedValues.join('-')
  showDatePicker.value = false
}

const onAccountSelect = (action: any) => {
  form.value.account = action.value
  form.value.accountName = action.name
}

const showRemarkInput = () => {
  remarkInput.value = form.value.description
  showRemarkDialog.value = true
}

const onRemarkConfirm = () => {
  form.value.description = remarkInput.value
}

const chooseImage = () => {
  // 模拟选择图片
  showToast('图片上传功能开发中')
}

const removeImage = (idx: number) => {
  form.value.images.splice(idx, 1)
}

const scanInvoice = () => {
  showToast('发票扫描功能开发中')
}

const showCategoryManager = () => {
  showToast('分类管理功能开发中')
}

const saveTransaction = async () => {
  if (saving.value) return
  
  if (!form.value.amount || parseFloat(form.value.amount) <= 0) {
    showToast('请输入金额')
    return
  }
  if (!form.value.category) {
    showToast('请选择分类')
    return
  }
  
  saving.value = true
  const toast = showLoadingToast({
    message: '保存中...',
    forbidClick: true,
    duration: 0
  })
  
  try {
    await transactionApi.create({
      transaction_type: form.value.type,
      amount: parseFloat(form.value.amount),
      category: form.value.category,
      transaction_date: form.value.date,
      description: form.value.description,
      account_id: form.value.account || undefined
    })
    
    showSuccessToast('保存成功')
    router.back()
  } catch (e: any) {
    showToast(e.message || '保存失败')
  } finally {
    saving.value = false
    toast.clear()
  }
}

const confirmBack = () => {
  if (form.value.amount || form.value.category || form.value.description) {
    showConfirmDialog({
      title: '提示',
      message: '当前内容未保存，确定要返回吗？',
    })
      .then(() => router.back())
      .catch(() => {})
  } else {
    router.back()
  }
}
</script>

<style scoped>
.create-page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.scan-btn {
  transition: transform 0.2s ease;
}

.scan-btn:active {
  transform: scale(0.9);
}

/* 类型切换 */
.type-tabs {
  display: flex;
  background: #fff;
  padding: 12px 20px;
  gap: 12px;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  border-radius: 20px;
  font-size: 14px;
  color: #666;
  background: #f5f6fa;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.tab:active {
  transform: scale(0.98);
}

.tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 3px;
  background: #fff;
  border-radius: 2px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    width: 0;
    opacity: 0;
  }
  to {
    width: 30px;
    opacity: 1;
  }
}

/* 分类 */
.category-section {
  background: #fff;
  padding: 16px 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.section-title {
  font-size: 13px;
  color: #999;
}

.section-more {
  font-size: 12px;
  color: #667eea;
  padding: 4px 8px;
  border-radius: 8px;
}

.section-more:active {
  background: #f5f6fa;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  position: relative;
  transition: all 0.3s ease;
}

.category-item:active {
  transform: scale(0.95);
}

.cat-icon-wrapper {
  position: relative;
  width: 44px;
  height: 44px;
}

.cat-icon {
  width: 44px;
  height: 44px;
  background: #f5f6fa;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.category-item.active .cat-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.cat-ring {
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 2px solid #667eea;
  border-radius: 15px;
  animation: ringPulse 0.5s ease-out;
}

@keyframes ringPulse {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.cat-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  animation: glowPulse 1s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
}

.category-item span {
  font-size: 12px;
  color: #666;
  margin-top: 6px;
  transition: all 0.3s ease;
}

.category-item.active span {
  color: #667eea;
  font-weight: 500;
}

.cat-check {
  position: absolute;
  top: -2px;
  right: 0;
  width: 16px;
  height: 16px;
  background: #07c160;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  animation: checkPop 0.3s ease-out;
  box-shadow: 0 2px 4px rgba(7, 193, 96, 0.3);
}

@keyframes checkPop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* 金额 */
.amount-section {
  background: #fff;
  margin-top: 12px;
  padding: 20px;
  position: relative;
}

.amount-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.amount-input {
  display: flex;
  align-items: baseline;
}

.currency {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-right: 4px;
  transition: all 0.2s ease;
}

.amount-value {
  font-size: 36px;
  font-weight: 700;
  color: #333;
  transition: transform 0.1s ease;
}

.amount-value.bounce {
  animation: amountBounce 0.1s ease;
}

@keyframes amountBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.amount-char {
  display: inline-block;
  animation: charFadeIn 0.15s ease-out forwards;
}

@keyframes charFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.amount-hint {
  position: absolute;
  left: 20px;
  bottom: 8px;
  font-size: 12px;
  color: #ccc;
}

/* 数字键盘 */
.numpad {
  background: #fff;
  margin-top: auto;
  padding: 8px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}

.numpad-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.numpad-key {
  flex: 1;
  height: 52px;
  background: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 500;
  color: #333;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.numpad-key:active {
  background: #e8e8e8;
}

.numpad-key.press {
  transform: scale(0.95);
  background: #e0e0e0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.numpad-key::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.numpad-key:active::after {
  width: 150%;
  height: 150%;
}

.numpad-key.action {
  background: linear-gradient(180deg, #f0f0f0 0%, #e8e8e8 100%);
  color: #667eea;
  font-size: 20px;
  font-weight: 600;
}

.numpad-key.wide {
  flex: 2;
}

.numpad-key.save {
  flex: 2;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.numpad-key.save:active {
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.numpad-key.save.disabled {
  opacity: 0.7;
}

.save-glow {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: saveGlow 2s ease-in-out infinite;
}

@keyframes saveGlow {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

/* 更多选项 */
.options-section {
  background: #fff;
  margin-top: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s ease;
}

.option-item:last-child {
  border-bottom: none;
}

.option-item:active {
  background: #fafafa;
}

.option-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.option-icon {
  font-size: 18px;
}

.option-label {
  font-size: 14px;
  color: #333;
}

.option-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.option-value {
  font-size: 14px;
  color: #999;
}

/* 图片预览 */
.image-preview {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  overflow-x: auto;
}

.image-item {
  position: relative;
  flex-shrink: 0;
}

.image-item img {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  background: linear-gradient(135deg, #ff6b6b, #ee0a24);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  box-shadow: 0 2px 6px rgba(238, 10, 36, 0.3);
}

.image-remove:active {
  transform: scale(0.9);
}

/* 涟漪效果 */
.ripple {
  position: relative;
  overflow: hidden;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.ripple:active::after {
  width: 200%;
  height: 200%;
}

/* 淡入动画 */
.fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>