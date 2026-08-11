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
    who: 'a knight: broad angular shoulder armour, a horned helmet with a red crest, '
       + 'steel-grey armour with red cloth. Red accent #EF9A9A.',
  },
  archer: {
    w: 42, h: 48,
    // 초록을 세게 못박습니다. 그냥 "green accent" 라고만 두었더니 카키·황토로
    // 나와서, 붉은 전사 · 보라 도적과 색으로 갈리지 않았습니다. 세 직업을
    // 색으로 외우는 게임이라 여기가 흐려지면 안 됩니다.
    who: 'an archer dressed in GREEN: a sharply pointed green hood and green cloak, a slim tall '
       + 'body, green leather gear with darker green straps. The green must be clearly, obviously '
       + 'green (#A5D6A7 and #4C8C2A) — not khaki, not tan, not brown, not olive.',
  },
  rogue: {
    w: 40, h: 48,
    who: 'a rogue: hood and a face covering, a cloak, a low crouched stance. '
       + 'Purple accent #CE93D8.',
  },
};

// 무기 종류마다 몸이 다르게 움직입니다 (js/motion.js 의 MOTIONS 와 같은 갈래).
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
};

const STYLE = [
  '2D game sprite art, side view, the character FACING RIGHT in every single frame,',
  'bold clean dark outlines, flat cel shading with two tone shadows, saturated colours,',
  'dark fantasy but friendly, mobile game art.',
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

function promptFor(job, weapon) {
  const hero = HEROES[job];
  const swing = SWINGS[weapon.kind] || SWINGS.sword;
  return [
    `A sprite sheet of ${COLS * ROWS} animation frames showing one complete attack cycle of `
      + `the SAME character: ${hero.who}`,
    `The character is wielding "${weapon.label}" — ${weapon.look}`,
    `The motion is ${swing}.`,
    'CRITICAL: it is the exact same character and the exact same weapon in all frames — identical '
      + 'armour, identical colours, identical proportions, identical size. Only the pose changes.',
    GRID, STYLE, BG,
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
function refFor(job, weapon) {
  const f = path.join(ROOT, 'shots', 'poseref', `${job}-${weapon.kind}.png`);
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
  const base = baseFor(job, weapon);
  const ref = refFor(job, weapon);
  const parts = [];
  // 붙이는 차례가 곧 "첫째 그림 · 둘째 그림"입니다. 지시문이 그 차례를 가리킵니다.
  if (base) parts.push({ inlineData: { mimeType: 'image/png', data: base } });
  if (ref) parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
  const head = [];
  if (base) head.push(BASE_RULE);
  if (ref) {
    // 그림이 둘이면 몇 번째인지 가리켜 줘야 합니다. 하나뿐이면 그냥 "첨부한 그림".
    head.push(base
      ? REF_RULE.replace('The attached image is', 'The SECOND attached image is')
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
        generationConfig: { imageConfig: { aspectRatio: '16:9' } },
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
    return { frames, union: { w: uw, h: uh }, cell: { w: Math.round(cw), h: Math.round(ch) } };
  }, { b64: png.toString('base64'), cols: COLS, rows: ROWS, tol: TOL, feather: FEATHER,
       w: hero.w, h: hero.h, bake: BAKE });
}

// ── 무엇을 그리는가 — js/classes.js 의 무기 표에서 뽑습니다 ──
function weaponsOf(job) {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'classes.js'), 'utf8');
  const order = ['warrior', 'archer', 'rogue'];
  const blk = src.split('weapons: [')[order.indexOf(job) + 1];
  // 종류는 무기마다 다릅니다 — 전사 넷째는 창이고, 쌍(twin) 이면 두 자루입니다.
  // 여기를 job 으로 뭉뚱그리면 창을 베는 그림이 나옵니다.
  const found = [...blk.matchAll(
    /\{ name: '([^']+)'[\s\S]*?color: (0x[0-9a-fA-F]+)[\s\S]*?icon: \{ art: '([a-z]+)'([^}]*)\}/g)]
    .slice(0, 12);
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

(async () => {
  if (!KEY && !process.argv.includes("--reslice")) { console.error('GEMINI_API_KEY 가 없습니다'); process.exit(1); }
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!args.length) { console.error('직업(warrior) 이나 무기(w-warrior-0) 를 주세요'); process.exit(1); }

  let todo = [];
  for (const a of args) {
    if (HEROES[a]) todo.push(...weaponsOf(a).map((w) => ({ job: a, w })));
    else {
      const job = a.split('-')[1];
      const one = (weaponsOf(job) || []).find((w) => w.key === a);
      if (one) todo.push({ job, w: one });
    }
  }
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
      console.log(`칸 ${cut.cell.w}×${cut.cell.h} · 합친 경계 ${cut.union.w}×${cut.union.h}` +
                  (empty ? `  ← 빈 칸 ${empty}개` : ''));
    } catch (e) {
      console.log('실패 — ' + e.message);
    }
  }

  await browser.close();
  console.log('\n컷은 assets/sheets/<무기>/0..7.png · 원본은 shots/sheet-raw/');
})();
