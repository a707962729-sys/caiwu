import { useState, useEffect } from 'react'
import { Table, Card, Button, Tag, Space, message, Modal, Form, Input, InputNumber, Select, DatePicker, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { transactionApi } from '../api'
import './Transactions.css'

interface TransactionRecord {
  id: number
  transaction_no: string
  transaction_date: string
  type: 'income' | 'expense'
  transaction_type: string
  category: string
  amount: number
  currency: string
  status: string
  description?: string
  partner_name?: string
  contract_name?: string
  creator_name?: string
  created_at: string
}

const Transactions = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TransactionRecord[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filterType, setFilterType] = useState<string>('')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [pagination.current, filterType, dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize,
      }
      if (filterType) params.type = filterType
      if (dateRange) {
        params.startDate = dateRange[0]
        params.endDate = dateRange[1]
      }
      if (searchText) params.search = searchText

      const result = await transactionApi.getList(params) as any
      const list = result?.data?.list || result?.list || []
      setData(list)
      setPagination(prev => ({
        ...prev,
        total: result?.data?.pagination?.total || list.length
      }))
    } catch (err: any) {
      message.error('加载数据失败: ' + (err.message || ''))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination(p => ({ ...p, current: 1 }))
    loadData()
  }

  const handleAdd = () => {
    setEditingId(null)
    form.setFieldsValue({
      transaction_date: undefined,
      type: 'expense',
      transaction_type: '',
      category: '',
      amount: 0,
      description: '',
    })
    setModalVisible(true)
  }

  const handleEdit = (record: TransactionRecord) => {
    setEditingId(record.id)
    form.setFieldsValue({
      ...record,
      transaction_date: record.transaction_date ? record.transaction_date.split(' ')[0] : undefined,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        transaction_date: values.transaction_date?.format('YYYY-MM-DD') || new Date().toISOString().split('T')[0],
        type: values.type,
      }

      if (editingId) {
        await transactionApi.update(editingId, payload)
        message.success('更新成功')
      } else {
        await transactionApi.create(payload as any)
        message.success('创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (err: any) {
      if (err.errorFields) return
      message.error(editingId ? '更新失败' : '创建失败: ' + (err.message || ''))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await transactionApi.delete(id)
      message.success('删除成功')
      loadData()
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || ''))
    }
  }

  const getStatusTag = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: '待审核', color: 'default' },
      confirmed: { label: '已确认', color: 'success' },
      cancelled: { label: '已取消', color: 'error' },
    }
    const info = map[status] || { label: status, color: 'default' }
    return <Tag color={info.color}>{info.label}</Tag>
  }

  const columns: ColumnsType<TransactionRecord> = [
    {
      title: '日期',
      dataIndex: 'transaction_date',
      key: 'transaction_date',
      width: 110,
      render: (v: string) => v?.split(' ')[0] || '-',
      sorter: (a, b) => (a.transaction_date || '').localeCompare(b.transaction_date || ''),
    },
    {
      title: '单号',
      dataIndex: 'transaction_no',
      key: 'transaction_no',
      width: 160,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'income' ? 'success' : 'red'}>
          {v === 'income' ? '收入' : '支出'}
        </Tag>
      ),
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      render: (v: number, record: TransactionRecord) => (
        <span style={{ color: record.type === 'income' ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {record.type === 'income' ? '+' : '-'}¥{v?.toLocaleString() || '0'}
        </span>
      ),
      sorter: (a, b) => (a.amount || 0) - (b.amount || 0),
    },
    {
      title: '对方单位',
      dataIndex: 'partner_name',
      key: 'partner_name',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: TransactionRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // Stats
  const totalIncome = data.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0)
  const totalExpense = data.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0)

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h2>记账管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增记账
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <div className="stats-cards">
        <Card size="small" className="stat-card income-card">
          <div className="stat-label">收入合计</div>
          <div className="stat-value income">+¥{totalIncome.toLocaleString()}</div>
          <div className="stat-count">{data.filter(r => r.type === 'income').length} 笔</div>
        </Card>
        <Card size="small" className="stat-card expense-card">
          <div className="stat-label">支出合计</div>
          <div className="stat-value expense">-¥{totalExpense.toLocaleString()}</div>
          <div className="stat-count">{data.filter(r => r.type === 'expense').length} 笔</div>
        </Card>
        <Card size="small" className="stat-card balance-card">
          <div className="stat-label">结余</div>
          <div className={`stat-value ${totalIncome - totalExpense >= 0 ? 'income' : 'expense'}`}>
            {totalIncome - totalExpense >= 0 ? '+' : '-'}¥{Math.abs(totalIncome - totalExpense).toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card size="small" className="filter-card">
        <Space wrap>
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => { setFilterType(v || ''); setPagination(p => ({ ...p, current: 1 })) }}
          >
            <Select.Option value="income">收入</Select.Option>
            <Select.Option value="expense">支出</Select.Option>
          </Select>
          <Input.Search
            placeholder="搜索单号/描述/客户"
            style={{ width: 200 }}
            onSearch={handleSearch}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <DatePicker.RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              } else {
                setDateRange(null)
              }
              setPagination(p => ({ ...p, current: 1 }))
            }}
          />
          <Button onClick={handleSearch}>筛选</Button>
        </Space>
      </Card>

      {/* Table */}
      <Card size="small" className="table-card">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingId ? '编辑记账' : '新增记账'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields() }}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="transaction_date" label="记账日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="type" label="收支类型" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>
                <Select.Option value="income">收入</Select.Option>
                <Select.Option value="expense">支出</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="category" label="类别" rules={[{ required: true, message: '请输入类别' }]} style={{ flex: 1 }}>
              <Input placeholder="如：销售收入、人员工资" />
            </Form.Item>
          </Space>

          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="0.00"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Form.Item name="transaction_type" label="交易类型" rules={[{ required: true, message: '请输入交易类型' }]}>
            <Input placeholder="如：收入、支出" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选描述信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Transactions
