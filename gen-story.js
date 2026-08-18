// 이야기 컷씬 여덟 장을 만듭니다.
//
//   GEMINI_API_KEY=... node gen-story.js            여덟 장 전부
//   GEMINI_API_KEY=... node gen-story.js story-3    한 장만 다시
//
// 앞 그림을 뒤 그림의 참조로 물립니다. 텍스트 프롬프트만으로는 여덟 장에서
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

// ── 여덟 장에 글자 하나 안 바꾸고 붙는 두 덩어리 ──────────────
// 이게 여덟 장을 한 세계로 묶는 유일한 장치입니다. 장면마다 조금씩 고치면
// 이야기가 아니라 그림 모음이 됩니다.
// 첫 줄만 장면이 바꿔 낄 수 있습니다 (scene.head). 여덟 장 중 일곱은 조용한
// 컷인데 다섯째만 싸움이라, 여기에 「calm」이 박혀 있으면 그 한 장이 늘
// 얌전하게 나옵니다. 나머지는 글자 하나 안 바꾸고 그대로 붙습니다.
const HEAD = 'Dark, calm fantasy illustration — a cutscene still for a vertical mobile game.';

// 컷씬은 정사각형입니다 (액자가 정사각형이라). 타이틀 배경만 화면을 통째로
// 덮으므로 세로로 깁니다 — scene.shape 로 바꿔 낍니다.
const SHAPE = 'Square 1:1 composition, one single unified scene.';

const STYLE = [
  'Setting: the inside of a cold dark-blue stone tower.',
  'Muted palette anchored on deep navy #141A2E and #1D2542, low saturation,',
  'moody cinematic lighting with one clear light source, soft rim light.',
  'Painterly game illustration with clean readable shapes.',
  '@SHAPE@',
  'Absolutely no text, no letters, no numbers, no speech bubbles, no subtitles, no captions,',
  'no watermark, no signature, no logo, no border, no frame, no vignette frame,',
  'no comic panels, no panel divisions, no split screen, no collage.',
  'Avoid bright white or light backgrounds.',
].join(' ');

// 제목 글자용. 컷씬 화풍과 겹치는 것은 색뿐입니다.
const LETTER_STYLE = [
  '@SHAPE@',
  'Transparent background (PNG/WebP alpha) — no backdrop, no scenery, no frame, no border.',
  'Flat artwork on nothing: only the lettering and the small mark.',
  'No characters, no tower, no props, no watermark, no signature.',
  'No Latin letters and no words other than the two Korean lines given.',
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
  // ── 타이틀 화면 배경 ─────────────────────────────────
  // 켜면 가장 먼저 서는 화면입니다. 컷씬이 아니라 **화면을 통째로 덮는**
  // 그림이라 혼자만 세로로 깁니다 (9:16).
  //
  // 보스 다섯을 넘고 전리품을 전부 붙인 채 싸우는 한 순간입니다
  // (js/trophies.js 의 다섯 가지가 그대로 그림에 있어야 합니다 — 화면에서
  // 실제로 도는 것들이라, 여기서 처음 보는 물건이 섞이면 판에서 못 알아봅니다).
  //
  // **위아래를 비워야 합니다.** 위쪽에 제목이 서고 아래쪽에 「터치해서
  // 계속하기」가 섭니다. 이 한 가지가 어긋나면 아무리 잘 그려도 못 씁니다.
  {
    name: 'title-art',
    refs: ['story-1', 'story-4'],
    head: 'Dark, high-energy action fantasy illustration — the title screen background '
      + 'for a vertical mobile game.',
    shape: 'Tall vertical 9:16 composition that fills a phone screen, one single unified scene.',
    aspect: 9 / 16,
    scene: [
      'A dynamic action shot: the knight fighting high up inside the tower, mid-combat,',
      'body twisted into a full sword swing, cloth and crest streaming, sparks and embers',
      'flying, a shockwave of light along the blade. Low dramatic camera angle looking',
      'slightly up at him. Around him five or six monstrous silhouettes close in from the',
      'dark; two are being flung backwards by the blow.',
      'He is carrying the spoils taken from the bosses he has beaten, all visible at once:',
      '(1) three small floating eyeballs orbiting around him, each about one tenth of his',
      'height, trailing faint violet light, one of them firing a thin bolt;',
      '(2) a wide beam of pale piercing light lancing out past his shoulder through a row',
      'of enemies;',
      '(3) a pair of huge red-hot iron tongs, glowing like they came straight out of a forge,',
      'clamped around a monster beside him, that monster burning;',
      '(4) three small hatchling creatures, freshly broken out of their eggs, bounding along',
      'the floor at his feet and biting at the enemies;',
      '(5) a cracked pale mask worn over his face, over the helmet, slightly larger than his',
      'head, a fracture running across it.',
      'The far background falls away into an enormous dark drop — he is very high up.',
      'COMPOSITION IS CRITICAL: place the knight and the fighting in the MIDDLE BAND of the',
      'tall frame. The TOP QUARTER must be dark, simple and almost empty — only distant',
      'tower depth and haze, nothing important — because a title will sit there. The BOTTOM',
      'SIXTH must also stay dark and quiet, because a line of text sits there too.',
      'Energetic, kinetic, thrilling: this is the frame that says what this game is.',
    ].join(' '),
  },

  // ── 제목 글자 ────────────────────────────────────────
  // 그림이 없으면 코드가 글꼴로 짓습니다 (js/logo.js). 글꼴로 찍은 제목은
  // 무게가 없습니다 — 획 끝이 고르고, 자간이 기계적이고, 무엇보다 이 게임의
  // 것으로 안 보입니다. **사람도 탑도 없는 그림**이라 규칙이 통째로 다릅니다.
  {
    name: 'title-logo',
    refs: [],
    noHero: true,
    style: LETTER_STYLE,
    head: 'Hand-lettered Korean game title logo artwork.',
    shape: 'Wide horizontal composition, roughly 5:2, the lettering filling the frame.',
    aspect: 5 / 2,
    scene: [
      'Korean hand-lettered game title logo, two lines, centred, on a fully transparent',
      'background (alpha channel, no backdrop of any kind).',
      'Line 1, smaller and dimmer, muted blue-grey: 오늘도 탑을 오르는 나는',
      'Line 2, much larger and brighter, near-white with a faint violet edge light:',
      '무슨 생각을 해야 하나',
      'Reproduce the Korean characters EXACTLY as written above — do not invent, alter,',
      'reorder or add any glyph. Hangul syllable blocks must stay correctly formed.',
      'The lettering is brush-drawn but controlled and highly legible: slightly irregular',
      'stroke ends, a little weight variation, faint wear and grit as if carved into cold',
      'stone and then lit from one side. Not a computer font, but not messy either.',
      'A single thin horizontal rule under line 2, violet #7E6BC4, slightly frayed.',
      'Above the lettering, small and centred, a simple mark: four stacked horizontal bars',
      'forming a ziggurat — widest at the bottom, each one narrower and brighter going up,',
      'from deep navy to pale violet.',
      'Palette: navy #141A2E, violet #7E6BC4 and #B39DDB, near-white #FFFFFF,',
      'muted blue-grey #8794B5. Dark, calm, weighty.',
      'No other objects, no characters, no tower, no background scenery, no frame,',
      'no watermark, no Latin text, no extra words.',
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
  // 사람이 안 나오는 그림에는 주인공 문장을 안 붙입니다 — 붙이면 글자만
  // 그려 달라고 해 놓고 기사를 그려 넣습니다.
  if (!s.noHero) parts.push(HERO);
  // 화풍 덩어리를 통째로 바꿔 끼우는 장면도 있습니다 (제목 글자). 컷씬용
  // STYLE 에는 「글자 금지 · 로고 금지 · 배경은 돌탑 안」이 박혀 있어서,
  // 글자를 그려 달라는 그림에 붙이면 **요청문이 스스로와 싸웁니다.**
  parts.push((s.head || HEAD) + ' ' + (s.style || STYLE).replace('@SHAPE@', s.shape || SHAPE));
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

// aspect 는 가로÷세로입니다. 컷씬은 1 (정사각형), 타이틀 배경은 9/16,
// 제목 글자는 5/2 — **모델이 시킨 비율로 안 주는 일이 흔해서** 여기서
// 가운데를 잘라 맞춥니다. 안 맞추면 화면에서 늘어나거나 잘립니다.
async function bake(oven, pngBuffer, outName, aspect) {
  const baked = await oven.evaluate(async ({ b64, size, max, steps, ar }) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error('그림을 못 읽었습니다'));
      img.src = 'data:image/png;base64,' + b64;
    });
    // 원본에서 ar 비율의 가장 큰 칸을 가운데로 잘라 냅니다.
    let cw = img.width;
    let ch = Math.round(cw / ar);
    if (ch > img.height) { ch = img.height; cw = Math.round(ch * ar); }
    const sx = (img.width - cw) / 2;
    const sy = (img.height - ch) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = ar >= 1 ? size : Math.round(size * ar);
    canvas.height = ar >= 1 ? Math.round(size / ar) : size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
    const sizeOf = (u) => Math.floor((u.length - u.indexOf(',') - 1) * 0.75);
    let last = null;
    for (const q of steps) {
      const url = canvas.toDataURL('image/webp', q);
      last = { url, q, bytes: sizeOf(url), w: img.width, h: img.height };
      if (last.bytes <= max) return last;
    }
    return last;
  }, { b64: pngBuffer.toString('base64'), size: SIZE, max: MAX_BYTES, steps: QUALITY_STEPS,
    ar: aspect || 1 });

  const body = baked.url.slice(baked.url.indexOf(',') + 1);
  fs.writeFileSync(path.join(OUT, outName), Buffer.from(body, 'base64'));
  return baked;
}

(async () => {
  // ── 프롬프트만 뽑기 ──────────────────────────────────
  // 키가 없는 자리에서도 **그림을 다른 데서 그려 올 수는 있어야** 합니다.
  // 붙는 것(참조·주인공·화풍)까지 다 합쳐서 그대로 붙여 쓸 수 있는 한 덩어리로
  // 뱉습니다 — 여기 적힌 것과 다른 글로 그리면 여덟 장이 한 세계가 아니게 됩니다.
  //
  //   node gen-story.js --prompt              여덟 장 전부
  //   node gen-story.js --prompt story-5      한 장만
  if (process.argv.includes('--prompt')) {
    const pick = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    const list = pick.length ? SCENES.filter((s) => pick.includes(s.name)) : SCENES;
    list.forEach((s, i) => {
      if (i) console.log('\n' + '─'.repeat(70) + '\n');
      console.log('### ' + s.name + (s.refs.length ? '   참조: ' + s.refs.join(' · ') : ''));
      console.log('\n' + promptFor(s));
    });
    return;
  }

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
      const baked = await bake(oven, png, scene.name + '.webp', scene.aspect);
      const over = baked.bytes > MAX_BYTES ? '  ← 상한 초과' : '';
      console.log(`${baked.w}×${baked.h} → ${SIZE}×${SIZE} · 화질 ${baked.q} · ` +
                  `${Math.round(baked.bytes / 1024)}KB${over}`);
      made.push({ name: scene.name + '.webp', kb: Math.round(baked.bytes / 1024) });
    } catch (e) {
      console.log('실패 — ' + e.message);
    }
  }

  // ── 여덟 장을 한 판에 ────────────────────────────────────
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
