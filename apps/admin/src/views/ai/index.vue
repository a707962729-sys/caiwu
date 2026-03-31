<template>
  <div class="ai-chat-page">
    <!-- 顶部标题 -->
    <div class="chat-header">
      <div class="header-left">
        <div class="ai-avatar">
          <el-icon :size="28"><MagicStick /></el-icon>
        </div>
        <div class="header-info">
          <h2>AI 智能助手</h2>
          <span class="status-dot"></span>
          <span class="status-text">在线</span>
        </div>
      </div>
      <div class="header-actions">
        <el-button text @click="clearHistory">
          <el-icon><Delete /></el-icon>
          清空对话
        </el-button>
      </div>
    </div>

    <!-- 图片预览栏 -->
    <div class="image-preview-bar" v-if="previewImages.length > 0">
      <div class="preview-item" v-for="(img, idx) in previewImages" :key="idx">
        <img :src="img" alt="预览图片" />
        <el-icon class="remove-icon" @click="removeImage(idx)"><Close /></el-icon>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesRef"
         @dragover.prevent="handleDragOver"
         @drop.prevent="handleDrop">
      <!-- 欢迎消息 -->
      <div class="welcome-message" v-if="messages.length === 0">
        <div class="welcome-icon">
          <el-icon :size="48"><ChatDotRound /></el-icon>
        </div>
        <h3>你好，我是财务管家 AI 助手</h3>
        <p>我可以帮你解答财务问题、分析数据、查询报表</p>
        <div class="quick-prompts">
          <el-tag
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="quick-tag"
            @click="sendQuickPrompt(prompt)"
          >
            {{ prompt }}
          </el-tag>
        </div>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="message-item"
        :class="msg.role"
      >
        <div class="message-avatar">
          <div class="avatar-icon" :class="msg.role">
            <el-icon v-if="msg.role === 'user'"><User /></el-icon>
            <el-icon v-else><MagicStick /></el-icon>
          </div>
        </div>
        <div class="message-content">
          <!-- 用户发送的图片 -->
          <div class="message-images" v-if="msg.images?.length > 0">
            <img
              v-for="(img, imgIdx) in msg.images"
              :key="imgIdx"
              :src="img"
              class="message-image"
              @click="previewFullImage(img)"
            />
          </div>
          <div class="message-bubble" v-html="renderMarkdown(msg.content)"></div>
          <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
        </div>
      </div>

      <!-- 加载中 -->
      <div class="message-item assistant loading" v-if="loading">
        <div class="message-avatar">
          <div class="avatar-icon assistant">
            <el-icon><MagicStick /></el-icon>
          </div>
        </div>
        <div class="message-content">
          <div class="message-bubble loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷问题提示 -->
    <div class="query-hints" v-if="queryResult">
      <el-icon><DataAnalysis /></el-icon>
      <span>我找到了以下数据：</span>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area">
      <div class="input-tabs">
        <el-radio-group v-model="inputMode" size="small">
          <el-radio-button label="chat">
            <el-icon><ChatLineSquare /></el-icon>
            智能对话
          </el-radio-button>
          <el-radio-button label="query">
            <el-icon><DataAnalysis /></el-icon>
            数据查询
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="input-box">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="1"
          :placeholder="inputPlaceholder"
          resize="none"
          @keydown.enter.exact.prevent="handleSend"
          @input="autoResize"
          ref="inputRef"
        />
        <!-- 图片上传按钮 -->
        <el-button
          text
          class="image-upload-btn"
          @click="triggerImageUpload"
          :disabled="loading"
          title="上传图片（支持发票/合同/劳动合同）"
        >
          <el-icon><Picture /></el-icon>
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          style="display: none"
          @change="handleFileChange"
        />
        <el-button
          type="primary"
          :disabled="(!inputText.trim() && previewImages.length === 0) || loading"
          @click="handleSend"
          class="send-btn"
        >
          <el-icon v-if="!loading"><Promotion /></el-icon>
          <el-icon v-else class="is-loading"><Loading /></el-icon>
          发送
        </el-button>
      </div>

      <div class="input-tips">
        <span v-if="inputMode === 'chat'">按 Enter 发送，Shift+Enter 换行</span>
        <span v-else>支持询问：本月销售额、应收账款、利润分析、库存情况等</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import {
  MagicStick, Delete, ChatDotRound, User, Promotion, Loading,
  DataAnalysis, ChatLineSquare, Picture, Close
} from '@element-plus/icons-vue'
import { aiApi, type ChatMessage } from '@/api'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()

// 状态
const messages = ref<(ChatMessage & { timestamp?: number; images?: string[] })[]>([])
const inputText = ref('')
const loading = ref(false)
const inputMode = ref<'chat' | 'query'>('chat')
const queryResult = ref<any>(null)
const messagesRef = ref<HTMLElement>()
const inputRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const previewImages = ref<string[]>([])
const isDragOver = ref(false)

// 快捷提示
const quickPrompts = [
  '本月销售额是多少？',
  '帮我分析本月利润',
  '有哪些客户欠款？',
  '库存情况如何？',
  '本月支出最多的分类？',
  '帮我生成财务报表'
]

const inputPlaceholder = computed(() => {
  if (inputMode.value === 'query') {
    return '输入问题，如：本月销售额、应收账款分析...'
  }
  return '输入你想咨询的问题...'
})

// 渲染简单的 Markdown 格式
const renderMarkdown = (text: string) => {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

// 格式化时间
const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// 自动调整输入框高度
const autoResize = () => {
  nextTick(() => {
    const textarea = inputRef.value?.$el?.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  })
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

// 发送消息
const handleSend = async () => {
  const text = inputText.value.trim()
  const hasImages = previewImages.value.length > 0
  if ((!text && !hasImages) || loading.value) return

  // 添加用户消息（带图片）
  messages.value.push({
    role: 'user',
    content: text || (hasImages ? '[图片]' : ''),
    images: hasImages ? [...previewImages.value] : undefined,
    timestamp: Date.now()
  })

  inputText.value = ''
  previewImages.value = []
  autoResize()
  scrollToBottom()

  if (inputMode.value === 'query') {
    await handleQuery(text)
  } else {
    const sentImages = messages.value[messages.value.length - 1].images
    await handleChat(text, sentImages)
  }
}

// 处理智能对话
const handleChat = async (text: string, images?: string[]) => {
  loading.value = true
  queryResult.value = null

  try {
    const context = messages.value.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }))

    const res = await aiApi.chat({
      message: text,
      context,
      images
    })

    messages.value.push({
      role: 'assistant',
      content: res.response,
      timestamp: Date.now()
    })
  } catch (err: any) {
    messages.value.push({
      role: 'assistant',
      content: `抱歉，AI 服务暂时不可用：${err.message || '请稍后重试'}`,
      timestamp: Date.now()
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

// 处理数据查询
const handleQuery = async (question: string) => {
  loading.value = true

  try {
    const res = await aiApi.query({ question })

    let content = res.answer || '我没有找到相关数据'

    // 如果有结构化数据，添加格式化输出
    if (res.data && res.data.type !== 'unknown') {
      content += '\n\n'
      switch (res.data.type) {
        case 'sales':
          content += `📊 总销售额：**${(res.data.total || 0).toLocaleString()}** 元\n`
          content += `📋 订单数：**${res.data.count || 0}** 笔\n`
          if (res.data.breakdown?.length > 0) {
            content += '\n**客户分布：**\n'
            res.data.breakdown.slice(0, 3).forEach((item: any, i: number) => {
              content += `${i + 1}. ${item.customer_name}：${(item.amount || 0).toLocaleString()} 元\n`
            })
          }
          break
        case 'profit':
          content += `💰 收入：**${(res.data.revenue || 0).toLocaleString()}** 元\n`
          content += `💸 支出：**${(res.data.cost || 0).toLocaleString()}** 元\n`
          content += `✅ 净利润：**${(res.data.profit || 0).toLocaleString()}** 元\n`
          content += `📈 利润率：**${res.data.margin}**\n`
          break
        case 'receivables':
          content += `💵 应收账款总额：**${(res.data.total || 0).toLocaleString()}** 元\n`
          content += `📋 待收笔数：**${res.data.count || 0}** 笔\n`
          content += `⚠️ 逾期金额：**${(res.data.overdue || 0).toLocaleString()}** 元\n`
          break
        case 'inventory':
          content += `📦 库存总量：**${res.data.totalQuantity || 0}** 件\n`
          content += `🏷️ 商品种类：**${res.data.productCount || 0}** 种\n`
          if (res.data.lowStockProducts?.length > 0) {
            content += `\n⚠️ **库存不足商品：**\n`
            res.data.lowStockProducts.slice(0, 5).forEach((item: any) => {
              content += `- ${item.name}（${item.quantity}/${item.min_stock}）\n`
            })
          }
          break
        case 'expenses':
          content += `💸 支出总额：**${(res.data.total || 0).toLocaleString()}** 元\n`
          content += `📋 支出笔数：**${res.data.count || 0}** 笔\n`
          if (res.data.breakdown?.length > 0) {
            content += '\n**支出分类：**\n'
            res.data.breakdown.forEach((item: any, i: number) => {
              content += `${i + 1}. ${item.category}：${(item.total || 0).toLocaleString()} 元\n`
            })
          }
          break
        case 'orders':
          content += `📋 订单总数：**${res.data.count || 0}** 笔\n`
          content += `💰 订单总额：**${(res.data.totalAmount || 0).toLocaleString()}** 元\n`
          break
        case 'topCustomers':
          if (res.data.customers?.length > 0) {
            content += '\n**TOP 客户：**\n'
            res.data.customers.forEach((item: any, i: number) => {
              content += `${i + 1}. ${item.customer_name} - ${(item.total_amount || 0).toLocaleString()} 元（${item.order_count} 笔）\n`
            })
          }
          break
      }
    }

    messages.value.push({
      role: 'assistant',
      content,
      timestamp: Date.now()
    })

    queryResult.value = res.data
  } catch (err: any) {
    messages.value.push({
      role: 'assistant',
      content: `查询失败：${err.message || '请稍后重试'}`,
      timestamp: Date.now()
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

// 快捷问题
const sendQuickPrompt = (prompt: string) => {
  inputText.value = prompt
  handleSend()
}

// 清空历史
const clearHistory = () => {
  messages.value = []
  queryResult.value = null
  previewImages.value = []
}

// 触发图片上传
const triggerImageUpload = () => {
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files) return
  processFiles(Array.from(files))
  target.value = '' // reset
}

// 处理拖拽
const handleDragOver = () => {
  isDragOver.value = true
}

const handleDrop = (e: DragEvent) => {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files) return
  processFiles(Array.from(files))
}

// 处理文件列表
const processFiles = (files: File[]) => {
  const imageFiles = files.filter(f => f.type.startsWith('image/'))
  if (imageFiles.length === 0) {
    ElMessage.warning('请选择图片文件')
    return
  }
  if (previewImages.value.length + imageFiles.length > 5) {
    ElMessage.warning('最多上传5张图片')
    return
  }
  imageFiles.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      previewImages.value.push(result)
    }
    reader.readAsDataURL(file)
  })
}

// 移除预览图片
const removeImage = (index: number) => {
  previewImages.value.splice(index, 1)
}

// 预览大图
const previewFullImage = (url: string) => {
  window.open(url, '_blank')
}
</script>

<style lang="scss" scoped>
.ai-chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background: #f5f7fa;
  overflow: hidden;
}

// 顶部
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .ai-avatar {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }

    .header-info {
      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }

      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #67C23A;
        margin-left: 8px;
      }

      .status-text {
        font-size: 12px;
        color: #67C23A;
      }
    }
  }
}

// 消息区域
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
  }
}

// 欢迎消息
.welcome-message {
  text-align: center;
  padding: 60px 20px;

  .welcome-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea22, #764ba222);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    color: #667eea;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #303133;
  }

  p {
    margin: 0 0 24px;
    color: #909399;
    font-size: 14px;
  }

  .quick-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;

    .quick-tag {
      cursor: pointer;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }
}

// 消息项
.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease;

  &.user {
    flex-direction: row-reverse;

    .message-bubble {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      border-radius: 16px 4px 16px 16px;
    }

    .message-time {
      text-align: right;
    }
  }

  &.assistant {
    .message-bubble {
      background: #fff;
      color: #303133;
      border-radius: 4px 16px 16px 16px;
    }
  }

  .message-avatar {
    flex-shrink: 0;

    .avatar-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.user {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
      }

      &.assistant {
        background: #f5f7fa;
        color: #667eea;
      }
    }
  }

  .message-content {
    max-width: 70%;

    .message-bubble {
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

      :deep(p) {
        margin: 0 0 8px;
        &:last-child { margin-bottom: 0; }
      }

      :deep(code) {
        background: #f1f2f3;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
      }

      :deep(strong) {
        color: #667eea;
      }
    }

    .message-time {
      font-size: 11px;
      color: #c0c4cc;
      margin-top: 4px;
      padding: 0 4px;
    }

    .message-images {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
      max-width: 100%;
    }

    .message-image {
      max-width: 200px;
      max-height: 200px;
      border-radius: 8px;
      cursor: pointer;
      object-fit: cover;
      transition: transform 0.2s;

      &:hover {
        transform: scale(1.02);
      }
    }
  }

  // 加载动画
  &.loading .message-bubble {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 16px 24px;
  }

  .loading-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #667eea;
    animation: bounce 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

// 查询提示
.query-hints {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 24px;
  background: #667eea11;
  color: #667eea;
  font-size: 13px;
  flex-shrink: 0;
}

// 输入区域
.chat-input-area {
  padding: 16px 24px 20px;
  background: #fff;
  border-top: 1px solid #ebeef5;
  flex-shrink: 0;

  .input-tabs {
    margin-bottom: 12px;
  }

  .input-box {
    display: flex;
    gap: 12px;
    align-items: flex-end;

    .el-textarea {
      flex: 1;

      :deep(.el-textarea__inner) {
        border-radius: 12px;
        padding: 12px 16px;
        line-height: 1.5;
        max-height: 120px;
      }
    }

    .send-btn {
      height: 42px;
      padding: 0 20px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none;

      &:hover {
        opacity: 0.9;
      }

      &:disabled {
        background: #dcdfe6;
        opacity: 1;
      }
    }
  }

  .input-tips {
    font-size: 12px;
    color: #c0c4cc;
    margin-top: 8px;
  }

  .image-upload-btn {
    height: 42px;
    width: 42px;
    padding: 0;
    border-radius: 12px;
    color: #909399;

    &:hover {
      color: #667eea;
    }

    &:disabled {
      color: #c0c4cc;
    }
  }
}

// 图片预览栏
.image-preview-bar {
  display: flex;
  gap: 8px;
  padding: 8px 24px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 2px;
  }

  .preview-item {
    position: relative;
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .remove-icon {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      border-radius: 50%;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: rgba(220, 53, 69, 0.8);
      }
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .chat-header {
    padding: 12px 16px;
  }

  .chat-messages {
    padding: 16px;
  }

  .message-item .message-content {
    max-width: 85%;
  }

  .chat-input-area {
    padding: 12px 16px;
  }
}
</style>
