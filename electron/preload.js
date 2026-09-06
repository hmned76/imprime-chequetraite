const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printHTML: (payload) => {
    ipcRenderer.send('print-html', payload || {});
  },
  getPrinters: () => {
    return ipcRenderer.invoke('get-printers');
  },
  onPrintResult: (callback) => {
    const listener = (_e, msg) => callback && callback(msg);
    ipcRenderer.on('print-result', listener);
    return () => ipcRenderer.removeListener('print-result', listener);
  }
});