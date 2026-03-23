import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 主窗口引用
let mainWindow = null;
// API 服务器实例
let apiServer = null;
// 判断是否开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
// 获取 API 端口
const API_PORT = parseInt(process.env.CAIWU_API_PORT || '3000');
// 启动 API 服务（直接 require，使用 Electron 内置的 Node.js 运行时）
async function startApiServer() {
    return new Promise((resolve, reject) => {
        try {
            const dbPath = isDev
                ? path.join(__dirname, '../../../data/caiwu.db')
                : path.join(app.getPath('userData'), 'data/caiwu.db');
            // 确保 data 目录存在
            const fs = require('fs');
            const dataDir = path.dirname(dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            // 设置环境变量
            process.env.PORT = String(API_PORT);
            process.env.DATABASE_PATH = dbPath;
            process.env.NODE_ENV = 'production';
            console.log('Starting API server...');
            console.log('DB path:', dbPath);
            // 动态 require API 入口
            const apiPath = isDev
                ? path.join(__dirname, '../../../services/api/src/index.js')
                : path.join(process.resourcesPath, 'api/src/index.js');
            console.log('API path:', apiPath);
            // 清除缓存确保重新加载
            delete require.cache[require.resolve(apiPath)];
            const { startServer } = require(apiPath);
            // 启动服务器
            startServer().then(() => {
                console.log(`API server started on port ${API_PORT}`);
                resolve(API_PORT);
            }).catch((err) => {
                console.error('Failed to start API server:', err);
                reject(err);
            });
        }
        catch (err) {
            console.error('Failed to load API module:', err);
            reject(err);
        }
    });
}
// 停止 API 服务
function stopApiServer() {
    console.log('Stopping API server...');
    apiServer = null;
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
    });
    // 窗口准备就绪时显示
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    // 加载页面
    if (isDev) {
        mainWindow.loadURL('http://localhost:5174');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    // 外部链接用浏览器打开
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// 窗口控制 IPC
ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
});
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    }
    else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window-close', () => {
    mainWindow?.close();
});
// 应用就绪
app.whenReady().then(async () => {
    try {
        // 启动 API 服务
        await startApiServer();
        console.log(`API server started on port ${API_PORT}`);
    }
    catch (err) {
        console.error('Failed to start API server:', err);
        dialog.showErrorBox('启动失败', 'API 服务启动失败，应用可能无法正常工作。');
    }
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    // 自动更新检查（生产环境）
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});
// 所有窗口关闭时退出
app.on('window-all-closed', () => {
    stopApiServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// 应用退出前清理
app.on('before-quit', () => {
    stopApiServer();
});
// 自动更新事件
autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
});
autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
});
ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});
ipcMain.on('check-update', async () => {
    try {
        await autoUpdater.checkForUpdates();
    }
    catch (error) {
        console.error('Update check failed:', error);
    }
});
//# sourceMappingURL=main.js.map