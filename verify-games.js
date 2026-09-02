// 순위표와 업적의 **셈**을 봅니다.
//
// 구글에 올리는 일은 껍데기와 콘솔 등록이 끝난 뒤에 붙습니다. 그때까지도
// 여기 있는 셈은 그대로 돌아야 하고, **다리가 없다고 게임이 멈추면 안
// 됩니다** — 이 게임은 웹에서도 돕니다 (gh-pages).
//
// 그리고 업적 조건은 저장을 보고 세므로, 저장 모양이 바뀌면 조용히 안
// 맞게 됩니다. 여기서 저장을 심어 놓고 조건마다 눌러 봅니다.
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
  const port = Number(process.env.PORT) || 9740;
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

  // ── 표가 성한가 ────────────────────────────────────────
  const 표 = await page.evaluate(() => ({
    순위: Games.boards.map((b) => b.key),
    업적: Games.deeds.map((a) => a.key),
    이름없는것: Games.deeds.filter((a) => !a.name || !a.desc).map((a) => a.key),
    참없는것: Games.deeds.filter((a) => typeof a.참 !== 'function').map((a) => a.key),
    숨김: Games.deeds.filter((a) => a.hidden).map((a) => a.key),
  }));
  check(new Set(표.순위).size === 표.순위.length, '순위표 이름이 안 겹침', 표.순위.join(' '));
  check(new Set(표.업적).size === 표.업적.length, '업적 이름이 안 겹침', 표.업적.length + '가지');
  check(표.이름없는것.length === 0, '업적마다 이름과 설명이 있음',
    표.이름없는것.join(' ') || '다 있음');
  check(표.참없는것.length === 0, '업적마다 조건이 있음', 표.참없는것.join(' ') || '다 있음');
  // 콘솔에 넣을 때 쓰는 이름은 영문·숫자·붙임표여야 헷갈리지 않습니다.
  const 이상한이름 = 표.업적.concat(표.순위).filter((k) => !/^[a-z0-9-]+$/.test(k));
  check(이상한이름.length === 0, '이름이 영문 소문자·숫자·붙임표뿐',
    이상한이름.join(' ') || '다 성함');

  // ── 다리가 없어도 안 터지는가 ──────────────────────────
  //
  // **여기가 이 파일에서 가장 값진 검사입니다.** 웹에서 판이 끝날 때마다
  // 이 길을 지나갑니다. 여기서 터지면 죽음 화면이 안 뜹니다.
  const 다리없이 = await page.evaluate(() => {
    Games.bridge = null;
    try {
      const r = Games.report(Save.data);
      return { 터짐: false, 순위: r.순위.length, 붙었나: Games.붙었나() };
    } catch (e) { return { 터짐: true, 왜: e.message }; }
  });
  check(!다리없이.터짐, '다리가 없어도 안 터짐', 다리없이.터짐 ? 다리없이.왜 : '멀쩡');
  check(다리없이.붙었나 === false, '다리가 없으면 안 붙은 것으로 봄');

  // 다리가 있는데 그 다리가 터지는 경우까지
  const 터지는다리 = await page.evaluate(() => {
    Games.bridge = {
      signedIn: () => true,
      submit: () => { throw new Error('다리가 터졌습니다'); },
      unlock: () => { throw new Error('다리가 터졌습니다'); },
    };
    try { Games.report(Save.data); Games.bridge = null; return { 터짐: false }; }
    catch (e) { Games.bridge = null; return { 터짐: true, 왜: e.message }; }
  });
  check(!터지는다리.터짐, '다리가 터져도 판은 안 멈춤',
    터지는다리.터짐 ? 터지는다리.왜 : '멀쩡');

  // ── 조건이 저장을 제대로 보는가 ────────────────────────
  //
  // 빈 저장에서는 하나도 안 차야 하고, 다 채운 저장에서는 다 차야 합니다.
  // 가운데가 맞는지는 몇 개를 짚어 봅니다.
  const 빔 = await page.evaluate(() => {
    const d = { bestFloor: 0, bestCoins: 0, runs: 0, unlocked: {}, relics: {},
      perks: {}, weapons: {}, bossesBeaten: {}, frogsCaught: 0, endingStage: 0, sawEnding: false };
    return Games.report(d).업적;
  });
  check(빔.length === 0, '갓 시작한 사람은 업적이 하나도 안 참', 빔.join(' ') || '0가지');

  const 다참 = await page.evaluate(() => {
    const 채운그릇 = (n, 값) => {
      const o = {}; for (let i = 0; i < n; i++) o['k' + i] = 값 === undefined ? true : 값; return o;
    };
    const d = {
      bestFloor: 2000, bestCoins: 3000, runs: 50,
      unlocked: 채운그릇(8), relics: 채운그릇(35), bossesBeaten: 채운그릇(5),
      frogsCaught: 10, endingStage: 2, sawEnding: true,
      // 마흔여덟 = 여덟 직업 × 여섯
      perks: Object.fromEntries([...Array(8)].map((_, i) => ['j' + i, 채운그릇(6)])),
      // 서른여섯 = 여덟 직업에 나눠서
      weapons: Object.fromEntries([...Array(8)].map((_, i) => ['j' + i, 채운그릇(i < 4 ? 5 : 4, {})])),
    };
    return { 찬것: Games.report(d).업적, 전부: Games.deeds.length };
  });
  check(다참.찬것.length === 다참.전부, '다 이룬 사람은 업적이 다 참',
    다참.찬것.length + ' / ' + 다참.전부);

  // 경계 — 하나 모자라면 안 차야 합니다
  const 경계 = await page.evaluate(() => {
    const 재기 = (고침) => {
      const d = Object.assign({ bestFloor: 0, bestCoins: 0, runs: 0, unlocked: {}, relics: {},
        perks: {}, weapons: {}, bossesBeaten: {}, frogsCaught: 0, endingStage: 0, sawEnding: false }, 고침);
      return Games.report(d).업적;
    };
    return {
      '99층': 재기({ bestFloor: 99 }).includes('floor-100'),
      '100층': 재기({ bestFloor: 100 }).includes('floor-100'),
      '유물34': 재기({ relics: Object.fromEntries([...Array(34)].map((_, i) => ['r' + i, true])) }).includes('relic-all'),
      '유물35': 재기({ relics: Object.fromEntries([...Array(35)].map((_, i) => ['r' + i, true])) }).includes('relic-all'),
      '보스4': 재기({ bossesBeaten: { a: 1, b: 1, c: 1, d: 1 } }).includes('boss-all'),
      '보스5': 재기({ bossesBeaten: { a: 1, b: 1, c: 1, d: 1, e: 1 } }).includes('boss-all'),
    };
  });
  check(!경계['99층'] && 경계['100층'], '99층에서는 안 차고 100층에서 참');
  check(!경계['유물34'] && 경계['유물35'], '유물 서른넷에서는 안 차고 서른다섯에서 참');
  check(!경계['보스4'] && 경계['보스5'], '보스 넷에서는 안 차고 다섯에서 참');

  // ── 세는 수가 게임의 실제 수와 맞는가 ──────────────────
  //
  // 업적에 적은 「서른다섯」「마흔여덟」「서른여섯」이 게임과 어긋나면
  // **영영 못 받는 업적**이 됩니다. 실제 표에서 세어 대 봅니다.
  const 실제 = await page.evaluate(() => ({
    유물: (typeof RELICS !== 'undefined' ? RELICS.length : -1),
    직업: (typeof CLASSES !== 'undefined' ? CLASSES.length : -1),
    보스: (CFG.boss.kinds || []).length,
  }));
  check(실제.유물 === 35, '업적이 말하는 유물 수 = 실제 유물 수', 실제.유물 + '개');
  check(실제.직업 === 8, '업적이 말하는 직업 수 = 실제 직업 수', 실제.직업 + '명');
  check(실제.보스 === 5, '업적이 말하는 보스 종 = 실제 보스 종', 실제.보스 + '종');

  // ── 저장이 실제로 적는가 ───────────────────────────────
  const 적힘 = await page.evaluate(() => {
    Save.markBoss('boss-warden');
    Save.markBoss('boss-warden');   // 두 번 세면 안 됩니다
    Save.markFrog();
    const d = JSON.parse(window.localStorage.getItem('tower-climb-v1'));
    return { 보스: Object.keys(d.bossesBeaten || {}).length, 개구리: d.frogsCaught };
  });
  check(적힘.보스 === 1, '같은 보스를 두 번 눕혀도 한 번만 셈', 적힘.보스 + '종');
  check(적힘.개구리 === 1, '황금개구리가 저장에 적힘', 적힘.개구리 + '마리');

  await page.evaluate(() => { window.localStorage.removeItem('tower-climb-v1'); Save.load(); });

  console.log('\n  순위표 ' + 표.순위.length + '가지 · 업적 ' + 표.업적.length
    + '가지 (숨김 ' + 표.숨김.length + ')');
  console.log(bad ? `\n${bad}건 어긋남` : '\n순위표와 업적의 셈이 맞고, 다리가 없어도 판이 안 멈춥니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
