// 이야기 그림들을 js/storydata.js 한 장으로 굽습니다.
//
//   node bake-story.js          640px 로 줄여서 굽습니다 (기본)
//   node bake-story.js --full   원본 크기 그대로 굽습니다
//
//   art/story-1..4.webp   오프닝 네 컷 (낱장 넷 — 권장)
//   art/title-art.webp    타이틀 화면 배경 — 후반 전투 (세로 9:16)
//   art/title-logo.webp   제목 글자를 그린 것 (없으면 글꼴로 짓습니다)
//   art/story.webp        오프닝 2×2 한 장 (자를 자리를 코드가 찾습니다)
//   art/meet-archer.webp  궁수를 만나는 컷
//   art/meet-rogue.webp   도적을 만나는 컷
//
// art/*.svg 는 bake-art.js 가 묶지만 이야기 그림은 원본이 SVG가 아닙니다 —
// 사람이 그리거나 다른 도구로 그린 래스터입니다. 그래서 통로를 따로 둡니다.
//
// ── 왜 굳이 코드 안에 넣는가 ──────────────────────────────
// 이 게임은 한 파일로 합쳐서 돌아갑니다 (build.js → dist/index.html).
// index.html 을 더블클릭해 여는 길도 살아 있어야 하는데, 그러면 file:// 이라
// 바깥 이미지 파일을 불러올 수 없습니다. artdata.js 와 같은 이유입니다.
//
// ── 왜 줄여서 굽는가 ──────────────────────────────────────
// **화면에 그려지는 크기가 452px 입니다** (scene-story.js 의 frameW).
// 이 게임은 캔버스를 540×960 으로 고정해 놓고 CSS 로만 늘리므로(main.js 의
// Scale.FIT, resolution 을 안 줌), 원본이 1024px 이어도 캔버스에 닿는 순간
// 452px 로 줄어듭니다. **절반이 넘는 픽셀이 화면까지 못 갑니다.**
//
// 그래서 640px 로 줄여 굽습니다. 452 에 1.4배 여유라 눈에 띄는 손해는 없고,
// 파일은 네 배 가까이 가벼워집니다 (한 장 150KB → 36KB).
// **원본은 art/ 에 그대로 둡니다** — 나중에 액자를 키우거나 캔버스 해상도를
// 올리면 MAX_W 만 올려서 다시 구우면 됩니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ART = path.join(ROOT, 'art');
const OUT = path.join(ROOT, 'js', 'storydata.js');

// 화면에서 그려지는 크기(452px)의 1.4배. 위 주석 참고.
const MAX_W = 640;
const QUALITY = 0.86;
const WARN_KB = 120; // 줄인 뒤 한 장이 이보다 크면 알려 줍니다
const FULL = process.argv.includes('--full');

// 굽을 그림들. 하나도 없어도 게임은 돌아갑니다.
//
// 오프닝은 **두 가지 길** 중 아무 쪽이나 됩니다.
//   story.webp                        2×2 네 컷 한 장 (코드가 사분면으로 자름)
//   story-1..4.webp                   컷마다 한 장씩 (자르지 않음)
//
// 낱장 쪽을 더 권합니다. 그림 도구에게 "정확히 한가운데서 잘리는 2×2"를
// 시키면 칸 사이에 여백이나 테두리를 멋대로 넣기 일쑤인데, 그러면 잘린 자리에
// 흰 띠가 남습니다. 낱장이면 그 문제가 아예 없습니다.
// 둘 다 있으면 낱장이 이깁니다 (js/scene-story.js).
//
// 타이틀 화면의 세 장은 규격이 다릅니다.
//   title-art   화면을 덮는 세로 그림 (9:16 · 배경이 안 비침)
//   title-logo  제목 글자를 그린 것 (가로로 긴 · 배경이 비침)
//   title-hint  「터치해서 계속하기」 금테 (아주 가로로 긴 · 배경이 비침)
//
// 뒤의 둘은 **알파가 살아 있어야** 합니다. 배경 그림 위에 얹히는 것이라,
// 알파가 죽으면 검은 판때기가 그림 위에 놓입니다.
const WANT = ['story', 'story-1', 'story-2', 'story-3', 'story-4',
  'title-art', 'title-logo', 'title-hint', 'meet-archer', 'meet-rogue'];

// 넷 중 먼저 찾은 것을 씁니다. webp 가 같은 화질에서 가장 가볍습니다.
const EXTS = ['.webp', '.jpg', '.jpeg', '.png'];
const MIME = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

const files = {};
const missing = [];
for (const name of WANT) {
  const file = EXTS.map((e) => path.join(ART, name + e)).find((f) => fs.existsSync(f));
  if (file) files[name] = file; else missing.push(name);
}

const asIs = (file) =>
  'data:' + MIME[path.extname(file).toLowerCase()] + ';base64,' +
  fs.readFileSync(file).toString('base64');

// 줄이는 일은 브라우저에게 시킵니다. 이 저장소에는 이미지 라이브러리가 없고,
// render-art.js 도 같은 방식으로 Chromium 에게 그리기를 맡깁니다.
async function shrinkAll(names) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const out = {};

  for (const name of names) {
    const file = files[name];
    const uri = asIs(file);
    const done = await page.evaluate(async ([src, maxW, q]) => {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
      if (img.width <= maxW) return { uri: src, w: img.width, kept: true };

      const c = document.createElement('canvas');
      c.width = maxW;
      c.height = Math.round(maxW * img.height / img.width);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return { uri: c.toDataURL('image/webp', q), w: c.width, from: img.width, kept: false };
    }, [uri, MAX_W, QUALITY]);

    out[name] = done.uri;
    const kb = Math.round(done.uri.length * 0.75 / 1024);
    const was = Math.round(fs.statSync(file).size / 1024);
    console.log(done.kept
      ? `${path.basename(file)}  ${done.w}px · ${was}KB  (이미 작아서 그대로)`
      : `${path.basename(file)}  ${done.from}px ${was}KB → ${done.w}px ${kb}KB`);
    if (kb > WARN_KB) {
      console.log(`  ⚠ 줄이고도 ${kb}KB 입니다. 그림이 너무 복잡하거나 원본이 사진일 수 있습니다.`);
    }
  }

  await browser.close();
  return out;
}

(async () => {
  const names = Object.keys(files);
  let found = {};

  if (!names.length) {
    console.log('이야기 그림이 하나도 없습니다.');
  } else if (FULL) {
    names.forEach((n) => { found[n] = asIs(files[n]); });
    console.log('--full — 원본 크기 그대로 굽습니다.');
  } else {
    try {
      found = await shrinkAll(names);
    } catch (e) {
      // 브라우저가 없어도 굽기는 되어야 합니다. 무거워질 뿐입니다.
      console.log('줄이기를 건너뜁니다 (' + e.message.split('\n')[0] + ')');
      console.log('원본 크기 그대로 굽습니다 — 합친 파일이 그만큼 무거워집니다.');
      names.forEach((n) => { found[n] = asIs(files[n]); });
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
  // 2×2 한 장으로 메울 수 있는 것은 앞의 넷까지입니다.
  const cuts = [1, 2, 3, 4].filter((i) => found['story-' + i]).length;
  console.log(`\njs/storydata.js  ${outKb}KB  (${Object.keys(found).length}장)`);
  console.log(cuts === 4 ? '오프닝: 낱장 넷을 씁니다 (자르지 않음)'
    : found.story ? '오프닝: 2×2 한 장을 사분면으로 자릅니다'
      : '오프닝: 그림이 없어 빈 네모로 나옵니다');
  if (cuts && cuts < 4) {
    console.log(`  ⚠ 낱장이 ${cuts}장뿐입니다. 없는 컷은 story.webp(2×2 한 장)로 메워집니다.`);
  }
  if (missing.length) {
    console.log('아직 없는 그림: ' + missing.map((m) => 'art/' + m + '.webp').join(' · '));
    console.log('없어도 돌아갑니다 — 그 자리만 빈 네모로 나옵니다.');
  }
})();
