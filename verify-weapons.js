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
    weapons: {}, boosts: {}, relics: {}, unlocked: {}, lastJob: 'warrior',
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.mouse.click(...at(270, 278));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(...at(start.x, start.y));
  await page.waitForTimeout(900);

  // ── 서른여섯 자루가 모두 구워졌는가 ────────────────────
  const baked = await page.evaluate(() => {
    const s = window.__scene;
    const missing = [];
    let total = 0;
    CLASSES.forEach((job) => job.weapons.forEach((w, tier) => {
      total++;
      const key = weaponIconKey(job.key, tier);
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
    CLASSES.forEach((job) => job.weapons.forEach((w, tier) => {
      const src = s.textures.get(weaponIconKey(job.key, tier)).getSourceImage();
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      const sig = c.toDataURL();
      if (seen.has(sig)) dup++;
      seen.add(sig);
    }));
    return { unique: seen.size, dup };
  });
  check(distinct.dup === 0, '서른여섯 자루가 서로 다른 그림',
    '서로 다른 것 ' + distinct.unique + '개 · 겹친 것 ' + distinct.dup + '개');

  // ── HUD 에 지금 든 무기가 보이는가 ─────────────────────
  const hud = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.tier = 0;
    s.hud.update();
    const first = s.hud.weaponIcon.texture.key;
    s.weapon.tier = 6;
    s.hud.update();
    return { first, later: s.hud.weaponIcon.texture.key, want: weaponIconKey(s.job.key, 6) };
  });
  check(hud.first === 'w-warrior-0' && hud.later === hud.want,
    'HUD 그림이 지금 든 무기를 따라감', hud.first + ' → ' + hud.later);

  // ── 발판의 UP 이 다음 무기 그림인가 ────────────────────
  const mark = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.tier = 3;
    s.floorIndex = 40;
    const f = s.floorIndex + 1;
    s.removeFloor(f); s.addFloor(f);
    const floor = s.floors.get(f);
    const slot = floor.slots.mid;
    if (slot.view) { slot.view.destroy(); slot.view = null; }
    slot.kind = SLOT.UPGRADE;
    slot.taken = false; slot.expired = false; slot.upIcon = null;
    slot.view = s.makeMark(slot);
    floor.views.push(slot.view);

    const shown = slot.upIcon && slot.upIcon.texture.key;
    // 상점에서 무기를 한 단계 올리면 위층 그림도 따라 바뀌어야 합니다.
    s.weapon.tier = 4;
    s.updateItems(s.time.now);
    return { shown, want4: weaponIconKey(s.job.key, 4), after: slot.upIcon && slot.upIcon.texture.key,
      want5: weaponIconKey(s.job.key, 5) };
  });
  check(mark.shown === mark.want4, '발판의 UP 은 다음 단계 무기 그림', mark.shown);
  check(mark.after === mark.want5, '무기 단계가 오르면 위층 그림도 따라 바뀜',
    mark.shown + ' → ' + mark.after);

  // 마지막 무기를 들면 UP 은 회복이 되므로, 무기 그림이 남아 있으면 안 됩니다.
  const maxed = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.tier = s.job.weapons.length - 1;
    s.updateItems(s.time.now);
    const slot = s.floors.get(s.floorIndex + 1).slots.mid;
    return { icon: !!slot.upIcon, hasView: !!slot.view };
  });
  check(!maxed.icon && maxed.hasView, '마지막 무기를 들면 UP 그림이 회복 표시로 바뀜');

  // ── 죽는 이펙트 ────────────────────────────────────────
  const burst = await page.evaluate(() => {
    const s = window.__scene;
    s.weapon.tier = 0;
    const before = s.children.list.length;
    s.addFloor(s.floorIndex);
    const fl = s.floors.get(s.floorIndex);
    const slot = fl.slots.mid || fl.slots.left || fl.slots.right;
    const e = spawnEnemy(s, slot.x, slot.y - 120, s.floorIndex, 'flyer');
    e.hp = 1;
    // 이펙트는 전부 깊이 11~12에 놓입니다. 코인처럼 오래 남는 것과 섞이지 않게
    // 그 깊이만 세어야 "걷혔는가"를 제대로 볼 수 있습니다.
    const fx = () => s.children.list.filter((o) => o.depth === 11 || o.depth === 12).length;
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
    .filter((o) => o.depth === 11 || o.depth === 12).length);
  check(cleaned <= burst.mid, '이펙트가 스스로 걷힘 (쌓이지 않음)',
    burst.after + '개 → ' + cleaned + '개');

  console.log(bad ? `\n${bad}건 어긋남` : '\n무기 그림·죽는 이펙트 모두 맞음');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
