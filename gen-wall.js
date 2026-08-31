// 탑 벽과 발판을 그려 냅니다 — art/wall-*.svg · art/plat*.svg
//
//   node gen-wall.js && node bake-art.js
//
// ── 왜 손으로 안 그리고 만들어 내는가 ───────────────────
// 벽 한 장에 돌이 사백 장 넘게 들어갑니다. 하나하나 폭과 색과 깨진 자리가
// 달라야 「단색 무늬」가 아니라 「쌓아 올린 돌」로 보이는데, 그걸 손으로
// 적으면 고칠 수가 없습니다. 켜 높이 하나를 바꾸려고 사백 줄을 다시 쓰게
// 됩니다. 배치는 코드가, 판단은 사람이 합니다.
//
// ── 지켜야 하는 것 셋 ───────────────────────────────────
// 1. 세로로 이어 붙여도 이음매가 없어야 합니다. 벽은 tileSprite 라 960 에서
//    0 으로 감깁니다. 무늬를 전부 0~960 안에 가두고, 켜 높이 48 이 960 을
//    나누어떨어지게 잡았습니다 (960 / 48 = 20 켜). 사슬 고리는 24 (= 40 개).
// 2. 앞의 것을 잡아먹지 않아야 합니다. 값을 #0b1024 ~ #46548d 안에 가둬서
//    주인공과 적이 언제나 배경보다 밝게 남습니다. 여기서 대비를 올리면
//    그림이 예뻐지고 게임은 안 보이게 됩니다.
// 3. 발판은 140×20 을 **1배로** 굽습니다 (js/artset.js). 게임 캔버스가
//    540×960 이고 Scale.FIT 으로 늘려 보여 주는 것이라, 크게 구워 봐야
//    프레임버퍼에서 도로 줄어듭니다 — 세로 스무 줄이 가진 전부입니다.
//    그래서 발판에 넣은 것은 넷뿐입니다: 밟는 윗면 · 두께 · 낡음 · 밑그늘.
//
// ── 왜 회화풍인가 ───────────────────────────────────────
// 벡터풍(돌마다 단색 + 윗면 빛)과 회화풍(돌마다 빛이 왼위에서 오른아래로
// 흐름)을 둘 다 그려서 판 위에 얹어 견줬습니다 (wall-try.js). 회화풍이
// 이겼습니다 — 단색 면이 하나도 없어지는 것이 「사실적」의 알맹이였습니다.
const fs = require('fs');
const path = require('path');

const ART = path.join(__dirname, 'art');
const W = 500, H = 960, COURSE = 48, ROWS = H / COURSE;
const LINK = 24;                        // 사슬 고리 한 칸. 960 / 24 = 40

// 씨앗 없는 난수를 안 씁니다 — 돌 하나하나가 매번 달라지면 고칠 수가 없습니다.
function rnd(a, b) {
  let t = (a * 374761393 + b * 668265263) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}
const pick = (arr, a, b) => arr[Math.floor(rnd(a, b) * arr.length) % arr.length];
const n = (v) => Math.round(v * 100) / 100;

// ── 돌 쌓기 ─────────────────────────────────────────────
// 켜마다 첫 돌의 폭을 달리해서 세로 이음매를 어긋냅니다. 벽돌이 격자로 줄
// 맞춰 서면 그 순간 「무늬」로 보이고 돌로 안 보입니다.
function courses() {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const y = r * COURSE;
    const blocks = [];
    let x = 0, i = 0;
    while (x < W) {
      let w = 74 + Math.round(rnd(r * 37 + i, 11) * 58);   // 74~132
      if (i === 0) w = Math.round(w * (0.42 + rnd(r, 3) * 0.62));
      if (x + w > W) w = W - x;
      if (w < 30 && blocks.length) { blocks[blocks.length - 1].w += w; break; }
      blocks.push({ x, y, w, h: COURSE, r, i });
      x += w; i++;
    }
    rows.push(blocks);
  }
  return rows;
}

const M = 1.4;   // 줄눈 절반. 위아래로 M 씩 물러나면 이음매가 2.8 이 됩니다.
                 // 감기는 자리(960↔0)도 1.4 + 1.4 이라 다른 이음매와 같습니다
const inner = (b) => ({ x: b.x + M, y: b.y + M, w: b.w - M * 2, h: b.h - M * 2 });

// ── 뒤 · 돌벽 ───────────────────────────────────────────
// 가장 느리게(0.55배) 흐릅니다. 멀리 있는 것은 천천히 지나갑니다.
function wallFar() {
  const rows = courses();
  const p = [`<rect width="${W}" height="${H}" fill="#101731"/>`];
  const tone = ['#1b2442', '#1d2748', '#19213e', '#202a51', '#1c2445'];

  for (const row of rows) for (const b of row) {
    const q = inner(b);
    p.push(`<rect x="${n(q.x)}" y="${n(q.y)}" width="${n(q.w)}" height="${n(q.h)}" fill="${pick(tone, b.r * 91 + b.i, 7)}"/>`);
    // 돌 하나마다 왼위에서 오른아래로 빛이 흐릅니다. objectBoundingBox 라
    // 그러데이션 하나를 사백 장이 나눠 씁니다 — 이것 하나가 회화풍의 전부입니다
    p.push(`<rect x="${n(q.x)}" y="${n(q.y)}" width="${n(q.w)}" height="${n(q.h)}" fill="url(#lit)"/>`);
    // 윗면 빛 · 아랫면 그늘. 빛은 위에서 옵니다 — 스무 켜가 같은 규칙입니다
    p.push(`<rect x="${n(q.x)}" y="${n(q.y)}" width="${n(q.w)}" height="1.6" fill="#31407a" opacity=".5"/>`);
    p.push(`<rect x="${n(q.x)}" y="${n(q.y + q.h - 1.6)}" width="${n(q.w)}" height="1.6" fill="#0b1024" opacity=".6"/>`);

    // 깨진 모서리 — 넷 중 하나꼴. 돌은 반듯하지 않습니다
    if (rnd(b.r * 13 + b.i, 21) > 0.72) {
      const s = 4 + rnd(b.r + b.i, 5) * 7;
      const left = rnd(b.r, b.i + 2) > 0.5;
      const x0 = left ? q.x : q.x + q.w;
      const d = left ? 1 : -1;
      p.push(`<path d="M${n(x0)} ${n(q.y)} l${n(d * s)} 0 l${n(-d * s)} ${n(s)} z" fill="#101731" opacity=".85"/>`);
    }
    // 금 — 돌 하나 안에서 끝납니다. 켜를 가로지르면 벽이 무너지는 것으로 읽힙니다
    if (rnd(b.r * 29 + b.i, 33) > 0.82) {
      const cx = q.x + q.w * (0.25 + rnd(b.r, b.i) * 0.5);
      p.push(`<path d="M${n(cx)} ${n(q.y + 4)} l${n(-2 + rnd(b.i, b.r) * 5)} ${n(q.h * 0.4)} `
        + `l${n(-1 + rnd(b.r, 9) * 4)} ${n(q.h * 0.3)}" fill="none" stroke="#0d1428" stroke-width="1.1" opacity=".8"/>`);
    }
  }

  // 물때 — 줄눈에서 스며 나와 아래로 흐른 자국. 이 탑은 물이 샙니다.
  // **이끼는 안 씁니다.** 이 탑의 것은 전부 말라 있습니다 (js/decor.js).
  for (let i = 0; i < 14; i++) {
    p.push(`<rect x="${n(20 + rnd(i, 51) * (W - 60))}" `
      + `y="${Math.floor(rnd(i, 52) * (ROWS - 3)) * COURSE + COURSE}" `
      + `width="${n(6 + rnd(i, 54) * 16)}" height="${n(40 + rnd(i, 53) * 110)}" `
      + `fill="url(#drip)" opacity=".55"/>`);
  }

  return svg(W, H,
    `<linearGradient id="drip" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0%" stop-color="#0a0f22" stop-opacity=".85"/>`
    + `<stop offset="70%" stop-color="#0a0f22" stop-opacity=".35"/>`
    + `<stop offset="100%" stop-color="#0a0f22" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="lit" x1="0" y1="0" x2="0.7" y2="1">`
    + `<stop offset="0%" stop-color="#4a5c9e" stop-opacity=".22"/>`
    + `<stop offset="45%" stop-color="#4a5c9e" stop-opacity="0"/>`
    + `<stop offset="100%" stop-color="#070b18" stop-opacity=".35"/></linearGradient>`,
    p.join(''), 2, '탑 안쪽 벽 · 뒤 (돌). 0.55배로 흐릅니다');
}

// ── 중간 · 기둥과 벽감 ──────────────────────────────────
// 이 겹만 카메라와 **같은 속도**로 흐릅니다. 발판 바로 뒤에 붙어 있는 것이라
// 오르는 거리와 어긋나면 안 됩니다.
function wallMid() {
  const p = [];
  [0, W - 34].forEach((x0, side) => {
    p.push(`<rect x="${x0}" y="0" width="34" height="${H}" fill="url(#col)"/>`);
    for (let y = 0; y < H; y += 96) {
      p.push(`<rect x="${x0}" y="${y + 42}" width="34" height="10" fill="#161e3c"/>`);
      p.push(`<rect x="${x0}" y="${y + 42}" width="34" height="2" fill="#33417a" opacity=".75"/>`);
    }
    // 기둥의 안쪽 모서리. 밝은 줄과 어두운 줄이 붙어 있어야 기둥이 앞으로 섭니다
    const ex = side === 0 ? x0 + 34 : x0;
    p.push(`<rect x="${ex - (side === 0 ? 2.4 : 0)}" y="0" width="2.4" height="${H}" fill="#3a4986" opacity=".5"/>`);
    p.push(`<rect x="${side === 0 ? ex : ex - 3}" y="0" width="3" height="${H}" fill="#0b1024" opacity=".8"/>`);
  });

  // 벽감 둘 — 480 마다. 먼 데서 타는 등불 하나가 탑을 사람 사는 곳으로 만듭니다
  [196, 676].forEach((cy) => {
    p.push(`<rect x="222" y="${cy - 46}" width="56" height="76" rx="28" fill="#141b36"/>`
      + `<rect x="228" y="${cy - 40}" width="44" height="64" rx="22" fill="#0e1428"/>`
      + `<circle cx="250" cy="${cy}" r="88" fill="url(#sconce)"/>`
      + `<ellipse cx="250" cy="${cy}" rx="5" ry="8.5" fill="#ffb74d" opacity=".55"/>`
      + `<ellipse cx="250" cy="${cy - 2}" rx="2.4" ry="4.6" fill="#fff3c4" opacity=".7"/>`
      + `<rect x="243" y="${cy + 8}" width="14" height="10" rx="2" fill="#2a3660" opacity=".8"/>`);
  });

  return svg(W, H,
    `<radialGradient id="sconce" cx="50%" cy="50%" r="50%">`
    + `<stop offset="0%" stop-color="#ffb74d" stop-opacity=".34"/>`
    + `<stop offset="50%" stop-color="#ff9800" stop-opacity=".11"/>`
    + `<stop offset="100%" stop-color="#ff9800" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="col" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0%" stop-color="#141c3a"/><stop offset="55%" stop-color="#26325e"/>`
    + `<stop offset="100%" stop-color="#182047"/></linearGradient>`,
    p.join(''), 2, '탑 안쪽 벽 · 중간 (기둥과 벽감). 카메라와 같은 속도로 흐릅니다');
}

// ── 앞 · 쇠사슬 ─────────────────────────────────────────
// 가장 빠르게(1.45배) 흐릅니다. **가운데는 비웁니다** — 앞에 뭘 두면 발판과
// 적을 가립니다. 좌우 끝, 사람이 안 서는 자리에만 걸어 둡니다.
function wallNear() {
  const p = [];
  [44, W - 44].forEach((x) => {
    for (let y = 0; y < H; y += LINK) {
      // 진짜 사슬은 고리가 한 칸씩 90도 돌아갑니다. 세로만 늘어놓으면
      // 구슬을 꿴 줄로 보입니다 — 이 한 가지가 사슬로 읽히느냐를 가릅니다
      const cy = y + LINK / 2;
      if ((y / LINK) % 2 === 0) {
        p.push(`<ellipse cx="${x}" cy="${cy}" rx="4.2" ry="10" fill="none" stroke="#080d1e" stroke-width="3.6"/>`
          + `<path d="M${x - 3.6} ${cy - 6} a4.2 10 0 0 0 0 12" fill="none" stroke="#46548d" stroke-width="1.2" opacity=".5"/>`);
      } else {
        p.push(`<ellipse cx="${x}" cy="${cy}" rx="7.4" ry="6" fill="none" stroke="#080d1e" stroke-width="3.2"/>`
          + `<path d="M${x - 6.6} ${cy - 2.4} a7.4 6 0 0 1 3 -3" fill="none" stroke="#46548d" stroke-width="1.2" opacity=".45"/>`);
      }
    }
    // 사슬을 매단 자리 — 480 마다. 사슬만 있으면 어디에 걸렸는지 모릅니다
    for (let y = 0; y < H; y += 480) {
      p.push(`<rect x="${x - 14}" y="${y + 2}" width="28" height="13" rx="3" fill="#080d1e"/>`
        + `<rect x="${x - 14}" y="${y + 2}" width="28" height="2.6" rx="1.3" fill="#46548d" opacity=".55"/>`);
    }
  });
  return svg(W, H, '', p.join(''), 2, '탑 안쪽 벽 · 앞 (쇠사슬). 1.45배로 흐릅니다');
}

// ── 그늘 (고정) ─────────────────────────────────────────
// 이것만 흐르지 않습니다. 통이 둥글게 말려 들어가는 느낌은 **화면**에 붙어
// 있어야 합니다 — 같이 흐르면 벽이 도는 것처럼 보입니다. 화면 너비(540)
// 그대로라 벽(500) 바깥의 두 뼘까지 덮습니다.
function wallShade() {
  return svg(540, H,
    `<linearGradient id="round" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0%" stop-color="#05080f" stop-opacity=".72"/>`
    + `<stop offset="20%" stop-color="#05080f" stop-opacity=".2"/>`
    + `<stop offset="50%" stop-color="#05080f" stop-opacity="0"/>`
    + `<stop offset="80%" stop-color="#05080f" stop-opacity=".2"/>`
    + `<stop offset="100%" stop-color="#05080f" stop-opacity=".72"/></linearGradient>`
    + `<linearGradient id="up" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0%" stop-color="#05080f" stop-opacity=".5"/>`
    + `<stop offset="30%" stop-color="#05080f" stop-opacity="0"/></linearGradient>`,
    `<rect width="540" height="${H}" fill="url(#round)"/><rect width="540" height="${H}" fill="url(#up)"/>`,
    2, '탑 안쪽 벽 · 그늘. 화면에 고정합니다 — 흐르지 않습니다');
}

// ── 발판 ────────────────────────────────────────────────
// 세로 스무 줄이 전부입니다. 넣은 것은 넷뿐 — 밟는 윗면, 두께, 낡음, 밑그늘.
// 더 넣으면 뭉갭니다.
//
// **윗면이 가장 밝아야 합니다.** 어디를 딛는지가 곧 이 게임의 규칙입니다.
// 낡게 그린다고 윗면을 어둡게 하면 그림은 나아지고 게임은 나빠집니다.
function plat(w, c, note) {
  const p = [];
  const R = w;   // 오른쪽 끝
  p.push(`<path d="M3 5 q-3 0 -3 3 v9 q0 4 4 4 h${R - 8} q4 0 4 -4 v-9 q0 -3 -3 -3 z" fill="url(#pb)"/>`);
  // 돌 이음매 — 양 끝 18 은 비워 둡니다 (가로로 늘려 쓸 때 잘리는 자리)
  const 이음 = [];
  for (let x = 34; x < R - 18; x += 36) 이음.push(x);
  이음.forEach((x) => {
    p.push(`<rect x="${x}" y="9" width="1.6" height="11" fill="${c.joint}" opacity=".9"/>`
      + `<rect x="${x + 1.6}" y="9" width="1" height="11" fill="${c.lip}" opacity=".35"/>`);
  });
  // 밟는 윗면
  p.push(`<path d="M2 2 h${R - 4} q3 0 3 3 v4 h-${R} v-4 q0 -3 3 -3 z" fill="url(#pt)"/>`);
  p.push(`<rect x="4" y="2" width="${R - 8}" height="1.5" rx=".7" fill="${c.shine}" opacity=".95"/>`);
  // 윗면이 닳아 이가 빠진 자리 — 이 둘로 「낡았다」가 섭니다
  p.push(`<path d="M${Math.round(R * 0.29)} 2 l7 0 l-2 3.4 l-4 0 z" fill="${c.chip}"/>`
    + `<path d="M${Math.round(R * 0.69)} 2 l9 0 l-3 2.6 l-5 0 z" fill="${c.chip}"/>`);
  // 윗면과 몸통 사이 그늘 — 이 한 줄이 두께를 만듭니다
  p.push(`<rect x="0" y="9" width="${R}" height="1.8" fill="${c.joint}" opacity=".9"/>`);
  // 깨진 아래 모서리
  p.push(`<path d="M0 14 l6 3 l-6 3 z" fill="${c.under}" opacity=".8"/>`
    + `<path d="M${R} 13 l-8 4 l8 4 z" fill="${c.under}" opacity=".8"/>`);
  // 금 하나
  p.push(`<path d="M${Math.round(R * 0.4)} 11 l-2 5 l2 4" fill="none" stroke="${c.joint}" stroke-width="1" opacity=".8"/>`);
  // 밑그늘 — 발판이 공중에 떠 있는 것으로 보이게 하는 유일한 줄입니다
  p.push(`<path d="M4 17 h${R - 8} q3 0 3 3 h-${R - 2} q0 -3 3 -3 z" fill="${c.under}"/>`
    + `<rect x="10" y="19" width="${R - 20}" height="1" fill="#0b0f26" opacity=".7"/>`);

  return svg(w, 20,
    `<linearGradient id="pb" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0%" stop-color="${c.b0}"/><stop offset="50%" stop-color="${c.b1}"/>`
    + `<stop offset="100%" stop-color="${c.b2}"/></linearGradient>`
    + `<linearGradient id="pt" x1="0" y1="0" x2="0.35" y2="1">`
    + `<stop offset="0%" stop-color="${c.t0}"/><stop offset="60%" stop-color="${c.t1}"/>`
    + `<stop offset="100%" stop-color="${c.t2}"/></linearGradient>`,
    p.join(''), 4, note);
}

function svg(w, h, defs, body, scale, note) {
  return `<!-- ${note}\n     이 파일은 만들어진 것입니다 — 고치지 마세요. 'node gen-wall.js' 가 다시 만듭니다.\n`
    + `     까닭과 지켜야 할 것은 gen-wall.js 머리말에 적어 두었습니다. -->\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`
    + ` data-bake-scale="${scale}">`
    + (defs ? `<defs>${defs}</defs>` : '') + body + '</svg>\n';
}

const 보통 = { b0: '#5766ac', b1: '#46529a', b2: '#333c7c', t0: '#b3bdec', t1: '#8e99d2',
  t2: '#7b86c4', shine: '#cdd4f2', chip: '#6f7bc0', joint: '#2b3369', lip: '#5c6ab5', under: '#191f4a' };
const 상점 = { b0: '#f6b768', b1: '#e0a044', b2: '#b4761f', t0: '#ffe4b3', t1: '#ffcd8a',
  t2: '#eeb469', shine: '#fff4e0', chip: '#d59a52', joint: '#8d5a12', lip: '#ffd79a', under: '#6f460d' };
const 투기장 = { b0: '#7b3ba5', b1: '#652a8c', b2: '#48186a', t0: '#e6c4ef', t1: '#c99add',
  t2: '#ac7cc4', shine: '#f5e4fa', chip: '#9a5cbe', joint: '#3c0f5c', lip: '#d3a5e4', under: '#2a0842' };

const made = {
  'wall-far': wallFar(),
  'wall-mid': wallMid(),
  'wall-near': wallNear(),
  'wall-shade': wallShade(),
  'plat': plat(140, 보통, '보통 발판 140×20 · 딛고 오르는 자리'),
  'plat-shop': plat(460, 상점, '상점 발판 460×20'),
  'plat-boss': plat(460, 투기장, '보스 투기장 460×20'),
};
for (const [key, text] of Object.entries(made)) {
  fs.writeFileSync(path.join(ART, key + '.svg'), text);
}
// 갈라서 그리기 전의 벽 한 장은 이제 쓰이지 않습니다.
const 옛 = path.join(ART, 'wall.svg');
if (fs.existsSync(옛)) fs.unlinkSync(옛);
console.log('그렸습니다 →', Object.keys(made).join(' · '));
