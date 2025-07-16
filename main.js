const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, "renderer.js"),
      nodeIntegration: true, // optional if using preload
      contextIsolation: false, // optional if using nodeIntegration
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
