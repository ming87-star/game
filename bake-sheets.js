// assets/sheets/<무기>/0..7.png 를 js/sheetdata.js 한 장으로 묶습니다.
//
//   CHROME_PATH=... node bake-sheets.js
//
// ── 왜 이렇게까지 하는가 ────────────────────────────────
// 이 게임은 한 파일로 합쳐서 돕니다 (build.js → dist/index.html). 더블클릭으로
// 여는 길이 살아 있어야 하므로 file:// 이고, 그러면 바깥 PNG 를 못 읽습니다.
// 그림은 전부 코드 안으로 들어와야 합니다.
//
// 컷이 288장(무기 36 × 8컷)입니다. PNG 로 그대로 넣으면 7MB 가 붙어서 못 씁니다.
// 그래서 무기 한 자루를 **가로로 이어 붙인 띠 한 장**으로 만들고 webp 로 굽습니다.
//   · 띠 한 장 — 파일이 36개면 되고, Phaser 의 spritesheet 가 그 자리에서 자릅니다
//   · webp   — 같은 그림이 PNG 의 5분의 1입니다 (알파도 그대로 살아 있습니다)
//
// ── 재는 것 셋 ──────────────────────────────────────────
// 그림만 넣으면 게임이 이걸 어디에 어떤 크기로 놓을지 모릅니다. 세 값을 같이
// 재서 넣습니다. 전부 구워 낸 칸의 픽셀 단위입니다.
//
//   ground  발이 딛는 줄. 이 줄을 물리 몸의 발바닥에 맞춥니다
//   footX   발의 좌우 한가운데. 휘두르는 쪽으로 그림이 쏠려 있으므로
//           칸 한가운데를 쓰면 주인공이 옆으로 밀려 서 있게 됩니다
//   hero    머리끝에서 발까지. 무기마다 휘두르는 폭이 달라서 인물 크기가
//           몇 %씩 다릅니다. 이 값으로 나눠 주면 서른여섯 자루가 같은 키입니다
//
// 머리끝은 **발 위 기둥 안에서 굵은 줄**을 찾습니다. 칼날이나 활채는 얇아서
// (10px 언저리) 안 걸리고 투구는 굵어서(30px 넘게) 걸립니다. 여덟 컷의
// 가운뎃값을 쓰므로 한 컷이 이상해도 흔들리지 않습니다.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'assets', 'sheets');
const OUT = path.join(ROOT, 'js', 'sheetdata.js');

// 화면에서 주인공은 52px 남짓이고, 잘라 낸 칸 안의 인물은 90~110px 입니다 —
// 즉 두 배로 굽는 셈입니다. 촘촘한 화면에서도 또렷하고, 그 위로 올려 봐야
// 파일만 커지고 눈에는 거의 안 보입니다.
//
// 결은 0.7 언저리에서 꺾입니다 (0.82→1.45MB, 0.7→1.25MB, 0.6→1.19MB).
// 더 내려 봐야 얻는 것이 없으므로 꺾이는 자리 바로 위에 둡니다.
const SCALE = 0.85;
const QUALITY = 0.72;

// 굵은 줄로 치는 기준. 투구는 넘고 칼날은 못 넘는 자리에 둡니다.
const HEAD_INK = 16;
const FOOT_INK = 8;

async function measureAndPack(page, dir, files) {
  const urls = files.map((f) => 'data:image/png;base64,'
    + fs.readFileSync(path.join(dir, f)).toString('base64'));
  return page.evaluate(async (a) => {
    const imgs = await Promise.all(a.urls.map((u) => new Promise((r) => {
      const i = new Image(); i.onload = () => r(i); i.src = u;
    })));
    const W = imgs[0].width, H = imgs[0].height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });

    const per = imgs.map((im) => {
      x.clearRect(0, 0, W, H);
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, W, H).data;
      const ink = [];
      let l = W, r = -1, t = H, b = -1;
      for (let y = 0; y < H; y++) {
        let n = 0;
        for (let X = 0; X < W; X++) {
          if (d[(y * W + X) * 4 + 3] > 40) {
            n++;
            if (X < l) l = X; if (X > r) r = X;
            if (y < t) t = y; if (y > b) b = y;
          }
        }
        ink.push(n);
      }
      if (r < 0) return null;
      // 바닥 — 아래에서 올라오며 굵은 줄이 처음 나오는 자리
      let ground = b;
      for (let y = H - 1; y >= 0; y--) { if (ink[y] >= a.footInk) { ground = y; break; } }
      // 발의 좌우 한가운데 — 바닥 위 열 줄의 알파 무게중심
      let sx = 0, sn = 0;
      for (let y = Math.max(0, ground - 10); y <= ground; y++) {
        for (let X = 0; X < W; X++) {
          const al = d[(y * W + X) * 4 + 3];
          if (al > 40) { sx += X * al; sn += al; }
        }
      }
      const footX = sn ? sx / sn : W / 2;
      // 머리끝 — 발 위 기둥 안에서 위에서부터 굵은 줄을 찾습니다
      const c0 = Math.max(0, Math.round(footX - W * 0.18));
      const c1 = Math.min(W - 1, Math.round(footX + W * 0.18));
      let head = ground;
      for (let y = 0; y < H; y++) {
        let n = 0;
        for (let X = c0; X <= c1; X++) if (d[(y * W + X) * 4 + 3] > 40) n++;
        if (n >= a.headInk) { head = y; break; }
      }
      return { ground, footX, head, l, r, t, b };
    });

    const live = per.filter(Boolean);
    if (!live.length) return { error: '빈 시트입니다' };
    const mid = (list) => { const s = list.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
    const ground = mid(live.map((q) => q.ground));
    const footX = mid(live.map((q) => q.footX));
    const head = mid(live.map((q) => q.head));

    // 여덟 컷을 **합친 경계**로 잘라 냅니다. 칸마다 따로 자르면 재생할 때
    // 주인공이 벌렁거립니다. 빈 여백만 걷어 내는 것이라 그림은 안 바뀝니다.
    const pad = 2;
    const L = Math.max(0, Math.min(...live.map((q) => q.l)) - pad);
    const R = Math.min(W - 1, Math.max(...live.map((q) => q.r)) + pad);
    const T = Math.max(0, Math.min(...live.map((q) => q.t)) - pad);
    const B = Math.min(H - 1, Math.max(...live.map((q) => q.b)) + pad);
    const cw = R - L + 1, ch = B - T + 1;

    const fw = Math.round(cw * a.scale), fh = Math.round(ch * a.scale);
    const strip = document.createElement('canvas');
    strip.width = fw * imgs.length; strip.height = fh;
    const sx2 = strip.getContext('2d');
    sx2.imageSmoothingQuality = 'high';
    imgs.forEach((im, i) => sx2.drawImage(im, L, T, cw, ch, i * fw, 0, fw, fh));
    const blob = await new Promise((r) => strip.toBlob(r, 'image/webp', a.quality));
    const url = await new Promise((r) => {
      const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob);
    });

    // **0번 칸에 든 그림의 세로 길이.**
    //
    // hero(머리끝~발)와 다릅니다. 머리끝은 「발 위 기둥 안에서 굵은 줄」로
    // 찾는데, 후드를 쓴 사람이나 누운 컷에서는 그 줄이 한참 아래에서
    // 잡힙니다 — 붉은 겉옷 시트에서 hero 는 93.5 인데 그림이 실제로 든
    // 길이는 142 였습니다. 그 값으로 배율을 내면 그림이 1.5배로 섭니다.
    //
    // 시트와 **그림 한 장을 번갈아 쓰는 자리**(엔딩의 겉옷)에서는 이 값으로
    // 맞춰야 크기가 안 튑니다.
    const 첫칸 = per[0] || live[0];
    return { url, bytes: blob.size, n: imgs.length, fw, fh,
      // 잘라 낸 뒤의 자리로 옮기고, 구운 배율을 먹입니다
      foot: +((footX - L) * a.scale).toFixed(1),
      ground: +((ground - T) * a.scale).toFixed(1),
      hero: +((ground - head) * a.scale).toFixed(1),
      tall: +((첫칸.b - 첫칸.t + 1) * a.scale).toFixed(1) };
  }, { urls, scale: SCALE, quality: QUALITY, headInk: HEAD_INK, footInk: FOOT_INK });
}

(async () => {
  const keys = fs.readdirSync(SRC)
    .filter((k) => fs.statSync(path.join(SRC, k)).isDirectory())
    .sort();
  if (!keys.length) { console.error('assets/sheets 가 비었습니다'); process.exit(1); }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage();
  await page.setContent('<html></html>');

  const out = {};
  let total = 0;
  for (const key of keys) {
    const dir = path.join(SRC, key);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const r = await measureAndPack(page, dir, files);
    if (r.error) { console.log(`${key}  건너뜀 — ${r.error}`); continue; }
    // **키 앞에 sheet- 를 붙입니다.** 안 붙이면 js/textures.js 의
    // weaponIconKey(job, tier) 와 이름이 똑같아집니다 ('w-warrior-0').
    // buildWeaponIcons 는 "이미 있는 키는 건너뛴다"라서, 시트가 먼저 올라가면
    // 무기 아이콘이 아예 안 만들어지고 발판 위 UP 칸과 HUD 에 **주인공이 통째로
    // 30×30 으로 찌그러져** 나옵니다. 실제로 그랬습니다.
    out['sheet-' + key] = { url: r.url, n: r.n, fw: r.fw, fh: r.fh,
      foot: r.foot, ground: r.ground, hero: r.hero, tall: r.tall };
    total += r.bytes;
    console.log(`${key.padEnd(13)} ${r.n}컷 ${r.fw}×${r.fh}  키 ${r.hero}  발 ${r.foot},${r.ground}`
      + `  ${(r.bytes / 1024).toFixed(0)}KB`);
  }
  await browser.close();

  const body = Object.keys(out).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`);
  fs.writeFileSync(OUT, [
    '// bake-sheets.js 가 만든 파일입니다. 손으로 고치지 마세요.',
    '// assets/sheets/<무기>/0..7.png → 무기마다 가로로 이어 붙인 띠 한 장(webp).',
    '// 키는 sheet- 로 시작합니다 — 무기 아이콘(w-warrior-0)과 이름이 겹치면 안 됩니다.',
    '// n=컷수, fw·fh=칸 크기, foot·ground=발이 딛는 자리, hero=머리끝에서 발까지,',
    '// tall=0번 칸에 든 그림의 세로 길이 (hero 와 다릅니다 — bake-sheets.js 참고).',
    'const SHEET_ART = {',
    ...body,
    '};',
    '',
  ].join('\n'));

  const heroes = Object.values(out).map((v) => v.hero);
  console.log(`\n무기 ${Object.keys(out).length}자루 · 합쳐서 ${(total / 1048576).toFixed(2)}MB`
    + ` (base64 로 ${(total * 1.34 / 1048576).toFixed(2)}MB)`);
  console.log(`키 ${Math.min(...heroes)} … ${Math.max(...heroes)} → js/sheetdata.js`);
})();
