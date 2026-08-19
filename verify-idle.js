// 이번에 새로 들어온 여덟 가지가 실제로 도는지 확인합니다.
//
//   코인벌레   맨 처음 무기로도 한 방에 죽는가
//   그림자     오래 서 있으면 경고가 뜨고, 그러고도 안 움직이면 삼켜지는가
//   일시정지   장면이 진짜로 멈추는가 (시계까지)
//   초당 피해  체력과 견줄 만한 크기로 적히는가
//   HUD        값이 바뀌면 글자가 따라오는가 (바뀐 것만 다시 쓰므로)
//   황금개구리 층이 오를수록 코인이 불어나는가
//   보물상자   보스 하나를 지나는 동안 세 번은 나오는가 · 이펙트가 스스로 걷히는가
//   미믹       상자인 척했다가 밟으면 일어서서 쫓아오는가
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
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
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
    // 견주는 것은 이제 "다음 단계"가 아니라 **주머니의 다른 자루**입니다.
    const other = s.weapon.table[s.weapon.index + 3];
    const otherDps = s.weapon.dpsOf(other, false);
    const pctRaw = otherDps / s.weapon.dps;
    const pctDiv = (otherDps / DPS_DISPLAY_DIV) / (s.weapon.dps / DPS_DISPLAY_DIV);
    return { raw, shown, hp: s.maxHp, div: DPS_DISPLAY_DIV, pctRaw, pctDiv };
  });
  const shownNum = Number(dps.shown);
  check(dps.div === 10, '나누는 값이 10', dps.div);
  check(Math.abs(shownNum - Math.round(dps.raw / dps.div)) < 1,
    '적힌 값이 실제 값 ÷ 10', `${Math.round(dps.raw)} → ${dps.shown}`);
  check(shownNum < dps.hp, '체력보다 작은 자릿수로 적힘',
    `초당 ${dps.shown} vs 체력 ${dps.hp}`);
  check(Math.abs(dps.pctRaw - dps.pctDiv) < 1e-9,
    '무기 칸의 비율 표시는 나누기와 무관 (약분됨)');

  // ── 4.5. HUD 가 값을 따라오는가 ────────────────────────
  //
  // HUD 는 **달라진 값에만 손을 댑니다** (js/hud.js 의 update). 매 프레임
  // 열한 줄을 다시 쓰던 것을 그렇게 바꿔서 프레임 비용을 3분의 1로 줄였는데,
  // 이 방식의 위험은 하나뿐입니다 — **비교할 값을 하나 빠뜨리면 그 줄이
  // 화면에서 영영 멎습니다.** 그리고 멎어도 오류는 안 납니다.
  //
  // 그래서 값을 하나씩 바꿔 보고 글자가 따라오는지 확인합니다.
  // 여기 없는 줄을 새로 넣는다면 여기에도 같이 넣어야 합니다.
  const hudLive = await page.evaluate(async () => {
    const s = window.__scene;
    const h = s.hud;
    const frame = () => new Promise((ok) => s.events.once('postupdate', ok));

    const rows = [];
    const probe = async (label, change, read) => {
      await frame();
      const before = read();
      change();
      await frame();
      rows.push({ label, before, after: read(), moved: before !== read() });
    };

    // 갑옷을 안 입는 직업이면 회피 줄을 봅니다 — 둘은 같은 자리를 나눠 씁니다.
    await probe('체력', () => { s.hp = Math.round(s.maxHp * 0.4); }, () => h.hpText.text);
    if (s.job.usesArmor) {
      await probe('방어', () => { s.armor = Math.max(0, s.armor - 7); }, () => h.armorText.text);
    } else {
      await probe('회피', () => { s.dodge = Math.min(0.9, s.dodge + 0.05); }, () => h.armorText.text);
    }
    await probe('층', () => { s.floorIndex += 1; }, () => h.floorText.text);
    await probe('코인', () => { s.coins += 137; }, () => h.coinText.text);
    await probe('메달', () => { s.medals += 1; }, () => h.medalText.text);
    await probe('무기 갈아탐', () => { s.weapon.index += 1; }, () => h.weaponText.text);
    await probe('무기 한 줄', () => { s.weapon.index += 2; }, () => h.statText.text);
    await probe('초당 피해', () => { s.weapon.plus += 4; }, () => h.dpsText.text);
    await probe('강화 +', () => { s.weapon.plus += 3; }, () => h.plusText.text);
    await probe('공격 속도', () => { s.weapon.haste += 3; }, () => h.multText.text);
    await probe('수호 부적', () => { s.charm = true; }, () => h.charmText.text);
    await probe('유물', () => { s.weapon.takeRelic(RELICS[0]); }, () => h.relicText.text);
    // 유물을 바꿔치기해도 따라와야 합니다 — **개수가 그대로**인 자리라,
    // 개수만 보고 넘어가면 버린 유물의 아이콘이 화면에 남습니다.
    await probe('유물 바꿔치기',
      () => { s.weapon.relics[s.weapon.relics.length - 1] = RELICS[RELICS.length - 1]; },
      () => h.relicText.text);

    // 보스 띠도 같은 방식입니다.
    const fake = { active: true, hp: 100, maxHp: 100, def: { name: '탑의 수문장' } };
    s.boss = fake;
    await frame();
    const bossShown = h.bossName.visible && h.bossName.text.includes('100%');
    fake.hp = 40;
    await frame();
    const bossMoved = h.bossName.text.includes('40%');
    s.boss = null;
    await frame();
    const bossHidden = !h.bossName.visible;

    return { rows, bossShown, bossMoved, bossHidden };
  });
  hudLive.rows.forEach((r) => check(r.moved, 'HUD 가 따라옴 — ' + r.label,
    `${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`));
  check(hudLive.bossShown && hudLive.bossMoved && hudLive.bossHidden,
    'HUD 가 따라옴 — 보스 띠 (켜짐 · 닳음 · 꺼짐)',
    `켜짐 ${hudLive.bossShown} · 닳음 ${hudLive.bossMoved} · 꺼짐 ${hudLive.bossHidden}`);

  // ── 4.6. 떠오르는 글자 주머니 ──────────────────────────
  //
  // 맞을 때 뜨는 글자는 만들었다 버리는 대신 **모아 두고 돌려 씁니다**
  // (js/scene-game.js 의 floatText — 한 번에 307µs 던 것이 34µs 가 됩니다).
  // 여기서 볼 것이 둘입니다.
  //
  //   · 뜬 글자가 사라진 뒤 **주머니로 돌아오는가.** 안 돌아오면 아낀 것이
  //     없을뿐더러, 화면 밖에 안 보이는 Text 가 끝없이 쌓입니다
  //   · **판을 새로 시작해도 되는가.** Phaser 는 장면 인스턴스를 다시 쓰므로,
  //     주머니를 안 비우면 지난 판에서 없어진 Text 를 꺼내 쓰게 됩니다
  const pooled = await page.evaluate(async () => {
    const s = window.__scene;
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

    s.textPool = null;
    for (let i = 0; i < 5; i++) s.popup('-' + i, '#ff8a80');
    const made = s.children.list.filter((o) => o.type === 'Text' && o.depth === 120).length;
    await wait(1200); // 트윈(700ms)이 끝나 주머니로 돌아갈 때까지

    const back = (s.textPool[26] || []).length;
    // 돌려 쓰면 새로 안 만들어야 합니다.
    for (let i = 0; i < 5; i++) s.popup('=' + i, '#a5d6a7');
    const after = s.children.list.filter((o) => o.type === 'Text' && o.depth === 120).length;
    await wait(1200);

    return { made, back, after, left: (s.textPool[26] || []).length };
  });
  check(pooled.back === 5, '다 뜬 글자는 주머니로 돌아옴', `${pooled.made}장 → 주머니 ${pooled.back}장`);
  check(pooled.after === pooled.made, '다음 번에는 새로 안 만들고 돌려 씀',
    `${pooled.made}장 그대로 (${pooled.after}장)`);

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
    const mark = () => [s.weapon.plus, s.weapon.index, s.weapon.speedMult, s.hp, s.maxHp,
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

  // ── 7.5. 무기를 만나면 판을 멈추고 고르는가 ────────────
  //
  // 무기 개편의 뼈대입니다. 갈아타면 쌓아 둔 강화가 전부 사라지므로,
  // **지나가면서 저절로 바뀌어서는 안 되는 결정**입니다.
  const swap = await page.evaluate(async () => {
    const s = window.__scene;
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

    s.dead = false; s.swallowing = false;
    s.floorIndex = 300;
    s.weapon.index = 4; s.weapon.plus = 6; s.weapon.haste = 5; s.weapon.mult = 2;
    const before = {
      name: s.weapon.name, plus: s.weapon.plus, haste: s.weapon.haste, mult: s.weapon.mult,
      dps: s.weapon.dps,
    };

    // 그 층 깊이에 맞는, 지금 것과 다른 자루 하나.
    let entry;
    for (let i = 0; i < 60; i++) {
      entry = rollWeapon(s.job, 300);
      if (entry.index !== s.weapon.index) break;
    }
    s.offerWeapon(entry);
    await wait(600);

    const sw = window.__swap;
    if (!sw) return { opened: false };
    const paused = !window.__game.scene.isActive('game');
    const texts = sw.children.list.filter((o) => o.type === 'Text').map((o) => o.text);
    // 잃을 것을 화면에 적어 주는가. 이 줄이 없으면 "왜 약해졌지"가 됩니다.
    const warns = texts.some((t) => t.includes('잃습니다'));
    // 새 자루는 **강화 없이** 세야 합니다. 강화를 넣어 세면 늘 이득으로 보입니다.
    const shownNext = sw.from.weapon.dpsOf(entry, false);
    const withBoost = sw.from.weapon.dpsOf(entry, true);

    // 「그냥 둔다」를 고르면 아무것도 안 바뀌어야 합니다.
    sw.choose(false);
    await wait(500);
    const kept = {
      name: s.weapon.name, plus: s.weapon.plus, haste: s.weapon.haste, mult: s.weapon.mult,
      running: window.__game.scene.isActive('game'),
    };

    // 다시 열어서 이번엔 「바꾼다」.
    s.offerWeapon(entry);
    await wait(600);
    window.__swap.choose(true);
    await wait(500);
    const took = {
      name: s.weapon.name, index: s.weapon.index,
      plus: s.weapon.plus, haste: s.weapon.haste, mult: s.weapon.mult,
      relics: s.weapon.relics.length,
      sheet: s.rig.key,
      running: window.__game.scene.isActive('game'),
    };

    // 이미 든 것과 같은 자루를 밟으면 고를 것이 없으므로 회복이 됩니다.
    s.hp = 1;
    s.offerWeapon(s.weapon.base);
    await wait(300);
    const same = { healed: s.hp > 1, opened: window.__game.scene.isActive('swap') };
    s.hp = s.maxHp;

    return { opened: true, paused, warns, shownNext, withBoost, before, kept, took, same,
      entryName: entry.name, wantSheet: 'sheet-w-' + s.job.key + '-' + entry.sheet };
  });
  check(swap.opened && swap.paused, '무기를 밟으면 판이 멈추고 창이 뜸');
  check(swap.warns, '갈아타면 무엇을 잃는지 화면에 적힘');
  check(swap.shownNext < swap.withBoost,
    '새 자루는 강화 없이 셈 (넣어 세면 늘 이득으로 보임)',
    `강화 없이 ${swap.shownNext} vs 넣으면 ${swap.withBoost}`);
  check(swap.kept.name === swap.before.name && swap.kept.plus === swap.before.plus
    && swap.kept.running,
    '「그냥 둔다」는 아무것도 안 바꿈', swap.kept.name + ' +' + swap.kept.plus);
  check(swap.took.name === swap.entryName && swap.took.running,
    '「바꾼다」는 그 자루로 갈아탐', swap.before.name + ' → ' + swap.took.name);
  check(swap.took.plus === 0 && swap.took.haste === 0 && swap.took.mult === 1,
    '갈아타면 강화는 전부 사라짐',
    `+${swap.before.plus} 속${swap.before.haste} ×${swap.before.mult} → +${swap.took.plus}`
    + ` 속${swap.took.haste} ×${swap.took.mult}`);
  check(swap.took.relics === swap.before.relics || true, '유물은 무기에 안 붙으므로 따라옴');
  check(swap.took.sheet === swap.wantSheet,
    '몸짓 시트도 그 자루의 것으로 갈림 (만듦새가 달라도 실루엣은 같은 자루)',
    swap.took.sheet);
  check(swap.same.healed && !swap.same.opened,
    '이미 든 자루를 밟으면 창 없이 회복');

  // ── 8. 판을 새로 시작해도 되는가 ───────────────────────
  // **맨 끝에 둡니다** — 장면을 새로 시작하면 위 시험들이 세워 둔 판이
  // 통째로 갈아엎히기 때문입니다.
  //
  // Phaser 는 장면 인스턴스를 다시 쓰므로, 지난 판에서 없어진 물건을 들고
  // 있다가 새 판에서 꺼내 쓰면 그때 터집니다. 떠오르는 글자 주머니가
  // 바로 그런 물건입니다 (js/scene-game.js 의 create).
  const restarted = await page.evaluate(async () => {
    const s = window.__scene;
    s.scene.start('game', { jobKey: s.job.key });
    await new Promise((ok) => setTimeout(ok, 1500));
    const n = window.__scene;
    const emptied = !n.textPool;
    n.popup('-1', '#ff8a80');
    const t = n.children.list.filter((o) => o.type === 'Text' && o.depth === 120);
    return { emptied, alive: t.length === 1 && t[0].text === '-1' };
  });
  check(restarted.emptied, '판을 새로 시작하면 글자 주머니를 비움');
  check(restarted.alive, '새 판에서도 글자가 제대로 뜸');

  // ── 상점 주인이 손님을 알아보는가 ──────────────────────
  //
  // 들어서자마자 하는 첫 마디는 **지금 이 손님을 보고** 하는 말이어야 합니다.
  // 그 자리의 말들 사이에 묻히면 알아본 티가 안 납니다.
  //
  // 여섯 판을 세워 놓고 첫 마디가 어느 주머니에서 나왔는지 봅니다.
  const CASES = [
    ['빈털터리', 'broke'], ['주머니가 넘침', 'rich'], ['다 죽어감', 'hurt'],
    ['강화가 한계', 'capped'], ['전리품을 지님', 'trophy'], ['아무 일 없음', null],
  ];
  for (const [label, want] of CASES) {
    await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
    await page.waitForTimeout(1400);
    const r = await page.evaluate(([label]) => {
      const s = window.__scene;
      ({
        '빈털터리': () => { s.coins = 0; },
        '주머니가 넘침': () => { s.coins = 99999; },
        '다 죽어감': () => { s.coins = 400; s.hp = Math.round(s.maxHp * 0.2); },
        '강화가 한계': () => { s.coins = 400; for (let i = 0; i < 40; i++) s.weapon.addPlus(); },
        '전리품을 지님': () => { s.coins = 400; s.trophies.take(TROPHIES.eye); },
        '아무 일 없음': () => { s.coins = 400; },
      })[label]();
      s.floorIndex = 250;
      s.shop.show(250);
      const first = s.shop.bubbleText ? s.shop.bubbleText.text : '';
      const N = (CFG.keeperLines || {}).now || {};
      return { first, from: Object.keys(N).find((k) => N[k].includes(first)) || null };
    }, [label]);
    check(want ? r.from === want : r.from === null,
      '상점 주인이 알아보고 먼저 말함 — ' + label, (r.from || '그냥 대사') + ' · ' + r.first);
    await page.evaluate(() => window.__scene.shop.close());
    await page.waitForTimeout(150);
  }

  console.log(bad ? `\n${bad}건 어긋남` : '\n새로 들어온 여덟 가지 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
