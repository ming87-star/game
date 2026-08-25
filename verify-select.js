// 직업 고르기 — 격자와 실루엣이 제대로 서는지 봅니다.
//
// ── 이 시험이 생긴 까닭 ─────────────────────────────────
// 잠긴 직업을 새까맣게 칠하는 데 `setTintFill` 을 썼습니다. Phaser 4 에서
// 그 함수는 **있기는 한데 아무 일도 안 합니다** — `tint` 가 안 바뀌고
// **오류도 안 납니다.** 화면에는 초상화가 색깔 그대로 떠 있었고, 그림이
// 잘 나오고 있으니 얼핏 멀쩡해 보였습니다.
//
// 「그려졌는가」를 묻는 시험은 이걸 못 잡습니다. 그려지긴 했으니까요.
// **「무슨 색으로 그려졌는가」**를 물어야 잡힙니다. 그래서 여기서는 구워진
// 실루엣의 픽셀을 직접 셉니다.
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
const check = (ok, what, note) => {
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : '틀림 ') + ' ' + what + (note === undefined ? '' : '  → ' + note));
};

(async () => {
  const port = Number(process.env.PORT) || 8123;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const open = async (save) => {
    await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
    await page.evaluate((s) => window.localStorage.setItem('tower-climb-v1', JSON.stringify(s)),
      Object.assign({ sawStory: true }, save));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__game.scene.start('select'));
    await page.waitForFunction(() => window.__select && window.__select.picked,
      null, { timeout: 8000 });
    await page.waitForTimeout(300);
  };

  // ── 실루엣이 진짜로 검은가 ───────────────────────────────
  await open({ bestFloor: 320, bestCoins: 640 });   // 궁수·도적이 잠긴 판

  const sil = await page.evaluate(() => {
    const s = window.__select;
    const out = {};
    ['archer', 'rogue'].forEach((k) => {
      const tex = s.textures.exists('sil-' + k) && s.textures.get('sil-' + k);
      if (!tex) { out[k] = null; return; }
      const src = tex.getSourceImage();
      const cv = document.createElement('canvas');
      cv.width = src.width; cv.height = src.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(src, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let 검정 = 0, 외곽선 = 0, 그밖 = 0, 빈칸 = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) { 빈칸++; continue; }
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r < 8 && g < 8 && b < 8) 검정++;
        else if (Math.abs(r - 0x5a) < 6 && Math.abs(g - 0x67) < 6 && Math.abs(b - 0x95) < 6) 외곽선++;
        else 그밖++;
      }
      out[k] = { 검정, 외곽선, 그밖, 빈칸, w: cv.width, h: cv.height };
    });
    return out;
  });

  ['archer', 'rogue'].forEach((k) => {
    const g = sil[k];
    check(!!g, k + ' — 실루엣이 구워짐', g ? g.w + '×' + g.h : '없음');
    if (!g) return;
    // **알맹이입니다.** 색깔이 한 점이라도 남아 있으면 칠이 안 먹은 것입니다.
    check(g.그밖 === 0, k + ' — 검정과 외곽선 말고 다른 색이 없음', g.그밖 + '픽셀');
    check(g.검정 > 1000, k + ' — 몸이 새까맣게 칠해짐', g.검정 + '픽셀');
    // 외곽선이 몸을 두르므로 둘레만큼은 나옵니다. 0 이면 안 둘린 것입니다.
    check(g.외곽선 > 200, k + ' — 외곽선이 둘림', g.외곽선 + '픽셀');
  });

  // 잠긴 칸에 **진짜 초상화가 안 깔렸는지**. 실루엣을 얹어 놓고 그 아래
  // 원본이 남아 있으면 가장자리로 색이 삐져나옵니다.
  const drawn = await page.evaluate(() => {
    const keys = [];
    window.__select.children.list.forEach((o) => { if (o.texture) keys.push(o.texture.key); });
    return keys;
  });
  check(!drawn.includes('face-archer') && !drawn.includes('face-rogue'),
    '잠긴 직업은 원본 초상화를 안 그림',
    drawn.filter((k) => k.startsWith('face-') || k.startsWith('sil-')).join(' · '));

  // ── 이름과 조건 ─────────────────────────────────────────
  const texts = () => page.evaluate(() => {
    const out = [];
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text') out.push(o.text);
      if (o.list) walk(o.list);
    });
    walk(window.__select.children.list);
    return out;
  });

  let t = await texts();
  check(!t.some((x) => x === '궁수' || x === '도적'),
    '잠긴 직업의 이름이 화면 어디에도 없음', t.filter((x) => x === '???').length + '개가 ???');

  // 잠긴 것을 골라 봅니다 — **조건은 가리지 않습니다.** 누구인지는 궁금해야
  // 하지만 어떻게 여는지까지 가리면 궁금한 게 아니라 막힌 것입니다.
  const at = await page.evaluate(() => window.__select.jobAt('rogue'));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(300);
  t = await texts();
  check(t.some((x) => x.indexOf('700층') >= 0 && x.indexOf('2000') >= 0),
    '잠긴 직업도 해금 조건은 그대로 보여 줌',
    (t.find((x) => x.indexOf('700층') >= 0) || '없음'));
  check(t.some((x) => x.indexOf('있다고 합니다') >= 0), '소문 한 줄이 뜸',
    (t.find((x) => x.indexOf('있다고') >= 0) || '없음'));
  check(!t.includes('시작하기'), '잠긴 직업에는 시작 단추가 없음');
  const startNull = await page.evaluate(() => window.__select.startAt);
  check(startNull === null, '잠긴 직업으로는 판을 시작할 수 없음', String(startNull));

  // 잠긴 칸을 골랐을 때 **그 직업의 색이 새어 나오면 안 됩니다.** 도적은 보라,
  // 궁수는 초록이라, 실루엣으로 애써 가려 놓고 테두리가 알려 주게 됩니다.
  const leak = await page.evaluate(() => {
    const c = window.__select.cells.rogue.box;
    return { 테두리: c.strokeColor, 직업색: classByKey('rogue').color };
  });
  check(leak.테두리 !== leak.직업색, '잠긴 칸을 골라도 직업 색이 안 새어 나옴',
    '0x' + leak.테두리.toString(16) + ' ≠ 0x' + leak.직업색.toString(16));

  // ── 여덟이 들어가는가 ───────────────────────────────────
  // 한동안은 셋뿐이라 **가짜 다섯을 끼워 넣어** 미리 쟀습니다. 이제 진짜
  // 여덟이 있으므로 그대로 봅니다 — 가짜를 그냥 두었더니 열셋이 되어
  // 이 검사가 통째로 멎었습니다.
  //
  // 여기서 보는 것은 셋일 때와 같습니다. 격자가 넘치는가, 세부 패널이
  // 아래 단추를 밟는가, 스크롤 없이 한 화면에 들어가는가.
  await open({ bestFloor: 1200, bestCoins: 4000, medals: 6,
    unlocked: { archer: true, rogue: true, monk: true, hunter: true,
      necro: true, wizard: true, digger: true } });
  await page.waitForTimeout(300);

  const fit = await page.evaluate(() => {
    const s = window.__select;
    let 왼 = 1e9, 오 = -1e9, 위 = 1e9, 아래 = -1e9;
    Object.keys(s.cells).forEach((k) => {
      const b = s.cells[k].box.getBounds();
      왼 = Math.min(왼, b.left); 오 = Math.max(오, b.right);
      위 = Math.min(위, b.top); 아래 = Math.max(아래, b.bottom);
      const l = s.cells[k].label.getBounds();
      아래 = Math.max(아래, l.bottom);
    });
    // 세부 패널이 실제로 어디까지 내려오는지
    let 패널아래 = -1e9;
    s.detail.list.forEach((o) => { 패널아래 = Math.max(패널아래, o.getBounds().bottom); });
    return { 왼, 오, 위, 아래, 패널아래, 단추위: CFG.height - 78,
      폭: CFG.width, 높이: CFG.height, 칸수: Object.keys(s.cells).length };
  });

  check(fit.칸수 === 8, '여덟 칸이 다 섬', fit.칸수 + '칸');
  check(fit.왼 >= 18 && fit.오 <= fit.폭 - 18, '격자가 좌우로 안 넘침',
    Math.round(fit.왼) + ' ~ ' + Math.round(fit.오) + ' (화면 ' + fit.폭 + ')');
  check(fit.아래 < fit.단추위, '격자가 아래 단추를 안 밟음',
    Math.round(fit.아래) + ' < ' + fit.단추위);
  check(fit.패널아래 <= fit.단추위 + 2, '세부 패널이 아래 단추를 안 밟음',
    Math.round(fit.패널아래) + ' ≤ ' + fit.단추위);
  check(fit.아래 < fit.높이 && fit.패널아래 < fit.높이,
    '스크롤 없이 한 화면에 다 들어감',
    '가장 아래 ' + Math.round(Math.max(fit.아래, fit.패널아래)) + ' / ' + fit.높이);

  // ── 마지막에 오른 직업이 골라진 채로 ─────────────────────
  // 이게 있어야 늘 같은 직업으로 오르는 사람이 **여전히 한 번만** 누릅니다.
  await open({ bestFloor: 820, bestCoins: 2400, unlocked: { archer: true, rogue: true },
    lastJob: 'rogue' });
  check(await page.evaluate(() => window.__select.picked) === 'rogue',
    '마지막에 오른 직업이 이미 골라진 채로 들어옴');

  // 잠긴 직업이 마지막이었다면(기록을 지웠다든지) 전사로 물러섭니다.
  await open({ lastJob: 'rogue' });
  check(await page.evaluate(() => window.__select.picked) === 'warrior',
    '마지막 직업이 잠겼으면 전사로 물러섬');

  // ── 판 안에 설 몸이 있는가 ──────────────────────────────
  // 고르는 화면은 `face-<직업>`, **판 안은 `player-<직업>`** 입니다. 서로
  // 다른 그림이라 하나만 있어도 이 화면은 멀쩡해 보입니다 — 그런데 판에
  // 들어가면 **초록 X 상자**가 서 있습니다 (Phaser 의 __MISSING). 오류는
  // 안 납니다.
  //
  // 실제로 그랬습니다. 새 직업 다섯을 붙이고 고르기 화면까지 다 맞춰 놨는데,
  // 사령술사로 판에 들어가 보니 주인공이 초록 상자였습니다.
  // **판 장면에서 봅니다.** 고르기 화면은 buildTextures 를 안 부르므로
  // 거기서는 player-* 가 하나도 없습니다 (처음에 여기서 재다가 여덟이 다
  // 없다고 나왔습니다).
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player,
    null, { timeout: 8000 });

  const 몸 = await page.evaluate(() => {
    const s = window.__scene;
    return CLASSES.map((j) => ({
      key: j.key, name: j.name,
      face: s.textures.exists('face-' + j.key),
      body: s.textures.exists('player-' + j.key),
    }));
  });
  const 없는몸 = 몸.filter((x) => !x.body).map((x) => x.name);
  const 없는얼굴 = 몸.filter((x) => !x.face).map((x) => x.name);
  check(없는몸.length === 0, '여덟 다 **판 안에 설 몸**이 있음 (player-*)',
    없는몸.length ? '없음: ' + 없는몸.join(' · ') : 몸.length + '개 다 있음');
  check(없는얼굴.length === 0, '여덟 다 고르기 화면에 설 얼굴이 있음 (face-*)',
    없는얼굴.length ? '없음: ' + 없는얼굴.join(' · ') : 몸.length + '개 다 있음');

  // 몸이 서로 달라야 합니다 — 하나를 돌려 쓰면 판에서 누구인지 안 보입니다.
  const 다름 = await page.evaluate(() => {
    const s = window.__scene;
    const seen = new Map();
    const 겹침 = [];
    CLASSES.forEach((j) => {
      const src = s.textures.get('player-' + j.key).getSourceImage();
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      const sig = c.toDataURL();
      if (seen.has(sig)) 겹침.push(seen.get(sig) + ' ↔ ' + j.name);
      else seen.set(sig, j.name);
    });
    return 겹침;
  });
  check(다름.length === 0, '여덟의 몸이 서로 다름',
    다름.length ? 다름.join(' · ') : '겹친 것 없음');

  console.log(bad ? `\n${bad}건 어긋남` : '\n고르기 화면이 제대로 섭니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
