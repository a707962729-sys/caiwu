import { Outlet } from 'react-router-dom'
import TitleBar from '../components/TitleBar'
import Sidebar from '../components/Sidebar'
import { useSidebarStore } from '../stores'
import './MainLayout.css'

const MainLayout = () => {
  const { collapsed } = useSidebarStore()

  return (
    <div className="main-layout">
      <TitleBar />
      <div className="main-content">
        <Sidebar />
        <main className={`content-area ${collapsed ? 'sidebar-collapsed' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout