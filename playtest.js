// 헤드리스 브라우저로 게임을 실제로 굴려보고 화면을 찍습니다.
//   node playtest.js          기본 60번 점프
//   node playtest.js 120      더 높이
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

// 게임 해상도와 뷰포트 비율이 같아서 좌표를 그냥 배율로 환산하면 됩니다.
const VIEW = { width: 405, height: 720 };
const SCALE = VIEW.width / 540;
const at = (gx, gy) => [gx * SCALE, gy * SCALE];

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
  const jumps = Number(process.argv[2]) || 60;
  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  await new Promise((r) => server.listen(8099, r));

  // CHROME_PATH가 있으면 그 브라우저를 쓰고, 없으면 playwright가 받아둔 것을 씁니다.
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEW });

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, '01-start.png');

  const read = () => page.evaluate(() => {
    const s = window.__scene;
    if (!s) return null;
    const next = s.floors.get(s.floorIndex + 1);
    const kindOf = (lane) => (next && next.slots[lane] ? next.slots[lane].kind : null);
    return {
      floor: s.floorIndex, hp: Math.round(s.hp), maxHp: s.maxHp,
      kills: s.kills, coins: s.coins, totalCoins: s.totalCoins,
      weapon: s.weapon.name, plus: s.weapon.plus, mult: s.weapon.mult,
      dmg: s.weapon.dmg, shots: s.weapon.shots,
      // UP이 실제로 이득인지. 강화를 잃고도 화력이 오르는가로 판단합니다.
      upWorth: (() => {
        const w = s.weapon, next = CFG.weapons[w.tier + 1];
        if (!next) return false;
        // 발사체는 서로 다른 적에게 날아갑니다. 단단한 적 하나를 상대할 때는
        // 4발이 4배가 아니므로, 두 번째 발부터는 절반 값으로 셉니다.
        const power = (dmg, shots, rate) => dmg / rate * (1 + (shots - 1) * 0.5);
        return power(next.dmg, next.shots, next.rate) > power(w.dmg, w.shots, w.rate);
      })(),
      enemies: s.enemies.countActive(), dead: s.dead, shopOpen: s.shop.open,
      score: s.score(),
      left: kindOf('left'), right: kindOf('right'),
    };
  });

  // 사람처럼 고르는 가상 플레이어.
  // UP은 손해일 때가 있어서, 이득일 때만 노립니다. 무조건 먹는 플레이어로
  // 재면 밸런스가 실제보다 나쁘게 나옵니다.
  const rank = (kind, s) => {
    if (kind === null) return -1;
    if (kind === 'heal') return s.hp < s.maxHp * 0.6 ? 6 : 1;
    if (kind === 'double') return 5;
    if (kind === 'upgrade') return s.upWorth ? 4 : 1;
    if (kind === 'plus') return 3;
    if (kind === 'empty') return 2;
    return 0; // enemy
  };

  // 상점 버튼을 실제 좌표로 눌러서 UI가 입력을 받는지까지 확인합니다.
  const doShop = async (label) => {
    await page.waitForTimeout(400);
    await shot(page, label);
    const top = 960 / 2 - 620 / 2; // SHOP_LAYOUT.height
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(...at(270, top + 148 + i * 112));
      await page.waitForTimeout(180);
    }
    await shot(page, label.replace('.png', '-after.png'));
    await page.mouse.click(...at(270, 960 / 2 - 620 / 2 + 532));
    await page.waitForTimeout(400);
  };

  const log = [];
  let shopsSeen = 0;
  for (let i = 0; i < jumps; i++) {
    const s = await read();
    if (!s) break;
    if (s.dead) { log.push(`${s.floor}층에서 사망`); break; }

    if (s.shopOpen) {
      shopsSeen++;
      await doShop(`shop-${s.floor}.png`);
      continue;
    }

    const left = rank(s.left, s) >= rank(s.right, s);
    await page.mouse.click(...at(left ? 135 : 405, 620));
    await page.waitForTimeout(560);

    if (i % 10 === 9) {
      const t = await read();
      log.push(`${String(t.floor).padStart(3)}층  HP ${t.hp}/${t.maxHp}  적 ${t.enemies}  처치 ${t.kills}  코인 ${t.coins}` +
        `  ${t.weapon}${t.plus ? ' +' + t.plus : ''}${t.mult > 1 ? ' ×' + t.mult : ''}` +
        `  (공격력 ${t.dmg} · ${t.shots}발)`);
    }
    if (i === 24) await shot(page, '03-combat.png');
  }

  await page.waitForTimeout(1200);
  await shot(page, '04-late.png');

  const state = await read();
  console.log(log.join('\n'));
  console.log(`상점 ${shopsSeen}회`);
  console.log('최종:', JSON.stringify(state));
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');

  await browser.close();
  server.close();
})();
