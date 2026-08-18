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
    weapons: {}, boosts: {}, relics: {}, unlocked: {}, lastJob: 'warrior', sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  // 켜면 타이틀 화면이 먼저 섭니다 (js/scene-title.js). 사람처럼 한 번 지납니다 —
  // 안 지나면 아래가 전부 타이틀 화면 위에서 헛돕니다.
  await page.waitForFunction(() => window.__title && window.__title.ready,
    null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);

  // 직업 → 메달 상점 → 탑
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
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

  // ── 잿비 — 약한 대신 피할 자리가 없는 공격 ──────────────
  // 나머지 넷은 전부 "안전한 줄"이 있습니다. 이것 하나만 없습니다.
  // 한 발씩 시차를 두고 나오고, 먼저 나온 것은 바닥에 닿아 사라집니다.
  // 어느 한 순간을 재면 몇 발밖에 안 보이므로, 나오는 동안 모아서 셉니다.
  const rain = await page.evaluate(async () => {
    const s = window.__scene;
    const r = CFG.boss.rain;
    // 보스가 제 시계로 다른 패턴을 겹쳐 쏘면 그것까지 세어 버립니다.
    // 재는 동안만 다음 차례를 멀리 밀어 둡니다.
    //
    // **밀어 두는 것만으로는 모자랍니다.** 이미 나간 패턴은 예고(850ms)와
    // 줄 사이 간격(320ms×2)만큼 뒤에 떨어지도록 delayedCall 로 예약돼 있어서,
    // 곧바로 재면 그 늦둥이가 잿비에 섞여 들어옵니다 (한 발이 무겁고 빠르고
    // fromBoss 가 붙어 있어서 셋 다 틀립니다). 예약된 것이 다 떨어질 때까지
    // 기다렸다가 비우고 시작합니다.
    s.boss.nextVolleyAt = s.time.now + 1e6;
    await new Promise((ok) => setTimeout(ok, 1600));
    s.enemyBullets.clear(true, true);
    bossRain(s, s.boss);

    // **시간이 아니라 결과를 기다립니다.** 잿비는 게임 시계(delayedCall)를
    // 타는데 여기서 재는 것은 벽시계라, 창을 시간으로 잡으면 게임이 조금만
    // 느려져도 열넷 중 셋만 보고 창이 닫힙니다 (실제로 그랬습니다).
    // 다 나올 때까지 기다리되, 안 나오면 매달리지 않게 뚜껑을 둡니다.
    const seen = [];
    const giveUp = Date.now() + 8000;
    while (seen.length < r.count && Date.now() < giveUp) {
      s.enemyBullets.getChildren().forEach((b) => {
        if (b.__counted) return;
        b.__counted = true;
        seen.push({ x: b.x, dmg: b.dmg, vy: b.body.velocity.y, fromBoss: !!b.fromBoss });
      });
      await new Promise((ok) => setTimeout(ok, 40));
    }

    // 세 줄 어디에 서 있어도 머리 위로 하나쯤은 지나가는가.
    const covered = LANES.filter((l) =>
      seen.some((b) => Math.abs(b.x - CFG.laneX[l]) < 70)).length;
    const heavy = Math.round(CFG.boss.shotDamage * (1 + s.boss.floor * CFG.enemy.dmgPerFloor));
    return {
      n: seen.length, covered, heavy, want: r.count,
      dmg: seen.length ? seen[0].dmg : 0,
      // 잿비에는 fromBoss 를 안 붙입니다 — 도적의 회피가 온전히 통해야 합니다.
      plainDodge: seen.every((b) => !b.fromBoss),
      slower: seen.every((b) => b.vy < 620),
    };
  });
  check(rain.n >= rain.want * 0.6, '잿비는 한 번에 여러 발이 쏟아짐',
    `${rain.n}발 (설정 ${rain.want})`);
  check(rain.covered === 3, '세 줄 어디에도 안전한 자리가 없음',
    `${rain.covered}/3 줄이 덮임`);
  check(rain.dmg > 0 && rain.dmg < rain.heavy * 0.5, '대신 한 발이 아주 가벼움',
    `${rain.dmg} vs 내리꽂기 ${rain.heavy}`);
  check(rain.slower, '내리꽂기보다 느리게 떨어짐 (보고 비킬 수 있게)');
  check(rain.plainDodge, '회피가 온전히 통함 (자리로는 못 피하는 공격이므로)');
  await page.evaluate(() => window.__scene.enemyBullets.clear(true, true));

  // 눈의 값들은 CFG 에서 읽어 둡니다 — 손으로 적으면 CFG 를 만질 때마다
  // 여기가 같이 틀립니다.
  const [CFG_EYE_SCALE, CFG_EYE_RATE, CFG_EYE_SHARE, CFG_HATCH_N] = await page.evaluate(() =>
    [CFG.trophy.eye.scale, CFG.trophy.eye.rate, CFG.trophy.eye.dpsShare, CFG.trophy.hatch.count]);

  // 보스를 죽여 보고 길이 다시 열리는지 확인합니다.
  // 메달은 **죽이기 직전 잔액**과 견줍니다 — 200층까지 오르는 동안 층에서
  // 하나가 들어와 있어서, 0인지 보면 층 규칙을 잡게 됩니다.
  //
  // **죽지 않게 먼저 받쳐 둡니다.** 여기까지 오는 동안 보스가 내리꽂는 것을
  // 그대로 맞고 서 있었기 때문에, 열 번에 서너 번은 이 자리에서 이미 죽어
  // 있었습니다. 죽으면 update 가 첫 줄에서 물러나므로 **전리품이 한 줄도 안
  // 돕니다** — 그런데 화면에는 오류가 안 나서, 아래 여덟 가지가 전부 「아무
  // 일도 안 일어났다」로 조용히 어긋났습니다. 재려는 것은 보스를 견디는
  // 능력이 아니라 전리품이 하는 일입니다.
  const survived = await page.evaluate(() => {
    const s = window.__scene;
    const was = s.dead;
    s.dead = false;
    s.hp = s.maxHp = 1e9;
    return !was;
  });
  check(true, '보스 층에서 전리품을 재기 전에 받쳐 둠',
    survived ? '멀쩡히 서 있었음' : '이미 죽어 있어 되살림');
  const medalsBefore = await page.evaluate(() => window.__scene.medals);
  await page.evaluate(() => {
    const s = window.__scene;
    s.hitEnemy(s.boss, s.boss.maxHp * 2);
  });
  await page.waitForTimeout(700);

  // ── 판이 멈추고 한 장이 펼쳐집니다 ─────────────────────
  // 보스를 넘은 자리는 지나가면서 읽게 두면 안 되는 자리라, 알림 두 줄이
  // 아니라 창 하나로 바꿨습니다 (js/scene-trophy.js). 그래서 **여기서부터
  // 판은 멈춰 있습니다** — 아래에서 재려는 전리품은 update 가 도는 동안에만
  // 일하므로, 창을 안 닫으면 그 뒤가 전부 「아무 일도 안 일어났다」가 됩니다.
  const shown = await page.evaluate(() => {
    const s = window.__scene;
    const w = window.__trophy;
    return {
      up: !!(w && w.scene && w.scene.isActive('trophy')),
      paused: !s.scene.isActive('game'),
      name: w && w.trophy ? w.trophy.name : '',
    };
  });
  check(shown.up && shown.paused, '전리품은 판을 멈추고 한 장으로 알림',
    (shown.name || '창이 없음') + ' · 판 멈춤 ' + shown.paused);

  await page.evaluate(() => window.__trophy.close());
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => {
    const s = window.__scene;
    return { live: s.scene.manager.getScenes(true).map((x) => x.scene.key).join(','),
      trophies: s.trophies.count };
  });
  check(closed.live.includes('game') && !closed.live.includes('trophy'),
    '창을 닫으면 판이 다시 흐름', '살아 있는 장면 ' + closed.live);

  const after = await page.evaluate(() => {
    const s = window.__scene;
    const eye = s.trophies.eyes[0];
    return {
      fight: s.bossFight,
      above: Array.from(s.floors.keys()).filter((i) => i > 200).length,
      medals: s.medals,
      trophies: s.trophies.count,
      label: s.trophies.label(),
      // 눈은 주인공 키의 1/10 (CFG.trophy.eye.scale).
      ratio: eye ? eye.displayHeight / s.player.displayHeight : 0,
    };
  });
  check(!after.fight && after.above > 0, '보스를 잡으면 길이 다시 열림', after.above + '층 생성');

  // ── 보상은 메달이 아니라 전리품입니다 ──────────────────
  // 메달은 100층마다 층에서 나오는 것 하나로 모았습니다. 보스가 더 얹으면
  // 그 규칙이 규칙이 아니게 됩니다.
  check(after.medals === medalsBefore, '보스는 메달을 안 줌 (메달은 100층마다 층에서)',
    medalsBefore + ' → ' + after.medals);
  check(after.trophies === 1, '대신 전리품을 하나 줌', after.label);
  check(Math.abs(after.ratio - CFG_EYE_SCALE) < 0.02,
    '눈은 주인공 키의 1/10', after.ratio.toFixed(3));

  // **주인공을 따라 돕니다.** 한 바퀴 도는 동안의 자리를 모아서 봅니다 —
  // 한 순간만 재면 타원의 위아래에서는 주인공과 거의 겹칩니다.
  const orbit = await page.evaluate(async () => {
    const s = window.__scene;
    const xs = [];
    const ys = [];
    for (let i = 0; i < 24; i++) {
      xs.push(s.trophies.eyes[0].x - s.player.x);
      ys.push(s.trophies.eyes[0].y - s.player.y);
      await new Promise((r) => setTimeout(r, CFG.trophy.eye.spinMs / 24));
    }
    return {
      wide: Math.round(Math.max(...xs) - Math.min(...xs)),
      tall: Math.round(Math.max(...ys) - Math.min(...ys)),
      r: CFG.trophy.eye.orbitR, ry: CFG.trophy.eye.orbitRy,
    };
  });
  check(orbit.wide > orbit.r * 1.5 && orbit.tall > orbit.ry,
    '주인공을 둘레로 한 바퀴 돎 (타원)', orbit.wide + '×' + orbit.tall + 'px');

  // 스스로 쏩니다. 사람이 하는 일이 없어야 **보조**입니다.
  // **날아가는 것을 세면 안 됩니다.** 눈빛은 맞는 순간 사라지므로, 재는
  // 그 찰나에 하늘에 몇 개 떠 있느냐는 운에 달립니다. 쏜 횟수를 셉니다.
  const bolt = await page.evaluate(async () => {
    const s = window.__scene;
    const e = spawnEnemy(s, s.player.x + 100, s.player.y - 20, 60, 'walker');
    if (e) { e.hp = 99999; e.maxHp = 99999; }
    const real = s.fireEyeBolt.bind(s);
    let n = 0;
    s.fireEyeBolt = (...a) => { n++; return real(...a); };
    await new Promise((r) => setTimeout(r, CFG.trophy.eye.rate * 2.5));
    s.fireEyeBolt = real;
    return { shots: n, dmg: s.trophies.share(CFG.trophy.eye.dpsShare, CFG.trophy.eye.rate),
      dps: s.weapon.dps };
  });
  check(bolt.shots > 0, '눈이 스스로 쏨', bolt.shots + '발');
  // 세기는 지금 든 자루의 초당 피해에 매답니다. 고정값이면 아래층에서는
  // 주인공보다 세고 위층에서는 있으나 마나가 됩니다.
  const share = bolt.dmg * 1000 / CFG_EYE_RATE / bolt.dps;
  check(Math.abs(share - CFG_EYE_SHARE) < 0.03,
    '세기가 주인공 초당 피해에 비례', (share * 100).toFixed(0) + '%');

  // 한도 — 넷째 보스부터는 더 안 쌓입니다.
  const cap = await page.evaluate(() => {
    const s = window.__scene;
    const got = [];
    for (let i = 0; i < 4; i++) got.push(s.trophies.take(TROPHIES.eye));
    return { got, eyes: s.trophies.eyes.length, max: CFG.trophy.maxEyes };
  });
  check(cap.eyes === cap.max && cap.got[cap.max] === false,
    '눈은 ' + cap.max + '개까지만 쌓임', cap.eyes + '개 · ' + JSON.stringify(cap.got));

  // ── 나머지 넷 ──────────────────────────────────────────
  // 다섯이 저마다 **다른 일**을 해야 합니다. 넷이 같은 일을 하면 그건 하나를
  // 네 번 받은 것과 같습니다.
  //
  // **시계로 재면 안 됩니다.** 이 검사들은 창을 셋 띄워 놓고 도는데, 뒤에
  // 있는 창은 브라우저가 프레임을 죄어서 벽시계 1초가 게임 안에서 얼마인지
  // 알 수 없습니다. 그래서 전부 **결과가 나올 때까지** 기다립니다.
  //
  // **freeze 를 주면 여섯이 그 자리에 못 박힙니다.** 기는 놈은 초당 210px 로
  // 달려드는데, 눈길은 겨누고 나서 460ms 뒤에 터집니다. 그동안 여섯은 한 줄을
  // 버리고 주인공에게 몰리고, 둘은 아예 발판에서 떨어집니다 — 재려던 것은
  // 「한 줄을 꿰뚫는가」인데 실제로 재고 있던 것은 「460ms 동안 얼마나
  // 흩어지는가」였습니다. 그래서 프레임이 조금만 달라져도 4/6 이었다가
  // 2/6 이 됐습니다. 칼을 꺼 두는 것과 같은 까닭입니다.
  const seedRow = (gap, freeze) => page.evaluate(([gap, freeze]) => {
    const s = window.__scene;
    s.bossFight = false;
    if (s.boss) { s.boss.destroy(); s.boss = null; }
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.hp = s.maxHp = 1e9;
    // **주인공의 칼을 꺼 둡니다.** 전사는 사거리 안을 매번 베고 기절까지 걸어서,
    // 안 끄면 전리품이 한 일과 칼이 한 일이 뒤섞여 아무것도 못 잽니다.
    s.weapon.hits = () => false;
    s.trophies.reset();
    window.__mark = [];
    for (let i = 0; i < 6; i++) {
      const e = spawnEnemy(s, s.player.x + gap + i * 40, s.player.y - 16, 620, 'crawler');
      if (e) {
        e.hp = e.maxHp = 1e6;
        if (freeze) { e.speed = 0; e.body.velocity.set(0, 0); }
        window.__mark.push(e);
      }
    }
    return window.__mark.length;
  }, [gap, freeze]);

  check(await page.evaluate(() => CFG.boss.kinds.every((k) => trophyForBoss(k))
      && new Set(CFG.boss.kinds.map((k) => trophyForBoss(k).key)).size === 5),
    '보스 다섯이 저마다 다른 것을 내놓음',
    (await page.evaluate(() => CFG.boss.kinds.map((k) => trophyForBoss(k).name).join(' · '))));

  // 꿰뚫는 눈길 — **늘어선 여럿을 한 번에**. 가장 가까운 놈을 겨누면 각이
  // 가팔라져 멀리 있는 놈이 선 밖으로 밀려나므로, 가장 많이 꿰뚫는 쪽을 고릅니다.
  await seedRow(150, true);
  const gaze = await page.evaluate(async () => {
    const s = window.__scene;
    s.trophies.take(TROPHIES.gaze);
    s.trophies.gazeAt = 0;
    const start = window.__mark.map((e) => e.hp);
    for (let i = 0; i < 80; i++) {
      const now = window.__mark.map((e) => (e.active ? e.hp : 0));
      const hit = start.filter((h, k) => now[k] < h).length;
      if (hit) return { hit, all: start.length };
      await new Promise((r) => setTimeout(r, 100));
    }
    return { hit: 0, all: start.length };
  });
  check(gaze.hit >= 3, '눈길은 한 번에 여럿을 꿰뚫음', gaze.hit + '/' + gaze.all + '마리');

  // 불집게 — 둘레의 적을 한꺼번에 집습니다. **한도가 있어야** 합니다.
  await seedRow(150);
  const claw = await page.evaluate(async () => {
    const s = window.__scene;
    window.__mark.forEach((e, i) => {
      const a = (Math.PI * 2 * i) / 6;
      e.setPosition(s.player.x + Math.cos(a) * 90, s.player.y + Math.sin(a) * 50);
    });
    s.trophies.take(TROPHIES.claw);
    s.trophies.clawAt = 0;
    const start = window.__mark.map((e) => e.hp);
    let held = 0;
    for (let i = 0; i < 80; i++) {
      // 집게가 잡은 것만 셉니다 (clawUntil). 기절만 보면 칼이 건 것과 섞입니다.
      held = Math.max(held, window.__mark.filter((e) => e.clawUntil > s.time.now).length);
      const now = window.__mark.map((e) => (e.active ? e.hp : 0));
      const burned = start.filter((h, k) => now[k] < h).length;
      if (burned >= CFG.trophy.claw.max) {
        return { held, burned, max: CFG.trophy.claw.max, all: start.length };
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { held, burned: 0, max: CFG.trophy.claw.max, all: start.length };
  });
  check(claw.held === claw.max, '집게는 둘레의 적을 한도까지만 붙잡음',
    claw.held + '/' + claw.all + '마리 (한도 ' + claw.max + ')');
  check(claw.burned >= claw.max, '붙잡힌 것이 탐', claw.burned + '마리');

  // 깨어난 알 — 셋이 튀어다니며 갉습니다. **자리가 바뀌어야** 튀는 것입니다.
  await seedRow(180);
  const hatch = await page.evaluate(async () => {
    const s = window.__scene;
    s.trophies.take(TROPHIES.hatch);
    const start = window.__mark.map((e) => e.hp);
    const p1 = [];
    for (let i = 0; i < 80; i++) {
      if (!p1.length && s.trophies.hatchlings.length) {
        s.trophies.hatchlings.forEach((b) => p1.push(Math.round(b.x) + ',' + Math.round(b.y)));
      }
      const now = window.__mark.map((e) => (e.active ? e.hp : 0));
      const gnawed = start.filter((h, k) => now[k] < h).length;
      const p2 = s.trophies.hatchlings.map((b) => Math.round(b.x) + ',' + Math.round(b.y));
      if (gnawed > 0 && p1.filter((v, k) => v !== p2[k]).length === p1.length) {
        return { n: s.trophies.hatchlings.length, gnawed, moved: p1.length,
          attached: s.trophies.hatchlings.filter((b) => b.target).length };
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { n: s.trophies.hatchlings.length, gnawed: 0, moved: 0, attached: 0 };
  });
  check(hatch.n === CFG_HATCH_N, '알은 ' + CFG_HATCH_N + '마리', hatch.n + '마리');
  check(hatch.gnawed > 0 && hatch.moved === hatch.n, '셋이 튀어다니며 갉음',
    hatch.gnawed + '마리를 갉음 · 붙어 있는 것 ' + hatch.attached);

  // 붙어 있던 놈이 쓰러질 때가 되면 놓고 옮겨 붙습니다 — 어차피 죽을 놈을
  // 마저 갉는 것은 버리는 피해입니다.
  const moved = await page.evaluate(async () => {
    const s = window.__scene;
    const b = s.trophies.hatchlings.find((x) => x.target);
    if (!b) return { ok: false, why: '붙은 것이 없음' };
    const was = b.target;
    was.hp = was.maxHp * 0.1;
    for (let i = 0; i < 40; i++) {
      if (b.target !== was) return { ok: true };
      await new Promise((r) => setTimeout(r, 100));
    }
    return { ok: false, why: '안 옮김' };
  });
  check(moved.ok, '쓰러질 놈은 놓고 다른 놈에게 옮겨 붙음', moved.why);

  // 갈라진 가면 — 한 대를 **통째로** 막고 깨졌다가 다시 생깁니다.
  const mask = await page.evaluate(async () => {
    const s = window.__scene;
    s.trophies.reset();
    s.trophies.take(TROPHIES.mask);
    s.dodge = 0;
    s.armor = 50;              // 방어력이 있어도 **통째로** 막아야 합니다
    s.hp = s.maxHp = 1000;
    const worn = !!s.trophies.mask;
    s.hurt(300);
    const blocked = { hp: s.hp, mask: !!s.trophies.mask };
    s.hurt(300);               // 두 번째는 그대로 맞습니다
    const second = s.hp;
    s.trophies.maskAt = s.time.now + 100;   // 재생 시각을 앞당겨서 봅니다
    let back = false;
    for (let i = 0; i < 40 && !back; i++) {
      back = !!s.trophies.mask;
      await new Promise((r) => setTimeout(r, 100));
    }
    return { worn, blocked, second, back, regenMs: CFG.trophy.mask.regenMs };
  });
  check(mask.worn, '가면을 쓰고 있음');
  check(mask.blocked.hp === 1000 && !mask.blocked.mask,
    '한 대를 통째로 막고 깨짐 (방어력이 있어도)', '체력 1000 → ' + mask.blocked.hp);
  check(mask.second < 1000, '깨진 뒤에는 그대로 맞음', '체력 → ' + mask.second);
  check(mask.back, (mask.regenMs / 1000) + '초 뒤 다시 생김');

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
