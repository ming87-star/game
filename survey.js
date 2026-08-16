// 층 생성기만 수천 번 돌려서 "무엇이 얼마나 자주 나오는지"를 셉니다.
// 브라우저를 띄우지 않으니 즉시 끝납니다. 확률을 만진 뒤 여기부터 확인하세요.
//   node survey.js        기본 400판
//   node survey.js 1000   더 정밀하게
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// const 선언은 스크립트마다 따로 놀기 때문에, 두 파일을 한 덩어리로 붙여
// 같은 스코프에서 실행한 뒤 필요한 것만 꺼냅니다.
// 무기표는 직업이 들고 있으므로 classes.js도 같이 붙입니다. classes.js는 Save를
// 참조하지만 여기서 쓰는 것은 무기표뿐이라, 빈 껍데기 하나만 세워 두면 됩니다.
const source = ['js/config.js', 'js/forge.js', 'js/classes.js', 'js/tower.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ makeFloor, resetTowerRun, healNeedFrom, treasureFloorFor, LANES, ITEM_KINDS, CFG, CLASSES, buildWeaponPool, weaponPoolAt })';

const { makeFloor, resetTowerRun, healNeedFrom, treasureFloorFor, LANES, ITEM_KINDS, CFG, CLASSES,
  buildWeaponPool, weaponPoolAt } =
  vm.runInContext(source, vm.createContext({
    Math,
    Save: { data: { unlocked: {} }, recordWeapon() {} },
    window: { localStorage: { getItem: () => null, setItem() {} } },
    // forge.js 가 Phaser.Math.Clamp 를 씁니다. 브라우저를 안 띄우므로 흉내만 냅니다.
    Phaser: { Math: { Clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } },
  }));

// 층별 곡선은 직업 하나를 골라서 봅니다.  node survey.js 400 1 archer
const JOB = CLASSES.find((c) => c.key === process.argv[4]) || CLASSES[0];
const WEAPONS = JOB.weapons;

const ROUNDS = Number(process.argv[2]) || 400;
// 회복은 체력에 따라 확률이 달라집니다. 기본은 체력이 가득한 상태로 셉니다.
//   node survey.js 400 0.3   → 체력 30%인 상태의 확률
const HP_RATIO = process.argv[3] === undefined ? 1 : Number(process.argv[3]);

const TOP = 200;
const ITEMS = ['plus', 'haste', 'heal', 'armor', 'upgrade', 'double'];
const TRAPS = ['bomb', 'mimic'];
const BANDS = [[1, 30], [30, 70], [70, 120], [120, 200]];

const NEED = healNeedFrom(HP_RATIO, 1);

const stat = () => ({ floors: 0, has: {}, laneCount: [0, 0, 0, 0], twoItems: 0 });
const bandStats = BANDS.map(stat);
const upPerBand = new Map(); // 50층 구간마다 UP이 몇 개 나왔는지

for (let round = 0; round < ROUNDS; round++) {
  resetTowerRun(); // 판마다 UP 배치를 새로 뽑습니다

  for (let i = 1; i <= TOP; i++) {
    const floor = makeFloor(i, NEED);
    if (floor.shop) continue;

    const kinds = LANES.map((l) => floor.slots[l]).filter(Boolean).map((s) => s.kind);

    const band = Math.floor((i - 1) / CFG.shopEvery);
    const key = round + ':' + band;
    upPerBand.set(key, (upPerBand.get(key) || 0) + kinds.filter((k) => k === 'upgrade').length);

    for (const [b, [from, to]] of BANDS.entries()) {
      if (i < from || i >= to) continue;
      const s = bandStats[b];
      s.floors++;
      s.laneCount[kinds.length]++;
      new Set(kinds).forEach((k) => { s.has[k] = (s.has[k] || 0) + 1; });
      if (kinds.filter((k) => ITEM_KINDS.has(k)).length >= 2) s.twoItems++;
    }
  }
}

const pct = (n, d) => ((n || 0) / d * 100).toFixed(1).padStart(5) + '%';

console.log(`${ROUNDS}판 × ${TOP}층 · 체력 ${Math.round(HP_RATIO * 100)}% 상태 기준\n`);
console.log('한 층에 올라섰을 때 그것을 마주칠 확률 (길 중 하나라도)\n');
console.log('  구간        아이템    +1      속     방     회복     UP     ×2    상자   개구리    적     함정    폭탄    가짜');

for (const [b, [from, to]] of BANDS.entries()) {
  const s = bandStats[b];
  const anyItem = ITEMS.reduce((a, k) => a + (s.has[k] || 0), 0);
  console.log(
    `  ${String(from).padStart(3)}~${String(to).padStart(3)}층  ` +
    [anyItem, s.has.plus, s.has.haste, s.has.armor, s.has.heal, s.has.upgrade, s.has.double,
      s.has.treasure, s.has.goldfrog, s.has.enemy,
      TRAPS.reduce((a, k) => a + (s.has[k] || 0), 0), s.has.bomb, s.has.mimic]
      .map((n) => pct(n, s.floors)).join(' '));
}

// 보물상자도 UP 처럼 확률이 아니라 배치입니다. 여기서 노리는 것은 "구간마다
// 하나"가 아니라 **"보스 하나를 지나는 동안 세 번 이상"** 입니다.
//
// 판을 여러 번 뽑아서 봐야 합니다. 한 판만 보면, 구간 폭이 보스 간격을
// 나누어떨어지지 않아 어쩌다 두 번뿐인 판이 섞이는 것을 놓칩니다.
{
  const per = [];
  for (let round = 0; round < 200; round++) {
    resetTowerRun();
    for (let band = 0; band * CFG.bossEvery < 800; band++) {
      let n = 0;
      const from = band * CFG.bossEvery + 1;
      for (let f = from; f < from + CFG.bossEvery; f++) if (f === treasureFloorFor(f)) n++;
      per.push(n);
    }
  }
  const worst = Math.min(...per);
  console.log(`\n보스 사이(${CFG.bossEvery}층)마다 나온 보물상자 — ${per.length}구간 중` +
    ` 가장 적을 때 ${worst}개 · 가장 많을 때 ${Math.max(...per)}개`);
  console.log(worst >= 3 ? '  ✓ 어느 구간에서도 세 번 이상' : '  ✗ 세 번을 못 채우는 구간이 있습니다');
}

console.log('\n갈림길 수 (한 층에 놓인 길의 개수)\n');
for (const [b, [from, to]] of BANDS.entries()) {
  const s = bandStats[b];
  console.log(`  ${String(from).padStart(3)}~${String(to).padStart(3)}층   ` +
    `외길 ${pct(s.laneCount[1], s.floors)}   두 갈래 ${pct(s.laneCount[2], s.floors)}   세 갈래 ${pct(s.laneCount[3], s.floors)}`);
}

// UP은 확률이 아니라 배치입니다. 구간마다 정확히 하나여야 합니다.
const counts = {};
upPerBand.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
const bandsSeen = upPerBand.size;
console.log(`\n${CFG.shopEvery}층 구간마다 나온 무기 칸 개수 — ` +
  Object.keys(counts).sort().map((n) => `${n}개: ${pct(counts[n], bandsSeen)}`).join('   '));
console.log(counts['1'] === bandsSeen ? '  ✓ 모든 구간에 정확히 하나' : '  ✗ 구간당 하나가 아닌 경우가 있습니다');
console.log(`\n${JOB.name} 무기 주머니에 자루가 ${buildWeaponPool(JOB).length}개 있습니다` +
  ` (자루 ${WEAPONS.length} × 만듦새 둘). 무기 칸은 지도에서 ${CFG.shopEvery}층당 1개` +
  ` + 상점에서 1개 — 사다리가 아니라 그때그때 굴려 나옵니다.`);

// ── 화력과 체력의 곡선 ──────────────────────────────────
// ── 층별 화력 대 체력 ──────────────────────────────────
//
// 무기가 사다리에서 주머니로 바뀌면서 이 표가 묻는 것도 달라졌습니다.
// 예전에는 "그 층에서 드는 무기 한 자루"가 정해져 있었지만, 지금은 그 층에서
// **나올 수 있는 자루가 여럿**입니다. 그래서 가장 약한 자루와 가장 센 자루를
// 같이 적습니다 — 그 폭이 곧 "운이 얼마나 갈리나"입니다.
//
// 적 체력은 층을 안 탑니다 (js/enemies.js 의 enemyHpScale). 그러니 이 표에서
// 봐야 할 것은 **한 마리 잡는 시간이 위층으로 가면서 짧아지는 정도**입니다.
// 너무 빨리 짧아지면 후반이 싱거워지고, 안 짧아지면 답답해집니다.
const plusPace = 0.055; // 층당 +1을 마주치는 빈도 (survey 위쪽 표와 같습니다)

// 갈아타면 강화가 전부 날아갑니다. 그러니 실제로 들고 있는 강화는 층수에
// 비례하지 않고 **마지막으로 갈아탄 뒤에 주운 것**만 남습니다.
// 자루가 40~50층마다 하나씩 열리므로 그 언저리를 갈아타는 주기로 봅니다.
const stacks = Math.max(1, Math.round(45 * plusPace));

console.log(`\n\n층별 화력 대 체력 (그 층에 나오는 자루들 · +${stacks} 쌓은 경우)\n`);
console.log('  층   그 층에 나오는 자루         가장 약한~센 초당피해   보통적  단단   거인    한 마리 잡는 시간');

const hpAt = (mult) => Math.round(CFG.enemy.baseHp * mult);
const NORMAL = hpAt(1.0);
const BRUTE = hpAt(2.4);
const GIANT = hpAt(3.5);

for (let f = 0; f <= 600; f += f < 200 ? 40 : 50) {
  const pool = weaponPoolAt(JOB, f);
  const boost = 1 + stacks * CFG.plusStep * (JOB.plusScale || 1);
  const speed = Math.min(JOB.speedCap, 1 + stacks * CFG.hasteStep);
  const dpsOf = (w) => (w.dmgMin + w.dmgMax) / 2 * boost * (w.shots || 1) * w.acc
    / (w.rate / speed) * 1000;

  const lo = pool.reduce((a, w) => (dpsOf(w) < dpsOf(a) ? w : a));
  const hi = pool.reduce((a, w) => (dpsOf(w) > dpsOf(a) ? w : a));
  const mid = (dpsOf(lo) + dpsOf(hi)) / 2;

  console.log(
    `  ${String(f).padStart(3)}  ${(pool.length + '자루  ' + lo.name + ' ~ ' + hi.name).padEnd(28)}` +
    ` ${String(Math.round(dpsOf(lo))).padStart(5)}~${String(Math.round(dpsOf(hi))).padStart(5)}` +
    `   ${String(NORMAL).padStart(5)} ${String(BRUTE).padStart(5)} ${String(GIANT).padStart(6)}` +
    `    보통 ${(NORMAL / mid).toFixed(1)}초 · 거인 ${(GIANT / mid).toFixed(1)}초`);
}

// ── 직업 셋을 나란히 ────────────────────────────────────
// 자동 플레이는 실시간이라 같은 씨앗을 줘도 판마다 갈라집니다 (기계가 바쁘면
// 결과가 통째로 바뀝니다 — 손 안 댄 직업이 154층에서 118층으로 내려앉는 것을
// 봤습니다). 20%짜리 손질은 그 잡음 안에 묻힙니다.
//
// 그래서 **셈으로 낼 수 있는 것은 셈으로 냅니다.** 화력과 맷집은 수식이라
// 돌릴 때마다 같은 답이 나옵니다. 자동 플레이는 그 뒤에 "그래서 실제로도
// 그런가"를 보는 데만 씁니다.
//
// 맷집을 재는 방법: 회피는 확률이라 평균으로 환산합니다. 한 대에 실제로
// 들어오는 몫은 (1 - 회피) × (1 - 방어/100) 이므로, 실질 체력은 체력을
// 그 몫으로 나눈 값입니다. 도적의 회피와 전사의 방어를 같은 자로 잽니다.
console.log('\n\n직업 셋을 같은 자로 (UP을 매번 챙기고 강화를 같이 쌓은 경우)\n');
// 근접의 초당 피해는 **한 놈에게 들어가는 몫**입니다. 전사는 사거리가 넓어
// 한 번에 여럿이 함께 맞으므로, 발판에 몰려 있을 때의 실제 화력은 이 값의
// 몇 배입니다. 표만 보고 "전사가 제일 약하다"로 읽으면 안 됩니다.
console.log('  층    직업    무기            초당 피해   회피   방어   한 대에 들어오는 몫   실질 체력');

for (const f of [0, 50, 120, 250, 400, 550]) {
  for (const job of CLASSES) {
    // 그 층에 나오는 자루들의 **한가운데**를 그 직업의 화력으로 봅니다.
    // 어느 하나를 집으면 운 좋은 판만 재게 됩니다.
    const pool = weaponPoolAt(job, f);
    const boostAt = 1 + stacks * CFG.plusStep * (job.plusScale || 1);
    const speed = Math.min(job.speedCap, 1 + stacks * CFG.hasteStep);
    const each = pool.map((x) => (x.dmgMin + x.dmgMax) / 2 * boostAt * (x.shots || 1) * x.acc
      / (x.rate / speed) * 1000).sort((a, b) => a - b);
    const dps = each[Math.floor(each.length / 2)];
    const w = pool[Math.floor(pool.length / 2)];

    // 방어·회피도 판이 진행될수록 한계 쪽으로 자랍니다. 절반쯤 채운 것으로 봅니다.
    const grow = Math.min(1, f / 250);
    const dodge = job.dodge + (job.dodgeMax - job.dodge || 0) * grow * 0.7;
    const armorCap = job.armorMax || job.armor;
    const armor = job.usesArmor ? job.armor + (armorCap - job.armor) * grow * 0.7 : job.armor;

    const taken = (1 - dodge) * (1 - armor / 100);
    const ehp = job.hp / taken;

    console.log(
      `  ${String(f).padStart(3)}   ${job.name}    ${w.name.padEnd(12)}` +
      ` ${String(Math.round(dps)).padStart(8)}` +
      ` ${(dodge * 100).toFixed(0).padStart(5)}% ${armor.toFixed(0).padStart(5)}%` +
      `           ${taken.toFixed(3)}   ${String(Math.round(ehp)).padStart(6)}`);
  }
  console.log('');
}
