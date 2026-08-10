// **합친 파일**(dist/index.html)을 실제로 눌러 봅니다.
//
// 이 검사가 왜 따로 있어야 하는가:
// 다른 검사들은 전부 개발용 index.html 을 봅니다. 그런데 사람이 실제로 여는
// 것은 합친 파일입니다. 둘이 어긋나면 — 예를 들어 build.js 가 새 js 파일을
// 빼먹으면 — 개발용은 멀쩡하고 합친 파일에서만 게임이 안 뜹니다.
//
// 실제로 그런 일이 있었습니다. js/artset.js 를 index.html 에만 넣고 build.js 의
// 목록을 안 고쳤더니, 메달 상점에서 「탑에 오르기」를 눌러도 아무 일이 없었습니다.
// 화면에는 오류가 안 나오므로 눌러 본 사람은 "버튼이 안 먹는다"고만 느낍니다.
// 검사 일곱 묶음이 전부 통과한 채로 그게 나갔습니다.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FILE = path.join(ROOT, 'dist', 'index.html');
const server = http.createServer((req, res) => {
  fs.readFile(FILE, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('dist/index.html 이 없습니다'); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(buf);
  });
});

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

(async () => {
  if (!fs.existsSync(FILE)) {
    console.log('dist/index.html 이 없습니다. node build.js 를 먼저 돌리세요.');
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 9700;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.message || '')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  // 1. 시작 화면
  check(await page.evaluate(() => !!window.__game), '합친 파일이 켜짐');

  // 2. 직업 고르기 → 메달 상점
  await page.mouse.click(270, 288);
  await page.waitForTimeout(900);
  const medal = await page.evaluate(() => (window.__medal ? window.__medal.startAt : null));
  check(!!medal, '직업을 고르면 메달 상점으로', medal ? JSON.stringify(medal) : '안 넘어감');

  // 3. 「탑에 오르기」 → 실제로 판이 시작되는가
  //    여기가 핵심입니다. 장면이 안 뜨면 버튼이 안 먹는 것처럼 보입니다.
  if (medal) {
    await page.mouse.click(medal.x, medal.y);
    await page.waitForTimeout(1600);
  }
  const started = await page.evaluate(() => ({
    live: window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','),
    game: !!(window.__scene && window.__scene.player),
    art: !!(window.__scene && window.__scene.textures.exists('player-warrior')),
  }));
  check(started.game, '「탑에 오르기」를 누르면 판이 시작됨',
    '살아 있는 장면 [' + started.live + ']');
  check(started.art, '합친 파일에도 그림이 들어 있음');

  // 4. 한 번 뛰어 보기 — 켜지기만 하고 안 굴러가는 것도 잡습니다.
  if (started.game) {
    const before = await page.evaluate(() => window.__scene.floorIndex);
    await page.mouse.click(270, 620);
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => window.__scene.floorIndex);
    check(after > before, '눌러서 한 층 올라감', before + ' → ' + after);
  }

  check(errors.length === 0, '오류 하나 없이 여기까지', errors.slice(0, 3).join(' | ') || '없음');

  console.log(bad ? `\n${bad}건 어긋남` : '\n합친 파일이 사람 손에서 제대로 돕니다');
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})();
