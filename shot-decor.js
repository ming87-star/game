// 벽에 남은 것들이 실제 판에서 어떻게 보이는지 찍습니다.
// 층을 옮겨 가며 몇 장 — 흐린 것이 흐린 대로 보이는지, 발판과 안 겹치는지.
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, s) => {
  const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); s.end(b); });
});
const OUT = process.env.OUT_DIR || ROOT;
(async () => {
  await new Promise(r => server.listen(9930, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:9930/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 900, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, perks: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 8000 });
  await page.evaluate(() => window.__title.go());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 8000 });
  await page.waitForTimeout(900);

  for (const at of [70, 170, 203]) {
    const n = await page.evaluate((base) => {
      const s = window.__scene;
      s.enemies.getChildren().slice().forEach(e => e.destroy());
      s.floors.forEach((f, i) => { f.views.forEach(v => v.destroy()); s.floors.delete(i); });
      let 덩굴 = 0, 꽃 = 0;
      for (let i = base - 2; i <= base + 5; i++) {
        s.addFloor(i);
        const f = s.floors.get(i);
        if (!f) continue;
        f.views.forEach(v => { if (v.texture && v.texture.key === 'decor-vine') 덩굴++;
          if (v.texture && v.texture.key === 'decor-flower') 꽃++; });
      }
      s.floorIndex = base;
      const mid = s.floors.get(base).slots.mid || Object.values(s.floors.get(base).slots)[0];
      s.player.setPosition(mid.x, mid.y - 34);
      s.rig && s.rig.sync();
      s.scene.pause();
      s.cameras.main.centerOn(270, mid.y - 200);
      return { 덩굴, 꽃 };
    }, at);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `decor-${at}.png`) });
    console.log(`${at}층 언저리 — 덩굴 ${n.덩굴} · 꽃 ${n.꽃}`);
  }
  console.log(errs.length ? '오류: ' + errs.slice(0, 3).join(' | ') : '오류 없음');
  await br.close(); server.close();
})();
