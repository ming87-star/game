// ── 유물은 언제 손에 들어오는가 ─────────────────────────
//
//   node relic-pace.js
//
// job-scale.js 는 직업을 「초당 피해 × 실질 체력」으로 재면서 유물 칸을
// **다 채운 것으로** 봅니다 (칸당 ×1.18). 도굴꾼의 94 점은 다섯 칸이 다
// 찬 뒤의 값입니다 — 비어 있으면 94/1.64 ≈ 57 입니다.
//
// 그런데 유물은 200층부터 100층마다 하나씩입니다. 그러니 「다섯 칸」은
// 600층에 가야 뜻이 생기고, 그 전까지 도굴꾼은 **남들과 똑같은 두 칸을
// 든 채 남들보다 약한 수치로** 오릅니다.
//
// 이 도구는 그 어긋남을 층별로 펼칩니다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = ['js/config.js', 'js/forge.js', 'js/classes.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ CFG, CLASSES })';

const { CFG, CLASSES } = vm.runInContext(source, vm.createContext({
  Math,
  Save: { data: { unlocked: {} }, recordWeapon() {} },
  window: { localStorage: { getItem: () => null, setItem() {} } },
  Phaser: { Math: { Clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } },
}));

const 칸값 = 1.18;   // job-scale.js 와 같은 값이라야 견줄 수 있습니다
const 기준칸 = 2;
const R = CFG.relic;

// 그 층까지 유물 자리를 몇 번 밟았나 (200 · 300 · 400 …).
// 시작 유물이 있으면 그만큼 이미 들고 시작합니다.
function 든수(job, floor) {
  const 주운수 = floor < R.from ? 0 : Math.floor((floor - R.from) / R.every) + 1;
  const 시작 = job.startRelics || 0;
  return Math.min(job.relicMax || R.maxHeld, 시작 + 주운수);
}

const 층들 = [0, 100, 200, 300, 400, 500, 600, 700];
const pad = (s, n) => String(s).padStart(n);

console.log('\n── 층마다 유물을 몇 개 들고 있나 ─────────────────────');
console.log('  (' + R.from + '층부터 ' + R.every + '층마다 하나 · 기본 ' + R.maxHeld + '칸)\n');
console.log('  직업      칸   시작' + 층들.map((f) => pad(f + '층', 7)).join(''));
CLASSES.forEach((job) => {
  console.log('  ' + job.name.padEnd(7)
    + pad(job.relicMax || R.maxHeld, 3)
    + pad(job.startRelics || 0, 6) + '  '
    + 층들.map((f) => pad(든수(job, f), 7)).join(''));
});

console.log('\n── 그것이 점수에 곱해지는 배수 (칸당 ×' + 칸값 + ', 두 칸이 1.00) ──\n');
console.log('  직업     ' + 층들.map((f) => pad(f + '층', 7)).join(''));
CLASSES.forEach((job) => {
  console.log('  ' + job.name.padEnd(9)
    + 층들.map((f) => pad(Math.pow(칸값, 든수(job, f) - 기준칸).toFixed(2), 7)).join(''));
});

// ── 표값을 층 위에 다시 앉힙니다 ────────────────────────
// job-scale.js 의 점수는 **칸이 다 찬 뒤**의 값입니다. 가득 찬 보정을
// 나눠서 맨몸 점수를 얻고, 층마다 실제로 든 수로 다시 곱합니다.
// (job-scale 을 직접 돌려 읽습니다 — 두 곳에 같은 셈을 두면 갈라집니다.)
const 표 = {};
try {
  const out = require('child_process')
    .execFileSync(process.execPath, [path.join(__dirname, 'job-scale.js')],
      { encoding: 'utf8' });
  const 이름줄 = /^\s{4}(\S+)\s+(\d+)\s+\(/;
  out.split('\n').forEach((line) => {
    const m = line.match(이름줄);
    if (m) 표[m[1]] = Number(m[2]);
  });
} catch (e) {
  console.log('\n  (job-scale.js 를 못 돌렸습니다 — 점수 표는 건너뜁니다)');
}
if (Object.keys(표).length === CLASSES.length) {
  console.log('\n── 층마다의 실제 점수 (전사의 가득 찬 값을 100 으로) ──');
  console.log('  job-scale.js 의 점수를 「가득 찬 보정」으로 나눠 맨몸 값을 얻고,');
  console.log('  층마다 실제로 든 수로 다시 곱한 것입니다.\n');
  const 맨몸 = {};
  CLASSES.forEach((job) => {
    맨몸[job.key] = 표[job.name] / Math.pow(칸값, (job.relicMax || R.maxHeld) - 기준칸);
  });
  console.log('  직업     ' + 층들.map((f) => pad(f + '층', 7)).join(''));
  CLASSES.forEach((job) => {
    console.log('  ' + job.name.padEnd(9) + 층들.map((f) =>
      pad((맨몸[job.key] * Math.pow(칸값, 든수(job, f) - 기준칸)).toFixed(0), 7)).join(''));
  });
  // 가장 약한 자리가 어디인지 한 줄로.
  const 최약 = 층들.map((f) => {
    const 값 = CLASSES.map((j) => ({ n: j.name, v: 맨몸[j.key] * Math.pow(칸값, 든수(j, f) - 기준칸) }))
      .sort((a, b) => a.v - b.v);
    return f + '층 ' + 값[0].n + '(' + 값[0].v.toFixed(0) + ') — 가장 센 '
      + 값[값.length - 1].n + '(' + 값[값.length - 1].v.toFixed(0) + ') 의 '
      + (값[0].v / 값[값.length - 1].v * 100).toFixed(0) + '%';
  });
  console.log('\n  층마다 가장 약한 직업');
  최약.forEach((l) => console.log('    ' + l));
}

// 도굴꾼이 「다섯 칸 직업」으로 서는 것은 몇 층부터인가.
const 도굴 = CLASSES.find((c) => c.key === 'digger');
if (도굴) {
  let f = 0;
  while (f < 3000 && 든수(도굴, f) < (도굴.relicMax || R.maxHeld)) f += 10;
  console.log('\n  도굴꾼이 다섯 칸을 다 채우는 층: ' + f + '층');
  const 남 = CLASSES.find((c) => c.key === 'warrior');
  let g = 0;
  while (g < 3000 && 든수(도굴, g) <= 든수(남, g)) g += 10;
  console.log('  도굴꾼이 전사보다 많이 들기 시작하는 층: ' + g + '층\n');
}
