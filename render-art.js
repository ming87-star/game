// art/*.svg 를 assets/*.png 로 굽습니다.
//
// 이 환경에는 ImageMagick 도 rsvg 도 없습니다. 대신 Playwright 로 깔려 있는
// Chromium 이 SVG 를 제대로 그립니다 — omitBackground 로 찍으면 알파가 살아 있는
// PNG 가 그대로 나옵니다. 도형을 코드로 그리던 것(js/textures.js)과 달리
// 그림을 눈으로 보며 고칠 수 있고, 크기는 SVG 의 viewBox 가 정해 줍니다.
//
//   node render-art.js            4배로 굽고 미리보기 한 장
//   node render-art.js --scale 8  더 크게
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ART = path.join(ROOT, 'art');
const OUT = path.join(ROOT, 'assets');

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const SCALE = arg('scale', 4);

// 게임 안의 색. 미리보기는 이 위에 얹어야 뜻이 있습니다 —
// 흰 배경에서 예뻐 보이는 그림이 남색 위에서 묻히는 일이 흔합니다.
const WALL = '#1d2542';
const OUTSIDE = '#141a2e';

function sizeOf(svg) {
  const m = svg.match(/viewBox\s*=\s*"([\d.\s-]+)"/);
  if (!m) throw new Error('viewBox 가 없습니다');
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
  return { w, h };
}

// 그림마다 배율을 따로 정할 수 있습니다 — svg 뿌리에 data-bake-scale="2".
// 32px 짜리는 4배가 알맞지만 벽(500×960)은 4배면 2000×3840 이 되어 무겁습니다.
// 배경은 늘려서 깔리므로 2배면 충분합니다.
function scaleOf(svg) {
  const m = svg.match(/data-bake-scale\s*=\s*"([\d.]+)"/);
  return m ? Number(m[1]) : SCALE;
}

// 사람·적은 카드로 나란히 보고, 벽·발판은 실제 장면으로 봐야 판단이 됩니다.
const isScenery = (w, h) => w >= 120 || h >= 120;

(async () => {
  if (!fs.existsSync(ART)) { console.log('art/ 폴더가 없습니다'); return; }
  const files = fs.readdirSync(ART).filter((f) => f.endsWith('.svg')).sort();
  if (!files.length) { console.log('art/ 에 svg 가 없습니다'); return; }
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });

  const made = [];
  for (const file of files) {
    const svg = fs.readFileSync(path.join(ART, file), 'utf8');
    const { w, h } = sizeOf(svg);
    const scale = scaleOf(svg);
    const page = await browser.newPage({
      viewport: { width: Math.round(w * scale), height: Math.round(h * scale) },
      deviceScaleFactor: 1,
    });
    // SVG 를 뷰포트에 딱 맞춰 늘립니다. 벡터라 아무리 키워도 계단이 안 집니다.
    await page.setContent(
      '<style>html,body{margin:0;background:transparent}' +
      'svg{display:block;width:100vw;height:100vh}</style>' + svg);
    const name = file.replace(/\.svg$/, '.png');
    await page.screenshot({ path: path.join(OUT, name), omitBackground: true });
    await page.close();
    made.push({ name, w, h, scale });
    console.log(`${name}  ${w}×${h} ×${scale} → ${Math.round(w * scale)}×${Math.round(h * scale)}`);
  }

  // 그림은 data URI 로 박아 넣습니다. setContent 로 띄운 쪽은 file:// 을 못 읽습니다.
  const src = (name) => 'data:image/png;base64,' +
    fs.readFileSync(path.join(OUT, name)).toString('base64');
  const has = (name) => made.some((m) => m.name === name);

  // ── 미리보기 한 장 ────────────────────────────────────
  // 실제 게임 크기와 크게 키운 것을 나란히, 진짜 배경색 위에 얹습니다.
  const cast = made.filter((m) => !isScenery(m.w, m.h));
  const cell = 150;
  const page = await browser.newPage({
    viewport: { width: Math.max(560, cast.length * cell + 40), height: 360 },
    deviceScaleFactor: 2,
  });
  const cards = cast.map((m) => {
    const src = 'data:image/png;base64,' +
      fs.readFileSync(path.join(OUT, m.name)).toString('base64');
    return `
    <div class="card">
      <div class="big"><img src="${src}" style="width:${m.w * 3}px;height:${m.h * 3}px"></div>
      <div class="real"><img src="${src}" style="width:${m.w}px;height:${m.h}px"></div>
      <div class="cap">${m.name.replace('.png', '')}<br><b>${m.w}×${m.h}</b></div>
    </div>`;
  }).join('');
  await page.setContent(`<style>
      html,body{margin:0;background:${OUTSIDE};font-family:sans-serif;color:#8794b5}
      .wall{background:${WALL};padding:18px 20px;display:flex;gap:14px;justify-content:center}
      .card{width:${cell - 14}px;text-align:center}
      .big{height:190px;display:flex;align-items:flex-end;justify-content:center}
      .real{height:56px;display:flex;align-items:flex-end;justify-content:center;
            image-rendering:auto}
      .cap{font-size:12px;line-height:1.5;margin-top:6px}
      b{color:#cfd8dc;font-weight:600}
      .note{font-size:12px;text-align:center;padding:10px 0 0}
    </style>
    <div class="wall">${cards}</div>
    <div class="note">위 = 3배로 키운 것 · 아래 = 게임에서 실제로 보이는 크기</div>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'shots/art-preview.png') });
  await page.close();

  // ── 배경 미리보기 ─────────────────────────────────────
  // 벽과 발판은 카드로 보면 아무것도 알 수 없습니다. 실제 폭(500)으로 깔고,
  // 그 위에 사람과 적을 세워 놓고, **이음매가 화면 한가운데 오게** 밀어서
  // 띄웁니다. 이음매가 보이면 위로 오를 때마다 그 자리에 선이 그어집니다.
  if (has('wall.png')) {
    const SEAM = 480;                       // 벽 한 장(960)의 절반만큼 밀어 둡니다
    const on = (plat, x, y, who, dx) => {   // 발판 위에 세우기
      const m = made.find((k) => k.name === who);
      if (!m) return '';
      return `<img src="${src(who)}" style="left:${x + dx}px;top:${y - m.h}px;
              width:${m.w}px;height:${m.h}px">`;
    };
    const plat = (name, x, y) => {
      const m = made.find((k) => k.name === name);
      if (!m) return '';
      return `<img src="${src(name)}" style="left:${x}px;top:${y}px;
              width:${m.w}px;height:${m.h}px">`;
    };

    const stage = await browser.newPage({
      viewport: { width: 540, height: 1000 }, deviceScaleFactor: 2,
    });
    await stage.setContent(`<style>
        html,body{margin:0;background:${OUTSIDE};font-family:sans-serif}
        .stage{position:absolute;left:20px;top:0;width:500px;height:1000px;
               background-image:url(${src('wall.png')});background-repeat:repeat-y;
               background-size:500px 960px;background-position:0 -${SEAM}px}
        .stage img{position:absolute;image-rendering:auto}
        .seam{position:absolute;left:0;top:${960 - SEAM}px;width:500px;height:0;
              border-top:1px dashed rgba(255,120,120,.55)}
        .seam span{position:absolute;right:4px;top:-16px;font-size:11px;color:#e57373}
      </style>
      <div class="stage">
        ${plat('plat-boss.png', 20, 300)}
        ${on('plat-boss.png', 20, 300, 'player-archer.png', 190)}
        ${plat('plat-shop.png', 20, 560)}
        ${on('plat-shop.png', 20, 560, 'e-brute.png', 300)}
        ${on('plat-shop.png', 20, 560, 'e-crawler.png', 120)}
        ${plat('plat.png', 40, 780)}
        ${on('plat.png', 40, 780, 'player-warrior.png', 50)}
        ${plat('plat.png', 300, 720)}
        ${on('plat.png', 300, 720, 'e-hopper.png', 50)}
        <img src="${src('e-flyer.png')}" style="left:250px;top:640px;width:36px;height:32px">
        <div class="seam"><span>벽 이음매 — 여기 선이 보이면 안 됩니다</span></div>
      </div>`);
    await stage.waitForTimeout(300);
    await stage.screenshot({ path: path.join(ROOT, 'shots/art-scene.png') });
    await stage.close();
  }

  // ── 보스 미리보기 ─────────────────────────────────────
  // 보스는 카드로 보면 크기 감각이 안 옵니다. 투기장 발판 위에 띄우고 그 아래
  // 사람을 세워야, 이 덩치가 화면에서 무엇을 덮는지가 보입니다.
  const bosses = made.filter((m) => /^boss-(?!shot)/.test(m.name));
  if (bosses.length && has('wall.png')) {
    const CW = 540, CH = 360;                  // 한 칸 = 게임 화면 폭
    const cols = 2;
    const rows = Math.ceil(bosses.length / cols);
    const hero = made.find((m) => m.name === 'player-warrior.png');
    const arena = made.find((m) => m.name === 'plat-boss.png');

    const cells = bosses.map((b) => {
      const shotName = b.name === 'boss-warden.png'
        ? 'boss-shot.png'
        : b.name.replace('boss-', 'boss-shot-');
      const shot = made.find((m) => m.name === shotName);
      return `
      <div class="cell">
        <img class="boss" src="${src(b.name)}"
             style="left:${(CW - b.w) / 2}px;top:16px;width:${b.w}px;height:${b.h}px">
        ${shot ? `<img src="${src(shot.name)}" style="left:${CW / 2 - 100}px;top:266px;
             width:${shot.w}px;height:${shot.h}px">
          <img src="${src(shot.name)}" style="left:${CW / 2 + 68}px;top:284px;
             width:${shot.w}px;height:${shot.h}px">` : ''}
        ${arena ? `<img src="${src(arena.name)}"
             style="left:${(CW - arena.w) / 2}px;top:320px;width:${arena.w}px;height:${arena.h}px">` : ''}
        ${hero ? `<img src="${src(hero.name)}"
             style="left:${CW / 2 - 19}px;top:${320 - hero.h}px;width:${hero.w}px;height:${hero.h}px">` : ''}
        <div class="tag">${b.name.replace('.png', '')} · ${b.w}×${b.h}</div>
      </div>`;
    }).join('');

    const sheet = await browser.newPage({
      viewport: { width: CW * cols, height: CH * rows }, deviceScaleFactor: 1,
    });
    await sheet.setContent(`<style>
        html,body{margin:0;background:${OUTSIDE};font-family:sans-serif}
        .grid{display:flex;flex-wrap:wrap;width:${CW * cols}px}
        .cell{position:relative;width:${CW}px;height:${CH}px;overflow:hidden;
              background-image:url(${src('wall.png')});background-size:500px 960px;
              background-position:20px -120px;box-shadow:inset 0 0 0 1px #232b4d}
        .cell img{position:absolute}
        .tag{position:absolute;left:10px;bottom:8px;font-size:13px;color:#8794b5;
             background:rgba(13,17,32,.75);padding:3px 8px;border-radius:4px}
      </style><div class="grid">${cells}</div>`);
    await sheet.waitForTimeout(300);
    await sheet.screenshot({ path: path.join(ROOT, 'shots/art-boss.png') });
    await sheet.close();
  }

  await browser.close();
  console.log(`\n${made.length}장 · shots/art-preview.png` +
    (has('wall.png') ? ' · shots/art-scene.png' : '') +
    (bosses.length ? ' · shots/art-boss.png' : ''));
})();
