// 층 생성기만 수천 번 돌려서 "무엇이 얼마나 자주 나오는지"를 셉니다.
// 브라우저를 띄우지 않으니 즉시 끝납니다. 확률을 만진 뒤 여기부터 확인하세요.
//   node survey.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// const 선언은 스크립트마다 따로 놀기 때문에, 두 파일을 한 덩어리로 붙여
// 같은 스코프에서 실행한 뒤 필요한 것만 꺼냅니다.
const source = ['js/config.js', 'js/tower.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ makeFloor, ITEM_KINDS, CFG })';

const { makeFloor, ITEM_KINDS, CFG } = vm.runInContext(source, vm.createContext({ Math }));

const ITEMS = ['plus', 'heal', 'upgrade', 'double'];

function survey(from, to, rounds) {
  const floorHas = {};
  let floors = 0;
  let bothItems = 0;

  for (let r = 0; r < rounds; r++) {
    for (let i = from; i < to; i++) {
      const f = makeFloor(i);
      if (f.shop) continue;
      floors++;

      const kinds = [];
      for (const lane of ['left', 'right']) {
        if (f.slots[lane]) kinds.push(f.slots[lane].kind);
      }
      new Set(kinds).forEach((k) => { floorHas[k] = (floorHas[k] || 0) + 1; });
      if (kinds.length === 2 && kinds.every((k) => ITEM_KINDS.has(k))) bothItems++;
    }
  }
  return { floors, floorHas, bothItems };
}

const pct = (n, d) => ((n || 0) / d * 100).toFixed(1).padStart(5) + '%';

console.log('한 층에 올라섰을 때 그것을 마주칠 확률 (좌우 두 칸 중 하나라도)\n');
console.log('  구간        아이템    +1     회복     UP     ×2    적    양쪽다아이템   UP 간격');

for (const [a, b] of [[1, 30], [30, 70], [70, 120], [120, 200]]) {
  const r = survey(a, b, 400);
  const anyItem = ITEMS.reduce((s, k) => s + (r.floorHas[k] || 0), 0);
  const upGap = r.floors / (r.floorHas.upgrade || 1);

  console.log(
    `  ${String(a).padStart(3)}~${String(b).padStart(3)}층  ` +
    pct(anyItem, r.floors) + ' ' +
    pct(r.floorHas.plus, r.floors) + ' ' +
    pct(r.floorHas.heal, r.floors) + ' ' +
    pct(r.floorHas.upgrade, r.floors) + ' ' +
    pct(r.floorHas.double, r.floors) + ' ' +
    pct(r.floorHas.enemy, r.floors) + '   ' +
    pct(r.bothItems, r.floors) + '     ' +
    upGap.toFixed(0) + '층마다');
}

console.log('\n무기를 끝까지 올리려면 UP이 ' + (CFG.weapons.length - 1) + '개 필요합니다.');
