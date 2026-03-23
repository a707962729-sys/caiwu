<template>
  <div class="sales-order-page">
    <!-- 搜索和操作区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.search"
            placeholder="订单号/客户名称"
            clearable
            @keyup.enter="handleSearch"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="草稿" value="draft" />
            <el-option label="待审核" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="发货中" value="shipping" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款状态">
          <el-select v-model="searchForm.payment_status" placeholder="全部" clearable style="width: 120px">
            <el-option label="未付款" value="unpaid" />
            <el-option label="部分付款" value="partial" />
            <el-option label="已付款" value="paid" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作按钮 -->
    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增订单
          </el-button>
          <el-button @click="handleExport" :loading="exporting">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-button @click="loadData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="order_no" label="订单号" width="160">
          <template #default="{ row }">
            <el-link type="primary" @click="handleView(row)">{{ row.order_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" min-width="120" show-overflow-tooltip />
        <el-table-column prop="order_date" label="订单日期" width="120" />
        <el-table-column label="订单金额" width="140" align="right">
          <template #default="{ row }">
            <span class="amount">¥{{ formatAmount(row.final_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="付款状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getPaymentStatusType(row.payment_status)" size="small">
              {{ getPaymentStatusLabel(row.payment_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getSalesOrderStatusType(row.status)" size="small">
              {{ getSalesOrderStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="创建人" width="100" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">查看</el-button>
            <el-button
              v-if="row.status === 'draft'"
              link
              type="primary"
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.status === 'draft'"
              link
              type="primary"
              size="small"
              @click="handleSubmit(row)"
            >
              提交
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link
              type="success"
              size="small"
              @click="handleConfirm(row)"
            >
              审核
            </el-button>
            <el-button
              v-if="row.status === 'confirmed'"
              link
              type="primary"
              size="small"
              @click="handleShip(row)"
            >
              发货
            </el-button>
            <el-button
              v-if="['draft', 'pending', 'confirmed'].includes(row.status)"
              link
              type="danger"
              size="small"
              @click="handleCancel(row)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
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
      :title="dialogType === 'add' ? '新增订单' : '编辑订单'"
      width="1000px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form
        ref="orderFormRef"
        :model="orderForm"
        :rules="orderRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户" prop="customer_id">
              <el-select
                v-model="orderForm.customer_id"
                placeholder="选择客户"
                filterable
                style="width: 100%"
                @change="handleCustomerChange"
              >
                <el-option
                  v-for="item in customerList"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="订单日期" prop="order_date">
              <el-date-picker
                v-model="orderForm.order_date"
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
            <el-form-item label="联系人">
              <el-input v-model="orderForm.contact_person" placeholder="联系人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="orderForm.contact_phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="付款方式">
              <el-select v-model="orderForm.payment_method" placeholder="选择付款方式" style="width: 100%">
                <el-option label="银行转账" value="bank_transfer" />
                <el-option label="现金" value="cash" />
                <el-option label="微信" value="wechat" />
                <el-option label="支付宝" value="alipay" />
                <el-option label="支票" value="check" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配送方式">
              <el-select v-model="orderForm.delivery_method" placeholder="选择配送方式" style="width: 100%">
                <el-option label="快递" value="express" />
                <el-option label="物流" value="logistics" />
                <el-option label="自提" value="pickup" />
                <el-option label="送货上门" value="delivery" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="收货地址">
          <el-input v-model="orderForm.shipping_address" placeholder="收货地址" />
        </el-form-item>

        <!-- 订单明细 -->
        <el-divider content-position="left">订单明细</el-divider>
        <div class="items-header">
          <el-button type="primary" size="small" @click="handleAddItem">
            <el-icon><Plus /></el-icon>
            添加商品
          </el-button>
        </div>
        <el-table :data="orderForm.items" border style="width: 100%">
          <el-table-column label="商品" min-width="200">
            <template #default="{ row, $index }">
              <el-select
                v-model="row.product_id"
                placeholder="选择商品"
                filterable
                style="width: 100%"
                @change="(val) => handleProductChange(val, $index)"
              >
                <el-option
                  v-for="item in productList"
                  :key="item.id"
                  :label="`${item.name}${item.code ? ` (${item.code})` : ''}`"
                  :value="item.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="规格" width="120">
            <template #default="{ row }">
              {{ row.specification || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }">
              {{ row.unit || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="单价" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unit_price"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="1"
                :controls="false"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="折扣(%)" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.discount_rate"
                :min="0"
                :max="100"
                :controls="false"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="税率(%)" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.tax_rate"
                :min="0"
                :max="100"
                :controls="false"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="小计" width="120" align="right">
            <template #default="{ row }">
              ¥{{ formatAmount(calculateItemTotal(row)) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="60" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="handleRemoveItem($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 金额汇总 -->
        <div class="amount-summary">
          <el-row :gutter="20">
            <el-col :span="6" :offset="12">
              <el-form-item label="商品金额">
                <span class="amount">¥{{ formatAmount(calculateSubtotal()) }}</span>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="优惠金额">
                <el-input-number
                  v-model="orderForm.discount_amount"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="6" :offset="12">
              <el-form-item label="税额">
                <span class="amount">¥{{ formatAmount(calculateTaxAmount()) }}</span>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="订单总额">
                <span class="amount total">¥{{ formatAmount(calculateTotal()) }}</span>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <el-form-item label="备注">
          <el-input
            v-model="orderForm.remark"
            type="textarea"
            :rows="3"
            placeholder="订单备注"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitOrder" :loading="submitting">
          {{ dialogType === 'add' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 订单详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="订单详情"
      width="900px"
      destroy-on-close
    >
      <template v-if="currentOrder">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="订单号">{{ currentOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentOrder.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="订单日期">{{ currentOrder.order_date }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ currentOrder.contact_person || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentOrder.contact_phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">
            <el-tag :type="getSalesOrderStatusType(currentOrder.status)" size="small">
              {{ getSalesOrderStatusLabel(currentOrder.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="付款状态">
            <el-tag :type="getPaymentStatusType(currentOrder.payment_status)" size="small">
              {{ getPaymentStatusLabel(currentOrder.payment_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="付款方式">{{ currentOrder.payment_method || '-' }}</el-descriptions-item>
          <el-descriptions-item label="配送方式">{{ currentOrder.delivery_method || '-' }}</el-descriptions-item>
          <el-descriptions-item label="收货地址" :span="3">{{ currentOrder.shipping_address || '-' }}</el-descriptions-item>
          <el-descriptions-item label="物流单号">{{ currentOrder.tracking_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="发货日期">{{ currentOrder.delivery_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ currentOrder.creator_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{ currentOrder.auditor_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审核时间">{{ currentOrder.audit_time ? formatDateTime(currentOrder.audit_time) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="审核备注">{{ currentOrder.audit_remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">订单明细</el-divider>
        <el-table :data="currentOrder.items" border style="width: 100%">
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="product_name" label="商品名称" min-width="150" />
          <el-table-column prop="product_code" label="商品编码" width="120" />
          <el-table-column prop="specification" label="规格" width="100" />
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column prop="quantity" label="数量" width="80" align="right" />
          <el-table-column label="单价" width="100" align="right">
            <template #default="{ row }">¥{{ formatAmount(row.unit_price) }}</template>
          </el-table-column>
          <el-table-column label="折扣" width="80" align="right">
            <template #default="{ row }">{{ row.discount_rate ? `${row.discount_rate}%` : '-' }}</template>
          </el-table-column>
          <el-table-column label="税额" width="100" align="right">
            <template #default="{ row }">¥{{ formatAmount(row.tax_amount || 0) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="120" align="right">
            <template #default="{ row }">¥{{ formatAmount(row.subtotal) }}</template>
          </el-table-column>
        </el-table>

        <div class="detail-amount">
          <el-row :gutter="20">
            <el-col :span="6" :offset="12">
              <div class="amount-item">
                <span class="label">商品金额：</span>
                <span class="value">¥{{ formatAmount(currentOrder.total_amount) }}</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="amount-item">
                <span class="label">优惠金额：</span>
                <span class="value">¥{{ formatAmount(currentOrder.discount_amount) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="6" :offset="12">
              <div class="amount-item">
                <span class="label">税额：</span>
                <span class="value">¥{{ formatAmount(currentOrder.tax_amount) }}</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="amount-item total">
                <span class="label">订单总额：</span>
                <span class="value">¥{{ formatAmount(currentOrder.final_amount) }}</span>
              </div>
            </el-col>
          </el-row>
        </div>

        <el-divider v-if="currentOrder.remark" content-position="left">备注</el-divider>
        <p v-if="currentOrder.remark" class="remark">{{ currentOrder.remark }}</p>
      </template>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="currentOrder?.status === 'draft'"
          type="primary"
          @click="handleEditFromDetail"
        >
          编辑
        </el-button>
        <el-button
          v-if="currentOrder?.status === 'draft'"
          type="primary"
          @click="handleSubmitFromDetail"
        >
          提交审核
        </el-button>
      </template>
    </el-dialog>

    <!-- 发货弹窗 -->
    <el-dialog
      v-model="shipDialogVisible"
      title="发货信息"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="shipFormRef"
        :model="shipForm"
        label-width="100px"
      >
        <el-form-item label="发货日期">
          <el-date-picker
            v-model="shipForm.delivery_date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="shipForm.tracking_no" placeholder="请输入物流单号" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="shipForm.remark"
            type="textarea"
            :rows="3"
            placeholder="发货备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmShip" :loading="submitting">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- 审核弹窗 -->
    <el-dialog
      v-model="auditDialogVisible"
      title="订单审核"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="auditFormRef"
        :model="auditForm"
        label-width="100px"
      >
        <el-form-item label="审核备注">
          <el-input
            v-model="auditForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入审核意见（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject" :loading="submitting">驳回</el-button>
        <el-button type="primary" @click="handleApprove" :loading="submitting">通过</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search, Refresh, Plus, Download } from '@element-plus/icons-vue'
import {
  salesOrderApi,
  getSalesOrderStatusLabel,
  getSalesOrderStatusType,
  getPaymentStatusLabel,
  getPaymentStatusType,
  type SalesOrder,
  type SalesOrderStatus,
  type SalesOrderItemParams
} from '@/api/sales'
import { customerApi, type Customer } from '@/api/customer'

// 搜索表单
const searchForm = reactive({
  search: '',
  status: '' as SalesOrderStatus | '',
  payment_status: '' as 'unpaid' | 'partial' | 'paid' | ''
})
const dateRange = ref<[string, string] | null>(null)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 表格数据
const loading = ref(false)
const tableData = ref<SalesOrder[]>([])
const selectedRows = ref<SalesOrder[]>([])

// 客户和商品列表
const customerList = ref<Customer[]>([])
const productList = ref<Array<{
  id: number
  name: string
  code?: string
  specification?: string
  unit: string
  selling_price: number
  stock: number
}>>([])

// 对话框
const dialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const detailVisible = ref(false)
const shipDialogVisible = ref(false)
const auditDialogVisible = ref(false)
const submitting = ref(false)
const exporting = ref(false)

// 当前操作订单
const currentOrder = ref<SalesOrder | null>(null)

// 订单表单
const orderFormRef = ref<FormInstance>()
const orderForm = reactive({
  customer_id: undefined as number | undefined,
  order_date: '',
  contact_person: '',
  contact_phone: '',
  shipping_address: '',
  payment_method: '',
  delivery_method: '',
  discount_amount: 0,
  remark: '',
  items: [] as Array<SalesOrderItemParams & {
    specification?: string
    unit?: string
  }>
})

// 订单校验规则
const orderRules: FormRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  order_date: [{ required: true, message: '请选择订单日期', trigger: 'change' }]
}

// 发货表单
const shipFormRef = ref<FormInstance>()
const shipForm = reactive({
  delivery_date: '',
  tracking_no: '',
  remark: ''
})

// 审核表单
const auditFormRef = ref<FormInstance>()
const auditForm = reactive({
  remark: ''
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1],
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    const res = await salesOrderApi.getList(params)
    tableData.value = res.list
    pagination.total = res.total
  } catch (error) {
    console.error('加载订单列表失败', error)
  } finally {
    loading.value = false
  }
}

// 加载客户列表
async function loadCustomers() {
  try {
    const res = await customerApi.getList({ pageSize: 1000 })
    customerList.value = res.list
  } catch (error) {
    console.error('加载客户列表失败', error)
  }
}

// 加载商品列表
async function loadProducts() {
  try {
    productList.value = await salesOrderApi.getProducts()
  } catch (error) {
    console.error('加载商品列表失败', error)
  }
}

// 搜索
function handleSearch() {
  pagination.page = 1
  loadData()
}

// 重置
function handleReset() {
  searchForm.search = ''
  searchForm.status = ''
  searchForm.payment_status = ''
  dateRange.value = null
  handleSearch()
}

// 分页
function handleSizeChange(size: number) {
  pagination.pageSize = size
  loadData()
}

function handlePageChange(page: number) {
  pagination.page = page
  loadData()
}

// 选择
function handleSelectionChange(rows: SalesOrder[]) {
  selectedRows.value = rows
}

// 新增
function handleAdd() {
  dialogType.value = 'add'
  resetOrderForm()
  orderForm.order_date = new Date().toISOString().split('T')[0]
  dialogVisible.value = true
}

// 编辑
function handleEdit(row: SalesOrder) {
  dialogType.value = 'edit'
  resetOrderForm()
  // 加载订单详情
  salesOrderApi.getDetail(row.id).then(detail => {
    currentOrder.value = detail
    orderForm.customer_id = detail.customer_id
    orderForm.order_date = detail.order_date
    orderForm.contact_person = detail.contact_person || ''
    orderForm.contact_phone = detail.contact_phone || ''
    orderForm.shipping_address = detail.shipping_address || ''
    orderForm.payment_method = detail.payment_method || ''
    orderForm.delivery_method = detail.delivery_method || ''
    orderForm.discount_amount = detail.discount_amount
    orderForm.remark = detail.remark || ''
    orderForm.items = detail.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_rate: item.discount_rate,
      tax_rate: item.tax_rate,
      remark: item.remark,
      specification: item.specification,
      unit: item.unit
    }))
    dialogVisible.value = true
  })
}

// 查看详情
function handleView(row: SalesOrder) {
  salesOrderApi.getDetail(row.id).then(detail => {
    currentOrder.value = detail
    detailVisible.value = true
  })
}

// 从详情编辑
function handleEditFromDetail() {
  if (currentOrder.value) {
    detailVisible.value = false
    handleEdit(currentOrder.value)
  }
}

// 从详情提交
function handleSubmitFromDetail() {
  if (currentOrder.value) {
    ElMessageBox.confirm('确定要提交此订单进行审核吗？', '提示', {
      type: 'warning'
    }).then(() => {
      salesOrderApi.confirm(currentOrder.value!.id).then(() => {
        ElMessage.success('订单已提交审核')
        detailVisible.value = false
        loadData()
      })
    }).catch(() => {})
  }
}

// 提交审核（从列表）
function handleSubmit(row: SalesOrder) {
  ElMessageBox.confirm('确定要提交此订单进行审核吗？', '提示', {
    type: 'warning'
  }).then(() => {
    salesOrderApi.confirm(row.id).then(() => {
      ElMessage.success('订单已提交审核')
      loadData()
    })
  }).catch(() => {})
}

// 审核
function handleConfirm(row: SalesOrder) {
  currentOrder.value = row
  auditForm.remark = ''
  auditDialogVisible.value = true
}

// 审核通过
function handleApprove() {
  if (!currentOrder.value) return
  submitting.value = true
  salesOrderApi.confirm(currentOrder.value.id, auditForm.remark).then(() => {
    ElMessage.success('审核通过')
    auditDialogVisible.value = false
    loadData()
  }).finally(() => {
    submitting.value = false
  })
}

// 审核驳回（这里简化为取消订单）
function handleReject() {
  if (!currentOrder.value) return
  ElMessageBox.prompt('请输入驳回原因', '驳回订单', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '请输入驳回原因'
  }).then(({ value }) => {
    submitting.value = true
    salesOrderApi.cancel(currentOrder.value!.id, value).then(() => {
      ElMessage.success('订单已驳回')
      auditDialogVisible.value = false
      loadData()
    }).finally(() => {
      submitting.value = false
    })
  }).catch(() => {})
}

// 发货
function handleShip(row: SalesOrder) {
  currentOrder.value = row
  shipForm.delivery_date = new Date().toISOString().split('T')[0]
  shipForm.tracking_no = ''
  shipForm.remark = ''
  shipDialogVisible.value = true
}

// 确认发货
function handleConfirmShip() {
  if (!currentOrder.value) return
  submitting.value = true
  salesOrderApi.ship(currentOrder.value.id, {
    delivery_date: shipForm.delivery_date,
    tracking_no: shipForm.tracking_no,
    remark: shipForm.remark
  }).then(() => {
    ElMessage.success('发货成功')
    shipDialogVisible.value = false
    loadData()
  }).finally(() => {
    submitting.value = false
  })
}

// 取消订单
function handleCancel(row: SalesOrder) {
  ElMessageBox.prompt('请输入取消原因', '取消订单', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '请输入取消原因'
  }).then(({ value }) => {
    salesOrderApi.cancel(row.id, value).then(() => {
      ElMessage.success('订单已取消')
      loadData()
    })
  }).catch(() => {})
}

// 导出
async function handleExport() {
  exporting.value = true
  try {
    const params = {
      ...searchForm,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1]
    }
    const blob = await salesOrderApi.export(params)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `销售订单_${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// 重置订单表单
function resetOrderForm() {
  orderForm.customer_id = undefined
  orderForm.order_date = ''
  orderForm.contact_person = ''
  orderForm.contact_phone = ''
  orderForm.shipping_address = ''
  orderForm.payment_method = ''
  orderForm.delivery_method = ''
  orderForm.discount_amount = 0
  orderForm.remark = ''
  orderForm.items = []
}

// 客户变更
function handleCustomerChange(customerId: number) {
  const customer = customerList.value.find(c => c.id === customerId)
  if (customer) {
    orderForm.contact_person = customer.contact_person || ''
    orderForm.contact_phone = customer.phone || ''
    orderForm.shipping_address = customer.address || ''
  }
}

// 添加商品明细
function handleAddItem() {
  orderForm.items.push({
    product_id: undefined as unknown as number,
    quantity: 1,
    unit_price: 0,
    discount_rate: 0,
    tax_rate: 0,
    remark: '',
    specification: '',
    unit: ''
  })
}

// 删除商品明细
function handleRemoveItem(index: number) {
  orderForm.items.splice(index, 1)
}

// 商品变更
function handleProductChange(productId: number, index: number) {
  const product = productList.value.find(p => p.id === productId)
  if (product) {
    orderForm.items[index].unit_price = product.selling_price
    orderForm.items[index].specification = product.specification || ''
    orderForm.items[index].unit = product.unit
  }
}

// 计算明细小计
function calculateItemTotal(item: SalesOrderItemParams): number {
  const subtotal = item.quantity * item.unit_price
  const discount = item.discount_rate ? subtotal * item.discount_rate / 100 : 0
  const tax = item.tax_rate ? (subtotal - discount) * item.tax_rate / 100 : 0
  return subtotal - discount + tax
}

// 计算商品金额小计
function calculateSubtotal(): number {
  return orderForm.items.reduce((sum, item) => {
    return sum + item.quantity * item.unit_price
  }, 0)
}

// 计算税额
function calculateTaxAmount(): number {
  return orderForm.items.reduce((sum, item) => {
    const subtotal = item.quantity * item.unit_price
    const discount = item.discount_rate ? subtotal * item.discount_rate / 100 : 0
    const tax = item.tax_rate ? (subtotal - discount) * item.tax_rate / 100 : 0
    return sum + tax
  }, 0)
}

// 计算订单总额
function calculateTotal(): number {
  const subtotal = orderForm.items.reduce((sum, item) => {
    return sum + calculateItemTotal(item)
  }, 0)
  return subtotal - orderForm.discount_amount
}

// 格式化金额
function formatAmount(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化日期时间
function formatDateTime(datetime: string): string {
  return datetime.replace('T', ' ').substring(0, 19)
}

// 提交订单
async function handleSubmitOrder() {
  if (!orderFormRef.value) return

  try {
    await orderFormRef.value.validate()
  } catch {
    return
  }

  if (orderForm.items.length === 0) {
    ElMessage.warning('请添加至少一个商品明细')
    return
  }

  // 验证商品明细
  for (const item of orderForm.items) {
    if (!item.product_id) {
      ElMessage.warning('请选择商品')
      return
    }
    if (item.quantity <= 0) {
      ElMessage.warning('商品数量必须大于0')
      return
    }
    if (item.unit_price < 0) {
      ElMessage.warning('商品单价不能为负数')
      return
    }
  }

  submitting.value = true
  try {
    const data = {
      customer_id: orderForm.customer_id!,
      order_date: orderForm.order_date,
      contact_person: orderForm.contact_person,
      contact_phone: orderForm.contact_phone,
      shipping_address: orderForm.shipping_address,
      payment_method: orderForm.payment_method,
      delivery_method: orderForm.delivery_method,
      discount_amount: orderForm.discount_amount,
      remark: orderForm.remark,
      items: orderForm.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_rate: item.discount_rate,
        tax_rate: item.tax_rate,
        remark: item.remark
      }))
    }

    if (dialogType.value === 'add') {
      await salesOrderApi.create(data)
      ElMessage.success('订单创建成功')
    } else {
      await salesOrderApi.update(currentOrder.value!.id, data)
      ElMessage.success('订单更新成功')
    }

    dialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('保存订单失败', error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadData()
  loadCustomers()
  loadProducts()
})
</script>

<style lang="scss" scoped>
.sales-order-page {
  .search-card,
  .toolbar-card {
    margin-bottom: 16px;

    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .table-card {
    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .amount {
    font-weight: 600;
    color: #f56c6c;
  }

  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .items-header {
    margin-bottom: 12px;
  }

  .amount-summary {
    margin-top: 16px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 4px;

    .amount {
      font-size: 16px;
      font-weight: 600;

      &.total {
        color: #f56c6c;
        font-size: 18px;
      }
    }
  }

  .detail-amount {
    margin-top: 16px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 4px;

    .amount-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;

      .label {
        color: #606266;
      }

      .value {
        font-weight: 600;
        font-size: 16px;
      }

      &.total .value {
        color: #f56c6c;
        font-size: 18px;
      }
    }
  }

  .remark {
    margin: 0;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    color: #606266;
    line-height: 1.6;
  }
}
</style>