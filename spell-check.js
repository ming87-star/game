// ── 마법사의 한 대가 실제로 몇에게 닿는가 ────────────────
//
//   CHROME_PATH=... node spell-check.js
//
// 지팡이는 원래 넷을 지녔습니다 — 태우고·꿰뚫고·터지고·감쌉니다. 넷 다
// 「한 대에 얹히는 것」이라, 열세 자루가 서로 달라도 손짓은 늘 같았습니다.
// 연쇄번개와 장판을 새로 달면서, **한 대가 실제로 얼마나 퍼지는지**를
// 자루마다 재 둡니다.
//
// 재는 법: 발판 하나에 적을 여럿 세우고 한 대만 쏘게 한 뒤, 잠깐 두었다가
// **모두가 잃은 체력의 합**을 셉니다. 장판은 시간이 지나야 값이 나므로
// 판 시계를 실제로 흘려 보냅니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});

const 마릿수 = [1, 3, 5];

(async () => {
  await new Promise((r) => server.listen(8496, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8496/', { waitUntil: 'networkidle' });
  await pg.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    sawStory: true, unlocked: { wizard: true }, lastJob: 'wizard' })));
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  await pg.evaluate(() => window.__title.go());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => window.__game.scene.start('game', { jobKey: 'wizard' }));
  await pg.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });
  await pg.waitForTimeout(900);

  const 자루들 = await pg.evaluate(() => window.__scene.weapon.table
    .map((w, i) => ({ i, name: w.name, chain: w.chain || 0, field: w.field || 0,
      aoe: w.aoe || 0, burn: w.burn || 0, shots: w.shots || 1 })));

  console.log('\n── 한 대가 모두에게 넣은 피해의 합 (한 마리일 때를 1.00 으로) ──\n');
  console.log('  자루                번개 장판   ' + 마릿수.map((n) => (n + '마리').padStart(9)).join(''));

  let 빠짐 = 0;
  for (const w of 자루들) {
    const 값 = [];
    for (const n of 마릿수) {
      const got = await pg.evaluate(async ([idx, cnt]) => {
        const s = window.__scene;
        // ── 한 판에서 여러 번 재는 값 ────────────────────
        // 이 도구는 한 판을 켜 놓고 자루를 바꿔 가며 수십 번 잽니다. 그
        // 동안 주인공은 한 층에 **몇 분씩 서 있습니다** — 그러면
        // CFG.idle 이 45초에 경고하고 60초에 **그림자가 삼킵니다.**
        // 그 뒤로는 죽은 사람으로 재게 되어 열세 자루 중 뒤쪽 절반이
        // 통째로 0 으로 나옵니다. 실제로 그랬습니다.
        //
        // 그래서 잴 때마다 판을 처음 상태로 되돌립니다.
        s.idleMs = 0; s.idleWarned = false; s.swallowing = false;
        if (s.clearShadowPool) s.clearShadowPool();
        s.dead = false;
        s.hp = s.maxHp;
        s.clearFields();
        s.enemies.getChildren().slice().forEach((e) => e.destroy());
        s.weapon.index = idx;
        // mult 는 **배수**라 기본이 1 입니다. 0 으로 두면 rawSpeed 가 0 이
        // 되고 rate 가 Infinity 가 되어 **쏘는 것 자체가 매번 쿨다운에
        // 걸립니다** — 그러면 열세 자루가 조용히 전부 0 으로 나옵니다.
        s.weapon.plus = 0; s.weapon.haste = 0; s.weapon.mult = 1;
        s.weapon.relics = [];
        s.weapon.hits = () => true;          // 정확도 굴림을 뺍니다
        s.weapon.rollDamage = () => s.weapon.dmg;  // 흔들림도 뺍니다
        const f = s.floors.get(s.floorIndex);
        s.player.x = f.slots.mid.x; s.player.y = f.slots.mid.y;
        // 한 줄로 촘촘히 세웁니다 (34px 간격) — 번개가 옮겨 붙고 장판이
        // 덮을 만큼입니다. 자루끼리 견주는 자리라 간격은 늘 같습니다.
        const 놈들 = [];
        for (let i = 0; i < cnt; i++) {
          const e = spawnEnemy(s, s.player.x + 60 + i * 34, s.player.y - 30, s.floorIndex, 'crawler');
          e.maxHp = e.hp = 200000; e.hitOnce = true;
          // **몸을 끄면 안 됩니다.** 화살이 맞는 것은 물리 겹침으로 잡히므로
          // body.enable = false 로 세워 두면 아무것도 안 맞습니다 — 처음에
          // 그렇게 했다가 열세 자루가 전부 0 으로 나왔습니다.
          //
          // 기절로 세우고(enemies.js 의 stunUntil) 중력만 끕니다. 발판은
          // 폭이 140 이라 다섯을 세우면 끝이 밖으로 나가 떨어집니다 —
          // 처음엔 그래서 맨 앞 놈이 사라진 채로 재고 있었습니다.
          e.stunUntil = s.time.now + 1e9;
          if (e.body) e.body.setAllowGravity(false);
          놈들.push(e);
        }
        // ── 딱 한 대만 ──────────────────────────────────
        // 판은 저절로 계속 쏩니다. 그대로 두고 3초를 재면 **그 사이에 몇
        // 대가 나갔는가**까지 섞여서, 헤드리스(14fps)에서는 같은 자루가
        // 판마다 다른 값을 냅니다 — 595 와 497 이 나왔는데 그 차이가
        // 정확히 한 대였습니다.
        //
        // 그래서 쏘는 문을 잠그고 손으로 한 번만 엽니다.
        const 원래쏘기 = s.shoot.bind(s);
        s.shoot = () => {};
        s.lastSubAt = -99999;   // 쏘는 쪽 쿨다운은 lastSubAt 입니다
        원래쏘기(s.time.now);
        // 장판·화상은 시간이 지나야 값이 납니다. 판 시계를 흘립니다.
        await new Promise((r) => {
          const 끝 = s.time.now + 3000, 벽 = Date.now() + 9000;
          const 보기 = () => ((s.time.now >= 끝 || Date.now() >= 벽) ? r() : setTimeout(보기, 16));
          보기();
        });
        s.shoot = 원래쏘기;   // 문을 도로 엽니다
        // 사라진 놈이 있거나 주인공이 죽었으면 그 판은 못 믿습니다.
        const 사라짐 = 놈들.filter((e) => !e.active).length + (s.dead ? 1 : 0);
        const 합 = 놈들.reduce((a, e) => a + (200000 - e.hp), 0);
        놈들.forEach((e) => e.destroy());
        s.clearFields();
        return { 합, 사라짐 };
      }, [w.i, n]);
      if (got.사라짐) 빠짐 += got.사라짐;
      값.push(got.합);
    }
    const 밑 = 값[0];
    console.log('  ' + w.name.padEnd(18)
      + String(w.chain || '·').padStart(3) + String(w.field ? w.field.toFixed(2) : '·').padStart(7) + '   '
      + 값.map((v) => (밑 ? (v / 밑).toFixed(2) : '?').padStart(9)).join('')
      + '   (' + 값.join(' / ') + ')');
  }
  if (빠짐) console.log('\n  ※ 재는 도중 사라진 놈 ' + 빠짐 + '마리 — 그만큼은 못 믿습니다');
  console.log('\n' + (errs.length ? '오류:\n' + errs.join('\n') : '오류 없음'));
  await br.close(); server.close();
})();
