// 무기 그림 서른여섯 자루를 한 판에 늘어놓고 눈으로 확인하는 도구.
// 흰 외곽선 하나로 통일했으므로, 실루엣만으로 갈리는지가 볼 것의 전부입니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

(async () => {
  const port = 9834;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior', sawStory: true })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 직업 고르기 → 메달 상점 → 시작
  await page.mouse.click(270, 288);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  await page.waitForTimeout(900);

  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  let missing = [];

  for (const jobKey of ['warrior', 'archer', 'rogue']) {
    const gone = await page.evaluate((key) => {
      const s = window.__game.scene.getScenes(true)[0];
      if (s.__sheet) s.__sheet.forEach((o) => o.destroy());
      const put = (o) => { s.__sheet.push(o.setScrollFactor(0).setDepth(900)); return o; };
      s.__sheet = [];

      const job = classByKey(key);
      const gone2 = [];
      put(s.add.rectangle(0, 0, 540, 960, 0x0d1120).setOrigin(0, 0));
      put(s.add.text(270, 24, job.name + ' — 무기 그림 — 단계마다 색과 모양이 다릅니다', {
        fontFamily: 'sans-serif', fontSize: '24px', color: '#ffffff',
      }).setOrigin(0.5));

      job.weapons.forEach((w, tier) => {
        const id = weaponIconKey(job.key, tier);
        if (!s.textures.exists(id)) { gone2.push(id); return; }
        const x = 90 + (tier % 3) * 180, y = 120 + Math.floor(tier / 3) * 215;
        put(s.add.circle(x, y, 62, 0x232b47).setStrokeStyle(2, 0x3f4a78));
        put(s.add.image(x, y, id).setDisplaySize(110, 110));
        put(s.add.text(x, y + 78, w.name, {
          fontFamily: 'sans-serif', fontSize: '18px', color: '#cfd8dc',
        }).setOrigin(0.5));
      });
      return gone2;
    }, jobKey);
    missing = missing.concat(gone);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ROOT, 'shots/weapon-icons-' + jobKey + '.png') });
  }

  console.log(missing.length ? '빠진 그림: ' + missing.join(', ') : '서른여섯 자루 모두 구워졌습니다.');
  if (errors.length) console.log('오류: ' + errors.join(' | '));
  await browser.close();
  server.close();
})();
