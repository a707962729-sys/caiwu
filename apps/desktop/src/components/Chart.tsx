import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface ChartProps {
  option: EChartsOption
  height?: number | string
  loading?: boolean
  style?: React.CSSProperties
}

const Chart = ({ option, height = 300, loading, style }: ChartProps) => {
  const defaultOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    ...option,
  }

  return (
    <ReactECharts
      option={defaultOption}
      style={{ height, width: '100%', ...style }}
      showLoading={loading}
      opts={{ renderer: 'svg' }}
    />
  )
}

export default Chart