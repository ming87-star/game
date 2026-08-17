// assets/ 의 그림을 게임에 끼워 넣고, 지금 도형과 나란히 찍습니다.
// 그림은 흰 종이 위가 아니라 실제 탑 안에서 봐야 판단이 됩니다.
//
// 요령: 판을 **세워 두고** 그림만 갈아 끼웁니다. 두 장 사이에 적이 움직이거나
// 주인공이 칼을 휘두르면 배치가 달라져서, 무엇이 그림 덕인지 알 수가 없습니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

// 그림의 원래 크기. 4배로 구워져 있으므로 게임에서는 이 크기로 줄여 씁니다.
const SIZES = {
  'player-warrior': [38, 48],
  'player-archer': [42, 48],
  'player-rogue': [40, 48],
  'e-crawler': [32, 32],
  'e-hopper': [34, 32],
  'e-flyer': [36, 32],
  'e-brute': [32, 34],
};
const CLIP = { x: 40, y: 560, width: 460, height: 190 };

(async () => {
  const port = 9838;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.mouse.click(270, 288);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  // ── 그림을 먼저 불러다 놓고, 자리를 잡고, 판을 세웁니다 ──
  // 불러오기(async)는 판을 세우기 전에 끝내야 합니다. 멈춘 판 위에서 기다리면
  // 그 약속이 영영 안 풀립니다.
  const swapped = await page.evaluate(async (sizes) => {
    const s = window.__scene;

    // 쓰던 키를 지웠다가 다시 넣으면 렌더러가 그 자리에서 무너집니다
    // (화면이 통째로 비어 버립니다). 새 키로 넣어 두고 나중에 갈아 끼웁니다.
    const load = (key) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { s.textures.addImage('nx-' + key, img); res(key); };
      img.onerror = () => rej(new Error(key));
      img.src = '/assets/' + key + '.png';
    });
    const keys = Object.keys(sizes);
    for (const k of keys) await load(k);

    s.floorIndex = 120; s.lane = 'mid';
    for (let i = s.floorIndex; i <= s.floorIndex + 7; i++) s.addFloor(i);
    const slot = s.floors.get(s.floorIndex).slots.mid || s.floors.get(s.floorIndex).slots.left;
    s.enemies.getChildren().slice().forEach((e) => e.destroy());

    const made = [];
    [[-165, 'crawler', -22], [-100, 'hopper', -22], [-30, 'brute', -24],
     [70, 'flyer', -70], [145, 'flyer', -100]]
      .forEach(([dx, kind, dy]) => {
        const e = spawnEnemy(s, slot.x + dx, slot.y + dy, 120, kind);
        if (e) { e.body.setAllowGravity(false); e.body.velocity.set(0, 0); e.hp = 1e9; made.push(e); }
      });
    s.__staged = made;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - 960 * 0.68);
    s.scene.pause();

    // 세우기 직전에 걸려 있던 것들을 걷습니다 — 맞은 흰 섬광, 휘두르던 칼자국,
    // 떠 있던 숫자. 안 걷으면 적이 흰 덩어리로 찍혀 그림을 볼 수가 없습니다.
    s.enemies.getChildren().forEach((e) => {
      e.clearTint();
      if (e.setTintMode) e.setTintMode(Phaser.TintModes.MULTIPLY);
    });
    s.children.list.slice()
      .filter((o) => o.depth >= 11 && o.depth <= 120)
      .forEach((o) => o.destroy());
    s.bullets.clear(true, true);
    return { keys };
  }, SIZES);
  await page.waitForTimeout(300);

  const shoot = async (tag) => {
    await page.screenshot({ path: path.join(ROOT, `shots/art-${tag}.png`) });
    await page.screenshot({ path: path.join(ROOT, `shots/art-${tag}-zoom.png`), clip: CLIP });
  };
  await shoot('before');

  // ── 그림만 갈아 끼웁니다 (판은 이미 멈춰 있습니다) ────
  const shown = await page.evaluate((sizes) => {
    const s = window.__scene;
    const [pw, ph] = sizes['player-warrior'];
    s.player.setTexture('nx-player-warrior').setDisplaySize(pw, ph);
    (s.__staged || []).forEach((e) => {
      const key = 'e-' + e.def.key;
      if (!sizes[key]) return;
      const [w, h] = sizes[key];
      const k = e.def.scale || 1;
      e.setTexture('nx-' + key).setDisplaySize(w * k, h * k);
    });
    return (s.__staged || []).map((e) =>
      `${e.texture.key} ${Math.round(e.displayWidth)}×${Math.round(e.displayHeight)}`);
  }, SIZES);

  await page.waitForTimeout(300);
  await shoot('after');

  // ── 나란히 ────────────────────────────────────────────
  const b64 = (f) => 'data:image/png;base64,' +
    fs.readFileSync(path.join(ROOT, 'shots', f)).toString('base64');
  const sheet = await browser.newPage({ viewport: { width: 1140, height: 1500 }, deviceScaleFactor: 1 });
  await sheet.setContent(`<style>
      html,body{margin:0;background:#0d1120;font-family:sans-serif;color:#8794b5}
      .row{display:flex;gap:20px;padding:16px 20px 0}
      figure{margin:0}
      figcaption{text-align:center;font-size:15px;padding:8px 0}
      img{display:block;width:540px;border:1px solid #2a3252}
      b{color:#cfd8dc}
    </style>
    <div class="row">
      <figure><img src="${b64('art-before.png')}"><figcaption>지금 — 코드로 그린 도형</figcaption></figure>
      <figure><img src="${b64('art-after.png')}"><figcaption><b>SVG로 그린 것</b></figcaption></figure>
    </div>
    <div class="row">
      <figure><img src="${b64('art-before-zoom.png')}"><figcaption>싸우는 자리 — 지금</figcaption></figure>
      <figure><img src="${b64('art-after-zoom.png')}"><figcaption><b>싸우는 자리 — SVG</b></figcaption></figure>
    </div>`);
  await sheet.waitForTimeout(250);
  await sheet.screenshot({ path: path.join(ROOT, 'shots/art-compare.png') });

  console.log('바꿔 낀 그림: ' + swapped.keys.join(', '));
  console.log('게임 안 크기: ' + shown.join(' | '));
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close(); server.close();
})();
