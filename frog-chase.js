// ── 황금개구리를 쫓아가 잡을 수 있는가 ────────────────────
//
//   CHROME_PATH=... node frog-chase.js
//   CHROME_PATH=... node frog-chase.js --every 900 --hp 1.4
//
// 개구리 수치는 **짐작으로 정할 수가 없습니다.** 「따라잡을 만한가」는
// 주인공이 한 층에 몇 초인지, 개구리가 몇 초인지, 사라지는 한도가 몇 층인지가
// 한꺼번에 걸리는 값이라, 셋 중 하나만 만져도 답이 바뀝니다.
//
// 그래서 진짜 판에서 재 봅니다 — 개구리를 나타나는 자리에 띄우고 주인공을
// 몰아서 **잡을 때까지** 갑니다. 사거리에 드는 것으로는 모자랍니다:
// 개구리는 맞아도 안 멈추고 계속 뛰므로 「닿았다」와 「잡았다」가 다릅니다.
//
// `--every`·`--hp`·`--ms` 를 주면 그 값으로 덮어쓰고 잽니다. 코드에 넣기
// 전에 먼저 재 보려는 것입니다.
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

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? Number(process.argv[i + 1]) : null;
};
const 덮어쓰기 = { climbEvery: arg('every'), hpScale: arg('hp'), climbMs: arg('ms'),
  firstHopMs: arg('first'), vanishAbove: arg('vanish') };
const 직업 = process.argv.includes('--job')
  ? process.argv[process.argv.indexOf('--job') + 1] : 'warrior';

(async () => {
  const port = Number(process.env.PORT) || 8142;
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
  await page.evaluate((j) => window.__game.scene.start('game', { jobKey: j }), 직업);
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });
  await page.waitForTimeout(600);

  const 값 = await page.evaluate((덮) => {
    Object.entries(덮).forEach(([k, v]) => { if (v !== null) CFG.goldfrog[k] = v; });
    return { ...CFG.goldfrog, 직업: window.__scene.job.name, 자루: window.__scene.weapon.name };
  }, 덮어쓰기);

  const 첫점프 = 값.firstHopMs === undefined ? 값.climbEvery : 값.firstHopMs;
  console.log('── 지금 값 ──────────────────────────────────────────');
  console.log(`  첫 점프까지 ${첫점프}ms · 한 층에 ${값.climbEvery + 값.climbMs}ms`
    + ` (기다림 ${값.climbEvery} + 뛰는 ${값.climbMs})`);
  console.log(`  체력 ×${값.hpScale} · ${값.vanishAbove}층 위로 달아나면 사라짐`
    + ` · 재는 사람은 ${값.직업}(${값.자루})`);

  // 판을 그 층으로 옮기고 **주인공도 같이** 세웁니다.
  //
  // 층만 깔고 주인공을 아래 두면 개구리가 스무 층 위에 뜬 꼴이 되어 첫
  // 프레임에 vanishAbove 에 걸려 그대로 사라집니다 — 처음에 그렇게 재서
  // 「0.3초 만에 사라짐」이 나왔습니다. **개구리가 아니라 시험이 틀린
  // 것이었습니다.**
  const 판깔기 = (층) => `
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    for (let i = ${층} - 2; i <= ${층} + 60; i++) s.addFloor(i);
    s.floorIndex = ${층};
    const 딛기 = s.floors.get(${층});
    const 발판 = LANES.map((l) => 딛기.slots[l]).filter(Boolean)[0];
    s.lane = LANES.find((l) => 딛기.slots[l] === 발판);
    s.player.setPosition(발판.x, 발판.y - 34);
    // **한 박자 쉽니다.** 주인공을 순간이동시키면 카메라와 물리가 아직 옛
    // 자리에 있어서, 그 프레임에 뜬 개구리가 화면 밖으로 판정되어 그대로
    // 사라집니다 — 층마다 결과가 갈리던 것이 이것이었습니다.
    await new Promise((r) => setTimeout(r, 700));
    const 위 = s.floors.get(${층} + 1);
    const 자리 = LANES.map((l) => 위.slots[l]).filter(Boolean)[0];
  `;

  const 쫓기 = async (층) => page.evaluate(new Function('층', `return (async () => {
    ${판깔기('층')}
    const frog = spawnGoldFrog(s, 자리.x, 자리.y - 50, 층 + 1);
    if (!frog) return { 못띄움: true };
    // 순간이동 잔재를 걸러 냅니다. 제대로 떴으면 개구리는 한 층 위에
    // 있어야 합니다 — 서른 층 위에 뜬 판을 「놓쳤다」고 적으면 그게 더
    // 나쁩니다. 아홉 판에 한 판꼴로 그랬습니다.
    const 층차 = Math.round((s.player.y - frog.y) / CFG.floorHeight);
    if (층차 < 0 || 층차 > 2) { frog.destroy(); return { 못띄움: true, 층차 }; }

    // **죽음은 갈고리로 잡습니다.** 90ms 마다 체력을 들여다보면 그 사이에
    // 죽은 것을 「놓쳤다」고 적습니다 — 두 대에 끝나는 지금은 늘 그렇습니다.
    const 원래 = s.hitEnemy.bind(s);
    let 대수 = 0, 죽음 = false;
    s.hitEnemy = (e, d) => { if (e === frog) 대수++; 원래(e, d); if (e === frog && e.hp <= 0) 죽음 = true; };

    const t0 = s.time.now;
    const 개구리처음 = frog.frogFloor;
    let 층수 = 0, 끝 = '시간초과', 가장먼층차 = 0, 개구리끝 = 개구리처음;
    for (let i = 0; i < 240; i++) {
      if (죽음) { 끝 = '잡음'; break; }
      if (!frog.active) { 끝 = '놓침'; break; }
      가장먼층차 = Math.max(가장먼층차, Math.round((s.player.y - frog.y) / CFG.floorHeight));
      개구리끝 = frog.frogFloor;
      const here = LANES.indexOf(s.lane);
      const 위층 = s.floors.get(s.floorIndex + 1);
      let 고른칸 = here, 가장 = Infinity;
      if (위층) LANES.forEach((l, k) => {
        const sl = 위층.slots[l];
        if (!sl || Math.abs(k - here) > 1) return;
        const d = Math.abs(sl.x - frog.x);
        if (d < 가장) { 가장 = d; 고른칸 = k; }
      });
      // 개구리보다 위로 올라가면 지나쳐 버립니다. 아래에 있을 때만 오릅니다.
      const 아래인가 = s.player.y - frog.y > CFG.floorHeight * 0.5;
      if (아래인가) {
        const 전층 = s.floorIndex;
        s.jump(고른칸 < here ? -1 : 고른칸 > here ? 1 : 0);
        await new Promise((r) => setTimeout(r, 90));
        if (s.floorIndex > 전층) 층수 += s.floorIndex - 전층;
      } else {
        await new Promise((r) => setTimeout(r, 90));
      }
    }
    const 걸림 = Math.round(s.time.now - t0);
    s.hitEnemy = 원래;
    if (frog.active) frog.destroy();
    return { 끝, 층수, 걸림, 대수, 가장먼층차, 개구리오름: 개구리끝 - 개구리처음 };
  })()`), 층);

  // **낮은 층에서 잽니다.** 적 체력은 층에 안 매달려 있고(enemyHpScale)
  // 주인공의 오르는 속도도 층과 무관하므로, 층 번호는 쫓기에 아무것도
  // 안 더합니다. 자루가 세지는 몫은 아래 「몇 대에 잡히나」가 따로 냅니다.
  // (높은 층에서는 발판을 예순 개 까느라 판이 밀려 시험이 헛돕니다.)
  console.log('\n── 마음먹고 쫓으면 (잡을 때까지) ────────────────────');
  console.log('  시작층   결과       개구리가 오른 층   걸린 시간   때린 대   가장 벌어진 층');
  for (const 층 of [60, 100, 140]) {
    const r = await 쫓기(층);
    if (r.못띄움) {
      console.log(`  ${String(층).padStart(4)}층   못 띄움`
        + (r.층차 === undefined ? '' : ` (한 층 위여야 하는데 ${r.층차}층 위에 떴습니다)`));
      continue;
    }
    console.log(`  ${String(층).padStart(4)}층   ${r.끝.padEnd(8)}   ${String(r.개구리오름).padStart(12)}층`
      + `   ${((r.걸림 / 1000).toFixed(1) + '초').padStart(7)}   ${String(r.대수).padStart(6)}대`
      + `   ${String(r.가장먼층차).padStart(10)}층`);
  }

  // 가만히 두면 몇 초 만에 사라지나 — 「놓칠 수 있게」의 반대쪽 값입니다.
  const 놓치기 = await page.evaluate(new Function(`return (async () => {
    ${판깔기('300')}
    const frog = spawnGoldFrog(s, 자리.x, 자리.y - 50, 301);
    const t0 = s.time.now;
    for (let i = 0; i < 400 && frog.active; i++) await new Promise((r) => setTimeout(r, 80));
    return { 걸림: Math.round(s.time.now - t0), 사라짐: !frog.active };
  })()`));
  console.log('\n── 가만히 두면 ──────────────────────────────────────');
  console.log('  ' + (놓치기.사라짐 ? (놓치기.걸림 / 1000).toFixed(1) + '초 만에 사라집니다'
    : '32초가 지나도 안 사라집니다'));

  // ── 몇 대에 잡히는가 ────────────────────────────────────
  // 자루 하나로만 재면 답이 안 나옵니다 — 첫 자루와 마지막이 몇 배 차이
  // 납니다. **첫 · 한가운데 · 마지막** 셋으로 재서 「열 대 안팎」이 어느
  // 언저리에서 참인지 봅니다. 정확도까지 셉니다 — 흑철처럼 잘 빗나가는
  // 자루는 실제로 더 여러 대입니다.
  const 대수 = await page.evaluate(() => {
    const 잰다 = (c, i) => {
      const w = new Weapon(c, i);
      const 한대 = w.dmg * (c.attack === 'melee' ? 1 : (w.shots || 1)) * w.accuracy;
      const hp = Math.round((CFG.enemy.baseHp + 100 * CFG.enemy.hpPerFloor)
        * enemyHpScale(100) * CFG.goldfrog.hpScale);
      return { 이름: w.name, 대: Math.max(1, Math.ceil(hp / 한대)), hp };
    };
    return CLASSES.map((c) => {
      const n = buildWeaponPool(c).length;
      return { 직업: c.name,
        첫: 잰다(c, 0), 가운데: 잰다(c, Math.floor(n / 2)), 끝: 잰다(c, n - 1) };
    });
  });
  console.log('\n── 몇 대에 잡히나 (개구리 체력 ' + 대수[0].첫.hp + ') ───────────────');
  console.log('  직업        첫 자루             한가운데            마지막');
  대수.forEach((r) => {
    const 칸 = (x) => (x.대 + '대 ' + x.이름).padEnd(20);
    console.log('  ' + r.직업.padEnd(11) + 칸(r.첫) + 칸(r.가운데) + 칸(r.끝));
  });
  const 다 = 대수.flatMap((r) => [r.첫.대, r.가운데.대, r.끝.대]);
  const 가운데들 = 대수.map((r) => r.가운데.대);
  console.log(`  → 한가운데 자루로 ${Math.min(...가운데들)}~${Math.max(...가운데들)}대`
    + ` · 여덟 직업 스물넷 자루로는 ${Math.min(...다)}~${Math.max(...다)}대`);

  console.log('\n' + (errors.length ? '오류:\n' + errors.join('\n') : '오류 없음'));
  await browser.close();
  server.close();
})();
