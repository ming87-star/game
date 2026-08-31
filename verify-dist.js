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

// ── 같은 이름의 전역 함수 둘 ────────────────────────────
//
// 이 판에는 모듈이 없습니다. js/*.js 가 <script> 로 차례차례 실려서 **전역
// 하나를 통째로 나눠 씁니다.** 그러니 두 파일이 같은 이름의 함수를 두면
// **뒤에 실린 쪽이 말없이 앞의 것을 덮어씁니다.** 오류도 경고도 없습니다.
//
// 실제로 당했습니다. js/classes.js 에 `withRo`(「전사로」)를 새로 두었는데
// js/scene-meet.js 에 이미 같은 이름(「전사로도」)이 있었고, 그쪽이 뒤에
// 실려서 직업 고르기 화면에 「궁수로도 한 판에서 550층」이 떴습니다.
// 검사 열여덟이 전부 통과한 채로였습니다 — 눈으로 보고서야 찾았습니다.
//
// 브라우저를 안 켜고 파일만 읽어도 되는 검사입니다. 합친 파일이 곧 「전부
// 한 자리에 놓은 것」이라 여기가 제자리입니다.
function 겹치는전역() {
  const 목록 = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  const 자리 = {};
  목록.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    // 줄 맨 앞의 `function 이름(` 만 봅니다 — 안쪽에 들여쓴 것은 그 함수의
    // 지역이라 전역을 안 건드립니다.
    const re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    let m;
    while ((m = re.exec(src))) (자리[m[1]] = 자리[m[1]] || []).push(f);
  });
  return Object.keys(자리).filter((k) => 자리[k].length > 1)
    .map((k) => k + ' (' + 자리[k].join(' · ') + ')');
}

(async () => {
  const 겹침 = 겹치는전역();
  check(겹침.length === 0, '같은 이름의 전역 함수가 둘 있지 않음',
    겹침.length ? 겹침.join(' / ') : '0개');

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

  // ── 0. 뒷문이 안 실렸는가 ─────────────────────────────
  //
  // js/devdoor.js 는 주소 끝에 #ending 만 붙이면 저장을 세워 놓고 엔딩으로
  // 들어가는 문입니다. 만드는 동안에는 있어야 하지만(휴대폰에는 콘솔이
  // 없습니다), **내놓는 파일에 있으면 누구든 주소 한 글자로 엔딩을 열고
  // 남의 기록을 지웁니다.** build.js 가 이 파일만 빼고 합칩니다.
  //
  // 글자가 없는지 보고 끝내지 않습니다 — **실제로 #ending 을 붙여 켜 보고**
  // 아무 일도 안 일어나는지 봅니다. 빼는 것을 잊는 날 여기서 걸립니다.
  check(!/devDoor|DEV_BACKUP/.test(fs.readFileSync(FILE, 'utf8')),
    '합친 파일에 개발용 뒷문이 안 들어감');

  await page.goto('http://localhost:' + port + '/#ending', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const 뒷문 = await page.evaluate(() => ({
    세움: !!(window.__save && window.__save.data.devSeeded),
    단계: window.__save ? window.__save.endingStage : -1,
    메달: window.__save ? window.__save.medals : -1,
  }));
  check(!뒷문.세움 && 뒷문.단계 === 0 && 뒷문.메달 === 0,
    '#ending 을 붙여 켜도 아무 일이 없음',
    `세움 ${뒷문.세움} · 단계 ${뒷문.단계} · 메달 ${뒷문.메달}`);

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  // 1. 시작 화면
  check(await page.evaluate(() => !!window.__game), '합친 파일이 켜짐');

  // 1-1. 타이틀 — **켜면 가장 먼저 서는 화면입니다.** 매번 섭니다.
  //      제목이 뜨고, 「터치해서 계속하기」가 깜빡이고, 누르면 넘어갑니다.
  //      여기가 막히면 게임에 아예 못 들어갑니다.
  const title = await page.evaluate(() => (window.__title
    ? { live: window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','),
      // 「터치해서 계속하기」는 글자일 수도 그림일 수도 있습니다
      // (art/title-hint.webp). 어느 쪽이든 서 있어야 하고, 무엇이라고
      // 적혀 있는지는 hintLabel 이 들고 있습니다.
      hint: window.__title.hintLabel,
      hintUp: !!window.__title.hint && window.__title.hint.visible,
      art: ['title-art', 'title-logo', 'title-hint']
        .filter((k) => window.__title.textures.exists(k)).join(','),
    } : null));
  check(title && title.live === 'title', '켜면 타이틀 화면이 가장 먼저',
    title ? title.live : '안 나옴');
  check(!!title && title.hint === '터치해서 계속하기' && title.hintUp,
    '「터치해서 계속하기」가 서 있음', title ? title.hint : '');
  // 그림 셋이 합친 파일 안에 들어 있는가. 안 들어 있어도 게임은 도는데
  // (글꼴과 어두운 바탕으로 물러납니다) 그러면 타이틀 화면이 통째로 밋밋해집니다.
  check(!!title && title.art === 'title-art,title-logo,title-hint',
    '타이틀 그림 셋이 다 실림', title ? title.art : '');

  // 다 뜰 때까지 기다립니다 — 시계가 아니라 **다 떴다는 표시**를 봅니다.
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  await page.mouse.click(270, 500);
  await page.waitForTimeout(800);

  // 1-2. 오프닝 — **처음 켠 사람이 실제로 보는 첫 화면입니다.**
  //      다른 검사는 전부 sawStory 를 켜 놓고 건너뛰므로, 여기서 한 번은
  //      진짜로 지나가 봐야 합니다. 여기가 막히면 새 사람은 게임을 못 켭니다.
  const story = await page.evaluate(() => (window.__story
    ? { panels: window.__story.panels.length, skip: window.__story.skipAt } : null));
  check(!!story, '처음 켠 사람에게는 오프닝이 먼저 나옴',
    story ? story.panels + '컷' : '안 나옴');

  if (story) {
    // 한 컷씩 넘겨 봅니다 — 넘김이 안 먹으면 건너뛰기 말고는 길이 없습니다.
    for (let i = 1; i < story.panels; i++) {
      await page.mouse.click(270, 400);
      await page.waitForTimeout(220);
    }
    const last = await page.evaluate(() => (window.__story ? window.__story.at : -1));
    check(last === story.panels - 1, '탭할 때마다 다음 컷으로', '마지막 컷 ' + last);

    await page.mouse.click(story.skip.x, story.skip.y);
    await page.waitForTimeout(900);
  }
  const onSelect = await page.evaluate(() =>
    window.__game.scene.getScenes(true).some((s) => s.scene.key === 'select'));
  check(onSelect, '오프닝을 지나면 직업 고르기로');

  // 2. 직업 고르기 → 메달 상점
  // 여기서는 **진짜로 누릅니다** — 이 시험의 알맹이가 「사람 손에서 도는가」라서
  // 좌표를 안 거치면 재는 뜻이 없습니다. 자리만 화면에 물어봅니다.
  const cell = await page.evaluate(() => window.__select.jobAt('warrior'));
  await page.mouse.click(cell.x, cell.y);
  await page.waitForTimeout(300);
  const goAt = await page.evaluate(() => window.__select.startAt);
  await page.mouse.click(goAt.x, goAt.y);
  await page.waitForTimeout(900);
  const medal = await page.evaluate(() => (window.__medal ? window.__medal.startAt : null));
  check(!!medal, '직업을 고르면 메달 상점으로', medal ? JSON.stringify(medal) : '안 넘어감');

  // 3. 「무기 고르기」 → 무기 도감 → 실제로 판이 시작되는가
  //    여기가 핵심입니다. 장면이 안 뜨면 버튼이 안 먹는 것처럼 보입니다.
  if (medal) {
    await page.mouse.click(medal.x, medal.y);
    await page.waitForTimeout(900);
    const book = await page.evaluate(() => (window.__weaponbook
      ? window.__weaponbook.takeAt : null));
    check(!!book, '메달 상점에서 무기 도감으로', book ? JSON.stringify(book) : '안 넘어감');
    if (book) await page.mouse.click(book.x, book.y);
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
