// 이야기 그림들을 js/storydata.js 한 장으로 굽습니다.
//
//   node bake-story.js
//
//   art/story.webp        오프닝 네 컷 (2×2 한 장)
//   art/meet-archer.webp  궁수를 만나는 컷 (한 장)
//   art/meet-rogue.webp   도적을 만나는 컷 (한 장)
//
// art/*.svg 는 bake-art.js 가 묶지만 이야기 그림은 원본이 SVG가 아닙니다 —
// 사람이 그리거나 다른 도구로 그린 래스터입니다. 그래서 통로를 따로 둡니다.
//
// ── 왜 굳이 코드 안에 넣는가 ──────────────────────────────
// 이 게임은 한 파일로 합쳐서 돌아갑니다 (build.js → dist/index.html).
// index.html 을 더블클릭해 여는 길도 살아 있어야 하는데, 그러면 file:// 이라
// 바깥 이미지 파일을 불러올 수 없습니다. artdata.js 와 같은 이유입니다.
//
// ── 크기를 조심하세요 ─────────────────────────────────────
// base64 는 원본보다 33% 큽니다. 합친 파일이 이미 1.6MB 라, 이야기 그림은
// **한 장에 400KB 아래**로 맞추기를 권합니다 (webp 나 jpg 로). 넘으면 아래에서
// 경고를 찍습니다 — 막지는 않습니다. 판단은 사람이 합니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ART = path.join(ROOT, 'art');
const OUT = path.join(ROOT, 'js', 'storydata.js');
const WARN_KB = 400;

// 굽을 그림들. 이름 → 그 그림이 없어도 게임이 돌아가야 합니다.
const WANT = ['story', 'meet-archer', 'meet-rogue'];

// 넷 중 먼저 찾은 것을 씁니다. webp 가 같은 화질에서 가장 가볍습니다.
const EXTS = ['.webp', '.jpg', '.jpeg', '.png'];
const MIME = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

const found = {};
const missing = [];

for (const name of WANT) {
  const file = EXTS.map((e) => path.join(ART, name + e)).find((f) => fs.existsSync(f));
  if (!file) { missing.push(name); continue; }

  const buf = fs.readFileSync(file);
  found[name] = 'data:' + MIME[path.extname(file).toLowerCase()] + ';base64,' + buf.toString('base64');

  const kb = Math.round(buf.length / 1024);
  console.log(`art/${path.basename(file)}  ${kb}KB`);
  if (kb > WARN_KB) {
    console.log(`  ⚠ ${WARN_KB}KB 를 넘습니다. 합친 파일이 그만큼 무거워집니다 —`);
    console.log('    webp 로 바꾸거나 가로 1024px 안쪽으로 줄이는 것을 권합니다.');
  }
}

// 그림이 하나도 없어도, 몇 장만 있어도 게임은 돌아가야 합니다
// (js/scene-story.js 와 js/scene-meet.js 가 빈 자리를 네모로 그립니다).
// 빈 파일이라도 써 둬야 index.html 의 목록이 안 깨집니다.
fs.writeFileSync(OUT,
  '// node bake-story.js 가 만든 파일입니다. 손으로 고치지 마세요.\n' +
  '// 없는 그림은 빠져 있습니다 — 그 자리는 화면에서 빈 네모로 그려집니다.\n' +
  'const STORY_ART = ' + JSON.stringify(found, null, 0) + ';\n');

const outKb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`\njs/storydata.js  ${outKb}KB  (${Object.keys(found).length}/${WANT.length}장)`);
if (missing.length) {
  console.log('아직 없는 그림: ' + missing.map((m) => 'art/' + m + '.webp').join(' · '));
  console.log('없어도 돌아갑니다 — 그 자리만 빈 네모로 나옵니다.');
}
