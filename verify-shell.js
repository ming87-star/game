// 껍데기(android/)와 게임이 **어긋나지 않는지** 봅니다.
//
// 이 검사가 필요한 까닭. 순위표·업적 이름이 **세 군데**에 적혀 있습니다.
//
//   js/games.js          'floor' · 'relic-all' …   (게임이 부르는 이름)
//   res/values/strings.xml   deed_relic_all …      (구글 ID 를 담을 자리)
//   GamesBridge.java     업적("relic-all", R.string.deed_relic_all)
//
// 하나만 빠뜨리면 **그 업적은 영영 안 올라갑니다.** 오류도 안 나고, 폰에서도
// 아무 일이 없습니다 — 그냥 조용합니다. 구글 콘솔에 등록까지 다 해 놓고도
// 왜 안 뜨는지 며칠을 헤매게 되는 자리입니다.
//
// **이 환경에는 안드로이드 SDK 가 없어 자바를 컴파일할 수 없습니다.**
// (dl.google.com 이 프록시에서 막힙니다.) 그래서 컴파일 대신 **글을 맞춰
// 봅니다.** 컴파일이 잡아 주는 것과는 다르지만, 이름이 어긋나는 것은
// 컴파일러도 못 잡습니다 — 문자열이니까요.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const A = path.join(ROOT, 'android', 'app', 'src', 'main');

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};
const 읽기 = (p) => fs.readFileSync(p, 'utf8');

// ── 파일이 다 있는가 ──────────────────────────────────────
const 있어야할것 = [
  'android/settings.gradle', 'android/build.gradle', 'android/gradle.properties',
  'android/app/build.gradle', 'android/app/proguard-rules.pro',
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/projectjhs/whileclimbing/MainActivity.java',
  'android/app/src/main/java/com/projectjhs/whileclimbing/GamesBridge.java',
  'android/app/src/main/res/values/strings.xml',
  'android/app/src/main/res/values/themes.xml',
  'android/app/src/main/res/values/colors.xml',
  'android/app/src/main/res/xml/backup_rules.xml',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
  'store/icon-512.png', 'store/feature-1024x500.png',
];
const 없는것 = 있어야할것.filter((f) => !fs.existsSync(path.join(ROOT, f)));
check(없는것.length === 0, '껍데기 파일이 다 있음', 없는것.join(' ') || 있어야할것.length + '개');

// ── 이름 셋이 맞는가 ──────────────────────────────────────
const games = 읽기(path.join(ROOT, 'js', 'games.js'));
const 판이름 = (덩이) => {
  const i = games.indexOf('const ' + 덩이 + ' = [');
  const j = games.indexOf('\n];', i);
  return [...games.slice(i, j).matchAll(/key: '([^']+)'/g)].map((m) => m[1]);
};
const 순위 = 판이름('BOARDS');
const 업적 = 판이름('DEEDS');
check(순위.length === 2 && 업적.length >= 20,
  'js/games.js 에서 이름을 읽음', `순위 ${순위.length} · 업적 ${업적.length}`);

const strings = 읽기(path.join(A, 'res', 'values', 'strings.xml'));
const 문자열있나 = (n) => strings.includes(`name="${n}"`);
const 자바 = 읽기(path.join(A, 'java', 'com', 'projectjhs', 'whileclimbing', 'GamesBridge.java'));

const 자원이름 = (키, 앞) => 앞 +키.replace(/-/g, '_');

const 문자열빠짐 = [];
const 자바빠짐 = [];
순위.forEach((k) => {
  if (!문자열있나(자원이름(k, 'board_'))) 문자열빠짐.push(자원이름(k, 'board_'));
  if (!자바.includes(`"${k}"`)) 자바빠짐.push(k);
});
업적.forEach((k) => {
  if (!문자열있나(자원이름(k, 'deed_'))) 문자열빠짐.push(자원이름(k, 'deed_'));
  if (!자바.includes(`업적("${k}"`)) 자바빠짐.push(k);
});
check(문자열빠짐.length === 0, '게임의 이름이 strings.xml 에 다 있음',
  문자열빠짐.join(' ') || (순위.length + 업적.length) + '개 다 있음');
check(자바빠짐.length === 0, '게임의 이름이 GamesBridge.java 에 다 있음',
  자바빠짐.join(' ') || (순위.length + 업적.length) + '개 다 있음');

// 반대쪽 — strings.xml 에만 있고 게임이 안 부르는 것
const 적힌업적 = [...strings.matchAll(/name="deed_([a-z0-9_]+)"/g)]
  .map((m) => m[1].replace(/_/g, '-'));
const 남는것 = 적힌업적.filter((k) => !업적.includes(k));
check(남는것.length === 0, 'strings.xml 에만 있고 게임이 안 부르는 업적이 없음',
  남는것.join(' ') || '없음');

// 자바가 JS 에 물리는 이름
check(자바.includes('signedIn') && 자바.includes('submit') && 자바.includes('unlock'),
  '다리의 세 함수가 자바에 다 있음');
const main = 읽기(path.join(A, 'java', 'com', 'projectjhs', 'whileclimbing', 'MainActivity.java'));
const 물린이름 = (main.match(/addJavascriptInterface\([^,]+,\s*"([^"]+)"/) || [])[1];
check(물린이름 && games.includes('window.' + 물린이름),
  '자바가 물리는 이름과 게임이 찾는 이름이 같음', 물린이름);

// ── 놓치면 큰일 나는 설정들 ───────────────────────────────
const manifest = 읽기(path.join(A, 'AndroidManifest.xml'));
check(/screenOrientation="portrait"/.test(manifest), '세로로 고정됨');
check(/allowBackup="true"/.test(manifest), '자동 백업이 켜짐 (폰을 바꿔도 기록이 남게)');
// **주석은 빼고 봅니다.** 처음에는 파일에 app_webview 라는 글자가 있는지만
// 봤는데, 규칙에서 그 줄을 빼도 주석에 남아 있어서 그대로 통과했습니다 —
// 돌연변이를 돌려 보고서야 알았습니다.
const 주석뺀것 = (p) => 읽기(p).replace(/<!--[\s\S]*?-->/g, '');
const backup = 주석뺀것(path.join(A, 'res', 'xml', 'backup_rules.xml'));
const 뽑기 = 주석뺀것(path.join(A, 'res', 'xml', 'data_extraction_rules.xml'));
const 담나 = (x) => /<include[^>]*path="app_webview"/.test(x);
check(담나(backup) && 담나(뽑기),
  '백업이 **저장이 실제로 있는 자리**를 담음 (WebView 의 localStorage)',
  '백업 ' + (담나(backup) ? 'O' : 'X') + ' · 옮기기 ' + (담나(뽑기) ? 'O' : 'X'));
check(/INTERNET/.test(manifest), '순위표를 위한 인터넷 권한이 있음');
// 게임 코드는 전부 WebView 안이라, 이걸 빠뜨리면 저장이 통째로 안 남습니다.
check(/setDomStorageEnabled\(true\)/.test(main),
  '**DOM 저장이 켜짐** — 이게 없으면 기록이 하나도 안 남습니다');
check(/__androidBack/.test(main), '뒤로를 게임에게 물어봄');
check(/file:\/\/\/android_asset\/game\.html/.test(main), '합친 한 장을 엶');

const appGradle = 읽기(path.join(ROOT, 'android', 'app', 'build.gradle'));
const 패키지 = (appGradle.match(/applicationId "([^"]+)"/) || [])[1];
check(패키지 === 'com.projectjhs.whileclimbing', '패키지명이 정한 대로', 패키지);
check(main.includes('package ' + 패키지) && 자바.includes('package ' + 패키지),
  '자바의 package 줄이 패키지명과 같음');
const proguard = 읽기(path.join(ROOT, 'android', 'app', 'proguard-rules.pro'));
check(proguard.includes('GamesBridge'),
  '다리가 난독화에서 지켜짐 (이름이 바뀌면 JS 가 못 찾습니다)');

// ── 합친 한 장이 껍데기 안에 있는가 ───────────────────────
const 자산 = path.join(A, 'assets', 'game.html');
if (fs.existsSync(자산)) {
  const a = fs.statSync(자산).size;
  const d = fs.statSync(path.join(ROOT, 'dist', 'index.html')).size;
  check(a === d, '껍데기 안의 한 장 = 방금 만든 dist/index.html',
    Math.round(a / 1024) + 'KB / ' + Math.round(d / 1024) + 'KB');
} else {
  check(false, '껍데기 안에 game.html 이 있음', '없음 — node make-android.js 를 돌리세요');
}

// ── 아직 도형인 것 ────────────────────────────────────────
//
// **어긋남으로 세지 않습니다.** 이건 틀린 것이 아니라 아직 안 한 것이고,
// 이것 때문에 검사가 빨개지면 진짜 어긋남이 안 보입니다.
// 다만 조용히 두면 도형인 채로 스토어에 올라갑니다.
if (!fs.existsSync(path.join(ROOT, 'assets', 'app-icon.png'))) {
  console.log('\n⚠ 아이콘이 아직 **도형**입니다 (코드가 SVG 로 그린 것).');
  console.log('  게임의 다른 그림은 회화풍인데 아이콘만 도형이면 딴 게임처럼 보입니다.');
  console.log('  스토어에 올리기 전에 그림으로 바꾸세요:');
  console.log('    GEMINI_API_KEY=... node gen-sprite.js app-icon   (또는 PROVIDER=openai)');
  console.log('    node gen-icon.js');
}

console.log(bad ? `\n${bad}건 어긋남` : '\n껍데기와 게임이 같은 이름을 봅니다 (자바 컴파일은 사장님 컴퓨터에서)');
process.exit(bad ? 1 : 0);
