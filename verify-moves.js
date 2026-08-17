// 새 움직임이 실제로 도는지. 종류마다 한 마리씩 띄워 놓고 잠시 지켜봅니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/workspace/game';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
(async () => {
  await new Promise((r) => server.listen(8190, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8190/', { waitUntil: 'networkidle' });
  // 오프닝은 처음 켠 사람에게만 나옵니다. 여기서 보려는 것은 이동이므로 건너뜁니다.
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1',
    JSON.stringify({ sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.mouse.click(270 * .75, 278 * .75); await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x * .75, st.y * .75); await page.waitForTimeout(900);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

  const before = await page.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 560;
    CFG.enemyTypes.forEach((t, i) => {
      const e = spawnEnemy(s, 90 + (i % 3) * 175, s.player.y - 120 - Math.floor(i / 3) * 60, 560, t.key);
      if (e) e.__mark = t.key;
    });
    return s.enemies.getChildren().map((e) => ({ k: e.__mark, x: Math.round(e.x), y: Math.round(e.y) }));
  });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => window.__scene.enemies.getChildren()
    .map((e) => ({ k: e.__mark, x: Math.round(e.x), y: Math.round(e.y), phased: !!e.phased, ph: e.chargePhase || e.divePhase || '' })));

  const moved = {};
  before.forEach((b) => { const a = after.find((x) => x.k === b.k); moved[b.k] = a ? Math.hypot(a.x - b.x, a.y - b.y) : 'x'; });
  console.log('종류별로 2.5초 동안 움직인 거리 (x = 그 사이 죽음)');
  Object.entries(moved).forEach(([k, d]) => console.log('  ' + k.padEnd(10), typeof d === 'number' ? Math.round(d) + 'px' : d));
  console.log('\n상태를 가진 것들:', after.filter((a) => a.ph || a.phased).map((a) => a.k + ':' + (a.ph || 'phased')).join(' · ') || '(없음)');
  // 유령이 사라져 있는 동안은 노리는 대상에서 빠져야 합니다.
  const ghost = await page.evaluate(() => {
    const s = window.__scene;
    const g = s.enemies.getChildren().find((e) => e.def && e.def.key === 'ghost');
    if (!g) return { skip: true };
    g.phased = true;
    const hidden = s.targetable(g);
    g.phased = false;
    const shown = s.targetable(g);
    return { hidden, shown };
  });
  console.log('\n유령이 사라졌을 때 노려지는가:',
    ghost.skip ? '(유령 없음)'
      : (!ghost.hidden && ghost.shown ? 'OK — 사라지면 못 노리고, 나타나면 노림' : '틀림'));

  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close(); server.close();
})();
