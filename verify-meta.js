// 메달과 무기 계승이 실제로 판을 넘어 이어지는지 브라우저에서 확인합니다.
// 죽음 화면의 세 갈래는 서로 배타적이라, 고르지 않은 쪽은 확실히 사라져야 합니다.
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
  const port = Number(process.env.PORT) || 8120;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const seed = async (data) => {
    await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
    await page.evaluate((d) => window.localStorage.setItem('tower-climb-v1', JSON.stringify(d)), data);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
  };
  const base = () => ({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, unlocked: {},
    medals: 0, weapons: {}, boosts: {}, lastJob: 'warrior', sawStory: true,
  });
  // 지금 실제로 돌아가는 장면. window.__scene은 넘어간 뒤에도 직전 장면을
  // 가리킨 채 남으므로 그것으로 판단하면 안 됩니다.
  const scene = () => page.evaluate(() =>
    window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','));
  const save = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__save.data)));

  // 직업 카드를 눌러 메달 상점으로. 카드는 y 288부터 210 간격입니다.
  const pickWarrior = () => page.mouse.click(...at(270, 288));

  // ── 1. 직업을 고르면 메달 상점을 거칩니다 ──────────────
  await seed(base());
  await pickWarrior();
  await page.waitForTimeout(700);
  check(await scene() === 'medal', '직업 → 메달 상점으로 넘어감', await scene());

  // 메달이 0이면 아무것도 못 삽니다.
  const rows = await page.evaluate(() => window.__medal.rows.map((r) => ({ x: r.box.x, y: r.box.y })));
  await page.mouse.click(...at(rows[0].x, rows[0].y));
  await page.waitForTimeout(200);
  check(Object.keys((await save()).boosts).length === 0, '메달 0개로는 아무것도 못 삼');

  // ── 2. 메달로 산 것은 판이 시작되면 실제로 붙습니다 ────
  await seed(Object.assign(base(), { medals: 5 }));
  await pickWarrior();
  await page.waitForTimeout(700);
  await page.mouse.click(...at(rows[0].x, rows[0].y)); // 튼튼한 몸 (1메달)
  await page.waitForTimeout(200);
  const afterBuy = await save();
  check(afterBuy.medals === 4 && afterBuy.boosts.hp === true,
    '메달을 쓰면 잔액이 줄고 예약됨', `메달 ${afterBuy.medals} · ${JSON.stringify(afterBuy.boosts)}`);

  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await page.waitForTimeout(900);
  const inGame = await page.evaluate(() => ({
    maxHp: window.__scene.maxHp, job: window.__scene.job.hp,
    boosts: window.__scene.boosts,
  }));
  check(inGame.maxHp === inGame.job + 40, '체력 +40이 실제로 붙음',
    `${inGame.job} → ${inGame.maxHp}`);
  check(Object.keys((await save()).boosts).length === 0,
    '산 것은 한 판 쓰고 비워짐 (일회성)');

  // ── 3. 죽음 화면 — 메달 받기 ──────────────────────────
  // 판을 억지로 끝냅니다. 상점 두 번 들른 셈 치고 메달 3개를 쥐여 줍니다.
  const die = (medals) => page.evaluate((m) => {
    const s = window.__scene;
    s.medals = m;
    s.floorIndex = 120;
    s.gameOver();
    return s.deathChoices.map((c) => ({ x: c.x, y: c.y }));
  }, medals);

  const choices = await die(3);
  check(choices.length === 3, '죽음 화면에 선택지 셋', choices.length);

  await page.mouse.click(...at(choices[0].x, choices[0].y)); // 1. 메달 받기
  await page.waitForTimeout(800);
  const afterMedal = await save();
  check(await scene() === 'medal' && afterMedal.medals === 4 + 3,
    '메달 받기 → 상점으로 가고 잔액에 더해짐',
    `${await scene()} · 메달 ${afterMedal.medals}`);

  // ── 4. 무기 계승 ──────────────────────────────────────
  // 도감에 좋은 무기를 하나 심어 두고, 그것을 들고 다시 시작하는지 봅니다.
  await seed(Object.assign(base(), {
    medals: 0, weapons: { warrior: { 3: { plus: 5, mult: 2 } } },
  }));
  await pickWarrior();
  await page.waitForTimeout(600);
  await page.mouse.click(...at((await page.evaluate(() => window.__medal.startAt)).x,
    (await page.evaluate(() => window.__medal.startAt)).y));
  await page.waitForTimeout(900);

  // 계승은 이제 무작위가 아니라 "이번 판에서 두 번째로 얻은 무기"로 고정입니다.
  // 그러려면 이 판에서 무기를 두 번은 손에 넣어야 합니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.upgrade(); s.noteWeapon();   // 둘째 무기
    s.weapon.addPlus(); s.weapon.addPlus();
    s.weapon.upgrade(); s.noteWeapon();   // 셋째 — 계승 대상이 아니어야 합니다
    s.weapon.haste = 9;                   // 속도는 넘어가면 안 됩니다
  });
  const choices2 = await die(2);
  const rolled = await page.evaluate(() => window.__scene.deathCarry);
  const got = await page.evaluate(() => window.__save.data.lastRun.got);
  check(rolled && rolled.tier === got[1].tier,
    '계승은 이번 판의 두 번째 무기로 고정',
    `얻은 순서 ${got.map((w) => w.tier).join('→')} · 계승 ${rolled && rolled.tier}단계`);
  await page.mouse.click(...at(choices2[1].x, choices2[1].y)); // 2. 무기 계승
  await page.waitForTimeout(1000);
  const carried = await page.evaluate(() => {
    const w = window.__scene.weapon;
    return { tier: w.tier, plus: w.plus, mult: w.mult, haste: w.haste, name: w.name };
  });
  check(await scene() === 'game' && carried.tier === rolled.tier &&
    carried.plus === rolled.plus,
    '고른 무기를 그대로 들고 새 판이 시작됨',
    `계승 ${JSON.stringify(rolled)} → ${carried.name} +${carried.plus}`);
  // 공격 속도는 무기가 아니라 손에 붙는 것이라 판이 끝나면 사라져야 합니다.
  check(carried.haste === 0 && carried.mult === 1,
    '공격 속도는 계승되지 않음 (무기에 붙는 것이 아님)',
    `속 ${carried.haste} · ×${carried.mult}`);
  check((await save()).medals === 0, '계승을 고르면 그 판의 메달은 버려짐', (await save()).medals);

  // ── 5. 이어서 진행하기 ────────────────────────────────
  // 상점에 한 번도 안 닿았으면 고를 수 없어야 합니다.
  const noShop = await page.evaluate(() => {
    const s = window.__scene;
    s.resumePoint = null;
    s.medals = 2;
    s.floorIndex = 30;
    s.gameOver();
    return s.deathChoices.length;
  });
  check(noShop === 3, '상점에 안 닿았어도 선택지는 셋 (세 번째는 잠김)', noShop);
  const stuck = await page.evaluate(() => {
    const c = window.__scene.deathChoices[2];
    return { x: c.x, y: c.y };
  });
  await page.mouse.click(...at(stuck.x, stuck.y));
  await page.waitForTimeout(600);
  check(await scene() === 'game' && await page.evaluate(() => window.__scene.dead) === true,
    '상점 없이 이어하기를 눌러도 아무 일이 없음', await scene());

  // 이제 상점을 한 번 지난 판을 흉내 냅니다.
  await page.evaluate(() => {
    const s = window.__scene;
    s.dead = false;
    s.floorIndex = 100;
    s.coins = 240; s.totalCoins = 700; s.armor = 55;
    // 상점에서 코인을 주고 산 것들 — 부적과 한계.
    s.charm = true; s.armorMax = 78; s.dodgeMax = 0.4;
    s.weapon.tier = 4; s.weapon.plus = 3; s.weapon.haste = 6;
    s.weapon.relics = [RELICS.find((r) => r.key === 'bloodcloak')];
    s.snapshotAtShop();       // 100층 상점을 나선 셈
    s.floorIndex = 137;       // 그 뒤로 더 올라가다가
    s.weapon.addPlus();       // 위층에서 주운 것들
    s.coins = 999;
    s.medals = 5;
    s.gameOver();
  });
  const before = await page.evaluate(() => ({
    medals: window.__save.medals, continues: window.__scene.continues,
  }));
  const c3 = await page.evaluate(() => {
    const c = window.__scene.deathChoices[2];
    return { x: c.x, y: c.y };
  });
  await page.mouse.click(...at(c3.x, c3.y));
  await page.waitForTimeout(1100);
  const resumed = await page.evaluate(() => {
    const s = window.__scene;
    return {
      scene: 'game', floor: s.floorIndex, coins: s.coins, armor: s.armor,
      medals: s.medals, continues: s.continues,
      charm: s.charm, armorMax: s.armorMax, dodgeMax: s.dodgeMax,
      tier: s.weapon.tier, plus: s.weapon.plus, haste: s.weapon.haste,
      relics: s.weapon.relics.map((r) => r.key),
      onShop: !!(s.floors.get(s.floorIndex) && s.floors.get(s.floorIndex).shop),
      shopOpen: s.shop.open,
    };
  });
  check(resumed.floor === 100 && resumed.onShop,
    '이어서 진행 → 마지막 상점 층에서 다시 시작', resumed.floor + '층 · 상점 발판 ' + resumed.onShop);
  check(!resumed.shopOpen, '이미 쓴 상점이 다시 열리지는 않음');

  // 상점에서 **코인을 주고 산 것**은 이어 갈 때도 따라와야 합니다.
  // 이걸 빠뜨렸더니 부적을 사고 죽어서 이어 가면 부적이 없었습니다 —
  // 값은 치렀는데 물건이 사라진 것이라, 밖에서 보면 "부적이 안 듣는다"입니다.
  check(resumed.charm === true && resumed.armorMax === 78 && resumed.dodgeMax === 0.4,
    '상점에서 산 부적과 한계도 그대로 따라옴',
    `부적 ${resumed.charm} · 방어한계 ${resumed.armorMax} · 회피한계 ${resumed.dodgeMax}`);
  check(resumed.tier === 4 && resumed.plus === 3 && resumed.haste === 6 &&
    resumed.coins === 240 && resumed.armor === 55 && resumed.relics.length === 1,
    '무기·강화·코인·방어·유물이 상점을 나서던 그대로',
    `${resumed.tier}단계 +${resumed.plus} 속${resumed.haste} · 코인 ${resumed.coins} · 방어 ${resumed.armor} · ${resumed.relics.join(',')}`);
  check(resumed.medals === 0 && (await save()).medals === before.medals,
    '이번 판에 번 메달은 버려짐 (쌓아 둔 것은 그대로)',
    `이번 판 ${resumed.medals} · 잔액 ${(await save()).medals}`);
  check(resumed.continues === 1, '이어하기 횟수가 하나 올라감', resumed.continues);

  // 두 번째까지는 되고, 세 번째는 잠겨야 합니다.
  const limit = await page.evaluate(() => {
    const s = window.__scene;
    s.snapshotAtShop();
    s.continues = CFG.continues.max;      // 이미 두 번 썼다고 치고
    s.resumePoint.continues = s.continues;
    s.medals = 3;
    s.gameOver();
    const box = s.deathChoices[2];
    return { max: CFG.continues.max, x: box.x, y: box.y };
  });
  await page.mouse.click(...at(limit.x, limit.y));
  await page.waitForTimeout(600);
  check(await page.evaluate(() => window.__scene.dead) === true,
    '두 번을 다 쓰면 더는 이어갈 수 없음', '최대 ' + limit.max + '번');

  console.log(bad ? `\n${bad}건 어긋남` : '\n메달·계승 흐름 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})();
