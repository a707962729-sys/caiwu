<template>
  <div class="settings-page">
    <el-card shadow="never" class="settings-card">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <!-- 系统参数配置 -->
        <el-tab-pane label="系统参数" name="system">
          <div class="tab-content">
            <el-form
              v-loading="configLoading"
              :model="configForm"
              label-width="140px"
              class="config-form"
            >
              <el-divider content-position="left">基础设置</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="系统名称">
                    <el-input v-model="configForm.system_name" placeholder="请输入系统名称" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="系统Logo">
                    <el-input v-model="configForm.system_logo" placeholder="Logo URL" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">财务设置</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="默认货币">
                    <el-select v-model="configForm.currency" style="width: 100%">
                      <el-option label="人民币 (CNY)" value="CNY" />
                      <el-option label="美元 (USD)" value="USD" />
                      <el-option label="欧元 (EUR)" value="EUR" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="金额小数位">
                    <el-select v-model="configForm.decimal_places" style="width: 100%">
                      <el-option label="2位" :value="2" />
                      <el-option label="3位" :value="3" />
                      <el-option label="4位" :value="4" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="库存预警阈值">
                    <el-input-number v-model="configForm.stock_warning" :min="0" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="发票打印模板">
                    <el-select v-model="configForm.invoice_template" style="width: 100%">
                      <el-option label="标准模板" value="standard" />
                      <el-option label="简洁模板" value="simple" />
                      <el-option label="详细模板" value="detail" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">安全设置</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="会话超时(分钟)">
                    <el-input-number v-model="configForm.session_timeout" :min="5" :max="120" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="密码过期天数">
                    <el-input-number v-model="configForm.password_expire" :min="0" :max="365" style="width: 100%" />
                    <div class="form-tip">0表示永不过期</div>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item>
                <el-button type="primary" :loading="configSaving" @click="saveConfig">保存配置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 数据字典管理 -->
        <el-tab-pane label="数据字典" name="dict">
          <div class="tab-content">
            <div class="dict-toolbar">
              <el-select v-model="dictType" placeholder="选择字典类型" style="width: 200px" @change="loadDictList">
                <el-option label="商品分类" value="product_category" />
                <el-option label="客户类型" value="customer_type" />
                <el-option label="供应商类型" value="supplier_type" />
                <el-option label="支付方式" value="payment_method" />
                <el-option label="支出分类" value="expense_category" />
                <el-option label="收入分类" value="income_category" />
              </el-select>
              <el-button type="primary" :icon="Plus" @click="handleAddDict">新增字典项</el-button>
            </div>

            <el-table v-loading="dictLoading" :data="dictList" stripe>
              <el-table-column prop="code" label="编码" width="120" />
              <el-table-column prop="name" label="名称" min-width="150" />
              <el-table-column prop="value" label="值" width="120">
                <template #default="{ row }">
                  {{ row.value || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="sort" label="排序" width="80" align="center" />
              <el-table-column prop="status" label="状态" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
                    {{ row.status === 1 ? '启用' : '禁用' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="150">
                <template #default="{ row }">
                  {{ row.remark || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="handleEditDict(row)">编辑</el-button>
                  <el-button link type="danger" @click="handleDeleteDict(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- 公司信息设置 -->
        <el-tab-pane label="公司信息" name="company">
          <div class="tab-content">
            <el-form
              v-loading="companyLoading"
              :model="companyForm"
              :rules="companyRules"
              ref="companyFormRef"
              label-width="120px"
              class="company-form"
            >
              <el-divider content-position="left">基本信息</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="公司全称" prop="name">
                    <el-input v-model="companyForm.name" placeholder="请输入公司全称" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="公司简称">
                    <el-input v-model="companyForm.short_name" placeholder="请输入公司简称" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">税务信息</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="纳税人识别号">
                    <el-input v-model="companyForm.tax_number" placeholder="请输入纳税人识别号" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="发票抬头">
                    <el-input v-model="companyForm.invoice_header" placeholder="发票抬头（默认公司全称）" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">联系方式</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="公司地址">
                    <el-input v-model="companyForm.address" placeholder="请输入公司地址" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="联系电话">
                    <el-input v-model="companyForm.phone" placeholder="请输入联系电话" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="电子邮箱">
                    <el-input v-model="companyForm.email" placeholder="请输入电子邮箱" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">银行信息</el-divider>
              <el-row :gutter="24">
                <el-col :span="12">
                  <el-form-item label="开户银行">
                    <el-input v-model="companyForm.bank_name" placeholder="请输入开户银行" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="银行账号">
                    <el-input v-model="companyForm.bank_account" placeholder="请输入银行账号" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item label="备注">
                <el-input
                  v-model="companyForm.remark"
                  type="textarea"
                  :rows="3"
                  placeholder="备注信息（选填）"
                />
              </el-form-item>

              <el-form-item>
                <el-button type="primary" :loading="companySaving" @click="saveCompany">保存信息</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 分类管理 -->
        <el-tab-pane label="分类管理" name="category">
          <div class="tab-content">
            <div class="category-layout">
              <!-- 左侧分类类型列表 -->
              <div class="category-sidebar">
                <div class="sidebar-header">
                  <span>分类类型</span>
                  <el-button :icon="Plus" size="small" @click="handleAddCategoryType" />
                </div>
                <el-menu
                  :default-active="currentCategoryType"
                  @select="handleSelectCategoryType"
                >
                  <el-menu-item index="product_category">
                    <span>商品分类</span>
                    <el-badge :value="categoryCount.product_category" class="menu-badge" />
                  </el-menu-item>
                  <el-menu-item index="customer_type">
                    <span>客户类型</span>
                    <el-badge :value="categoryCount.customer_type" class="menu-badge" />
                  </el-menu-item>
                  <el-menu-item index="supplier_type">
                    <span>供应商类型</span>
                    <el-badge :value="categoryCount.supplier_type" class="menu-badge" />
                  </el-menu-item>
                  <el-menu-item index="expense_category">
                    <span>支出分类</span>
                    <el-badge :value="categoryCount.expense_category" class="menu-badge" />
                  </el-menu-item>
                  <el-menu-item index="income_category">
                    <span>收入分类</span>
                    <el-badge :value="categoryCount.income_category" class="menu-badge" />
                  </el-menu-item>
                </el-menu>
              </div>

              <!-- 右侧分类项管理 -->
              <div class="category-main">
                <div class="category-header">
                  <span class="title">{{ categoryTypeLabel }}</span>
                  <el-button type="primary" :icon="Plus" @click="handleAddCategory">新增分类</el-button>
                </div>

                <el-table
                  v-loading="categoryLoading"
                  :data="categoryList"
                  stripe
                  row-key="id"
                  default-expand-all
                >
                  <el-table-column prop="name" label="分类名称" min-width="200">
                    <template #default="{ row }">
                      <span class="category-name">{{ row.name }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="code" label="编码" width="120" />
                  <el-table-column prop="sort" label="排序" width="80" align="center" />
                  <el-table-column prop="status" label="状态" width="80" align="center">
                    <template #default="{ row }">
                      <el-switch
                        v-model="row.status"
                        :active-value="1"
                        :inactive-value="0"
                        @change="handleStatusChange(row)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="150" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="handleEditCategory(row)">编辑</el-button>
                      <el-button link type="primary" @click="handleAddSubCategory(row)">添加子项</el-button>
                      <el-button link type="danger" @click="handleDeleteCategory(row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 报销标准配置 -->
        <el-tab-pane label="报销标准" name="reimbursement">
          <ReimbursementStandards />
        </el-tab-pane>

        <!-- QQ 机器人配置 -->
        <el-tab-pane label="QQ机器人" name="qqbot">
          <div class="tab-content">
            <el-alert type="info" :closable="false" style="margin-bottom: 16px">
              请前往 <a href="https://q.qq.com" target="_blank">QQ开放平台</a> 创建机器人，获取 AppID 和 AppSecret 后填入下方配置。
            </el-alert>
            <el-form :model="qqbotForm" label-width="120px" style="max-width: 600px">
              <el-form-item label="AppID">
                <el-input v-model="qqbotForm.appId" placeholder="机器人 AppID，如 102000123" />
              </el-form-item>
              <el-form-item label="AppSecret">
                <el-input v-model="qqbotForm.appSecret" placeholder="机器人 AppSecret" show-password />
              </el-form-item>
              <el-form-item label="启用机器人">
                <el-switch v-model="qqbotForm.enabled" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="qqbotSaving" @click="saveQQBotConfig">保存配置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 字典编辑弹窗 -->
    <el-dialog
      v-model="dictDialogVisible"
      :title="dictDialogTitle"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="dictFormRef"
        :model="dictForm"
        :rules="dictRules"
        label-width="80px"
      >
        <el-form-item label="编码" prop="code">
          <el-input v-model="dictForm.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="dictForm.name" placeholder="请输入名称" />
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="dictForm.value" placeholder="可选，用于存储额外值" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="dictForm.sort" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="dictForm.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dictForm.remark" type="textarea" :rows="2" placeholder="备注（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictSaving" @click="saveDict">确定</el-button>
      </template>
    </el-dialog>

    <!-- 分类编辑弹窗 -->
    <el-dialog
      v-model="categoryDialogVisible"
      :title="categoryDialogTitle"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="categoryFormRef"
        :model="categoryForm"
        :rules="categoryRules"
        label-width="80px"
      >
        <el-form-item label="编码" prop="code">
          <el-input v-model="categoryForm.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="categoryForm.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sort" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="categoryForm.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="categoryForm.remark" type="textarea" :rows="2" placeholder="备注（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="categorySaving" @click="saveCategory">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { dictApi, companyApi, configApi, type DictItem, type DictType, type CompanyInfo, type SystemConfig } from '@/api/dict'
import ReimbursementStandards from './ReimbursementStandards.vue'

// Tab 状态
const activeTab = ref('system')

// ==================== 系统参数配置 ====================
const configLoading = ref(false)
const configSaving = ref(false)
const configForm = reactive({
  system_name: '',
  system_logo: '',
  currency: 'CNY',
  decimal_places: 2,
  stock_warning: 10,
  invoice_template: 'standard',
  session_timeout: 30,
  password_expire: 90
})

// QQ 机器人配置
const qqbotForm = reactive({
  appId: '',
  appSecret: '',
  enabled: false
})
const qqbotSaving = ref(false)

const loadQQBotConfig = async () => {
  try {
    const res = await request.get('/api/qq-bot/config')
    const d = res.data || {}
    qqbotForm.appId = d.appId || ''
    qqbotForm.appSecret = d.appSecret || ''
    qqbotForm.enabled = d.enabled === true
  } catch (e) {
    console.error('加载QQ机器人配置失败', e)
  }
}

const saveQQBotConfig = async () => {
  qqbotSaving.value = true
  try {
    await request.post('/api/qq-bot/config', {
      appId: qqbotForm.appId,
      appSecret: qqbotForm.appSecret,
      enabled: qqbotForm.enabled
    })
    ElMessage.success('QQ 机器人配置已保存')
  } catch (e) {
    console.error('保存QQ机器人配置失败', e)
    ElMessage.error('保存失败')
  } finally {
    qqbotSaving.value = false
  }
}

const loadConfig = async () => {
  configLoading.value = true
  try {
    const configs = await configApi.getList()
    configs.forEach(config => {
      if (config.key in configForm) {
        // 根据类型转换值
        if (config.type === 'number') {
          (configForm as any)[config.key] = Number(config.value)
        } else {
          (configForm as any)[config.key] = config.value
        }
      }
    })
  } catch (e) {
    console.error('加载配置失败', e)
  } finally {
    configLoading.value = false
  }
}

const saveConfig = async () => {
  configSaving.value = true
  try {
    const configs = Object.entries(configForm).map(([key, value]) => ({
      key,
      value: String(value)
    }))
    await configApi.batchUpdate(configs)
    ElMessage.success('保存成功')
  } catch (e) {
    console.error('保存配置失败', e)
    ElMessage.error('保存失败')
  } finally {
    configSaving.value = false
  }
}

// ==================== 数据字典管理 ====================
const dictType = ref<DictType>('product_category')
const dictLoading = ref(false)
const dictList = ref<DictItem[]>([])
const dictDialogVisible = ref(false)
const dictDialogTitle = computed(() => dictForm.id ? '编辑字典项' : '新增字典项')
const dictSaving = ref(false)
const dictFormRef = ref<FormInstance>()
const dictForm = reactive({
  id: undefined as number | undefined,
  type: 'product_category' as DictType,
  code: '',
  name: '',
  value: '',
  sort: 0,
  status: 1,
  remark: ''
})

const dictRules: FormRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
}

const loadDictList = async () => {
  if (!dictType.value) return
  dictLoading.value = true
  try {
    dictList.value = await dictApi.getList({ type: dictType.value })
  } catch (e) {
    console.error('加载字典失败', e)
  } finally {
    dictLoading.value = false
  }
}

const resetDictForm = () => {
  dictForm.id = undefined
  dictForm.type = dictType.value
  dictForm.code = ''
  dictForm.name = ''
  dictForm.value = ''
  dictForm.sort = 0
  dictForm.status = 1
  dictForm.remark = ''
  dictFormRef.value?.clearValidate()
}

const handleAddDict = () => {
  resetDictForm()
  dictDialogVisible.value = true
}

const handleEditDict = (row: DictItem) => {
  resetDictForm()
  Object.assign(dictForm, {
    id: row.id,
    type: row.type,
    code: row.code,
    name: row.name,
    value: row.value || '',
    sort: row.sort,
    status: row.status,
    remark: row.remark || ''
  })
  dictDialogVisible.value = true
}

const handleDeleteDict = async (row: DictItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除字典项「${row.name}」吗？`, '删除确认', {
      type: 'warning'
    })
    await dictApi.delete(row.id)
    ElMessage.success('删除成功')
    loadDictList()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
      ElMessage.error('删除失败')
    }
  }
}

const saveDict = async () => {
  if (!dictFormRef.value) return
  try {
    await dictFormRef.value.validate()
  } catch {
    return
  }

  dictSaving.value = true
  try {
    const data = {
      type: dictForm.type,
      code: dictForm.code,
      name: dictForm.name,
      value: dictForm.value || undefined,
      sort: dictForm.sort,
      status: dictForm.status,
      remark: dictForm.remark || undefined
    }

    if (dictForm.id) {
      await dictApi.update(dictForm.id, data)
      ElMessage.success('更新成功')
    } else {
      await dictApi.create(data)
      ElMessage.success('添加成功')
    }
    dictDialogVisible.value = false
    loadDictList()
  } catch (e) {
    console.error('保存失败', e)
    ElMessage.error('操作失败')
  } finally {
    dictSaving.value = false
  }
}

// ==================== 公司信息 ====================
const companyLoading = ref(false)
const companySaving = ref(false)
const companyFormRef = ref<FormInstance>()
const companyForm = reactive({
  name: '',
  short_name: '',
  tax_number: '',
  address: '',
  phone: '',
  email: '',
  bank_name: '',
  bank_account: '',
  invoice_header: '',
  remark: ''
})

const companyRules: FormRules = {
  name: [{ required: true, message: '请输入公司全称', trigger: 'blur' }]
}

const loadCompany = async () => {
  companyLoading.value = true
  try {
    const info = await companyApi.getInfo()
    Object.assign(companyForm, {
      name: info.name || '',
      short_name: info.short_name || '',
      tax_number: info.tax_number || '',
      address: info.address || '',
      phone: info.phone || '',
      email: info.email || '',
      bank_name: info.bank_name || '',
      bank_account: info.bank_account || '',
      invoice_header: info.invoice_header || '',
      remark: info.remark || ''
    })
  } catch (e) {
    console.error('加载公司信息失败', e)
  } finally {
    companyLoading.value = false
  }
}

const saveCompany = async () => {
  if (!companyFormRef.value) return
  try {
    await companyFormRef.value.validate()
  } catch {
    return
  }

  companySaving.value = true
  try {
    await companyApi.update({
      name: companyForm.name,
      short_name: companyForm.short_name || undefined,
      tax_number: companyForm.tax_number || undefined,
      address: companyForm.address || undefined,
      phone: companyForm.phone || undefined,
      email: companyForm.email || undefined,
      bank_name: companyForm.bank_name || undefined,
      bank_account: companyForm.bank_account || undefined,
      invoice_header: companyForm.invoice_header || undefined,
      remark: companyForm.remark || undefined
    })
    ElMessage.success('保存成功')
  } catch (e) {
    console.error('保存公司信息失败', e)
    ElMessage.error('保存失败')
  } finally {
    companySaving.value = false
  }
}

// ==================== 分类管理 ====================
const currentCategoryType = ref<DictType>('product_category')
const categoryLoading = ref(false)
const categoryList = ref<DictItem[]>([])
const categoryCount = reactive<Record<string, number>>({
  product_category: 0,
  customer_type: 0,
  supplier_type: 0,
  expense_category: 0,
  income_category: 0
})

const categoryTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    product_category: '商品分类',
    customer_type: '客户类型',
    supplier_type: '供应商类型',
    expense_category: '支出分类',
    income_category: '收入分类'
  }
  return labels[currentCategoryType.value] || '分类'
})

const categoryDialogVisible = ref(false)
const categoryDialogTitle = computed(() => categoryForm.id ? '编辑分类' : '新增分类')
const categorySaving = ref(false)
const categoryFormRef = ref<FormInstance>()
const categoryForm = reactive({
  id: undefined as number | undefined,
  type: 'product_category' as DictType,
  code: '',
  name: '',
  sort: 0,
  status: 1,
  parent_id: undefined as number | undefined,
  remark: ''
})

const categoryRules: FormRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
}

const loadAllCategoryCounts = async () => {
  const types: DictType[] = ['product_category', 'customer_type', 'supplier_type', 'expense_category', 'income_category']
  for (const type of types) {
    try {
      const list = await dictApi.getList({ type })
      categoryCount[type] = list.length
    } catch (e) {
      console.error(`加载${type}计数失败`, e)
    }
  }
}

const loadCategoryList = async () => {
  categoryLoading.value = true
  try {
    categoryList.value = await dictApi.getList({ type: currentCategoryType.value })
  } catch (e) {
    console.error('加载分类失败', e)
  } finally {
    categoryLoading.value = false
  }
}

const handleSelectCategoryType = (type: string) => {
  currentCategoryType.value = type as DictType
  loadCategoryList()
}

const resetCategoryForm = () => {
  categoryForm.id = undefined
  categoryForm.type = currentCategoryType.value
  categoryForm.code = ''
  categoryForm.name = ''
  categoryForm.sort = 0
  categoryForm.status = 1
  categoryForm.parent_id = undefined
  categoryForm.remark = ''
  categoryFormRef.value?.clearValidate()
}

const handleAddCategoryType = () => {
  ElMessage.info('请在上方字典管理中添加新的字典类型')
}

const handleAddCategory = () => {
  resetCategoryForm()
  categoryDialogVisible.value = true
}

const handleAddSubCategory = (row: DictItem) => {
  resetCategoryForm()
  categoryForm.parent_id = row.id
  categoryDialogVisible.value = true
}

const handleEditCategory = (row: DictItem) => {
  resetCategoryForm()
  Object.assign(categoryForm, {
    id: row.id,
    type: row.type,
    code: row.code,
    name: row.name,
    sort: row.sort,
    status: row.status,
    parent_id: row.parent_id,
    remark: row.remark || ''
  })
  categoryDialogVisible.value = true
}

const handleDeleteCategory = async (row: DictItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除分类「${row.name}」吗？`, '删除确认', {
      type: 'warning'
    })
    await dictApi.delete(row.id)
    ElMessage.success('删除成功')
    loadCategoryList()
    loadAllCategoryCounts()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
      ElMessage.error('删除失败')
    }
  }
}

const handleStatusChange = async (row: DictItem) => {
  try {
    await dictApi.update(row.id, { status: row.status })
    ElMessage.success('状态已更新')
  } catch (e) {
    console.error('更新状态失败', e)
    ElMessage.error('更新失败')
    row.status = row.status === 1 ? 0 : 1 // 回滚
  }
}

const saveCategory = async () => {
  if (!categoryFormRef.value) return
  try {
    await categoryFormRef.value.validate()
  } catch {
    return
  }

  categorySaving.value = true
  try {
    const data = {
      type: categoryForm.type,
      code: categoryForm.code,
      name: categoryForm.name,
      sort: categoryForm.sort,
      status: categoryForm.status,
      parent_id: categoryForm.parent_id,
      remark: categoryForm.remark || undefined
    }

    if (categoryForm.id) {
      await dictApi.update(categoryForm.id, data)
      ElMessage.success('更新成功')
    } else {
      await dictApi.create(data)
      ElMessage.success('添加成功')
    }
    categoryDialogVisible.value = false
    loadCategoryList()
    loadAllCategoryCounts()
  } catch (e) {
    console.error('保存失败', e)
    ElMessage.error('操作失败')
  } finally {
    categorySaving.value = false
  }
}

// 初始化
onMounted(() => {
  loadConfig()
  loadDictList()
  loadCompany()
  loadAllCategoryCounts()
  loadQQBotConfig()
  loadCategoryList()
})
</script>

<style lang="scss" scoped>
.settings-page {
  .settings-card {
    border-radius: 12px;
    
    :deep(.el-card__body) {
      padding: 0;
    }
  }

  .settings-tabs {
    :deep(.el-tabs__header) {
      margin: 0;
      padding: 0 20px;
      background: #fafafa;
      border-bottom: 1px solid #e4e7ed;
      border-radius: 12px 12px 0 0;
    }

    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }

    :deep(.el-tabs__item) {
      height: 50px;
      line-height: 50px;
      font-size: 14px;
      
      &.is-active {
        font-weight: 600;
      }
    }
  }

  .tab-content {
    padding: 24px;
    min-height: 400px;
  }

  .config-form,
  .company-form {
    max-width: 800px;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.4;
    margin-top: 4px;
  }

  // 字典管理样式
  .dict-toolbar {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }

  // 分类管理布局
  .category-layout {
    display: flex;
    gap: 24px;
    min-height: 500px;
  }

  .category-sidebar {
    width: 200px;
    flex-shrink: 0;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #fafafa;
      border-bottom: 1px solid #e4e7ed;
      font-weight: 500;
    }

    .el-menu {
      border-right: none;
    }

    .el-menu-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .menu-badge {
        :deep(.el-badge__content) {
          font-size: 10px;
          height: 16px;
          line-height: 16px;
          padding: 0 5px;
        }
      }
    }
  }

  .category-main {
    flex: 1;
    min-width: 0;

    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .title {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .category-name {
    font-weight: 500;
  }

  :deep(.el-divider__text) {
    font-weight: 500;
    color: #303133;
  }

  :deep(.el-table) {
    th.el-table__cell {
      background: #fafafa;
      font-weight: 500;
    }
  }
}
</style>