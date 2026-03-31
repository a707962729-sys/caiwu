"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 窗口控制
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
  closeWindow: () => electron.ipcRenderer.send("window-close"),
  // 自动更新
  onUpdateAvailable: (callback) => {
    electron.ipcRenderer.on("update-available", callback);
  },
  onUpdateDownloaded: (callback) => {
    electron.ipcRenderer.on("update-downloaded", callback);
  },
  installUpdate: () => electron.ipcRenderer.send("install-update"),
  checkUpdate: () => electron.ipcRenderer.send("check-update"),
  // 移除监听器
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  }
});
