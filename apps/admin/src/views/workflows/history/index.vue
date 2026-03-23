<template>
  <div class="workflow-history-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总审批数</div>
              <div class="stat-value">{{ stats.total }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card pending">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">待审批</div>
              <div class="stat-value">{{ stats.pending }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card approved">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CircleCheck /></el-icon>
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
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已拒绝</div>
              <div class="stat-value">{{ stats.rejected }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选区域 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="searchForm" class="filter-form">
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.search"
            placeholder="流程名称/单号/发起人"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #append>
              <el-button :icon="Search" @click="handleSearch" />
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="审批状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部状态"
            clearable
            style="width: 120px"
            @change="handleSearch"
          >
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已撤销" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="流程类型">
          <el-select
            v-model="searchForm.workflow_type"
            placeholder="全部类型"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option label="费用报销" value="expense" />
            <el-option label="付款申请" value="payment" />
            <el-option label="合同审批" value="contract" />
            <el-option label="采购审批" value="purchase" />
            <el-option label="请假申请" value="leave" />
            <el-option label="采购订单" value="purchase_order" />
            <el-option label="销售订单" value="sales_order" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            @change="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="workflow_name" label="流程名称" min-width="150">
          <template #default="{ row }">
            <div class="workflow-info">
              <el-tag size="small" type="info" effect="plain">
                {{ getWorkflowTypeLabel(row.workflow_type) }}
              </el-tag>
              <span class="title">{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="business_no" label="业务单号" width="140">
          <template #default="{ row }">
            <span v-if="row.business_no">{{ row.business_no }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="initiator_name" label="发起人" width="100" />
        <el-table-column prop="approver_name" label="审批人" width="100" />
        <el-table-column label="审批结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.status === 'pending'"
              type="warning"
              size="small"
            >
              待审批
            </el-tag>
            <el-tag
              v-else
              :type="getApprovalResultType(row.result)"
              size="small"
            >
              {{ getApprovalResultLabel(row.result) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="审批意见" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.comment">{{ row.comment }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="发起时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="processed_at" label="审批时间" width="160">
          <template #default="{ row }">
            <span v-if="row.processed_at">{{ formatDateTime(row.processed_at) }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="handleViewDetail(row)">
              详情
            </el-button>
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

    <!-- 流程详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="审批详情"
      width="700px"
      destroy-on-close
    >
      <template v-if="currentInstance">
        <!-- 基本信息 -->
        <el-descriptions :column="2" border class="instance-info">
          <el-descriptions-item label="流程类型">
            <el-tag size="small" type="info" effect="plain">
              {{ getWorkflowTypeLabel(currentInstance.workflow_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="流程名称">{{ currentInstance.title }}</el-descriptions-item>
          <el-descriptions-item label="业务单号">{{ currentInstance.business_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审批状态">
            <el-tag :type="getApprovalStatusType(currentInstance.status)" size="small">
              {{ getApprovalStatusLabel(currentInstance.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="发起人">{{ currentInstance.initiator_name }}</el-descriptions-item>
          <el-descriptions-item label="发起时间">{{ formatDateTime(currentInstance.created_at) }}</el-descriptions-item>
          <el-descriptions-item v-if="currentInstance.completed_at" label="完成时间">
            {{ formatDateTime(currentInstance.completed_at) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentInstance.result" label="最终结果">
            <el-tag :type="getApprovalResultType(currentInstance.result)" size="small">
              {{ getApprovalResultLabel(currentInstance.result) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 审批链路时间线 -->
        <el-divider content-position="left">审批链路</el-divider>
        <div class="approval-timeline">
          <el-timeline>
            <el-timeline-item
              v-for="(step, index) in currentInstance.steps"
              :key="step.id"
              :type="getTimelineType(step.status)"
              :hollow="step.status === 'pending'"
              :timestamp="step.processed_at ? formatDateTime(step.processed_at) : ''"
              placement="top"
            >
              <el-card shadow="never" class="step-card" :class="step.status">
                <div class="step-header">
                  <div class="step-info">
                    <span class="step-no">第{{ step.step_no }}步</span>
                    <span class="step-name">{{ step.step_name }}</span>
                  </div>
                  <el-tag
                    :type="getApprovalStatusType(step.status)"
                    size="small"
                  >
                    {{ getApprovalStatusLabel(step.status) }}
                  </el-tag>
                </div>
                <div class="step-body">
                  <div class="approver-info">
                    <el-icon><User /></el-icon>
                    <span>审批人：{{ step.approver_name }}</span>
                  </div>
                  <div v-if="step.comment" class="step-comment">
                    <el-icon><ChatDotRound /></el-icon>
                    <span>{{ step.comment }}</span>
                  </div>
                  <div v-if="step.result" class="step-result">
                    <el-tag :type="getApprovalResultType(step.result)" size="small">
                      {{ getApprovalResultLabel(step.result) }}
                    </el-tag>
                  </div>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search, Refresh, Document, Clock, CircleCheck, CircleClose, User, ChatDotRound
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  workflowApi,
  getApprovalStatusLabel,
  getApprovalStatusType,
  getApprovalResultLabel,
  getApprovalResultType,
  getWorkflowTypeLabel,
  type ApprovalTask,
  type WorkflowInstance,
  type ApprovalStatus,
  type ApprovalStep
} from '@/api/workflow'

// 加载状态
const loading = ref(false)

// 数据
const tableData = ref<ApprovalTask[]>([])
const currentInstance = ref<WorkflowInstance | null>(null)

// 统计数据
const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0
})

// 搜索表单
const searchForm = reactive({
  search: '',
  status: '' as ApprovalStatus | '',
  workflow_type: ''
})
const dateRange = ref<[string, string] | null>(null)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const detailDialogVisible = ref(false)

// 工具函数
const formatDateTime = (datetime: string): string => {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

const getTimelineType = (status: ApprovalStatus): 'primary' | 'success' | 'danger' | 'warning' | 'info' => {
  const types: Record<ApprovalStatus, 'primary' | 'success' | 'danger' | 'warning' | 'info'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: searchForm.search || undefined,
      status: searchForm.status || undefined,
      workflow_type: searchForm.workflow_type || undefined,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1]
    }
    const res = await workflowApi.getHistory(params)
    tableData.value = res.list || []
    pagination.total = res.total || 0
    
    // 更新统计
    updateStats(res.list || [])
  } catch (e) {
    console.error('加载失败', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 更新统计数据
const updateStats = (list: ApprovalTask[]) => {
  stats.total = pagination.total
  stats.pending = list.filter(item => item.status === 'pending').length
  stats.approved = list.filter(item => item.result === 'approved').length
  stats.rejected = list.filter(item => item.result === 'rejected').length
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 重置
const handleReset = () => {
  searchForm.search = ''
  searchForm.status = ''
  searchForm.workflow_type = ''
  dateRange.value = null
  handleSearch()
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

// 点击行查看详情
const handleRowClick = (row: ApprovalTask) => {
  handleViewDetail(row)
}

// 查看详情
const handleViewDetail = async (row: ApprovalTask) => {
  try {
    currentInstance.value = await workflowApi.getInstanceDetail(row.instance_id)
    detailDialogVisible.value = true
  } catch (e) {
    console.error('获取详情失败', e)
    ElMessage.error('获取详情失败')
  }
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.workflow-history-page {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    border-radius: 12px;
    border: none;

    &.total {
      background: linear-gradient(135deg, #e8f4fd 0%, #d4e9fc 100%);

      .stat-icon {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      }

      .stat-value {
        color: #3b82f6;
      }
    }

    &.pending {
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
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }

      .stat-value {
        color: #07c160;
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

      .el-table__row {
        cursor: pointer;
        
        &:hover {
          background-color: #f5f7fa;
        }
      }

      .workflow-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .title {
          font-weight: 500;
        }
      }

      .text-muted {
        color: #c0c4cc;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .instance-info {
    margin-bottom: 20px;
  }

  .approval-timeline {
    max-height: 400px;
    overflow-y: auto;
    padding-right: 10px;

    .step-card {
      &.pending {
        border-color: #e6a23c;
      }

      &.approved {
        border-color: #07c160;
      }

      &.rejected {
        border-color: #f56c6c;
      }

      .step-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .step-info {
          display: flex;
          align-items: center;
          gap: 8px;

          .step-no {
            font-size: 12px;
            color: #909399;
            background: #f4f4f5;
            padding: 2px 6px;
            border-radius: 4px;
          }

          .step-name {
            font-weight: 500;
            color: #303133;
          }
        }
      }

      .step-body {
        .approver-info {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #606266;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .step-comment {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          color: #606266;
          font-size: 13px;
          padding: 8px 12px;
          background: #f5f7fa;
          border-radius: 6px;
          margin-bottom: 8px;

          .el-icon {
            margin-top: 2px;
            color: #909399;
          }
        }

        .step-result {
          margin-top: 8px;
        }
      }
    }
  }
}
</style>