// 상점 층과 상점 화면을 찍습니다 — 주인 둘이 제자리에 섰는지 눈으로 봅니다.
//   CHROME_PATH=... node shot-shop.js
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
(async () => {
  const port = 9851;
  await new Promise((r) => server.listen(port, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  // 화면을 눌러 가며 들어가면 **자리를 옮길 때마다 이 스크립트가 깨집니다** —
  // 실제로 타이틀이 생기고 카드 자리가 바뀌면서 두 번 깨졌습니다.
  // 판을 바로 엽니다. 그림을 보려는 것이지 흐름을 보려는 것이 아닙니다.
  await page.evaluate(() => {
    // 상점은 50층마다입니다. 한 번에 몇 층만 짓기 때문에 0층 언저리에서는
    // 상점 층이 아예 안 만들어집니다. **판을 열기 전에** 간격을 좁혀 둡니다 —
    // 브라우저 안에서만 바꾸는 것이라 파일은 안 건드립니다.
    CFG.shopEvery = 2;
    const g = window.__game;
    ['title', 'story', 'select', 'medal'].forEach((k) => g.scene.stop(k));
    g.scene.start('game', { jobKey: 'warrior' });
  });
  await page.waitForTimeout(1500);

  // 상점 층으로 카메라를 옮깁니다.
  const info = await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    let found = null;
    s.floors.forEach((f) => {
      if (found) return;
      for (const lane of LANES) {
        const slot = f.slots[lane];
        if (slot && slot.kind === SLOT.SHOP) { found = { f, slot }; return; }
      }
    });
    if (!found) return { err: '상점 층이 안 보입니다' };
    s.cameras.main.scrollY = found.slot.y - 560;
    s.scene.pause();
    if (s.rig && s.rig.view) s.rig.view.setVisible(false);
    s.player.setVisible(false);
    return { floor: found.f.index, npc: s.textures.exists('shop-npc'),
      back: s.textures.exists('shop-back') };
  });
  console.log(JSON.stringify(info));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'shots/shop-floor.png'),
    clip: { x: 0, y: 380, width: 540, height: 360 } });

  // 상점 **화면**도 엽니다. 주인의 초상은 여기 서고, 발판 위의 작은 주인과는
  // 다른 그림입니다 (하나는 190px, 하나는 38px).
  const win = await page.evaluate(() => {
    const s = window.__scene;
    s.scene.resume();
    s.coins = 300;
    s.shop.show(s.floorIndex);
    return { keeper: s.textures.exists('shop-keeper') };
  });
  console.log(JSON.stringify(win));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(ROOT, 'shots/shop-window.png') });

  console.log(errs.length ? '오류: ' + errs.slice(0, 3).join(' | ') : '오류 없음');
  await br.close(); server.close();
})();
