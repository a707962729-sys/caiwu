import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { fileURLToPath } from 'url'
import type http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 主窗口引用
let mainWindow: BrowserWindow | null = null

// API 服务器实例（Node.js http.Server）
let apiServer: http.Server | null = null

// 判断是否开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 获取 API 端口（生产默认 3001，开发默认 3000）
const API_PORT = parseInt(process.env.CAIWU_API_PORT || (isDev ? '3000' : '3001'))

// 检查 API 服务是否已经在运行
function isApiServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const http = require('http')
    const req = http.get(`http://localhost:${API_PORT}/api/health`, { timeout: 2000 }, (res: any) => {
      resolve(res.statusCode === 200 || res.statusCode === 401) // 401 means running but not authenticated
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

// 启动 API 服务
async function startApiServer(): Promise<void> {
  // 先检查是否已经运行
  const running = await isApiServerRunning()
  if (running) {
    console.log(`API server already running on port ${API_PORT}, skipping start`)
    return
  }

  return new Promise(async (resolve, reject) => {
    try {
      const dbPath = isDev
        ? path.join(__dirname, '../../../data/caiwu.db')
        : path.join(app.getPath('userData'), 'data/caiwu.db')

      // 确保 data 目录存在
      const fs = require('fs')
      const dataDir = path.dirname(dbPath)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      // 设置环境变量
      process.env.PORT = String(API_PORT)
      process.env.DATABASE_PATH = dbPath
      process.env.NODE_ENV = 'production'

      console.log('[Caiwu Desktop] Starting API server...')
      console.log('[Caiwu Desktop] DB path:', dbPath)
      console.log('[Caiwu Desktop] API port:', API_PORT)

      // API 入口路径
      const apiPath = isDev
        ? path.join(__dirname, '../../../services/api/src/index.js')
        : path.join(process.resourcesPath, 'api/src/index.js')

      console.log('[Caiwu Desktop] API path:', apiPath)

      // 清除缓存确保重新加载
      const resolvedApi = require.resolve(apiPath)
      delete require.cache[resolvedApi]

      // 动态加载 API 模块
      // API 服务会调用 app.listen()，我们劫持它来获取 server 实例
      const apiModule = require(resolvedApi)
      const apiApp = apiModule.app

      // 启动 HTTP 服务器，劫持 server 实例
      const server = apiApp.listen(API_PORT, () => {
        console.log(`[Caiwu Desktop] API server started on port ${API_PORT}`)
        resolve()
      })

      if (!server) {
        reject(new Error('Failed to create HTTP server'))
        return
      }

      apiServer = server
      server.on('error', (err: NodeJS.ErrnoException) => {
        console.error('[Caiwu Desktop] API server error:', err)
        reject(err)
      })

    } catch (err) {
      console.error('[Caiwu Desktop] Failed to load API module:', err)
      reject(err)
    }
  })
}

// 停止 API 服务
async function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!apiServer) {
      console.log('[Caiwu Desktop] No API server to stop')
      resolve()
      return
    }

    console.log('[Caiwu Desktop] Stopping API server...')
    apiServer.close((err) => {
      if (err) {
        console.error('[Caiwu Desktop] Error stopping API server:', err)
      } else {
        console.log('[Caiwu Desktop] API server stopped')
      }
      apiServer = null
      resolve()
    })

    // 超时保护
    setTimeout(() => {
      if (apiServer) {
        console.warn('[Caiwu Desktop] API server stop timeout, forcing close')
        apiServer.close()
        apiServer = null
      }
      resolve()
    }, 5000)
  })
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false, // 无边框窗口
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false // 先隐藏，加载完成后再显示
  })

  // 窗口准备就绪时显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 外部链接用浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 窗口控制 IPC
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

// 应用就绪
app.whenReady().then(async () => {
  console.log('[Caiwu Desktop] App ready, starting...')

  // 生产模式：自动启动 API 服务
  // 开发模式：若未设置 SKIP_BUILTIN_API 也启动
  const shouldStartApi = !isDev || (isDev && process.env.SKIP_BUILTIN_API !== 'true')

  if (shouldStartApi) {
    try {
      await startApiServer()
    } catch (err) {
      console.error('[Caiwu Desktop] Failed to start API server:', err)
      dialog.showErrorBox('启动失败', 'API 服务启动失败，应用可能无法正常工作。')
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // 自动更新检查（生产环境）
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', async () => {
  console.log('[Caiwu Desktop] All windows closed')
  await stopApiServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前清理
app.on('before-quit', async (e) => {
  console.log('[Caiwu Desktop] App quitting...')
  // 阻止立即退出，等待服务停止
  e.preventDefault()
  await stopApiServer()
  app.exit(0)
})

// 自动更新事件
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded')
})

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.on('check-update', async () => {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    console.error('Update check failed:', error)
  }
})
