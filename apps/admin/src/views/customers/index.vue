<template>
  <div class="customers-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">客户总数</div>
              <div class="stat-value">{{ stats.total }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card active">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Avatar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">活跃客户</div>
              <div class="stat-value">{{ getStatusCount('active') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card potential">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Star /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">潜在客户</div>
              <div class="stat-value">{{ getStatusCount('potential') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card lost">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">已流失</div>
              <div class="stat-value">{{ getStatusCount('lost') }}</div>
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
            placeholder="客户名称/联系人/电话" 
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
        <el-form-item label="类型">
          <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 120px" @change="handleFilter">
            <el-option label="个人" value="individual" />
            <el-option label="企业" value="company" />
            <el-option label="政府" value="government" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px" @change="handleFilter">
            <el-option label="潜在客户" value="potential" />
            <el-option label="活跃客户" value="active" />
            <el-option label="不活跃" value="inactive" />
            <el-option label="已流失" value="lost" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filterForm.source" placeholder="全部来源" clearable style="width: 120px" @change="handleFilter">
            <el-option label="官网" value="website" />
            <el-option label="转介绍" value="referral" />
            <el-option label="广告" value="advertisement" />
            <el-option label="展会" value="exhibition" />
            <el-option label="电话营销" value="cold_call" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增客户</el-button>
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
        @row-click="handleRowClick"
      >
        <el-table-column prop="name" label="客户名称" min-width="160">
          <template #default="{ row }">
            <div class="customer-name">
              <span class="name">{{ row.name }}</span>
              <el-tag v-if="row.credit_level" :type="getCreditTagType(row.credit_level)" size="small" class="credit-tag">
                {{ row.credit_level }}级
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact_person" label="联系人" width="100">
          <template #default="{ row }">
            {{ row.contact_person || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" width="130">
          <template #default="{ row }">
            <span v-if="row.phone" class="phone-link" @click.stop>
              <a :href="`tel:${row.phone}`">{{ row.phone }}</a>
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="industry" label="行业" width="100">
          <template #default="{ row }">
            {{ row.industry || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deal_count" label="成交次数" width="90" align="center">
          <template #default="{ row }">
            <span class="deal-count">{{ row.deal_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="成交金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.total_amount || 0) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="last_contact_date" label="最近联系" width="100">
          <template #default="{ row }">
            {{ row.last_contact_date ? formatDate(row.last_contact_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="next_follow_date" label="下次跟进" width="100">
          <template #default="{ row }">
            <span :class="{ 'overdue': isOverdue(row.next_follow_date) }">
              {{ row.next_follow_date ? formatDate(row.next_follow_date) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" @click.stop="handleFollow(row)">跟进</el-button>
            <el-button link type="danger" @click.stop="handleDelete(row)">删除</el-button>
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

    <!-- 新增/编辑客户弹窗 -->
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
            <el-form-item label="客户名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入客户名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户类型" prop="type">
              <el-select v-model="formData.type" placeholder="选择类型" style="width: 100%">
                <el-option label="个人" value="individual" />
                <el-option label="企业" value="company" />
                <el-option label="政府" value="government" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="formData.contact_person" placeholder="主要联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话">
              <el-input v-model="formData.phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="formData.email" placeholder="电子邮箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="行业">
              <el-select v-model="formData.industry" placeholder="选择行业" clearable style="width: 100%">
                <el-option label="IT/互联网" value="IT/互联网" />
                <el-option label="金融" value="金融" />
                <el-option label="制造业" value="制造业" />
                <el-option label="教育" value="教育" />
                <el-option label="医疗" value="医疗" />
                <el-option label="房地产" value="房地产" />
                <el-option label="零售" value="零售" />
                <el-option label="服务业" value="服务业" />
                <el-option label="政府/事业单位" value="政府/事业单位" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户状态">
              <el-select v-model="formData.status" placeholder="选择状态" style="width: 100%">
                <el-option label="潜在客户" value="potential" />
                <el-option label="活跃客户" value="active" />
                <el-option label="不活跃" value="inactive" />
                <el-option label="已流失" value="lost" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户来源">
              <el-select v-model="formData.source" placeholder="选择来源" clearable style="width: 100%">
                <el-option label="官网" value="website" />
                <el-option label="转介绍" value="referral" />
                <el-option label="广告" value="advertisement" />
                <el-option label="展会" value="exhibition" />
                <el-option label="电话营销" value="cold_call" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="信用等级">
              <el-select v-model="formData.credit_level" placeholder="选择等级" clearable style="width: 100%">
                <el-option label="A级 (优质)" value="A" />
                <el-option label="B级 (良好)" value="B" />
                <el-option label="C级 (一般)" value="C" />
                <el-option label="D级 (较差)" value="D" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下次跟进">
              <el-date-picker
                v-model="formData.next_follow_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="详细地址">
          <el-input v-model="formData.address" placeholder="详细地址" />
        </el-form-item>
        <el-form-item label="网址">
          <el-input v-model="formData.website" placeholder="公司网站" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="添加备注（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 客户详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="currentCustomer?.name"
      size="60%"
      direction="rtl"
    >
      <div class="customer-drawer" v-if="currentCustomer">
        <!-- 客户信息 -->
        <div class="info-section">
          <h4 class="section-title">基本信息</h4>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="客户类型">
              <el-tag :type="getTypeTagType(currentCustomer.type)" size="small">
                {{ getTypeLabel(currentCustomer.type) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="客户状态">
              <el-tag :type="getStatusTagType(currentCustomer.status)" size="small">
                {{ getStatusLabel(currentCustomer.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="信用等级">
              <el-tag v-if="currentCustomer.credit_level" :type="getCreditTagType(currentCustomer.credit_level)" size="small">
                {{ currentCustomer.credit_level }}级
              </el-tag>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="联系人">{{ currentCustomer.contact_person || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电话">
              <a v-if="currentCustomer.phone" :href="`tel:${currentCustomer.phone}`">{{ currentCustomer.phone }}</a>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ currentCustomer.email || '-' }}</el-descriptions-item>
            <el-descriptions-item label="行业">{{ currentCustomer.industry || '-' }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{ currentCustomer.source ? getSourceLabel(currentCustomer.source) : '-' }}</el-descriptions-item>
            <el-descriptions-item label="成交次数">{{ currentCustomer.deal_count || 0 }} 次</el-descriptions-item>
            <el-descriptions-item label="成交金额">{{ formatMoney(currentCustomer.total_amount || 0) }}</el-descriptions-item>
            <el-descriptions-item label="最近联系">{{ currentCustomer.last_contact_date || '-' }}</el-descriptions-item>
            <el-descriptions-item label="下次跟进">{{ currentCustomer.next_follow_date || '-' }}</el-descriptions-item>
            <el-descriptions-item label="地址" :span="3">{{ currentCustomer.address || '-' }}</el-descriptions-item>
            <el-descriptions-item label="网址" :span="3">
              <a v-if="currentCustomer.website" :href="currentCustomer.website" target="_blank">{{ currentCustomer.website }}</a>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="备注" :span="3">{{ currentCustomer.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- Tabs: 联系人 & 跟进记录 -->
        <el-tabs v-model="activeTab" class="detail-tabs">
          <!-- 联系人 -->
          <el-tab-pane label="联系人" name="contacts">
            <div class="tab-header">
              <el-button type="primary" size="small" :icon="Plus" @click="handleAddContact">新增联系人</el-button>
            </div>
            <el-table :data="contacts" v-loading="contactsLoading" size="small">
              <el-table-column prop="name" label="姓名" width="100">
                <template #default="{ row }">
                  <span>
                    {{ row.name }}
                    <el-tag v-if="row.is_primary" type="success" size="small" class="primary-tag">主要</el-tag>
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="position" label="职位" width="100">
                <template #default="{ row }">{{ row.position || '-' }}</template>
              </el-table-column>
              <el-table-column prop="mobile" label="手机" width="130">
                <template #default="{ row }">
                  <a v-if="row.mobile" :href="`tel:${row.mobile}`">{{ row.mobile }}</a>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="phone" label="座机" width="120">
                <template #default="{ row }">{{ row.phone || '-' }}</template>
              </el-table-column>
              <el-table-column prop="email" label="邮箱" min-width="160">
                <template #default="{ row }">
                  <a v-if="row.email" :href="`mailto:${row.email}`">{{ row.email }}</a>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="wechat" label="微信" width="100">
                <template #default="{ row }">{{ row.wechat || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="140" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="handleEditContact(row)">编辑</el-button>
                  <el-button v-if="!row.is_primary" link type="primary" size="small" @click="handleSetPrimaryContact(row)">设为主要</el-button>
                  <el-button link type="danger" size="small" @click="handleDeleteContact(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 跟进记录 -->
          <el-tab-pane label="跟进记录" name="follows">
            <div class="tab-header">
              <el-button type="primary" size="small" :icon="Plus" @click="handleAddFollow">新增跟进</el-button>
            </div>
            <div class="follow-timeline" v-loading="followsLoading">
              <el-timeline v-if="follows.length > 0">
                <el-timeline-item
                  v-for="item in follows"
                  :key="item.id"
                  :timestamp="item.created_at"
                  placement="top"
                  :type="getFollowTimelineType(item.type)"
                >
                  <el-card shadow="hover" class="follow-card">
                    <div class="follow-header">
                      <el-tag :type="getFollowTagType(item.type)" size="small">
                        {{ getFollowTypeLabel(item.type) }}
                      </el-tag>
                      <span class="contact-name" v-if="item.contact_name">联系人：{{ item.contact_name }}</span>
                      <span class="creator">记录人：{{ item.creator_name || '系统' }}</span>
                    </div>
                    <div class="follow-content">{{ item.content }}</div>
                    <div class="follow-footer" v-if="item.next_action || item.next_date">
                      <span class="next-action" v-if="item.next_action">
                        <el-icon><Calendar /></el-icon>
                        下一步：{{ item.next_action }}
                      </span>
                      <span class="next-date" v-if="item.next_date">
                        <el-icon><Clock /></el-icon>
                        计划日期：{{ item.next_date }}
                      </span>
                    </div>
                    <div class="follow-actions">
                      <el-button link type="primary" size="small" @click="handleEditFollow(item)">编辑</el-button>
                      <el-button link type="danger" size="small" @click="handleDeleteFollow(item)">删除</el-button>
                    </div>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
              <el-empty v-else description="暂无跟进记录" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <!-- 联系人弹窗 -->
    <el-dialog
      v-model="contactDialogVisible"
      :title="contactDialogTitle"
      width="500px"
      :close-on-click-modal="false"
      @close="resetContactForm"
    >
      <el-form
        ref="contactFormRef"
        :model="contactFormData"
        :rules="contactFormRules"
        label-width="80px"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="contactFormData.name" placeholder="联系人姓名" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="职位">
              <el-input v-model="contactFormData.position" placeholder="职位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门">
              <el-input v-model="contactFormData.department" placeholder="部门" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="手机">
              <el-input v-model="contactFormData.mobile" placeholder="手机号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="座机">
              <el-input v-model="contactFormData.phone" placeholder="座机号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="contactFormData.email" placeholder="邮箱地址" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="微信">
              <el-input v-model="contactFormData.wechat" placeholder="微信号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="QQ">
          <el-input v-model="contactFormData.qq" placeholder="QQ号" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="contactFormData.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="主要联系人">
          <el-switch v-model="contactFormData.is_primary" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="contactDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="contactSubmitting" @click="handleSubmitContact">确定</el-button>
      </template>
    </el-dialog>

    <!-- 跟进记录弹窗 -->
    <el-dialog
      v-model="followDialogVisible"
      :title="followDialogTitle"
      width="560px"
      :close-on-click-modal="false"
      @close="resetFollowForm"
    >
      <el-form
        ref="followFormRef"
        :model="followFormData"
        :rules="followFormRules"
        label-width="90px"
      >
        <el-form-item label="跟进方式" prop="type">
          <el-select v-model="followFormData.type" placeholder="选择方式" style="width: 100%">
            <el-option label="上门拜访" value="visit" />
            <el-option label="电话沟通" value="call" />
            <el-option label="邮件联系" value="email" />
            <el-option label="微信沟通" value="wechat" />
            <el-option label="其他方式" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人">
          <el-select v-model="followFormData.contact_id" placeholder="选择联系人（选填）" clearable style="width: 100%">
            <el-option
              v-for="contact in contacts"
              :key="contact.id"
              :label="contact.name"
              :value="contact.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进内容" prop="content">
          <el-input
            v-model="followFormData.content"
            type="textarea"
            :rows="4"
            placeholder="请输入跟进内容"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="下一步">
              <el-input v-model="followFormData.next_action" placeholder="下一步行动计划" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计划日期">
              <el-date-picker
                v-model="followFormData.next_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="followDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="followSubmitting" @click="handleSubmitFollow">确定</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="400px"
    >
      <p>确定要删除客户「{{ deleteTarget?.name }}」吗？</p>
      <p class="delete-warning">删除后相关联系人和跟进记录也会被删除，此操作不可恢复。</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确定删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, Download, Search, User, Avatar, Star, Warning, Calendar, Clock
} from '@element-plus/icons-vue'
import {
  customerApi,
  contactApi,
  followRecordApi,
  type Customer,
  type Contact,
  type FollowRecord,
  type CustomerCreateParams,
  type ContactCreateParams,
  type FollowRecordCreateParams,
  type CustomerType,
  type CustomerStatus,
  type CustomerSource,
  getCustomerTypeLabel as getTypeLabel,
  getCustomerStatusLabel as getStatusLabel,
  getCustomerSourceLabel as getSourceLabel,
  getFollowTypeLabel
} from '@/api/customer'
import type { FormInstance, FormRules } from 'element-plus'
import dayjs from 'dayjs'

// 加载状态
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const contactsLoading = ref(false)
const followsLoading = ref(false)
const contactSubmitting = ref(false)
const followSubmitting = ref(false)

// 数据
const tableData = ref<Customer[]>([])
const currentCustomer = ref<Customer | null>(null)
const contacts = ref<Contact[]>([])
const follows = ref<FollowRecord[]>([])

// 统计数据
const stats = reactive({
  total: 0,
  by_status: [] as Array<{ status: string; count: number }>,
  by_type: [] as Array<{ type: string; count: number }>,
  by_source: [] as Array<{ source: string; count: number }>
})

// 筛选表单
const filterForm = reactive({
  search: '',
  type: '' as CustomerType | '',
  status: '' as CustomerStatus | '',
  source: '' as CustomerSource | ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 弹窗
const dialogVisible = ref(false)
const dialogTitle = computed(() => formData.id ? '编辑客户' : '新增客户')
const deleteDialogVisible = ref(false)
const deleteTarget = ref<Customer | null>(null)
const drawerVisible = ref(false)
const activeTab = ref('contacts')

// 客户表单
const formRef = ref<FormInstance>()
const formData = reactive<CustomerCreateParams & { id?: number }>({
  name: '',
  type: 'company',
  status: 'potential',
  source: undefined,
  industry: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  province: '',
  city: '',
  district: '',
  website: '',
  remark: '',
  credit_level: undefined,
  next_follow_date: ''
})

// 客户表单校验
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入客户名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择客户类型', trigger: 'change' }
  ]
}

// 联系人弹窗
const contactDialogVisible = ref(false)
const contactDialogTitle = computed(() => contactFormData.id ? '编辑联系人' : '新增联系人')
const contactFormRef = ref<FormInstance>()
const contactFormData = reactive<ContactCreateParams & { id?: number }>({
  customer_id: 0,
  name: '',
  position: '',
  department: '',
  phone: '',
  mobile: '',
  email: '',
  wechat: '',
  qq: '',
  is_primary: false,
  remark: ''
})

// 联系人表单校验
const contactFormRules: FormRules = {
  name: [
    { required: true, message: '请输入联系人姓名', trigger: 'blur' }
  ]
}

// 跟进记录弹窗
const followDialogVisible = ref(false)
const followDialogTitle = computed(() => followFormData.id ? '编辑跟进记录' : '新增跟进记录')
const followFormRef = ref<FormInstance>()
const followFormData = reactive<FollowRecordCreateParams & { id?: number }>({
  customer_id: 0,
  contact_id: undefined,
  type: 'call',
  content: '',
  next_action: '',
  next_date: ''
})

// 跟进表单校验
const followFormRules: FormRules = {
  type: [
    { required: true, message: '请选择跟进方式', trigger: 'change' }
  ],
  content: [
    { required: true, message: '请输入跟进内容', trigger: 'blur' }
  ]
}

// 计算属性
const getStatusCount = (status: CustomerStatus) => {
  const item = stats.by_status.find(s => s.status === status)
  return item ? item.count : 0
}

// 工具函数
const formatMoney = (n: number) => {
  if (!n && n !== 0) return '¥0.00'
  if (Math.abs(n) >= 10000) {
    return '¥' + (n / 10000).toFixed(2) + '万'
  }
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (date: string) => {
  return dayjs(date).format('MM-DD')
}

const isOverdue = (date?: string) => {
  if (!date) return false
  return dayjs(date).isBefore(dayjs(), 'day')
}

const getTypeTagType = (type: CustomerType) => {
  const map: Record<CustomerType, string> = {
    individual: '',
    company: 'primary',
    government: 'warning',
    other: 'info'
  }
  return map[type] || ''
}

const getStatusTagType = (status: CustomerStatus) => {
  const map: Record<CustomerStatus, string> = {
    potential: 'info',
    active: 'success',
    inactive: 'warning',
    lost: 'danger'
  }
  return map[status] || ''
}

const getCreditTagType = (level: string) => {
  const map: Record<string, string> = {
    A: 'success',
    B: 'primary',
    C: 'warning',
    D: 'danger'
  }
  return map[level] || ''
}

const getFollowTagType = (type: string) => {
  const map: Record<string, string> = {
    visit: 'primary',
    call: 'success',
    email: 'warning',
    wechat: 'success',
    other: 'info'
  }
  return map[type] || 'info'
}

const getFollowTimelineType = (type: string) => {
  const map: Record<string, string> = {
    visit: 'primary',
    call: 'success',
    email: 'warning',
    wechat: 'success',
    other: 'info'
  }
  return map[type] || 'primary'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await customerApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filterForm.search || undefined,
      type: filterForm.type || undefined,
      status: filterForm.status || undefined,
      source: filterForm.source || undefined
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

// 加载统计
const loadStats = async () => {
  try {
    const res = await customerApi.getStats()
    stats.total = res.total || 0
    stats.by_status = res.by_status || []
    stats.by_type = res.by_type || []
    stats.by_source = res.by_source || []
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

// 加载联系人
const loadContacts = async (customerId: number) => {
  contactsLoading.value = true
  try {
    const res = await contactApi.getList({ customer_id: customerId, pageSize: 100 })
    contacts.value = res.list || []
  } catch (e) {
    console.error('加载联系人失败', e)
  } finally {
    contactsLoading.value = false
  }
}

// 加载跟进记录
const loadFollows = async (customerId: number) => {
  followsLoading.value = true
  try {
    const res = await followRecordApi.getList({ customer_id: customerId, pageSize: 50 })
    follows.value = res.list || []
  } catch (e) {
    console.error('加载跟进记录失败', e)
  } finally {
    followsLoading.value = false
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

const handleRowClick = (row: Customer) => {
  currentCustomer.value = row
  drawerVisible.value = true
  loadContacts(row.id)
  loadFollows(row.id)
}

// 新增客户
const handleAdd = () => {
  resetForm()
  dialogVisible.value = true
}

// 编辑客户
const handleEdit = (row: Customer) => {
  resetForm()
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    source: row.source,
    industry: row.industry,
    contact_person: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    province: row.province,
    city: row.city,
    district: row.district,
    website: row.website,
    remark: row.remark,
    credit_level: row.credit_level,
    next_follow_date: row.next_follow_date
  })
  dialogVisible.value = true
}

// 快速跟进
const handleFollow = (row: Customer) => {
  currentCustomer.value = row
  resetFollowForm()
  followFormData.customer_id = row.id
  loadContacts(row.id)
  followDialogVisible.value = true
}

// 提交客户表单
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
      await customerApi.update(formData.id, {
        name: formData.name,
        type: formData.type,
        status: formData.status,
        source: formData.source,
        industry: formData.industry,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        website: formData.website,
        remark: formData.remark,
        credit_level: formData.credit_level,
        next_follow_date: formData.next_follow_date
      })
      ElMessage.success('更新成功')
    } else {
      await customerApi.create({
        name: formData.name,
        type: formData.type,
        status: formData.status,
        source: formData.source,
        industry: formData.industry,
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        website: formData.website,
        remark: formData.remark,
        credit_level: formData.credit_level,
        next_follow_date: formData.next_follow_date
      })
      ElMessage.success('添加成功')
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

// 删除客户
const handleDelete = (row: Customer) => {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    await customerApi.delete(deleteTarget.value.id)
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

// 导出
const handleExport = async () => {
  try {
    const blob = await customerApi.export({
      search: filterForm.search || undefined,
      type: filterForm.type || undefined,
      status: filterForm.status || undefined,
      source: filterForm.source || undefined
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `客户列表_${dayjs().format('YYYY-MM-DD')}.xlsx`
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

// 重置客户表单
const resetForm = () => {
  formData.id = undefined
  formData.name = ''
  formData.type = 'company'
  formData.status = 'potential'
  formData.source = undefined
  formData.industry = ''
  formData.contact_person = ''
  formData.phone = ''
  formData.email = ''
  formData.address = ''
  formData.province = ''
  formData.city = ''
  formData.district = ''
  formData.website = ''
  formData.remark = ''
  formData.credit_level = undefined
  formData.next_follow_date = ''
  formRef.value?.clearValidate()
}

// ========== 联系人相关 ==========
const handleAddContact = () => {
  if (!currentCustomer.value) return
  resetContactForm()
  contactFormData.customer_id = currentCustomer.value.id
  contactDialogVisible.value = true
}

const handleEditContact = (row: Contact) => {
  resetContactForm()
  Object.assign(contactFormData, {
    id: row.id,
    customer_id: row.customer_id,
    name: row.name,
    position: row.position,
    department: row.department,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    wechat: row.wechat,
    qq: row.qq,
    is_primary: row.is_primary,
    remark: row.remark
  })
  contactDialogVisible.value = true
}

const handleDeleteContact = async (row: Contact) => {
  try {
    await ElMessageBox.confirm('确定要删除此联系人吗？', '删除确认', {
      type: 'warning'
    })
    await contactApi.delete(row.id)
    ElMessage.success('删除成功')
    loadContacts(row.customer_id)
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
      ElMessage.error('删除失败')
    }
  }
}

const handleSetPrimaryContact = async (row: Contact) => {
  try {
    await contactApi.setPrimary(row.id)
    ElMessage.success('设置成功')
    loadContacts(row.customer_id)
  } catch (e) {
    console.error('设置失败', e)
    ElMessage.error('设置失败')
  }
}

const handleSubmitContact = async () => {
  if (!contactFormRef.value) return
  
  try {
    await contactFormRef.value.validate()
  } catch {
    return
  }
  
  contactSubmitting.value = true
  try {
    if (contactFormData.id) {
      await contactApi.update(contactFormData.id, {
        name: contactFormData.name,
        position: contactFormData.position,
        department: contactFormData.department,
        phone: contactFormData.phone,
        mobile: contactFormData.mobile,
        email: contactFormData.email,
        wechat: contactFormData.wechat,
        qq: contactFormData.qq,
        is_primary: contactFormData.is_primary,
        remark: contactFormData.remark
      })
      ElMessage.success('更新成功')
    } else {
      await contactApi.create({
        customer_id: contactFormData.customer_id,
        name: contactFormData.name,
        position: contactFormData.position,
        department: contactFormData.department,
        phone: contactFormData.phone,
        mobile: contactFormData.mobile,
        email: contactFormData.email,
        wechat: contactFormData.wechat,
        qq: contactFormData.qq,
        is_primary: contactFormData.is_primary,
        remark: contactFormData.remark
      })
      ElMessage.success('添加成功')
    }
    contactDialogVisible.value = false
    loadContacts(contactFormData.customer_id)
  } catch (e) {
    console.error('提交失败', e)
    ElMessage.error('操作失败')
  } finally {
    contactSubmitting.value = false
  }
}

const resetContactForm = () => {
  contactFormData.id = undefined
  contactFormData.customer_id = 0
  contactFormData.name = ''
  contactFormData.position = ''
  contactFormData.department = ''
  contactFormData.phone = ''
  contactFormData.mobile = ''
  contactFormData.email = ''
  contactFormData.wechat = ''
  contactFormData.qq = ''
  contactFormData.is_primary = false
  contactFormData.remark = ''
  contactFormRef.value?.clearValidate()
}

// ========== 跟进记录相关 ==========
const handleAddFollow = () => {
  if (!currentCustomer.value) return
  resetFollowForm()
  followFormData.customer_id = currentCustomer.value.id
  followDialogVisible.value = true
}

const handleEditFollow = (row: FollowRecord) => {
  resetFollowForm()
  Object.assign(followFormData, {
    id: row.id,
    customer_id: row.customer_id,
    contact_id: row.contact_id,
    type: row.type,
    content: row.content,
    next_action: row.next_action,
    next_date: row.next_date
  })
  followDialogVisible.value = true
}

const handleDeleteFollow = async (row: FollowRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除此跟进记录吗？', '删除确认', {
      type: 'warning'
    })
    await followRecordApi.delete(row.id)
    ElMessage.success('删除成功')
    loadFollows(row.customer_id)
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
      ElMessage.error('删除失败')
    }
  }
}

const handleSubmitFollow = async () => {
  if (!followFormRef.value) return
  
  try {
    await followFormRef.value.validate()
  } catch {
    return
  }
  
  followSubmitting.value = true
  try {
    if (followFormData.id) {
      await followRecordApi.update(followFormData.id, {
        contact_id: followFormData.contact_id,
        type: followFormData.type,
        content: followFormData.content,
        next_action: followFormData.next_action,
        next_date: followFormData.next_date
      })
      ElMessage.success('更新成功')
    } else {
      await followRecordApi.create({
        customer_id: followFormData.customer_id,
        contact_id: followFormData.contact_id,
        type: followFormData.type,
        content: followFormData.content,
        next_action: followFormData.next_action,
        next_date: followFormData.next_date
      })
      ElMessage.success('添加成功')
    }
    followDialogVisible.value = false
    loadFollows(followFormData.customer_id)
    // 刷新客户列表以更新最近联系时间
    loadData()
  } catch (e) {
    console.error('提交失败', e)
    ElMessage.error('操作失败')
  } finally {
    followSubmitting.value = false
  }
}

const resetFollowForm = () => {
  followFormData.id = undefined
  followFormData.customer_id = 0
  followFormData.contact_id = undefined
  followFormData.type = 'call'
  followFormData.content = ''
  followFormData.next_action = ''
  followFormData.next_date = ''
  followFormRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.customers-page {
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
    
    &.active {
      background: linear-gradient(135deg, #e8f9f0 0%, #d4f5e4 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
      }
      
      .stat-value {
        color: #07c160;
      }
    }
    
    &.potential {
      background: linear-gradient(135deg, #fef9e7 0%, #fdf3d1 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      }
      
      .stat-value {
        color: #f59e0b;
      }
    }
    
    &.lost {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      
      .stat-icon {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }
      
      .stat-value {
        color: #ef4444;
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
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 24px;
    }

    .stat-info {
      .stat-label {
        font-size: 13px;
        color: #909399;
      }
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        margin-top: 4px;
      }
    }
  }

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
      cursor: pointer;
      
      th.el-table__cell {
        background: #fafafa;
        color: #1a1a2e;
        font-weight: 500;
      }
      
      .customer-name {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .name {
          font-weight: 500;
        }
        
        .credit-tag {
          font-size: 10px;
        }
      }
      
      .phone-link {
        a {
          color: #3b82f6;
          text-decoration: none;
          
          &:hover {
            text-decoration: underline;
          }
        }
      }
      
      .deal-count {
        font-weight: 500;
      }
      
      .amount {
        font-weight: 600;
        color: #333;
      }
      
      .overdue {
        color: #ef4444;
        font-weight: 500;
      }
    }
  }

  .pagination-container {
    padding: 20px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #ebeef5;
  }

  .delete-warning {
    margin-top: 12px;
    padding: 10px 12px;
    background: #fef2f2;
    border-radius: 6px;
    color: #dc2626;
    font-size: 13px;
  }
}

// 抽屉样式
.customer-drawer {
  padding: 0 20px 20px;
  
  .info-section {
    margin-bottom: 24px;
    
    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 12px;
      color: #1a1a2e;
    }
  }
  
  .detail-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 16px;
    }
    
    .tab-header {
      margin-bottom: 12px;
    }
    
    .primary-tag {
      margin-left: 4px;
    }
  }
  
  .follow-timeline {
    max-height: 500px;
    overflow-y: auto;
    padding-right: 10px;
    
    .follow-card {
      margin-bottom: 0;
      
      :deep(.el-card__body) {
        padding: 12px 16px;
      }
      
      .follow-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        
        .contact-name {
          color: #606266;
          font-size: 13px;
        }
        
        .creator {
          color: #909399;
          font-size: 12px;
          margin-left: auto;
        }
      }
      
      .follow-content {
        color: #333;
        line-height: 1.6;
        white-space: pre-wrap;
      }
      
      .follow-footer {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        gap: 20px;
        
        .next-action,
        .next-date {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #606266;
          font-size: 13px;
          
          .el-icon {
            color: #909399;
          }
        }
      }
      
      .follow-actions {
        margin-top: 8px;
        text-align: right;
      }
    }
  }
}
</style>