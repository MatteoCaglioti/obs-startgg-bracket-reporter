const { app, BrowserWindow } = require("electron");
const path = require("path");

function startServer() {
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
    icon: path.join(__dirname, "../build/icon.ico"),
  });

  win.loadURL("http://localhost:3001");
}

app.whenReady().then(() => {
  startServer();

  setTimeout(() => {
    createWindow();
  }, 1000);
});

app.on("window-all-closed", () => {
  app.quit();
});