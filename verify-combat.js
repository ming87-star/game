// 세 직업의 공격이 제 성격대로 도는지 확인합니다.
//
//   파동검  휘두른 방향으로, 다섯 번에 한 번, 절반의 힘으로
//   궁수    주인공보다 아래의 적은 안 쏨
//   도적    보스 앞에서는 회피가 덜 통하고, 보스는 털 수 없음
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

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

const errors = [];

async function boot(browser, port, jobIndex) {
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0,
    weapons: {}, boosts: {}, relics: {},
    unlocked: { archer: true, rogue: true }, lastJob: 'warrior',
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.mouse.click(...at(270, 278 + jobIndex * 210));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await page.waitForTimeout(900);
  return page;
}

(async () => {
  const port = Number(process.env.PORT) || 9660;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });

  // ── 공격 모션 ──────────────────────────────────────────
  // 몸짓은 눈으로 봐야 알지만, **눈으로만 보면 조용히 어긋납니다.** 값을 하나
  // 잘못 고쳐 창이 검처럼 돌아도 화면에서는 "좀 이상한데" 정도로만 보입니다.
  // 그래서 성격을 숫자로 못 박아 둡니다. 띠로 보는 것은 node shot-motion.js.
  const warrior = await boot(browser, port, 0);

  const motion = await warrior.evaluate(() => {
    const s = window.__scene;
    const rig = s.rig;

    // 한 판을 촘촘히 훑어 그 몸짓이 어디까지 갔는지를 잽니다.
    const sweep = (m) => {
      const out = { minDx: 0, maxDx: 0, maxRot: 0, minRot: 0, peaks: 0 };
      const dxs = [];
      for (let i = 0; i <= 100; i++) {
        rig.applyAt(m.keys, i / 100);
        const p = rig.pose;
        dxs.push(p.dx);
        out.minDx = Math.min(out.minDx, p.dx);
        out.maxDx = Math.max(out.maxDx, p.dx);
        out.maxRot = Math.max(out.maxRot, p.rot);
        out.minRot = Math.min(out.minRot, p.rot);
      }
      // 앞으로 나갔다 되돌아오는 산의 개수. 쌍단검만 둘이어야 합니다.
      for (let i = 1; i < dxs.length - 1; i++) {
        if (dxs[i] > dxs[i - 1] && dxs[i] >= dxs[i + 1] && dxs[i] > 4) out.peaks++;
      }
      return out;
    };

    // 실제 무기표에서 어떤 몸짓이 걸리는지도 함께 봅니다 —
    // MOTIONS 만 맞고 무기가 딴 것을 집으면 아무 뜻이 없습니다.
    const pick = (jobKey, tier) => {
      const job = classByKey(jobKey);
      const w = { base: job.weapons[tier] };
      const m = motionFor(job, w);
      return Object.keys(MOTIONS).find((k) => MOTIONS[k] === m);
    };

    rig.applyAt(MOTIONS.sword.keys, 1);
    const ended = { ...rig.pose };
    rig.rest();

    return {
      sword: sweep(MOTIONS.sword),
      spear: sweep(MOTIONS.spear),
      twin: sweep(MOTIONS.daggerTwin),
      dagger: sweep(MOTIONS.dagger),
      bow: sweep(MOTIONS.bow),
      crossbow: sweep(MOTIONS.crossbow),
      ended,
      picks: [
        '전사0=' + pick('warrior', 0), '전사3=' + pick('warrior', 3),
        '도적0=' + pick('rogue', 0), '도적2=' + pick('rogue', 2),
        '궁수0=' + pick('archer', 0), '궁수3=' + pick('archer', 3),
      ],
      // 다음 대가 나가기 전에 한 판이 끝나야 동작이 잘려 보이지 않습니다.
      fits: [410, 300, 230, 170, 85].every((rate) => motionMs(rate) <= rate),
      // 이펙트를 늦추는 것은 아무리 느린 무기라도 70ms 를 넘지 않습니다.
      lead: Math.max(...[410, 300, 230, 170].map(
        (rate) => motionLead(MOTIONS.bow, motionMs(rate)))),
    };
  });

  check(motion.picks.join(' · ') ===
    '전사0=sword · 전사3=spear · 도적0=dagger · 도적2=daggerTwin · 궁수0=bow · 궁수3=crossbow',
    '무기표의 그림과 몸짓이 짝을 이룸', motion.picks.join(' · '));

  // 검은 돌려서 베고 창은 밀어 넣습니다. 이 둘이 안 갈리면 창이 몽둥이가 됩니다.
  check(motion.spear.maxDx > motion.sword.maxDx * 1.4 &&
    motion.spear.maxRot < motion.sword.maxRot * 0.5,
    '창은 검보다 멀리 나가고 훨씬 덜 돎',
    `앞으로 ${motion.spear.maxDx.toFixed(0)} vs ${motion.sword.maxDx.toFixed(0)} · ` +
    `회전 ${motion.spear.maxRot.toFixed(2)} vs ${motion.sword.maxRot.toFixed(2)}`);

  // 석궁은 이미 걸려 있는 것을 놓을 뿐이라 앞으로 나갈 일이 없습니다.
  check(motion.crossbow.minDx < -8 && motion.crossbow.maxDx <= 0,
    '석궁은 앞으로 안 나가고 뒤로 밀림',
    `뒤로 ${motion.crossbow.minDx.toFixed(0)} · 앞으로 ${motion.crossbow.maxDx.toFixed(0)}`);

  check(motion.twin.peaks === 2 && motion.dagger.peaks === 1,
    '쌍단검은 두 번, 단검은 한 번 나감',
    `쌍 ${motion.twin.peaks}번 · 단 ${motion.dagger.peaks}번`);

  // 활은 놓을 때가 아니라 **당길 때** 힘이 실립니다 — 뒤로 눕는 것이 더 커야 합니다.
  check(motion.bow.minRot < -0.15 && Math.abs(motion.bow.minRot) > motion.bow.maxRot,
    '활은 앞으로 서기보다 뒤로 눕는 것이 큼',
    `뒤 ${motion.bow.minRot.toFixed(2)} · 앞 ${motion.bow.maxRot.toFixed(2)}`);

  const rested = Object.values(motion.ended);
  check(rested.every((v) => Math.abs(v) < 0.001 || Math.abs(v - 1) < 0.001),
    '판이 끝나면 자세가 제자리로', JSON.stringify(motion.ended));

  check(motion.fits, '한 판이 다음 대보다 먼저 끝남');
  check(motion.lead <= 70, '이펙트를 늦추는 것은 70ms 를 안 넘음', motion.lead + 'ms');

  // 겉몸이 물리 몸을 그대로 따라가는가. 여기가 어긋나면 주인공이 제자리에
  // 서 있는데 그림만 딴 데 가 있습니다.
  const follow = await warrior.evaluate(() => {
    const s = window.__scene;
    s.player.setPosition(200, 400);
    s.player.setFlipX(false);
    s.rig.pose.dx = 10; s.rig.pose.dy = -4;
    s.rig.sync();
    const right = { x: s.rig.view.x, y: s.rig.view.y };
    s.player.setFlipX(true); // 왼쪽을 보면 앞은 왼쪽입니다
    s.rig.sync();
    const left = { x: s.rig.view.x, y: s.rig.view.y };
    s.rig.rest(); s.rig.sync();
    const rest = { x: s.rig.view.x, y: s.rig.view.y, hidden: s.player.visible };
    return { right, left, rest };
  });
  check(follow.right.x === 210 && follow.right.y === 396 && follow.left.x === 190,
    '겉몸이 물리 몸을 따라가고, 앞쪽은 바라보는 쪽',
    `오른쪽 ${follow.right.x} · 왼쪽 ${follow.left.x}`);
  check(follow.rest.x === 200 && follow.rest.y === 400 && follow.rest.hidden === false,
    '쉴 때는 물리 몸 자리 그대로 (그리고 물리 몸은 안 보임)');

  // ── 파동검 (전사) ──────────────────────────────────────
  const wave = await warrior.evaluate(async () => {
    const s = window.__scene;

    // 이펙트가 몸짓 뒤에 나오게 되면서 이 검사는 **기다려야** 합니다.
    // 그런데 기다리는 동안 판은 계속 돕니다 — 게임이 스스로 휘두른 것까지
    // 세면 "다섯 번에 한 번"이 맞을 리가 없습니다. 재는 동안만 손을 묶습니다.
    s.attack = () => {};
    // 적도 붙들어 둡니다. 기다리는 사이에 날것이 떠다니면, 다섯 번째로 휘두를 때
    // 그놈은 이미 다른 자리에 있어서 "휘두른 방향"이 딴 데를 가리킵니다.
    window.updateEnemies = () => {};

    s.weapon.relics = [RELICS.find((r) => r.key === 'waveblade')];
    s.floorIndex = 40;
    s.addFloor(s.floorIndex);
    const slot = s.floors.get(s.floorIndex).slots.mid
      || s.floors.get(s.floorIndex).slots.left;
    s.player.setPosition(slot.x, slot.y - 34);

    // 사거리 안에 한 마리, 훨씬 위쪽 멀리에 또 한 마리를 둡니다.
    // 파동이 표적을 고른다면 멀리 있는 놈 쪽으로 날아갑니다.
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const near = spawnEnemy(s, s.player.x + 40, s.player.y, s.floorIndex, 'flyer');
    const far = spawnEnemy(s, s.player.x - 30, s.player.y - 330, s.floorIndex, 'flyer');
    near.body.setAllowGravity(false);
    far.body.setAllowGravity(false);
    near.hp = 1e9; far.hp = 1e9;

    const waves = [];
    let swings = 0;
    s.swings = 0;
    const dmgOf = Math.round(s.weapon.dmg * s.weapon.relicSum('wave'));

    // 파동은 **몸이 지나간 뒤에** 나갑니다 (js/motion.js 의 windup — 최대 70ms).
    // 곧장 세면 아직 안 나간 것을 "안 나갔다"고 적게 됩니다.
    //
    // 정해진 시간만큼 기다리지 않고 **나올 때까지 지켜봅니다.** 소프트웨어
    // 그래픽으로 도는 검사판은 초당 몇 장밖에 못 그려서, 70ms 를 기다리는 데
    // 실제로는 그 몇 배가 걸립니다. 시간을 박아 두면 느린 날에만 틀립니다.
    const waveAfter = async (before) => {
      for (let k = 0; k < 20; k++) {
        await new Promise((r) => setTimeout(r, 25));
        const made = s.bullets.getChildren().filter((b) => b.active && !b.isArrow);
        if (made.length > before) return made[made.length - 1];
      }
      return null;
    };

    for (let i = 0; i < 10; i++) {
      s.lastSwingAt = -1e9;
      const before = s.bullets.getChildren().filter((b) => b.active && !b.isArrow).length;
      s.swing(s.time.now + i * 1000);
      swings++;
      const b = await waveAfter(before);
      if (b) {
        waves.push({ swing: swings, vx: Math.round(b.body.velocity.x), vy: Math.round(b.body.velocity.y), dmg: b.dmg });
      }
    }
    return { waves, dmgOf, body: s.weapon.dmg, every: CFG.waveEvery, nearX: near.x, nearY: near.y, farY: far.y };
  });
  check(wave.waves.length === 2 && wave.waves[0].swing === wave.every,
    '파동은 다섯 번에 한 번만 나감',
    '열 번 휘둘러 ' + wave.waves.length + '번 · ' + wave.waves.map((w) => w.swing + '번째').join(', '));
  check(wave.waves.length > 0 && wave.waves[0].dmg === wave.dmgOf &&
    wave.dmgOf <= Math.round(wave.body * 0.3),
    '파동의 힘은 본체의 3할 아래', wave.dmgOf + ' / ' + wave.body);
  // 멀리 위쪽의 적을 쫓았다면 vy 가 크게 음수입니다.
  // 휘두른 쪽(오른쪽 옆의 적)으로 나갔다면 거의 수평입니다.
  check(wave.waves.length > 0 && wave.waves[0].vx > 300 && Math.abs(wave.waves[0].vy) < 200,
    '파동은 멀리 있는 적이 아니라 휘두른 방향으로 나감',
    wave.waves.length ? `속도 (${wave.waves[0].vx}, ${wave.waves[0].vy})` : '안 나감');

  // 사거리 안에 아무도 없으면 휘두르지도 않아야 합니다 (허공을 베지 않습니다).
  const idle = await warrior.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.bullets.clear(true, true);
    s.lastSwingAt = -1e9;
    const before = s.swings;
    s.swing(s.time.now + 99999);
    return { swung: s.swings !== before, waves: s.bullets.getChildren().length };
  });
  check(!idle.swung && idle.waves === 0, '사거리 안에 아무도 없으면 휘두르지 않음');
  await warrior.close();

  // ── 궁수는 위만 쏜다 ───────────────────────────────────
  const archer = await boot(browser, port, 1);
  const aim = await archer.evaluate(async () => {
    const s = window.__scene;
    s.attack = () => {};        // 재는 동안 판이 스스로 쏘지 않도록
    window.updateEnemies = () => {}; // 적이 떠다니면 사거리 안팎이 바뀝니다
    s.floorIndex = 40;
    s.addFloor(s.floorIndex);
    const slot = s.floors.get(s.floorIndex).slots.mid
      || s.floors.get(s.floorIndex).slots.left;
    s.player.setPosition(slot.x, slot.y - 34);
    s.enemies.getChildren().slice().forEach((e) => e.destroy());

    const put = (dy) => {
      const e = spawnEnemy(s, s.player.x + 60, s.player.y + dy, s.floorIndex, 'flyer');
      e.body.setAllowGravity(false);
      e.hp = 1e9;
      return e;
    };
    const below = put(200);   // 한 층 아래
    const sameFloor = put(18); // 같은 발판 — 발이 땅에 붙어 조금 아래
    const above = put(-150);  // 위층

    // 화살은 **활을 다 당긴 뒤에** 나갑니다 (js/motion.js 의 windup).
    // 쏘라고 이르고 곧장 세면 아직 시위에 걸려 있습니다.
    // 파동과 같은 이유로, 시간을 박지 않고 나올 때까지 지켜봅니다.
    const canHit = async (e) => {
      s.enemies.getChildren().forEach((x) => x.setActive(x === e).setVisible(x === e));
      s.subTarget = null;
      s.lastSubAt = -1e9;
      s.bullets.clear(true, true);
      s.shoot(s.time.now);
      let n = 0;
      for (let k = 0; k < 20 && !n; k++) {
        await new Promise((r) => setTimeout(r, 25));
        n = s.bullets.getChildren().filter((b) => b.active).length;
      }
      s.enemies.getChildren().forEach((x) => x.setActive(true).setVisible(true));
      return n > 0;
    };
    return {
      below: await canHit(below), same: await canHit(sameFloor),
      above: await canHit(above), tol: CFG.aimBelow,
    };
  });
  check(aim.above === true, '위층의 적은 쏨');
  check(aim.same === true, '같은 발판의 적도 쏨 (발밑 몫은 봐줌)', 'aimBelow ' + aim.tol);
  check(aim.below === false, '아래층의 적은 안 쏨');
  await archer.close();

  // ── 도적: 보스 앞의 회피와 절도 ────────────────────────
  const rogue = await boot(browser, port, 2);

  const steal = await rogue.evaluate(() => {
    const s = window.__scene;
    return { rate: s.job.steal, chance: s.weapon.stealChance };
  });
  check(steal.rate <= 0.2, '절도 확률이 낮아짐 (0.32 → 0.2 아래)', steal.rate);

  // 보스 층으로 올려 실제 보스를 세웁니다.
  await rogue.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 199;
    s.lane = 'mid';
    for (let i = 199; i <= 206; i++) s.addFloor(i);
    const slot = s.floors.get(199).slots.mid;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
  });
  await rogue.waitForTimeout(300);
  await rogue.mouse.click(...at(270, 620));
  await rogue.waitForTimeout(1200 + 2400);

  const bossSteal = await rogue.evaluate(() => {
    const s = window.__scene;
    const boss = s.boss;
    if (!boss || !boss.active) return { noBoss: true };
    // 확실히 훔치도록 확률을 1로 올려 두고 백 번 벱니다.
    s.job.steal = 1;
    s.weapon.job = s.job;
    boss.hp = 1e12;
    const before = s.coins;
    const pickups = s.pickups.length;
    for (let i = 0; i < 100; i++) { s.lastSwingAt = -1e9; s.swing(s.time.now + i * 1000); }
    return { coins: s.coins - before, dropped: s.pickups.length - pickups, hitBoss: boss.hp < 1e12 };
  });
  check(!bossSteal.noBoss, '보스가 서 있음');
  check(bossSteal.hitBoss, '도적의 칼이 보스에게 닿음');
  check(bossSteal.dropped === 0 && bossSteal.coins === 0,
    '백 번을 베도 보스에게서는 한 닢도 못 훔침',
    '떨어진 코인 ' + bossSteal.dropped + '개');

  const bossDodge = await rogue.evaluate(() => {
    const s = window.__scene;
    s.dodge = 0.6;
    s.hp = s.maxHp = 1e9;

    const rounds = 4000;
    const run = (fromBoss) => {
      let dodged = 0;
      for (let i = 0; i < rounds; i++) {
        const hp = s.hp;
        s.lastHitAt = -1e9;
        s.hurt(10, null, fromBoss);
        if (s.hp === hp) dodged++;
      }
      return dodged / rounds;
    };
    const normal = run(false);
    const boss = run(true);
    return { normal, boss, scale: CFG.boss.dodgeScale };
  });
  const pc = (x) => (x * 100).toFixed(0) + '%';
  check(Math.abs(bossDodge.normal - 0.6) < 0.04, '보통 공격은 회피가 그대로', pc(bossDodge.normal));
  check(Math.abs(bossDodge.boss - 0.6 * bossDodge.scale) < 0.04,
    '보스가 내리꽂는 것에는 3분의 2만 통함',
    pc(bossDodge.boss) + ' (기대 ' + pc(0.6 * bossDodge.scale) + ')');
  await rogue.close();

  console.log(bad ? `\n${bad}건 어긋남` : '\n공격 성격 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
