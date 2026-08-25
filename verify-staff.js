// 직업의 능력들 — 마법사의 지팡이 넷(**화상 · 관통 · 광역 · 보호막**),
// 권법사의 **연타**, 사령술사의 **부하 셋**, 곰사냥꾼의 **곰**.
//
// 다섯 다 같은 부류입니다 — 자루나 직업에 값이 적혀 있고, 그 값을 읽는
// 코드가 있어야 비로소 무슨 일이 일어납니다.
//
// ── 이 시험이 있는 까닭 ─────────────────────────────────
// 넷 다 `js/classes.js` 의 자루에 **숫자로 적혀 있습니다.** 그런데 그 숫자를
// 읽는 코드가 없으면 **아무 일도 안 일어나고 오류도 안 납니다.** 지팡이는
// 멀쩡히 날아가고 적은 멀쩡히 맞습니다 — 그냥 안 타고, 안 뚫리고, 안 터지고,
// 덜 아프지 않을 뿐입니다.
//
// 그래서 「값이 적혀 있는가」가 아니라 **「그래서 무슨 일이 일어나는가」**를
// 봅니다. 적을 실제로 세워 놓고 때린 뒤 체력을 셉니다.
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
  const port = Number(process.env.PORT) || 8131;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'wizard' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });

  // ── 자루에 값이 적혀 있는가 ──────────────────────────────
  // 여기가 틀리면 아래가 전부 헛돕니다.
  const 적힘 = await page.evaluate(() => {
    const w = classByKey('wizard').weapons;
    return {
      화상: w.filter((x) => x.burn).map((x) => x.name + ' ' + x.burn),
      관통: w.filter((x) => x.pierce).map((x) => x.name + ' ' + x.pierce),
      광역: w.filter((x) => x.aoe).map((x) => x.name),
      보호막: w.filter((x) => x.shield).map((x) => x.name + ' ×' + x.shield),
    };
  });
  check(적힘.화상.length >= 2, '화상이 적힌 지팡이가 있음', 적힘.화상.join(' · '));
  check(적힘.관통.length >= 2, '관통이 적힌 지팡이가 있음', 적힘.관통.join(' · '));
  check(적힘.광역.length >= 2, '광역이 적힌 지팡이가 있음', 적힘.광역.join(' · '));
  check(적힘.보호막.length >= 2, '보호막이 적힌 지팡이가 있음', 적힘.보호막.join(' · '));

  // 그 자루를 손에 쥐어 주는 도구. 주머니에서 이름으로 찾습니다.
  const 쥐기 = (이름) => page.evaluate((n) => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    const i = pool.findIndex((w) => w.name.includes(n));
    if (i < 0) return null;
    s.weapon = new Weapon(s.job, i);
    return { name: pool[i].name, burn: s.weapon.burn, pierce: s.weapon.pierce,
      aoe: s.weapon.aoe, shield: s.weapon.shield };
  }, 이름);

  // ── 화상 ────────────────────────────────────────────────
  // 적 하나를 세워 놓고 한 대만 때린 뒤, **때리지 않고 기다립니다.**
  // 타는 자루면 그 뒤로도 체력이 깎여야 합니다.
  const 불 = await 쥐기('불의 지팡이');
  const 나무 = await 쥐기('나무 지팡이');
  check(불 && 불.burn > 0, '불의 지팡이를 쥐면 burn 이 딸려 옴', 불 && 불.burn);
  check(나무 && 나무.burn === 0, '나무 지팡이는 안 탐', 나무 && 나무.burn);

  // 실제로 적이 타는가. 적 하나를 세우고 한 대 먹인 뒤 시간을 흘립니다.
  const 탐 = await page.evaluate(async () => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    const i = pool.findIndex((w) => w.name.includes('불의 지팡이'));
    s.weapon = new Weapon(s.job, i);
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const e = s.enemies.create(s.player.x + 40, s.player.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 100000; e.maxHp = 100000; e.floor = 1; e.def = { key: 'crawler' };
    s.applyOil(e);
    const 처음 = e.hp;
    const 걸림 = { burnLeft: e.burnLeft, burnDmg: e.burnDmg, ring: !!e.burnRing };
    // 틱 네 번이 도는 동안 기다립니다 (500ms × 4 + 여유)
    await new Promise((r) => setTimeout(r, 2600));
    return { 걸림, 깎임: 처음 - e.hp, 살아있나: e.active };
  });
  check(탐.걸림.burnLeft > 0 && 탐.걸림.burnDmg > 0, '한 대 맞으면 불이 붙음',
    '틱 ' + 탐.걸림.burnLeft + '번 · 한 틱 ' + 탐.걸림.burnDmg);
  check(탐.걸림.ring, '타는 것이 눈에 보임 (고리가 생김)');
  check(탐.깎임 > 0, '**때리지 않아도 체력이 깎임**', 탐.깎임 + ' 깎임');

  // 기름을 함께 발라도 두 번 타지 않아야 합니다 — 센 쪽 하나만.
  const 겹침 = await page.evaluate(() => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    s.weapon = new Weapon(s.job, pool.findIndex((w) => w.name.includes('불의 지팡이')));
    const oil = RELICS.find((r) => r.key === 'hotoil');
    s.weapon.takeRelic(oil);
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const e = s.enemies.create(s.player.x + 40, s.player.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 100000; e.maxHp = 100000; e.floor = 1; e.def = { key: 'crawler' };
    s.applyOil(e);
    const 한번 = e.burnDmg;
    s.applyOil(e);
    return { 한번, 두번: e.burnDmg, 남은틱: e.burnLeft, ticks: CFG.relicFx.hotoil.ticks };
  });
  check(겹침.두번 === 겹침.한번 && 겹침.남은틱 === 겹침.ticks,
    '기름을 함께 발라도 두 번 안 탐 (센 쪽 하나만)',
    '한 틱 ' + 겹침.한번 + ' · 남은 틱 ' + 겹침.남은틱);

  // ── 관통 ────────────────────────────────────────────────
  const 관통 = await page.evaluate(() => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    const 잰다 = (이름) => {
      s.weapon = new Weapon(s.job, pool.findIndex((w) => w.name.includes(이름)));
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const 줄 = [0, 1, 2].map((k) => {
        const e = s.enemies.create(s.player.x + 60 + k * 30, s.player.y, 'e-crawler');
        e.body.setAllowGravity(false);
        e.hp = 100000; e.maxHp = 100000; e.floor = 1; e.def = { key: 'crawler' };
        return e;
      });
      s.fireArrow(s.player.x, s.player.y, 줄[0], 100, 0);
      const b = s.bullets.getChildren().filter((x) => x.active).pop();
      const 남음 = b ? (b.pierce || 0) : -1;
      // 실제로 셋을 다 치는지 — 총알을 손으로 지나가게 합니다
      줄.forEach((e) => { if (b && b.active) s.onBulletHit(b, e); });
      const 맞은수 = 줄.filter((e) => e.hp < 100000).length;
      줄.forEach((e) => e.destroy());
      return { 남음, 맞은수 };
    };
    return { 꿰뚫는: 잰다('꿰뚫는 지팡이'), 나무: 잰다('나무 지팡이') };
  });
  check(관통.꿰뚫는.남음 >= 2, '꿰뚫는 지팡이의 총알이 관통을 지님',
    '남은 관통 ' + 관통.꿰뚫는.남음);
  check(관통.꿰뚫는.맞은수 === 3, '줄지어 선 셋을 다 뚫음',
    관통.꿰뚫는.맞은수 + '/3');
  check(관통.나무.맞은수 === 1, '보통 지팡이는 하나만 맞힘',
    관통.나무.맞은수 + '/3');

  // ── 광역 ────────────────────────────────────────────────
  const 광역 = await page.evaluate(() => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    const 잰다 = (이름) => {
      s.weapon = new Weapon(s.job, pool.findIndex((w) => w.name.includes(이름)));
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      // 하나는 가까이, 하나는 반지름 밖에
      const 옆 = [30, CFG.aoe.radius + 40].map((dx) => {
        const e = s.enemies.create(s.player.x + 200 + dx, s.player.y, 'e-crawler');
        e.body.setAllowGravity(false);
        e.hp = 100000; e.maxHp = 100000; e.floor = 1; e.def = { key: 'crawler' };
        return e;
      });
      const 표적 = s.enemies.create(s.player.x + 200, s.player.y, 'e-crawler');
      표적.body.setAllowGravity(false);
      표적.hp = 100000; 표적.maxHp = 100000; 표적.floor = 1; 표적.def = { key: 'crawler' };
      s.splash({ x: 표적.x, y: 표적.y }, 표적, 100);
      const r = { 가까운: 100000 - 옆[0].hp, 먼: 100000 - 옆[1].hp, 표적: 100000 - 표적.hp };
      옆.forEach((e) => e.destroy()); 표적.destroy();
      return r;
    };
    return { 터지는: 잰다('터지는 지팡이'), 나무: 잰다('나무 지팡이') };
  });
  check(광역.터지는.가까운 > 0, '터지는 지팡이는 **곁에 선 것도** 맞힘',
    광역.터지는.가까운 + ' 들어감');
  check(광역.터지는.먼 === 0, '반지름 밖은 안 맞음', '반지름 ' + 0 + ' 밖 무사');
  check(광역.나무.가까운 === 0, '보통 지팡이는 곁을 안 건드림');
  check(광역.터지는.표적 === 0, '맞은 놈 자신은 두 번 안 맞음 (이미 온전히 맞았음)');

  // ── 보호막 ──────────────────────────────────────────────
  // **받는 피해가 실제로 줄어야** 합니다.
  const 보호막 = await page.evaluate(() => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    const 잰다 = (이름) => {
      s.weapon = new Weapon(s.job, pool.findIndex((w) => w.name.includes(이름)));
      s.armor = 0; s.dodge = 0;
      s.hp = s.maxHp;
      s.lastHitAt = -99999;
      s.hurt(100, null, false);
      return { 막 : s.weapon.shield, 깎임: s.maxHp - s.hp };
    };
    const a = 잰다('수호의 지팡이');
    const b = 잰다('나무 지팡이');
    return { 수호: a, 나무: b };
  });
  check(보호막.수호.막 > 1, '수호의 지팡이가 보호막을 지님', '×' + 보호막.수호.막);
  check(보호막.수호.깎임 < 보호막.나무.깎임,
    '**같은 대를 맞아도 덜 아픔**',
    '수호 ' + 보호막.수호.깎임 + ' < 나무 ' + 보호막.나무.깎임);
  check(Math.abs(보호막.수호.깎임 - Math.round(보호막.나무.깎임 / 보호막.수호.막)) <= 1,
    '줄어드는 만큼이 적힌 값과 맞음',
    보호막.나무.깎임 + ' ÷ ' + 보호막.수호.막 + ' ≈ ' + 보호막.수호.깎임);

  // ── 연타 (권법사) ───────────────────────────────────────
  // 지팡이 넷과 같은 부류입니다 — **값이 적혀 있어도 도는 코드가 없으면
  // 아무 일도 안 일어나고 오류도 안 납니다.**
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'monk' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'monk', null, { timeout: 8000 });

  const 연타 = await page.evaluate(() => {
    const s = window.__scene;
    const 배수 = [];
    s.combo = 0;
    for (let i = 0; i < CFG.combo.every * 2 + 1; i++) {
      배수.push(Number(s.comboMul().toFixed(4)));
      s.bumpCombo();
    }
    return { 배수, per: CFG.combo.per, every: CFG.combo.every };
  });
  check(연타.배수[0] === 1, '첫 대는 그대로 (쌓인 것이 없음)', '×' + 연타.배수[0]);
  check(연타.배수[1] > 1, '두 번째부터 쌓임', '×' + 연타.배수[1]);
  const 꼭대기 = 연타.every - 1;
  check(Math.abs(연타.배수[꼭대기] - (1 + 꼭대기 * 연타.per)) < 1e-6,
    '열 번째가 가장 크게 들어감', '×' + 연타.배수[꼭대기]);
  check(연타.배수[연타.every] === 1, '**열 번을 치면 풀림**',
    연타.every + '번째 뒤 ×' + 연타.배수[연타.every]);
  check(연타.배수[연타.every + 1] > 1, '풀린 뒤 다시 쌓임',
    '×' + 연타.배수[연타.every + 1]);
  const 평균 = 연타.배수.slice(0, 연타.every).reduce((a, b) => a + b, 0) / 연타.every;
  check(Math.abs(평균 - 1.315) < 0.02, '한 바퀴 평균이 직업표의 어림과 맞음',
    '×' + 평균.toFixed(3) + ' (classes.js 의 그럴듯과 맞물립니다)');

  // **실제로 더 아프게 들어가는가.** 위는 셈이고 이것이 판입니다.
  const 아픔 = await page.evaluate(() => {
    const s = window.__scene;
    const 친다 = (쌓임) => {
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const e = s.enemies.create(s.player.x + 20, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1e9; e.maxHp = 1e9; e.floor = 1; e.def = { key: 'crawler' };
      s.combo = 쌓임;
      s.lastSwingAt = -99999;
      // 흔들림과 정확도를 없애 **연타 말고는 아무것도 안 달라지게** 합니다.
      const w = s.weapon;
      w.rollDamage = () => 1000;
      w.hits = () => true;
      s.swing(s.time.now);
      const 들어감 = 1e9 - e.hp;
      e.destroy();
      return 들어감;
    };
    return { 맨처음: 친다(0), 아홉쌓임: 친다(9) };
  });
  check(아픔.맨처음 > 0, '맨몸으로도 들어감', 아픔.맨처음);
  check(아픔.아홉쌓임 > 아픔.맨처음, '**쌓이면 실제로 더 아픔**',
    아픔.맨처음 + ' → ' + 아픔.아홉쌓임);
  check(Math.abs(아픔.아홉쌓임 / 아픔.맨처음 - (1 + 9 * 연타.per)) < 0.03,
    '더 아픈 만큼이 적힌 값과 맞음',
    (아픔.아홉쌓임 / 아픔.맨처음).toFixed(3) + ' ≈ ' + (1 + 9 * 연타.per).toFixed(2));

  // 권법사가 아니면 아무 일도 없어야 합니다.
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'warrior', null, { timeout: 8000 });
  const 남 = await page.evaluate(() => {
    const s = window.__scene;
    s.combo = 9;
    return { 배수: s.comboMul(), 쌓이나: (s.bumpCombo(), s.combo) };
  });
  check(남.배수 === 1 && 남.쌓이나 === 9, '권법사가 아니면 연타가 안 걸림',
    '×' + 남.배수);

  // ── 부하 (사령술사) ─────────────────────────────────────
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'necro' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'necro', null, { timeout: 8000 });

  const 하나 = await page.evaluate(() => {
    const s = window.__scene;
    s.clearThralls();
    const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
    s.hitEnemy(e, 999);
    return (s.thralls || []).length;
  });
  check(하나 === 1, '내가 잡으면 그 자리에서 하나 일어섬', 하나 + '마리');

  // 셋까지. 넷째를 잡으면 가장 오래된 것이 물러납니다.
  const 넘침 = await page.evaluate(() => {
    const s = window.__scene;
    s.clearThralls();
    const 잡기 = () => {
      const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
    };
    for (let i = 0; i < 3; i++) 잡기();
    const 셋 = s.thralls.length;
    const 처음것 = s.thralls[0];
    잡기();
    return { 셋, 넷째뒤: s.thralls.length, 처음것사라짐: !s.thralls.includes(처음것),
      max: CFG.thrall.max };
  });
  check(넘침.셋 === 3, '셋까지 섬', 넘침.셋 + '/' + 넘침.max);
  check(넘침.넷째뒤 === 넘침.max, '넷째를 잡아도 셋을 안 넘음', 넘침.넷째뒤 + '마리');
  check(넘침.처음것사라짐, '넘치면 **가장 오래된 것**이 물러남 (새것이 안 서면 잡을수록 손해)');

  // 판을 바꾸는 넷·보스·박쥐는 안 일어섭니다.
  const 안섬 = await page.evaluate(() => {
    const s = window.__scene;
    const 재기 = (꾸미기) => {
      s.clearThralls();
      const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      꾸미기(e);
      s.hitEnemy(e, 999);
      return (s.thralls || []).length;
    };
    return {
      보스: 재기((e) => { e.isBoss = true; }),
      박쥐: 재기((e) => { e.isBat = true; }),
      개구리: 재기((e) => { e.isGoldFrog = true; e.coin = 0; }),
    };
  });
  check(안섬.보스 === 0, '보스는 안 일어섬');
  check(안섬.박쥐 === 0, '박쥐는 안 일어섬');
  check(안섬.개구리 === 0, '황금개구리는 안 일어섬');

  // 실제로 치는가. 적을 하나 세워 두고 시간을 흘립니다.
  const 침 = await page.evaluate(async () => {
    const s = window.__scene;
    s.clearThralls();
    const 잡기 = () => {
      const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
    };
    잡기(); 잡기();
    // 부하를 주인공 곁에 붙여 두고 먹이를 하나 세웁니다
    s.thralls.forEach((t) => { t.sprite.x = s.player.x; t.sprite.y = s.player.y; t.nextHitAt = 0; });
    const 먹이 = s.enemies.create(s.player.x + 40, s.player.y, 'e-crawler');
    먹이.body.setAllowGravity(false);
    먹이.hp = 1e9; 먹이.maxHp = 1e9; 먹이.floor = 1; 먹이.coin = 0; 먹이.def = { key: 'crawler' };
    const 처음 = 먹이.hp;
    for (let i = 0; i < 12; i++) {
      s.updateThralls(s.time.now + i * 800, 16);
      await new Promise((r) => setTimeout(r, 20));
    }
    const 깎임 = 처음 - 먹이.hp;
    먹이.destroy();
    return { 깎임, 마리: s.thralls.length };
  });
  check(침.깎임 > 0, '**부하가 실제로 칩니다**', 침.깎임 + ' 깎임 (' + 침.마리 + '마리)');

  // 주인공이 맞으면 하나 스러집니다.
  const 맞음 = await page.evaluate(() => {
    const s = window.__scene;
    s.clearThralls();
    for (let i = 0; i < 3; i++) {
      const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
    }
    const 전 = s.thralls.length;
    s.armor = 0; s.dodge = 0; s.hp = s.maxHp; s.lastHitAt = -99999;
    s.hurt(10, null, false);
    return { 전, 후: s.thralls.length };
  });
  check(맞음.후 === 맞음.전 - 1, '**주인공이 맞으면 하나 스러짐**',
    맞음.전 + ' → ' + 맞음.후);

  // 층을 옮기면 따라옵니다 — 두고 가지 않습니다.
  const 따라옴 = await page.evaluate(() => {
    const s = window.__scene;
    s.clearThralls();
    const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
    s.hitEnemy(e, 999);
    const t = s.thralls[0];
    // 주인공을 한 층 위로 옮겨 놓고 몇 프레임 돌립니다
    const 전거리 = Phaser.Math.Distance.Between(t.sprite.x, t.sprite.y, s.player.x, s.player.y);
    s.player.y -= CFG.floorHeight;
    for (let i = 0; i < 60; i++) s.updateThralls(s.time.now, 16);
    const 후거리 = Phaser.Math.Distance.Between(t.sprite.x, t.sprite.y, s.player.x, s.player.y);
    return { 전거리: Math.round(전거리), 후거리: Math.round(후거리) };
  });
  check(따라옴.후거리 < 60, '**층을 옮기면 따라옴** (두고 가지 않음)',
    '주인공에서 ' + 따라옴.후거리 + 'px');

  // 사령술사가 아니면 아무 일도 없어야 합니다.
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'warrior', null, { timeout: 8000 });
  const 남2 = await page.evaluate(() => {
    const s = window.__scene;
    const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
    s.hitEnemy(e, 999);
    return (s.thralls || []).length;
  });
  check(남2 === 0, '사령술사가 아니면 아무것도 안 일어섬', 남2 + '마리');

  // ── 곰 (곰사냥꾼) ───────────────────────────────────────
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'hunter' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'hunter', null, { timeout: 8000 });
  await page.waitForTimeout(300);

  const 곰생김 = await page.evaluate(() => {
    const s = window.__scene;
    s.updateBear(s.time.now, 16);
    return { 있나: !!s.bear, hp: s.bear && s.bear.hp, 그림: s.bear && s.bear.sprite.texture.key };
  });
  check(곰생김.있나, '판이 시작되면 곰이 섬');
  check(곰생김.그림 === 'ally-bear', '곰 그림을 씀', 곰생김.그림);
  check(곰생김.hp > 0, '곰에게 체력이 있음', 곰생김.hp);

  // 한 층 위의 적에게 갑니다 — **내가 아직 안 간 층**입니다.
  const 앞서감 = await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const 위 = s.enemies.create(CFG.laneX.right, floorY(s.floorIndex + 1) - 18, 'e-crawler');
    위.body.setAllowGravity(false);
    위.hp = 1e9; 위.maxHp = 1e9; 위.floor = s.floorIndex + 1; 위.coin = 0; 위.def = { key: 'crawler' };
    s.bear.sprite.setPosition(s.player.x, s.player.y);
    const 처음 = Phaser.Math.Distance.Between(s.bear.sprite.x, s.bear.sprite.y, 위.x, 위.y);
    for (let i = 0; i < 90; i++) s.updateBear(s.time.now, 16);
    const 나중 = Phaser.Math.Distance.Between(s.bear.sprite.x, s.bear.sprite.y, 위.x, 위.y);
    const 위층인가 = s.bear.sprite.y < s.player.y - 40;
    위.destroy();
    return { 처음: Math.round(처음), 나중: Math.round(나중), 위층인가 };
  });
  check(곰생김.있나 && 앞서감.나중 < 앞서감.처음, '**한 층 위의 적에게 앞서 감**',
    앞서감.처음 + 'px → ' + 앞서감.나중 + 'px');
  check(앞서감.위층인가, '곰이 주인공보다 위에 섬 (안 가 본 층)');

  // 실제로 칩니다 — 그리고 잡으면 코인이 나오고 처치 수에 들어갑니다.
  const 곰이침 = await page.evaluate(async () => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const e = s.enemies.create(s.player.x + 30, s.player.y - 20, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1e9; e.maxHp = 1e9; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'crawler' };
    s.bear.sprite.setPosition(e.x, e.y);
    s.bear.nextHitAt = 0;
    const 처음 = e.hp;
    for (let i = 0; i < 6; i++) { s.updateBear(s.time.now + i * 700, 16); }
    const 깎임 = 처음 - e.hp;
    e.destroy();
    return 깎임;
  });
  check(곰이침 > 0, '**곰이 실제로 칩니다**', 곰이침 + ' 깎임');

  const 곰이잡음 = await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const 전처치 = s.kills;
    const 전코인 = s.coins;
    const e = s.enemies.create(s.player.x + 30, s.player.y - 20, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 500; e.def = { key: 'crawler' };
    s.bear.sprite.setPosition(e.x, e.y);
    s.bear.nextHitAt = 0;
    s.updateBear(s.time.now, 16);
    return { 처치늘음: s.kills - 전처치, 코인나옴: s.coinsOnFloor === undefined
      ? s.children.list.filter((o) => o.texture && o.texture.key === 'coin').length : 0 };
  });
  check(곰이잡음.처치늘음 === 1, '곰이 잡은 것도 **내 처치 수**에 들어감',
    곰이잡음.처치늘음 + '마리');

  // 단단한 놈을 물면 곰이 깎이고, 다 깎이면 쓰러졌다가 돌아옵니다.
  const 쓰러짐 = await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const e = s.enemies.create(s.player.x + 30, s.player.y - 20, 'e-brute');
    e.body.setAllowGravity(false);
    e.hp = 1e9; e.maxHp = 1e9; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'brute' };
    s.bear.hp = s.bear.maxHp;
    const 처음hp = s.bear.hp;
    let 깎인뒤 = 처음hp;
    for (let i = 0; i < 40 && s.bear.hp > 0; i++) {
      s.bear.sprite.setPosition(e.x, e.y);
      s.bear.nextHitAt = 0;
      s.updateBear(s.time.now + i * 700, 16);
      깎인뒤 = s.bear.hp;
    }
    const 쓰러졌나 = s.bear.hp <= 0;
    const 되살아날때 = s.bear.deadUntil;
    // 시간을 뛰어넘어 돌아오는지 봅니다
    s.updateBear(되살아날때 + 10, 16);
    const 돌아왔나 = s.bear.hp > 0;
    e.destroy();
    return { 처음hp, 깎인뒤, 쓰러졌나, 돌아왔나, reviveMs: CFG.bear.reviveMs };
  });
  check(쓰러짐.깎인뒤 < 쓰러짐.처음hp, '**단단한 놈을 물면 곰이 깎임**',
    쓰러짐.처음hp + ' → ' + Math.max(0, 쓰러짐.깎인뒤));
  check(쓰러짐.쓰러졌나, '다 깎이면 쓰러짐');
  check(쓰러짐.돌아왔나, '**쓰러져도 잠시 뒤에 돌아옴** (판이 끝나지 않음)',
    쓰러짐.reviveMs + 'ms 뒤');

  // 곰사냥꾼이 아니면 곰이 없어야 합니다.
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'warrior', null, { timeout: 8000 });
  const 남3 = await page.evaluate(() => {
    const s = window.__scene;
    s.updateBear(s.time.now, 16);
    return !!s.bear;
  });
  check(!남3, '곰사냥꾼이 아니면 곰이 안 섬');

  console.log(bad ? `\n${bad}건 어긋남` : '\n지팡이 넷 · 연타 · 부하 · 곰이 다 제 일을 합니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
