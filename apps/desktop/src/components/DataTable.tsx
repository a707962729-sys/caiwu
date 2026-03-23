import { Table } from 'antd'
import type { TableProps } from 'antd'
import './DataTable.css'

interface DataTableProps<T> extends TableProps<T> {
  loading?: boolean
}

function DataTable<T extends Record<string, unknown>>({
  loading = false,
  ...props
}: DataTableProps<T>) {
  return (
    <div className="data-table-wrapper">
      <Table<T>
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          defaultPageSize: 10,
          ...props.pagination,
        }}
        scroll={{ x: 'max-content' }}
        {...props}
      />
    </div>
  )
}

export default DataTable