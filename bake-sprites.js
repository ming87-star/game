// assets/*.png 로 그려 둔 스프라이트를 js/spritedata.js 한 장으로 묶습니다.
//
//   CHROME_PATH=... node bake-sprites.js
//
// ── art/*.svg 와 무엇이 다른가 ────────────────────────────
// 손으로 그린 것은 art/*.svg 에 있고 bake-art.js 가 묶습니다. 그런데 적 여덟과
// 박쥐 둘은 gen-sprite.js 가 그려서 assets/*.png 로 나왔습니다 (원본이 래스터라
// SVG 로 만들 길이 없습니다). 그것들이 갈 자리가 없어서 게임에서는 여태
// **도형이 대신 서 있었습니다** — 그림은 다 그려 놓고 아무도 안 쓰고 있었습니다.
//
// ── 왜 4배를 1배로 줄이는가 ──────────────────────────────
// **이 엔진은 충돌 상자가 그림 배율을 따라가지 않습니다.** 128×128 로 구워 놓고
// 화면에서만 줄이면, 보이는 것은 32px인데 부딪히는 상자는 128px 로 남습니다.
// 적이 허공에서 걸리고 발판에 안 얹힙니다 (자세한 것은 js/artset.js 맨 위).
//
// art/*.svg 는 viewBox 크기 그대로(1배) 굽습니다. 그림은 4배로 그려 두었으므로
// 여기서 4로 나눠 같은 규칙에 맞춥니다 — 그래야 지금까지의 충돌·사거리 계산이
// 한 줄도 안 바뀌고 그대로 맞습니다.
//
// ── 왜 webp 인가 ─────────────────────────────────────────
// 알파가 있어야 하는데 PNG 는 무겁습니다. 32×32 로 줄이고 나면 어차피 작지만,
// 같은 그림이 PNG 의 몇 분의 일입니다. bake-sheets.js 와 같은 이유입니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ART = path.join(ROOT, 'art');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'js', 'spritedata.js');

const SCALE = 4;      // 그림은 4배로 그려져 있습니다 (ART.md)
const QUALITY = 0.92; // 32px 까지 줄이고 나면 화질이 아까우므로 넉넉히 줍니다

// 이 목록에 있는 것만 굽습니다. assets/ 에는 미리보기로 구워 둔 것(art/*.svg 를
// render-art.js 로 뽑은 것)도 섞여 있어서, 통째로 쓸어 담으면 손으로 그린 SVG 를
// 그 미리보기가 덮어씁니다.
//
// 기는 것 · 뛰는 것 · 날것 · 단단한 놈 넷은 **손그림 SVG 가 이기고 있었습니다.**
// AI 가 그린 것이 assets/ 에 이미 있었는데 아무도 안 쓰고 있었고, 그래서 이 넷만
// 그림체가 달랐습니다. 지금은 art/e-*.svg 넷을 지워서 AI 쪽이 씁니다.
const WANT = [
  'e-coinbug', 'e-crawler', 'e-hopper', 'e-goldfrog', 'e-flyer', 'e-brute',
  'e-charger', 'e-dasher', 'e-bomber', 'e-giant', 'e-splitter', 'e-shooter',
  'e-diver', 'e-ghost',
  'bat-thief', 'bat-biter',
];   // 적 열넷 + 박쥐 둘 — 게임에 나오는 적 전부입니다

(async () => {
  const jobs = [];
  const skipped = [];
  const missing = [];

  for (const key of WANT) {
    // **손으로 그린 SVG 가 있으면 그쪽이 이깁니다.** assets/ 의 같은 이름은
    // 그 SVG 의 미리보기일 뿐이라, 덮어쓰면 원본을 잃습니다.
    if (fs.existsSync(path.join(ART, key + '.svg'))) { skipped.push(key); continue; }
    const png = path.join(ASSETS, key + '.png');
    if (!fs.existsSync(png)) { missing.push(key); continue; }
    jobs.push({ key, png });
  }

  const out = {};
  if (jobs.length) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || undefined,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();

    for (const { key, png } of jobs) {
      const uri = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
      const r = await page.evaluate(async ([src, div, q]) => {
        const img = new Image();
        await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
        const c = document.createElement('canvas');
        c.width = Math.round(img.width / div);
        c.height = Math.round(img.height / div);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
        return { uri: c.toDataURL('image/webp', q), w: c.width, h: c.height, from: img.width };
      }, [uri, SCALE, QUALITY]);

      out[key] = { w: r.w, h: r.h, uri: r.uri };
      const was = Math.round(fs.statSync(png).size / 1024);
      const now = Math.round(r.uri.length * 0.75 / 1024);
      console.log(`${key}  ${r.from}px ${was}KB → ${r.w}×${r.h} ${now}KB`);
    }
    await browser.close();
  }

  fs.writeFileSync(OUT,
    '// node bake-sprites.js 가 만든 파일입니다. 손으로 고치지 마세요.\n' +
    '// assets/*.png (4배로 그린 것)를 1배로 줄여 담았습니다 — 게임 픽셀 = 그림 픽셀.\n' +
    'const SPRITE_ART = ' + JSON.stringify(out, null, 0) + ';\n');

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\njs/spritedata.js  ${kb}KB  (${Object.keys(out).length}장)`);
  if (skipped.length) console.log('손그림 SVG 가 이김: ' + skipped.join(' '));
  if (missing.length) console.log('아직 없는 그림: ' + missing.join(' ') + ' (도형이 자리를 지킵니다)');
})();
