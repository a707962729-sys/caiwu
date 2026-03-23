<template>
  <div class="reimbursement-standards">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="filters">
        <el-select v-model="filters.category" placeholder="选择类别" clearable style="width: 150px" @change="loadStandards">
          <el-option label="住宿" value="accommodation" />
          <el-option label="餐饮" value="meal" />
          <el-option label="交通" value="transport" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-select v-model="filters.status" placeholder="选择状态" clearable style="width: 120px; margin-left: 12px" @change="loadStandards">
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="inactive" />
        </el-select>
        <el-input
          v-model="filters.search"
          placeholder="搜索标准名称"
          clearable
          style="width: 200px; margin-left: 12px"
          @keyup.enter="loadStandards"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增报销标准</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table v-loading="loading" :data="standards" stripe>
      <el-table-column prop="category_name" label="类别" width="100">
        <template #default="{ row }">
          <el-tag :type="getCategoryType(row.category)">
            {{ row.category_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="标准名称" min-width="180" />
      <el-table-column prop="daily_limit" label="每日限额" width="120" align="right">
        <template #default="{ row }">
          {{ row.daily_limit ? `¥${Number(row.daily_limit).toFixed(2)}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="monthly_limit" label="每月限额" width="120" align="right">
        <template #default="{ row }">
          {{ row.monthly_limit ? `¥${Number(row.monthly_limit).toFixed(2)}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="per_item_limit" label="单项限额" width="120" align="right">
        <template #default="{ row }">
          {{ row.per_item_limit ? `¥${Number(row.per_item_limit).toFixed(2)}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="说明" min-width="200">
        <template #default="{ row }">
          {{ row.description || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            active-value="active"
            inactive-value="inactive"
            @change="handleStatusChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadStandards"
        @current-change="loadStandards"
      />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="550px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="类别" prop="category">
          <el-select v-model="form.category" placeholder="请选择类别" style="width: 100%">
            <el-option label="住宿" value="accommodation" />
            <el-option label="餐饮" value="meal" />
            <el-option label="交通" value="transport" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="标准名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入标准名称" maxlength="100" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="每日限额">
              <el-input-number
                v-model="form.daily_limit"
                :precision="2"
                :min="0"
                placeholder="不限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每月限额">
              <el-input-number
                v-model="form.monthly_limit"
                :precision="2"
                :min="0"
                placeholder="不限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="单项限额">
          <el-input-number
            v-model="form.per_item_limit"
            :precision="2"
            :min="0"
            placeholder="不限"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="报销标准说明（选填）"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import request from '@/api/request'

// 类型定义
interface ReimbursementStandard {
  id: number
  company_id: number
  category: string
  category_name: string
  name: string
  daily_limit: number | null
  monthly_limit: number | null
  per_item_limit: number | null
  description: string | null
  status: string
  created_at: string
}

// 状态
const loading = ref(false)
const standards = ref<ReimbursementStandard[]>([])
const filters = reactive({
  category: '',
  status: '',
  search: ''
})
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => form.id ? '编辑报销标准' : '新增报销标准')
const saving = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  id: undefined as number | undefined,
  category: '',
  name: '',
  daily_limit: null as number | null,
  monthly_limit: null as number | null,
  per_item_limit: null as number | null,
  description: '',
  status: 'active'
})

const rules: FormRules = {
  category: [{ required: true, message: '请选择类别', trigger: 'change' }],
  name: [{ required: true, message: '请输入标准名称', trigger: 'blur' }]
}

// 加载数据
const loadStandards = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    if (filters.category) params.category = filters.category
    if (filters.status) params.status = filters.status
    if (filters.search) params.search = filters.search

    const data = await request.get('/reimbursement-standards', { params })
    standards.value = data.list || []
    pagination.total = data.total || 0
  } catch (e: any) {
    console.error('加载报销标准失败', e)
    ElMessage.error(e.response?.data?.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

// 类别颜色
const getCategoryType = (category: string): string => {
  const types: Record<string, string> = {
    accommodation: 'primary',
    meal: 'success',
    transport: 'warning',
    other: 'info'
  }
  return types[category] || 'info'
}

// 重置表单
const resetForm = () => {
  form.id = undefined
  form.category = ''
  form.name = ''
  form.daily_limit = null
  form.monthly_limit = null
  form.per_item_limit = null
  form.description = ''
  form.status = 'active'
  formRef.value?.clearValidate()
}

// 新增
const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: ReimbursementStandard) => {
  resetForm()
  form.id = row.id
  form.category = row.category
  form.name = row.name
  form.daily_limit = row.daily_limit
  form.monthly_limit = row.monthly_limit
  form.per_item_limit = row.per_item_limit
  form.description = row.description || ''
  form.status = row.status
  dialogVisible.value = true
}

// 保存
const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const data = {
      category: form.category,
      name: form.name,
      daily_limit: form.daily_limit,
      monthly_limit: form.monthly_limit,
      per_item_limit: form.per_item_limit,
      description: form.description || null,
      status: form.status
    }

    if (form.id) {
      await request.put(`/reimbursement-standards/${form.id}`, data)
      ElMessage.success('更新成功')
    } else {
      await request.post('/reimbursement-standards', data)
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
    loadStandards()
  } catch (e: any) {
    console.error('保存报销标准失败', e)
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 删除
const handleDelete = async (row: ReimbursementStandard) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除报销标准「${row.name}」吗？`,
      '删除确认',
      { type: 'warning' }
    )

    await request.delete(`/reimbursement-standards/${row.id}`)
    ElMessage.success('删除成功')
    loadStandards()
  } catch (e: any) {
    if (e !== 'cancel') {
      console.error('删除报销标准失败', e)
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }
}

// 状态切换
const handleStatusChange = async (row: ReimbursementStandard) => {
  try {
    await request.put(`/reimbursement-standards/${row.id}/status`, {
      status: row.status
    })
    ElMessage.success(row.status === 'active' ? '已启用' : '已禁用')
  } catch (e: any) {
    console.error('更新状态失败', e)
    ElMessage.error(e.response?.data?.message || '更新失败')
    // 恢复原状态
    row.status = row.status === 'active' ? 'inactive' : 'active'
  }
}

// 初始化
onMounted(() => {
  loadStandards()
})
</script>

<style scoped>
.reimbursement-standards {
  padding: 0;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filters {
  display: flex;
  align-items: center;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>