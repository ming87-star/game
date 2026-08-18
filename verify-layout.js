// 화면마다 **글자가 서로 겹치지 않는지**를 훑습니다.
//
// 눈으로 찾으면 놓치는 자리입니다. 겹침은 몇 px 짜리라 스크린샷에서는
// "좀 붙었나?" 정도로 보이고, 화면이 열둘이라 한 번 볼 때마다 다 열어 보기도
// 어렵습니다. 그런데 한글은 글자 상자가 글꼴 크기보다 큽니다 — 24px 글자의
// 상자가 26px 이라, 줄을 24px 간격으로 잡으면 반드시 겹칩니다.
// **자리를 손으로 적는 한 계속 새는 자리**라 셈으로 훑습니다.
//
// 견주는 규칙 셋:
//   · 안 보이는 것(visible false · alpha 0 · 빈 글자)은 뺍니다
//   · **스크롤을 따라가는 것과 화면에 붙박인 것은 섞지 않습니다** — 좌표계가
//     달라서, 발판 위 글자와 HUD 는 겹쳐 보이는 것이 정상입니다
//   · **깊이 100 단위로 층을 나눠 그 안에서만 견줍니다.** 상점·유물 고르기는
//     깊이 300 에 불투명한 판을 깔고 그 위에 글을 얹습니다. 밑에 있는 HUD 는
//     판에 완전히 가려지므로, 좌표만 보면 겹치지만 눈에는 안 보입니다.
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

const SCALE = 405 / 540;
const at = (gx, gy) => [gx * SCALE, gy * SCALE];

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

// 화면에 보이는 모든 Text 의 사각형을 맞대 봅니다.
const PROBE = `(() => {
  const out = [];
  window.__game.scene.scenes.forEach((s) => {
    if (!s.sys.settings.active || !s.sys.settings.visible) return;
    const texts = [];
    const walk = (list, mulAlpha) => list.forEach((o) => {
      const a = mulAlpha * (o.alpha === undefined ? 1 : o.alpha);
      if (o.visible === false || a < 0.05) return;
      if (o.type === 'Container') return walk(o.list, a);
      if (o.type !== 'Text' || !o.text || !String(o.text).trim()) return;
      // 떠올랐다 사라지는 글자(피해·빗나감·주움)는 뺍니다. 같은 순간에 두 번
      // 일어난 일은 스쳐 지나가는 것이 정상이고, 자리를 고칠 방법도 없습니다.
      if (o.name === 'float') return;
      const b = o.getBounds();
      if (b.width < 1 || b.height < 1) return;
      texts.push({ t: String(o.text).replace(/\\n/g, ' '), x: b.x, y: b.y,
        w: b.width, h: b.height, sf: o.scrollFactorX, layer: Math.floor((o.depth || 0) / 100) });
    });
    walk(s.children.list, 1);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if ((a.sf === 0) !== (b.sf === 0)) continue;
      if (a.layer !== b.layer) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      // 2px 까지는 글자 상자의 여백이라 눈에 안 걸립니다.
      if (ox > 2 && oy > 2) {
        out.push(s.scene.key + '  「' + a.t + '」 × 「' + b.t + '」  '
          + Math.round(ox) + '×' + Math.round(oy) + 'px');
      }
    }
  });
  return out;
})()`;

(async () => {
  const port = Number(process.env.PORT) || 9680;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const seed = (o) => page.evaluate((d) =>
    window.localStorage.setItem('tower-climb-v1', JSON.stringify(d)), o);
  const look = async (label, waitMs) => {
    if (waitMs) await page.waitForTimeout(waitMs);
    const hits = await page.evaluate(PROBE);
    check(hits.length === 0, label, hits.length ? '\n      ' + hits.join('\n      ') : '겹침 없음');
  };
  // 화면에 지금 떠 있는 글자들. "안 겹쳤다"가 "아무것도 안 떴다"가 아님을
  // 확인하는 데 씁니다 — 화면이 비면 이 시험은 늘 통과하기 때문입니다.
  const shown = () => page.evaluate(`(() => {
    const out = [];
    window.__game.scene.scenes.forEach((s) => {
      if (!s.sys.settings.active || !s.sys.settings.visible) return;
      const walk = (list, mulAlpha) => list.forEach((o) => {
        const a = mulAlpha * (o.alpha === undefined ? 1 : o.alpha);
        if (o.visible === false || a < 0.05) return;
        if (o.type === 'Container') return walk(o.list, a);
        if (o.type === 'Text' && o.text) out.push(String(o.text));
      });
      walk(s.children.list, 1);
    });
    return out;
  })()`);

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });

  // ── 오프닝 ──────────────────────────────────────────────
  await seed({});
  await page.reload({ waitUntil: 'networkidle' });
  await look('오프닝 첫 컷', 1300);
  for (let i = 0; i < 3; i++) { await page.mouse.click(...at(270, 500)); await page.waitForTimeout(450); }
  await look('오프닝 마지막 컷', 300);

  // ── 직업 고르기 ─────────────────────────────────────────
  // 셋 다 열린 판과 전사만 열린 판은 카드에 적히는 글이 다릅니다.
  await seed({ sawStory: true, unlocked: { archer: true, rogue: true },
    medals: 40, bestFloor: 412, deaths: 7, runs: 9, bestCoins: 3100 });
  await page.reload({ waitUntil: 'networkidle' });
  await look('직업 고르기 — 셋 다 열림', 900);

  await seed({ sawStory: true, medals: 40 });
  await page.reload({ waitUntil: 'networkidle' });
  await look('직업 고르기 — 전사만 열림', 900);

  // ── 유물 도감 ───────────────────────────────────────────
  await page.evaluate(() => window.__game.scene.start('relicbook'));
  await look('유물 도감', 800);
  await page.evaluate(() => window.__game.scene.start('select'));
  await page.waitForTimeout(800);

  // ── 메달 상점 ───────────────────────────────────────────
  await page.mouse.click(...at(270, 288));
  await look('메달 상점 — 아무것도 없음', 800);
  await page.evaluate(() => {
    const m = window.__medal;
    m.items.forEach((i) => Save.addPerk(m.job.key, i.key));
    m.refresh();
  });
  await look('메달 상점 — 전부 지님', 250);

  // ── 무기 도감 ───────────────────────────────────────────
  // 전설 줄이 자루마다 한 줄에서 세 줄까지라, 아래 만듦새 줄과 수치 줄이
  // 밀려 겹치기 쉬운 자리입니다. **전설이 가장 긴 자루**를 골라서 봅니다.
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await look('무기 도감 — 처음 켠 판 (하나만 만남)', 900);

  await page.evaluate(() => {
    const b = window.__weaponbook;
    b.pool.forEach((w) => Save.findWeapon(b.job.key, w.index));
    window.__game.scene.start('weaponbook', { jobKey: b.job.key });
  });
  await look('무기 도감 — 스물넷 다 만남', 900);

  const longest = await page.evaluate(() => {
    const b = window.__weaponbook;
    const w = b.pool.reduce((a, x) =>
      ((x.lore || '').length + (x.detail || '').length
        > (a.lore || '').length + (a.detail || '').length ? x : a));
    const c = b.cells.find((x) => x.index === w.index);
    return { x: c.box.x, y: c.box.y, name: w.name };
  });
  await page.mouse.click(...at(longest.x, longest.y));
  await look('무기 도감 — 전설이 가장 긴 자루 (' + longest.name + ')', 400);

  // ── 판 ─────────────────────────────────────────────────
  await page.evaluate(() => window.__weaponbook.leave());
  await page.waitForTimeout(900);
  // 판이 시작되면 「지니고 오른 것」이 한가운데에 뜹니다. 그동안에도 봅니다.
  await look('판 시작 — 지니고 오른 것', 900);
  await look('판 시작 2초 뒤', 1400);

  // 이름이 가장 긴 자루로 갈아 끼워 봅니다. HUD 의 무기 줄은 이름 길이에 따라
  // 오른쪽으로 밀리므로, 짧은 이름에서 안 겹쳐도 긴 이름에서 겹칠 수 있습니다.
  await page.evaluate(() => {
    const s = window.__scene;
    const pool = s.weapon.table;
    const longest = pool.reduce((a, b) => (b.name.length > a.name.length ? b : a));
    s.weapon.index = longest.index;
    s.weapon.plus = 12; s.weapon.haste = 9; s.weapon.mult = 2;
    s.coins = 999999; s.medals = 88; s.charm = true;
    s.weapon.relics = RELICS.slice(0, 2);
    s.hud.update();
  });
  await look('HUD — 가장 긴 이름 · 강화 가득 · 유물 둘', 300);

  // ── 한가운데 알림 ───────────────────────────────────────
  // 여기가 원래 새던 자리입니다. 알리는 자리가 여섯인데 저마다 제 좌표에
  // 글자를 놓아서, 두 개가 같은 순간에 뜨면 그대로 포개졌습니다. 특히
  // 한 발판에서 새 종류 둘이 함께 깨어나는 일은 판 첫머리에 흔합니다.
  // 이제는 줄을 서므로, **한꺼번에 불러도** 한 번에 하나만 떠야 합니다.
  const together = [
    ['새 적 둘', `s.announceEnemy({ name: '해골' }); s.announceEnemy({ name: '박쥐귀신' })`],
    ['새 적 + 황금개구리', `s.announceEnemy({ name: '해골' }); s.announceGoldFrog()`],
    ['새 적 + 메달', `s.announceEnemy({ name: '해골' }); s.announceMedal()`],
    ['메달 + 규칙', `s.announceMedal(); s.announceGate(s.floorGates()[1])`],
    ['새 적 + 규칙', `s.announceEnemy({ name: '해골' }); s.announceGate(s.floorGates()[0])`],
    ['보스 + 새 적', `s.announceBoss(); s.announceEnemy({ name: '날것' })`],
  ];
  for (const [label, body] of together) {
    await page.evaluate(`(() => { const s = window.__scene; s.clearNotices(); ${body}; })()`);
    await look('알림 겹쳐 부르기 — ' + label, 500);
    // 겹치지 않은 것이 "아무것도 안 떴다"여서는 안 됩니다.
    const on = await shown();
    check(on.some((t) => /새로운 적|황금개구리|메달을 주웠습니다|함정|박쥐|층$/.test(t)),
      '알림 겹쳐 부르기 — ' + label + ' · 뜨긴 떴는가', on.length + '개 중 알림 있음');
    await page.evaluate(() => window.__scene.clearNotices());
    await page.waitForTimeout(150);
  }

  // ── 상점 ───────────────────────────────────────────────
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 100; s.coins = 4000;
    s.shop.show(100);
  });
  await look('상점 — 큰 상점', 500);
  await page.evaluate(() => window.__scene.shop.close());
  await page.waitForTimeout(400);

  // ── 유물 고르기 ─────────────────────────────────────────
  await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [];
    s.openRelicChoice();
  });
  await look('유물 고르기 — 세 장', 500);

  // 꽉 찬 채로 하나 더 고르면 무엇을 버릴지 다시 묻습니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = RELICS.slice(0, CFG.relic.maxHeld);
  });
  let card = await page.evaluate(() => window.__scene.relicChoices[0]);
  await page.mouse.click(...at(card.x, card.y));
  await look('유물 버리기 — 꽉 찼을 때', 500);
  card = await page.evaluate(() => window.__scene.relicSwaps[0]);
  await page.mouse.click(...at(card.x, card.y));
  await page.waitForTimeout(400);
  // 고르기가 끝나야 다음 화면들이 열립니다 (choosing 이 남아 있으면 일시정지가 안 뜹니다).
  check(await page.evaluate(() => !window.__scene.choosing), '유물 고르기가 닫혔는가');

  // ── 무기 갈아타기 ───────────────────────────────────────
  await page.evaluate(async () => {
    const s = window.__scene;
    s.weapon.plus = 9; s.weapon.haste = 6; s.weapon.mult = 2;
    let e;
    for (let i = 0; i < 60; i++) { e = rollWeapon(s.job, 300); if (e.index !== s.weapon.index) break; }
    s.offerWeapon(e);
  });
  await look('무기 갈아타기 창', 800);
  await page.evaluate(() => window.__swap && window.__swap.choose(false));
  await page.waitForTimeout(500);

  // ── 일시정지 ───────────────────────────────────────────
  await page.evaluate(() => window.__scene.pauseGame());
  check(await page.evaluate(() => !!window.__pause), '일시정지 화면이 열렸는가');
  await look('일시정지 — 무기 상세', 700);
  await page.evaluate(() => window.__pause.resumeGame());
  await page.waitForTimeout(500);

  // ── 보스 ───────────────────────────────────────────────
  // 보스 체력 띠는 화면 위쪽에 겹쳐 뜹니다. HUD 띠를 키운 뒤로 여기가
  // 부딪히기 쉬운 자리가 됐습니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 199; s.lane = 'mid';
    for (let i = 199; i <= 206; i++) s.addFloor(i);
    const slot = s.floors.get(199).slots.mid;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.68);
  });
  await page.waitForTimeout(300);
  await page.mouse.click(...at(270, 620));
  await look('보스 층 — 체력 띠와 HUD', 3800);

  // ── 보스를 넘고 나서 뜨는 창 ───────────────────────────
  // 판을 멈추고 펼치는 한 장이라 줄이 많습니다 (이름·하는 일·전설·경고).
  // **가장 나쁜 경우를 봅니다**: 회복 줄이 붙고, 전설이 두 줄로 접히고,
  // 한도가 차서 「이미 가득」 줄까지 함께 뜨는 판.
  const openTrophy = (bossKey, trophyKey, got, healed) => page.evaluate((d) => {
    const s = window.__scene;
    s.bossFight = false;
    s.scene.pause();
    s.scene.launch('trophy', {
      from: s,
      boss: CFG.boss.kinds.find((k) => k.key === d.bossKey),
      trophy: TROPHIES[d.trophyKey],
      got: d.got, healed: d.healed,
    });
  }, { bossKey, trophyKey, got, healed });
  const closeTrophy = async () => {
    await page.evaluate(() => window.__trophy.close());
    await page.waitForTimeout(400);
  };

  await openTrophy('boss-phantom', 'mask', false, 120);
  await look('보스 전리품 창 — 회복 줄 + 한도까지 참', 600);
  await closeTrophy();

  await openTrophy('boss-warden', 'eye', true, 0);
  await look('보스 전리품 창 — 첫 보스', 600);
  await closeTrophy();

  // ── 죽음 화면 ──────────────────────────────────────────
  // 두 갈래를 다 봅니다. 유물 줄은 있을 때만 자리를 쓰므로, 유물을 들고
  // 죽은 판과 빈손으로 죽은 판의 아래쪽 줄 자리가 서로 다릅니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.bossFight = false;
    s.medals = 7; s.coins = 2480; s.totalCoins = 5120;
    s.weapon.relics = RELICS.slice(0, CFG.relic.maxHeld);
    s.gameOver();
  });
  await look('죽음 화면 — 유물을 들고', 900);

  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 60; s.medals = 0; s.coins = 300; s.totalCoins = 900;
    s.weapon.relics = [];
    s.gameOver();
  });
  await look('죽음 화면 — 빈손으로', 900);

  console.log(bad ? `\n${bad}건 어긋남` : '\n어느 화면에서도 글자가 안 겹칩니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
