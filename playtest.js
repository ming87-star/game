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
  // 씨앗을 주면 같은 탑이 다시 만들어집니다. 직업끼리 견줄 때는 반드시 주세요 —
  // 탑이 매번 다르면 직업 차이가 운에 묻힙니다.
  const seed = Number(process.env.SEED) || 0;
  if (seed) await page.evaluate((v) => window.localStorage.setItem('tower-seed', String(v)), seed);
  await page.evaluate((m) => window.localStorage.setItem('tower-climb-v1',
    JSON.stringify({ bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: m,
      weapons: {}, boosts: {}, unlocked: { archer: true, rogue: true }, sawStory: true })), medals);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '00-select.png');
  if (seed) {
    const on = await page.evaluate(() => window.__seed || null);
    if (!on) { console.error('씨앗이 걸리지 않았습니다'); process.exit(1); }
  }

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
    // 가짜 함정은 겉모습만 보입니다. 여기서 진짜 정체를 넘겨주면 harness만
    // 함정을 다 피하는 초능력자가 되어, 함정이 밸런스에 미치는 영향이 안 잡힙니다.
    LANES.forEach((l) => {
      const slot = next && next.slots[l];
      kinds[l] = slot ? (slot.kind === 'mimic' ? slot.disguise : slot.kind) : null;
    });
    return {
      floor: s.floorIndex, hp: Math.round(s.hp), maxHp: s.maxHp,
      kills: s.kills, coins: s.coins, totalCoins: s.totalCoins,
      job: s.job.name, relics: s.weapon.relics.map((r) => r.name),
      weapon: s.weapon.name, plus: Number(s.weapon.plusValue.toFixed(1)),
      speed: Number(s.weapon.speedMult.toFixed(2)), capped: s.weapon.speedCapped,
      dmg: s.weapon.dmg, reach: Math.round(s.weapon.reach), shots: s.weapon.shots,
      // 무기 칸이 실제로 이득인지. **놓여 있는 자루를 직접 보고** 셉니다 —
      // 무기는 이제 사다리가 아니라 주머니라, "다음 단계"라는 것이 없습니다.
      // 갈아타면 강화가 날아가므로 새 자루는 강화 없이 잽니다.
      upWorth: (() => {
        const w = s.weapon;
        const floor = s.floors.get(s.floorIndex + 1);
        const slot = floor && LANES.map((l) => floor.slots[l])
          .find((c) => c && c.kind === SLOT.UPGRADE && c.weapon);
        if (!slot) return false;
        return w.dpsOf(slot.weapon, false) > w.dps;
      })(),
      armor: Math.round(s.armor),
      lane: s.lane,
      // 사거리 안에 남아 있는 적 — 싸움을 끝내고 갈지 판단하는 데 씁니다.
      //
      // 예전에는 원거리면 0으로 두었습니다 ("어차피 멈출 필요가 없으니까").
      // 그런데 그러면 궁수만 한 번도 멈추지 않고 지나가는 플레이어가 되어
      // 코인을 거의 못 법니다 — 직업끼리 견줄 때 궁수만 손해를 보는 셈입니다.
      // 사람은 사정거리에 들어온 무리는 정리하고 갑니다.
      inReach: (() => {
        const w = s.weapon;
        const near = s.job.attack === 'ranged' ? w.range * 0.6 : w.reach;
        return s.enemies.getChildren().filter((e) => e.active &&
          Phaser.Math.Distance.Between(e.x, e.y, s.player.x, s.player.y) <= near).length;
      })(),
      enemies: s.enemies.countActive(), dead: s.dead, shopOpen: s.shop.open,
      swapOpen: !!(window.__game.scene.isActive('swap') && window.__swap),
      score: s.score(),
      medals: s.medals, boosts: s.boosts,
      // 보스와 유물은 흐름을 통째로 바꿉니다. harness도 알아야 합니다.
      bossFight: s.bossFight,
      bossHp: s.boss && s.boss.active ? Math.round(s.boss.hp / s.boss.maxHp * 100) : null,
      choosing: s.choosing,
      bats: s.batCount(),
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
    // 폭탄은 대놓고 보입니다. 빈 칸보다도 나쁘지만, 다른 길이 다 막혔으면 밟습니다.
    if (kind === 'bomb') return 0.2;
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
  let relicsTaken = 0;
  let swapsSeen = 0;
  let bossSeen = false;
  for (let i = 0; i < jumps; i++) {
    const s = await read();
    if (!s) break;
    if (s.dead) { log.push(`${s.floor}층에서 사망`); break; }

    if (s.shopOpen) {
      shopsSeen++;
      await doShop(`shop-${s.floor}.png`);
      continue;
    }

    // 무기를 밟으면 판이 멈추고 갈아탈지 묻습니다. **이걸 안 눌러 주면
    // 판이 통째로 거기서 멎습니다** — 남은 점프를 전부 멈춘 화면에 씁니다.
    // 이득일 때만 갈아타는 사람으로 잽니다.
    if (s.swapOpen) {
      swapsSeen++;
      const at2 = await page.evaluate(() => {
        const sw = window.__swap;
        const g = window.__scene;
        const good = g.weapon.dpsOf(sw.entry, false) > g.weapon.dps;
        return good ? sw.swapAt : sw.keepAt;
      });
      await page.mouse.click(...at(at2.x, at2.y));
      await page.waitForTimeout(400);
      continue;
    }

    // 유물은 판을 멈추고 세 장 중 하나를 고르게 합니다. 첫 장을 집습니다.
    if (s.choosing) {
      relicsTaken++;
      await shot(page, `relic-${s.floor}.png`);
      const card = await page.evaluate(() => window.__scene.relicChoices[0]);
      await page.mouse.click(...at(card.x, card.y));
      await page.waitForTimeout(400);
      continue;
    }

    // 보스 층에서는 위로 못 갑니다. 좌우로 피하면서 자동 공격이 깎기를 기다립니다.
    if (s.bossFight) {
      if (!bossSeen) { bossSeen = true; await shot(page, `boss-${s.floor}.png`); }
      // 예고된 줄을 피해 좌우로 오갑니다. 실제 조작과 같은 탭입니다.
      await page.mouse.click(...at(Math.random() < 0.5 ? 90 : 450, 620));
      await page.waitForTimeout(420);
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
        `  (공격력 ${t.dmg}${t.reach ? ' · 사거리 ' + t.reach : ' · ' + t.shots + '발'})${t.relics.length ? ' ★' + t.relics.join('·') : ''}`);
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
        carry: window.__save.carryWeapon(s.job.key),
        book: window.__save.data.weapons[s.job.key] || {},
      };
    });
    console.log('죽음 화면: 선택지', choices.buttons + '개',
      '· 도감', Object.keys(choices.book).length + '단계',
      '· 계승할 무기:', JSON.stringify(choices.carry));
  }

  console.log(log.join('\n'));
  console.log(`${jobKey} · 상점 ${shopsSeen}회 · 무기 ${swapsSeen}자루 만남 · 유물 ${relicsTaken}개 · 보스 ${bossSeen ? "만남" : "못 만남"}` +
    ` · 메달 ${state ? state.medals : 0}개` +
    (state && state.boosts && state.boosts.length ? ' · 시작 강화 ' + state.boosts.join(',') : ''));
  console.log('최종:', JSON.stringify(state));
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');

  await browser.close();
  server.close();
})();
