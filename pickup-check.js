// ── 주워 든 자루가 지금 든 것과 견줄 만한가 ────────────────
//
//   CHROME_PATH=... node pickup-check.js
//
// 필드·상점에서 만나는 자루는 종류를 굴린 뒤 **강화를 얹어서** 나옵니다
// (js/forge.js 의 withPickupGift). 그 얹기가 실제로 격차를 메우는지 잽니다.
//
// 예전에는 늘 맨 것(+0)이 나와서 후보 여덟이 **예외 없이** 지금 든 것의
// ×0.36 ~ ×0.90 이었습니다. 갈아탈 이유가 셈으로 아예 없었습니다.
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
  await new Promise((r) => server.listen(8492, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox','--use-gl=swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8492/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);

  const out = await pg.evaluate(() => {
    // 그 층까지 오르면 강화를 대충 이만큼 먹습니다 (UP 자리·상점). 어림입니다.
    const 쌓임 = (f) => ({ plus: Math.min(10, Math.round(f / 45)),
      haste: Math.min(8, Math.round(f / 90)), mult: f >= 300 ? 2 : 1 });
    const rows = [];
    for (const floor of [100, 300, 600, 900]) {
      for (const key of ['warrior', 'archer', 'rogue', 'monk', 'wizard']) {
        const job = classByKey(key);
        const pool = buildWeaponPool(job);
        // 무명은 성격이 다릅니다 — 맨몸이 가장 약한 대신 +1 을 쉰까지
        // 받습니다. 그것만 들고 재면 흔한 판을 못 봅니다. 보통 자루를
        // 들고 있는 쪽으로 잽니다.
        const 열린 = pool.filter((w) => floor >= w.depth && w.forge && !isNameless(w));
        const me = new Weapon(job, pool.indexOf(열린[열린.length - 1]));
        const u = 쌓임(floor);
        me.plus = u.plus; me.haste = u.haste; me.mult = u.mult;

        // 200번 굴려서 비를 모읍니다 — 종류가 무작위라 한 번으로는 못 봅니다.
        const 비 = [];
        let 벼림합 = 0, 무명 = 0;
        for (let i = 0; i < 200; i++) {
          const e = rollWeapon(job, floor, me);
          if (isNameless(e)) { 무명++; continue; }
          비.push(me.dpsOf(e, false) / me.dps);
          벼림합 += (e.gift && e.gift.plus) || 0;
        }
        비.sort((a, b) => a - b);
        rows.push({ floor, job: job.name, me: me.name, u,
          lo: 비[0], hi: 비[비.length - 1],
          mid: 비[Math.floor(비.length / 2)],
          벼림: 벼림합 / Math.max(1, 비.length), 무명 });
      }
    }
    return { rows, band: CFG.pickup };
  });

  console.log(`  범위로 정해 둔 것: ×${out.band.lo} ~ ×${out.band.hi}\n`);
  console.log('  층    직업     지금 든 자루            주운 것의 초당피해 비        평균 벼림');
  out.rows.forEach((r) => {
    const 표 = r.me + ' +' + r.u.plus + (r.u.mult > 1 ? ' ×' + r.u.mult : '') + ' 속' + r.u.haste;
    const 벗어남 = r.lo < out.band.lo - 0.08 || r.hi > out.band.hi + 0.08;
    console.log('  ' + String(r.floor).padStart(3) + '   ' + r.job.padEnd(7) + 표.padEnd(24)
      + '×' + r.lo.toFixed(2) + ' ~ ×' + r.hi.toFixed(2) + '  (가운데 ×' + r.mid.toFixed(2) + ')'
      + '   +' + r.벼림.toFixed(1) + (벗어남 ? '   ← 범위 밖' : ''));
  });
  const 다 = out.rows.flatMap((r) => [r.lo, r.hi]);
  console.log(`\n  통틀어 ×${Math.min(...다).toFixed(2)} ~ ×${Math.max(...다).toFixed(2)}`);
  console.log(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
  await br.close(); server.close();
})();
