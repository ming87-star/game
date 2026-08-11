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
    unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true,
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
  // 몸짓은 이제 그림 안에 들어 있습니다 (assets/sheets → js/sheetdata.js).
  // 코드가 정하는 것은 **어떤 시트를 · 어떤 박자로** 넘길지뿐이라, 여기서
  // 볼 것도 그 둘입니다. 띠로 눈으로 보는 것은 node shot-motion.js.
  const warrior = await boot(browser, port, 0);

  const motion = await warrior.evaluate(() => {
    const s = window.__scene;
    const rig = s.rig;

    // 무기표의 그림과 박자가 짝을 이루는가. 그림이 창인데 박자가 검이면
    // 어느 쪽이든 거짓말이 됩니다.
    const pick = (jobKey, tier) => {
      const job = classByKey(jobKey);
      const m = motionFor(job, { base: job.weapons[tier] });
      return Object.keys(BEATS).find((k) => BEATS[k] === m);
    };

    // 한 판을 촘촘히 훑어 컷이 **차례대로 하나씩** 넘어가는지 봅니다.
    // 건너뛰거나 되돌아가면 화면에서 툭툭 끊깁니다.
    const walk = (beat) => {
      const seen = [];
      for (let i = 0; i <= 400; i++) {
        rig.frameAt(beat, i / 400);
        if (seen[seen.length - 1] !== rig.frame) seen.push(rig.frame);
      }
      rig.rest();
      return seen;
    };

    // 예비동작이 타격보다 느려야 합니다. 여기가 뒤집히면 컷을 아무리 잘
    // 그려도 휘두르는 맛이 안 납니다.
    const pace = {};
    Object.keys(BEATS).forEach((k) => {
      const h = BEATS[k].hold;
      const windup = (h[0] + h[1] + h[2]) / 3;
      const strike = (h[3] + h[4]) / 2;
      pace[k] = +(windup / strike).toFixed(2);
    });

    // 서른여섯 자루가 화면에서 같은 키로 서는가. 무기마다 휘두르는 폭이
    // 달라 인물이 다르게 구워졌으므로 잰 키로 나눠 줍니다.
    const heights = Object.keys(SHEET_ART).map((k) => {
      const d = SHEET_ART[k];
      return +(52 / d.hero * d.hero).toFixed(1);   // = HERO_H, 정의상 늘 같아야 합니다
    });
    const missing = [];
    ['warrior', 'archer', 'rogue'].forEach((j) => {
      for (let t = 0; t < 12; t++) if (!SHEET_ART['w-' + j + '-' + t]) missing.push(j + t);
    });

    return {
      walk: walk(BEATS.sword),
      pace,
      cut: rig.cut,
      key: rig.key,
      onScreen: +(rig.scale * rig.data.hero).toFixed(1),
      sheets: Object.keys(SHEET_ART).length,
      missing,
      heights: heights.length,
      picks: [
        '전사0=' + pick('warrior', 0), '전사3=' + pick('warrior', 3),
        '도적0=' + pick('rogue', 0), '도적2=' + pick('rogue', 2),
        '궁수0=' + pick('archer', 0), '궁수3=' + pick('archer', 3),
      ],
      fits: [410, 300, 230, 170, 85].every((rate) => motionMs(rate) <= rate),
      lead: Math.max(...[410, 300, 230, 170].map(
        (rate) => motionLead(BEATS.bow, motionMs(rate)))),
      resting: (rig.rest(), rig.frame),
    };
  });

  check(motion.cut && motion.key === 'w-warrior-0',
    '주인공이 그 무기의 시트로 서 있음', motion.key);

  check(motion.sheets === 36 && !motion.missing.length,
    '무기 서른여섯 자루의 시트가 다 있음',
    motion.sheets + '자루' + (motion.missing.length ? ' · 빠짐 ' + motion.missing.join(',') : ''));

  check(motion.picks.join(' · ') ===
    '전사0=sword · 전사3=spear · 도적0=dagger · 도적2=daggerTwin · 궁수0=bow · 궁수3=crossbow',
    '무기표의 그림과 박자가 짝을 이룸', motion.picks.join(' · '));

  // **이 검사가 이번 손질의 핵심입니다.** 컷을 하나라도 건너뛰면 그 자세를
  // 아무도 못 보고, 되돌아가면 팔이 두 번 올라갑니다.
  check(motion.walk.join(',') === '0,1,2,3,4,5,6,7',
    '여덟 컷이 건너뜀도 되돌아감도 없이 차례대로 넘어감', motion.walk.join(','));

  // 애니메이션 쪽 통설 — 예비동작을 늦추고 타격을 빠르게 하는 것이, 컷을 더
  // 그려 넣는 것보다 낫다. 값으로 못 박아 둡니다.
  const slowest = Math.min(...Object.values(motion.pace));
  check(slowest >= 1.6,
    '어느 무기든 예비동작이 타격보다 한참 느림',
    Object.keys(motion.pace).map((k) => k + ' ' + motion.pace[k] + '배').join(' · '));

  check(Math.abs(motion.onScreen - 52) < 0.5,
    '무기가 바뀌어도 화면에서 주인공의 키는 그대로', motion.onScreen + 'px');

  check(motion.resting === 0, '판이 끝나면 첫 컷으로 돌아옴', '컷 ' + motion.resting);

  check(motion.fits, '한 판이 다음 대보다 먼저 끝남');
  check(motion.lead <= 100, '이펙트를 늦추는 것은 100ms 를 안 넘음', motion.lead + 'ms');

  // 겉몸이 물리 몸을 그대로 따라가는가. 여기가 어긋나면 주인공이 제자리에
  // 서 있는데 그림만 딴 데 가 있습니다.
  const follow = await warrior.evaluate(() => {
    const s = window.__scene;
    const v = () => ({ x: Math.round(s.rig.view.x * 10) / 10,
                       y: Math.round(s.rig.view.y * 10) / 10 });

    s.player.setPosition(200, 400);
    s.player.setFlipX(false);
    s.rig.sync();
    const flat = v();

    // 앞으로 나간 만큼 그림도 따라가야 합니다.
    s.player.setPosition(260, 400);
    s.rig.sync();
    const moved = v();
    s.player.setPosition(200, 400);

    // 좌우를 뒤집어도 **발은 제자리**여야 합니다. 축이 발이라 그렇습니다 —
    // 축이 한가운데였으면 뒤집을 때마다 발이 옆으로 튑니다.
    s.player.setFlipX(true);
    s.rig.sync();
    const flipped = v();
    const flipX = s.rig.view.flipX;
    s.player.setFlipX(false);

    // 몸 전체가 도는 것 (도적이 뛰며 한 바퀴). 그림의 **자리**까지 몸 한가운데를
    // 돌아야 합니다. 각도만 돌면 발을 축으로 제자리에서 돌아 몸이 땅에 박힙니다.
    s.player.setRotation(Math.PI / 2);
    s.rig.sync();
    const spun = v();
    s.player.setRotation(0);

    s.rig.rest(); s.rig.sync();
    return { flat, moved, flipped, flipX, spun, hidden: s.player.visible,
             alpha: (s.player.setAlpha(0.4), s.rig.sync(), s.rig.view.alpha) };
  });

  check(follow.moved.x - follow.flat.x === 60,
    '물리 몸이 나간 만큼 겉몸도 나감', (follow.moved.x - follow.flat.x).toFixed(0) + 'px');
  check(follow.flipX && follow.flipped.x === follow.flat.x && follow.flipped.y === follow.flat.y,
    '좌우를 뒤집어도 발은 제자리', follow.flipped.x + ',' + follow.flipped.y);
  // 몸이 90도 돌면 발은 몸 한가운데를 돌아 **다른 자리로** 가야 합니다.
  const spunBy = Math.hypot(follow.spun.x - follow.flat.x, follow.spun.y - follow.flat.y);
  check(spunBy > 5, '몸 전체가 돌면 겉몸의 자리도 몸 한가운데를 돎',
    spunBy.toFixed(1) + 'px 옮겨 감');
  check(Math.abs(follow.alpha - 0.4) < 0.01, '맞아서 깜빡이는 것이 겉몸에도 보임', follow.alpha);

  check(follow.hidden === false, '물리 몸은 안 보이고 겉몸만 보임');

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

  // ── 도적의 가죽 갑옷 ───────────────────────────────────
  // 회피만으로 버티게 했더니 운 나쁜 몇 대에 증발했습니다. 얇은 가죽을 한 겹
  // 깔아 바닥을 받칩니다. 위험한 곳은 셋입니다 —
  //   1. 가죽이 닳으면 몇 대 맞고 나서 도로 0이 됩니다 (닳지 않아야 합니다)
  //   2. usesArmor 를 켜 버리면 필드에서 '회' 대신 방어구가 나와 정체성이 바뀝니다
  //   3. 회피가 터진 대에는 가죽까지 겹쳐 세면 안 됩니다 (0을 또 깎을 수는 없으니)
  const leather = await rogue.evaluate(() => {
    const s = window.__scene;
    s.dodge = 0;                 // 가죽만 따로 재려고 회피를 끕니다
    s.hp = s.maxHp = 1e9;
    const before = s.armor;

    let taken = 0;
    for (let i = 0; i < 200; i++) {
      const hp = s.hp;
      s.lastHitAt = -1e9;
      s.hurt(100);
      taken += hp - s.hp;
    }

    // 필드의 「방어 칸」이 도적에게 무엇으로 나오는지.
    const kinds = new Set();
    for (let i = 0; i < 400; i++) kinds.add(pickKind(150, 0, s.job.usesArmor));

    return {
      before, after: s.armor,
      perHit: taken / 200,
      usesArmor: s.job.usesArmor,
      hasDodgeSlot: kinds.has(SLOT.DODGE),
      hasArmorSlot: kinds.has(SLOT.ARMOR),
    };
  });
  check(leather.before > 0, '도적도 가죽을 두르고 시작함', leather.before + '%');
  check(leather.after === leather.before, '가죽은 닳지 않음 (갈아 낼 만큼 두껍지 않으니)',
    `${leather.before}% → ${leather.after}%`);
  check(Math.abs(leather.perHit - 100 * (1 - leather.before / 100)) < 1,
    '가죽만큼 덜 맞음', `100 중 ${leather.perHit.toFixed(0)}`);
  check(!leather.usesArmor && leather.hasDodgeSlot && !leather.hasArmorSlot,
    '가죽을 둘러도 필드에서는 여전히 회피가 나옴 (방어구가 아니라)',
    leather.hasDodgeSlot ? '회피 나옴 · 방어구 안 나옴' : '회피가 안 나옵니다');

  await rogue.close();

  console.log(bad ? `\n${bad}건 어긋남` : '\n공격 성격 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
