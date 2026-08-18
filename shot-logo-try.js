// shots/logo-try/*.webp 를 **실제 타이틀 화면 위에** 얹어 나란히 보여 줍니다.
//
//   CHROME_PATH=... node shot-logo-try.js
//
// 글자만 따로 보면 못 고릅니다 — 배경의 밝은 데를 밟는지, 아래 그림과 무게가
// 맞는지가 이 그림의 전부입니다. 자리·크기·덮개는 js/scene-title.js 그대로입니다
// (가로 = 화면폭 - 32, 위 176, 원점 위가운데).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const TRY = path.join(ROOT, 'shots', 'logo-try');
const W = 540, HGT = 960;
const uri = (f, m) => 'data:image/' + m + ';base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const names = fs.readdirSync(TRY).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();
  // 지금 쓰는 것도 맨 앞에 끼워 견줍니다 — 무엇이 나아졌는지 보려면 기준이 있어야 합니다.
  const cards = [{ name: '지금 것', file: path.join(ROOT, 'art', 'title-logo.webp') }]
    .concat(names.map((n) => ({ name: n, file: path.join(TRY, n + '.webp') })))
    .filter((c) => fs.existsSync(c.file));

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
  const scale = 0.62;                       // 여럿을 한 판에 놓으려고 줄입니다
  const cw = Math.round(W * scale), chh = Math.round(HGT * scale);
  const page = await browser.newPage({
    viewport: { width: cards.length * (cw + 10) + 10, height: chh + 34 } });

  const back = uri(path.join(ROOT, 'art', 'title-art.webp'), 'webp');
  await page.setContent(`<style>
      html,body{margin:0;background:#15171c;font:13px sans-serif;color:#cfd8dc}
      .row{display:flex;gap:10px;padding:5px}
      .c{width:${cw}px}
      .s{position:relative;width:${cw}px;height:${chh}px;overflow:hidden;background:#0a0d18}
      .s img.bg{position:absolute;left:0;top:0;width:${cw}px;height:${chh}px;object-fit:cover}
      .veil{position:absolute;inset:0;background:rgba(10,13,24,.42)}
      .foot{position:absolute;left:0;right:0;bottom:0;height:${Math.round(320 * scale)}px;
            background:rgba(10,13,24,.55)}
      /* js/logo.js — 가로를 화면폭-32 에 맞추고 위 176 에 세웁니다 */
      .s img.lg{position:absolute;left:${Math.round(16 * scale)}px;top:${Math.round(176 * scale)}px;
                width:${Math.round((W - 32) * scale)}px}
      .hint{position:absolute;left:0;right:0;top:${Math.round((HGT - 128 - 11) * scale)}px;
            text-align:center;color:#b0bec5;font-size:${Math.round(22 * scale)}px}
      .l{text-align:center;padding-top:6px}
    </style><div class=row>${cards.map((c) => `
      <div class=c><div class=s>
        <img class=bg src="${back}"><div class=veil></div><div class=foot></div>
        <img class=lg src="${uri(c.file, 'webp')}">
        <div class=hint>터치해서 계속하기</div>
      </div><div class=l>${c.name}</div></div>`).join('')}</div>`);
  await page.waitForTimeout(500);
  const out = path.join(ROOT, 'shots', 'logo-try.png');
  await page.screenshot({ path: out });

  // ── 두 번째 판 — 글자만 크게 ────────────────────────────
  // 화면에 얹은 것만으로는 획을 못 봅니다. 고르는 것은 결이므로 크게도
  // 한 번 보여 줍니다. 바탕은 타이틀에서 글자가 실제로 앉는 색입니다.
  const big = await browser.newPage({
    viewport: { width: 1180, height: cards.length * 240 + 20 } });
  await big.setContent(`<style>
      html,body{margin:0;background:#15171c;font:14px sans-serif;color:#cfd8dc}
      .r{display:flex;align-items:center;gap:16px;padding:6px 10px}
      .n{width:70px;text-align:right;color:#8794b5}
      .b{width:1040px;background:#1b2033;border-radius:6px;padding:8px 0}
      .b img{width:1020px;display:block;margin:0 auto}
    </style>${cards.map((c) => `
      <div class=r><div class=n>${c.name}</div>
        <div class=b><img src="${uri(c.file, 'webp')}"></div></div>`).join('')}`);
  await big.waitForTimeout(400);
  const out2 = path.join(ROOT, 'shots', 'logo-try-big.png');
  await big.screenshot({ path: out2, fullPage: true });

  await browser.close();
  console.log(out + '\n' + out2 + '  — ' + cards.map((c) => c.name).join(' · '));
})();
