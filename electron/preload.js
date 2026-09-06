const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printHTML: (payload) => {
    ipcRenderer.send('print-html', payload || {});
  },
  onPrintResult: (callback) => {
    const listener = (_e, msg) => callback && callback(msg);
    ipcRenderer.on('print-result', listener);
    return () => ipcRenderer.removeListener('print-result', listener);
  }
});