// 지금 관절 모션의 자세를 **여덟 지점에서 캡쳐해 참조 격자 시트**로 만듭니다.
//
//   CHROME_PATH=... node shot-poseref.js warrior sword
//   CHROME_PATH=... node shot-poseref.js warrior spear
//
// ── 왜 이걸 만드는가 ───────────────────────────────────────
// 처음에는 AI 에게 글로만 "칼을 휘두르는 여덟 컷"을 시켰습니다. 그림은 예뻤지만
// **자세를 제가 지어내서** 모션이 어색했습니다. 컷 사이가 튀고 발이 미끄러졌습니다.
//
// 지금 게임의 관절 모션은 공들여 다듬어 둔 것입니다 (js/motion.js 머리말 참고 —
// 허리부터 돌고, 발은 제자리에 남고, 검은 몸보다 훨씬 많이 돕니다). 그러니
// **그 자세를 그대로 찍어 AI 에게 참조로 물리면** AI 는 다시 그리기만 하면 됩니다.
//
// rig.applyAt(motion, t) 이 그 지점의 자세를 만들고 rig.sync() 가 그립니다.
// 판을 세워 두고 t 를 0 … 1 로 옮기며 여덟 번 찍습니다.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'shots', 'poseref');
const COLS = 4, ROWS = 2, CELL = 220;   // 참조는 크지 않아도 됩니다

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
});

(async () => {
  const job = process.argv[2] || 'warrior';
  const kind = process.argv[3] || 'sword';
  const port = 9841;
  await new Promise((r) => server.listen(port, r));
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });

  // 세 직업 다 열어 두고 그 직업으로 시작합니다.
  await page.evaluate((j) => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: j, sawStory: true })), job);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.mouse.click(270, 288);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  await page.waitForTimeout(1000);

  // 판을 세우고, 주인공만 화면 한가운데에 크게 놓습니다.
  const ready = await page.evaluate((k) => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.bullets.clear(true, true);
    // 흔들리는 것들을 걷습니다 — 참조에 섬광이 끼면 AI 가 그것까지 그립니다.
    s.children.list.slice().filter((o) => o.depth >= 11 && o.depth <= 120)
      .forEach((o) => o.destroy());
    s.scene.pause();
    if (!s.rig || !s.rig.cut) return { ok: false, why: '조각 리그가 아닙니다' };

    // 배경을 걷고 주인공만 남깁니다. 참조에 벽돌과 발판이 끼면 AI 가 그것까지
    // 그려 넣습니다 — 참조는 "이 자세"만 말해야 합니다.
    const keep = new Set(s.rig.parts.map((q) => q.view));
    s.children.list.slice().forEach((o) => { if (!keep.has(o)) o.setVisible(false); });
    s.cameras.main.setBackgroundColor('#ff00ff');
    // MOTIONS 는 const 라 window 에 안 올라갑니다. 함수 선언인 motionFor 는
    // 올라가므로 그쪽으로 가져옵니다 — 가짜 무기를 넘겨 종류만 고릅니다.
    if (typeof window.motionFor !== 'function') return { ok: false, why: 'motionFor 가 없습니다' };
    const m = window.motionFor(s.job, { base: { icon: { art: k } } });
    return { ok: !!m, why: m ? '' : '그런 동작이 없습니다' };
  }, kind);
  if (!ready.ok) { console.log('멈춤 — ' + ready.why); await browser.close(); server.close(); return; }

  // 여덟 지점을 찍습니다. 판이 멈춰 있으므로 t 를 직접 옮깁니다.
  const shots = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const t = i / (COLS * ROWS - 1);
    const box = await page.evaluate(({ t, k }) => {
      const s = window.__scene;
      const m = window.motionFor(s.job, { base: { icon: { art: k } } });
      s.rig.applyAt(m, t);
      s.rig.sync();
      // 조각들이 실제로 차지한 자리를 재서 알려 줍니다 (잘라 낼 때 씁니다)
      const xs = [], ys = [];
      s.rig.parts.forEach((p) => {
        const b = p.view.getBounds();
        xs.push(b.left, b.right); ys.push(b.top, b.bottom);
      });
      const cam = s.cameras.main;
      return { l: Math.min(...xs) - cam.scrollX, r: Math.max(...xs) - cam.scrollX,
               t: Math.min(...ys) - cam.scrollY, b: Math.max(...ys) - cam.scrollY };
    }, { t, k: kind });
    await page.waitForTimeout(60);
    shots.push({ t, box, png: await page.screenshot({ type: 'png' }) });
  }

  // 여덟 장을 하나의 격자로 붙입니다. **자를 자리는 여덟 컷 공통**이어야
  // AI 가 받은 그림에서도 인물이 같은 자리에 섭니다.
  // 참조에서 무기가 칸 끝에 잘리면 AI 가 그 잘린 모양을 그대로 베낍니다.
  // 옆으로 크게 뻗는 컷이 있으므로 가로에 여백을 더 둡니다.
  const pad = 10, padX = 26;
  const L = Math.floor(Math.min(...shots.map((s) => s.box.l)) - padX);
  const R = Math.ceil(Math.max(...shots.map((s) => s.box.r)) + padX);
  const T = Math.floor(Math.min(...shots.map((s) => s.box.t)) - pad);
  const B = Math.ceil(Math.max(...shots.map((s) => s.box.b)) + pad);

  const oven = await browser.newPage({
    viewport: { width: COLS * CELL, height: ROWS * CELL }, deviceScaleFactor: 1 });
  const imgs = shots.map((s) => 'data:image/png;base64,' + s.png.toString('base64'));
  await oven.setContent(`<style>
      html,body{margin:0;background:#ff00ff;overflow:hidden}
      .g{display:flex;flex-wrap:wrap;width:${COLS * CELL}px}
      .c{width:${CELL}px;height:${CELL}px;overflow:hidden;position:relative}
      /* 옮기기를 배율 **안에** 넣어야 합니다. left/top 으로 민 뒤에 scale 을
         걸면 민 거리까지 같이 배율이 먹어서 엉뚱한 자리가 잘립니다. */
      .c img{position:absolute;left:0;top:0;transform-origin:0 0;
             transform:scale(${Math.min(CELL / (R - L), CELL / (B - T))}) translate(${-L}px, ${-T}px)}
    </style><div class="g">${imgs.map((u) => `<div class="c"><img src="${u}"></div>`).join('')}</div>`);
  await oven.waitForTimeout(250);
  const name = `${job}-${kind}.png`;
  await oven.screenshot({ path: path.join(OUT, name) });

  console.log(`${name}  ${COLS}×${ROWS} · 잘라낸 자리 ${R - L}×${B - T}`);
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close();
  server.close();
})();
