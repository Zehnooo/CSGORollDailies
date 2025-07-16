const { app, BrowserWindow, ipcMain } = require("electron");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");

puppeteer.use(StealthPlugin());

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

// --- Store user credentials/settings ---
let userSettings = {
  email: null,
  password: null,
  autoStash: false,
  risk: 50,
};

// --- Step 1: After user submits login form ---
ipcMain.on("credentials-entered", (event, credentials) => {
  userSettings.email = credentials.email;
  userSettings.password = credentials.password;
  mainWindow.webContents.send("show-settings");
});

// --- Step 2: When user clicks 'Run Bot' ---
ipcMain.on("run-bot", async (event, settings) => {
  try {
    userSettings.autoStash = settings.autoStash;
    userSettings.risk = settings.risk;

    // Launch browser
    const browser = await puppeteer.launch({ headless: false });
    const [page] = await browser.pages();

    // Step 2: Set realistic fingerprint
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    // Go to login page
    await page.goto("https://www.csgoroll.com/en/login", {
      waitUntil: "networkidle2",
    });

    // Step 3: Clear previous session (optional)
    await page.deleteCookie(...(await page.cookies()));
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Step 4: Dismiss cookie popup
    try {
      await page.waitForSelector(".cky-btn-reject", {
        timeout: 3000,
        visible: true,
      });
      await page.click(".cky-btn-reject");
      console.log("Cookie popup dismissed");
    } catch {
      console.log("No cookie popup shown");
    }

    // Step 5: Fill login form like a human
    await page.waitForSelector('input[formcontrolname="email"]', {
      visible: true,
    });
    await page.type('input[formcontrolname="email"]', userSettings.email, {
      delay: 100,
    });

    await page.waitForSelector('input[formcontrolname="password"]', {
      visible: true,
    });
    await page.type(
      'input[formcontrolname="password"]',
      userSettings.password,
      {
        delay: 100,
      }
    );

    await page.waitForSelector('button[type="submit"]', { visible: true });
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log("Login complete");

    await page.goto("https://www.csgoroll.com/cases/daily-free", {
      waitUntil: "networkidle2",
    });

    /* Don't want to open my cases yet

    const caseButtons = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".grid button")];
      return buttons
        .filter((btn) => !btn.disabled)
        .map((btn, index) => {
          return `.grid button:nth-of-type(${index + 1})`;
        });
    });
    console.log("Grid contents:\n", gridHTML);

    for (const button of caseButtons) {
      await page.click(button);
      await page.waitForTimeout(1000); // wait between case openings
    }
*/
    // TODO: Auto-stash and risk-based logic goes here

    // await browser.close();
  } catch (err) {
    console.error("Puppeteer run failed:", err);
  }
});
