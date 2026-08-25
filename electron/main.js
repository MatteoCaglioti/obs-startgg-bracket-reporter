const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

const API_URL = "http://127.0.0.1:3001";
const WEB_DEV_URL = "http://127.0.0.1:5173";

function waitForServer(url, retries = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      http
        .get(url, (response) => {
          response.resume();
          resolve();
        })
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
  process.env.IS_PROD = "true";

  const serverPath = path.join(
    process.resourcesPath,
    "app.asar",
    "api",
    "dist",
    "server.js",
  );
  require(serverPath);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    autoHideMenuBar: true,
  });

  if (app.isPackaged) {
    win.loadURL(API_URL);
  } else {
    win.loadURL(WEB_DEV_URL);
  }
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    startServer();
  }

  await waitForServer(`${API_URL}/config`);
  if (!app.isPackaged) {
    await waitForServer(WEB_DEV_URL);
  }

  createWindow();
}).catch((error) => {
  console.error("Failed to launch application:", error);
  app.quit();
});

app.on("window-all-closed", () => {
  app.quit();
});
