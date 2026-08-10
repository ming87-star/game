// 보스·유물·박쥐를 실제 브라우저에서 확인합니다.
// 200층까지 걸어 올라가려면 몇 분이 걸리므로, 층수만 옮겨 놓고 그 앞에서 시작합니다.
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
const shot = (page, name) => page.screenshot({ path: path.join(ROOT, 'shots', name) });

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

(async () => {
  const port = Number(process.env.PORT) || 8150;
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

  // 직업 → 메달 상점 → 탑
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await page.waitForTimeout(900);

  // ── 층 생성 규칙 ───────────────────────────────────────
  const gen = await page.evaluate(() => {
    resetTowerRun();
    const relicFloors = [];
    for (let f = 1; f <= 620; f++) if (f === relicFloorFor(f)) relicFloors.push(f);
    return {
      boss: [200, 400, 600].map(isBossFloor),
      bossIsNotShop: [200, 400].map(isShopFloor),
      relicFloors,
      earlyRelic: relicFloorFor(120),
    };
  });
  check(gen.boss.every(Boolean) && !gen.bossIsNotShop.some(Boolean),
    '200·400·600층은 보스 층이고 상점이 아님', JSON.stringify(gen.boss));
  check(gen.earlyRelic === -1, '200층 아래에는 유물이 없음', gen.earlyRelic);
  check(gen.relicFloors.length >= 4 && gen.relicFloors.every((f) => f >= 200),
    '유물은 200층부터 구간마다 하나씩', gen.relicFloors.join(', '));

  // ── 보스 ───────────────────────────────────────────────
  // 199층으로 옮겨 두고 한 번 뛰어 투기장에 들어갑니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 199;
    s.lane = 'mid';
    for (let i = 199; i <= 206; i++) s.addFloor(i);
    const slot = s.floors.get(199).slots.mid;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
  });
  await page.waitForTimeout(300);
  await page.mouse.click(...at(270, 620)); // 위로
  // 보스가 내려앉기를 기다립니다. 내려오는 중에 사거리를 재면 아직 저 위에 있어서
  // "안 닿는다"가 나옵니다 — 자리를 잡은 뒤에 재야 뜻이 있습니다.
  await page.waitForTimeout(1200 + 2400);
  const settled = await page.evaluate(() => window.__scene.bossEntering);
  check(settled === false, '보스가 자리를 잡음', '내려오는 중 ' + settled);

  const inBoss = await page.evaluate(() => {
    const s = window.__scene;
    return {
      fight: s.bossFight, floor: s.floorIndex,
      hasBoss: !!(s.boss && s.boss.active),
      // 투기장 위로는 발판이 없어야 합니다.
      above: Array.from(s.floors.keys()).filter((i) => i > s.bossFloor).length,
      contact: s.boss ? s.boss.contactDamage : -1,
      // 세 직업이 같은 조건에서 때릴 수 있는지.
      // 게임이 실제로 쓰는 meleeDist 를 그대로 불러서 잽니다 — 여기서 계산을
      // 따로 베껴 쓰면 본 코드가 바뀌어도 시험이 눈치채지 못합니다.
      reachable: LANES.map((lane) => {
        const keep = s.player.x;
        s.player.x = CFG.laneX[lane];
        const gap = Math.round(s.meleeDist(s.boss));
        s.player.x = keep;
        return { lane, gap };
      }),
    };
  });
  check(inBoss.fight && inBoss.hasBoss, '보스 층에 올라서면 전투가 시작됨',
    `${inBoss.floor}층 · 보스 ${inBoss.hasBoss}`);
  check(inBoss.above === 0, '투기장 위 발판이 사라짐', inBoss.above + '개 남음');
  check(inBoss.contact === 0, '보스는 접촉 피해가 없음 (근접이 붙을 수 있어야 함)', inBoss.contact);

  // 가장 짧은 무기(도적 이 빠진 단도 70)로도 닿아야 세 직업이 같은 조건입니다.
  const worst = Math.max(...inBoss.reachable.map((r) => r.gap));
  check(worst <= 70, '어느 줄에서든 가장 짧은 근접 무기(70)가 닿음',
    inBoss.reachable.map((r) => r.lane + ' ' + r.gap).join(' · '));

  // 위로 뛰려 해도 층이 오르지 않아야 합니다.
  await page.mouse.click(...at(270, 620));
  await page.waitForTimeout(500);
  const stuck = await page.evaluate(() => window.__scene.floorIndex);
  check(stuck === 200, '보스 중에는 위로 오를 수 없음', stuck + '층');

  // 좌우로는 움직여야 합니다.
  const laneBefore = await page.evaluate(() => window.__scene.lane);
  await page.mouse.click(...at(90, 620));
  await page.waitForTimeout(400);
  const laneAfter = await page.evaluate(() => window.__scene.lane);
  check(laneBefore !== laneAfter, '좌우로는 움직임', laneBefore + ' → ' + laneAfter);

  // 200층에 어울리는 무기를 쥐여 주고 실제로 깎이는지 봅니다.
  // 1단계 무기로는 보스 체력의 0.02%라 "깎였다"를 잴 수가 없습니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.tier = 8;
    s.weapon.haste = 8;
    s.boss.hp = s.boss.maxHp;
  });
  await page.waitForTimeout(2600);
  await shot(page, 'v-boss.png');
  const fought = await page.evaluate(() => {
    const s = window.__scene;
    return {
      hp: s.boss && s.boss.active ? s.boss.hp / s.boss.maxHp : 0,
      shots: s.enemyBullets.countActive() + s.enemies.getChildren().filter((e) => !e.isBoss).length,
    };
  });
  // 체력을 3배로 올렸으므로 몇 초로는 조금밖에 못 깎습니다. 깎이기만 하면 됩니다.
  check(fought.hp < 0.999 && fought.hp > 0, '자동 공격이 보스를 깎음',
    '남은 체력 ' + (fought.hp * 100).toFixed(2) + '%');
  check(fought.shots > 0, '보스가 투사체나 졸개를 내보냄', fought.shots + '개');

  // 보스를 죽여 보고 길이 다시 열리는지 확인합니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.hitEnemy(s.boss, s.boss.maxHp * 2);
  });
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const s = window.__scene;
    return {
      fight: s.bossFight,
      above: Array.from(s.floors.keys()).filter((i) => i > 200).length,
      medals: s.medals,
    };
  });
  check(!after.fight && after.above > 0, '보스를 잡으면 길이 다시 열림', after.above + '층 생성');
  check(after.medals >= 3, '보스 보상 메달', after.medals);

  // ── 유물 고르기 ────────────────────────────────────────
  const relic = await page.evaluate(() => {
    const s = window.__scene;
    s.openRelicChoice();
    return {
      choosing: s.choosing,
      cards: s.relicChoices.map((c) => c.relic.name),
      spots: s.relicChoices.map((c) => ({ x: c.x, y: c.y })),
    };
  });
  check(relic.choosing && relic.cards.length === 3, '유물은 판을 멈추고 세 장을 펼침',
    relic.cards.join(' · '));
  await shot(page, 'v-relic.png');

  await page.mouse.click(...at(relic.spots[0].x, relic.spots[0].y));
  await page.waitForTimeout(500);
  const took = await page.evaluate(() => {
    const s = window.__scene;
    return {
      choosing: s.choosing,
      held: s.weapon.relics.map((r) => r.name),
      book: Object.keys(window.__save.data.relics),
    };
  });
  check(!took.choosing && took.held.length === 1, '고른 하나만 붙고 판이 다시 흐름',
    took.held.join(','));
  check(took.book.length === 1, '유물 도감에 남음', took.book.join(','));

  // 두 번째 유물도 겹쳐 들 수 있어야 합니다.
  await page.evaluate(() => window.__scene.openRelicChoice());
  const second = await page.evaluate(() => window.__scene.relicChoices.map((c) => c.relic.key));
  check(!second.includes(took.book[0]), '이미 든 유물은 다시 안 뜸', second.join(','));
  const spot2 = await page.evaluate(() => window.__scene.relicChoices[0]);
  await page.mouse.click(...at(spot2.x, spot2.y));
  await page.waitForTimeout(400);
  const stacked = await page.evaluate(() => window.__scene.weapon.relics.length);
  check(stacked === 2, '유물을 겹쳐 들 수 있음', stacked + '개');

  // ── 유물은 두 개까지 ───────────────────────────────────
  // 꽉 찬 채로 또 만나면 무엇을 버릴지 한 번 더 고르게 해야 합니다.
  const before2 = await page.evaluate(() => window.__scene.weapon.relics.map((r) => r.key));
  await page.evaluate(() => window.__scene.openRelicChoice());
  const third = await page.evaluate(() => window.__scene.relicChoices[0]);
  await page.mouse.click(...at(third.x, third.y));
  await page.waitForTimeout(400);
  const swap = await page.evaluate(() => ({
    choosing: window.__scene.choosing,
    rows: window.__scene.relicSwaps.length,
    held: window.__scene.weapon.relics.length,
    spots: window.__scene.relicSwaps.map((r) => ({ x: r.x, y: r.y, key: r.relic && r.relic.key })),
  }));
  check(swap.choosing && swap.held === 2 && swap.rows === 3,
    '꽉 찼으면 버릴 것을 고르게 함 (버리기 2 + 그냥 두기 1)',
    swap.rows + '갈래 · 아직 ' + swap.held + '개');
  await shot(page, 'v-relic-swap.png');

  // 첫 번째 것을 버리고 새것을 받습니다.
  await page.mouse.click(...at(swap.spots[0].x, swap.spots[0].y));
  await page.waitForTimeout(400);
  const swapped = await page.evaluate(() => ({
    choosing: window.__scene.choosing,
    held: window.__scene.weapon.relics.map((r) => r.key),
  }));
  check(!swapped.choosing && swapped.held.length === 2 &&
    !swapped.held.includes(before2[0]),
    '버린 것은 빠지고 새것이 들어옴 — 언제나 2개',
    before2.join(',') + ' → ' + swapped.held.join(','));

  // 그냥 두는 길도 있어야 합니다.
  await page.evaluate(() => window.__scene.openRelicChoice());
  const fourth = await page.evaluate(() => window.__scene.relicChoices[0]);
  await page.mouse.click(...at(fourth.x, fourth.y));
  await page.waitForTimeout(300);
  const keepSpot = await page.evaluate(() => {
    const rows = window.__scene.relicSwaps;
    return rows[rows.length - 1];
  });
  await page.mouse.click(...at(keepSpot.x, keepSpot.y));
  await page.waitForTimeout(400);
  const kept = await page.evaluate(() => ({
    choosing: window.__scene.choosing,
    held: window.__scene.weapon.relics.map((r) => r.key),
  }));
  check(!kept.choosing && kept.held.join(',') === swapped.held.join(','),
    '"그냥 두기"를 고르면 들고 있던 것이 그대로', kept.held.join(','));

  const CFG_LEAD = await page.evaluate(() => CFG.bats.warnLeadMs);

  // ── 박쥐 ───────────────────────────────────────────────
  // 첫 상점까지는 아무리 늑장을 부려도 안 옵니다. 규칙을 익히는 구간이니까요.
  const early = await page.evaluate(async () => {
    const s = window.__scene;
    s.bossFight = false;
    s.clearBats();
    s.gatesShown = new Set();
    s.floorIndex = CFG.bats.fromFloor - 11;           // 40층 언저리
    s.checkFloorGates();
    s.lastShopAt = s.time.now - CFG.bats.graceMs * 4; // 아주 오래 늑장
    for (let i = 0; i < 8; i++) s.updateBats(s.time.now + i * CFG.bats.spawnEvery);
    return { floor: s.floorIndex, count: s.batCount(), gates: [...s.gatesShown] };
  });
  check(early.count === 0 && early.gates.length === 0,
    '첫 상점 아래에서는 늑장을 부려도 안 오고 알림도 없음',
    early.floor + '층 · ' + early.count + '마리');

  // 51층에 **올라서는 순간** 알림이 뜨고, 그 뒤에야 옵니다.
  const gate = await page.evaluate(async () => {
    const s = window.__scene;
    s.lastShopAt = s.time.now - CFG.bats.graceMs - 1; // 이미 늦은 상태로 올라섭니다
    s.floorIndex = CFG.bats.warnFloor;
    s.checkFloorGates();                              // 층에 올라선 그 순간
    const t0 = s.time.now;
    s.updateBats(t0);
    const atGate = { shown: s.gatesShown.has('bats'), count: s.batCount() };
    s.updateBats(t0 + CFG.bats.warnLeadMs - 200);     // 아직 글씨가 떠 있을 때
    const stillNone = s.batCount();
    s.updateBats(t0 + CFG.bats.warnLeadMs + 50);      // 그 뒤
    return { atGate, stillNone, after: s.batCount(), floor: s.floorIndex };
  });
  check(gate.atGate.shown && gate.atGate.count === 0 && gate.stillNone === 0,
    gate.floor + '층에 올라서면 알림이 먼저 뜨고 그동안은 안 옴',
    CFG_LEAD + 'ms 앞서');
  check(gate.after > 0, '알린 뒤에 날아듦', gate.after + '마리');

  // 한 판에 한 번만 뜹니다. 상점을 지날 때마다 다시 뜨면 잡음입니다.
  const twiceGate = await page.evaluate(() => {
    const s = window.__scene;
    const before = [...s.gatesShown];
    s.floorIndex = CFG.bats.warnFloor + 30;
    s.checkFloorGates();
    return { before, after: [...s.gatesShown] };
  });
  check(twiceGate.before.join(',') === twiceGate.after.join(','),
    '알림은 한 판에 한 번만', twiceGate.after.join(','));

  // ── 함정 알림 ──────────────────────────────────────────
  const trapGate = await page.evaluate(() => {
    const s = window.__scene;
    s.gatesShown = new Set(['bats']); // 박쥐 알림은 지나온 것으로 두고 함정만 봅니다
    s.gateUntil = 0;
    s.floorIndex = CFG.trap.warnFloor - 1;
    s.checkFloorGates();
    const before = s.gatesShown.has('trap');
    s.floorIndex = CFG.trap.warnFloor;
    s.checkFloorGates();
    return { before, after: s.gatesShown.has('trap'), floor: CFG.trap.warnFloor };
  });
  check(!trapGate.before && trapGate.after,
    trapGate.floor + '층에 올라서면 함정 알림이 뜸 (그 아래에서는 안 뜸)');

  // 둘이 한꺼번에 조건을 채워도 글자가 포개지지 않습니다.
  // 상점에서 이어서 시작하거나 층을 건너뛰면 실제로 이런 일이 생깁니다.
  const gateQueue = await page.evaluate(() => {
    const s = window.__scene;
    s.gatesShown = new Set();
    s.gateUntil = 0;
    s.floorIndex = CFG.trap.warnFloor + 5; // 밀린 알림 둘이 동시에 조건을 채움
    s.checkFloorGates();
    const first = [...s.gatesShown];
    s.checkFloorGates();                   // 다음 층 — 아직 앞 글자가 떠 있음
    const stillFirst = [...s.gatesShown];
    s.gateUntil = 0;                       // 글자가 걷힌 뒤
    s.checkFloorGates();
    return { first, stillFirst, then: [...s.gatesShown] };
  });
  check(gateQueue.first.length === 1 && gateQueue.stillFirst.length === 1
    && gateQueue.then.length === 2,
    '밀린 알림이 겹치지 않고 한 번에 하나씩',
    gateQueue.first.join(',') + ' → ' + gateQueue.then.join(','));

  // 그 아래로는 함정이 아예 안 놓입니다.
  const trapFloors = await page.evaluate(() => {
    resetTowerRun();
    let below = 0, above = 0;
    for (let f = 1; f < CFG.trap.fromFloor; f++) {
      if (isShopFloor(f) || isBossFloor(f)) continue;
      const fl = makeFloor(f, 0, true);
      LANES.forEach((l) => {
        const k = fl.slots[l] && fl.slots[l].kind;
        if (k === SLOT.BOMB || k === SLOT.MIMIC) below++;
      });
    }
    for (let f = CFG.trap.fromFloor; f < CFG.trap.fromFloor + 1500; f++) {
      if (isShopFloor(f) || isBossFloor(f)) continue;
      const fl = makeFloor(f, 0, true);
      LANES.forEach((l) => {
        const k = fl.slots[l] && fl.slots[l].kind;
        if (k === SLOT.BOMB || k === SLOT.MIMIC) above++;
      });
    }
    return { below, above, from: CFG.trap.fromFloor };
  });
  check(trapFloors.below === 0 && trapFloors.above > 0,
    trapFloors.from + '층 아래에는 함정이 한 칸도 없음',
    '아래 ' + trapFloors.below + '칸 · 위 ' + trapFloors.above + '칸');

  const bats = await page.evaluate(async () => {
    const s = window.__scene;
    s.coins = 200;
    s.floorIndex = CFG.bats.fromFloor + 20;
    s.gatesShown = new Set(['trap']);
    s.gateUntil = 0;
    s.checkFloorGates();
    s.lastShopAt = s.time.now - CFG.bats.graceMs - 1;
    for (let i = 0; i < 6; i++) {
      s.updateBats(s.time.now + CFG.bats.warnLeadMs + 100 + i * CFG.bats.spawnEvery);
    }
    return { count: s.batCount(), coins: s.coins };
  });
  check(bats.count > 0, '오래 머무르면 박쥐가 몰려옴', bats.count + '마리');

  const stolen = await page.evaluate(() => {
    const s = window.__scene;
    const bat = s.enemies.getChildren().find((e) => e.isBat && e.batKind === 'thief');
    if (!bat) return { skip: true };
    const before = s.coins;
    s.batStealsCoins(bat);
    return { before, after: s.coins, fleeing: bat.fleeing };
  });
  check(stolen.skip || (stolen.after < stolen.before && stolen.fleeing),
    '도둑 박쥐가 코인을 채 가고 달아남',
    stolen.skip ? '도둑 박쥐가 안 나옴' : `${stolen.before} → ${stolen.after}`);

  const cleared = await page.evaluate(() => {
    const s = window.__scene;
    s.enterShop();
    s.shop.close();
    return s.batCount();
  });
  check(cleared === 0, '상점에 닿으면 박쥐가 물러감', cleared + '마리');

  console.log(bad ? `\n${bad}건 어긋남` : '\n보스·유물·박쥐 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
