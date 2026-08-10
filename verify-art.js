// 그림이 실제로 게임에 붙었는지 확인합니다.
//
// 이 검사가 필요한 이유: 그림이 안 붙으면 게임은 **아무 일 없이 잘 돕니다.**
// 도형으로 조용히 되돌아갈 뿐이라 오류도 안 나고 화면도 그럴듯합니다.
// 키 이름을 하나 잘못 적은 것을 사람 눈으로 잡으려면 스무 장을 다 봐야 합니다.
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
  const port = Number(process.env.PORT) || 9680;
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

  // ── 다 구워졌는가, 그리고 제 크기인가 ──────────────────
  const baked = await page.evaluate(() => {
    const s = window.__scene;
    const out = { total: 0, missing: [], wrongSize: [] };
    Object.keys(ART_SVG).forEach((key) => {
      out.total++;
      if (!s.textures.exists(key)) { out.missing.push(key); return; }
      const img = s.textures.get(key).getSourceImage();
      const a = ART_SVG[key];
      // 게임 픽셀 = 그림 픽셀이어야 지금까지의 충돌·사거리 계산이 맞습니다.
      if (img.width !== a.w || img.height !== a.h) {
        out.wrongSize.push(`${key} ${img.width}×${img.height} (${a.w}×${a.h} 여야 함)`);
      }
    });
    return out;
  });
  check(baked.missing.length === 0, '그림이 다 구워짐',
    baked.total + '장 중 빠진 것 ' + (baked.missing.join(', ') || '없음'));
  check(baked.wrongSize.length === 0, '게임 픽셀 = 그림 픽셀 (1배)',
    baked.wrongSize.join(' · ') || '전부 맞음');

  // ── 도형이 그림을 덮어쓰지 않았는가 ────────────────────
  // generateTexture 는 캔버스를, load.svg 는 이미지를 남깁니다. 그래서 이걸로
  // "지금 화면에 있는 것이 그림인지 도형인지"를 가릴 수 있습니다.
  const source = await page.evaluate(() => {
    const s = window.__scene;
    const kindOf = (key) => {
      if (!s.textures.exists(key)) return '없음';
      const img = s.textures.get(key).getSourceImage();
      return (img && img.tagName === 'CANVAS') ? '도형' : '그림';
    };
    return {
      art: ['player-warrior', 'e-crawler', 'e-flyer', 'wall', 'plat'].map((k) => k + '=' + kindOf(k)),
      // 아직 안 그린 것은 도형이 맡고 있어야 합니다 — 빈칸이면 안 됩니다.
      shape: ['e-dasher', 'bat-thief', 'coin'].map((k) => k + '=' + kindOf(k)),
    };
  });
  check(source.art.every((x) => x.endsWith('그림')), '그려 둔 것은 그림이 쓰임',
    source.art.join(' · '));
  check(source.shape.every((x) => x.endsWith('도형')), '안 그린 것은 도형이 자리를 지킴',
    source.shape.join(' · '));

  // ── 충돌 상자가 그대로인가 ─────────────────────────────
  // 그림을 크게 굽고 화면에서만 줄이면 여기가 조용히 어긋납니다.
  const bodies = await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 40;
    s.addFloor(s.floorIndex);
    const fl = s.floors.get(s.floorIndex);
    const slot = fl.slots.mid || fl.slots.left || fl.slots.right;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const ground = spawnEnemy(s, slot.x, slot.y - 40, 40, 'crawler');
    const air = spawnEnemy(s, slot.x, slot.y - 120, 40, 'flyer');
    return {
      player: Math.round(s.player.body.width) + '×' + Math.round(s.player.body.height),
      ground: Math.round(ground.body.width) + '×' + Math.round(ground.body.height),
      airRadius: Math.round(air.body.radius),
      groundDisplay: Math.round(ground.displayWidth),
    };
  });
  check(bodies.player === '26×40', '주인공 충돌 상자가 그대로', bodies.player);
  check(bodies.ground === '32×32', '땅 적의 상자가 그림 크기와 같음', bodies.ground);
  check(bodies.airRadius === 18, '나는 적의 원이 그림 크기와 같음', bodies.airRadius);

  // ── 보스는 층마다 차례로 ───────────────────────────────
  const rota = await page.evaluate(() => {
    const floors = [200, 400, 600, 800, 1000, 1200];
    return floors.map((f) => f + ' ' + bossKindFor(f).name);
  });
  check(rota.length === 6 && rota[0].includes('수문장') && rota[5].includes('수문장'),
    '보스가 층마다 차례로 (다섯을 돌고 되풀이)', rota.join(' · '));

  const bossArt = await page.evaluate(() => {
    const s = window.__scene;
    const out = [];
    CFG.boss.kinds.forEach((k) => {
      out.push(k.key + (s.textures.exists(k.key) ? '' : ' 없음') +
        '/' + k.shot + (s.textures.exists(k.shot) ? '' : ' 없음'));
    });
    return out;
  });
  check(!bossArt.some((x) => x.includes('없음')), '다섯 놈과 탄 다섯이 다 있음',
    bossArt.length + '쌍');

  // 실제로 세워 보고, 그 놈의 그림과 그 놈의 탄이 붙는지 봅니다.
  const spawned = await page.evaluate(() => {
    const s = window.__scene;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());
    const out = [];
    [200, 400, 600].forEach((f) => {
      const b = spawnBoss(s, f, 270, 300);
      out.push(f + ' ' + b.texture.key + ' / ' + b.shotKey + ' / ' + b.def.name);
      b.destroy();
    });
    return out;
  });
  check(spawned[0].includes('boss-warden') && spawned[1].includes('boss-gazer') &&
    spawned[2].includes('boss-crusher') && spawned[1].includes('boss-shot-gazer'),
    '세운 보스의 그림·탄·이름이 그 놈의 것', spawned.join(' | '));

  // ── 벽과 발판이 화면에 있는가 ──────────────────────────
  const scenery = await page.evaluate(() => {
    const s = window.__scene;
    const fl = s.floors.get(s.floorIndex);
    const lane = LANES.find((l) => fl.slots[l]);
    const deck = fl.slots[lane].deck[0];
    return {
      wall: !!(s.wall && s.wall.texture && s.wall.texture.key === 'wall'),
      deck: deck && deck.texture ? deck.texture.key : '(네모)',
    };
  });
  check(scenery.wall, '탑 안쪽 벽이 그림으로 깔림');
  check(scenery.deck === 'plat', '발판이 그림으로 깔림', scenery.deck);

  console.log(bad ? `\n${bad}건 어긋남` : '\n그림이 제자리에 다 붙었습니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
