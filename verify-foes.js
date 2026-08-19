// ── 판을 바꾸는 넷이 진짜로 판을 바꾸는지 ────────────────────
//
// 미는 놈 · 내리찍는 놈 · 가르는 놈 · 전류를 뿜는 놈.
//
// 앞의 열넷은 「닿으면 아프다」 하나뿐이라 눈으로 봐도 다 보입니다. 이 넷은
// **규칙을 하나씩 새로 만듭니다** — 층을 잃고, 발판이 막히고, 서 있던 자리가
// 아프고, 제 옆이 오히려 안전합니다. 규칙은 눈으로 안 보이므로 재야 합니다.
//
// 재는 방법에 두 가지 함정이 있어서 짚어 둡니다.
//
//   1. **놈은 `slot.y - 50` 에 세웁니다.** -24 에 세우면 발판을 뚫고 아래층으로
//      떨어져서, 위층을 잰다고 해 놓고 아래층을 재게 됩니다.
//   2. **재는 동안 옆 놈들을 계속 치웁니다.** 가까운 층이 깨어나면서 준 피해가
//      그대로 섞여 들어와, 「제 층은 안전하다」가 안전하지 않은 것으로 나옵니다.
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

const LANES_N = 3;   // 줄 셋 (왼쪽·가운데·오른쪽)

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

(async () => {
  const port = Number(process.env.PORT) || 9612;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0,
    weapons: {}, boosts: {}, relics: {}, unlocked: {}, lastJob: 'warrior', sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });
  await page.waitForTimeout(900);

  // ── 0. 목록이 오름차순인가 ──────────────────────────────
  // typeSpan() 이 CFG.enemyTypes 를 **차례로** 훑어서 몇째 놈까지 풀렸는지
  // 셉니다. 넷을 끼워 넣다가 순서가 어긋나면 등장 층이 통째로 뒤틀립니다.
  const order = await page.evaluate(() => {
    const list = CFG.enemyTypes;
    const wrong = [];
    for (let i = 1; i < list.length; i++) {
      if (list[i].from < list[i - 1].from) wrong.push(list[i - 1].key + '→' + list[i].key);
    }
    return { wrong, four: ['shover', 'slammer', 'lancer', 'zapper'].map((k) => {
      const d = list.find((t) => t.key === k);
      return d ? { key: k, name: d.name, from: d.from } : { key: k, name: '(없음)' };
    }) };
  });
  check(order.wrong.length === 0, 'enemyTypes 가 등장 층 오름차순',
    order.wrong.length ? order.wrong.join(' · ') : list0(order.four));
  check(order.four.every((f) => f.name && f.name.endsWith('놈')),
    '넷 다 「…놈」으로 끝남 (특별한 짓을 하는 것들의 표시)',
    order.four.map((f) => f.name).join(' · '));
  check(order.four.map((f) => f.from).join() === '225,425,625,825',
    '보스 뒤 25층마다 하나씩', order.four.map((f) => f.from).join(' · '));

  // ── 0-2. 두 바퀴째에 넷이 다시 풀리는가 ─────────────────
  // 「한 층에 넷까지」 규칙에 밀려 미는 놈은 425층, 내리찍는 놈은 625층에서
  // 물러납니다. 두 번째 칸이 없으면 사나워진 판을 받을 놈이 둘뿐입니다.
  const again = await page.evaluate(() => {
    const live = (f) => CFG.enemyTypes
      .filter((t) => { const s = typeSpan(t); return f >= s.from && f < s.until; })
      .map((t) => t.name);
    const four = ['shover', 'slammer', 'lancer', 'zapper'];
    return {
      second: four.map((k) => CFG.enemyTypes.filter((t) => t.key === k).length),
      top: live(1900),
      mid: live(700),
      // 두 바퀴째의 값은 표에 안 적고 spawnEnemy 가 얹습니다. 같은 칸이어야 합니다.
      same: four.every((k) => {
        const [a, b] = CFG.enemyTypes.filter((t) => t.key === k);
        return b && a.hp === b.hp && a.dmg === b.dmg && a.move === b.move;
      }),
    };
  });
  check(again.second.every((n) => n === 2), '넷 다 목록에 두 번 (두 바퀴째 자리)',
    again.second.join(' · '));
  check(again.top.length === 4 && ['미는 놈', '내리찍는 놈', '가르는 놈', '전류를 뿜는 놈']
    .every((n) => again.top.indexOf(n) >= 0),
    '끝판(1900층)은 **넷만** 돕니다', again.top.join(' · '));
  check(again.same, '두 바퀴째 칸은 첫 칸과 같은 값 (세지는 것은 spawnEnemy 가 얹음)');

  // ── 0-2-2. 한 발판에 하나까지 ───────────────────────────
  // 이 넷은 하나하나가 판단을 요구합니다. 둘이 겹치면 곱해지는 것이 아니라
  // 아예 셀 수가 없어집니다. 층을 여럿 만들어 보고 **가장 많을 때**를 봅니다.
  const perSlot = await page.evaluate(() => {
    const cap = CFG.foes.perSlot;
    const out = [];
    [250, 650, 850, 1100, 1500, 1900].forEach((f) => {
      let most = 0, mostFloor = 0, slots = 0, want = 0, got = 0;
      for (let i = 0; i < 300; i++) {
        const floor = makeFloor(f + (i % 40));
        let inFloor = 0;
        LANES.forEach((l) => {
          const sl = floor.slots[l];
          if (!sl || sl.kind !== 'enemy') return;
          slots++; want += enemyCountFor(sl.index); got += sl.enemyTypes.length;
          const n = sl.enemyTypes.filter((k) => isFoeType(enemyDefOf(k))).length;
          most = Math.max(most, n);
          inFloor += n;
          // 「⚠ N」이 실제로 선 마릿수와 같아야 합니다
          if (sl.enemyCount !== sl.enemyTypes.length) most = 99;
        });
        mostFloor = Math.max(mostFloor, inFloor);
      }
      out.push({ f, most, mostFloor, cap,
        want: +(want / slots).toFixed(2), got: +(got / slots).toFixed(2) });
    });
    return out;
  });
  check(perSlot.every((r) => r.most <= r.cap),
    '한 발판에 판을 바꾸는 놈은 ' + perSlot[0].cap + '까지 (300층씩 여섯 자리)',
    perSlot.map((r) => r.f + '층 ' + r.most).join(' · '));
  check(perSlot.every((r) => r.mostFloor <= LANES_N * perSlot[0].cap),
    '한 층에는 줄마다 하나까지 — 넘어서는 일이 없음',
    perSlot.map((r) => r.f + '층 ' + r.mostFloor).join(' · '));
  console.log('      한 발판 마릿수 (뽑으려던 → 선): ' +
    perSlot.map((r) => r.f + '층 ' + r.want + '→' + r.got).join(' · '));

  // ── 0-3. 1000층을 넘으면 정말로 사나워지는가 ────────────
  const fierce = await page.evaluate(() => {
    const s = window.__scene;
    CFG.enemyTypes.forEach((t) => s.seenTypes.add(t.key));
    const make = (floor) => {
      s.floorIndex = floor;
      for (let i = floor - 3; i <= floor + 7; i++) s.addFloor(i);
      const f = s.floors.get(floor);
      const at = LANES.map((l) => f.slots[l]).find(Boolean);
      const e = spawnEnemy(s, at.x, at.y - 50, floor, 'shover');
      const out = { hp: e.maxHp, dmg: e.contactDamage, fierce: !!e.fierce, hits: e.hits };
      e.destroy();
      return out;
    };
    // **같은 층에서** 견줍니다. 300층과 1300층을 견주면 층에 따라 자라는 몫과
    // 한 마리 배수가 함께 섞여 들어와, 사나워진 몫만 따로 볼 수 없습니다
    // (그렇게 재 봤더니 1.5배여야 할 것이 6.92배로 나왔습니다).
    const was = CFG.foes.fierce.from;
    CFG.foes.fierce.from = 99999;      // 잠깐 꺼 둡니다
    const plain = make(1300);
    CFG.foes.fierce.from = was;
    const wild = make(1300);
    const low = make(300);
    return { plain, wild, low, want: CFG.foes.fierce, hits: CFG.foes.hits.shover };
  });
  const CFG_hits = fierce.hits;
  check(!fierce.low.fierce && fierce.wild.fierce, '1000층 아래는 그대로, 위는 사나운 판',
    '300층 보통 · 1300층 사나움');
  check(Math.abs(fierce.wild.dmg / fierce.plain.dmg - fierce.want.dmg) < 0.06,
    '두 바퀴째 피해가 정해진 배수 (같은 층에서 견줌)',
    (fierce.wild.dmg / fierce.plain.dmg).toFixed(2) + '배 / ' + fierce.want.dmg + '배');
  // 두 바퀴째의 체력은 **배수가 아니라 몇 번 더**입니다 — 네 번짜리가
  // 7.2번이 되면 세는 것이 뜻을 잃습니다. 미는 놈은 넷에서 여섯이 됩니다.
  const wantHits = CFG_hits + fierce.want.hits;
  check(fierce.wild.hits === wantHits && fierce.plain.hits === CFG_hits,
    '두 바퀴째는 **' + fierce.want.hits + '번 더** 때려야 함',
    fierce.plain.hits + '번 → ' + fierce.wild.hits + '번');

  // ── 판을 재기 좋게 만들어 둡니다 ────────────────────────
  const setup = (floor, key, opts) => page.evaluate(([floor, key, opts]) => {
    const s = window.__scene;
    s.dead = false; s.hp = s.maxHp = 1e9;
    s.weapon.hits = () => false;          // 내가 죽여 버리면 못 잽니다
    if (!opts || !opts.tell) CFG.enemyTypes.forEach((t) => s.seenTypes.add(t.key));
    s.floorIndex = floor; s.lane = 'mid';
    for (let i = floor - 3; i <= floor + 7; i++) s.addFloor(i);
    const f = s.floors.get(floor);
    const here = f.slots.mid || LANES.map((l) => f.slots[l]).find(Boolean);
    s.player.setPosition(here.x, here.y - 34);
    s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.5);
    s.enemies.getChildren().slice().forEach((x) => x.destroy());
    // 놈은 **발판 위 50px**에 세웁니다 (판이 쓰는 값). 낮게 세우면 뚫고 떨어집니다.
    const e = spawnEnemy(s, here.x, here.y - 50, floor, key);
    window.__it = e;
    return { made: !!e, x: Math.round(e.x), y: Math.round(e.y) };
  }, [floor, key, opts || null]);

  // 이놈 말고는 계속 치웁니다. 옆에서 깨어난 놈이 준 피해가 섞이면 숫자가 거짓말을 합니다.
  const lone = () => page.evaluate(() => {
    window.__sweep = setInterval(() => window.__scene.enemies.getChildren()
      .forEach((x) => { if (x !== window.__it) x.destroy(); }), 100);
  });
  const unlone = () => page.evaluate(() => clearInterval(window.__sweep));

  // ── 1. 미는 놈 — 딱 한 층 ───────────────────────────────
  // 여러 층을 미끄러지면 이미 지워진 층과 지워진 적이 걸립니다. 한 층이어야 합니다.
  await setup(300, 'shover');
  await lone();   // 300층이면 미는 놈이 옆에서도 깨어납니다. 재는 건 이 한 놈입니다.
  const shove = await page.evaluate(() => {
    const s = window.__scene, e = window.__it;
    const was = s.floorIndex;
    s.shoveDown(e);
    // **밀고 나서 그놈을 치웁니다.** 안 치우면 재는 동안 제 박자로 한 번 더
    // 밀어서 두 층이 나옵니다 — 그건 규칙이 아니라 이 시험이 두 번 민 것입니다.
    e.destroy();
    // **떨어지는 도중**에 봐야 합니다. 발판에 닿는 순간 밀친 값이 그대로
    // 들어오면서(shoveDown 의 onComplete) 무적이 끝나므로, 다 내려온 뒤에
    // 보면 언제나 꺼져 있습니다. 무적은 「떨어지는 동안」에만 있는 것입니다.
    const mid = new Promise((r) => setTimeout(() => r(s.lastHitAt > s.time.now), 140));
    return mid.then((grace) => new Promise((done) => setTimeout(() => done({
      grace,
      was, now: s.floorIndex,
      alive: !!s.floors.get(s.floorIndex),      // 밀려 간 층이 살아 있는가
      onDeck: Math.abs(s.player.y - (LANES.map((l) => s.floors.get(s.floorIndex).slots[l])
        .filter(Boolean).sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0].y - 34)) < 6,
    }), 700)));
  });
  check(shove.was - shove.now === 1, '미는 놈은 **딱 한 층** 아래로',
    shove.was + '층 → ' + shove.now + '층');
  check(shove.alive, '밀려 내려간 층이 아직 살아 있음 (지워진 자리로 안 떨어짐)');
  check(shove.onDeck, '내려간 뒤 발판 위에 제대로 섬');
  check(shove.grace, '밀리는 동안은 안 맞음 (연달아 밀려 내려가지 않게)');
  await unlone();

  // ── 2. 내리찍는 놈 — 세 층을 뚫고, 뚫린 발판은 잠깐 막힘 ─
  await setup(430, 'slammer');
  const slam = await page.evaluate(() => {
    const s = window.__scene, e = window.__it;
    const c = CFG.foes.slam;
    const marks0 = s.children.list.filter((o) => o.depth === 6).length;
    s.markSlamLane(e);
    const marks = s.children.list.filter((o) => o.depth === 6).length - marks0;
    // 주인공이 선 발판을 뚫어 봅니다.
    const floor = s.floors.get(s.floorIndex);
    const slot = LANES.map((l) => floor.slots[l]).filter(Boolean)
      .sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0];
    e.setPosition(slot.x, slot.y - 10);
    s.slamThrough(e);
    // 위로 뛰려 할 때 **부서진 발판은 안 잡힙니다** — 그 줄이 진짜로 막힙니다.
    const up = s.floors.get(s.floorIndex + 1);
    const upSlot = LANES.map((l) => up.slots[l]).filter(Boolean)
      .sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0];
    upSlot.broken = true;
    const was = { floor: s.floorIndex, lane: s.lane };
    s.jumping = false;
    // jump() 은 **몇 칸 옆으로**를 받습니다 (줄 이름이 아닙니다).
    // 0 = 바로 위. 그 위가 부서져 있으니 옆으로 돌아야 합니다.
    s.jump(0);
    // 줄은 **뛰어 내린 뒤에** 바뀝니다. 부르자마자 읽으면 떠나기 전 줄이 나옵니다.
    return new Promise((done) => {
      const wait = setInterval(() => {
        if (s.jumping) return;
        clearInterval(wait);
        upSlot.broken = false;
        done({ marks, floors: c.floors, broken: !!slot.broken,
          was, wentTo: s.lane, up: s.floorIndex,
          onBroken: s.lane === upSlot.lane });
      }, 60);
      setTimeout(() => { clearInterval(wait); upSlot.broken = false;
        done({ marks, floors: c.floors, broken: !!slot.broken, was,
          wentTo: s.lane, up: s.floorIndex, onBroken: s.lane === upSlot.lane }); }, 2500);
    });
  });
  check(slam.marks === slam.floors, '내려올 줄을 **세 층 미리** 물들임',
    slam.marks + '층');
  check(slam.broken, '뚫고 지나간 발판이 부서진 것으로 표시됨');
  check(!slam.onBroken, '부서진 발판은 안 딛음 — 막힌 줄을 버리고 옆으로 돕니다',
    '막힌 줄 ' + slam.was.lane + ' → 디딘 줄 ' + slam.wentTo);

  // 세 층을 진짜로 뚫고 내려와서, **판에 남아 평범한 적이 되는가.**
  // 피한 것이 사라지지 않고 앞길에 서 있어야 피한 값이 붙습니다.
  await setup(440, 'slammer');
  await lone();
  const land = await page.evaluate(() => {
    const s = window.__scene, e = window.__it;
    s.player.body.setAllowGravity(false); s.player.body.velocity.set(0, 0);
    const y0 = s.player.y;
    let hits = 0;
    const orig = s.slamThrough.bind(s);
    s.slamThrough = (x) => { hits++; return orig(x); };
    return new Promise((done) => {
      const t0 = Date.now();
      const wait = setInterval(() => {
        const over = e.slamPhase === 'done';
        if (!over && Date.now() - t0 < 20000) return;
        clearInterval(wait);
        s.slamThrough = orig;
        s.player.body.setAllowGravity(true);
        done({ phase: e.slamPhase, hit: hits, want: CFG.foes.slam.floors,
          move: e.def.move, ground: !!e.def.ground, alive: !!e.active,
          fell: Math.round(e.y - (y0 - CFG.floorHeight * CFG.foes.slam.above)),
          gravity: !!(e.body && e.body.allowGravity) });
      }, 150);
    });
  });
  await unlone();
  check(land.phase === 'done', '세 층을 다 뚫고 내려옴', land.phase);
  check(land.hit === land.want, '뚫은 층 수가 정해진 만큼', land.hit + '층 / ' + land.want + '층');
  check(land.alive && land.move === 'chase' && land.ground,
    '내려앉은 뒤에는 **평범한 적으로 남음** (피한 것이 앞길에 서 있게)',
    land.move + ' · 땅 ' + land.ground);
  check(land.gravity, '남은 뒤에는 중력을 다시 받음');

  await page.waitForFunction(() => !window.__scene.jumping, null, { timeout: 5000 });

  // 앞 시험에서 한 번 뛰었습니다. **그 점프가 끝나기 전에는 아무 자리도 못
  // 잡습니다** — 점프 트윈이 매 프레임 주인공을 제 길로 끌고 가서, 세워 둔 자리가
  // 그대로 밀려납니다. (이 한 줄이 없어서 가르는 놈이 0 으로 나왔었습니다.)
  await page.waitForFunction(() => !window.__scene.jumping, null, { timeout: 5000 });

  // ── 3. 가르는 놈 — 그 층 전체 ───────────────────────────
  // 줄은 상관없습니다. **그 층에 있으면** 맞습니다. 한 층만 비키면 안 맞습니다.
  await setup(630, 'lancer');
  await lone();
  const lance = await page.evaluate(async () => {
    const s = window.__scene, e = window.__it;
    const c = CFG.foes.lance;
    const shot = async (dy, dx) => {
      s.player.setPosition(e.x + dx, e.y + dy * CFG.floorHeight);
      s.player.body.setAllowGravity(false); s.player.body.velocity.set(0, 0);
      const hp0 = s.hp;
      s.fireLance(e);
      await new Promise((r) => setTimeout(r, c.chargeMs + 500));
      s.player.body.setAllowGravity(true);
      return Math.round(hp0 - s.hp);
    };
    return {
      here: await shot(0, 0),        // 바로 옆
      far: await shot(0, 210),       // 같은 층 · 반대편 줄
      up: await shot(-1, 0),         // 한 층 위
      dmg: Math.round(e.contactDamage || 0),
    };
  });
  await unlone();
  check(lance.here > 0 && lance.far > 0, '가르는 놈은 **줄과 상관없이 그 층 전체**',
    '옆 ' + lance.here + ' · 반대편 줄 ' + lance.far);
  check(lance.up === 0, '한 층만 비키면 안 맞음', '위층에서 잃은 체력 ' + lance.up);

  // ── 4. 전류를 뿜는 놈 — 제 옆이 오히려 안전 ─────────────
  await setup(830, 'zapper');
  await lone();
  const zap = await page.evaluate(async () => {
    const s = window.__scene, e = window.__it;
    const c = CFG.foes.zap;
    const shot = async (dy, dx) => {
      s.player.setPosition(e.x + dx, e.y + dy * CFG.floorHeight);
      s.player.body.setAllowGravity(false); s.player.body.velocity.set(0, 0);
      const hp0 = s.hp;
      s.fireZap(e);
      await new Promise((r) => setTimeout(r, c.chargeMs + 500));
      s.player.body.setAllowGravity(true);
      return Math.round(hp0 - s.hp);
    };
    return {
      // 같은 층에서 **닿지는 않을 만큼**만 떨어져 섭니다 (60px). 사거리(150) 안입니다.
      beside: await shot(0, 60),
      up: await shot(-1, 0),
      down: await shot(1, 0),
      out: await shot(-1, c.reachX + 60),   // 위층이어도 좌우로 벗어나면 안 맞습니다
    };
  });
  await unlone();
  check(zap.beside === 0, '제 층은 안전 — **그놈 옆이 가장 안전한 자리**',
    '옆에서 잃은 체력 ' + zap.beside);
  check(zap.up > 0 && zap.down > 0, '위층과 아래층은 아픔',
    '위 ' + zap.up + ' · 아래 ' + zap.down);
  check(zap.out === 0, '좌우로 벗어나면 위층이어도 안 맞음', zap.out);

  // ── 4-2. 무게 — 몇 번 때려야 하는가, 얼마나 아픈가 ──────
  // 이 넷의 체력은 숫자가 아니라 **지금 든 자루로 몇 번**입니다. 그래야
  // 누가 오든 똑같이 무겁습니다. 자루를 바꿔 가며 그 약속이 지켜지는지 봅니다.
  const weight = await page.evaluate(() => {
    const s = window.__scene;
    s.dead = false; s.hp = s.maxHp = 500;
    s.floorIndex = 860;
    for (let i = 857; i <= 866; i++) s.addFloor(i);
    const f = s.floors.get(860);
    const at = LANES.map((l) => f.slots[l]).find(Boolean);
    const rows = [];
    // 자루 셋 — 맨 처음 것, 가운데 것, 가장 깊은 것. 셋 다 같은 횟수여야 합니다.
    [0, 10, 22].forEach((idx) => {
      s.weapon = new Weapon(s.job, idx);
      const swing = s.weapon.dmg * (s.weapon.shots || 1) * s.weapon.accuracy;
      ['shover', 'slammer', 'lancer', 'zapper'].forEach((k) => {
        s.enemies.getChildren().slice().forEach((x) => x.destroy());
        const e = spawnEnemy(s, at.x, at.y - 50, 860, k);
        rows.push({ idx, k, want: CFG.foes.hits[k],
          got: +(e.maxHp / swing).toFixed(2),
          dmg: e.contactDamage, pct: +(e.contactDamage / s.maxHp).toFixed(3),
          wantPct: CFG.foes.dmgPct[k] });
        e.destroy();
      });
    });
    s.weapon = new Weapon(s.job, 0);
    return rows;
  });
  const offBy = weight.filter((r) => Math.abs(r.got - r.want) > 0.02);
  check(!offBy.length, '넷의 체력이 **지금 든 자루로 몇 번**인가 (자루 셋으로 견줌)',
    weight.filter((r) => r.idx === 0).map((r) => r.k + ' ' + r.got + '번').join(' · '));
  const offPct = weight.filter((r) => Math.abs(r.pct - r.wantPct) > 0.005);
  check(!offPct.length, '한 대가 **최대 체력의 정해진 몫** (체력 500 기준)',
    weight.filter((r) => r.idx === 0)
      .map((r) => r.k + ' ' + r.dmg + '(' + Math.round(r.pct * 100) + '%)').join(' · '));

  // 회피는 이 넷에게 절반만 듣습니다. 흘려 넘긴 횟수를 세어 봅니다.
  const dodged = await page.evaluate(() => {
    const s = window.__scene;
    s.dead = false; s.hp = s.maxHp = 1e9;
    const f = s.floors.get(s.floorIndex);
    const at = LANES.map((l) => f.slots[l]).find(Boolean);
    s.enemies.getChildren().slice().forEach((x) => x.destroy());
    const foe = spawnEnemy(s, at.x, at.y - 50, s.floorIndex, 'lancer');
    const plain = spawnEnemy(s, at.x, at.y - 50, s.floorIndex, 'crawler');
    const count = (src) => {
      let through = 0;
      for (let i = 0; i < 600; i++) {
        const hp0 = s.hp;
        s.lastHitAt = 0;
        s.hurt(1000, src);
        if (s.hp < hp0) through++;
      }
      return through / 600;
    };
    s.dodge = 1;                       // 언제나 흘려 넘기는 몸으로 세워 둡니다
    const vsPlain = count(plain);
    const vsFoe = count(foe);
    s.dodge = 0;
    foe.destroy(); plain.destroy();
    return { vsPlain, vsFoe, want: CFG.foes.dodgeScale };
  });
  check(dodged.vsPlain === 0, '회피 100%면 보통 적의 피해는 하나도 안 들어옴',
    Math.round(dodged.vsPlain * 100) + '%');
  check(Math.abs(dodged.vsFoe - (1 - dodged.want)) < 0.06,
    '판을 바꾸는 넷에게는 회피가 **절반만** 듦',
    Math.round(dodged.vsFoe * 100) + '% 들어옴 (' +
    Math.round((1 - dodged.want) * 100) + '% 예상)');

  // ── 5. 처음 만나면 판이 멈추고 한 장이 뜬다 ─────────────
  const foe = await page.evaluate(async () => {
    const s = window.__scene;
    // **먼저 되살립니다.** 앞 시험에서 전류를 여덟 번 맞았는데, 이 넷의 피해는
    // 이제 최대 체력의 몇 할이라 네 대면 죽습니다. 죽은 채로는 안내 창이
    // 안 뜹니다(announceEnemy 가 dead 를 봅니다) — 창을 재려는 시험이 죽음을
    // 재게 됩니다.
    s.dead = false; s.hp = s.maxHp;
    // **문은 announceEnemy 가 아니라 spawnEnemy 에 달려 있습니다** — 처음 본
    // 종류일 때만 부릅니다(js/enemies.js). 그러니 문을 재려면 놈을 세워야 합니다.
    s.seenTypes.delete('zapper');
    s.enemies.getChildren().slice().forEach((x) => x.destroy());
    const f = s.floors.get(s.floorIndex);
    const at = LANES.map((l) => f.slots[l]).find(Boolean);
    window.__foe = null;
    spawnEnemy(s, at.x, at.y - 50, s.floorIndex, 'zapper');
    await new Promise((r) => setTimeout(r, 700));
    const opened = !!window.__foe;
    const paused = !s.scene.isActive();
    // **단추는 잠시 뒤에 뜹니다.** 뜨기 전에 눌러도 안 닫혀야 합니다 —
    // 이 자리가 판에서는 점프 단추라, 안 막으면 읽기도 전에 닫힙니다.
    const early = opened ? window.__foe.ready : null;
    if (opened) window.__foe.close();
    await new Promise((r) => setTimeout(r, 120));
    const shutEarly = opened && s.scene.isActive();   // 일찍 눌러서 닫혔으면 판이 돕니다
    if (opened) {
      await new Promise((done) => {
        const t0 = Date.now();
        const wait = setInterval(() => {
          if (window.__foe && window.__foe.ready) { clearInterval(wait); done(); }
          else if (Date.now() - t0 > 6000) { clearInterval(wait); done(); }
        }, 60);
      });
    }
    const late = opened ? window.__foe.ready : null;
    if (opened) window.__foe.close();
    // **닫자마자** 봐야 합니다 — 막는 시간은 0.3초뿐입니다 (그 한 번의 탭만
    // 삼키면 되니까요). 기다렸다 보면 언제나 꺼져 있습니다.
    const blocked = s.tapBlockedUntil > s.time.now;
    await new Promise((r) => setTimeout(r, 500));
    const back = s.scene.isActive();
    // 두 번째부터는 안 뜹니다 — 판마다 한 번씩입니다.
    window.__foe = null;
    spawnEnemy(s, at.x, at.y - 50, s.floorIndex, 'zapper');
    await new Promise((r) => setTimeout(r, 500));
    return { opened, paused, again: !!window.__foe, back, blocked,
      early, late, shutEarly, wait: CFG.foes.tellDelayMs };
  });

  check(foe.opened && foe.paused, '처음 보면 **판이 멈추고** 안내 창이 뜸');
  check(foe.early === false && foe.late === true,
    '단추가 ' + foe.wait + 'ms 뒤에 뜸 (점프 단추 자리라 바로 눌리면 못 읽습니다)',
    '뜨자마자 ' + foe.early + ' → 기다린 뒤 ' + foe.late);
  check(!foe.shutEarly, '단추가 뜨기 전에 누르면 안 닫힘');
  check(foe.back, '닫으면 판이 다시 돎');
  check(foe.blocked, '창을 닫은 그 탭이 점프로 새지 않음');
  check(!foe.again, '이미 본 놈은 다시 안 멈춤');

  // ── 6. 알려 줄 말이 넷 다 있는가 ────────────────────────
  const tells = await page.evaluate(() => {
    const t = CFG.foes.tell;
    return ['shover', 'slammer', 'lancer', 'zapper'].map((k) => ({
      k, ok: !!(t[k] && t[k].name && t[k].what && t[k].care),
      name: t[k] && t[k].name,
      same: t[k] && CFG.enemyTypes.find((x) => x.key === k).name === t[k].name,
    }));
  });
  check(tells.every((x) => x.ok), '넷 다 이름·하는 짓·조심할 것이 적혀 있음');
  check(tells.every((x) => x.same), '안내 창의 이름과 판의 이름이 같음',
    tells.map((x) => x.name).join(' · '));

  console.log(bad ? `\n${bad}건 어긋남` : '\n판을 바꾸는 넷 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();

function list0(four) {
  return four.map((f) => f.name + ' ' + f.from + '층').join(' · ');
}
