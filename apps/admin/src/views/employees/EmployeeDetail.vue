<template>
  <div class="emp-detail-page">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="$router.back()">返回</el-button>
    </div>

    <el-row :gutter="20">
      <!-- 基本信息卡片 -->
      <el-col :span="16">
        <el-card shadow="never" class="info-card">
          <template #header>
            <div class="card-header">
              <span>员工信息</span>
              <el-button type="primary" :icon="Edit" link @click="handleEdit">编辑</el-button>
            </div>
          </template>
          <el-descriptions :column="2" border v-if="employee">
            <el-descriptions-item label="姓名">{{ employee.name }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">
              <a v-if="employee.phone" :href="`tel:${employee.phone}`" class="phone-link">{{ employee.phone }}</a>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="身份证号">{{ employee.id_card || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电子邮箱">{{ employee.email || '-' }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ employee.department || '-' }}</el-descriptions-item>
            <el-descriptions-item label="职位">{{ employee.position || '-' }}</el-descriptions-item>
            <el-descriptions-item label="角色">{{ getEmployeeRoleLabel(employee.role) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="employee.status === 'active' || employee.status === 1 ? 'success' : employee.status === 'probation' ? 'warning' : 'info'" size="small">
                {{ getEmployeeStatusLabel(employee.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="月薪">
              <span v-if="employee.salary">¥{{ formatNumber(employee.salary) }}</span>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="入职日期">{{ employee.hire_date || '-' }}</el-descriptions-item>
            <el-descriptions-item label="合同类型">{{ employee.contract_type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="合同到期">{{ employee.contract_end || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开户银行">{{ employee.bank_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="银行账号">{{ employee.bank_account || '-' }}</el-descriptions-item>
            <el-descriptions-item label="紧急联系人">{{ employee.emergency_contact || '-' }}</el-descriptions-item>
            <el-descriptions-item label="紧急联系电话">
              <a v-if="employee.emergency_phone" :href="`tel:${employee.emergency_phone}`" class="phone-link">{{ employee.emergency_phone }}</a>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 考勤记录 -->
        <el-card shadow="never" class="info-card" style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>考勤记录</span>
              <el-radio-group v-model="attendanceMonth" size="small" @change="loadAttendance">
                <el-radio-button v-for="m in availableMonths" :key="m" :value="m">{{ m }}</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <el-table :data="attendanceList" stripe v-loading="attendanceLoading">
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column prop="clock_in" label="上班打卡" width="120">
              <template #default="{ row }">{{ row.clock_in || '-' }}</template>
            </el-table-column>
            <el-table-column prop="clock_out" label="下班打卡" width="120">
              <template #default="{ row }">{{ row.clock_out || '-' }}</template>
            </el-table-column>
            <el-table-column prop="work_hours" label="工时" width="80" align="center">
              <template #default="{ row }">{{ row.work_hours ? row.work_hours + 'h' : '-' }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getAttendanceTagType(row.status)">{{ getAttendanceLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" />
          </el-table>
        </el-card>

        <!-- 工资记录 -->
        <el-card shadow="never" class="info-card" style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>工资记录</span>
              <el-button type="primary" size="small" @click="handlePreviewSalary">预览本月工资</el-button>
            </div>
          </template>
          <el-table :data="salaryList" stripe v-loading="salaryLoading">
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
            <el-table-column prop="net_salary" label="实发工资" width="110" align="right">
              <template #default="{ row }"><b style="color:#07c160">¥{{ formatNumber(row.net_salary) }}</b></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getSalaryTagType(row.status)">{{ getSalaryLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 侧边统计 -->
      <el-col :span="8">
        <el-card shadow="never" class="info-card">
          <template #header><span>本月考勤统计</span></template>
          <div class="stat-item"><span>正常出勤</span><b>{{ attendanceStat.normal_days }} 天</b></div>
          <div class="stat-item"><span>迟到</span><b class="warn">{{ attendanceStat.late_days }} 次</b></div>
          <div class="stat-item"><span>早退</span><b class="warn">{{ attendanceStat.early_days }} 次</b></div>
          <div class="stat-item"><span>旷工</span><b class="danger">{{ attendanceStat.absent_days }} 天</b></div>
          <div class="stat-item"><span>请假</span><b>{{ attendanceStat.leave_days }} 天</b></div>
          <div class="stat-item"><span>出勤率</span><b class="primary">{{ attendanceStat.attendance_rate }}%</b></div>
          <div class="stat-item"><span>总工时</span><b>{{ attendanceStat.total_work_hours }} h</b></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑员工" width="640px" :close-on-click-modal="false" @close="resetEditForm">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="90px" style="padding-right:20px">
        <el-row :gutter="20">
          <el-col :span="12"><el-form-item label="姓名" prop="name"><el-input v-model="editForm.name" placeholder="请输入姓名" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="联系电话" prop="phone"><el-input v-model="editForm.phone" placeholder="请输入联系电话" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12"><el-form-item label="部门"><el-select v-model="editForm.department" placeholder="选择部门" clearable style="width:100%"><el-option v-for="d in departments" :key="d" :label="d" :value="d" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="职位"><el-input v-model="editForm.position" placeholder="请输入职位" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12"><el-form-item label="月薪"><el-input-number id="salary" v-model="editForm.salary" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态"><el-select v-model="editForm.status" style="width:100%"><el-option label="在职" :value="1" /><el-option label="离职" :value="0" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12"><el-form-item label="合同起始"><el-date-picker v-model="editForm.contract_start" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="合同到期"><el-date-picker v-model="editForm.contract_end" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12"><el-form-item label="开户银行"><el-input v-model="editForm.bank_name" placeholder="银行名称" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="银行账号"><el-input v-model="editForm.bank_account" placeholder="银行卡号" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 工资预览弹窗 -->
    <el-dialog v-model="salaryPreviewVisible" title="工资预览" width="500px">
      <el-descriptions :column="1" border v-if="salaryPreview">
        <el-descriptions-item label="基本工资">¥{{ formatNumber(salaryPreview.base_salary) }}</el-descriptions-item>
        <el-descriptions-item label="加班费">¥{{ formatNumber(salaryPreview.overtime_pay) }}</el-descriptions-item>
        <el-descriptions-item label="迟到扣款">-¥{{ formatNumber(salaryPreview.late_deduction) }}</el-descriptions-item>
        <el-descriptions-item label="旷工扣款">-¥{{ formatNumber(salaryPreview.absent_deduction) }}</el-descriptions-item>
        <el-descriptions-item label="奖金">¥{{ formatNumber(salaryPreview.bonus) }}</el-descriptions-item>
        <el-descriptions-item label="社保">-¥{{ formatNumber(salaryPreview.social_security) }}</el-descriptions-item>
        <el-descriptions-item label="公积金">-¥{{ formatNumber(salaryPreview.housing_fund) }}</el-descriptions-item>
        <el-descriptions-item label="个人所得税">-¥{{ formatNumber(salaryPreview.personal_income_tax) }}</el-descriptions-item>
        <el-descriptions-item label="实发工资"><b style="color:#07c160;font-size:18px">¥{{ formatNumber(salaryPreview.net_salary) }}</b></el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="salaryPreviewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Edit } from '@element-plus/icons-vue'
import { employeeApi, getEmployeeRoleLabel, getEmployeeStatusLabel } from '@/api/employee'
import { attendanceApi, type AttendanceRecord, type AttendanceStat } from '@/api/attendance'
import { salaryApi, type SalaryRecord, type SalaryPreview } from '@/api/salary'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const employeeId = Number(route.params.id)

const departments = ['财务部', '行政部', '销售部', '技术部', '人事部', '运营部']

const employee = ref<any>(null)
const attendanceList = ref<AttendanceRecord[]>([])
const salaryList = ref<SalaryRecord[]>([])
const attendanceLoading = ref(false)
const salaryLoading = ref(false)
const submitting = ref(false)
const editDialogVisible = ref(false)
const salaryPreviewVisible = ref(false)
const salaryPreview = ref<SalaryPreview | null>(null)

const attendanceMonth = ref(dayjs().format('YYYY-MM'))
const availableMonths = Array.from({ length: 6 }, (_, i) => dayjs().subtract(i, 'month').format('YYYY-MM'))
const attendanceStat = reactive<AttendanceStat>({
  employee_id: employeeId, employee_name: '', department: '', month: '',
  normal_days: 0, late_days: 0, absent_days: 0, leave_days: 0, early_days: 0,
  total_work_hours: 0, attendance_rate: 0
})

const editFormRef = ref<FormInstance>()
const editForm = reactive<any>({})
const editRules: FormRules = { name: [{ required: true, message: '请输入姓名', trigger: 'blur' }] }

const formatNumber = (num: number) => num?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'

const getAttendanceTagType = (status: string) => ({ normal: 'success', late: 'warning', absent: 'danger', leave: 'info', early: 'warning' }[status] || '')
const getAttendanceLabel = (status: string) => ({ normal: '正常', late: '迟到', absent: '旷工', leave: '请假', early: '早退' }[status] || status)
const getSalaryTagType = (status: string) => ({ pending: 'info', calculated: 'success', paid: 'primary', cancelled: 'danger' }[status] || '')
const getSalaryLabel = (status: string) => ({ pending: '待计算', calculated: '已计算', paid: '已发放', cancelled: '已取消' }[status] || status)

const loadEmployee = async () => {
  try {
    employee.value = await employeeApi.getDetail(employeeId)
  } catch (e) {
    ElMessage.error('加载员工信息失败')
  }
}

const loadAttendance = async () => {
  attendanceLoading.value = true
  try {
    const [records, stats] = await Promise.all([
      attendanceApi.getEmployeeRecords(employeeId, attendanceMonth.value),
      attendanceApi.getStats({ month: attendanceMonth.value, employee_id: employeeId })
    ])
    attendanceList.value = records || []
    if (stats.length > 0) Object.assign(attendanceStat, stats[0])
  } catch (e) {
    console.error(e)
  } finally {
    attendanceLoading.value = false
  }
}

const loadSalary = async () => {
  salaryLoading.value = true
  try {
    const res = await salaryApi.getList({ employee_id: employeeId, pageSize: 12 })
    salaryList.value = res.list || []
  } catch (e) {
    console.error(e)
  } finally {
    salaryLoading.value = false
  }
}

const handleEdit = () => {
  Object.assign(editForm, { ...employee.value })
  editDialogVisible.value = true
}

const resetEditForm = () => {
  editFormRef.value?.clearValidate()
}

const handleSaveEdit = async () => {
  if (!editFormRef.value) return
  try { await editFormRef.value.validate() } catch { return }
  submitting.value = true
  try {
    await employeeApi.update(employeeId, editForm)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadEmployee()
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

const handlePreviewSalary = async () => {
  try {
    salaryPreview.value = await salaryApi.calculatePreview(employeeId, dayjs().format('YYYY-MM'))
    salaryPreviewVisible.value = true
  } catch (e) {
    ElMessage.error('加载失败')
  }
}

onMounted(() => {
  loadEmployee()
  // loadAttendance() // TODO: 修复考勤数据加载
  loadSalary()
})
</script>

<style lang="scss" scoped>
.emp-detail-page { .page-header { margin-bottom: 20px; } .info-card { border-radius: 12px; :deep(.el-card__header) { font-weight: 600; .card-header { display: flex; justify-content: space-between; align-items: center; } } } .phone-link { color: #3b82f6; text-decoration: none; &:hover { text-decoration: underline; } } .stat-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; &:last-child { border-bottom: none; } b { font-size: 15px; &.primary { color: #3b82f6; } &.warn { color: #f59e0b; } &.danger { color: #ef4444; } } } }
</style>
