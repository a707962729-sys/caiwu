<template>
  <div class="invoices-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">票据总数</div>
              <div class="stat-value">{{ stats.total }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card amount">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">总金额</div>
              <div class="stat-value">{{ formatMoney(stats.total_amount) }}</div>
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
              <div class="stat-label">待审核</div>
              <div class="stat-value">{{ stats.pendingReview || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card verified">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已审核</div>
              <div class="stat-value">{{ getStatusCount('verified') }}</div>
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
            placeholder="票据号/开票单位/付款单位" 
            clearable 
            style="width: 220px"
            @keyup.enter="handleFilter"
            @clear="handleFilter"
          >
            <template #append>
              <el-button :icon="Search" @click="handleFilter" />
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 130px" @change="handleFilter">
            <el-option label="增值税发票" value="vat_invoice" />
            <el-option label="收据" value="receipt" />
            <el-option label="支票" value="check" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 110px" @change="handleFilter">
            <el-option label="待处理" value="pending" />
            <el-option label="待审核" value="pending_review" />
            <el-option label="已审核" value="verified" />
            <el-option label="已支付" value="paid" />
            <el-option label="已作废" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增票据</el-button>
          <el-button :icon="Download" @click="handleExport">导出</el-button>
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
      >
        <el-table-column prop="invoice_no" label="票据号" min-width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewInvoice(row)">{{ row.invoice_no }}</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="invoice_type" label="类型" width="140" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.invoice_type || '电子发票' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="金额" width="130" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.total_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="issue_date" label="日期" width="110" align="center">
          <template #default="{ row }">
            {{ formatDate(row.issue_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="seller_name" label="开票单位" min-width="140">
          <template #default="{ row }">
            {{ row.seller_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="buyer_name" label="付款单位" min-width="140">
          <template #default="{ row }">
            {{ row.buyer_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending_review'" link type="success" @click="handleVerify(row)">审核</el-button>
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
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

    <!-- 新增/编辑票据弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      :close-on-click-modal="false"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="90px"
        style="padding-right: 20px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="票据号" prop="invoice_no">
              <el-input v-model="formData.invoice_no" placeholder="请输入票据号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="票据类型" prop="type">
              <el-select v-model="formData.type" placeholder="选择类型" style="width: 100%">
                <el-option label="增值税发票" value="vat_invoice" />
                <el-option label="收据" value="receipt" />
                <el-option label="支票" value="check" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="金额" prop="amount">
              <el-input-number
                v-model="formData.amount"
                :precision="2"
                :min="0"
                :max="999999999"
                placeholder="请输入金额"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="日期" prop="invoice_date">
              <el-date-picker
                v-model="formData.invoice_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开票单位">
              <el-input v-model="formData.issuer" placeholder="开票单位名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="付款单位">
              <el-input v-model="formData.payer" placeholder="付款单位名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-select v-model="formData.status" placeholder="选择状态" style="width: 100%">
            <el-option label="待审核" value="pending" />
            <el-option label="已审核" value="verified" />
            <el-option label="已支付" value="paid" />
            <el-option label="已作废" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="添加备注（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除票据「{{ deleteTarget?.invoice_no }}」吗？</p>
      <p class="delete-warning">此操作不可恢复，请谨慎操作。</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确定删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Plus, Download, Search, Document, Money, Clock, CircleCheck
} from '@element-plus/icons-vue'
import {
  invoiceApi,
  type Invoice,
  type InvoiceCreateParams,
  type InvoiceType,
  type InvoiceStatus,
  getInvoiceTypeLabel as getTypeLabel,
  getInvoiceStatusLabel as getStatusLabel,
  getInvoiceTypeTagType,
  getInvoiceStatusTagType
} from '@/api/invoice'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Invoice[]>([])

// 统计数据
const stats = reactive({
  total: 0,
  total_amount: 0,
  pendingReview: 0,
  by_type: [] as Array<{ type: string; count: number; amount: number }>,
  by_status: [] as Array<{ status: string; count: number; amount: number }>
})

// 筛选表单
const filterForm = reactive({
  search: '',
  type: '' as InvoiceType | '',
  status: '' as InvoiceStatus | '',
  startDate: '',
  endDate: ''
})

// 日期范围
const dateRange = ref<[string, string] | null>(null)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑票据' : '新增票据')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Invoice | null>(null)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<InvoiceCreateParams & { id?: number }>({
  invoice_no: '',
  type: 'vat_invoice',
  amount: 0,
  invoice_date: '',
  status: 'pending',
  issuer: '',
  payer: '',
  description: ''
})

// 表单校验
const formRules: FormRules = {
  invoice_no: [
    { required: true, message: '请输入票据号', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择票据类型', trigger: 'change' }
  ],
  amount: [
    { required: true, message: '请输入金额', trigger: 'blur' }
  ],
  invoice_date: [
    { required: true, message: '请选择日期', trigger: 'change' }
  ]
}

// 计算属性
const getStatusCount = (status: InvoiceStatus) => {
  const item = stats.by_status.find(s => s.status === status)
  return item ? item.count : 0
}

// 工具函数
const formatMoney = (n: number) => {
  if (!n && n !== 0) return '¥0.00'
  if (Math.abs(n) >= 10000) {
    return '¥' + (n / 10000).toFixed(2) + '万'
  }
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD')
}

const formatDateTime = (datetime: string) => {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await invoiceApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filterForm.search || undefined,
      type: filterForm.type || undefined,
      status: filterForm.status || undefined,
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined
    })
    
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
    const res = await invoiceApi.getStats()
    stats.total = res.total || 0
    stats.total_amount = res.totalAmount || 0
    stats.by_type = res.by_type || []
    stats.by_status = res.byStatus || []
    stats.pendingReview = res.pendingReview || 0
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

// 事件处理
const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleDateChange = (val: [string, string] | null) => {
  if (val) {
    filterForm.startDate = val[0]
    filterForm.endDate = val[1]
  } else {
    filterForm.startDate = ''
    filterForm.endDate = ''
  }
  handleFilter()
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

// 新增票据
const handleAdd = () => {
  resetForm()
  // 默认日期为今天
  formData.invoice_date = dayjs().format('YYYY-MM-DD')
  dialogVisible.value = true
}

// 编辑票据
const handleEdit = (row: Invoice) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    invoice_no: row.invoice_no,
    type: row.type,
    amount: row.amount,
    invoice_date: row.invoice_date,
    status: row.status,
    issuer: row.issuer,
    payer: row.payer,
    description: row.description
  })
  dialogVisible.value = true
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    if (formData.id) {
      await invoiceApi.update(formData.id, {
        invoice_no: formData.invoice_no,
        type: formData.type,
        amount: formData.amount,
        invoice_date: formData.invoice_date,
        status: formData.status,
        issuer: formData.issuer,
        payer: formData.payer,
        description: formData.description
      })
      ElMessage.success('更新成功')
    } else {
      await invoiceApi.create({
        invoice_no: formData.invoice_no,
        type: formData.type,
        amount: formData.amount,
        invoice_date: formData.invoice_date,
        status: formData.status,
        issuer: formData.issuer,
        payer: formData.payer,
        description: formData.description
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadData()
    loadStats()
  } catch (e) {
    console.error('提交失败', e)
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 查看发票详情
const viewInvoice = (row: Invoice) => {
  // TODO: 打开发票详情弹窗或跳转详情页
  ElMessage.info(`查看发票: ${row.invoice_no}`)
}

// 审核发票
const handleVerify = async (row: Invoice) => {
  try {
    await invoiceApi.verify(row.id)
    ElMessage.success('审核通过')
    loadData()
    loadStats()
  } catch (e) {
    console.error('审核失败', e)
    ElMessage.error('审核失败')
  }
}

// 状态标签类型
const getStatusTagType = (status: string) => {
  const types: Record<string, string> = {
    pending: 'info',
    pending_review: 'warning',
    verified: 'success',
    paid: 'primary',
    cancelled: 'danger'
  }
  return types[status] || 'info'
}

// 状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待处理',
    pending_review: '待审核',
    verified: '已审核',
    paid: '已支付',
    cancelled: '已作废'
  }
  return texts[status] || status
}

// 删除票据
const handleDelete = (row: Invoice) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await invoiceApi.delete(deleteTarget.value.id)
    ElMessage.success('删除成功')
    deleteDialogVisible.value = false
    loadData()
    loadStats()
  } catch (e) {
    console.error('删除失败', e)
    ElMessage.error('删除失败')
  } finally {
    deleting.value = false
  }
}

// 导出
const handleExport = async () => {
  try {
    const blob = await invoiceApi.export({
      search: filterForm.search || undefined,
      type: filterForm.type || undefined,
      status: filterForm.status || undefined,
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `票据列表_${dayjs().format('YYYY-MM-DD')}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (e) {
    console.error('导出失败', e)
    ElMessage.error('导出失败')
  }
}

// 重置表单
const resetForm = () => {
  formData.id = undefined
  formData.invoice_no = ''
  formData.type = 'vat_invoice'
  formData.amount = 0
  formData.invoice_date = ''
  formData.status = 'pending'
  formData.issuer = ''
  formData.payer = ''
  formData.description = ''
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.invoices-page {
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
    
    &.amount {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }
      
      .stat-value {
        color: #07c160;
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
    
    &.verified {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      }
      
      .stat-value {
        color: #0ea5e9;
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      
      .invoice-no {
        font-weight: 500;
        color: #303133;
      }
      
      .amount {
        font-weight: 600;
        color: #333;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .delete-warning {
    margin-top: 12px;
    padding: 10px 12px;
    background: #fef2f2;
    border-radius: 6px;
    color: #dc2626;
    font-size: 13px;
  }
}
</style>