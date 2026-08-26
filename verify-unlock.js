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
    // 켜면 타이틀 화면이 먼저 섭니다 (js/scene-title.js). 사람처럼 지나갑니다 —
    // 다 뜰 때까지 기다렸다가 한 번 누릅니다.
    await page.waitForFunction(() => window.__title && window.__title.ready,
      null, { timeout: 8000 });
    await page.evaluate(() => window.__title.go());
    await page.waitForTimeout(700);
    const locked = await page.evaluate(() =>
      CLASSES.map((j) => j.key + (classUnlocked(j) ? ':열림' : ':잠김')).join(' '));

    // 직업 → 메달 상점 → 탑. 여기서는 아무것도 사지 않고 그대로 올라갑니다.
    // 자리는 화면에 물어봅니다 — 적어 두면 고르기 화면을 고칠 때 조용히
    // 엉뚱한 데를 누르고, 그래도 오류는 안 납니다.
    const cell = await page.evaluate(() => window.__select.jobAt('warrior'));
    await page.mouse.click(cell.x * 0.75, cell.y * 0.75);
    await page.waitForTimeout(300);
    const go = await page.evaluate(() => window.__select.startAt);
    await page.mouse.click(go.x * 0.75, go.y * 0.75);
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

  // ── 무엇이 열려야 하는지는 **직업표에서 뽑습니다** ──────
  // 예전에는 여기 `{ archer: true }` 처럼 손으로 적어 두었습니다. 직업이
  // 셋에서 여덟이 되자 500층/1000코인 에서 도굴꾼(300/800)도 함께 열렸는데,
  // 시험은 궁수 하나만 적혀 있어서 **틀렸다고 했습니다.** 게임이 맞고
  // 시험이 낡은 것이었습니다.
  //
  // 조건을 표에서 읽으면 직업이 몇이 되든 안 낡습니다. 대신 **규칙 자체**를
  // 따로 봅니다 — 한 판 안에서 층과 코인을 **둘 다** 채워야 한다는 것.
  const 기대 = (floor, coins) => page.evaluate(([f, c]) => CLASSES
    .filter((j) => (j.unlockFloor || j.unlockCoins)
      && f >= (j.unlockFloor || 0) && c >= (j.unlockCoins || 0))
    .map((j) => j.key).sort(), [floor, coins]);

  const cases = [
    ['층만 채움', 900, 300],
    ['코인만 채움', 120, 3000],
    ['가장 낮은 문', 300, 800],
    ['가운데쯤', 500, 1000],
    ['거의 다', 700, 2000],
    ['전부', 1200, 4000],
  ];

  let bad = 0;
  for (const [label, floor, coins] of cases) {
    const start = await fresh();
    const got = await runEnd(floor, coins);
    const 예상 = await 기대(floor, coins);
    const ok = JSON.stringify(Object.keys(got).sort()) === JSON.stringify(예상);
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : '틀림'}  ${label.padEnd(12)} ${floor}층/${coins}코인 →`,
      Object.keys(got).sort().join(',') || '(없음)',
      ok ? '' : ' (예상 ' + (예상.join(',') || '없음') + ')');
  }

  // **규칙 자체**를 봅니다 — 한쪽만 채워서는 하나도 안 열려야 합니다.
  // 위 표에서 뽑는 방식은 조건을 그대로 옮겨 오므로, 이 한 줄이 없으면
  // 「둘 다 채워야 한다」가 깨져도 시험이 같이 틀립니다.
  // 페이지가 열린 뒤라야 CLASSES 를 읽을 수 있어서 **고리 뒤에서** 봅니다.
  const 아무것도 = await 기대(0, 0);
  const 층만 = await 기대(9999, 0);
  const 코인만 = await 기대(0, 9999);
  const 규칙 = 아무것도.length === 0 && 층만.length === 0 && 코인만.length === 0;
  if (!규칙) bad++;
  console.log(`${규칙 ? 'OK ' : '틀림'}  ${'한쪽만 채워서는 안 열림'.padEnd(12)}`,
    '아무것도 ' + (아무것도.join(',') || '없음') +
    ' · 층만 ' + (층만.join(',') || '없음') +
    ' · 코인만 ' + (코인만.join(',') || '없음'));

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

  // ── 열리는 사람마다 만날 글이 있는가 ──────────────────
  //
  // **이것이 없으면 아무 일도 안 일어나고 오류도 안 납니다.** MeetScene 의
  // init 은 `CFG.story.meetings` 에 글이 없는 직업을 **조용히 걸러 냅니다** —
  // 걸러 내고 나면 목록이 비고, create 가 곧바로 leave 로 빠집니다. 죽음
  // 화면에서 다음 화면으로 그냥 넘어가는 것과 구분이 안 됩니다.
  //
  // 실제로 그랬습니다. 직업을 여덟으로 늘리면서 **새로 들어온 다섯의 글을
  // 아무도 안 썼고**, 다섯 중 넷이 궁수보다 먼저 열리는데 그동안 해금 순간이
  // 통째로 비어 있었습니다. 아래 「열린 사람이 차례로 나옴」이 그때도
  // `archer,rogue` 를 기다리고 있어서 **틀린 것을 옳다고 적고 있었습니다.**
  const 글있나 = await page.evaluate(() => CLASSES
    .filter((c) => c.unlockFloor || c.unlockCoins)
    .map((c) => ({ key: c.key, 이름: c.name,
      글: !!(CFG.story.meetings && CFG.story.meetings[c.key]) })));
  const 글없는 = 글있나.filter((c) => !c.글).map((c) => c.이름);
  check(글없는.length === 0,
    '**열리는 사람 일곱 모두 만날 글이 있음** (없으면 그 해금은 조용히 빈칸)',
    글없는.length ? '없는 사람: ' + 글없는.join(', ') : 글있나.length + '명 다 있음');

  await fresh();

  // **기다리는 이름을 손으로 적지 않습니다.** 직업이 늘 때마다 손으로 적은
  // 목록은 같이 안 고쳐지고, 그러면 시험이 틀린 것을 옳다고 적습니다.
  //
  // 판을 **끝내기 전에** 물어봅니다 — 끝나고 나면 그 사람들이 이미 열려
  // 있어서(Save.data.unlocked) classesUnlockedBy 가 빈손으로 돌아옵니다.
  const 열릴것 = await page.evaluate(() =>
    classesUnlockedBy(700, 2000).map((c) => c.key).sort());

  // 한 판에 오를 수 있는 만큼 올라, 열리는 사람이 여럿인 판으로 끝냅니다.
  await runEnd(700, 2000);
  await page.waitForTimeout(500);

  const choices = await page.evaluate(() => window.__scene.deathChoices);
  await page.mouse.click(choices[0].x * 0.75, choices[0].y * 0.75); // 「메달 받기」
  await page.waitForTimeout(700);

  const met = await page.evaluate(() => (window.__meet
    ? { live: true, jobs: window.__meet.jobs.slice(), at: window.__meet.at }
    : { live: false }));
  check(met.live, '해금되면 고른 뒤에 만남 컷이 나옴');
  // 나오는 차례는 CLASSES 에 앉은 순서라 해금 조건 순서와 다릅니다.
  // 여기서 볼 것은 **하나도 안 빠졌는가**이지 차례가 아닙니다.
  check(met.live && met.jobs.slice().sort().join(',') === 열릴것.join(','),
    '**열린 사람이 하나도 안 빠지고 나옴**',
    (met.jobs || []).join(' → ') + '  (열려야 할 사람 ' + 열릴것.join(', ') + ')');

  if (met.live) {
    // 마지막 사람까지 하나씩 넘겨 봅니다 — 둘로 못박으면 셋이 열리는 날
    // 셋째가 안 나와도 시험이 지나갑니다.
    for (let i = 1; i < met.jobs.length; i++) {
      await page.mouse.click(270 * 0.75, 400 * 0.75);
      await page.waitForTimeout(300);
      const at = await page.evaluate(() => (window.__meet ? window.__meet.at : -1));
      check(at === i, '탭하면 다음 사람으로 (' + (i + 1) + '번째)', at);
    }
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
