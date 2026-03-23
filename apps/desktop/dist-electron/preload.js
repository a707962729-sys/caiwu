import { contextBridge, ipcRenderer } from 'electron';
// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    // 自动更新
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', callback);
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', callback);
    },
    installUpdate: () => ipcRenderer.send('install-update'),
    checkUpdate: () => ipcRenderer.send('check-update'),
    // 移除监听器
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
//# sourceMappingURL=preload.js.map