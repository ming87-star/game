// 여러 파일로 나뉜 게임을 한 파일로 합칩니다.
// 폰에 링크 하나로 보내 눌러보게 하거나, 정적 호스팅에 올릴 때 씁니다.
//   node build.js            → dist/index.html      (그대로 열리는 완성 파일)
//   node build.js --fragment → dist/artifact.html   (문서 껍데기 없는 조각)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 무엇을 합칠지는 **index.html 에서 읽습니다.**
//
// 예전에는 여기 목록을 손으로 적어 두었습니다. 그러다 js/artdata.js 와
// js/artset.js 를 index.html 에만 넣고 여기를 안 고쳤더니, 개발용으로 열면
// 멀쩡한데 합친 파일에서만 "loadArt is not defined" 로 게임 장면이 안 뜨고,
// 메달 상점에서 「탑에 오르기」를 눌러도 아무 일이 없었습니다. 화면에는
// 오류가 안 보이므로 눌러 본 사람은 그냥 "버튼이 안 먹는다"고 느낍니다.
//
// 목록이 두 군데 있으면 언젠가 반드시 어긋납니다. 한 군데만 둡니다.
function scriptsFromIndex() {
  const html = read('index.html');
  const found = [...html.matchAll(/<script\s+src="([^"]+)"\s*>/g)].map((m) => m[1]);
  if (!found.length) throw new Error('index.html 에서 <script src> 를 못 찾았습니다');
  found.forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) throw new Error(f + ' 가 없습니다');
  });
  return found;
}

const SCRIPTS = scriptsFromIndex();

// 인라인 <script> 안에 </script> 문자열이 들어가면 태그가 거기서 끊깁니다.
const safe = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const css = read('css/game.css');
const js = SCRIPTS.map((f) => `/* ${f} */\n${safe(read(f))}`).join('\n;\n');

const fragment = `<title>오늘도 탑을 오르는 나는 무슨 생각을 해야 하나</title>
<style>
${css}
</style>

<div id="game"></div>

<script>
${js}
</script>
`;

const page = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
${fragment.split('\n').slice(0, 1).join('\n')}
</head>
<body>
${fragment.split('\n').slice(1).join('\n')}
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const asFragment = process.argv.includes('--fragment');
const out = asFragment ? 'dist/artifact.html' : 'dist/index.html';
fs.writeFileSync(path.join(ROOT, out), asFragment ? fragment : page);

const kb = Math.round(fs.statSync(path.join(ROOT, out)).size / 1024);
console.log(`${out}  ${kb}KB`);
