const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

function waitForServer(url, retries = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      http
        .get(url, () => resolve())
        .on("error", () => {
          attempts++;

          if (attempts >= retries) {
            reject(new Error("Server did not start"));
          } else {
            setTimeout(check, 200);
          }
        });
    };

    check();
  });
}

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
    win.loadFile(
      path.join(process.resourcesPath, "app.asar", "web", "dist", "index.html"),
    );
  } else {
    win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(async () => {
  startServer();

  await waitForServer("http://localhost:3001/config");

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
