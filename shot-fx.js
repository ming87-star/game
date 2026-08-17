// 공격 모션과 보스 체력바를 눈으로 확인하기 위한 스크린샷 도구.
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
  const port = 9830;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const errors = [];
  const go = async (job, name, boss) => {
    const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
    page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
    await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
      bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
      relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const idx = ['warrior', 'archer', 'rogue'].indexOf(job);
    await page.mouse.click(270 * 0.75, (288 + idx * 210) * 0.75);
    await page.waitForTimeout(600);
    const st = await page.evaluate(() => window.__medal.startAt);
    await page.mouse.click(st.x * 0.75, st.y * 0.75);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
    await page.waitForTimeout(900);

    await page.evaluate((isBoss) => {
      const s = window.__scene;
      s.weapon.tier = 5; s.weapon.haste = 6;
      s.floorIndex = isBoss ? 199 : 120;
      s.lane = 'mid';
      for (let i = s.floorIndex; i <= s.floorIndex + 7; i++) s.addFloor(i);
      const slot = s.floors.get(s.floorIndex).slots.mid;
      s.player.setPosition(slot.x, slot.y - 34);
      s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
      // 나는 적으로 띄웁니다. 땅을 딛는 적은 발판 밖으로 걸어 나가 떨어져서
      // 사진을 찍기 전에 사라집니다.
      if (!isBoss) for (let i = 0; i < 5; i++) {
        spawnEnemy(s, slot.x - 90 + i * 45, slot.y - 150, 120, 'flyer');
      }
    }, boss);
    if (boss) { await page.mouse.click(270 * 0.75, 620 * 0.75); await page.waitForTimeout(3400); }
    await page.waitForTimeout(boss ? 900 : 450);
    await page.screenshot({ path: path.join(ROOT, 'shots', name) });
    await page.close();
  };
  await go('warrior', 'fx-melee.png', false);
  await go('archer', 'fx-arrow.png', false);
  await go('warrior', 'fx-bossbar.png', true);
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close(); server.close();
})();
