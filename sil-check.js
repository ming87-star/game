// 검게 칠했을 때 직업들이 서로 갈리는지 봅니다 (ART.md 2.5절).
//
//   CHROME_PATH=... node sil-check.js                  구워진 초상화 전부
//   CHROME_PATH=... node sil-check.js 그림.png ...      아직 안 구운 파일도 함께
//
// → shots/silhouette.png
//
// ── 왜 이 도구가 있는가 ─────────────────────────────────
// 직업 고르기가 격자가 되면서, 잠긴 직업은 **속이 하나도 안 보이는 새까만
// 덩어리**로 나옵니다. 색도 갑옷 결도 얼굴도 안 보이고 **윤곽 하나만** 남습니다.
//
// 그런데 사람 모양은 까맣게 칠하면 원래 서로 비슷해집니다. 그림 도구에서 보는
// 화려한 초상화와, 플레이어가 처음 보는 검은 덩어리는 **다른 그림**입니다.
// 눈으로 짐작하지 말고 **칠해 놓고 보세요.**
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 화면에서 초상화가 그려지는 크기입니다 (js/scene-select.js 의 격자 칸).
// 패널 500 − 양옆 16 − 칸 사이 10×3 = 칸 109, 안쪽 여백 6씩 빼면 97.
const DRAW_W = 97;
const DRAW_H = 123;

// ── 외곽선 ──────────────────────────────────────────────
// 새까만 덩어리는 카드 바탕(#141826)과 너무 가까워서 **모양이 아니라 얼룩**으로
// 보입니다. 검정에서 남는 정보는 윤곽뿐인데, 그 윤곽이 안 보이면 아무것도
// 안 남습니다. 외곽선을 두르면 그 하나가 살아납니다.
//
// **1px 입니다.** 2px 로 두껍게 하면 얇게 삐져나온 것들이 뭉갭니다 — 그런데
// 이 화면에서 직업을 갈라 주는 것이 바로 그 얇게 삐져나온 것들입니다
// (궁수의 활). 굵은 선이 규격이 기대는 정보를 먹습니다.
//
// 색은 열린 카드 테두리(#3f4a78)보다 한 단 밝게 잡습니다. 같은 색이면
// 잠긴 칸이 열린 칸처럼 보입니다.
const OUTLINE = 1;
const OUTLINE_COLOR = '#5a6795';

// 여덟 방향으로 어긋나게 겹쳐서 테두리를 냅니다. 게임 쪽도 같은 방식입니다 —
// 같은 그림을 여덟 번 깔고 그 위에 검은 것을 올립니다.
const ring = (px, color) => Array.from({ length: 8 }, (_, i) => {
  const a = i * Math.PI / 4;
  return `drop-shadow(${(Math.cos(a) * px).toFixed(2)}px ${(Math.sin(a) * px).toFixed(2)}px 0 ${color})`;
}).join(' ');

function baked() {
  const f = path.join(__dirname, 'js', 'spritedata.js');
  if (!fs.existsSync(f)) return [];
  const raw = fs.readFileSync(f, 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, '');
  const sp = JSON.parse(raw);
  return Object.keys(sp).filter((k) => k.startsWith('face-')).sort()
    .map((k) => ({ name: k.slice(5), uri: sp[k].uri }));
}

function fromArgs() {
  return process.argv.slice(2).filter((a) => !a.startsWith('--')).map((f) => {
    const ext = path.extname(f).slice(1).toLowerCase();
    return {
      name: path.basename(f, path.extname(f)),
      uri: 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,'
        + fs.readFileSync(f).toString('base64'),
    };
  });
}

(async () => {
  const list = baked().concat(fromArgs());
  if (!list.length) { console.error('볼 그림이 없습니다'); process.exit(1); }
  console.log(list.length + '장 — ' + list.map((c) => c.name).join(' · '));

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  // 한 줄에 넷 (격자가 4열입니다). 줄이 늘면 화면도 늘립니다.
  const cols = Math.min(4, list.length);
  const rows = Math.ceil(list.length / cols);
  const page = await browser.newPage({
    viewport: { width: cols * 121 + 24, height: rows * 2 * 168 + 96 },
  });

  // 위 줄은 있는 그대로, 아래 줄은 **완전한 검정**입니다. 나란히 놓아야
  // "색이 예쁜 것"과 "윤곽이 갈리는 것"이 다른 문제라는 게 보입니다.
  const cell = (c, black) => `<div style="width:109px">
    <div style="height:${DRAW_H + 8}px;background:${black ? '#141826' : '#1b2138'};
      border:1px solid ${black ? '#252c44' : '#3f4a78'};border-radius:6px;
      display:flex;align-items:flex-end;justify-content:center;overflow:hidden">
      <img src="${c.uri}" style="max-width:${DRAW_W}px;max-height:${DRAW_H}px;
        ${black ? 'filter:brightness(0) invert(.05) ' + ring(OUTLINE, OUTLINE_COLOR) : ''}">
    </div>
    <div style="text-align:center;font:12px sans-serif;color:${black ? '#4a5578' : '#8794b5'};
      padding-top:4px">${black ? '???' : c.name}</div></div>`;

  const grid = (black) => '<div style="display:grid;gap:12px;justify-content:start;'
    + `grid-template-columns:repeat(${cols},109px)">`
    + list.map((c) => cell(c, black)).join('') + '</div>';

  await page.setContent('<body style="margin:0;background:#0d1120;padding:12px;'
    + 'font:13px sans-serif;color:#8794b5">'
    + '<div style="padding:4px 0 8px">열림 — 있는 그대로</div>' + grid(false)
    + '<div style="padding:18px 0 8px">잠김 — 완전한 검정 (플레이어가 처음 보는 것)</div>'
    + grid(true) + '</body>');

  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  await page.screenshot({ path: 'shots/silhouette.png' });
  await browser.close();
  console.log('shots/silhouette.png');
  console.log('\n아래 줄에서 **둘이 헷갈리면 다시 그려야 합니다.** 몸 밖으로');
  console.log('나오는 것이 있어야 윤곽이 갈립니다 (ART.md 2.5절).');
  console.log('외곽선 ' + OUTLINE + 'px ' + OUTLINE_COLOR + ' — 게임과 같은 조건으로 그렸습니다.');
})();
