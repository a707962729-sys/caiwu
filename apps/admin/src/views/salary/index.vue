<template>
  <div class="salary-page">
    <!-- 操作区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="月份">
          <el-date-picker v-model="filterForm.month" type="month" placeholder="选择月份" value-format="YYYY-MM" style="width: 140px" @change="handleFilter" />
        </el-form-item>
        <el-form-item label="员工">
          <el-select v-model="filterForm.employee_id" placeholder="全部员工" clearable filterable style="width: 160px" @change="handleFilter">
            <el-option v-for="emp in employeeOptions" :key="emp.id" :label="emp.name" :value="emp.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="待计算" value="pending" />
            <el-option label="已计算" value="calculated" />
            <el-option label="已发放" value="paid" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleFilter">搜索</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="success" :icon="MagicStick" @click="handleAutoGenerate">批量生成工资</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon total"><el-icon><Money /></el-icon></div>
            <div class="stat-info">
              <div class="stat-label">本月工资总额</div>
              <div class="stat-value">¥{{ formatNumber(stats.totalSalary) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon calc"><el-icon><Finished /></el-icon></div>
            <div class="stat-info">
              <div class="stat-label">已计算</div>
              <div class="stat-value">{{ stats.calculated }} 人</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon paid"><el-icon><CircleCheck /></el-icon></div>
            <div class="stat-info">
              <div class="stat-label">已发放</div>
              <div class="stat-value">{{ stats.paid }} 人</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon pending"><el-icon><Clock /></el-icon></div>
            <div class="stat-info">
              <div class="stat-label">待计算</div>
              <div class="stat-value">{{ stats.pending }} 人</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="employee_name" label="员工姓名" width="120" />
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="position" label="职位" width="120" />
        <el-table-column prop="month" label="月份" width="100" />
        <el-table-column prop="base_salary" label="基本工资" width="110" align="right">
          <template #default="{ row }">¥{{ formatNumber(row.base_salary) }}</template>
        </el-table-column>
        <el-table-column prop="overtime_pay" label="加班费" width="100" align="right">
          <template #default="{ row }">¥{{ formatNumber(row.overtime_pay) }}</template>
        </el-table-column>
        <el-table-column prop="bonus" label="奖金" width="100" align="right">
          <template #default="{ row }">¥{{ formatNumber(row.bonus) }}</template>
        </el-table-column>
        <el-table-column prop="deduction" label="扣款" width="90" align="right">
          <template #default="{ row }">¥{{ formatNumber(row.deduction) }}</template>
        </el-table-column>
        <el-table-column prop="net_salary" label="实发工资" width="120" align="right">
          <template #default="{ row }"><b style="color:#07c160">¥{{ formatNumber(row.net_salary) }}</b></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getTagType(row.status)">{{ getLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handlePreview(row)">预览</el-button>
            <el-button v-if="row.status === 'calculated'" link type="success" @click="handleMarkPaid(row)">发放</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 批量生成弹窗 -->
    <el-dialog v-model="autoGenerateVisible" title="批量生成工资" width="480px">
      <el-form :model="autoGenerateForm" label-width="100px">
        <el-form-item label="生成月份" required>
          <el-date-picker v-model="autoGenerateForm.month" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width: 100%" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="autoGenerateForm.department" placeholder="全部部门（不选则生成全部）" clearable style="width: 100%">
            <el-option v-for="dept in departments" :key="dept" :label="dept" :value="dept" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="generate-tip">将根据考勤数据自动计算并生成所选月份员工工资</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="autoGenerateVisible = false">取消</el-button>
        <el-button type="success" :loading="generating" @click="confirmAutoGenerate">确认生成</el-button>
      </template>
    </el-dialog>

    <!-- 工资预览弹窗 -->
    <el-dialog v-model="previewVisible" title="工资预览" width="520px">
      <el-descriptions :column="1" border v-if="previewData">
        <el-descriptions-item label="员工">{{ previewData.employee_name }}</el-descriptions-item>
        <el-descriptions-item label="月份">{{ previewData.month }}</el-descriptions-item>
        <el-descriptions-item label="基本工资">¥{{ formatNumber(previewData.base_salary) }}</el-descriptions-item>
        <el-descriptions-item label="加班费">¥{{ formatNumber(previewData.overtime_pay) }}</el-descriptions-item>
        <el-descriptions-item label="迟到扣款">-¥{{ formatNumber(previewData.late_deduction) }}</el-descriptions-item>
        <el-descriptions-item label="旷工扣款">-¥{{ formatNumber(previewData.absent_deduction) }}</el-descriptions-item>
        <el-descriptions-item label="奖金">¥{{ formatNumber(previewData.bonus) }}</el-descriptions-item>
        <el-descriptions-item label="社保扣款">-¥{{ formatNumber(previewData.social_security) }}</el-descriptions-item>
        <el-descriptions-item label="公积金扣款">-¥{{ formatNumber(previewData.housing_fund) }}</el-descriptions-item>
        <el-descriptions-item label="个人所得税">-¥{{ formatNumber(previewData.personal_income_tax) }}</el-descriptions-item>
        <el-descriptions-item label="实发工资"><b style="color:#07c160;font-size:18px">¥{{ formatNumber(previewData.net_salary) }}</b></el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, MagicStick, Money, Finished, CircleCheck, Clock } from '@element-plus/icons-vue'
import { salaryApi, type SalaryRecord, type SalaryPreview } from '@/api/salary'
import { employeeApi } from '@/api/employee'
import dayjs from 'dayjs'

const loading = ref(false)
const generating = ref(false)
const tableData = ref<SalaryRecord[]>([])
const employeeOptions = ref<Array<{ id: number; name: string }>>([])
const departments = ['财务部', '行政部', '销售部', '技术部', '人事部', '运营部']
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const filterForm = reactive({
  month: dayjs().format('YYYY-MM'),
  employee_id: undefined as number | undefined,
  status: '' as string | ''
})

const stats = reactive({ totalSalary: 0, calculated: 0, paid: 0, pending: 0 })

const autoGenerateVisible = ref(false)
const autoGenerateForm = reactive({ month: dayjs().format('YYYY-MM'), department: '' as string | undefined })
const previewVisible = ref(false)
const previewData = ref<SalaryPreview | null>(null)

const formatNumber = (num: number) => num?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'

const getTagType = (status: string) => ({ pending: 'info', calculated: 'success', paid: 'primary', cancelled: 'danger' }[status] || '')
const getLabel = (status: string) => ({ pending: '待计算', calculated: '已计算', paid: '已发放', cancelled: '已取消' }[status] || status)

const loadEmployees = async () => {
  try {
    const res = await employeeApi.getList({ page: 1, pageSize: 100, status: 1 })
    employeeOptions.value = (res.list || []).map((e: any) => ({ id: e.id, name: e.name }))
  } catch (e) { console.error(e) }
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await salaryApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      month: filterForm.month || undefined,
      employee_id: filterForm.employee_id,
      status: filterForm.status || undefined
    })
    tableData.value = res.list || []
    pagination.total = res.total || 0
    stats.totalSalary = (res.list || []).reduce((sum: number, r: SalaryRecord) => sum + (r.net_salary || 0), 0)
    stats.calculated = (res.list || []).filter((r: SalaryRecord) => r.status === 'calculated').length
    stats.paid = (res.list || []).filter((r: SalaryRecord) => r.status === 'paid').length
    stats.pending = (res.list || []).filter((r: SalaryRecord) => r.status === 'pending').length
  } catch (e) { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

const handleFilter = () => { pagination.page = 1; loadData() }
const handleSizeChange = (size: number) => { pagination.pageSize = size; pagination.page = 1; loadData() }
const handlePageChange = (page: number) => { pagination.page = page; loadData() }

const handleAutoGenerate = () => { autoGenerateForm.month = dayjs().format('YYYY-MM'); autoGenerateVisible.value = true }

const confirmAutoGenerate = async () => {
  if (!autoGenerateForm.month) { ElMessage.warning('请选择月份'); return }
  generating.value = true
  try {
    const res = await salaryApi.autoGenerate({ month: autoGenerateForm.month, department: autoGenerateForm.department })
    ElMessage.success(`生成完成：成功 ${res.success} 人，失败 ${res.failed} 人`)
    autoGenerateVisible.value = false
    loadData()
  } catch (e) { ElMessage.error('生成失败') }
  finally { generating.value = false }
}

const handlePreview = async (row: SalaryRecord) => {
  try {
    previewData.value = await salaryApi.calculatePreview(row.employee_id, row.month)
    previewVisible.value = true
  } catch (e) { ElMessage.error('加载失败') }
}

const handleMarkPaid = async (row: SalaryRecord) => {
  try {
    await salaryApi.markPaid(row.id)
    ElMessage.success('已标记为已发放')
    loadData()
  } catch (e) { ElMessage.error('操作失败') }
}

onMounted(() => { loadEmployees(); loadData() })
</script>

<style lang="scss" scoped>
.salary-page {
  .filter-card { margin-bottom: 20px; border-radius: 12px; :deep(.el-card__body) { padding: 16px 20px; } }
  .stats-row { margin-bottom: 20px; }
  .stat-card { border-radius: 12px; border: none; .stat-content { display: flex; align-items: center; gap: 16px; } .stat-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; &.total { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); } &.calc { background: linear-gradient(135deg, #07c160 0%, #06ad56 100%); } &.paid { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); } &.pending { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); } } .stat-info { .stat-label { font-size: 13px; color: #909399; } .stat-value { font-size: 22px; font-weight: 600; margin-top: 4px; } } }
  .table-card { border-radius: 12px; :deep(.el-card__body) { padding: 0; } :deep(.el-table) { th.el-table__cell { background: #fafafa; } } }
  .pagination-container { padding: 20px; display: flex; justify-content: flex-end; border-top: 1px solid #ebeef5; }
  .generate-tip { font-size: 13px; color: #909399; line-height: 1.5; }
}
</style>
