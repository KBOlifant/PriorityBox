const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const { googleAuth } = require("./google-auth");
const { autoUpdater } = require("electron-updater");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Fixed origin so OAuth redirect URIs (Google / Microsoft) can be registered.
const PORT = 38417;
const ORIGIN = `http://localhost:${PORT}`;
const OUT_DIR = path.join(__dirname, "..", "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const target = path.normalize(path.join(OUT_DIR, clean));
  if (!target.startsWith(OUT_DIR)) return null;
  const candidates = [target, target + ".html", path.join(target, "index.html")];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const file = resolveFile(req.url || "/") || path.join(OUT_DIR, "404.html");
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(file.endsWith("404.html") ? 404 : 200, {
          "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        });
        res.end(data);
      });
    });
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "PriorityBoxLogo.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // Keep the app origin in-window; send everything else to the browser,
  // except auth popups which need to stay inside Electron.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(ORIGIN)) return { action: "allow" };
    const host = new URL(target).hostname;
    const authHosts = [
      "accounts.google.com",
      "login.microsoftonline.com",
      "login.live.com",
      "firebaseapp.com",
    ];
    if (authHosts.some((h) => host === h || host.endsWith("." + h))) {
      return { action: "allow" };
    }
    shell.openExternal(target);
    return { action: "deny" };
  });

  win.loadURL(url);
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      title: "Update ready",
      message: `PriorityBox ${info.version} has been downloaded.`,
      detail: "Restart to apply the update.",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", (e) => console.error("Auto-update error:", e));
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

ipcMain.handle("google-auth", (_e, opts) => googleAuth(opts));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    const devUrl = process.env.ELECTRON_DEV_URL;
    if (devUrl) {
      createWindow(devUrl);
    } else {
      await startServer();
      createWindow(ORIGIN);
    }
    setupAutoUpdates();
  });
  app.on("window-all-closed", () => app.quit());
}
