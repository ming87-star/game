// 이번에 새로 들어온 일곱 가지가 실제로 도는지 확인합니다.
//
//   코인벌레   맨 처음 무기로도 한 방에 죽는가
//   그림자     오래 서 있으면 경고가 뜨고, 그러고도 안 움직이면 삼켜지는가
//   일시정지   장면이 진짜로 멈추는가 (시계까지)
//   초당 피해  체력과 견줄 만한 크기로 적히는가
//   황금개구리 층이 오를수록 코인이 불어나는가
//   보물상자   보스 하나를 지나는 동안 세 번은 나오는가 · 이펙트가 스스로 걷히는가
//   미믹       상자인 척했다가 밟으면 아픈가
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
  const port = Number(process.env.PORT) || 9640;
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
  await page.waitForTimeout(700);
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await page.waitForTimeout(900);

  // ── 설정이 빠지지 않았나 ───────────────────────────────
  const cfgMissing = await page.evaluate(() => {
    const need = [
      ['idle.warnMs', CFG.idle && CFG.idle.warnMs],
      ['idle.killMs', CFG.idle && CFG.idle.killMs],
      ['goldfrog.coinBase', CFG.goldfrog && CFG.goldfrog.coinBase],
      ['goldfrog.coinPerFloor', CFG.goldfrog && CFG.goldfrog.coinPerFloor],
      ['treasure.every', CFG.treasure && CFG.treasure.every],
      ['treasure.relicChance', CFG.treasure && CFG.treasure.relicChance],
      ['trap.mimicTreasure', CFG.trap && CFG.trap.mimicTreasure],
      ['slotChance.goldfrog', CFG.slotChance && CFG.slotChance.goldfrog],
    ];
    return need.filter(([, v]) => v === undefined || v === null).map(([k]) => k);
  });
  check(cfgMissing.length === 0, 'CFG 에 빠진 칸이 없음',
    cfgMissing.length ? cfgMissing.join(' · ') : '전부 있음');

  // ── 1. 코인벌레 — 한 방에 죽어야 합니다 ────────────────
  // 세 직업의 **가장 약한 시작 무기**로도 한 대에 죽어야 "부딪혀도 되는 것"이
  // 됩니다. 여기가 어긋나면 처음 만나는 적이 다시 부담스러워집니다.
  const bug = await page.evaluate(() => {
    const def = CFG.enemyTypes.find((t) => t.key === 'coinbug');
    if (!def) return null;
    const hp = Math.round((CFG.enemy.baseHp + 0) * def.hp);
    const weakest = Math.min(...CLASSES.map((c) => c.weapons[0].dmg));
    return { from: def.from, hp, weakest, ground: def.ground, coin: def.coin };
  });
  check(bug && bug.from === 0, '코인벌레는 0층부터 나옴', bug && bug.from + '층부터');
  check(bug && bug.hp <= bug.weakest, '가장 약한 시작 무기로도 한 방',
    bug && `체력 ${bug.hp} ≤ 최약 공격력 ${bug.weakest}`);
  check(bug && bug.coin > 0, '잡으면 코인을 줌', bug && bug.coin);

  // ── 2. 오래 서 있으면 그림자에게 삼켜짐 ────────────────
  const idle = await page.evaluate(async () => {
    const s = window.__scene;
    s.idleMs = 0; s.idleWarned = false; s.clearShadowPool();

    s.updateIdle(CFG.idle.warnMs - 500);
    const beforeWarn = { warned: s.idleWarned, pool: !!s.shadowPool };

    s.updateIdle(1000);                       // 경고 시각을 넘깁니다
    const afterWarn = { warned: s.idleWarned, pool: !!s.shadowPool };
    const smallR = s.shadowPool && s.shadowPool.radius;

    s.updateIdle(CFG.idle.killMs - CFG.idle.warnMs - 1500);
    const grownR = s.shadowPool && s.shadowPool.radius;

    s.updateIdle(2000);                       // 삼켜지는 시각을 넘깁니다
    return {
      beforeWarn, afterWarn, smallR, grownR,
      swallowing: s.swallowing, poolGone: !s.shadowPool,
    };
  });
  check(!idle.beforeWarn.warned && !idle.beforeWarn.pool,
    '경고 시각 전에는 아무 일도 없음');
  check(idle.afterWarn.warned && idle.afterWarn.pool,
    '경고가 뜨고 바닥에 그림자가 생김');
  check(idle.grownR > idle.smallR, '그림자가 자람',
    `${Math.round(idle.smallR)}px → ${Math.round(idle.grownR)}px`);
  check(idle.swallowing && idle.poolGone, '끝내 삼켜짐');

  // 삼켜지는 중에는 다른 피해가 끼어들지 않습니다.
  const hpFrozen = await page.evaluate(() => {
    const s = window.__scene;
    const before = s.hp;
    s.hurt(50);
    return { before, after: s.hp };
  });
  check(hpFrozen.before === hpFrozen.after, '삼켜지는 중에는 다른 피해가 안 들어옴',
    `${hpFrozen.before} → ${hpFrozen.after}`);

  // 삼킴이 끝나면 죽음 화면이 뜹니다. 까닭도 적혀 있어야 합니다.
  await page.waitForTimeout(1400);
  const dead = await page.evaluate(() => ({
    dead: window.__scene.dead,
    reason: window.__scene.children.list.some((o) =>
      o.type === 'Text' && o.text && o.text.includes('그림자')),
  }));
  check(dead.dead, '삼켜지면 판이 끝남');
  check(dead.reason, '죽음 화면에 까닭이 적힘');

  // ── 판을 새로 시작합니다 ───────────────────────────────
  await page.evaluate(() => {
    window.__scene.scene.start('select');
  });
  await page.waitForTimeout(700);
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start2 = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start2.x, start2.y));
  await page.waitForTimeout(900);

  // 층이 바뀌면 시계가 0부터 다시 갑니다 — 천천히 노는 것에 값을 매기는 게
  // 아니라 가만히 있는 것에 값을 매기는 것이기 때문입니다.
  const reset = await page.evaluate(async () => {
    const s = window.__scene;
    s.idleMs = 0; s.idleWarned = false;
    s.updateIdle(CFG.idle.warnMs + 500);   // 경고까지 갑니다
    const warned = s.idleWarned;
    await new Promise((r) => { s.jump(0); setTimeout(r, CFG.jumpDuration + 250); });
    return { warned, after: s.idleMs, stillWarned: s.idleWarned, pool: !!s.shadowPool };
  });
  check(reset.warned && reset.after < 1000 && !reset.stillWarned && !reset.pool,
    '한 칸 올라서면 시계가 0부터 다시 감', Math.round(reset.after) + 'ms');

  // 보스전 중에는 세지 않습니다 — 이미 다른 압박이 있는 자리입니다.
  const inBoss = await page.evaluate(() => {
    const s = window.__scene;
    s.bossFight = true;
    s.idleMs = CFG.idle.warnMs + 5000;
    s.updateIdle(1000);
    const out = { ms: s.idleMs, warned: s.idleWarned };
    s.bossFight = false;
    return out;
  });
  check(inBoss.ms === 0 && !inBoss.warned, '보스전 중에는 시계가 멈춤');

  // ── 3. 일시정지 ────────────────────────────────────────
  const pausePos = await page.evaluate(() => window.__scene.hud.pauseAt);
  await page.mouse.click(...at(pausePos.x, pausePos.y));
  await page.waitForTimeout(500);

  const paused = await page.evaluate(async () => {
    const g = window.__game.scene.getScene('game');
    const wasNow = g.time.now;
    const wasY = g.player.y;
    await new Promise((r) => setTimeout(r, 700));
    return {
      up: window.__game.scene.isActive('pause'),
      frozen: g.time.now === wasNow,      // 장면의 시계까지 멈췄는가
      still: g.player.y === wasY,
      idleFrozen: g.idleMs,
    };
  });
  check(paused.up, '일시정지 화면이 뜸');
  check(paused.frozen, '멈춘 동안은 그 장면의 시계도 안 감');
  check(paused.still, '멈춘 동안은 아무것도 안 움직임');

  // 멈춘 동안은 서 있는 시간도 안 셉니다 — 안 그러면 멈춘 벌로 삼켜집니다.
  const idleWhilePaused = await page.evaluate(() => window.__game.scene.getScene('game').idleMs);
  check(Math.abs(idleWhilePaused - paused.idleFrozen) < 1,
    '멈춘 동안은 서 있는 시간도 안 셈', Math.round(idleWhilePaused) + 'ms');

  const resumeAt = await page.evaluate(() => window.__pause.resumeAt);
  await page.mouse.click(...at(resumeAt.x, resumeAt.y));
  await page.waitForTimeout(600);
  const resumed = await page.evaluate(() => ({
    pauseGone: !window.__game.scene.isActive('pause'),
    running: window.__game.scene.isActive('game'),
  }));
  check(resumed.pauseGone && resumed.running, '이어서 하기를 누르면 판이 그대로 이어짐');

  // ── 4. 초당 피해 표시 ──────────────────────────────────
  // 체력과 견줄 만한 크기여야 합니다. 나누는 것은 표시뿐이므로,
  // UP 발판의 비율 표시(%)는 나누기 전과 똑같아야 합니다.
  const dps = await page.evaluate(() => {
    const s = window.__scene;
    const raw = s.weapon.dps;
    const shown = s.hud.dpsText.text.replace(/[^0-9.만억]/g, '');
    // 비율은 약분되므로 나누기와 무관해야 합니다.
    const pctRaw = s.weapon.nextDps / s.weapon.dps;
    const pctDiv = (s.weapon.nextDps / DPS_DISPLAY_DIV) / (s.weapon.dps / DPS_DISPLAY_DIV);
    return { raw, shown, hp: s.maxHp, div: DPS_DISPLAY_DIV, pctRaw, pctDiv };
  });
  const shownNum = Number(dps.shown);
  check(dps.div === 10, '나누는 값이 10', dps.div);
  check(Math.abs(shownNum - Math.round(dps.raw / dps.div)) < 1,
    '적힌 값이 실제 값 ÷ 10', `${Math.round(dps.raw)} → ${dps.shown}`);
  check(shownNum < dps.hp, '체력보다 작은 자릿수로 적힘',
    `초당 ${dps.shown} vs 체력 ${dps.hp}`);
  check(Math.abs(dps.pctRaw - dps.pctDiv) < 1e-9,
    'UP 의 비율 표시는 나누기와 무관 (약분됨)');

  // ── 5. 황금개구리 ──────────────────────────────────────
  const frog = await page.evaluate(() => {
    const s = window.__scene;
    const make = (floor) => {
      const e = spawnGoldFrog(s, 200, s.player.y - 100, floor);
      const out = { coin: e.coin, hp: e.maxHp, gold: !!e.isGoldFrog, art: e.texture.key };
      e.destroy();
      return out;
    };
    const low = make(10);
    const high = make(400);
    // 보통 적과 견줍니다 — 같은 층에서 얼마나 더 주는가.
    const plain = CFG.enemyTypes.find((t) => t.key === 'crawler');
    return { low, high, plainCoin: plain.coin };
  });
  check(frog.low.gold, '황금개구리 표가 붙음');
  check(frog.low.art === 'e-goldfrog', '제 그림이 있음', frog.low.art);
  check(frog.high.coin > frog.low.coin, '위층일수록 코인이 불어남',
    `10층 ${frog.low.coin} → 400층 ${frog.high.coin}`);
  check(frog.low.coin > frog.plainCoin * 10, '보통 적보다 훨씬 많이 줌',
    `${frog.low.coin} vs ${frog.plainCoin}`);

  // 잡으면 확률이 아니라 무조건 떨어집니다 — 드문 것을 잡았는데 빈손이면
  // 남는 것은 실망뿐입니다.
  const drop = await page.evaluate(() => {
    const s = window.__scene;
    s.pickups.forEach((p) => p.sprite.destroy());
    s.pickups = [];
    let dropped = 0;
    for (let i = 0; i < 12; i++) {
      const e = spawnGoldFrog(s, 200, s.player.y - 100, 50);
      e.hp = 1;
      const before = s.pickups.length;
      s.hitEnemy(e, 9999);
      if (s.pickups.length > before) dropped++;
    }
    const total = s.pickups.reduce((a, p) => a + p.value, 0);
    return { dropped, total };
  });
  check(drop.dropped === 12, '잡으면 언제나 코인을 흘림', drop.dropped + '/12');
  check(drop.total > 1000, '한 마리 값이 큼', '열두 마리 ' + drop.total);

  // ── 6. 보물상자 — 보스 하나를 지나는 동안 세 번 ────────
  // **보스 사이 구간마다** 몇 번 놓이는지 셉니다. 구간을 넉넉히 훑어야 합니다 —
  // 처음엔 네 구간만 봤는데, 구간 폭이 보스 간격을 나누어떨어지지 않아
  // 어쩌다 두 번뿐인 판이 섞이는 것을 한참 뒤에야 잡았습니다.
  const chest = await page.evaluate(() => {
    const runs = [];
    for (let run = 0; run < 30; run++) {
      resetTowerRun();                      // 판마다 자리를 새로 뽑습니다
      for (let band = 0; band < 6; band++) {
        let n = 0;
        const from = band * CFG.bossEvery + 1;
        for (let f = from; f < from + CFG.bossEvery; f++) {
          if (f === treasureFloorFor(f)) n++;
        }
        runs.push(n);
      }
    }
    resetTowerRun();
    return { min: Math.min(...runs), max: Math.max(...runs), n: runs.length };
  });
  check(chest.min >= 3, '보스 하나를 지나는 동안 적어도 세 번 나옴',
    `${chest.n}구간 · 가장 적을 때 ${chest.min}번 · 가장 많을 때 ${chest.max}번`);

  // 자리는 상점·보스·유물·UP 과 겹치지 않습니다.
  const clash = await page.evaluate(() => {
    let n = 0;
    for (let f = 1; f < 600; f++) {
      if (f !== treasureFloorFor(f)) continue;
      if (isShopFloor(f) || isBossFloor(f) || f === relicFloorFor(f) || f === upFloorFor(f)) n++;
    }
    return n;
  });
  check(clash === 0, '상점·보스·유물·UP 자리와 안 겹침', clash + '건');

  // 열면 상점 물건이 나오고, 화면을 채우는 이펙트가 붙었다가 스스로 걷힙니다.
  // 상자에서 나올 수 있는 것을 **하나도 빠짐없이** 담은 지문을 찍고 견줍니다.
  // 처음엔 공격력·체력·방어만 봤는데, 속도나 한계나 부적이 나온 판에서는
  // "아무것도 안 줬다"로 잘못 읽혀 시험이 들쭉날쭉했습니다.
  const open = await page.evaluate(() => {
    const s = window.__scene;
    const mark = () => [s.weapon.plus, s.weapon.tier, s.weapon.speedMult, s.hp, s.maxHp,
      s.armor, s.armorMax, s.dodge, s.dodgeMax, s.charm, s.weapon.relics.length].join('|');

    let missed = 0;
    let grew = 0;
    for (let i = 0; i < 20; i++) {
      s.hp = Math.max(1, s.maxHp - 30);          // 회복이 나와도 표가 나게
      const before = mark();
      const wasKids = s.children.list.length;
      s.openTreasure({ x: s.player.x, y: s.player.y });
      if (mark() === before) missed++;
      grew = Math.max(grew, s.children.list.length - wasKids);
    }
    return { missed, grew };
  });
  check(open.missed === 0, '열면 언제나 무언가를 줌', `스무 번 중 빈손 ${open.missed}번`);
  check(open.grew > 10, '화면을 채우는 이펙트가 붙음', open.grew + '개');

  await page.waitForTimeout(1500);
  const fxGone = await page.evaluate(() => {
    const s = window.__scene;
    return s.children.list.filter((o) => o.type === 'Sprite' && o.texture.key === 'spark').length;
  });
  check(fxGone === 0, '이펙트가 스스로 걷힘 (쌓이지 않음)', fxGone + '개 남음');

  // 유물이 든 상자는 이펙트가 황금빛입니다.
  const golden = await page.evaluate(() => {
    const s = window.__scene;
    const pick = (g) => {
      s.treasureFx(s.player.x, s.player.y, g);
      const sp = s.children.list.filter((o) => o.type === 'Sprite' && o.texture.key === 'spark');
      const n = sp.length;
      const tint = sp.length ? sp[sp.length - 1].tintTopLeft : null;
      sp.forEach((o) => o.destroy());
      return { n, tint };
    };
    const plain = pick(false);
    const gold = pick(true);
    return { plain, gold };
  });
  check(golden.gold.tint === 0xffd54f && golden.plain.tint !== golden.gold.tint,
    '유물이 든 상자는 황금빛',
    '보통 #' + golden.plain.tint.toString(16) + ' vs 유물 #' + golden.gold.tint.toString(16));
  check(golden.gold.n > golden.plain.n, '유물일 때가 더 화려함',
    `${golden.plain.n}개 → ${golden.gold.n}개`);

  // 유물이 꽉 찼으면 굴리지 않습니다 — 무엇을 버릴지 고르게 할 이유가 없습니다.
  const full = await page.evaluate(() => {
    const s = window.__scene;
    const held = s.weapon.relics.slice();
    while (s.weapon.relics.length < CFG.relic.maxHeld) {
      const r = rollRelicChoices(s.job.key, s.weapon.relics, 1)[0];
      if (!r) break;
      s.weapon.takeRelic(r);
    }
    const n = s.weapon.relics.length;
    let grew = 0;
    for (let i = 0; i < 60; i++) {
      const was = s.weapon.relics.length;
      s.openTreasure({ x: s.player.x, y: s.player.y });
      if (s.weapon.relics.length > was) grew++;
    }
    s.weapon.relics = held;
    return { n, grew };
  });
  check(full.grew === 0, '유물이 꽉 차면 상자에서 유물이 안 나옴',
    `${full.n}개 보유 · 예순 번 열어 ${full.grew}개`);

  // ── 7. 미믹 — 상자인 척했다가 밟으면 일어서서 쫓아옴 ──────
  // 밟는 순간 아프고 끝나는 것이 아닙니다. 밟은 뒤부터가 시작입니다.
  const mimic = await page.evaluate(() => {
    const s = window.__scene;
    const disguised = MIMIC_DISGUISES.includes(SLOT.TREASURE);
    const same = slotArtKey(SLOT.TREASURE, s.job.key);
    const shown = fakeArtKey(SLOT.TREASURE, s.job.key);

    s.dead = false; s.swallowing = false;
    // 앞 시험들이 갑옷과 회피를 잔뜩 올려 둔 상태라, 그대로 재면 최소 피해 1만
    // 들어와서 아무 의미가 없습니다. 맨몸으로 되돌리고 잽니다.
    s.armor = 0; s.dodge = 0;
    s.hp = s.maxHp;

    const was = s.enemies.getChildren().filter((e) => e.isMimic).length;
    s.springMimic({ disguise: SLOT.TREASURE, x: s.player.x, y: s.player.y - 40 });
    const born = s.enemies.getChildren().filter((e) => e.isMimic);
    const m = born[born.length - 1];
    if (!m) return { disguised, same, shown, was, made: 0 };

    // 보통 적 하나와 견줍니다 — 미믹은 단단해야 하고, 한 입은 작아야 합니다.
    const plain = spawnEnemy(s, 50, s.player.y, s.floorIndex, 'crawler');
    const ratio = plain ? m.maxHp / plain.maxHp : 0;
    const bite = plain ? m.contactDamage / plain.contactDamage : 0;
    if (plain) plain.destroy();

    // 중력을 안 받아야 층을 가로질러 쫓아옵니다.
    const flies = !m.body.allowGravity;

    // 제 박자로 씹되, 물려도 무적 시간은 새로 걸리지 않아야 합니다.
    const hp0 = s.hp;
    s.lastHitAt = -9999;
    m.nextBiteAt = 0;
    s.mimicBite(m);          // 한 입
    const hp1 = s.hp;
    const invulnKept = s.lastHitAt < 0; // 물려도 무적을 얻지 않았는가
    s.mimicBite(m);          // 곧바로 또 불러도 제 간격 전이라 안 들어감
    const hp2 = s.hp;

    m.destroy();
    s.hp = s.maxHp;
    return { disguised, same, shown, was, made: born.length - was,
      ratio, bite, flies, hp0, hp1, hp2, invulnKept,
      speed: CFG.mimic.speed, maxSpeed: CFG.enemy.maxSpeed };
  });
  check(mimic.disguised, '미믹이 보물상자인 척할 수 있음');
  check(mimic.same === 'item-treasure' && mimic.shown === 'item-fake-treasure',
    '드러나기 전엔 진짜 상자 그림, 드러나면 아가리',
    mimic.same + ' → ' + mimic.shown);
  check(mimic.made === 1, '밟으면 터지는 대신 한 마리가 일어섬',
    `미믹 ${mimic.was}마리 → ${mimic.was + mimic.made}마리`);
  check(mimic.ratio >= 3, '보통 적보다 훨씬 단단함',
    `기는 것의 ${(mimic.ratio || 0).toFixed(1)}배`);
  check(mimic.bite > 0 && mimic.bite < 1, '한 입은 보통 적보다 작음',
    `기는 것의 ${(mimic.bite || 0).toFixed(2)}배`);
  check(mimic.flies, '중력을 안 받아 층을 가로질러 쫓아옴');
  check(mimic.speed > mimic.maxSpeed, '보통 적이 낼 수 없는 속도로 쫓아옴',
    `${mimic.speed} > 보통 적 상한 ${mimic.maxSpeed}`);
  check(mimic.hp1 < mimic.hp0, '붙어 있으면 물어뜯음',
    `${mimic.hp0} → ${Math.round(mimic.hp1)}`);
  check(mimic.hp2 === mimic.hp1, '제 간격 전에는 두 번 안 뭄',
    `${Math.round(mimic.hp1)} → ${Math.round(mimic.hp2)}`);
  check(mimic.invulnKept, '물려도 무적 시간을 얻지 않음 (미믹이 방패가 되지 않게)');

  console.log(bad ? `\n${bad}건 어긋남` : '\n새로 들어온 일곱 가지 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
