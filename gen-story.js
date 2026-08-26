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
// ── --keep — 구도는 그대로, 색만 바꿉니다 ────────────────
// 색 하나 때문에 다시 그릴 때, 맨손으로 다시 시키면 **구도까지 새로 나옵니다.**
// 실제로 전사를 군청으로 옮기면서 story-1 을 다시 뽑았더니 방이 넓어지고
// 얼굴이 드러났습니다 — 색만 바꾸려던 것인데 다른 그림이 됐습니다.
//
// 그래서 예전 그림을 **구도 참조로 붙이고** "이 그림 그대로, 색만" 이라고
// 시킵니다. 예전 그림은 shots/story-prev/ 에 둡니다 (직접 옮겨 두세요).
const PREV = path.join(ROOT, 'shots', 'story-prev');
const KEEP = process.argv.includes('--keep');

// **이번 일에는 쓰지 마세요.** 이것은 「구도는 그대로」라고 시키는 말이라,
// 열한 장을 1인칭으로 갈아엎는 일과는 정반대입니다 — 예전 그림을 물리면
// 3인칭 구도가 그대로 따라옵니다. 색 하나만 고칠 일이 또 생기면 그때
// 되살리세요 (ART.md 11절).
const KEEP_NOTE = [
  'The FIRST attached image is the previous version of this exact same picture.',
  'Redraw it: keep the composition, the camera angle, the framing, the lighting and the mood',
  'exactly as they are. Change ONLY what the instructions below say to change.',
].join(' ');
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
// 제목 글자는 **배경이 비쳐야** 합니다. 그런데 이 모델은 알파를 안 내놓습니다 —
// "transparent background" 라고 시켰더니 회색 판때기를 그려 왔고, 그대로 쓰면
// 타이틀 그림 위에 회색 상자가 얹힙니다.
//
// 스프라이트 쪽에서 쓰던 길을 그대로 씁니다 (gen-sprite.js) — **순수 마젠타**
// 위에 그리게 하고 굽는 자리에서 걷어냅니다. 이 그림의 팔레트(남색·보라·흰빛)에
// 없는 색이라 글자와 섞일 일이 없습니다.
const LETTER_STYLE = [
  '@SHAPE@',
  'The background is one completely flat, uniform, pure magenta #FF00FF chroma key screen.',
  'Every single pixel that is not the lettering or the small mark must be exactly that',
  'same magenta — no gradient, no texture, no vignette, no panel, no card, no frame,',
  'no border, and NO SHADOW of any kind behind or under the letters.',
  'Flat artwork on plain magenta: only the lettering and the small mark.',
  'No characters, no tower, no props, no watermark, no signature.',
  'No Latin letters and no words other than the two Korean lines given.',
].join(' ');

// ── 주인공이 아니라 카메라가 고정입니다 (ART.md 7.97절) ────
// 예전에는 「1~4컷의 기사와 만남 컷에 쓰러진 사람이 같은 사람」이 규칙이라
// 여기에 주인공 고정 문장(HERO)이 있었습니다. 직업이 여덟이 되면서 **그
// 사람이 누구인지 그림이 정할 수가 없어졌습니다** — 어느 직업으로 오르든
// 같은 기사가 쓰러져 있으면 그 판의 나와 그림 속의 내가 다른 사람입니다.
//
// 그래서 사람을 빼고 **시점**을 남겼습니다. 열한 장 전부 주인공의 눈이고,
// 주인공은 그림에 안 나옵니다. 이어져야 하는 것은 얼굴이 아니라 카메라입니다.
//
// 붉은 것은 여전히 하나뿐입니다 (STORY.md 3절).
const CAMERA = [
  'FIRST PERSON: the frame IS the main character\'s own eyes. We see only what they see.',
  'NEVER draw the main character: no face, no body, no back view, no fallen body lying on the',
  'ground, no weapon in hand, no armour, no cloak, and no reflection of them in water, glass',
  'or polished metal.',
  'A BARE hand or a BARE FOOT may enter from the very bottom edge of the frame, and nothing',
  'more: the sleeve or leg fades away into darkness.',
  'That hand or foot must be BARE SKIN. No glove, no gauntlet, no bracer, no ring, no',
  'jewellery, no armour plate, no weapon — and on a foot, NO BOOT, NO SHOE, NO SANDAL and no',
  'wrapping of any kind. If drawing a bare foot looks wrong, show a bare hand instead, or',
  'show neither.',
  'Nothing anywhere in the picture may be red, crimson, scarlet, maroon or orange — no cloth,',
  'no light, no flame, no ember, no glow. There is no red in this world.',
].join(' ');

// 참조로 잇는 것도 사람이 아니라 **세계와 시점**입니다. 이제 그릴 사람이
// 없으므로 물려받을 것은 탑의 결과 카메라 높이입니다.
const REF_NOTE = [
  'Use the attached image(s) as the visual reference for THE WORLD and THE CAMERA, never for',
  'a character: the same cold dark-blue stone tower, the same wall texture and masonry, the',
  'same palette, the same lighting and mood, the same painting style, and the same',
  'first-person eye-level framing. Same place, same eyes, a different moment.',
  'Do NOT copy any person out of them.',
].join(' ');

// scene = 그 장면에서만 다른 것. 위의 두 덩어리는 자동으로 붙습니다.
const SCENES = [
  // ── 오프닝 넷 (ART.md 7.97절) ──────────────────────────
  // 기억을 잃고 탑 바닥에서 깨어난 사람이 오르기 시작하는 네 장면을,
  // **그 사람의 눈으로** 봅니다. 그 사람은 그림에 안 나옵니다.
  {
    name: 'story-1',
    refs: [],
    scene: [
      'The moment of waking on the floor of the tower. The camera lies right down on the cold',
      'stone: the grain and grit of the flagstones fill the near foreground, very close and a',
      'little out of focus, and the edges of the frame are still dark as if the eyes are only',
      'half open. Far above, a faint shaft of pale light falls through the gloom.',
      'A BARE hand presses flat against the stone at the very bottom edge of the frame,',
      'pushing up. Stillness and silence, and nobody else here.',
    ].join(' '),
  },
  {
    name: 'story-2',
    refs: ['story-1'],
    scene: [
      'THE CAMERA POINTS STRAIGHT UP AT THE SKY-LESS TOP OF THE TOWER — flat on its back on the',
      'floor, lens aimed vertically. The floor is therefore NOT in this picture at all, and no',
      'hand or foot appears: the frame is filled edge to edge by the shaft climbing away above.',
      'This must look nothing like the previous picture, which looked along the floor — this one',
      'looks up the barrel of the tower.',
      'Tier after tier of stone ledges, broken platforms and arched openings ring the shaft and',
      'shrink into blackness as they recede, getting smaller and closer together toward the',
      'centre of the frame in a deep vertical perspective.',
      'CRITICAL: the tower NEVER CLOSES. There is NO ceiling, NO dome, NO vault, NO roof and no',
      'flat surface across the top — the walls just keep going until they vanish into darkness.',
      'If you find yourself drawing a circular ceiling, you have drawn it wrong: it is an open',
      'shaft with no end.',
      'A tiny pinprick of pale light impossibly far up. The scale should feel crushing.',
    ].join(' '),
  },
  {
    name: 'story-3',
    refs: ['story-1', 'story-2'],
    scene: [
      'Standing close to the tower wall and looking at an ancient carved stone relief, seen from',
      'near enough that the carving fills most of the frame. The worn relief faintly depicts an',
      'enormous horned crowned being at the top of the tower. Raking side light picks out the',
      'cut edges of the stone. Quiet and curious.',
      'If a hand is shown at all, only BARE fingertips entering from the bottom edge of the',
      'frame, reaching toward the carving.',
    ].join(' '),
  },
  {
    name: 'story-4',
    refs: ['story-1', 'story-3'],
    scene: [
      'STANDING UPRIGHT on the first stone platform, at head height now — not lying down any',
      'more — and looking ahead and slightly UP into the tower.',
      'THREE SEPARATE WAYS UP are the subject of this picture and must be unmistakable: three',
      'distinct routes climbing away from this platform and diverging as they rise — three',
      'stone stairways, or three ledges leading to three different arched openings — clearly',
      'three, clearly going up, and clearly going to different places. Do not draw one path,',
      'and do not draw a wall of identical arches.',
      'The near edge of the platform drops away into darkness at the bottom of the frame, and',
      'only BARE toes enter at that very bottom edge.',
      'A moment of resolve: the way up is chosen here.',
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
      'COMPOSITION IS CRITICAL, and it matters more than the action does.',
      'The TOP 30% OF THE FRAME MUST BE EMPTY: nothing but dark, plain, out-of-focus tower',
      'wall and haze. NOTHING may reach up into that band — no sword tip, no raised arm,',
      'no crest, no beam, no lightning, no sparks, no floating eyeball, no monster hand.',
      'Keep that band dark and low-contrast so pale text laid over it stays readable.',
      'Push the knight and the whole fight DOWN into the middle band of the tall frame,',
      'and draw him smaller than you would like so that everything fits below the empty top.',
      'The BOTTOM SIXTH must also stay dark and quiet, because a line of text sits there too.',
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
    chroma: true,       // 마젠타를 걷어내고 알파로 (아래 bake)
    style: LETTER_STYLE,
    head: 'Hand-lettered Korean game title logo artwork.',
    shape: 'Wide horizontal composition, roughly 5:2, the lettering filling the frame.',
    aspect: 5 / 2,
    scene: [
      'Korean hand-lettered game title logo, two lines, centred, on a flat pure magenta',
      '#FF00FF chroma key background (it will be keyed out later).',
      'Line 1, smaller and dimmer, muted blue-grey: 오늘도 탑을 오르는 나는',
      'Line 2, much larger and brighter, near-white with a faint violet edge light:',
      '무슨 생각을 해야 할까',
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
      'FINAL REMINDER: everything behind and around the lettering is flat pure magenta',
      '#FF00FF. Not grey. Not navy. Not a checkerboard. Not a card or a panel. Magenta.',
    ].join(' '),
  },

  // ── 탑에서 만나는 사람 일곱 (ART.md 7.97절) ────────────
  // 일곱 다 **바닥에 쓰러져 누운 내 눈높이**입니다. 상대는 늘 나보다 위에
  // 있고, 카메라는 낮고, 시선은 위를 향합니다. 내 몸은 안 나옵니다.
  //
  // **나를 보는지 안 보는지가 그 사람의 전부입니다.** 일곱이 그 하나로
  // 갈립니다 — 들여다보는 궁수, 손을 뻗는 사령술사, 금화를 보는 도적,
  // 저만치서 안 보는 권법사, 등을 돌린 도굴꾼, 어둠에 잠긴 마법사,
  // 그리고 코를 대는 곰.
  {
    name: 'meet-archer',
    refs: ['story-1', 'story-4'],
    scene: [
      'LOOKING UP FROM THE FLOOR: the camera lies on the stone, tilted upward, and everything is',
      'seen from that low angle looking up.',
      'An archer has just lowered their bow and is LEANING DOWN OVER THE CAMERA to look right',
      'into it — their face is close, clearly lit and clearly visible, meeting our eyes. They',
      'are the protagonist of the next story.',
      'Beyond them and higher up, a monster lies dead with an arrow through it.',
      'A sharply pointed hood, a slender build, light leather gear, a bow. Green tones #A5D6A7.',
      'One BARE hand rests on the stone at the very bottom edge of the frame, as in the other',
      'pictures in this set — it is the only part of us that shows.',
    ].join(' '),
  },
  {
    name: 'meet-necro',
    refs: ['story-1', 'meet-archer'],
    scene: [
      'LOOKING UP FROM THE FLOOR, the same low tilted-up camera.',
      'A hooded figure has crouched down and is REACHING ONE HAND STRAIGHT TOWARD THE CAMERA —',
      'the open hand comes forward into the frame, the nearest thing in the picture, about to',
      'take hold. They have bent low to lift, and the movement is unhurried and practised, as',
      'if they have done this many times before. Their face is near and calm.',
      'A bone staff lies on the ground beside them, laid down rather than held.',
      'A deep hood over a bone-pale face, a long robe with a hem torn into ragged points.',
      'Cold teal tones #4DB6AC. No spirits, no ghosts, no summoned creatures anywhere.',
    ].join(' '),
  },
  {
    name: 'meet-rogue',
    refs: ['story-1', 'meet-archer'],
    scene: [
      'LOOKING UP FROM THE FLOOR, the same low tilted-up camera.',
      'A rogue crouches low nearby, but THEIR EYES ARE NOT ON THE CAMERA — they look past it',
      'and downward at gold coins scattered across the stone. Their gaze must clearly miss us.',
      'The coins lie strewn across the lower part of the frame, close to the camera, catching',
      'the light.',
      'A hood and a cloth face covering, a low coiled crouch, TWO daggers, one in each hand.',
      'Purple tones #CE93D8.',
    ].join(' '),
  },
  {
    name: 'meet-monk',
    refs: ['story-1', 'meet-archer'],
    scene: [
      'LOOKING UP FROM THE FLOOR, the same low tilted-up camera.',
      'An old bare-handed martial artist stands SOME DISTANCE AWAY, alone, quietly working',
      'through a stance by himself. He is not looking at the camera at all and has not come',
      'over. He is small in the frame because he is far off.',
      'HIS HANDS HOLD NOTHING — cloth wraps around his hands and forearms, and no weapon',
      'anywhere on him. On the stone near the camera a weapon someone dropped lies where it',
      'fell, and he does not look at that either.',
      'Iron-grey hair in a topknot, a short grey beard, a lined weathered face, a sleeveless',
      'tunic and a long sash. Gold tones #FFD54F.',
    ].join(' '),
  },
  {
    name: 'meet-digger',
    refs: ['story-1', 'meet-archer'],
    scene: [
      'LOOKING UP FROM THE FLOOR, the same low tilted-up camera.',
      'A tomb robber has their BACK FULLY TURNED to the camera and is digging into the tower',
      'wall, absorbed in it. Their face is not visible at all — we never see it. They have not',
      'noticed us.',
      'A big bulging sack is roped to their back, and a pickaxe is in their hands or propped',
      'beside them. A cloth head wrap, no armour. Dusty lime tones #D4E157.',
    ].join(' '),
  },
  {
    name: 'meet-wizard',
    refs: ['story-1', 'meet-archer'],
    scene: [
      'LOOKING UP FROM THE FLOOR, the same low tilted-up camera.',
      'ALMOST EVERYTHING IS DARK. The only bright thing in the picture is a single point of',
      'light gathered at the tip of a tall staff — a clear ball of blue-white ICE and frost,',
      'and nothing else. It is the one light source and it leaves the rest of the frame deep',
      'in shadow.',
      'The wizard stands holding that staff, but their FACE IS LOST IN THE DARKNESS under the',
      'brim of a tall pointed hat — we cannot tell whether they have seen us or not.',
      'A long robe with wide sleeves. Sky blue tones #4FC3F7.',
    ].join(' '),
  },
  {
    name: 'meet-hunter',
    refs: ['story-1', 'meet-archer'],
    assets: ['ally-bear'],
    scene: [
      'LOOKING UP FROM THE FLOOR, the same low tilted-up camera.',
      'A BIG BROWN BEAR\'S FACE FILLS THE FRAME. It has lowered its head right down to the',
      'camera and pressed its nose almost against it, snuffling at us — its muzzle and eyes',
      'are the nearest and largest thing in the picture, looking straight into the lens.',
      'One of the attached images is that exact bear, already drawn: copy it — the same fur',
      'colour and shading, the same face, the same PALE BAND around its neck, a friendly',
      'animal with no bared fangs.',
      'FAR BEHIND AND ABOVE the bear, small in the frame, a hunter stands watching: a bear',
      'skull worn as a hood, a shaggy fur mantle, and a big heavy bow held low.',
      'Grey-brown tones #BCAAA4.',
    ].join(' '),
  },
];

function promptFor(s) {
  const parts = [];
  // 구도 참조가 붙는 날에는 그 말이 가장 먼저 와야 합니다 — 뒤에 오는
  // 장면 설명은 「무엇을 그리는가」이고, 이것은 「어떻게 그리는가」입니다.
  if (KEEP && fs.existsSync(path.join(PREV, s.name + '.png'))) parts.push(KEEP_NOTE);
  if (s.refs.length) parts.push(REF_NOTE);
  parts.push(s.scene);
  // 사람이 안 나오는 그림에는 주인공 문장을 안 붙입니다 — 붙이면 글자만
  // 그려 달라고 해 놓고 기사를 그려 넣습니다.
  if (!s.noHero) parts.push(CAMERA);
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

// 모델에게 **처음부터 그 비율로** 시킵니다.
//
// 예전에는 무엇을 그리든 1:1 로 받아 놓고 굽는 자리에서 잘랐습니다. 컷씬은
// 어차피 정사각형이라 아무 일도 없었는데, 세로 9:16 짜리 타이틀 배경이
// 들어오면서 문제가 드러났습니다 — 정사각형으로 그린 그림에서 가운데 세로
// 띠만 남기면 좌우가 반쯤 잘려 나가고, 무엇보다 **"위 1/4 을 비워라"가
// 무의미해집니다.** 모델은 정사각형 안에서 위를 비운 것이지 9:16 안에서
// 비운 것이 아니니까요.
//
// API 가 받는 비율은 정해져 있습니다. 원하는 비율에서 가장 가까운 것을
// 고르고, 남는 차이만 굽는 자리에서 잘라 냅니다 (5:2 는 21:9 로 받아 조금만
// 다듬으면 됩니다).
const API_RATIOS = [
  ['1:1', 1], ['2:3', 2 / 3], ['3:2', 3 / 2], ['3:4', 3 / 4], ['4:3', 4 / 3],
  ['4:5', 4 / 5], ['5:4', 5 / 4], ['9:16', 9 / 16], ['16:9', 16 / 9], ['21:9', 21 / 9],
];
function apiRatio(aspect) {
  const want = aspect || 1;
  let best = API_RATIOS[0];
  // 비율은 곱셈으로 멀어지므로 로그 거리로 잽니다 — 2배와 0.5배가 같은 거리입니다.
  API_RATIOS.forEach((r) => {
    if (Math.abs(Math.log(r[1] / want)) < Math.abs(Math.log(best[1] / want))) best = r;
  });
  return best[0];
}

async function generate(scene) {
  const parts = [];
  // 구도 참조가 **맨 앞**이어야 합니다 — KEEP_NOTE 가 "첫 번째 그림"이라고
  // 가리키므로, 순서가 밀리면 엉뚱한 그림을 붙들고 그립니다.
  if (KEEP) {
    const prev = path.join(PREV, scene.name + '.png');
    if (fs.existsSync(prev)) {
      parts.push({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(prev).toString('base64') } });
    }
  }
  // 참조를 먼저 넣어야 지시문이 그 그림을 가리킵니다.
  for (const ref of scene.refs) {
    const file = path.join(RAW, ref + '.png');
    if (!fs.existsSync(file)) continue;
    parts.push({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(file).toString('base64') } });
  }
  // 판에 이미 서 있는 그림을 물려야 할 때가 있습니다 — 곰사냥꾼의 만남 컷에
  // 나오는 곰은 발판 위를 걷는 그 곰이어야 합니다 (ART.md 7.95절).
  // 이야기 컷끼리 물리는 refs 와 달리 이쪽은 assets/ 에서 끌어옵니다.
  for (const a of scene.assets || []) {
    const file = path.join(ROOT, 'assets', a + '.png');
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
        generationConfig: { imageConfig: { aspectRatio: apiRatio(scene.aspect) } },
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
async function bake(oven, pngBuffer, outName, aspect, chroma) {
  const baked = await oven.evaluate(async ({ b64, size, max, steps, ar, key }) => {
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

    // 마젠타를 걷어냅니다. 거리에 따라 서서히 지워야 글자 가장자리가 톱니가
    // 안 됩니다. 지우고 나면 남은 반투명 화소에 분홍 기운이 남으므로,
    // 초록을 빨강·파랑 중 작은 쪽까지 끌어올려 그 기운을 뺍니다.
    if (key) {
      const TOL = 110, FEATHER = 70;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const p2 = d.data;
      for (let i = 0; i < p2.length; i += 4) {
        const dist = Math.hypot(p2[i] - 255, p2[i + 1], p2[i + 2] - 255);
        if (dist < TOL) { p2[i + 3] = 0; continue; }
        if (dist < TOL + FEATHER) p2[i + 3] = Math.round(p2[i + 3] * (dist - TOL) / FEATHER);
        const lo = Math.min(p2[i], p2[i + 2]);
        if (p2[i + 1] < lo) p2[i + 1] = lo;
      }
      ctx.putImageData(d, 0, 0);
    }

    const sizeOf = (u) => Math.floor((u.length - u.indexOf(',') - 1) * 0.75);
    let last = null;
    for (const q of steps) {
      const url = canvas.toDataURL('image/webp', q);
      last = { url, q, bytes: sizeOf(url), w: img.width, h: img.height,
        // 실제로 나간 크기. 예전에는 늘 SIZE×SIZE 라고 찍어서, 세로 그림을
        // 정사각형으로 구운 줄 알고 한참 헤맸습니다.
        outW: canvas.width, outH: canvas.height };
      if (last.bytes <= max) return last;
    }
    return last;
  }, { b64: pngBuffer.toString('base64'), size: SIZE, max: MAX_BYTES, steps: QUALITY_STEPS,
    ar: aspect || 1, key: !!chroma });

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
    const kept = KEEP && fs.existsSync(path.join(PREV, scene.name + '.png'));
    process.stdout.write(`${scene.name}  ${kept ? '구도 그대로 · ' : ''}참조 [${refs.join(', ') || '없음'}] … `);
    try {
      const png = await generate({ ...scene, refs });
      fs.writeFileSync(path.join(RAW, scene.name + '.png'), png);
      const baked = await bake(oven, png, scene.name + '.webp', scene.aspect, scene.chroma);
      const over = baked.bytes > MAX_BYTES ? '  ← 상한 초과' : '';
      console.log(`${baked.w}×${baked.h} → ${baked.outW}×${baked.outH} · 화질 ${baked.q} · ` +
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
