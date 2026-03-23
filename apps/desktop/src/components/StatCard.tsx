import { Card, Statistic, Row, Col } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import './StatCard.css'

interface StatItem {
  title: string
  value: number
  prefix?: React.ReactNode
  suffix?: string
  precision?: number
  trend?: 'up' | 'down'
  trendValue?: string
  color?: string
}

interface StatCardProps {
  stats: StatItem[]
  loading?: boolean
}

const StatCard = ({ stats, loading }: StatCardProps) => {
  return (
    <Row gutter={16}>
      {stats.map((stat, index) => (
        <Col span={24 / Math.min(stats.length, 4)} key={index}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title={stat.title}
              value={stat.value}
              precision={stat.precision ?? 2}
              valueStyle={{ color: stat.color || '#333' }}
              prefix={stat.prefix}
              suffix={stat.suffix}
            />
            {stat.trend && (
              <div className={`stat-trend ${stat.trend}`}>
                {stat.trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                <span>{stat.trendValue}</span>
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  )
}

export default StatCard