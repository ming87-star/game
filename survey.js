// 층 생성기만 수천 번 돌려서 "무엇이 얼마나 자주 나오는지"를 셉니다.
// 브라우저를 띄우지 않으니 즉시 끝납니다. 확률을 만진 뒤 여기부터 확인하세요.
//   node survey.js        기본 400판
//   node survey.js 1000   더 정밀하게
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// const 선언은 스크립트마다 따로 놀기 때문에, 두 파일을 한 덩어리로 붙여
// 같은 스코프에서 실행한 뒤 필요한 것만 꺼냅니다.
const source = ['js/config.js', 'js/tower.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ makeFloor, resetTowerRun, LANES, ITEM_KINDS, CFG })';

const { makeFloor, resetTowerRun, LANES, ITEM_KINDS, CFG } =
  vm.runInContext(source, vm.createContext({ Math }));

const ROUNDS = Number(process.argv[2]) || 400;
const TOP = 200;
const ITEMS = ['plus', 'heal', 'upgrade', 'double'];
const BANDS = [[1, 30], [30, 70], [70, 120], [120, 200]];

const stat = () => ({ floors: 0, has: {}, laneCount: [0, 0, 0, 0], twoItems: 0 });
const bandStats = BANDS.map(stat);
const upPerBand = new Map(); // 50층 구간마다 UP이 몇 개 나왔는지

for (let round = 0; round < ROUNDS; round++) {
  resetTowerRun(); // 판마다 UP 배치를 새로 뽑습니다

  for (let i = 1; i <= TOP; i++) {
    const floor = makeFloor(i);
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

console.log(`${ROUNDS}판 × ${TOP}층\n`);
console.log('한 층에 올라섰을 때 그것을 마주칠 확률 (길 중 하나라도)\n');
console.log('  구간        아이템    +1     회복     UP     ×2     적    아이템둘이상');

for (const [b, [from, to]] of BANDS.entries()) {
  const s = bandStats[b];
  const anyItem = ITEMS.reduce((a, k) => a + (s.has[k] || 0), 0);
  console.log(
    `  ${String(from).padStart(3)}~${String(to).padStart(3)}층  ` +
    [anyItem, s.has.plus, s.has.heal, s.has.upgrade, s.has.double, s.has.enemy]
      .map((n) => pct(n, s.floors)).join(' ') + '   ' + pct(s.twoItems, s.floors));
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
console.log(`\n${CFG.shopEvery}층 구간마다 나온 UP 개수 — ` +
  Object.keys(counts).sort().map((n) => `${n}개: ${pct(counts[n], bandsSeen)}`).join('   '));
console.log(counts['1'] === bandsSeen ? '  ✓ 모든 구간에 정확히 하나' : '  ✗ 구간당 하나가 아닌 경우가 있습니다');
console.log(`\n무기를 끝까지 올리려면 UP이 ${CFG.weapons.length - 1}개 필요합니다.` +
  ` 지도에서 ${CFG.shopEvery}층당 1개 + 상점에서 최대 1개.`);
