<template>
  <div class="receivables-page">
    <!-- 账龄分析卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">应收总额</div>
              <div class="stat-value">¥{{ formatAmount(aging.total_amount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card received">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已收金额</div>
              <div class="stat-value">¥{{ formatAmount(aging.received_amount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card unreceived">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">待收金额</div>
              <div class="stat-value">¥{{ formatAmount(aging.unreceived_amount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card overdue">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">逾期金额</div>
              <div class="stat-value">¥{{ formatAmount(aging.overdue_amount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 账龄分析图表 -->
    <el-card shadow="never" class="aging-card">
      <template #header>
        <div class="card-header">
          <span>账龄分析</span>
          <el-button text @click="showAgingDetail = !showAgingDetail">
            {{ showAgingDetail ? '收起' : '展开详情' }}
          </el-button>
        </div>
      </template>
      <div class="aging-chart">
        <div class="aging-bars">
          <div
            v-for="item in aging.by_period"
            :key="item.period"
            class="aging-bar-item"
          >
            <div class="bar-label">{{ item.label }}</div>
            <div class="bar-wrapper">
              <div
                class="bar-fill"
                :style="{
                  width: getBarWidth(item.amount),
                  backgroundColor: getBarColor(item.period)
                }"
              ></div>
            </div>
            <div class="bar-info">
              <span class="amount">¥{{ formatAmount(item.amount) }}</span>
              <span class="count">{{ item.count }}笔</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 客户明细 -->
      <div v-if="showAgingDetail" class="aging-detail">
        <el-divider content-position="left">客户应收明细</el-divider>
        <el-table :data="aging.by_customer" size="small" max-height="300">
          <el-table-column prop="customer_name" label="客户名称" min-width="150" />
          <el-table-column label="应收金额" width="120" align="right">
            <template #default="{ row }">
              <span class="amount">¥{{ formatAmount(row.total_amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="已收金额" width="120" align="right">
            <template #default="{ row }">
              <span class="amount success">¥{{ formatAmount(row.received_amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="待收金额" width="120" align="right">
            <template #default="{ row }">
              <span class="amount warning">¥{{ formatAmount(row.unreceived_amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="逾期天数" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.overdue_days > 0" type="danger" size="small">
                {{ row.overdue_days }}天
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 搜索和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="searchForm" class="filter-form">
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.search"
            placeholder="客户名称/单号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #append>
              <el-button :icon="Search" @click="handleSearch" />
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleSearch">
            <el-option label="待收款" value="pending" />
            <el-option label="部分收款" value="partial" />
            <el-option label="已收清" value="paid" />
            <el-option label="已逾期" value="overdue" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期日期">
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
          <el-checkbox v-model="searchForm.overdue" @change="handleSearch">仅显示逾期</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增应收</el-button>
          <el-button :icon="Download" @click="handleExport" :loading="exporting">导出</el-button>
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
        <el-table-column prop="receivable_no" label="应收单号" width="140">
          <template #default="{ row }">
            <el-link type="primary" @click="handleView(row)">{{ row.receivable_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="order_no" label="关联订单" width="140">
          <template #default="{ row }">
            <span v-if="row.order_no">{{ row.order_no }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="应收金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount">¥{{ formatAmount(row.total_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已收金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount success">¥{{ formatAmount(row.received_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="未收金额" width="120" align="right">
          <template #default="{ row }">
            <span :class="['amount', row.unreceived_amount > 0 ? 'warning' : '']">
              ¥{{ formatAmount(row.unreceived_amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="due_date" label="到期日" width="110">
          <template #default="{ row }">
            <span :class="{ 'overdue': isOverdue(row.due_date, row.status) }">
              {{ formatDate(row.due_date) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="收款进度" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="getProgress(row)"
              :stroke-width="8"
              :color="getProgressColor(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getReceivableStatusType(row.status)" size="small">
              {{ getReceivableStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.unreceived_amount > 0"
              link
              type="primary"
              size="small"
              @click="handleReceive(row)"
            >
              收款
            </el-button>
            <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
            <el-button
              v-if="row.status === 'pending'"
              link
              type="primary"
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.status === 'pending' && !row.order_id"
              link
              type="danger"
              size="small"
              @click="handleDelete(row)"
            >
              删除
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

    <!-- 新增/编辑应收弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增应收账款' : '编辑应收账款'"
      width="500px"
      :close-on-click-modal="false"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="客户" prop="customer_id">
          <el-select
            v-model="formData.customer_id"
            placeholder="选择客户"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="item in customerList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="应收金额" prop="total_amount">
          <el-input-number
            v-model="formData.total_amount"
            :min="0.01"
            :precision="2"
            :controls="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="到期日" prop="due_date">
          <el-date-picker
            v-model="formData.due_date"
            type="date"
            placeholder="选择到期日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="备注信息（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ dialogType === 'add' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 收款弹窗 -->
    <el-dialog
      v-model="receiveDialogVisible"
      title="收款"
      width="500px"
      :close-on-click-modal="false"
      @close="resetReceiveForm"
    >
      <el-form
        ref="receiveFormRef"
        :model="receiveForm"
        :rules="receiveFormRules"
        label-width="100px"
      >
        <el-form-item label="客户">
          <span>{{ currentReceivable?.customer_name }}</span>
        </el-form-item>
        <el-form-item label="应收金额">
          <span class="amount">¥{{ formatAmount(currentReceivable?.total_amount || 0) }}</span>
        </el-form-item>
        <el-form-item label="待收金额">
          <span class="amount warning">¥{{ formatAmount(currentReceivable?.unreceived_amount || 0) }}</span>
        </el-form-item>
        <el-divider />
        <el-form-item label="收款金额" prop="amount">
          <el-input-number
            v-model="receiveForm.amount"
            :min="0.01"
            :max="currentReceivable?.unreceived_amount || 0"
            :precision="2"
            :controls="false"
            style="width: 100%"
          />
          <div class="quick-amount">
            <el-button size="small" @click="receiveForm.amount = currentReceivable?.unreceived_amount || 0">
              全部收款
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="收款方式" prop="payment_method">
          <el-select v-model="receiveForm.payment_method" placeholder="选择收款方式" style="width: 100%">
            <el-option label="银行转账" value="bank_transfer" />
            <el-option label="现金" value="cash" />
            <el-option label="微信" value="wechat" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="支票" value="check" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款日期" prop="payment_date">
          <el-date-picker
            v-model="receiveForm.payment_date"
            type="date"
            placeholder="选择收款日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="收款账户">
          <el-input v-model="receiveForm.account_no" placeholder="收款账号（选填）" />
        </el-form-item>
        <el-form-item label="凭证号">
          <el-input v-model="receiveForm.voucher_no" placeholder="凭证号（选填）" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="receiveForm.remark"
            type="textarea"
            :rows="2"
            placeholder="备注信息（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="receiveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="receiving" @click="handleConfirmReceive">
          确认收款
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="应收账款详情"
      width="700px"
      destroy-on-close
    >
      <template v-if="currentReceivable">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="应收单号">{{ currentReceivable.receivable_no }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ currentReceivable.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="关联订单">{{ currentReceivable.order_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getReceivableStatusType(currentReceivable.status)" size="small">
              {{ getReceivableStatusLabel(currentReceivable.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="应收金额">
            <span class="amount">¥{{ formatAmount(currentReceivable.total_amount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="已收金额">
            <span class="amount success">¥{{ formatAmount(currentReceivable.received_amount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="未收金额">
            <span class="amount warning">¥{{ formatAmount(currentReceivable.unreceived_amount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="到期日">
            <span :class="{ 'overdue': isOverdue(currentReceivable.due_date, currentReceivable.status) }">
              {{ currentReceivable.due_date }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="创建人">{{ currentReceivable.creator_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(currentReceivable.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentReceivable.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 收款记录 -->
        <el-divider content-position="left">收款记录</el-divider>
        <el-table
          v-if="currentReceivable.records && currentReceivable.records.length > 0"
          :data="currentReceivable.records"
          size="small"
        >
          <el-table-column prop="payment_date" label="收款日期" width="110" />
          <el-table-column label="收款金额" width="120" align="right">
            <template #default="{ row }">
              <span class="amount success">¥{{ formatAmount(row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="收款方式" width="100">
            <template #default="{ row }">
              {{ getReceivablePaymentMethodLabel(row.payment_method) }}
            </template>
          </el-table-column>
          <el-table-column prop="account_no" label="收款账户" min-width="120">
            <template #default="{ row }">
              {{ row.account_no || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="voucher_no" label="凭证号" width="120">
            <template #default="{ row }">
              {{ row.voucher_no || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="creator_name" label="操作人" width="100" />
          <el-table-column prop="remark" label="备注" min-width="120">
            <template #default="{ row }">
              {{ row.remark || '-' }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无收款记录" :image-size="80" />
      </template>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="currentReceivable && currentReceivable.unreceived_amount > 0"
          type="primary"
          @click="handleReceiveFromDetail"
        >
          收款
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Download, Search, Document, CircleCheck, Clock, Warning
} from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'
import {
  receivableApi,
  getReceivableStatusLabel,
  getReceivableStatusType,
  getReceivablePaymentMethodLabel,
  type Receivable,
  type ReceivableStatus,
  type ReceivableCreateParams,
  type ReceivableReceiveParams,
  type ReceivableAgingAnalysis
} from '@/api/receivable'
import { customerApi, type Customer } from '@/api/customer'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const receiving = ref(false)
const exporting = ref(false)

// 数据
const tableData = ref<Receivable[]>([])
const customerList = ref<Customer[]>([])
const currentReceivable = ref<Receivable | null>(null)

// 账龄分析
const aging = ref<ReceivableAgingAnalysis>({
  total_amount: 0,
  received_amount: 0,
  unreceived_amount: 0,
  overdue_amount: 0,
  by_period: [],
  by_customer: []
})
const showAgingDetail = ref(false)

// 搜索表单
const searchForm = reactive({
  search: '',
  status: '' as ReceivableStatus | '',
  overdue: false
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
const dialogType = ref<'add' | 'edit'>('add')
const receiveDialogVisible = ref(false)
const detailDialogVisible = ref(false)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<ReceivableCreateParams & { id?: number }>({
  customer_id: undefined as unknown as number,
  total_amount: 0,
  due_date: '',
  remark: ''
})

const formRules: FormRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  total_amount: [{ required: true, message: '请输入应收金额', trigger: 'blur' }],
  due_date: [{ required: true, message: '请选择到期日', trigger: 'change' }]
}

// 收款表单
const receiveFormRef = ref<FormInstance>()
const receiveForm = reactive<ReceivableReceiveParams>({
  amount: 0,
  payment_method: 'bank_transfer',
  payment_date: dayjs().format('YYYY-MM-DD'),
  account_no: '',
  voucher_no: '',
  remark: ''
})

const receiveFormRules: FormRules = {
  amount: [
    { required: true, message: '请输入收款金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '收款金额必须大于0', trigger: 'blur' }
  ],
  payment_method: [{ required: true, message: '请选择收款方式', trigger: 'change' }],
  payment_date: [{ required: true, message: '请选择收款日期', trigger: 'change' }]
}

// 工具函数
const formatAmount = (amount: number): string => {
  if (!amount && amount !== 0) return '0.00'
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (date: string): string => {
  return dayjs(date).format('MM-DD')
}

const formatDateTime = (datetime: string): string => {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm')
}

const isOverdue = (dueDate: string, status: ReceivableStatus): boolean => {
  if (status === 'paid') return false
  return dayjs(dueDate).isBefore(dayjs(), 'day')
}

const getProgress = (row: Receivable): number => {
  if (row.total_amount === 0) return 0
  const progress = (row.received_amount / row.total_amount) * 100
  return Math.min(100, Math.round(progress))
}

const getProgressColor = (row: Receivable): string => {
  if (row.status === 'paid') return '#67c23a'
  if (row.status === 'overdue') return '#f56c6c'
  if (row.status === 'partial') return '#409eff'
  return '#e6a23c'
}

const getBarWidth = (amount: number): string => {
  if (aging.value.total_amount === 0) return '0%'
  const width = (amount / aging.value.total_amount) * 100
  return `${Math.max(2, Math.min(100, width))}%`
}

const getBarColor = (period: string): string => {
  const colors: Record<string, string> = {
    '0-30': '#67c23a',
    '31-60': '#409eff',
    '61-90': '#e6a23c',
    '91-180': '#f56c6c',
    '180+': '#c45656'
  }
  return colors[period] || '#909399'
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
      overdue: searchForm.overdue || undefined,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1]
    }
    const res = await receivableApi.getList(params)
    tableData.value = res.list || []
    pagination.total = res.total || 0
  } catch (e) {
    console.error('加载失败', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 加载账龄分析
const loadAging = async () => {
  try {
    aging.value = await receivableApi.getAging()
  } catch (e) {
    console.error('加载账龄分析失败', e)
  }
}

// 加载客户列表
const loadCustomers = async () => {
  try {
    const res = await customerApi.getList({ pageSize: 1000 })
    customerList.value = res.list || []
  } catch (e) {
    console.error('加载客户列表失败', e)
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadData()
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

// 新增
const handleAdd = () => {
  resetForm()
  dialogType.value = 'add'
  dialogVisible.value = true
}

// 编辑
const handleEdit = async (row: Receivable) => {
  resetForm()
  dialogType.value = 'edit'
  try {
    const detail = await receivableApi.getDetail(row.id)
    formData.id = detail.id
    formData.customer_id = detail.customer_id
    formData.total_amount = detail.total_amount
    formData.due_date = detail.due_date
    formData.remark = detail.remark || ''
    dialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取详情失败')
  }
}

// 查看详情
const handleView = async (row: Receivable) => {
  try {
    currentReceivable.value = await receivableApi.getDetail(row.id)
    detailDialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取详情失败')
  }
}

// 从详情页收款
const handleReceiveFromDetail = () => {
  detailDialogVisible.value = false
  handleReceive(currentReceivable.value!)
}

// 收款
const handleReceive = (row: Receivable) => {
  currentReceivable.value = row
  resetReceiveForm()
  receiveForm.payment_date = dayjs().format('YYYY-MM-DD')
  receiveDialogVisible.value = true
}

// 确认收款
const handleConfirmReceive = async () => {
  if (!receiveFormRef.value || !currentReceivable.value) return

  try {
    await receiveFormRef.value.validate()
  } catch {
    return
  }

  if (receiveForm.amount > currentReceivable.value.unreceived_amount) {
    ElMessage.warning('收款金额不能超过待收金额')
    return
  }

  receiving.value = true
  try {
    await receivableApi.receive(currentReceivable.value.id, {
      amount: receiveForm.amount,
      payment_method: receiveForm.payment_method,
      payment_date: receiveForm.payment_date,
      account_no: receiveForm.account_no,
      voucher_no: receiveForm.voucher_no,
      remark: receiveForm.remark
    })
    ElMessage.success('收款成功')
    receiveDialogVisible.value = false
    loadData()
    loadAging()
  } catch (e) {
    console.error('收款失败', e)
    ElMessage.error('收款失败')
  } finally {
    receiving.value = false
  }
}

// 删除
const handleDelete = async (row: Receivable) => {
  try {
    await ElMessageBox.confirm('确定要删除此应收账款吗？', '删除确认', {
      type: 'warning'
    })
    await receivableApi.delete(row.id)
    ElMessage.success('删除成功')
    loadData()
    loadAging()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
      ElMessage.error('删除失败')
    }
  }
}

// 导出
const handleExport = async () => {
  exporting.value = true
  try {
    const blob = await receivableApi.export({
      search: searchForm.search || undefined,
      status: searchForm.status || undefined,
      overdue: searchForm.overdue || undefined,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1]
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `应收账款_${dayjs().format('YYYY-MM-DD')}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    console.error('导出失败', e)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
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
      await receivableApi.update(formData.id, {
        customer_id: formData.customer_id,
        total_amount: formData.total_amount,
        due_date: formData.due_date,
        remark: formData.remark
      })
      ElMessage.success('更新成功')
    } else {
      await receivableApi.create({
        customer_id: formData.customer_id,
        total_amount: formData.total_amount,
        due_date: formData.due_date,
        remark: formData.remark
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
    loadAging()
  } catch (e) {
    console.error('提交失败', e)
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  formData.id = undefined
  formData.customer_id = undefined as unknown as number
  formData.total_amount = 0
  formData.due_date = ''
  formData.remark = ''
  formRef.value?.clearValidate()
}

// 重置收款表单
const resetReceiveForm = () => {
  receiveForm.amount = 0
  receiveForm.payment_method = 'bank_transfer'
  receiveForm.payment_date = dayjs().format('YYYY-MM-DD')
  receiveForm.account_no = ''
  receiveForm.voucher_no = ''
  receiveForm.remark = ''
  receiveFormRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
  loadAging()
  loadCustomers()
})
</script>

<style lang="scss" scoped>
.receivables-page {
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

    &.received {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);

      .stat-icon {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }

      .stat-value {
        color: #07c160;
      }
    }

    &.unreceived {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%);

      .stat-icon {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }

      .stat-value {
        color: #f59e0b;
      }
    }

    &.overdue {
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
        font-size: 20px;
        font-weight: 600;
        margin-top: 4px;
      }
    }
  }

  .aging-card {
    margin-bottom: 20px;
    border-radius: 12px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .aging-chart {
      .aging-bars {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .aging-bar-item {
        display: flex;
        align-items: center;
        gap: 16px;

        .bar-label {
          width: 80px;
          font-size: 13px;
          color: #606266;
        }

        .bar-wrapper {
          flex: 1;
          height: 20px;
          background: #f0f2f5;
          border-radius: 4px;
          overflow: hidden;

          .bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s ease;
          }
        }

        .bar-info {
          width: 140px;
          display: flex;
          justify-content: space-between;
          font-size: 13px;

          .amount {
            font-weight: 500;
            color: #303133;
          }

          .count {
            color: #909399;
          }
        }
      }
    }

    .aging-detail {
      margin-top: 20px;
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

      .amount {
        font-weight: 600;
        color: #303133;

        &.success {
          color: #07c160;
        }

        &.warning {
          color: #f59e0b;
        }
      }

      .text-muted {
        color: #c0c4cc;
      }

      .overdue {
        color: #ef4444;
        font-weight: 500;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .quick-amount {
    margin-top: 8px;
  }
}
</style>