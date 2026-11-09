const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('codeTypeDesktop', Object.freeze({ platform: process.platform, isDesktop: true, notifyPracticeComplete: (result) => ipcRenderer.invoke('notifications:practice-completed', result) }));
