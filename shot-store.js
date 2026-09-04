// 스토어에 올릴 스크린샷을 뽑습니다.
//   CHROME_PATH=... node shot-store.js   → store/shots/01..08.png
//
// **1080×1920 으로 찍습니다.** 캔버스가 540×960 이라 deviceScaleFactor 2 로
// 두 배 해상도로 그립니다 — 잡아 늘린 것이 아니라 두 배로 그린 것입니다.
// Play 는 세로 스크린샷을 2~8장 받고, 짧은 변 320px 이상이면 됩니다.
//
// **꾸미지 않습니다.** 글자를 얹거나 액자를 두르지 않고 게임 화면 그대로
// 찍습니다. 스토어에서 보는 것과 폰에서 보는 것이 같아야 합니다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});
const OUT = path.join(ROOT, 'store', 'shots');

(async () => {
  const port = Number(process.env.PORT) || 9914;
  await new Promise((r) => server.listen(port, r));
  fs.mkdirSync(OUT, { recursive: true });
  const br = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));

  // 웬만큼 해 본 사람의 저장으로 채웁니다 — 텅 빈 화면은 게임을 안 보여 줍니다.
  //
  // **웬만큼 해 본 사람의 저장**으로 채웁니다. 처음 켠 상태로 찍으면 직업이
  // 검은 실루엣이고 도감이 전부 「???」라, 게임이 아니라 빈 껍데기가 찍힙니다.
  const 유물들 = ['waveblade', 'mirrorplate', 'bloodcloak', 'thornmail', 'swiftboots',
    'coinpurse', 'farblade', 'echobow', 'goblinglove', 'invisijump', 'roundtower',
    'quietwake', 'rocketboots', 'sandoftime', 'trueeye', 'willowisp', 'executionermark',
    'firststrike', 'piercingoil', 'hotoil', 'coldoil', 'secondheart'];
  const 저장 = {
    sawStory: true, medals: 12, lastJob: 'wizard', bestFloor: 1240, runs: 37,
    unlocked: { archer: true, rogue: true, monk: true, necro: true,
      digger: true, wizard: true, hunter: true },
    relics: Object.fromEntries(유물들.map((k) => [k, true])),
  };
  await pg.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await pg.evaluate((d) => window.localStorage.setItem('tower-climb-v1', JSON.stringify(d)), 저장);

  const 찍기 = async (이름, 뜸) => {
    await pg.waitForTimeout(뜸 || 700);
    const f = path.join(OUT, 이름 + '.png');
    await pg.screenshot({ path: f });
    const { width, height } = require('fs').statSync(f);
    console.log('  ' + 이름 + '.png');
  };
  const 새로 = async () => {
    await pg.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
    await pg.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 25000 });
  };
  const 장면으로 = async (키, 값) => {
    await pg.evaluate(([k, v]) => {
      const g = window.__game;
      g.scene.getScenes(true).forEach((s) => s.scene.stop());
      g.scene.start(k, v);
    }, [키, 값 || null]);
  };

  console.log('찍습니다 (1080×1920):');

  // 1. 타이틀
  await 새로();
  await 찍기('01-title', 1400);

  // 2. 직업 고르기 — 여덟이 다 열린 채
  await 장면으로('select');
  await pg.waitForTimeout(1200);
  await 찍기('02-select');

  // 3~5. 판 — **실제로 올라갑니다.**
  //
  // floorIndex 를 손으로 밀어 넣으면 숫자만 바뀌고 탑은 0층 그대로입니다.
  // 적도 아이템도 없는 화면이 찍힙니다. 그래서 진짜로 뜁니다 — 오르는 동안
  // 적이 서고 아이템이 떨어지고 무기가 바뀌는 것이 다 실제로 일어납니다.
  //
  // **한 판으로 셋을 다 찍습니다.** 오르는 데 시간이 걸리므로 판을 여러 번
  // 새로 열지 않습니다.
  await 장면으로('game', { jobKey: 'wizard' });
  await pg.waitForFunction(() => window.__scene && window.__scene.player, null, { timeout: 30000 });
  await pg.waitForTimeout(600);

  // 한 번 뛰는 데 320ms 걸리고(CFG.jumpDuration), **뛰는 중에는 다음 뜀이
  // 안 먹습니다.** 처음에 120ms 마다 눌렀더니 여섯 층에서 멈췄습니다 —
  // 대부분이 씹힌 것입니다. 뜀이 끝나기를 기다렸다가 다음을 누릅니다.
  const 오르기 = async (까지) => {
    for (let i = 0; i < 까지 * 4; i++) {
      const 지금 = await pg.evaluate(() => window.__scene.floorIndex);
      if (지금 >= 까지) break;
      await pg.evaluate(() => {
        const s = window.__scene;
        if (s.shop.open || s.choosing || s.dead || s.jumping) return;
        s.jump([-1, 0, 1][Math.floor(Math.random() * 3)]);
      });
      await pg.waitForFunction(() => !window.__scene.jumping, null, { timeout: 3000 })
        .catch(() => {});
      await pg.waitForTimeout(60);
    }
    return pg.evaluate(() => window.__scene.floorIndex);
  };

  const 층 = await 오르기(46);
  console.log('  (판에서 ' + 층 + '층까지 올랐습니다)');
  await pg.waitForTimeout(900);
  await 찍기('03-climb');

  // 상점 — 50층에서 **진짜로 만납니다**
  await 오르기(50);
  await pg.waitForTimeout(1400);
  const 열렸나 = await pg.evaluate(() => window.__scene.shop.open);
  if (!열렸나) await pg.evaluate(() => window.__scene.shop.show(50));
  await 찍기('05-shop', 900);
  // **닫지 않습니다.** 다음 장면으로 옮기면 이 장면이 통째로 멈추므로
  // 닫을 까닭이 없고, 닫으려다 한 번 터졌습니다 — 상점을 닫는 길은
  // 이미 없어진 적 무리를 훑습니다(clearBats).
  await pg.evaluate(() => { window.__scene.shop.parts.forEach((o) => o.destroy());
    window.__scene.shop.parts = []; window.__scene.shop.open = false; });
  await pg.waitForTimeout(300);

  // 4. 보스 — **이 게임에서 가장 눈에 띄는 화면**입니다.
  //
  // 200층까지 실제로 오르면 시작 무기로는 못 버팁니다. 그래서 199층으로
  // 옮겨 두고 한 번 뛰어 투기장에 들어갑니다 (verify-boss.js 와 같은 길).
  await pg.evaluate(() => {
    const s = window.__scene;
    s.floorIndex = 199;
    s.lane = 'mid';
    for (let i = 199; i <= 206; i++) s.addFloor(i);
    const slot = s.floors.get(199).slots.mid;
    s.player.setPosition(slot.x, slot.y - 34);
    s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.68);
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => window.__scene.jump(0));
  // 보스가 다 내려앉기를 기다립니다 — 내려오는 중에 찍으면 반쯤 걸칩니다.
  await pg.waitForTimeout(3800);
  await 찍기('04-boss', 600);

  // 6. 유물 도감
  await 장면으로('relicbook');
  await 찍기('06-relics', 1200);

  // 7. 메달 상점
  await 장면으로('medal', { jobKey: 'wizard' });
  await 찍기('07-medal', 1200);

  // 8. 무기 도감
  await 장면으로('weaponbook', { jobKey: 'wizard' });
  await 찍기('08-weapons', 1200);

  console.log(errs.length ? '오류: ' + errs.join(' / ') : '오류 없음');
  await br.close(); server.close();
})();
