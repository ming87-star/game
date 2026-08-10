// 공격 모션을 **한 판을 여러 장으로 쪼개서** 봅니다.
//
// 한 장짜리 스크린샷으로는 모션을 볼 수 없습니다. 움직임은 자세가 아니라
// 자세와 자세 **사이**에 있습니다. 그래서 한 판(beat)을 일정한 간격으로 끊어
// 여덟 장을 찍고 가로로 붙입니다 — 검이 도는지, 창이 곧게 나가는지,
// 석궁이 뒤로 밀리는지가 이 띠에서 한눈에 갈립니다.
//
// 시계는 실제로 흐르지 않습니다. 모션의 자세를 직접 계산해 얹고 한 장씩 찍습니다.
// 소프트웨어 그래픽으로 도는 판은 초당 몇 장밖에 못 그려서, 진짜로 기다리면
// 여덟 장이 아니라 두 장만 다르게 나옵니다.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

// 무엇을 들고 보여 줄지. 직업 · 무기 단계 · 이름.
const SHOTS = [
  { job: 0, tier: 0, motion: 'sword', title: '검 — 들었다가 돌려서 내리침' },
  { job: 0, tier: 3, motion: 'spear', title: '창 — 회전 없이 곧게 찌름' },
  { job: 2, tier: 0, motion: 'dagger', title: '단검 — 짧고 빠르게 찔러 넣음' },
  { job: 2, tier: 2, motion: 'daggerTwin', title: '쌍단검 — 같은 동작을 두 번' },
  { job: 1, tier: 0, motion: 'bow', title: '활 — 길게 당겼다가 놓음' },
  { job: 1, tier: 3, motion: 'crossbow', title: '석궁 — 당김 없이 반동으로 밀림' },
];
const FRAMES = 8;
const BOX = { w: 150, h: 130 }; // 주인공을 둘러싼 만큼만. 자리는 화면에서 직접 잽니다

async function boot(browser, port, jobIndex) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, medals: 0, weapons: {}, boosts: {},
    relics: {}, unlocked: { archer: true, rogue: true }, lastJob: 'warrior' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.mouse.click(270, 278 + jobIndex * 210);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__medal.startAt);
  await page.mouse.click(st.x, st.y);
  await page.waitForTimeout(900);
  return page;
}

(async () => {
  await new Promise((r) => server.listen(9890, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const errs = [];
  const strips = [];

  for (const spec of SHOTS) {
    const page = await boot(browser, 9890, spec.job);
    page.on('pageerror', (e) => errs.push(e.message));

    // 자리를 잡고, 판이 스스로 움직이지 않게 붙들어 둡니다.
    const ok = await page.evaluate((spec) => {
      const s = window.__scene;
      s.attack = () => {};
      s.spawnAmbient = () => {}; // 안 막으면 적이 계속 걸어 나와 주인공을 덮습니다
      // 맞으면 주인공이 깜빡입니다 (hurt 의 알파 트윈). 그 깜빡임이 겉몸에도
      // 그대로 비쳐서, 자세를 찍으려던 장이 반투명하거나 아예 안 보이게 나옵니다.
      s.hurt = () => {};
      window.updateEnemies = () => {};
      s.weapon.tier = spec.tier;
      s.floorIndex = 40;
      s.addFloor(s.floorIndex);
      const slot = s.floors.get(s.floorIndex).slots.mid || s.floors.get(s.floorIndex).slots.left;
      s.player.setPosition(slot.x, slot.y - 34);
      s.player.setFlipX(false);
      s.cameras.main.setScroll(0, s.player.y - CFG.height * 0.68); // 카메라가 쉬는 자리
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      s.bullets.clear(true, true);
      return motionFor(s.job, s.weapon) === MOTIONS[spec.motion];
    }, spec);
    if (!ok) errs.push(spec.title + ' — 뜻한 몸짓이 아님');
    await page.waitForTimeout(500); // 카메라가 자리를 잡을 때까지

    // **판을 멈춥니다.** 여기서부터는 자세를 손으로 얹고 한 장씩 찍습니다.
    // 판이 돌고 있으면 적이 걸어 나오고, 맞으면 몸이 깜빡이고, 카메라가 흐릅니다 —
    // 자세를 보려고 찍은 장에 그것들이 죄다 섞여 들어옵니다.
    // 멈춰도 그리기는 계속되므로 화면은 그대로 나옵니다.
    //
    // 그리고 **겉몸만 남기고 다 감춥니다.** 멈추기 직전에 이미 나와 있던 적,
    // 터지던 이펙트, 발판 위의 표 같은 것이 그대로 얼어붙어 주인공을 가립니다.
    // 보려는 것은 자세 하나뿐이므로, 화면에 그것만 남기는 것이 가장 확실합니다.
    await page.evaluate(() => {
      const s = window.__scene;
      s.enemies.getChildren().slice().forEach((e) => e.destroy());
      s.bullets.clear(true, true);
      s.scene.pause();
      s.children.list.forEach((o) => { if (o !== s.rig.view && o.setVisible) o.setVisible(false); });
      s.cameras.main.setBackgroundColor('#1d2542');
    });
    await page.waitForTimeout(200);

    const frames = [];
    let at = null;
    for (let i = 0; i < FRAMES; i++) {
      // 자세를 얹고 카메라를 못 박습니다. 카메라가 조금이라도 흐르면 잘라 낸
      // 자리가 프레임마다 달라져서, 몸이 움직인 것인지 틀이 움직인 것인지
      // 알 수 없는 띠가 나옵니다.
      at = await page.evaluate(({ i, n }) => {
        const s = window.__scene;
        const cam = s.cameras.main;
        if (s.rig.tw) { s.rig.tw.remove(); s.rig.tw = null; }
        s.rig.applyAt(motionFor(s.job, s.weapon).keys, i / (n - 1));
        s.rig.sync();
        // 겉몸이 아니라 **물리 몸**을 가운데 둡니다. 겉몸에 맞추면 몸이 앞으로
        // 나간 만큼 틀도 따라 나가서, 움직임이 통째로 지워집니다.
        return { x: s.player.x - cam.scrollX, y: s.player.y - cam.scrollY };
      }, { i, n: FRAMES });

      // 화면 전체를 찍고 자르기는 붙이는 쪽에서 합니다. clip 으로 자르면
      // 그림이 다 그려지기 전에 잘려서 몸이 찢어진 장이 섞입니다.
      await page.waitForTimeout(160);
      const buf = await page.screenshot();
      frames.push('data:image/png;base64,' + buf.toString('base64'));
    }
    strips.push({ title: spec.title, frames, at });
    await page.close();
  }

  const sheet = await browser.newPage({ viewport: { width: 1310, height: 1260 } });
  await sheet.setContent(`<style>
    html,body{margin:0;background:#0d1120;font-family:sans-serif;color:#8794b5}
    .strip{padding:8px 18px}
    h3{font-size:16px;margin:6px 0;color:#cfd8dc;font-weight:600}
    .row{display:flex;gap:4px}
    figure{margin:0}
    .win{width:${BOX.w}px;height:${BOX.h}px;overflow:hidden;position:relative;border:1px solid #232b47}
    .win img{position:absolute;display:block}
    figcaption{text-align:center;font-size:11px;padding:3px 0}
    </style>` +
    strips.map((s) => `<div class="strip"><h3>${s.title}</h3><div class="row">` +
      s.frames.map((f, i) =>
        `<figure><div class="win"><img src="${f}" style="left:${Math.round(BOX.w / 2 - s.at.x)}px;` +
        `top:${Math.round(BOX.h / 2 - s.at.y)}px"></div><figcaption>${i + 1}</figcaption></figure></figure>`).join('') +
      '</div></div>').join(''));
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(ROOT, 'shots/motion.png'), fullPage: true });

  console.log(errs.length ? '오류: ' + errs.join(' | ') : '오류 없음');
  await browser.close(); server.close();
})();
