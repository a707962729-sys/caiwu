<template>
  <div class="reimbursements-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">报销总数</div>
              <div class="stat-value">{{ stats.total }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card pending">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">待审批</div>
              <div class="stat-value">{{ getStatusCount('pending') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card approved">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已批准</div>
              <div class="stat-value">{{ getStatusCount('approved') }}</div>
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
              <div class="stat-label">报销总额</div>
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
            placeholder="报销单号/标题/申请人"
            clearable
            style="width: 220px"
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
            <el-option label="待审批" value="pending" />
            <el-option label="已批准" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已支付" value="paid" />
            <el-option label="已撤销" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filterForm.reimbursement_type" placeholder="全部类型" clearable style="width: 130px" @change="handleFilter">
            <el-option label="业务招待" value="business" />
            <el-option label="差旅报销" value="travel" />
            <el-option label="通讯报销" value="communication" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请日期">
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
          <el-button type="primary" :icon="Plus" @click="handleAdd">新建报销</el-button>
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
        <el-table-column prop="reimbursement_no" label="报销单号" width="160">
          <template #default="{ row }">
            <span class="reimbursement-no">{{ row.reimbursement_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="报销标题" min-width="180">
          <template #default="{ row }">
            <span class="reimbursement-title">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reimbursement_type" label="类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.reimbursement_type)" size="small">
              {{ getTypeLabel(row.reimbursement_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="applicant_name" label="申请人" width="100">
          <template #default="{ row }">
            <span>{{ row.applicant_name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="130" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.amount, row.currency) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="application_date" label="申请日期" width="110">
          <template #default="{ row }">
            {{ row.application_date ? formatDate(row.application_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="expense_date" label="费用日期" width="110">
          <template #default="{ row }">
            {{ row.expense_date ? formatDate(row.expense_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="approver_name" label="审批人" width="100">
          <template #default="{ row }">
            {{ row.approver_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="reject_reason" label="拒绝原因" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.status === 'rejected'" class="reject-reason">{{ row.reject_reason || '-' }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="110">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="handleView(row)">详情</el-button>
            <el-button v-if="row.status === 'draft'" link type="primary" @click.stop="handleEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'draft'" link type="success" @click.stop="handleSubmit(row)">提交</el-button>
            <el-button v-if="row.status === 'pending'" link type="warning" @click.stop="handleApprove(row)">审批</el-button>
            <el-button v-if="row.status === 'approved'" link type="primary" @click.stop="handlePay(row)">支付</el-button>
            <el-button v-if="['draft', 'rejected'].includes(row.status)" link type="danger" @click.stop="handleDelete(row)">删除</el-button>
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

    <!-- 新建/编辑报销单弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="720px"
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
            <el-form-item label="报销标题" prop="title">
              <el-input v-model="formData.title" placeholder="请输入报销标题" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="报销类型" prop="reimbursement_type">
              <el-select v-model="formData.reimbursement_type" placeholder="选择类型" style="width: 100%">
                <el-option label="业务招待" value="business" />
                <el-option label="差旅报销" value="travel" />
                <el-option label="通讯报销" value="communication" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="申请日期" prop="application_date">
              <el-date-picker
                v-model="formData.application_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="费用日期" prop="expense_date">
              <el-date-picker
                v-model="formData.expense_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="报销金额" prop="amount">
              <el-input-number
                v-model="formData.amount"
                :precision="2"
                :min="0"
                :step="100"
                placeholder="请输入金额"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="币种">
              <el-select v-model="formData.currency" placeholder="选择币种" style="width: 100%">
                <el-option label="人民币" value="CNY" />
                <el-option label="美元" value="USD" />
                <el-option label="欧元" value="EUR" />
                <el-option label="港币" value="HKD" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注说明">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="2"
            placeholder="请输入备注说明"
          />
        </el-form-item>

        <!-- 报销明细 -->
        <el-divider content-position="left">报销明细</el-divider>
        <div class="items-section">
          <div v-for="(item, index) in formData.items" :key="index" class="item-row">
            <el-row :gutter="12">
              <el-col :span="6">
                <el-form-item label="费用日期" :prop="`items.${index}.item_date`" label-width="70px">
                  <el-date-picker
                    v-model="item.item_date"
                    type="date"
                    placeholder="日期"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                    size="small"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="5">
                <el-form-item label="类别" :prop="`items.${index}.category`" label-width="50px">
                  <el-select v-model="item.category" placeholder="类别" style="width: 100%" size="small">
                    <el-option label="交通" value="transport" />
                    <el-option label="住宿" value="accommodation" />
                    <el-option label="餐饮" value="meal" />
                    <el-option label="办公" value="office" />
                    <el-option label="通讯" value="communication" />
                    <el-option label="其他" value="other" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="说明" :prop="`items.${index}.description`" label-width="40px">
                  <el-input v-model="item.description" placeholder="费用说明" size="small" />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="金额" :prop="`items.${index}.amount`" label-width="40px">
                  <el-input-number
                    v-model="item.amount"
                    :precision="2"
                    :min="0"
                    size="small"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="3" style="padding-top: 4px;">
                <el-button link type="danger" size="small" @click="removeItem(index)">删除</el-button>
              </el-col>
            </el-row>
          </div>
          <el-button link type="primary" :icon="Plus" @click="addItem">添加明细</el-button>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitForm">
          {{ formData.id ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="报销单详情"
      width="680px"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="报销单号">{{ currentRow?.reimbursement_no }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(currentRow?.status || '')" size="small">
            {{ getStatusLabel(currentRow?.status || '') }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="报销标题">{{ currentRow?.title }}</el-descriptions-item>
        <el-descriptions-item label="类型">
          {{ getTypeLabel(currentRow?.reimbursement_type) }}
        </el-descriptions-item>
        <el-descriptions-item label="申请人">{{ currentRow?.applicant_name }}</el-descriptions-item>
        <el-descriptions-item label="金额">
          <span class="amount">{{ formatMoney(currentRow?.amount || 0, currentRow?.currency) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="申请日期">{{ currentRow?.application_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="费用日期">{{ currentRow?.expense_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审批人">{{ currentRow?.approver_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="支付人">{{ currentRow?.payer_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="拒绝原因" :span="2">{{ currentRow?.reject_reason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentRow?.notes || '-' }}</el-descriptions-item>
      </el-descriptions>

      <template v-if="detailData && detailData.items && detailData.items.length > 0">
        <el-divider content-position="left">报销明细</el-divider>
        <el-table :data="detailData.items" stripe size="small">
          <el-table-column prop="item_date" label="费用日期" width="110" />
          <el-table-column prop="category" label="类别" width="100">
            <template #default="{ row }">
              {{ getCategoryLabel(row.category) }}
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="150" />
          <el-table-column prop="amount" label="金额" width="120" align="right">
            <template #default="{ row }">
              {{ formatMoney(row.amount, row.currency) }}
            </template>
          </el-table-column>
          <el-table-column prop="invoice_no" label="发票号" width="130" />
        </el-table>
      </template>
    </el-dialog>

    <!-- 审批弹窗 -->
    <el-dialog
      v-model="approveDialogVisible"
      title="审批报销单"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form ref="approveFormRef" :model="approveForm" label-width="80px">
        <el-form-item label="报销单号">
          <span>{{ currentRow?.reimbursement_no }}</span>
        </el-form-item>
        <el-form-item label="报销金额">
          <span class="amount">{{ formatMoney(currentRow?.amount || 0, currentRow?.currency) }}</span>
        </el-form-item>
        <el-form-item label="审批操作" prop="action">
          <el-radio-group v-model="approveForm.action">
            <el-radio value="approve">批准</el-radio>
            <el-radio value="reject">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="approveForm.action === 'reject'" label="拒绝原因" prop="reject_reason">
          <el-input
            v-model="approveForm.reject_reason"
            type="textarea"
            :rows="3"
            placeholder="请输入拒绝原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button :loading="approving" type="primary" @click="confirmApprove">确认{{ approveForm.action === 'approve' ? '批准' : '拒绝' }}</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认弹窗 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除"
      width="400px"
    >
      <p>确定要删除报销单 <strong>{{ deleteTarget?.reimbursement_no }}</strong> 吗？此操作不可撤销。</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确认删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Document, Clock, CircleCheck, Money, Search, Plus, Download
} from '@element-plus/icons-vue'
import { reimbursementApi, type Reimbursement, type ReimbursementItem, type ReimbursementApproveParams } from '@/api/reimbursement'

// 状态统计
const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  paid: 0,
  rejected: 0,
  total_amount: 0
})

const getStatusCount = (status: string) => {
  const countMap: Record<string, number> = {
    pending: stats.pending,
    approved: stats.approved,
    paid: stats.paid,
    rejected: stats.rejected
  }
  return countMap[status] || 0
}

// 筛选表单
const filterForm = reactive({
  search: '',
  status: '' as string,
  reimbursement_type: '',
  startDate: '',
  endDate: ''
})

const dateRange = ref<string[]>([])

const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleDateChange = (val: string[] | null) => {
  if (val) {
    filterForm.startDate = val[0]
    filterForm.endDate = val[1]
  } else {
    filterForm.startDate = ''
    filterForm.endDate = ''
  }
  handleFilter()
}

// 表格数据
const loading = ref(false)
const tableData = ref<Reimbursement[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 详情数据
const currentRow = ref<Reimbursement | null>(null)
const detailVisible = ref(false)
const detailData = ref<Reimbursement | null>(null)

const loadData = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filterForm.search || undefined,
      status: filterForm.status || undefined
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }

    const res = await reimbursementApi.getList(params)
    tableData.value = res.list || []
    pagination.total = res.total || 0
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    // 并行获取各状态统计
    const [draftRes, pendingRes, approvedRes, rejectedRes, paidRes] = await Promise.all([
      reimbursementApi.getList({ pageSize: 1, page: 1, status: 'draft' }),
      reimbursementApi.getList({ pageSize: 1, page: 1, status: 'pending' }),
      reimbursementApi.getList({ pageSize: 1, page: 1, status: 'approved' }),
      reimbursementApi.getList({ pageSize: 1, page: 1, status: 'rejected' }),
      reimbursementApi.getList({ pageSize: 1, page: 1, status: 'paid' })
    ])

    const draftCount = draftRes.total || 0
    const pendingCount = pendingRes.total || 0
    const approvedCount = approvedRes.total || 0
    const rejectedCount = rejectedRes.total || 0
    const paidCount = paidRes.total || 0

    stats.total = draftCount + pendingCount + approvedCount + rejectedCount + paidCount
    stats.pending = pendingCount
    stats.approved = approvedCount
    stats.paid = paidCount
    stats.rejected = rejectedCount

    // 计算总额（已批准+已支付）
    const [approvedAmountRes, paidAmountRes] = await Promise.all([
      reimbursementApi.getList({ pageSize: 1000, status: 'approved' }),
      reimbursementApi.getList({ pageSize: 1000, status: 'paid' })
    ])
    const allAmounts = [...(approvedAmountRes.list || []), ...(paidAmountRes.list || [])]
    stats.total_amount = allAmounts.reduce((sum, item) => sum + (item.amount || 0), 0)
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

// 新建/编辑弹窗
const dialogVisible = ref(false)
const dialogTitle = ref('新建报销单')
const submitting = ref(false)
const formRef = ref()
const formData = reactive<{
  id?: number
  title: string
  reimbursement_type?: string
  application_date?: string
  expense_date?: string
  amount: number
  currency: string
  notes: string
  items: ReimbursementItem[]
}>({
  title: '',
  reimbursement_type: 'business',
  application_date: '',
  expense_date: '',
  amount: 0,
  currency: 'CNY',
  notes: '',
  items: []
})

const formRules = {
  title: [{ required: true, message: '请输入报销标题', trigger: 'blur' }],
  amount: [{ required: true, message: '请输入报销金额', trigger: 'blur' }]
}

const resetForm = () => {
  formData.id = undefined
  formData.title = ''
  formData.reimbursement_type = 'business'
  formData.application_date = ''
  formData.expense_date = ''
  formData.amount = 0
  formData.currency = 'CNY'
  formData.notes = ''
  formData.items = []
  formRef.value?.clearValidate()
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新建报销单'
  dialogVisible.value = true
}

const handleEdit = async (row: Reimbursement) => {
  try {
    const res = await reimbursementApi.getDetail(row.id)
    const data = res as any
    formData.id = data.id
    formData.title = data.title
    formData.reimbursement_type = data.reimbursement_type
    formData.application_date = data.application_date || ''
    formData.expense_date = data.expense_date || ''
    formData.amount = data.amount
    formData.currency = data.currency || 'CNY'
    formData.notes = data.notes || ''
    formData.items = data.items || []
    dialogTitle.value = '编辑报销单'
    dialogVisible.value = true
  } catch (e) {
    ElMessage.error('加载详情失败')
  }
}

const handleView = async (row: Reimbursement) => {
  try {
    const res = await reimbursementApi.getDetail(row.id)
    currentRow.value = row
    detailData.value = res as any
    detailVisible.value = true
  } catch (e) {
    ElMessage.error('加载详情失败')
  }
}

const handleRowClick = (row: Reimbursement) => {
  // 可以在此扩展点击行打开详情
}

const handleSubmitForm = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const submitData: any = {
      title: formData.title,
      reimbursement_type: formData.reimbursement_type,
      amount: formData.amount,
      currency: formData.currency,
      application_date: formData.application_date || undefined,
      expense_date: formData.expense_date || undefined,
      notes: formData.notes,
      items: formData.items.filter(item => item.amount > 0)
    }

    if (formData.id) {
      await reimbursementApi.update(formData.id, submitData)
      ElMessage.success('保存成功')
    } else {
      await reimbursementApi.create(submitData)
      ElMessage.success('创建成功')
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

// 明细操作
const addItem = () => {
  formData.items.push({
    item_date: '',
    category: 'other',
    description: '',
    amount: 0,
    currency: formData.currency
  })
}

const removeItem = (index: number) => {
  formData.items.splice(index, 1)
}

// 提交审批
const handleSubmit = async (row: Reimbursement) => {
  try {
    await reimbursementApi.submit(row.id)
    ElMessage.success('提交成功，报销单已进入审批流程')
    loadData()
    loadStats()
  } catch (e) {
    ElMessage.error('提交失败')
  }
}

// 审批弹窗
const approveDialogVisible = ref(false)
const approving = ref(false)
const approveFormRef = ref()
const approveForm = reactive<ReimbursementApproveParams>({
  action: 'approve',
  reject_reason: ''
})

const handleApprove = (row: Reimbursement) => {
  currentRow.value = row
  approveForm.action = 'approve'
  approveForm.reject_reason = ''
  approveDialogVisible.value = true
}

const confirmApprove = async () => {
  if (approveForm.action === 'reject' && !approveForm.reject_reason) {
    ElMessage.warning('请填写拒绝原因')
    return
  }
  if (!currentRow.value) return

  approving.value = true
  try {
    await reimbursementApi.approve(currentRow.value.id, {
      action: approveForm.action,
      reject_reason: approveForm.action === 'reject' ? approveForm.reject_reason : undefined
    })
    ElMessage.success(approveForm.action === 'approve' ? '已批准' : '已拒绝')
    approveDialogVisible.value = false
    loadData()
    loadStats()
  } catch (e) {
    console.error('审批失败', e)
    ElMessage.error('操作失败')
  } finally {
    approving.value = false
  }
}

// 支付
const handlePay = async (row: Reimbursement) => {
  try {
    await reimbursementApi.pay(row.id)
    ElMessage.success('支付成功')
    loadData()
    loadStats()
  } catch (e) {
    ElMessage.error('支付失败')
  }
}

// 删除
const deleteDialogVisible = ref(false)
const deleting = ref(false)
const deleteTarget = ref<Reimbursement | null>(null)

const handleDelete = (row: Reimbursement) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return

  deleting.value = true
  try {
    await reimbursementApi.delete(deleteTarget.value.id)
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

// 分页
const handleSizeChange = () => {
  pagination.page = 1
  loadData()
}

const handlePageChange = () => {
  loadData()
}

// 辅助函数
const formatMoney = (amount: number, currency = 'CNY') => {
  const symbols: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€', HKD: 'HK$' }
  return `${symbols[currency] || '¥'}${Number(amount || 0).toFixed(2)}`
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return date.slice(0, 10)
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: '草稿',
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    paid: '已支付',
    cancelled: '已撤销'
  }
  return labels[status] || status
}

const getStatusTagType = (status: string): 'success' | 'primary' | 'warning' | 'info' | 'danger' => {
  const types: Record<string, 'success' | 'primary' | 'warning' | 'info' | 'danger'> = {
    draft: 'info',
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    paid: 'primary',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

const getTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    business: '业务招待',
    travel: '差旅报销',
    communication: '通讯报销',
    other: '其他'
  }
  return labels[type || ''] || '-'
}

const getTypeTagType = (type?: string): 'success' | 'primary' | 'warning' | 'info' | 'danger' => {
  const types: Record<string, 'success' | 'primary' | 'warning' | 'info' | 'danger'> = {
    business: 'warning',
    travel: 'primary',
    communication: 'success',
    other: 'info'
  }
  return types[type || ''] || 'info'
}

const getCategoryLabel = (category?: string) => {
  const labels: Record<string, string> = {
    transport: '交通',
    accommodation: '住宿',
    meal: '餐饮',
    office: '办公',
    communication: '通讯',
    other: '其他'
  }
  return labels[category || ''] || category || '-'
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.reimbursements-page {
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

    &.pending {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%);

      .stat-icon {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }

      .stat-value {
        color: #f59e0b;
      }
    }

    &.approved {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);

      .stat-icon {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }

      .stat-value {
        color: #07c160;
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
  }

  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 22px;
    flex-shrink: 0;
  }

  .stat-info {
    flex: 1;
  }

  .stat-label {
    font-size: 13px;
    color: #666;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #333;
  }

  .filter-card {
    margin-bottom: 16px;
    border-radius: 12px;
  }

  .table-card {
    border-radius: 12px;
  }

  .reimbursement-no {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 13px;
    color: #3b82f6;
  }

  .reimbursement-title {
    font-weight: 500;
    color: #333;
  }

  .reject-reason {
    color: #f56c6c;
  }

  .amount {
    font-weight: 600;
    color: #333;
    font-family: 'PingFang SC', 'Microsoft YaHei', monospace;
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .items-section {
    background: #fafafa;
    border-radius: 8px;
    padding: 12px;
  }

  .item-row {
    margin-bottom: 8px;
  }

  .party-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .party-name {
    font-weight: 500;
  }

  .party-tag {
    width: fit-content;
  }

  .overdue {
    color: #f56c6c;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
