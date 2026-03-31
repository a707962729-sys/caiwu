<template>
  <div class="onboarding-page">
    <el-card shadow="never" class="upload-card">
      <template #header>
        <div class="card-header">
          <span>劳动合同上传</span>
        </div>
      </template>

      <div class="upload-area" v-if="!uploadResult">
        <el-upload
          ref="uploadRef"
          class="upload-demo"
          drag
          :action="uploadUrl"
          :headers="{ Authorization: 'Bearer ' + token }"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
          :before-upload="beforeUpload"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          :auto-upload="false"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">拖拽合同文件到此处，或 <em>点击上传</em></div>
          <template #tip>
            <div class="el-upload__tip">支持 PDF、图片、Word 文档，单个文件不超过 10MB</div>
          </template>
        </el-upload>

        <div class="upload-actions">
          <el-button type="primary" @click="handleUpload">上传并解析</el-button>
        </div>
      </div>

      <!-- 手动录入表单 -->
      <div class="manual-form" v-if="!uploadResult">
        <el-divider content-position="left">或手动录入员工信息</el-divider>
        <el-form ref="manualFormRef" :model="manualForm" :rules="manualRules" label-width="100px">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="姓名" prop="name">
                <el-input v-model="manualForm.name" placeholder="员工姓名" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="身份证号" prop="id_card">
                <el-input v-model="manualForm.id_card" placeholder="身份证号码" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="联系电话">
                <el-input v-model="manualForm.phone" placeholder="手机号码" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="部门">
                <el-select v-model="manualForm.department" placeholder="选择部门" style="width: 100%">
                  <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="职位">
                <el-input v-model="manualForm.position" placeholder="职位名称" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="月薪">
                <el-input-number v-model="manualForm.salary" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="合同类型">
                <el-select v-model="manualForm.contract_type" placeholder="合同类型" style="width: 100%">
                  <el-option label="正式" value="正式" />
                  <el-option label="临时" value="临时" />
                  <el-option label="实习" value="实习" />
                  <el-option label="外包" value="外包" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="入职日期">
                <el-date-picker v-model="manualForm.contract_start" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="handleManualSubmit">确认入职</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- 解析结果确认 -->
    <el-card v-if="uploadResult" shadow="never" class="confirm-card">
      <template #header>
        <div class="card-header">
          <span>自动识别结果</span>
          <el-button text type="primary" @click="resetUpload">重新上传</el-button>
        </div>
      </template>

      <div class="parse-result" v-if="uploadResult">
        <el-alert type="info" :closable="false" show-icon>
          <template #title>系统已自动识别合同中的员工信息，请核对并确认</template>
        </el-alert>

        <el-form ref="confirmFormRef" :model="confirmForm" :rules="confirmRules" label-width="100px" style="margin-top: 20px">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="姓名" prop="name">
                <el-input v-model="confirmForm.name" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="身份证号" prop="id_card">
                <el-input v-model="confirmForm.id_card" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="联系电话">
                <el-input v-model="confirmForm.phone" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="部门">
                <el-select v-model="confirmForm.department" placeholder="选择部门" style="width: 100%">
                  <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="职位">
                <el-input v-model="confirmForm.position" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="月薪">
                <el-input-number v-model="confirmForm.salary" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="合同类型">
                <el-select v-model="confirmForm.contract_type" style="width: 100%">
                  <el-option label="正式" value="正式" />
                  <el-option label="临时" value="临时" />
                  <el-option label="实习" value="实习" />
                  <el-option label="外包" value="外包" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="合同期限">
                <el-date-picker v-model="contractRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <div class="confirm-actions">
            <el-button @click="resetUpload">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="handleConfirm">确认入职</el-button>
          </div>
        </el-form>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSafeNavigate } from '@/composables/useNavigation'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { employeeApi, type OnboardParams } from '@/api/employee'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const { safeNavigate } = useSafeNavigate()
const uploadRef = ref()
const manualFormRef = ref()
const confirmFormRef = ref()
const submitting = ref(false)
const uploadResult = ref<any>(null)
const contractRange = ref<string[]>([])
const token = localStorage.getItem('token') || ''

const uploadUrl = '/api/employees/onboard/upload'
const departments = ['财务部', '行政部', '销售部', '技术部', '人事部', '运营部']

const manualForm = reactive({
  name: '',
  id_card: '',
  phone: '',
  department: '',
  position: '',
  salary: 0,
  contract_type: '',
  contract_start: ''
})

const confirmForm = reactive<any>({
  name: '',
  id_card: '',
  phone: '',
  department: '',
  position: '',
  salary: 0,
  contract_type: '正式'
})

const manualRules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  id_card: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: /^\d{17}[\dXx]$/, message: '身份证号格式不正确', trigger: 'blur' }
  ]
}

const confirmRules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  id_card: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: /^\d{17}[\dXx]$/, message: '身份证号格式不正确', trigger: 'blur' }
  ]
}

const beforeUpload = (file: any) => {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB')
    return false
  }
  return true
}

const handleUpload = () => {
  uploadRef.value?.submit()
}

const handleUploadSuccess = (res: any) => {
  uploadResult.value = res.data || res
  if (uploadResult.value) {
    Object.assign(confirmForm, uploadResult.value)
    ElMessage.success('合同解析成功，请核对信息')
  }
}

const handleUploadError = () => {
  ElMessage.error('上传失败，请重试')
}

const handleManualSubmit = async () => {
  if (!manualFormRef.value) return
  try { await manualFormRef.value.validate() } catch { return }
  submitting.value = true
  try {
    await employeeApi.onboard({
      name: manualForm.name,
      id_card: manualForm.id_card,
      phone: manualForm.phone,
      auto_fields: {
        department: manualForm.department,
        position: manualForm.position,
        salary: manualForm.salary,
        contract_type: manualForm.contract_type as any,
        contract_start: manualForm.contract_start
      }
    })
    ElMessage.success('员工入职成功')
    safeNavigate('/employees')
  } catch (e) { ElMessage.error('操作失败') }
  finally { submitting.value = false }
}

const handleConfirm = async () => {
  if (!confirmFormRef.value) return
  try { await confirmFormRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const data: OnboardParams = {
      name: confirmForm.name,
      id_card: confirmForm.id_card,
      phone: confirmForm.phone,
      contract_file: uploadResult.value?.contract_file || '',
      auto_fields: {
        department: confirmForm.department,
        position: confirmForm.position,
        salary: confirmForm.salary,
        contract_type: confirmForm.contract_type as any,
        contract_start: contractRange.value?.[0],
        contract_end: contractRange.value?.[1]
      }
    }
    await employeeApi.onboard(data)
    ElMessage.success('员工入职成功')
    safeNavigate('/employees')
  } catch (e) { ElMessage.error('操作失败') }
  finally { submitting.value = false }
}

const resetUpload = () => {
  uploadResult.value = null
  uploadRef.value?.clearFiles()
}
</script>

<style lang="scss" scoped>
.onboarding-page {
  max-width: 900px;
  .upload-card, .confirm-card { border-radius: 12px; :deep(.el-card__header) { font-weight: 600; .card-header { display: flex; justify-content: space-between; align-items: center; } } }
  .upload-card { margin-bottom: 20px; }
  .upload-area { text-align: center; }
  .upload-actions { margin-top: 20px; }
  .manual-form { :deep(.el-divider) { margin: 24px 0; } }
  .confirm-actions { margin-top: 24px; text-align: center; }
}
</style>
