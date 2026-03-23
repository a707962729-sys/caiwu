// Electron API 类型声明
export interface ElectronAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  onUpdateAvailable: (callback: () => void) => void
  onUpdateDownloaded: (callback: () => void) => void
  installUpdate: () => void
  checkUpdate: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}