const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    autoHideMenuBar: true
  });

  win.loadURL("http://localhost:3001");
}

app.whenReady().then(() => {
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "api", "dist", "server.js")
    : path.join(__dirname, "../api/dist/server.js");

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: app.isPackaged
      ? path.join(process.resourcesPath, "app.asar")
      : path.join(__dirname, ".."),
    stdio: "ignore",
    shell: false
  });

  setTimeout(createWindow, 1500);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});