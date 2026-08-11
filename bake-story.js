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

// 굽을 그림들. 하나도 없어도 게임은 돌아가야 합니다.
//
// 오프닝은 **두 가지 길** 중 아무 쪽이나 됩니다.
//   story.webp                        2×2 네 컷 한 장 (코드가 사분면으로 자름)
//   story-1..4.webp                    컷마다 한 장씩 (자르지 않음)
//
// 낱장 쪽을 더 권합니다. 그림 도구에게 "정확히 한가운데서 잘리는 2×2"를
// 시키면 칸 사이에 여백이나 테두리를 멋대로 넣기 일쑤인데, 그러면 잘린 자리에
// 흰 띠가 남습니다. 낱장이면 그 문제가 아예 없습니다.
// 둘 다 있으면 낱장이 이깁니다 (js/scene-story.js).
const WANT = ['story', 'story-1', 'story-2', 'story-3', 'story-4',
  'meet-archer', 'meet-rogue'];

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
const cuts = [1, 2, 3, 4].filter((i) => found['story-' + i]).length;
console.log(`\njs/storydata.js  ${outKb}KB  (${Object.keys(found).length}장)`);
console.log(cuts === 4 ? '오프닝: 낱장 넷을 씁니다 (자르지 않음)'
  : found.story ? '오프닝: 2×2 한 장을 사분면으로 자릅니다'
    : '오프닝: 그림이 없어 빈 네모로 나옵니다');
if (cuts && cuts < 4) {
  console.log(`  ⚠ 낱장이 ${cuts}장뿐입니다. 넷을 다 채우거나, 없는 컷은`);
  console.log('    story.webp(2×2 한 장)로 메워집니다.');
}
if (missing.length) {
  console.log('아직 없는 그림: ' + missing.map((m) => 'art/' + m + '.webp').join(' · '));
  console.log('없어도 돌아갑니다 — 그 자리만 빈 네모로 나옵니다.');
}
