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
  const port = 9836;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'rogue', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.mouse.click(270, 288 + 2 * 210);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    s.floorIndex = 120; s.lane = 'mid';
    for (let i = s.floorIndex; i <= s.floorIndex + 7; i++) s.addFloor(i);
    const slot = s.floors.get(s.floorIndex).slots.mid || s.floors.get(s.floorIndex).slots.left;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    for (let i = 0; i < 3; i++) {
      const e = spawnEnemy(s, slot.x - 70 + i * 70, slot.y - 90, 120, 'flyer');
      if (e) { e.body.setAllowGravity(false); e.hp = 1e9; }
    }
    s.job.steal = 1; s.weapon.job = s.job;
    s.lastSwingAt = -1e9;
    setTimeout(() => s.swing(s.time.now), 40);
  });
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(ROOT, 'shots/fx-steal.png') });
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close(); server.close();
})();
