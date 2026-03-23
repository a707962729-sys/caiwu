<template>
  <div class="products-page">
    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="搜索">
          <el-input 
            v-model="filterForm.search" 
            placeholder="编码/名称/条码" 
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
        <el-form-item label="分类">
          <el-select v-model="filterForm.category" placeholder="全部分类" clearable style="width: 140px" @change="handleFilter">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增商品</el-button>
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
      >
        <el-table-column prop="code" label="编码" width="120">
          <template #default="{ row }">
            <span class="code-text">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="160">
          <template #default="{ row }">
            <div class="product-name">
              <span class="name">{{ row.name }}</span>
              <el-tag v-if="row.status === 0" type="danger" size="small" class="status-tag">禁用</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.category || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="规格" width="120">
          <template #default="{ row }">
            {{ row.specification || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80" align="center">
          <template #default="{ row }">
            {{ row.unit || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="cost_price" label="成本价" width="100" align="right">
          <template #default="{ row }">
            <span class="price cost">{{ formatPrice(row.cost_price) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="selling_price" label="售价" width="100" align="right">
          <template #default="{ row }">
            <span class="price selling">{{ formatPrice(row.selling_price) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="100" align="center">
          <template #default="{ row }">
            <span :class="['stock', { warning: isLowStock(row) }]">
              {{ row.stock ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
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

    <!-- 新增/编辑商品弹窗 -->
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
            <el-form-item label="商品编码" prop="code">
              <el-input v-model="formData.code" placeholder="请输入商品编码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入商品名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品分类" prop="category">
              <el-select v-model="formData.category" placeholder="选择分类" style="width: 100%">
                <el-option
                  v-for="cat in categories"
                  :key="cat.id"
                  :label="cat.name"
                  :value="cat.name"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位" prop="unit">
              <el-select v-model="formData.unit" placeholder="选择单位" allow-create filterable style="width: 100%">
                <el-option label="件" value="件" />
                <el-option label="个" value="个" />
                <el-option label="套" value="套" />
                <el-option label="箱" value="箱" />
                <el-option label="包" value="包" />
                <el-option label="kg" value="kg" />
                <el-option label="斤" value="斤" />
                <el-option label="米" value="米" />
                <el-option label="张" value="张" />
                <el-option label="本" value="本" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="规格型号">
              <el-input v-model="formData.specification" placeholder="规格型号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="条形码">
              <el-input v-model="formData.barcode" placeholder="条形码" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="成本价" prop="cost_price">
              <el-input-number 
                v-model="formData.cost_price" 
                :precision="2" 
                :min="0" 
                :step="1"
                placeholder="成本价"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="售价" prop="selling_price">
              <el-input-number 
                v-model="formData.selling_price" 
                :precision="2" 
                :min="0" 
                :step="1"
                placeholder="售价"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="库存">
              <el-input-number 
                v-model="formData.stock" 
                :precision="0" 
                :min="0" 
                :step="1"
                placeholder="库存"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="库存下限">
              <el-input-number 
                v-model="formData.min_stock" 
                :precision="0" 
                :min="0"
                placeholder="下限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="库存上限">
              <el-input-number 
                v-model="formData.max_stock" 
                :precision="0" 
                :min="0"
                placeholder="上限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="商品状态">
          <el-radio-group v-model="formData.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="商品备注说明（选填）"
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
      <p>确定要删除商品「{{ deleteTarget?.name }}」吗？</p>
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
import { Plus, Download, Search } from '@element-plus/icons-vue'
import {
  productApi,
  categoryApi,
  type Product,
  type ProductCreateParams,
  type ProductListParams
} from '@/api/product'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)

// 数据
const tableData = ref<Product[]>([])
const categories = ref<Array<{ id: number; name: string; code?: string }>>([])

// 筛选表单
const filterForm = reactive({
  search: '',
  category: '',
  status: undefined as number | undefined
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑商品' : '新增商品')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Product | null>(null)

// 商品表单
const formRef = ref<FormInstance>()
const formData = reactive<ProductCreateParams & { id?: number; status?: number }>({
  code: '',
  name: '',
  category: '',
  specification: '',
  unit: '件',
  cost_price: 0,
  selling_price: 0,
  stock: 0,
  min_stock: undefined,
  max_stock: undefined,
  barcode: '',
  description: '',
  status: 1
})

// 表单校验
const formRules: FormRules = {
  code: [
    { required: true, message: '请输入商品编码', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择商品分类', trigger: 'change' }
  ],
  unit: [
    { required: true, message: '请选择单位', trigger: 'change' }
  ],
  cost_price: [
    { required: true, message: '请输入成本价', trigger: 'blur' }
  ],
  selling_price: [
    { required: true, message: '请输入售价', trigger: 'blur' }
  ]
}

// 工具函数
const formatPrice = (price: number) => {
  if (price === undefined || price === null) return '¥0.00'
  return '¥' + price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const isLowStock = (row: Product) => {
  if (row.min_stock && row.stock < row.min_stock) return true
  return false
}

// 加载分类
const loadCategories = async () => {
  try {
    const res = await categoryApi.getList()
    categories.value = res || []
  } catch (e) {
    console.error('加载分类失败', e)
  }
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params: ProductListParams = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    if (filterForm.search) params.search = filterForm.search
    if (filterForm.category) params.category = filterForm.category
    if (filterForm.status !== undefined) params.status = filterForm.status
    
    const res = await productApi.getList(params)
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

// 新增商品
const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

// 编辑商品
const handleEdit = (row: Product) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    specification: row.specification || '',
    unit: row.unit,
    cost_price: row.cost_price,
    selling_price: row.selling_price,
    stock: row.stock,
    min_stock: row.min_stock,
    max_stock: row.max_stock,
    barcode: row.barcode || '',
    description: row.description || '',
    status: row.status
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
    const data: ProductCreateParams = {
      code: formData.code,
      name: formData.name,
      category: formData.category,
      specification: formData.specification || undefined,
      unit: formData.unit,
      cost_price: formData.cost_price,
      selling_price: formData.selling_price,
      stock: formData.stock,
      min_stock: formData.min_stock || undefined,
      max_stock: formData.max_stock || undefined,
      barcode: formData.barcode || undefined,
      description: formData.description || undefined
    }
    
    if (formData.id) {
      await productApi.update(formData.id, data)
      ElMessage.success('更新成功')
    } else {
      await productApi.create(data)
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

// 删除商品
const handleDelete = (row: Product) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await productApi.delete(deleteTarget.value.id)
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
    const params: ProductListParams = {}
    if (filterForm.search) params.search = filterForm.search
    if (filterForm.category) params.category = filterForm.category
    if (filterForm.status !== undefined) params.status = filterForm.status
    
    const blob = await productApi.export(params)
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `商品列表_${dayjs().format('YYYY-MM-DD')}.xlsx`
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
  formData.code = ''
  formData.name = ''
  formData.category = ''
  formData.specification = ''
  formData.unit = '件'
  formData.cost_price = 0
  formData.selling_price = 0
  formData.stock = 0
  formData.min_stock = undefined
  formData.max_stock = undefined
  formData.barcode = ''
  formData.description = ''
  formData.status = 1
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadCategories()
  loadData()
})
</script>

<style lang="scss" scoped>
.products-page {
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
      
      .code-text {
        font-family: 'SF Mono', 'Monaco', monospace;
        color: #606266;
      }
      
      .product-name {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .name {
          font-weight: 500;
        }
        
        .status-tag {
          font-size: 10px;
        }
      }
      
      .price {
        font-weight: 500;
        
        &.cost {
          color: #909399;
        }
        
        &.selling {
          color: #333;
        }
      }
      
      .stock {
        font-weight: 500;
        
        &.warning {
          color: #ef4444;
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
}
</style>