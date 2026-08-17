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
    // 해금은 빈 기록에서 봐야 하지만, 오프닝만은 건너뜁니다 —
    // 여기서 재는 것은 이야기가 아니라 해금 조건입니다.
    await page.evaluate(() => window.localStorage.setItem('tower-climb-v1',
      JSON.stringify({ sawStory: true })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const locked = await page.evaluate(() =>
      CLASSES.map((j) => j.key + (classUnlocked(j) ? ':열림' : ':잠김')).join(' '));

    // 직업 → 메달 상점 → 탑. 여기서는 아무것도 사지 않고 그대로 올라갑니다.
    await page.mouse.click(270 * 0.75, 288 * 0.75); // 전사 카드
    await page.waitForTimeout(600);
    const start = await page.evaluate(() => window.__medal.startAt);
    await page.mouse.click(start.x * 0.75, start.y * 0.75);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
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

  // ── 만남 컷 ────────────────────────────────────────────
  // 직업이 열리면 죽음 화면에서 고른 **다음에** 한 컷이 나오고, 끝나면
  // 원래 가려던 곳으로 이어져야 합니다.
  //
  // 여기서 진짜로 무서운 것은 컷이 안 나오는 게 아니라 **컷이 목적지를
  // 삼키는 것**입니다. 그러면 「메달 받기」를 눌렀는데 메달 상점 대신 시작
  // 화면으로 떨어집니다 — 눌린 것은 맞으니 화면에는 아무 오류도 안 뜹니다.
  const check = (ok, label, got) => {
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
  };
  console.log('');

  await fresh();
  // 궁수와 도적이 한꺼번에 열리는 판으로 끝냅니다.
  await runEnd(700, 2000);
  await page.waitForTimeout(500);

  const choices = await page.evaluate(() => window.__scene.deathChoices);
  await page.mouse.click(choices[0].x * 0.75, choices[0].y * 0.75); // 「메달 받기」
  await page.waitForTimeout(700);

  const met = await page.evaluate(() => (window.__meet
    ? { live: true, jobs: window.__meet.jobs.slice(), at: window.__meet.at }
    : { live: false }));
  check(met.live, '해금되면 고른 뒤에 만남 컷이 나옴');
  check(met.live && met.jobs.join(',') === 'archer,rogue',
    '열린 사람이 차례로 나옴', met.jobs && met.jobs.join(' → '));

  if (met.live) {
    await page.mouse.click(270 * 0.75, 400 * 0.75); // 다음 사람
    await page.waitForTimeout(300);
    const at = await page.evaluate(() => window.__meet.at);
    check(at === 1, '탭하면 다음 사람으로', '두 번째 ' + at);

    await page.mouse.click(270 * 0.75, 400 * 0.75); // 끝내기
    await page.waitForTimeout(800);
  }

  // 「메달 받기」를 눌렀으니 메달 상점으로 가야 합니다 — 컷이 가로채면 안 됩니다.
  const landed = await page.evaluate(() => ({
    live: window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','),
    medal: !!window.__medal,
  }));
  check(landed.medal && landed.live.includes('medal'),
    '컷이 끝나면 고른 곳(메달 상점)으로 이어짐', landed.live);

  // 이미 열린 뒤에는 다시 안 나옵니다. 볼 때마다 나오면 그건 이야기가 아닙니다.
  const again = await page.evaluate(() => {
    const s = window.__scene;
    return s ? (s.justOpened || []).length : -1;
  });
  check(again <= 0, '한 번 열린 사람은 다시 안 나옴', '남은 만남 ' + again);

  console.log(bad ? `\n${bad}건 어긋남` : '\n해금 조건과 만남 컷 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
