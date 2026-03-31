<template>
  <div class="users-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">用户总数</div>
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
              <div class="stat-label">启用用户</div>
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
              <div class="stat-label">禁用用户</div>
              <div class="stat-value">{{ stats.inactive }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card roles">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Avatar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">角色数</div>
              <div class="stat-value">{{ roles.length }}</div>
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
            placeholder="用户名/姓名/电话" 
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
        <el-form-item label="角色">
          <el-select v-model="filterForm.role" placeholder="全部角色" clearable style="width: 120px" @change="handleFilter">
            <el-option label="老板" value="boss" />
            <el-option label="会计" value="accountant" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 100px" @change="handleFilter">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="filterForm.department" placeholder="全部部门" clearable style="width: 140px" @change="handleFilter">
            <el-option v-for="dept in departments" :key="dept.id" :label="dept.name" :value="dept.name" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增用户</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="tableData" stripe style="width: 100%">
        <el-table-column prop="username" label="用户名" width="140">
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar v-if="row.avatar" :src="row.avatar" :size="32" />
              <el-avatar v-else :size="32" class="avatar-default">
                {{ row.real_name?.charAt(0) || row.username?.charAt(0) }}
              </el-avatar>
              <span class="username">{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="real_name" label="姓名" width="120">
          <template #default="{ row }">
            {{ row.real_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)" size="small">
              {{ getRoleLabel(row.role) }}
            </el-tag>
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
            <span v-if="row.phone" class="phone-link" @click.stop>
              <a :href="`tel:${row.phone}`">{{ row.phone }}</a>
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">
            <a v-if="row.email" :href="`mailto:${row.email}`" class="email-link">{{ row.email }}</a>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="110">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="handleResetPassword(row)">重置密码</el-button>
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

    <!-- 新增/编辑用户弹窗 -->
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
        label-width="80px"
        style="padding-right: 20px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input 
                v-model="formData.username" 
                placeholder="请输入用户名"
                :disabled="!!formData.id"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="real_name">
              <el-input v-model="formData.real_name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="角色" prop="role">
              <el-select v-model="formData.role" placeholder="选择角色" style="width: 100%">
                <el-option label="老板" value="boss" />
                <el-option label="会计" value="accountant" />
                <el-option label="员工" value="employee" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-switch
                v-model="formData.status"
                :active-value="1"
                :inactive-value="0"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="部门">
              <el-select v-model="formData.department" placeholder="选择部门" clearable style="width: 100%">
                <el-option v-for="dept in departments" :key="dept.id" :label="dept.name" :value="dept.name" />
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
            <el-form-item label="电话">
              <el-input v-model="formData.phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="formData.email" placeholder="电子邮箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="!formData.id" label="初始密码" prop="password">
          <el-input 
            v-model="formData.password" 
            type="password"
            placeholder="请输入初始密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog
      v-model="resetPasswordVisible"
      title="重置密码"
      width="400px"
      :close-on-click-modal="false"
      @close="resetPasswordForm"
    >
      <el-form
        ref="resetFormRef"
        :model="resetPasswordData"
        :rules="resetPasswordRules"
        label-width="80px"
      >
        <el-form-item label="用户">
          <span>{{ currentUser?.username }} ({{ currentUser?.real_name }})</span>
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="resetPasswordData.newPassword" 
            type="password"
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="resetPasswordData.confirmPassword" 
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetting" @click="handleConfirmResetPassword">确定</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除用户「{{ deleteTarget?.username }}」吗？</p>
      <p class="delete-warning">删除后该用户将无法登录系统，此操作不可恢复。</p>
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
  Plus, Search, User, CircleCheck, CircleClose, Avatar
} from '@element-plus/icons-vue'
import {
  userApi,
  type User as UserType,
  type UserCreateParams,
  type UserRole,
  type Department,
  type Role,
  getUserRoleLabel as getRoleLabel,
  getUserRoleTagType as getRoleTagType
} from '@/api/user'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const resetting = ref(false)

// 数据
const tableData = ref<UserType[]>([])
const departments = ref<Department[]>([])
const roles = ref<Role[]>([])
const currentUser = ref<UserType | null>(null)

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0
})

// 筛选表单
const filterForm = reactive({
  search: '',
  role: '' as UserRole | '',
  status: '' as 0 | 1 | '',
  department: ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑用户' : '新增用户')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<UserType | null>(null)
const resetPasswordVisible = ref(false)

// 用户表单
const formRef = ref<FormInstance>()
const formData = reactive<UserCreateParams & { id?: number }>({
  username: '',
  real_name: '',
  email: '',
  phone: '',
  role: 'employee',
  department: '',
  position: '',
  status: 1,
  password: ''
})

// 验证用户名
const validateUsername = (rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入用户名'))
  } else if (value.length < 3 || value.length > 20) {
    callback(new Error('用户名长度为3-20个字符'))
  } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    callback(new Error('用户名只能包含字母、数字和下划线'))
  } else {
    callback()
  }
}

// 验证密码
const validatePassword = (rule: any, value: string, callback: any) => {
  if (!formData.id && !value) {
    callback(new Error('请输入初始密码'))
  } else if (value && value.length < 6) {
    callback(new Error('密码长度不能少于6位'))
  } else {
    callback()
  }
}

// 用户表单校验
const formRules: FormRules = {
  username: [
    { required: true, validator: validateUsername, trigger: 'blur' }
  ],
  real_name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ],
  password: [
    { validator: validatePassword, trigger: 'blur' }
  ]
}

// 重置密码表单
const resetFormRef = ref<FormInstance>()
const resetPasswordData = reactive({
  newPassword: '',
  confirmPassword: ''
})

// 验证确认密码
const validateConfirmPassword = (rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== resetPasswordData.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

// 重置密码表单校验
const resetPasswordRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// 工具函数
const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD')
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    // 转换筛选状态: 前端用 0/1，API 用 'active'/'inactive'
    const statusParam = filterForm.status === 1 ? 'active' : filterForm.status === 0 ? 'inactive' : undefined
    const res = await userApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filterForm.search || undefined,
      role: filterForm.role || undefined,
      status: statusParam,
      department: filterForm.department || undefined
    })
    
    // 标准化 status: API 返回 'active'/'inactive' 字符串，转换为 1/0 数字
    tableData.value = (res.list || []).map(user => ({
      ...user,
      status: user.status === 'active' ? 1 : user.status === 'inactive' ? 0 : user.status
    }))
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
    const res = await userApi.getStats()
    stats.total = res.total || 0
    stats.active = res.active || 0
    stats.inactive = res.inactive || 0
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

// 加载部门和角色
const loadDepartments = async () => {
  try {
    const res = await userApi.getDepartments()
    departments.value = res || []
  } catch (e) {
    console.error('加载部门失败', e)
    // 使用默认部门
    departments.value = [
      { id: '1', name: '财务部' },
      { id: '2', name: '行政部' },
      { id: '3', name: '销售部' },
      { id: '4', name: '技术部' }
    ]
  }
}

const loadRoles = async () => {
  try {
    const res = await userApi.getRoles()
    roles.value = res || []
  } catch (e) {
    console.error('加载角色失败', e)
    // 使用默认角色
    roles.value = [
      { id: 'boss', name: 'boss', label: '老板', permissions: ['*'] },
      { id: 'accountant', name: 'accountant', label: '会计', permissions: ['finance', 'report'] },
      { id: 'employee', name: 'employee', label: '员工', permissions: ['view'] }
    ]
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

// 新增用户
const handleAdd = () => {
  resetFormData()
  dialogVisible.value = true
}

// 编辑用户
const handleEdit = (row: UserType) => {
  resetFormData()
  // 转换 status: 字符串 -> 数字
  const statusNum = row.status === 'active' ? 1 : row.status === 'inactive' ? 0 : 1
  Object.assign(formData, {
    id: row.id,
    username: row.username,
    real_name: row.real_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    department: row.department,
    position: row.position,
    status: statusNum
  })
  dialogVisible.value = true
}

// 提交用户表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    // 转换 status: 数字 -> 字符串
    const statusStr = formData.status === 1 ? 'active' : formData.status === 0 ? 'inactive' : formData.status
    
    if (formData.id) {
      await userApi.update(formData.id, {
        real_name: formData.real_name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        department: formData.department,
        position: formData.position,
        status: statusStr
      })
      ElMessage.success('更新成功')
    } else {
      await userApi.create({
        username: formData.username,
        real_name: formData.real_name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        department: formData.department,
        position: formData.position,
        status: statusStr,
        password: formData.password
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

// 状态变更
const handleStatusChange = async (row: UserType) => {
  try {
    const statusStr = row.status === 1 ? 'active' : 'inactive'
    await userApi.update(row.id, { status: statusStr })
    ElMessage.success(row.status === 1 ? '已启用' : '已禁用')
    loadStats()
  } catch (e) {
    console.error('状态更新失败', e)
    ElMessage.error('操作失败')
    // 恢复原状态
    row.status = row.status === 1 ? 0 : 1
  }
}

// 重置密码
const handleResetPassword = (row: UserType) => {
  currentUser.value = row
  resetPasswordData.newPassword = ''
  resetPasswordData.confirmPassword = ''
  resetPasswordVisible.value = true
}

const handleConfirmResetPassword = async () => {
  if (!resetFormRef.value || !currentUser.value) return
  
  try {
    await resetFormRef.value.validate()
  } catch {
    return
  }
  
  resetting.value = true
  try {
    await userApi.resetPassword(currentUser.value.id, {
      newPassword: resetPasswordData.newPassword
    })
    ElMessage.success('密码重置成功')
    resetPasswordVisible.value = false
  } catch (e) {
    console.error('密码重置失败', e)
    ElMessage.error('操作失败')
  } finally {
    resetting.value = false
  }
}

const resetPasswordForm = () => {
  resetPasswordData.newPassword = ''
  resetPasswordData.confirmPassword = ''
  resetFormRef.value?.clearValidate()
}

// 删除用户
const handleDelete = (row: UserType) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await userApi.delete(deleteTarget.value.id)
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

// 重置表单
const resetFormData = () => {
  formData.id = undefined
  formData.username = ''
  formData.real_name = ''
  formData.email = ''
  formData.phone = ''
  formData.role = 'employee'
  formData.department = ''
  formData.position = ''
  formData.status = 1
  formData.password = ''
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
  loadDepartments()
  loadRoles()
})
</script>

<style lang="scss" scoped>
.users-page {
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
    
    &.inactive {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }
      
      .stat-value {
        color: #ef4444;
      }
    }
    
    &.roles {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }
      
      .stat-value {
        color: #f59e0b;
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
      
      .user-info {
        display: flex;
        align-items: center;
        gap: 10px;
        
        .avatar-default {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          font-size: 14px;
        }
        
        .username {
          font-weight: 500;
        }
      }
      
      .phone-link {
        a {
          color: #3b82f6;
          text-decoration: none;
          
          &:hover {
            text-decoration: underline;
          }
        }
      }
      
      .email-link {
        color: #3b82f6;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
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