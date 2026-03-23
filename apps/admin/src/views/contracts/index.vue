<template>
  <div class="contracts-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">合同总数</div>
              <div class="stat-value">{{ stats.total }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card active">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">生效中</div>
              <div class="stat-value">{{ getStatusCount('active') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card expired">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已过期</div>
              <div class="stat-value">{{ getStatusCount('expired') }}</div>
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
              <div class="stat-label">合同总额</div>
              <div class="stat-value">{{ formatMoney(stats.total_amount) }}</div>
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
            placeholder="合同编号/名称/签约方" 
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
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="草稿" value="draft" />
            <el-option label="生效中" value="active" />
            <el-option label="已过期" value="expired" />
            <el-option label="已终止" value="terminated" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 120px" @change="handleFilter">
            <el-option label="销售合同" value="sales" />
            <el-option label="采购合同" value="purchase" />
            <el-option label="服务合同" value="service" />
            <el-option label="其他合同" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="签约方">
          <el-select v-model="filterForm.party_type" placeholder="全部" clearable style="width: 120px" @change="handleFilter">
            <el-option label="客户" value="customer" />
            <el-option label="供应商" value="supplier" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日期">
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
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增合同</el-button>
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
        @row-click="handleRowClick"
      >
        <el-table-column prop="contract_no" label="合同编号" width="140">
          <template #default="{ row }">
            <span class="contract-no">{{ row.contract_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="合同名称" min-width="180">
          <template #default="{ row }">
            <span class="contract-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="party_name" label="签约方" width="150">
          <template #default="{ row }">
            <div class="party-info">
              <span class="party-name">{{ row.party_name }}</span>
              <el-tag :type="row.party_type === 'customer' ? 'primary' : 'success'" size="small" class="party-tag">
                {{ row.party_type === 'customer' ? '客户' : '供应商' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="130" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="生效日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.start_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="end_date" label="到期日期" width="110">
          <template #default="{ row }">
            <span :class="{ 'overdue': isOverdue(row.end_date, row.status) }">
              {{ formatDate(row.end_date) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="sign_date" label="签订日期" width="110">
          <template #default="{ row }">
            {{ row.sign_date ? formatDate(row.sign_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="110">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" @click.stop="handleDelete(row)">删除</el-button>
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

    <!-- 新增/编辑合同弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="680px"
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
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="合同名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入合同名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同类型" prop="type">
              <el-select v-model="formData.type" placeholder="选择类型" style="width: 100%">
                <el-option label="销售合同" value="sales" />
                <el-option label="采购合同" value="purchase" />
                <el-option label="服务合同" value="service" />
                <el-option label="其他合同" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="签约方类型" prop="party_type">
              <el-select v-model="formData.party_type" placeholder="选择类型" style="width: 100%" @change="handlePartyTypeChange">
                <el-option label="客户" value="customer" />
                <el-option label="供应商" value="supplier" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="签约方" prop="party_id">
              <el-select 
                v-model="formData.party_id" 
                :placeholder="formData.party_type === 'customer' ? '选择客户' : '选择供应商'" 
                style="width: 100%"
                filterable
              >
                <el-option
                  v-for="item in partyOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="合同金额" prop="amount">
              <el-input-number 
                v-model="formData.amount" 
                :precision="2" 
                :min="0" 
                placeholder="请输入金额"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同状态">
              <el-select v-model="formData.status" placeholder="选择状态" style="width: 100%">
                <el-option label="草稿" value="draft" />
                <el-option label="生效中" value="active" />
                <el-option label="已过期" value="expired" />
                <el-option label="已终止" value="terminated" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="签订日期">
              <el-date-picker
                v-model="formData.sign_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生效日期" prop="start_date">
              <el-date-picker
                v-model="formData.start_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="到期日期" prop="end_date">
              <el-date-picker
                v-model="formData.end_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="合同内容">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="4"
            placeholder="合同主要内容描述（选填）"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="2"
            placeholder="备注信息（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 合同详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      title="合同详情"
      size="50%"
      direction="rtl"
    >
      <div class="contract-drawer" v-if="currentContract">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同编号">{{ currentContract.contract_no }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ currentContract.name }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">
            <el-tag :type="getTypeTagType(currentContract.type)" size="small">
              {{ getTypeLabel(currentContract.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="合同状态">
            <el-tag :type="getStatusTagType(currentContract.status)" size="small">
              {{ getStatusLabel(currentContract.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="签约方类型">
            {{ currentContract.party_type === 'customer' ? '客户' : '供应商' }}
          </el-descriptions-item>
          <el-descriptions-item label="签约方">{{ currentContract.party_name }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">
            <span class="amount">{{ formatMoney(currentContract.amount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="签订日期">{{ currentContract.sign_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="生效日期">{{ currentContract.start_date }}</el-descriptions-item>
          <el-descriptions-item label="到期日期">{{ currentContract.end_date }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ currentContract.creator_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentContract.created_at }}</el-descriptions-item>
          <el-descriptions-item label="合同内容" :span="2">
            <div class="content-text">{{ currentContract.content || '-' }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentContract.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除合同「{{ deleteTarget?.name }}」吗？</p>
      <p class="delete-warning">删除后数据将无法恢复。</p>
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
  Plus, Download, Search, Document, CircleCheck, Clock, Money
} from '@element-plus/icons-vue'
import {
  contractApi,
  type Contract,
  type ContractCreateParams,
  type ContractStatus,
  type ContractType,
  getContractStatusLabel as getStatusLabel,
  getContractTypeLabel as getTypeLabel,
  getContractStatusTagType as getStatusTagType,
  getContractTypeTagType as getTypeTagType
} from '@/api/contract'
import { customerApi } from '@/api/customer'
import { supplierApi } from '@/api/supplier'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Contract[]>([])
const currentContract = ref<Contract | null>(null)
const partyOptions = ref<Array<{ id: number; name: string }>>([])

// 统计数据
const stats = reactive({
  total: 0,
  by_status: [] as Array<{ status: string; count: number }>,
  by_type: [] as Array<{ type: string; count: number }>,
  total_amount: 0
})

// 筛选表单
const filterForm = reactive({
  search: '',
  status: '' as ContractStatus | '',
  type: '' as ContractType | '',
  party_type: '' as 'customer' | 'supplier' | '',
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
const dialogTitle = computed(() => formData.id ? '编辑合同' : '新增合同')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Contract | null>(null)
const drawerVisible = ref(false)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<ContractCreateParams & { id?: number }>({
  name: '',
  type: 'sales',
  party_type: 'customer',
  party_id: 0,
  amount: 0,
  status: 'draft',
  sign_date: '',
  start_date: '',
  end_date: '',
  content: '',
  remark: ''
})

// 表单校验
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入合同名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择合同类型', trigger: 'change' }
  ],
  party_type: [
    { required: true, message: '请选择签约方类型', trigger: 'change' }
  ],
  party_id: [
    { required: true, message: '请选择签约方', trigger: 'change' }
  ],
  amount: [
    { required: true, message: '请输入合同金额', trigger: 'blur' }
  ],
  start_date: [
    { required: true, message: '请选择生效日期', trigger: 'change' }
  ],
  end_date: [
    { required: true, message: '请选择到期日期', trigger: 'change' }
  ]
}

// 计算属性
const getStatusCount = (status: ContractStatus) => {
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
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

const isOverdue = (date: string, status: ContractStatus) => {
  if (!date || status === 'terminated' || status === 'expired') return false
  return dayjs(date).isBefore(dayjs(), 'day')
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await contractApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filterForm.search || undefined,
      status: filterForm.status || undefined,
      type: filterForm.type || undefined,
      party_type: filterForm.party_type || undefined,
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
    const res = await contractApi.getStats()
    stats.total = res.total || 0
    stats.by_status = res.by_status || []
    stats.by_type = res.by_type || []
    stats.total_amount = res.total_amount || 0
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

// 加载签约方选项
const loadPartyOptions = async (partyType: 'customer' | 'supplier') => {
  try {
    if (partyType === 'customer') {
      const res = await customerApi.getList({ pageSize: 1000 })
      partyOptions.value = (res.list || []).map(item => ({ id: item.id, name: item.name }))
    } else {
      const res = await supplierApi.getList({ pageSize: 1000 })
      partyOptions.value = (res.list || []).map(item => ({ id: item.id, name: item.name }))
    }
  } catch (e) {
    console.error('加载签约方失败', e)
    partyOptions.value = []
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

const handleRowClick = (row: Contract) => {
  currentContract.value = row
  drawerVisible.value = true
}

// 签约方类型变更
const handlePartyTypeChange = (val: 'customer' | 'supplier') => {
  formData.party_id = 0
  loadPartyOptions(val)
}

// 新增
const handleAdd = () => {
  resetForm()
  loadPartyOptions('customer')
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: Contract) => {
  resetForm()
  loadPartyOptions(row.party_type)
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    type: row.type,
    party_type: row.party_type,
    party_id: row.party_id,
    amount: row.amount,
    status: row.status,
    sign_date: row.sign_date,
    start_date: row.start_date,
    end_date: row.end_date,
    content: row.content,
    remark: row.remark
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
    const submitData: ContractCreateParams = {
      name: formData.name,
      type: formData.type,
      party_type: formData.party_type,
      party_id: formData.party_id,
      amount: formData.amount,
      status: formData.status,
      sign_date: formData.sign_date || undefined,
      start_date: formData.start_date,
      end_date: formData.end_date,
      content: formData.content || undefined,
      remark: formData.remark || undefined
    }
    
    if (formData.id) {
      await contractApi.update(formData.id, submitData)
      ElMessage.success('更新成功')
    } else {
      await contractApi.create(submitData)
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

// 删除
const handleDelete = (row: Contract) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await contractApi.delete(deleteTarget.value.id)
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
    const blob = await contractApi.export({
      search: filterForm.search || undefined,
      status: filterForm.status || undefined,
      type: filterForm.type || undefined,
      party_type: filterForm.party_type || undefined,
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `合同列表_${dayjs().format('YYYY-MM-DD')}.xlsx`
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
  formData.name = ''
  formData.type = 'sales'
  formData.party_type = 'customer'
  formData.party_id = 0
  formData.amount = 0
  formData.status = 'draft'
  formData.sign_date = ''
  formData.start_date = ''
  formData.end_date = ''
  formData.content = ''
  formData.remark = ''
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.contracts-page {
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
    
    &.active {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }
      
      .stat-value {
        color: #07c160;
      }
    }
    
    &.expired {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }
      
      .stat-value {
        color: #f59e0b;
      }
    }
    
    &.amount {
      background: linear-gradient(135deg, #f0e8fd 0%, #e4d4fc 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      }
      
      .stat-value {
        color: #8b5cf6;
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
      cursor: pointer;
      
      th.el-table__cell {
        background: #fafafa;
        color: #1a1a2e;
        font-weight: 500;
      }
      
      .contract-no {
        color: #3b82f6;
        font-weight: 500;
      }
      
      .contract-name {
        font-weight: 500;
      }
      
      .party-info {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .party-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .party-tag {
          flex-shrink: 0;
        }
      }
      
      .amount {
        font-weight: 600;
        color: #333;
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

  .delete-warning {
    margin-top: 12px;
    padding: 10px 12px;
    background: #fef2f2;
    border-radius: 6px;
    color: #dc2626;
    font-size: 13px;
  }
}

// 抽屉样式
.contract-drawer {
  padding: 0 20px 20px;
  
  .content-text {
    white-space: pre-wrap;
    line-height: 1.6;
  }
  
  .amount {
    font-weight: 600;
    color: #333;
  }
}
</style>