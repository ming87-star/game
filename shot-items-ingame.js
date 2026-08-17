// 발판 위에 실제로 놓인 아이템을 봅니다.
//
// 카드 위에서 예쁜 것과 발판 위에서 읽히는 것은 다릅니다. 여기서는 게임이
// 쓰는 그대로 — 어두운 벽, 흔들리는 배지, 옆에 놓인 다른 칸 — 을 함께 봅니다.
// 가짜는 드러나기 전과 드러난 뒤를 나란히 찍습니다. 따로 보면 둘 다 멀쩡해 보입니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

// 주인공 위로 **비어 있지 않은 칸을 차례로** 채웁니다.
// 층마다 발판이 몇 개인지가 다르므로 "왼쪽·가운데·오른쪽"으로 짜 두면
// 없는 자리가 생겨 표가 군데군데 빕니다.
//
// 세 장이 **같은 자리**를 씁니다 — 진짜와 가짜를 같은 칸에 놓고 갈아 끼워야
// 눈이 둘을 겹쳐 볼 수 있습니다. 따로 놓으면 둘 다 그럴듯해 보입니다.
const REAL = ['plus', 'haste', 'armor', 'dodge', 'heal', 'treasure', 'relic', 'medal'];
const PAGES = [
  { name: 'items-real.png', title: '진짜', slots: REAL },
  { name: 'items-fake.png', title: '가짜 — 드러나기 전',
    slots: ['m:plus', 'm:haste', 'm:armor', 'm:dodge', 'm:heal', 'm:treasure', 'bomb', 'medal'] },
  { name: 'items-shown.png', title: '가짜 — 드러난 뒤',
    slots: ['r:plus', 'r:haste', 'r:armor', 'r:dodge', 'r:heal', 'r:treasure', 'bomb', 'medal'] },
];

(async () => {
  await new Promise((r) => server.listen(9880, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:9880/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: {}, lastJob: 'warrior', sawStory: true })));
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

  for (const spec of PAGES) {
    await page.evaluate((spec) => {
      const s = window.__scene;
      s.floorIndex = 120;
      // 앞서 만든 층과 배지를 다 걷어 내고 우리가 짠 대로 다시 놓습니다.
      s.floors.forEach((fl) => LANES.forEach((l) => {
        const sl = fl.slots[l];
        if (sl && sl.view) sl.view.destroy();
        (sl && sl.deck || []).forEach((d) => d.destroy());
      }));
      s.floors.clear();
      s.enemies.getChildren().slice().forEach((e) => e.destroy());

      for (let i = s.floorIndex - 1; i <= s.floorIndex + 6; i++) s.addFloor(i);
      s.floors.forEach((fl) => LANES.forEach((l) => {
        const sl = fl.slots[l];
        if (sl && sl.view) { sl.view.destroy(); sl.view = null; sl.kind = SLOT.EMPTY; }
      }));

      // 주인공 바로 위층부터 왼쪽→오른쪽으로 훑으며 있는 칸을 차례로 채웁니다.
      const open = [];
      for (let i = s.floorIndex + 1; i <= s.floorIndex + 6; i++) {
        const fl = s.floors.get(i);
        if (fl) LANES.forEach((l) => { if (fl.slots[l]) open.push(fl.slots[l]); });
      }
      spec.slots.forEach((code, i) => {
        const slot = open[i];
        if (!slot) return;
        const mimic = code.startsWith('m:') || code.startsWith('r:');
        const name = code.replace(/^[mr]:/, '');
        slot.kind = mimic ? SLOT.MIMIC : SLOT[name.toUpperCase()];
        if (mimic) slot.disguise = SLOT[name.toUpperCase()];
        slot.taken = false; slot.expired = false; slot.revealed = false;
        slot.view = s.makeMark(slot);
        if (code.startsWith('r:')) s.revealMimic(slot);
      });

      // 「드러나기 전」 장은 저절로 드러나면 안 됩니다. updateItems 가 매 프레임
      // 두 층 안의 가짜를 벗기므로, 이 장에서만 그 손이 닿지 않게 해 둡니다.
      CFG.trap.revealWithin = spec.name === 'items-fake.png' ? -1 : 2;

      const home = s.floors.get(s.floorIndex).slots.mid || s.floors.get(s.floorIndex).slots.left;
      s.player.setPosition(home.x, home.y - 34);
      s.cameras.main.setScroll(0, s.player.y - 960 * 0.72);
    }, spec);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ROOT, 'shots/' + spec.name) });
  }

  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'shots', f)).toString('base64');
  const sheet = await browser.newPage({ viewport: { width: 1700, height: 1030 } });
  await sheet.setContent(`<style>html,body{margin:0;background:#0d1120;font-family:sans-serif;color:#8794b5}
    .row{display:flex;gap:20px;padding:16px 20px}figure{margin:0}
    figcaption{text-align:center;font-size:15px;padding:8px 0}
    img{display:block;width:540px;border:1px solid #2a3252}</style>
    <div class="row">${PAGES.map((p) =>
      `<figure><img src="${b64(p.name)}"><figcaption>${p.title}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(250);
  await sheet.screenshot({ path: path.join(ROOT, 'shots/items-ingame.png') });
  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close(); server.close();
})();
