// 무기 그림과 죽는 이펙트를 확인합니다.
// 그림은 "구워졌는가"가 아니라 "어디에 붙었는가"가 중요합니다 —
// 들고 있는 것과 다음에 올 것이 화면에서 실제로 이어져야 합니다.
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

(async () => {
  const port = Number(process.env.PORT) || 9640;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0,
    weapons: {}, boosts: {}, relics: {}, unlocked: {}, lastJob: 'warrior', sawStory: true,
  })));
  await page.reload({ waitUntil: 'networkidle' });
  // 켜면 타이틀 화면이 먼저 섭니다 (js/scene-title.js). 사람처럼 한 번 지납니다 —
  // 안 지나면 아래가 전부 타이틀 화면 위에서 헛돕니다.
  await page.waitForFunction(() => window.__title && window.__title.ready,
    null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);
  // 좌표를 손으로 적지 않습니다 — 고르기가 격자로 바뀌면서 적어 둔 자리는
  // 오류 없이 빗나갔고, 그 다음 줄에서야 엉뚱한 곳이 터졌습니다.
  await page.evaluate(() => window.__select.go('warrior'));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  // ── 일흔두 자루가 모두 구워졌는가 ──────────────────────
  // 자루 열둘 × 만듦새 둘 × 직업 셋. **주머니(job.pool)를 돌아야 합니다** —
  // 예전 코드가 job.weapons(열둘)만 돌았더니 열두 번째부터 텍스처가 없어서,
  // 무기 칸과 HUD 에 초록 X 상자가 떴습니다.
  const baked = await page.evaluate(() => {
    const s = window.__scene;
    const missing = [];
    let total = 0;
    CLASSES.forEach((job) => buildWeaponPool(job).forEach((w, index) => {
      total++;
      const key = weaponIconKey(job.key, index);
      if (!s.textures.exists(key)) missing.push(job.key + ' ' + w.name);
    }));
    return { total, missing };
  });
  check(baked.missing.length === 0, '직업마다 무기 그림이 다 있음',
    baked.total + '자루 중 빠진 것 ' + (baked.missing.join(', ') || '없음'));

  // 그림이 서로 달라야 합니다. 하나를 돌려 쓰면 "무엇을 들었나"가 안 보입니다.
  const distinct = await page.evaluate(() => {
    const s = window.__scene;
    const seen = new Set();
    let dup = 0;
    CLASSES.forEach((job) => buildWeaponPool(job).forEach((w, index) => {
      const src = s.textures.get(weaponIconKey(job.key, index)).getSourceImage();
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      const sig = c.toDataURL();
      if (seen.has(sig)) dup++;
      seen.add(sig);
    }));
    return { unique: seen.size, dup };
  });
  check(distinct.dup === 0, '일흔두 자루가 서로 다른 그림',
    '서로 다른 것 ' + distinct.unique + '개 · 겹친 것 ' + distinct.dup + '개');

  // ── HUD 에 지금 든 무기가 보이는가 ─────────────────────
  const hud = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.index = 0;
    s.hud.update();
    const first = s.hud.weaponIcon.texture.key;
    s.weapon.index = 6;
    s.hud.update();
    return { first, later: s.hud.weaponIcon.texture.key, want: weaponIconKey(s.job.key, 6) };
  });
  check(hud.first === 'w-warrior-0' && hud.later === hud.want,
    'HUD 그림이 지금 든 무기를 따라감', hud.first + ' → ' + hud.later);

  // ── 발판의 무기 칸 ─────────────────────────────────────
  //
  // 무기는 이제 사다리가 아닙니다. 발판에 **놓여 있는 자루**가 따로 있고,
  // 그림은 그 자루의 것이어야 합니다 (내가 든 것의 "다음 단계"가 아니라).
  // 그리고 그 자루는 발판을 지을 때 한 번 굴려 놓고 **바뀌지 않아야** 합니다 —
  // 두 층 밖에서 보고 길을 정하는 일이 뜻을 가지려면요.
  const mark = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.index = 3; s.weapon.plus = 0;
    s.floorIndex = 240;
    const f = s.floorIndex + 1;
    s.removeFloor(f); s.addFloor(f);
    const floor = s.floors.get(f);
    const slot = floor.slots.mid;
    if (slot.view) { slot.view.destroy(); slot.view = null; }
    slot.kind = SLOT.UPGRADE;
    slot.taken = false; slot.expired = false; slot.upIcon = null; slot.weapon = null;
    slot.view = s.makeMark(slot);
    floor.views.push(slot.view);

    const shown = slot.upIcon && slot.upIcon.texture.key;
    const want = weaponIconKey(s.job.key, slot.weapon.index);
    // **게임이 쓰는 함수로 그대로 대조합니다.** 여기서 창을 다시 계산하면
    // 어긋납니다 — 창의 기준은 "층 - lookBack"이 아니라 "그 층에서 열린 것 중
    // 가장 깊은 자루 - lookBack"입니다. 실제로 그렇게 잘못 적었다가 판마다
    // 붙었다 떨어졌다 했습니다.
    const inPool = weaponPoolAt(s.job, 240).some((x) => x.index === slot.weapon.index);
    const gainBefore = slot.upGain.text;

    // 내가 무기를 갈아타도 **놓인 자루는 그대로**여야 합니다.
    // 바뀌는 것은 견주는 값(손익 표시)뿐입니다.
    s.weapon.index = 8;
    s.updateItems(s.time.now);
    return { shown, want, inPool, gainBefore,
      after: slot.upIcon && slot.upIcon.texture.key, gainAfter: slot.upGain.text };
  });
  check(mark.shown === mark.want, '발판에는 그 칸에 놓인 자루의 그림', mark.shown);
  check(mark.inPool, '그 층에 나올 수 있는 자루만 놓임');
  check(mark.after === mark.shown, '내가 갈아타도 놓인 자루의 그림은 그대로',
    mark.shown + ' → ' + mark.after);
  check(mark.gainBefore !== mark.gainAfter, '대신 손익 표시는 다시 셈',
    mark.gainBefore + ' → ' + mark.gainAfter);

  // ── 죽는 이펙트 ────────────────────────────────────────
  const burst = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.index = 0;
    const before = s.children.list.length;
    s.addFloor(s.floorIndex);
    const fl = s.floors.get(s.floorIndex);
    const slot = fl.slots.mid || fl.slots.left || fl.slots.right;
    const e = spawnEnemy(s, slot.x, slot.y - 120, s.floorIndex, 'flyer');
    e.hp = 1;
    // 코인은 이펙트가 아니라 주울 것이라 오래 남습니다. 확률로 떨어지므로
    // 세는 데 섞이면 판마다 결과가 달라집니다 — 아예 안 떨어지게 해 둡니다.
    e.coin = 0;
    // 이펙트는 전부 깊이 11~12에 놓입니다.
    const fx = () => s.children.list.filter((o) =>
      (o.depth === 11 || o.depth === 12) && !(o.texture && o.texture.key === 'coin')).length;
    const mid = fx();
    s.hitEnemy(e, 9999);
    return { before, mid, after: fx(), gone: !e.active };
  });
  check(burst.gone, '마지막 한 대에 적이 사라짐');
  check(burst.after - burst.mid >= 6, '죽는 자리에 이펙트가 남음',
    burst.after - burst.mid + '개 (섬광·몸·고리·조각)');

  // 이펙트는 스스로 걷혀야 합니다. 안 걷히면 한 판에 수백 개가 쌓입니다.
  await page.waitForTimeout(700);
  const cleaned = await page.evaluate(() => window.__scene.children.list
    .filter((o) => (o.depth === 11 || o.depth === 12) &&
      !(o.texture && o.texture.key === 'coin')).length);
  check(cleaned <= burst.mid, '이펙트가 스스로 걷힘 (쌓이지 않음)',
    burst.after + '개 → ' + cleaned + '개');

  // ── 무명(無名)의 두 문 ─────────────────────────────────
  // 다른 자루는 문이 하나(층)인데 이것만 둘입니다 — 메달 셋과 120층.
  // 눈으로는 못 봅니다. 메달 개수를 0부터 넷까지 바꿔 가며 주머니를 받습니다.
  const gate = await page.evaluate(() => {
    const job = CLASSES[0];
    const was = JSON.parse(JSON.stringify(Save.data.perks || {}));
    const set = (n) => {
      const keys = ['coins', 'hp', 'armor', 'plus', 'haste'];
      Save.data.perks[job.key] = {};
      for (let i = 0; i < n; i++) Save.data.perks[job.key][keys[i]] = true;
    };
    const hasAt = (f) => weaponPoolAt(job, f).some(isNameless);
    const grid = [0, 1, 2, 3, 4].map((n) => {
      set(n);
      return { n, at: [0, 80, 119, 120, 200, 900, 1500].map((f) => ({ f, has: hasAt(f) })) };
    });
    // 도감은 그대로 스물다섯 칸이어야 합니다 — 문이 닫혀 있다고 칸이
    // 사라지면 「하나가 더 있다」는 것조차 안 보입니다.
    set(0);
    const book = buildWeaponPool(job).length;
    Save.data.perks = was;
    return { grid, book, want: CFG.weapon.namelessPerks };
  });
  const shut = gate.grid.filter((r) => r.n < gate.want);
  const open = gate.grid.filter((r) => r.n >= gate.want);
  check(shut.every((r) => r.at.every((a) => !a.has)),
    '메달 ' + gate.want + '개를 안 샀으면 무명은 어느 층에도 안 나옴',
    shut.map((r) => r.n + '개:' + r.at.filter((a) => a.has).length + '군데').join(' · '));
  check(open.every((r) => r.at.filter((a) => a.f < 120).every((a) => !a.has)),
    '메달을 다 샀어도 120층 아래에는 안 나옴',
    open.map((r) => r.n + '개:' + r.at.filter((a) => a.f < 120 && a.has).length + '군데').join(' · '));
  check(open.every((r) => r.at.filter((a) => a.f >= 120).every((a) => a.has)),
    '120층 위로는 **끝까지** 나옴 (창 규칙을 안 탐)',
    open.map((r) => r.n + '개:' + r.at.filter((a) => a.f >= 120 && a.has).length + '/' +
      r.at.filter((a) => a.f >= 120).length).join(' · '));
  check(gate.book === 25, '도감은 문이 닫혀 있어도 스물다섯 칸', gate.book + '칸');

  // ═══ 주워 든 자루가 견줄 만한가 ═══════════════════════════
  //
  // 필드와 상점에서 만나는 자루는 종류를 굴린 뒤 **강화를 얹어서** 나옵니다
  // (js/forge.js 의 withPickupGift · CFG.pickup).
  //
  // 예전에는 늘 맨 것(+0 · 속0 · ×1)이 나왔습니다. 종류는 층에 맞게 굴렀는데
  // 강화가 0이라, 쌓아 온 것이 통째로 격차가 됐습니다 — 후보 여덟이
  // **예외 없이** 지금 든 것의 ×0.36 ~ ×0.90 이었습니다. 갈아탈 이유가 셈으로
  // 아예 없었으니, 안 바꾼 것이 아니라 못 바꾼 것입니다.
  //
  // **오류가 안 나는 부류입니다.** 창은 멀쩡히 뜨고 숫자도 맞습니다. 그냥
  // 아무도 「바꾼다」를 안 누를 뿐입니다. 그래서 여기서 잽니다.

  const 주움 = await page.evaluate(() => {
    const 쌓임 = (f) => ({ plus: Math.min(10, Math.round(f / 45)),
      haste: Math.min(8, Math.round(f / 90)), mult: f >= 300 ? 2 : 1 });
    const out = [];
    for (const floor of [100, 300, 600]) {
      for (const key of ['warrior', 'archer', 'rogue', 'monk']) {
        const job = classByKey(key);
        const pool = buildWeaponPool(job);
        // 무명은 성격이 달라 (맨몸이 가장 약한 대신 +1 을 쉰까지) 흔한
        // 판을 못 봅니다. 보통 자루를 든 쪽으로 잽니다.
        const 열린 = pool.filter((w) => floor >= w.depth && w.forge && !isNameless(w));
        const me = new Weapon(job, pool.indexOf(열린[열린.length - 1]));
        const u = 쌓임(floor);
        me.plus = u.plus; me.haste = u.haste; me.mult = u.mult;

        const 비 = [];
        let 맨것 = 0, 든것보다셈 = 0;
        for (let i = 0; i < 120; i++) {
          const e = rollWeapon(job, floor, me);
          if (isNameless(e)) continue;
          const g = e.gift || {};
          비.push(me.dpsOf(e, false) / me.dps);
          if (!e.gift) 맨것++;
          // **속과 ×2 는 든 것을 넘으면 안 됩니다.** 그 둘은 자루가 아니라
          // 그 판에서 주운 것이라, 넘겨 주면 주운 적도 없는 것이 손에
          // 들어옵니다.
          //
          // `+1` 은 넘어도 됩니다 — 자루마다 걸음(plusStep)과 밑값이 달라서,
          // **약한 자루의 +8 이 센 자루의 +2 와 같은 세기**입니다. 칸 수를
          // 맞추면 오히려 세기가 어긋납니다. 세기는 아래 ×1.25 문턱이 봅니다.
          if ((g.haste || 0) > me.haste || (g.mult || 1) > me.mult) 든것보다셈++;
        }
        비.sort((a, b) => a - b);
        out.push({ floor, job: job.name, lo: 비[0], hi: 비[비.length - 1],
          mid: 비[Math.floor(비.length / 2)], 맨것, 든것보다셈, n: 비.length });
      }
    }
    return { out, band: CFG.pickup };
  });

  console.log('');
  const 다 = 주움.out.flatMap((r) => [r.lo, r.hi]);
  const 가운데들 = 주움.out.map((r) => r.mid);
  // 예전 값이 ×0.36 이었습니다. 그 언저리로 돌아가면 이 손질이 통째로
  // 풀린 것이므로, 문턱을 그 사이에 둡니다.
  check(Math.min(...다) >= 0.70,
    '**주운 자루가 반토막 나지 않음** (예전에는 ×0.36 까지 내려갔습니다)',
    '가장 낮은 것 ×' + Math.min(...다).toFixed(2));
  check(가운데들.every((m) => m >= 0.82 && m <= 1.15),
    '가운뎃값이 지금 든 것 언저리에 섬',
    '×' + Math.min(...가운데들).toFixed(2) + ' ~ ×' + Math.max(...가운데들).toFixed(2));
  check(Math.max(...다) <= 1.25,
    '그렇다고 대박이 나오지도 않음 (쌓아 온 것이 헛일이 되지 않게)',
    '가장 높은 것 ×' + Math.max(...다).toFixed(2));
  check(주움.out.every((r) => r.든것보다셈 === 0),
    '**속·×2 는 든 것을 안 넘음** (주운 적 없는 것이 손에 들어오지 않게)',
    주움.out.reduce((a, r) => a + r.든것보다셈, 0) + '개');
  // 100층은 아직 쌓은 것이 적어 맨 것이 섞여도 됩니다. 300층부터는
  // 맨 것이 나오면 그게 곧 예전의 그 문제입니다.
  const 깊은데 = 주움.out.filter((r) => r.floor >= 300);
  check(깊은데.every((r) => r.맨것 === 0),
    '깊은 층에서는 맨 자루(+0)가 안 나옴',
    깊은데.map((r) => r.floor + '층 ' + r.맨것 + '개').join(' · '));

  // 무명만은 벼려 주지 않습니다 — 「맨몸이 가장 약한 대신 +1 을 쉰까지」가
  // 그 자루의 전부라, 벼려진 채로 주면 그 자루가 아니게 됩니다.
  const 무명 = await page.evaluate(() => {
    const job = classByKey('warrior');
    const pool = buildWeaponPool(job);
    const me = new Weapon(job, pool.findIndex((w) => w.forge && w.depth >= 400));
    me.plus = 10; me.haste = 8; me.mult = 2;
    const 것 = pool.filter(isNameless).map((w) => withPickupGift(w, job, me));
    return { n: 것.length, 벼려진: 것.filter((w) => w.gift).length };
  });
  check(무명.n > 0 && 무명.벼려진 === 0,
    '**무명은 벼려 주지 않음** (맨몸이 가장 약한 것이 그 자루의 전부)',
    무명.n + '개 중 ' + 무명.벼려진 + '개');

  // ── 판이 실제로 벼려서 놓는가 ───────────────────────────
  //
  // **위의 것들은 rollWeapon 을 직접 불러서 잽니다.** 그러면 판이 그 함수를
  // 부를 때 `this.weapon` 을 안 넘기더라도 다 통과합니다 — 실제로 그
  // 되돌림을 시험해 봤더니 **하나도 안 걸렸습니다.**
  //
  // 그래서 발판 위의 자리를 진짜로 그려 보고(makeMark), 거기 놓인 자루가
  // 벼려져 있는지를 봅니다. 배선이 끊기면 여기가 걸립니다.
  const 판에서 = await page.evaluate(async () => {
    window.__game.scene.start('game', { jobKey: 'warrior' });
    await new Promise((r) => setTimeout(r, 900));
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    // 한참 벼려 든 사람으로 만들어 둡니다 — 맨몸이면 벼려 줄 것도 없습니다.
    s.weapon = new Weapon(s.job, pool.findIndex((w) => w.forge && w.depth >= 300));
    s.weapon.plus = 8; s.weapon.haste = 5; s.weapon.mult = 2;
    s.floorIndex = 400;
    for (let i = 398; i <= 404; i++) s.addFloor(i);
    const f = s.floors.get(401);
    const 자리 = LANES.map((l) => f.slots[l]).find(Boolean);
    // 그 자리를 무기 자리로 바꾸고 판이 그리게 합니다.
    자리.kind = SLOT.UPGRADE;
    자리.weapon = null;
    자리.index = 401;
    if (자리.view) { 자리.view.destroy(); 자리.view = null; }
    s.makeMark(자리);
    const w = 자리.weapon;
    return { 놓였나: !!w, 이름: w && w.name, gift: w && w.gift || null };
  });
  check(판에서.놓였나, '발판 위 무기 자리에 자루가 놓임', 판에서.이름);
  check(!!판에서.gift,
    '**판이 실제로 벼려서 놓음** (rollWeapon 에 든 자루를 넘기는가)',
    판에서.gift ? JSON.stringify(판에서.gift) : '맨 것이 놓였습니다');

  // 상점도 같은 배선입니다. **필드만 재면 상점 쪽이 끊겨도 다 통과합니다** —
  // 실제로 그 되돌림이 안 걸렸습니다. 코인까지 치르는 자리라 반토막이
  // 나오면 그 칸이 통째로 죽은 칸이 됩니다.
  const 상점에서 = await page.evaluate(async () => {
    window.__game.scene.start('game', { jobKey: 'archer' });
    await new Promise((r) => setTimeout(r, 900));
    const s = window.__scene;
    const pool = buildWeaponPool(s.job);
    s.weapon = new Weapon(s.job, pool.findIndex((w) => w.forge && w.depth >= 300));
    s.weapon.plus = 8; s.weapon.haste = 5; s.weapon.mult = 2;
    // 진열을 새로 차립니다. 같은 자루가 걸리면 상점이 안 내놓으므로
    // (shopWeapon 이 null) 몇 번 돌려 봅니다.
    for (let i = 0; i < 40; i++) {
      s.shop.show(400);
      s.shop.close && s.shop.close();
      if (s.shopWeapon) break;
    }
    return { 내놨나: !!s.shopWeapon, 이름: s.shopWeapon && s.shopWeapon.name,
      gift: (s.shopWeapon && s.shopWeapon.gift) || null };
  });
  check(상점에서.내놨나, '상점이 자루를 내놓음', 상점에서.이름);
  check(!!상점에서.gift,
    '**상점 자루도 벼려져서 나옴** (코인까지 치르는 자리입니다)',
    상점에서.gift ? JSON.stringify(상점에서.gift) : '맨 것이 나왔습니다');

  // 갈아타면 그 몫이 실제로 손에 들어와야 합니다. 창에만 적히고 안 붙으면
  // 「바꿨더니 약해졌다」가 됩니다 — 가장 나쁜 꼴입니다.
  const 붙나 = await page.evaluate(() => {
    const job = classByKey('warrior');
    const pool = buildWeaponPool(job);
    const w = new Weapon(job, pool.findIndex((x) => x.forge && x.depth >= 300));
    w.plus = 8; w.haste = 5; w.mult = 2;
    let e = null;
    for (let i = 0; i < 60 && !e; i++) {
      const r = rollWeapon(job, 400, w);
      if (r.gift && r.index !== w.index) e = r;
    }
    if (!e) return { 못찾음: true };
    const 적힌 = Object.assign({}, e.gift);
    w.swapTo(e);
    return { 적힌, 붙은: { plus: w.plus, haste: w.haste, mult: w.mult } };
  });
  check(!붙나.못찾음 && 붙나.적힌.plus === 붙나.붙은.plus
    && 붙나.적힌.haste === 붙나.붙은.haste && 붙나.적힌.mult === 붙나.붙은.mult,
    '**갈아타면 벼려진 몫이 그대로 손에 들어옴** (창에만 적히면 안 됩니다)',
    붙나.못찾음 ? '벼려진 자루를 못 찾음' : JSON.stringify(붙나.붙은));

  console.log(bad ? `\n${bad}건 어긋남` : '\n무기 그림·죽는 이펙트·주워 든 자루 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
