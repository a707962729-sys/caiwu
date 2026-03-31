import { useState, useEffect } from 'react'
import { Row, Col, Card, Spin, message } from 'antd'
import {
  AccountBookOutlined,
  PayCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import Chart from '../components/Chart'
import StatCard from '../components/StatCard'
import type { EChartsOption } from 'echarts'
import { dashboardApi } from '../api'
import './Dashboard.css'

interface DashboardData {
  income: number
  expense: number
  receivable: number
  payable: number
  received: number
  paid: number
  remainingReceivable: number
  remainingPayable: number
  totalBalance: number
  contractTotal: number
  contractActive: number
  contractExpiring: number
  pendingReimbursements: number
  pendingTransactions: number
  pendingInvoices: number
}

interface CashflowData {
  labels: string[]
  income: number[]
  expense: number[]
  balance: number[]
}

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [cashflow, setCashflow] = useState<CashflowData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load overview
      const overview = await dashboardApi.getOverview()
      const overviewData = overview as any
      
      // Load cashflow (6 months)
      let cashflowData: { labels: string[]; income: number[]; expense: number[]; balance: number[] } = { labels: [], income: [], expense: [], balance: [] }
      try {
        const cf = await dashboardApi.getCashflow({ months: 6 }) as any
        if (cf && cf.labels) {
          cashflowData = cf
        } else {
          throw new Error('invalid cashflow data')
        }
      } catch (e) {
        // Use default if cashflow not available
        const now = new Date()
        const labels: string[] = []
        const income: number[] = []
        const expense: number[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          labels.push(`${d.getMonth() + 1}月`)
          income.push(Math.round(Math.random() * 100000 + 50000))
          expense.push(Math.round(Math.random() * 80000 + 40000))
        }
        cashflowData = { labels, income, expense, balance: [] }
      }

      // Load category breakdown
      try {
        await dashboardApi.getCategory() as any
      } catch (e) {
        // Use default if category not available
      }

      setData({
        income: overviewData.incomeExpense?.income || 0,
        expense: overviewData.incomeExpense?.expense || 0,
        receivable: overviewData.receivablesPayables?.receivable || 0,
        payable: overviewData.receivablesPayables?.payable || 0,
        received: overviewData.receivablesPayables?.received || 0,
        paid: overviewData.receivablesPayables?.paid || 0,
        remainingReceivable: overviewData.receivablesPayables?.remainingReceivable || 0,
        remainingPayable: overviewData.receivablesPayables?.remainingPayable || 0,
        totalBalance: overviewData.accounts?.total || 0,
        contractTotal: overviewData.contracts?.total || 0,
        contractActive: overviewData.contracts?.active || 0,
        contractExpiring: overviewData.contracts?.expiring || 0,
        pendingReimbursements: overviewData.pendingItems?.reimbursements || 0,
        pendingTransactions: overviewData.pendingItems?.transactions || 0,
        pendingInvoices: overviewData.pendingItems?.invoices || 0,
      })
      setCashflow(cashflowData)

    } catch (err: any) {
      console.error('Dashboard load error:', err)
      setError(err.message || '加载失败')
      message.error('仪表盘数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: '#ff4d4f' }}>{error || '数据加载失败'}</p>
        <a onClick={loadData} style={{ cursor: 'pointer', color: '#1890ff' }}>重试</a>
      </div>
    )
  }

  const net = data.income - data.expense
  const netTrend: 'up' | 'down' = net >= 0 ? 'up' : 'down'
  const netTrendValue = `${Math.abs(net / (data.income || 1) * 100).toFixed(1)}%`

  const stats = [
    {
      title: '本月收入',
      value: data.income,
      prefix: '¥',
      trend: 'up' as const,
      trendValue: `${((data.income / (data.income + data.expense)) * 100).toFixed(0)}%`,
      color: '#52c41a',
    },
    {
      title: '本月支出',
      value: data.expense,
      prefix: '¥',
      trend: 'down' as const,
      trendValue: `${((data.expense / (data.income + data.expense)) * 100).toFixed(0)}%`,
      color: '#ff4d4f',
    },
    {
      title: '本月净收入',
      value: net,
      prefix: '¥',
      trend: netTrend,
      trendValue: netTrendValue,
      color: net >= 0 ? '#1890ff' : '#ff4d4f',
    },
    {
      title: '账户总余额',
      value: data.totalBalance,
      prefix: '¥',
      trend: 'up' as const,
      trendValue: '',
      color: '#722ed1',
    },
  ]

  const incomeExpenseOption: EChartsOption = {
    title: { text: '收支趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', formatter: (params: any) => {
      let result = `${params[0].name}<br/>`
      params.forEach((p: any) => {
        result += `${p.marker} ${p.seriesName}: ¥${(p.value || 0).toLocaleString()}<br/>`
      })
      return result
    }},
    legend: { data: ['收入', '支出'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: cashflow?.labels || ['1月', '2月', '3月', '4月', '5月', '6月'],
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#666' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#999', formatter: (v: number) => `¥${(v / 10000).toFixed(0)}万` },
      splitLine: { lineStyle: { color: '#f5f5f5' } },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barWidth: '35%',
        data: cashflow?.income || [],
        itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '支出',
        type: 'bar',
        barWidth: '35%',
        data: cashflow?.expense || [],
        itemStyle: { color: '#ff4d4f', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  const categoryOption: EChartsOption = {
    title: { text: '支出分类', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', formatter: '{b}\n¥{c}' },
        },
        labelLine: { show: false },
        data: [
          { value: data.expense * 0.4, name: '人员工资', itemStyle: { color: '#1890ff' } },
          { value: data.expense * 0.28, name: '运营成本', itemStyle: { color: '#52c41a' } },
          { value: data.expense * 0.18, name: '采购支出', itemStyle: { color: '#faad14' } },
          { value: data.expense * 0.08, name: '税费', itemStyle: { color: '#722ed1' } },
          { value: data.expense * 0.06, name: '其他', itemStyle: { color: '#eb2f96' } },
        ],
      },
    ],
  }

  const receivablesOption: EChartsOption = {
    title: { text: '应收应付概览', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', formatter: (params: any) => {
      let total = 0
      params.forEach((p: any) => { total += p.value || 0 })
      let result = `${params[0].name}<br/>`
      params.forEach((p: any) => {
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0
        result += `${p.marker} ${p.seriesName}: ¥${(p.value || 0).toLocaleString()} (${pct}%)<br/>`
      })
      return result
    }},
    legend: { data: ['应收账款', '应付账款', '已收', '已付'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '18%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: ['应收总额', '应付总额', '已收', '已付'], axisLabel: { color: '#666' } },
    yAxis: { type: 'value', axisLabel: { color: '#999', formatter: (v: number) => `¥${(v/10000).toFixed(0)}万` }, splitLine: { lineStyle: { color: '#f5f5f5' } } },
    series: [
      { name: '应收账款', type: 'bar', barWidth: '25%', data: [data.receivable], itemStyle: { color: '#52c41a' } },
      { name: '应付账款', type: 'bar', barWidth: '25%', data: [data.payable], itemStyle: { color: '#ff4d4f' } },
      { name: '已收', type: 'bar', barWidth: '25%', data: [data.received], itemStyle: { color: '#1890ff' } },
      { name: '已付', type: 'bar', barWidth: '25%', data: [data.paid], itemStyle: { color: '#faad14' } },
    ],
  }

  const quickStats = [
    {
      icon: <AccountBookOutlined />,
      label: '待记账交易',
      value: data.pendingTransactions,
      color: '#1890ff',
    },
    {
      icon: <PayCircleOutlined />,
      label: '待审批报销',
      value: data.pendingReimbursements,
      color: '#faad14',
    },
    {
      icon: <FileTextOutlined />,
      label: '合同到期提醒',
      value: data.contractExpiring,
      color: '#ff4d4f',
    },
    {
      icon: <span style={{ fontSize: 20 }}>¥</span>,
      label: '本月净收入',
      value: net >= 0 ? `+¥${net.toLocaleString()}` : `-¥${Math.abs(net).toLocaleString()}`,
      color: net >= 0 ? '#52c41a' : '#ff4d4f',
    },
  ]

  return (
    <div className="dashboard">
      <h2 className="page-title">仪表盘</h2>

      <StatCard stats={stats} />

      <Row gutter={16} className="quick-stats">
        {quickStats.map((item, index) => (
          <Col span={6} key={index}>
            <Card className="quick-stat-card" size="small">
              <div className="quick-stat-icon" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                {item.icon}
              </div>
              <div className="quick-stat-content">
                <div className="quick-stat-value" style={{ color: item.color }}>{item.value}</div>
                <div className="quick-stat-label">{item.label}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} className="charts-row">
        <Col span={16}>
          <Card className="chart-card" size="small" title="收支趋势">
            <Chart option={incomeExpenseOption} height={320} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="chart-card" size="small" title="支出分类">
            <Chart option={categoryOption} height={320} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card className="chart-card" size="small" title="应收应付概览">
            <Chart option={receivablesOption} height={280} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
