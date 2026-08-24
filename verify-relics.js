// ── 유물 서른 개 ─────────────────────────────────────────
//
// 아홉이던 유물을 서른으로 늘렸습니다. 새로 들어온 스물하나 중 눈으로는
// 안 보이는 규칙을 가진 것들을 재 봅니다 — 기름은 정말 겹쳐 안 쓰이는지,
// 강철 살갗 없는 도적은 정말 목록에서 빠지는지, 초전박살은 정말 「첫 대만」
// 세 배인지, 로켓장화는 정말 사이 층을 건너뛰는지.
//
// 밸런스 값은 아직 첫 판입니다 (js/config.js 의 CFG.relicFx). 여기서 재는
// 것은 그 값이 맞는 자리에서 나오는지이지, 그 값 자체가 적당한지가 아닙니다.
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

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

(async () => {
  const port = Number(process.env.PORT) || 9616;
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
    weapons: {}, boosts: {}, relics: {}, unlocked: { archer: true, rogue: true },
    lastJob: 'warrior', sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });
  await page.waitForTimeout(900);

  // ── 0. 개수와 자리 ──────────────────────────────────────
  const roster = await page.evaluate(() => ({
    total: RELICS.length,
    keys: RELICS.map((r) => r.key),
    warrior: relicsFor('warrior').length,
    archer: relicsFor('archer').length,
    rogue: relicsFor('rogue').length,
  }));
  check(roster.total === 30, '유물 서른 개', roster.total + '개');
  check(new Set(roster.keys).size === 30, '열쇠가 서로 다 다름');
  // 강철 살갗·흑철갑옷은 needsArmor — 도적 목록에서 빠져야 합니다.
  check(roster.rogue < roster.warrior,
    '갑옷 없는 도적은 needsArmor 유물만큼 적게 봄',
    '전사 ' + roster.warrior + '개 · 도적 ' + roster.rogue + '개');

  const setup = (jobKey) => page.evaluate((jobKey) => {
    const s = window.__scene;
    s.job = CLASSES.find((c) => c.key === jobKey);
    s.weapon = new Weapon(s.job, 0);
    s.dead = false; s.hp = s.maxHp = 500;
    s.floorIndex = 300; s.lane = 'mid';
    for (let i = 297; i <= 310; i++) s.addFloor(i);
    s.enemies.getChildren().slice().forEach((x) => x.destroy());
  }, jobKey);
  await setup('warrior');

  // ── 1. relicMax — 직업마다 다름 ─────────────────────────
  const limits = await page.evaluate(() => {
    const s = window.__scene;
    const at = (jobKey) => { s.job = CLASSES.find((c) => c.key === jobKey); return s.relicMax(); };
    return { warrior: at('warrior'), archer: at('archer'), rogue: at('rogue'), cfg: CFG.relic.maxHeld };
  });
  await setup('warrior');
  check(limits.warrior === limits.cfg, '전사는 기본값', limits.warrior);
  check(limits.archer === 3, '궁수는 셋', limits.archer);
  check(limits.rogue === 2, '도적은 둘', limits.rogue);

  // ── 2. 기름 셋은 겹쳐 못 씀 ──────────────────────────────
  const oil = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [];
    s.takeRelic(relicByKey('hotoil'));
    const after1 = s.weapon.relics.map((r) => r.key);
    s.takeRelic(relicByKey('coldoil'));
    const after2 = s.weapon.relics.map((r) => r.key);
    return { after1, after2 };
  });
  check(oil.after1.includes('hotoil'), '기름을 바르면 유물이 붙음', oil.after1.join(','));
  check(!oil.after2.includes('hotoil') && oil.after2.includes('coldoil'),
    '다른 기름을 바르면 전에 바른 기름이 벗겨짐', oil.after2.join(','));
  check(oil.after2.length === 1, '자리를 더 안 씀 (한 자리를 나눠 씀)', oil.after2.length + '개');

  // ── 3. 초전박살 — 그 적의 첫 대만 세 배 ─────────────────
  const first = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('firststrike')];
    const f = s.floors.get(300);
    const e = spawnEnemy(s, f.slots.mid.x, f.slots.mid.y - 50, 300, 'crawler');
    e.maxHp = e.hp = 100000;
    s.hitEnemy(e, 10);
    const afterFirst = 100000 - e.hp;   // 30 이어야 합니다 (10 × 3)
    s.hitEnemy(e, 10);
    const afterSecond = (100000 - afterFirst) - e.hp; // 10 이어야 합니다 (배수 없음)
    e.destroy();
    return { afterFirst, afterSecond };
  });
  check(first.afterFirst === 30, '첫 대는 세 배', first.afterFirst);
  check(first.afterSecond === 10, '두 번째 대부터는 평소대로', first.afterSecond);

  // ── 4. 처형인의 표식 — 남은 체력 25% 아래일 때만 두 배 ──
  const exec = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('executionermark')];
    const f = s.floors.get(300);
    const mk = () => { const e = spawnEnemy(s, f.slots.mid.x, f.slots.mid.y - 50, 300, 'crawler');
      e.hitOnce = true; return e; };
    const high = mk(); high.maxHp = 1000; high.hp = 500;   // 50% — 문턱 위
    const before1 = high.hp; s.hitEnemy(high, 10);
    const highLost = before1 - high.hp;
    const low = mk(); low.maxHp = 1000; low.hp = 200;      // 20% — 문턱 아래
    const before2 = low.hp; s.hitEnemy(low, 10);
    const lowLost = before2 - low.hp;
    high.destroy(); low.destroy();
    return { highLost, lowLost };
  });
  check(exec.highLost === 10, '문턱 위에서는 평소대로', exec.highLost);
  check(exec.lowLost === 20, '25% 아래면 두 배', exec.lowLost);

  // ── 5. 용 비늘 투구 — 보스 피해만 절반 ──────────────────
  const dragon = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('dragonscale')];
    s.hp = s.maxHp = 1000; s.dodge = 0; s.armor = 0; s.lastHitAt = 0;
    const hp0 = s.hp; s.hurt(100, null, true);
    const fromBoss = hp0 - s.hp;
    s.hp = s.maxHp; s.lastHitAt = 0;
    const hp1 = s.hp; s.hurt(100, null, false);
    const notBoss = hp1 - s.hp;
    return { fromBoss, notBoss };
  });
  check(dragon.fromBoss === 50, '보스 공격은 절반만', dragon.fromBoss);
  check(dragon.notBoss === 100, '보스가 아니면 그대로', dragon.notBoss);

  // ── 6. 위기는 기회다 — 체력 반 아래일 때만 ──────────────
  const crisis = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('crisis')];
    s.armor = 0; s.dodge = 0;
    s.maxHp = 1000;
    s.hp = 600; s.lastHitAt = 0;                 // 60% — 문턱 위
    const hp0 = s.hp; s.hurt(100, null, false);
    const highLost = hp0 - s.hp;
    s.hp = 400; s.lastHitAt = 0;                 // 40% — 문턱 아래
    const hp1 = s.hp; s.hurt(100, null, false);
    const lowLost = hp1 - s.hp;
    // 손도 빨라져야 합니다
    s.hp = 400; // 계속 문턱 아래
    const fastRate = s.effRate();
    s.hp = 900; // 문턱 위
    const slowRate = s.effRate();
    return { highLost, lowLost, fastRate, slowRate, rate: s.weapon.rate };
  });
  check(crisis.highLost === 100, '체력이 넉넉하면 평소대로', crisis.highLost);
  check(crisis.lowLost === 70, '반 아래면 30% 덜 맞음', crisis.lowLost);
  check(crisis.fastRate < crisis.slowRate, '반 아래면 손도 빨라짐 (쿨다운이 더 짧음)',
    Math.round(crisis.fastRate) + ' < ' + Math.round(crisis.slowRate));

  // ── 7. 거울 조각 — 보스마다 딱 한 번, 완전히 막고 되돌림 ─
  const mirror = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('mirrorshard')];
    s.armor = 0; s.dodge = 0; s.maxHp = 1000; s.hp = 1000;
    // 진짜 스프라이트라야 hitEnemy 가 하는 setTint 등이 안 터집니다.
    const f = s.floors.get(300);
    s.boss = spawnEnemy(s, f.slots.mid.x, f.slots.mid.y - 50, 300, 'crawler');
    s.boss.hp = s.boss.maxHp = 100000;
    s.mirrorUsed = false;
    s.lastHitAt = 0;
    const hp0 = s.hp; const bossHp0 = s.boss.hp;
    s.hurt(200, null, true);           // 첫 대 — 완전히 막고 되돌려야 합니다
    const firstPlayerLost = hp0 - s.hp;
    const bossLost = bossHp0 - s.boss.hp;
    const hp1 = s.hp;
    s.hurt(200, null, true);           // 두 번째 대 — 이제는 그냥 맞습니다
    const secondPlayerLost = hp1 - s.hp;
    return { firstPlayerLost, bossLost, secondPlayerLost };
  });
  check(mirror.firstPlayerLost === 0, '첫 대는 안 맞음 (완전히 막음)', mirror.firstPlayerLost);
  check(mirror.bossLost === 200, '막은 만큼 보스에게 그대로', mirror.bossLost);
  check(mirror.secondPlayerLost > 0, '그 판마다 한 번뿐 — 두 번째는 그냥 맞음',
    mirror.secondPlayerLost);

  // ── 8. 두 번째 심장 — 「단단한 몸」이 더 큼 ──────────────
  const heart = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [];
    const plain = maxhpGainFor(s);
    s.weapon.relics = [relicByKey('secondheart')];
    const boosted = maxhpGainFor(s);
    return { plain, boosted, base: CFG.shop.maxhpGain, bonus: CFG.relicFx.secondheartBonus };
  });
  check(heart.plain === heart.base, '유물이 없으면 원래 값', heart.plain);
  check(heart.boosted === heart.base + heart.bonus, '유물이 있으면 더 큼',
    heart.plain + ' → ' + heart.boosted);

  // ── 9. 강철 살갗 — 닳는 속도만 줄어듦 (안 닳는 게 아님) ──
  const skin = await page.evaluate(() => {
    const s = window.__scene;
    s.job = CLASSES.find((c) => c.key === 'warrior');
    s.armor = 50;
    s.weapon.relics = [];
    const plain = s.wearArmor(100);
    s.armor = 50;
    s.weapon.relics = [relicByKey('ironskin')];
    const boosted = s.wearArmor(100);
    return { plain, boosted };
  });
  check(skin.plain > 0, '평소에는 닳음', skin.plain);
  check(skin.boosted > 0 && skin.boosted < skin.plain,
    '강철 살갗은 **덜** 닳게 함 (0은 아님)', skin.plain + ' → ' + skin.boosted);

  // ── 10. 기울어진 저울 — 상점 값 40% 낮음 ────────────────
  const scale = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [];
    const plain = s.shop.priceOf('plus', 3);
    s.weapon.relics = [relicByKey('tiltedscale')];
    const cheap = s.shop.priceOf('plus', 3);
    return { plain, cheap, want: CFG.relicFx.scaleMul };
  });
  check(Math.abs(scale.cheap / scale.plain - scale.want) < 0.03,
    '기울어진 저울이 값을 정해진 만큼 낮춤',
    scale.plain + ' → ' + scale.cheap + ' (' + (scale.cheap / scale.plain).toFixed(2) + '배)');

  // ── 11. 보라빛 메달 — 보스마다 +1, 유물이 없으면 그대로 ─
  const medal = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [];
    s.medals = 0;
    s.bossDefeated({ x: 0, y: 0, kind: 'boss-warden' });
    const without = s.medals;
    s.weapon.relics = [relicByKey('purplemedal')];
    s.medals = 0;
    s.bossFight = true; s.boss = {};
    s.bossDefeated({ x: 0, y: 0, kind: 'boss-warden' });
    const with_ = s.medals;
    return { without, with_ };
  });
  check(medal.without === 0, '유물이 없으면 보스를 잡아도 메달이 안 늚', medal.without);
  check(medal.with_ === 1, '유물이 있으면 보스마다 +1', medal.with_);

  // ── 12. 황금 손 — 코인이 끌리는 범위 ─────────────────────
  const magnet = await page.evaluate(async () => {
    const s = window.__scene;
    s.weapon.relics = [];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const drop = (dx, dy) => {
      s.pickups.length = 0;
      s.dropCoin(s.player.x + dx, s.player.y + dy, 10);
      return s.pickups[0];
    };
    // 멀리(같은 층 벗어난 두 칸 옆) — 유물 없이는 안 끌려야 합니다
    const p1 = drop(400, 0);
    const before1 = dist(p1.sprite, s.player);
    for (let i = 0; i < 20; i++) s.updatePickups(16);
    const after1 = dist(p1.sprite, s.player);
    s.pickups.forEach((p) => p.sprite.destroy()); s.pickups.length = 0;

    s.weapon.relics = [relicByKey('goldhand')];
    const p2 = drop(400, 0);
    const before2 = dist(p2.sprite, s.player);
    for (let i = 0; i < 20; i++) s.updatePickups(16);
    const after2 = dist(p2.sprite, s.player);
    s.pickups.forEach((p) => p.sprite.destroy()); s.pickups.length = 0;
    return { before1, after1, before2, after2 };
  });
  check(Math.abs(magnet.after1 - magnet.before1) < 4,
    '유물 없이는 먼 코인이 안 끌려옴 (제자리)',
    Math.round(magnet.before1) + ' → ' + Math.round(magnet.after1));
  check(magnet.after2 < magnet.before2 - 20,
    '황금 손이 있으면 같은 자리에서도 끌려옴',
    Math.round(magnet.before2) + ' → ' + Math.round(magnet.after2));

  // ── 13. 탑은 둥글다 — 맨 끝 줄에서 바깥으로 뛰면 반대쪽으로 ─
  const round = await page.evaluate(async () => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('roundtower')];
    s.scene.resume('game');
    s.dead = false; s.jumping = false; s.bossFight = false; s.choosing = false; s.shop.open = false;
    s.floorIndex = 300; s.lane = 'left';
    for (let i = 297; i <= 308; i++) s.addFloor(i);
    LANES.forEach((l) => { const f = s.floors.get(300); if (!f.slots[l]) f.slots[l] = blankSlot(300, l, 'empty'); });
    LANES.forEach((l) => { const f = s.floors.get(301); f.slots[l] = blankSlot(301, l, 'empty'); });
    const at = f => s.floors.get(f);
    s.player.setPosition(at(300).slots.left.x, at(300).slots.left.y - 34);
    s.jump(-1); // 왼쪽 끝에서 왼쪽으로
    await new Promise((r) => setTimeout(r, 700));
    return { landedLane: s.lane, landedFloor: s.floorIndex };
  });
  check(round.landedFloor === 301 && round.landedLane === 'right',
    '왼쪽 끝에서 왼쪽으로 뛰면 위층 오른쪽 끝으로', round.landedLane + '줄 ' + round.landedFloor + '층');

  // ── 14. 로켓장화 — 두 층을 한 번에, 사이 층은 안 지나감 ──
  const rocket = await page.evaluate(async () => {
    const s = window.__scene;
    s.weapon.relics = [relicByKey('rocketboots')];
    s.scene.resume('game');
    s.dead = false; s.jumping = false; s.bossFight = false; s.choosing = false; s.shop.open = false;
    s.floorIndex = 300; s.lane = 'mid';
    for (let i = 297; i <= 310; i++) s.addFloor(i);
    const mid = s.floors.get(300).slots.mid;
    s.player.setPosition(mid.x, mid.y - 34);
    const midFloor = s.floors.get(301);
    LANES.forEach((l) => { if (midFloor.slots[l]) midFloor.slots[l].spawned = true; }); // 안 깨움을 셀 표시
    const ok = s.rocketJump();
    await new Promise((r) => setTimeout(r, 900));
    return { ok, floor: s.floorIndex, jumpingAfter: s.jumping };
  });
  check(rocket.ok, 'rocketJump 이 실제로 시작됨');
  check(rocket.floor === 302, '두 층을 한 번에 (300 → 302)', rocket.floor);
  check(!rocket.jumpingAfter, '내려앉은 뒤에는 다시 뛸 수 있음');

  // ── 15. 혜안 — 미믹이 훨씬 멀리서부터 드러남 ────────────
  const eye = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.relics = [];
    s.floorIndex = 300;
    for (let i = 297; i <= 308; i++) s.addFloor(i);
    const far = s.floors.get(306); // 6층 위 — 기본 revealWithin(2) 밖
    LANES.forEach((l) => { if (far.slots[l]) far.slots[l] = blankSlot(306, l, 'empty'); });
    far.slots.mid.kind = 'mimic'; far.slots.mid.disguise = 'heal';
    far.slots.mid.view = null; far.slots.mid.badgeParts = null; far.slots.mid.revealed = false;
    // view 가 없으면 revealMimic 이 조용히 물러나므로, 세워 둔 표를 하나 답니다
    far.slots.mid.view = s.add.container(far.slots.mid.x, far.slots.mid.y);
    far.slots.mid.badgeParts = { circle: s.add.circle(0, 0, 10), label: s.add.text(0, 0, '') };
    s.updateItems(s.time.now);
    const without = far.slots.mid.revealed;
    far.slots.mid.revealed = false;
    s.weapon.relics = [relicByKey('trueeye')];
    s.updateItems(s.time.now);
    const withEye = far.slots.mid.revealed;
    return { without, withEye };
  });
  check(!eye.without, '평소에는 6층 위 가짜가 아직 안 드러남');
  check(eye.withEye, '혜안이 있으면 그만큼 멀어도 드러남');

  // ── 16. 유물 도감 — 서른 줄에 **다 닿을 수 있는가** ─────
  //
  // 아홉이던 유물을 서른으로 늘렸을 때 도감은 그대로 뒀습니다. 줄은 다
  // 그려졌지만 마지막 줄이 y=2382 (화면은 960) 라서 열아홉은 아예 화면
  // 밖이었습니다 — 그리는 것과 닿는 것은 다릅니다. 그래서 「그려졌나」가
  // 아니라 「끝까지 끌어서 마지막 줄을 볼 수 있나」를 잽니다.
  const book = await page.evaluate(async () => {
    // 도감은 못 만난 유물을 「? ???」로 적습니다. 이름으로 찾아야 하니
    // 서른을 다 만난 것으로 해 두고 엽니다.
    RELICS.forEach((r) => { Save.data.relics[r.key] = 1; });
    window.__game.scene.start('relicbook');
    await new Promise((r) => setTimeout(r, 700));
    const s = window.__relicbook;
    const cam = s.cameras.main;
    // 흘리기 전 — 몇 줄이 화면 안에 들어와 있나
    const 보이는줄 = () => s.children.list.filter((o) => o.type === 'Text'
      && o.scrollFactorY !== 0
      && o.y - cam.scrollY > 152 && o.y - cam.scrollY < CFG.height - 86).length;
    const 처음 = 보이는줄();
    // 끝까지 흘립니다
    cam.scrollY = s.maxScroll;
    const 끝에서 = 보이는줄();
    // 마지막 유물의 이름이 화면 안에 들어왔는가
    // 도감 줄은 그림 + 이름입니다 (js/relicart.js 를 붙이면서 기호가 빠졌습니다).
    const 줄글 = (r) => r.name;
    const 막줄 = RELICS[RELICS.length - 1].name;
    const 막줄보임 = s.children.list.some((o) => o.type === 'Text'
      && o.text === 줄글(RELICS[RELICS.length - 1])
      && o.y - cam.scrollY > 152 && o.y - cam.scrollY < CFG.height - 86);
    // 첫 유물은 흘리기 전에 보여야 합니다 (거꾸로 시작하지 않게)
    const 첫줄 = RELICS[0].name;
    cam.scrollY = 0;
    const 첫줄보임 = s.children.list.some((o) => o.type === 'Text'
      && o.text === 줄글(RELICS[0])
      && o.y - cam.scrollY > 152 && o.y - cam.scrollY < CFG.height - 86);
    return { 처음, 끝에서, 막줄보임, 첫줄보임, maxScroll: Math.round(s.maxScroll), 막줄, 첫줄 };
  });
  check(book.첫줄보임, '처음에는 첫 유물이 보임', book.첫줄);
  check(book.maxScroll > 0, '끌어서 넘길 자리가 있음', book.maxScroll + 'px');
  check(book.막줄보임, '끝까지 끌면 마지막 유물까지 닿음', book.막줄);
  check(book.끝에서 > 0, '끝에서도 빈 화면이 아님', book.끝에서 + '줄');

  // ── 17. 판을 거치지 않고 도감을 열어도 그림이 뜨는가 ────
  //
  // 위의 도감 검사는 판을 한 번 돌고 나서 엽니다. 그런데 도감은 **시작
  // 화면에서 바로** 열 수 있고, 그때는 텍스처가 아직 안 구워져 있어서
  // Phaser 가 「없는 그림」 자리에 초록 X 상자를 놓습니다. 실제로 그랬습니다.
  // 그래서 판을 아예 안 거친 길을 따로 재 둡니다.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  const fresh = await page.evaluate(async () => {
    RELICS.forEach((r) => { Save.data.relics[r.key] = 1; });
    window.__title.go();
    await new Promise((r) => setTimeout(r, 500));
    window.__game.scene.start('relicbook');
    await new Promise((r) => setTimeout(r, 900));
    const s = window.__relicbook;
    const imgs = s.children.list.filter((o) => o.type === 'Image');
    const 빠진것 = imgs.filter((o) => o.texture.key === '__MISSING').length;
    return { 그림수: imgs.length, 빠진것, 총: RELICS.length };
  });
  check(fresh.그림수 >= fresh.총, '판을 안 거쳐도 서른 장이 다 놓임', fresh.그림수 + '장');
  check(fresh.빠진것 === 0, '없는 그림(초록 X 상자)이 하나도 없음', fresh.빠진것 + '개');

  console.log(bad ? `\n${bad}건 어긋남` : '\n유물 서른 개 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
