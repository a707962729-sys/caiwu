<template>
  <div class="partners-page">
    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 140px" @change="handleFilter">
            <el-option label="客户" value="customer" />
            <el-option label="供应商" value="supplier" />
            <el-option label="客户&供应商" value="both" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="正常" value="active" />
            <el-option label="停用" value="inactive" />
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
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增往来单位</el-button>
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
        <el-table-column prop="name" label="名称" min-width="180">
          <template #default="{ row }">
            <span class="partner-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small" effect="plain">
              {{ getTypeLabel(row.type) }}
            </el-tag>
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
        <el-table-column prop="balance" label="余额" width="140" align="right">
          <template #default="{ row }">
            <span :class="['balance', { positive: row.balance > 0, negative: row.balance < 0 }]">
              {{ formatMoney(row.balance) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '正常' : '停用' }}
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
        <el-form-item label="名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入往来单位名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="供应商" value="supplier" />
            <el-option label="客户&供应商" value="both" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="formData.contact_person" placeholder="请输入联系人姓名" maxlength="50" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入联系电话" maxlength="20" />
        </el-form-item>
        <el-form-item label="期初余额" prop="balance">
          <el-input-number 
            v-model="formData.balance" 
            :precision="2" 
            :step="100"
            :min="-9999999.99"
            :max="9999999.99"
            style="width: 100%"
            placeholder="正数表示应收，负数表示应付"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio label="active">正常</el-radio>
            <el-radio label="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
            maxlength="200"
            show-word-limit
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
      <p>确定要删除该往来单位吗？</p>
      <p class="delete-info">
        <strong>{{ deleteTarget?.name }}</strong>
        <el-tag size="small" effect="plain">{{ deleteTarget ? getTypeLabel(deleteTarget.type) : '' }}</el-tag>
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
import { 
  partnerApi, 
  type Partner, 
  type PartnerCreateParams, 
  type PartnerType,
  type PartnerStatus,
  getPartnerTypeLabel as getTypeLabel
} from '@/api/partner'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Partner[]>([])

// 筛选表单
const filterForm = reactive({
  type: '' as PartnerType | '',
  status: '' as PartnerStatus | '',
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
const dialogTitle = computed(() => formData.id ? '编辑往来单位' : '新增往来单位')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Partner | null>(null)

// 表单
const formRef = ref<FormInstance>()
const formData = reactive<PartnerCreateParams & { id?: number }>({
  name: '',
  type: 'customer',
  contact_person: '',
  phone: '',
  balance: 0,
  status: 'active',
  remark: ''
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
    { required: true, message: '请输入往来单位名称', trigger: 'blur' },
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
  remark: [
    { max: 200, message: '长度不能超过 200 个字符', trigger: 'blur' }
  ]
}

// 工具函数
const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD')
}

const formatMoney = (n: number) => {
  if (!n && n !== 0) return '¥0.00'
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const copyPhone = (phone: string) => {
  navigator.clipboard.writeText(phone).then(() => {
    ElMessage.success('电话已复制')
  }).catch(() => {
    ElMessage.warning('复制失败')
  })
}

const getTypeTagType = (type: PartnerType): 'success' | 'primary' | 'warning' => {
  const map: Record<PartnerType, 'success' | 'primary' | 'warning'> = {
    customer: 'success',
    supplier: 'warning',
    both: 'primary'
  }
  return map[type]
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await partnerApi.getList({
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
const handleEdit = (row: Partner) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    type: row.type,
    contact_person: row.contact_person,
    phone: row.phone,
    balance: row.balance,
    status: row.status,
    remark: row.remark
  })
  dialogVisible.value = true
}

// 切换状态
const handleToggleStatus = async (row: Partner) => {
  const newStatus = row.status === 'active' ? 'inactive' : 'active'
  const actionText = newStatus === 'active' ? '启用' : '停用'
  
  try {
    await partnerApi.update(row.id, { status: newStatus })
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
      await partnerApi.update(formData.id, {
        name: formData.name,
        type: formData.type,
        contact_person: formData.contact_person,
        phone: formData.phone,
        balance: formData.balance,
        status: formData.status,
        remark: formData.remark
      })
      ElMessage.success('更新成功')
    } else {
      await partnerApi.create({
        name: formData.name,
        type: formData.type,
        contact_person: formData.contact_person,
        phone: formData.phone,
        balance: formData.balance,
        status: formData.status,
        remark: formData.remark
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
const handleDelete = (row: Partner) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await partnerApi.delete(deleteTarget.value.id)
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
  formData.type = 'customer'
  formData.contact_person = ''
  formData.phone = ''
  formData.balance = 0
  formData.status = 'active'
  formData.remark = ''
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.partners-page {
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
      
      .partner-name {
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
      
      .balance {
        font-weight: 600;
        
        &.positive {
          color: #67c23a;
        }
        
        &.negative {
          color: #f56c6c;
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