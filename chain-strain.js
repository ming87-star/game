// ── 해금 사슬은 고르게 빡빡한가 ─────────────────────────
//
//   node chain-strain.js
//
// 해금이 사슬이 되면서(js/classes.js 의 unlockBy) 각 문은 **정해진 한
// 사람**으로만 열 수 있게 됐습니다. 그러면 「몇 층을 요구하는가」만으로는
// 난이도를 알 수 없습니다 — **누가 그 층까지 가야 하는가**가 함께 들어가야
// 합니다. 센 사람에게 높은 문을 맡기는 것과 약한 사람에게 맡기는 것은
// 전혀 다른 일입니다.
//
// 여는 사람의 점수는 job-scale.js 에서 그대로 읽습니다(그럴듯한 값). 두 곳에
// 같은 셈을 두면 갈라지므로 돌려서 읽습니다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = ['js/config.js', 'js/forge.js', 'js/classes.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ CLASSES, classByKey })';

const { CLASSES, classByKey } = vm.runInContext(source, vm.createContext({
  Math,
  Save: { data: { unlocked: {} }, recordWeapon() {} },
  window: { localStorage: { getItem: () => null, setItem() {} } },
  Phaser: { Math: { Clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } },
}));

// job-scale.js 의 마지막 표(그럴듯한 값을 넣으면 어디에 앉나)를 읽습니다.
const 점수 = {};
try {
  const out = require('child_process')
    .execFileSync(process.execPath, [path.join(__dirname, 'job-scale.js')], { encoding: 'utf8' });
  out.split('\n').forEach((line) => {
    const m = line.match(/^\s{4}(\S+)\s+\d+\s+×\s+[\d.]+\s+=\s+(\d+)/);
    if (m) 점수[m[1]] = Number(m[2]);
  });
} catch (e) {
  console.log('  (job-scale.js 를 못 돌렸습니다)');
}

const pad = (s, n) => String(s).padStart(n);
console.log('\n── 사슬의 각 고리 ─────────────────────────────────────');
console.log('  「그 층까지 가야 하는 사람」이 얼마나 센가. 나눈 값이 클수록');
console.log('  약한 사람에게 높은 문을 맡긴 것입니다.\n');
console.log('  여는 사람        점수   여는 문        층÷점수');

let k = 'warrior';
const 고리 = [];
for (;;) {
  const 다음 = CLASSES.find((j) => j.unlockBy === k);
  if (!다음) break;
  const 여는이 = classByKey(k);
  const s = 점수[여는이.name];
  고리.push({ 여는이: 여는이.name, 열림: 다음.name, 층: 다음.unlockFloor, 점수: s,
    비: s ? 다음.unlockFloor / s : null });
  k = 다음.key;
}
고리.forEach((r) => console.log('  ' + r.여는이.padEnd(10)
  + pad(r.점수 === undefined ? '?' : r.점수, 5) + '   '
  + (r.열림 + ' ' + r.층 + '층').padEnd(16)
  + (r.비 === null ? '?' : r.비.toFixed(1))));

const 값 = 고리.filter((r) => r.비 !== null).map((r) => r.비);
if (값.length) {
  const 최소 = Math.min(...값), 최대 = Math.max(...값);
  const 센곳 = 고리.find((r) => r.비 === 최대);
  console.log('\n  가장 헐거운 고리 ' + 최소.toFixed(1)
    + ' · 가장 빡빡한 고리 ' + 최대.toFixed(1)
    + '  (' + (최대 / 최소).toFixed(1) + '배)');
  console.log('  가장 빡빡한 곳: ' + 센곳.여는이 + '(' + 센곳.점수 + ') 로 '
    + 센곳.층 + '층 — ' + 센곳.열림 + '을 엽니다\n');
}
