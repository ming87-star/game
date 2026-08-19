// 받아 온 타이틀 그림을 **9:16 으로 맞춥니다.**
//
//   CHROME_PATH=... node fit-title.js "art/incoming/new title art.png"
//
// ── 왜 필요한가 ───────────────────────────────────────────
// 타이틀 배경은 화면을 덮습니다(cover). 그림이 9:16 보다 넓적하면 **좌우가
// 잘려 나갑니다** — 0.800 짜리를 넣으면 30%가 화면 밖으로 밀립니다. 구석에
// 그려 넣은 것들이 통째로 사라집니다.
//
// 좌우를 잘라 9:16 을 만드는 길도 있지만 그건 같은 손실입니다. 대신
// **위에 어두운 띠를 이어 붙여** 세로를 늘립니다. 잃는 것이 없고, 덤으로
// 제목이 앉을 빈 자리가 생깁니다 (그게 원래 규격이 요구하던 것입니다).
//
// 이어 붙이는 띠는 그림의 **맨 윗부분을 세로로 늘린 것**입니다. 대개 어두운
// 벽이라 늘려도 티가 안 나고, 색이 이어지므로 경계가 안 보입니다.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'art', 'incoming');
const AR = 9 / 16;          // 타이틀 배경의 규격
const BAND = 0.09;          // 위에서 이만큼을 늘려 씁니다 (그림 높이의 비율)
const DARK = 0.45;          // 이어 붙인 띠를 위로 갈수록 이만큼 어둡게

(async () => {
  const src = process.argv[2];
  if (!src || !fs.existsSync(src)) { console.error('그림 파일을 주세요'); process.exit(1); }
  const b64 = fs.readFileSync(src).toString('base64');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<html></html>');

  const r = await page.evaluate(async (a) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error('못 읽었습니다'));
      img.src = 'data:image/png;base64,' + a.b64;
    });

    // 1. 가장자리의 검은 테두리를 걷어냅니다. 이어 붙일 때 검은 줄이 남습니다.
    const probe = document.createElement('canvas');
    probe.width = img.width; probe.height = img.height;
    const px = probe.getContext('2d', { willReadFrequently: true });
    px.drawImage(img, 0, 0);
    const d = px.getImageData(0, 0, img.width, img.height).data;
    const lum = (X, y) => {
      const i = (y * img.width + X) * 4;
      return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    };
    const rowLit = (y) => { let n = 0; for (let X = 0; X < img.width; X += 4) if (lum(X, y) > 0.06) n++;
      return n / (img.width / 4); };
    const colLit = (X) => { let n = 0; for (let y = 0; y < img.height; y += 4) if (lum(X, y) > 0.06) n++;
      return n / (img.height / 4); };
    let t = 0, b = img.height - 1, l = 0, rr = img.width - 1;
    while (t < b && rowLit(t) < 0.5) t++;
    while (b > t && rowLit(b) < 0.5) b--;
    while (l < rr && colLit(l) < 0.5) l++;
    while (rr > l && colLit(rr) < 0.5) rr--;
    const cw = rr - l + 1, ch = b - t + 1;

    // 2. 9:16 이 되도록 **위에 붙일 높이**를 셉니다.
    const want = Math.round(cw / a.ar);
    const add = Math.max(0, want - ch);

    const o = document.createElement('canvas');
    o.width = cw; o.height = ch + add;
    const ox = o.getContext('2d');
    ox.imageSmoothingQuality = 'high';

    // 3. 맨 윗부분을 늘려 위를 채웁니다. 그런 다음 위로 갈수록 어둡게 덮어
    //    늘어난 티를 지우고 제목이 앉을 자리를 만듭니다.
    if (add > 0) {
      const band = Math.max(2, Math.round(ch * a.band));
      ox.drawImage(img, l, t, cw, band, 0, 0, cw, add);
      const g = ox.createLinearGradient(0, 0, 0, add);
      g.addColorStop(0, 'rgba(10,13,24,' + a.dark + ')');
      g.addColorStop(1, 'rgba(10,13,24,0)');
      ox.fillStyle = g;
      ox.fillRect(0, 0, cw, add);
    }
    ox.drawImage(img, l, t, cw, ch, 0, add, cw, ch);

    // 4. 구워 냅니다. 400KB 를 넘지 않게 화질을 내려 갑니다 (bake-story 와 같은 규칙).
    const steps = [0.94, 0.9, 0.86, 0.82, 0.78, 0.72, 0.66];
    let last = null;
    for (const q of steps) {
      const url = o.toDataURL('image/webp', q);
      last = { url, q, bytes: Math.floor((url.length - url.indexOf(',') - 1) * 0.75) };
      if (last.bytes <= 400 * 1024) break;
    }
    return Object.assign(last, { from: img.width + '×' + img.height,
      trimmed: cw + '×' + ch, add, w: o.width, h: o.height });
  }, { b64, ar: AR, band: BAND, dark: DARK });

  await browser.close();
  const name = 'title-art-fitted.webp';
  fs.writeFileSync(path.join(OUT, name),
    Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'));
  console.log(`${r.from} → 테두리 걷고 ${r.trimmed} → 위에 ${r.add}px 이어 붙여 `
    + `${r.w}×${r.h} (${(r.w / r.h).toFixed(3)}:1) · 화질 ${r.q} · ${Math.round(r.bytes / 1024)}KB`);
  console.log('art/incoming/' + name);
})();
