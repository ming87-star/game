// 손으로 받아 온 UI 그림을 **잘라서 알파를 입힙니다.**
//
//   CHROME_PATH=... node crop-ui.js title art/incoming/title.png
//   CHROME_PATH=... node crop-ui.js hint  art/incoming/hint.png
//
// ── 왜 필요한가 ───────────────────────────────────────────
// 바깥에서 받은 그림은 **검은 바탕에 빛나는 것**으로 그려져 옵니다. 그대로
// 게임에 얹으면 타이틀 그림 위에 검은 상자가 앉습니다. 그렇다고 검정을 그냥
// 지우면 연기와 빛무리의 부드러운 자락까지 톱니가 되어 잘려 나갑니다.
//
// 검은 바탕의 빛 그림은 **밝기가 곧 알파**입니다. 빛이 셀수록 진하고, 배경에
// 가까울수록 비칩니다. 그렇게 뽑으면 연기 자락이 원래 그려진 대로 스르르
// 사라집니다 — 잘라 낸 티가 안 납니다.
//
//   title  탑과 보랏빛 연기를 다 살립니다. 밝기로 알파를 만들고 여백만 자릅니다
//   hint   금테를 살리고 여백을 자른 뒤, **바깥으로 갈수록 반투명**해집니다
//
// ── hint 는 밝기만으로 안 됩니다 ──────────────────────────
// 금테 **안쪽 판때기가 바깥 배경과 거의 같은 검정**입니다. 밝기로 뽑으면
// 판이 통째로 비고, 그렇다고 다 채우면 액자 밖의 검정까지 살아서 검은 상자가
// 됩니다 (처음에 그렇게 나왔습니다).
//
// 안과 밖을 가르는 것은 **금테 자신**입니다. 그림 가장자리에서 시작해 어두운
// 곳만 타고 번져 들어가면, 금테에 막혀서 판 안쪽에는 못 들어갑니다. 그렇게
// 닿은 곳이 '바깥', 안 닿은 곳이 '안'입니다.
//
// 결과는 shots/crop/ 에 쌓입니다. 고른 뒤에 손으로 art/ 로 옮깁니다 —
// 여기서 바로 art/ 를 덮지 않는 것은, 여러 벌을 견줘 보고 고르기 위해서입니다.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'shots', 'crop');

// 알파를 만드는 밝기 구간. 이보다 어두우면 아주 비치고, 이보다 밝으면 꽉 찹니다.
// 두 값 사이는 부드럽게 이어집니다 — 여기가 연기 자락이 사는 자리입니다.
const LO = 0.030, HI = 0.170;

// 자를 자리를 찾는 문턱. LO 보다 조금 높게 둡니다 — 눈에 안 보일 만큼 어두운
// 잡티까지 경계로 세면 여백이 안 잘립니다.
const EDGE = 0.055;

// 금테로 치는 밝기. 번지기가 여기서 막힙니다. 너무 높으면 어두운 테두리
// 틈으로 새어 들어가고, 너무 낮으면 판때기의 얼룩까지 벽으로 칩니다.
const WALL = 0.115;

// hint 를 바깥으로 흐리는 폭 (가로·세로, 자른 칸을 1로 놓은 비율).
// 가로는 금테 날개가 원래 옆으로 뻗어 나가므로 넉넉히, 세로는 좁게 둡니다.
const FADES = {
  soft:   { fx: 0.10, fy: 0.06 },
  medium: { fx: 0.20, fy: 0.12 },
  wide:   { fx: 0.32, fy: 0.20 },
};

async function work(page, b64, mode, opt) {
  return page.evaluate(async (a) => {
    const img = new Image();
    await new Promise((r, j) => {
      img.onload = r; img.onerror = () => j(new Error('그림을 못 읽었습니다'));
      img.src = 'data:image/png;base64,' + a.b64;
    });
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H);
    const p = d.data;

    // 사람 눈이 느끼는 밝기. 초록을 가장 무겁게 칩니다.
    const luma = (i) => (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;

    // 1. 내용이 실제로 차지한 자리를 잽니다.
    let l = W, r = -1, t = H, b = -1;
    for (let y = 0; y < H; y++) {
      for (let X = 0; X < W; X++) {
        if (luma((y * W + X) * 4) > a.edge) {
          if (X < l) l = X; if (X > r) r = X;
          if (y < t) t = y; if (y > b) b = y;
        }
      }
    }
    if (r < 0) return { error: '전부 어둡습니다 — 문턱을 낮춰 보세요' };

    // 여백을 조금 남깁니다. 딱 붙여 자르면 빛무리의 바깥 자락이 잘립니다.
    const padX = Math.round((r - l) * a.pad), padY = Math.round((b - t) * a.pad);
    l = Math.max(0, l - padX); r = Math.min(W - 1, r + padX);
    t = Math.max(0, t - padY); b = Math.min(H - 1, b + padY);
    const cw = r - l + 1, ch = b - t + 1;

    // 2. 잘라 낸 칸으로 옮겨 그리고, 거기서 알파를 만듭니다.
    const o = document.createElement('canvas');
    o.width = cw; o.height = ch;
    const ox = o.getContext('2d', { willReadFrequently: true });
    ox.drawImage(c, l, t, cw, ch, 0, 0, cw, ch);
    const od = ox.getImageData(0, 0, cw, ch);
    const q = od.data;
    const smooth = (v) => v * v * (3 - 2 * v);          // 양 끝이 부드러운 곡선

    // 가장자리에서 어두운 곳만 타고 번져 들어갑니다. 금테(밝은 곳)에 막히므로
    // 액자 안쪽에는 못 들어갑니다 — 닿은 곳이 '바깥'입니다.
    const outside = new Uint8Array(cw * ch);
    if (a.keepPlate) {
      const wall = new Uint8Array(cw * ch);
      for (let i = 0, k = 0; i < q.length; i += 4, k++) {
        wall[k] = (0.2126 * q[i] + 0.7152 * q[i + 1] + 0.0722 * q[i + 2]) / 255 > a.wall ? 1 : 0;
      }
      // 네 변을 씨앗으로 놓고 넓이 우선으로 번집니다.
      const queue = [];
      const push = (X, y) => {
        const k = y * cw + X;
        if (outside[k] || wall[k]) return;
        outside[k] = 1; queue.push(k);
      };
      for (let X = 0; X < cw; X++) { push(X, 0); push(X, ch - 1); }
      for (let y = 0; y < ch; y++) { push(0, y); push(cw - 1, y); }
      for (let h = 0; h < queue.length; h++) {
        const k = queue[h], X = k % cw, y = (k / cw) | 0;
        if (X > 0) push(X - 1, y);
        if (X < cw - 1) push(X + 1, y);
        if (y > 0) push(X, y - 1);
        if (y < ch - 1) push(X, y + 1);
      }
    }

    for (let y = 0; y < ch; y++) {
      for (let X = 0; X < cw; X++) {
        const i = (y * cw + X) * 4;
        const L = (0.2126 * q[i] + 0.7152 * q[i + 1] + 0.0722 * q[i + 2]) / 255;

        // 밝기로 만든 알파 — 검은 바탕의 빛 그림은 이것이 곧 원래의 알파입니다.
        let al = (L - a.lo) / (a.hi - a.lo);
        al = al <= 0 ? 0 : al >= 1 ? 1 : smooth(al);

        // 액자 **안쪽**이면 판때기를 살립니다. 바깥은 밝기가 정한 대로 둡니다 —
        // 금테 둘레의 빛무리가 원래 그려진 대로 스르르 사라집니다.
        if (a.keepPlate && !outside[y * cw + X]) al = Math.max(al, a.plate);

        // 바깥으로 갈수록 반투명하게. 네 변에서 각각 거리를 재어 가장 가까운
        // 쪽을 따릅니다 — 모서리는 자연히 두 번 흐려져 더 옅어집니다.
        if (a.fx > 0 || a.fy > 0) {
          const dl = a.fx > 0 ? (X / cw) / a.fx : 9;
          const dr = a.fx > 0 ? (1 - X / cw) / a.fx : 9;
          const dt = a.fy > 0 ? (y / ch) / a.fy : 9;
          const db = a.fy > 0 ? (1 - y / ch) / a.fy : 9;
          let e = Math.min(dl, dr, dt, db);
          e = e <= 0 ? 0 : e >= 1 ? 1 : smooth(e);
          al *= e;
        }
        q[i + 3] = Math.round(q[i + 3] * al);
      }
    }
    ox.putImageData(od, 0, 0);

    let clear = 0;
    for (let i = 3; i < q.length; i += 4) if (q[i] < 32) clear++;
    return { url: o.toDataURL('image/webp', 0.94), w: cw, h: ch, from: W + '×' + H,
      clear: +(clear / (cw * ch) * 100).toFixed(1) };
  }, Object.assign({ b64, lo: LO, hi: HI, edge: EDGE, wall: WALL, pad: 0.015,
    keepPlate: false, plate: 0, fx: 0, fy: 0 }, opt));
}

(async () => {
  const mode = process.argv[2];
  const src = process.argv[3];
  if (!mode || !src || !fs.existsSync(src)) {
    console.error('쓰는 법: node crop-ui.js title|hint <그림파일>');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const b64 = fs.readFileSync(src).toString('base64');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage();
  await page.setContent('<html></html>');

  // 어느 쪽이 나은지는 얹어 봐야 압니다. 한 벌만 뽑지 않고 여러 벌 냅니다.
  // 제목은 밝기 구간을 두 가지로 냅니다. 넓게 잡으면 연기가 곱게 사라지는
  // 대신 **탑의 돌까지 비치고**, 좁게 잡으면 탑이 단단해지는 대신 연기의
  // 바깥 자락이 조금 일찍 끊깁니다. 어느 쪽이 나은지는 얹어 봐야 압니다.
  const jobs = mode === 'hint'
    ? Object.keys(FADES).flatMap((k) => [
      { name: 'hint-' + k, opt: Object.assign({ keepPlate: true, plate: 1 }, FADES[k]) },
      { name: 'hint-' + k + '-glass', opt: Object.assign({ keepPlate: true, plate: 0.55 }, FADES[k]) },
    ])
    : [{ name: 'title-soft', opt: {} },
       { name: 'title-solid', opt: { lo: 0.018, hi: 0.075 } }];

  for (const j of jobs) {
    process.stdout.write(j.name.padEnd(18) + '… ');
    const r = await work(page, b64, mode, j.opt);
    if (r.error) { console.log('실패 — ' + r.error); continue; }
    fs.writeFileSync(path.join(OUT, j.name + '.webp'),
      Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'));
    console.log(`${r.from} → ${r.w}×${r.h} (${(r.w / r.h).toFixed(2)}:1) · 투명 ${r.clear}%`);
  }
  await browser.close();
  console.log('\nshots/crop/ 에 넣었습니다. 얹어 보려면: node shot-crop.js');
})();
