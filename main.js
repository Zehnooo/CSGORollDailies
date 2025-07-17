const { app, BrowserWindow, ipcMain } = require("electron");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const os = require("os");
const Store = require("electron-store");
const keytar = require("keytar");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);
const store = new Store();

puppeteer.use(StealthPlugin());

let mainWindow;

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

  mainWindow.webContents.on("did-finish-load", () => {
    (async () => {
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
    })();
  });
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

// --- Step 2: When user clicks 'Run Bot' ---
ipcMain.on("run-bot", async (event, settings) => {
  mainWindow.webContents.send("show-gallery");
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

    riskPercent = userSettings.risk;

    const riskMap = {
      5: 0.0,
      10: 0.17,
      20: 0.34,
      25: 0.51,
      40: 0.68,
      50: 0.85,
      60: 1.0,
    };

    const riskNormalized = riskMap[userSettings.risk];

    const slider = await page.$(".mdc-slider");

    await slider.evaluate((el) =>
      el.scrollIntoView({ behavior: "instant", block: "center" })
    );

    const box = await slider.boundingBox();

    if (box) {
      const { x, y, width, height } = box;

      const riskMap = {
        5: 0.0,
        10: 0.17,
        20: 0.34,
        25: 0.51,
        40: 0.68,
        50: 0.85,
        60: 1.0,
      };

      const riskNormalized = riskMap[userSettings.risk];
      const buffer = 5;

      const startX = x + buffer;
      const targetX = x + buffer + (width - buffer * 2) * riskNormalized;
      const centerY = y + height / 2;

      await page.mouse.move(0, 0); // <-- prevents selection behavior
      await page.mouse.move(startX, centerY);
      await page.mouse.down();
      await page.mouse.move(targetX, centerY, { steps: 20 });
      await page.mouse.up();

      console.log(`Slider set to ${userSettings.risk}%`);
    } else {
      console.error("Slider bounding box not found.");
    }

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
