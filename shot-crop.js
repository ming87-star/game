// shots/crop/*.webp 를 **실제 타이틀 화면 위에** 얹어 봅니다.
//
//   CHROME_PATH=... node shot-crop.js
//
// 잘라 낸 것은 따로 보면 못 고릅니다. 제목은 위 176 에, 「터치해서」는 아래
// 128 위에 앉습니다 (js/scene-title.js · js/logo.js 그대로).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const CROP = path.join(ROOT, 'shots', 'crop');
const W = 540, H = 960;
const uri = (f) => 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const all = fs.existsSync(CROP)
    ? fs.readdirSync(CROP).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort() : [];
  const titles = all.filter((n) => n.startsWith('title'));
  const hints = all.filter((n) => n.startsWith('hint'));
  if (!all.length) { console.error('shots/crop 이 비었습니다 — 먼저 node crop-ui.js'); process.exit(1); }

  // 제목은 하나뿐이므로 「터치해서」 쪽 가짓수만큼 판을 냅니다.
  const cards = (hints.length ? hints : [null]).map((h) => ({ hint: h, title: titles[0] || null }));

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
  const s = 0.62;
  const cw = Math.round(W * s), chh = Math.round(H * s);
  const page = await browser.newPage({
    viewport: { width: cards.length * (cw + 10) + 10, height: chh + 34 } });

  const back = 'data:image/webp;base64,'
    + fs.readFileSync(path.join(ROOT, 'art', 'title-art.webp')).toString('base64');

  await page.setContent(`<style>
      html,body{margin:0;background:#15171c;font:13px sans-serif;color:#cfd8dc}
      .row{display:flex;gap:10px;padding:5px}
      .s{position:relative;width:${cw}px;height:${chh}px;overflow:hidden;background:#0a0d18}
      .s img.bg{position:absolute;left:0;top:0;width:${cw}px;height:${chh}px;object-fit:cover}
      .veil{position:absolute;inset:0;background:rgba(10,13,24,.42)}
      .foot{position:absolute;left:0;right:0;bottom:0;height:${Math.round(320 * s)}px;
            background:rgba(10,13,24,.55)}
      /* js/logo.js — 가로를 화면폭-32 에 맞추고 위 176 에 */
      .lg{position:absolute;left:${Math.round(16 * s)}px;top:${Math.round(176 * s)}px;
          width:${Math.round((W - 32) * s)}px}
      /* 「터치해서」 — 가운데, 아래에서 128 (원래 글자의 자리)  */
      .ht{position:absolute;left:50%;transform:translate(-50%,-50%);
          top:${Math.round((H - 128) * s)}px;width:${Math.round(400 * s)}px}
      .l{text-align:center;padding-top:6px}
    </style><div class=row>${cards.map((c) => `
      <div><div class=s>
        <img class=bg src="${back}"><div class=veil></div><div class=foot></div>
        ${c.title ? `<img class=lg src="${uri(path.join(CROP, c.title + '.webp'))}">` : ''}
        ${c.hint ? `<img class=ht src="${uri(path.join(CROP, c.hint + '.webp'))}">` : ''}
      </div><div class=l>${c.hint || '제목만'}</div></div>`).join('')}</div>`);
  await page.waitForTimeout(500);
  const out = path.join(ROOT, 'shots', 'crop-try.png');
  await page.screenshot({ path: out });
  await browser.close();
  console.log(out + '  — ' + cards.map((c) => c.hint || '제목만').join(' · '));
})();
