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

  // 주인공이 맞으면 부하가 깎이고, 다 깎여야 스러집니다.
  //
  // 예전에는 **한 대에 하나씩 곧장 사라졌습니다.** 그러면 부하는 싸우다
  // 죽는 것이 아니라 서 있다 사라지는 것이라, 체력을 올려 주는 유물(썩지
  // 않는 것)이 붙을 자리 자체가 없었습니다.
  const 맞음 = await page.evaluate(() => {
    const s = window.__scene;
    const 세우기 = () => {
      const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
    };
    const 한대 = () => {
      s.armor = 0; s.dodge = 0; s.hp = s.maxHp; s.lastHitAt = -99999;
      s.hurt(10, null, false);
    };
    s.clearThralls();
    세우기();
    const t = s.thralls[0];
    const 처음 = t.hp;
    한대();
    const 한대뒤 = t.hp;
    let 횟수 = 1;
    while (s.thralls.length && 횟수 < 20) { 한대(); 횟수++; }
    return { 처음, 한대뒤, 횟수, 남음: s.thralls.length,
      share: CFG.thrall.hurtShare };
  });
  check(맞음.한대뒤 < 맞음.처음 && 맞음.한대뒤 > 0,
    '**주인공이 맞으면 부하가 깎임** (한 대에 사라지지 않음)',
    맞음.처음 + ' → ' + 맞음.한대뒤);
  check(맞음.남음 === 0, '다 깎이면 스러짐', 맞음.횟수 + '대째');
  check(맞음.횟수 === Math.ceil(1 / 맞음.share),
    '버티는 대 수가 적힌 몫과 맞음',
    맞음.횟수 + '대 (몫 ' + 맞음.share + ')');

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

  // ── 부하 셋이 제 몫을 하는가 ────────────────────────────
  //
  // 셋 다 모자랐습니다 (`node thrall-check.js` 가 저울질합니다).
  //
  //   눈에 보이는가   24px — **주인공(48)의 절반**. 거인(34)보다도 작아서
  //                   내 편인지 바닥의 부스러기인지 구분이 안 됐습니다
  //   따라오는가      평균 **0.95층 뒤**, 나쁠 때 2.18층 — 곰과 같은 병
  //   세기가 되는가   셋이 다 붙어도 **주인공의 47%**
  //
  // 셋 다 **오류가 안 나는 부류**입니다. 부하는 멀쩡히 서 있고 멀쩡히
  // 칩니다 — 작고 느리고 약할 뿐입니다.
  const 부하몫 = await page.evaluate(async () => {
    const s = window.__scene;
    s.hp = s.maxHp = 1e9;
    for (let i = 0; i < 30; i++) s.addFloor(i);
    const 세우기 = () => {
      const e = s.enemies.create(s.player.x + 40, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
    };
    s.clearThralls();
    for (let i = 0; i < CFG.thrall.max; i++) 세우기();

    const 부하키 = Math.round(s.thralls[0].sprite.displayHeight);
    const 내키 = Math.round(s.player.displayHeight);

    // ── 따라오는가 ───────────────────────────────────
    // **프레임을 직접 돌립니다.** 시계로 기다리면 헤드리스의 프레임 수에
    // 따라 값이 달라집니다 — 판 시계로 걸었더니 verify 안에서는 11.48층,
    // 따로 돌린 도구에서는 0.03층이 나왔습니다. 같은 코드인데요.
    //
    // 여기서 묻는 것은 하나입니다 — **주인공이 한 층 오르고 340ms(60fps로
    // 스물한 프레임)가 지나면 부하가 붙어 있는가.** 프레임을 세어서 돌리면
    // 판이 몇 프레임을 도는지와 무관하게 늘 같은 답이 나옵니다.
    const 프레임 = 21;
    const 뒤 = [];
    for (let f = 1; f <= 16; f++) {
      s.floorIndex = f;
      const 층 = s.floors.get(f);
      const 발판 = LANES.map((l) => 층.slots[l]).find(Boolean);
      s.lane = LANES.find((l) => 층.slots[l] === 발판);
      s.player.setPosition(발판.x, 발판.y - 34);
      for (let i = 0; i < 프레임; i++) s.updateThralls(s.time.now, 16);
      if (!s.thralls || !s.thralls.length) continue;
      뒤.push(Math.max(...s.thralls.map((t) =>
        (t.sprite.y - s.player.y) / CFG.floorHeight)));
    }
    const 끝 = 뒤.slice(-8);
    const w = s.weapon;
    const 한마리 = Math.round(w.dmg * CFG.thrall.dmgShare) * 1000 / CFG.thrall.tickMs;
    return {
      부하키, 내키,
      뒤평균: 끝.reduce((a, b) => a + b, 0) / Math.max(1, 끝.length),
      남음: s.thralls ? s.thralls.length : 0,
      셋몫: 한마리 * CFG.thrall.max / w.dps,
    };
  });
  check(부하몫.부하키 >= 30,
    '**부하가 눈에 띄는 크기** (예전에는 주인공의 절반이라 부스러기 같았습니다)',
    부하몫.부하키 + 'px · 주인공 ' + 부하몫.내키 + 'px');
  check(부하몫.남음 === 3, '오르는 동안 셋이 다 남음', 부하몫.남음 + '마리');
  check(부하몫.뒤평균 < 0.4,
    '**주인공이 쉬지 않고 올라도 붙어 옴** (예전에는 평균 0.95층 뒤였습니다)',
    부하몫.뒤평균.toFixed(2) + '층 뒤');
  check(부하몫.셋몫 > 0.6,
    '**셋이 붙으면 세기가 됨** (예전에는 주인공의 47%)',
    '주인공의 ' + Math.round(부하몫.셋몫 * 100) + '%');

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
    return { 있나: !!s.bear, hp: s.bear && s.bear.hp,
      그림: s.bear && s.bear.sprite.texture.key,
      시트: !!(s.bear && s.bear.sheet),
      시트있음: !!SHEET_ART['sheet-ally-bear'] };
  });
  check(곰생김.있나, '판이 시작되면 곰이 섬');
  // **시트가 오기 전과 온 뒤가 다릅니다.** 어느 쪽 하나로 못박으면 그림이
  // 오는 날 시험이 틀리고, 시험을 고치느라 「시트를 쓰는가」를 안 보게
  // 됩니다. 시트가 있으면 시트를, 없으면 한 장 그림을 — 둘 다 잽니다.
  check(곰생김.그림 === (곰생김.시트있음 ? 'sheet-ally-bear' : 'ally-bear'),
    곰생김.시트있음 ? '곰이 **시트를 씁니다**' : '시트가 없어 한 장 그림으로 물러섬',
    곰생김.그림);
  check(곰생김.시트 === 곰생김.시트있음,
    '시트가 실려 있으면 곰이 그것을 잡음', 곰생김.시트 ? '잡음' : '한 장');
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

  // ── 곰이 주인공을 앞서 가는가 ───────────────────────────
  //
  // 곰사냥꾼의 전부가 「곰이 한 층 앞서 올라가 먼저 싸운다」입니다.
  // 그런데 **곰이 주인공의 41% 속도**였습니다 —
  //
  //   주인공  한 층(165px)을 320ms 에  →  516 px/s
  //   곰      초당 210px               →  41%
  //
  // 쉬지 않고 마흔 층을 오르면 곰이 **스물두 층 뒤**에 처졌습니다. 설계는
  // 「앞서 간다」인데 수치가 정반대라, 사실상 판에 없는 것과 같았습니다.
  // 그런데 **오류는 안 납니다** — 곰은 멀쩡히 살아서 저 아래를 걷습니다.
  //
  // 재는 데 함정이 셋 있어서 적어 둡니다.
  //
  //   1. **판 시계로 세야 합니다.** 벽시계로 기다리면 헤드리스가 초당
  //      14프레임밖에 안 도는데(실제 판은 60) 곰만 프레임에 매여서, 멀쩡한
  //      곰이 네 배 느린 것으로 잡힙니다.
  //   2. **쓰러져 있는 동안은 빼야 합니다.** 죽은 곰이 그 자리에 남는 것은
  //      「못 따라온다」가 아니라 「죽었다」입니다. 섞으면 어디를 고쳐야
  //      할지 알 수가 없습니다 (실제로 -14층이 나와서 헤맸습니다).
  //   3. **주인공을 일정한 박자로 올려야 합니다.** s.jump() 로 몰면 판마다
  //      발판·상점·보스가 달라 오른 층이 16~44로 널뜁니다.
  //
  // 저울질은 `node bear-lead.js` 가 합니다. 여기서는 앞서는지만 봅니다.
  const 곰앞섬 = await page.evaluate(async () => {
    const s = window.__scene;
    s.hp = s.maxHp = 1e9;
    for (let i = 0; i < 40; i++) s.addFloor(i);
    s.clearBear();
    s.updateBear(s.time.now, 16);
    // **벽시계로 빠져나갈 길을 함께 둡니다.** 판이 멈추면(죽음 화면·상점)
    // s.time.now 가 그 자리에 서서 영영 안 돌아옵니다 — 처음에 그렇게
    // 걸어 놓고 시험이 십 분을 멈춰 있었습니다. 시험은 틀릴지언정
    // 멈추면 안 됩니다.
    const 판시계 = (ms) => new Promise((r) => {
      const 끝 = s.time.now + ms;
      const 벽끝 = Date.now() + ms * 6 + 500;
      const 보기 = () => ((s.time.now >= 끝 || Date.now() >= 벽끝)
        ? r() : setTimeout(보기, 8));
      보기();
    });
    const 층차 = [];
    let 쓰러짐 = 0, 잼 = 0;
    for (let f = 1; f <= 24; f++) {
      s.floorIndex = f;
      const 층 = s.floors.get(f);
      const 발판 = LANES.map((l) => 층.slots[l]).find(Boolean);
      s.lane = LANES.find((l) => 층.slots[l] === 발판);
      s.player.setPosition(발판.x, 발판.y - 34);
      s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.5);
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      await 판시계(340);
      if (!s.bear) continue;
      잼++;
      if (s.bear.hp <= 0) { 쓰러짐++; continue; }
      층차.push((s.player.y - s.bear.sprite.y) / CFG.floorHeight);
    }
    const 끝 = 층차.slice(-12);
    return { 평균: 끝.reduce((a, b) => a + b, 0) / Math.max(1, 끝.length),
      샘플: 끝.length, 쓰러진몫: 잼 ? 쓰러짐 / 잼 : 1 };
  });
  check(곰앞섬.샘플 >= 6, '곰이 살아서 따라다님', 곰앞섬.샘플 + '번 잼');
  check(곰앞섬.평균 > 0.3,
    '**주인공이 쉬지 않고 올라도 곰이 앞선다** (예전에는 스물두 층 뒤였습니다)',
    (곰앞섬.평균 >= 0 ? '+' : '') + 곰앞섬.평균.toFixed(2) + '층');
  check(곰앞섬.쓰러진몫 < 0.4, '판의 절반을 쓰러져 있지 않음',
    '쓰러져 있던 몫 ' + Math.round(곰앞섬.쓰러진몫 * 100) + '%');

  // ── 몸으로 막는가 ───────────────────────────────────────
  // 앞서 가기만 하고 적이 거들떠도 안 보면 그건 앞장이 아니라 산책입니다.
  const 막음 = await page.evaluate(async () => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.clearBear();
    s.updateBear(s.time.now, 16);
    const b = s.bear;
    // 곰을 주인공에게서 떼어 놓고, 그 곁에 적을 세웁니다.
    b.sprite.setPosition(s.player.x + 120, s.player.y - CFG.floorHeight);
    const e = s.enemies.create(b.sprite.x + 60, b.sprite.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1e9; e.maxHp = 1e9; e.floor = s.floorIndex + 1; e.coin = 0;
    e.def = { key: 'crawler', ground: true, move: 'walk' };
    e.contactDamage = 20; e.dir = 1; e.speed = 60;
    // (1) 그 적이 주인공이 아니라 곰을 봅니까.
    const 봄 = chaseTarget(s, e, s.player) === b.sprite;
    // (2) 몸이 닿으면 곰이 깎입니까.
    //
    // **무는 피해를 막아 놓고 재야 합니다.** 사거리(120)가 몸 닿는 거리(30)
    // 보다 넓어서, 그냥 재면 되받는 피해가 섞여 들어옵니다 — 처음에 그렇게
    // 재서 「126000009 깎임」이 나왔습니다. 그 숫자로는 막는 것이 실제로
    // 도는지 알 수가 없습니다.
    s.hp = s.maxHp = 200;              // 1e9 로 두면 되받는 값이 억이 됩니다
    b.nextHitAt = s.time.now + 1e6;    // 이번 프레임에는 물지 않습니다
    const 처음 = b.hp;
    e.setPosition(b.sprite.x + 10, b.sprite.y);
    b.nextTankAt = 0;
    s.updateBear(s.time.now, 16);
    const 깎임 = 처음 - b.hp;
    const 기대 = Math.max(1, Math.round(e.contactDamage * CFG.bear.tankShare));
    // (3) 멀리 있는 적은 주인공을 봅니다 — 두 층 밖까지 끌면 주인공이
    //     통째로 안 맞는 판이 됩니다.
    e.setPosition(s.player.x + 40, s.player.y);
    const 멀면 = chaseTarget(s, e, s.player) === s.player;
    e.destroy();
    return { 봄, 깎임, 멀면, 기대, share: CFG.bear.tankShare };
  });
  check(막음.봄, '**같은 층의 적이 주인공 대신 곰을 봄**');
  check(막음.깎임 === 막음.기대,
    '**몸이 닿으면 곰이 대신 맞음** (끌기만 하면 막는 게 아닙니다)',
    막음.깎임 + ' 깎임 (적의 접촉피해 × ' + 막음.share + ')');
  check(막음.멀면, '멀리 있는 적은 그대로 주인공을 봄 (곰이 다 막아 주면 안 됩니다)');

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

  // ── 내 편 둘도 숨을 쉬는가 ──────────────────────────────
  // 시트는 **주인공에게만** 있습니다. 판 위의 나머지는 전부 그림 한 장에
  // 눌렸다 늘어나는 트윈 하나입니다 (js/enemies.js) — 그 박자가 놈마다
  // 달라서 움직임만 봐도 갈립니다.
  //
  // 곰과 부하에게는 그게 없었습니다. **곁에 선 적들은 다 숨 쉬는데 내 편
  // 둘만 굳어** 있었습니다. 오류가 나는 것도 아니고 그림이 빠진 것도 아니라
  // 눈으로만 알 수 있는 부류라, 여기서 잽니다.
  const 숨 = await page.evaluate(async () => {
    const s = window.__scene;
    const 재기 = (o) => ({ sx: o.scaleX, sy: o.scaleY });

    // **두 점만 재면 안 됩니다.** 숨은 오르내리는 것이라, 두 점이 마루를
    // 사이에 두고 마주 앉으면 값이 같게 나옵니다 — 멀쩡히 숨 쉬는데 굳었다고
    // 하는 시험이 됩니다(실제로 그렇게 한 번 틀렸습니다). 한 주기 넘게
    // 여러 번 재서 **폭**을 봅니다.
    const 폭재기 = async (뽑기) => {
      let lo = 9, hi = -9;
      for (let i = 0; i < 14; i++) {
        const v = 재기(뽑기()).sy;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
        await new Promise((r) => setTimeout(r, 110));
      }
      return hi - lo;
    };

    // 곰 — **시트가 오면서 재는 것이 달라집니다.**
    // 시트를 쓰는 곰은 눌렸다 늘어나지 않습니다 (spawnBear 가 트윈을 안
    // 겁니다). 대신 **컷이 넘어갑니다.** 굳었는지를 보는 것은 그대로이되,
    // 무엇을 보고 그것을 아는지가 바뀝니다.
    window.__game.scene.start('game', { jobKey: 'hunter' });
    await new Promise((r) => setTimeout(r, 700));
    const s2 = window.__scene;
    s2.updateBear(s2.time.now, 16);
    let 곰폭 = 0;
    let 곰컷 = 0;
    if (s2.bear.sheet) {
      // **판이 저 혼자 도는 동안** 컷이 넘어가야 합니다. 손으로
      // stepBearFrame 을 불러 보는 것은 아래에서 따로 하고, 여기서는
      // update() 가 실제로 그것을 부르는지를 봅니다.
      //
      // **곰을 걷게 해 두어야 합니다.** 가만두면 곰은 주인공 앞 제자리에
      // 서고, 서 있는 곰은 첫 컷에 멈추는 것이 옳습니다 — 그걸 재면 멀쩡한
      // 곰을 굳었다고 하게 됩니다(실제로 그렇게 한 번 틀렸습니다).
      // 멀찍이 먹이를 세워 걸어가는 동안을 잽니다.
      s2.enemies.getChildren().slice().forEach((e) => e.destroy());
      const 멀리 = s2.enemies.create(s2.player.x + 420, s2.player.y - 40, 'e-crawler');
      멀리.body.setAllowGravity(false);
      멀리.hp = 1e9; 멀리.maxHp = 1e9; 멀리.floor = s2.floorIndex; 멀리.coin = 0;
      멀리.def = { key: 'crawler' };
      const 본컷 = new Set();
      for (let i = 0; i < 16; i++) {
        // 곰이 닿기 전에 먹이를 더 멀리 물립니다 — 계속 걷게 하려는 것입니다.
        멀리.x = s2.bear.sprite.x + 300;
        본컷.add(s2.bear.frame);
        await new Promise((r) => setTimeout(r, 100));
      }
      곰컷 = 본컷.size;
      멀리.destroy();
    } else {
      곰폭 = await 폭재기(() => s2.bear.sprite);
    }
    const 곰시트 = !!s2.bear.sheet;

    // 부하
    window.__game.scene.start('game', { jobKey: 'necro' });
    await new Promise((r) => setTimeout(r, 700));
    const s3 = window.__scene;
    const e = s3.enemies.create(s3.player.x + 60, s3.player.y, 'e-crawler');
    e.body.setAllowGravity(false);
    e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
    s3.hitEnemy(e, 999);
    const 부폭 = await 폭재기(() => s3.thralls[0].sprite);
    return { 곰폭: Number(곰폭.toFixed(4)), 곰컷, 곰시트,
      부폭: Number(부폭.toFixed(4)) };
  });
  check(숨.곰시트 ? 숨.곰컷 > 1 : 숨.곰폭 > 0.01,
    숨.곰시트 ? '**곰이 저 혼자 걷습니다** (판이 도는 동안 컷이 넘어감)'
      : '**곰이 숨을 쉼** (적들처럼 눌렸다 늘어남)',
    숨.곰시트 ? 숨.곰컷 + '컷 봄' : '폭 ' + 숨.곰폭);
  check(숨.부폭 > 0.01, '**부하가 숨을 쉼** (눌리는 대신 뜹니다 — 땅을 안 딛으니까)',
    '폭 ' + 숨.부폭);

  // ── 곰의 몸짓 시트 ──────────────────────────────────────
  // 곰은 **적이 아닙니다.** 판 내내 곁에서 보고 있는 것이라 눌렸다 늘어나는
  // 것만으로는 모자랍니다 — 주인공은 아니어도 주인공처럼 보여야 합니다.
  //
  // 그림이 오기 전에는 여기서 **가짜 시트를 끼워 넣고** 코드가 그것을 잡는지만
  // 봤습니다. 이제 진짜가 왔으므로(assets/sheets/ally-bear/) 진짜를 잽니다 —
  // 가짜를 겹쳐 끼우면 진짜를 덮어쓰고, 끝에 지우면 **뒤따르는 검사에서 곰이
  // 시트를 잃습니다.**
  //
  // 앞의 검사가 사령술사로 끝났습니다 — 곰사냥꾼으로 돌아가야 곰이 섭니다.
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'hunter' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'hunter', null, { timeout: 8000 });
  await page.waitForTimeout(300);

  const 시트준비 = await page.evaluate(() => {
    const s = window.__scene;
    s.clearBear();
    s.updateBear(s.time.now, 16);
    const b = s.bear;
    const out = { 시트잡음: !!b.sheet, 스프라이트: b.sprite.type,
      실림: !!SHEET_ART['sheet-ally-bear'] };
    if (!b.sheet) return out;
    out.걷기 = b.sheet.walk;
    out.무는것 = b.sheet.bite;
    out.컷수 = b.sheet.n;
    // 시트는 4배로 그려 구우므로 그대로 얹으면 곰이 발판을 덮습니다.
    out.배율 = Number(b.sprite.scaleX.toFixed(3));
    out.높이 = Math.round(b.sprite.displayHeight);

    const 걷다 = new Set();
    for (let i = 0; i < 40; i++) { s.stepBearFrame(s.time.now + i * 200, true); 걷다.add(b.frame); }
    out.걷다본컷 = [...걷다].sort((x, y) => x - y);

    b.biting = b.sheet.bite.length; b.frame = b.sheet.bite[0]; b.frameAt = 0;
    const 물다 = new Set([b.frame]);
    for (let i = 0; i < 12; i++) { s.stepBearFrame(s.time.now + 1e5 + i * 120, true); 물다.add(b.frame); }
    out.물다본컷 = [...물다].sort((x, y) => x - y);

    s.stepBearFrame(s.time.now + 2e5, false);
    out.서있을때 = b.frame;
    return out;
  });
  check(시트준비.실림, '구운 곰 시트가 실려 있음 (`sheet-ally-bear`)');
  check(시트준비.시트잡음, '곰이 **시트를 잡습니다**');
  check(시트준비.컷수 === 8, '여덟 컷', 시트준비.컷수 + '컷');
  check(시트준비.스프라이트 === 'Sprite',
    '시트가 있으면 컷을 넘길 수 있는 것으로 섬', 시트준비.스프라이트);
  check(JSON.stringify(시트준비.걷다본컷) === JSON.stringify(시트준비.걷기),
    '걷는 동안 **윗줄을 돕니다**', JSON.stringify(시트준비.걷다본컷));
  check((시트준비.물다본컷 || []).filter((f) => (시트준비.무는것 || []).includes(f)).length
    === (시트준비.무는것 || []).length,
    '물 때 **아랫줄을 한 바퀴 돕니다**', JSON.stringify(시트준비.물다본컷));
  check(시트준비.서있을때 === (시트준비.걷기 || [])[0],
    '서 있으면 첫 컷에 멈춥니다 (제자리걸음 안 함)', '컷 ' + 시트준비.서있을때);
  // 한 컷이 163×127 입니다. 그대로 얹으면 발판(165)을 통째로 덮습니다 —
  // **오류가 안 나고 그냥 화면을 가리는** 부류라 여기서 재 둡니다.
  check(시트준비.높이 > 30 && 시트준비.높이 < 90,
    '곰이 발판을 덮지 않을 만큼으로 줄어 섬',
    '높이 ' + 시트준비.높이 + 'px (배율 ×' + 시트준비.배율 + ')');

  // ── 여덟 컷이 정말 여덟인가 ─────────────────────────────
  // 시트가 실려 있고 컷이 넘어가도, **그려진 것이 다 같으면** 곰은 미끄러지는
  // 조각상입니다. 오류도 안 나고 컷 번호도 멀쩡히 바뀝니다.
  //
  // 그리고 컷마다 몸이 딴 자리에 서 있으면 걷는 것이 아니라 **떠는 것**으로
  // 보입니다 — 시트는 한 자리(foot/ground)를 기준으로 얹히니까요.
  const 컷들 = await page.evaluate(async () => {
    const 싣기 = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const d = SHEET_ART['sheet-ally-bear'];
    if (!d) return null;
    const img = await 싣기(d.url);
    const fw = d.fw, fh = d.fh;
    const 줄 = Math.round(img.width / fw);
    const 뜨기 = (k) => {
      const c = document.createElement('canvas');
      c.width = fw; c.height = fh;
      const x = c.getContext('2d');
      x.drawImage(img, (k % 줄) * fw, Math.floor(k / 줄) * fh, fw, fh, 0, 0, fw, fh);
      return x.getImageData(0, 0, fw, fh).data;
    };
    const 컷 = [...Array(d.n)].map((_, k) => 뜨기(k));
    // 두 컷이 몇 할이나 다른가.
    const 다름 = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1])
          + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]) > 40) n++;
      }
      return Math.round(n / (a.length / 4) * 1000) / 10;
    };
    // 몸이 어디에 섰는가.
    const 틀 = (a) => {
      let x0 = 1e9, x1 = -1, y1 = -1, 참 = 0;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        if (a[(y * fw + x) * 4 + 3] > 60) {
          참++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
      }
      return { cx: (x0 + x1) / 2, 발: y1, 참 };
    };
    const 틀들 = 컷.map(틀);
    const 이웃 = [0, 1, 2, 3].map((k) => 다름(컷[k], 컷[(k + 1) % 4]))
      .concat([4, 5, 6, 7].map((k) => 다름(컷[k], 컷[4 + ((k - 4 + 1) % 4)])));
    const 가운데 = 틀들.map((t) => t.cx);
    const 발 = 틀들.map((t) => t.발);
    return {
      줄, fw, fh,
      가장비슷한이웃: Math.min(...이웃),
      걷기와물기: Math.min(...[0, 1, 2, 3].map((k) => 다름(컷[k], 컷[k + 4]))),
      빈컷: 틀들.filter((t) => t.참 < fw * fh * 0.05).length,
      가운데흔들림: Math.round(Math.max(...가운데) - Math.min(...가운데)),
      발흔들림: Math.max(...발) - Math.min(...발),
    };
  });
  if (!컷들) {
    check(false, '구운 곰 시트를 읽을 수 있음');
  } else {
    check(컷들.빈컷 === 0, '빈 컷이 없음', 컷들.빈컷 + '개');
    check(컷들.가장비슷한이웃 > 8,
      '**이웃한 컷이 서로 다름** (같으면 미끄러지는 조각상입니다)',
      '가장 비슷한 이웃도 ' + 컷들.가장비슷한이웃 + '% 다름');
    check(컷들.걷기와물기 > 8, '무는 줄이 걷는 줄과 다름',
      '가장 비슷한 짝도 ' + 컷들.걷기와물기 + '% 다름');
    // 한 컷이 163 이므로 8px 은 5% — 화면에서는 0.35배로 줄어 3px 아래입니다.
    check(컷들.가운데흔들림 <= 8, '컷마다 몸이 같은 자리에 섬 (안 떨림)',
      '가운데 ' + 컷들.가운데흔들림 + 'px / ' + 컷들.fw);
    check(컷들.발흔들림 <= 8, '발밑이 컷마다 같은 높이',
      '발 ' + 컷들.발흔들림 + 'px / ' + 컷들.fh);
  }

  // ═══ 다섯의 전용 유물 ═══════════════════════════════════
  //
  // 위의 능력들과 **똑같은 부류**입니다 — js/relics.js 에 값이 적혀 있고, 그
  // 값을 읽는 코드가 있어야 비로소 무슨 일이 일어납니다. 값만 적어 두면 유물
  // 카드는 멀쩡히 뜨고 고를 수도 있는데 **아무 일도 안 일어납니다.**
  //
  // 실제로 그런 일이 하나 있었습니다. 「썩지 않는 것」이 부하의 체력을 두 배로
  // 올리는데, 부하가 맞는 대도 제 체력에 비례하고 있어서 **버티는 횟수가
  // 그대로**였습니다. 값도 맞고 코드도 돌고 오류도 안 나는데 유물이 없는 것과
  // 같았습니다. 그래서 여기서도 「값이 붙었는가」가 아니라 **「그래서 무엇이
  // 달라지는가」**를 잽니다.

  // ── 누구에게 나오는가 ───────────────────────────────────
  // 다섯은 다 전용입니다. 남의 것이 섞이면 유물 셋을 펼치는 자리가 고를 수
  // 없는 카드로 채워집니다.
  const 전용 = { monk: 'backhand', hunter: 'huntmark', necro: 'undying',
    wizard: 'spring', digger: 'heavier' };
  const 배정 = await page.evaluate((표) => {
    const 다섯 = Object.values(표);
    const out = {};
    CLASSES.forEach((c) => {
      out[c.key] = relicsFor(c.key).map((r) => r.key).filter((k) => 다섯.includes(k));
    });
    return out;
  }, 전용);
  Object.entries(전용).forEach(([job, key]) => {
    check(배정[job].length === 1 && 배정[job][0] === key,
      '전용 유물이 제 직업에게만 나옴 — ' + job,
      배정[job].join(', ') || '없음');
  });
  const 남들 = ['warrior', 'archer', 'rogue'];
  check(남들.every((k) => (배정[k] || []).length === 0),
    '나머지 셋에게는 다섯 중 아무것도 안 나옴',
    남들.map((k) => k + ':' + ((배정[k] || []).join('/') || '없음')).join(' · '));

  // ── 뒷손 (권법사) ───────────────────────────────────────
  // 사거리 안 하나만 치던 것이, 열 번째에는 **사거리 두 배 안 모두**에게.
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'monk' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'monk', null, { timeout: 8000 });

  const 뒷손 = await page.evaluate(() => {
    const s = window.__scene;
    // 셋을 세웁니다 — 사거리 안 · 사거리 밖 두 배 안 · 두 배 밖.
    const 한판 = (유물, 쌓임) => {
      s.weapon = new Weapon(s.job, 0);
      if (유물) s.weapon.takeRelic(relicByKey('backhand'));
      const w = s.weapon;
      w.hits = () => true;
      w.rollDamage = () => 1000;
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const 세우기 = (dx) => {
        const e = s.enemies.create(s.player.x + dx, s.player.y, 'e-crawler');
        e.body.setAllowGravity(false);
        e.hp = 1e9; e.maxHp = 1e9; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
        return e;
      };
      const 안 = 세우기(w.reach * 0.5);
      const 곁 = 세우기(w.reach * 1.5);
      const 밖 = 세우기(w.reach * 2.6);
      s.combo = 쌓임;
      s.lastSwingAt = -99999;
      s.swing(s.time.now);
      const r = { 안: 1e9 - 안.hp, 곁: 1e9 - 곁.hp, 밖: 1e9 - 밖.hp };
      [안, 곁, 밖].forEach((e) => e.destroy());
      return r;
    };
    const every = CFG.combo.every;
    return {
      열번째: 한판(true, every - 1),
      그냥한대: 한판(true, 0),
      유물없이: 한판(false, every - 1),
      share: CFG.combo.backhandShare,
    };
  });
  check(뒷손.유물없이.곁 === 0, '유물이 없으면 사거리 밖은 안 맞음 (열 번째라도)',
    뒷손.유물없이.곁 + ' 들어감');
  check(뒷손.그냥한대.곁 === 0, '유물이 있어도 **여느 대에는** 사거리 밖이 무사함',
    뒷손.그냥한대.곁 + ' 들어감');
  check(뒷손.열번째.곁 > 0, '**열 번째 한 대가 사거리 밖 곁의 놈에게도 들어감**',
    뒷손.열번째.곁 + ' 들어감');
  check(뒷손.열번째.밖 === 0, '사거리 두 배 밖은 안 맞음', 뒷손.열번째.밖 + ' 들어감');
  check(뒷손.열번째.안 > 0 && 뒷손.열번째.곁 < 뒷손.열번째.안,
    '곁에 튄 것은 제 대보다 작음 (몫 ' + 뒷손.share + ')',
    뒷손.열번째.안 + ' vs ' + 뒷손.열번째.곁);

  // ── 사냥꾼의 표식 (곰사냥꾼) ────────────────────────────
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'hunter' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'hunter', null, { timeout: 8000 });
  await page.waitForTimeout(300);

  // (1) 곰이 물면 표가 남는가.
  const 표남음 = await page.evaluate(() => {
    const s = window.__scene;
    const 물리기 = (유물) => {
      s.weapon = new Weapon(s.job, 0);
      if (유물) s.weapon.takeRelic(relicByKey('huntmark'));
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const e = s.enemies.create(s.player.x + 30, s.player.y - 20, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1e9; e.maxHp = 1e9; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'crawler' };
      s.clearBear();
      s.updateBear(s.time.now, 16);
      s.bear.sprite.setPosition(e.x, e.y);
      s.bear.nextHitAt = 0;
      s.updateBear(s.time.now, 16);
      const 표 = e.hunted || 0;
      e.destroy();
      return 표 - s.time.now;
    };
    return { 유물: 물리기(true), 없이: 물리기(false), markMs: CFG.bear.markMs };
  });
  check(표남음.유물 > 0, '**곰이 물면 그 놈에게 표가 남음**',
    Math.round(표남음.유물) + 'ms 남음 (' + 표남음.markMs + ')');
  check(표남음.없이 <= 0, '유물이 없으면 표가 안 남음');

  // (2) 표가 있는 놈을 **먼저 겨누는가.** 이것이 없으면 유물이 우연에 기댑니다.
  const 먼저겨눔 = await page.evaluate(() => {
    const s = window.__scene;
    const 재기 = (표찍기) => {
      s.weapon = new Weapon(s.job, 0);
      s.weapon.takeRelic(relicByKey('huntmark'));
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const 세우기 = (dx) => {
        const e = s.enemies.create(s.player.x + dx, s.player.y - 4, 'e-crawler');
        e.body.setAllowGravity(false);
        e.hp = 1e9; e.maxHp = 1e9; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'crawler' };
        return e;
      };
      const 가까운 = 세우기(50);
      const 먼놈 = 세우기(200);
      if (표찍기) 먼놈.hunted = s.time.now + CFG.bear.markMs;
      s.subTarget = null;
      s.lastSubAt = -99999;
      const 쏨 = s.fireArrow;
      s.fireArrow = () => {};
      s.shoot(s.time.now);
      s.fireArrow = 쏨;
      const 고른것 = s.subTarget === 먼놈 ? '먼놈' : (s.subTarget === 가까운 ? '가까운' : '없음');
      [가까운, 먼놈].forEach((e) => e.destroy());
      s.subTarget = null;
      return 고른것;
    };
    return { 표있을때: 재기(true), 표없을때: 재기(false) };
  });
  check(먼저겨눔.표없을때 === '가까운', '표가 없으면 늘 하던 대로 가까운 것부터',
    먼저겨눔.표없을때);
  check(먼저겨눔.표있을때 === '먼놈', '**표가 있으면 멀어도 그 놈을 먼저 겨눔**',
    먼저겨눔.표있을때);

  // (3) 실제로 더 아프게 들어가는가. 화살에 실린 값을 받아 적습니다 —
  //     날아가 맞는 것까지 기다리면 물리에 기대게 되어 시험이 흔들립니다.
  //     활은 당겼다 놓느라 화살이 늦게 나가는데(after), 그 사이에 판이
  //     저 혼자 쏜 화살이 섞여 들어옵니다. 재는 동안만 늦춤을 걷습니다.
  const 표몫 = await page.evaluate(() => {
    const s = window.__scene;
    const 늦춤 = s.after;
    s.after = (ms, fn) => fn();
    const 재기 = (표찍기, 유물) => {
      s.weapon = new Weapon(s.job, 0);
      if (유물) s.weapon.takeRelic(relicByKey('huntmark'));
      const w = s.weapon;
      w.hits = () => true;
      w.rollDamage = () => 1000;
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const e = s.enemies.create(s.player.x + 80, s.player.y - 4, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1e9; e.maxHp = 1e9; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'crawler' };
      if (표찍기) e.hunted = s.time.now + CFG.bear.markMs;
      const 적힘 = [];
      const 쏨 = s.fireArrow;
      s.fireArrow = (x, y, at, dmg) => { 적힘.push(dmg); };
      s.subTarget = null;
      s.lastSubAt = -99999;
      s.shoot(s.time.now);
      s.fireArrow = 쏨;
      e.destroy();
      s.subTarget = null;
      return 적힘[0] || 0;
    };
    const out = {
      표: 재기(true, true),
      맨: 재기(false, true),
      유물없이표: 재기(true, false),
      배수: relicByKey('huntmark').huntMarkMul,
    };
    s.after = 늦춤;
    return out;
  });
  check(표몫.맨 > 0, '표가 없는 놈에게도 화살은 나감', 표몫.맨);
  check(표몫.표 > 표몫.맨, '**표가 있는 놈에게 더 크게 들어감**',
    표몫.맨 + ' → ' + 표몫.표);
  check(Math.abs(표몫.표 / 표몫.맨 - 표몫.배수) < 0.02,
    '더 아픈 만큼이 적힌 값과 맞음',
    (표몫.표 / 표몫.맨).toFixed(2) + ' ≈ ' + 표몫.배수);
  check(표몫.유물없이표 === 표몫.맨,
    '유물이 없으면 표가 있어도 그대로 (표는 유물이 만드는 것)', 표몫.유물없이표);

  // ── 썩지 않는 것 (사령술사) ─────────────────────────────
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'necro' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'necro', null, { timeout: 8000 });

  const 썩지않음 = await page.evaluate(() => {
    const s = window.__scene;
    const 재기 = (유물) => {
      s.weapon = new Weapon(s.job, 0);
      if (유물) s.weapon.takeRelic(relicByKey('undying'));
      s.clearThralls();
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const e = s.enemies.create(s.player.x + 60, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
      const t = s.thralls[0];
      const 체력 = t.maxHp;
      // **몇 대를 버티는가.** 체력만 올리고 맞는 대도 같이 오르면
      // 유물이 아무 일도 안 한 것입니다 — 여기가 그것을 잡습니다.
      let 대 = 0;
      while (s.thralls.length && 대 < 40) {
        s.armor = 0; s.dodge = 0; s.hp = s.maxHp; s.lastHitAt = -99999;
        s.hurt(10, null, false);
        대++;
      }
      return { 체력, 대 };
    };
    return { 없이: 재기(false), 유물: 재기(true),
      배수: relicByKey('undying').thrallHpMul };
  });
  check(썩지않음.유물.체력 === 썩지않음.없이.체력 * 썩지않음.배수,
    '유물을 들면 부하의 체력이 적힌 배수만큼',
    썩지않음.없이.체력 + ' → ' + 썩지않음.유물.체력);
  check(썩지않음.유물.대 > 썩지않음.없이.대,
    '**그래서 실제로 더 오래 버팀** (체력만 오르고 끝나지 않음)',
    썩지않음.없이.대 + '대 → ' + 썩지않음.유물.대 + '대');
  check(썩지않음.유물.대 === 썩지않음.없이.대 * 썩지않음.배수,
    '버티는 대 수가 배수만큼 늘어남',
    썩지않음.없이.대 + ' × ' + 썩지않음.배수 + ' = ' + 썩지않음.유물.대);

  // ── 마르지 않는 샘물 (마법사) ───────────────────────────
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'wizard' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'wizard', null, { timeout: 8000 });

  const 샘물 = await page.evaluate(() => {
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    const 쥐기 = (이름, 유물) => {
      s.weapon = new Weapon(s.job, pool.findIndex((w) => w.name.includes(이름)));
      if (유물) s.weapon.takeRelic(relicByKey('spring'));
      return s.weapon;
    };
    // 적힌 값
    const 불1 = 쥐기('불의 지팡이', false).burn;
    const 불2 = 쥐기('불의 지팡이', true).burn;
    const 관1 = 쥐기('꿰뚫는 지팡이', false).pierce;
    const 관2 = 쥐기('꿰뚫는 지팡이', true).pierce;
    const 막1 = 쥐기('수호의 지팡이', false).shield;
    const 막2 = 쥐기('수호의 지팡이', true).shield;

    // 실제로 더 타는가
    const 태우기 = (유물) => {
      쥐기('불의 지팡이', 유물);
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      const e = s.enemies.create(s.player.x + 40, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1e9; e.maxHp = 1e9; e.floor = 1; e.coin = 0; e.def = { key: 'crawler' };
      s.applyOil(e);
      const r = e.burnDmg;
      e.destroy();
      return r;
    };
    // 실제로 덜 아픈가
    const 맞기 = (유물) => {
      쥐기('수호의 지팡이', 유물);
      s.armor = 0; s.dodge = 0; s.hp = s.maxHp; s.lastHitAt = -99999;
      s.hurt(100, null, false);
      return s.maxHp - s.hp;
    };
    return {
      불1, 불2, 관1, 관2, 막1: Number(막1.toFixed(4)), 막2: Number(막2.toFixed(4)),
      탐1: 태우기(false), 탐2: 태우기(true),
      아픔1: 맞기(false), 아픔2: 맞기(true),
      mul: relicByKey('spring').springMul, smul: relicByKey('spring').springShieldMul,
    };
  });
  check(Math.abs(샘물.불2 / 샘물.불1 - 샘물.mul) < 1e-6,
    '화상이 적힌 배수만큼 세짐', 샘물.불1 + ' → ' + 샘물.불2);
  check(샘물.탐2 > 샘물.탐1, '**한 틱에 실제로 더 탐**', 샘물.탐1 + ' → ' + 샘물.탐2);
  check(샘물.관2 > 샘물.관1, '관통이 세짐 (더 많이 뚫음)', 샘물.관1 + ' → ' + 샘물.관2);
  check(Math.abs(샘물.막2 - (1 + (샘물.막1 - 1) * 샘물.smul)) < 1e-6,
    '보호막은 **1 위의 몫에만** 배수가 붙음 (통째로 곱하면 절반 아래로 떨어집니다)',
    '×' + 샘물.막1 + ' → ×' + 샘물.막2);
  check(샘물.아픔2 < 샘물.아픔1, '**같은 대를 맞아도 더 덜 아픔**',
    샘물.아픔1 + ' → ' + 샘물.아픔2);

  // ── 많이 질수록 (도굴꾼) ────────────────────────────────
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'digger' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'digger', null, { timeout: 8000 });

  const 많이 = await page.evaluate(() => {
    const s = window.__scene;
    const 채우기 = (n) => {
      s.weapon = new Weapon(s.job, 0);
      if (n > 0) s.weapon.takeRelic(relicByKey('heavier'));
      // 나머지는 아무 유물이나 — 세는 것은 **수**입니다.
      const 남 = relicsFor('digger').filter((r) => r.key !== 'heavier');
      for (let i = 0; i < n - 1; i++) s.weapon.takeRelic(남[i]);
      return { 칸: s.weapon.relics.length, 최소: s.weapon.dmgMin, 최대: s.weapon.dmgMax };
    };
    const 굴리기 = () => {
      let 합 = 0;
      for (let i = 0; i < 600; i++) 합 += s.weapon.rollDamage();
      return 합 / 600;
    };
    const 맨몸 = 채우기(0);
    const 맨몸굴림 = 굴리기();
    const 하나 = 채우기(1);
    const 하나굴림 = 굴리기();
    const 다섯 = 채우기(5);
    const 다섯굴림 = 굴리기();
    // 유물은 있는데 이 유물만 없는 판 — 수만 세고 끝나면 안 됩니다.
    s.weapon = new Weapon(s.job, 0);
    relicsFor('digger').filter((r) => r.key !== 'heavier').slice(0, 4)
      .forEach((r) => s.weapon.takeRelic(r));
    const 남들만 = { 칸: s.weapon.relics.length, 최대: s.weapon.dmgMax };
    return { 맨몸, 하나, 다섯, 남들만, step: relicByKey('heavier').heavierStep,
      relicMax: s.job.relicMax,
      굴림: { 맨몸: 맨몸굴림, 하나: 하나굴림, 다섯: 다섯굴림 } };
  });
  check(많이.하나.최대 > 많이.맨몸.최대,
    '**자기도 셉니다** — 하나만 들어도 세짐',
    많이.맨몸.최대 + ' → ' + 많이.하나.최대 + ' (칸 ' + 많이.하나.칸 + ')');
  check(많이.다섯.칸 === 5 && 많이.다섯.최대 > 많이.하나.최대,
    '칸을 채울수록 더 세짐', 많이.하나.최대 + ' → ' + 많이.다섯.최대);
  check(Math.abs(많이.다섯.최대 / 많이.맨몸.최대 - (1 + 5 * 많이.step)) < 0.02,
    '세지는 만큼이 적힌 값과 맞음',
    (많이.다섯.최대 / 많이.맨몸.최대).toFixed(3) + ' ≈ ' + (1 + 5 * 많이.step).toFixed(2));
  check(많이.남들만.최대 === 많이.맨몸.최대,
    '이 유물이 없으면 칸을 채워도 그대로 (칸이 아니라 유물이 세는 것)',
    '칸 ' + 많이.남들만.칸 + ' · ' + 많이.남들만.최대);
  check(많이.굴림.다섯 > 많이.굴림.맨몸 * 1.15,
    '**굴려 본 대가 실제로 더 아픔**',
    많이.굴림.맨몸.toFixed(1) + ' → ' + 많이.굴림.다섯.toFixed(1));
  check(많이.relicMax === 5, '도굴꾼의 칸이 다섯 (다섯째까지 셀 수 있음)',
    많이.relicMax + '칸');

  // ── 마법사의 새 마법 둘 — 연쇄번개와 장판 ───────────────
  //
  // 지팡이는 원래 넷을 지녔습니다(태우고·꿰뚫고·터지고·감쌉니다). 넷 다
  // 「한 대에 얹히는 것」이라 열세 자루가 서로 달라도 손짓이 늘 같았습니다.
  // 둘을 새로 답니다 — 둘 다 **맞은 자리에서 스스로 퍼지는 것**입니다.
  //
  // **판을 마법사로 새로 켜고 잽니다.** 앞 절이 도굴꾼으로 끝나므로 그냥
  // 이어서 재면 자루 목록이 곡괭이입니다 — findIndex 가 -1 을 돌려주고
  // weapon.base 가 undefined 가 되어 `rate` 를 읽다 터집니다. 실제로 그랬습니다.
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'wizard' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player
    && window.__scene.job.key === 'wizard' && !window.__scene.dead,
  null, { timeout: 8000 });
  await page.waitForTimeout(600);

  const 마법 = await page.evaluate(async () => {
    const s = window.__scene;
    // 잴 때마다 판을 처음 상태로 (한 층에 오래 서 있으면 그림자가 삼킵니다).
    const 되돌리기 = () => {
      s.idleMs = 0; s.idleWarned = false; s.swallowing = false;
      if (s.clearShadowPool) s.clearShadowPool();
      s.dead = false; s.hp = s.maxHp;
      s.clearFields();
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
    };
    const 세우기 = (n, 간격) => {
      const f = s.floors.get(s.floorIndex);
      s.player.x = f.slots.mid.x; s.player.y = f.slots.mid.y;
      const 놈들 = [];
      for (let i = 0; i < n; i++) {
        const e = spawnEnemy(s, s.player.x + 60 + i * 간격, s.player.y - 30,
          s.floorIndex, 'crawler');
        e.maxHp = e.hp = 200000; e.hitOnce = true;
        e.stunUntil = s.time.now + 1e9;
        if (e.body) e.body.setAllowGravity(false);
        놈들.push(e);
      }
      return 놈들;
    };
    const 판시계 = (ms) => new Promise((r) => {
      const 끝 = s.time.now + ms, 벽 = Date.now() + ms * 6 + 800;
      const 보기 = () => ((s.time.now >= 끝 || Date.now() >= 벽) ? r() : setTimeout(보기, 16));
      보기();
    });

    // ── 연쇄번개 ──────────────────────────────────────
    // 「번개 지팡이」로 셋을 세우고 **한 대만** 쏩니다. 판은 저절로 계속
    // 쏘므로 문을 잠그고 손으로 한 번 엽니다 — 안 그러면 답이 「3초 동안
    // 몇 대가 나갔나」까지 섞여 판마다 달라집니다.
    const 한대 = async (자루, n) => {
      되돌리기();
      const 자리 = s.weapon.table.findIndex((w) => w.name === 자루);
      if (자리 < 0) throw new Error('그 자루가 목록에 없습니다: ' + 자루);
      s.weapon.index = 자리;
      s.weapon.plus = 0; s.weapon.haste = 0; s.weapon.mult = 1; s.weapon.relics = [];
      s.weapon.hits = () => true;
      s.weapon.rollDamage = () => s.weapon.dmg;
      const 놈들 = 세우기(n, 34);
      const 원래 = s.shoot.bind(s);
      s.shoot = () => {};
      s.lastSubAt = -99999;
      원래(s.time.now);
      await 판시계(3000);
      s.shoot = 원래;
      const 맞은수 = 놈들.filter((e) => e.hp < 200000).length;
      const 합 = 놈들.reduce((a, e) => a + (200000 - e.hp), 0);
      놈들.forEach((e) => e.destroy());
      s.clearFields();
      return { 합, 맞은수, 죽음: s.dead };
    };

    const 번개하나 = await 한대('번개 지팡이', 1);
    const 번개셋 = await 한대('번개 지팡이', 3);
    const 나무셋 = await 한대('나무 지팡이', 3);

    // ── 장판 ──────────────────────────────────────────
    // 깔린 자리에 서 있는 것만 맞습니다. 하나를 자리 안에, 하나를 밖에
    // 두고 재면 「자리에 남는다」가 그대로 잡힙니다.
    되돌리기();
    const 터짐자리 = s.weapon.table.findIndex((w) => w.name === '터지는 지팡이');
    if (터짐자리 < 0) throw new Error('터지는 지팡이가 목록에 없습니다');
    s.weapon.index = 터짐자리;
    s.weapon.plus = 0; s.weapon.haste = 0; s.weapon.mult = 1; s.weapon.relics = [];
    const c = CFG.field;
    const f = s.floors.get(s.floorIndex);
    s.player.x = f.slots.mid.x; s.player.y = f.slots.mid.y;
    const 안 = spawnEnemy(s, s.player.x + 200, s.player.y - 30, s.floorIndex, 'crawler');
    const 밖 = spawnEnemy(s, s.player.x + 200 + c.radius * 2.5, s.player.y - 30,
      s.floorIndex, 'crawler');
    [안, 밖].forEach((e) => { e.maxHp = e.hp = 200000; e.hitOnce = true;
      e.stunUntil = s.time.now + 1e9; if (e.body) e.body.setAllowGravity(false); });
    // **쏘는 문을 잠급니다.** 안 잠그면 판이 저절로 계속 쏘고, 터지는
    // 지팡이는 쏠 때마다 장판을 깝니다 — 다 사라졌는지 보려는 자리에서
    // 새 장판이 계속 깔려 「2장 남음」이 됩니다. 실제로 그랬습니다.
    const 문잠금 = s.shoot.bind(s);
    s.shoot = () => {};
    const 깔림 = s.dropField({ x: 안.x, y: 안.y }, 100);
    const 깔린수 = s.fields.length;
    await 판시계(c.ms + 400);
    s.shoot = 문잠금;
    const 장판 = { 깔림, 깔린수, 안: 200000 - 안.hp, 밖: 200000 - 밖.hp,
      남음: s.fields.length };
    안.destroy(); 밖.destroy();
    되돌리기();

    // 한 자리에 겹겹이 안 쌓입니다 (CFG.field.maxAt).
    for (let i = 0; i < 12; i++) {
      s.dropField({ x: s.player.x + 40 + i * 400, y: s.player.y }, 100);
    }
    const 겹침 = s.fields.length;
    s.clearFields();
    const 걷힘 = s.fields.length;

    return { 번개하나, 번개셋, 나무셋, 장판, 겹침, 걷힘, maxAt: c.maxAt };
  });

  check(마법.나무셋.맞은수 === 1,
    '아무것도 안 지닌 지팡이는 겨눈 하나만 맞힘', 마법.나무셋.맞은수 + '마리');
  check(마법.번개하나.맞은수 === 1 && 마법.번개셋.맞은수 === 2,
    '**연쇄번개는 곁의 하나로 옮겨 붙음** (혼자면 옮겨갈 곳이 없음)',
    마법.번개하나.맞은수 + '마리 → ' + 마법.번개셋.맞은수 + '마리');
  check(마법.번개셋.합 > 마법.번개하나.합 * 1.4,
    '옮겨 붙은 만큼 더 들어감',
    마법.번개하나.합 + ' → ' + 마법.번개셋.합
      + ' (' + (마법.번개셋.합 / 마법.번개하나.합).toFixed(2) + '배)');
  check(!마법.번개셋.죽음, '재는 동안 주인공이 멀쩡함 (그림자에 안 삼켜짐)');

  check(마법.장판.깔림 && 마법.장판.깔린수 === 1,
    '장판이 깔림', 마법.장판.깔린수 + '장');
  check(마법.장판.안 > 0, '**장판 안에 선 것은 계속 깎임**', 마법.장판.안 + ' 깎임');
  check(마법.장판.밖 === 0, '**장판 밖은 안 맞음** (자리에 남는 것이라서)',
    마법.장판.밖 + ' 깎임');
  check(마법.장판.남음 === 0, '때가 되면 스스로 사라짐', 마법.장판.남음 + '장 남음');
  check(마법.겹침 === 마법.maxAt,
    '한 번에 ' + 마법.maxAt + '장까지만 (빠른 자루가 겹겹이 못 쌓게)',
    마법.겹침 + '장');
  check(마법.걷힘 === 0, '판이 끝나면 걷힘 (다음 판에 안 남음)', 마법.걷힘 + '장');

  console.log(bad ? `\n${bad}건 어긋남` : '\n지팡이 넷 · 연타 · 부하 · 곰 · 전용 유물 다섯이 다 제 일을 합니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
