<template>
  <div class="contract-review-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">合同审核</h2>
        <el-tag v-if="currentContract" type="info" size="large">
          {{ currentContract.name }}
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回合同列表
        </el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <!-- 左侧：合同信息 + 文件上传 -->
      <el-col :span="8">
        <!-- 合同基本信息 -->
        <el-card shadow="never" class="info-card">
          <template #header>
            <div class="card-header">
              <span>合同信息</span>
            </div>
          </template>
          <el-descriptions :column="1" border size="small" v-if="currentContract">
            <el-descriptions-item label="合同编号">
              <span class="contract-no">{{ currentContract.contract_no }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="合同名称">
              {{ currentContract.name }}
            </el-descriptions-item>
            <el-descriptions-item label="签约方">
              {{ currentContract.party_name }}
            </el-descriptions-item>
            <el-descriptions-item label="合同金额">
              <span class="amount">{{ formatMoney(currentContract.amount) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="生效日期">
              {{ currentContract.start_date }}
            </el-descriptions-item>
            <el-descriptions-item label="到期日期">
              {{ currentContract.end_date }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 文件上传 -->
        <el-card shadow="never" class="upload-card">
          <template #header>
            <div class="card-header">
              <span>合同文件上传</span>
              <el-tag size="small" type="info">PDF/Word</el-tag>
            </div>
          </template>
          
          <el-upload
            ref="uploadRef"
            class="contract-uploader"
            drag
            :action="uploadUrl"
            :headers="uploadHeaders"
            :data="{ contract_id: contractId }"
            :auto-upload="false"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :file-list="fileList"
            accept=".pdf,.doc,.docx"
            multiple
          >
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-text">
              <span>拖拽文件到此处，或 <em>点击上传</em></span>
              <span class="upload-hint">支持 PDF、Word 文档</span>
            </div>
            <template #tip>
              <div class="upload-tip">
                上传后将自动提取文本内容用于 AI 审核分析
              </div>
            </template>
          </el-upload>

          <div v-if="extracting" class="extract-progress">
            <el-progress :percentage="extractProgress" :status="extractProgressStatus" />
            <span class="extract-text">{{ extractText }}</span>
          </div>

          <div v-if="extractedText" class="extracted-text">
            <div class="extracted-header">
              <span>已提取文本</span>
              <el-button size="small" text @click="viewFullText">
                查看全部
              </el-button>
            </div>
            <div class="extracted-content">
              {{ extractedText.substring(0, 500) }}{{ extractedText.length > 500 ? '...' : '' }}
            </div>
          </div>

          <div class="upload-actions">
            <el-button type="primary" :loading="uploading" @click="handleUpload">
              上传并提取文本
            </el-button>
          </div>
        </el-card>

        <!-- 审核操作 -->
        <el-card shadow="never" class="action-card">
          <template #header>
            <div class="card-header">
              <span>AI 审核</span>
            </div>
          </template>
          
          <div class="review-form">
            <el-form label-width="80px">
              <el-form-item label="合同文本">
                <el-input
                  v-model="reviewText"
                  type="textarea"
                  :rows="4"
                  placeholder="输入合同文本内容进行审核，或上传合同文件自动提取"
                />
              </el-form-item>
              <el-form-item>
                <el-button 
                  type="primary" 
                  :loading="reviewing"
                  :disabled="!reviewText && !extractedText"
                  @click="handleReview"
                >
                  <el-icon v-if="!reviewing"><MagicStick /></el-icon>
                  发起 AI 审核
                </el-button>
                <el-button @click="handleAnalyze">
                  仅分析（不保存）
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：审核结果 -->
      <el-col :span="16">
        <!-- 审核概览 -->
        <el-card shadow="never" class="result-overview-card" v-if="reviewResult">
          <template #header>
            <div class="card-header">
              <span>审核结果</span>
              <div class="header-right">
                <el-tag :type="getRiskTagType(reviewResult.overall_risk_level)" size="large">
                  {{ getRiskLabel(reviewResult.overall_risk_level) }}
                </el-tag>
                <el-button size="small" text @click="refreshReview">
                  <el-icon><Refresh /></el-icon>
                </el-button>
              </div>
            </div>
          </template>

          <div class="overview-content">
            <!-- 风险评分 -->
            <div class="risk-score-section">
              <div class="score-circle" :style="{ '--score-color': getScoreColor(reviewResult.risk_score) }">
                <div class="score-value">{{ reviewResult.risk_score }}</div>
                <div class="score-label">风险评分</div>
              </div>
              <div class="score-detail">
                <div class="detail-item">
                  <span class="detail-label">合同类型</span>
                  <span class="detail-value">
                    {{ reviewResult.contract_type }}
                    <el-tag size="small" type="info">
                      {{ (reviewResult.contract_type_confidence * 100).toFixed(0) }}% 置信度
                    </el-tag>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">甲方风险</span>
                  <span class="detail-value">
                    <el-tag :type="getRiskTagType(reviewResult.party_a_risk_level)" size="small">
                      {{ getRiskLabel(reviewResult.party_a_risk_level) }}
                    </el-tag>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">乙方风险</span>
                  <span class="detail-value">
                    <el-tag :type="getRiskTagType(reviewResult.party_b_risk_level)" size="small">
                      {{ getRiskLabel(reviewResult.party_b_risk_level) }}
                    </el-tag>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">AI 模型</span>
                  <span class="detail-value">{{ reviewResult.ai_model }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Token 消耗</span>
                  <span class="detail-value">{{ reviewResult.ai_tokens_used }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 风险发现 -->
        <el-card shadow="never" class="risk-findings-card" v-if="reviewResult?.risk_findings?.length">
          <template #header>
            <div class="card-header">
              <span>风险发现</span>
              <el-tag size="small">{{ reviewResult.risk_findings.length }} 项</el-tag>
            </div>
          </template>
          
          <el-table :data="reviewResult.risk_findings" stripe>
            <el-table-column prop="item" label="风险条款" min-width="150" />
            <el-table-column prop="detail" label="详细描述" min-width="250" />
            <el-table-column prop="risk_level" label="风险等级" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getRiskTagType(row.risk_level)" size="small">
                  {{ getRiskLabel(row.risk_level) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 整改建议 -->
        <el-card shadow="never" class="suggestions-card" v-if="reviewResult?.review_suggestions?.length">
          <template #header>
            <div class="card-header">
              <span>整改建议</span>
            </div>
          </template>
          
          <div class="suggestions-list">
            <div 
              v-for="(item, index) in reviewResult.review_suggestions" 
              :key="index"
              class="suggestion-item"
            >
              <div class="suggestion-priority">
                <el-tag :type="getPriorityTagType(item.priority)" size="small">
                  P{{ item.priority }}
                </el-tag>
              </div>
              <div class="suggestion-content">
                <div class="suggestion-header">
                  <span class="suggestion-category">
                    {{ getCategoryLabel(item.category) }}
                  </span>
                  <span class="suggestion-text">{{ item.suggestion }}</span>
                </div>
                <div class="suggestion-reason">{{ item.reason }}</div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 人工复审 -->
        <el-card shadow="never" class="manual-review-card" v-if="reviewResult">
          <template #header>
            <div class="card-header">
              <span>人工复审</span>
            </div>
          </template>
          
          <el-form label-width="100px">
            <el-form-item label="审核结论">
              <el-radio-group v-model="manualReviewForm.overall_risk_level">
                <el-radio value="low">低风险</el-radio>
                <el-radio value="medium">中风险</el-radio>
                <el-radio value="high">高风险</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="复审备注">
              <el-input
                v-model="manualReviewForm.notes"
                type="textarea"
                :rows="3"
                placeholder="输入复审意见..."
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleManualReview" :loading="manualReviewing">
                提交复审结论
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 审核历史 -->
        <el-card shadow="never" class="history-card" v-if="reviewHistory.length">
          <template #header>
            <div class="card-header">
              <span>审核历史</span>
            </div>
          </template>
          
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in reviewHistory"
              :key="index"
              :timestamp="item.created_at"
              placement="top"
            >
              <el-card shadow="never" size="small">
                <div class="history-item">
                  <div class="history-header">
                    <el-tag :type="getRiskTagType(item.overall_risk_level)" size="small">
                      {{ getRiskLabel(item.overall_risk_level) }}
                    </el-tag>
                    <span class="history-score">评分: {{ item.risk_score }}</span>
                  </div>
                  <div class="history-info" v-if="item.history?.length">
                    <div v-for="(h, i) in item.history" :key="i" class="history-action">
                      {{ h.operator_name }}: {{ getActionLabel(h.action) }}
                    </div>
                  </div>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <!-- 空状态 -->
        <el-empty v-if="!reviewResult && !reviewing" description="暂无审核结果">
          <el-button type="primary" @click="handleReview" :disabled="!reviewText && !extractedText">
            发起 AI 审核
          </el-button>
        </el-empty>
      </el-col>
    </el-row>

    <!-- 全文查看弹窗 -->
    <el-dialog v-model="textDialogVisible" title="合同文本全文" width="800px">
      <div class="full-text-content">
        <pre>{{ fullExtractedText }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSafeNavigate } from '@/composables/useNavigation'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, UploadFilled, MagicStick, Refresh
} from '@element-plus/icons-vue'
import type { UploadInstance, UploadRawFile } from 'element-plus'
import {
  contractReviewApi,
  type ContractReviewResult,
  type ContractReviewHistory,
} from '@/api/contract-review'
import { contractApi, type Contract } from '@/api/contract'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const { safeNavigate } = useSafeNavigate()
const userStore = useUserStore()

// 合同 ID
const contractId = computed(() => Number(route.params.id))

// 数据
const currentContract = ref<Contract | null>(null)
const reviewResult = ref<ContractReviewResult | null>(null)
const reviewHistory = ref<ContractReviewHistory[]>([])

// 审核状态
const reviewing = ref(false)
const manualReviewing = ref(false)

// 文件上传
const uploadRef = ref<UploadInstance>()
const fileList = ref<any[]>([])
const uploading = ref(false)
const extractedText = ref('')
const extracting = ref(false)
const extractProgress = ref(0)
const extractProgressStatus = ref<'success' | 'warning' | 'exception' | ''>('')
const extractText = ref('正在提取文本...')
const fullExtractedText = ref('')
const textDialogVisible = ref(false)

// 审核表单
const reviewText = ref('')
const reviewTextSource = ref<'manual' | 'file'>('manual')

// 人工复审表单
const manualReviewForm = reactive({
  overall_risk_level: 'medium',
  notes: ''
})

// 上传配置
const uploadUrl = computed(() => `/api/contracts/${contractId.value}/upload`)
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${userStore.token}`
}))

// 工具函数
const formatMoney = (n: number) => {
  if (!n && n !== 0) return '¥0.00'
  if (Math.abs(n) >= 10000) {
    return '¥' + (n / 10000).toFixed(2) + '万'
  }
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getRiskTagType = (level: string): 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    unknown: 'info'
  }
  return map[level] || 'info'
}

const getRiskLabel = (level: string): string => {
  const map: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    unknown: '未知'
  }
  return map[level] || level
}

const getScoreColor = (score: number): string => {
  if (score <= 30) return '#07c160'
  if (score <= 60) return '#f59e0b'
  return '#ef4444'
}

const getPriorityTagType = (priority: number): 'danger' | 'warning' | 'info' => {
  if (priority <= 2) return 'danger'
  if (priority <= 3) return 'warning'
  return 'info'
}

const getCategoryLabel = (category: string): string => {
  const map: Record<string, string> = {
    payment: '付款条款',
    term: '合同期限',
    liability: '违约责任',
    other: '其他'
  }
  return map[category] || category
}

const getActionLabel = (action: string) => {
  const map: Record<string, string> = {
    ai_completed: 'AI 审核完成',
    manual_reviewed: '人工复审',
    file_uploaded: '文件上传'
  }
  return map[action] || action
}

// 加载数据
const loadContract = async () => {
  try {
    const res = await contractApi.getDetail(contractId.value)
    currentContract.value = res
  } catch (e) {
    console.error('加载合同失败', e)
    ElMessage.error('加载合同失败')
  }
}

const loadReviewResult = async () => {
  try {
    const res = await contractReviewApi.getReviewResult(contractId.value)
    reviewResult.value = res
    if (res) {
      manualReviewForm.overall_risk_level = res.overall_risk_level
    }
  } catch (e) {
    console.error('加载审核结果失败', e)
  }
}

const loadReviewHistory = async () => {
  try {
    const res = await contractReviewApi.getReviewHistory(contractId.value)
    reviewHistory.value = res
  } catch (e) {
    console.error('加载审核历史失败', e)
  }
}

// 文件处理
const handleFileChange = (file: any, files: any[]) => {
  fileList.value = files
}

const handleFileRemove = () => {
  fileList.value = []
  extractedText.value = ''
}

const handleUpload = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  extracting.value = true
  extractProgress.value = 0
  extractText.value = '正在上传文件...'

  try {
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i]
      extractProgress.value = Math.round(((i + 0.5) / fileList.value.length) * 100)
      extractText.value = `正在提取 ${fileItem.name} 的文本...`

      const formData = new FormData()
      formData.append('file', fileItem.raw)
      formData.append('contract_id', String(contractId.value))

      const res = await contractReviewApi.uploadContractFile(contractId.value, fileItem.raw)
      
      if (res.text) {
        extractedText.value += `\n\n=== ${fileItem.name} ===\n\n` + res.text
      }
      
      extractProgress.value = Math.round(((i + 1) / fileList.value.length) * 100)
    }

    extractText.value = '提取完成'
    extractProgressStatus.value = 'success'
    reviewText.value = extractedText.value
    reviewTextSource.value = 'file'
    
    ElMessage.success('文件上传并提取成功')
  } catch (e: any) {
    console.error('上传失败', e)
    extractProgressStatus.value = 'exception'
    extractText.value = '提取失败'
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const handleUploadSuccess = (res: any) => {
  if (res.text) {
    extractedText.value = res.text
    reviewText.value = res.text
    reviewTextSource.value = 'file'
  }
  ElMessage.success('上传成功')
}

const viewFullText = () => {
  fullExtractedText.value = extractedText.value
  textDialogVisible.value = true
}

// 审核操作
const handleReview = async () => {
  const textToReview = reviewTextSource.value === 'file' ? extractedText.value : reviewText.value
  
  if (!textToReview || textToReview.trim().length < 50) {
    ElMessage.warning('合同文本内容不足，无法进行审核')
    return
  }

  reviewing.value = true
  try {
    const res = await contractReviewApi.review(contractId.value, textToReview)
    reviewResult.value = res
    manualReviewForm.overall_risk_level = res.overall_risk_level
    ElMessage.success('审核完成')
    loadReviewHistory()
  } catch (e: any) {
    console.error('审核失败', e)
    ElMessage.error(e.message || '审核失败')
  } finally {
    reviewing.value = false
  }
}

const handleAnalyze = async () => {
  const textToAnalyze = reviewTextSource.value === 'file' ? extractedText.value : reviewText.value
  
  if (!textToAnalyze || textToAnalyze.trim().length < 50) {
    ElMessage.warning('合同文本内容不足，无法进行分析')
    return
  }

  reviewing.value = true
  try {
    const res = await contractReviewApi.analyze(contractId.value, textToAnalyze)
    reviewResult.value = res
    ElMessage.success('分析完成（仅预览，未保存）')
  } catch (e: any) {
    console.error('分析失败', e)
    ElMessage.error(e.message || '分析失败')
  } finally {
    reviewing.value = false
  }
}

const refreshReview = async () => {
  await loadReviewResult()
  await loadReviewHistory()
}

const handleManualReview = async () => {
  if (!reviewResult.value) {
    ElMessage.warning('请先进行 AI 审核')
    return
  }

  manualReviewing.value = true
  try {
    await contractReviewApi.manualReview(reviewResult.value.review_id, {
      overall_risk_level: manualReviewForm.overall_risk_level,
      risk_findings: reviewResult.value.risk_findings,
      review_suggestions: reviewResult.value.review_suggestions,
      notes: manualReviewForm.notes
    })
    ElMessage.success('复审已提交')
    loadReviewHistory()
  } catch (e: any) {
    console.error('复审失败', e)
    ElMessage.error(e.message || '复审失败')
  } finally {
    manualReviewing.value = false
  }
}

const goBack = () => {
  safeNavigate('/contracts')
}

// 初始化
onMounted(() => {
  if (contractId.value) {
    loadContract()
    loadReviewResult()
    loadReviewHistory()
  }
})
</script>

<style lang="scss" scoped>
.contract-review-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;

      .page-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }
    }
  }

  .el-card {
    border-radius: 12px;
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }

  // 合同信息卡片
  .info-card {
    .contract-no {
      color: #3b82f6;
      font-weight: 500;
    }

    .amount {
      font-weight: 600;
      color: #333;
    }
  }

  // 文件上传卡片
  .upload-card {
    .contract-uploader {
      :deep(.el-upload-dragger) {
        padding: 30px 20px;
        border-radius: 12px;
        background: #fafafa;
        border: 2px dashed #dcdfe6;
        transition: all 0.3s;

        &:hover {
          border-color: #3b82f6;
          background: #f0f7ff;
        }
      }

      .upload-icon {
        font-size: 48px;
        color: #c0c4cc;
        margin-bottom: 16px;
      }

      .upload-text {
        color: #606266;

        em {
          color: #3b82f6;
          font-style: normal;
        }
      }

      .upload-hint {
        display: block;
        font-size: 12px;
        color: #909399;
        margin-top: 8px;
      }
    }

    .upload-tip {
      margin-top: 12px;
      padding: 10px 12px;
      background: #f0f7ff;
      border-radius: 6px;
      color: #3b82f6;
      font-size: 13px;
    }

    .extract-progress {
      margin-top: 16px;

      .extract-text {
        display: block;
        margin-top: 8px;
        color: #606266;
        font-size: 13px;
      }
    }

    .extracted-text {
      margin-top: 16px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 8px;

      .extracted-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 13px;
        color: #606266;
      }

      .extracted-content {
        font-size: 13px;
        color: #909399;
        line-height: 1.6;
        max-height: 100px;
        overflow: hidden;
      }
    }

    .upload-actions {
      margin-top: 16px;
      text-align: center;
    }
  }

  // 审核结果概览
  .result-overview-card {
    .overview-content {
      .risk-score-section {
        display: flex;
        align-items: center;
        gap: 40px;
        padding: 20px 0;

        .score-circle {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: conic-gradient(
            var(--score-color) 0%,
            #e4e7ed 0%
          );
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;

          &::before {
            content: '';
            position: absolute;
            width: 110px;
            height: 110px;
            border-radius: 50%;
            background: #fff;
          }

          .score-value {
            position: relative;
            font-size: 36px;
            font-weight: 700;
            color: var(--score-color);
          }

          .score-label {
            position: relative;
            font-size: 13px;
            color: #909399;
          }
        }

        .score-detail {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;

          .detail-item {
            display: flex;
            align-items: center;
            gap: 12px;

            .detail-label {
              color: #909399;
              font-size: 14px;
            }

            .detail-value {
              display: flex;
              align-items: center;
              gap: 8px;
              font-weight: 500;
            }
          }
        }
      }
    }
  }

  // 风险发现卡片
  .risk-findings-card {
    :deep(.el-table) {
      th.el-table__cell {
        background: #fafafa;
      }
    }
  }

  // 整改建议卡片
  .suggestions-card {
    .suggestions-list {
      .suggestion-item {
        display: flex;
        gap: 16px;
        padding: 16px;
        border-bottom: 1px solid #ebeef5;

        &:last-child {
          border-bottom: none;
        }

        .suggestion-priority {
          flex-shrink: 0;
        }

        .suggestion-content {
          flex: 1;

          .suggestion-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;

            .suggestion-category {
              padding: 2px 8px;
              background: #ecf5ff;
              color: #409eff;
              border-radius: 4px;
              font-size: 12px;
            }

            .suggestion-text {
              font-weight: 500;
              color: #303133;
            }
          }

          .suggestion-reason {
            color: #909399;
            font-size: 13px;
            line-height: 1.6;
          }
        }
      }
    }
  }

  // 审核历史卡片
  .history-card {
    .history-item {
      .history-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;

        .history-score {
          color: #909399;
          font-size: 13px;
        }
      }

      .history-info {
        .history-action {
          color: #606266;
          font-size: 13px;
          line-height: 1.8;
        }
      }
    }
  }
}

// 全文弹窗
.full-text-content {
  max-height: 60vh;
  overflow: auto;

  pre {
    white-space: pre-wrap;
    word-break: break-all;
    font-family: inherit;
    line-height: 1.8;
  }
}
</style>
