// 화면이 **기기 비율에 맞게 서는가**.
//
// 이 검사가 필요한 까닭. 예전에는 540×960 한 벌을 Phaser 의 FIT 에 맡겼는데,
// FIT 는 비율을 지키며 안쪽에 맞추므로 요즘 폰(19.5:9 · 20:9)에서는 위아래에
// **검은 띠**가 남습니다. 실기에서 「화면이 꽉 차지 않는다」로 나왔습니다.
//
// 이제 가로는 못박고 **세로만 기기에 맞춥니다**(js/config.js 의 세로맞추기).
// 그런데 그 값이 틀어져도 **게임은 아무 일 없이 잘 돕니다** — 조금 짧거나
// 긴 채로 돌 뿐이고 오류도 안 납니다. 그래서 여기서 잽니다.
//
// ── 여기서 잡으려는 것 ──────────────────────────────────
//  1. 비율마다 CFG.height 가 제대로 나오는가 (아래위 한계까지)
//  2. 폰 비율에서 **캔버스가 창을 꽉 채우는가** (띠가 안 남는가)
//  3. 세로가 늘어도 HUD 와 단추가 제자리에 붙어 있는가
//  4. 세로가 늘어도 화면 밖으로 흘러나간 것이 없는가
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

// 재 볼 기기들. 마지막 둘은 한계를 넘겨서 **한계가 실제로 무는지**를 봅니다.
const 기기 = [
  { 이름: '4:3 태블릿',   w: 768, h: 1024, 바람: 960,  띠없음: false },
  { 이름: '9:16 옛 폰',    w: 540, h: 960,  바람: 960,  띠없음: true },
  { 이름: '9:18 폰',       w: 540, h: 1080, 바람: 1080, 띠없음: true },
  { 이름: '9:19.5 요즘 폰', w: 540, h: 1170, 바람: 1170, 띠없음: true },
  { 이름: '9:21 긴 폰',    w: 540, h: 1260, 바람: 1200, 띠없음: false },
];

(async () => {
  const port = Number(process.env.PORT) || 9724;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const errors = [];
  const 보인층 = [];

  for (const 기 of 기기) {
    const page = await browser.newPage({ viewport: { width: 기.w, height: 기.h } });
    page.on('pageerror', (e) => errors.push(기.이름 + ': ' + e.message));
    await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
      sawStory: true, medals: 3, lastJob: 'warrior', unlocked: {} })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 30000 });

    // ── 1. 세로가 제대로 정해졌는가 ───────────────────────
    const 값 = await page.evaluate(() =>
      ({ h: CFG.height, g: CFG.groundY, w: CFG.width, v: CFG.viewHeight }));
    check(값.h === 기.바람, `${기.이름} — 세로가 ${기.바람}`, 값.h);
    check(값.w === 540, `${기.이름} — 가로는 그대로 540 (줄·HUD·패널이 다 이 값에 맞춰져 있습니다)`, 값.w);
    // 딛는 줄은 **화면 아래가 아니라 「탑이 보이는 창」의 아래**에서 잽니다.
    // 화면 아래에서 재면 아래쪽 어둠 띠가 첫 층을 삼킵니다.
    const 창아래 = (값.h + 값.v) / 2;
    check(값.g === 창아래 - 80,
      `${기.이름} — 딛는 줄이 **띠 안쪽** 창의 아래를 따라감`,
      값.g + ' (창 아래 ' + 창아래 + ')');

    // ── 2. 캔버스가 창을 꽉 채우는가 ──────────────────────
    //
    // **띠는 눈으로만 보입니다.** CFG.height 가 맞아도 CSS 나 scale 설정이
    // 어긋나면 그대로 띠가 남습니다.
    const 캔 = await page.evaluate(() => {
      const c = document.querySelector('#game canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height),
        창w: window.innerWidth, 창h: window.innerHeight };
    });
    if (!캔) check(false, `${기.이름} — 캔버스를 찾음`, '없음');
    else if (기.띠없음) {
      const 남는가로 = 캔.창w - 캔.w, 남는세로 = 캔.창h - 캔.h;
      check(남는가로 <= 2 && 남는세로 <= 2,
        `${기.이름} — **띠 없이 창을 꽉 채움**`,
        `남는 가로 ${남는가로}px · 세로 ${남는세로}px`);
    } else {
      // 한계 바깥에서는 띠가 남는 것이 맞습니다. 다만 **잘리면 안 됩니다.**
      check(캔.w <= 캔.창w + 2 && 캔.h <= 캔.창h + 2,
        `${기.이름} — 한계 바깥이라 띠는 남되 **잘리지는 않음**`,
        `${캔.w}×${캔.h} / 창 ${캔.창w}×${캔.창h}`);
    }

    // ── 3·4. 판을 열어 놓고 붙박인 것들을 봅니다 ──────────
    await page.evaluate(() => window.__title.scene.start('game', { jobKey: 'warrior' }));
    await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 30000 });
    await page.waitForTimeout(700);
    const 붙박이 = await page.evaluate(() => {
      const s = window.__scene;
      // 화면에 붙박인 것 = 스크롤을 안 따라가는 것 (scrollFactor 0)
      const 것들 = s.children.list.filter((o) =>
        o.visible && o.alpha > 0.05 && o.scrollFactorY === 0
        && o.getBounds && o.width > 2 && o.height > 2);
      let 위 = 1e9, 아래 = -1e9, 왼 = 1e9, 오른 = -1e9;
      것들.forEach((o) => {
        const b = o.getBounds();
        위 = Math.min(위, b.top); 아래 = Math.max(아래, b.bottom);
        왼 = Math.min(왼, b.left); 오른 = Math.max(오른, b.right);
      });
      return { 수: 것들.length, 위: Math.round(위), 아래: Math.round(아래),
        왼: Math.round(왼), 오른: Math.round(오른), h: CFG.height, w: CFG.width };
    });
    // HUD 는 맨 위에, 조작 단추는 맨 아래에 붙어 있어야 합니다. 세로가 늘었을 때
    // 둘 다 가운데로 몰리면 「화면은 길어졌는데 UI 만 떠 있는」 꼴이 됩니다.
    check(붙박이.위 < 60, `${기.이름} — HUD 가 위에 붙어 있음`, '맨 위 ' + 붙박이.위);
    check(붙박이.아래 > 붙박이.h - 120,
      `${기.이름} — 조작 단추가 아래에 붙어 있음`,
      '맨 아래 ' + 붙박이.아래 + ' / 세로 ' + 붙박이.h);
    // 화면 밖으로 흘러나간 것이 없는가 (좌우로 20px 까지는 봐줍니다 — 그림
    // 가장자리의 투명한 여백이 잡히는 자리가 있습니다).
    check(붙박이.왼 > -20 && 붙박이.오른 < 붙박이.w + 20
      && 붙박이.위 > -20 && 붙박이.아래 < 붙박이.h + 20,
      `${기.이름} — 화면 밖으로 흘러나간 것이 없음`,
      `${붙박이.왼},${붙박이.위} ~ ${붙박이.오른},${붙박이.아래}`);
    // ── 5. **보이는 층이 비율과 무관하게 같은가** ─────────
    //
    // 이 검사가 이 파일의 알맹이입니다. 세로를 늘리기만 하면 긴 폰이 층을
    // 하나 더 봅니다 — 재 보니 9:16 은 5층, 9:19.5 는 6층이었습니다.
    // 그건 넉넉한 것이 아니라 **천리안 유물이 파는 「앞을 아는 것」**을
    // 공짜로 얻는 것이고, 순위표는 기기가 다른 사람끼리 겨루는 자리입니다.
    // 그래서 남는 만큼을 어둠 띠로 덮습니다 — 덮였는지를 여기서 셉니다.
    const 층셈 = await page.evaluate(() => {
      const cam = window.__scene.cameras.main;
      // 띠가 **가리는** 자리를 뺀 창
      const 남 = CFG.height - CFG.viewHeight;
      const 띠 = Math.round(남 / 2);
      // 띠의 바깥 70% 는 꽉 채웁니다 — 그만큼은 안 보이는 것으로 셉니다.
      const 가림 = 띠 * 0.7;
      const 위 = cam.scrollY + 가림, 아래 = cam.scrollY + CFG.height - 가림;
      let 셈 = 0;
      for (let n = 0; n < 200; n++) {
        const y = CFG.groundY - n * CFG.floorHeight;
        if (y >= 위 && y <= 아래) 셈++;
      }
      return 셈;
    });
    보인층.push({ 이름: 기.이름, 셈: 층셈 });
    await page.close();
  }
  const 값들 = [...new Set(보인층.map((x) => x.셈))];
  check(값들.length === 1,
    '**보이는 층이 어느 비율에서나 같음** (긴 폰이 한 층을 더 보지 않게)',
    보인층.map((x) => x.이름 + ' ' + x.셈 + '층').join(' · '));

  console.log(bad ? `\n${bad}건 어긋남` : '\n비율마다 화면이 제대로 서고, 붙박인 것들이 제자리에 있습니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
