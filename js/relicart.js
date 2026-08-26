// 유물 그림 서른다섯 장.
//
// 예전에는 유니코드 기호였습니다 (≋ ◇ ❦ ☉ …). 기호는 무엇인지 알려 주기는
// 하는데, 글꼴마다 모양이 다르고 없는 글자는 네모로 뜨고, 무엇보다 **갖고
// 싶게 만들지 못합니다** — 무기 아이콘을 기호에서 그림으로 바꾼 것과 같은
// 까닭입니다 (js/textures.js 의 ICON 위에 적어 둔 글).
//
// 무기 그림과 같은 규칙을 그대로 씁니다: 48px 판, 어두운 외곽선(ICON.stroke),
// 덩어리마다 세 단(어두운 면 · 바탕 · 밝은 면). 그래서 유물 카드와 무기 칸이
// 나란히 서도 한 벌로 보입니다.
//
// 색은 유물마다 다릅니다. 서른 장이 한 화면(유물 도감)에 세로로 늘어서므로,
// 모양만으로는 훑을 때 구분이 안 됩니다. 결마다 색을 묶어 두었습니다 —
// 오르는 것은 하늘빛, 아는 것은 보랏빛, 때리는 것은 붉은빛, 버티는 것은
// 쇠빛, 버는 것은 금빛.
//
// 손으로 그린 그림이 오면 이 파일만 걷어내고 load.image() 로 바꾸면 됩니다
// (js/textures.js 맨 위와 같은 약속). 키는 `relic-<열쇠>` 입니다.

const RELIC_ART_SIZE = 48;

// 세 단으로 칠합니다 — 바탕, 어두운 면, 밝은 면.
function rTone(color) {
  return { base: color, dark: iconShade(color, 0.62), lit: iconShade(color, 1.35) };
}

// 이 덩어리는 이 색으로 (외곽선은 늘 어둡습니다).
function rFill(g, color) {
  g.fillStyle(color, 1);
  g.lineStyle(ICON.weight, ICON.stroke, 1);
}

// 선만. 굵기를 배수로 줍니다.
function rLine(g, color, k) {
  g.lineStyle(ICON.weight * (k || 1), color, 1);
}

// 둥근 덩어리 하나 (외곽선까지).
function rBlob(g, x, y, r, color) {
  rFill(g, color);
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
}

// ── 자주 쓰는 밑그림 ─────────────────────────────────────

// 방패. 가시 갑옷·반사 갑옷·강철 살갗이 나눠 씁니다.
function rShield(g, color, cx, top, w, h) {
  const t = rTone(color);
  rFill(g, t.base);
  iconPoly(g, [
    [cx - w / 2, top], [cx + w / 2, top],
    [cx + w / 2, top + h * 0.55], [cx, top + h], [cx - w / 2, top + h * 0.55],
  ]);
  // 왼쪽 절반을 어둡게 — 빛이 오른쪽에서 옵니다.
  g.fillStyle(t.dark, 1);
  g.fillTriangle(cx - w / 2, top + 1, cx, top + 1, cx, top + h - 2);
  g.fillStyle(t.lit, 0.9);
  g.fillTriangle(cx + 2, top + 3, cx + w / 2 - 2, top + 3, cx + 2, top + h * 0.5);
}

// 기름병. 기름 셋이 나눠 씁니다 — 몸통은 같고 안에 든 것만 다릅니다.
function rFlask(g, color, cx, cy) {
  const t = rTone(color);
  rFill(g, 0x9fb4cc);
  // 목
  g.fillRect(cx - 3, cy - 16, 6, 6);
  g.strokeRect ? null : null;
  rFill(g, t.base);
  iconPoly(g, [
    [cx - 4, cy - 11], [cx + 4, cy - 11],
    [cx + 10, cy + 6], [cx + 6, cy + 13], [cx - 6, cy + 13], [cx - 10, cy + 6],
  ]);
  g.fillStyle(t.dark, 1);
  g.fillTriangle(cx - 9, cy + 5, cx - 4, cy + 13, cx - 6, cy - 2);
  g.fillStyle(ICON.shine, 0.55);
  g.fillEllipse(cx + 4, cy + 2, 3, 6);
  // 마개
  rFill(g, ICON.wood);
  g.fillRoundedRect(cx - 5, cy - 20, 10, 6, 2);
}

// 부츠. 바람 각반·로켓장화가 나눠 씁니다.
//
// 처음에는 종아리가 10px 밖에 안 되어 발끝만 튀어나온 **「L」자**로 보였습니다.
// 신이라는 것이 읽히려면 종아리가 두툼하고, 발등이 둥글고, 굽이 짙어야 합니다.
function rBoot(g, color, cx, cy) {
  const t = rTone(color);
  rFill(g, t.base);
  iconPoly(g, [
    [cx - 8, cy - 15], [cx + 7, cy - 15], [cx + 7, cy + 2],
    [cx + 15, cy + 5], [cx + 16, cy + 11], [cx - 8, cy + 11],
  ]);
  // 발끝은 둥글게 — 각지면 신이 아니라 상자로 보입니다.
  g.fillCircle(cx + 12, cy + 6, 5);
  g.strokeCircle(cx + 12, cy + 6, 5);
  // 굽
  rFill(g, iconShade(color, 0.45));
  g.fillRoundedRect(cx - 9, cy + 9, 27, 5, 2);
  // 목깃
  rFill(g, t.lit);
  g.fillRoundedRect(cx - 9, cy - 17, 17, 6, 2);
}

// 심장. 두 번째 심장·위기는 기회다가 나눠 씁니다.
function rHeart(g, color, cx, cy, s) {
  const t = rTone(color);
  rFill(g, t.base);
  g.fillCircle(cx - s * 0.45, cy - s * 0.25, s * 0.5);
  g.fillCircle(cx + s * 0.45, cy - s * 0.25, s * 0.5);
  g.fillTriangle(cx - s * 0.92, cy - s * 0.02, cx + s * 0.92, cy - s * 0.02, cx, cy + s);
  g.fillStyle(t.lit, 0.8);
  g.fillCircle(cx - s * 0.45, cy - s * 0.35, s * 0.22);
}

// 코인. 여럿이 나눠 씁니다.
function rCoin(g, x, y, r) {
  rFill(g, ICON.gold);
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
  g.fillStyle(ICON.goldLit, 1);
  g.fillCircle(x - r * 0.28, y - r * 0.28, r * 0.34);
}

// ── 서른다섯 장 ──────────────────────────────────────────────
// 그리는 자리는 48×48, 한가운데가 (24, 24) 입니다.
const RELIC_ART = {
  // ── 기존 아홉 ─────────────────────────────────────────
  // 파동검 — 칼이 왼쪽에 서고, 벤 쪽으로 파동이 번져 나갑니다.
  // 처음에는 칼을 한가운데 두고 파동을 양옆으로 둘렀더니 **전파 표시**처럼
  // 보였습니다. 파동은 한쪽으로만 나가야 「휘두른 쪽으로 간다」가 읽힙니다.
  waveblade: (g) => {
    rFill(g, 0xc3d4e4);
    iconPoly(g, [[13, 4], [18, 9], [18, 30], [13, 34], [8, 30], [8, 9]]);
    rFill(g, ICON.gold);
    g.fillRect(5, 30, 16, 4);
    rFill(g, ICON.grip);
    g.fillRoundedRect(10, 34, 6, 9, 2);
    rLine(g, 0x81d4fa, 1.6);
    [10, 17, 24].forEach((d) => {
      g.beginPath();
      g.arc(19, 20, d, Math.PI * 1.72, Math.PI * 0.28, false);
      g.strokePath();
    });
  },

  // 반사 갑옷 — 방패에 화살이 맞고 튕겨 나갑니다.
  mirrorplate: (g) => {
    rShield(g, 0x90a4ae, 22, 10, 26, 30);
    rLine(g, 0xb3e5fc, 1.2);
    g.lineBetween(34, 8, 26, 18);   // 날아든 것
    g.lineBetween(26, 18, 40, 22);  // 튕겨 나간 것
    rFill(g, 0xb3e5fc);
    g.fillTriangle(40, 22, 34, 20, 36, 26);
  },

  // 흡혈 망토 — 망토 자락과 떨어지는 핏방울.
  bloodcloak: (g) => {
    const t = rTone(0x8e2b3a);
    rFill(g, t.base);
    iconPoly(g, [[24, 6], [37, 14], [33, 38], [24, 32], [15, 38], [11, 14]]);
    g.fillStyle(t.dark, 1);
    g.fillTriangle(11, 14, 24, 8, 24, 32);
    rFill(g, 0xd4af37);
    g.fillRoundedRect(19, 5, 10, 5, 2);
    rFill(g, 0xe53935);
    g.fillCircle(24, 40, 4);
    g.fillTriangle(21, 39, 27, 39, 24, 32);
  },

  // 가시 갑옷 — 방패 둘레로 가시가 섰습니다.
  thornmail: (g) => {
    rFill(g, 0xbdbdbd);
    [[10, 16], [10, 28], [38, 16], [38, 28]].forEach(([x, y], i) => {
      const d = x < 24 ? -7 : 7;
      g.fillTriangle(x, y - 4, x, y + 4, x + d, y);
    });
    rShield(g, 0x6d7f8b, 24, 10, 24, 29);
    rFill(g, 0xe0e0e0);
    g.fillTriangle(24, 4, 21, 12, 27, 12);
  },

  // 바람 각반 — 부츠 뒤로 바람 자국.
  swiftboots: (g) => {
    rBoot(g, 0x66bb6a, 26, 22);
    rLine(g, 0xa5d6a7, 1.2);
    g.lineBetween(6, 12, 16, 12);
    g.lineBetween(4, 20, 14, 20);
    g.lineBetween(7, 28, 15, 28);
  },

  // 도둑의 주머니 — 코인이 넘칩니다.
  coinpurse: (g) => {
    const t = rTone(0x6d4c41);
    rFill(g, t.base);
    iconPoly(g, [[14, 18], [34, 18], [39, 34], [32, 42], [16, 42], [9, 34]]);
    g.fillStyle(t.dark, 1);
    g.fillTriangle(9, 34, 16, 20, 16, 42);
    rFill(g, ICON.wood);
    g.fillRect(13, 14, 22, 5);
    rCoin(g, 20, 10, 6);
    rCoin(g, 31, 12, 5);
  },

  // 먼 그림자 검 — 칼 하나와, 그보다 길게 뻗은 그림자.
  // 그림자가 본체보다 **길고 옅어야** 「멀리 닿지만 끝이 무디다」가 보입니다.
  farblade: (g) => {
    g.fillStyle(0x7e57c2, 0.3);
    iconPoly(g, [[31, 1], [36, 7], [36, 31], [26, 31], [26, 7]]);
    rFill(g, 0xb39ddb);
    iconPoly(g, [[18, 9], [23, 14], [23, 32], [13, 32], [13, 14]]);
    rFill(g, ICON.gold);
    g.fillRect(9, 32, 18, 4);
    rFill(g, ICON.grip);
    g.fillRoundedRect(15, 36, 6, 9, 2);
  },

  // 메아리 활 — 활 하나와, 그 뒤로 겹쳐 남는 메아리 둘.
  // 활대는 두껍고 시위는 가늘어야 활로 보입니다. 처음에는 둘이 같은 굵기라
  // 괄호 두 짝처럼 보였습니다.
  echobow: (g) => {
    // 뒤에 남는 메아리 — 같은 활을 옅게 두 번.
    [[10, 0.3], [15, 0.16]].forEach(([dx, a]) => {
      g.lineStyle(3, 0xffe082, a);
      g.beginPath();
      g.arc(30 - dx, 24, 16, Math.PI * 0.58, Math.PI * 1.42, false);
      g.strokePath();
    });
    rLine(g, 0x6d4c41, 3.2);
    g.beginPath();
    g.arc(30, 24, 16, Math.PI * 0.58, Math.PI * 1.42, false);
    g.strokePath();
    rLine(g, 0xd7ccc8, 0.7);
    g.lineBetween(21, 10, 21, 38);
    rFill(g, 0xc3d4e4);
    g.fillRect(22, 23, 14, 2);
    g.fillTriangle(43, 24, 35, 20, 35, 28);
  },

  // 고블린의 장갑 — 손바닥과 손가락 넷, 엄지는 옆으로. 훔친 코인이 하나.
  // 손가락이 4px 짜리 막대 셋이었을 때는 초록 덩어리로만 보였습니다.
  goblinglove: (g) => {
    const t = rTone(0x558b2f);
    rFill(g, t.base);
    g.fillRoundedRect(13, 19, 21, 19, 5);   // 손바닥
    [14, 20, 26].forEach((x) => { g.fillRoundedRect(x, 9, 6, 12, 3); });
    rFill(g, t.base);
    g.fillRoundedRect(31, 21, 9, 7, 3);     // 엄지
    g.fillStyle(t.dark, 1);
    g.fillRect(14, 31, 19, 4);              // 손금 그늘
    rFill(g, ICON.wood);
    g.fillRoundedRect(12, 37, 23, 6, 2);    // 손목 띠
    rCoin(g, 35, 11, 7);
  },

  // ── 오르는 것 (하늘빛) ────────────────────────────────
  // 투명망토 — 자락이 점선입니다. 있는데 안 보이는 것.
  // 투명망토 — 망토 꼴은 그대로인데 자락이 점선입니다. 있는데 안 보이는 것.
  // 점선 토막이 촘촘하면 그냥 실선으로 보여서, 그릴 만큼과 건너뛸 만큼을
  // 반반으로 크게 끊습니다.
  invisijump: (g) => {
    const pts = [[24, 5], [38, 15], [35, 41], [24, 35], [13, 41], [10, 15], [24, 5]];
    g.fillStyle(0x81d4fa, 0.18);
    iconPoly(g, pts.slice(0, 6));
    rLine(g, 0x81d4fa, 1.5);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      for (let k = 0; k < 0.99; k += 0.5) {
        g.lineBetween(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k,
          x1 + (x2 - x1) * (k + 0.25), y1 + (y2 - y1) * (k + 0.25));
      }
    }
    // 여밈만은 또렷하게 — 여기 하나가 있어야 「망토」로 붙잡힙니다.
    rFill(g, 0xb3e5fc);
    g.fillCircle(24, 11, 4);
  },

  // 탑은 둥글다 — 탑 하나와, 그 둘레를 도는 화살.
  // 탑을 먼저 세우고 화살을 그 **뒤로** 돌립니다. 화살이 앞을 가로지르면
  // 무엇을 도는 것인지가 안 보입니다.
  roundtower: (g) => {
    const t = rTone(0x78909c);
    rFill(g, t.base);
    iconPoly(g, [[17, 42], [31, 42], [29, 14], [19, 14]]);
    g.fillStyle(t.dark, 1);
    g.fillTriangle(17, 42, 24, 14, 24, 42);
    g.fillStyle(0x263238, 1);
    g.fillRect(22, 22, 4, 7);           // 창
    rFill(g, 0xb0bec5);
    g.fillRect(15, 9, 18, 6);           // 꼭대기 난간
    // 둘레를 도는 화살 — 위로 넘어가는 반 바퀴만 보입니다.
    rLine(g, 0x4fc3f7, 2);
    g.beginPath();
    g.arc(24, 22, 19, Math.PI * 1.08, Math.PI * 1.92, false);
    g.strokePath();
    rFill(g, 0x4fc3f7);
    g.fillTriangle(45, 22, 37, 18, 37, 26);
  },

  // 고요한 걸음 — 초승달 아래 발자국.
  quietwake: (g) => {
    rFill(g, 0xfff59d);
    g.fillCircle(22, 17, 11);
    g.fillStyle(0x0f1626, 1);
    g.fillCircle(27, 14, 10);
    rFill(g, 0x90a4ae);
    g.fillEllipse(20, 36, 9, 7);
    g.fillEllipse(30, 40, 7, 5);
  },

  // 로켓장화 — 밑에서 불이 뿜습니다.
  rocketboots: (g) => {
    rBoot(g, 0xb0bec5, 24, 18);
    rFill(g, 0xff7043);
    g.fillTriangle(19, 32, 29, 32, 24, 44);
    rFill(g, 0xffd54f);
    g.fillTriangle(21, 33, 27, 33, 24, 40);
  },

  // 시간의 모래 — 모래시계.
  sandoftime: (g) => {
    rFill(g, 0x8d6e63);
    g.fillRect(12, 6, 24, 5);
    g.fillRect(12, 37, 24, 5);
    rFill(g, 0xcfd8dc);
    iconPoly(g, [[15, 11], [33, 11], [25, 24], [33, 37], [15, 37], [23, 24]]);
    rFill(g, ICON.gold);
    g.fillTriangle(17, 13, 31, 13, 24, 22);
    g.fillTriangle(17, 35, 31, 35, 24, 29);
    rLine(g, ICON.goldLit, 0.8);
    g.lineBetween(24, 23, 24, 30);
  },

  // ── 아는 것 (보랏빛) ──────────────────────────────────
  // 혜안 — 눈. 천리안과 한 쌍이라 눈으로 그립니다.
  trueeye: (g) => {
    rFill(g, 0xe1bee7);
    iconPoly(g, [[6, 24], [24, 11], [42, 24], [24, 37]]);
    rBlob(g, 24, 24, 8, 0x7e57c2);
    rFill(g, 0x1a1030);
    g.fillCircle(24, 24, 4);
    g.fillStyle(ICON.shine, 0.95);
    g.fillCircle(21, 21, 2);
    // 꿰뚫어 본다는 표 — 위아래로 뻗는 빛.
    rLine(g, 0xce93d8, 1);
    g.lineBetween(24, 4, 24, 8);
    g.lineBetween(24, 40, 24, 44);
  },

  // ── 때리는 것 (붉은빛) ────────────────────────────────
  // 도깨비불 — 큰 불꽃 하나와 곁을 도는 작은 불 둘.
  // 불꽃이 작으면 물방울로 보입니다. 판을 거의 채우고, 도는 것은 궤도 위에.
  willowisp: (g) => {
    rLine(g, 0xce93d8, 0.7);
    g.beginPath();
    g.arc(24, 25, 19, 0, Math.PI * 2, false);
    g.strokePath();
    rFill(g, 0x8e44ad);
    g.fillTriangle(13, 30, 35, 30, 24, 4);
    g.fillCircle(24, 29, 11);
    rFill(g, 0xce93d8);
    g.fillTriangle(18, 30, 30, 30, 24, 14);
    g.fillCircle(24, 29, 6);
    g.fillStyle(0xf3e5f5, 1);
    g.fillCircle(24, 29, 3);
    rBlob(g, 6, 18, 4, 0xe1bee7);
    rBlob(g, 42, 33, 3, 0xe1bee7);
  },

  // 처형인의 표식 — 해골.
  executionermark: (g) => {
    rFill(g, 0xeceff1);
    g.fillCircle(24, 21, 13);
    g.fillRoundedRect(18, 30, 12, 9, 3);
    rFill(g, 0x1a1a24);
    g.fillCircle(19, 20, 4);
    g.fillCircle(29, 20, 4);
    g.fillTriangle(24, 24, 21, 29, 27, 29);
    rLine(g, 0x455a64, 1);
    g.lineBetween(21, 33, 21, 38);
    g.lineBetween(27, 33, 27, 38);
  },

  // 초전박살 — 번개 한 줄기.
  firststrike: (g) => {
    rFill(g, 0xffd54f);
    iconPoly(g, [[27, 4], [13, 26], [22, 26], [18, 44], [35, 20], [25, 20]]);
    g.fillStyle(ICON.shine, 0.7);
    g.fillTriangle(25, 8, 19, 24, 24, 24);
  },

  // 관통하는 기름 — 병 하나와, 그 뒤를 곧게 지나가는 화살.
  // 화살이 병을 비스듬히 가로지르면 둘이 엉켜 보입니다. 가로로 곧게 두고
  // 병은 아래에 내려놓습니다.
  piercingoil: (g) => {
    rLine(g, 0x9e9e9e, 1.6);
    g.lineBetween(3, 12, 38, 12);
    rFill(g, 0xc3d4e4);
    g.fillTriangle(46, 12, 37, 7, 37, 17);
    rFill(g, 0x8d6e63);
    g.fillTriangle(3, 12, 10, 7, 10, 17);
    rFlask(g, 0x8bc34a, 24, 31);
  },

  // 뜨거운 기름 — 병 위로 불.
  hotoil: (g) => {
    rFlask(g, 0xff7043, 24, 28);
    rFill(g, 0xffb74d);
    g.fillTriangle(17, 12, 31, 12, 24, 1);
    rFill(g, 0xffe082);
    g.fillTriangle(20, 12, 28, 12, 24, 5);
  },

  // 차가운 기름 — 병 위로 얼음 결정.
  coldoil: (g) => {
    rFlask(g, 0x4fc3f7, 24, 28);
    rLine(g, 0xb3e5fc, 1.2);
    [0, 60, 120].forEach((deg) => {
      const a = deg * Math.PI / 180;
      g.lineBetween(24 - Math.cos(a) * 9, 8 - Math.sin(a) * 9,
        24 + Math.cos(a) * 9, 8 + Math.sin(a) * 9);
    });
  },

  // ── 버티는 것 (쇠빛) ──────────────────────────────────
  // 두 번째 심장 — 심장 둘, 하나는 뒤에.
  secondheart: (g) => {
    rHeart(g, 0x6d2434, 30, 20, 10);
    rHeart(g, 0xe53935, 20, 25, 12);
  },

  // 강철 살갗 — 비늘이 겹겹이 덮인 살갗.
  // 방패 위에 가는 선만 그었더니 그냥 회색 방패였습니다. 비늘을 **하나씩
  // 채워 넣어야** 「살갗이 쇠로 덮였다」가 보입니다.
  ironskin: (g) => {
    rShield(g, 0x607d8b, 24, 7, 28, 35);
    const t = rTone(0x90a4ae);
    for (let row = 0; row < 4; row++) {
      const y = 13 + row * 7;
      const half = row < 2 ? 2 : 1;      // 아래로 갈수록 좁아집니다
      for (let i = -half; i <= half; i++) {
        const x = 24 + i * 8 + (row % 2 ? 4 : 0);
        if (Math.abs(x - 24) > 13 - row * 2) continue;
        rFill(g, row % 2 ? t.base : t.lit);
        g.beginPath();
        g.arc(x, y, 4.2, Math.PI, 0, false);
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
    }
  },

  // 용 비늘 투구 — 뿔 달린 투구.
  dragonscale: (g) => {
    const t = rTone(0x455a64);
    rFill(g, t.base);
    iconPoly(g, [[12, 40], [12, 20], [24, 8], [36, 20], [36, 40], [30, 40], [30, 26], [18, 26], [18, 40]]);
    g.fillStyle(t.dark, 1);
    g.fillTriangle(12, 20, 24, 9, 24, 40);
    rFill(g, 0x8bc34a);
    g.fillTriangle(10, 18, 2, 8, 14, 12);
    g.fillTriangle(38, 18, 46, 8, 34, 12);
    rFill(g, 0xff7043);
    g.fillRect(19, 20, 10, 4);
  },

  // 흑철갑옷 — 두껍고 무거운 판.
  blackiron: (g) => {
    const t = rTone(0x37474f);
    rFill(g, t.base);
    g.fillRoundedRect(9, 10, 30, 30, 4);
    g.fillStyle(t.dark, 1);
    g.fillRect(10, 26, 28, 13);
    g.fillStyle(t.lit, 0.8);
    g.fillRect(12, 12, 24, 4);
    rLine(g, 0x263238, 1.2);
    g.lineBetween(24, 11, 24, 39);
    g.lineBetween(10, 25, 38, 25);
    rFill(g, ICON.gold);
    [14, 34].forEach((x) => [15, 35].forEach((y) => g.fillCircle(x, y, 2)));
  },

  // 위기는 기회다 — 금 간 심장에서 빛이 납니다.
  crisis: (g) => {
    rFill(g, 0xffd54f);
    [0, 90, 180, 270].forEach((deg) => {
      const a = (deg + 45) * Math.PI / 180;
      g.fillTriangle(24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22,
        24 + Math.cos(a + 0.3) * 13, 24 + Math.sin(a + 0.3) * 13,
        24 + Math.cos(a - 0.3) * 13, 24 + Math.sin(a - 0.3) * 13);
    });
    rHeart(g, 0xe53935, 24, 20, 12);
    rLine(g, 0xfff59d, 1.4);
    g.beginPath();
    g.moveTo(20, 14); g.lineTo(26, 22); g.lineTo(21, 26); g.lineTo(27, 33);
    g.strokePath();
  },

  // ── 버는 것 · 판을 바꾸는 것 (금빛) ───────────────────
  // 황금 손 — 손으로 코인이 끌려옵니다.
  goldhand: (g) => {
    const t = rTone(0xffc94d);
    rFill(g, t.base);
    g.fillRoundedRect(12, 22, 20, 18, 4);
    [14, 19, 24].forEach((x) => { g.fillRoundedRect(x, 15, 4, 9, 2); });
    g.fillRoundedRect(28, 24, 7, 5, 2);
    g.fillStyle(t.dark, 1);
    g.fillRect(13, 34, 18, 5);
    rCoin(g, 38, 12, 5);
    rCoin(g, 9, 12, 4);
    rLine(g, ICON.goldLit, 0.9);
    g.lineBetween(34, 16, 29, 21);
    g.lineBetween(13, 16, 17, 21);
  },

  // 기울어진 저울 — 한쪽으로 기운 저울.
  tiltedscale: (g) => {
    rFill(g, 0x8d6e63);
    g.fillRect(22, 10, 4, 30);
    g.fillRoundedRect(15, 39, 18, 5, 2);
    rLine(g, 0xbcaaa4, 1.3);
    g.lineBetween(8, 16, 40, 12);   // 기운 대
    g.lineBetween(9, 16, 9, 24);
    g.lineBetween(39, 12, 39, 20);
    rFill(g, ICON.gold);
    g.fillTriangle(3, 24, 15, 24, 9, 32);   // 무거운 쪽
    rFill(g, 0xffe9a8);
    g.fillTriangle(34, 20, 44, 20, 39, 26);
  },

  // 보라빛 메달 — 리본 달린 훈장.
  purplemedal: (g) => {
    rFill(g, 0x7e57c2);
    g.fillTriangle(14, 4, 24, 22, 22, 4);
    g.fillTriangle(34, 4, 24, 22, 26, 4);
    rBlob(g, 24, 30, 12, 0xce93d8);
    rFill(g, 0xf3e5f5);
    g.fillTriangle(24, 22, 20, 32, 28, 32);
    g.fillTriangle(24, 38, 20, 28, 28, 28);
  },

  // 거울 조각 — 깨진 조각에 빛이 비칩니다.
  mirrorshard: (g) => {
    const t = rTone(0xb3e5fc);
    rFill(g, t.base);
    iconPoly(g, [[24, 4], [38, 22], [26, 44], [12, 26]]);
    g.fillStyle(t.dark, 1);
    g.fillTriangle(12, 26, 24, 6, 24, 44);
    g.fillStyle(ICON.shine, 0.85);
    g.fillTriangle(26, 12, 34, 22, 27, 24);
    rLine(g, ICON.stroke, 1);
    g.lineBetween(24, 4, 24, 44);
  },

  // ── 다섯의 전용 유물 (직업 색) ────────────────────────
  // 앞의 서른 장은 결마다 색을 묶었지만(오르는 것 하늘빛, 때리는 것 붉은빛…),
  // 이 다섯은 **직업 색을 그대로 씁니다** — 도감을 훑을 때 「이건 내 것」이
  // 색만으로 먼저 읽히게 하려는 것입니다. 권법사 금빛, 곰사냥꾼 잿빛,
  // 사령술사 청록, 마법사 하늘빛, 도굴꾼 연둣빛 (js/classes.js 의 color).

  // 뒷손 — 주먹 하나와, 그 둘레로 끊어져 퍼진 테.
  //
  // 처음에는 온전한 동그라미 둘을 두르고 주먹도 같은 금빛으로 칠했더니,
  // 48px 에서 **훈장**으로 보였습니다 — 테 안에 든 금빛 덩어리. 테를 네
  // 토막으로 끊고(끊긴 테는 동그라미가 아니라 퍼지는 것으로 읽힙니다)
  // 주먹을 한 단 짙게 해서, 눈이 둘을 갈라 볼 수 있게 했습니다.
  backhand: (g) => {
    rLine(g, 0xffe082, 2.0);
    [0, 1, 2, 3].forEach((i) => {
      const a = Math.PI * (0.28 + i * 0.5);
      g.beginPath();
      g.arc(24, 25, 21, a, a + Math.PI * 0.34, false);
      g.strokePath();
    });
    const t = rTone(0xf9a825);
    rFill(g, t.base);
    // 손등이 이쪽을 봅니다 — 뒷손이니까.
    g.fillRoundedRect(13, 19, 22, 15, 4);
    g.strokeRoundedRect(13, 19, 22, 15, 4);
    g.fillStyle(t.dark, 1);
    g.fillRect(14, 29, 20, 4);
    // 손가락 마디 넷 — 사이가 보여야 주먹으로 읽힙니다.
    rFill(g, iconShade(0xf9a825, 1.45));
    [13, 18.5, 24, 29.5].forEach((x) => {
      g.fillRoundedRect(x, 15, 4.5, 7, 2);
      g.strokeRoundedRect(x, 15, 4.5, 7, 2);
    });
    // 엄지.
    rFill(g, t.base);
    g.fillRoundedRect(32, 27, 7, 6, 3);
    g.strokeRoundedRect(32, 27, 7, 6, 3);
  },

  // 사냥꾼의 표식 — 겹친 테 안에 곰 발자국.
  // 테만 있으면 그냥 과녁이고, 발자국만 있으면 그냥 짐승입니다.
  // 「곰이 문 자리에 표가 남는다」는 둘이 겹쳐야 읽힙니다.
  huntmark: (g) => {
    rLine(g, 0xe57373, 1.5);
    g.strokeCircle(24, 24, 21);
    g.strokeCircle(24, 24, 15);
    // 눈금 넷 — 이것이 있어야 그냥 두른 테가 아니라 겨눈 자리로 읽힙니다.
    g.lineBetween(24, 1, 24, 8);
    g.lineBetween(24, 40, 24, 47);
    g.lineBetween(1, 24, 8, 24);
    g.lineBetween(40, 24, 47, 24);
    const t = rTone(0xbcaaa4);
    rFill(g, t.base);
    // 발바닥.
    g.fillEllipse(24, 28, 17, 12);
    g.strokeEllipse(24, 28, 17, 12);
    // 발가락 넷.
    [[16, 19, 3.4], [21, 16, 3.8], [27, 16, 3.8], [32, 19, 3.4]].forEach(([x, y, r]) => {
      g.fillCircle(x, y, r);
      g.strokeCircle(x, y, r);
    });
    g.fillStyle(t.dark, 1);
    g.fillEllipse(20, 31, 7, 5);
  },

  // 썩지 않는 것 — 오래되었는데 금 하나 안 간 뼈.
  //
  // 처음에는 해골로 그렸다가 걷어냈습니다. 도감에 이미 「처형인의 표식」
  // 해골이 있어서 48px 에서 둘을 가를 수가 없었고, 무엇보다 해골은
  // 「죽음」이지 「버팀」이 아닙니다. 금 없는 굵은 뼈 하나를 세우면
  // 둘 다 풀립니다.
  undying: (g) => {
    const t = rTone(0xdcede9);
    rFill(g, t.base);
    g.fillRoundedRect(19, 12, 10, 25, 3);
    g.strokeRoundedRect(19, 12, 10, 25, 3);
    [[19, 10], [29, 10], [19, 39], [29, 39]].forEach(([x, y]) => {
      g.fillCircle(x, y, 6.5);
      g.strokeCircle(x, y, 6.5);
    });
    // 빛은 오른쪽에서 옵니다.
    g.fillStyle(t.dark, 1);
    g.fillRect(20, 13, 4, 23);
    g.fillStyle(ICON.shine, 0.6);
    g.fillEllipse(27, 22, 3, 12);
    // 안 삭았다는 표 — 청록 빛이 양옆을 따라 섭니다.
    rLine(g, 0x4db6ac, 1.6);
    g.lineBetween(11, 17, 11, 31);
    g.lineBetween(37, 17, 37, 31);
    rFill(g, 0x4db6ac);
    g.fillCircle(11, 24, 2.6);
    g.fillCircle(37, 24, 2.6);
  },

  // 마르지 않는 샘물 — 돌테를 넘어 솟는 물. 방울이 위로 튑니다.
  // 아래로 떨어뜨리면 「새는 것」이 되므로 방울은 반드시 올라가야 합니다.
  spring: (g) => {
    const t = rTone(0x4fc3f7);
    // 솟는 물기둥.
    rFill(g, t.lit);
    // 아래로 벌어지면 갓으로 보입니다. 기둥은 거의 곧게 세우고 머리만
    // 둥글게 말아야 「솟는다」가 읽힙니다.
    iconPoly(g, [[21, 9], [27, 9], [29, 26], [19, 26]]);
    g.fillCircle(24, 9, 3.6);
    g.strokeCircle(24, 9, 3.6);
    rFill(g, t.base);
    g.fillEllipse(24, 27, 26, 9);
    g.strokeEllipse(24, 27, 26, 9);
    // 돌테.
    rFill(g, 0x8d9aa8);
    g.fillRoundedRect(9, 30, 30, 8, 3);
    g.strokeRoundedRect(9, 30, 30, 8, 3);
    g.fillStyle(0x6b7783, 1);
    [13, 21, 29].forEach((x) => { g.fillRect(x, 31, 2, 6); });
    // 튀어 오른 방울 셋.
    rFill(g, t.lit);
    [[13, 15, 3], [35, 13, 3.4], [24, 4, 2.6]].forEach(([x, y, r]) => {
      g.fillCircle(x, y, r);
      g.strokeCircle(x, y, r);
    });
    g.fillStyle(ICON.shine, 0.7);
    g.fillEllipse(21, 16, 3, 7);
  },

  // 많이 질수록 — 짐이 그득한 배낭. 옆으로 오르는 갈매기 둘.
  heavier: (g) => {
    const t = rTone(0xd4e157);
    rFill(g, t.base);
    g.fillRoundedRect(11, 15, 26, 26, 5);
    g.strokeRoundedRect(11, 15, 26, 26, 5);
    g.fillStyle(t.dark, 1);
    g.fillRect(12, 33, 24, 7);
    // 덮개.
    rFill(g, iconShade(0xd4e157, 0.78));
    g.fillRoundedRect(9, 14, 30, 11, 4);
    g.strokeRoundedRect(9, 14, 30, 11, 4);
    // 잠금 끈.
    rFill(g, ICON.grip);
    g.fillRoundedRect(21, 22, 6, 8, 2);
    // 그득해서 위로 삐져나온 것들.
    rFill(g, 0x8d6e63);
    g.fillRect(14, 5, 4, 10);
    rFill(g, 0xb0bec5);
    g.fillTriangle(30, 4, 27, 15, 34, 15);
    // 무거울수록 세진다 — 오르는 표.
    rLine(g, 0xf0f4c3, 1.6);
    [30, 37].forEach((y) => {
      g.beginPath();
      g.moveTo(39, y); g.lineTo(43, y - 5); g.lineTo(47, y);
      g.strokePath();
    });
  },
};

// 서른다섯 장을 구워 `relic-<열쇠>` 로 등록합니다.
// 이미 있는 키는 건너뜁니다 — 손으로 그린 그림이 먼저 실려 있으면 그쪽이
// 이깁니다 (js/artset.js 와 같은 약속).
function buildRelicIcons(scene) {
  const g = scene.make.graphics({ add: false });
  RELICS.forEach((relic) => {
    const key = relicIconKey(relic.key);
    if (scene.textures.exists(key)) return;
    const draw = RELIC_ART[relic.key];
    if (!draw) return;
    g.clear();
    draw(g);
    g.generateTexture(key, RELIC_ART_SIZE, RELIC_ART_SIZE);
  });
  g.destroy();
}

function relicIconKey(key) {
  return 'relic-' + key;
}
