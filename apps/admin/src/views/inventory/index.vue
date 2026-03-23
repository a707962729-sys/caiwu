<template>
  <div class="inventory-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Box /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">商品种类</div>
              <div class="stat-value">{{ stats.total_products }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card quantity">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Goods /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">库存总量</div>
              <div class="stat-value">{{ formatNumber(stats.total_quantity) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card value">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">库存总值</div>
              <div class="stat-value">{{ formatMoney(stats.total_value) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card warning" :class="{ 'has-warning': stats.low_stock_count > 0 }">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">库存预警</div>
              <div class="stat-value">{{ stats.low_stock_count }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="仓库">
          <el-select v-model="filterForm.warehouse_id" placeholder="全部仓库" clearable style="width: 160px" @change="handleFilter">
            <el-option 
              v-for="wh in warehouses" 
              :key="wh.id" 
              :label="wh.name" 
              :value="wh.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="商品">
          <el-input 
            v-model="filterForm.product_name" 
            placeholder="搜索商品名称" 
            clearable 
            style="width: 180px"
            @keyup.enter="handleFilter"
            @clear="handleFilter"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="filterForm.low_stock" @change="handleFilter">只显示低库存</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleFilter">查询</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="success" :icon="Plus" @click="handleStockIn">入库</el-button>
          <el-button type="warning" :icon="Minus" @click="handleStockOut">出库</el-button>
          <el-button type="info" :icon="Switch" @click="handleTransfer">调拨</el-button>
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
        :row-class-name="getRowClassName"
      >
        <el-table-column prop="product_name" label="商品名称" min-width="160">
          <template #default="{ row }">
            <div class="product-cell">
              <span class="product-name">{{ row.product_name }}</span>
              <span v-if="row.product_sku" class="product-sku">{{ row.product_sku }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse_name" label="仓库" width="120" />
        <el-table-column prop="quantity" label="库存数量" width="120" align="right">
          <template #default="{ row }">
            <span :class="{ 'low-stock': isLowStock(row) }">
              {{ row.quantity }} {{ row.unit }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="safety_stock" label="安全库存" width="100" align="right">
          <template #default="{ row }">
            {{ row.safety_stock }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="cost_price" label="成本单价" width="110" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.cost_price) }}
          </template>
        </el-table-column>
        <el-table-column prop="total_cost" label="库存价值" width="120" align="right">
          <template #default="{ row }">
            <span class="total-cost">{{ formatMoney(row.total_cost) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.quantity <= 0" type="danger" size="small">缺货</el-tag>
            <el-tag v-else-if="isLowStock(row)" type="warning" size="small">低库存</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleViewLogs(row)">记录</el-button>
            <el-button link type="primary" @click="handleEditSafetyStock(row)">设置</el-button>
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

    <!-- 入库弹窗 -->
    <el-dialog
      v-model="stockInDialogVisible"
      title="商品入库"
      width="480px"
      :close-on-click-modal="false"
      @close="resetStockInForm"
    >
      <el-form
        ref="stockInFormRef"
        :model="stockInForm"
        :rules="stockInRules"
        label-width="80px"
      >
        <el-form-item label="商品" prop="product_id">
          <el-select
            v-model="stockInForm.product_id"
            placeholder="选择商品"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            >
              <span>{{ p.name }}</span>
              <span v-if="p.sku" class="option-sku">{{ p.sku }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="仓库" prop="warehouse_id">
          <el-select v-model="stockInForm.warehouse_id" placeholder="选择仓库" style="width: 100%">
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number
            v-model="stockInForm.quantity"
            :min="1"
            :max="999999"
            :precision="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="成本价" prop="cost_price">
          <el-input-number
            v-model="stockInForm.cost_price"
            :min="0"
            :precision="2"
            :controls="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="stockInForm.reason"
            type="textarea"
            :rows="2"
            placeholder="入库原因（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockInDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitStockIn">确认入库</el-button>
      </template>
    </el-dialog>

    <!-- 出库弹窗 -->
    <el-dialog
      v-model="stockOutDialogVisible"
      title="商品出库"
      width="480px"
      :close-on-click-modal="false"
      @close="resetStockOutForm"
    >
      <el-form
        ref="stockOutFormRef"
        :model="stockOutForm"
        :rules="stockOutRules"
        label-width="80px"
      >
        <el-form-item label="商品" prop="product_id">
          <el-select
            v-model="stockOutForm.product_id"
            placeholder="选择商品"
            filterable
            style="width: 100%"
            @change="handleProductChange"
          >
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库" prop="warehouse_id">
          <el-select v-model="stockOutForm.warehouse_id" placeholder="选择仓库" style="width: 100%">
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number
            v-model="stockOutForm.quantity"
            :min="1"
            :max="999999"
            :precision="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="stockOutForm.reason"
            type="textarea"
            :rows="2"
            placeholder="出库原因（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockOutDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitStockOut">确认出库</el-button>
      </template>
    </el-dialog>

    <!-- 调拨弹窗 -->
    <el-dialog
      v-model="transferDialogVisible"
      title="库存调拨"
      width="480px"
      :close-on-click-modal="false"
      @close="resetTransferForm"
    >
      <el-form
        ref="transferFormRef"
        :model="transferForm"
        :rules="transferRules"
        label-width="80px"
      >
        <el-form-item label="商品" prop="product_id">
          <el-select
            v-model="transferForm.product_id"
            placeholder="选择商品"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="源仓库" prop="from_warehouse_id">
          <el-select v-model="transferForm.from_warehouse_id" placeholder="选择源仓库" style="width: 100%">
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标仓库" prop="to_warehouse_id">
          <el-select v-model="transferForm.to_warehouse_id" placeholder="选择目标仓库" style="width: 100%">
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
              :disabled="wh.id === transferForm.from_warehouse_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number
            v-model="transferForm.quantity"
            :min="1"
            :max="999999"
            :precision="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="transferForm.reason"
            type="textarea"
            :rows="2"
            placeholder="调拨原因（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitTransfer">确认调拨</el-button>
      </template>
    </el-dialog>

    <!-- 设置安全库存弹窗 -->
    <el-dialog
      v-model="safetyStockDialogVisible"
      title="设置安全库存"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="safetyStockForm" label-width="80px">
        <el-form-item label="商品">
          <span>{{ currentInventory?.product_name }}</span>
        </el-form-item>
        <el-form-item label="仓库">
          <span>{{ currentInventory?.warehouse_name }}</span>
        </el-form-item>
        <el-form-item label="当前库存">
          <span>{{ currentInventory?.quantity }} {{ currentInventory?.unit }}</span>
        </el-form-item>
        <el-form-item label="安全库存">
          <el-input-number
            v-model="safetyStockForm.safety_stock"
            :min="0"
            :max="999999"
            :precision="0"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="safetyStockDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitSafetyStock">保存</el-button>
      </template>
    </el-dialog>

    <!-- 库存变动记录弹窗 -->
    <el-dialog
      v-model="logsDialogVisible"
      title="库存变动记录"
      width="900px"
      :close-on-click-modal="false"
    >
      <div class="logs-filter">
        <el-select v-model="logsFilter.type" placeholder="全部类型" clearable style="width: 120px" @change="loadLogs">
          <el-option label="入库" value="stock_in" />
          <el-option label="出库" value="stock_out" />
          <el-option label="调拨入" value="transfer_in" />
          <el-option label="调拨出" value="transfer_out" />
          <el-option label="调整" value="adjust" />
        </el-select>
      </div>
      <el-table
        v-loading="logsLoading"
        :data="logsData"
        stripe
        max-height="400px"
      >
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getLogTypeTagType(row.type)" size="small">
              {{ getLogTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse_name" label="仓库" width="100" />
        <el-table-column prop="quantity" label="数量" width="100" align="right">
          <template #default="{ row }">
            <span :class="['log-quantity', row.type.includes('in') ? 'positive' : 'negative']">
              {{ row.type.includes('in') ? '+' : '-' }}{{ row.quantity }} {{ row.unit }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="before_quantity" label="变动前" width="90" align="right">
          <template #default="{ row }">
            {{ row.before_quantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="after_quantity" label="变动后" width="90" align="right">
          <template #default="{ row }">
            {{ row.after_quantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="金额" width="100" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.total_amount) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="备注" min-width="120">
          <template #default="{ row }">
            {{ row.reason || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
      </el-table>
      <div class="logs-pagination">
        <el-pagination
          v-model:current-page="logsPagination.page"
          v-model:page-size="logsPagination.pageSize"
          :total="logsPagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, prev, pager, next"
          small
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Plus, Minus, Search, Box, Goods, Money, Warning, Switch 
} from '@element-plus/icons-vue'
import { 
  inventoryApi, 
  type InventoryItem, 
  type InventoryLog,
  type Warehouse,
  type StockInParams,
  type StockOutParams,
  type TransferParams
} from '@/api/inventory'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const logsLoading = ref(false)

// 数据
const tableData = ref<InventoryItem[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Array<{ id: number; name: string; sku?: string; unit: string }>>([])

// 统计数据
const stats = reactive({
  total_products: 0,
  total_quantity: 0,
  total_value: 0,
  low_stock_count: 0
})

// 筛选表单
const filterForm = reactive({
  warehouse_id: undefined as number | undefined,
  product_name: '',
  low_stock: false
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 入库弹窗
const stockInDialogVisible = ref(false)
const stockInFormRef = ref<FormInstance>()
const stockInForm = reactive<StockInParams>({
  product_id: 0,
  warehouse_id: 0,
  quantity: 1,
  cost_price: 0,
  reason: ''
})
const stockInRules: FormRules = {
  product_id: [{ required: true, message: '请选择商品', trigger: 'change' }],
  warehouse_id: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  cost_price: [{ required: true, message: '请输入成本价', trigger: 'blur' }]
}

// 出库弹窗
const stockOutDialogVisible = ref(false)
const stockOutFormRef = ref<FormInstance>()
const stockOutForm = reactive<StockOutParams>({
  product_id: 0,
  warehouse_id: 0,
  quantity: 1,
  reason: ''
})
const stockOutRules: FormRules = {
  product_id: [{ required: true, message: '请选择商品', trigger: 'change' }],
  warehouse_id: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

// 调拨弹窗
const transferDialogVisible = ref(false)
const transferFormRef = ref<FormInstance>()
const transferForm = reactive<TransferParams>({
  product_id: 0,
  from_warehouse_id: 0,
  to_warehouse_id: 0,
  quantity: 1,
  reason: ''
})
const transferRules: FormRules = {
  product_id: [{ required: true, message: '请选择商品', trigger: 'change' }],
  from_warehouse_id: [{ required: true, message: '请选择源仓库', trigger: 'change' }],
  to_warehouse_id: [{ required: true, message: '请选择目标仓库', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

// 安全库存弹窗
const safetyStockDialogVisible = ref(false)
const currentInventory = ref<InventoryItem | null>(null)
const safetyStockForm = reactive({
  safety_stock: 0
})

// 变动记录弹窗
const logsDialogVisible = ref(false)
const logsData = ref<InventoryLog[]>([])
const logsFilter = reactive({
  inventory_id: undefined as number | undefined,
  type: '' as '' | 'stock_in' | 'stock_out' | 'transfer_in' | 'transfer_out' | 'adjust'
})
const logsPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 工具函数
const formatMoney = (n: number) => {
  if (!n && n !== 0) return '0.00'
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatNumber = (n: number) => {
  if (!n && n !== 0) return '0'
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(2) + '万'
  }
  return n.toLocaleString('zh-CN')
}

const formatDateTime = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const isLowStock = (row: InventoryItem) => {
  return row.quantity <= row.safety_stock
}

const getRowClassName = ({ row }: { row: InventoryItem }) => {
  if (row.quantity <= 0) return 'out-of-stock-row'
  if (row.quantity <= row.safety_stock) return 'low-stock-row'
  return ''
}

const getLogTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    stock_in: '入库',
    stock_out: '出库',
    transfer_in: '调入',
    transfer_out: '调出',
    adjust: '调整'
  }
  return map[type] || type
}

const getLogTypeTagType = (type: string) => {
  const map: Record<string, string> = {
    stock_in: 'success',
    stock_out: 'danger',
    transfer_in: 'success',
    transfer_out: 'warning',
    adjust: 'info'
  }
  return map[type] || ''
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await inventoryApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      warehouse_id: filterForm.warehouse_id,
      product_name: filterForm.product_name || undefined,
      low_stock: filterForm.low_stock || undefined
    })
    
    tableData.value = res.list || []
    pagination.total = res.total || 0
    
    // 更新统计
    if (res.stats) {
      stats.total_products = res.stats.total_products || 0
      stats.total_quantity = res.stats.total_quantity || 0
      stats.total_value = res.stats.total_value || 0
      stats.low_stock_count = res.stats.low_stock_count || 0
    }
  } catch (e) {
    console.error('加载失败', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    warehouses.value = await inventoryApi.getWarehouses()
  } catch (e) {
    console.error('加载仓库失败', e)
    // 模拟数据
    warehouses.value = [
      { id: 1, name: '主仓库', code: 'WH001', status: 1 },
      { id: 2, name: '分仓库', code: 'WH002', status: 1 }
    ] as Warehouse[]
  }
}

// 加载商品列表
const loadProducts = async () => {
  try {
    products.value = await inventoryApi.getProducts()
  } catch (e) {
    console.error('加载商品失败', e)
    // 模拟数据
    products.value = [
      { id: 1, name: '商品A', sku: 'SKU001', unit: '件' },
      { id: 2, name: '商品B', sku: 'SKU002', unit: '个' },
      { id: 3, name: '商品C', sku: 'SKU003', unit: '箱' }
    ]
  }
}

// 筛选
const handleFilter = () => {
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

// 入库
const handleStockIn = () => {
  resetStockInForm()
  stockInDialogVisible.value = true
}

const resetStockInForm = () => {
  stockInForm.product_id = 0
  stockInForm.warehouse_id = 0
  stockInForm.quantity = 1
  stockInForm.cost_price = 0
  stockInForm.reason = ''
  stockInFormRef.value?.clearValidate()
}

const submitStockIn = async () => {
  if (!stockInFormRef.value) return
  
  try {
    await stockInFormRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    await inventoryApi.stockIn({
      product_id: stockInForm.product_id,
      warehouse_id: stockInForm.warehouse_id,
      quantity: stockInForm.quantity,
      cost_price: stockInForm.cost_price,
      reason: stockInForm.reason
    })
    ElMessage.success('入库成功')
    stockInDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error('入库失败', e)
    ElMessage.error('入库失败')
  } finally {
    submitting.value = false
  }
}

// 出库
const handleStockOut = () => {
  resetStockOutForm()
  stockOutDialogVisible.value = true
}

const resetStockOutForm = () => {
  stockOutForm.product_id = 0
  stockOutForm.warehouse_id = 0
  stockOutForm.quantity = 1
  stockOutForm.reason = ''
  stockOutFormRef.value?.clearValidate()
}

const handleProductChange = () => {
  // 可以根据商品变化加载该商品的库存信息
}

const submitStockOut = async () => {
  if (!stockOutFormRef.value) return
  
  try {
    await stockOutFormRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    await inventoryApi.stockOut({
      product_id: stockOutForm.product_id,
      warehouse_id: stockOutForm.warehouse_id,
      quantity: stockOutForm.quantity,
      reason: stockOutForm.reason
    })
    ElMessage.success('出库成功')
    stockOutDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error('出库失败', e)
    ElMessage.error('出库失败')
  } finally {
    submitting.value = false
  }
}

// 调拨
const handleTransfer = () => {
  resetTransferForm()
  transferDialogVisible.value = true
}

const resetTransferForm = () => {
  transferForm.product_id = 0
  transferForm.from_warehouse_id = 0
  transferForm.to_warehouse_id = 0
  transferForm.quantity = 1
  transferForm.reason = ''
  transferFormRef.value?.clearValidate()
}

const submitTransfer = async () => {
  if (!transferFormRef.value) return
  
  try {
    await transferFormRef.value.validate()
  } catch {
    return
  }
  
  if (transferForm.from_warehouse_id === transferForm.to_warehouse_id) {
    ElMessage.error('源仓库和目标仓库不能相同')
    return
  }
  
  submitting.value = true
  try {
    await inventoryApi.transfer({
      product_id: transferForm.product_id,
      from_warehouse_id: transferForm.from_warehouse_id,
      to_warehouse_id: transferForm.to_warehouse_id,
      quantity: transferForm.quantity,
      reason: transferForm.reason
    })
    ElMessage.success('调拨成功')
    transferDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error('调拨失败', e)
    ElMessage.error('调拨失败')
  } finally {
    submitting.value = false
  }
}

// 设置安全库存
const handleEditSafetyStock = (row: InventoryItem) => {
  currentInventory.value = row
  safetyStockForm.safety_stock = row.safety_stock
  safetyStockDialogVisible.value = true
}

const submitSafetyStock = async () => {
  if (!currentInventory.value) return
  
  submitting.value = true
  try {
    await inventoryApi.updateSafetyStock(currentInventory.value.id, safetyStockForm.safety_stock)
    ElMessage.success('设置成功')
    safetyStockDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error('设置失败', e)
    ElMessage.error('设置失败')
  } finally {
    submitting.value = false
  }
}

// 查看变动记录
const handleViewLogs = (row: InventoryItem) => {
  logsFilter.inventory_id = row.id
  logsFilter.type = ''
  logsPagination.page = 1
  logsDialogVisible.value = true
  loadLogs()
}

const loadLogs = async () => {
  if (!logsFilter.inventory_id) return
  
  logsLoading.value = true
  try {
    const res = await inventoryApi.getLogs({
      page: logsPagination.page,
      pageSize: logsPagination.pageSize,
      inventory_id: logsFilter.inventory_id,
      type: logsFilter.type || undefined
    })
    logsData.value = res.list || []
    logsPagination.total = res.total || 0
  } catch (e) {
    console.error('加载记录失败', e)
    ElMessage.error('加载记录失败')
  } finally {
    logsLoading.value = false
  }
}

// 初始化
onMounted(() => {
  loadWarehouses()
  loadProducts()
  loadData()
})
</script>

<style lang="scss" scoped>
.inventory-page {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    border-radius: 12px;
    border: none;
    
    &.total {
      background: linear-gradient(135deg, #e8f4fd 0%, #d4e9fc 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #409eff 0%, #3375b9 100%);
      }
      
      .stat-value {
        color: #409eff;
      }
    }
    
    &.quantity {
      background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #67c23a 0%, #529b2e 100%);
      }
      
      .stat-value {
        color: #67c23a;
      }
    }
    
    &.value {
      background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #f56c6c 0%, #dd6161 100%);
      }
      
      .stat-value {
        color: #f56c6c;
      }
    }
    
    &.warning {
      background: linear-gradient(135deg, #fdf6ec 0%, #faecd8 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #e6a23c 0%, #cf9236 100%);
      }
      
      .stat-value {
        color: #e6a23c;
      }
      
      &.has-warning {
        animation: pulse 2s infinite;
        
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(230, 162, 60, 0.4);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(230, 162, 60, 0);
          }
        }
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
      
      .product-cell {
        display: flex;
        flex-direction: column;
        
        .product-name {
          font-weight: 500;
        }
        
        .product-sku {
          font-size: 12px;
          color: #909399;
        }
      }
      
      .low-stock {
        color: #e6a23c;
        font-weight: 600;
      }
      
      .total-cost {
        font-weight: 600;
        color: #409eff;
      }
      
      .out-of-stock-row {
        background-color: #fef0f0 !important;
      }
      
      .low-stock-row {
        background-color: #fdf6ec !important;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .option-sku {
    margin-left: 8px;
    color: #909399;
    font-size: 12px;
  }

  .logs-filter {
    margin-bottom: 16px;
  }

  .logs-pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .log-quantity {
    font-weight: 600;
    
    &.positive {
      color: #67c23a;
    }
    
    &.negative {
      color: #f56c6c;
    }
  }
}
</style>