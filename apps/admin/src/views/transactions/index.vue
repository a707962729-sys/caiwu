<template>
  <div class="transactions-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card income">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><TrendCharts /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">收入</div>
              <div class="stat-value">{{ formatMoney(stats.total_income) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card expense">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Minus /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">支出</div>
              <div class="stat-value">{{ formatMoney(stats.total_expense) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card" :class="{ positive: stats.net_profit >= 0, negative: stats.net_profit < 0 }">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Wallet /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">结余</div>
              <div class="stat-value">{{ stats.net_profit >= 0 ? '+' : '' }}{{ formatMoney(stats.net_profit) }}</div>
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
        <el-form-item label="类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 120px" @change="handleFilter">
            <el-option label="收入" value="income" />
            <el-option label="支出" value="expense" />
            <el-option label="转账" value="transfer" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="filterForm.category" placeholder="全部分类" clearable style="width: 140px" @change="handleFilter">
            <el-option 
              v-for="cat in filteredCategories" 
              :key="cat.name" 
              :label="cat.name" 
              :value="cat.name" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input 
            v-model="filterForm.search" 
            placeholder="备注/对方" 
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
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增记账</el-button>
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
      >
        <el-table-column prop="transaction_date" label="日期" width="120" sortable="custom">
          <template #default="{ row }">
            {{ formatDate(row.transaction_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="transaction_type" label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.transaction_type)" size="small">
              {{ getTypeLabel(row.transaction_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <span class="category-cell">
              <span class="category-icon">{{ getCategoryIcon(row.category) }}</span>
              {{ row.category }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="140" align="right" sortable="custom">
          <template #default="{ row }">
            <span :class="['amount', row.transaction_type]">
              {{ row.transaction_type === 'income' ? '+' : '-' }}{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="备注" min-width="180">
          <template #default="{ row }">
            <span class="description">{{ row.description || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="counterparty" label="对方" width="140">
          <template #default="{ row }">
            {{ row.counterparty || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="540px"
      :close-on-click-modal="false"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
        style="padding-right: 20px"
      >
        <el-form-item label="类型" prop="transaction_type">
          <el-radio-group v-model="formData.transaction_type" @change="handleTypeChange">
            <el-radio-button label="income">收入</el-radio-button>
            <el-radio-button label="expense">支出</el-radio-button>
            <el-radio-button label="transfer">转账</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="formData.category" placeholder="选择分类" style="width: 100%">
            <el-option
              v-for="cat in availableCategories"
              :key="cat.name"
              :label="cat.name"
              :value="cat.name"
            >
              <span>{{ getCategoryIcon(cat.name) }} {{ cat.name }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number
            v-model="formData.amount"
            :precision="2"
            :min="0"
            :max="999999999"
            :controls="false"
            placeholder="请输入金额"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="日期" prop="transaction_date">
          <el-date-picker
            v-model="formData.transaction_date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="对方">
          <el-input v-model="formData.counterparty" placeholder="对方名称（选填）" />
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
      <p>确定要删除这条记录吗？</p>
      <p class="delete-info">
        <el-tag :type="getTypeTagType(deleteTarget?.transaction_type || 'income')" size="small">
          {{ getTypeLabel(deleteTarget?.transaction_type || 'income') }}
        </el-tag>
        <span class="amount" :class="deleteTarget?.transaction_type">
          {{ deleteTarget?.transaction_type === 'income' ? '+' : '-' }}{{ formatMoney(deleteTarget?.amount || 0) }}
        </span>
        <span class="category">{{ deleteTarget?.category }}</span>
      </p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确定删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Plus, Download, Search, TrendCharts, Minus, Wallet 
} from '@element-plus/icons-vue'
import { transactionApi, type Transaction, type TransactionCreateParams } from '@/api/transaction'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
dayjs.extend(quarterOfYear)

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Transaction[]>([])
const categories = ref<Array<{ name: string; type: string; icon?: string }>>([])

// 统计数据
const stats = reactive({
  total_income: 0,
  total_expense: 0,
  net_profit: 0
})

// 筛选表单
const filterForm = reactive({
  type: '' as '' | 'income' | 'expense' | 'transfer',
  category: '',
  status: '',
  search: '',
  startDate: '',
  endDate: ''
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
  },
  {
    text: '本季度',
    value: () => {
      const start = dayjs().startOf('quarter').format('YYYY-MM-DD')
      const end = dayjs().endOf('quarter').format('YYYY-MM-DD')
      return [start, end]
    }
  },
  {
    text: '本年',
    value: () => {
      const start = dayjs().startOf('year').format('YYYY-MM-DD')
      const end = dayjs().endOf('year').format('YYYY-MM-DD')
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

// 排序
const sortParams = reactive({
  sortBy: 'transaction_date',
  sortOrder: 'desc' as 'asc' | 'desc'
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑记账' : '新增记账')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Transaction | null>(null)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<TransactionCreateParams & { id?: number }>({
  transaction_type: 'expense',
  category: '',
  amount: 0,
  transaction_date: dayjs().format('YYYY-MM-DD'),
  description: '',
  counterparty: ''
})

// 表单校验规则
const formRules: FormRules = {
  transaction_type: [
    { required: true, message: '请选择类型', trigger: 'change' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ],
  amount: [
    { required: true, message: '请输入金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '金额必须大于0', trigger: 'blur' }
  ],
  transaction_date: [
    { required: true, message: '请选择日期', trigger: 'change' }
  ]
}

// 计算属性：根据类型筛选分类
const filteredCategories = computed(() => {
  if (!filterForm.type) return categories.value
  return categories.value.filter(c => c.type === filterForm.type)
})

const availableCategories = computed(() => {
  return categories.value.filter(c => c.type === formData.transaction_type)
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
  return dayjs(date).format('MM-DD')
}

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    income: '收入',
    expense: '支出',
    transfer: '转账'
  }
  return map[type] || type
}

const getTypeTagType = (type: string) => {
  const map: Record<string, string> = {
    income: 'success',
    expense: 'danger',
    transfer: 'warning'
  }
  return map[type] || ''
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const getStatusTagType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    completed: 'success',
    cancelled: 'info'
  }
  return map[status] || ''
}

const getCategoryIcon = (cat: string) => {
  const icons: Record<string, string> = {
    '销售收入': '💵', '服务收入': '💼', '利息收入': '🏦', '利息': '🏦', '投资收益': '📈',
    '人员工资': '👥', '办公费用': '📋', '办公': '📋', '差旅费': '✈️', '差旅': '✈️',
    '采购成本': '📦', '采购': '📦', '房租物业': '🏢', '房租': '🏢', '水电费': '💡',
    '餐饮': '🍜', '交通': '🚗', '购物': '🛒', '工资': '👥', '福利': '🎁',
    '其他': '📌', '其他支出': '📌', '其他收入': '📌', '转账': '🔄'
  }
  return icons[cat] || '📌'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await transactionApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      type: filterForm.type || undefined,
      category: filterForm.category || undefined,
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined,
      search: filterForm.search || undefined
    })
    
    tableData.value = res.list || []
    pagination.total = res.total || 0
    
    // 更新统计
    if (res.summary) {
      stats.total_income = res.summary.total_income || 0
      stats.total_expense = res.summary.total_expense || 0
      stats.net_profit = res.summary.net_profit || 0
    }
  } catch (e) {
    console.error('加载失败', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 加载分类
const loadCategories = async () => {
  try {
    // 默认分类列表
    categories.value = [
      { name: '销售收入', type: 'income' },
      { name: '服务收入', type: 'income' },
      { name: '利息收入', type: 'income' },
      { name: '投资收益', type: 'income' },
      { name: '其他收入', type: 'income' },
      { name: '人员工资', type: 'expense' },
      { name: '办公费用', type: 'expense' },
      { name: '差旅费', type: 'expense' },
      { name: '采购成本', type: 'expense' },
      { name: '房租物业', type: 'expense' },
      { name: '水电费', type: 'expense' },
      { name: '餐饮', type: 'expense' },
      { name: '交通', type: 'expense' },
      { name: '购物', type: 'expense' },
      { name: '福利', type: 'expense' },
      { name: '其他支出', type: 'expense' }
    ]
  } catch (e) {
    console.error('加载分类失败', e)
  }
}

// 事件处理
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

const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
  if (order) {
    sortParams.sortBy = prop
    sortParams.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  }
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
  formData.transaction_type = 'expense'
  formData.transaction_date = dayjs().format('YYYY-MM-DD')
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: Transaction) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    transaction_type: row.transaction_type,
    category: row.category,
    subcategory: row.subcategory,
    amount: row.amount,
    transaction_date: row.transaction_date,
    description: row.description,
    counterparty: row.counterparty
  })
  dialogVisible.value = true
}

// 类型变化时清空分类
const handleTypeChange = () => {
  formData.category = ''
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
      await transactionApi.update(formData.id, {
        transaction_type: formData.transaction_type,
        category: formData.category,
        subcategory: formData.subcategory,
        amount: formData.amount,
        transaction_date: formData.transaction_date,
        description: formData.description,
        counterparty: formData.counterparty
      })
      ElMessage.success('更新成功')
    } else {
      await transactionApi.create({
        transaction_type: formData.transaction_type,
        category: formData.category,
        subcategory: formData.subcategory,
        amount: formData.amount,
        transaction_date: formData.transaction_date,
        description: formData.description,
        counterparty: formData.counterparty
      })
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

// 删除
const handleDelete = (row: Transaction) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await transactionApi.delete(deleteTarget.value.id)
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
    const blob = await transactionApi.export({
      type: filterForm.type || undefined,
      category: filterForm.category || undefined,
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined,
      search: filterForm.search || undefined
    })
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `记账记录_${dayjs().format('YYYY-MM-DD')}.xlsx`
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
  formData.transaction_type = 'expense'
  formData.category = ''
  formData.subcategory = undefined
  formData.amount = 0
  formData.transaction_date = dayjs().format('YYYY-MM-DD')
  formData.description = ''
  formData.counterparty = ''
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  // 默认加载本月数据
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  dateRange.value = [start, end]
  filterForm.startDate = start
  filterForm.endDate = end
  
  loadCategories()
  loadData()
})
</script>

<style lang="scss" scoped>
.transactions-page {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    border-radius: 12px;
    border: none;
    
    &.income {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }
      
      .stat-value {
        color: #07c160;
      }
    }
    
    &.expense {
      background: linear-gradient(135deg, #fff0f0 0%, #ffe8e8 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #ee0a24 0%, #d60a1e 100%);
      }
      
      .stat-value {
        color: #ee0a24;
      }
    }
    
    &.positive {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);
      
      .stat-value {
        color: #07c160;
      }
    }
    
    &.negative {
      background: linear-gradient(135deg, #fff0f0 0%, #ffe8e8 100%);
      
      .stat-value {
        color: #ee0a24;
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
      
      .category-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        
        .category-icon {
          font-size: 16px;
        }
      }
      
      .amount {
        font-weight: 600;
        
        &.income {
          color: #07c160;
        }
        
        &.expense {
          color: #333;
        }
      }
      
      .description {
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

  .delete-info {
    margin-top: 16px;
    padding: 12px 16px;
    background: #fafafa;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    
    .amount {
      font-weight: 600;
      font-size: 16px;
      
      &.income {
        color: #07c160;
      }
      
      &.expense {
        color: #ee0a24;
      }
    }
    
    .category {
      color: #909399;
    }
  }
}
</style>