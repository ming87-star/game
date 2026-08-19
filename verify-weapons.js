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
  await page.mouse.click(...at(270, 278));
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

  console.log(bad ? `\n${bad}건 어긋남` : '\n무기 그림·죽는 이펙트 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
