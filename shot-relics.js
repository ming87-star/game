// 새 유물 화면을 찍습니다 — 유물 고르기 창(서른 개 중 셋)과, 도깨비불·
// 기름 이펙트가 실제로 걸린 인게임 화면.
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

const OUT = '/tmp/claude-0/-home-user-CRETEC-test/6ef932c5-f747-53e8-9e55-72cbdec62fd8/scratchpad';

(async () => {
  const port = 9733;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 900, deaths: 0, runs: 0, bestCoins: 5000, medals: 26,
    weapons: {}, perks: {}, boosts: {}, unlocked: { archer: true, rogue: true }, sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  // 타이틀 → 직업(전사) → 메달 상점 → 무기 도감 → 판 시작.
  await page.evaluate(() => window.__title && window.__title.go && window.__title.go());
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__select.go('warrior'));  // 좌표 대신 화면에 시킵니다
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__medal && window.__medal.startAt);
  if (st) { await page.mouse.click(st.x, st.y); await page.waitForTimeout(1000); }
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  // ── 1) 유물 고르기 창 — 서른 개 중 셋 ─────────────────
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 300;
    s.weapon.relics = [];
    s.hud.update();
    s.openRelicChoice();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'relic-choice.png') });

  // 첫 장을 실제로 눌러서 창을 닫습니다 (버튼의 pointerdown 안에서
  // 카드 그림들을 스스로 치우므로, closeChoice() 만 불러서는 안 지워집니다).
  const card = await page.evaluate(() => window.__scene.relicChoices[0]);
  await page.mouse.click(card.x, card.y);
  await page.waitForTimeout(300);

  // ── 2) 도깨비불 + 뜨거운 기름이 실제로 도는 인게임 화면 ──
  await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('willowisp'), relicByKey('hotoil')];
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.addFloor(s.floorIndex);
    const f = s.floors.get(s.floorIndex);
    LANES.forEach((l) => { if (!f.slots[l]) f.slots[l] = blankSlot(s.floorIndex, l, 'empty'); });
    const e1 = spawnEnemy(s, f.slots.left.x, f.slots.left.y - 40, s.floorIndex, 'crawler');
    const e2 = spawnEnemy(s, f.slots.right.x, f.slots.right.y - 40, s.floorIndex, 'brute');
    s.applyOil(e1);
    s.hud.update();
  });
  // 도깨비불이 몇 바퀴 돌게 시간을 좀 흘립니다.
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      const s = window.__scene;
      s.updateWisps(s.time.now, 16);
      s.updateOilFx(s.time.now);
    });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'relic-wisp-oil.png') });

  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
})();
