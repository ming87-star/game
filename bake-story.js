// 오프닝 그림 한 장을 js/storydata.js 로 굽습니다.
//
//   node bake-story.js
//
// art/*.svg 는 bake-art.js 가 묶지만 오프닝은 그림 원본이 SVG가 아닙니다 —
// 사람이 그리거나 다른 도구로 그린 래스터 한 장입니다. 그래서 통로를 따로 둡니다.
//
// ── 왜 굳이 코드 안에 넣는가 ──────────────────────────────
// 이 게임은 한 파일로 합쳐서 돌아갑니다 (build.js → dist/index.html).
// index.html 을 더블클릭해 여는 길도 살아 있어야 하는데, 그러면 file:// 이라
// 바깥 이미지 파일을 불러올 수 없습니다. artdata.js 와 같은 이유입니다.
//
// ── 크기를 조심하세요 ─────────────────────────────────────
// base64 는 원본보다 33% 큽니다. 합친 파일이 이미 1.6MB 라, 오프닝 그림은
// **400KB 아래**로 맞추기를 권합니다 (webp 나 jpg 로). 넘으면 아래에서
// 경고를 찍습니다 — 막지는 않습니다. 판단은 사람이 합니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'js', 'storydata.js');
const WARN_KB = 400;

// 넷 중 먼저 찾은 것을 씁니다. webp 가 같은 화질에서 가장 가볍습니다.
const CANDIDATES = ['story.webp', 'story.jpg', 'story.jpeg', 'story.png'];
const MIME = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

const found = CANDIDATES
  .map((f) => path.join(ROOT, 'art', f))
  .find((f) => fs.existsSync(f));

if (!found) {
  // 그림이 아직 없어도 게임은 돌아가야 합니다 (js/scene-story.js 가 빈 자리를
  // 네모로 그립니다). 빈 파일을 써 두면 index.html 의 목록이 안 깨집니다.
  fs.writeFileSync(OUT, '// node bake-story.js 가 만든 파일입니다. 원본이 없어 비어 있습니다.\n' +
    '// art/story.webp (또는 .jpg · .png) 를 두고 다시 돌리세요.\n' +
    'const STORY_IMAGE = null;\n');
  console.log('art/story.{webp,jpg,png} 가 없습니다 — 빈 storydata.js 를 썼습니다.');
  console.log('그림이 없어도 오프닝은 돌아갑니다 (자리만 네모로 그립니다).');
  process.exit(0);
}

const buf = fs.readFileSync(found);
const ext = path.extname(found).toLowerCase();
const uri = 'data:' + MIME[ext] + ';base64,' + buf.toString('base64');

fs.writeFileSync(OUT,
  '// node bake-story.js 가 만든 파일입니다. 손으로 고치지 마세요.\n' +
  '// 원본: art/' + path.basename(found) + '\n' +
  'const STORY_IMAGE = ' + JSON.stringify(uri) + ';\n');

const srcKb = Math.round(buf.length / 1024);
const outKb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`art/${path.basename(found)}  ${srcKb}KB → js/storydata.js  ${outKb}KB`);
if (srcKb > WARN_KB) {
  console.log(`  ⚠ ${WARN_KB}KB 를 넘습니다. 합친 파일이 그만큼 무거워집니다 —`);
  console.log('    webp 로 바꾸거나 가로 1024px 안쪽으로 줄이는 것을 권합니다.');
}
