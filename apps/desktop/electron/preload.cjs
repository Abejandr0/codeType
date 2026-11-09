const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('codeTypeDesktop', Object.freeze({ platform: process.platform, isDesktop: true }));
