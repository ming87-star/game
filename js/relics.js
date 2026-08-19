// 유물.
//
// 200층부터 100층 구간마다 하나씩 놓입니다. 밟으면 게임이 멈추고 세 장이
// 펼쳐집니다 — 그중 하나만 가져갑니다. 한 판에 여러 개를 겹쳐 쓸 수 있고,
// UP을 먹어도 사라지지 않습니다.
//
// 예전에는 직업마다 하나뿐이었고 38층부터 나왔습니다. 너무 이르고, 너무 셌고,
// 무엇보다 고를 것이 없었습니다. 지금은 종류를 늘리고 자리를 뒤로 미뤘습니다.
//
// jobs 가 있으면 그 직업에게만 나옵니다. 없으면 셋 다에게 나옵니다.
// 아래 필드들이 실제 효과입니다 — weapon.js 와 scene-game.js 가 읽습니다.
//
//   reachScale   근접 사거리 배수
//   bounce       화살이 튕기는 횟수
//   stealBonus   절도 확률 가산 · stealAmount 절도 액수 가산
//   capBonus     공격 속도 한계 가산
//   wave         벨 때마다 날아가는 파동 (근접 전용)
//   reflect      적 투사체를 튕겨낼 확률
//   lifesteal    준 피해의 이 비율만큼 회복
//   thorns       접촉한 적에게 돌려주는 피해 (내가 맞은 피해 대비)
//   coinBonus    코인 획득 배수 가산
const RELICS = [
  {
    key: 'waveblade', name: '파동검', icon: '≋',
    desc: '다섯 번에 한 번 파동이 날아갑니다',
    detail: '휘두른 방향으로 나갑니다 — 적을 쫓지는 않습니다',
    jobs: ['warrior', 'rogue'], // 원거리 직업에게는 뜻이 없습니다
    // 벨 때마다 나가고 본체의 55%였습니다. 그러면 근접이 사실상 원거리가 되어
    // 유물 하나로 직업이 바뀝니다. 다섯 번에 한 번(CFG.waveEvery) · 절반으로 낮췄습니다.
    wave: 0.28, // 파동 피해는 본체 공격의 이만큼
  },
  {
    key: 'mirrorplate', name: '반사 갑옷', icon: '◇',
    desc: '날아오는 것을 튕겨냅니다',
    detail: '적의 투사체를 절반쯤 되돌려 보냅니다',
    reflect: 0.5,
  },
  {
    key: 'bloodcloak', name: '흡혈 망토', icon: '❦',
    desc: '준 피해의 일부를 회복합니다',
    detail: '깎은 체력의 2.5%, 초당 최대 체력의 3%까지',
    // 5%였습니다. 보스전에서 거의 죽지 않는다는 말이 나왔습니다.
    //
    // 비율만 낮추는 것으로는 모자랍니다. 피해는 층을 오를수록 곱으로 자라는데
    // 최대 체력은 그렇지 않아서, 위층에서는 한 대만 넣어도 체력이 가득 찹니다.
    // 그래서 뚜껑을 함께 씌웠습니다. 처음에는 **한 대당**이었는데, 그러면
    // 후반에는 늘 뚜껑에 닿아서 실제 회복량이 `뚜껑 × 초당 대수`가 됩니다 —
    // 도적이 초당 48%를 채웠습니다. 지금은 **초당 몫**입니다
    // (CFG.lifestealPerSec). 셋이 같은 회복량을 갖습니다.
    lifesteal: 0.025,
  },
  {
    key: 'thornmail', name: '가시 갑옷', icon: '✷',
    desc: '닿은 적에게 되돌려 줍니다',
    detail: '맞은 피해의 2.5배를 그 적에게',
    thorns: 2.5,
  },
  {
    key: 'swiftboots', name: '바람 각반', icon: '⟫',
    desc: '공격 속도 한계가 올라갑니다',
    detail: '한계 +0.4',
    capBonus: 0.4,
  },
  {
    key: 'coinpurse', name: '도둑의 주머니', icon: '◎',
    desc: '코인이 더 들어옵니다',
    detail: '획득량 +50%',
    coinBonus: 0.5,
  },
  // ── 직업 전용 ────────────────────────────────────────
  {
    key: 'farblade', name: '먼 그림자 검', icon: '✚',
    desc: '멀리 닿지만 끝이 무딥니다',
    detail: '사거리 1.5배, 멀수록 약해져 끝에서는 10%',
    jobs: ['warrior'],
    reachScale: 1.5, // 1.9였던 것을 낮췄습니다. 혼자서 판을 끝내던 값이었습니다
    // 그림자는 멀리 뻗을수록 옅어집니다. 코앞이면 100%, 사거리 끝이면 10%.
    //
    // 늘어난 사거리를 그대로 두고 피해만 깎은 이유가 있습니다. 이 유물의 값은
    // "닿는다"는 데 있지 "닿는 곳마다 똑같이 벤다"는 데 있지 않습니다. 멀리
    // 있는 놈을 긁어 두고 다가가서 끝내는 무기가 됩니다.
    falloff: 0.1,
  },
  {
    key: 'echobow', name: '메아리 활', icon: '↺',
    desc: '화살이 다른 적에게 튕깁니다',
    detail: '한 번 더 튕겨 나갑니다',
    jobs: ['archer'],
    bounce: 1,
  },
  {
    key: 'goblinglove', name: '고블린의 장갑', icon: '✋',
    desc: '훔칠 확률과 액수가 늡니다',
    detail: '확률 +25% · 액수 +2',
    jobs: ['rogue'],
    stealBonus: 0.25,
    stealAmount: 2,
  },
];

function relicByKey(key) {
  return RELICS.find((r) => r.key === key) || null;
}

// 그 직업이 얻을 수 있는 것들.
function relicsFor(jobKey) {
  return RELICS.filter((r) => !r.jobs || r.jobs.includes(jobKey));
}

// 펼쳐 보일 세 장. 이미 들고 있는 것은 빼고 무작위로 뽑습니다.
// 후보가 셋보다 적으면 있는 만큼만 보여 줍니다.
function rollRelicChoices(jobKey, held, count = 3) {
  const pool = relicsFor(jobKey).filter((r) => !held.some((h) => h.key === r.key));
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}
