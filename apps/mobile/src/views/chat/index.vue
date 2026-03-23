<template>
  <div class="chat-page">
    <!-- 顶部导航 -->
    <div class="chat-header">
      <van-nav-bar :title="agent.name" left-arrow @click-left="$router.back()">
        <template #right>
          <van-icon name="delete-o" size="20" @click="clearHistory" />
        </template>
      </van-nav-bar>
      <div class="agent-info">
        <span class="agent-avatar">{{ agent.avatar }}</span>
        <span class="agent-desc">{{ agent.description }}</span>
      </div>
    </div>
    
    <!-- 消息列表 -->
    <div class="message-list" ref="messageListRef">
      <!-- 欢迎消息 -->
      <div class="message bot" v-if="messages.length === 0">
        <div class="avatar">{{ agent.avatar }}</div>
        <div class="bubble">
          <div class="text">{{ agent.welcome }}</div>
        </div>
      </div>
      
      <!-- 消息列表 -->
      <div 
        v-for="(msg, index) in messages" 
        :key="index" 
        :class="['message', msg.type]"
      >
        <div class="avatar" v-if="msg.type === 'bot'">{{ agent.avatar }}</div>
        <div class="bubble">
          <!-- 文字消息 -->
          <div class="text" v-if="msg.text" v-html="formatText(msg.text)"></div>
          
          <!-- 图片消息 -->
          <div class="image-message" v-if="msg.image" @click="previewImage(msg.image)">
            <img :src="msg.image" />
          </div>
          
          <!-- 票据识别结果 -->
          <div class="invoice-result" v-if="msg.invoiceData">
            <div class="result-header">🧾 识别结果</div>
            <div class="result-item">
              <span class="label">票据类型：</span>
              <span>{{ msg.invoiceData.type }}</span>
            </div>
            <div class="result-item">
              <span class="label">金额：</span>
              <span class="amount">¥{{ msg.invoiceData.amount }}</span>
            </div>
            <div class="result-item">
              <span class="label">日期：</span>
              <span>{{ msg.invoiceData.date }}</span>
            </div>
            <div class="result-item">
              <span class="label">建议分类：</span>
              <span>{{ msg.invoiceData.category }}</span>
            </div>
            <div class="result-actions" v-if="!msg.confirmed">
              <van-button size="small" type="primary" @click="confirmInvoice(msg, index)">
                ✅ 确认入账
              </van-button>
              <van-button size="small" @click="editInvoice(msg, index)">
                ✏️ 修改
              </van-button>
            </div>
            <div class="result-status" v-else>
              ✅ 已入账
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="quick-actions" v-if="msg.actions && !msg.confirmed">
            <van-button 
              v-for="action in msg.actions" 
              :key="action.text"
              size="small"
              :type="action.type || 'default'"
              @click="handleAction(action)"
            >
              {{ action.text }}
            </van-button>
          </div>
        </div>
        <div class="avatar" v-if="msg.type === 'user'">{{ userAvatar }}</div>
      </div>
      
      <!-- 加载中 -->
      <div class="message bot" v-if="loading">
        <div class="avatar">{{ agent.avatar }}</div>
        <div class="bubble">
          <div class="typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 快捷操作 -->
    <div class="quick-bar">
      <div class="quick-item" @click="sendQuickMessage('查看本月收支')">
        <span>📊</span>
        <span>收支</span>
      </div>
      <div class="quick-item" @click="sendQuickMessage('查看待办事项')">
        <span>📋</span>
        <span>待办</span>
      </div>
      <div class="quick-item" @click="sendQuickMessage('最近账单')">
        <span>📝</span>
        <span>账单</span>
      </div>
      <div class="quick-item" @click="sendQuickMessage('合同情况')">
        <span>📄</span>
        <span>合同</span>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <van-uploader 
        :after-read="handleImageUpload" 
        :max-count="1"
        accept="image/*"
      >
        <div class="upload-btn">
          <van-icon name="photo-o" size="22" />
          <span>票据</span>
        </div>
      </van-uploader>
      <van-field 
        v-model="inputText" 
        placeholder="输入消息或发送票据..." 
        borderless
        @keyup.enter="sendMessage"
      />
      <van-button type="primary" size="small" @click="sendMessage" :disabled="!inputText.trim()">
        发送
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showSuccessToast, showToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'
import { getAgentByRole } from '@/config/agents'
import { aiApi, transactionApi } from '@/api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const agent = computed(() => {
  const role = userStore.user?.role || 'employee'
  return getAgentByRole(role)
})

const userAvatar = computed(() => {
  return userStore.user?.real_name?.charAt(0) || 'U'
})

const messages = ref<any[]>([])
const inputText = ref('')
const loading = ref(false)
const messageListRef = ref<HTMLElement>()
const sessionId = ref('')

// 格式化文本
const formatText = (text: string) => {
  return text
    .replace(/\n/g, '<br>')
    .replace(/(\d+)/g, '<span class="num">$1</span>')
}

// 发送文字消息
const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || loading.value) return
  
  messages.value.push({
    type: 'user',
    text: text
  })
  inputText.value = ''
  scrollToBottom()
  
  await callAI(text)
}

// 发送快捷消息
const sendQuickMessage = (text: string) => {
  inputText.value = text
  sendMessage()
}

// 处理图片上传
const handleImageUpload = async (file: any) => {
  const imageUrl = file.content
  
  messages.value.push({
    type: 'user',
    image: imageUrl
  })
  
  scrollToBottom()
  loading.value = true
  
  try {
    const result = await aiApi.recognizeInvoice({ image: imageUrl })
    
    loading.value = false
    
    messages.value.push({
      type: 'bot',
      text: '我已识别出票据信息：',
      image: imageUrl,
      invoiceData: {
        type: result.type || '增值税发票',
        amount: result.amount || 0,
        date: result.date || new Date().toISOString().split('T')[0],
        category: result.category || '办公费用',
        seller: result.seller || ''
      },
      confirmed: false
    })
    
    scrollToBottom()
  } catch (e) {
    loading.value = false
    showToast('识别失败，请重试')
  }
}

// 确认入账
const confirmInvoice = async (msg: any, index: number) => {
  try {
    const result = await transactionApi.create({
      transaction_type: 'expense',
      amount: msg.invoiceData.amount,
      category: msg.invoiceData.category,
      transaction_date: msg.invoiceData.date,
      description: `${msg.invoiceData.type} - AI识别入账`
    })
    
    messages.value[index].confirmed = true
    showSuccessToast('入账成功！')
    
    messages.value.push({
      type: 'bot',
      text: `✅ 入账成功！\n\n金额：¥${msg.invoiceData.amount}\n分类：${msg.invoiceData.category}\n日期：${msg.invoiceData.date}`
    })
    
    scrollToBottom()
  } catch (e: any) {
    showToast(e.message || '入账失败')
  }
}

// 编辑票据
const editInvoice = (msg: any, index: number) => {
  showToast('编辑功能开发中')
}

// 调用AI
const callAI = async (text: string) => {
  loading.value = true
  
  try {
    const result = await aiApi.chat({
      message: text,
      sessionId: sessionId.value,
      history: messages.value.slice(-10).map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.text || ''
      }))
    })
    
    loading.value = false
    sessionId.value = result.sessionId || sessionId.value
    
    messages.value.push({
      type: 'bot',
      text: result.response || '抱歉，我暂时无法回答这个问题。',
      actions: result.actions
    })
    
    scrollToBottom()
  } catch (e) {
    loading.value = false
    showToast('请求失败，请重试')
  }
}

// 处理快捷操作
const handleAction = (action: any) => {
  switch (action.action) {
    case 'report':
    case 'finance':
      router.push('/dashboard')
      break
    case 'create':
    case 'expense':
    case 'income':
      router.push('/transactions/create')
      break
    case 'view_reimbursements':
    case 'approve_all':
      router.push('/reimbursement')
      break
    case 'view_contracts':
      router.push('/contracts')
      break
    case 'upload':
      document.querySelector('.van-uploader input')?.dispatchEvent(new MouseEvent('click'))
      break
    default:
      if (action.text) {
        sendQuickMessage(action.text)
      }
  }
}

// 预览图片
const previewImage = (url: string) => {
  showImagePreview([url])
}

// 清空历史
const clearHistory = async () => {
  try {
    await showConfirmDialog({
      title: '清空对话',
      message: '确定要清空所有对话记录吗？'
    })
    messages.value = []
    sessionId.value = ''
    showSuccessToast('已清空')
  } catch {}
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f6fa;
}

.chat-header {
  flex-shrink: 0;
  background: #fff;
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 12px;
  background: #fff;
}

.agent-avatar {
  font-size: 20px;
}

.agent-desc {
  font-size: 12px;
  color: #999;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 8px;
}

.message {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.message.bot .avatar {
  background: linear-gradient(135deg, #667eea, #764ba2);
  font-size: 20px;
}

.message.user .avatar {
  background: linear-gradient(135deg, #07c160, #00d084);
  color: #fff;
}

.bubble {
  max-width: 80%;
  margin: 0 10px;
}

.message.bot .bubble {
  background: #fff;
  border-radius: 12px 12px 12px 4px;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.message.user .bubble {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px 12px 4px 12px;
  padding: 12px 14px;
  color: #fff;
}

.text {
  font-size: 14px;
  line-height: 1.7;
}

.text :deep(.num) {
  font-weight: 600;
  color: #667eea;
}

.message.user .text :deep(.num) {
  color: #a8f5c8;
}

.image-message img {
  max-width: 180px;
  border-radius: 8px;
  margin-top: 8px;
  cursor: pointer;
}

.invoice-result {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  margin-top: 10px;
  border-left: 3px solid #667eea;
}

.result-header {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
}

.result-item {
  font-size: 13px;
  padding: 4px 0;
  display: flex;
  justify-content: space-between;
}

.result-item .label {
  color: #999;
}

.result-item .amount {
  color: #ee0a24;
  font-weight: 600;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.result-status {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  color: #07c160;
  font-size: 13px;
  text-align: center;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing span {
  width: 6px;
  height: 6px;
  background: #ccc;
  border-radius: 50%;
  animation: typing 1s infinite;
}

.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

.quick-bar {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
  overflow-x: auto;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 14px;
  background: #f5f6fa;
  border-radius: 8px;
  font-size: 11px;
  white-space: nowrap;
  min-width: 50px;
}

.quick-item span:first-child {
  font-size: 18px;
  margin-bottom: 4px;
}

.input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.upload-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #666;
}

.upload-btn span {
  font-size: 10px;
  margin-top: 2px;
}

.input-area :deep(.van-field) {
  flex: 1;
  background: #f5f6fa;
  border-radius: 18px;
  padding: 8px 14px;
}

.input-area :deep(.van-button--primary) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 16px;
  padding: 0 16px;
}
</style>