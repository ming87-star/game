// ── 갈라진 가면이 얼굴에 씌워지는가 ──────────────────────
//
// 가면은 물리 몸 한가운데에서 16px 위에 그냥 놓여 있었습니다. 그런데 겉몸은
// **발을 축으로** 그려지고(js/motion.js) 자세마다 머리가 딴 데 가 있어서,
// 가면이 얼굴을 비켜 가슴을 덮고 투구가 뒤로 삐져나왔습니다. 어긋난 정도도
// 직업마다 달랐습니다 — 도적이 가장 크게 숙입니다.
//
// 지금은 시트 그림에서 머리 자리를 찾습니다. 그러면 재야 할 것이 하나
// 늘어납니다: **자루 일흔다섯 × 컷 여덟**에서 그 찾기가 매번 머리를 맞히는가.
// 쉬는 자세 셋만 눈으로 보고 넘어가면, 어느 자루의 어느 컷에서 가면이 칼에
// 붙어 있어도 아무도 모릅니다.
//
// 「머리를 맞혔다」는 세 가지로 봅니다 — 찾은 자리가 (1) 그림이 있는 자리이고
// (2) 몸의 위쪽에 있고 (3) 발에서 옆으로 너무 벗어나지 않았는가.
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
  const port = Number(process.env.PORT) || 9618;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 900, deaths: 0, runs: 0, bestCoins: 0, medals: 0,
    weapons: {}, boosts: {}, relics: {}, unlocked: { archer: true, rogue: true },
    lastJob: 'warrior', sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });
  await page.waitForTimeout(900);

  // ── 1. 자루마다 · 컷마다 머리를 맞히는가 ────────────────
  const scan = await page.evaluate(() => {
    const s = window.__scene;
    const t0 = performance.now();
    // 시트는 자루마다가 아니라 `sheet` 번호로 나뉩니다 (js/motion.js 의
    // sheetKey). 구워진 것을 통째로 훑으면 빠지는 것이 없습니다.
    const 시트들 = Object.keys(SHEET_ART)
      .filter((key) => s.textures.exists(key))
      .map((key) => ({ job: key, key }));

    const 어긋남 = [];
    let 잰컷 = 0;
    시트들.forEach(({ job, key }) => {
      const d = SHEET_ART[key];
      const h = headAnchors(s, key, d);
      if (!h) { 어긋남.push(job + ' ' + key + ': 못 찾음'); return; }
      // 픽셀을 다시 읽어 그 자리에 정말 그림이 있는지 봅니다.
      const src = s.textures.get(key).getSourceImage();
      const cv = document.createElement('canvas');
      cv.width = src.width; cv.height = src.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0);
      const px = ctx.getImageData(0, 0, cv.width, cv.height).data;

      h.forEach((a, i) => {
        잰컷++;
        const X = Math.round(i * d.fw + a.x);
        const Y = Math.round(a.y);
        const 있음 = X >= 0 && X < cv.width && Y >= 0 && Y < cv.height
          && px[((Y * cv.width) + X) * 4 + 3] > 40;
        // 몸의 위쪽 절반 안에 있어야 합니다 (머리끝 ~ 허리께).
        const 위쪽 = a.y >= d.ground - d.hero - 2 && a.y <= d.ground - d.hero * 0.5;
        // 발에서 옆으로 반 키 넘게 벗어나면 그건 뻗은 무기입니다.
        const 곁 = Math.abs(a.x - d.foot) <= d.hero * 0.5;
        if (!있음 || !위쪽 || !곁) {
          어긋남.push(`${job} ${key} 컷${i}: ${!있음 ? '빈자리' : ''}${!위쪽 ? '높이' : ''}${!곁 ? '옆으로' : ''}`);
        }
      });
    });
    return { 시트수: 시트들.length, 잰컷, 어긋남, ms: Math.round(performance.now() - t0) };
  });

  check(scan.시트수 >= 12, '시트를 두루 봤음', scan.시트수 + '장');

  // ── 한 직업의 시트는 **전부거나 전무**여야 합니다 ────────
  // 시트가 없는 자루로 갈아타면 setWeapon 이 그대로 물러납니다 (js/motion.js
  // 의 「시트가 없으면 그대로 둡니다」). 앞 자루의 시트가 그냥 남습니다.
  //
  // 그러면 **곡괭이를 들고 삽을 휘두르는 사람**이 됩니다. 오류는 안 납니다.
  //
  // 새 직업 다섯의 시트가 들어올 때 한 직업을 절반만 채우고 넘어가면 바로
  // 이 자리입니다 (ART.md 2.6절).
  const 반쪽 = await page.evaluate(() => {
    const out = [];
    CLASSES.forEach((job) => {
      const pool = buildWeaponPool(job);
      // 만듦새를 걷어낸 **자루 갈래**로 셉니다 — 시트는 갈래마다 하나입니다.
      const 갈래 = [...new Set(pool.map((w, i) => sheetKey(job, { index: i, base: w })))];
      const 있는것 = 갈래.filter((k) => typeof SHEET_ART !== 'undefined' && SHEET_ART[k]);
      if (있는것.length && 있는것.length < 갈래.length) {
        out.push(job.name + ' ' + 있는것.length + '/' + 갈래.length);
      }
    });
    return out;
  });
  check(반쪽.length === 0,
    '한 직업의 시트가 **반쪽으로 남아 있지 않음** (전부거나 전무)',
    반쪽.length ? 반쪽.join(' · ') : '반쪽인 직업 없음');
  check(scan.어긋남.length === 0,
    '모든 자루 · 모든 컷에서 머리를 맞힘', scan.잰컷 + '컷 중 어긋남 ' + scan.어긋남.length);
  scan.어긋남.slice(0, 12).forEach((m) => console.log('        ' + m));
  // 한 자루당 한 번만 읽고 적어 두므로, 판이 도는 동안 다시 읽지 않습니다.
  check(scan.ms < 8000, '일흔다섯 자루를 다 읽어도 오래 안 걸림', scan.ms + 'ms');

  // ── 2. 실제로 씌운 가면이 머리 위에 오는가 ──────────────
  const worn = await page.evaluate(() => {
    const out = [];
    ['warrior', 'archer', 'rogue'].forEach((jobKey) => {
      const s = window.__scene;
      s.job = CLASSES.find((c) => c.key === jobKey);
      s.weapon = new Weapon(s.job, 0);
      s.rig.setWeapon(s.job, s.weapon);
      s.rig.sync();
      s.trophies.clear && s.trophies.clear();
      s.trophies.mask = null;
      s.trophies.wearMask();
      s.trophies.updateMask(s.time.now);
      const m = s.trophies.mask;
      const head = s.rig.headPoint();
      const 발 = s.player.y + 24;          // FEET_DY
      const 키 = 52;                        // HERO_H
      out.push({
        직업: s.job.name,
        가면: { x: Math.round(m.x), y: Math.round(m.y), 크기: Math.round(m.displayWidth) },
        머리: head ? { x: Math.round(head.x), y: Math.round(head.y) } : null,
        머리높이대: { 위: Math.round(발 - 키), 아래: Math.round(발 - 키 * 0.45) },
      });
      s.trophies.mask.destroy();
      s.trophies.mask = null;
    });
    return out;
  });
  worn.forEach((w) => {
    check(w.머리 !== null, w.직업 + ' — 머리 자리를 찾음');
    check(w.가면.y >= w.머리높이대.위 - 4 && w.가면.y <= w.머리높이대.아래,
      w.직업 + ' — 가면이 머리 높이에 옴',
      w.가면.y + ' (머리높이 ' + w.머리높이대.위 + '~' + w.머리높이대.아래 + ')');
    // 예전에는 34px 였습니다 — 키(52)의 3분의 2라 가슴까지 덮었습니다.
    check(w.가면.크기 <= 30, w.직업 + ' — 가면이 몸을 다 덮지 않음', w.가면.크기 + 'px');
  });

  // ── 3. 몸을 뒤집으면 가면도 따라 뒤집히는가 ─────────────
  const flip = await page.evaluate(() => {
    const s = window.__scene;
    s.job = CLASSES.find((c) => c.key === 'rogue');
    s.weapon = new Weapon(s.job, 0);
    s.rig.setWeapon(s.job, s.weapon);
    s.player.setFlipX(false); s.rig.sync();
    s.trophies.mask = null; s.trophies.wearMask();
    const 오른쪽 = s.trophies.mask.x - s.player.x;
    s.player.setFlipX(true); s.rig.sync();
    s.trophies.updateMask(s.time.now);
    const 왼쪽 = s.trophies.mask.x - s.player.x;
    s.trophies.mask.destroy(); s.trophies.mask = null;
    return { 오른쪽: Math.round(오른쪽), 왼쪽: Math.round(왼쪽) };
  });
  check(Math.abs(flip.오른쪽 + flip.왼쪽) <= 1 && Math.abs(flip.오른쪽) > 2,
    '몸을 뒤집으면 가면도 반대쪽으로 (얼굴을 따라감)',
    flip.오른쪽 + ' ↔ ' + flip.왼쪽);

  console.log(bad ? `\n${bad}건 어긋남` : '\n가면이 얼굴에 제대로 씌워집니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
