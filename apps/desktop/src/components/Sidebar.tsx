import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  BookOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  AuditOutlined,
  AccountBookOutlined,
  BarChartOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useSidebarStore, useAuthStore } from '../stores'
import './Sidebar.css'

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/accounting', icon: <BookOutlined />, label: '记账管理' },
  { key: '/contracts', icon: <FileTextOutlined />, label: '合同管理' },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单/项目' },
  { key: '/expenses', icon: <AuditOutlined />, label: '报销管理' },
  { key: '/receivables', icon: <AccountBookOutlined />, label: '应收应付' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报表中心' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
]

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { collapsed, toggle } = useSidebarStore()
  const { user, logout } = useAuthStore()

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-toggle" onClick={toggle}>
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <div
            key={item.key}
            className={`menu-item ${location.pathname === item.key ? 'active' : ''}`}
            onClick={() => handleMenuClick(item.key)}
            title={item.label}
          >
            <span className="menu-icon">{item.icon}</span>
            {!collapsed && <span className="menu-label">{item.label}</span>}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="user-info">
            <div className="user-avatar">
              {user?.real_name?.charAt(0) || 'U'}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.real_name || '用户'}</div>
              <div className="user-role">
                {user?.role === 'boss' ? '老板' : user?.role === 'accountant' ? '会计' : '员工'}
              </div>
            </div>
          </div>
        )}
        {!collapsed && (
          <button className="logout-btn" onClick={handleLogout}>
            退出登录
          </button>
        )}
      </div>
    </div>
  )
}

export default Sidebar