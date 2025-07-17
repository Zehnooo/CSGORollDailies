const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const keytar = require("keytar");

const {
  launchBrowser,
  loginToCSGORoll,
  navigateToDailyCases,
  setRiskSlider,
  openDailyCases,
  waitForGridReady,
  // eventually also: captureScreenshots, cleanOldScreenshots
} = require("./botActions");

const store = new Store();

let mainWindow;

const userSettings = {
  email: null,
  password: null,
  autoStash: false,
  risk: 50,
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");

  mainWindow.webContents.on("did-finish-load", async () => {
    const savedEmail = store.get("email");
    if (savedEmail) {
      try {
        const savedPassword = await keytar.getPassword(
          "CSGORollBot",
          savedEmail
        );
        if (savedPassword) {
          mainWindow.webContents.send("load-credentials", {
            email: savedEmail,
            password: savedPassword,
          });
        }
      } catch (err) {
        console.error("Failed to load credentials:", err);
      }
    }
  });
}

app.whenReady().then(createWindow);

// Handle credentials entered from UI
ipcMain.on(
  "credentials-entered",
  async (event, { email, password, remember }) => {
    userSettings.email = email;
    userSettings.password = password;

    try {
      if (remember) {
        store.set("email", email);
        await keytar.setPassword("CSGORollBot", email, password);
        console.log("Credentials saved.");
      } else {
        store.delete("email");
        await keytar.deletePassword("CSGORollBot", email);
        console.log("Credentials cleared.");
      }
    } catch (err) {
      console.error("Failed to save/clear credentials:", err);
    }

    mainWindow.webContents.send("show-settings");
  }
);

// Handle Run Bot from settings page
ipcMain.on("run-bot", async (event, settings) => {
  mainWindow.webContents.send("show-gallery");

  try {
    userSettings.autoStash = settings.autoStash;
    userSettings.risk = settings.risk;

    const { browser, page } = await launchBrowser();
    await loginToCSGORoll(page, userSettings.email, userSettings.password);
    await navigateToDailyCases(page);
    await setRiskSlider(page, userSettings.risk);
    await waitForGridReady(page);
    await openDailyCases(page);

    // Next steps:
    // await captureScreenshots(page);
    // await cleanOldScreenshots();
    // if (userSettings.autoStash) await stashItems(page);
    // await browser.close();
  } catch (err) {
    console.error("Puppeteer run failed:", err);
  }
});

// Exit gracefully
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
