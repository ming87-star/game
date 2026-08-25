// 마법사의 지팡이가 지닌 넷 — **화상 · 관통 · 광역 · 보호막**.
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

  console.log(bad ? `\n${bad}건 어긋남` : '\n지팡이 넷이 다 제 일을 합니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
