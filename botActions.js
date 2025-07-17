const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");

dayjs.extend(isoWeek);

puppeteer.use(StealthPlugin());

async function launchBrowser() {
  const browser = await puppeteer.launch({ headless: false });
  const [page] = await browser.pages();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });

  return { browser, page };
}

async function loginToCSGORoll(page, email, password) {
  await page.goto("https://www.csgoroll.com/en/login", {
    waitUntil: "networkidle2",
  });

  await page.deleteCookie(...(await page.cookies()));
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  try {
    await page.waitForSelector(".cky-btn-reject", { timeout: 3000 });
    await page.click(".cky-btn-reject");
    console.log("Cookie popup dismissed");
  } catch {
    console.log("No cookie popup shown");
  }

  await page.waitForSelector('input[formcontrolname="email"]');
  await page.type('input[formcontrolname="email"]', email, { delay: 100 });

  await page.waitForSelector('input[formcontrolname="password"]');
  await page.type('input[formcontrolname="password"]', password, {
    delay: 100,
  });

  await page.waitForSelector('button[type="submit"]');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("Login complete");
}

async function navigateToDailyCases(page) {
  await page.goto("https://www.csgoroll.com/cases/daily-free", {
    waitUntil: "networkidle2",
  });
}

async function setRiskSlider(page, risk) {
  const riskMap = {
    5: 0.0,
    10: 0.17,
    20: 0.34,
    25: 0.51,
    40: 0.68,
    50: 0.85,
    60: 1.0,
  };

  const normalized = riskMap[risk];
  const slider = await page.$(".mdc-slider");
  await slider.evaluate((el) =>
    el.scrollIntoView({ behavior: "instant", block: "center" })
  );

  const box = await slider.boundingBox();
  if (!box) return console.error("Slider not found.");

  const buffer = 5;
  const startX = box.x + buffer;
  const targetX = startX + (box.width - buffer * 2) * normalized;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(0, 0);
  await page.mouse.move(startX, centerY);
  await page.mouse.down();
  await page.mouse.move(targetX, centerY, { steps: 20 });
  await page.mouse.up();

  console.log(`Slider set to ${risk}%`);
}

async function openDailyCases(page) {
  try {
    const caseSelectors = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".grid button")];
      return buttons
        .filter((btn) => !btn.disabled)
        .map((btn, index) => `.grid button:nth-of-type(${index + 1})`);
    });

    console.log(`Found ${caseSelectors.length} cases to open.`);

    for (const selector of caseSelectors) {
      try {
        await page.click(selector);
        console.log(`Opened case: ${selector}`);
        await page.waitForTimeout(1000);
        await captureScreenshots(page);
      } catch (err) {
        console.warn(`Failed to click ${selector}`, err);
      }
    }
  } catch (err) {
    console.error("Failed to open daily cases:", err);
  }
}

async function captureScreenshots(page) {
  const currentWeek = dayjs().isoWeek();
  const currentYear = dayjs().year();
  const folderName = `${currentYear}-W${currentWeek}`;
  const folderPath = path.join(__dirname, "screenshots", folderName);

  const screenshotsRoot = path.join(__dirname, "screenshots");
  fs.readdirSync(screenshotsRoot).forEach((dir) => {
    const fullPath = path.join(screenshotsRoot, dir);
    if (dir !== folderName && fs.lstatSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`Old screenshot folder deleted: ${dir}`);
    }
  });

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const screenshotFile = path.join(folderPath, `item-${Date.now()}.png`);
  await page.screenshot({ path: screenshotFile });
  console.log(`Saved screenshot: ${screenshotFile}`);
}

module.exports = {
  launchBrowser,
  loginToCSGORoll,
  navigateToDailyCases,
  setRiskSlider,
  openDailyCases,
};
