// 전사의 붉은 망토를 군청으로 옮깁니다.
//
//   CHROME_PATH=... node recolor-warrior.js --preview   한 장만 미리 보기
//   CHROME_PATH=... node recolor-warrior.js             아흔여섯 장 전부
//
// ── 왜 색을 옮기는가 ────────────────────────────────────
// 이야기의 마지막에 **붉은 겉옷** 하나가 나옵니다. 그것이 이 게임에서 유일한
// 붉은 것이어야 뜻이 섭니다. 그런데 전사가 이미 백 시간 동안 붉은 망토를
// 두르고 오르고 있었습니다. 상징이 둘이면 상징이 아닙니다.
//
// ── 왜 다시 뽑지 않고 색만 옮기는가 ─────────────────────
// 시트는 Gemini 로 뽑은 그림입니다 (gen-sheet.js). 다시 뽑으면 열쇠도 들고,
// 무엇보다 **여덟 컷이 같은 사람이라는 보장이 깨집니다** — 한 번에 한 장으로
// 뽑아야 갑옷 모양이 컷마다 안 흔들리는데, 열두 자루를 다시 돌리면 지금
// 맞춰 둔 것이 전부 새로 흔들립니다. 색만 옮기면 모양은 한 획도 안 변합니다.
//
// ── 붉은 픽셀만 고르는 법 ───────────────────────────────
// 전사 그림에서 붉은 것은 **망토·투구 깃·허리띠뿐**입니다. 재 보니 붉은
// 픽셀이 컷의 10~18% 인데 그게 전부 그 셋입니다 (궁수는 0.1%, 도적은 0%).
// 살빛이 붉은 쪽으로 걸리지 않게 문턱을 좁게 잡고, 눈으로 확인합니다.
//
// 색을 통째로 갈아 끼우지 않고 **밝기를 그대로 두고 색만 돌립니다.** 그래야
// 접힌 자국과 그늘이 살아 있습니다 — 한 색으로 칠해 버리면 망토가 종이가 됩니다.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const SHEETS = path.join(ROOT, 'assets', 'sheets');
const PREVIEW = process.argv.includes('--preview');

// 옮겨 갈 색 — 군청.
//
// 이 게임의 배경이 이미 남색 계열이라(벽 #1d2542 · 발판 #5c6bc0 · 발판 립
// #9fa8da) **그냥 파랗게만 만들면 주인공이 배경에 묻힙니다.** 발판은
// h232 · 채도 0.42 · 밝기 0.56 인 흐린 남보라입니다. 망토는 같은 계열이되
// **더 짙고 더 진하게** 잡아야 그 위에 서도 갈립니다.
//
//   sMul  채도를 올립니다 — 흐린 발판과 갈라지는 것은 이쪽입니다
//   lMul  밝기를 낮춥니다 — 「군청」은 밝은 파랑이 아닙니다
//   lo/hi 너무 어두워 벽에 묻히거나, 너무 밝아 발판 립처럼 되지 않게
const NAVY = { h: 224, sMul: 1.35, sMax: 0.9, lMul: 0.86, lo: 0.20, hi: 0.56 };

function listWarriorFrames() {
  const out = fs.readdirSync(SHEETS)
    .filter((d) => d.startsWith('w-warrior-'))
    .sort()
    .flatMap((d) => fs.readdirSync(path.join(SHEETS, d))
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => path.join(SHEETS, d, f)));
  // 직업 고르기 카드에 서는 초상화도 같은 사람입니다 (bake-sprites.js 가
  // 이 파일을 face-warrior 로 굽습니다). 여기를 빠뜨렸더니 판 안의 전사만
  // 군청이 되고 **고르는 화면에서는 여전히 붉은 망토**였습니다.
  const face = path.join(ROOT, 'assets', 'player-warrior.png');
  if (fs.existsSync(face)) out.push(face);
  return out;
}

(async () => {
  const files = listWarriorFrames();
  const todo = PREVIEW ? files.slice(0, 1) : files;
  console.log((PREVIEW ? '미리 보기 — ' : '') + todo.length + '장');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');

  let 바뀐픽셀 = 0;
  for (const file of todo) {
    const b64 = fs.readFileSync(file).toString('base64');
    const out = await page.evaluate(async ([b64, navy]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height);
      const px = d.data;

      const hsl = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const l = (mx + mn) / 2;
        if (mx === mn) return [0, 0, l];
        const c = mx - mn;
        const s = l > 0.5 ? c / (2 - mx - mn) : c / (mx + mn);
        let h;
        if (mx === r) h = ((g - b) / c + (g < b ? 6 : 0));
        else if (mx === g) h = (b - r) / c + 2;
        else h = (r - g) / c + 4;
        return [h * 60, s, l];
      };
      const rgb = (h, s, l) => {
        h = ((h % 360) + 360) % 360 / 360;
        if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const f = (t) => {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
      };

      const W = cv.width, H = cv.height;
      const 붉음 = (h, s, l) => (h < 22 || h > 338) && l > 0.05 && l < 0.94 && s > 0.05;
      const 옮김 = new Uint8Array(W * H);
      const 돌리기 = (i, h, s, l) => {
        // **밝기의 결은 그대로 두고** 색만 돌립니다 — 접힌 자국과 그늘이
        // 살아 있어야 망토가 천으로 보입니다. 한 색으로 칠하면 종이가 됩니다.
        const ns = Math.min(navy.sMax, s * navy.sMul);
        const nl = Math.max(navy.lo, Math.min(navy.hi, l * navy.lMul));
        const [nr, ng, nb] = rgb(navy.h, ns, nl);
        px[i] = nr; px[i + 1] = ng; px[i + 2] = nb;
      };

      // ── 1벌: 확실한 붉은색 ───────────────────────────
      let n = 0;
      for (let p = 0; p < W * H; p++) {
        const i = p * 4;
        if (px[i + 3] < 20) continue;
        const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2]);
        if (!(붉음(h, s, l) && s > 0.30 && l > 0.08 && l < 0.82)) continue;
        돌리기(i, h, s, l);
        옮김[p] = 1;
        n++;
      }

      // ── 2벌: 그 곁에 남은 붉은 테 ────────────────────
      // 경계 픽셀은 흐리게 섞여 있어 1벌의 문턱에 안 걸립니다. 그대로 두면
      // **파란 망토에 붉은 테가 남습니다.** 문턱을 통째로 낮추면 살빛까지
      // 걸리므로, **이미 옮긴 픽셀에 닿아 있는 것만** 더 옮깁니다.
      for (let pass = 0; pass < 3; pass++) {
        const 이번 = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p = y * W + x;
            if (옮김[p]) continue;
            const i = p * 4;
            if (px[i + 3] < 20) continue;
            const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2]);
            if (!붉음(h, s, l)) continue;
            const 곁에 = (x > 0 && 옮김[p - 1]) || (x < W - 1 && 옮김[p + 1])
              || (y > 0 && 옮김[p - W]) || (y < H - 1 && 옮김[p + W]);
            if (곁에) 이번.push([p, h, s, l]);
          }
        }
        if (!이번.length) break;
        이번.forEach(([p, h, s, l]) => { 돌리기(p * 4, h, s, l); 옮김[p] = 1; n++; });
      }
      ctx.putImageData(d, 0, 0);
      return { png: cv.toDataURL('image/png').split(',')[1], n };
    }, [b64, NAVY]);

    바뀐픽셀 += out.n;
    const target = PREVIEW
      ? path.join(ROOT, 'shots', 'recolor-preview.png')
      : file;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(out.png, 'base64'));
    if (PREVIEW) console.log('  ' + file + ' → ' + target + '  (' + out.n + '픽셀)');
  }

  console.log('옮긴 픽셀 ' + 바뀐픽셀 + '개');
  if (!PREVIEW) console.log('\n다음: CHROME_PATH=... node bake-sheets.js  (js/sheetdata.js 다시 굽기)');
  await browser.close();
})();
