import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'
import './TitleBar.css'

const TitleBar = () => {
  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow()
  }

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow()
  }

  const handleClose = () => {
    window.electronAPI?.closeWindow()
  }

  return (
    <div className="title-bar drag-region">
      <div className="title-bar-content no-drag">
        <div className="title-bar-logo">
          <img src="/icon.svg" alt="Logo" className="logo-icon" />
          <span className="logo-text">财务管家</span>
        </div>
      </div>
      <div className="title-bar-actions no-drag">
        <button className="title-btn minimize" onClick={handleMinimize}>
          <MinusOutlined />
        </button>
        <button className="title-btn maximize" onClick={handleMaximize}>
          <BorderOutlined />
        </button>
        <button className="title-btn close" onClick={handleClose}>
          <CloseOutlined />
        </button>
      </div>
    </div>
  )
}

export default TitleBar