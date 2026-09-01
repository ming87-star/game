// 타이틀의 **코드 입력**이 제 일을 하는지 봅니다 (js/codes.js).
//
// 여기서 가장 값진 검사는 **「엔딩 코드가 기록을 안 건드리는가」** 입니다.
// 예전 방식(주소 끝의 #ending)은 저장을 통째로 세워 놓고 들어갔고, 그래서
// 백업을 따로 떠야 했습니다. 지금은 미리보기로만 돌아야 합니다 — 여기가
// 새면 손으로 한 번 눌러 본 것이 「이 사람은 엔딩을 봤다」가 되어 판이
// 닫힙니다. 화면으로는 안 보이는 새김입니다.
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
  const port = Number(process.env.PORT) || 8142;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  let bad = 0;
  const check = (ok, label, got) => {
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
  };
  const 장면 = () => page.evaluate(() =>
    window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','));
  const 넣기 = async (d) => {
    await page.evaluate((s) => { for (const k of s) window.__code.press(k); }, d);
    await page.waitForTimeout(500);
  };
  const 새로 = async (hash) => {
    await page.goto('http://localhost:' + port + '/' + (hash || ''), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 20000 });
  };

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    sawStory: true, lastJob: 'warrior', unlocked: {} })));
  await 새로();
  console.log('');

  // ── 옛 문이 죽었는가 ───────────────────────────────────
  //
  // 주소 끝에 붙이던 방식은 **의도 없이도 열렸습니다.** 주소를 잘못 만지면
  // 기록이 통째로 세워졌습니다. 걷어냈는지를 글자가 아니라 **실제로 붙여
  // 켜 보고** 확인합니다.
  await 새로('#ending');
  const 옛문 = await page.evaluate(() => ({
    세움: !!window.__save.data.devSeeded,
    단계: window.__save.endingStage,
    메달: window.__save.medals,
    장면: window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','),
  }));
  check(!옛문.세움 && 옛문.단계 === 0 && 옛문.메달 === 0 && 옛문.장면 === 'title',
    '주소에 #ending 을 붙여도 아무 일이 없음 (옛 방식은 걷어냈습니다)',
    `단계 ${옛문.단계} · 메달 ${옛문.메달} · ${옛문.장면}`);
  check(!/devDoor|DEV_BACKUP|tower-climb-v1-backup/.test(
    fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8')
    + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')),
    '뒷문 파일이 어디에도 안 걸려 있음');

  // ── 표가 성한가 ────────────────────────────────────────
  await 새로();
  const 표 = await page.evaluate(() => CODES.map((c) => c.code));
  check(표.length > 0 && 표.every((c) => /^\d{6}$/.test(c)),
    '코드가 모두 여섯 자리 숫자', 표.join(' · '));
  check(new Set(표).size === 표.length, '같은 코드가 둘 있지 않음', 표.length + '개');

  // ── 타이틀에서 들어가는가 ──────────────────────────────
  const at = await page.evaluate(() => window.__title.codeAt);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(600);
  check(await 장면() === 'code', '타이틀의 「코드 입력」으로 들어감', await 장면());

  // ── 돌아와서 타이틀이 **다시 눌리는가** ────────────────
  //
  // 이 검사가 생긴 까닭. 코드 화면을 열 때 밑에 깔린 「눌러서 계속」이
  // 같이 먹지 않게 goingCode 를 세워 두는데, 그걸 **아무 데서도 안
  // 지웠습니다.** Phaser 는 scene.start 마다 장면을 새로 만들지 않고
  // create() 만 다시 돌리므로, 인스턴스에 붙은 값은 지난번 것이 그대로
  // 남습니다. 그래서 코드 화면을 한 번 열어 본 사람은 돌아온 뒤로
  // **타이틀이 영영 안 눌렸습니다** — go() 가 첫 줄에서 되돌아갑니다.
  // 오류도 안 나고 화면도 멀쩡합니다. 그냥 아무 일도 안 일어납니다.
  //
  // 엔딩을 코드로 보고 나온 사람이 바로 이 자리에 갇혔습니다.
  await page.evaluate(() => window.__code.scene.start('title'));
  await page.waitForFunction(() =>
    window.__game.scene.getScenes(true).map((x) => x.scene.key).join(',') === 'title'
    && window.__title.ready, null, { timeout: 20000 });
  const 깃발 = await page.evaluate(() => window.__title.goingCode);
  check(깃발 === false, '돌아오면 코드 깃발이 내려감 (장면 객체는 다시 쓰입니다)', String(깃발));
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(900);
  const 눌렸나 = await 장면();
  check(눌렸나 !== 'title', '돌아온 뒤에도 타이틀이 눌림',눌렸나);

  // 다시 코드 화면으로 돌아가 나머지를 봅니다
  await page.evaluate(() => window.__game.scene.start('title'));
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 20000 });
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(600);

  // ── 없는 코드 ──────────────────────────────────────────
  await 넣기('000000');
  const 없는 = await page.evaluate(() => ({ 말: window.__code.말.text, 남은: window.__code.digits }));
  check(없는.말.indexOf('없는') >= 0 && 없는.남은 === '',
    '없는 코드는 거절하고 칸을 비움', 없는.말);

  // ── 한 번짜리는 두 번 안 먹는가 ────────────────────────
  const 한번 = await page.evaluate(() => CODES.find((c) => c.once));
  if (한번) {
    await 넣기(한번.code);
    const 처음 = await page.evaluate(() => ({
      말: window.__code.말.text, 쓴것: Object.keys(window.__save.data.usedCodes || {}) }));
    check(처음.쓴것.length === 1, '한 번짜리 코드를 쓰면 저장에 적힘', 처음.말);
    await 넣기(한번.code);
    check((await page.evaluate(() => window.__code.말.text)).indexOf('이미') >= 0,
      '같은 코드를 또 넣으면 안 먹음', await page.evaluate(() => window.__code.말.text));
  }

  // ── 엔딩 코드는 기록을 안 건드리는가 ───────────────────
  //
  // **이 검사가 이 파일의 이유입니다.** 화면은 똑같이 돌아가므로, 새도
  // 눈으로는 모릅니다.
  await 새로();
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(600);
  const 엔딩코드 = await page.evaluate(() =>
    (CODES.find((c) => /엔딩/.test(c.title)) || {}).code);
  await 넣기(엔딩코드);
  await page.waitForTimeout(600);
  const 뒤 = await page.evaluate(() => ({
    장면: window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','),
    단계: window.__save.endingStage,
    봤나: window.__save.sawEnding,
    미리보기: !!(window.__endingline && window.__endingline.preview),
  }));
  check(뒤.장면 === 'endingline', '엔딩 코드를 넣으면 여는 말부터 시작', 뒤.장면);
  check(뒤.미리보기, '미리보기로 들어감');
  check(뒤.단계 === 0 && !뒤.봤나,
    '엔딩 코드는 **기록에 아무것도 안 적음** (되돌릴 일이 없게)',
    `단계 ${뒤.단계} · 봤나 ${뒤.봤나}`);

  // 끝까지 본 뒤에도 안 적혀야 합니다 — leave() 가 markEndingSeen 을 부릅니다.
  await page.evaluate(() => {
    window.__endingline.shown = true;
    window.__endingline.go();
  });
  await page.waitForFunction(() => window.__endingwatch, null, { timeout: 20000 });
  const 보는중 = await page.evaluate(() => !!window.__endingwatch.preview);
  check(보는중, '보는 장면까지 미리보기가 이어짐');
  await page.evaluate(() => window.__endingwatch.leave());
  await page.waitForTimeout(700);
  check(await page.evaluate(() => !window.__save.sawEnding),
    '끝까지 봐도 「봤다」로 안 적힘');

  console.log(bad ? `\n${bad}건 어긋남` : '\n코드 입력이 제 일을 하고, 기록은 안 건드립니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
