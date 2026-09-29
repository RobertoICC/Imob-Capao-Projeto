// Gera o card da T2 em PNG (1920x1080).
// Uso: node render.js [ep] [prédio] [bairro] [foto] [saída]
// Ex.: node render.js 02 "Edifício Milano" "Centro · Capão da Canoa/RS" assets/ep02.jpg card-t2-ep02.png
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const [ep = '01', predio, bairro, foto, out = `card-t2-ep${ep}.png`] = process.argv.slice(2);
  const q = new URLSearchParams({ ep });
  if (predio) q.set('predio', predio);
  if (bairro) q.set('bairro', bairro);
  if (foto) q.set('foto', foto);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(__dirname, 'card.html') + '?' + q.toString());
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, out) });
  await browser.close();
  console.log('ok:', out);
})();
