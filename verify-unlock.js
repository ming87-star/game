// 해금 조건이 실제로 걸리는지 브라우저에서 확인합니다.
// 층과 코인을 "한 판 안에서 동시에" 채웠을 때만 열려야 합니다.
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

(async () => {
  const port = Number(process.env.PORT) || 8110;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  // 한 판을 억지로 끝내고, 그때 무엇이 열렸는지 저장된 것을 읽습니다.
  const runEnd = (floor, coins) => page.evaluate(([f, c]) => {
    const s = window.__scene;
    s.floorIndex = f;
    s.totalCoins = c;
    s.gameOver();
    return JSON.parse(JSON.stringify(window.__save.data.unlocked));
  }, [floor, coins]);

  const fresh = async () => {
    await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.removeItem('tower-climb-v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const locked = await page.evaluate(() =>
      CLASSES.map((j) => j.key + (classUnlocked(j) ? ':열림' : ':잠김')).join(' '));

    // 직업 → 메달 상점 → 탑. 여기서는 아무것도 사지 않고 그대로 올라갑니다.
    await page.mouse.click(270 * 0.75, 288 * 0.75); // 전사 카드
    await page.waitForTimeout(600);
    const start = await page.evaluate(() => window.__medal.startAt);
    await page.mouse.click(start.x * 0.75, start.y * 0.75);
    await page.waitForTimeout(800);
    return locked;
  };

  const cases = [
    ['층만 채움',        900, 300,  {}],
    ['코인만 채움',      120, 3000, {}],
    ['궁수 조건 충족',   500, 1000, { archer: true }],
    ['둘 다 충족',       700, 2000, { archer: true, rogue: true }],
  ];

  let bad = 0;
  for (const [label, floor, coins, want] of cases) {
    const start = await fresh();
    const got = await runEnd(floor, coins);
    const ok = JSON.stringify(Object.keys(got).sort()) === JSON.stringify(Object.keys(want).sort());
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : '틀림'}  ${label.padEnd(14)} ${floor}층/${coins}코인 →`,
      Object.keys(got).join(',') || '(없음)', ' | 시작화면:', start);
  }

  console.log(bad ? `\n${bad}건 어긋남` : '\n해금 조건 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
})();
