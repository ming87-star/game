// ── 곰이 주인공을 앞서 가는가 ─────────────────────────────
//
//   CHROME_PATH=... node bear-lead.js
//
// 곰사냥꾼의 전부가 「곰이 한 층 앞서 올라가 먼저 싸운다」입니다 (CFG.bear).
// 그런데 주인공이 계속 오르면 곰이 따라오지를 못했습니다 —
//
//   주인공  한 층(165px)을 320ms 에  →  516 px/s
//   곰                              →  210 px/s   (41%)
//
// 「앞서 간다」가 설계인데 수치가 정반대였습니다. 그래서 여기서는
// **주인공을 쉬지 않고 올려 놓고** 곰이 몇 층 뒤에 처지는지를 셉니다.
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
  await new Promise((r) => server.listen(8496, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox','--use-gl=swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8496/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);

  const 값 = await pg.evaluate(() => ({
    곰: CFG.bear.speed,
    주인공: Math.round(CFG.floorHeight / CFG.jumpDuration * 1000),
    ahead: CFG.bear.ahead,
  }));
  console.log(`  곰 ${값.곰} px/s · 주인공 ${값.주인공} px/s`
    + `  (곰이 ${(값.곰 / 값.주인공 * 100).toFixed(0)}%)  · 앞서는 층 ${값.ahead}\n`);

  // **주인공을 일정한 박자로 올립니다.** s.jump() 로 몰면 판마다 발판·상점·
  // 보스가 달라서 오른 층이 16~44 로 널뛰고, 그러면 곰을 재는 것이 아니라
  // 그 판의 운을 재게 됩니다. 여기서 묻는 것은 하나입니다 —
  // **주인공이 이 속도로 오를 때 곰이 앞서 있는가.**
  const 재기 = (적없이, 박자) => pg.evaluate(async ([비우기, ms]) => {
    window.__game.scene.start('game', { jobKey: 'hunter' });
    await new Promise((r) => setTimeout(r, 900));
    const s = window.__scene;
    s.hp = s.maxHp = 1e9;
    for (let i = 0; i < 60; i++) s.addFloor(i);
    s.updateBear(s.time.now, 16);

    const 층차 = [];
    let 먹이본적 = 0, 잰횟수 = 0, 쓰러져있던횟수 = 0;
    // **판 시계로 셉니다.** 벽시계로 기다리면 시험이 거짓말을 합니다 —
    // 헤드리스는 초당 14프레임밖에 안 도는데(실제 판은 60), 곰은 프레임마다
    // 움직이고 주인공은 벽시계로 올라가서 곰이 4배 느린 것처럼 잡힙니다.
    // 둘을 같은 시계에 두어야 실제 판과 같은 값이 나옵니다.
    const 판시계로기다리기 = (밀리초) => new Promise((r) => {
      const 끝 = s.time.now + 밀리초;
      const 보기 = () => (s.time.now >= 끝 ? r() : setTimeout(보기, 8));
      보기();
    });
    for (let f = 1; f <= 40; f++) {
      // 한 층 올려 놓습니다 — 뛰는 시늉이 아니라 자리를 옮깁니다.
      s.floorIndex = f;
      const 층 = s.floors.get(f);
      const 발판 = LANES.map((l) => 층.slots[l]).find(Boolean);
      s.lane = LANES.find((l) => 층.slots[l] === 발판);
      s.player.setPosition(발판.x, 발판.y - 34);
      s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.5);
      if (비우기) s.enemies.getChildren().slice().forEach((e) => e.destroy());
      await 판시계로기다리기(ms);
      if (!s.bear) continue;
      잰횟수++;
      // **쓰러져 있는 동안은 빼고 셉니다.** 죽은 곰이 그 자리에 남는 것은
      // 「못 따라온다」가 아니라 「죽었다」입니다. 둘을 섞으면 어디를
      // 고쳐야 할지 알 수가 없습니다 — 따로 셉니다.
      if (s.bear.hp <= 0) { 쓰러져있던횟수++; continue; }
      층차.push((s.player.y - s.bear.sprite.y) / CFG.floorHeight);
      if (s.enemies.getChildren().some((e) => s.targetable(e)
        && e.floor >= s.floorIndex && e.floor <= s.floorIndex + CFG.bear.ahead)) 먹이본적++;
    }
    const 끝 = 층차.slice(-20);
    return {
      평균: 끝.reduce((a, b) => a + b, 0) / Math.max(1, 끝.length),
      가장뒤: Math.min(...층차), 가장앞: Math.max(...층차),
      싸운몫: 잰횟수 ? 먹이본적 / 잰횟수 : 0,
      쓰러진몫: 잰횟수 ? 쓰러져있던횟수 / 잰횟수 : 0,
      잰수: 층차.length,
    };
  }, [적없이, 박자]);

  const 박자 = 340;  // 주인공이 한 층에 쓰는 시간 (뛰는 데 320ms)
  console.log(`  주인공이 ${박자}ms 마다 한 층씩 오를 때 곰의 자리 (양수 = 앞섬)\n`);
  for (const [이름, 비우기] of [['적을 치우고 (움직임만)', true], ['판 그대로 (싸우면서)', false]]) {
    const 판들 = [];
    for (let i = 0; i < 3; i++) 판들.push(await 재기(비우기, 박자));
    const 평균들 = 판들.map((r) => r.평균).sort((a, b) => a - b);
    const 가운데 = 평균들[1];
    console.log('  ' + 이름);
    console.log('    세 판의 평균  ' + 평균들.map((v) => (v >= 0 ? '+' : '') + v.toFixed(2)).join('  '));
    console.log(`    가운뎃값 ${가운데 >= 0 ? '+' : ''}${가운데.toFixed(2)}층`
      + `  ·  가장 뒤 ${Math.min(...판들.map((r) => r.가장뒤)).toFixed(2)}층`
      + `  ·  쓰러져 있던 몫 ${(Math.max(...판들.map((r) => r.쓰러진몫)) * 100).toFixed(0)}%`
      + (비우기 ? '' : `  ·  적이 있던 몫 ${(판들[0].싸운몫 * 100).toFixed(0)}%`));
    console.log(`    ${가운데 >= 0.3 ? '앞서 갑니다' : '따라오지 못합니다'}\n`);
  }

  console.log(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
  await br.close(); server.close();
})();
