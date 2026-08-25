// 죽음 화면의 세 갈래를 눈으로 확인하는 도구.
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
  const port = 9837;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 6, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__select.go('warrior'));  // 좌표 대신 화면에 시킵니다
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    s.floorIndex = 150;
    s.coins = 320; s.totalCoins = 980; s.kills = 214; s.armor = 60;
    s.weapon.tier = 5; s.weapon.plus = 4; s.weapon.haste = 5;
    s.weapon.upgrade(); s.noteWeapon();
    s.weapon.upgrade(); s.noteWeapon();
    s.snapshotAtShop();
    s.floorIndex = 173;
    s.medals = 4;
    s.gameOver();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ROOT, 'shots/death-choices.png') });
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close(); server.close();
})();
