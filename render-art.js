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
    const page = await browser.newPage({
      viewport: { width: Math.round(w * SCALE), height: Math.round(h * SCALE) },
      deviceScaleFactor: 1,
    });
    // SVG 를 뷰포트에 딱 맞춰 늘립니다. 벡터라 아무리 키워도 계단이 안 집니다.
    await page.setContent(
      '<style>html,body{margin:0;background:transparent}' +
      'svg{display:block;width:100vw;height:100vh}</style>' + svg);
    const name = file.replace(/\.svg$/, '.png');
    await page.screenshot({ path: path.join(OUT, name), omitBackground: true });
    await page.close();
    made.push({ name, w, h });
    console.log(`${name}  ${w}×${h} → ${Math.round(w * SCALE)}×${Math.round(h * SCALE)}`);
  }

  // ── 미리보기 한 장 ────────────────────────────────────
  // 실제 게임 크기와 크게 키운 것을 나란히, 진짜 배경색 위에 얹습니다.
  const cell = 150;
  const page = await browser.newPage({
    viewport: { width: Math.max(560, made.length * cell + 40), height: 360 },
    deviceScaleFactor: 2,
  });
  // 그림은 data URI 로 박아 넣습니다. setContent 로 띄운 쪽은 file:// 을 못 읽습니다.
  const cards = made.map((m) => {
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

  await browser.close();
  console.log(`\n${made.length}장 · shots/art-preview.png 에 미리보기`);
})();
