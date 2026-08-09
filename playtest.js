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
  const jobKey = process.argv[3] || 'warrior';
  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  const port = Number(process.env.PORT) || 8099;
  await new Promise((r) => server.listen(port, r));

  // CHROME_PATH가 있으면 그 브라우저를 쓰고, 없으면 playwright가 받아둔 것을 씁니다.
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEW });

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  // 잠긴 직업도 시험해야 하므로 해금을 미리 채워 두고 새로고침합니다.
  // 메달은 MEDALS 로 넘겨서 "몇 번 죽은 뒤"의 상태도 재 볼 수 있습니다.
  const medals = Number(process.env.MEDALS) || 0;
  await page.evaluate((m) => window.localStorage.setItem('tower-climb-v1',
    JSON.stringify({ bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: m,
      weapons: {}, boosts: {}, unlocked: { archer: true, rogue: true } })), medals);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '00-select.png');

  // 시작 화면에서 직업 카드를 실제로 눌러서 들어갑니다.
  const cardIndex = ['warrior', 'archer', 'rogue'].indexOf(jobKey);
  await page.mouse.click(...at(270, 288 + Math.max(0, cardIndex) * 210));
  await page.waitForTimeout(800);

  // 직업을 고르면 메달 상점을 거칩니다. 살 수 있는 것은 위에서부터 다 삽니다.
  await shot(page, '01-medal.png');
  const medalShop = await page.evaluate(() => {
    const m = window.__medal;
    if (!m) return null;
    return { rows: m.rows.map((r) => ({ x: r.box.x, y: r.box.y })), start: m.startAt };
  });
  if (medalShop) {
    for (const r of medalShop.rows) {
      await page.mouse.click(...at(r.x, r.y));
      await page.waitForTimeout(140);
    }
    await shot(page, '01-medal-after.png');
    await page.mouse.click(...at(medalShop.start.x, medalShop.start.y));
  }
  await page.waitForTimeout(1000);
  await shot(page, '02-start.png');

  const read = () => page.evaluate(() => {
    const s = window.__scene;
    if (!s) return null;
    const next = s.floors.get(s.floorIndex + 1);
    const kinds = {};
    LANES.forEach((l) => { kinds[l] = next && next.slots[l] ? next.slots[l].kind : null; });
    return {
      floor: s.floorIndex, hp: Math.round(s.hp), maxHp: s.maxHp,
      kills: s.kills, coins: s.coins, totalCoins: s.totalCoins,
      job: s.job.name, relic: s.weapon.relic ? s.weapon.relic.name : null,
      weapon: s.weapon.name, plus: Number(s.weapon.plusValue.toFixed(1)),
      speed: Number(s.weapon.speedMult.toFixed(2)), capped: s.weapon.speedCapped,
      dmg: s.weapon.dmg, reach: Math.round(s.weapon.reach), shots: s.weapon.shots,
      // UP이 실제로 이득인지. 강화를 잃고도 화력이 오르는가로 판단합니다.
      upWorth: (() => {
        const w = s.weapon, next = w.table[w.tier + 1];
        if (!next) return false;
        // 근접은 사거리 안을 한 번에 벱니다. 화력은 공격력 ÷ 주기,
        // 거기에 사거리가 넓을수록 한 번에 더 많이 맞는 것을 얹어 봅니다.
        const power = (t) => t.dmg / t.rate * (1 + (t.reach || 0) / 400) * (t.shots || 1);
        return power(next) > power({ dmg: w.dmg, rate: w.rate, reach: w.reach, shots: w.shots });
      })(),
      armor: Math.round(s.armor),
      lane: s.lane,
      // 사거리 안에 남아 있는 적 — 싸움을 끝내고 갈지 판단하는 데 씁니다.
      // 근접이면 사거리 안, 원거리면 어차피 멈출 필요가 없으므로 0.
      inReach: s.job.attack === 'ranged' ? 0 :
        s.enemies.getChildren().filter((e) => e.active &&
          Phaser.Math.Distance.Between(e.x, e.y, s.player.x, s.player.y) <= s.weapon.reach).length,
      enemies: s.enemies.countActive(), dead: s.dead, shopOpen: s.shop.open,
      score: s.score(),
      medals: s.medals, boosts: s.boosts,
      kinds,
    };
  });

  // 사람처럼 고르는 가상 플레이어.
  // UP은 손해일 때가 있어서, 이득일 때만 노립니다. 무조건 먹는 플레이어로
  // 재면 밸런스가 실제보다 나쁘게 나옵니다.
  const rank = (kind, s) => {
    if (kind === null) return -1;
    if (kind === 'heal') return s.hp < s.maxHp * 0.6 ? 6 : 1;
    if (kind === 'double') return s.capped ? 1 : 8;
    if (kind === 'haste') return s.capped ? 1 : 5;
    if (kind === 'upgrade') return s.upWorth ? 4 : 1;
    if (kind === 'armor') return s.armor < 40 ? 4 : 2;
    if (kind === 'medal') return 9; // 판을 넘어 남는 유일한 것. 무조건 집습니다
    if (kind === 'plus') return 3;
    if (kind === 'empty') return 2;
    // 적 발판은 코인이 궁할 때 골라 갑니다. 땅에 붙은 적은 피하면 그만이라,
    // 늘 피하는 플레이어로 재면 전투가 통째로 빠진 채 밸런스를 보게 됩니다.
    return s.coins < 130 ? 2.5 : 0.5;
  };

  // 상점 버튼을 실제 좌표로 눌러서 UI가 입력을 받는지까지 확인합니다.
  const doShop = async (label) => {
    await page.waitForTimeout(400);
    await shot(page, label);
    // 칸 좌표는 상점이 실제로 그려 둔 것을 읽어 옵니다. 배치를 바꿔도 따라갑니다.
    const spots = await page.evaluate(() => ({
      rows: window.__scene.shop.rows.map((r) => ({ x: r.box.x, y: r.box.y })),
      exit: window.__scene.shop.exitAt,
    }));
    for (const r of spots.rows) {
      await page.mouse.click(...at(r.x, r.y));
      await page.waitForTimeout(180);
    }
    await shot(page, label.replace('.png', '-after.png'));
    await page.mouse.click(...at(spots.exit.x, spots.exit.y));
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

    // 한 칸 이내로 닿는 길 중에서 가장 나은 쪽을 고르고, 그 "방향"을 누릅니다.
    const lanes = ['left', 'mid', 'right'];
    const here = lanes.indexOf(s.lane);
    const reachable = lanes
      .map((l, i) => ({ l, i }))
      .filter((c) => Math.abs(c.i - here) <= 1 && s.kinds[c.l] !== null);
    const pick = reachable.length
      ? reachable.reduce((a, b) => (rank(s.kinds[b.l], s) > rank(s.kinds[a.l], s) ? b : a))
      : { i: here };
    const dir = Math.sign(pick.i - here); // -1 왼쪽 · 0 위 · +1 오른쪽
    await page.mouse.click(...at(dir < 0 ? 90 : dir > 0 ? 450 : 270, 620));
    await page.waitForTimeout(560);

    // 근접이라 발판에 올라선 채로 싸웁니다. 기계적으로 계속 올라가면
    // 몇 대 치다 떠나 버려서 아무것도 못 잡습니다 — 사람은 그렇게 놀지 않습니다.
    // 발 앞에 적이 남아 있으면 정리될 때까지 (또는 체력이 위험해질 때까지) 버팁니다.
    for (let waited = 0; waited < 2400; waited += 200) {
      const t = await read();
      if (!t || t.dead || t.shopOpen || !t.inReach) break;
      if (t.hp < t.maxHp * 0.3) break; // 위험하면 두고 도망칩니다
      await page.waitForTimeout(200);
    }

    if (i % 10 === 9) {
      const t = await read();
      log.push(`${String(t.floor).padStart(3)}층  HP ${t.hp}/${t.maxHp}  적 ${t.enemies}  처치 ${t.kills}  코인 ${t.coins}` +
        `  방어 ${t.armor}%  ${t.weapon}${t.plus ? ' +' + t.plus : ''}${t.speed > 1 ? ' ×' + t.speed + (t.capped ? '한계' : '') : ''}` +
        `  (공격력 ${t.dmg}${t.reach ? ' · 사거리 ' + t.reach : ' · ' + t.shots + '발'})${t.relic ? ' ★' + t.relic : ''}`);
    }
    if (i === 24) await shot(page, '03-combat.png');
  }

  await page.waitForTimeout(1200);
  await shot(page, '04-late.png');

  const state = await read();

  // 죽었다면 죽음 화면의 세 갈래가 실제로 그려졌는지, 무엇을 계승할 수 있는지 봅니다.
  if (state && state.dead) {
    await shot(page, '05-death.png');
    const choices = await page.evaluate(() => {
      const s = window.__scene;
      return {
        buttons: s.deathChoices ? s.deathChoices.length : 0,
        carry: window.__save.rollWeapon(s.job.key),
        book: window.__save.data.weapons[s.job.key] || {},
      };
    });
    console.log('죽음 화면: 선택지', choices.buttons + '개',
      '· 도감', Object.keys(choices.book).length + '단계',
      '· 뽑기 예:', JSON.stringify(choices.carry));
  }

  console.log(log.join('\n'));
  console.log(`${jobKey} · 상점 ${shopsSeen}회 · 메달 ${state ? state.medals : 0}개` +
    (state && state.boosts && state.boosts.length ? ' · 시작 강화 ' + state.boosts.join(',') : ''));
  console.log('최종:', JSON.stringify(state));
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');

  await browser.close();
  server.close();
})();
