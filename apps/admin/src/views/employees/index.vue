<template>
  <div class="employees-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">员工总数</div>
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
              <div class="stat-label">在职员工</div>
              <div class="stat-value">{{ stats.active }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card inactive">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">离职员工</div>
              <div class="stat-value">{{ stats.inactive }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card dept">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><OfficeBuilding /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">部门数</div>
              <div class="stat-value">{{ stats.by_department?.length || 0 }}</div>
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
            placeholder="姓名/电话/身份证"
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
        <el-form-item label="部门">
          <el-select v-model="filterForm.department" placeholder="全部部门" clearable style="width: 140px" @change="handleFilter">
            <el-option v-for="dept in departments" :key="dept" :label="dept" :value="dept" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 100px" @change="handleFilter">
            <el-option label="在职" :value="1" />
            <el-option label="离职" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增员工</el-button>
        </el-form-item>
        <el-form-item>
          <el-button :icon="Upload" @click="goOnboarding">入职录入</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="tableData" stripe style="width: 100%">
        <el-table-column prop="name" label="姓名" width="120">
          <template #default="{ row }">
            <div class="emp-info">
              <el-avatar :size="32" class="avatar-default">
                {{ row.name?.charAt(0) }}
              </el-avatar>
              <span class="emp-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="部门" width="120">
          <template #default="{ row }">
            {{ row.department || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="position" label="职位" width="120">
          <template #default="{ row }">
            {{ row.position || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" width="130">
          <template #default="{ row }">
            <a v-if="row.phone" :href="`tel:${row.phone}`" class="phone-link">{{ row.phone }}</a>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="contract_type" label="合同类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.contract_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contract_start" label="合同起始" width="110">
          <template #default="{ row }">
            {{ row.contract_start || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="contract_end" label="合同到期" width="110">
          <template #default="{ row }">
            <span :class="{ 'expired': isContractExpiringSoon(row.contract_end) }">
              {{ row.contract_end || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="salary" label="月薪" width="110" align="right">
          <template #default="{ row }">
            <span v-if="row.salary">¥{{ formatNumber(row.salary) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 || row.status === 'active' ? 'success' : 'info'" size="small">
              {{ getEmployeeStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleView(row)">详情</el-button>
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

    <!-- 新增/编辑员工弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="640px"
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
            <el-form-item label="姓名" prop="name">
              <el-input v-model="formData.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号" prop="id_card">
              <el-input v-model="formData.id_card" placeholder="请输入身份证号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="formData.phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电子邮箱">
              <el-input v-model="formData.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="部门">
              <el-select v-model="formData.department" placeholder="选择部门" clearable style="width: 100%">
                <el-option v-for="dept in departments" :key="dept" :label="dept" :value="dept" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="职位">
              <el-input v-model="formData.position" placeholder="请输入职位" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="角色">
              <el-select v-model="formData.role" placeholder="选择角色" style="width: 100%">
                <el-option label="老板" value="boss" />
                <el-option label="会计" value="accountant" />
                <el-option label="员工" value="employee" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="月薪">
              <el-input-number v-model="formData.salary" :min="0" :precision="2" placeholder="基本工资金额" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="合同类型">
              <el-select v-model="formData.contract_type" placeholder="选择合同类型" clearable style="width: 100%">
                <el-option label="正式" value="正式" />
                <el-option label="临时" value="临时" />
                <el-option label="实习" value="实习" />
                <el-option label="外包" value="外包" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="formData.status" placeholder="选择状态" style="width: 100%">
                <el-option label="在职" :value="1" />
                <el-option label="离职" :value="0" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="合同起始">
              <el-date-picker v-model="formData.contract_start" type="date" placeholder="合同开始日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同到期">
              <el-date-picker v-model="formData.contract_end" type="date" placeholder="合同结束日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开户银行">
              <el-input v-model="formData.bank_name" placeholder="如：中国工商银行" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="银行账号">
              <el-input v-model="formData.bank_account" placeholder="请输入银行卡号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="紧急联系人">
              <el-input v-model="formData.emergency_contact" placeholder="紧急联系人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="紧急联系电话">
              <el-input v-model="formData.emergency_phone" placeholder="紧急联系人电话" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteDialogVisible" title="删除确认" width="400px">
      <p>确定要删除员工「{{ deleteTarget?.name }}」吗？</p>
      <p class="delete-warning">删除后该员工的所有信息将无法恢复。</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确定删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSafeNavigate } from '@/composables/useNavigation'
import { ElMessage } from 'element-plus'
import {
  Plus, Search, User, CircleCheck, CircleClose, OfficeBuilding, Upload
} from '@element-plus/icons-vue'
import {
  employeeApi,
  type Employee,
  type EmployeeCreateParams,
  getEmployeeStatusLabel
} from '@/api/employee'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()
const { safeNavigate } = useSafeNavigate()

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Employee[]>([])
const departments = ref<string[]>(['财务部', '行政部', '销售部', '技术部', '人事部', '运营部'])

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  by_department: [] as Array<{ department: string; count: number }>
})

// 筛选表单
const filterForm = reactive({
  search: '',
  department: '',
  status: '' as 0 | 1 | ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑员工' : '新增员工')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Employee | null>(null)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<EmployeeCreateParams & { id?: number }>({
  name: '',
  id_card: '',
  phone: '',
  email: '',
  role: 'employee',
  department: '',
  position: '',
  salary: 0,
  contract_type: undefined,
  contract_start: '',
  contract_end: '',
  bank_account: '',
  bank_name: '',
  emergency_contact: '',
  emergency_phone: '',
  status: 1
})

const formRules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 工具函数
const formatNumber = (num: number) => {
  return num?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'
}

const isContractExpiringSoon = (endDate?: string) => {
  if (!endDate) return false
  return dayjs(endDate).isBefore(dayjs().add(30, 'day'))
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await employeeApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: filterForm.search || undefined,
      department: filterForm.department || undefined,
      status: filterForm.status || undefined
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
    const res = await employeeApi.getStats()
    stats.total = res.total || 0
    stats.active = res.active || 0
    stats.inactive = res.inactive || 0
    stats.by_department = res.by_department || []
  } catch (e) {
    console.error('加载统计失败', e)
  }
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

const handleAdd = () => {
  resetFormData()
  dialogVisible.value = true
}

const handleEdit = (row: Employee) => {
  resetFormData()
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    id_card: row.id_card,
    phone: row.phone,
    email: row.email,
    role: row.role,
    department: row.department,
    position: row.position,
    salary: row.base_salary || row.salary || 0,
    bank_account: row.bank_account,
    bank_name: row.bank_name,
    emergency_contact: row.emergency_contact,
    emergency_phone: row.emergency_phone,
    status: row.status === 'active' || row.status === 1 ? 1 : 0
  })
  dialogVisible.value = true
}

const handleView = (row: Employee) => {
  safeNavigate(`/employees/${row.id}`)
}

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
      // 转换字段名以匹配 API
      const updateData = {
        name: formData.name,
        id_card: formData.id_card,
        phone: formData.phone,
        email: formData.email,
        position: formData.position,
        department: formData.department,
        base_salary: formData.salary,
        status: formData.status === 1 ? 'active' : 'probation'
      }
      await employeeApi.update(formData.id, updateData)
      ElMessage.success('更新成功')
    } else {
      await employeeApi.create(formData)
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

const handleDelete = (row: Employee) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await employeeApi.delete(deleteTarget.value.id)
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

const resetFormData = () => {
  formData.id = undefined
  formData.name = ''
  formData.id_card = ''
  formData.phone = ''
  formData.email = ''
  formData.role = 'employee'
  formData.department = ''
  formData.position = ''
  formData.salary = 0
  formData.contract_type = undefined
  formData.contract_start = ''
  formData.contract_end = ''
  formData.bank_account = ''
  formData.bank_name = ''
  formData.emergency_contact = ''
  formData.emergency_phone = ''
  formData.status = 1
  formRef.value?.clearValidate()
}

const goOnboarding = () => {
  safeNavigate('/onboarding')
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.employees-page {
  .stats-row { margin-bottom: 20px; }

  .stat-card {
    border-radius: 12px;
    border: none;
    &.total { background: linear-gradient(135deg, #e8f4fd 0%, #d4e9fc 100%); .stat-icon { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); } .stat-value { color: #3b82f6; } }
    &.active { background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%); .stat-icon { background: linear-gradient(135deg, #07c160 0%, #06ad56 100%); } .stat-value { color: #07c160; } }
    &.inactive { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); .stat-icon { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); } .stat-value { color: #ef4444; } }
    &.dept { background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%); .stat-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); } .stat-value { color: #f59e0b; } }
    .stat-content { display: flex; align-items: center; gap: 16px; }
    .stat-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; }
    .stat-info { .stat-label { font-size: 13px; color: #909399; } .stat-value { font-size: 24px; font-weight: 600; margin-top: 4px; } }
  }

  .filter-card { margin-bottom: 20px; border-radius: 12px; :deep(.el-card__body) { padding: 16px 20px; } .filter-form { display: flex; flex-wrap: wrap; .el-form-item { margin-bottom: 0; margin-right: 16px; } } }

  .table-card {
    border-radius: 12px;
    :deep(.el-card__body) { padding: 0; }
    :deep(.el-table) {
      th.el-table__cell { background: #fafafa; color: #1a1a2e; font-weight: 500; }
      .emp-info { display: flex; align-items: center; gap: 10px; .avatar-default { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; } .emp-name { font-weight: 500; } }
      .phone-link { color: #3b82f6; text-decoration: none; &:hover { text-decoration: underline; } }
      .expired { color: #f56c6c; font-weight: 500; }
    }
  }

  .pagination-container { padding: 20px; display: flex; justify-content: flex-end; border-top: 1px solid #ebeef5; }
  .delete-warning { margin-top: 12px; padding: 10px 12px; background: #fef2f2; border-radius: 6px; color: #dc2626; font-size: 13px; }
}
</style>
