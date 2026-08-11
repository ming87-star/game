// 이번에 들어온 것들을 눈으로 봅니다.
//
//   코인벌레·황금개구리  발판 위에서 다른 적과 구분되는가
//   그림자              경고와 웅덩이가 읽히는가 · 삼켜지는 순간
//   일시정지            뒤가 비쳐 "끝난 것"이 아니라 "멈춘 것"으로 보이는가
//   보물상자            여는 순간 화면이 실제로 가득 차는가 (보통 · 유물)
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
  await new Promise((r) => server.listen(9890, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:9890/', { waitUntil: 'networkidle' });
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

  const shot = (name) => page.screenshot({ path: path.join(ROOT, 'shots/' + name) });

  // ── 새로 들어온 두 마리 ────────────────────────────────
  await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const y = s.player.y - 40;
    spawnEnemy(s, 120, y, 3, 'coinbug');
    spawnEnemy(s, 200, y, 3, 'coinbug');
    spawnEnemy(s, 300, y, 3, 'crawler');   // 견주어 볼 보통 적
    spawnGoldFrog(s, 420, y, 40);
    s.enemies.getChildren().forEach((e) => { e.body.setVelocity(0, 0); e.speed = 0; });
  });
  await page.waitForTimeout(400);
  await shot('new-enemies.png');

  // ── 그림자 — 경고가 뜬 직후 ────────────────────────────
  await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.idleMs = 0; s.idleWarned = false; s.clearShadowPool();
    s.updateIdle(CFG.idle.warnMs + 100);
  });
  await page.waitForTimeout(300);
  await shot('new-shadow-warn.png');

  // ── 그림자 — 다 자란 웅덩이 ────────────────────────────
  // 삼켜지기 직전까지만 키웁니다. update 가 매 프레임 계속 더하므로,
  // 딱 붙여 놓으면 찍기도 전에 삼켜집니다 (실제로 그랬습니다).
  await page.evaluate(() => {
    const s = window.__scene;
    s.updateIdle(CFG.idle.killMs - CFG.idle.warnMs - 3000);
  });
  await page.waitForTimeout(200);
  await shot('new-shadow-grown.png');

  // ── 보물상자 ───────────────────────────────────────────
  // 상자는 새 판에서 엽니다 — 위에서 그림자를 키워 놓은 판이라 그대로 두면
  // 이펙트 위로 그림자가 겹칩니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.idleMs = 0; s.idleWarned = false; s.clearShadowPool();
    s.treasureFx(s.player.x, s.player.y - 60, false);
  });
  await page.waitForTimeout(140);
  await shot('new-chest.png');

  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const s = window.__scene;
    s.treasureFx(s.player.x, s.player.y - 60, true);
  });
  await page.waitForTimeout(140);
  await shot('new-chest-relic.png');
  await page.waitForTimeout(1200);

  // ── 일시정지 ───────────────────────────────────────────
  await page.evaluate(() => window.__scene.pauseGame());
  await page.waitForTimeout(400);
  await shot('new-pause.png');
  await page.evaluate(() => window.__pause.resumeGame());
  await page.waitForTimeout(400);

  // ── 삼켜지는 순간 ──────────────────────────────────────
  await page.evaluate(() => window.__scene.swallowPlayer());
  await page.waitForTimeout(320);
  await shot('new-swallow.png');
  await page.waitForTimeout(1400);
  await shot('new-swallow-death.png');

  // ── 한 장으로 묶어 봅니다 ──────────────────────────────
  const names = ['new-enemies.png', 'new-shadow-warn.png', 'new-shadow-grown.png',
    'new-chest.png', 'new-chest-relic.png', 'new-pause.png',
    'new-swallow.png', 'new-swallow-death.png'];
  const titles = ['코인벌레 · 황금개구리', '그림자 경고', '다 자란 그림자',
    '보물상자', '보물상자 — 유물', '일시정지', '삼켜짐', '죽음 화면'];
  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'shots', f)).toString('base64');
  // 두 줄이 다 들어가야 뜻이 있습니다 — 한 줄만 보이면 견줄 것이 없습니다.
  // 화면이 세로로 기니(540×960) 폭을 250까지 줄여야 두 줄이 앉습니다.
  const sheet = await browser.newPage({ viewport: { width: 1096, height: 1020 } });
  await sheet.setContent(`<style>html,body{margin:0;background:#0d1120;font-family:sans-serif;color:#8794b5}
    .row{display:flex;gap:12px;padding:8px 12px}figure{margin:0}
    img{width:250px;border:1px solid #2a3252;border-radius:5px;display:block}
    figcaption{text-align:center;font-size:14px;padding-top:4px}</style>
    <div class="row">${names.slice(0, 4).map((n, i) =>
      `<figure><img src="${b64(n)}"><figcaption>${titles[i]}</figcaption></figure>`).join('')}</div>
    <div class="row">${names.slice(4).map((n, i) =>
      `<figure><img src="${b64(n)}"><figcaption>${titles[i + 4]}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(400);
  await sheet.screenshot({ path: path.join(ROOT, 'shots/new-sheet.png') });

  console.log(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
  await browser.close(); server.close();
  process.exit(errs.length ? 1 : 0);
})();
