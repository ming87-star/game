// 공격 모션을 **격자 시트 한 장**으로 받습니다. 무기 한 자루에 시트 한 장.
//
//   GEMINI_API_KEY=... node gen-sheet.js w-warrior-0
//   GEMINI_API_KEY=... node gen-sheet.js warrior          그 직업 열두 자루
//
// ── 왜 한 장에 몰아 받는가 ─────────────────────────────────
// 컷을 따로 여덟 번 뽑으면 갑옷 모양과 색이 컷마다 흔들려서, 이어 붙이면
// 깜빡입니다. 한 장에 그리게 하면 **같은 붓으로 한 번에** 그리므로 여덟 컷이
// 같은 사람입니다. 조각(팔·다리·몸통)을 따로 뽑는 길도 시험했는데, 모델이
// 조각마다 틀을 새로 잡아서 겹쳐지지 않았습니다. 시트가 답입니다.
//
// ── 처음 시험에서 깨졌던 것 셋과 그 대책 ───────────────────
//  1. 분홍 테두리가 남았습니다 → 허용 범위를 넓히고 잔색(마젠타 기운)을 뺍니다
//  2. 칸을 넘은 칼끝이 잘렸습니다 → 칸마다 넉넉한 여백을 요구하고, 칸 사이가
//     붙지 않게 못박습니다
//  3. 컷마다 크기가 들쭉날쭉했습니다 → 컷마다 따로 재서 맞추면 재생할 때
//     주인공이 벌렁거립니다. 여덟 칸의 경계를 **합쳐서** 하나의 배율·하나의
//     자리를 구하고, 그 값을 여덟 컷에 똑같이 씁니다
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'shots', 'sheet-raw');      // shots/ 는 .gitignore
const OUT = path.join(ROOT, 'assets', 'sheets');

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const COLS = 4, ROWS = 2;                               // 여덟 컷
const BAKE = 4;

// 마젠타 걷어내기. 첫 시험(78)에서 분홍 실이 남아 넓혔습니다.
const TOL = 112, FEATHER = 70;

// ── 주인공 고정 문장 — 모든 시트에 글자 하나 안 바꾸고 붙습니다 ──
const HEROES = {
  warrior: {
    w: 38, h: 48,
    // 망토를 군청으로 옮길 때(recolor-warrior.js) **이 글은 안 고쳐 뒀었습니다.**
    // 그림 파일만 바꾸고 주문서를 두면 다시 뽑는 날 붉은 전사가 돌아옵니다.
    who: 'a knight: broad angular shoulder armour, a horned helmet with a deep navy-blue crest, '
       + 'steel-grey armour with navy-blue cloth. Navy accent #133286. Nothing on him is red.',
  },
  archer: {
    w: 42, h: 48,
    // 초록을 세게 못박습니다. 그냥 "green accent" 라고만 두었더니 카키·황토로
    // 나와서, 붉은 전사 · 보라 도적과 색으로 갈리지 않았습니다. 세 직업을
    // 색으로 외우는 게임이라 여기가 흐려지면 안 됩니다.
    // "slim tall body" 라고 적어 두었더니 궁수만 **7등신 실사 비례**로 나왔습니다.
    // 전사와 도적은 4등신이라 셋을 나란히 놓으면 궁수 혼자 딴 게임 사람입니다.
    // 키는 몸이 아니라 **자세**로 말하게 하고, 비례는 PROPORTION 이 못박습니다.
    who: 'an archer dressed in GREEN: a sharply pointed green hood and green cloak, '
       + 'green leather gear with darker green straps. The green must be clearly, obviously '
       + 'green (#A5D6A7 and #4C8C2A) — not khaki, not tan, not brown, not olive.',
  },
  rogue: {
    w: 40, h: 48,
    who: 'a rogue: hood and a face covering, a cloak, a low crouched stance. '
       + 'Purple accent #CE93D8.',
  },

  // ── 새 직업 다섯 (ART.md 2.6절) ────────────────────────
  // 고르는 화면의 초상화(assets/player-*.png)와 **같은 사람**이어야 합니다.
  // 그래서 아래 글과 함께 그 초상화를 참조로 붙입니다 (portraitFor).
  // 글만으로는 얼굴과 차림이 판마다 흔들립니다.
  monk: {
    w: 38, h: 48,
    who: 'an OLD BARE-HANDED MARTIAL ARTIST: iron-grey hair in a topknot, a short grey chin '
       + 'beard, a heavily lined weathered face, a sleeveless cream off-white tunic, loose '
       + 'trousers cropped at the shin, and cloth wraps on his forearms and shins. '
       + 'Lean and wiry with no armour. A long sash at his waist streams behind him. '
       + 'He is old but not frail. Gold accent #FFD54F. Nothing on him is red. '
       + 'HIS HANDS ARE EMPTY IN EVERY SINGLE FRAME — he carries no sword, no staff, no stick '
       + 'and no blade of any kind. Whatever the weapon is called, it is something WORN on his '
       + 'hands (wraps, rings, gauntlets), never something held.',
  },
  hunter: {
    w: 42, h: 48,
    who: 'a heavy BEAR HUNTER: a bear skull worn as a hood with the snout jutting over his brow, '
       + 'a shaggy fur mantle over the shoulders only, close leather below, and a bearded '
       + 'weather-beaten older face. Wide, low and thick-set. '
       + 'Grey-brown hide #BCAAA4 with darker brown leather. Nothing on him is red.',
  },
  necro: {
    w: 40, h: 48,
    who: 'a gaunt NECROMANCER: a deep hood with a bone-pale skull-like face inside it, a long '
       + 'tattered robe whose hem is torn into ragged points, and thin bony hands. '
       + 'Bone white #ECEFF1 and cold teal #4DB6AC. Nothing on him is red.',
  },
  wizard: {
    w: 40, h: 48,
    who: 'a WIZARD: a tall wide-brimmed POINTED HAT bent over at the tip, a long robe with wide '
       + 'sleeves, and a long beard hanging over the robe. '
       + 'Sky blue #4FC3F7 robe with deeper blue shadow. Nothing on him is red. '
       + 'He must never be mistaken for the necromancer: the wizard has a POINTED HAT and a full '
       + 'clean robe, the necromancer has a plain deep HOOD and a ragged torn hem.',
  },
  digger: {
    w: 42, h: 48,
    who: 'a TOMB ROBBER: a cloth head wrap with goggles pushed up on his forehead, rolled '
       + 'sleeves, straps and buckles across his chest, and NO armour at all — lean and wiry. '
       + 'A big fat BULGING SACK is roped to his BACK and sticks out behind him in every frame. '
       + 'Dusty lime #D4E157 and worn brown leather. Nothing on him is red.',
  },
};

// 고르는 화면에서 본 사람과 판 위의 사람이 같아야 합니다 (ART.md 2.6절).
// 0단계 시트를 그릴 때만 붙입니다 — 1단계부터는 baseFor 가 그 직업의 0단계
// 시트를 물리므로, 초상화까지 겹쳐 붙이면 참조가 셋이 되어 서로 다툽니다.
function portraitFor(job, weapon) {
  if (weapon.key !== `w-${job}-0`) return null;
  const f = path.join(ROOT, 'assets', `player-${job}.png`);
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
}

const PORTRAIT_RULE = [
  'One of the attached images is the CHARACTER PORTRAIT: this exact same character, already',
  'drawn, standing in a single posed shot. Take the person from it — the same face, the same',
  'hair and headgear, the same clothing and its cut, the same colours, the same build.',
  'A player picks this character off a card showing that portrait and must recognise the same',
  'person on the platform a moment later.',
  'Do NOT copy its pose or its framing: that portrait is one posed figure seen near front-on,',
  'and what you are drawing is eight side-view frames of an attack, facing right.',
  'Ignore any companion animal or floating creature in the portrait — draw the person alone.',
].join(' ');

// 무기 종류마다 몸이 다르게 움직입니다 (js/motion.js 의 MOTIONS 와 같은 갈래).
// 갈래를 그림으로 말하는 낱말. js/classes.js 의 icon.art 값이 열쇠입니다.
const KIND_WORD = {
  sword: 'one-handed SWORD with a straight blade and a crossguard',
  spear: 'long SPEAR — a long wooden shaft with a pointed metal head at the tip, '
       + 'clearly much longer than the character is tall',
  dagger: 'short DAGGER — a small knife-length blade',
  bow: 'BOW — a curved limb with a drawn bowstring, shooting arrows',
  crossbow: 'CROSSBOW — a horizontal bow mounted crosswise on a wooden stock with a trigger, '
          + 'held like a rifle, NOT a hand bow',
  // 새 직업 다섯이 들고 오는 갈래 셋. 이것이 없으면 KIND_WORD[kind] 가
  // undefined 라 갈래 이름 자리에 'fist' 같은 날말이 그대로 들어갑니다.
  //
  // **짧은 이름씨로 적으세요.** 틀이 이 말을 한 문장에 두 번 끼웁니다
  // ("wielding X, which is A X … must read as a X"). 길게 적으면 그 문장이
  // 통째로 두 번 나와서 읽히지도 않고 뒤의 지시를 밀어냅니다. 못 박을 것은
  // 갈래 이름이 아니라 직업 설명(who)이나 동작(SWINGS)에 넣습니다.
  fist: 'BARE FIST — empty hands, wrapped in cloth or fitted with knuckle guards, holding nothing',
  staff: 'long STAFF — a tall wooden shaft with a crystal, skull or knot of bone at its upper tip',
  pick: 'PICKAXE — a heavy head mounted crosswise on a shaft, one long spike curving to a point',
};

const SWINGS = {
  sword: 'a one-handed sword slash: wind the sword up behind the head, step in, cut down and '
       + 'across, follow through low, then recover to a ready guard',
  spear: 'a spear thrust: draw the spear back beside the ribs, brace, drive it straight forward '
       + 'to full extension, then pull it back to guard',
  dagger: 'a quick dagger stab: coil low, snap the blade forward in a short stab, twist, '
        + 'then drop back into a crouched guard',
  bow: 'an archery shot: raise the bow, draw the string back to the cheek, hold, loose the arrow, '
     + 'then lower the bow',
  crossbow: 'a crossbow shot: raise the crossbow to the shoulder, brace against the recoil, '
          + 'fire, then lower it and work the lever',
  fist: 'a bare-handed combination: coil back with the hips, drive one straight punch out to full '
      + 'extension, snap it back, then throw the other fist across, finishing in a low ready guard '
      + '— hands stay empty and open or fisted throughout',
  // 지팡이는 **긋지 않습니다.** 처음에 "휘두른다"고 적었더니 모델이 칼처럼
  // 크게 그어서 꼬리를 길게 달았고, 그 꼬리가 칸을 넘어 잘렸습니다 — 세 판을
  // 다시 뽑아도 그대로였습니다. 문구를 세게 하는 것으로는 안 잡힙니다.
  // **그을 일을 아예 없앴습니다** — 겨누고 터뜨리는 동작이라 꼬리가 안 생깁니다.
  staff: 'a staff cast: plant the staff, raise it as light gathers into a tight ball at its tip, '
       + 'then level the tip at the target and release, and settle back upright. '
       + 'The staff barely travels — it is aimed and fired, not swung. '
       + 'DO NOT draw any sweeping arc, swoosh, crescent, ribbon, comet tail or motion trail: '
       + 'the magic is a COMPACT BURST held close around the tip of the staff, no wider than the '
       + 'character\'s head, and it must never streak across the frame',
  pick: 'an overhead pickaxe swing: haul the pick up and back over one shoulder, rise onto the '
      + 'toes, then bring it down hard in a full arc, burying the point low, and recover',
};

const STYLE = [
  '2D game sprite art, side view, the character FACING RIGHT in every single frame,',
  'bold clean dark outlines, flat cel shading with two tone shadows, saturated colours,',
  'dark fantasy but friendly, mobile game art.',
].join(' ');

// ── 세 직업의 비례를 하나로 못박습니다 ──────────────────────
// 직업 설명에 "slim tall" 같은 말을 한 마디 넣으면 모델이 그 직업만 실사 비례로
// 그립니다. 화면에서 셋은 같은 크기의 말이라 비례가 다르면 한 명만 어른입니다.
// 그래서 등신을 숫자로 적습니다 — 취향이 아니라 규격입니다.
const PROPORTION = [
  'PROPORTIONS (identical for every class in this game): a chunky CHIBI build about four heads',
  'tall — a big head, a short sturdy torso, short thick limbs, large hands and boots.',
  'NOT a realistic seven- or eight-head figure, not slender, not lanky, not tall.',
  'The whole standing figure fills roughly two thirds of the height of its cell.',
].join(' ');

// 칸이 붙으면 잘라 낼 때 서로를 침범합니다. 여백을 크게 요구하는 것이 대책입니다.
const GRID = [
  `Lay the frames out as a strict ${COLS} columns by ${ROWS} rows grid, read left to right,`,
  'top to bottom. Every frame is the same size and every character is drawn at exactly the same',
  'scale, standing on the same ground line, centred in its own cell.',
  'Leave a GENEROUS empty margin around each frame — no part of the character or the weapon may',
  'come near the edge of its cell, and frames must never touch or overlap each other.',
  'Do not draw any grid lines, cell borders, separators, numbers or labels.',
].join(' ');

// 그림자를 특히 세게 막습니다. 발밑에 타원 하나만 그려 놔도 마젠타가 아니라
// 배경 제거를 통과해서, 게임 안에서 발밑 얼룩으로 남습니다.
const BG = [
  'The background behind every frame is one completely flat, uniform, pure magenta #FF00FF',
  'chroma key screen. Every single pixel that is not the character or the weapon must be',
  'exactly that same magenta.',
  'ABSOLUTELY NO SHADOW of any kind: no ground shadow, no contact shadow, no drop shadow,',
  'no dark ellipse or oval or puddle under the feet, no shading on the background,',
  'no ground plane, no floor, no platform, no horizon.',
  'The character floats on plain flat magenta with nothing beneath the feet.',
  'No text, no watermark, no signature, no border, no frame.',
].join(' ');

// 지팡이·창·곡괭이는 사람보다 깁니다. 사람을 칸에 맞춰 그리면 무기가 칸을
// 넘고, 그러면 **끝이 잘린 채로 구워집니다** — 사령술사 첫 판이 여덟 컷 중
// 여섯에서 칸에 닿아 있었습니다(여백 0px). 오류는 안 납니다. 지팡이 끝이
// 없어질 뿐입니다.
//
// 그래서 긴 무기에는 "사람을 더 작게 그려서라도 무기를 다 넣어라"를 붙입니다.
// 사람 크기는 굽는 자리에서 다시 맞추므로(bake-sheets.js 가 여덟 컷을 합쳐
// 한 배율로 잽니다) 작게 그려도 화면에서는 같은 키로 섭니다.
const LONG = new Set(['staff', 'spear', 'pick', 'bow']);
const LONG_RULE = [
  'THIS WEAPON IS LONGER THAN THE CHARACTER IS TALL, and in some frames it is raised or swung',
  'diagonally, which makes it reach much further than the body does.',
  'EVERYTHING YOU DRAW MUST FIT INSIDE ITS OWN CELL — the figure, the whole weapon from the butt',
  'of the shaft to the very tip, AND every effect: flames, glows, energy trails, smear arcs,',
  'sparks, projectiles and magic. Leave a clear band of empty magenta, at least a tenth of the',
  'cell wide, between the outermost thing you draw and every edge of that cell.',
  'Nothing may touch a cell edge and nothing may cross into a neighbouring frame. A trail that',
  'runs off the edge comes back as a hard straight cut across the picture, and a piece that',
  'crosses over lands as a floating scrap in the next frame.',
  'If it does not all fit: FIRST make the effects smaller and shorter — an arc that sweeps a',
  'quarter circle reads just as fast as one that sweeps a half circle — and if it still does not',
  'fit, DRAW THE WHOLE CHARACTER SMALLER until everything fits with room to spare.',
  'A smaller figure with a whole weapon is right; a big figure with a cut-off tip is wrong.',
  'Keep the character the same size in all eight frames.',
  'CONCRETELY: draw the standing figure at only about HALF the height of its cell, not two',
  'thirds — that spare room is what the raised staff and the trailing effects need. The',
  'character will be scaled back up afterwards, so a small figure here costs nothing.',
].join(' ');

function promptFor(job, weapon) {
  const hero = HEROES[job];
  const swing = SWINGS[weapon.kind] || SWINGS.sword;
  return [
    `A sprite sheet of ${COLS * ROWS} animation frames showing one complete attack cycle of `
      + `the SAME character: ${hero.who}`,
    // 무기 이름은 한글입니다 ("강철 석궁"). 모델이 그걸 못 읽어서 석궁을
    // 활로, 창을 검으로 그려 온 일이 있습니다. 갈래를 영어로 한 번 더 못박습니다.
    `The character is wielding "${weapon.label}", which is A ${KIND_WORD[weapon.kind] || weapon.kind}`
      + ` — and it must unmistakably read as a ${KIND_WORD[weapon.kind] || weapon.kind},`
      + ` not as any other kind of weapon. ${weapon.look}`,
    `The motion is ${swing}.`,
    'CRITICAL: it is the exact same character and the exact same weapon in all frames — identical '
      + 'armour, identical colours, identical proportions, identical size. Only the pose changes.',
    PROPORTION, GRID, STYLE, BG,
    ...(LONG.has(weapon.kind) ? [LONG_RULE] : []),
    // 배경 규칙을 맨 끝에 한 번 더 둡니다. 지시문이 길어지면 앞쪽이 묻혀서
    // 흰 칸 위에 그려 오는 일이 생깁니다.
    'FINAL REMINDER: the entire background, in every cell and between all cells, is flat pure '
      + 'magenta #FF00FF. Not white. Not grey. Not a card or a panel. Magenta.',
  ].join('\n\n');
}

// ── 부르기 ─────────────────────────────────────────────────
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

// 참조 시트가 있으면 물립니다. 이게 어색한 모션을 고치는 핵심입니다 —
// 글로만 시키면 모델이 자세를 지어내고, 그 자세들이 서로 안 이어져서 튑니다.
// 지금 관절 모션은 공들여 다듬어 둔 것이므로(js/motion.js 머리말), 그 자세를
// shot-poseref.js 로 찍어 참조로 주면 모델은 **다시 그리기만** 하면 됩니다.
// 이 다섯 장은 관절 리그(js/motion.js 의 옛 PlayerRig)를 여덟 지점에서 찍어
// 만든 것입니다. 그 리그는 시트로 갈아타면서 없어졌으므로 다시 못 찍습니다 —
// 그래서 shots/(무시됨) 가 아니라 assets/poseref/ 에 넣어 함께 갑니다.
function refFor(job, weapon) {
  const f = path.join(ROOT, 'assets', 'poseref', `${job}-${weapon.kind}.png`);
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
}

// 그 직업의 **기본 무기 시트**(0단계)를 인물 기준으로 물립니다.
// 시트마다 따로 생성하면 열두 자루의 기사가 조금씩 딴사람이 됩니다 — 창 쪽
// 갑옷이 더 화려해지고 투구 깃이 길어지는 식으로. 다 그려 놓은 0단계 시트를
// 함께 주고 "이 사람 그대로, 무기와 동작만" 이라고 하면 그 흔들림이 잡힙니다.
// 원본(마젠타 배경 · 8칸)을 그대로 씁니다 — 배경과 칸 배치까지 같이 베끼게 됩니다.
function baseFor(job, weapon) {
  if (weapon.key === `w-${job}-0`) return null;      // 자기 자신은 물리지 않습니다
  const f = path.join(ROOT, 'shots', 'sheet-raw', `w-${job}-0.png`);
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
}

// 0단계 시트를 그릴 때는 **전사의 0단계 시트**를 비례 견본으로 물립니다.
// 다른 사람을 그리는 것이므로 인물 기준(baseFor)과는 쓰임이 다릅니다 —
// 가져갈 것은 등신·화면에서 차지하는 크기·선 굵기·칸 배치뿐입니다.
const ANCHOR_JOB = 'warrior';
function anchorFor(job, weapon) {
  if (weapon.key !== `w-${job}-0` || job === ANCHOR_JOB) return null;
  const f = path.join(ROOT, 'shots', 'sheet-raw', `w-${ANCHOR_JOB}-0.png`);
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
}

const ANCHOR_RULE = [
  'The FIRST attached image is a PROPORTION SAMPLE: another character class from this same game,',
  'already finished. It is NOT the character you are drawing and you must not copy its armour,',
  'its colours or its weapon.',
  'Take from it ONLY the measurements: the same chunky four-head chibi build, the same head-to-body',
  'ratio, the same limb thickness, the same figure height inside the cell, the same outline weight',
  'and shading, the same grid and cell size and ground line, the same flat magenta background.',
  'Put the two sheets side by side and the two characters must look like the same size of person',
  'from the same game — different costume, same skeleton.',
].join(' ');

const BASE_RULE = [
  'The FIRST attached image is the CHARACTER REFERENCE: the finished sprite sheet of this same',
  'character with the basic starting weapon, in exactly the layout and on exactly the background',
  'you must produce.',
  'Copy that character EXACTLY — the same face and helmet, the same armour plates and their shapes,',
  'the same cape, the same colours, the same proportions, the same body size, the same line weight',
  'and shading style, the same grid, the same cell size, the same ground line, the same flat magenta',
  'background. Someone must be able to put your sheet next to it and see one single character.',
  'ONLY TWO THINGS CHANGE: the weapon in the hands, and the poses of the attack.',
].join(' ');

// 참조는 **가늠자**입니다. 그대로 베끼게 했더니 원본 모션이 원래 얌전해서
// 휘두르는 맛이 안 났습니다. 그래서 "순서·방향·발 자리"만 가져가고, 힘은
// 애니메이션 원칙으로 다시 넣게 합니다 — 예비동작 · 스미어 · 팔로스루.
const REF_RULE = [
  'The attached image is a rough POSE GUIDE: the same 8 frames of this attack, in the same grid,',
  'drawn as crude placeholder art. Use it ONLY to know, for each frame: where in the swing we are,',
  'which way the weapon points, which foot is forward, and how the frames run in order.',
  'Do NOT copy it literally — that guide is stiff and weak, and copying it makes a limp animation.',
  '',
  'Redraw the whole cycle as a real, powerful attack using proper animation principles:',
  '· ANTICIPATION — the early frames wind up FURTHER back than the guide does, weight shifting onto',
  '  the back foot, shoulders and hips coiled away from the target.',
  '· EXTREMES — push the strongest frames well past the guide. Big rotation of the weapon between',
  '  consecutive frames is good; a swing should cover a lot of arc in very few frames.',
  '· SMEAR — on the fastest frame (the impact), stretch and blur the weapon into a curved arc trail',
  '  so the eye reads speed. One smear frame is enough.',
  '· FOLLOW THROUGH — after impact the weapon overshoots low and the body is committed forward,',
  '  clearly past the point of balance, before recovering.',
  '· WEIGHT — the body leans and drops through the strike; do not keep it upright and static.',
  '',
  'Keep from the guide: the frame order, the general direction of travel, and the feet staying',
  'planted on the same ground line (the character must not drift across the cell).',
  'Every frame must be the same character at the same scale on the same ground line.',
  '',
  'Draw the weapon WHOLE in every frame — complete from hilt to tip, never running off the edge of',
  'its cell and never cut short. If a long weapon will not fit, draw the character slightly smaller.',
  '',
  'KEEP THE BACKGROUND OF THE REFERENCE: the guide sits on flat pure magenta #FF00FF and yours must',
  'too. Do not put the frames on white, on a light box, on cards or on panels of any kind.',
].join(' ');

async function generate(job, weapon) {
  // 첫 자리는 하나뿐입니다 — 0단계에는 비례 견본이, 그 위 단계에는 인물 기준이
  // 옵니다. 둘이 같이 붙는 일은 없습니다.
  const base = baseFor(job, weapon);
  const anchor = base ? null : anchorFor(job, weapon);
  const ref = refFor(job, weapon);
  // 새 직업은 0단계에 초상화를 함께 물립니다 — 그 직업의 0단계 시트가 아직
  // 없어서 baseFor 가 빈손이고, 비례 견본(전사)만으로는 **사람이 안 정해집니다.**
  const portrait = base ? null : portraitFor(job, weapon);
  const parts = [];
  // 붙이는 차례가 곧 "첫째 그림 · 둘째 그림"입니다. 지시문이 그 차례를 가리킵니다.
  if (base) parts.push({ inlineData: { mimeType: 'image/png', data: base } });
  if (anchor) parts.push({ inlineData: { mimeType: 'image/png', data: anchor } });
  if (portrait) parts.push({ inlineData: { mimeType: 'image/png', data: portrait } });
  if (ref) parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
  const head = [];
  if (base) head.push(BASE_RULE);
  if (anchor) head.push(ANCHOR_RULE);
  if (portrait) head.push(PORTRAIT_RULE);
  if (ref) {
    // 그림이 둘이면 몇 번째인지 가리켜 줘야 합니다. 하나뿐이면 그냥 "첨부한 그림".
    head.push(base || anchor || portrait
      ? REF_RULE.replace('The attached image is', 'The LAST attached image is')
      : REF_RULE);
  }
  parts.push({ text: (head.length ? head.join('\n\n') + '\n\n' : '') + promptFor(job, weapon) });
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(MODEL) + ':generateContent',
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        // 긴 무기는 **더 넓은 종이**를 받습니다. 지팡이는 쏘는 순간 가로로
        // 뻗는데 16:9 로 받으면 칸이 344×384 라 세로로 길어서, 가로로 뻗는
        // 것이 갈 데가 없습니다. 21:9 면 칸이 392×336 이 되어 가로가 48px
        // 넓어집니다. 문구로 네 판을 다시 뽑아도 안 잡히던 것이라, 종이를
        // 바꾸는 쪽이 맞습니다.
        generationConfig: { imageConfig: {
          aspectRatio: LONG.has(weapon.kind) ? '21:9' : '16:9' } },
      }) });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' · ' + text.slice(0, 200));
  const b64 = pickImage(JSON.parse(text));
  if (!b64) throw new Error('응답에 그림이 없습니다');
  return Buffer.from(b64, 'base64');
}

// ── 자르기 ─────────────────────────────────────────────────
// 여기가 이 스크립트의 핵심입니다. 컷마다 따로 맞추면 안 됩니다.
async function slice(oven, png, job) {
  const hero = HEROES[job];
  return oven.evaluate(async (a) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error('못 읽었습니다'));
      img.src = 'data:image/png;base64,' + a.b64;
    });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;

    // 1. 마젠타 걷어내기 + 잔색 빼기
    for (let i = 0; i < p.length; i += 4) {
      const dr = p[i] - 255, dg = p[i + 1], db = p[i + 2] - 255;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < a.tol) { p[i + 3] = 0; continue; }
      if (dist < a.tol + a.feather) p[i + 3] = Math.round(255 * ((dist - a.tol) / a.feather));
      // 초록을 올려 분홍 기운을 뺍니다 (마젠타는 R·B 만 높습니다)
      const lo = Math.min(p[i], p[i + 2]);
      if (p[i + 1] < lo) p[i + 1] = Math.round((p[i + 1] + lo) / 2);
    }
    x.putImageData(d, 0, 0);

    // 1.5 격자선만 골라 지웁니다.
    // 모델에게 "격자선을 그리지 마라"고 해도 **검은 칸 선을 그려 옵니다.**
    // 그 선은 마젠타가 아니라 배경 제거를 통과합니다.
    //
    // 처음엔 칸 테두리를 2% 통째로 지웠는데, 그러면 **그 띠에 걸친 칼끝까지
    // 같이 잘려 나갑니다.** 그래서 지금은 경계선 자리를 훑어보고 "거의 다 차
    // 있는 줄"일 때만 그 줄 ±2px 을 지웁니다. 칼은 한 줄을 다 채우지 못하므로
    // 안 걸립니다.
    const cw0 = c.width / a.cols, ch0 = c.height / a.rows;
    const wipeCol = (X) => {
      let filled = 0;
      for (let Y = 0; Y < c.height; Y++) if (p[(Y * c.width + X) * 4 + 3] > 24) filled++;
      if (filled < c.height * 0.7) return false;
      for (let dx = -2; dx <= 2; dx++) {
        const nx = X + dx; if (nx < 0 || nx >= c.width) continue;
        for (let Y = 0; Y < c.height; Y++) p[(Y * c.width + nx) * 4 + 3] = 0;
      }
      return true;
    };
    const wipeRow = (Y) => {
      let filled = 0;
      for (let X = 0; X < c.width; X++) if (p[(Y * c.width + X) * 4 + 3] > 24) filled++;
      if (filled < c.width * 0.7) return false;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = Y + dy; if (ny < 0 || ny >= c.height) continue;
        for (let X = 0; X < c.width; X++) p[(ny * c.width + X) * 4 + 3] = 0;
      }
      return true;
    };
    let wiped = 0;
    for (let q = 0; q <= a.cols; q++) {
      const X = Math.min(c.width - 1, Math.max(0, Math.round(q * cw0)));
      for (let o = -3; o <= 3; o++) if (wipeCol(Math.min(c.width - 1, Math.max(0, X + o)))) wiped++;
    }
    for (let r = 0; r <= a.rows; r++) {
      const Y = Math.min(c.height - 1, Math.max(0, Math.round(r * ch0)));
      for (let o = -3; o <= 3; o++) if (wipeRow(Math.min(c.height - 1, Math.max(0, Y + o)))) wiped++;
    }
    x.putImageData(d, 0, 0);

    // 2. 칸마다 **칸 안에서의** 경계를 잽니다
    const cw = c.width / a.cols, ch = c.height / a.rows;
    const boxes = [];
    for (let r = 0; r < a.rows; r++) for (let q = 0; q < a.cols; q++) {
      const sx = Math.round(q * cw), sy = Math.round(r * ch);
      const ex = Math.round((q + 1) * cw), ey = Math.round((r + 1) * ch);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let Y = sy; Y < ey; Y++) for (let X = sx; X < ex; X++) {
        if (p[(Y * c.width + X) * 4 + 3] > 24) {
          if (X < x0) x0 = X; if (X > x1) x1 = X;
          if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
        }
      }
      if (x1 < 0) { boxes.push(null); continue; }

      // 칸 안에서 이어진 덩어리를 셉니다. 칼끝이 옆 칸을 침범하면 그 조각이
      // 이 칸 가장자리에 남는데, 그것까지 세면 경계가 칸 끝까지 벌어집니다.
      // 주인공은 칸 가운데에 서 있으므로 **가운데 띠를 지나는 덩어리만** 남깁니다.
      const midL = sx + (ex - sx) * 0.32, midR = sx + (ex - sx) * 0.68;
      const seen = new Uint8Array((ex - sx) * (ey - sy));
      const idx = (X, Y) => (Y - sy) * (ex - sx) + (X - sx);
      let kx0 = 1e9, ky0 = 1e9, kx1 = -1, ky1 = -1;
      for (let Y = sy; Y < ey; Y++) for (let X = sx; X < ex; X++) {
        if (seen[idx(X, Y)] || p[(Y * c.width + X) * 4 + 3] <= 24) continue;
        // 너비 우선으로 한 덩어리를 훑습니다
        const q2 = [[X, Y]]; seen[idx(X, Y)] = 1;
        let bx0 = X, by0 = Y, bx1 = X, by1 = Y, touchesMid = false;
        while (q2.length) {
          const [cx2, cy2] = q2.pop();
          if (cx2 >= midL && cx2 <= midR) touchesMid = true;
          if (cx2 < bx0) bx0 = cx2; if (cx2 > bx1) bx1 = cx2;
          if (cy2 < by0) by0 = cy2; if (cy2 > by1) by1 = cy2;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = cx2 + dx, ny = cy2 + dy;
            if (nx < sx || nx >= ex || ny < sy || ny >= ey) continue;
            if (seen[idx(nx, ny)] || p[(ny * c.width + nx) * 4 + 3] <= 24) continue;
            seen[idx(nx, ny)] = 1; q2.push([nx, ny]);
          }
        }
        if (!touchesMid) {
          // 넘어온 조각입니다 — 지웁니다
          for (let Y2 = by0; Y2 <= by1; Y2++) for (let X2 = bx0; X2 <= bx1; X2++) {
            if (seen[idx(X2, Y2)]) p[(Y2 * c.width + X2) * 4 + 3] = 0;
          }
          continue;
        }
        if (bx0 < kx0) kx0 = bx0; if (bx1 > kx1) kx1 = bx1;
        if (by0 < ky0) ky0 = by0; if (by1 > ky1) ky1 = by1;
      }
      if (kx1 < 0) { boxes.push(null); continue; }
      boxes.push({ sx, sy, lx: kx0 - sx, ly: ky0 - sy, rx: kx1 - sx, ry: ky1 - sy });
    }

    x.putImageData(d, 0, 0);   // 넘어온 조각을 지운 것을 반영합니다

    // 3. 여덟 칸의 경계를 **합칩니다**. 배율과 자리를 하나로 묶어야
    //    재생할 때 주인공이 안 벌렁거립니다.
    let ux0 = 1e9, uy0 = 1e9, ux1 = -1, uy1 = -1;
    boxes.forEach((b) => { if (!b) return;
      if (b.lx < ux0) ux0 = b.lx; if (b.rx > ux1) ux1 = b.rx;
      if (b.ly < uy0) uy0 = b.ly; if (b.ry > uy1) uy1 = b.ry; });
    if (ux1 < 0) return { error: '남은 것이 없습니다' };
    const uw = ux1 - ux0 + 1, uh = uy1 - uy0 + 1;

    const bw = a.w * a.bake, bh = a.h * a.bake;
    const k = Math.min(bw / uw, bh / uh);
    const dw = uw * k, dh = uh * k;
    const offX = (bw - dw) / 2, offY = bh - dh;   // 발이 바닥에 닿게

    // 4. 여덟 컷 모두 같은 값으로 그립니다
    const frames = boxes.map((b, i) => {
      const o = document.createElement('canvas');
      o.width = bw; o.height = bh;
      if (!b) return { url: o.toDataURL('image/png'), empty: true };
      const oc = o.getContext('2d');
      oc.imageSmoothingQuality = 'high';
      oc.drawImage(c, b.sx + ux0, b.sy + uy0, uw, uh, offX, offY, dw, dh);
      return { url: o.toDataURL('image/png') };
    });
    // 칸 가장자리에 그림이 닿았으면 **잘린 것**입니다. 여기서 안 세면 조용히
    // 끝이 날아간 시트가 구워집니다 — 오류도 안 나고 화면도 그럴듯합니다.
    // **칸 경계선 위에 그림이 몇 픽셀이나 얹혔는지** 셉니다.
    //
    // 처음에는 "경계까지의 여백"으로 쟀는데 너무 시끄러웠습니다 — 지팡이 끝이
    // 경계에 닿기만 해도 걸리는데, 닿는 것과 **잘리는 것**은 다릅니다. 끝이
    // 딱 맞게 닿은 것은 멀쩡하고, 잘린 것은 경계선을 따라 **길게** 얹힙니다
    // (불꼬리가 칸을 넘으면 곧은 자국이 그어집니다).
    // 그래서 경계선에 얹힌 길이를 세고, 길면 그때 알립니다.
    const edge = [];
    for (let r = 0; r < a.rows; r++) for (let q = 0; q < a.cols; q++) {
      const sx = Math.round(q * cw), sy = Math.round(r * ch);
      const ex = Math.round((q + 1) * cw) - 1, ey = Math.round((r + 1) * ch) - 1;
      let n = 0;
      const on = (X, Y) => { if (p[(Y * c.width + X) * 4 + 3] > 24) n++; };
      for (let Y = sy; Y <= ey; Y++) { on(sx, Y); on(ex, Y); }
      for (let X = sx; X <= ex; X++) { on(X, sy); on(X, ey); }
      edge.push(n);
    }
    return { frames, edge, union: { w: uw, h: uh },
             cell: { w: Math.round(cw), h: Math.round(ch) } };
    return { frames, tight, union: { w: uw, h: uh },
             cell: { w: Math.round(cw), h: Math.round(ch) } };
  }, { b64: png.toString('base64'), cols: COLS, rows: ROWS, tol: TOL, feather: FEATHER,
       w: hero.w, h: hero.h, bake: BAKE });
}

// ── 무엇을 그리는가 — js/classes.js 의 무기 표에서 뽑습니다 ──
// **js/classes.js 를 읽어 옵니다. 그 파일이 바뀌면 여기가 조용히 멎습니다.**
// 실제로 한 번 멎어 있었습니다 — 자리로 세던 것(order 배열의 몇 번째)이
// 직업이 셋에서 여덟으로 늘면서 어긋났고, 무기 한 줄의 생김새도 바뀌었습니다
// ({ name: … } 앞에 key 가 붙었습니다). 여덟 직업 모두 자루를 0개로 읽고 있었고
// **오류는 안 났습니다** — 그릴 것이 없으니 조용히 아무것도 안 했습니다.
//
// 그래서 두 가지를 바꿨습니다.
//   · 자리로 세지 않고 **key 로 찾습니다** — 직업이 더 늘어도 안 어긋납니다
//   · 한 자루도 못 찾으면 **소리 내고 멈춥니다** (아래) — 조용히 0개는 안 됩니다
function weaponsOf(job) {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'classes.js'), 'utf8');
  const at = src.indexOf(`key: '${job}'`);
  if (at < 0) throw new Error(`js/classes.js 에 '${job}' 직업이 없습니다`);
  const blk = src.slice(at).split('weapons: [')[1];
  if (!blk) throw new Error(`'${job}' 에 weapons 목록이 없습니다`);
  // 종류는 무기마다 다릅니다 — 전사 넷째는 창이고, 쌍(twin) 이면 두 자루입니다.
  // 여기를 job 으로 뭉뚱그리면 창을 베는 그림이 나옵니다.
  const found = [...blk.matchAll(
    /\{ key: '[^']+', name: '([^']+)'[\s\S]*?color: (0x[0-9a-fA-F]+)[\s\S]*?icon: \{ art: '([a-z]+)'([^}]*)\}/g)]
    .slice(0, 12);
  if (found.length !== 12) {
    throw new Error(`'${job}' 의 자루를 ${found.length}개밖에 못 읽었습니다 — `
      + 'js/classes.js 의 생김새가 바뀌었는지 보세요 (열둘이어야 합니다)');
  }
  const GRADE = [
    'a plain worn starting weapon, simple and unadorned',
    'a plain but solid weapon',
    'a solid well-made weapon with a little ornament',
    'a well-made weapon with clear ornament',
    'an enchanted weapon with glowing runes',
    'an enchanted weapon wreathed in faint energy',
    'a powerful enchanted weapon with a bright aura',
    'a powerful weapon crackling with energy',
    'a legendary weapon, large and elaborate',
    'a legendary weapon blazing with light',
    'a mythic weapon of overwhelming presence',
    'the ultimate weapon, vast and radiant',
  ];
  return found.map(([, name, color, art, rest], i) => ({
    key: `w-${job}-${i}`,
    label: name,
    kind: art,
    twin: /twin: *true/.test(rest || ''),
    look: `${GRADE[i]}. Its dominant colour is #${color.slice(2)}. `
        + (/twin: *true/.test(rest || '') ? 'The character wields TWO of them, one in each hand. ' : '')
        + 'It must look clearly stronger and more elaborate than the previous tier.',
  }));
}

function planFor(args) {
  const todo = [];
  for (const a of args) {
    if (HEROES[a]) todo.push(...weaponsOf(a).map((w) => ({ job: a, w })));
    else {
      const job = a.split('-')[1];
      const one = (weaponsOf(job) || []).find((w) => w.key === a);
      if (one) todo.push({ job, w: one });
    }
  }
  return todo;
}

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!args.length) { console.error('직업(warrior) 이나 무기(w-warrior-0) 를 주세요'); process.exit(1); }

  // ── --prompt — 열쇠 없이 주문서만 봅니다 ────────────────
  // gen-sprite.js · gen-story.js 와 같은 규칙입니다. 열쇠가 없거나 저쪽이
  // 멎어 있을 때도 **무엇을 시키는지는 읽을 수 있어야** 합니다. 이 도구가
  // js/classes.js 를 읽어 오므로, 자루를 제대로 세는지 보는 자리이기도 합니다.
  if (process.argv.includes('--prompt')) {
    const plan = planFor(args);
    if (!plan.length) { console.error('그런 것이 없습니다'); process.exit(1); }
    plan.forEach(({ job, w }, i) => {
      if (i) console.log('\n' + '─'.repeat(70) + '\n');
      const refs = [
        baseFor(job, w) && '그 직업 0단계 시트',
        !baseFor(job, w) && anchorFor(job, w) && '전사 0단계 시트(비례)',
        !baseFor(job, w) && portraitFor(job, w) && `초상화 player-${job}.png`,
        refFor(job, w) && '자세 안내',
      ].filter(Boolean);
      console.log(`### ${w.key}  ${w.label} (${w.kind})`
        + (refs.length ? '   참조: ' + refs.join(' · ') : '   참조: 없음'));
      console.log('\n' + promptFor(job, w));
    });
    return;
  }

  if (!KEY && !process.argv.includes("--reslice")) { console.error('GEMINI_API_KEY 가 없습니다'); process.exit(1); }
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const todo = planFor(args);
  if (!todo.length) { console.error('그런 것이 없습니다'); process.exit(1); }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const oven = await browser.newPage();
  await oven.setContent('<html></html>');

  for (const { job, w } of todo) {
    process.stdout.write(`${w.key}  ${w.label} … `);
    try {
      const cached = path.join(RAW, w.key + '.png');
      const reslice = process.argv.includes('--reslice') && fs.existsSync(cached);
      const png = reslice ? fs.readFileSync(cached) : await generate(job, w);
      if (!reslice) fs.writeFileSync(cached, png);
      if (reslice) process.stdout.write('(받아 둔 것으로) ');
      const cut = await slice(oven, png, job);
      if (cut.error) { console.log('자르기 실패 — ' + cut.error); continue; }
      const dir = path.join(OUT, w.key);
      fs.mkdirSync(dir, { recursive: true });
      let empty = 0;
      cut.frames.forEach((f, i) => {
        if (f.empty) empty++;
        fs.writeFileSync(path.join(dir, `${i}.png`),
          Buffer.from(f.url.slice(f.url.indexOf(',') + 1), 'base64'));
      });
      // 경계선에 길게 얹힌 컷을 **소리 내어** 알립니다. 잘린 채로도 게임은
      // 멀쩡히 돌아갑니다 — 불꼬리가 곧게 잘린 자국이 남을 뿐입니다.
      const CUT = 12;   // 이보다 길게 얹히면 스쳐 지난 것이 아니라 잘린 것입니다
      const cutAt = (cut.edge || [])
        .map((n, i) => (n >= CUT ? `${i}(${n}px)` : null)).filter(Boolean);
      console.log(`칸 ${cut.cell.w}×${cut.cell.h} · 합친 경계 ${cut.union.w}×${cut.union.h}`
        + (empty ? `  ← 빈 칸 ${empty}개` : '')
        + (cutAt.length ? `  ← 칸을 넘어 잘림: 컷 ${cutAt.join(' ')}` : ''));
    } catch (e) {
      console.log('실패 — ' + e.message);
    }
  }

  await browser.close();
  console.log('\n컷은 assets/sheets/<무기>/0..7.png · 원본은 shots/sheet-raw/');
})();
