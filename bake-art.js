// art/*.svg 를 js/artdata.js 한 장으로 묶습니다.
//
// PNG(assets/*.png)를 그대로 쓰지 않는 이유:
//   이 게임은 한 파일로 합쳐서 돌아갑니다 (build.js → dist/index.html).
//   index.html 을 더블클릭해서 여는 길도 살아 있어야 하는데, 그러면 file:// 이라
//   바깥 PNG 를 불러올 수 없습니다. 그래서 그림을 코드 안에 넣어야 합니다.
//
//   PNG 를 base64 로 넣으면 1.3MB → 1.7MB 가 붙습니다.
//   SVG 는 원본이 128KB 라 스무 배 가볍고, Phaser 의 load.svg 가 원하는 크기로
//   그 자리에서 구워 줍니다 — 화면이 촘촘한 기기에서도 계단이 안 집니다.
//
//   node bake-art.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ART = path.join(ROOT, 'art');
const OUT = path.join(ROOT, 'js', 'artdata.js');

function sizeOf(svg, file) {
  const m = svg.match(/viewBox\s*=\s*"([\d.\s-]+)"/);
  if (!m) throw new Error(file + ' 에 viewBox 가 없습니다');
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
  return { w, h };
}

// 굽는 배수. 그림 쪽에서 data-bake-scale 로 정할 수 있습니다 —
// 32px 짜리는 4배가 알맞지만 벽(500×960)은 4배면 2000×3840 이라 너무 무겁습니다.
function scaleOf(svg) {
  const m = svg.match(/data-bake-scale\s*=\s*"([\d.]+)"/);
  return m ? Number(m[1]) : 4;
}

// 주석과 줄바꿈은 굽는 결과에 영향이 없습니다. 파일에 실어 보낼 이유도 없습니다.
function squeeze(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const files = fs.readdirSync(ART).filter((f) => f.endsWith('.svg')).sort();
const entries = files.map((file) => {
  const raw = fs.readFileSync(path.join(ART, file), 'utf8');
  const { w, h } = sizeOf(raw, file);
  const key = file.replace(/\.svg$/, '');
  return { key, w, h, scale: scaleOf(raw), svg: squeeze(raw) };
});

const body = entries.map((e) =>
  `  '${e.key}': { w: ${e.w}, h: ${e.h}, scale: ${e.scale},\n` +
  `    svg: ${JSON.stringify(e.svg)} },`).join('\n');

const out = `// 이 파일은 만들어진 것입니다 — 고치지 마세요.
// 원본은 art/*.svg 이고, 'node bake-art.js' 로 다시 만듭니다.
//
//   w · h    게임 안에서 차지하는 크기 (SVG 의 viewBox)
//   scale    그 몇 배로 구울지. 촘촘한 화면에서도 또렷하도록 크게 굽습니다
//   svg      원본 그림. Phaser 의 load.svg 가 data URI 로 받아 구워 줍니다
const ART_SVG = {
${body}
};
`;

fs.writeFileSync(OUT, out);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log(`${entries.length}장 → js/artdata.js  ${kb(out.length)}`);
entries.forEach((e) => console.log(`  ${e.key}  ${e.w}×${e.h} ×${e.scale}  ${kb(e.svg.length)}`));
