const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = process.env.SCREENSHOT_DIR || 'screenshots';
const HTML_DIR = path.join(OUTPUT_DIR, 'html');

async function main() {
  const files = fs.readdirSync(HTML_DIR).filter(name => name.endsWith('.html')).sort();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.setDefaultTimeout(15000);

  for (const file of files) {
    const htmlPath = path.resolve(path.join(HTML_DIR, file));
    const pngPath = path.resolve(path.join(OUTPUT_DIR, file.replace(/\.html$/, '.png')));
    console.log(`capturing ${pngPath}`);
    await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: pngPath, fullPage: false });
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
