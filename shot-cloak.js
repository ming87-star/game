// 붉은 겉옷 셋과 「내려온 것」을 **크게 띄워** 나란히 봅니다.
//
// 36×46 짜리를 판 위에서 보면 무엇이 달라졌는지 알 수가 없습니다. 그렇다고
// 크게만 보면 안 됩니다 — 실제 크기로도 읽혀야 하므로 **1배와 8배를 같이**
// 놓습니다. 왼쪽이 게임에서 보이는 크기입니다.
//
//   node shot-cloak.js   → shots/cloak.png
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});

(async () => {
  await new Promise((r) => server.listen(9882, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:9882/', { waitUntil: 'networkidle' });
  await pg.evaluate(() => window.localStorage.setItem('tower-climb-v1',
    JSON.stringify({ sawStory: true, lastJob: 'warrior', unlocked: {} })));
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 15000 });

  // 판을 한 번 거쳐야 art/*.svg 가 실립니다 (「내려온 것」이 거기 있습니다).
  await pg.evaluate(() => window.__title.scene.start('game', { jobKey: 'warrior' }));
  await pg.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 15000 });
  await pg.waitForTimeout(600);

  await pg.evaluate(() => {
    const s = window.__scene;
    s.scene.pause();
    s.children.list.slice().forEach((o) => o.destroy());
    s.cameras.main.setScroll(0, 0);
    s.cameras.main.setBackgroundColor('#141a2e');
    // 판에서 실제로 서는 벽 앞에 세웁니다 — 흰 종이 위에서 고르면 안 됩니다
    if (typeof buildTowerWall === 'function') buildTowerWall(s);
    const 글 = (x, y, t, n) => s.add.text(x, y, t,
      { fontFamily: 'sans-serif', fontSize: (n || 15) + 'px', color: '#8794b5' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(50);
    [['cloak-red', '붉은 겉옷'], ['cloak-white', '흰옷'],
      ['cloak-falling', '떨어지는 중'], ['cloak-fallen', '바닥에 놓인 옷'],
      ['ending-foe', '내려온 것']]
      .filter(([key]) => s.textures.exists(key))
      .forEach(([key, 이름], i) => {
        const y = 70 + i * 178;
        글(90, y - 34, 이름, 16);
        s.add.image(90, y + 40, key).setScrollFactor(0).setDepth(50);   // 1배
        글(90, y + 74, '게임 크기', 12);
        const 큰 = s.add.image(340, y + 60, key).setScrollFactor(0).setDepth(50);
        큰.setScale(key === 'ending-foe' ? 1.3 : 3.4);
      });
  });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(ROOT, 'shots/cloak.png') });
  console.log(errs.length ? '오류 ' + errs.join(' / ') : '오류 없음');
  await br.close(); server.close();
})();
