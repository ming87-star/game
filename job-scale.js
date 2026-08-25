// 직업을 같은 자로 재서 한 숫자로 냅니다 — **초당 피해 × 실질 체력**.
//
//   node job-scale.js
//
// ── 왜 이 자인가 ────────────────────────────────────────
// 직업이 여덟이 됩니다. 「세기는 같고 성격만 다르다」를 눈으로 지킬 수는
// 없습니다 — 여덟을 서로 견주면 스물여덟 쌍입니다.
//
// 화력과 맷집을 곱하면 **얼마나 오래 살아서 얼마나 때리는가**가 한 숫자로
// 나옵니다. 도적을 100 으로 놓고 나머지를 그 옆에 세웁니다.
//
// ── 이 자가 못 재는 것 ──────────────────────────────────
// **이 표는 답이 아니라 시작점입니다.** 직업마다 이 자에 안 잡히는 것이
// 하나씩 있고, 그게 바로 직업을 직업으로 만드는 것입니다.
//
//   전사    사거리가 넓어 **한 번에 여럿**이 맞습니다. 표의 초당 피해는
//           한 놈에게 들어가는 몫이라 발판에 몰려 있을 때는 몇 배가 됩니다
//   궁수    shots 는 **서로 다른 적**을 동시에 노립니다. 곱해 두긴 했지만
//           적이 하나뿐이면 그 몫이 통째로 놀고 있습니다
//   도적    **훔칩니다.** 코인은 이 자에 안 잡히는데, 코인이 무기가 되고
//           무기가 화력이 되므로 결국 세기입니다
//
// 그래서 **재고 나서 곧바로 고치지 않습니다.** 숫자를 먼저 놓고 봅니다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = ['js/config.js', 'js/forge.js', 'js/classes.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ CFG, CLASSES, buildWeaponPool, weaponPoolAt })';

const { CFG, CLASSES, weaponPoolAt } = vm.runInContext(source, vm.createContext({
  Math,
  Save: { data: { unlocked: {} }, recordWeapon() {} },
  window: { localStorage: { getItem: () => null, setItem() {} } },
  Phaser: { Math: { Clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } },
}));

// ── 강화를 몇 단 쌓은 것으로 보나 ───────────────────────
// **이 값이 답을 크게 흔듭니다.** 속도 한계가 직업마다 다르기 때문입니다 —
// 전사는 ×1.30 에서 멎는데 도적은 ×2.5 까지 갑니다. 많이 쌓았다고 보면
// 전사만 한계에 걸려 멎고 도적은 계속 자라서, **자를 어디에 두느냐가
// 곧 답이 됩니다.**
//
// 그래서 손으로 정하지 않고 **survey.js 와 같은 값**을 씁니다. 갈아타면
// 강화가 전부 날아가므로 실제로 들고 있는 것은 마지막으로 갈아탄 뒤에
// 주운 것뿐이고, 자루가 40~50층마다 하나씩 열립니다 (survey.js 의 stacks).
//   node job-scale.js 6     ← 굳이 다른 값으로 보고 싶을 때만
const PLUS_PACE = 0.055;   // 층당 +1 을 마주치는 빈도 (survey.js 와 같은 값)
const STACKS = Number(process.argv[2]) || Math.max(1, Math.round(45 * PLUS_PACE));
const FLOORS = [0, 50, 120, 250, 400, 550];

// 한 직업을 한 층에서 재서 { dps, ehp, score } 를 냅니다.
function measure(job, f) {
  const pool = weaponPoolAt(job, f);
  const boost = 1 + STACKS * CFG.plusStep * (job.plusScale || 1);
  const speed = Math.min(job.speedCap, 1 + STACKS * CFG.hasteStep);

  // 그 층에 나오는 자루들의 **한가운데**를 그 직업의 화력으로 봅니다.
  // 어느 하나를 집으면 운 좋은 판만 재게 됩니다.
  const each = pool
    .map((x) => (x.dmgMin + x.dmgMax) / 2 * boost * (x.shots || 1) * x.acc / (x.rate / speed) * 1000)
    .sort((a, b) => a - b);
  const dps = each[Math.floor(each.length / 2)];

  // 방어·회피도 판이 진행될수록 한계 쪽으로 자랍니다. 절반쯤 채운 것으로 봅니다.
  const grow = Math.min(1, f / 250);
  const dodge = job.dodge + ((job.dodgeMax || job.dodge) - job.dodge) * grow * 0.7;
  const armorCap = job.armorMax || job.armor;
  const armor = job.usesArmor ? job.armor + (armorCap - job.armor) * grow * 0.7 : job.armor;

  // 한 대에 실제로 들어오는 몫은 (1−회피)×(1−방어/100). 실질 체력은 그 몫으로 나눈 값.
  const taken = (1 - dodge) * (1 - armor / 100);
  const ehp = job.hp / taken;
  return { dps, ehp, dodge, armor, score: dps * ehp / 1000 };
}

const pad = (s, n) => String(s).padStart(n);

console.log('\n초당 피해 × 실질 체력 — 도적을 100 으로 (강화 ' + STACKS + '단)\n');
console.log('  층    직업    초당 피해   회피   방어   실질 체력      점수   도적 대비');
console.log('  ' + '─'.repeat(72));

const totals = {};
for (const f of FLOORS) {
  const row = CLASSES.map((job) => ({ job, m: measure(job, f) }));
  const base = (row.find((r) => r.job.key === 'rogue') || row[row.length - 1]).m.score;
  for (const { job, m } of row) {
    const rel = m.score / base * 100;
    (totals[job.key] = totals[job.key] || []).push(rel);
    console.log(
      '  ' + pad(f, 3) + '   ' + job.name +
      pad(Math.round(m.dps), 10) +
      pad((m.dodge * 100).toFixed(0) + '%', 7) +
      pad(m.armor.toFixed(0) + '%', 7) +
      pad(Math.round(m.ehp), 12) +
      pad(Math.round(m.score), 10) +
      pad(rel.toFixed(0), 10) + (job.key === 'rogue' ? '  ←' : ''));
  }
  console.log('');
}

console.log('  층을 가로질러 고른 값 (도적 = 100)\n');
CLASSES.forEach((job) => {
  const v = totals[job.key];
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  console.log('    ' + job.name + pad(avg.toFixed(0), 8) +
    '     (' + lo.toFixed(0) + ' ~ ' + hi.toFixed(0) + ')');
});

// ── 새 직업이 들어올 자리 ────────────────────────────────
// 지금 셋이 실제로 얼마나 벌어져 있는지를 먼저 봐야, 새 직업에게 무엇을
// 요구할지 정할 수 있습니다. **셋이 이미 벌어져 있는데 새 직업만 95~105
// 안에 맞추라고 하면 그게 더 이상합니다.**
const avgs = CLASSES.map((j) => {
  const v = totals[j.key];
  return v.reduce((a, b) => a + b, 0) / v.length;
});
console.log('\n  지금 셋이 벌어진 폭: ' +
  Math.round(Math.min(...avgs)) + ' ~ ' + Math.round(Math.max(...avgs)) +
  '  (가장 센 쪽이 가장 약한 쪽의 ' + (Math.max(...avgs) / Math.min(...avgs)).toFixed(2) + '배)');
console.log('\n  ※ 이 표에 안 잡히는 것 — 전사의 광역, 궁수의 shots 가 노는 경우, 도적의 절도.');
console.log('     파일 맨 위 주석을 보세요. **표는 답이 아니라 시작점입니다.**\n');
