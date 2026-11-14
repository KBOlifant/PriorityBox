const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  googleAuth: (opts) => ipcRenderer.invoke("google-auth", opts),
  // Redis lookups run in the main process; see electron/redis-cache.js.
  cache: {
    getMany: (keys) => ipcRenderer.invoke("cache:get-many", keys),
    set: (key, json, ttlSeconds) => ipcRenderer.invoke("cache:set", key, json, ttlSeconds),
    del: (keys) => ipcRenderer.invoke("cache:del", keys),
  },
});
