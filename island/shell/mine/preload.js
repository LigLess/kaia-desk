const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('island', {
  on: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  cur: (fn) => ipcRenderer.on('cur', (_e, p) => fn(p)),
  hover: (on) => ipcRenderer.send('hover', on),
  drag: (d) => ipcRenderer.send('drag', d),
  act: (a) => ipcRenderer.invoke('act', a),
});
