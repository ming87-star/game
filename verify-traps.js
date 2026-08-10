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
