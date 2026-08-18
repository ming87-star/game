// 제목 글자를 **여러 결로 그려 놓고 고릅니다.**
//
//   GEMINI_API_KEY=... node gen-logo.js            여섯 벌 다
//   GEMINI_API_KEY=... node gen-logo.js stone metal  고른 것만
//
// ── 왜 따로 두는가 ────────────────────────────────────────
// gen-story.js 는 art/title-logo.webp 를 곧장 덮어씁니다. 고르려면 여러 벌을
// 나란히 놓고 봐야 하는데, 덮어쓰면 앞의 것이 없어져서 견줄 수가 없습니다.
// 그래서 여기서는 shots/logo-try/ 에 쌓아 두기만 하고, 고른 뒤에 손으로
// art/ 로 옮깁니다 (아래에 그 명령을 찍어 줍니다).
//
// 바꾸는 것은 **획의 결 하나뿐**입니다. 글줄·표시·색·비율은 ART.md 7.96 그대로
// 둡니다 — 여러 가지를 한꺼번에 바꾸면 무엇 때문에 좋아졌는지 알 수 없습니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'shots', 'logo-try');
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const MAX_BYTES = 400 * 1024;
const QUALITY_STEPS = [0.94, 0.9, 0.86, 0.82, 0.78, 0.72];
const W = 1024, H = 410;                 // 5:2

// ── 결 여섯 ───────────────────────────────────────────────
// 지금 쓰는 것은 `brush` 에 가깝습니다. 나머지 다섯은 일부러 멀리 벌려
// 두었습니다 — 비슷한 것을 여섯 개 놓으면 고를 수가 없습니다.
const CUTS = {
  stone: ['Letterforms CARVED INTO COLD STONE: hard chiselled edges with a visible bevel,',
    'each stroke cut with a flat blade so the ends are square and slightly chipped,',
    'a sharp lit face on the upper-left of every stroke and deep shadow inside the cut.',
    'Weighty and monumental, like an inscription on a tomb.'].join(' '),

  metal: ['Letterforms FORGED FROM DARK IRON: thick slabs of cold metal with a bevelled edge,',
    'a hard specular highlight running along one side of each stroke, faint nicks and',
    'scratches, a dull violet sheen where the light catches. Heavy, hard, machine-cut',
    'rather than hand-drawn.'].join(' '),

  blade: ['Letterforms cut like SWORD STROKES: every stroke starts thick and tapers to a fine',
    'sharp point, slightly angled as if slashed in one pass, with a thin bright edge-light',
    'along the leading side. Fast, sharp and aggressive, but still perfectly legible.'].join(' '),

  ink: ['Letterforms written with a DRY INK BRUSH on rough paper: strong pressure changes so',
    'strokes swell and thin, split hairline streaks inside the thick parts where the brush',
    'ran dry, blunt torn ends. Confident and calligraphic, not neat.'].join(' '),

  heavy: ['Letterforms as a HEAVY ANGULAR GAME LOGO: very bold condensed geometric shapes,',
    'flat faces, sharp corners, almost no stroke-width variation, tight spacing so the two',
    'lines read as one solid block. Modern, loud, poster-like — the kind of title stamped on',
    'a game box.'].join(' '),

  quiet: ['Letterforms written by hand with a THIN, CALM PEN: light even strokes, generous',
    'spacing, no drama, slightly irregular where a hand would waver. Restrained and literary,',
    'like a line copied into a diary. Still clearly readable at a glance.'].join(' '),
};

// ── 글줄과 표시 — 여기는 안 건드립니다 (ART.md 7.96) ───────
const BODY = [
  'Korean hand-lettered game title logo, two lines, centred, on a flat pure magenta',
  '#FF00FF chroma key background (it will be keyed out later).',
  'Line 1, smaller and dimmer, muted blue-grey: 오늘도 탑을 오르는 나는',
  'Line 2, much larger and brighter, near-white with a faint violet edge light:',
  '무슨 생각을 해야 하나',
  'Reproduce the Korean characters EXACTLY as written above — do not invent, alter,',
  'reorder or add any glyph. Hangul syllable blocks must stay correctly formed.',
  'A single thin horizontal rule under line 2, violet #7E6BC4, slightly frayed.',
  'Above the lettering, small and centred, a simple mark: four stacked horizontal bars',
  'forming a ziggurat — widest at the bottom, each one narrower and brighter going up,',
  'from deep navy to pale violet.',
  'Palette: navy #141A2E, violet #7E6BC4 and #B39DDB, near-white #FFFFFF,',
  'muted blue-grey #8794B5. Dark, calm, weighty.',
].join(' ');

const BG = [
  'Wide horizontal composition, roughly 5:2, the lettering filling the frame.',
  'The background is one completely flat, uniform, pure magenta #FF00FF chroma key screen.',
  'Every single pixel that is not the lettering or the small mark must be exactly that same',
  'magenta — no gradient, no texture, no vignette, no panel, no card, no frame, no border,',
  'and NO SHADOW of any kind behind or under the letters.',
  'No characters, no tower, no props, no scenery, no watermark, no signature.',
  'No Latin letters and no words other than the two Korean lines given.',
  'FINAL REMINDER: everything behind and around the lettering is flat pure magenta #FF00FF.',
  'Not grey. Not navy. Not a checkerboard. Not a card or a panel. Magenta.',
].join(' ');

const promptFor = (cut) => ['Hand-lettered Korean game title logo artwork.', BODY, CUTS[cut], BG]
  .join('\n\n');

function pickImage(json) {
  const out = [];
  (function walk(n, d) {
    if (!n || d > 12 || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
    const i = n.inlineData || n.inline_data;
    if (i && typeof i.data === 'string') out.push(i.data);
    Object.keys(n).forEach((k) => walk(n[k], d + 1));
  })(json, 0);
  return out[0];
}

async function generate(cut) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/'
      + encodeURIComponent(MODEL) + ':generateContent',
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFor(cut) }] }],
        generationConfig: { imageConfig: { aspectRatio: '21:9' } },   // 5:2 에 가장 가까운 것
      }) });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' · ' + text.slice(0, 160).replace(/\s+/g, ' '));
  const b64 = pickImage(JSON.parse(text));
  if (!b64) throw new Error('응답에 그림이 없습니다');
  return Buffer.from(b64, 'base64');
}

// 마젠타를 걷어내고 5:2 로 잘라 굽습니다 (gen-story.js 의 bake 와 같은 규칙).
async function bake(page, png) {
  return page.evaluate(async ({ b64, w, h, steps, max }) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = () => j(new Error('못 읽음')); 
      img.src = 'data:image/png;base64,' + b64; });
    const ar = w / h;
    let cw = img.width, ch = Math.round(cw / ar);
    if (ch > img.height) { ch = img.height; cw = Math.round(ch * ar); }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, (img.width - cw) / 2, (img.height - ch) / 2, cw, ch, 0, 0, w, h);
    const TOL = 110, FEATHER = 70;
    const d = x.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const dist = Math.hypot(p[i] - 255, p[i + 1], p[i + 2] - 255);
      if (dist < TOL) { p[i + 3] = 0; continue; }
      if (dist < TOL + FEATHER) p[i + 3] = Math.round(p[i + 3] * (dist - TOL) / FEATHER);
      const lo = Math.min(p[i], p[i + 2]);
      if (p[i + 1] < lo) p[i + 1] = lo;
    }
    x.putImageData(d, 0, 0);
    let clear = 0;
    for (let i = 3; i < p.length; i += 4) if (p[i] < 32) clear++;
    let last = null;
    for (const q of steps) {
      const url = c.toDataURL('image/webp', q);
      last = { url, q, bytes: Math.floor((url.length - url.indexOf(',') - 1) * 0.75),
        clear: +(clear / (w * h) * 100).toFixed(1) };
      if (last.bytes <= max) return last;
    }
    return last;
  }, { b64: png.toString('base64'), w: W, h: H, steps: QUALITY_STEPS, max: MAX_BYTES });
}

(async () => {
  if (!KEY) { console.error('GEMINI_API_KEY 가 없습니다'); process.exit(1); }
  const want = process.argv.slice(2).filter((a) => CUTS[a]);
  const cuts = want.length ? want : Object.keys(CUTS);
  fs.mkdirSync(OUT, { recursive: true });

  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage();
  await page.setContent('<html></html>');

  const made = [];
  for (const cut of cuts) {
    process.stdout.write(`${cut.padEnd(6)} … `);
    try {
      const png = await generate(cut);
      const baked = await bake(page, png);
      const file = path.join(OUT, cut + '.webp');
      fs.writeFileSync(file, Buffer.from(baked.url.slice(baked.url.indexOf(',') + 1), 'base64'));
      made.push(cut);
      console.log(`${W}×${H} · 화질 ${baked.q} · 투명 ${baked.clear}% · ${Math.round(baked.bytes / 1024)}KB`);
    } catch (e) {
      console.log('실패 — ' + e.message);
    }
  }
  await browser.close();

  if (made.length) {
    console.log('\nshots/logo-try/ 에 ' + made.length + '벌.');
    console.log('마음에 드는 것을 고르면:  cp shots/logo-try/<이름>.webp art/title-logo.webp');
    console.log('그다음:  node bake-story.js && node build.js && node shot-story.js');
  }
})();
