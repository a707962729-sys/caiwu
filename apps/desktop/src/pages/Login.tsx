import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores'
import { authApi } from '../api'
import { useNavigate } from 'react-router-dom'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await authApi.login(values)
      login(result.user, result.token)
      message.success('登录成功')
      navigate('/')
    } catch (error) {
      // 错误已在请求拦截器中处理
      console.error('Login failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="login-logo">
            <img src="/icon.svg" alt="Logo" />
          </div>
          <h1>财务管家</h1>
          <p>智能财务管理解决方案</p>
        </div>
        <Form form={form} onFinish={handleSubmit} className="login-form" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div className="login-footer">
          <p>测试账号: admin / admin123</p>
        </div>
      </div>
    </div>
  )
}

export default Login