const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  googleAuth: (opts) => ipcRenderer.invoke("google-auth", opts),
});
