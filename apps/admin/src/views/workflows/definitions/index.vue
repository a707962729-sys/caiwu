<template>
  <div class="workflow-definitions-page">
    <!-- 筛选和操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="搜索">
          <el-input 
            v-model="filterForm.search" 
            placeholder="流程名称" 
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
        <el-form-item label="流程类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 140px" @change="handleFilter">
            <el-option
              v-for="opt in workflowTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option
              v-for="opt in workflowStatusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增流程</el-button>
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
        <el-table-column prop="name" label="流程名称" min-width="180">
          <template #default="{ row }">
            <div class="workflow-name">
              <span class="name">{{ row.name }}</span>
              <el-tag v-if="row.status === 'inactive'" type="info" size="small" class="status-tag">停用</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="流程类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getWorkflowTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="active"
              inactive-value="inactive"
              :loading="statusLoading[row.id]"
              @change="(val: string | number | boolean) => handleStatusChange(row, val as WorkflowStatus)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="nodes" label="节点数" width="80" align="center">
          <template #default="{ row }">
            <span class="node-count">{{ row.nodes?.length || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200">
          <template #default="{ row }">
            <span class="description">{{ row.description || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" align="center">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="handleConfig(row)">配置</el-button>
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
        label-width="90px"
        style="padding-right: 20px"
      >
        <el-form-item label="流程名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入流程名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="流程类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择流程类型" style="width: 100%">
            <el-option
              v-for="opt in workflowTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="流程描述（选填）"
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

    <!-- 节点配置弹窗 -->
    <el-dialog
      v-model="configDialogVisible"
      title="流程节点配置"
      width="900px"
      :close-on-click-modal="false"
      @close="resetConfigForm"
    >
      <div class="config-container">
        <!-- 节点列表 -->
        <div class="nodes-panel">
          <div class="panel-header">
            <span class="title">流程节点</span>
            <el-button type="primary" size="small" :icon="Plus" @click="handleAddNode">添加节点</el-button>
          </div>
          <div class="nodes-list">
            <div
              v-for="(node, index) in configNodes"
              :key="node.id"
              :class="['node-item', { active: selectedNodeId === node.id }]"
              @click="selectNode(node.id)"
            >
              <div class="node-info">
                <span class="node-order">{{ index + 1 }}</span>
                <span class="node-name">{{ node.name }}</span>
                <el-tag :type="getNodeTypeTagType(node.type)" size="small">{{ getNodeTypeName(node.type) }}</el-tag>
              </div>
              <div class="node-actions">
                <el-button 
                  v-if="index > 0" 
                  link 
                  size="small" 
                  :icon="Top"
                  @click.stop="moveNodeUp(index)"
                />
                <el-button 
                  v-if="index < configNodes.length - 1" 
                  link 
                  size="small" 
                  :icon="Bottom"
                  @click.stop="moveNodeDown(index)"
                />
                <el-button 
                  v-if="node.type !== 'start' && node.type !== 'end'" 
                  link 
                  type="danger" 
                  size="small" 
                  :icon="Delete"
                  @click.stop="removeNode(index)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 节点配置 -->
        <div class="config-panel">
          <div class="panel-header">
            <span class="title">节点配置</span>
          </div>
          <div v-if="selectedNode" class="config-form">
            <el-form label-width="90px">
              <el-form-item label="节点名称">
                <el-input v-model="selectedNode.name" placeholder="请输入节点名称" />
              </el-form-item>
              <el-form-item label="节点类型">
                <el-tag :type="getNodeTypeTagType(selectedNode.type)">{{ getNodeTypeName(selectedNode.type) }}</el-tag>
              </el-form-item>

              <!-- 审批节点配置 -->
              <template v-if="selectedNode.type === 'approval'">
                <el-form-item label="审批人类型">
                  <el-select v-model="selectedNode.approverType" placeholder="请选择" style="width: 100%">
                    <el-option
                      v-for="opt in approverTypeOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="selectedNode.approverType === 'user'" label="指定用户">
                  <el-select
                    v-model="selectedNode.approverIds"
                    multiple
                    placeholder="请选择用户"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="user in mockUsers"
                      :key="user.id"
                      :label="user.name"
                      :value="user.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="selectedNode.approverType === 'role'" label="指定角色">
                  <el-select
                    v-model="selectedNode.approverRoleIds"
                    multiple
                    placeholder="请选择角色"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="role in mockRoles"
                      :key="role.id"
                      :label="role.name"
                      :value="role.id"
                    />
                  </el-select>
                </el-form-item>
              </template>

              <!-- 条件节点配置 -->
              <template v-if="selectedNode.type === 'condition'">
                <el-form-item label="条件规则">
                  <div class="conditions-list">
                    <div v-for="(cond, idx) in selectedNode.conditions" :key="idx" class="condition-item">
                      <el-select v-model="cond.field" placeholder="字段" style="width: 120px">
                        <el-option label="金额" value="amount" />
                        <el-option label="天数" value="days" />
                        <el-option label="部门" value="department" />
                      </el-select>
                      <el-select v-model="cond.operator" placeholder="操作" style="width: 100px">
                        <el-option
                          v-for="opt in conditionOperatorOptions"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                      <el-input v-model="cond.value" placeholder="值" style="width: 120px" />
                      <el-button type="danger" size="small" :icon="Delete" circle @click="removeCondition(idx)" />
                    </div>
                    <el-button type="primary" size="small" plain @click="addCondition">添加条件</el-button>
                  </div>
                </el-form-item>
              </template>
            </el-form>
          </div>
          <div v-else class="empty-config">
            <el-empty description="请选择节点进行配置" :image-size="80" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="configSubmitting" @click="handleConfigSubmit">保存配置</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除流程「{{ deleteTarget?.name }}」吗？删除后无法恢复。</p>
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
import { Plus, Search, Delete, Top, Bottom } from '@element-plus/icons-vue'
import {
  workflowDefinitionApi,
  workflowTypeOptions,
  workflowStatusOptions,
  approverTypeOptions,
  conditionOperatorOptions,
  getWorkflowTypeLabel,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowType,
  type WorkflowStatus,
  type WorkflowDefinitionCreateParams,
  type WorkflowDefinitionListParams
} from '@/api/workflow'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const configSubmitting = ref(false)
const statusLoading = ref<Record<number, boolean>>({})

// 数据
const tableData = ref<WorkflowDefinition[]>([])

// 筛选表单
const filterForm = reactive({
  search: '',
  type: undefined as WorkflowType | undefined,
  status: undefined as WorkflowStatus | undefined
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑流程' : '新增流程')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<WorkflowDefinition | null>(null)
const configDialogVisible = ref(false)

// 流程表单
const formRef = ref<FormInstance>()
const formData = reactive<WorkflowDefinitionCreateParams & { id?: number }>({
  name: '',
  type: 'leave',
  status: 'active',
  description: '',
  nodes: []
})

// 表单校验
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入流程名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择流程类型', trigger: 'change' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
}

// 节点配置
const configNodes = ref<WorkflowNode[]>([])
const selectedNodeId = ref<string>('')
const selectedNode = computed(() => {
  return configNodes.value.find(n => n.id === selectedNodeId.value)
})

// 模拟数据 - 实际应从用户/角色API获取
const mockUsers = ref([
  { id: 1, name: '张三' },
  { id: 2, name: '李四' },
  { id: 3, name: '王五' },
  { id: 4, name: '赵六' }
])

const mockRoles = ref([
  { id: 1, name: '财务经理' },
  { id: 2, name: '部门经理' },
  { id: 3, name: '总经理' },
  { id: 4, name: '人事经理' }
])

// 工具函数
const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const getTypeTagType = (type: WorkflowType): 'success' | 'warning' | 'danger' | 'info' | 'primary' | undefined => {
  const map: Record<WorkflowType, 'success' | 'warning' | 'danger' | 'info' | 'primary' | undefined> = {
    leave: undefined,
    expense: 'success',
    purchase: 'warning',
    payment: 'danger'
  }
  return map[type]
}

const getNodeTypeTagType = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | undefined => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | undefined> = {
    start: 'success',
    approval: 'primary',
    condition: 'warning',
    end: 'info'
  }
  return map[type]
}

const getNodeTypeName = (type: string) => {
  const map: Record<string, string> = {
    start: '开始',
    approval: '审批',
    condition: '条件',
    end: '结束'
  }
  return map[type] || type
}

const generateNodeId = () => {
  return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params: WorkflowDefinitionListParams = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    if (filterForm.search) params.search = filterForm.search
    if (filterForm.type) params.type = filterForm.type
    if (filterForm.status) params.status = filterForm.status
    
    const res = await workflowDefinitionApi.getList(params)
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

// 状态切换
const handleStatusChange = async (row: WorkflowDefinition, status: WorkflowStatus) => {
  statusLoading.value[row.id] = true
  try {
    await workflowDefinitionApi.toggleStatus(row.id)
    ElMessage.success(status === 'active' ? '已启用' : '已停用')
  } catch (e) {
    // 回滚状态
    row.status = status === 'active' ? 'inactive' : 'active'
    console.error('状态切换失败', e)
    ElMessage.error('操作失败')
  } finally {
    statusLoading.value[row.id] = false
  }
}

// 新增流程
const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

// 编辑流程
const handleEdit = (row: WorkflowDefinition) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    description: row.description || '',
    nodes: row.nodes || []
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
    const data: WorkflowDefinitionCreateParams = {
      name: formData.name,
      type: formData.type,
      status: formData.status,
      description: formData.description || undefined,
      nodes: formData.nodes.length > 0 ? formData.nodes : getDefaultNodes()
    }
    
    if (formData.id) {
      await workflowDefinitionApi.update(formData.id, data)
      ElMessage.success('更新成功')
    } else {
      await workflowDefinitionApi.create(data)
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

// 删除流程
const handleDelete = (row: WorkflowDefinition) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await workflowDefinitionApi.delete(deleteTarget.value.id)
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

// 获取默认节点
const getDefaultNodes = (): WorkflowNode[] => {
  return [
    { id: generateNodeId(), type: 'start', name: '开始', order: 1 },
    { id: generateNodeId(), type: 'approval', name: '审批人', order: 2, approverType: 'supervisor' },
    { id: generateNodeId(), type: 'end', name: '结束', order: 3 }
  ]
}

// 节点配置
const handleConfig = (row: WorkflowDefinition) => {
  configNodes.value = row.nodes?.length > 0 
    ? [...row.nodes] 
    : getDefaultNodes()
  selectedNodeId.value = configNodes.value[0]?.id || ''
  formData.id = row.id
  configDialogVisible.value = true
}

const selectNode = (nodeId: string) => {
  selectedNodeId.value = nodeId
}

const handleAddNode = () => {
  const newNode: WorkflowNode = {
    id: generateNodeId(),
    type: 'approval',
    name: '新审批节点',
    order: configNodes.value.length,
    approverType: 'supervisor'
  }
  
  // 在结束节点前插入
  const endIndex = configNodes.value.findIndex(n => n.type === 'end')
  if (endIndex > -1) {
    configNodes.value.splice(endIndex, 0, newNode)
  } else {
    configNodes.value.push(newNode)
  }
  
  selectedNodeId.value = newNode.id
  updateNodeOrders()
}

const moveNodeUp = (index: number) => {
  if (index <= 0) return
  const nodes = configNodes.value
  // 不能移动开始和结束节点
  if (nodes[index].type === 'start' || nodes[index - 1].type === 'start') return
  if (nodes[index].type === 'end' || nodes[index - 1].type === 'end') return
  
  const temp = nodes[index]
  nodes[index] = nodes[index - 1]
  nodes[index - 1] = temp
  updateNodeOrders()
}

const moveNodeDown = (index: number) => {
  const nodes = configNodes.value
  if (index >= nodes.length - 1) return
  // 不能移动开始和结束节点
  if (nodes[index].type === 'start' || nodes[index + 1].type === 'end') return
  if (nodes[index].type === 'end' || nodes[index + 1].type === 'end') return
  
  const temp = nodes[index]
  nodes[index] = nodes[index + 1]
  nodes[index + 1] = temp
  updateNodeOrders()
}

const removeNode = (index: number) => {
  const node = configNodes.value[index]
  if (node.type === 'start' || node.type === 'end') {
    ElMessage.warning('开始和结束节点不能删除')
    return
  }
  
  if (selectedNodeId.value === node.id) {
    selectedNodeId.value = configNodes.value[Math.max(0, index - 1)]?.id || ''
  }
  
  configNodes.value.splice(index, 1)
  updateNodeOrders()
}

const updateNodeOrders = () => {
  configNodes.value.forEach((node, index) => {
    node.order = index + 1
  })
}

const addCondition = () => {
  if (!selectedNode.value) return
  if (!selectedNode.value.conditions) {
    selectedNode.value.conditions = []
  }
  selectedNode.value.conditions.push({
    field: 'amount',
    operator: 'gt',
    value: ''
  })
}

const removeCondition = (index: number) => {
  if (!selectedNode.value?.conditions) return
  selectedNode.value.conditions.splice(index, 1)
}

const handleConfigSubmit = async () => {
  if (!formData.id) return
  
  configSubmitting.value = true
  try {
    await workflowDefinitionApi.update(formData.id, {
      nodes: configNodes.value
    })
    ElMessage.success('保存成功')
    configDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error('保存失败', e)
    ElMessage.error('保存失败')
  } finally {
    configSubmitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  formData.id = undefined
  formData.name = ''
  formData.type = 'leave'
  formData.status = 'active'
  formData.description = ''
  formData.nodes = []
  formRef.value?.clearValidate()
}

const resetConfigForm = () => {
  configNodes.value = []
  selectedNodeId.value = ''
  formData.id = undefined
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.workflow-definitions-page {
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
      
      .workflow-name {
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
      
      .node-count {
        font-weight: 500;
        color: #409eff;
      }
      
      .description {
        color: #909399;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  // 配置弹窗样式
  .config-container {
    display: flex;
    gap: 20px;
    height: 500px;
    
    .nodes-panel,
    .config-panel {
      flex: 1;
      border: 1px solid #e4e7ed;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .panel-header {
      padding: 12px 16px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .title {
        font-weight: 500;
        color: #303133;
      }
    }
    
    .nodes-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    
    .node-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 4px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: #f5f7fa;
      }
      
      &.active {
        background: #ecf5ff;
        border: 1px solid #409eff;
      }
      
      .node-info {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .node-order {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e4e7ed;
          border-radius: 50%;
          font-size: 12px;
          color: #606266;
        }
        
        .node-name {
          font-weight: 500;
        }
      }
      
      .node-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      &:hover .node-actions {
        opacity: 1;
      }
    }
    
    .config-form {
      padding: 16px;
      overflow-y: auto;
    }
    
    .empty-config {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .conditions-list {
      width: 100%;
      
      .condition-item {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        align-items: center;
      }
    }
  }
}
</style>