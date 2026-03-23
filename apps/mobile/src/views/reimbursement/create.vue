<template>
  <div class="reimburse-create">
    <van-nav-bar title="提交报销" left-arrow @click-left="$router.back()" />
    
    <van-form @submit="onSubmit">
      <van-cell-group inset title="报销信息">
        <van-field
          v-model="form.type"
          is-link
          readonly
          label="报销类型"
          placeholder="请选择"
          @click="showTypePicker = true"
          required
        />
        <van-field
          v-model="form.amount"
          type="number"
          label="报销金额"
          placeholder="请输入金额"
          required
        >
          <template #button>
            <span>元</span>
          </template>
        </van-field>
        <van-field
          v-model="form.date"
          is-link
          readonly
          label="发生日期"
          placeholder="请选择日期"
          @click="showDatePicker = true"
          required
        />
        <van-field
          v-model="form.description"
          rows="2"
          autosize
          label="报销说明"
          type="textarea"
          placeholder="请输入报销说明"
        />
      </van-cell-group>
      
      <van-cell-group inset title="附件上传">
        <div class="upload-section">
          <van-uploader
            v-model="fileList"
            multiple
            :max-count="5"
            accept="image/*"
          />
          <div class="upload-tip">最多上传5张图片</div>
        </div>
      </van-cell-group>
      
      <div class="submit-area">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          提交报销
        </van-button>
      </div>
    </van-form>
    
    <!-- 类型选择 -->
    <van-popup v-model:show="showTypePicker" position="bottom" round>
      <van-picker
        :columns="typeOptions"
        @confirm="onTypeConfirm"
        @cancel="showTypePicker = false"
      />
    </van-popup>
    
    <!-- 日期选择 -->
    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showToast } from 'vant'
import { reimbursementApi } from '@/api'

const router = useRouter()

const form = ref({
  type: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: ''
})

const fileList = ref<any[]>([])
const loading = ref(false)
const showTypePicker = ref(false)
const showDatePicker = ref(false)

const typeOptions = [
  '差旅费',
  '交通费',
  '餐饮费',
  '办公用品',
  '招待费',
  '通讯费',
  '其他'
]

const onTypeConfirm = ({ selectedOptions }: any) => {
  form.value.type = selectedOptions[0]?.text || selectedOptions[0]
  showTypePicker.value = false
}

const onDateConfirm = ({ selectedValues }: any) => {
  form.value.date = selectedValues.join('-')
  showDatePicker.value = false
}

const onSubmit = async () => {
  if (!form.value.type) {
    showToast('请选择报销类型')
    return
  }
  if (!form.value.amount || parseFloat(form.value.amount) <= 0) {
    showToast('请输入有效金额')
    return
  }
  
  loading.value = true
  
  try {
    await reimbursementApi.create({
      type: form.value.type,
      amount: parseFloat(form.value.amount),
      expense_date: form.value.date,
      description: form.value.description,
      attachments: fileList.value.map(f => f.content || f.url)
    })
    
    showSuccessToast('提交成功')
    router.back()
  } catch (e: any) {
    showToast(e.message || '提交失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reimburse-create {
  min-height: 100vh;
  background: #f5f6fa;
}

.upload-section {
  padding: 12px 16px;
}

.upload-tip {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.submit-area {
  padding: 24px 16px;
}
</style>