<template>
  <div class="purchase-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">订单总数</div>
              <div class="stat-value">{{ stats.total_count }}</div>
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
              <div class="stat-value">{{ stats.pending_count }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card confirmed">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Select /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已确认</div>
              <div class="stat-value">{{ stats.confirmed_count }}</div>
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
    </el-row>

    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :shortcuts="dateShortcuts"
            style="width: 260px"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item label="供应商">
          <el-select v-model="filterForm.supplier_id" placeholder="全部供应商" clearable style="width: 160px" @change="handleFilter">
            <el-option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="草稿" value="draft" />
            <el-option label="待审核" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已入库" value="received" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input 
            v-model="filterForm.search" 
            placeholder="订单号/备注" 
            clearable 
            style="width: 160px"
            @keyup.enter="handleFilter"
            @clear="handleFilter"
          >
            <template #append>
              <el-button :icon="Search" @click="handleFilter" />
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增订单</el-button>
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
        @sort-change="handleSortChange"
        @row-click="handleRowClick"
      >
        <el-table-column prop="order_no" label="订单号" width="150">
          <template #default="{ row }">
            <span class="order-no">{{ row.order_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="supplier_name" label="供应商" min-width="140" />
        <el-table-column prop="total_amount" label="金额" width="120" align="right" sortable="custom">
          <template #default="{ row }">
            <span class="amount">¥{{ formatMoney(row.total_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_date" label="下单日期" width="110" sortable="custom">
          <template #default="{ row }">
            {{ formatDate(row.order_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="expected_date" label="预计到货" width="110">
          <template #default="{ row }">
            {{ row.expected_date ? formatDate(row.expected_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="auditor" label="审核人" width="100">
          <template #default="{ row }">
            {{ row.auditor || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="remarks" label="备注" min-width="150">
          <template #default="{ row }">
            <span class="remarks">{{ row.remarks || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'draft'">
              <el-button link type="primary" @click.stop="handleEdit(row)">编辑</el-button>
              <el-button link type="success" @click.stop="handleSubmitAudit(row)">提交</el-button>
              <el-button link type="danger" @click.stop="handleDelete(row)">删除</el-button>
            </template>
            <template v-else-if="row.status === 'pending'">
              <el-button link type="primary" @click.stop="handleViewDetail(row)">详情</el-button>
              <el-button link type="success" @click.stop="handleAudit(row, true)">通过</el-button>
              <el-button link type="warning" @click.stop="handleAudit(row, false)">驳回</el-button>
            </template>
            <template v-else-if="row.status === 'confirmed'">
              <el-button link type="primary" @click.stop="handleViewDetail(row)">详情</el-button>
              <el-button link type="success" @click.stop="handleReceive(row)">入库</el-button>
            </template>
            <template v-else>
              <el-button link type="primary" @click.stop="handleViewDetail(row)">详情</el-button>
            </template>
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

    <!-- 新增/编辑订单弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="900px"
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
            <el-form-item label="供应商" prop="supplier_id">
              <el-select 
                v-model="formData.supplier_id" 
                placeholder="选择供应商" 
                style="width: 100%"
                :disabled="isViewMode"
              >
                <el-option
                  v-for="supplier in suppliers"
                  :key="supplier.id"
                  :label="supplier.name"
                  :value="supplier.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下单日期" prop="order_date">
              <el-date-picker
                v-model="formData.order_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="isViewMode"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="预计到货">
              <el-date-picker
                v-model="formData.expected_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="isViewMode"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="备注">
              <el-input v-model="formData.remarks" placeholder="备注信息（选填）" :disabled="isViewMode" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 订单明细 -->
        <el-divider content-position="left">订单明细</el-divider>
        
        <div v-if="!isViewMode" class="detail-toolbar">
          <el-button type="primary" :icon="Plus" size="small" @click="handleAddDetail">添加商品</el-button>
        </div>

        <el-table :data="formData.details" stripe size="small" class="detail-table">
          <el-table-column label="商品" min-width="180">
            <template #default="{ row, $index }">
              <el-select
                v-if="!isViewMode"
                v-model="row.product_id"
                placeholder="选择商品"
                style="width: 100%"
                @change="(val: number) => handleProductChange(val, $index)"
              >
                <el-option
                  v-for="product in products"
                  :key="product.id"
                  :label="product.name"
                  :value="product.id"
                />
              </el-select>
              <span v-else>{{ row.product_name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }">
              {{ row.unit || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="数量" width="120">
            <template #default="{ row, $index }">
              <el-input-number
                v-if="!isViewMode"
                v-model="row.quantity"
                :min="1"
                :precision="0"
                :controls="false"
                size="small"
                @change="calculateAmount($index)"
              />
              <span v-else>{{ row.quantity }}</span>
            </template>
          </el-table-column>
          <el-table-column label="单价" width="120">
            <template #default="{ row, $index }">
              <el-input-number
                v-if="!isViewMode"
                v-model="row.price"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                @change="calculateAmount($index)"
              />
              <span v-else>¥{{ row.price.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">
              <span class="detail-amount">¥{{ row.amount.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="100">
            <template #default="{ row }">
              <el-input
                v-if="!isViewMode"
                v-model="row.remarks"
                placeholder="备注"
                size="small"
              />
              <span v-else>{{ row.remarks || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="!isViewMode" label="操作" width="70" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" @click="handleRemoveDetail($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="total-row">
          <span>合计金额：</span>
          <span class="total-amount">¥{{ calculateTotal() }}</span>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="!isViewMode" type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 入库弹窗 -->
    <el-dialog
      v-model="receiveDialogVisible"
      title="采购入库"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="receiveFormRef"
        :model="receiveForm"
        :rules="receiveFormRules"
        label-width="90px"
      >
        <el-form-item label="入库仓库" prop="warehouse_id">
          <el-select v-model="receiveForm.warehouse_id" placeholder="选择仓库" style="width: 100%">
            <el-option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :label="warehouse.name"
              :value="warehouse.id"
            />
          </el-select>
        </el-form-item>
        
        <el-divider content-position="left">入库明细</el-divider>
        
        <el-table :data="receiveForm.details" stripe size="small">
          <el-table-column label="商品" min-width="150">
            <template #default="{ row }">
              {{ row.product_name }}
            </template>
          </el-table-column>
          <el-table-column label="订单数量" width="100" align="center">
            <template #default="{ row }">
              {{ row.quantity }}
            </template>
          </el-table-column>
          <el-table-column label="已入库" width="100" align="center">
            <template #default="{ row }">
              {{ row.received_quantity || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="待入库" width="100" align="center">
            <template #default="{ row }">
              {{ row.quantity - (row.received_quantity || 0) }}
            </template>
          </el-table-column>
          <el-table-column label="本次入库" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.current_receive"
                :min="0"
                :max="row.quantity - (row.received_quantity || 0)"
                :precision="0"
                :controls="false"
                size="small"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="receiveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="receiving" @click="confirmReceive">确认入库</el-button>
      </template>
    </el-dialog>

    <!-- 审核备注弹窗 -->
    <el-dialog
      v-model="auditDialogVisible"
      :title="auditApproved ? '审核通过' : '审核驳回'"
      width="400px"
    >
      <el-form :model="auditForm" label-width="80px">
        <el-form-item label="审核备注">
          <el-input
            v-model="auditForm.remark"
            type="textarea"
            :rows="3"
            :placeholder="auditApproved ? '审核备注（选填）' : '请填写驳回原因'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditDialogVisible = false">取消</el-button>
        <el-button :type="auditApproved ? 'success' : 'warning'" :loading="auditing" @click="confirmAudit">
          {{ auditApproved ? '确认通过' : '确认驳回' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除订单 <strong>{{ deleteTarget?.order_no }}</strong> 吗？</p>
      <p class="delete-info">
        供应商：{{ deleteTarget?.supplier_name }}<br>
        金额：¥{{ formatMoney(deleteTarget?.total_amount || 0) }}
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
import { Plus, Download, Search, Document, Clock, Select, Money } from '@element-plus/icons-vue'
import { purchaseApi, type PurchaseOrder, type PurchaseOrderDetail, type PurchaseOrderStatus } from '@/api/purchase'
import { supplierApi, type Supplier } from '@/api/supplier'
import { inventoryApi, type Warehouse } from '@/api/inventory'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const receiving = ref(false)
const auditing = ref(false)

// 数据
const tableData = ref<PurchaseOrder[]>([])
const suppliers = ref<Supplier[]>([])
const products = ref<Array<{ id: number; name: string; unit: string; cost_price: number }>>([])
const warehouses = ref<Warehouse[]>([])

// 统计数据
const stats = reactive({
  total_count: 0,
  total_amount: 0,
  pending_count: 0,
  confirmed_count: 0,
  received_count: 0
})

// 筛选表单
const filterForm = reactive({
  supplier_id: undefined as number | undefined,
  status: '' as PurchaseOrderStatus | '',
  search: '',
  start_date: '',
  end_date: ''
})

// 日期范围
const dateRange = ref<[string, string] | null>(null)

// 日期快捷选项
const dateShortcuts = [
  {
    text: '今天',
    value: () => {
      const today = dayjs().format('YYYY-MM-DD')
      return [today, today]
    }
  },
  {
    text: '本周',
    value: () => {
      const start = dayjs().startOf('week').format('YYYY-MM-DD')
      const end = dayjs().endOf('week').format('YYYY-MM-DD')
      return [start, end]
    }
  },
  {
    text: '本月',
    value: () => {
      const start = dayjs().startOf('month').format('YYYY-MM-DD')
      const end = dayjs().endOf('month').format('YYYY-MM-DD')
      return [start, end]
    }
  },
  {
    text: '上月',
    value: () => {
      const start = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
      const end = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      return [start, end]
    }
  }
]

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const isViewMode = ref(false)
const dialogTitle = computed(() => {
  if (isViewMode.value) return '订单详情'
  return formData.id ? '编辑订单' : '新增订单'
})
const deleteDialogVisible = ref(false)
const deleteTarget = ref<PurchaseOrder | null>(null)
const receiveDialogVisible = ref(false)
const auditDialogVisible = ref(false)
const auditApproved = ref(true)
const currentAuditOrder = ref<PurchaseOrder | null>(null)
const currentReceiveOrder = ref<PurchaseOrder | null>(null)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<{
  id?: number
  supplier_id: number | undefined
  order_date: string
  expected_date: string
  remarks: string
  details: Array<{
    product_id: number | undefined
    product_name: string
    unit: string
    quantity: number
    price: number
    amount: number
    remarks: string
  }>
}>({
  supplier_id: undefined,
  order_date: dayjs().format('YYYY-MM-DD'),
  expected_date: '',
  remarks: '',
  details: []
})

// 表单校验规则
const formRules: FormRules = {
  supplier_id: [
    { required: true, message: '请选择供应商', trigger: 'change' }
  ],
  order_date: [
    { required: true, message: '请选择下单日期', trigger: 'change' }
  ]
}

// 入库表单
const receiveFormRef = ref<FormInstance>()
const receiveForm = reactive({
  warehouse_id: undefined as number | undefined,
  details: Array<{
    detail_id: number
    product_name: string
    quantity: number
    received_quantity: number
    current_receive: number
  }>()
})

const receiveFormRules: FormRules = {
  warehouse_id: [
    { required: true, message: '请选择入库仓库', trigger: 'change' }
  ]
}

// 审核表单
const auditForm = reactive({
  remark: ''
})

// 工具函数
const formatMoney = (n: number) => {
  if (!n && n !== 0) return '0.00'
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(2) + '万'
  }
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD')
}

const getStatusLabel = (status: PurchaseOrderStatus) => {
  const map: Record<PurchaseOrderStatus, string> = {
    draft: '草稿',
    pending: '待审核',
    confirmed: '已确认',
    received: '已入库',
    cancelled: '已取消'
  }
  return map[status] || status
}

const getStatusTagType = (status: PurchaseOrderStatus) => {
  const map: Record<PurchaseOrderStatus, string> = {
    draft: 'info',
    pending: 'warning',
    confirmed: 'success',
    received: 'primary',
    cancelled: 'danger'
  }
  return map[status] || ''
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await purchaseApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      supplier_id: filterForm.supplier_id,
      status: filterForm.status || undefined,
      start_date: filterForm.start_date || undefined,
      end_date: filterForm.end_date || undefined,
      search: filterForm.search || undefined
    })
    
    tableData.value = res.list || []
    pagination.total = res.total || 0
    
    // 更新统计
    if (res.stats) {
      stats.total_count = res.stats.total_count || 0
      stats.total_amount = res.stats.total_amount || 0
      stats.pending_count = res.stats.pending_count || 0
      stats.confirmed_count = res.stats.confirmed_count || 0
      stats.received_count = res.stats.received_count || 0
    }
  } catch (e) {
    console.error('加载失败', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    const res = await supplierApi.getList({ pageSize: 1000, status: 'active' })
    suppliers.value = res.list || []
  } catch (e) {
    console.error('加载供应商失败', e)
  }
}

// 加载商品列表
const loadProducts = async () => {
  try {
    const res = await inventoryApi.getProducts()
    products.value = (res || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      cost_price: p.cost_price || 0
    }))
  } catch (e) {
    console.error('加载商品失败', e)
  }
}

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    warehouses.value = await inventoryApi.getWarehouses() || []
  } catch (e) {
    console.error('加载仓库失败', e)
  }
}

// 事件处理
const handleDateChange = (val: [string, string] | null) => {
  if (val) {
    filterForm.start_date = val[0]
    filterForm.end_date = val[1]
  } else {
    filterForm.start_date = ''
    filterForm.end_date = ''
  }
  handleFilter()
}

const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
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
const handleEdit = async (row: PurchaseOrder) => {
  resetForm()
  try {
    const detail = await purchaseApi.getDetail(row.id)
    formData.id = detail.id
    formData.supplier_id = detail.supplier_id
    formData.order_date = detail.order_date
    formData.expected_date = detail.expected_date || ''
    formData.remarks = detail.remarks || ''
    formData.details = (detail.details || []).map(d => ({
      product_id: d.product_id,
      product_name: d.product_name,
      unit: d.unit,
      quantity: d.quantity,
      price: d.price,
      amount: d.amount,
      remarks: d.remarks || ''
    }))
    dialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取订单详情失败')
  }
}

// 查看详情
const handleViewDetail = async (row: PurchaseOrder) => {
  isViewMode.value = true
  await handleEdit(row)
}

// 行点击
const handleRowClick = (row: PurchaseOrder) => {
  handleViewDetail(row)
}

// 提交审核
const handleSubmitAudit = async (row: PurchaseOrder) => {
  try {
    await purchaseApi.confirm(row.id)
    ElMessage.success('订单已提交审核')
    loadData()
  } catch (e) {
    ElMessage.error('提交失败')
  }
}

// 添加明细行
const handleAddDetail = () => {
  formData.details.push({
    product_id: undefined,
    product_name: '',
    unit: '',
    quantity: 1,
    price: 0,
    amount: 0,
    remarks: ''
  })
}

// 删除明细行
const handleRemoveDetail = (index: number) => {
  formData.details.splice(index, 1)
}

// 商品选择变化
const handleProductChange = (productId: number, index: number) => {
  const product = products.value.find(p => p.id === productId)
  if (product) {
    formData.details[index].product_name = product.name
    formData.details[index].unit = product.unit
    formData.details[index].price = product.cost_price
    calculateAmount(index)
  }
}

// 计算明细金额
const calculateAmount = (index: number) => {
  const detail = formData.details[index]
  detail.amount = detail.quantity * detail.price
}

// 计算总金额
const calculateTotal = () => {
  return formData.details.reduce((sum, d) => sum + d.amount, 0).toFixed(2)
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  if (formData.details.length === 0) {
    ElMessage.warning('请添加订单明细')
    return
  }

  const hasInvalidDetail = formData.details.some(d => !d.product_id || d.quantity <= 0)
  if (hasInvalidDetail) {
    ElMessage.warning('请完善订单明细')
    return
  }
  
  submitting.value = true
  try {
    const data = {
      supplier_id: formData.supplier_id!,
      order_date: formData.order_date,
      expected_date: formData.expected_date || undefined,
      remarks: formData.remarks || undefined,
      details: formData.details.map(d => ({
        product_id: d.product_id!,
        quantity: d.quantity,
        price: d.price,
        remarks: d.remarks || undefined
      }))
    }

    if (formData.id) {
      await purchaseApi.update(formData.id, data)
      ElMessage.success('更新成功')
    } else {
      await purchaseApi.create(data)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    console.error('提交失败', e)
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 审核
const handleAudit = (row: PurchaseOrder, approved: boolean) => {
  currentAuditOrder.value = row
  auditApproved.value = approved
  auditForm.remark = ''
  auditDialogVisible.value = true
}

const confirmAudit = async () => {
  if (!currentAuditOrder.value) return
  
  if (!auditApproved.value && !auditForm.remark.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  
  auditing.value = true
  try {
    await purchaseApi.audit(currentAuditOrder.value.id, {
      approved: auditApproved.value,
      remark: auditForm.remark
    })
    ElMessage.success(auditApproved.value ? '审核通过' : '已驳回')
    auditDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('审核失败')
  } finally {
    auditing.value = false
  }
}

// 入库
const handleReceive = async (row: PurchaseOrder) => {
  try {
    const detail = await purchaseApi.getDetail(row.id)
    currentReceiveOrder.value = detail
    receiveForm.warehouse_id = undefined
    receiveForm.details = (detail.details || []).map(d => ({
      detail_id: d.id!,
      product_name: d.product_name,
      quantity: d.quantity,
      received_quantity: d.received_quantity || 0,
      current_receive: d.quantity - (d.received_quantity || 0)
    }))
    receiveDialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取订单详情失败')
  }
}

const confirmReceive = async () => {
  if (!receiveFormRef.value) return
  
  try {
    await receiveFormRef.value.validate()
  } catch {
    return
  }

  const hasReceive = receiveForm.details.some(d => d.current_receive > 0)
  if (!hasReceive) {
    ElMessage.warning('请填写入库数量')
    return
  }
  
  receiving.value = true
  try {
    await purchaseApi.receive(currentReceiveOrder.value!.id, {
      warehouse_id: receiveForm.warehouse_id!,
      details: receiveForm.details
        .filter(d => d.current_receive > 0)
        .map(d => ({
          detail_id: d.detail_id,
          received_quantity: d.current_receive
        }))
    })
    ElMessage.success('入库成功')
    receiveDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('入库失败')
  } finally {
    receiving.value = false
  }
}

// 删除
const handleDelete = (row: PurchaseOrder) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await purchaseApi.delete(deleteTarget.value.id)
    ElMessage.success('删除成功')
    deleteDialogVisible.value = false
    loadData()
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
    const blob = await purchaseApi.export({
      supplier_id: filterForm.supplier_id,
      status: filterForm.status || undefined,
      start_date: filterForm.start_date || undefined,
      end_date: filterForm.end_date || undefined,
      search: filterForm.search || undefined
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `采购订单_${dayjs().format('YYYY-MM-DD')}.xlsx`
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
  isViewMode.value = false
  formData.id = undefined
  formData.supplier_id = undefined
  formData.order_date = dayjs().format('YYYY-MM-DD')
  formData.expected_date = ''
  formData.remarks = ''
  formData.details = []
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  // 默认加载本月数据
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  dateRange.value = [start, end]
  filterForm.start_date = start
  filterForm.end_date = end
  
  loadSuppliers()
  loadProducts()
  loadWarehouses()
  loadData()
})
</script>

<style lang="scss" scoped>
.purchase-page {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    border-radius: 12px;
    border: none;
    
    &.total {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      .stat-icon { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); }
      .stat-value { color: #1976d2; }
    }
    
    &.pending {
      background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
      .stat-icon { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); }
      .stat-value { color: #f57c00; }
    }
    
    &.confirmed {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      .stat-icon { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); }
      .stat-value { color: #388e3c; }
    }
    
    &.amount {
      background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
      .stat-icon { background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%); }
      .stat-value { color: #c2185b; }
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
      
      .order-no {
        color: #409eff;
        cursor: pointer;
        
        &:hover {
          text-decoration: underline;
        }
      }
      
      .amount {
        font-weight: 600;
        color: #333;
      }
      
      .remarks {
        color: #909399;
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

  .detail-toolbar {
    margin-bottom: 12px;
  }

  .detail-table {
    margin-bottom: 16px;
    
    .detail-amount {
      font-weight: 600;
      color: #333;
    }
  }

  .total-row {
    text-align: right;
    padding: 12px 16px;
    background: #fafafa;
    border-radius: 8px;
    font-size: 16px;
    
    .total-amount {
      font-weight: 600;
      font-size: 20px;
      color: #e91e63;
    }
  }

  .delete-info {
    margin-top: 16px;
    padding: 12px 16px;
    background: #fafafa;
    border-radius: 8px;
    line-height: 1.8;
    color: #606266;
  }
}
</style>