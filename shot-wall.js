// 탑 배경을 **진짜 판 위에서** 찍습니다.
//
// 흰 종이에 놓고 보면 안 됩니다. 배경은 주인공과 적과 아이템이 그 위에
// 섰을 때 어떤지가 전부입니다 — 예쁜 벽과 게임이 되는 벽은 다릅니다.
//
//   node shot-wall.js
//     shots/wall-now.png       120층에 세워 둔 판
//     shots/wall-now-zoom.png  발판 언저리만 확대
//     shots/wall-now-up.png    같은 자리에서 400 올라간 것.
//                              세 겹이 저마다 다른 만큼 밀렸는지 여기서 봅니다
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = req.url === '/' ? 'index.html' : req.url.split('?')[0];
  const f = path.join(ROOT, u);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

(async () => {
  const port = 9841;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // 타이틀을 한 번 눌러야 직업 고르기로 넘어갑니다.
  await page.evaluate(() => window.__title && window.__title.go());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__select.go('warrior'));
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  // ── 판을 세워 둡니다 ──────────────────────────────────
  // 두 장 사이에 적이 걸어가면 무엇이 그림 덕인지 알 수가 없습니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 120; s.lane = 'mid';
    for (let i = s.floorIndex - 2; i <= s.floorIndex + 7; i++) s.addFloor(i);
    const slot = s.floors.get(s.floorIndex).slots.mid || s.floors.get(s.floorIndex).slots.left;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    [[-150, 'crawler', -22], [-6, 'brute', -24], [130, 'flyer', -74]].forEach(([dx, kind, dy]) => {
      const e = spawnEnemy(s, slot.x + dx, slot.y + dy, 120, kind);
      if (e) { e.body.setAllowGravity(false); e.body.velocity.set(0, 0); e.hp = 1e9; }
    });
    s.player.setPosition(slot.x, slot.y - 34);
    s.baseScroll = s.player.y - 960 * 0.68;
    s.cameras.main.setScroll(0, s.baseScroll);
    s.scene.pause();
    s.enemies.getChildren().forEach((e) => e.clearTint());
    s.children.list.slice().filter((o) => o.depth >= 11 && o.depth <= 120).forEach((o) => o.destroy());
    s.bullets.clear(true, true);
  });
  await page.waitForTimeout(400);

  // 지금 화면. 벽 한 장이 카메라와 같은 속도로 흐릅니다.
  const 밀기 = async (dy) => page.evaluate((d) => {
    const s = window.__scene;
    const y = s.baseScroll - d;
    s.cameras.main.setScroll(0, y);
    if (s.wall) s.wall.tilePositionY = y;
    (s.__layers || []).forEach(({ o, k }) => { o.tilePositionY = y * k; });
  }, dy).then(() => page.waitForTimeout(320));   // 멈춘 판도 그리기는 계속합니다

  // 발판은 20px 짜리라 통짜 화면에서는 무엇이 달라졌는지 안 보입니다.
  const ZOOM = { x: 20, y: 545, width: 500, height: 190 };
  await 밀기(0);
  await page.screenshot({ path: path.join(ROOT, 'shots/wall-now.png') });
  await page.screenshot({ path: path.join(ROOT, 'shots/wall-now-zoom.png'), clip: ZOOM });
  await 밀기(400);
  await page.screenshot({ path: path.join(ROOT, 'shots/wall-now-up.png') });

  // ── 오를수록 밝아지는가 (500층마다 한 칸) ────────────
  // 한 화면에 층대를 넷 붙여 놓고 봅니다. 따로따로 보면 밝아졌는지 아닌지를
  // 사람 눈으로는 못 가립니다 — 나란히 놔야 보입니다.
  for (const 층 of [0, 1000, 2000, 3500]) {
    await page.evaluate((n) => {
      const s = window.__scene;
      s.scene.resume();
      s.floors.forEach((f) => f.views.forEach((v) => v.destroy()));
      s.floors.clear();
      s.floorIndex = n; s.lane = 'mid';
      for (let i = n; i <= n + 6; i++) s.addFloor(i);
      const slot = s.floors.get(n).slots.mid || s.floors.get(n).slots.left;
      s.player.setPosition(slot.x, slot.y - 34);
      s.baseScroll = s.player.y - 960 * 0.68;
      s.cameras.main.setScroll(0, s.baseScroll);
      s.wallStep = undefined;              // 칸을 새로 잡습니다 (트윈 없이)
      lightTowerWall(s, n);
      s.scene.pause();
    }, 층);
    await 밀기(0);
    await page.screenshot({ path: path.join(ROOT, `shots/wall-lit-${층}.png`),
      clip: { x: 20, y: 120, width: 500, height: 500 } });
  }

  // ── 탑의 바닥 (0층) ──────────────────────────────────
  // 0층은 발판 셋이 아니라 바닥 한 장입니다. 윗면이 발판 윗면과 같은 높이에
  // 오는지, 아래가 화면 끝까지 덮이는지를 여기서 봅니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.scene.resume();
    s.floors.forEach((f) => f.views.forEach((v) => v.destroy()));
    s.floors.clear();
    s.floorIndex = 0; s.lane = 'mid';
    for (let i = 0; i <= 6; i++) s.addFloor(i);
    const slot = s.floors.get(0).slots.mid;
    s.player.setPosition(slot.x, slot.y - 34);
    s.baseScroll = s.player.y - 960 * 0.68;
    s.cameras.main.setScroll(0, s.baseScroll);
    s.scene.pause();
  });
  await 밀기(0);
  await page.screenshot({ path: path.join(ROOT, 'shots/wall-ground.png') });

  console.log(errs.length ? '오류 ' + errs.join(' / ') : '오류 없음');
  await browser.close(); server.close();
})();
