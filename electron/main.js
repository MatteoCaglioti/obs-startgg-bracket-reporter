const { app, BrowserWindow } = require("electron");
const path = require("path");

function startServer() {
  process.env.IS_PROD = app.isPackaged ? "true" : "false";

  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "api", "dist", "server.js")
    : path.join(__dirname, "../api/dist/server.js");

  require(serverPath);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    autoHideMenuBar: true,
  });

  if (app.isPackaged) {
    win.loadFile(path.join(process.resourcesPath, "app.asar", "web", "dist", "index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});