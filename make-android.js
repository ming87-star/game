// 합친 한 장을 껍데기 안으로 옮깁니다.
//
//   node build.js && node make-android.js
//
// **build.js 를 먼저 돌려야 합니다.** 안 그러면 어제 만든 것이 들어갑니다.
// 그래서 dist/index.html 이 js/ 보다 오래됐으면 여기서 멈춥니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const 원본 = path.join(ROOT, 'dist', 'index.html');
const 자리 = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'game.html');

if (!fs.existsSync(원본)) {
  console.error('dist/index.html 이 없습니다. 먼저 `node build.js` 를 돌리세요.');
  process.exit(1);
}

// 합친 것이 소스보다 오래됐는가. 이걸 안 보면 **고친 것이 안 들어간 채**
// 폰에 깔리고, 「고쳤는데 그대로다」로 반나절을 씁니다.
const 만든때 = fs.statSync(원본).mtimeMs;
const 늦은것 = [];
['js', 'css'].forEach((d) => {
  fs.readdirSync(path.join(ROOT, d)).forEach((f) => {
    const p = path.join(ROOT, d, f);
    if (fs.statSync(p).mtimeMs > 만든때) 늦은것.push(d + '/' + f);
  });
});
if (fs.statSync(path.join(ROOT, 'index.html')).mtimeMs > 만든때) 늦은것.push('index.html');
if (늦은것.length) {
  console.error('dist/index.html 이 낡았습니다. `node build.js` 를 먼저 돌리세요.');
  console.error('  더 새것: ' + 늦은것.slice(0, 6).join(' ') + (늦은것.length > 6 ? ' …' : ''));
  process.exit(1);
}

fs.mkdirSync(path.dirname(자리), { recursive: true });
fs.copyFileSync(원본, 자리);
const kb = Math.round(fs.statSync(자리).size / 1024);
console.log(`android/app/src/main/assets/game.html  ${kb}KB`);
console.log('이제 Android Studio 로 android/ 를 열거나, 그 안에서 ./gradlew assembleDebug');
