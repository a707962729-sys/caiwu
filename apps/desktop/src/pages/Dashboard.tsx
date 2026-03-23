import { Row, Col, Card } from 'antd'
import {
  AccountBookOutlined,
  PayCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import Chart from '../components/Chart'
import StatCard from '../components/StatCard'
import type { EChartsOption } from 'echarts'
import './Dashboard.css'

const Dashboard = () => {
  const stats = [
    {
      title: '本月收入',
      value: 128500,
      prefix: '¥',
      trend: 'up' as const,
      trendValue: '12.5%',
      color: '#52c41a',
    },
    {
      title: '本月支出',
      value: 89600,
      prefix: '¥',
      trend: 'down' as const,
      trendValue: '8.2%',
      color: '#ff4d4f',
    },
    {
      title: '应收账款',
      value: 45000,
      prefix: '¥',
      trend: 'up' as const,
      trendValue: '5.3%',
      color: '#faad14',
    },
    {
      title: '应付账款',
      value: 23800,
      prefix: '¥',
      trend: 'down' as const,
      trendValue: '2.1%',
      color: '#1890ff',
    },
  ]

  const incomeExpenseOption: EChartsOption = {
    title: { text: '收支趋势', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'], bottom: 0 },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月'],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: [98000, 105000, 112000, 118000, 125000, 128500],
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: [72000, 78000, 82000, 85000, 88000, 89600],
        itemStyle: { color: '#ff4d4f' },
      },
    ],
  }

  const categoryOption: EChartsOption = {
    title: { text: '支出分类', left: 'center' },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 18, fontWeight: 'bold' },
        },
        labelLine: { show: false },
        data: [
          { value: 35000, name: '人员工资', itemStyle: { color: '#1890ff' } },
          { value: 25000, name: '运营成本', itemStyle: { color: '#52c41a' } },
          { value: 18000, name: '采购支出', itemStyle: { color: '#faad14' } },
          { value: 8000, name: '税费', itemStyle: { color: '#722ed1' } },
          { value: 3600, name: '其他', itemStyle: { color: '#eb2f96' } },
        ],
      },
    ],
  }

  const quickStats = [
    { icon: <AccountBookOutlined />, label: '待记账', value: 12, color: '#1890ff' },
    { icon: <PayCircleOutlined />, label: '待审批', value: 5, color: '#faad14' },
    { icon: <FileTextOutlined />, label: '合同到期', value: 3, color: '#ff4d4f' },
    { icon: <TeamOutlined />, label: '本月客户', value: 28, color: '#52c41a' },
  ]

  return (
    <div className="dashboard">
      <h2 className="page-title">仪表盘</h2>

      <StatCard stats={stats} />

      <Row gutter={16} className="quick-stats">
        {quickStats.map((item, index) => (
          <Col span={6} key={index}>
            <Card className="quick-stat-card">
              <div className="quick-stat-icon" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                {item.icon}
              </div>
              <div className="quick-stat-content">
                <div className="quick-stat-value">{item.value}</div>
                <div className="quick-stat-label">{item.label}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} className="charts-row">
        <Col span={16}>
          <Card className="chart-card">
            <Chart option={incomeExpenseOption} height={350} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="chart-card">
            <Chart option={categoryOption} height={350} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard