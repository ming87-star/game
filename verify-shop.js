// ── 상점에 새로 들어온 셋 ────────────────────────────────
//
//   천리안     화면 밖 다음 아이템 하나를 알려 줍니다
//   막는 것 넷 그 놈의 짓을 세 번까지 없던 일로. 상점마다 도로 참
//   유물복권   가장 비싸고 절반은 꽝. 후반에 남는 코인을 태우는 자리
//
// 셋 다 **눈으로는 안 보이는 규칙**을 갖고 있어서 재야 합니다 — 아직 안 만든
// 층을 미리 굴려 보지는 않는지, 막은 뒤에 층을 안 잃는지, 진열이 열셋으로
// 불어나 단골을 밀어내지는 않는지.
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
  const port = Number(process.env.PORT) || 9614;
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

  // ── 1. 천리안 — 줄마다 하나씩, 화면에 이미 들어온 것은 뺌 ──
  const far = await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 120; s.lane = 'mid';
    for (let i = 117; i <= 130; i++) s.addFloor(i);
    // 앞으로 남은 열넷 칸을 줄마다 하나씩 심어서, 「줄마다 가장 가까운 것
    // 하나」가 실제로 지켜지는지 봅니다 (같은 줄에 둘을 심으면 가까운 쪽만
    // 나와야 합니다).
    // 층에 따라 길이 둘로 좁아지기도 합니다(가운데는 늘 있지만 좌우는
    // 아닙니다). **셋 다 있어야 재기가 됩니다** — blankSlot 으로 없는 자리를
    // 채워 넣습니다.
    for (let i = s.floorIndex + 1; i <= s.floorIndex + 7; i++) {
      const f = s.floors.get(i);
      if (!f) continue;
      LANES.forEach((l) => { f.slots[l] = blankSlot(i, l, 'empty'); });
    }
    const put = (up, lane, kind, disguise) => {
      const f = s.floors.get(s.floorIndex + up);
      f.slots[lane].kind = kind;
      if (disguise) f.slots[lane].disguise = disguise;
    };
    put(2, 'left', 'plus');
    put(5, 'left', 'heal');   // left 는 2층 위 것만 잡혀야 합니다 (더 가까움)
    put(3, 'mid', 'mimic', 'heal'); // 미믹은 겉모습(heal)으로 나와야 합니다
    put(2, 'right', 'plus');  // 뒤가 없는 하나 — 화면에 들어오면 그냥 사라져야 합니다

    const at = s.nextItemsByLane();

    // **아직 안 만든 층은 안 봅니다.** 거기서 굴려 보면 그때 나온 것과 실제로
    // 갈 때 나오는 것이 달라져서, 미리 보여 준 것이 거짓말이 됩니다.
    const madeUpTo = Math.max(...[...s.floors.keys()]);

    // **화면에 이미 들어온 것은 뺍니다.** 카메라를 그 칸이 보이는 자리까지
    // 바짝 올려 두고 다시 물어봅니다.
    //   right (뒤가 없음)  → null 이 되어야 합니다
    //   left  (뒤에 5층 위 것이 하나 더 있음) → 다음 것(5층 위)으로 넘어가야
    //         합니다. 진짜 표식이라면 하나가 화면에 들어왔다고 줄 전체가
    //         꺼지면 안 되고, 다음으로 가까운 것을 이어서 알려야 합니다.
    s.cameras.main.setScroll(0, s.floors.get(s.floorIndex + 2).slots.left.y - 200);
    const nearCam = s.nextItemsByLane();

    return {
      leftUp: at.left && at.left.up, leftKind: at.left && at.left.kind,
      midUp: at.mid && at.mid.up, midKind: at.mid && at.mid.kind,
      right: at.right,
      madeUpTo, ahead: madeUpTo - s.floorIndex,
      nearRight: nearCam.right,
      nearLeft: nearCam.left,
    };
  });
  check(far.leftUp === 2 && far.leftKind === 'plus',
    '줄마다 **가장 가까운 것 하나만** — 2층·5층에 둘을 심으면 2층 것만 나옴',
    'left ' + far.leftUp + '층 위 · ' + far.leftKind);
  check(far.midKind === 'heal',
    '미믹은 **겉모습 그대로** — 천리안도 지도와 똑같이 속습니다',
    '「회복」인 척한 미믹을 심었더니 ' + far.midKind + ' 으로 보임');

  check(far.leftUp <= far.ahead,
    '아직 안 만든 층은 안 봄 (미리 보여 준 것이 거짓말이 되면 안 됩니다)',
    '만들어 둔 데까지 ' + far.ahead + '층 위');
  check(!far.nearRight,
    '화면에 실제로 들어온 것은 표에서 빠짐 (뒤가 없으면 그냥 사라짐)');
  check(far.nearLeft && far.nearLeft.kind === 'heal' && far.nearLeft.up > far.leftUp,
    '가까운 것이 화면에 들어오면 **다음으로 가까운 것**을 이어서 알려 줌',
    far.leftUp + '층 위(plus) → ' + (far.nearLeft && far.nearLeft.up) + '층 위(' +
    (far.nearLeft && far.nearLeft.kind) + ')');

  // ── 1-2. HUD 의 줄 표식 ──────────────────────────────────
  const beacon = await page.evaluate(() => {
    const s = window.__scene;
    // 앞선 시험이 right 줄에 심어 둔 것을 치웁니다 — 여기서는 「아무것도
    // 없는 줄」로 다시 씁니다.
    s.floors.get(s.floorIndex + 2).slots.right.kind = 'empty';
    s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.68); // 되돌립니다
    s.farsight = true; s.bossFight = false;
    s.hud.update();
    const shown = s.hud.farIcons.map((b) => b.ring.visible);
    s.farsight = false;
    s.hud.update();
    const hiddenAfterOff = s.hud.farIcons.every((b) => !b.ring.visible);
    s.farsight = true; s.bossFight = true;   // 투기장에서는 접힘
    s.hud.update();
    const hiddenInBoss = s.hud.farIcons.every((b) => !b.ring.visible);
    s.bossFight = false;
    return { shown, hiddenAfterOff, hiddenInBoss };
  });
  check(beacon.shown[0] && beacon.shown[1] && !beacon.shown[2],
    'HUD 표식이 줄마다 따로 뜸 (왼쪽·가운데 있음 · 오른쪽 없음)',
    beacon.shown.join(' · '));
  check(beacon.hiddenAfterOff, '천리안을 안 샀으면 표식이 다 접힘');
  check(beacon.hiddenInBoss, '투기장에서는 접힘 (줄도 아이템도 없는 자리라서)');

  // ── 2. 막는 것 ──────────────────────────────────────────
  const ward = await page.evaluate(() => {
    const s = window.__scene;
    s.dead = false; s.hp = s.maxHp = 400;
    s.floorIndex = 300; s.lane = 'mid';
    for (let i = 297; i <= 310; i++) s.addFloor(i);
    const f = s.floors.get(300);
    const here = f.slots.mid || LANES.map((l) => f.slots[l]).find(Boolean);
    s.player.setPosition(here.x, here.y - 34);
    s.enemies.getChildren().slice().forEach((x) => x.destroy());
    CFG.enemyTypes.forEach((t) => s.seenTypes.add(t.key));
    const e = spawnEnemy(s, here.x, here.y - 50, 300, 'shover');

    s.wards = { shover: CFG.foes.ward.charges };
    const was = s.floorIndex;
    s.shoveDown(e);                        // 첫 번째 — 막혀야 합니다
    const afterBlock = { floor: s.floorIndex, left: s.wards.shover };
    // 남은 것을 다 씁니다
    s.hurt(100, e); s.hurt(100, e);
    const spent = s.wards.shover;
    const hp0 = s.hp;
    s.lastHitAt = 0;
    s.hurt(100, e);                        // 다 썼으니 이제 들어옵니다
    const through = hp0 - s.hp;
    e.destroy();
    return { was, afterBlock, spent, through, charges: CFG.foes.ward.charges };
  });
  check(ward.afterBlock.floor === ward.was,
    '「박은 신」은 **밀리는 것 자체**를 막음 (피해만 막으면 층은 그대로 잃습니다)',
    ward.was + '층 그대로');
  check(ward.afterBlock.left === ward.charges - 1, '한 번 쓰면 하나 줄어듦',
    ward.charges + ' → ' + ward.afterBlock.left);
  check(ward.spent === 0 && ward.through > 0, '다 쓰면 그다음부터는 그대로 맞음',
    '남은 ' + ward.spent + ' · 들어온 피해 ' + ward.through);

  // ── 3. 진열 ─────────────────────────────────────────────
  const shelf = await page.evaluate(() => {
    const s = window.__scene;
    s.wards = {}; s.farsight = false; s.charm = false;
    const roll = (floor) => {
      s.floorIndex = floor;
      const out = { ward: 0, lottery: 0, far: 0, plus: 0, heal: 0, wardKeys: new Set() };
      for (let i = 0; i < 400; i++) {
        const offers = s.shop.rollOffers(Math.floor(floor / CFG.shopEvery));
        offers.forEach((o) => {
          if (o.key === 'ward') { out.ward++; out.wardKeys.add(o.ward); }
          if (o.key === 'lottery') out.lottery++;
          if (o.key === 'farsight') out.far++;
          if (o.key === 'plus') out.plus++;
          if (o.key === 'heal') out.heal++;
        });
        // 한 진열에 「막는 것」이 둘 이상 뜨면 한 칸을 나눠 쓰는 것이 아닙니다
        if (offers.filter((o) => o.key === 'ward').length > 1) out.twice = true;
      }
      out.wardKeys = [...out.wardKeys];
      return out;
    };
    const low = roll(300);      // 복권이 아직 안 뜨는 층
    const high = roll(900);     // 다 뜨는 층
    s.wards = { shover: 3, slammer: 3, lancer: 3, zapper: 3 };
    const owned = roll(900);    // 넷을 다 산 뒤
    s.wards = {};
    return { low, high, owned, from: CFG.shop.lottery.from };
  });
  check(shelf.low.lottery === 0, '유물복권은 ' + shelf.from + '층 아래에서는 안 뜸',
    '300층에서 ' + shelf.low.lottery + '번');
  check(shelf.high.lottery > 0, '그 위에서는 뜸', '900층에서 400판 중 ' + shelf.high.lottery + '번');
  check(!shelf.high.twice, '「막는 것」은 한 진열에 하나까지 (한 칸을 나눠 씁니다)');
  check(shelf.high.wardKeys.length === 4, '넷이 돌아가며 뜸', shelf.high.wardKeys.join(' · '));
  check(shelf.owned.ward === 0, '넷을 다 사면 그 칸이 사라짐', shelf.owned.ward + '번');
  // 단골이 밀려나지 않는지 — 후보가 늘어난 만큼은 줄지만 절반은 넘어야 합니다.
  check(shelf.high.plus / 400 > 0.4 && shelf.high.heal / 400 > 0.4,
    '+1 과 회복이 여전히 자주 뜸 (새 물건에 밀려나지 않음)',
    '+1 ' + Math.round(shelf.high.plus / 4) + '% · 회복 ' + Math.round(shelf.high.heal / 4) + '%');

  // ── 4. 복권 ─────────────────────────────────────────────
  const lotto = await page.evaluate(() => {
    const s = window.__scene;
    s.pendingRelics = 0;
    let won = 0;
    const marks = [];
    for (let i = 0; i < 2000; i++) {
      const before = s.pendingRelics;
      applyShopEffect(s, 'lottery', { mark: (w) => marks.push(w) });
      if (s.pendingRelics > before) won++;
    }
    const got = s.pendingRelics;
    s.pendingRelics = 0;
    return { won, got, marks: marks.length, want: CFG.shop.lottery.chance };
  });
  check(Math.abs(lotto.won / 2000 - lotto.want) < 0.04, '유물복권 당첨이 정해진 확률',
    Math.round(lotto.won / 20) + '% (' + Math.round(lotto.want * 100) + '% 예상)');
  check(lotto.got === lotto.won, '당첨된 만큼 쌓임 (상점을 나설 때 하나씩 엽니다)',
    lotto.got + '개');
  check(lotto.marks === 2000, '이겼든 졌든 **그 줄에 결과가 적힘** (꽝도 보여야 합니다)',
    lotto.marks + '/2000');

  console.log(bad ? `\n${bad}건 어긋남` : '\n상점의 새 물건 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
