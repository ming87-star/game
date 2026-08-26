// 유물 그림 서른다섯 장을 한 장에 펼쳐 찍습니다 — 눈으로 견주려는 것입니다.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const OUT = process.env.OUT_DIR || ROOT;

(async () => {
  const port = 9822;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const missing = await page.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0];
    buildTextures(scene);
    // 펼칠 자리를 내려고 쓰던 것을 다 걷습니다.
    scene.children.list.slice().forEach((o) => o.destroy());
    scene.cameras.main.setBackgroundColor('#0d1120');
    scene.cameras.main.setScroll(0, 0);

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    scene.add.text(270, 18, '유물 그림 서른다섯 장', font(24, '#ffffff')).setOrigin(0.5);

    const cols = 5;
    const cellW = 104;
    const cellH = 90;
    const left = 270 - (cols * cellW) / 2;
    const 빠진것 = [];
    RELICS.forEach((r, i) => {
      const key = relicIconKey(r.key);
      const x = left + cellW * (i % cols) + cellW / 2;
      const y = 76 + cellH * Math.floor(i / cols);
      if (!scene.textures.exists(key)) { 빠진것.push(r.key); return; }
      scene.add.rectangle(x, y + 6, cellW - 10, cellH - 12, 0x1b2138)
        .setStrokeStyle(1, 0x2f3a5c);
      scene.add.image(x, y, key).setDisplaySize(48, 48);
      scene.add.text(x, y + 32, r.name, font(13, '#ffd54f')).setOrigin(0.5);
    });
    return 빠진것;
  });

  console.log(missing.length ? '그림이 없는 유물: ' + missing.join(', ') : '서른다섯 장 모두 있음');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'relic-art.png') });
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
})();
