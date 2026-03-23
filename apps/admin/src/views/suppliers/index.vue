<template>
  <div class="suppliers-page">
    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 140px" @change="handleFilter">
            <el-option label="原材料供应商" value="原材料供应商" />
            <el-option label="设备供应商" value="设备供应商" />
            <el-option label="服务供应商" value="服务供应商" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="合作中" value="active" />
            <el-option label="已停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input 
            v-model="filterForm.search" 
            placeholder="名称/联系人/电话" 
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
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增供应商</el-button>
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
        <el-table-column prop="name" label="供应商名称" min-width="180">
          <template #default="{ row }">
            <span class="supplier-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact_person" label="联系人" width="120">
          <template #default="{ row }">
            {{ row.contact_person || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" width="140">
          <template #default="{ row }">
            <span v-if="row.phone" class="phone-link" @click="copyPhone(row.phone)">
              {{ row.phone }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="200">
          <template #default="{ row }">
            <span class="address-text">{{ row.address || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '合作中' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="120">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button 
              link 
              :type="row.status === 'active' ? 'warning' : 'success'" 
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 'active' ? '停用' : '启用' }}
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
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入供应商名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="原材料供应商" value="原材料供应商" />
            <el-option label="设备供应商" value="设备供应商" />
            <el-option label="服务供应商" value="服务供应商" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="formData.contact_person" placeholder="请输入联系人姓名" maxlength="50" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入联系电话" maxlength="20" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input
            v-model="formData.address"
            type="textarea"
            :rows="2"
            placeholder="请输入详细地址"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio label="active">合作中</el-radio>
            <el-radio label="inactive">已停用</el-radio>
          </el-radio-group>
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
      <p>确定要删除该供应商吗？</p>
      <p class="delete-info">
        <strong>{{ deleteTarget?.name }}</strong>
        <el-tag size="small" effect="plain">{{ deleteTarget?.type }}</el-tag>
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
import { Plus, Search } from '@element-plus/icons-vue'
import { supplierApi, type Supplier, type SupplierCreateParams } from '@/api/supplier'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Supplier[]>([])

// 筛选表单
const filterForm = reactive({
  type: '',
  status: '' as '' | 'active' | 'inactive',
  search: ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑供应商' : '新增供应商')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Supplier | null>(null)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<SupplierCreateParams & { id?: number; status: 'active' | 'inactive' }>({
  name: '',
  type: '',
  contact_person: '',
  phone: '',
  address: '',
  status: 'active'
})

// 电话号码校验
const validatePhone = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback()
    return
  }
  const phoneRegex = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/
  if (!phoneRegex.test(value)) {
    callback(new Error('请输入正确的电话号码'))
  } else {
    callback()
  }
}

// 表单校验规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入供应商名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择类型', trigger: 'change' }
  ],
  contact_person: [
    { max: 50, message: '长度不能超过 50 个字符', trigger: 'blur' }
  ],
  phone: [
    { validator: validatePhone, trigger: 'blur' }
  ],
  address: [
    { max: 200, message: '长度不能超过 200 个字符', trigger: 'blur' }
  ]
}

// 工具函数
const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD')
}

const copyPhone = (phone: string) => {
  navigator.clipboard.writeText(phone).then(() => {
    ElMessage.success('电话已复制')
  }).catch(() => {
    ElMessage.warning('复制失败')
  })
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await supplierApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      type: filterForm.type || undefined,
      status: filterForm.status || undefined,
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
const handleEdit = (row: Supplier) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    type: row.type,
    contact_person: row.contact_person,
    phone: row.phone,
    address: row.address,
    status: row.status
  })
  dialogVisible.value = true
}

// 切换状态
const handleToggleStatus = async (row: Supplier) => {
  const newStatus = row.status === 'active' ? 'inactive' : 'active'
  const actionText = newStatus === 'active' ? '启用' : '停用'
  
  try {
    await supplierApi.update(row.id, { status: newStatus })
    ElMessage.success(`${actionText}成功`)
    loadData()
  } catch (e) {
    console.error('状态更新失败', e)
    ElMessage.error(`${actionText}失败`)
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
      await supplierApi.update(formData.id, {
        name: formData.name,
        type: formData.type,
        contact_person: formData.contact_person,
        phone: formData.phone,
        address: formData.address,
        status: formData.status
      })
      ElMessage.success('更新成功')
    } else {
      await supplierApi.create({
        name: formData.name,
        type: formData.type,
        contact_person: formData.contact_person,
        phone: formData.phone,
        address: formData.address,
        status: formData.status
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
const handleDelete = (row: Supplier) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await supplierApi.delete(deleteTarget.value.id)
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

// 重置表单
const resetForm = () => {
  formData.id = undefined
  formData.name = ''
  formData.type = ''
  formData.contact_person = ''
  formData.phone = ''
  formData.address = ''
  formData.status = 'active'
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.suppliers-page {
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
      
      .phone-link {
        color: #409eff;
        cursor: pointer;
        
        &:hover {
          text-decoration: underline;
        }
      }
      
      .address-text {
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
    
    strong {
      font-size: 16px;
    }
  }
}
</style>