<template>
  <div class="payables-page">
    <!-- 账龄分析卡片 -->
    <el-card shadow="never" class="aging-card">
      <template #header>
        <div class="card-header">
          <span>账龄分析</span>
          <el-button link type="primary" @click="loadAgingAnalysis">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
      </template>
      <div v-loading="agingLoading" class="aging-content">
        <el-row :gutter="20">
          <el-col :span="4">
            <div class="aging-item total">
              <div class="aging-label">应付总额</div>
              <div class="aging-value">{{ formatAmount(agingData.total) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="aging-item not-due">
              <div class="aging-label">未到期</div>
              <div class="aging-value">{{ formatAmount(agingData.not_due) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="aging-item overdue-0-30">
              <div class="aging-label">逾期0-30天</div>
              <div class="aging-value">{{ formatAmount(agingData.overdue_0_30) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="aging-item overdue-30-60">
              <div class="aging-label">逾期30-60天</div>
              <div class="aging-value">{{ formatAmount(agingData.overdue_30_60) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="aging-item overdue-60-90">
              <div class="aging-label">逾期60-90天</div>
              <div class="aging-value">{{ formatAmount(agingData.overdue_60_90) }}</div>
            </div>
          </el-col>
          <el-col :span="4">
            <div class="aging-item overdue-90-plus">
              <div class="aging-label">逾期90天以上</div>
              <div class="aging-value">{{ formatAmount(agingData.overdue_90_plus) }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="供应商">
          <el-select 
            v-model="filterForm.supplier_id" 
            placeholder="全部供应商" 
            clearable 
            filterable
            style="width: 180px" 
            @change="handleFilter"
          >
            <el-option
              v-for="item in supplierList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="待付款" value="pending" />
            <el-option label="部分付款" value="partial" />
            <el-option label="已付款" value="paid" />
            <el-option label="已逾期" value="overdue" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期日">
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
        <el-form-item label="搜索">
          <el-input 
            v-model="filterForm.search" 
            placeholder="发票号/描述" 
            clearable 
            style="width: 180px"
            @keyup.enter="handleFilter"
            @clear="handleFilter"
          >
            <template #append>
              <el-button :icon="Search" @click="handleFilter" />
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增应付</el-button>
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
        <el-table-column prop="supplier_name" label="供应商" min-width="150">
          <template #default="{ row }">
            <span class="supplier-name">{{ row.supplier_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="invoice_no" label="发票号" width="140">
          <template #default="{ row }">
            {{ row.invoice_no || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="应付金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-text">{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="已付金额" width="120" align="right">
          <template #default="{ row }">
            <span class="paid-amount">{{ formatAmount(row.paid_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="unpaid_amount" label="未付金额" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.unpaid_amount > 0 ? 'unpaid-amount' : ''">
              {{ formatAmount(row.unpaid_amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="due_date" label="到期日" width="110">
          <template #default="{ row }">
            <span :class="{ 'overdue-date': isOverdue(row) }">
              {{ formatDate(row.due_date) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getPayableStatusType(row.status)" size="small">
              {{ getPayableStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="备注" min-width="150">
          <template #default="{ row }">
            <span class="description-text">{{ row.description || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button 
              v-if="row.unpaid_amount > 0" 
              link 
              type="success" 
              @click="handlePay(row)"
            >
              付款
            </el-button>
            <el-button 
              v-if="row.paid_amount > 0" 
              link 
              type="info" 
              @click="handleViewPayments(row)"
            >
              记录
            </el-button>
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

    <!-- 新增/编辑弹窗 -->
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
        label-width="100px"
        style="padding-right: 20px"
      >
        <el-form-item label="供应商" prop="supplier_id">
          <el-select 
            v-model="formData.supplier_id" 
            placeholder="请选择供应商" 
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="item in supplierList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="发票号" prop="invoice_no">
          <el-input v-model="formData.invoice_no" placeholder="请输入发票号" maxlength="50" />
        </el-form-item>
        <el-form-item label="应付金额" prop="amount">
          <el-input-number 
            v-model="formData.amount" 
            :precision="2" 
            :min="0.01" 
            :max="99999999.99"
            style="width: 100%"
            placeholder="请输入应付金额"
          />
        </el-form-item>
        <el-form-item label="到期日" prop="due_date">
          <el-date-picker
            v-model="formData.due_date"
            type="date"
            placeholder="请选择到期日"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 付款弹窗 -->
    <el-dialog
      v-model="paymentDialogVisible"
      title="付款"
      width="500px"
      :close-on-click-modal="false"
      @close="resetPaymentForm"
    >
      <div class="payment-info">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="供应商">{{ paymentTarget?.supplier_name }}</el-descriptions-item>
          <el-descriptions-item label="应付金额">{{ formatAmount(paymentTarget?.amount || 0) }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">{{ formatAmount(paymentTarget?.paid_amount || 0) }}</el-descriptions-item>
          <el-descriptions-item label="未付金额">
            <span class="unpaid-amount">{{ formatAmount(paymentTarget?.unpaid_amount || 0) }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <el-form
        ref="paymentFormRef"
        :model="paymentData"
        :rules="paymentRules"
        label-width="100px"
        style="margin-top: 20px; padding-right: 20px"
      >
        <el-form-item label="付款金额" prop="amount">
          <el-input-number 
            v-model="paymentData.amount" 
            :precision="2" 
            :min="0.01" 
            :max="paymentTarget?.unpaid_amount || 99999999.99"
            style="width: 100%"
            placeholder="请输入付款金额"
          />
        </el-form-item>
        <el-form-item label="付款日期" prop="payment_date">
          <el-date-picker
            v-model="paymentData.payment_date"
            type="date"
            placeholder="请选择付款日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="付款方式" prop="payment_method">
          <el-select v-model="paymentData.payment_method" placeholder="请选择付款方式" style="width: 100%">
            <el-option label="银行转账" value="bank" />
            <el-option label="现金" value="cash" />
            <el-option label="支票" value="check" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="微信" value="wechat" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款账户" prop="account">
          <el-input v-model="paymentData.account" placeholder="请输入付款账户" maxlength="100" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="paymentData.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
            maxlength="200"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="paymentSubmitting" @click="handlePaymentSubmit">确认付款</el-button>
      </template>
    </el-dialog>

    <!-- 付款记录弹窗 -->
    <el-dialog
      v-model="paymentRecordsDialogVisible"
      title="付款记录"
      width="700px"
    >
      <el-table :data="paymentRecords" v-loading="paymentRecordsLoading" stripe>
        <el-table-column prop="payment_date" label="付款日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.payment_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="付款金额" width="120" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column prop="payment_method" label="付款方式" width="100">
          <template #default="{ row }">
            {{ getPaymentMethodLabel(row.payment_method) }}
          </template>
        </el-table-column>
        <el-table-column prop="account" label="付款账户" min-width="140">
          <template #default="{ row }">
            {{ row.account || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120">
          <template #default="{ row }">
            {{ row.remark || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="记录时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除该应付账款吗？</p>
      <p class="delete-info">
        <strong>{{ deleteTarget?.supplier_name }}</strong>
        <span>{{ formatAmount(deleteTarget?.amount || 0) }}</span>
      </p>
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
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import { 
  payableApi, 
  type Payable, 
  type PayableCreateParams,
  type PayableUpdateParams,
  type PaymentRecord,
  type AgingAnalysis,
  getPayableStatusLabel,
  getPayableStatusType,
  getPaymentMethodLabel,
  formatAmount
} from '@/api/payable'
import { supplierApi, type Supplier } from '@/api/supplier'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const agingLoading = ref(false)
const paymentSubmitting = ref(false)
const paymentRecordsLoading = ref(false)

// 数据
const tableData = ref<Payable[]>([])
const supplierList = ref<Supplier[]>([])
const agingData = ref<AgingAnalysis>({
  total: 0,
  not_due: 0,
  overdue_0_30: 0,
  overdue_30_60: 0,
  overdue_60_90: 0,
  overdue_90_plus: 0,
  by_supplier: []
})
const paymentRecords = ref<PaymentRecord[]>([])

// 筛选表单
const filterForm = reactive({
  supplier_id: undefined as number | undefined,
  status: '' as '' | 'pending' | 'partial' | 'paid' | 'overdue',
  search: ''
})
const dateRange = ref<[string, string] | null>(null)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑应付账款' : '新增应付账款')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Payable | null>(null)
const paymentDialogVisible = ref(false)
const paymentTarget = ref<Payable | null>(null)
const paymentRecordsDialogVisible = ref(false)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<PayableCreateParams & { id?: number }>({
  supplier_id: undefined as unknown as number,
  invoice_no: '',
  amount: 0,
  due_date: '',
  description: ''
})

// 表单校验规则
const formRules: FormRules = {
  supplier_id: [
    { required: true, message: '请选择供应商', trigger: 'change' }
  ],
  amount: [
    { required: true, message: '请输入应付金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '金额必须大于0', trigger: 'blur' }
  ],
  due_date: [
    { required: true, message: '请选择到期日', trigger: 'change' }
  ]
}

// 付款表单
const paymentFormRef = ref<FormInstance>()
const paymentData = reactive({
  amount: 0,
  payment_date: dayjs().format('YYYY-MM-DD'),
  payment_method: 'bank',
  account: '',
  remark: ''
})

// 付款表单校验规则
const paymentRules: FormRules = {
  amount: [
    { required: true, message: '请输入付款金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '金额必须大于0', trigger: 'blur' }
  ],
  payment_date: [
    { required: true, message: '请选择付款日期', trigger: 'change' }
  ],
  payment_method: [
    { required: true, message: '请选择付款方式', trigger: 'change' }
  ]
}

// 工具函数
const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD')
}

const formatDateTime = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const isOverdue = (row: Payable) => {
  return row.status === 'overdue' || (row.unpaid_amount > 0 && dayjs(row.due_date).isBefore(dayjs(), 'day'))
}

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    const res = await supplierApi.getList({ pageSize: 1000, status: 'active' })
    supplierList.value = res.list || []
  } catch (e) {
    console.error('加载供应商失败', e)
  }
}

// 加载账龄分析
const loadAgingAnalysis = async () => {
  agingLoading.value = true
  try {
    const res = await payableApi.getAgingAnalysis()
    agingData.value = res
  } catch (e) {
    console.error('加载账龄分析失败', e)
  } finally {
    agingLoading.value = false
  }
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await payableApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      supplier_id: filterForm.supplier_id,
      status: filterForm.status || undefined,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      search: filterForm.search || undefined
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

// 事件处理
const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleDateChange = () => {
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

// 新增
const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: Payable) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    supplier_id: row.supplier_id,
    invoice_no: row.invoice_no || '',
    amount: row.amount,
    due_date: row.due_date,
    description: row.description || ''
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
      const updateData: PayableUpdateParams = {
        supplier_id: formData.supplier_id,
        invoice_no: formData.invoice_no,
        amount: formData.amount,
        due_date: formData.due_date,
        description: formData.description
      }
      await payableApi.update(formData.id, updateData)
      ElMessage.success('更新成功')
    } else {
      await payableApi.create({
        supplier_id: formData.supplier_id,
        invoice_no: formData.invoice_no,
        amount: formData.amount,
        due_date: formData.due_date,
        description: formData.description
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadData()
    loadAgingAnalysis()
  } catch (e) {
    console.error('提交失败', e)
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 付款
const handlePay = (row: Payable) => {
  paymentTarget.value = row
  paymentData.amount = row.unpaid_amount
  paymentData.payment_date = dayjs().format('YYYY-MM-DD')
  paymentData.payment_method = 'bank'
  paymentData.account = ''
  paymentData.remark = ''
  paymentDialogVisible.value = true
}

// 提交付款
const handlePaymentSubmit = async () => {
  if (!paymentFormRef.value || !paymentTarget.value) return
  
  try {
    await paymentFormRef.value.validate()
  } catch {
    return
  }
  
  paymentSubmitting.value = true
  try {
    await payableApi.pay(paymentTarget.value.id, {
      amount: paymentData.amount,
      payment_date: paymentData.payment_date,
      payment_method: paymentData.payment_method,
      account: paymentData.account,
      remark: paymentData.remark
    })
    ElMessage.success('付款成功')
    paymentDialogVisible.value = false
    loadData()
    loadAgingAnalysis()
  } catch (e) {
    console.error('付款失败', e)
    ElMessage.error('付款失败')
  } finally {
    paymentSubmitting.value = false
  }
}

// 查看付款记录
const handleViewPayments = async (row: Payable) => {
  paymentRecordsDialogVisible.value = true
  paymentRecordsLoading.value = true
  try {
    const res = await payableApi.getPaymentRecords(row.id)
    paymentRecords.value = res || []
  } catch (e) {
    console.error('加载付款记录失败', e)
    ElMessage.error('加载付款记录失败')
  } finally {
    paymentRecordsLoading.value = false
  }
}

// 删除
const handleDelete = (row: Payable) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await payableApi.delete(deleteTarget.value.id)
    ElMessage.success('删除成功')
    deleteDialogVisible.value = false
    loadData()
    loadAgingAnalysis()
  } catch (e) {
    console.error('删除失败', e)
    ElMessage.error('删除失败')
  } finally {
    deleting.value = false
  }
}

// 重置表单
const resetForm = () => {
  formData.id = undefined
  formData.supplier_id = undefined as unknown as number
  formData.invoice_no = ''
  formData.amount = 0
  formData.due_date = ''
  formData.description = ''
  formRef.value?.clearValidate()
}

// 重置付款表单
const resetPaymentForm = () => {
  paymentData.amount = 0
  paymentData.payment_date = dayjs().format('YYYY-MM-DD')
  paymentData.payment_method = 'bank'
  paymentData.account = ''
  paymentData.remark = ''
  paymentFormRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadSuppliers()
  loadData()
  loadAgingAnalysis()
})
</script>

<style lang="scss" scoped>
.payables-page {
  .aging-card {
    margin-bottom: 20px;
    border-radius: 12px;
    
    :deep(.el-card__header) {
      padding: 16px 20px;
      border-bottom: 1px solid #ebeef5;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .aging-content {
      padding: 10px 0;
    }
    
    .aging-item {
      text-align: center;
      padding: 16px 12px;
      border-radius: 8px;
      background: #f5f7fa;
      
      .aging-label {
        font-size: 13px;
        color: #909399;
        margin-bottom: 8px;
      }
      
      .aging-value {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
      }
      
      &.total {
        background: #ecf5ff;
        .aging-value { color: #409eff; }
      }
      
      &.not-due {
        background: #f0f9eb;
        .aging-value { color: #67c23a; }
      }
      
      &.overdue-0-30 {
        background: #fdf6ec;
        .aging-value { color: #e6a23c; }
      }
      
      &.overdue-30-60 {
        background: #fef0f0;
        .aging-value { color: #f56c6c; }
      }
      
      &.overdue-60-90 {
        background: #fef0f0;
        .aging-value { color: #f56c6c; }
      }
      
      &.overdue-90-plus {
        background: #fef0f0;
        .aging-value { color: #f56c6c; font-weight: 700; }
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
      
      .supplier-name {
        font-weight: 500;
        color: #303133;
      }
      
      .amount-text {
        font-weight: 500;
        color: #303133;
      }
      
      .paid-amount {
        color: #67c23a;
        font-weight: 500;
      }
      
      .unpaid-amount {
        color: #f56c6c;
        font-weight: 600;
      }
      
      .overdue-date {
        color: #f56c6c;
        font-weight: 500;
      }
      
      .description-text {
        color: #606266;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .payment-info {
    :deep(.el-descriptions__label) {
      width: 80px;
    }
  }

  .delete-info {
    margin-top: 16px;
    padding: 12px 16px;
    background: #fafafa;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    
    strong {
      font-size: 16px;
    }
  }
}
</style>