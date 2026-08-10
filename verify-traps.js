// 함정이 제대로 도는지 확인합니다.
// 폭탄은 보이고 아프게, 가짜는 겉은 같되 속은 반대로.
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

(async () => {
  const port = Number(process.env.PORT) || 9600;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0,
    weapons: {}, boosts: {}, relics: {}, unlocked: {}, lastJob: 'warrior',
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await page.waitForTimeout(900);

  // ── 설정이 빠지지 않았나 ───────────────────────────────
  // CFG 에 칸 하나가 없으면 그것을 읽는 파일이 통째로 죽습니다. 실제로
  // CFG.dodge 를 빠뜨렸더니 shop.js 가 불러오다 터져서 상점이 아예 없는 채로
  // 판이 돌았고, 밸런스를 두 번이나 헛 쟀습니다. 화면에는 아무 표시도 없습니다.
  const cfgOk = await page.evaluate(() => {
    const need = [
      ['dodge.perItem', CFG.dodge && CFG.dodge.perItem],
      ['dodge.shopGain', CFG.dodge && CFG.dodge.shopGain],
      ['trap.bombDamage', CFG.trap && CFG.trap.bombDamage],
      ['shop.prices.dodge', CFG.shop.prices && CFG.shop.prices.dodge],
      ['shop.priceGrowth', CFG.shop.priceGrowth],
      ['enemyCount.capMax', CFG.enemyCount && CFG.enemyCount.capMax],
      ['relic.maxHeld', CFG.relic && CFG.relic.maxHeld],
      ['boss.hpMult', CFG.boss && CFG.boss.hpMult],
      ['bats.graceMs', CFG.bats && CFG.bats.graceMs],
    ];
    return need.filter(([, v]) => v === undefined || v === null).map(([k]) => k);
  });
  check(cfgOk.length === 0, 'CFG 에 빠진 칸이 없음', cfgOk.join(', ') || '전부 있음');

  // 페이지가 조용히 죽지 않았는지도 봅니다.
  const alive = await page.evaluate(() => !!(window.__scene && window.__scene.shop));
  check(alive, '상점 객체가 실제로 만들어짐');

  // ── 얼마나 나오나 ──────────────────────────────────────
  const odds = await page.evaluate(() => {
    resetTowerRun();
    let bomb = 0, mimic = 0, item = 0, floors = 0;
    for (let f = 1; f <= 4000; f++) {
      if (isShopFloor(f) || isBossFloor(f)) continue;
      const fl = makeFloor(f, 0, true);
      floors++;
      let hasB = false, hasM = false, hasI = false;
      LANES.forEach((l) => {
        const s = fl.slots[l];
        if (!s) return;
        if (s.kind === SLOT.BOMB) hasB = true;
        else if (s.kind === SLOT.MIMIC) hasM = true;
        else if (ITEM_KINDS.has(s.kind)) hasI = true;
      });
      if (hasB) bomb++;
      if (hasM) mimic++;
      if (hasI) item++;
    }
    return { bomb: bomb / floors, mimic: mimic / floors, item: item / floors };
  });
  const pc = (x) => (x * 100).toFixed(1) + '%';
  check(odds.bomb > 0.02 && odds.bomb < 0.09, '폭탄은 드물게 (2~9%)', pc(odds.bomb));
  check(odds.mimic > 0.01 && odds.mimic < 0.06, '가짜는 더 드물게 (1~6%)', pc(odds.mimic));
  // 진짜가 훨씬 많아야 아이템을 집는 일이 도박이 되지 않습니다.
  check(odds.mimic < odds.item * 0.12, '아이템 열에 하나 아래로만 가짜',
    `가짜 ${pc(odds.mimic)} vs 진짜 ${pc(odds.item)}`);

  // ── 가짜는 겉이 같아야 합니다 ──────────────────────────
  const look = await page.evaluate(() => {
    const s = window.__scene;
    const out = { same: true, disguises: {} };
    resetTowerRun();
    for (let f = 1; f <= 3000; f++) {
      const fl = makeFloor(f, 0, true);
      LANES.forEach((l) => {
        const slot = fl.slots[l];
        if (!slot || slot.kind !== SLOT.MIMIC) return;
        out.disguises[slot.disguise] = (out.disguises[slot.disguise] || 0) + 1;
        // 겉모습은 흉내 낸 것의 표를 그대로 써야 합니다.
        if (!SLOT_MARK[slot.disguise]) out.same = false;
      });
    }
    return out;
  });
  check(look.same && Object.keys(look.disguises).length >= 3,
    '가짜는 진짜 아이템의 표를 그대로 씁니다',
    Object.entries(look.disguises).map(([k, n]) => k + ' ' + n).join(' · '));

  // ── 가까이 가면 정체가 드러나야 합니다 ─────────────────
  // 이게 없으면 플레이어는 "왜 당했는지" 모른 채 기분만 나빠집니다.
  const reveal = await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 20;
    // 위층 셋에 가짜를 하나씩 심습니다: 바로 위 · 두 층 위 · 세 층 위.
    const made = {};
    [1, 2, 3].forEach((d) => {
      const f = s.floorIndex + d;
      s.removeFloor(f);
      s.addFloor(f);
      const floor = s.floors.get(f);
      const slot = floor.slots.mid;
      if (slot.view) { slot.view.destroy(); slot.view = null; }
      slot.kind = SLOT.MIMIC;
      slot.disguise = SLOT.PLUS;
      slot.taken = false; slot.expired = false; slot.revealed = false;
      const mark = s.makeMark(slot);
      slot.view = mark;
      floor.views.push(mark);
      made[d] = slot;
    });

    // 겉모습이 진짜 +1 과 같은지 먼저 봅니다 (드러나기 전).
    const before = [1, 2, 3].map((d) => made[d].revealed);

    s.updateItems(s.time.now);
    return {
      before,
      after: [1, 2, 3].map((d) => made[d].revealed),
      alphaTweens: [1, 2, 3].map((d) =>
        s.tweens.getTweensOf(made[d].view).length),
    };
  });
  check(reveal.before.every((v) => v === false), '심어 둔 가짜는 처음엔 안 드러남');
  check(reveal.after[0] === true && reveal.after[1] === true && reveal.after[2] === false,
    '2층 안의 가짜만 정체를 드러냄 (세 층 위는 그대로)',
    `1층위 ${reveal.after[0]} · 2층위 ${reveal.after[1]} · 3층위 ${reveal.after[2]}`);
  check(reveal.alphaTweens[0] >= 2 && reveal.alphaTweens[2] <= 1,
    '드러난 것에만 깜빡임이 걸림',
    `트윈 ${reveal.alphaTweens.join(' / ')}`);

  // 두 번 불러도 트윈이 쌓이지 않아야 합니다 — 쌓이면 깜빡임이 뭉개집니다.
  const twice = await page.evaluate(() => {
    const s = window.__scene;
    const slot = s.floors.get(s.floorIndex + 1).slots.mid;
    s.updateItems(s.time.now);
    s.updateItems(s.time.now);
    return s.tweens.getTweensOf(slot.view).length;
  });
  check(twice <= 3, '여러 번 불려도 깜빡임 트윈이 쌓이지 않음', twice + '개');

  // ── 밟았을 때 ──────────────────────────────────────────
  const bomb = await page.evaluate(() => {
    const s = window.__scene;
    s.hp = s.maxHp;
    s.floorIndex = 60;
    const before = s.hp;
    s.springTrap(CFG.trap.bombDamage, '폭탄!');
    return { before, after: s.hp };
  });
  check(bomb.after < bomb.before, '폭탄을 밟으면 체력이 줄어듦',
    `${Math.round(bomb.before)} → ${Math.round(bomb.after)}`);

  // 무적 시간 중에도 아파야 합니다 — 아니면 맞은 직후에 밟는 것이 공짜가 됩니다.
  const again = await page.evaluate(() => {
    const s = window.__scene;
    s.hp = s.maxHp;
    s.lastHitAt = s.time.now; // 방금 맞은 셈
    const before = s.hp;
    s.springTrap(CFG.trap.bombDamage, '폭탄!');
    return { before, after: s.hp };
  });
  check(again.after < again.before, '무적 시간 중에도 폭탄은 아픔',
    `${Math.round(again.before)} → ${Math.round(again.after)}`);

  const mimic = await page.evaluate(() => {
    const s = window.__scene;
    s.hp = s.maxHp;
    s.weapon.plus = 5;
    s.weapon.haste = 5;
    s.armor = 40;

    s.springMimic({ disguise: SLOT.PLUS });
    const afterPlus = s.weapon.plus;
    s.springMimic({ disguise: SLOT.HASTE });
    const afterHaste = s.weapon.haste;
    s.springMimic({ disguise: SLOT.ARMOR });
    const afterArmor = Math.round(s.armor);
    const hpBefore = s.hp;
    s.springMimic({ disguise: SLOT.HEAL });
    return { afterPlus, afterHaste, afterArmor, hpBefore, hpAfter: s.hp };
  });
  check(mimic.afterPlus === 5 - 2, '가짜 +1 → 공격력 강화를 잃음',
    '5 → ' + mimic.afterPlus);
  check(mimic.afterHaste === 5 - 2, '가짜 속 → 속도 강화를 잃음',
    '5 → ' + mimic.afterHaste);
  check(mimic.afterArmor < 40, '가짜 방 → 방어력을 잃음', '40 → ' + mimic.afterArmor);
  check(mimic.hpAfter < mimic.hpBefore, '가짜 회복 → 오히려 깎임',
    `${Math.round(mimic.hpBefore)} → ${Math.round(mimic.hpAfter)}`);

  // 강화가 없을 때 음수로 내려가면 안 됩니다.
  const floorZero = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.plus = 0;
    s.weapon.haste = 0;
    s.armor = 0;
    s.springMimic({ disguise: SLOT.PLUS });
    s.springMimic({ disguise: SLOT.HASTE });
    s.springMimic({ disguise: SLOT.ARMOR });
    return { plus: s.weapon.plus, haste: s.weapon.haste, armor: s.armor };
  });
  check(floorZero.plus === 0 && floorZero.haste === 0 && floorZero.armor === 0,
    '잃을 것이 없으면 0에서 멈춤 (음수 없음)',
    JSON.stringify(floorZero));

  console.log(bad ? `\n${bad}건 어긋남` : '\n함정 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
