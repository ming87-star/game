// 안드로이드의 「뒤로」.
//
// 껍데기 쪽 자바는 이 환경에서 컴파일도 못 합니다 (안드로이드 SDK 가
// 없습니다). 그래서 **자바가 부를 함수 하나를 JS 에 두고, 그 절반만이라도
// 여기서 눌러 봅니다.**
//
// 이걸 안 두면 탑에서 뒤로를 누르는 순간 앱이 닫히고 오르던 판이 통째로
// 날아갑니다 — 안드로이드에서 가장 흔한 원망입니다.
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

(async () => {
  const port = Number(process.env.PORT) || 9750;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1',
    JSON.stringify({ sawStory: true, version: 1 })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 30000 });

  const 장면 = () => page.evaluate(() =>
    window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','));
  const 뒤로 = () => page.evaluate(() => window.__androidBack());

  // **한 화면만 켜 놓고 눌러 봅니다.**
  //
  // Phaser 의 SceneManager.start 는 다른 장면을 **안 멈춥니다.** 그걸 모르고
  // 시험에서 그대로 썼더니 타이틀·판·멈춤이 겹겹이 켜진 채로 쌓여서,
  // 「코드 화면에서 뒤로」를 재는데 code,pause 가 나왔습니다. 게임이 아니라
  // 시험이 틀린 것이었습니다. 옮길 때마다 나머지를 손으로 멈춥니다.
  const 로가기 = (키, 값) => page.evaluate(([키, 값]) => {
    window.__game.scene.scenes.forEach((s) => {
      if (s.scene.isActive() || s.scene.isPaused()) s.scene.stop();
    });
    window.__game.scene.start(키, 값);
  }, [키, 값]);

  check(await page.evaluate(() => typeof window.__androidBack === 'function'),
    '껍데기가 부를 함수가 있음');

  // ── 타이틀에서는 껍데기에 맡깁니다 ─────────────────────
  //
  // 여기서 참을 돌려주면 **앱을 영영 못 나갑니다** — 뒤로를 아무리 눌러도
  // 게임이 「내가 처리했다」고만 하고 아무 일도 안 일어납니다.
  check(await 뒤로() === false, '타이틀에서는 거짓을 줌 (앱을 나갈 수 있게)', await 장면());

  // ── 탑 위에서는 나가지 않고 멈춥니다 ───────────────────
  await 로가기('game', { jobKey: 'warrior' });
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const 판에서 = await 뒤로();
  await page.waitForTimeout(400);
  const 멈췄나 = await 장면();
  check(판에서 === true, '탑 위에서는 참을 줌 (앱이 안 닫히게)');
  check(멈췄나.includes('pause'), '탑 위에서 뒤로를 누르면 **멈춤 창**이 뜸', 멈췄나);

  // 한 번 더 누르면 다시 이어집니다
  const 두번째 = await 뒤로();
  await page.waitForTimeout(500);
  const 이어짐 = await 장면();
  check(두번째 === true && !이어짐.includes('pause'),
    '멈춤 창에서 뒤로를 누르면 다시 이어짐', 이어짐);

  // ── 곁가지 화면은 한 걸음 물러섭니다 ───────────────────
  await 로가기('title');
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 20000 });
  await page.evaluate(() => window.__title.openCode());
  // **장면은 겹쳐 뜹니다.** 「켜진 것이 code 하나뿐」으로 기다리면 영영
  // 안 옵니다 — 타이틀이 밑에 남아 있습니다. 들어 있는지만 봅니다.
  await page.waitForFunction(() => window.__game.scene.getScenes(true)
    .map((s) => s.scene.key).includes('code'), null, { timeout: 20000 });
  const 코드에서 = await 뒤로();
  await page.waitForTimeout(700);
  const 코드뒤 = await 장면();
  check(코드에서 === true && 코드뒤.includes('title') && !코드뒤.includes('code'),
    '코드 화면에서 뒤로를 누르면 타이틀로', 코드뒤);

  // ── 창이 떠 있으면 안 닫습니다 ─────────────────────────
  //
  // 무기 갈아타기는 고르기 전에 사라지면 안 됩니다 — 무엇을 골랐는지
  // 모르는 채로 판이 흘러갑니다.
  // 갈아타기 창은 데이터를 받아야 서므로 **장면 목록만 흉내 내서** 규칙을
  // 직접 눌러 봅니다. 여기서 보려는 것은 창의 모양이 아니라 「참만 주고
  // 아무것도 안 한다」는 규칙 하나입니다.
  const 창에서 = await page.evaluate(() => {
    const 원래 = window.__game;
    let 건드림 = 0;
    window.__game = { scene: {
      getScenes: () => [{ scene: { key: 'game' } }, { scene: { key: 'swap' } }],
      getScene: () => { 건드림++; return null; },
      start: () => { 건드림++; },
    } };
    const r = window.__androidBack();
    window.__game = 원래;
    return { 답: r, 건드림 };
  });
  check(창에서.답 === true && 창에서.건드림 === 0,
    '갈아타기 창이 떠 있으면 참만 주고 아무것도 안 함',
    '답 ' + 창에서.답 + ' · 건드린 횟수 ' + 창에서.건드림);

  await page.evaluate(() => { window.localStorage.removeItem('tower-climb-v1'); });
  console.log(bad ? `\n${bad}건 어긋남` : '\n뒤로를 눌러도 판이 안 날아가고, 타이틀에서는 앱을 나갈 수 있습니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
