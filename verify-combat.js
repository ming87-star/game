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
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
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
    const missing = [];
    ['warrior', 'archer', 'rogue'].forEach((j) => {
      for (let t = 0; t < 12; t++) if (!SHEET_ART['sheet-w-' + j + '-' + t]) missing.push(j + t);
    });

    // **시트 이름이 무기 아이콘 이름을 덮으면 안 됩니다.**
    // weaponIconKey(job, tier) 는 'w-warrior-0' 을 내놓고, buildWeaponIcons 는
    // "이미 있는 키는 건너뛴다"입니다. 시트를 같은 이름으로 올렸더니 무기
    // 아이콘이 아예 안 만들어지고, 발판 위 UP 칸과 HUD 에 주인공이 통째로
    // 30×30 으로 찌그러져 들어앉았습니다. 이름이 겹치는지 여기서 봅니다.
    const clash = [];
    CLASSES.forEach((job) => job.weapons.forEach((w, t) => {
      const k = weaponIconKey(job.key, t);
      if (SHEET_ART[k]) clash.push(k);
      // 무기 아이콘은 **한 칸짜리**여야 합니다. 여러 칸이면 시트가 앉은 것입니다.
      const tex = s.textures.get(k);
      if (tex && tex.frameTotal > 2) clash.push(k + '(칸 ' + (tex.frameTotal - 1) + ')');
    }));

    return {
      walk: walk(BEATS.sword),
      pace,
      cut: rig.cut,
      key: rig.key,
      onScreen: +(rig.scale * rig.data.hero).toFixed(1),
      sheets: Object.keys(SHEET_ART).length,
      missing,
      clash,
      // 발판 위 UP 칸이 쓰는 그림. 무기 아이콘의 실제 크기입니다.
      iconSize: (() => {
        const im = s.textures.get(weaponIconKey(s.job.key, 0)).getSourceImage();
        return im.width + '×' + im.height;
      })(),
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

  check(motion.cut && motion.key === 'sheet-w-warrior-0',
    '주인공이 그 무기의 시트로 서 있음', motion.key);

  check(!motion.clash.length,
    '시트 이름이 무기 아이콘 이름을 안 덮음 (발판 위 UP 칸이 무기로 보임)',
    motion.clash.length ? '겹침: ' + motion.clash.join(' ') : '무기 아이콘 ' + motion.iconSize);

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

  // ── 먼 그림자 검 ───────────────────────────────────────
  // 멀리 닿는 대신 끝이 무딥니다. 그리고 늘어난 팔이 아래층까지 내려가지
  // 않아야 합니다 — 궁수와 같은 규칙(CFG.aimBelow)입니다.
  const farblade = await warrior.evaluate(() => {
    const s = window.__scene;
    const clear = () => s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const put = (dx, dy) => {
      const e = spawnEnemy(s, s.player.x + dx, s.player.y + dy, s.floorIndex, 'crawler');
      if (e) {
        e.hp = e.maxHp = 1e9;
        e.body.setAllowGravity(false); e.body.velocity.set(0, 0);
        e.__x = e.x; e.__y = e.y;      // 자리를 적어 둡니다 (되돌려 가며 여러 번 잽니다)
      }
      return e;
    };
    // 한 번 휘둘러 이 놈이 얼마나 깎이는가. 주사위를 멈춰 뒀으므로 몇 번을
    // 재도 같은 값이 나옵니다 — 잰 뒤 자리만 되돌려 주면 됩니다.
    const hitFor = (e, n = 8) => {
      const before = e.hp;
      for (let i = 0; i < n; i++) {
        e.x = e.__x; e.y = e.__y;      // 자리를 되돌립니다
        s.lastSwingAt = -1e9;
        s.swing(s.time.now + 99999);
      }
      return (before - e.hp) / n;
    };

    // ── 주사위를 잠시 멈춥니다 ─────────────────────────
    // 여기서 재려는 것은 **거리에 따른 감쇠** 하나입니다. 공격력은 범위이고
    // 정확도는 확률이라, 그대로 두면 60번을 재도 ±17%가 흔들려서 감쇠가
    // 있는지 없는지를 못 가립니다 (실제로 그래서 한 번 틀렸습니다).
    // 굴리는 것과 빗나가는 것은 따로 검사하므로 여기서는 고정합니다.
    //
    // **재고 나서 반드시 되돌립니다.** 무기 인스턴스에 직접 씌우는 것이라
    // 안 걷어내면 그 뒤의 검사들이 전부 "안 빗나가고 늘 같은 값"인 무기를
    // 재게 됩니다 (한 번 그렇게 물렸습니다).
    const realRoll = s.weapon.rollDamage;
    const realHits = s.weapon.hits;
    s.weapon.rollDamage = function () { return this.dmg; };
    s.weapon.hits = () => true;
    const undoStub = () => { s.weapon.rollDamage = realRoll; s.weapon.hits = realHits; };

    const relic = RELICS.find((r) => r.key === 'farblade');
    // **가장 긴 자루**로 올려 놓고 잽니다. 첫 검은 사거리가 100 이라 1.5배를
    // 해도 150 — 한 층(165)에 못 미쳐서 "아래를 안 친다"를 시험할 수가 없습니다.
    // 아래층까지 팔이 닿는 것은 긴 무기에 유물을 얹었을 때뿐입니다.
    //
    // 예전에는 주머니의 **마지막 칸**을 썼습니다. 그때는 그것이 가장 긴
    // 자루였지만, 무명(無名)이 맨 끝에 붙으면서 아니게 됐습니다 — 사거리 96 인
    // 자루로 재고 있었으니 유물을 얹어도 한 층에 못 닿아, 이 검사가 조용히
    // 아무것도 안 재고 있었습니다. 이름표가 아니라 **값으로** 고릅니다.
    s.weapon.index = s.weapon.table.reduce(
      (a, b) => ((b.reach || b.range || 0) > (a.reach || a.range || 0) ? b : a)).index;
    const baseReach = s.weapon.reach;

    // 유물 없이: 거리와 상관없이 온전히 들어가야 합니다.
    clear();
    const near0 = put(10, 0);
    const plainNear = hitFor(near0);
    clear();
    const far0 = put(Math.round(baseReach * 0.95), 0);
    const plainFar = hitFor(far0);

    // 유물을 들고: 사거리가 늘고, 먼 쪽이 확 무뎌집니다.
    s.weapon.takeRelic(relic);
    const longReach = s.weapon.reach;
    clear();
    const near1 = put(10, 0);
    const relicNear = hitFor(near1);
    clear();
    const far1 = put(Math.round(longReach * 0.97), 0);
    const relicFar = hitFor(far1);

    // 한 층 아래의 적. 늘어난 사거리 안이지만 쳐서는 안 됩니다.
    clear();
    const below = put(0, CFG.floorHeight);
    const reachesBelow = s.meleeDist(below) <= longReach;
    const hitBelow = hitFor(below, 10);
    clear();
    s.weapon.relics = s.weapon.relics.filter((r) => r.key !== 'farblade');
    undoStub();

    return { baseReach, longReach, plainNear, plainFar, relicNear, relicFar,
      reachesBelow, hitBelow, floorGap: CFG.floorHeight, falloff: relic.falloff };
  });
  check(farblade.longReach > farblade.baseReach, '먼 그림자 검은 사거리를 늘림',
    `${Math.round(farblade.baseReach)} → ${Math.round(farblade.longReach)}`);
  check(Math.abs(farblade.plainFar / farblade.plainNear - 1) < 0.12,
    '유물이 없으면 거리와 상관없이 온전히 들어감',
    `코앞 ${farblade.plainNear.toFixed(1)} · 끝 ${farblade.plainFar.toFixed(1)}`);
  check(farblade.relicNear / farblade.plainNear > 0.85,
    '유물을 들어도 코앞은 거의 그대로',
    `${farblade.relicNear.toFixed(1)} / ${farblade.plainNear.toFixed(1)} = `
    + (farblade.relicNear / farblade.plainNear).toFixed(2));
  check(farblade.relicFar > 0 && farblade.relicFar / farblade.relicNear < farblade.falloff * 1.8,
    '사거리 끝에서는 1할 언저리만 들어감',
    `${farblade.relicFar.toFixed(1)} / ${farblade.relicNear.toFixed(1)} = `
    + (farblade.relicFar / farblade.relicNear).toFixed(2));
  check(farblade.reachesBelow && farblade.hitBelow === 0,
    '늘어난 사거리 안이라도 아래층은 안 침',
    `한 층 아래(${farblade.floorGap}) < 사거리 ${Math.round(farblade.longReach)}, 그래도 0`);

  // ── 흡혈 망토 ──────────────────────────────────────────
  // 준 피해에 비례하되, 한 대에 채우는 양에는 뚜껑이 있습니다.
  // 뚜껑이 없으면 위층에서 한 방이 곧 완전 회복이 됩니다.
  const leech = await warrior.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    s.weapon.takeRelic(RELICS.find((r) => r.key === 'bloodcloak'));

    const bite = (dmg) => {
      const e = spawnEnemy(s, s.player.x + 400, s.player.y, s.floorIndex, 'crawler');
      e.hp = e.maxHp = 1e9;
      s.hp = 1;
      s.hitEnemy(e, dmg);
      e.destroy();
      return s.hp - 1;
    };

    s.maxHp = 1000;
    const small = bite(400);   // 뚜껑(3%=30) 아래: 400 × 2.5% = 10
    const huge = bite(900000); // 뚜껑을 훌쩍 넘는 한 방
    s.weapon.relics = s.weapon.relics.filter((r) => r.key !== 'bloodcloak');
    s.hp = s.maxHp;
    return { small, huge, cap: Math.round(1000 * CFG.lifestealCap) };
  });
  check(leech.small > 0 && leech.small < leech.cap, '작은 한 대는 비율대로 회복',
    `${leech.small} (뚜껑 ${leech.cap})`);
  check(leech.huge === leech.cap, '아무리 크게 때려도 한 대에 뚜껑까지만',
    `${leech.huge} = ${leech.cap}`);

  // ── 공격력 범위와 정확도 ────────────────────────────────
  // 무기 개편의 뼈대입니다. 한 값이 아니라 범위이고, 빗나가는 일이 있습니다.
  const roll = await warrior.evaluate(() => {
    const s = window.__scene;
    const w = s.weapon;
    w.index = 0; w.plus = 0;

    // 범위: 굴린 값이 dmgMin~dmgMax 안에 있고, 양 끝이 실제로 나오는가.
    const d = [];
    for (let i = 0; i < 4000; i++) d.push(w.rollDamage());
    const lo = Math.min(...d), hi = Math.max(...d);

    // 정확도: 설정한 만큼 빗나가는가.
    let miss = 0;
    for (let i = 0; i < 8000; i++) if (!w.hits()) miss++;

    // 강화(`+1`)는 범위 **전체**를 밀어 올려야 합니다. 아래쪽만 올리면
    // "최소 공격력"이 곧 실제 공격력이 되어 범위라는 것이 뜻을 잃습니다.
    const bare = [w.dmgMin, w.dmgMax];
    w.plus = 5;
    const boosted = [w.dmgMin, w.dmgMax];
    w.plus = 0;

    // 만듦새마다 성격이 다른가 — 은장은 고르고 흑철은 들쭉날쭉해야 합니다.
    const pool = w.table;
    const width = (k) => {
      const e = pool.find((x) => x.forge === k);
      return e ? (e.dmgMax - e.dmgMin) / ((e.dmgMax + e.dmgMin) / 2) : null;
    };
    const accOf = (k) => {
      const e = pool.find((x) => x.forge === k);
      return e ? e.acc : null;
    };

    return {
      lo, hi, want: [w.dmgMin, w.dmgMax], missPct: miss / 8000, acc: w.accuracy,
      bare, boosted,
      silverWidth: width('silver'), blackWidth: width('black'),
      silverAcc: accOf('silver'), blackAcc: accOf('black'), plainAcc: accOf('plain'),
      pool: pool.length,
    };
  });
  check(roll.lo >= roll.want[0] && roll.hi <= roll.want[1],
    '공격력은 정해진 범위 안에서만 굴림',
    `굴린 값 ${roll.lo}~${roll.hi} · 설정 ${roll.want[0]}~${roll.want[1]}`);
  check(roll.lo === roll.want[0] && roll.hi === roll.want[1],
    '범위의 양 끝이 실제로 나옴 (한가운데만 나오지 않음)');
  check(Math.abs(roll.missPct - (1 - roll.acc)) < 0.02,
    '정확도만큼 빗나감', `설정 ${Math.round(roll.acc * 100)}% · 실제 ${(100 - roll.missPct * 100).toFixed(1)}%`);
  check(roll.boosted[0] > roll.bare[0] && roll.boosted[1] > roll.bare[1] &&
    Math.abs((roll.boosted[0] / roll.bare[0]) - (roll.boosted[1] / roll.bare[1])) < 0.02,
    '강화는 범위의 위아래를 같은 비율로 밀어 올림',
    `${roll.bare.join('~')} → ${roll.boosted.join('~')}`);
  check(roll.pool === 25, '주머니에 자루가 스물다섯 (열둘 × 만듦새 둘 + 무명)', roll.pool + '자루');
  check(roll.silverWidth < roll.blackWidth,
    '은장은 한 대가 고르고 흑철은 들쭉날쭉',
    `은장 ±${(roll.silverWidth * 50).toFixed(0)}% · 흑철 ±${(roll.blackWidth * 50).toFixed(0)}%`);
  check(roll.silverAcc > roll.plainAcc && roll.blackAcc < roll.plainAcc,
    '은장은 잘 맞고 흑철은 잘 빗나감',
    `은장 ${Math.round(roll.silverAcc * 100)}% · 원본 ${Math.round(roll.plainAcc * 100)}%`
    + ` · 흑철 ${Math.round(roll.blackAcc * 100)}%`);

  // ── 만듦새는 초당 피해로 전부 같아야 합니다 ─────────────
  //
  // **이 검사가 만듦새 규칙의 파수꾼입니다.** forge.js 주석에 "수치는 서로
  // 맞바꾼다"고 적어 놓고도 처음에 못 지켰습니다 — 은장 +4.6% · 무쇠 +3.7% ·
  // 흑철 +1.1%. 한쪽이 초당 피해로 더 세면 그건 만듦새가 아니라 그냥 상위
  // 무기이고, 그러면 무기를 주머니로 바꾼 뜻이 없어집니다.
  //
  // 수치를 만질 때마다 조용히 새는 자리라, 셈으로 못을 박아 둡니다.
  const forges = await warrior.evaluate(() => {
    const rows = [];
    CLASSES.forEach((job) => {
      const pool = buildWeaponPool(job);
      const w = new Weapon(job, 0);
      pool.filter((x) => x.forge !== 'plain').forEach((x) => {
        const base = pool.find((b) => b.family === x.family && b.forge === 'plain');
        rows.push({ job: job.name, forge: x.forge, name: x.name,
          d: w.dpsOf(x, false) / w.dpsOf(base, false) - 1 });
      });
    });

    const byForge = {};
    rows.forEach((r) => (byForge[r.forge] = byForge[r.forge] || []).push(r.d));
    const avg = {};
    Object.keys(byForge).forEach((k) => {
      avg[k] = byForge[k].reduce((a, b) => a + b, 0) / byForge[k].length;
    });

    // 정확도 천장(1.00)에 잘린 자루가 있으면 그 자루만 조용히 손해입니다 —
    // 값은 치렀는데 덤을 다 못 받으니까요.
    const clamped = [];
    CLASSES.forEach((job) => buildWeaponPool(job).forEach((x) => {
      const f = FORGES[x.forge];
      if (!f.acc) return;
      const fam = job.weapons.find((y) => y.key === x.family);
      const raw = (fam.acc === undefined ? 0.92 : fam.acc) + f.acc;
      if (raw > 1.0001) clamped.push(x.name + ' ' + raw.toFixed(2));
    }));

    const worst = rows.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
    return { avg, clamped, worst, n: rows.length,
      forges: Object.keys(byForge).map((k) => FORGES[k].prefix) };
  });
  const off = Object.entries(forges.avg).filter(([, v]) => Math.abs(v) > 0.01);
  check(off.length === 0, '만듦새 넷이 초당 피해로 같음 (평균 ±1% 안)',
    Object.entries(forges.avg).map(([k, v]) =>
      (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%').join(' · ')
    + ' — ' + forges.forges.join(' · '));
  // 낱낱은 정수 반올림 때문에 조금 더 흔들립니다. 궁수는 화살 한 발이
  // 16~53 이라 1이 어긋나면 그게 곧 2~6%입니다.
  check(Math.abs(forges.worst.d) <= 0.03, '자루 하나하나도 ±3% 안 (반올림 몫)',
    forges.worst.name + ' ' + (forges.worst.d >= 0 ? '+' : '')
    + (forges.worst.d * 100).toFixed(1) + '% · ' + forges.n + '자루 중');
  check(forges.clamped.length === 0,
    '정확도 천장에 잘리는 자루가 없음 (값만 치르고 덤을 못 받는 자리)',
    forges.clamped.join(', ') || '없음');

  // ── 전사의 기절 ─────────────────────────────────────────
  const stun = await warrior.evaluate(async () => {
    const s = window.__scene;
    s.weapon.index = 0; s.weapon.plus = 0;
    // 여기서 볼 것은 멎느냐이지 얼마나 깎였느냐가 아닙니다.
    // 빗나가면 안 걸리므로(그게 맞습니다) 재는 동안만 주사위를 멈춥니다.
    const realRoll = s.weapon.rollDamage;
    const realHits = s.weapon.hits;
    s.weapon.rollDamage = function () { return this.dmg; };
    s.weapon.hits = () => true;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());

    const put = (dx) => {
      const e = spawnEnemy(s, s.player.x + dx, s.player.y, s.floorIndex, 'crawler');
      e.hp = e.maxHp = 1e9;
      e.body.setAllowGravity(false); e.body.velocity.set(0, 0);
      return e;
    };

    const e = put(12);
    const x0 = e.x;
    s.lastSwingAt = -1e9;
    s.swing(s.time.now + 99999);
    const now = s.time.now;

    // **자리는 그대로여야 합니다.** 밀어내면 좁은 발판에서 떨어집니다 —
    // 그게 밀어내기를 걷어낸 까닭입니다.
    const moved = Math.abs(e.x - x0);
    const stunned = e.stunUntil > now;
    const leaning = Math.abs(e.angle) > 1; // 멎었다는 표

    // 멎은 동안에는 걷지 않습니다.
    groundStep(s, e, s.player, now + 10);
    const frozen = e.body.velocity.x === 0;

    // **회복 시간이 없으면 스턴이 아니라 전원 스위치입니다.**
    // 공격 주기(215~315ms)가 스턴(480ms)보다 짧아서, 때릴 때마다 다시
    // 걸면 사거리 안의 적은 영영 안 깨어납니다. 스턴이 풀린 직후에
    // 곧바로 다시 걸리는지 봅니다 — 걸리면 안 됩니다.
    const okAt = e.stunOkAt;
    const justAfter = e.stunUntil + 20;
    s.time.now = justAfter;               // 스턴이 막 풀린 시점
    s.lastSwingAt = -1e9;
    s.swing(justAfter + 99999);
    const reStunnedTooSoon = e.stunUntil > justAfter;

    // 회복 시간이 지난 뒤에는 다시 걸려야 합니다.
    const later = okAt + 20;
    s.time.now = later;
    s.lastSwingAt = -1e9;
    s.swing(later + 99999);
    const reStunnedLater = e.stunUntil > later;

    // 열 번을 연달아 쳐도 계속 맞아야 합니다 (자리를 안 옮기니 당연하지만,
    // 여기가 밀어내기 시절에 깨지던 자리라 그대로 지킵니다).
    let landed = 0;
    for (let i = 0; i < 10; i++) {
      const hp = e.hp;
      s.lastSwingAt = -1e9;
      s.swing(s.time.now + 99999);
      if (e.hp < hp) landed++;
    }
    e.destroy();

    // 보스는 안 걸립니다. 얼려 두고 때리면 보스전이 성립하지 않습니다.
    const bossStunned = (() => {
      const b = { active: true, isBoss: true, body: { velocity: { x: 0 } } };
      s.stunEnemy(b);
      return !!b.stunUntil;
    })();

    // 궁수·도적은 아예 안 겁니다 — 전사만의 것입니다.
    const rogueHas = !!classByKey('rogue').stun;
    const archerHas = !!classByKey('archer').stun;

    s.weapon.rollDamage = realRoll;
    s.weapon.hits = realHits;
    return { moved, stunned, leaning, frozen, reStunnedTooSoon, reStunnedLater,
      landed, bossStunned, rogueHas, archerHas,
      ms: CFG.stun.ms, recover: CFG.stun.recoverMs };
  });
  check(stun.stunned, '전사가 휘두르면 적이 기절함', stun.ms + 'ms');
  check(stun.moved < 1, '**자리는 그대로** — 밀지 않으니 발판에서 안 떨어짐',
    Math.round(stun.moved) + 'px 움직임');
  check(stun.leaning, '멎었다는 것이 보임 (몸이 기움)');
  check(stun.frozen, '기절한 동안에는 다가오지 않음 (버는 시간)');
  check(!stun.reStunnedTooSoon, '풀리자마자 다시 안 걸림 (전원 스위치가 되지 않게)',
    '회복 ' + stun.recover + 'ms');
  check(stun.reStunnedLater, '회복 시간이 지나면 다시 걸림');
  check(stun.landed === 10, '연달아 쳐도 계속 맞음', '열 번 중 ' + stun.landed + '번');
  check(!stun.bossStunned, '보스는 안 걸림');
  check(!stun.rogueHas && !stun.archerHas, '전사만의 것 (궁수·도적은 안 걺)');

  // ── 한 층에 도는 몬스터는 넷까지 ────────────────────────
  // 새 종류가 하나 풀리면 가장 먼저 나왔던 하나가 물러납니다.
  const kinds = await warrior.evaluate(() => {
    let worst = 0;
    let worstAt = 0;
    const at = (f) => CFG.enemyTypes.filter((t) => typeWeight(t, f) > 0).map((t) => t.key);
    for (let f = 0; f <= 1200; f++) {
      const n = at(f).length;
      if (n > worst) { worst = n; worstAt = f; }
    }
    // 실제로 뽑아 봐도 넷을 넘지 않아야 합니다 (typeWeight 만 맞고 뽑기가
    // 새는 경우를 잡습니다 — 예전 pickEnemyType 의 마지막 줄이 그랬습니다).
    const drawn = new Set();
    for (let i = 0; i < 6000; i++) drawn.add(pickEnemyType(600));
    // 첫 층의 코인벌레는 한참 위에서는 사라져야 합니다.
    const early = at(0).includes('coinbug');
    const late = at(600).includes('coinbug');
    return { worst, worstAt, drawn: [...drawn], early, late, at600: at(600),
      max: CFG.enemyWave.maxKinds };
  });
  check(kinds.worst <= kinds.max, '어느 층에서도 종류가 넷을 안 넘음',
    `가장 많은 곳이 ${kinds.worstAt}층의 ${kinds.worst}종`);
  check(kinds.drawn.length <= kinds.max,
    '실제로 뽑아 봐도 넷까지', `600층에서 ${kinds.drawn.length}종: ${kinds.at600.join(',')}`);
  check(kinds.early && !kinds.late, '초반 몬스터는 후반에 안 나옴',
    `코인벌레 0층 ${kinds.early ? '있음' : '없음'} · 600층 ${kinds.late ? '있음' : '없음'}`);

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
      // **제자리에 못 박습니다.** 날것은 주인공에게 곧장 다가오는데, 그러면
      // 재는 사이에 주인공 위로 올라타 버립니다. 그 자리에서 쏜 화살은 나가자마자
      // 그놈에게 맞아 사라지고, 세는 쪽은 "안 쐈다"로 읽습니다 —
      // 스무 번에 세 번쯤 그렇게 어긋났습니다. 재려는 것은 **어느 높이를
      // 겨누는가**이지 다가오는 속도가 아니므로, 움직임을 아예 끕니다.
      e.body.moves = false;
      e.hp = 1e9;
      return e;
    };
    const below = put(200);   // 한 층 아래
    const sameFloor = put(18); // 같은 발판 — 발이 땅에 붙어 조금 아래
    const above = put(-150);  // 위층

    // 여기서 재려는 것은 **어느 높이를 겨누는가**입니다. 그러니 겨눈 것을
    // 그대로 봅니다 (s.subTarget) — shoot 이 정하는 그 값입니다.
    //
    // 예전에는 화살이 실제로 나올 때까지 25ms 씩 스무 번 지켜봤는데,
    // 여덟 번에 두 번쯤 어긋났습니다. 까닭이 둘이었습니다 —
    //   · 이 검사는 창을 셋 띄워 놓고 돌아서, 기계가 바쁘면 500ms 동안
    //     게임 루프가 몇 프레임밖에 안 돕니다. 화살은 시위를 다 당긴 뒤에야
    //     나오므로 그 안에 못 나옵니다
    //   · 날것이 주인공 위로 올라타면, 나간 화살이 그 자리에서 맞고 사라져
    //     세는 쪽이 "안 나왔다"로 읽습니다 (그래서 위에서 못 박아 뒀습니다)
    // 겨눈 것을 보면 시계에 기대지 않아 매번 같은 답이 나옵니다.
    const aimsAt = (e) => {
      s.enemies.getChildren().forEach((x) => x.setActive(x === e).setVisible(x === e));
      s.subTarget = null;
      s.lastSubAt = -1e9;
      s.shoot(s.time.now);
      const got = s.subTarget === e;
      s.enemies.getChildren().forEach((x) => x.setActive(true).setVisible(true));
      return got;
    };

    // 겨누는 것과 별개로, 화살이 **실제로 나오기는 하는지**도 한 번은 봐야
    // 합니다. 겨누기만 하고 안 나가면 위 검사는 전부 통과해 버립니다.
    //
    // **여기서는 빗나가면 안 됩니다.** 빗나간 화살은 아예 안 만들어지므로
    // (js/scene-game.js 의 shoot), 한 번만 쏘고 기다리면 정확도 92% 짜리
    // 무기로는 열두 번에 한 번쯤 "안 나갔다"가 나옵니다 — 실제로 그렇게
    // 한 번 터졌습니다. 빗나감은 따로 검사하므로 여기서만 주사위를 멈춥니다.
    const realHits = s.weapon.hits;
    s.weapon.hits = () => true;
    s.enemies.getChildren().forEach((x) => x.setActive(x === above).setVisible(x === above));
    s.subTarget = null;
    s.lastSubAt = -1e9;
    s.bullets.clear(true, true);
    s.shoot(s.time.now);
    let shots = 0;
    for (let k = 0; k < 80 && !shots; k++) {
      await new Promise((r) => setTimeout(r, 25));
      shots = s.bullets.getChildren().filter((b) => b.active).length;
    }
    s.enemies.getChildren().forEach((x) => x.setActive(true).setVisible(true));
    s.weapon.hits = realHits;

    return {
      below: aimsAt(below), same: aimsAt(sameFloor),
      above: aimsAt(above), tol: CFG.aimBelow, shots,
    };
  });
  check(aim.shots > 0, '겨눈 뒤에 화살이 실제로 나감', aim.shots + '발');
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

  // ── 맞았을 때의 깜빡임이 쌓이지 않는가 ─────────────────
  // 주인공이 **판이 갈수록 반투명해지는** 버그가 있었습니다. 깜빡임 트윈은
  // 시작할 때의 알파를 기억했다가 yoyo 로 거기까지 돌아옵니다. 그래서 깜빡이는
  // 도중에 또 맞으면 새 트윈이 지금의 흐릿한 값을 시작값으로 잡고, 1로는
  // 영영 안 돌아옵니다. 한 대마다 조금씩 더 투명해진 채로 굳었습니다.
  //   1 → 0.79 → 0.59 → 0.50 → 0.42 …
  //
  // 무적(1100ms)이 깜빡임(720ms)보다 길어 보통은 안 겹치는데, **함정이
  // 무적을 무시합니다.** 함정은 101층부터 늘어나니 오를수록 흐려졌습니다.
  //
  // **시계로 재지 않습니다.** 이 검사는 창을 셋 띄워 놓고 도는데, 뒤에 있는
  // 창은 브라우저가 프레임을 죄어서 1400ms 를 기다려도 게임 안에서는 몇
  // 프레임밖에 안 흐릅니다. 트윈이 안 끝나 있는 것을 "안 돌아왔다"로 읽으면
  // 없는 버그를 잡게 됩니다 (실제로 그렇게 헛돌았습니다).
  // 대신 **굳지 않게 하는 성질 자체**를 봅니다 — 시계가 필요 없습니다.
  const flash = await rogue.evaluate(async () => {
    const s = window.__scene;
    s.maxHp = 1e9; s.hp = 1e9;
    s.dead = false; s.swallowing = false;
    s.player.setAlpha(1);
    // **회피를 꺼야 합니다.** 흘려 넘긴 대는 hurt 가 곧장 물러나서 깜빡임이
    // 아예 안 생깁니다 (도적은 절반 넘게 흘립니다). 그걸 "1에서 안 시작했다"로
    // 읽으면 없는 버그를 잡습니다 — 실제로 열 번 중 일곱 번이 그랬습니다.
    s.dodge = 0;

    const starts = [];
    let most = 0;
    for (let i = 0; i < 10; i++) {
      s.springTrap(5, '시험');           // 함정은 무적을 무시합니다
      // 막 시작한 깜빡임이 **1에서 출발**해야 합니다. 흐릿한 값에서 출발하면
      // 거기로 되돌아가고, 그것이 굳음의 정체입니다.
      starts.push(+s.hurtFlash.a.toFixed(3));
      most = Math.max(most, s.tweens.getTweensOf(s.hurtFlash).length);
      await new Promise((r) => setTimeout(r, 80)); // 깜빡임(720ms)이 끝나기 전에 또
    }

    // 걷어내면 알파가 되돌아와야 합니다.
    s.clearHurtFlash();
    const cleared = +s.player.alpha.toFixed(3);

    // 깜빡임은 주인공 몸이 아니라 그릇에 걸려야 합니다. 몸에 걸면 앞선 것을
    // 걷어낼 길이 killTweensOf(player) 뿐인데, 그러면 도적이 뛰며 도는 회전과
    // 투기장의 좌우 이동까지 같이 죽습니다.
    const onPlayer = s.tweens.getTweensOf(s.player).length;

    // 그래서 실제로 안 죽는지도 봅니다.
    s.player.setRotation(0);
    const spin = s.tweens.add({ targets: s.player, rotation: Math.PI, duration: 4000 });
    s.springTrap(5, '시험');
    const spinAlive = s.tweens.getTweensOf(s.player).includes(spin);
    spin.stop(); s.player.setRotation(0);
    s.clearHurtFlash();

    return { starts, most, cleared, spinAlive, onPlayer };
  });
  check(flash.starts.every((a) => a === 1),
    '깜빡임은 언제나 알파 1에서 시작함 (흐릿한 값에서 출발하지 않음)',
    '열 번 중 1이 아닌 것 ' + flash.starts.filter((a) => a !== 1).length + '개');
  check(flash.most === 1, '깜빡임 트윈이 겹쳐 쌓이지 않음', '가장 많을 때 ' + flash.most + '개');
  check(flash.cleared === 1, '걷어내면 알파가 1로 돌아옴', flash.cleared);
  check(flash.spinAlive, '깜빡임이 다른 트윈(회전·이동)을 안 죽임');
  check(flash.onPlayer === 0, '주인공 몸에는 깜빡임 트윈이 안 걸림 (그릇을 따로 흔듭니다)',
    flash.onPlayer + '개');

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

  // 손으로 적으면 CFG 를 만질 때마다 여기가 같이 틀립니다.
  const CFG_PLUS_MAX = 10;

  // ── 공격력 강화의 한계 ─────────────────────────────────
  //
  // 한계가 없던 시절에는 「한 자루를 오래 들고 다니며 계속 벼리기」가 늘
  // 옳았습니다. 갈아타면 강화가 날아가니까요 — 그래서 갈아타기 창이
  // 물어보는 것이 사실은 물어보는 것이 아니었습니다.
  const cap = await boot(browser, port, 0);

  const limits = await cap.evaluate(() => {
    const s = window.__scene;
    const w = s.weapon;
    const out = {};

    // 보통 자루 — 열에서 멎습니다. addPlus 는 붙었으면 true, 한계면 false.
    w.index = 0; w.plus = 0;
    let took = 0;
    for (let i = 0; i < 20; i++) if (w.addPlus()) took++;
    out.plain = { took, plus: w.plus, max: w.plusMax, capped: w.plusCapped };

    // 무명(無名) — 서른까지.
    const nameless = w.table.find((x) => x.family === 'nameless');
    out.hasNameless = !!nameless;
    if (!nameless) return out;
    w.index = nameless.index; w.plus = 0;
    took = 0;
    for (let i = 0; i < 40; i++) if (w.addPlus()) took++;
    out.nameless = { name: w.name, took, plus: w.plus, max: w.plusMax };

    // 곡선 — **맨몸이 가장 약하고, +25 에서 최강(+10 한계)을 앞지릅니다.**
    const best = w.table.reduce((x, y) => (w.dpsOf(y, false) > w.dpsOf(x, false) ? y : x));
    w.index = best.index; w.plus = CFG.plusMax;
    const ceiling = w.dps;
    w.index = nameless.index;
    const at = (n) => { w.plus = n; return w.dps; };
    out.curve = {
      best: best.name, ceiling: Math.round(ceiling),
      // 주머니에서 맨몸이 가장 약한가
      weakest: w.table.every((x) => w.dpsOf(x, false) >= w.dpsOf(nameless, false)),
      p10: Math.round(at(10) / ceiling * 100),
      p24: Math.round(at(24) / ceiling * 100),
      p25: Math.round(at(25) / ceiling * 100),
      p30: Math.round(at(30) / ceiling * 100),
    };

    // 보물상자 — 한계에 닿으면 공격력이 후보에서 빠집니다. 화면을 가득 채우는
    // 이펙트를 터뜨려 놓고 아무 일도 안 일어나면 그건 보상이 아니라 놀림입니다.
    w.index = 0;
    const roll = (n) => {
      const seen = new Set();
      for (let i = 0; i < 400; i++) seen.add(rollChestLoot(s));
      return seen;
    };
    w.plus = 0;
    out.chestFree = roll().has('plus');
    w.plus = CFG.plusMax;
    out.chestCapped = roll().has('plus');

    // 상점의 힘 셈 — 한계를 넘겨서 세면 추천 표가 헛것을 가리킵니다.
    out.gainCapped = powerAfter(s, 'plus') / powerNow(s) - 1;
    w.plus = CFG.plusMax - 1;
    out.gainOne = powerAfter(s, 'plus') / powerNow(s) - 1;
    w.plus = 0;
    out.gainFull = powerAfter(s, 'plus') / powerNow(s) - 1;
    return out;
  });

  check(limits.plain.took === limits.plain.max && limits.plain.capped,
    '보통 자루는 +' + limits.plain.max + '에서 멎음',
    limits.plain.took + '개 붙고 멈춤');
  check(limits.hasNameless, '주머니에 무명(無名)이 있음');
  check(limits.nameless && limits.nameless.took === 30 && limits.nameless.max === 30,
    '무명은 +30까지 받음',
    limits.nameless && limits.nameless.name + ' → +' + limits.nameless.plus);
  check(limits.curve.weakest, '무명은 맨몸이 주머니에서 가장 약함');
  check(limits.curve.p10 < 60, '+10 까지는 오히려 뒤처짐',
    '최강(+' + CFG_PLUS_MAX + ' 한계) 대비 ' + limits.curve.p10 + '%');
  // **여기가 이 자루의 전부입니다.** 스물넷에서는 아직 못 미치고 스물다섯에서
  // 넘어야 합니다 — 넘는 자리가 흐려지면 「인내」라는 성격이 사라집니다.
  check(limits.curve.p24 < 100 && limits.curve.p25 >= 100,
    '+25 에서 가장 강한 자루가 됨',
    '+24 ' + limits.curve.p24 + '% → +25 ' + limits.curve.p25 + '% (' + limits.curve.best + ' +'
      + CFG_PLUS_MAX + ' = ' + limits.curve.ceiling + ')');
  check(limits.curve.p30 > limits.curve.p25, '+30 에서 가장 높음', limits.curve.p30 + '%');

  check(limits.chestFree && !limits.chestCapped,
    '한계에 닿으면 보물상자가 공격력을 안 줌',
    '여유 ' + limits.chestFree + ' · 한계 ' + limits.chestCapped);
  check(Math.abs(limits.gainCapped) < 0.001,
    '한계에 닿으면 상점의 이득 셈도 0', Math.round(limits.gainCapped * 1000) / 10 + '%');
  check(limits.gainOne > 0 && limits.gainOne < limits.gainFull,
    '하나만 남았으면 뭉치(셋)를 사도 하나만 셈',
    Math.round(limits.gainOne * 1000) / 10 + '% < ' + Math.round(limits.gainFull * 1000) / 10 + '%');

  // 지도의 +1 — 한계면 망치도 안 내리칩니다.
  const pickup = await cap.evaluate(() => {
    const s = window.__scene;
    s.weapon.index = 0; s.weapon.plus = CFG.plusMax;
    const said = [];
    const real = s.popup.bind(s);
    s.popup = (t, c) => { said.push(t); return real(t, c); };
    let forged = 0;
    const realFx = s.forgeFx.bind(s);
    s.forgeFx = (...a) => { forged++; return realFx(...a); };
    const slot = { taken: false, expired: false, kind: SLOT.PLUS, x: s.player.x, y: s.player.y };
    s.land(slot);
    s.popup = real; s.forgeFx = realFx;
    return { said, forged, plus: s.weapon.plus };
  });
  check(pickup.said.some((t) => t.includes('한계')) && pickup.forged === 0,
    '한계에 닿으면 지도의 +1 도 그렇다고 적고 망치를 안 내리침',
    pickup.said.join(' / ') + ' · 망치 ' + pickup.forged + '번');

  await cap.close();

  console.log(bad ? `\n${bad}건 어긋남` : '\n공격 성격 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
