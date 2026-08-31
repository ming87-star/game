// ── 사령술사의 부하 셋이 제 몫을 하는가 ───────────────────
//
//   CHROME_PATH=... node thrall-check.js
//
// 세 가지를 봅니다 — **눈에 보이는가 · 따라오는가 · 세기가 되는가.**
//
// 곰을 재면서 배운 것을 그대로 씁니다 (bear-lead.js 머리글):
//   · 판 시계로 셉니다. 벽시계로 기다리면 헤드리스가 초당 14프레임밖에
//     안 도는데 부하는 프레임마다 움직여서, 멀쩡한 것이 네 배 느리게 잡힙니다
//   · 주인공을 일정한 박자로 올립니다. jump() 로 몰면 판마다 값이 널뜁니다
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = __dirname;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});
(async () => {
  await new Promise((r) => server.listen(8498, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox','--use-gl=swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8498/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);

  const out = await pg.evaluate(async () => {
    window.__game.scene.start('game', { jobKey: 'necro' });
    await new Promise((r) => setTimeout(r, 900));
    const s = window.__scene;
    s.hp = s.maxHp = 1e9;
    for (let i = 0; i < 40; i++) s.addFloor(i);

    const 세우기 = () => {
      const e = s.enemies.create(s.player.x + 40, s.player.y, 'e-crawler');
      e.body.setAllowGravity(false);
      e.hp = 1; e.maxHp = 10; e.floor = s.floorIndex; e.coin = 0; e.def = { key: 'crawler' };
      s.hitEnemy(e, 999);
    };
    s.clearThralls();
    for (let i = 0; i < CFG.thrall.max; i++) 세우기();

    // ── 크기 ──────────────────────────────────────────
    const t0 = s.thralls[0].sprite;
    const 크기 = { 부하: Math.round(t0.displayHeight),
      주인공: Math.round(s.player.displayHeight) };
    const e0 = s.enemies.create(s.player.x + 200, s.player.y, 'e-brute');
    크기.센적 = Math.round(e0.displayHeight);
    e0.destroy();

    // ── 따라오는가 ────────────────────────────────────
    const 판시계 = (ms) => new Promise((r) => {
      const 끝 = s.time.now + ms;
      const 보기 = () => (s.time.now >= 끝 ? r() : setTimeout(보기, 8));
      보기();
    });
    const 뒤처짐 = [];
    for (let f = 1; f <= 22; f++) {
      s.floorIndex = f;
      const 층 = s.floors.get(f);
      const 발판 = LANES.map((l) => 층.slots[l]).find(Boolean);
      s.lane = LANES.find((l) => 층.slots[l] === 발판);
      s.player.setPosition(발판.x, 발판.y - 34);
      s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.5);
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      await 판시계(340);
      if (!s.thralls || !s.thralls.length) continue;
      // 가장 뒤처진 부하가 몇 층 뒤인가.
      const 가장뒤 = Math.max(...s.thralls.map((t) =>
        (t.sprite.y - s.player.y) / CFG.floorHeight));
      뒤처짐.push(가장뒤);
    }
    const 끝 = 뒤처짐.slice(-10);

    // ── 세기 ──────────────────────────────────────────
    // 부하 셋이 붙어서 치는 초당 피해가 주인공의 몇 할인가.
    const w = s.weapon;
    const 내초당 = w.dps;
    const 한마리 = Math.round(w.dmg * CFG.thrall.dmgShare) * 1000 / CFG.thrall.tickMs;
    return {
      크기,
      따라옴: { 평균: 끝.reduce((a, b) => a + b, 0) / Math.max(1, 끝.length),
        가장뒤: Math.max(...뒤처짐), 남은수: s.thralls ? s.thralls.length : 0 },
      세기: { 내초당, 한마리: Math.round(한마리),
        셋: Math.round(한마리 * CFG.thrall.max),
        몫: 한마리 * CFG.thrall.max / 내초당 },
      값: { ...CFG.thrall },
    };
  });

  console.log('  ── 눈에 보이는가 ──────────────────────────');
  console.log(`    부하 ${out.크기.부하}px  ·  주인공 ${out.크기.주인공}px`
    + `  ·  센 적(거인) ${out.크기.센적}px`
    + `   → 주인공의 ${(out.크기.부하 / out.크기.주인공 * 100).toFixed(0)}%`);
  console.log('\n  ── 따라오는가 (주인공이 340ms 마다 한 층) ──');
  console.log(`    가장 뒤처진 부하   평균 ${out.따라옴.평균.toFixed(2)}층`
    + `  ·  가장 나쁠 때 ${out.따라옴.가장뒤.toFixed(2)}층  ·  남은 수 ${out.따라옴.남은수}`);
  console.log(`    ${out.따라옴.평균 < 0.6 ? '따라옵니다' : '뒤처집니다'}`);
  console.log('\n  ── 세기 ────────────────────────────────────');
  console.log(`    주인공 초당 ${out.세기.내초당}  ·  부하 하나 ${out.세기.한마리}`
    + `  ·  셋이면 ${out.세기.셋}   → 주인공의 ${(out.세기.몫 * 100).toFixed(0)}%`);
  console.log(`\n  지금 값: ${JSON.stringify(out.값)}`);
  console.log(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
  await br.close(); server.close();
})();
