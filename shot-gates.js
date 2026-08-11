// 층에 올라설 때 뜨는 알림 둘(박쥐 51층 · 함정 101층)을 눈으로 확인합니다.
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
  await new Promise((r) => server.listen(9860, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:9860/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: {}, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.mouse.click(270, 288);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  await page.waitForTimeout(900);

  const shot = async (key, floor, name) => {
    // 앞 알림 글자가 완전히 사라진 뒤에 다음 것을 띄웁니다.
    // (게임도 같은 규칙으로 겹침을 막습니다 — checkFloorGates 의 gateUntil)
    await page.waitForFunction(() => window.__scene.time.now >= (window.__scene.gateUntil || 0));
    await page.evaluate(({ key, floor }) => {
      const s = window.__scene;
      s.gatesShown.delete(key);
      s.floorIndex = floor;
      for (let i = s.floorIndex; i <= s.floorIndex + 7; i++) s.addFloor(i);
      const slot = s.floors.get(s.floorIndex).slots.mid || s.floors.get(s.floorIndex).slots.left;
      s.player.setPosition(slot.x, slot.y - 34);
      s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
      s.checkFloorGates();
    }, { key, floor });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(ROOT, 'shots/' + name) });
  };
  await shot('bats', 51, 'gate-bats.png');
  await shot('trap', 101, 'gate-trap.png');

  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'shots', f)).toString('base64');
  const sheet = await browser.newPage({ viewport: { width: 1140, height: 1030 } });
  await sheet.setContent(`<style>html,body{margin:0;background:#0d1120;font-family:sans-serif;color:#8794b5}
    .row{display:flex;gap:20px;padding:16px 20px}figure{margin:0}
    figcaption{text-align:center;font-size:15px;padding:8px 0}
    img{display:block;width:540px;border:1px solid #2a3252}</style>
    <div class="row">
      <figure><img src="${b64('gate-bats.png')}"><figcaption>51층에 올라설 때</figcaption></figure>
      <figure><img src="${b64('gate-trap.png')}"><figcaption>101층에 올라설 때</figcaption></figure>
    </div>`);
  await sheet.waitForTimeout(250);
  await sheet.screenshot({ path: path.join(ROOT, 'shots/gates.png') });
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close(); server.close();
})();
