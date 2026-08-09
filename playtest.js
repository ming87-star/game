// 헤드리스 브라우저로 게임을 실제로 굴려보고 화면을 찍습니다.
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

const shot = (page, name) => page.screenshot({ path: path.join(ROOT, 'shots', name) });

(async () => {
  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  await new Promise((r) => server.listen(8099, r));

  // CHROME_PATH가 있으면 그 브라우저를 쓰고, 없으면 playwright가 받아둔 것을 씁니다.
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, '01-start.png');

  const box = { w: 405, h: 720 };
  const read = () => page.evaluate(() => {
    const s = window.__scene;
    if (!s) return null;
    const next = s.floors.get(s.floorIndex + 1);
    const kindOf = (lane) => (next && next.slots[lane] ? next.slots[lane].kind : null);
    return {
      floor: s.floorIndex, hp: Math.round(s.hp), kills: s.kills,
      weapon: CFG.weapons[s.weaponLevel].name, enemies: s.enemies.countActive(),
      dead: s.dead, score: s.score(),
      left: kindOf('left'), right: kindOf('right'),
    };
  });

  // 사람처럼 고르는 가상 플레이어: 체력이 낮으면 회복, 아니면 아이템을 우선합니다.
  const rank = (kind, hp) => {
    if (kind === null) return -1;
    if (kind === 'heal') return hp < 60 ? 4 : 1;
    if (kind === 'item') return 3;
    if (kind === 'empty') return 2;
    return 0; // enemy
  };

  const log = [];
  for (let i = 0; i < 45; i++) {
    const s = await read();
    if (!s || s.dead) { log.push(`${i}회차: 사망 (${s && s.floor}층)`); break; }
    const left = rank(s.left, s.hp) >= rank(s.right, s.hp);
    await page.mouse.click(left ? box.w * 0.25 : box.w * 0.75, box.h * 0.6);
    await page.waitForTimeout(560);
    if (i % 10 === 9) {
      const t = await read();
      log.push(`${t.floor}층  HP ${t.hp}  처치 ${t.kills}  적 ${t.enemies}  ${t.weapon}  점수 ${t.score}`);
    }
    if (i === 6) await shot(page, '02-climb.png');
    if (i === 24) await shot(page, '03-combat.png');
  }
  await page.waitForTimeout(1500);
  await shot(page, '04-late.png');

  const state = await read();
  console.log(log.join('\n'));
  console.log('최종:', JSON.stringify(state));
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');

  await browser.close();
  server.close();
})();
