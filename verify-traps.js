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
    weapons: {}, boosts: {}, relics: {}, unlocked: {}, lastJob: 'warrior', sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  // 켜면 타이틀 화면이 먼저 섭니다 (js/scene-title.js). 사람처럼 한 번 지납니다 —
  // 안 지나면 아래가 전부 타이틀 화면 위에서 헛돕니다.
  await page.waitForFunction(() => window.__title && window.__title.ready,
    null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
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
  // 값을 통째로 낮췄습니다 (폭탄 2~9% → 0.7~4% · 가짜 1~6% → 0.2~2%).
  // 아이템 확률을 3분의 1로 줄이면서 함정도 같은 배수로 줄였기 때문입니다 —
  // 좋은 것만 줄이고 함정을 그대로 두면 "아이템처럼 보이는 것 다섯에 하나"가
  // 가짜가 되어, 집는 일 자체가 도박이 됩니다 (아래 검사가 그걸 봅니다).
  check(odds.bomb > 0.007 && odds.bomb < 0.04, '폭탄은 드물게 (0.7~4%)', pc(odds.bomb));
  check(odds.mimic > 0.002 && odds.mimic < 0.02, '가짜는 더 드물게 (0.2~2%)', pc(odds.mimic));
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

  // ── 함정의 수명 ────────────────────────────────────────
  // 세 칸이 다 막혔을 때 기다렸다 지나갈 수 있어야 합니다. 그러려면
  // 함정이 보통 아이템보다 훨씬 빨리 삭아야 하고, 코앞에서야 시계가 켜져야
  // 합니다 (멀리서 켜지면 도착 전에 다 없어져서 함정이 없는 것과 같습니다).
  const life = await page.evaluate(() => ({
    trapLife: CFG.trap.life, itemLife: CFG.item.life,
    trapArm: CFG.trap.armWithin, itemArm: CFG.item.armWithin,
  }));
  check(life.trapLife < life.itemLife * 0.6, '함정은 보통 아이템보다 훨씬 빨리 삭음',
    `함정 ${life.trapLife}ms vs 아이템 ${life.itemLife}ms`);
  check(life.trapArm < life.itemArm, '함정의 시계는 코앞에서야 켜짐',
    `함정 ${life.trapArm}층 vs 아이템 ${life.itemArm}층`);

  const timer = await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 30;
    // 위층에 함정과 진짜 아이템을 나란히 심습니다.
    // 한 층에 둘을 심으므로 층은 한 번만 새로 짓습니다 — 두 번 지으면 먼저 심은
    // 칸이 새 층에서 떨어져 나가 시계가 안 켜집니다 (실제로 여기서 헛 쟀습니다).
    [1, 2, 4].forEach((d) => { s.removeFloor(s.floorIndex + d); s.addFloor(s.floorIndex + d); });
    const put = (d, lane, kind) => {
      const f = s.floorIndex + d;
      const floor = s.floors.get(f);
      let slot = floor.slots[lane];
      if (!slot) { slot = blankSlot(f, lane, kind); floor.slots[lane] = slot; }
      if (slot.view) { slot.view.destroy(); slot.view = null; }
      slot.kind = kind;
      slot.taken = false; slot.expired = false; slot.revealed = false;
      slot.armed = false; slot.armedAt = 0; slot.blinking = false;
      slot.view = s.makeMark(slot);
      if (slot.view) floor.views.push(slot.view);
      return slot;
    };

    const nearBomb = put(1, 'left', SLOT.BOMB);
    const nearPlus = put(1, 'right', SLOT.PLUS);
    const farBomb = put(4, 'left', SLOT.BOMB);
    const farPlus = put(4, 'right', SLOT.PLUS);
    // 두 층 위 — 아이템은 켜지지만 함정은 아직입니다 (한 층 아래에 서야 켜집니다).
    const midBomb = put(2, 'left', SLOT.BOMB);

    s.armItems();
    const armed = {
      nearBomb: nearBomb.armed, nearPlus: nearPlus.armed,
      midBomb: midBomb.armed, farBomb: farBomb.armed, farPlus: farPlus.armed,
    };

    // 함정 수명만큼 시간이 흐른 셈 치고 한 번 돌립니다.
    const now = s.time.now;
    nearBomb.armedAt = now - (CFG.trap.life + 50);
    nearPlus.armedAt = now - (CFG.trap.life + 50);
    s.updateItems(now);

    // 사라진 칸을 밟으면 아무 일도 없어야 합니다 — 그게 "지나갈 수 있다"는 뜻입니다.
    s.hp = s.maxHp;
    const hpBefore = s.hp;
    s.land(nearBomb);
    return {
      armed,
      bombGone: nearBomb.expired, plusAlive: !nearPlus.expired,
      hpBefore, hpAfter: s.hp,
    };
  });
  check(timer.armed.nearBomb && timer.armed.nearPlus,
    '눈앞의 함정과 아이템은 둘 다 시계가 켜짐');
  check(!timer.armed.farBomb && !timer.armed.midBomb && timer.armed.farPlus,
    '멀리 있는 함정은 아직 안 켜짐 (아이템은 켜짐)',
    `두 층 위 ${timer.armed.midBomb} · 네 층 위 ${timer.armed.farBomb} · 아이템 ${timer.armed.farPlus}`);
  check(timer.bombGone && timer.plusAlive,
    '함정 수명이 지나면 함정만 사라짐 (같은 나이의 아이템은 남음)',
    `함정 사라짐 ${timer.bombGone} · 아이템 남음 ${timer.plusAlive}`);
  check(Math.round(timer.hpAfter) === Math.round(timer.hpBefore),
    '사라진 함정 자리는 밟아도 안 아픔 — 기다렸다 지나갈 수 있음',
    `${Math.round(timer.hpBefore)} → ${Math.round(timer.hpAfter)}`);

  // 드러난 가짜도 사라질 때가 되면 깜빡여야 합니다. 홀로그램 트윈이 alpha 를
  // 붙들고 있으면 "언제 사라질지 모르는 함정"이 되어 기다릴 수가 없습니다.
  const blink = await page.evaluate(() => {
    const s = window.__scene;
    const f = s.floorIndex + 1;
    s.removeFloor(f); s.addFloor(f);
    const floor = s.floors.get(f);
    const slot = floor.slots.mid;
    if (slot.view) { slot.view.destroy(); slot.view = null; }
    slot.kind = SLOT.MIMIC; slot.disguise = SLOT.PLUS;
    slot.taken = false; slot.expired = false; slot.revealed = false;
    slot.blinking = false; slot.armed = false;
    slot.view = s.makeMark(slot);
    floor.views.push(slot.view);

    s.armItems();
    s.updateItems(s.time.now);            // 가까우니 정체가 드러납니다
    const revealed = slot.revealed;
    const before = s.tweens.getTweensOf(slot.view).length;

    slot.armedAt = s.time.now - (CFG.trap.blinkAt + 60); // 사라질 때가 됐습니다
    s.updateItems(s.time.now);
    return { revealed, before, after: s.tweens.getTweensOf(slot.view).length, blinking: slot.blinking };
  });
  check(blink.revealed && blink.before >= 2, '가짜가 먼저 정체를 드러냄',
    '트윈 ' + blink.before + '개');
  check(blink.blinking && blink.after < blink.before,
    '사라질 때가 되면 홀로그램을 걷고 수명 깜빡임으로 넘어감',
    `트윈 ${blink.before} → ${blink.after}`);

  console.log(bad ? `\n${bad}건 어긋남` : '\n함정 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
