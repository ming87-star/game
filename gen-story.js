// 「탑 오르기」 이야기 컷씬 여섯 장을 만듭니다.
//
//   GEMINI_API_KEY=... node gen-story.js            여섯 장 전부
//   GEMINI_API_KEY=... node gen-story.js story-3    한 장만 다시
//
// 앞 그림을 뒤 그림의 참조로 물립니다. 텍스트 프롬프트만으로는 여섯 장에서
// 같은 사람을 유지할 수 없기 때문입니다. 다만 바로 앞 장만 물리면 조금씩
// 어긋난 것이 쌓이므로, **story-1 을 기준으로 늘 함께 붙이고** 거기에 바로
// 앞 장을 더합니다 — 기준점 하나와 흐름 하나.
//
// 키는 저장소에 두지 않습니다. 환경 변수로만 받습니다.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'shots', 'story-raw');   // shots/ 는 .gitignore 에 있습니다
const OUT = path.join(ROOT, 'art');   // bake-story.js 가 art/ 에서 읽습니다

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const SIZE = 1024;
const MAX_BYTES = 400 * 1024;

// ── 여섯 장에 글자 하나 안 바꾸고 붙는 두 덩어리 ──────────────
// 이게 여섯 장을 한 세계로 묶는 유일한 장치입니다. 장면마다 조금씩 고치면
// 이야기가 아니라 그림 모음이 됩니다.
const STYLE = [
  'Dark, calm fantasy illustration — a cutscene still for a vertical mobile game.',
  'Setting: the inside of a cold dark-blue stone tower.',
  'Muted palette anchored on deep navy #141A2E and #1D2542, low saturation,',
  'moody cinematic lighting with one clear light source, soft rim light.',
  'Painterly game illustration with clean readable shapes.',
  'Square 1:1 composition, one single unified scene.',
  'Absolutely no text, no letters, no numbers, no speech bubbles, no subtitles, no captions,',
  'no watermark, no signature, no logo, no border, no frame, no vignette frame,',
  'no comic panels, no panel divisions, no split screen, no collage.',
  'Avoid bright white or light backgrounds.',
].join(' ');

const HERO = [
  'The knight: broad angular shoulder armour, a horned helmet with a red crest,',
  'steel-grey armour with red cloth, and one large sword.',
  'His face is almost entirely hidden by the helmet. Red accent colour #EF9A9A.',
].join(' ');

const REF_NOTE = [
  'Use the attached image(s) as the exact visual reference for the knight and for the world:',
  'keep the same armour silhouette, the horned helmet with its red crest, the same colours,',
  'proportions, art style, palette and lighting. Same character, same tower, a different moment.',
].join(' ');

// scene = 그 장면에서만 다른 것. 위의 두 덩어리는 자동으로 붙습니다.
const SCENES = [
  {
    name: 'story-1',
    refs: [],
    scene: [
      'The knight lies fallen on the cold stone floor in darkness and has just opened his eyes.',
      'Nobody else is present. Only a faint shaft of pale light falls from far above.',
      'Stillness and silence. He has lost his memory and does not know where he is.',
    ].join(' '),
  },
  {
    name: 'story-2',
    refs: ['story-1'],
    scene: [
      'Extreme upward perspective from behind the knight, over his shoulders.',
      'The knight is small and low in the frame, seen from behind, head tilted back.',
      'Above him the tower shaft climbs forever: tier after tier of stone ledges, broken',
      'platforms and arched openings shrinking into blackness, receding far past the top of',
      'the frame. The top is NOT visible and there is NO ceiling, NO dome, NO closed roof —',
      'only depth going up and up until it disappears. A tiny pinprick of pale light',
      'impossibly far above. There are no stairs leading down anywhere.',
      'The scale should feel crushing: the climb is impossibly tall.',
    ].join(' '),
  },
  {
    name: 'story-3',
    refs: ['story-1', 'story-2'],
    scene: [
      'The knight traces an ancient carved stone relief on the tower wall with his gloved hand.',
      'The worn relief faintly depicts an enormous horned crowned being at the top of the tower.',
      'Raking side light picks out the carving. Close, quiet, curious.',
    ].join(' '),
  },
  {
    name: 'story-4',
    refs: ['story-1', 'story-3'],
    scene: [
      'Back view of the knight as he steps up onto the first stone platform, sword in hand.',
      'Above him three diverging paths are faintly visible in the gloom.',
      'A moment of resolve — he has decided to climb.',
    ].join(' '),
  },
  {
    name: 'meet-archer',
    refs: ['story-1', 'story-4'],
    scene: [
      'An archer stands over the fallen knight, looking down at him.',
      'The arrow they have just loosed has pierced a monster lying dead beside them.',
      'They are lowering their bow, the string still settling.',
      'The archer wears a pointed hood, has a slender tall build, and holds a bow;',
      'green tones #A5D6A7. Their face is clearly visible and catches the light —',
      'they are the protagonist of the next story. The knight stays red, the archer green:',
      'the two must read as different people at a glance.',
    ].join(' '),
  },
  {
    name: 'meet-rogue',
    refs: ['story-1', 'meet-archer'],
    scene: [
      'A rogue is going through the fallen knight\'s pack and has just frozen mid-motion.',
      'Gold coins are scattered across the dark stone floor, catching the light.',
      'The rogue is crouched down LOW and close to the ground, knees deeply bent,',
      'body coiled near the floor beside the knight — not standing, not upright.',
      'Hood and a cloth face covering. They hold TWO daggers, one in each hand,',
      'both blades clearly visible.',
      'They look straight out at the viewer from the darkness. Purple tones #CE93D8.',
      'The knight stays red, the rogue purple: the two must read as different people at a glance.',
    ].join(' '),
  },
];

function promptFor(s) {
  const parts = [];
  if (s.refs.length) parts.push(REF_NOTE);
  parts.push(s.scene);
  parts.push(HERO);
  parts.push(STYLE);
  return parts.join('\n\n');
}

// ── 한 장 만들기 ───────────────────────────────────────────
function pickImage(json) {
  const out = [];
  (function walk(node, depth) {
    if (!node || depth > 12 || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const inline = node.inlineData || node.inline_data;
    if (inline && typeof inline.data === 'string') {
      out.push({ b64: inline.data, mime: inline.mimeType || inline.mime_type || 'image/png' });
    }
    Object.keys(node).forEach((k) => walk(node[k], depth + 1));
  })(json, 0);
  return out[0] || null;
}

async function generate(scene) {
  const parts = [];
  // 참조를 먼저 넣어야 지시문이 그 그림을 가리킵니다.
  for (const ref of scene.refs) {
    const file = path.join(RAW, ref + '.png');
    if (!fs.existsSync(file)) continue;
    parts.push({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(file).toString('base64') } });
  }
  parts.push({ text: promptFor(scene) });

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(MODEL) + ':generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { imageConfig: { aspectRatio: '1:1' } },
      }),
    });

  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' · ' + text.slice(0, 400));
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error('응답을 못 읽었습니다 · ' + text.slice(0, 200)); }
  const img = pickImage(json);
  if (!img) throw new Error('응답에 그림이 없습니다 · ' + text.slice(0, 400));
  return Buffer.from(img.b64, 'base64');
}

// ── 굽기 ───────────────────────────────────────────────────
// 1:1 로 맞추고 webp 로 줄입니다. 화질을 높은 쪽부터 내려가며 처음으로
// 상한(400KB)에 들어오는 값에서 멈춥니다 — 더 내리면 어두운 면에 띠가 생기는데
// 이 그림들은 어두운 면이 대부분이라 거기서 제일 먼저 티가 납니다.
const QUALITY_STEPS = [0.94, 0.9, 0.86, 0.82, 0.78, 0.72, 0.66, 0.58, 0.5];

async function bake(oven, pngBuffer, outName) {
  const baked = await oven.evaluate(async ({ b64, size, max, steps }) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error('그림을 못 읽었습니다'));
      img.src = 'data:image/png;base64,' + b64;
    });
    // 정사각형으로 맞춥니다. 모델이 1:1 로 안 주면 가운데를 잘라 냅니다.
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    const sizeOf = (u) => Math.floor((u.length - u.indexOf(',') - 1) * 0.75);
    let last = null;
    for (const q of steps) {
      const url = canvas.toDataURL('image/webp', q);
      last = { url, q, bytes: sizeOf(url), w: img.width, h: img.height };
      if (last.bytes <= max) return last;
    }
    return last;
  }, { b64: pngBuffer.toString('base64'), size: SIZE, max: MAX_BYTES, steps: QUALITY_STEPS });

  const body = baked.url.slice(baked.url.indexOf(',') + 1);
  fs.writeFileSync(path.join(OUT, outName), Buffer.from(body, 'base64'));
  return baked;
}

(async () => {
  if (!KEY) { console.error('GEMINI_API_KEY 가 없습니다'); process.exit(1); }
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todo = only.length ? SCENES.filter((s) => only.includes(s.name)) : SCENES;
  if (!todo.length) { console.error('그런 장면이 없습니다: ' + only.join(', ')); process.exit(1); }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const oven = await browser.newPage();
  await oven.setContent('<html></html>');

  const made = [];
  for (const scene of todo) {
    const refs = scene.refs.filter((r) => fs.existsSync(path.join(RAW, r + '.png')));
    process.stdout.write(`${scene.name}  참조 [${refs.join(', ') || '없음'}] … `);
    try {
      const png = await generate({ ...scene, refs });
      fs.writeFileSync(path.join(RAW, scene.name + '.png'), png);
      const baked = await bake(oven, png, scene.name + '.webp');
      const over = baked.bytes > MAX_BYTES ? '  ← 상한 초과' : '';
      console.log(`${baked.w}×${baked.h} → ${SIZE}×${SIZE} · 화질 ${baked.q} · ` +
                  `${Math.round(baked.bytes / 1024)}KB${over}`);
      made.push({ name: scene.name + '.webp', kb: Math.round(baked.bytes / 1024) });
    } catch (e) {
      console.log('실패 — ' + e.message);
    }
  }

  // ── 여섯 장을 한 판에 ────────────────────────────────────
  // 한 장씩 보면 다 그럴듯한데, 늘어놓으면 인물이 딴사람이 되었거나
  // 밝기가 튀는 것이 그때 보입니다.
  const all = SCENES.map((s) => s.name + '.webp')
    .filter((n) => fs.existsSync(path.join(OUT, n)));
  if (all.length) {
    const b64 = (n) => 'data:image/webp;base64,' +
      fs.readFileSync(path.join(OUT, n)).toString('base64');
    const kb = (n) => Math.round(fs.statSync(path.join(OUT, n)).size / 1024);
    const sheet = await browser.newPage({
      viewport: { width: 1140, height: 830 }, deviceScaleFactor: 1,
    });
    await sheet.setContent(`<style>
        html,body{margin:0;background:#141a2e;font-family:sans-serif;color:#8794b5}
        .grid{display:flex;flex-wrap:wrap;gap:12px;padding:14px}
        figure{margin:0;width:360px}
        img{display:block;width:360px;height:360px;border:1px solid #2a3252}
        figcaption{font-size:12px;padding:6px 0 0;text-align:center}
      </style><div class="grid">${all.map((n) => `
        <figure><img src="${b64(n)}">
        <figcaption>${n.replace('.webp', '')} · ${kb(n)}KB</figcaption></figure>`).join('')}</div>`);
    await sheet.waitForTimeout(200);
    await sheet.screenshot({ path: path.join(ROOT, 'shots/story-sheet.png') });
    await sheet.close();
  }

  await browser.close();
  console.log(`\n${made.length}장 · shots/story-sheet.png 에 한 판으로`);
})();
