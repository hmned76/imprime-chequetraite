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
  },
  importScan: (abbr) => {
    return ipcRenderer.invoke('import-scan', abbr);
  },
  getChequeScan: (abbr) => {
    return ipcRenderer.invoke('get-cheque-scan', abbr);
  },
  removeScan: (abbr) => {
    return ipcRenderer.invoke('remove-scan', abbr);
  }
});