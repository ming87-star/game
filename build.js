// 여러 파일로 나뉜 게임을 한 파일로 합칩니다.
// 폰에 링크 하나로 보내 눌러보게 하거나, 정적 호스팅에 올릴 때 씁니다.
//   node build.js            → dist/index.html      (그대로 열리는 완성 파일)
//   node build.js --fragment → dist/artifact.html   (문서 껍데기 없는 조각)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCRIPTS = ['vendor/phaser.min.js', 'js/config.js', 'js/classes.js', 'js/tower.js', 'js/weapon.js', 'js/textures.js', 'js/enemies.js', 'js/hud.js', 'js/shop.js', 'js/scene-select.js', 'js/scene-game.js', 'js/main.js'];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 인라인 <script> 안에 </script> 문자열이 들어가면 태그가 거기서 끊깁니다.
const safe = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const css = read('css/game.css');
const js = SCRIPTS.map((f) => `/* ${f} */\n${safe(read(f))}`).join('\n;\n');

const fragment = `<title>탑 오르기</title>
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
