const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8000';
const EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const OUTPUT_DIR = process.env.SCREENSHOT_DIR || 'screenshots';

if (!EMAIL || !PASSWORD) {
  throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
}

async function waitForSettled(page, ms = 400) {
  await page.waitForTimeout(ms);
}

async function clickAndCapture(page, action, file) {
  console.log(`capturing ${file}`);
  await action();
  await waitForSettled(page, 600);
  await page.screenshot({ path: `${OUTPUT_DIR}/${file}`, fullPage: true });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.setDefaultTimeout(15000);

  console.log('opening app');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  console.log('loaded url', page.url());
  console.log('page title', await page.title());
  console.log('page snippet', (await page.content()).slice(0, 300));
  await page.waitForSelector('#login-email', { state: 'attached' });
  await page.waitForSelector('#login-password', { state: 'attached' });
  await page.waitForSelector('#login-btn', { state: 'attached' });
  console.log('submitting login');
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('#login-btn');
  await page.waitForFunction(() => {
    const el = document.querySelector('#auth-overlay');
    return !!el && !el.classList.contains('show');
  });
  await waitForSettled(page, 800);
  console.log('login complete');

  const topLevelViews = [
    ['pipeline', 'view-pipeline.png'],
    ['companion', 'view-companion.png'],
    ['thumbnail', 'view-thumbnail-studio.png'],
    ['marketing', 'view-marketing-campaigns.png'],
    ['dashboard', 'view-dashboard.png'],
    ['audience', 'view-audience-browser.png'],
    ['history', 'view-history.png'],
    ['ideas', 'view-ideas.png'],
    ['settings', 'view-settings.png'],
  ];

  for (const [mode, file] of topLevelViews) {
    await clickAndCapture(
      page,
      () => page.click(`button.nav[data-mode="${mode}"]`),
      file
    );
  }

  await page.click('button.nav[data-mode="marketing"]');
  await waitForSettled(page, 600);
  const marketingTabs = [
    ['library', 'view-marketing-campaigns.png'],
    ['studio', 'view-marketing-repurpose.png'],
    ['notes', 'view-marketing-compose.png'],
    ['quotes', 'view-marketing-quotes.png'],
    ['scheduled', 'view-marketing-publishing.png'],
  ];
  for (const [tab, file] of marketingTabs) {
    await clickAndCapture(
      page,
      () => page.click(`button[data-mk-tab="${tab}"]`),
      file
    );
  }

  await page.click('button.nav[data-mode="thumbnail"]');
  await waitForSettled(page, 600);
  const thumbnailTabs = [
    ['studio', 'view-thumbnail-studio.png'],
    ['library', 'view-thumbnail-library.png'],
  ];
  for (const [tab, file] of thumbnailTabs) {
    await clickAndCapture(
      page,
      () => page.click(`button[data-th-tab="${tab}"]`),
      file
    );
  }

  await page.click('button.nav[data-mode="audience"]');
  await waitForSettled(page, 600);
  const audienceTabs = [
    ['browser', 'view-audience-browser.png'],
    ['insights', 'view-audience-insights.png'],
  ];
  for (const [tab, file] of audienceTabs) {
    await clickAndCapture(
      page,
      () => page.click(`button[data-a="aud-tab"][data-tab="${tab}"]`),
      file
    );
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
