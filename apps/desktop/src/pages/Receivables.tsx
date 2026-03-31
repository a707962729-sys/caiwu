import { useState, useEffect } from 'react'
import { Table, Card, Button, Tag, message, Modal, Form, Input, InputNumber, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import { receivablePayableApi } from '../api'
import './Receivables.css'

interface ReceivableRecord {
  id: number
  type: 'receivable' | 'payable'
  rp_no: string
  partner_name: string
  amount: number
  paid_amount: number
  remaining_amount: number
  due_date: string
  status: string
  notes?: string
}

const Receivables = () => {
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReceivableRecord[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [activeTab, pagination.current])

  const loadData = async () => {
    setLoading(true)
    try {
      const api = activeTab === 'receivable' 
        ? receivablePayableApi.getReceivables 
        : receivablePayableApi.getPayables
      
      const result = await api({}) as any
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

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: '待处理', color: 'default' },
      partial: { label: '部分收款', color: 'processing' },
      settled: { label: '已完成', color: 'success' },
      overdue: { label: '已逾期', color: 'error' },
      paid: { label: '已付款', color: 'success' },
    }
    return map[status] || { label: status, color: 'default' }
  }

  const getDaysLeft = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const handleAdd = () => {
    form.setFieldsValue({ type: activeTab })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await receivablePayableApi.create({
        ...values,
        status: 'pending',
        due_date: values.due_date?.format('YYYY-MM-DD'),
      } as any)
      message.success('添加成功')
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (err: any) {
      if (err.errorFields) return
      message.error('添加失败: ' + (err.message || ''))
    }
  }

  const columns: ColumnsType<ReceivableRecord> = [
    {
      title: '单据编号',
      dataIndex: 'rp_no',
      key: 'rp_no',
      width: 150,
    },
    {
      title: activeTab === 'receivable' ? '客户' : '供应商',
      dataIndex: 'partner_name',
      key: 'partner_name',
      width: 180,
    },
    {
      title: '总金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => (
        <span style={{ color: activeTab === 'receivable' ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
          ¥{v.toLocaleString()}
        </span>
      ),
    },
    {
      title: '已收/付',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 100,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '剩余',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      width: 120,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '到期日',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
    },
    {
      title: '剩余天数',
      key: 'days_left',
      width: 90,
      render: (_: any, record: ReceivableRecord) => {
        const days = getDaysLeft(record.due_date)
        const cls = days < 0 ? 'overdue' : days < 7 ? 'warning' : ''
        return (
          <span className={cls}>
            {days < 0 ? `逾期${Math.abs(days)}天` : `${days}天`}
          </span>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const info = getStatusInfo(status)
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ]

  const totals = {
    receivable: {
      total: data.filter(r => r.type === 'receivable').reduce((s, r) => s + r.amount, 0),
      paid: data.filter(r => r.type === 'receivable').reduce((s, r) => s + r.paid_amount, 0),
      remaining: data.filter(r => r.type === 'receivable').reduce((s, r) => s + r.remaining_amount, 0),
    },
    payable: {
      total: data.filter(r => r.type === 'payable').reduce((s, r) => s + r.amount, 0),
      paid: data.filter(r => r.type === 'payable').reduce((s, r) => s + r.paid_amount, 0),
      remaining: data.filter(r => r.type === 'payable').reduce((s, r) => s + r.remaining_amount, 0),
    },
  }

  return (
    <div className="receivables-page">
      <div className="page-header">
        <h2>应收应付管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增记录
        </Button>
      </div>

      <div className="Summary-cards">
        <div
          className={`Summary-card ${activeTab === 'receivable' ? 'active' : ''} receivable`}
          onClick={() => { setActiveTab('receivable'); setPagination(p => ({ ...p, current: 1 })) }}
        >
          <div className="card-title">应收账款</div>
          <div className="card-amount income">¥{totals.receivable.total.toLocaleString()}</div>
          <div className="card-meta">
            <span>已收: ¥{totals.receivable.paid.toLocaleString()}</span>
            <span>待收: ¥{totals.receivable.remaining.toLocaleString()}</span>
          </div>
        </div>
        <div
          className={`Summary-card ${activeTab === 'payable' ? 'active' : ''} payable`}
          onClick={() => { setActiveTab('payable'); setPagination(p => ({ ...p, current: 1 })) }}
        >
          <div className="card-title">应付账款</div>
          <div className="card-amount expense">¥{totals.payable.total.toLocaleString()}</div>
          <div className="card-meta">
            <span>已付: ¥{totals.payable.paid.toLocaleString()}</span>
            <span>待付: ¥{totals.payable.remaining.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Card size="small" className="table-card">
        <div className="tab-bar">
          <span
            className={`tab ${activeTab === 'receivable' ? 'active' : ''}`}
            onClick={() => { setActiveTab('receivable'); setPagination(p => ({ ...p, current: 1 })) }}
          >
            应收账款 ({totals.receivable.total > 0 ? data.filter(r => r.type === 'receivable').length : '-'})
          </span>
          <span
            className={`tab ${activeTab === 'payable' ? 'active' : ''}`}
            onClick={() => { setActiveTab('payable'); setPagination(p => ({ ...p, current: 1 })) }}
          >
            应付账款 ({totals.payable.total > 0 ? data.filter(r => r.type === 'payable').length : '-'})
          </span>
        </div>

        <Table
          columns={columns}
          dataSource={data.filter(r => r.type === activeTab)}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => setPagination(p => ({ ...p, current: page })),
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={`新增${activeTab === 'receivable' ? '应收' : '应付'}记录`}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields() }}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="类型" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="partner_name"
            label={activeTab === 'receivable' ? '客户名称' : '供应商名称'}
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder={`请输入${activeTab === 'receivable' ? '客户' : '供应商'}名称`} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="due_date" label="到期日" rules={[{ required: true, message: '请选择到期日' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Receivables
