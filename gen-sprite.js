// 스프라이트를 Gemini 로 그립니다 — 컷씬(gen-story.js)과는 문제가 다릅니다.
//
//   GEMINI_API_KEY=... node gen-sprite.js boss          보스 다섯 + 탄
//   GEMINI_API_KEY=... node gen-sprite.js player enemy  주인공 셋 + 적 열둘
//   GEMINI_API_KEY=... node gen-sprite.js e-crawler     한 장만
//
// ── 왜 그냥 못 쓰는가 ─────────────────────────────────────
// 컷씬은 배경이 그림의 일부라 받은 그대로 씁니다. 스프라이트는 다릅니다.
// ART.md 0절이 요구하는 것 — 배경 투명 · 오른쪽을 봄 · 그림자 없음 ·
// 정확한 크기 · 32px 로 줄여도 읽힘.
//
// 그런데 **Gemini 는 알파 채널을 안 내놓습니다.** 그래서 이렇게 뚫습니다.
//   1. 순수 마젠타(#FF00FF) 바탕에 그리게 시킵니다. 이 게임 팔레트에 없는
//      색이라 몸 색과 겹칠 일이 없습니다 (초록·청록을 쓰면 궁수·사수가 먹힙니다)
//   2. 받은 그림에서 마젠타를 걷어냅니다
//   3. 남은 것의 실제 경계를 재서 잘라 냅니다 (모델이 여백을 제멋대로 둡니다)
//   4. 목표 크기의 4배 상자에 맞춰 넣습니다. 사람은 발이 바닥에 닿아야 하므로
//      아래로 붙이고, 나머지는 가운데에 둡니다
//
// 잘 안 되면 어디서 깨졌는지 보이게 중간 산물을 shots/sprite-raw/ 에 남깁니다.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'shots', 'sprite-raw');   // shots/ 는 .gitignore 에 있습니다
const OUT = path.join(ROOT, 'assets');

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const BAKE_SCALE = 4;          // ART.md 0절 — 표의 4배로 받습니다
const CHROMA = [255, 0, 255];  // 마젠타
const TOLERANCE = 78;          // 이 거리 안이면 배경으로 봅니다

// ── 서른 장에 글자 하나 안 바꾸고 붙는 문장 ────────────────
// ART.md 1절의 스타일 문장과 같은 말을 씁니다. 여기서 그림마다 조금씩 고치면
// 세계가 아니라 그림 모음이 됩니다.
const STYLE = [
  '2D game sprite, side view, facing right, chunky readable silhouette,',
  'bold clean dark outlines, flat cel shading with two tone shadows,',
  'light source from upper left, saturated colours, dark fantasy but friendly,',
  'mobile game art, centered single subject, full body visible.',
  'The subject must read clearly even when shrunk to 32 pixels:',
  'big simple shapes, large bright eyes, no fine detail that disappears when small.',
].join(' ');

// 배경 규칙. 이게 이 스크립트의 전부입니다 — 여기가 흔들리면 알파가 지저분해집니다.
const BG = [
  'The background must be a completely flat, uniform, pure magenta #FF00FF —',
  'a solid chroma key screen, absolutely nothing else: no gradient, no texture,',
  'no vignette, no scenery, no ground, no floor, no platform, no shadow of any kind,',
  'no drop shadow, no contact shadow, no reflection.',
  'The subject must not be tinted magenta and must not touch the edges of the frame:',
  'leave a small clean margin all around.',
].join(' ');

// ── 사람은 넷 다 같은 비례여야 합니다 ────────────────────
// gen-sheet.js 가 같은 문제로 한 번 데었습니다. 궁수에게 "slim tall body" 라고
// 적었더니 혼자 **7등신 실사 비례**로 나와서, 전사·도적(4등신) 옆에 세우면
// 딴 게임 사람이었습니다. 여기서도 권법사가 6~7등신 소년으로 왔습니다.
//
// **키나 체격은 몸이 아니라 자세와 옷으로 말하게 하고, 비례는 여기서 못박습니다.**
// 직업 고르기 격자는 여덟을 한 화면에 나란히 세우는 자리라(ART.md 2.5절)
// 하나만 비례가 달라도 그 칸만 튑니다.
const PROPORTION = [
  'PROPORTIONS (identical for every hero in this game): a chunky CHIBI build about four heads',
  'tall — a big head, a short sturdy torso, short thick limbs, large hands and boots.',
  'NOT a realistic six-, seven- or eight-head figure, not slender, not lanky, not tall,',
  'not a teenager and not a young adult body.',
].join(' ');

const FORBID = [
  // 아이템에서 자꾸 무생물에 눈을 그려 옵니다 — 폭탄 · 모루 · 망치 · 약병에
  // 만화 눈이 달려 나왔습니다. 적과 주인공만 눈을 가집니다.
  'If the subject is an object rather than a creature, it must NOT have a face:',
  'no eyes, no eyeballs, no pupils, no mouth, no expression — it is an inanimate object.',
  'No text, no letters, no numbers, no logo, no watermark, no signature,',
  'no border, no frame, no panel, no grid, no sprite sheet, no multiple views,',
  'no turnaround, no character sheet — exactly one single subject in the image.',
].join(' ');

// ── 무엇을 그리는가 ────────────────────────────────────────
// 크기는 ART.md 2·3·4·5절의 표 그대로입니다. 여기를 고치면 게임 안 충돌
// 범위와 어긋나므로 표를 먼저 고쳐야 합니다.
const SUBJECTS = [
  // 주인공 셋 — 발이 그림 맨 아래에 닿아야 합니다
  // 붉은 망토는 군청으로 옮겨졌습니다 (recolor-warrior.js · STORY.md 3절).
  // **그림 파일만 옮기고 이 글은 안 고쳐 뒀었습니다** — 그대로 뒀으면 다시
  // 뽑는 날 붉은 전사가 돌아옵니다. 색을 옮길 때는 그림과 주문서를 같이.
  { name: 'player-warrior', group: 'player', w: 38, h: 48, anchor: 'bottom',
    what: 'A warrior hero for a tower climbing game: broad angular pauldrons, a horned helmet '
        + 'with a deep navy-blue crest, sturdy wide stance, navy-blue and steel-grey armour, '
        + 'a sword held small at his side. Broadest of the three heroes. Navy accent #133286. '
        + 'Nothing on him is red.' },
  { name: 'player-archer', group: 'player', w: 42, h: 48, anchor: 'bottom',
    what: 'An archer hero: a sharply pointed hood, a bow slung across the back, a slim tall body, '
        + 'light leather gear. Narrower and taller-looking than the warrior. Green accent #A5D6A7.' },
  { name: 'player-rogue', group: 'player', w: 40, h: 48, anchor: 'bottom',
    what: 'A rogue hero: crouched low, a cloak streaming back, hood and a face covering, '
        + 'two short daggers. Lowest and widest stance of the three. Purple accent #CE93D8.' },

  // ── 새로 들어오는 다섯 (ART.md 2.5절) ──────────────────
  // 직업 고르기가 격자가 되면서 카드가 초상화 하나뿐이 되고, 잠긴 칸은
  // **속이 하나도 안 보이는 검정 + 외곽선 1px** 로 나옵니다. 그래서 규칙이
  // 하나 더 붙습니다 — **몸 밖으로 나오는 것이 하나씩 있어야 합니다.**
  // 윤곽선 안쪽의 무늬·색·얼굴은 검정에서 전부 사라집니다.
  //
  // 그린 뒤에는 반드시 재 보세요 (게임과 같은 조건으로 칠해 줍니다):
  //   CHROME_PATH=... node sil-check.js assets/player-monk.png
  //
  // 권법사가 가장 어렵습니다. 맨손이라 몸 밖으로 나오는 것이 가장 적은데,
  // **손에 아무것도 없다는 것 자체가 열쇠**라 무기를 쥐여 주면 안 됩니다.
  // 그래서 튀어나오는 것을 넷으로 나눠 걸었습니다 — 위로 상투, 앞으로 든
  // 무릎, 뒤로 날리는 띠, 옆으로 벌린 손.
  { name: 'player-monk', group: 'player', w: 38, h: 48, anchor: 'bottom',
    // 첫 판이 6~7등신 소년으로 왔습니다. 말로만 4등신이라고 하면 모델이
    // 제 결로 갑니다 — 이미 서 있는 둘을 붙여서 비례를 재게 합니다.
    //
    // 이 그림은 **gemini-3.1-flash-image** 로 뽑았습니다. 그리던 날 pro 가
    // 열한 번 내리 503 이었습니다. 참조 둘이 붓과 비례를 잡아 줘서 flash 로도
    // 셋 옆에 세울 만하게 나왔습니다 — 참조가 없었으면 못 바꿨을 겁니다.
    //   GEMINI_IMAGE_MODEL=gemini-3.1-flash-image node gen-sprite.js player-monk
    // (2.5-flash 는 마젠타를 못 걷어내고 분홍 배경째로 왔습니다)
    style: ['player-warrior', 'player-rogue'],
    what: 'A bare-handed martial artist hero, mid-stance, caught in one dynamic pose. '
        + 'HIS HANDS ARE COMPLETELY EMPTY — no weapon, no staff, no sword, no shield, '
        + 'nothing held and nothing strapped to him. That emptiness is the point. '
        + 'He stands on one leg with the OTHER KNEE LIFTED HIGH in front of him, thigh '
        + 'roughly level, so the raised leg clearly juts out from the body. '
        + 'Both hands are open with the fingers spread, held away from the torso — one '
        + 'forward, one drawn back — so there is clear empty space between arm and chest. '
        + 'A long cloth SASH tied at his waist streams out BEHIND him, well clear of the '
        + 'body, a separate ribbon of cloth. '
        + 'His hair is gathered into a TOPKNOT that sticks up above the crown of his head. '
        + 'He is an OLD MASTER, weathered and well past his prime years: iron-grey hair, '
        + 'a short grey chin beard jutting forward, a heavy lined brow, deep-set narrow eyes '
        + 'and a hard set mouth. He must clearly read as an old veteran, NOT as a boy, '
        + 'NOT as a teenager, NOT as a smooth-faced young man. '
        + 'Old but not frail — corded, wiry muscle on the bare arms, and he holds the stance '
        + 'with complete steadiness. '
        + 'He wears a sleeveless cream off-white tunic and loose trousers cropped at the '
        + 'shin, with cloth wraps around his forearms, hands and shins. '
        + 'No armour and no bulk — the opposite of the broad-shouldered warrior. '
        + 'Gold accent #FFD54F on the sash and the wraps. '
        + 'NOTHING on him is red, crimson, scarlet or orange.' },

  // 곰사냥꾼 — 열쇠가 **활**인데 궁수도 활입니다. 검정에서 활 하나로는
  // 둘이 같은 그림이 되므로 ART.md 2.5절이 자세로 가르라고 못박았습니다.
  // 궁수는 곧게 서서 겨누고, 이쪽은 **활을 내린 채** 무겁게 섭니다.
  //
  // **곰이 옆에 같이 섭니다.** 2.5절이 "초상화 안에 같이 들어가도 되지만"
  // 이라고 열어 둔 쪽입니다 — 판 위에 설 곰(ally-bear)은 그것대로 따로
  // 있어야 하고, 이건 초상화 안의 곰입니다. 둘이 같이 서면 이 사람이
  // 무엇을 하는 사람인지가 한 장에서 다 보입니다.
  //
  // 다만 칸이 세로로 깁니다(97×123). 곰을 옆으로 눕혀 세우면 무리가 가로로
  // 넓어져서 상자에 맞추느라 통째로 작아집니다. 그래서 **앉혀서 머리를
  // 들게** 합니다 — 같은 곰인데 세로로 서고, 사람과 키를 나눠 가집니다.
  //
  // 그리고 셋 사이를 띄웁니다. 붙으면 검정에서 덩어리 하나가 됩니다 —
  // 사령술사의 부하 셋과 같은 규칙입니다.
  { name: 'player-hunter', group: 'player', w: 42, h: 48, anchor: 'bottom',
    style: ['player-warrior', 'player-rogue'],
    what: 'A bear hunter hero: a heavy, thick-set, wide-legged figure standing planted and '
        + 'braced, weight low, shoulders hunched forward. '
        + 'THE BOW IS THE MOST IMPORTANT THING IN THIS PICTURE. He carries a huge LONGBOW, '
        + 'taller than he is, gripped in one fist and held STRAIGHT OUT TO ONE SIDE, his arm '
        + 'stretched fully away from his body so the whole bow stands clear of him in open '
        + 'space. There must be a WIDE GAP OF EMPTY BACKGROUND between the bow and his torso, '
        + 'visible along its entire length — the bow must never cross, overlap or touch his '
        + 'body, his fur or his legs. Its upper limb rises above his head and its lower limb '
        + 'reaches below his knee, so the bow is a tall separate shape beside him. '
        + 'The bow is NOT drawn and NOT aimed: no arrow nocked, no raised aiming arm, the '
        + 'string slack and the bow simply carried at rest. '
        + 'He wears a bear-skull as a HOOD with the SNOUT jutting forward over his brow, and '
        + 'a fur mantle over the SHOULDERS ONLY — cropped short at the chest, not a full '
        + 'body-covering pelt, so that it never swallows the bow or the outline of his legs. '
        + 'Below the mantle he is in close-fitting leather with his legs clearly separated. '
        + 'A bearded, weather-beaten older face under the skull hood. '
        + 'Muted grey-brown hide #BCAAA4 with darker brown leather. '
        + 'HIS BEAR SITS LOW IN FRONT OF HIM, down at his feet, on the opposite side from '
        + 'the bow — NOT beside him at his own height. The bear is seated on the ground with '
        + 'its head held LOW, no higher than the man\'s hip, so the two stack VERTICALLY: '
        + 'the man\'s head and chest up in the top half of the picture, the bear\'s heavy '
        + 'rounded mass down in the bottom corner. It is a big shaggy brown bear with kind '
        + 'eyes and no bared fangs, wearing a wide PALE BAND around its neck — it is his '
        + 'companion, not a threat. Warm brown fur #8D6E63, pale band #BCAAA4. '
        + 'THE SINGLE MOST IMPORTANT THING: the man and the bear MUST NOT TOUCH. Leave a '
        + 'wide band of empty background ABOVE THE BEAR\'S BACK, separating the top of the '
        + 'bear from the man\'s arm and body — you should be able to see straight through '
        + 'that gap to the background. The bear must not overlap or lean against his legs. '
        + 'Do the same between the man and the bow. '
        + 'Imagine all three filled in as flat black shapes: a viewer must still count THREE '
        + 'separate silhouettes — a bow, a standing man, and a low animal below him — not '
        + 'one merged lump. '
        + 'Because the bear sits low and forward instead of alongside, the whole group is '
        + 'TALLER THAN IT IS WIDE — keep it that way, a tall upright arrangement. '
        + 'He must NOT read like the slim upright archer: the archer stands tall and draws '
        + 'the bow, this man stands wide and low and carries it at rest out to one side. '
        + 'Nothing on him or the bear is red, crimson, scarlet or orange.' },

  // 사령술사 — 부하 셋이 열쇠인데, **몸에 붙으면 검정에서 안 세어집니다.**
  // 셋을 몸에서 떼어 놓는 것이 이 한 장의 전부입니다.
  { name: 'player-necro', group: 'player', w: 40, h: 48, anchor: 'bottom',
    style: ['player-warrior', 'player-rogue'],
    what: 'A necromancer hero: a gaunt hooded figure in a long tattered robe, standing with '
        + 'one hand raised and fingers curled as if pulling something up out of the ground. '
        + 'The hood is deep and the face inside it is bone-pale and skull-like. '
        + 'THREE SMALL SPIRITS FLOAT BEHIND HIM, arranged in a loose diagonal fan over one '
        + 'shoulder. Each is roughly one fifth of his height, a simple rounded wisp with two '
        + 'glowing eyes and a trailing tail. '
        + 'CRITICAL: all three float in CLEAR EMPTY AIR with an obvious gap of background '
        + 'between each spirit and his body, and between each spirit and the next. They must '
        + 'never touch him and never touch each other or overlap — a viewer must be able to '
        + 'count exactly three separate shapes in a solid black silhouette. '
        + 'The robe hem is torn into ragged points that flare out from his legs. '
        + 'Bone white #ECEFF1 and cold teal #4DB6AC. Nothing is red, crimson or orange.' },

  // 마법사 — 지팡이가 머리 위로 솟는 것과 뾰족한 모자, 세로로 긴 열쇠 둘.
  { name: 'player-wizard', group: 'player', w: 40, h: 48, anchor: 'bottom',
    style: ['player-warrior', 'player-rogue'],
    what: 'A wizard hero: he holds a LONG STAFF upright in one hand, and the staff clearly '
        + 'rises WELL ABOVE THE TOP OF HIS HAT — the shaft is a thin straight line running up '
        + 'past his head with a glowing crystal at its tip. '
        + 'He wears a tall WIDE-BRIMMED POINTED HAT, the cone bent over slightly at the tip, '
        + 'and a long robe with wide sleeves. A long beard hangs down over the robe. '
        + 'The robe hem and the sleeve cuffs flare out away from the body. '
        + 'Sky blue #4FC3F7 robe with deeper blue shadow and a pale glowing crystal. '
        + 'Nothing on him is red, crimson, scarlet or orange.' },

  // 도굴꾼 — 윤곽이 앞뒤 양쪽으로 튀어나오는 유일한 사람입니다.
  { name: 'player-digger', group: 'player', w: 42, h: 48, anchor: 'bottom',
    style: ['player-warrior', 'player-rogue'],
    what: 'A tomb robber hero, leaning forward under a load. '
        + 'A big fat BULGING SACK is roped to his BACK and sticks out well behind him, '
        + 'lumpy with the shapes of the loot inside and tied shut at the top. '
        + 'In his other hand he carries a PICKAXE held out FORWARD, its head at the front so '
        + 'the tool clearly juts out past his body on the opposite side from the sack. '
        + 'So his outline breaks outward in BOTH directions — sack behind, pickaxe ahead. '
        + 'He wears scrappy light gear with no armour at all: a cloth head wrap, goggles '
        + 'pushed up on his forehead, rolled sleeves, and straps and buckles across his chest. '
        + 'Lean and wiry, clearly the least protected of the heroes. '
        + 'Dusty lime #D4E157 and worn brown leather. Nothing is red, crimson or orange.' },

  // ── 33층의 붉은 겉옷 (ART.md 8.3절) ───────────────────
  // 엔딩 시퀀스의 주인공입니다. 다른 것은 다 그림이 됐는데 이 사람만
  // 도형으로 남아 있었고, **이 게임에서 가장 오래 화면에 머무는 사람**입니다.
  //
  // 어려운 줄은 얼굴입니다. 「얼굴 없음」으로 시키면 저승사자가 옵니다 —
  // 없는 것을 시키는 것보다 **있는 것을 시키는** 쪽이 늘 잘 나옵니다.
  // 그래서 「턱과 아랫뺨만 빛을 받는 살아 있는 얼굴」이라고 적습니다.
  //
  // 그리고 판에 「내려온 것」이 있습니다 — 그놈도 얼굴 없는 두건이라, 이
  // 사람의 얼굴이 안 읽히면 둘이 같은 것으로 보입니다. 갈리는 자리는
  // 빛입니다: 놈은 **눈만** 밝고(위), 사람은 **턱만** 밝습니다(아래).
  { name: 'cloak-red', group: 'player', w: 36, h: 46, anchor: 'bottom',
    facing: 'front',
    what: 'A person standing FACING THE VIEWER, wearing a hooded robe that falls all the way '
        + 'to the floor. The deep hood is pulled well forward over the head. '
        + 'THE ARMS ARE COMPLETELY HIDDEN INSIDE THE ROBE. Do not draw arms, do not draw hands, '
        + 'do not draw folded arms across the chest, do not draw sleeves. From the shoulders '
        + 'down the robe is ONE UNBROKEN CONE of cloth widening to the floor — the outline from '
        + 'shoulder to hem is a single clean line on each side with nothing sticking out of it. '
        + 'No weapon, no jewellery, no belt, no clasp, no buckle. '
        + 'THE FACE: this is a LIVING PERSON whose face is simply in shadow. The chin and the '
        + 'lower cheeks catch the light from below and are clearly visible as warm skin, while '
        + 'the eyes and forehead are swallowed by the shadow of the hood. '
        + 'It is NOT an empty hood, NOT a void, NOT a skull, NOT a wraith and NOT a reaper — '
        + 'there is a real face in there and we simply cannot see the upper half of it. '
        + 'He is a MAN OF ABOUT THIRTY-THREE, Middle Eastern — Israeli/Levantine — with warm '
        + 'olive skin, a strong square jaw and a short dark well-kept beard along the jawline. '
        + 'Not a boy and not an old man: a man in his early thirties. '
        + 'Only that lower part of his face shows; the eyes stay in shadow. '
        + 'COLOUR — EXACTLY TWO REDS AND NO OTHERS. The robe is filled with ONE flat red #c62828 '
        + 'over its whole surface, and the only other red allowed is the darker lining #8e1f1f, '
        + 'used solely in the small area inside the hood opening. '
        + 'Do NOT shade the robe with a range of reds: no lighter red highlight, no mid red, no '
        + 'deep red shadow, no gradient, no blending between them. If you would normally paint '
        + 'folds with five tones of red, paint them with none — leave the cloth flat and let the '
        + 'outline describe the shape instead. '
        + 'And no orange, vermilion, magenta, pink, purple or maroon anywhere. '
        + 'STYLE: flat vector illustration — bold simple shapes, a few large flat areas, a thin '
        + 'clean outline. No texture, no noise, no heavy gradients, no rendering detail. '
        + 'Shrunk to 36 pixels wide only three things survive: the line of the hood, the line '
        + 'of the shoulders and the hem — so embroidery, buttons and sashes are pointless. '
        + 'The figure fills the frame, seen straight on.' },

  { name: 'cloak-white', group: 'player', w: 36, h: 46, anchor: 'bottom',
    facing: 'front', same: 'cloak-red',
    sameRule: 'The attached image is THE SAME PERSON IN THE SAME GARMENT, already drawn. '
        + 'Keep everything about him: the same body, the same posture seen straight on, the same '
        + 'deep hood pulled forward, the same face with the chin and short dark beard catching '
        + 'the light while the eyes stay lost in the hood shadow, the same arms hidden inside '
        + 'the robe, the same unbroken cone from shoulders to hem, the same flat vector style '
        + 'and the same outline weight. Put the two pictures side by side and it must be one '
        + 'garment on one man. '
        + 'THE ONLY THING THAT CHANGES IS THE CLOTH COLOUR.',
    what: 'The same hooded figure, but the robe is now WHITE — one flat off-white #f5f5f5 over '
        + 'the whole garment, with a grey lining #cfd8dc inside the hood opening. '
        + 'THE INSIDE OF THE HOOD IS GREY, NOT BLACK. He is standing outside the tower in broad '
        + 'daylight here, so a black hood cavity would read as a hole punched in a bright sky. '
        + 'Keep his chin and beard lit and his eyes in shadow, but make that shadow a soft grey. '
        + 'There is NO RED anywhere on him now — not a thread, not a trim, not a lining. '
        + 'Same pose, same size, same flat vector style, transparent background.' },

  { name: 'cloak-fallen', group: 'item', w: 34, h: 24, anchor: 'bottom',
    facing: 'front', same: 'cloak-red',
    sameRule: 'The attached image is THE SAME PERSON IN THE SAME GARMENT, already drawn. '
        + 'Keep everything about him: the same body, the same posture seen straight on, the same '
        + 'deep hood pulled forward, the same face with the chin and short dark beard catching '
        + 'the light while the eyes stay lost in the hood shadow, the same arms hidden inside '
        + 'the robe, the same unbroken cone from shoulders to hem, the same flat vector style '
        + 'and the same outline weight. Put the two pictures side by side and it must be one '
        + 'garment on one man. '
        + 'WHAT CHANGES: the man is GONE. Erase the head, the hood opening, the face and the '
        + 'body entirely — keep only the red cloth itself.',
    what: 'THE SAME RED ROBE, now EMPTY and lying crumpled on the ground where it was dropped. '
        + 'Nobody is wearing it and nobody is in the picture: no head, no face, no hands, no '
        + 'feet, no body shape inside it. '
        + 'It has collapsed into a low soft heap — the hood fallen back and empty on top, the '
        + 'cloth pooling and folding outward below it, wider than it is tall. '
        + 'Same single flat red #c62828 with the darker lining #8e1f1f showing where the cloth '
        + 'has fallen open. Same flat vector style and outline weight. '
        + 'Seen from slightly above, transparent background, no shadow and no ground under it.' },

  // 위에서 떨어져 내리는 중의 옷. 판에서는 화면 밖에서 바닥까지 떨어지는데
  // (js/scene-ending.js), 바닥에 쌓인 그림을 그대로 띄우면 **더미가 공중에
  // 떠 있는 것**으로 보입니다. 떨어지는 동안은 펼쳐져 있어야 합니다.
  { name: 'cloak-falling', group: 'item', w: 34, h: 36, anchor: 'bottom',
    facing: 'front', same: 'cloak-red',
    sameRule: 'The attached image is THE SAME PERSON IN THE SAME GARMENT, already drawn. '
        + 'Keep everything about him: the same body, the same posture seen straight on, the same '
        + 'deep hood pulled forward, the same face with the chin and short dark beard catching '
        + 'the light while the eyes stay lost in the hood shadow, the same arms hidden inside '
        + 'the robe, the same unbroken cone from shoulders to hem, the same flat vector style '
        + 'and the same outline weight. Put the two pictures side by side and it must be one '
        + 'garment on one man. '
        + 'WHAT CHANGES: the man is GONE and the cloth is IN THE AIR. Erase the head, the face '
        + 'and the body entirely — keep only the red cloth itself.',
    what: 'THE SAME RED ROBE, empty, FALLING THROUGH THE AIR. Nobody is wearing it: no head, '
        + 'no face, no hands, no body inside it. '
        + 'It is caught mid-fall and spread open by the air — the cloth billowing and rippling, '
        + 'the hem flaring wide and lifting, the empty hood trailing up behind it, a few soft '
        + 'folds curling. It must clearly be FALLING and airborne, not resting: taller than it '
        + 'is wide, loose and open, with nothing supporting it. '
        + 'Same single flat red #c62828 with the darker lining #8e1f1f showing on the surfaces '
        + 'that have turned over. Same flat vector style and outline weight. '
        + 'Transparent background, no shadow, no ground, no motion-blur streaks and no speed lines.' },

  // ── 판 위에 서는 편 둘 (ART.md 2.5절) ─────────────────
  // 주인공이 아니라 **적과 같은 자리에 서는 그림**입니다. 그래서 가장 중요한
  // 것은 예쁨이 아니라 「저건 내 편이다」가 한눈에 붙는 것입니다. 적과
  // 헷갈리면 안 때려야 할 것을 때리고 피해야 할 것을 안 피합니다.
  { name: 'ally-bear', group: 'enemy', w: 48, h: 38, anchor: 'bottom',
    style: ['e-crawler', 'e-brute'],
    what: 'A big shaggy brown BEAR walking forward on all four legs, seen from the side, '
        + 'head low and shoulders humped, clearly an animal and not a monster. '
        + 'It is the bear hunter\'s companion and fights on the player\'s side, so it must '
        + 'read as FRIENDLY, not as a monster: kind round eyes, no fangs bared, no snarl, '
        + 'no spikes, no horns, no armour plating, no glowing parts. '
        + 'It wears a wide PALE BAND collared around its neck, light and clearly visible '
        + 'against the dark fur — that band is how a player tells it apart from the monsters. '
        + 'Warm brown fur #8D6E63 with a lighter muzzle, pale grey-brown band #BCAAA4. '
        + 'Nothing on it is red, crimson or orange.' },

  { name: 'ally-thrall', group: 'enemy', w: 22, h: 24, anchor: 'bottom',
    style: ['e-crawler'],
    what: 'A SMALL floating spirit wisp summoned by the necromancer — a simple rounded ghostly '
        + 'shape with a trailing wispy tail below it instead of legs, and two large friendly '
        + 'glowing eyes. Very small and simple, with almost no detail. '
        + 'It fights on the player\'s side, so it must NOT look monstrous: no fangs, no claws, '
        + 'no horns, no spikes, no angry brows. '
        + 'It is bone white and cold teal — pale and luminous — so it never gets mistaken for '
        + 'one of the dark saturated monsters. Bone white #ECEFF1, teal glow #4DB6AC. '
        + 'Nothing on it is red, crimson or orange.' },

  // 적 열둘 — 무엇이 위험한지가 실루엣에 보여야 합니다 (ART.md 3절)
  //
  // anchor: 땅을 딛는 놈은 'bottom'. 모델이 그려 주는 비율이 표의 비율과 안 맞아
  // 상자 안에 여백이 남는데, 가운데에 두면 기는 놈이 공중에 떠 보입니다.
  // 나는 놈(flyer · bomber · diver · ghost)과 박쥐·보스는 떠 있어야 하므로 그대로 둡니다.
  // 코인벌레 — 0층부터 만나는, 한 대에 죽는 첫 상대입니다. 나머지 적이 전부
  // 붉거나 어두운 쪽이라 이것만 반짝여야 **"잡아도 되는 것"**으로 먼저 읽힙니다.
  // 무섭게 그리면 안 됩니다 (js/config.js 의 enemyTypes 첫 줄 참고).
  { name: 'e-coinbug', group: 'enemy', anchor: 'bottom', w: 28, h: 26,
    what: 'A tiny round golden beetle monster, plump and dome-shaped like a coin lying on its '
        + 'side, a polished gold shell with a bright highlight on it, a few short stubby legs '
        + 'underneath, small friendly dark eyes. It looks harmless and valuable, not scary. '
        + 'Gold #FFCA28 with amber #FF8F00 legs.' },
  { name: 'e-crawler', group: 'enemy', anchor: 'bottom', w: 32, h: 32,
    what: 'A small red armoured crawling bug monster low to the ground, thick stubby legs, '
        + 'a segmented shell, big white eyes, pincer jaws forward. Red #EF5350.' },
  { name: 'e-hopper', group: 'enemy', anchor: 'bottom', w: 34, h: 32,
    what: 'A green frog-like hopping monster, huge folded coiled hind legs like a spring, '
        + 'bulging eyes on top of the head, wide mouth. Yellow-green #8BC34A.' },
  // 황금개구리 — 뛰는 것과 **몸이 같아야** 합니다. 실루엣이 같아야 처음 보는
  // 순간에도 어떻게 움직일지 이미 알고, 색만 보고 값어치를 정할 수 있습니다.
  // 그래서 `like` 로 뛰는 것의 그림을 물립니다.
  { name: 'e-goldfrog', group: 'enemy', anchor: 'bottom', w: 34, h: 32, like: 'e-hopper',
    what: 'A frog-like hopping monster made entirely of gleaming GOLD: the same body and the '
        + 'same coiled hind legs as the reference, but its skin is polished golden metal with '
        + 'bright highlights, pale cream eyes with dark pupils, a small gold gem glinting on its '
        + 'belly. Nothing green anywhere. Gold #FFCA28, deeper gold #F9A825, highlights #FFF9C4.' },
  { name: 'e-flyer', group: 'enemy', w: 36, h: 32,
    what: 'A purple flying insect monster with jagged bat-like wings spread, a tapered striped '
        + 'body, large pale eyes, small antennae. Purple #7E57C2.' },
  { name: 'e-brute', group: 'enemy', anchor: 'bottom', w: 32, h: 34,
    what: 'A heavy brown armoured brute, hunched and thick, stone pauldrons, tiny sunken head '
        + 'between the shoulders, heavy fists hanging low, stubby legs. Brown #8D6E63.' },
  // 방패를 앞세운 그림은 **미는 놈**의 것이 됐습니다 (아래 e-shover).
  // 이놈은 노려보다 가로로 내닫는 놈이라 뚫는 쪽으로 다시 그립니다.
  { name: 'e-charger', group: 'enemy', anchor: 'bottom', w: 36, h: 38,
    what: 'A brown armoured burrowing monster whose NOSE IS A BIG CONE DRILL thrust forward — '
        + 'the drill is the danger and must dominate the silhouette, taking up the front half '
        + 'of the body. Visible spiral grooves on the cone. Small braced legs, tiny angry eyes '
        + 'set back behind the drill. Brown #795548 body, pale steel #BCAAA4 drill.' },
  // ── 판을 바꾸는 넷 ─────────────────────────────────
  // 앞의 것들은 닿으면 아픈 것이 전부지만 이 넷은 층을 빼앗고 발판을 부수고
  // 박자로 때립니다. 처음 만날 때 판을 멈추고 이 그림을 크게 한 번 보여 주므로
  // (js/scene-foe.js), **무엇을 하는 놈인지가 실루엣에 보여야** 합니다.
  { name: 'e-shover', group: 'enemy', anchor: 'bottom', w: 36, h: 38,
    what: 'A brown charging soldier monster holding a big shield thrust forward — the shield is '
        + 'the danger and must dominate the silhouette. Braced stance. Brown #795548.' },
  { name: 'e-slammer', group: 'enemy', w: 38, h: 40,
    what: 'A steel-grey monster shaped like a falling WEDGE, heavy and pointed downward — the '
        + 'weight must sit at the bottom so it reads as something about to drop. Short stubby '
        + 'fins near the top, no legs. Steel #78909C, and only the bottom point glowing red '
        + '#EF5350.' },
  { name: 'e-lancer', group: 'enemy', anchor: 'bottom', w: 44, h: 30,
    what: 'A dark red monster with a LONG HORIZONTAL body, wider than it is tall, lying sideways '
        + 'like a cannon — it must never read as upright. One long horizontal glowing red slit '
        + 'across the middle of the body, like a firing port. Dark red #B71C1C body, slit '
        + '#FF5252.' },
  { name: 'e-zapper', group: 'enemy', anchor: 'bottom', w: 36, h: 40,
    what: 'A purple round-bodied monster with ONE PAIR OF HORNS REACHING UP AND DOWN — up above '
        + 'the head and down below the body, never sideways. Only the tips of the horns glow. '
        + 'Purple #7E57C2 body, glowing tips bright violet #D05CE3.' },
  { name: 'e-dasher', group: 'enemy', anchor: 'bottom', w: 32, h: 30,
    what: 'A yellow very fast monster, body swept sharply forward, low and streamlined, '
        + 'thin trailing wisps behind it. Yellow #FFCA28.' },
  { name: 'e-bomber', group: 'enemy', w: 34, h: 36,
    what: 'A blue-grey flying bomb monster carrying a round explosive with a lit burning fuse — '
        + 'the fuse and its spark must be obvious. Slate #546E7A.' },
  { name: 'e-giant', group: 'enemy', anchor: 'bottom', w: 36, h: 38,
    what: 'A large slow crimson-purple giant monster, massive upper body, small head, '
        + 'heavy arms. Reads as huge and slow. Deep pink-purple #AD1457.' },
  { name: 'e-splitter', group: 'enemy', anchor: 'bottom', w: 36, h: 36,
    what: 'A teal blob monster with a clear vertical seam splitting its body down the middle — '
        + 'it looks like it is about to come apart in two. Teal #00897B.' },
  { name: 'e-shooter', group: 'enemy', anchor: 'bottom', w: 34, h: 34,
    what: 'A teal turret monster with one single large eye and a barrel aimed to the right. '
        + 'Teal #26A69A.' },
  { name: 'e-diver', group: 'enemy', w: 36, h: 38,
    what: 'An indigo diving bird monster with a sharp pointed yellow beak and swept-back wings, '
        + 'poised to plunge downward. Indigo #5C6BC0, beak yellow.' },
  { name: 'e-ghost', group: 'enemy', w: 34, h: 36,
    what: 'A pale translucent lavender ghost monster with a bright glowing outline so it stays '
        + 'visible against a dark navy background, wispy dissolving lower body. Lavender #B39DDB.' },

  // 박쥐 둘 — 한눈에 갈려야 합니다 (ART.md 4절)
  { name: 'bat-thief', group: 'bat', w: 40, h: 32,
    what: 'A purple bat monster clutching a bulging loot sack in its feet — the sack must be '
        + 'obvious in the silhouette. Purple #7E57C2.' },
  { name: 'bat-biter', group: 'bat', w: 40, h: 32,
    what: 'A red bat monster with large bared fangs, mouth open — the fangs must be obvious '
        + 'in the silhouette. Red #C62828.' },

  // ── 무기 서른여섯 (ART.md 7절) ──────────────────────────
  // 이름과 순서는 js/classes.js 의 weapons 표에서 뽑았습니다. 색도 거기 값입니다.
  // 칼끝은 위를 보고 활은 오른쪽을 봅니다.
  //
  // 단계가 오를수록 커지고 화려해져야 합니다 — 열두 번째가 첫 번째와 한눈에
  // 갈리지 않으면 UP 을 밟는 보람이 없습니다. 그래서 등급을 넷으로 끊어
  // (수수함 → 견실함 → 마법 → 전설) 문장에 박았습니다.
  { name: 'w-warrior-0', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "녹슨 장검". The blade points UPWARD, hilt at the bottom. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #cfd8dc. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-1', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "강철 검". The blade points UPWARD, hilt at the bottom. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #90caf9. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-2', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "쌍날 검". The blade points UPWARD, hilt at the bottom. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #a5d6a7. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-3', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "은빛 창". The blade points UPWARD, hilt at the bottom. It is a solid well-made weapon with a little ornament. Its dominant colour is #b0bec5. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-4', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "마력 검". The blade points UPWARD, hilt at the bottom. It is a solid well-made weapon with a little ornament. Its dominant colour is #ce93d8. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-5', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "화염도". The blade points UPWARD, hilt at the bottom. It is a solid well-made weapon with a little ornament. Its dominant colour is #ff8a65. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-6', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "뇌전검". The blade points UPWARD, hilt at the bottom. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #81d4fa. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-7', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "용살검". The blade points UPWARD, hilt at the bottom. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #ffb74d. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-8', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "파천검". The blade points UPWARD, hilt at the bottom. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #f48fb1. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-9', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "성흔검". The blade points UPWARD, hilt at the bottom. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #fff59d. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-10', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "혼돈의 대검". The blade points UPWARD, hilt at the bottom. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #9575cd. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-warrior-11', group: 'weapon', w: 48, h: 48,
    what: 'A single sword weapon icon for a fantasy game, called "천공검". The blade points UPWARD, hilt at the bottom. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #80cbc4. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-0', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "낡은 단궁". The bow faces RIGHT, its string on the right side. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #d7ccc8. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-1', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "사냥꾼의 활". The bow faces RIGHT, its string on the right side. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #bcaaa4. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-2', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "각궁". The bow faces RIGHT, its string on the right side. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #a5d6a7. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-3', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "강철 석궁". The bow faces RIGHT, its string on the right side. It is a solid well-made weapon with a little ornament. Its dominant colour is #b0bec5. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-4', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "바람의 활". The bow faces RIGHT, its string on the right side. It is a solid well-made weapon with a little ornament. Its dominant colour is #80deea. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-5', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "불꽃 장궁". The bow faces RIGHT, its string on the right side. It is a solid well-made weapon with a little ornament. Its dominant colour is #ff8a65. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-6', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "뇌명궁". The bow faces RIGHT, its string on the right side. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #81d4fa. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-7', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "용뼈 대궁". The bow faces RIGHT, its string on the right side. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #ffb74d. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-8', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "질풍 대궁". The bow faces RIGHT, its string on the right side. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #f48fb1. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-9', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "성좌궁". The bow faces RIGHT, its string on the right side. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #fff59d. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-10', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "심연 장궁". The bow faces RIGHT, its string on the right side. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #9575cd. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-archer-11', group: 'weapon', w: 48, h: 48,
    what: 'A single bow weapon icon for a fantasy game, called "천뢰궁". The bow faces RIGHT, its string on the right side. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #80cbc4. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-0', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "이 빠진 단도". The blade points UPWARD, hilt at the bottom. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #cfd8dc. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-1', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "사냥칼". The blade points UPWARD, hilt at the bottom. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #90caf9. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-2', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "쌍단도". The blade points UPWARD, hilt at the bottom. It is a plain, worn, humble starting weapon — simple and unadorned. Its dominant colour is #a5d6a7. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-3', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "독니". The blade points UPWARD, hilt at the bottom. It is a solid well-made weapon with a little ornament. Its dominant colour is #9ccc65. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-4', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "그림자 단검". The blade points UPWARD, hilt at the bottom. It is a solid well-made weapon with a little ornament. Its dominant colour is #ce93d8. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-5', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "월아도". The blade points UPWARD, hilt at the bottom. It is a solid well-made weapon with a little ornament. Its dominant colour is #ff8a65. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-6', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "뇌전 비수". The blade points UPWARD, hilt at the bottom. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #81d4fa. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-7', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "용아 단검". The blade points UPWARD, hilt at the bottom. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #ffb74d. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-8', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "그믐 비수". The blade points UPWARD, hilt at the bottom. It is an ornate enchanted weapon with glowing details and a faint aura. Its dominant colour is #f48fb1. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-9', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "사혼도". The blade points UPWARD, hilt at the bottom. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #fff59d. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-10', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "심연의 이빨". The blade points UPWARD, hilt at the bottom. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #9575cd. It must look clearly more powerful and more elaborate than the previous tier.' },
  { name: 'w-rogue-11', group: 'weapon', w: 48, h: 48,
    what: 'A single dagger weapon icon for a fantasy game, called "천살 단검". The blade points UPWARD, hilt at the bottom. It is a legendary weapon, large and elaborate, wreathed in glowing energy. Its dominant colour is #80cbc4. It must look clearly more powerful and more elaborate than the previous tier.' },

  // ── 보스가 내리꽂는 것 다섯 (ART.md 5절) ────────────────
  // 옆을 보는 다른 그림과 달리 **위아래 방향**입니다. 떨어지는 쪽이 뾰족해야
  // 어디로 오는지가 읽힙니다.
  { name: 'boss-shot', group: 'bossshot', w: 36, h: 36,
    what: 'A falling magic projectile seen from the side, oriented vertically: a violet orb of '
        + 'energy with a bright pale core, tapering to a point at the BOTTOM, a short trail above '
        + 'it. Violet #7C4DFF, core pale #E1BEE7.' },
  { name: 'boss-shot-gazer', group: 'bossshot', w: 36, h: 36,
    what: 'A falling segment of a cyan energy beam, oriented vertically, narrow and lance-like, '
        + 'brightest white-cyan at its centre, tapering to a point at the BOTTOM. Cyan #26C6DA.' },
  { name: 'boss-shot-crusher', group: 'bossshot', w: 36, h: 36,
    what: 'A falling jagged chunk of dark rock with glowing molten orange cracks running through '
        + 'it, angular and heavy, oriented so it drops downward. Rock brown-grey, cracks #FF7043.' },
  { name: 'boss-shot-brood', group: 'bossshot', w: 36, h: 36,
    what: 'A falling green egg, heavier and rounder at the BOTTOM and narrower at the top, its '
        + 'translucent shell showing a small curled shape inside. Green #9CCC65.' },
  { name: 'boss-shot-phantom', group: 'bossshot', w: 36, h: 36,
    what: 'A falling pale wisp of ghost fire, oriented vertically with a long tail trailing UPWARD '
        + 'and a bright white core at the bottom. Pale violet #B39DDB, core white.' },

  // ── 발판 위 아이템 (ART.md 7.5) ─────────────────────────
  // 동그라미 배지 없이 그림 자체가 실루엣입니다. 어두운 벽 위에 맨몸으로
  // 놓이므로 밝고 또렷해야 합니다. 가짜는 진짜와 실루엣이 같고 안쪽만 망가집니다.
  { name: 'item-plus', group: 'item', w: 36, h: 36,
    what: 'A glowing blacksmith anvil with a forging hammer floating just above it, bright golden '
        + 'sparks flying where they meet. Gold #FFD54F.' },
  { name: 'item-fake-plus', group: 'item', w: 36, h: 36,
    what: 'The same anvil and hammer, but broken: the anvil is cracked through, the hammer head is '
        + 'split, and instead of sparks there is black smoke. Dull, tarnished, lifeless.' },
  { name: 'item-haste', group: 'item', w: 36, h: 36,
    what: 'A single light blue feather, its tip fraying into a few loose barbs blown off by the '
        + 'wind. Sky blue #4FC3F7.' },
  { name: 'item-fake-haste', group: 'item', w: 36, h: 36,
    what: 'The same feather, but snapped and bent in the middle with its tip burnt to black char, '
        + 'ash falling from it. Dull and colourless.' },
  { name: 'item-double', group: 'item', w: 36, h: 36,
    what: 'TWO bright cyan feathers side by side with a clear gap between them so they can be '
        + 'counted, glowing, the rarest item. Cyan #00E5FF.' },
  { name: 'item-armor-warrior', group: 'item', w: 36, h: 36,
    what: 'A steel shield, wide at the top and tapering to a point at the bottom, with a gold rim '
        + 'and a gold boss at its centre. Steel #A8BCCD, gold #FFC94D.' },
  { name: 'item-armor-archer', group: 'item', w: 36, h: 36,
    what: 'The same shield shape but made of green leather with brown stitched edging and a brown '
        + 'centre stud. Leather green #81C784, brown #6D4C41.' },
  { name: 'item-fake-armor', group: 'item', w: 36, h: 36,
    what: 'The same shield shape, tarnished grey, with a ragged hole punched clean through its '
        + 'middle and cracks radiating from the hole. The hole is empty, showing through.' },
  // 궁수는 가죽을 두르므로 가짜도 가죽이어야 합니다. 강철 가짜를 그대로 쓰면
  // "이건 내 것이 아니구나"가 먼저 읽혀서 속지를 않습니다 (verify-art.js 가 봅니다).
  { name: 'item-fake-armor-archer', group: 'item', w: 36, h: 36, like: 'item-armor-archer',
    what: 'The same green leather shield, but ruined: the leather is faded and grey-green, split '
        + 'open by a ragged tear through its middle with the stitching burst and threads hanging '
        + 'loose. The tear is empty, showing through.' },
  { name: 'item-dodge', group: 'item', w: 36, h: 36,
    what: 'ONE single light leather boot with a small wing on its heel, seen from the side, '
        + 'tilted as if in mid-stride, with two faint speed streaks trailing behind it. '
        + 'Purple leather #CE93D8. Just one boot — not a pair, not a stack, not a wall.' },
  { name: 'item-fake-dodge', group: 'item', w: 36, h: 36,
    what: 'The same boot, but ruined: the sole is torn open and flapping, the laces are snapped, '
        + 'and the trailing afterimages have gone grey and smoky.' },
  { name: 'item-heal', group: 'item', w: 36, h: 36,
    what: 'A round-bottomed glass flask of red healing potion with a cork stopper, surrounded by a '
        + 'soft green healing glow. Potion red #EF5350, glow green #66BB6A.' },
  { name: 'item-fake-heal', group: 'item', w: 36, h: 36,
    what: 'The same flask, but cracked and chipped, its contents black and sludgy, the glow gone '
        + 'and replaced by a faint dark vapour.' },
  { name: 'item-medal', group: 'item', w: 36, h: 36,
    what: 'A gold medal on a short red ribbon, a star struck into its face. Gold #FFCA28.' },
  { name: 'item-relic', group: 'item', w: 36, h: 36,
    what: 'A precious golden faceted gem held upright in a clawed golden setting, glowing, with '
        + 'small sparkles around it — a rare relic. Gold #FFD54F.' },
  { name: 'item-treasure', group: 'item', w: 36, h: 36,
    what: 'A closed wooden treasure chest with a domed lid, iron bands across it, gold corner '
        + 'fittings and a gold lock plate with a keyhole in the middle. Shut and ordinary — '
        + 'nothing about it is alive. Wood #8D6E63, gold #FFC94D.' },
  // 가짜 보물상자는 **미믹**입니다. 진짜와 나란히 놓았을 때 "저건 살아 있다"가
  // 한눈에 읽혀야 합니다 — 다가가기 전에는 진짜 그림을 쓰고, 다가가면 이걸로
  // 바뀝니다 (js/tower.js 의 MIMIC_DISGUISES).
  { name: 'item-fake-treasure', group: 'item', w: 36, h: 36, like: 'item-treasure',
    what: 'The same wooden chest, but it is a MIMIC that has woken up: the lid is thrown wide '
        + 'open like a jaw, a row of long white fangs lines the rim above and below, a fat pink '
        + 'tongue lolls out, and two round glowing yellow eyes stare from inside the lid. '
        + 'Wood #8D6E63, gold #FFC94D, eyes #FFCA28.' },
  { name: 'item-bomb', group: 'item', w: 36, h: 36,
    what: 'A classic black iron bomb, a round heavy sphere with a short fuse burning at the top '
        + 'and a bright spark. It is openly dangerous, not disguised.' },
  { name: 'item-plus-anvil', group: 'item', w: 36, h: 28,
    what: 'A blacksmith anvil alone, seen from the side, nothing above it, no hammer, no sparks.' },
  { name: 'item-plus-hammer', group: 'item', w: 28, h: 28,
    what: 'A forging hammer alone, its head at the upper left and its handle pointing down to the '
        + 'lower right, nothing else.' },

  // ── 상점 주인 (ART.md 8.9절) ─────────────────────────────
  //
  // 한 사람을 **두 장**으로 그립니다. 크기가 같아 헷갈리기 쉬운데 쓰임이
  // 정반대입니다.
  //
  //   shop-keeper  상점 **화면** 안에 서는 초상. 1배로 굽습니다 (152×192 그대로).
  //                화면에서 190px 이라 얼굴이 또렷해야 합니다
  //   shop-npc     상점 **발판** 위에 서는 작은 사람. 4배로 굽습니다 (→ 38×48).
  //                38px 로 줄어들면 남는 것은 붉은 두건과 금색 주머니뿐입니다
  //
  // 둘 다 `style` 로 **이미 그려 놓은 기사와 기는 것을 물립니다.** 이게
  // 8.9절이 가장 세게 못박은 것입니다 — 발판 위에서 적들과 나란히 서므로,
  // 그림체가 다르면 「저건 적인가」를 한 박자 늦게 판단하게 됩니다. 상점
  // 발판은 안전한 자리라 그 한 박자가 가장 나쁩니다.
  //
  // 색은 금/호박/따뜻한 갈색입니다. 이 게임에서 금색이 곧 「돈」이고
  // (코인·메달·가격표·상점 발판이 전부 #FFCA28 계열), 덤으로 주인공 셋의
  // 붉은색·초록·보라와 안 겹칩니다. 도적이 후드에 얼굴 가리개라 주인은
  // **얼굴이 보이는** 쪽으로 갑니다.
  //
  // 사람 설정은 손님이 준 그림에서 왔습니다 — 두건을 쓴 젊은 여자 상인.
  // **그림체는 그것을 따라가지 않습니다.** 받은 그림은 실사 비례의 애니풍이고,
  // 여기 붙는 것은 3등신 판 그림체입니다. 그래서 `style` 로 물리는 것은
  // 여전히 기사와 기는 것입니다 — 설정은 말로, 붓은 그림으로.
  { name: 'shop-keeper', group: 'shop', w: 152, h: 192, scale: 1, anchor: 'bottom',
    style: ['player-warrior', 'e-crawler'], facing: 'front',
    what: 'A cheerful YOUNG WOMAN merchant who has set up a stall inside a dark tower — seen from '
        + 'the front, from the waist up and a little above. '
        + 'She wears a rust-red bandana tied at the back over long dark hair, with one thin braid '
        + 'falling in front of her shoulder. A cream off-white shirt with the sleeves rolled up to '
        + 'the elbow, a brown leather vest over it with a buckled strap across the chest, '
        + 'fingerless brown leather gloves and wrist wraps, small brass earrings. '
        + 'A wide leather belt with a big brass buckle, several small pouches and bottles on it, '
        + 'and a satchel with a tassel hanging at her hip. '
        + 'She is holding up a fat MONEY SACK in one hand to show it off — a soft cloth bag '
        + 'gathered at the neck and tied shut with a drawstring cord, round and bulging with '
        + 'coins, with the cloth puckering into folds above the knot. '
        + 'It is NOT a hard clasp purse: no metal frame, no snap clasp, no hinge, no buckle, '
        + 'no stiff leather wallet — just cloth and a cord. '
        + 'She is smiling with her mouth open — bright and mid-sale. '
        + 'Warm browns, cream and brass gold. Gold #FFCA28, warm brown #8D6E63, '
        + 'rust bandana #B04A3A, cream #E8DCC0. '
        + 'Her face must read clearly: this drawing stands 190 pixels tall in a shop window.' },
  { name: 'shop-npc', group: 'shop', w: 38, h: 48, anchor: 'bottom',
    same: 'shop-keeper', facing: 'left',
    what: 'The shop keeper from the attached picture, drawn FULL BODY from head to feet, '
        + 'standing and turned to the LEFT. Same face, same rust-red bandana over long dark '
        + 'hair, same cream shirt and brown leather vest, same belt with pouches. '
        + 'She holds her round cloth money sack, tied with a drawstring, down at her side. '
        + 'HER FACE MUST BE DRAWN — turned left in three-quarter view with her eyes, eyebrows, '
        + 'nose and smiling mouth all clearly visible. Never a blank face, never her back to us. '
        + 'CRITICAL: this shrinks to 38 pixels tall in the game, so use big simple shapes and '
        + 'only two or three flat tones — no small patterns, no fine trim, no tiny buckles. '
        + 'The RUST-RED BANDANA, the dark hair and the MONEY SACK are the only things that '
        + 'survive at that size, so make all three large and unmistakable. '
        + 'Gold #FFCA28, warm brown #8D6E63, rust bandana #B04A3A, cream #E8DCC0.' },


  // ── 상점 배경 (ART.md 8.9절) ─────────────────────────────
  //
  // 발판 **뒤**에 깔립니다 (깊이 -3 — 벽과 발판 사이). 920×300 으로 그려서
  // 2로 나눕니다 → 460×150.
  //
  // 세 가지가 자리를 정합니다.
  //   · **가운데를 비웁니다.** 거기에 「상 점」 글자가 이미 서 있습니다.
  //     밝거나 어수선하면 글자가 묻힙니다 (타이틀 배경과 같은 규칙)
  //   · 아래 끝이 **반듯한 가로선**이어야 발판 윗변에 붙습니다
  //   · 위쪽은 아무것도 안 그립니다. 마젠타가 걷히면서 저절로 사라지므로
  //     다음 층 발판과 맞닿아도 경계가 안 보입니다
  //
  // 사람은 안 넣습니다 — 주인은 shop-npc 로 따로 서고, 둘이 겹치면 발판
  // 오른쪽에 사람이 둘이 됩니다.
  { name: 'shop-back', group: 'shop', w: 460, h: 150, scale: 2, anchor: 'bottom',
    // 사람을 자로 씁니다. 상자가 150px 인데 주인은 48px 이라, 수레가 상자를
    // 꽉 채우면 사람 키의 세 배가 됩니다 — 실제로 그렇게 나왔습니다.
    // 상자 150px 에 62% → 93px. 주인이 48px 이니 수레가 사람의 두 배쯤입니다.
    ratio: '21:9', tol: 112, tall: 0.62, style: ['shop-npc', 'player-warrior', 'e-crawler'],
    what: 'A travelling pedlar\'s stall set up inside a dark stone tower — NO PEOPLE anywhere, '
        + 'just the cart and the goods. A very wide, low, horizontal scene. '
        + 'SCALE IS THE MOST IMPORTANT THING HERE. One of the attached pictures is a merchant '
        + 'standing. In the game she stands right next to this cart, and she is only ONE THIRD '
        + 'of the height of this image. Draw everything to her size: '
        + 'the cart WHEELS come up to her knee, the CART BED is at her waist, the top of the '
        + 'AWNING is just above her head, and the CRATES are stacked no higher than her chest. '
        + 'A handcart one person pulls — not a wagon, not a caravan. '
        + 'THE TOP HALF OF THE IMAGE IS THEREFORE MOSTLY EMPTY, and that is correct. '
        + 'THE WIDTH IS DIVIDED INTO FIVE EQUAL BANDS AND EACH BAND IS SPOKEN FOR: '
        + 'BAND 1 and BAND 2 (the left 40%): a wooden handcart with two big spoked wheels and '
        + 'long pull handles resting on the ground, a striped cloth awning on bent poles above '
        + 'it, the cart bed piled with wares — rolled rugs, sacks, bottles, a brass scale. '
        + 'The whole cart, awning and handles included, must fit inside these two bands. '
        + 'BAND 3 (the exact middle 20%): COMPLETELY EMPTY. Nothing at all. Not one crate, not '
        + 'one rope, not one glow — this is where a sign goes, and anything drawn here ruins it. '
        + 'BAND 4 (60% to 80%): a few stacked wooden crates and a barrel on the ground, a coil '
        + 'of rope, and one small lantern hanging from a hook. Its light is WARM AMBER ORANGE '
        + '(#FFCA28 fading to #FF8F00) — never pink, never magenta, never violet. '
        + 'BAND 5 (the right 20%): COMPLETELY EMPTY. Nothing at all — a person will stand here. '
        + 'The empty bands are the SAME FLAT PURE MAGENTA as the background, because the magenta '
        + 'is keyed out to transparency later. Do NOT fill them with black. Do NOT draw a dark '
        + 'panel, a board, a backdrop, a wall, a curtain, a shadow or a gradient behind anything. '
        + 'There is no wall in this picture — the cart and the crates sit on plain magenta with '
        + 'nothing behind them at all. '
        + 'Everything rests on one straight flat ground line along the very BOTTOM edge of the '
        + 'image: the wheels, the crates and the barrel all touch that line and nothing hangs '
        + 'below it. Nothing floats. Keep everything low and small — remember the merchant is '
        + 'only one third of the image height and nothing here towers over her. '
        + 'Warm worn browns and dull brass, low saturation, lit by the lantern. '
        + 'Wood #8D6E63, brass #FFCA28, faded cloth #B04A3A. '
        + 'NOTHING in the artwork may be pink, magenta or violet — those are the key colour and '
        + 'will be erased. Glows, cloth and shadows all stay warm brown, amber or grey.' },

  // ── 날아가는 것과 이펙트 (ART.md 6절) ────────────────────
  // 코드가 회전시켜 쓰므로 전부 오른쪽을 향합니다.
  //
  // slash · wave · spark · bullet 은 **흰색이어야 합니다** — 코드가 무기 색을
  // 입혀서 씁니다. 색이 들어 있으면 그 색과 섞여 탁해집니다. 이건 취향이
  // 아니라 동작의 문제라 색을 못 바꿉니다.
  { name: 'arrow', group: 'fx', w: 38, h: 13,
    what: 'A single arrow lying horizontally, its sharp head at the RIGHT end and its fletching at '
        + 'the LEFT end, wooden shaft.' },
  { name: 'arrow-trail', group: 'fx', w: 18, h: 3,
    what: 'A short soft horizontal streak of pale light, faded at both ends — a motion trail.' },
  { name: 'wave', group: 'fx', w: 44, h: 44,
    what: 'A crescent-shaped energy wave bulging to the RIGHT, pure WHITE with no colour at all, '
        + 'thick in the middle and tapering to points at both tips.' },
  { name: 'slash', group: 'fx', w: 140, h: 140,
    what: 'A sword slash arc shaped like an eyebrow, pure WHITE with no colour at all, thick in '
        + 'the middle and tapering to sharp points at both ends, bulging to the RIGHT.' },
  { name: 'bullet', group: 'fx', w: 12, h: 12,
    what: 'A small round glowing bolt, pure WHITE with no colour at all, brightest at its centre.' },
  { name: 'enemy-bullet', group: 'fx', w: 16, h: 16,
    what: 'A small round glowing bolt in angry RED with a hot bright core — it must read as the '
        + 'enemy\'s shot, clearly different from a white one. Red #FF5252.' },
  { name: 'spark', group: 'fx', w: 10, h: 10,
    what: 'One tiny four-pointed spark, pure WHITE with no colour at all.' },
  { name: 'coin', group: 'fx', w: 18, h: 18,
    what: 'A gold coin seen from the side, slightly narrowed as if turning, with a bright rim. '
        + 'Gold #FFC107.' },

  // 보스 다섯 — 가로로 넓적하게, 아래턱이 아래로 (ART.md 5절)
  { name: 'boss-warden', group: 'boss', w: 320, h: 240,
    what: 'A huge wide floating boss demon, the gatekeeper of the tower: broad and horizontally '
        + 'wide, a crown of horns spreading upward, two enormous glowing red eyes, a heavy toothed '
        + 'lower jaw hanging down. Dark indigo body #311B92 and #4527A0, eyes red #FF5252.' },
  { name: 'boss-gazer', group: 'boss', w: 320, h: 240,
    what: 'A huge wide floating boss demon with ONE single enormous glowing cyan eye filling the '
        + 'centre of its body, horns swept back, a narrow toothed maw below, faint cyan light '
        + 'leaking downward from the maw. Dark indigo body #311B92, eye cyan #26C6DA.' },
  { name: 'boss-crusher', group: 'boss', w: 320, h: 240,
    what: 'A huge wide floating boss demon with two massive pincer claws spread wide to the left '
        + 'and right — the claws dominate the silhouette and are held open, their inner biting '
        + 'edges glowing hot orange. Small head, small eyes. Body #311B92, hot edges #FF7043.' },
  { name: 'boss-brood', group: 'boss', w: 320, h: 240,
    what: 'A huge wide floating boss demon with translucent green egg sacs hanging beneath its '
        + 'swollen abdomen, small curled shapes visible inside them, a cluster of many small eyes. '
        + 'Body dark indigo #311B92, egg sacs green #9CCC65.' },
  { name: 'boss-phantom', group: 'boss', w: 320, h: 240,
    what: 'A huge wide floating boss demon that is semi-transparent and ghostly, its body '
        + 'dissolving into wisps at the bottom, wearing a pale cracked porcelain mask split by a '
        + 'vertical crack, empty glowing eye slits. A bright pale outline keeps it visible against '
        + 'a dark background. Body #4527A0, mask pale #E1BEE7.' },

  // ── 발판 셋과 벽 — **AI 로 안 뽑습니다. SVG 로 둡니다** ──────
  // 시도했고 실패했습니다.
  //   벽   "돌벽만 그려라"고 했는데 모델이 그 위에 드워프 전사를 그려 넣었고,
  //        거울 타일링 때문에 위쪽에 거꾸로 선 드워프까지 생겼습니다.
  //        세로로 끊김 없이 이어져야 한다는 조건을 모델이 지킬 수 없습니다.
  //   발판  460×20 은 23:1 입니다. 모델은 그런 띠를 안 그리고, 늘려 채우면
  //        밋밋한 막대가 됩니다.
  //
  // 이 넷은 art/*.svg 가 맡습니다. 게임도 그쪽을 읽으므로 손해가 없습니다.
];

const GROUPS = ['player', 'enemy', 'bat', 'boss', 'bossshot', 'item', 'fx', 'weapon', 'scene'];

// 보스에만 붙는 규칙. 첫 판에서 다섯 다 여기서 어긋났습니다 —
// 세로로 길어지고, 아래턱이 사라지고, 수문장이 귀여워졌습니다.
const BOSS_RULES = [
  'COMPOSITION: the boss must be clearly WIDER THAN TALL — a broad, horizontally spread,',
  'looming shape that fills the frame from left edge to right edge, roughly 4:3.',
  'Do NOT draw it tall, vertical, upright or narrow.',
  'It floats in the air; it has no legs and does not stand on anything.',
  'A heavy LOWER JAW lined with teeth hangs down from the bottom of the body —',
  'this is the part the player reaches with a sword, so it must be thick and obvious.',
  'A CROWN of horns spreads upward and outward so the silhouette reads like a crown.',
  'TONE: menacing, heavy and imposing — an ancient thing that guards the tower.',
  'Not cute, not chibi, not a mascot. The eyes must have dark pupils and a hard stare.',
].join(' ');

// 벽과 발판은 배경을 안 지웁니다 — 그림 자체가 배경이거나 화면을 꽉 채웁니다.
// 거기에 마젠타를 시키면 오히려 가장자리에 분홍이 낍니다.
const BG_OPAQUE = [
  'This is a background/tileable surface, not a character: it must fill the entire frame',
  'edge to edge with no margin, no border, no vignette and no background behind it.',
].join(' ');

// 공통 문장(STYLE)이 "facing right" 라고 못박고 있습니다. 대부분은 그게 맞지만
// 상점 주인처럼 **왼쪽을 봐야 하는** 것도 있습니다. 앞의 문장과 뒤의 문장이
// 서로 싸우면 모델은 가운데를 고릅니다 — 실제로 정면을 보고 나왔습니다.
// 그래서 방향은 **맨 끝에 한 번 더** 못박습니다.
const FACING = {
  left: 'FINAL REMINDER — DIRECTION: this character faces LEFT, in profile, looking towards the '
      + 'left edge of the image. Ignore any earlier instruction that says facing right.',
  front: 'FINAL REMINDER — DIRECTION: this character faces the viewer, straight on. '
       + 'Ignore any earlier instruction that says side view or facing right.',
};

function promptFor(s) {
  const parts = [s.what];
  if (s.group === 'boss') parts.push(BOSS_RULES);
  if (s.group === 'player') parts.push(PROPORTION);
  parts.push(STYLE);
  parts.push(s.bg === 'none' || s.bg === 'opaque' ? BG_OPAQUE : BG);
  parts.push(FORBID);
  if (s.facing && FACING[s.facing]) parts.push(FACING[s.facing]);
  return parts.join('\n\n');
}

// ── 부르기 ─────────────────────────────────────────────────
function pickImage(json) {
  const out = [];
  (function walk(node, depth) {
    if (!node || depth > 12 || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const inline = node.inlineData || node.inline_data;
    if (inline && typeof inline.data === 'string') out.push(inline.data);
    Object.keys(node).forEach((k) => walk(node[k], depth + 1));
  })(json, 0);
  return out[0] || null;
}

// 어떤 놈은 **다른 놈과 실루엣이 같아야** 합니다. 황금개구리가 그렇습니다 —
// 뛰는 것과 몸이 같고 색만 금빛이어야, 처음 보는 순간에도 어떻게 움직일지
// 이미 알고 "쫓아갈까 말까"만 정하면 됩니다 (js/textures.js 의 주석).
// 말로만 시키면 모델이 제 개구리를 새로 지어냅니다. 그림을 물려야 합니다.
const SHAPE_RULE = [
  'The attached image is a SHAPE REFERENCE: another monster from this same game.',
  'Copy its silhouette closely — the same body shape, the same proportions, the same pose,',
  'the same stance, the same head and limb placement, the same outline weight. A player must',
  'recognise it as the same kind of creature at a glance.',
  'ONLY THE COLOURS AND THE SURFACE CHANGE, exactly as described above.',
].join(' ');

function refOf(subject) {
  if (!subject.like) return null;
  const f = path.join(OUT, subject.like + '.png');
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
}

// 어떤 그림은 **다른 놈과 그림체가 같아야** 합니다. 실루엣이 아니라 붓이
// 같아야 하는 것입니다 — 상점 주인이 그렇습니다. 판 위에서 적들과 나란히
// 서므로, 그림체가 다르면 「저건 적인가」를 한 박자 늦게 판단하게 됩니다
// (ART.md 8.9절). 말로 "3등신 · 두꺼운 외곽선" 이라고 적어도 모델은 제 결로
// 그립니다. 이미 그려 놓은 것을 **물려야** 합니다.
//
// 등신 수를 여기 글로 박아 두면 안 됩니다. 한동안 "three-head chibi" 라고
// 적혀 있었는데, 그건 상점 사람들 이야기였습니다 — 주인공 넷은 4등신입니다
// (gen-sheet.js 의 PROPORTION). 주인공에 이 규칙을 물리는 날 글과 그림이
// 서로 다른 말을 하게 됩니다. **비례는 붙인 그림에서 재게 시킵니다.**
const STYLE_RULE = [
  'The attached images are STYLE REFERENCES from this same game — a hero and a monster',
  'that already exist. They are NOT the character you are drawing: do not copy their',
  'costume, their colours, their weapon or their pose.',
  'Copy the DRAWING STYLE exactly: MATCH THE HEAD-TO-BODY RATIO OF THE ATTACHED PICTURES —',
  'measure it off them rather than choosing your own — along with the same chunky chibi',
  'build, the same thick dark outline weight, the same flat cel shading in three or four',
  'hard steps with no soft gradients, the same low saturation, the same amount of detail.',
  'Put your drawing next to them and they must look like they were painted by the same',
  'hand for the same game.',
].join(' ');

// 같은 **사람**을 두 장으로 그릴 때 씁니다. 실루엣을 베끼는 `like` 와도,
// 붓만 베끼는 `style` 과도 다릅니다 — 여기서는 얼굴과 옷차림이 같아야 하고
// 자세와 잡은 크기는 달라야 합니다 (하나는 상반신, 하나는 전신).
// 같은 것을 두 장으로 그릴 때 붙입니다. 아래 글은 **상점 주인 전용**이라
// (머리 모양·두건·장화 이야기가 박혀 있습니다) 다른 것에 그대로 물리면
// 엉뚱한 말을 합니다. 그래서 항목이 `sameRule` 로 제 글을 들고 올 수 있습니다.
const PERSON_RULE = [
  'The attached image is the SAME PERSON, already drawn. Keep her identity exactly: the same',
  'face and hairstyle, the same eyes and eyebrows and smile, the same headwrap, the same shirt',
  'and vest and belt and pouches, the same colours, the same drawing style and outline weight.',
  'Someone must look at the two pictures and say "that is her".',
  'WHAT CHANGES: the framing and the pose only.',
  'THE ATTACHED PICTURE IS CROPPED AT THE WAIST. YOURS IS NOT. Draw her ENTIRE body:',
  'head, torso, hips, both legs, and both BOOTS with the FEET fully inside the picture,',
  'standing upright. The bottom edge of your image sits just below the soles of her boots.',
  'If you cut her off at the waist or the thighs the drawing is unusable.',
].join(' ');

function sameOf(subject) {
  if (!subject.same) return null;
  const f = path.join(OUT, subject.same + '.png');
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
}

function stylesOf(subject) {
  if (!subject.style) return [];
  return subject.style
    .map((n) => path.join(OUT, n + '.png'))
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f).toString('base64'));
}

async function generate(subject) {
  // 보스는 가로로 넓적하고 나머지는 거의 정사각형입니다. 비율을 맞춰 달라고
  // 해야 모델이 여백을 덜 만듭니다.
  // 대개는 정사각형이나 4:3 이면 됩니다. 그런데 상점 배경처럼 **아주 가로로 긴**
  // 그림은 4:3 으로 받으면 모델이 그 안에 맞춰 그리고, 그걸 3:1 상자에 넣느라
  // 위아래가 통째로 잘립니다. 그런 것은 항목이 직접 비율을 고릅니다.
  const ratio = subject.ratio || (subject.w / subject.h > 1.2 ? '4:3' : '1:1');
  const ref = refOf(subject);
  const same = sameOf(subject);
  const styles = stylesOf(subject);
  const parts = [];
  if (ref) parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
  if (same) parts.push({ inlineData: { mimeType: 'image/png', data: same } });
  styles.forEach((b) => parts.push({ inlineData: { mimeType: 'image/png', data: b } }));
  const rules = [];
  if (ref) rules.push(SHAPE_RULE);
  if (same) rules.push(subject.sameRule || PERSON_RULE);
  if (styles.length) rules.push(STYLE_RULE);
  parts.push({ text: promptFor(subject) + (rules.length ? '\n\n' + rules.join('\n\n') : '') });
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(MODEL) + ':generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { imageConfig: { aspectRatio: ratio } },
      }),
    });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' · ' + text.slice(0, 300));
  const b64 = pickImage(JSON.parse(text));
  if (!b64) throw new Error('응답에 그림이 없습니다');
  return Buffer.from(b64, 'base64');
}

// ── 마젠타를 걷어내고, 재서 자르고, 상자에 맞춰 넣기 ────────
// 이 셋을 브라우저 canvas 안에서 한 번에 합니다.
async function keyOut(oven, png, subject) {
  return oven.evaluate(async ({ b64, w, h, scale, chroma, tol, anchor, fit, keep, tile, tall }) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error('못 읽었습니다'));
      img.src = 'data:image/png;base64,' + b64;
    });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    if (keep) {
      // 배경을 안 지웁니다. 통째로 상자에 늘려 넣고, 필요하면 거울로 이어 붙입니다.
      const bw = w * scale, bh = h * scale;
      const out = document.createElement('canvas');
      out.width = bw; out.height = bh;
      const octx = out.getContext('2d');
      octx.imageSmoothingQuality = 'high';
      if (tile === 'mirror') {
        // 위 절반을 그리고, 그 아래에 세로로 뒤집어 붙입니다. 그러면 타일의
        // 맨 윗줄과 맨 아랫줄이 같은 줄이 되어 세로로 반드시 이어집니다.
        octx.drawImage(c, 0, 0, c.width, c.height, 0, 0, bw, bh / 2);
        octx.save();
        octx.translate(0, bh);
        octx.scale(1, -1);
        octx.drawImage(c, 0, 0, c.width, c.height, 0, 0, bw, bh / 2);
        octx.restore();
      } else {
        octx.drawImage(c, 0, 0, c.width, c.height, 0, 0, bw, bh);
      }
      return { url: out.toDataURL('image/png'), src: { w: img.width, h: img.height },
               trimmed: { w: img.width, h: img.height }, fill: 100 };
    }

    // 1. 배경 걷어내기. 거리에 따라 가장자리를 부드럽게 깎아야 마젠타 테가
    //    남지 않습니다 — 딱 잘라 지우면 반투명 경계에 분홍 실이 생깁니다.
    let kept = 0;
    for (let i = 0; i < p.length; i += 4) {
      const dr = p[i] - chroma[0], dg = p[i + 1] - chroma[1], db = p[i + 2] - chroma[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < tol) { p[i + 3] = 0; }
      else if (dist < tol * 1.7) {
        p[i + 3] = Math.round(255 * ((dist - tol) / (tol * 0.7)));
        // 남은 마젠타 기운을 뺍니다 (초록을 올려 회색 쪽으로)
        p[i + 1] = Math.max(p[i + 1], Math.min(p[i], p[i + 2]));
        kept++;
      } else kept++;
    }
    ctx.putImageData(d, 0, 0);
    if (!kept) return { error: '전부 배경으로 지워졌습니다' };

    // 2. 남은 것의 실제 경계 재기
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (p[(y * c.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { error: '남은 것이 없습니다' };
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1;

    // 3. 목표 상자에 맞춰 넣기. 비율은 유지합니다 — 늘리면 사람이 뚱뚱해집니다.
    const bw = w * scale, bh = h * scale;
    // fit:'stretch' 는 비율을 버리고 상자를 꽉 채웁니다. 결이 길이 방향으로
    // 고른 띠(발판)에만 씁니다 — 사람에게 쓰면 뚱뚱해집니다.
    //
    // `tall` 은 **상자를 꽉 채우지 말라**는 뜻입니다 (0.62 면 높이의 62%).
    // 배경처럼 옆에 사람이 같이 서는 그림에 씁니다 — 안 그러면 모델이 아무리
    // 작게 그려도 여기서 상자 높이에 맞춰 늘려 버려서, 수레가 사람 키의 세 배가
    // 됩니다. 실제로 두 번 그렇게 나왔고, 프롬프트로는 못 고칩니다.
    const k = fit === 'stretch' ? null
      : (tall ? (bh * tall) / sh : Math.min(bw / sw, bh / sh));
    const dw = k === null ? bw : Math.round(sw * k);
    const dh = k === null ? bh : Math.round(sh * k);
    const dx = Math.round((bw - dw) / 2);
    // 사람은 발이 바닥에 닿아야 합니다 (ART.md 2절)
    const dy = anchor === 'bottom' ? bh - dh : Math.round((bh - dh) / 2);

    const out = document.createElement('canvas');
    out.width = bw; out.height = bh;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(c, x0, y0, sw, sh, dx, dy, dw, dh);
    return {
      url: out.toDataURL('image/png'),
      src: { w: img.width, h: img.height }, trimmed: { w: sw, h: sh },
      fill: Math.round((dw * dh) / (bw * bh) * 100),
    };
  }, { b64: png.toString('base64'), w: subject.w, h: subject.h,
       // 마젠타를 걷는 범위. 기본은 78 인데, 따뜻한 빛무리가 있는 그림은
       // 그 언저리가 분홍으로 남습니다 — 그런 항목만 넓혀 씁니다.
       scale: subject.scale || BAKE_SCALE, chroma: CHROMA, tol: subject.tol || TOLERANCE,
       anchor: subject.anchor || 'center',
       fit: subject.fit || 'contain', keep: subject.bg === 'none' || subject.bg === 'opaque',
       tile: subject.tile || 'none', tall: subject.tall || 0 });
}

(async () => {
  // ── --prompt — 열쇠 없이 주문서만 봅니다 ────────────────
  // 그림은 열쇠가 있는 자리에서 뽑지만, **무엇을 시킬지는 여기 적혀 있습니다.**
  // 열쇠가 없는 자리에서도 이 글을 꺼내 다른 도구에 그대로 붙일 수 있어야
  // 합니다 (gen-story.js 와 같은 규칙).
  if (process.argv.includes('--prompt')) {
    const pick = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    const list = !pick.length ? SUBJECTS
      : SUBJECTS.filter((x) => pick.includes(x.name) || pick.includes(x.group));
    list.forEach((x) => {
      console.log('── ' + x.name + '  ' + x.w + '×' + x.h +
        ' (그림은 ' + (x.w * (x.scale || BAKE_SCALE)) + '×' +
        (x.h * (x.scale || BAKE_SCALE)) + ' 로 받습니다)');
      console.log(promptFor(x));
      console.log();
    });
    return;
  }
  if (!KEY) { console.error('GEMINI_API_KEY 가 없습니다'); process.exit(1); }
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todo = !args.length ? SUBJECTS
    : SUBJECTS.filter((s) => args.includes(s.name) || args.includes(s.group));
  if (!todo.length) {
    console.error('그런 것이 없습니다. 이름이나 무리를 주세요 — ' + GROUPS.join(' · '));
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const oven = await browser.newPage();
  await oven.setContent('<html></html>');

  for (const s of todo) {
    process.stdout.write(`${s.name}  ${s.w}×${s.h} … `);
    try {
      const png = await generate(s);
      fs.writeFileSync(path.join(RAW, s.name + '.png'), png);   // 원본을 남깁니다
      const cut = await keyOut(oven, png, s);
      if (cut.error) { console.log('배경 제거 실패 — ' + cut.error); continue; }
      const body = cut.url.slice(cut.url.indexOf(',') + 1);
      fs.writeFileSync(path.join(OUT, s.name + '.png'), Buffer.from(body, 'base64'));
      const thin = cut.fill < 55 ? `  ← 상자를 ${cut.fill}% 밖에 못 채웠습니다` : '';
      console.log(`받음 ${cut.src.w}×${cut.src.h} → 잘라서 ${cut.trimmed.w}×${cut.trimmed.h} ` +
                  // 배수를 항목이 따로 정할 수 있으므로(shop-keeper 는 1배)
                  // 여기서도 그 값을 써야 합니다. BAKE_SCALE 을 박아 두었더니
                  // 실제로는 152×192 로 나온 것을 608×768 이라고 찍었습니다.
                  `→ ${s.w * (s.scale || BAKE_SCALE)}×${s.h * (s.scale || BAKE_SCALE)}${thin}`);
    } catch (e) {
      console.log('실패 — ' + e.message);
    }
  }

  await browser.close();
  console.log('\n원본은 shots/sprite-raw/ 에 남겨 뒀습니다 (배경이 깨끗한지 볼 때 씁니다).');
  console.log('나란히 보려면: CHROME_PATH=... node render-art.js  (미리보기만 다시 그립니다)');
})();
