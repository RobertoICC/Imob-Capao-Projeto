// Gera as telas finais das 5 missões: PNG 16:9 (1920x1080) e 9:16 (1080x1920).
// Uso: NODE_PATH=$(npm root -g) node render.js
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const fmt of ['h', 'v']) {
    const size = fmt === 'h' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
    const page = await browser.newPage({ viewport: size });
    for (const m of ['m1', 'm2', 'm3', 'm4', 'm5']) {
      await page.goto('file://' + path.join(__dirname, 'tela-final.html') + `?m=${m}&fmt=${fmt}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const out = `${m}-${fmt === 'h' ? '16x9' : '9x16'}.png`;
      await page.screenshot({ path: path.join(__dirname, out) });
      console.log('ok:', out);
    }
    await page.close();
  }
  await browser.close();
})();
