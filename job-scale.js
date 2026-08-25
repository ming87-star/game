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

// ── 아직 안 붙은 직업 다섯 ──────────────────────────────
//   node job-scale.js --draft
// draft-jobs.js 의 초안을 여덟 줄로 함께 세웁니다. 이름 예순 개를 짓기 전에
// **숫자부터 맞춰 놓으려고** 있는 길입니다.
const DRAFT_ON = process.argv.includes('--draft');
let 칸값 = 1;
let 기준칸 = 2;
if (DRAFT_ON) {
  const d = require('./draft-jobs.js');
  칸값 = d.칸값;
  기준칸 = d.기준칸;
  d.DRAFT.forEach((x) => CLASSES.push(d.expand(x)));
}

// 유물 칸이 몇이냐도 세기입니다. 기준(2칸)에서 벗어난 만큼 곱합니다 —
// 까닭과 어림한 값은 draft-jobs.js 아래쪽에 있습니다.
const 칸보정 = (job) => Math.pow(칸값, (job.relicMax || 기준칸) - 기준칸);

// 한 직업을 한 층에서 재서 { dps, ehp, score } 를 냅니다.
function measure(job, f) {
  const pool = weaponPoolAt(job, f);
  const boost = 1 + STACKS * CFG.plusStep * (job.plusScale || 1);
  const speed = Math.min(job.speedCap, 1 + STACKS * CFG.hasteStep);

  // 그 층에 나오는 자루들의 **한가운데**를 그 직업의 화력으로 봅니다.
  // 어느 하나를 집으면 운 좋은 판만 재게 됩니다.
  // ── 자루에 붙은 효과 ────────────────────────────────
  // burn   한 대에 얹히는 지속 피해 몫. 초당 피해에 그대로 곱해집니다
  // shield 실질 체력을 이만큼 올립니다
  // 관통·광역은 **여럿에게 닿는 것**이라 여기 안 잡힙니다 — 이 표의 초당
  // 피해는 처음부터 「한 놈에게 들어가는 몫」입니다 (전사의 사거리와 같은 자리).
  // ── 여벌 발사체는 절반만 셉니다 ──────────────────────
  // `shots` 는 **한 번에 노리는 서로 다른 적의 수**입니다 (README 「궁수는
  // 위만 쏩니다」). 그런데 이 표의 초당 피해는 처음부터 **한 놈에게 들어가는
  // 몫**입니다 — 그냥 곱하면 여벌 화살이 전부 그 한 놈에게 꽂히는 셈이 되어
  // 궁수와 마법사가 부풀려집니다.
  //
  // 그렇다고 0 으로 두면 안 됩니다. 발판에 여럿 있을 때는 실제로 값이 나고,
  // 그런 자리가 드물지 않습니다. **여벌 하나당 절반**으로 봅니다.
  //
  // 이 한 줄이 궁수를 몇 점 내립니다. 그래도 그쪽이 맞습니다 — 부풀린 값을
  // 기준으로 새 직업 다섯을 맞추면 다섯이 다 같이 부풀려집니다.
  const 발사체 = (n) => 1 + ((n || 1) - 1) * 0.5;
  const each = pool
    .map((x) => (x.dmgMin + x.dmgMax) / 2 * boost * 발사체(x.shots) * x.acc
      * (1 + (x.burn || 0)) / (x.rate / speed) * 1000)
    .sort((a, b) => a - b);
  const dps = each[Math.floor(each.length / 2)];

  // 보호막은 자루마다 다르므로 **그 층 자루들의 한가운데**로 봅니다 —
  // 초당 피해를 한가운데로 보는 것과 같은 이유입니다.
  const shields = pool.map((x) => x.shield || 1).sort((a, b) => a - b);
  const shield = shields[Math.floor(shields.length / 2)];

  // 방어·회피도 판이 진행될수록 한계 쪽으로 자랍니다. 절반쯤 채운 것으로 봅니다.
  const grow = Math.min(1, f / 250);
  const dodge = job.dodge + ((job.dodgeMax || job.dodge) - job.dodge) * grow * 0.7;
  const armorCap = job.armorMax || job.armor;
  const armor = job.usesArmor ? job.armor + (armorCap - job.armor) * grow * 0.7 : job.armor;

  // 한 대에 실제로 들어오는 몫은 (1−회피)×(1−방어/100). 실질 체력은 그 몫으로 나눈 값.
  const taken = (1 - dodge) * (1 - armor / 100);
  const ehp = job.hp / taken * shield;
  return { dps, ehp, dodge, armor, score: dps * ehp / 1000 * 칸보정(job) };
}

// ── 값을 바꿔 보기 ──────────────────────────────────────
// **고치기 전에 재 봅니다.** 수치 하나를 바꾸면 여덟 직업 스물여덟 쌍이
// 같이 움직이는데, 코드를 고쳐 놓고 재면 되돌릴 때 손이 갑니다.
//
//   node job-scale.js --set rogue.dodgeMax=0.70
//   node job-scale.js --set rogue.dodgeMax=0.70 --set warrior.hp=240
const 바꾼것 = [];
process.argv.forEach((a, i) => {
  if (a !== '--set') return;
  const m = /^([a-z]+)\.([A-Za-z]+)=(-?[\d.]+)$/.exec(process.argv[i + 1] || '');
  if (!m) { console.error('--set 은 직업.값=수 꼴입니다 (예: rogue.dodgeMax=0.70)'); process.exit(1); }
  const job = CLASSES.find((j) => j.key === m[1]);
  if (!job) { console.error('그런 직업이 없습니다: ' + m[1]); process.exit(1); }
  바꾼것.push(job.name + ' ' + m[2] + ' ' + job[m[2]] + ' → ' + m[3]);
  job[m[2]] = Number(m[3]);
});

const pad = (s, n) => String(s).padStart(n);

if (바꾼것.length) console.log('\n바꿔 본 값: ' + 바꾼것.join(' · '));
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

// 새 직업이 앉을 자리. 지금 셋이 53(전사) ~ 100(도적) 이므로 그 한가운데를
// 기본으로 둡니다 — 어디에 앉힐지는 **해금이 얼마나 어려운가**로 정할 일이라
// (전사는 공짜라 약하고 도적은 700층이라 셉니다) 아직 안 정했습니다.
//   node job-scale.js --draft 85
const TARGET = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a) && Number(a) > 10)) || 75;

console.log('  층을 가로질러 고른 값 (도적 = 100)\n');
CLASSES.forEach((job) => {
  const v = totals[job.key];
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const 칸 = job.relicMax || 기준칸;
  console.log('    ' + job.name.padEnd(5) + pad(avg.toFixed(0), 6) +
    '   (' + lo.toFixed(0) + '~' + hi.toFixed(0) + ')' +
    '   유물 ' + 칸 + '칸');
});

// ── 표에 안 잡히는 이득은 「몇 배여야 하는가」로 냅니다 ────
// 짐작한 값을 곱해서 점수를 맞추면, **깎는 값도 제가 정하고 수치도 제가
// 정하는 셈이라 어떤 답이든 나옵니다.** 사령술사가 낮으면 부하 값을 올리면
// 되고 높으면 내리면 됩니다. 그건 재는 것이 아니라 맞추는 것입니다.
//
// 거꾸로 냅니다 — 수치는 성격에서만 정하고, **「그 능력이 몇 배어치여야
// 이 자리에 서는가」를 셈이 내놓습니다.** 그 배수가 말이 되는지는 사람이
// 판단할 일이고, 말이 안 되면 그때 수치를 고칩니다.
const 초안 = CLASSES.filter((j) => j.표에안잡힘);
if (초안.length) {
  console.log('\n  표에 안 잡히는 이득이 **몇 배어치여야** 목표 ' + TARGET + ' 에 서는가\n');
  초안.forEach((job) => {
    const v = totals[job.key];
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    console.log('    ' + job.name.padEnd(5) + '지금 ' + pad(avg.toFixed(0), 3) +
      '  →  ×' + (TARGET / avg).toFixed(1) + '   ' + job.표에안잡힘);
  });
  console.log('\n  ×1.0 근처면 수치가 맞은 것이고, ×2 를 넘으면 그 능력 하나로');
  console.log('  메우기 어렵다는 뜻입니다 — **수치를 올려야 합니다.**');

  // ── 그럴듯한 값을 넣으면 어디에 앉나 ───────────────────
  // 위의 「목표 75」는 제가 임의로 잡은 자리입니다. 여덟이 다 한 점에 모여야
  // 할 까닭도 없습니다 — 지금 셋도 53·67·100 으로 벌어져 있고 그게 의도입니다.
  //
  // 그래서 **그 능력이 실제로 몇 배쯤일지**를 따로 적어 두고(draft-jobs.js 의
  // `그럴듯`, 까닭은 그 옆 주석에), 그 값으로 앉는 자리를 냅니다.
  // 여기가 이 표의 진짜 답입니다.
  if (초안.some((x) => x.그럴듯)) {
    // 머리글의 기준값도 셈에서 꺼냅니다 — 손으로 적어 두면 수식을 고칠
    // 때 같이 안 고쳐집니다 (README 직업 표가 그래서 한동안 틀렸습니다).
    const 기존 = ['warrior', 'archer', 'rogue'].map((k) => {
      const j2 = CLASSES.find((x) => x.key === k);
      const v = totals[k];
      return j2.name + ' ' + Math.round(v.reduce((a, b) => a + b, 0) / v.length);
    }).join(' · ');
    console.log('\n  그럴듯한 값을 넣으면 어디에 앉나 (' + 기존 + ')\n');
    const 자리 = 초안.map((job) => {
      const v = totals[job.key];
      const avg = v.reduce((a, b) => a + b, 0) / v.length;
      return { job, 앉음: avg * (job.그럴듯 || 1), 맨몸: avg };
    }).sort((a, b) => a.앉음 - b.앉음);
    자리.forEach(({ job, 앉음, 맨몸 }) => {
      console.log('    ' + job.name.padEnd(5) + pad(맨몸.toFixed(0), 4) + ' × ' +
        (job.그럴듯 || 1).toFixed(2) + '  =  ' + pad(앉음.toFixed(0), 4) +
        '   ' + job.표에안잡힘);
    });
  }
}

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
