// 죽는 이펙트와 발판 위 무기 그림을 눈으로 확인하는 도구.
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
  const port = 9835;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.mouse.click(270, 288);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });

  // ── 발판 위의 다음 무기 그림 ────────────────────────────
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    s.weapon.tier = 4;
    s.floorIndex = 120;
    s.lane = 'mid';
    for (let i = s.floorIndex; i <= s.floorIndex + 7; i++) s.addFloor(i);
    const here = s.floors.get(s.floorIndex).slots.mid;
    s.player.setPosition(here.x, here.y - 34);
    s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
    // 바로 위층 세 칸에 UP·+1·폭탄을 심어 나란히 보이게 합니다.
    // 길이 늘 셋인 것은 아니므로, 실제로 있는 칸에만 차례로 심습니다.
    const up = s.floors.get(s.floorIndex + 1);
    const kinds = [SLOT.UPGRADE, SLOT.PLUS, SLOT.BOMB];
    LANES.filter((l) => up.slots[l]).forEach((lane, i) => {
      const slot = up.slots[lane];
      if (slot.view) slot.view.destroy();
      slot.kind = kinds[i % kinds.length];
      slot.taken = false; slot.expired = false; slot.armed = false; slot.upIcon = null;
      slot.view = s.makeMark(slot);
      up.views.push(slot.view);
    });
    s.markedTier = -1;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ROOT, 'shots/fx-weapon-mark.png') });

  // ── 죽는 이펙트 ────────────────────────────────────────
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    const slot = s.floors.get(s.floorIndex).slots.mid;
    for (let i = 0; i < 6; i++) {
      const e = spawnEnemy(s, slot.x - 100 + i * 40, slot.y - 130, 120, i % 2 ? 'flyer' : 'giant');
      if (e) { e.hp = 1; setTimeout(() => s.hitEnemy(e, 9999), 20 + i * 50); }
    }
  });
  await page.waitForTimeout(215);
  await page.screenshot({ path: path.join(ROOT, 'shots/fx-kill.png') });

  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
})();
