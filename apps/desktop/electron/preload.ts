import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // 自动更新
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback)
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback)
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  checkUpdate: () => ipcRenderer.send('check-update'),

  // 移除监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})

// TypeScript 类型定义
export interface ElectronAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  onUpdateAvailable: (callback: () => void) => void
  onUpdateDownloaded: (callback: () => void) => void
  installUpdate: () => void
  checkUpdate: () => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}