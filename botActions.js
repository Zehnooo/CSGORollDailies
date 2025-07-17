const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");

dayjs.extend(isoWeek);
puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchBrowser() {
  const browser = await puppeteer.launch({ headless: false });
  const [page] = await browser.pages();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1280 });

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

  try {
    await page.waitForSelector(".grid .card-wrapper", {
      visible: true,
      timeout: 5000,
    });
    await delay(1000);
    console.log("Case grid reloaded.");
  } catch (e) {
    console.warn("Timeout waiting for case grid to reload. Continuing anyway.");
  }
}

async function openDailyCases(page) {
  while (true) {
    await waitForGridReady(page);
    const caseLinks = await getUnlockedCaseLinks(page);

    if (caseLinks.length === 0) {
      console.log("✅ All available cases opened.");
      break;
    }

    const caseUrl = caseLinks[0];
    console.log(`🧭 Navigating to: ${caseUrl}`);
    try {
      await page.waitForFunction(
        () => {
          const btn = document.querySelector(
            'button[data-test="open-box-button"]'
          );
          return btn && !btn.disabled;
        },
        { timeout: 7000 }
      );

      console.log(`🎁 Clicking 'Open 1 time'`);
      await page.click('button[data-test="open-box-button"]');

      // Wait for item image (see Fix 3 from previous message)
      await page.waitForSelector("img.item-preview", {
        visible: true,
        timeout: 10000,
      });

      await captureScreenshots(page);
    } catch (err) {
      console.warn("⚠️ Failed to open case or wait for reward:", err.message);
    }

    const openBtnSelector = 'button[data-test="open-box-button"]';
    try {
      await page.waitForSelector(openBtnSelector, {
        visible: true,
        timeout: 5000,
      });
      console.log(`🎁 Clicking 'Open 1 time'`);
      await page.click(openBtnSelector);

      try {
        await page.waitForFunction(
          () => {
            const previewImg = document.querySelector("img.item-preview");
            return (
              previewImg && previewImg.complete && previewImg.naturalHeight > 0
            );
          },
          { timeout: 10000 }
        );
      } catch (e) {
        console.warn("⚠️ No reward image detected after opening case.");
      }

      await captureScreenshots(page);
    } catch (err) {
      console.warn("⚠️ Failed to open case:", err.message);
    }

    await page.goto("https://www.csgoroll.com/cases/daily-free", {
      waitUntil: "networkidle2",
    });

    await waitForGridReady(page);

    await delay(1500);
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
  console.log(`📸 Saved screenshot: ${screenshotFile}`);
}

async function getUnlockedCaseLinks(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".box"))
      .filter((box) => {
        const openBtn = box.querySelector('button[data-test="open-case"]');
        const freeText = box.innerText.includes("FREE");

        if (!openBtn || openBtn.disabled) return false;
        if (!freeText) return false;

        // Make sure it's not a countdown or "Lvl X" requirement
        const btnText = openBtn.innerText.toLowerCase();
        if (btnText.includes("lvl") || /\d+[smhd]/.test(btnText)) return false;

        return true;
      })
      .map((box) => {
        const link = box.querySelector("a.img-container");
        return link?.href;
      })
      .filter(Boolean);
  });
}

async function waitForGridReady(page) {
  try {
    await page.waitForFunction(
      () => {
        const buttons = document.querySelectorAll(
          'button[data-test="open-case"]'
        );
        return Array.from(buttons).some((btn) => !btn.disabled);
      },
      { timeout: 7000 }
    );

    const count = await page.$$eval(
      'button[data-test="open-case"]:not([disabled])',
      (btns) => btns.length
    );
    console.log(`🟢 Grid ready with ${count} unlocked case(s)`);
  } catch (err) {
    console.warn("⚠️ Grid not ready in time:", err.message);
  }
}
module.exports = {
  launchBrowser,
  loginToCSGORoll,
  navigateToDailyCases,
  setRiskSlider,
  openDailyCases,
  waitForGridReady,
};
