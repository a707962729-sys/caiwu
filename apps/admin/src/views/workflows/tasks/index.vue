<template>
  <div class="workflow-tasks-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">待办任务</div>
              <div class="stat-value">{{ stats.pending }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card approved">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Select /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已通过</div>
              <div class="stat-value">{{ stats.approved }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card rejected">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CloseBold /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已驳回</div>
              <div class="stat-value">{{ stats.rejected }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total-count">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Finished /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总处理数</div>
              <div class="stat-value">{{ stats.total }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="搜索">
          <el-input
            v-model="filterForm.search"
            placeholder="流程名称/发起人"
            clearable
            style="width: 200px"
            @keyup.enter="handleFilter"
            @clear="handleFilter"
          >
            <template #append>
              <el-button :icon="Search" @click="handleFilter" />
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="流程类型">
          <el-select v-model="filterForm.workflow_type" placeholder="全部类型" clearable style="width: 140px" @change="handleFilter">
            <el-option
              v-for="(label, value) in WorkflowTypes"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="success"
            :icon="Select"
            :disabled="selectedTasks.length === 0"
            @click="handleBatchApprove"
          >
            批量通过 ({{ selectedTasks.length }})
          </el-button>
          <el-button
            type="danger"
            :icon="CloseBold"
            :disabled="selectedTasks.length === 0"
            @click="handleBatchReject"
          >
            批量驳回 ({{ selectedTasks.length }})
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" align="center" :selectable="canSelect" />
        <el-table-column prop="workflow_name" label="流程名称" min-width="180">
          <template #default="{ row }">
            <div class="workflow-name">
              <span class="name">{{ row.workflow_name }}</span>
              <el-tag type="info" size="small" class="type-tag">
                {{ getWorkflowTypeLabel(row.workflow_type) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="initiator_name" label="发起人" width="120">
          <template #default="{ row }">
            <div class="initiator">
              <el-avatar :size="28" class="avatar">{{ row.initiator_name?.charAt(0) }}</el-avatar>
              <div class="info">
                <span class="name">{{ row.initiator_name }}</span>
                <span class="dept">{{ row.department || '-' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="160">
          <template #default="{ row }">
            <div class="time-cell">
              <span class="date">{{ formatDate(row.created_at, 'YYYY-MM-DD') }}</span>
              <span class="time">{{ formatDate(row.created_at, 'HH:mm:ss') }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="TaskStatusTypes[row.status as TaskStatus]" size="small">
              {{ TaskStatusLabels[row.status as TaskStatus] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button type="success" size="small" @click="handleApprove(row)">通过</el-button>
              <el-button type="danger" size="small" @click="handleReject(row)">驳回</el-button>
            </template>
            <el-button type="primary" size="small" plain @click="handleViewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 审批弹窗 -->
    <el-dialog
      v-model="approvalDialogVisible"
      :title="approvalAction === 'approve' ? '审批通过' : '驳回审批'"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="approvalFormRef"
        :model="approvalForm"
        :rules="approvalRules"
        label-width="80px"
      >
        <el-form-item label="流程名称">
          <span>{{ currentTask?.workflow_name }}</span>
        </el-form-item>
        <el-form-item label="发起人">
          <span>{{ currentTask?.initiator_name }}</span>
        </el-form-item>
        <el-form-item label="审批意见" prop="comment">
          <el-input
            v-model="approvalForm.comment"
            type="textarea"
            :rows="4"
            :placeholder="approvalAction === 'approve' ? '审批意见（选填）' : '请输入驳回原因'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button
          :type="approvalAction === 'approve' ? 'success' : 'danger'"
          :loading="submitting"
          @click="confirmApproval"
        >
          确定{{ approvalAction === 'approve' ? '通过' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 批量审批弹窗 -->
    <el-dialog
      v-model="batchDialogVisible"
      :title="batchAction === 'approve' ? '批量通过' : '批量驳回'"
      width="480px"
      :close-on-click-modal="false"
    >
      <div class="batch-info">
        <el-alert
          :title="`已选择 ${selectedTasks.length} 个待办任务`"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        />
        <div class="selected-tasks">
          <el-tag
            v-for="task in selectedTasks.slice(0, 5)"
            :key="task.id"
            size="small"
            style="margin: 4px"
          >
            {{ task.workflow_name }}
          </el-tag>
          <el-tag v-if="selectedTasks.length > 5" size="small" type="info" style="margin: 4px">
            +{{ selectedTasks.length - 5 }} 更多
          </el-tag>
        </div>
      </div>
      <el-form
        ref="batchFormRef"
        :model="batchForm"
        :rules="batchRules"
        label-width="80px"
        style="margin-top: 16px"
      >
        <el-form-item label="审批意见" prop="comment">
          <el-input
            v-model="batchForm.comment"
            type="textarea"
            :rows="4"
            :placeholder="batchAction === 'approve' ? '审批意见（选填）' : '请输入驳回原因'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button
          :type="batchAction === 'approve' ? 'success' : 'danger'"
          :loading="batchSubmitting"
          @click="confirmBatchApproval"
        >
          确定{{ batchAction === 'approve' ? '通过' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      title="流程详情"
      size="50%"
      direction="rtl"
    >
      <div class="detail-drawer" v-if="currentTask">
        <!-- 基本信息 -->
        <div class="info-section">
          <h4 class="section-title">基本信息</h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="流程名称" :span="2">{{ currentTask.workflow_name }}</el-descriptions-item>
            <el-descriptions-item label="流程类型">
              <el-tag type="info" size="small">{{ getWorkflowTypeLabel(currentTask.workflow_type) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="TaskStatusTypes[currentTask.status]" size="small">
                {{ TaskStatusLabels[currentTask.status] }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="发起人">{{ currentTask.initiator_name }}</el-descriptions-item>
            <el-descriptions-item label="所属部门">{{ currentTask.department || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ currentTask.created_at }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ currentTask.updated_at || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 表单内容 -->
        <div class="info-section" v-if="currentTask.form_data && Object.keys(currentTask.form_data).length > 0">
          <h4 class="section-title">表单内容</h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item
              v-for="(value, key) in currentTask.form_data"
              :key="key"
              :label="getFieldLabel(key)"
              :span="getFieldSpan(value)"
            >
              <template v-if="typeof value === 'object' && value !== null">
                <pre class="json-value">{{ JSON.stringify(value, null, 2) }}</pre>
              </template>
              <template v-else-if="isMoneyField(key)">
                <span class="money">{{ formatMoney(value) }}</span>
              </template>
              <template v-else-if="isDateField(key)">
                {{ formatDate(value) }}
              </template>
              <template v-else>
                {{ value || '-' }}
              </template>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 操作按钮 -->
        <div class="action-section" v-if="currentTask.status === 'pending'">
          <el-button type="success" size="large" @click="handleApprove(currentTask)">通过</el-button>
          <el-button type="danger" size="large" @click="handleReject(currentTask)">驳回</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Document, Select, CloseBold, Finished, Search
} from '@element-plus/icons-vue'
import {
  workflowTaskApi,
  TaskStatusLabels,
  TaskStatusTypes,
  WorkflowTypes,
  getWorkflowTypeLabel,
  type WorkflowTask,
  type TaskStatus,
  type TaskListParams
} from '@/api/workflow'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const batchSubmitting = ref(false)

// 数据
const tableRef = ref()
const tableData = ref<WorkflowTask[]>([])
const selectedTasks = ref<WorkflowTask[]>([])

// 统计数据
const stats = reactive({
  pending: 0,
  approved: 0,
  rejected: 0,
  total: 0
})

// 筛选表单
const filterForm = reactive({
  search: '',
  status: '' as TaskStatus | '',
  workflow_type: ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 当前操作的任务
const currentTask = ref<WorkflowTask | null>(null)

// 审批弹窗
const approvalDialogVisible = ref(false)
const approvalAction = ref<'approve' | 'reject'>('approve')
const approvalFormRef = ref<FormInstance>()
const approvalForm = reactive({
  comment: ''
})

// 审批表单校验
const approvalRules = computed<FormRules>(() => ({
  comment: approvalAction.value === 'reject'
    ? [{ required: true, message: '请输入驳回原因', trigger: 'blur' }]
    : []
}))

// 批量审批弹窗
const batchDialogVisible = ref(false)
const batchAction = ref<'approve' | 'reject'>('approve')
const batchFormRef = ref<FormInstance>()
const batchForm = reactive({
  comment: ''
})

// 批量审批表单校验
const batchRules = computed<FormRules>(() => ({
  comment: batchAction.value === 'reject'
    ? [{ required: true, message: '请输入驳回原因', trigger: 'blur' }]
    : []
}))

// 详情抽屉
const detailDrawerVisible = ref(false)

// 工具函数
const formatDate = (date: string, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-'
  return dayjs(date).format(format)
}

const formatMoney = (value: any) => {
  const num = Number(value)
  if (isNaN(num)) return value
  return '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 判断是否可以选择（只有待审批状态可选）
const canSelect = (row: WorkflowTask) => row.status === 'pending'

// 字段标签映射
const fieldLabels: Record<string, string> = {
  contract_name: '合同名称',
  contract_no: '合同编号',
  amount: '金额',
  total_amount: '总金额',
  start_date: '开始日期',
  end_date: '结束日期',
  party_a: '甲方',
  party_b: '乙方',
  payment_method: '付款方式',
  description: '描述',
  reason: '原因',
  remark: '备注',
  attachments: '附件',
  supplier: '供应商',
  supplier_name: '供应商名称',
  product_name: '商品名称',
  quantity: '数量',
  unit_price: '单价',
  leave_type: '请假类型',
  leave_days: '请假天数',
  start_time: '开始时间',
  end_time: '结束时间',
  expense_type: '费用类型',
  expense_items: '费用明细'
}

const getFieldLabel = (key: string): string => {
  return fieldLabels[key] || key
}

const isMoneyField = (key: string): boolean => {
  const moneyFields = ['amount', 'total_amount', 'unit_price', 'price', 'cost']
  return moneyFields.some(f => key.toLowerCase().includes(f))
}

const isDateField = (key: string): boolean => {
  const dateFields = ['date', 'time', 'created_at', 'updated_at']
  return dateFields.some(f => key.toLowerCase().includes(f))
}

const getFieldSpan = (value: any): number => {
  if (typeof value === 'object' && value !== null) return 2
  if (typeof value === 'string' && value.length > 50) return 2
  return 1
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params: TaskListParams = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    if (filterForm.search) params.search = filterForm.search
    if (filterForm.status) params.status = filterForm.status
    if (filterForm.workflow_type) params.workflow_type = filterForm.workflow_type
    
    const res = await workflowTaskApi.getPendingList(params)
    tableData.value = res.list || []
    pagination.total = res.total || 0
  } catch (e) {
    console.error('加载失败', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 加载统计
const loadStats = async () => {
  try {
    // 分别获取各状态的数量
    const [pending, approved, rejected] = await Promise.all([
      workflowTaskApi.getPendingList({ status: 'pending', pageSize: 1 }),
      workflowTaskApi.getPendingList({ status: 'approved', pageSize: 1 }),
      workflowTaskApi.getPendingList({ status: 'rejected', pageSize: 1 })
    ])
    
    stats.pending = pending.total || 0
    stats.approved = approved.total || 0
    stats.rejected = rejected.total || 0
    stats.total = stats.pending + stats.approved + stats.rejected
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

// 选择变化
const handleSelectionChange = (selection: WorkflowTask[]) => {
  selectedTasks.value = selection
}

// 事件处理
const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

// 单个审批
const handleApprove = (row: WorkflowTask) => {
  currentTask.value = row
  approvalAction.value = 'approve'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

const handleReject = (row: WorkflowTask) => {
  currentTask.value = row
  approvalAction.value = 'reject'
  approvalForm.comment = ''
  approvalDialogVisible.value = true
}

const confirmApproval = async () => {
  if (!approvalFormRef.value || !currentTask.value) return
  
  try {
    await approvalFormRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    const action = approvalAction.value
    const method = action === 'approve' ? workflowTaskApi.approve : workflowTaskApi.reject
    
    await method(currentTask.value.id, { comment: approvalForm.comment })
    
    ElMessage.success(action === 'approve' ? '审批通过' : '已驳回')
    approvalDialogVisible.value = false
    loadData()
    loadStats()
  } catch (e) {
    console.error('操作失败', e)
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 批量审批
const handleBatchApprove = () => {
  if (selectedTasks.value.length === 0) {
    ElMessage.warning('请选择要审批的任务')
    return
  }
  
  batchAction.value = 'approve'
  batchForm.comment = ''
  batchDialogVisible.value = true
}

const handleBatchReject = () => {
  if (selectedTasks.value.length === 0) {
    ElMessage.warning('请选择要审批的任务')
    return
  }
  
  batchAction.value = 'reject'
  batchForm.comment = ''
  batchDialogVisible.value = true
}

const confirmBatchApproval = async () => {
  if (!batchFormRef.value || selectedTasks.value.length === 0) return
  
  try {
    await batchFormRef.value.validate()
  } catch {
    return
  }
  
  batchSubmitting.value = true
  try {
    const taskIds = selectedTasks.value.map(t => t.id)
    const action = batchAction.value
    const method = action === 'approve' ? workflowTaskApi.batchApprove : workflowTaskApi.batchReject
    
    const result = await method({
      task_ids: taskIds,
      action,
      comment: batchForm.comment
    })
    
    if (result.failed > 0) {
      ElMessage.warning(`成功 ${result.success} 个，失败 ${result.failed} 个`)
    } else {
      ElMessage.success(`批量${action === 'approve' ? '通过' : '驳回'}成功`)
    }
    
    batchDialogVisible.value = false
    tableRef.value?.clearSelection()
    loadData()
    loadStats()
  } catch (e) {
    console.error('批量操作失败', e)
    ElMessage.error('批量操作失败')
  } finally {
    batchSubmitting.value = false
  }
}

// 查看详情
const handleViewDetail = async (row: WorkflowTask) => {
  try {
    // 如果需要获取更详细的表单数据，可以调用详情接口
    // const detail = await workflowTaskApi.getDetail(row.id)
    // currentTask.value = detail
    currentTask.value = row
    detailDrawerVisible.value = true
  } catch (e) {
    console.error('获取详情失败', e)
    ElMessage.error('获取详情失败')
  }
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.workflow-tasks-page {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    border-radius: 12px;
    border: none;
    
    &.total {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }
      
      .stat-value {
        color: #f59e0b;
      }
    }
    
    &.approved {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      }
      
      .stat-value {
        color: #10b981;
      }
    }
    
    &.rejected {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }
      
      .stat-value {
        color: #ef4444;
      }
    }
    
    &.total-count {
      background: linear-gradient(135deg, #e8f4fd 0%, #d4e9fc 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      }
      
      .stat-value {
        color: #3b82f6;
      }
    }

    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 24px;
    }

    .stat-info {
      .stat-label {
        font-size: 13px;
        color: #909399;
      }
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        margin-top: 4px;
      }
    }
  }

  .filter-card {
    margin-bottom: 20px;
    border-radius: 12px;
    
    :deep(.el-card__body) {
      padding: 16px 20px;
    }
    
    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      
      .el-form-item {
        margin-bottom: 0;
        margin-right: 16px;
        
        &:last-child {
          margin-right: 0;
        }
      }
    }
  }

  .table-card {
    border-radius: 12px;
    
    :deep(.el-card__body) {
      padding: 0;
    }

    :deep(.el-table) {
      th.el-table__cell {
        background: #fafafa;
        color: #1a1a2e;
        font-weight: 500;
      }
      
      .workflow-name {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .name {
          font-weight: 500;
        }
        
        .type-tag {
          font-size: 10px;
        }
      }
      
      .initiator {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .avatar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          font-size: 12px;
        }
        
        .info {
          display: flex;
          flex-direction: column;
          
          .name {
            font-size: 13px;
            color: #333;
          }
          
          .dept {
            font-size: 11px;
            color: #909399;
          }
        }
      }
      
      .time-cell {
        display: flex;
        flex-direction: column;
        
        .date {
          font-size: 13px;
          color: #333;
        }
        
        .time {
          font-size: 11px;
          color: #909399;
        }
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .batch-info {
    .selected-tasks {
      max-height: 120px;
      overflow-y: auto;
    }
  }
}

// 详情抽屉样式
.detail-drawer {
  padding: 0 20px 20px;
  
  .info-section {
    margin-bottom: 24px;
    
    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 12px;
      color: #1a1a2e;
    }
  }
  
  .json-value {
    margin: 0;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    overflow-x: auto;
  }
  
  .money {
    font-weight: 600;
    color: #333;
  }
  
  .action-section {
    display: flex;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid #ebeef5;
    margin-top: 24px;
  }
}
</style>