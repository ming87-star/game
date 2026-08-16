// 매 프레임 도는 길이 각각 얼마나 걸리는지 잽니다.
//   node prof.js            기본 (400층까지 순간이동해서 재기)
// 최적화 전후로 돌려서 표를 견주는 용도입니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

(async () => {
  await new Promise((r) => server.listen(8195, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  await page.goto('http://localhost:8195/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tower-climb-v1',
    JSON.stringify({ sawStory: true, lastJob: 'warrior', medals: 30 })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.mouse.click(270 * .75, 278 * .75); await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x * .75, st.y * .75); await page.waitForTimeout(900);

  // 후반의 판을 흉내 냅니다 — 적이 여럿, 유물 둘, 무기 마지막.
  await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 420;
    for (let i = 418; i <= 428; i++) s.addFloor(i);
    const slot = s.floors.get(420).slots.mid;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
    s.weapon.tier = s.job.weapons.length - 1;
    s.weapon.plus = 6; s.weapon.haste = 6;
    s.weapon.takeRelic(RELICS.find((r) => r.key === 'waveblade'));
    s.weapon.takeRelic(RELICS.find((r) => r.key === 'bloodcloak'));
    s.hp = s.maxHp = 1e9; s.coins = 12345; s.medals = 30;
    for (let i = 0; i < 10; i++) {
      const e = spawnEnemy(s, 60 + i * 40, s.player.y - 40, 420,
        ['crawler', 'flyer', 'brute', 'dasher'][i % 4]);
      if (e) { e.hp = e.maxHp = 1e9; }
    }

    // 구간마다 걸린 시간을 모읍니다.
    const T = window.__T = {};
    const wrap = (obj, name, label) => {
      const fn = obj[name];
      obj[name] = function (...a) {
        const t0 = performance.now();
        const r = fn.apply(this, a);
        const d = performance.now() - t0;
        const c = T[label] || (T[label] = { ms: 0, n: 0 });
        c.ms += d; c.n++;
        return r;
      };
    };
    wrap(s.hud, 'update', 'hud.update');
    wrap(s, 'updateItems', 'updateItems');
    wrap(s, 'updatePickups', 'updatePickups');
    wrap(s, 'attack', 'attack');
    wrap(s, 'updateBats', 'updateBats');
    wrap(s.rig, 'sync', 'rig.sync');
    wrap(s.rig, 'setWeapon', 'rig.setWeapon');
    wrap(window, 'updateEnemies', 'updateEnemies');

    // 프레임 수를 따로 셉니다. hitEnemy 처럼 한 프레임에 여러 번 도는 것이
    // 있어서, 가장 많이 불린 것을 프레임 수로 삼으면 셈이 어긋납니다.
    window.__frames = 0;
    s.events.on('postupdate', () => { window.__frames++; });
    // swing 은 쿨다운이면 곧장 돌아옵니다. 일한 프레임과 아닌 프레임을 갈라 잽니다.
    {
      const fn = s.swing;
      s.swing = function (now) {
        const before = this.swings || 0;
        const t0 = performance.now();
        const r = fn.call(this, now);
        const d = performance.now() - t0;
        const key = (this.swings || 0) !== before ? 'swing (휘두른 프레임)' : 'swing (쿨다운)';
        const c = T[key] || (T[key] = { ms: 0, n: 0 });
        c.ms += d; c.n++;
        return r;
      };
    }
    wrap(s, 'hitEnemy', 'hitEnemy');
    wrap(s, 'showSlash', 'showSlash');
    wrap(s, 'playAttackMotion', 'playAttackMotion');
    wrap(s, 'popupHit', 'popupHit');
    wrap(s.hud, 'setBoss', 'hud.setBoss');
  });

  await page.waitForTimeout(6000);
  const { out, frames } = await page.evaluate(() => ({
    frames: window.__frames,
    out: Object.entries(window.__T).map(([k, v]) => [k, v.ms / v.n, v.n, v.ms])
      .sort((a, b) => b[1] - a[1]),
  }));
  console.log('한 프레임당 걸린 시간 (6초 동안, 적 10마리 · 420층)\n');
  console.log('  구간'.padEnd(24) + '한 번  '.padStart(10) + '횟수'.padStart(8));
  out.forEach(([k, ms, n]) => console.log('  ' + k.padEnd(22)
    + (ms.toFixed(3) + 'ms').padStart(10) + String(n).padStart(8)));
  // 무엇이 몇 번 돌든, **한 프레임이 실제로 짊어진 몫**으로 환산해서 더합니다.
  // (총 걸린 시간 ÷ 프레임 수). 서로 감싸는 것은 두 번 세이므로 뺍니다 —
  // attack 은 swing 을 품고, popupHit 은 popup 을 품습니다.
  const NESTED = ['swing (휘두른 프레임)', 'swing (쿨다운)', 'showSlash',
    'playAttackMotion', 'hitEnemy', 'popupHit'];
  const total = out.filter((o) => !NESTED.includes(o[0]))
    .reduce((a, o) => a + o[3], 0) / frames;
  console.log('\n  프레임 하나가 짊어진 몫   ' + total.toFixed(3) + 'ms'
    + '   (60fps 예산 16.7ms 의 ' + (total / 16.7 * 100).toFixed(1) + '%)'
    + '   · 프레임 ' + frames + '개');
  await browser.close(); server.close();
})();
