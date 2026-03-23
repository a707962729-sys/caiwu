import { Form, Input, Select, DatePicker, InputNumber, Button, Space } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import './SearchForm.css'

interface Field {
  name: string
  label: string
  type: 'input' | 'select' | 'date' | 'number'
  placeholder?: string
  options?: { label: string; value: string | number }[]
  span?: number
}

interface SearchFormProps {
  fields: Field[]
  onSearch: (values: Record<string, unknown>) => void
  onReset?: () => void
  form?: FormInstance
  loading?: boolean
}

const SearchForm = ({ fields, onSearch, onReset, form, loading }: SearchFormProps) => {
  const [internalForm] = Form.useForm()
  const formInstance = form || internalForm

  const handleReset = () => {
    formInstance.resetFields()
    onReset?.()
  }

  return (
    <div className="search-form-wrapper">
      <Form
        form={formInstance}
        layout="inline"
        onFinish={onSearch}
        className="search-form"
      >
        {fields.map((field) => (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            {field.type === 'input' && (
              <Input placeholder={field.placeholder || `请输入${field.label}`} allowClear />
            )}
            {field.type === 'select' && (
              <Select
                placeholder={field.placeholder || `请选择${field.label}`}
                options={field.options}
                allowClear
                style={{ width: 150 }}
              />
            )}
            {field.type === 'date' && (
              <DatePicker placeholder={field.placeholder || `请选择${field.label}`} />
            )}
            {field.type === 'number' && (
              <InputNumber placeholder={field.placeholder || `请输入${field.label}`} />
            )}
          </Form.Item>
        ))}
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}

export default SearchForm