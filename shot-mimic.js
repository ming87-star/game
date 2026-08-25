// 가짜가 드러나는 모습을 눈으로 확인합니다.
// 왼쪽엔 진짜 +1, 가운데엔 가짜 +1 을 나란히 놓고 찍습니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
(async () => {
  await new Promise((r) => server.listen(9840, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:9840/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.removeItem('tower-climb-v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__select.go('warrior')); await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x * 0.75, st.y * 0.75); await page.waitForTimeout(900);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  // 바로 위 층(2층 안 → 드러남)과 네 층 위(아직 안 드러남)에 각각 진짜/가짜를 놓습니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const put = (d, lane, kind, disguise) => {
      const f = s.floorIndex + d;
      const floor = s.floors.get(f);
      if (!floor) return;
      let slot = floor.slots[lane];
      if (!slot) { slot = blankSlot(f, lane, kind); floor.slots[lane] = slot; }
      if (slot.view) { slot.view.destroy(); slot.view = null; }
      slot.kind = kind; slot.disguise = disguise || null;
      slot.taken = false; slot.expired = false; slot.revealed = false; slot.armed = false;
      const mark = s.makeMark(slot);
      if (mark) { slot.view = mark; floor.views.push(mark); }
    };
    // 가까운 층 — 진짜와 가짜를 나란히
    put(1, 'left', SLOT.PLUS);
    put(1, 'mid', SLOT.MIMIC, SLOT.PLUS);
    put(1, 'right', SLOT.HASTE);
    // 먼 층 — 아직 구분이 안 되어야 합니다
    put(4, 'left', SLOT.PLUS);
    put(4, 'mid', SLOT.MIMIC, SLOT.PLUS);
    s.updateItems(s.time.now);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ROOT, 'shots', 'fx-mimic.png') });
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close(); server.close();
})();
