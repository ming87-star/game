// 저장. **한 번 내보내고 나면 모양을 마음대로 못 바꾸는 자리**입니다.
//
// 이미 오르고 있던 사람의 폰에 예전 모양이 들어 있고, 새 판이 그걸 읽어야
// 합니다. 여기가 틀리면 「업데이트하고 나니 기록이 다 날아갔다」가 됩니다 —
// 그리고 그건 되돌릴 수가 없습니다.
//
// 화면으로는 아무것도 안 보이는 자리라, 재는 수밖에 없습니다.
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
  const port = Number(process.env.PORT) || 9730;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title, null, { timeout: 30000 });

  // 저장을 이렇게 심어 놓고 다시 읽게 합니다.
  const 읽히기 = (넣을것) => page.evaluate((넣을것) => {
    if (넣을것 === null) window.localStorage.removeItem('tower-climb-v1');
    else window.localStorage.setItem('tower-climb-v1', 넣을것);
    Save.load();
    return {
      판: Save.data.version,
      쓸수있나: Save.usable,
      살렸나: Save.recovered,
      미래에서: Save.fromFuture,
      밟은수: Save.migrated,
      층: Save.data.bestFloor,
      메달: Save.data.medals,
      해금: Object.keys(Save.data.unlocked || {}).join(','),
      직업: Save.data.lastJob,
      // 다시 읽었을 때 저장소에 실제로 남아 있는 것
      적힌것: window.localStorage.getItem('tower-climb-v1'),
    };
  }, 넣을것);

  // ── 1. 처음 켠 사람 ────────────────────────────────────
  const 처음 = await 읽히기(null);
  check(처음.판 >= 1, '새로 시작하면 판 번호가 붙음', 'version ' + 처음.판);
  check(처음.쓸수있나 === true, '처음 켠 사람도 저장이 됨');

  // ── 2. 번호가 없던 시절의 저장 ─────────────────────────
  //
  // 지금까지 나간 모든 저장에는 version 이 없습니다. 그것도 1 로 봐야
  // 하고, **기록이 한 톨도 안 없어져야** 합니다.
  const 옛것 = await 읽히기(JSON.stringify({
    bestFloor: 812, medals: 37, unlocked: { warrior: true, archer: true },
    lastJob: 'archer', sawStory: true,
  }));
  check(옛것.층 === 812 && 옛것.메달 === 37 && 옛것.해금 === 'warrior,archer'
    && 옛것.직업 === 'archer',
    '번호 없던 옛 저장의 기록이 그대로 살아남',
    옛것.층 + '층 · 메달 ' + 옛것.메달 + ' · ' + 옛것.해금);
  check(옛것.판 >= 1, '읽고 나면 번호가 붙음', 'version ' + 옛것.판);
  check(JSON.parse(옛것.적힌것).version >= 1,
    '붙인 번호가 저장소에도 적힘 (다음에 또 안 밟게)',
    'version ' + JSON.parse(옛것.적힌것).version);

  // ── 3. 깨진 저장 ───────────────────────────────────────
  //
  // **여기가 이 파일에서 가장 값진 검사입니다.**
  //
  // 예전에는 JSON.parse 가 터지면 usable = false 로 넘어갔습니다. 그러면
  // 그 뒤로 **영영 저장이 안 됩니다** — 한 바이트가 상한 것 때문에 그
  // 폰에서는 다시는 아무것도 안 남습니다. 아무 말도 없이요. 사람은
  // 「왜 기록이 안 쌓이지」만 느낍니다.
  const 깨짐 = await 읽히기('{"bestFloor": 100, 이건 JSON 이 아닙니다');
  check(깨짐.쓸수있나 === true,
    '깨진 저장을 읽어도 **그 뒤로 저장이 됨** (한 바이트로 폰이 죽지 않게)',
    '쓸 수 있나 ' + 깨짐.쓸수있나);
  check(깨짐.살렸나 === true, '깨진 것을 알아채고 새로 시작함', String(깨짐.살렸나));
  const 덮였나 = await page.evaluate(() => {
    try { return !!JSON.parse(window.localStorage.getItem('tower-climb-v1')); } catch (e) { return false; }
  });
  check(덮였나, '깨진 것을 성한 것으로 덮어써 둠 (다음에 또 안 깨지게)');

  // JSON 이긴 한데 그릇이 아닌 것
  const 딴것 = await 읽히기('[1,2,3]');
  check(딴것.쓸수있나 === true && 딴것.살렸나 === true,
    'JSON 이지만 그릇이 아닌 것도 살려 냄');

  // ── 4. 더 새 판이 쓴 저장 ──────────────────────────────
  //
  // 스토어에서 새 판을 받았다가 되돌린 사람에게 일어납니다. 여기서
  // 덮어쓰면 **새 판이 적어 둔 것을 옛 판이 지웁니다** — 다시 새 판으로
  // 올렸을 때 기록이 사라져 있습니다.
  const 미래 = await 읽히기(JSON.stringify({
    version: 999, bestFloor: 5000, medals: 400, 새칸: '아직 모르는 것',
  }));
  check(미래.미래에서 === true, '더 새 판이 쓴 저장인 것을 알아챔', 'version ' + 미래.판);
  check(미래.쓸수있나 === false, '미래에서 온 저장은 **안 덮어씀**');
  const 그대로 = await page.evaluate(() => {
    Save.data.bestFloor = 1;      // 옛 판이 뭔가 적으려 해도
    Save.flush();
    return JSON.parse(window.localStorage.getItem('tower-climb-v1'));
  });
  check(그대로.bestFloor === 5000 && 그대로.새칸 === '아직 모르는 것',
    '옛 판이 뭘 해도 미래의 저장이 안 상함',
    그대로.bestFloor + '층 · 모르는 칸 ' + (그대로.새칸 === undefined ? '없어짐' : '남음'));
  check(미래.층 === 5000, '읽기는 읽음 (아는 칸만)', 미래.층 + '층');

  // ── 5. 숫자 자리에 숫자가 아닌 것 ──────────────────────
  //
  // NaN 은 게임 전체로 번집니다. 메달이 NaN 이면 상점에서 아무것도 못 사고,
  // 층이 NaN 이면 해금이 영영 안 열립니다. 그리고 저장에 null 로 적혀서
  // 다음 판에도 남습니다 — 그 폰이 영영 못 쓰게 됩니다.
  const 이상 = await 읽히기(JSON.stringify({
    bestFloor: '아주 높이', medals: null, deaths: -5,
    unlocked: 'warrior', lastJob: 42, bestCoins: NaN,
  }));
  check(Number.isFinite(이상.층) && Number.isFinite(이상.메달),
    '숫자 자리에 글자가 들어 있어도 NaN 이 안 됨',
    '층 ' + 이상.층 + ' · 메달 ' + 이상.메달);
  check(이상.해금 === '', '그릇 자리에 글자가 들어 있으면 빈 그릇으로', '해금 [' + 이상.해금 + ']');
  check(이상.직업 === 'warrior', '직업 자리가 이상하면 전사로', 이상.직업);
  const 음수 = await page.evaluate(() => Save.data.deaths);
  check(음수 === 0, '음수는 0 으로', String(음수));

  // ── 6. 저장소가 아예 막힌 자리 ─────────────────────────
  //
  // 사파리 비공개 모드 같은 데입니다. 여기서는 **쓰지도 읽지도** 못하는데,
  // 그래도 게임은 그 판만이라도 굴러가야 합니다.
  const 막힘 = await page.evaluate(() => {
    const 원래 = window.localStorage.getItem;
    try {
      window.localStorage.getItem = () => { throw new Error('막혔습니다'); };
      Save.load();
      return { 쓸수있나: Save.usable, 층: Save.data.bestFloor, 터짐: false };
    } catch (e) {
      return { 터짐: true, 왜: e.message };
    } finally {
      window.localStorage.getItem = 원래;
    }
  });
  check(!막힘.터짐, '저장소가 막혀 있어도 안 터짐', 막힘.터짐 ? 막힘.왜 : '멀쩡');
  check(막힘.쓸수있나 === false && 막힘.층 === 0,
    '막힌 곳에서는 이번 판만 기억함');

  // 뒷정리 — 다음 검사가 이 저장을 물려받지 않게
  await page.evaluate(() => { window.localStorage.removeItem('tower-climb-v1'); Save.load(); });

  console.log(bad ? `\n${bad}건 어긋남` : '\n저장이 판을 넘어 살아남고, 깨져도 되살아나고, 미래의 것을 안 상합니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
