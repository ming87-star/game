// 직업. 이 게임의 가장 큰 갈림길입니다.
//
// 땅에 붙은 적은 위층까지 쫓아오지 못하므로, 싸움은 원래 "선택"입니다.
// 그런데 한 번 피하기 시작하면 코인이 없어 강해지지 못하고, 약하니까 또 피하게 됩니다.
// 직업은 그 나선을 끊습니다 — 셋 다 코인을 벌지만 버는 방법이 다릅니다.
//
// 유물은 더 이상 직업마다 하나가 아닙니다. js/relics.js 를 보세요.
//
//   전사  버티고 서서 번다   (두꺼운 방어구 + 긴 사거리 + 광역)
//   궁수  지나가며 번다      (멈출 필요 없는 원거리, 한 방은 약함)
//   도적  훔쳐서 번다        (짧고 빠른 근접 + 회피 + 절도)

const CLASSES = [
  {
    key: 'warrior',
    name: '전사',
    unlockFloor: 0, unlockCoins: 0, // 처음부터 열려 있는 유일한 직업
    blurb: '두껍게 막고 크게 벤다',
    detail: '방어력이 높아 발판에 버티고 서서 싸울 수 있습니다.\n사거리 안의 적을 한 번에 모두 벱니다.',
    color: 0xef9a9a,

    hp: 205,
    armor: 34,
    usesArmor: true,
    plusScale: 1,
    attack: 'melee',
    dodge: 0,
    steal: 0,

    // 근접: 사거리 안을 한 번에 벱니다. 사거리가 길어 여럿이 함께 맞습니다.
    weapons: [
      { name: '녹슨 장검', dmg: 24,  rate: 205, reach: 100, color: 0xcfd8dc },
      { name: '강철 검',   dmg: 43,  rate: 195, reach: 108, color: 0x90caf9 },
      { name: '쌍날 검',   dmg: 69,  rate: 175, reach: 116, color: 0xa5d6a7 },
      { name: '은빛 창',   dmg: 118, rate: 165, reach: 124, color: 0xb0bec5 },
      { name: '마력 검',   dmg: 199, rate: 155, reach: 130, color: 0xce93d8 },
      { name: '화염도',    dmg: 322, rate: 140, reach: 135, color: 0xff8a65 },
      { name: '뇌전검',    dmg: 515, rate: 125, reach: 139, color: 0x81d4fa },
      { name: '용살검',    dmg: 772, rate: 105, reach: 143, color: 0xffb74d },
      // 여기서부터는 275층 언저리에서야 손에 들어옵니다. 한 판에 다 보기는 어렵고,
      // 메달과 무기 계승으로 판을 거듭해야 닿는 구간입니다.
      { name: '파천검',    dmg: 1310, rate: 100, reach: 147, color: 0xf48fb1 },
      { name: '성흔검',    dmg: 2230, rate: 95,  reach: 151, color: 0xfff59d },
      { name: '혼돈의 대검', dmg: 3780, rate: 90, reach: 155, color: 0x9575cd },
      { name: '천공검',    dmg: 6370, rate: 85,  reach: 159, color: 0x80cbc4 },
    ],

  },

  {
    key: 'archer',
    name: '궁수',
    // 한 판 안에서 둘 다 채워야 열립니다 — 멀리 가기만 해서도, 벌기만 해서도 안 됩니다.
    unlockFloor: 500, unlockCoins: 1000,
    blurb: '멈추지 않고 쏜다',
    detail: '처음부터 원거리. 한 발은 근접보다 약하지만 멈출 필요가 없습니다.\n좋은 활일수록 빨라지고 화살이 여러 발 나갑니다.',
    color: 0xa5d6a7,

    hp: 160,
    armor: 16,
    usesArmor: true,
    plusScale: 1,
    attack: 'ranged',
    dodge: 0,
    steal: 0,

    // 원거리: 한 발이 적 하나를 칩니다. shots 만큼 서로 다른 적을 동시에 노립니다.
    // 주기가 짧은 이유: 궁수는 멈추지 않고 지나가며 잡아야 합니다.
    // 한 발이 근접보다 약한 대신 훨씬 자주 나갑니다.
    weapons: [
      { name: '낡은 단궁',   dmg: 24,  rate: 160, range: 300, shots: 1, color: 0xd7ccc8 },
      { name: '사냥꾼의 활', dmg: 42,  rate: 152, range: 315, shots: 1, color: 0xbcaaa4 },
      { name: '각궁',       dmg: 35,  rate: 140, range: 330, shots: 2, color: 0xa5d6a7 },
      { name: '강철 석궁',   dmg: 60,  rate: 132, range: 345, shots: 2, color: 0xb0bec5 },
      { name: '바람의 활',   dmg: 69,  rate: 124, range: 360, shots: 3, color: 0x80deea },
      { name: '불꽃 장궁',   dmg: 111, rate: 113, range: 375, shots: 3, color: 0xff8a65 },
      { name: '뇌명궁',     dmg: 133, rate: 102, range: 390, shots: 4, color: 0x81d4fa },
      // 특수 무기 — 화살이 표적을 끝까지 쫓습니다. 아주 긴 판에서만 손에 들어옵니다.
      { name: '용뼈 대궁',   dmg: 200, rate: 89,  range: 410, shots: 4, homing: true, color: 0xffb74d },
      // 여기서부터는 유도가 기본입니다. 275층 언저리의 구간이라,
      // 메달과 무기 계승으로 판을 거듭해야 닿습니다.
      { name: '질풍 대궁',   dmg: 332,  rate: 82, range: 425, shots: 4, homing: true, color: 0xf48fb1 },
      { name: '성좌궁',     dmg: 442,  rate: 76, range: 440, shots: 5, homing: true, color: 0xfff59d },
      { name: '심연 장궁',   dmg: 734,  rate: 70, range: 455, shots: 5, homing: true, color: 0x9575cd },
      { name: '천뢰궁',     dmg: 1006, rate: 64, range: 470, shots: 6, homing: true, color: 0x80cbc4 },
    ],

  },

  {
    key: 'rogue',
    name: '도적',
    unlockFloor: 700, unlockCoins: 2000,
    blurb: '빠르게 찌르고 훔친다',
    detail: '사거리는 짧지만 매우 빠릅니다. 갑옷은 입지 않고 흘려 넘깁니다.\n적을 잡지 않아도 코인을 훔칩니다.',
    color: 0xce93d8,

    hp: 165,
    // 도적은 갑옷을 입지 않습니다. 맞으면 그대로 맞고, 대신 흘려 넘깁니다.
    // 방어구 아이템도 도적에게는 나오지 않습니다 (밟아도 아무 일 없으면 빈 칸이니까).
    armor: 0,
    usesArmor: false,
    // 그리고 +1 하나가 절반 값입니다. 빠른 공격 속도와 절도까지 겹치면
    // 강화가 그대로 곱해져서 손댈 수 없이 세집니다.
    plusScale: 0.5,
    attack: 'melee',
    dodge: 0.18,  // 이 확률로 피해를 통째로 흘립니다
    steal: 0.20,  // 때릴 때마다 이 확률로 코인을 훔칩니다 (잡지 않아도)

    // 근접이지만 사거리가 짧고 대신 훨씬 빠릅니다.
    weapons: [
      { name: '이 빠진 단도', dmg: 14,  rate: 115, reach: 70, color: 0xcfd8dc },
      { name: '사냥칼',      dmg: 25,  rate: 110, reach: 74, color: 0x90caf9 },
      { name: '쌍단도',      dmg: 40,  rate: 98,  reach: 78, color: 0xa5d6a7 },
      { name: '독니',        dmg: 68,  rate: 92,  reach: 83, color: 0x9ccc65 },
      { name: '그림자 단검',  dmg: 115, rate: 87,  reach: 87, color: 0xce93d8 },
      { name: '월아도',      dmg: 186, rate: 78,  reach: 90, color: 0xff8a65 },
      { name: '뇌전 비수',    dmg: 297, rate: 70,  reach: 93, color: 0x81d4fa },
      { name: '용아 단검',    dmg: 445, rate: 60,  reach: 96, color: 0xffb74d },
      // 275층 언저리 구간. 도적은 +1이 절반 값이라 여기 공격력이 셋 중 가장 큽니다.
      { name: '그믐 비수',    dmg: 745,  rate: 56, reach: 99,  color: 0xf48fb1 },
      { name: '사혼도',      dmg: 1235, rate: 52, reach: 102, color: 0xfff59d },
      { name: '심연의 이빨',  dmg: 2042, rate: 48, reach: 105, color: 0x9575cd },
      { name: '천살 단검',    dmg: 3347, rate: 44, reach: 108, color: 0x80cbc4 },
    ],

  },
];

function classByKey(key) {
  return CLASSES.find((c) => c.key === key) || CLASSES[0];
}

// 전사만 처음부터 열려 있습니다. 나머지는 한 판 안에서 층과 코인을 함께 채워야 합니다.
function classUnlocked(job) {
  if (!job.unlockFloor && !job.unlockCoins) return true;
  return !!Save.data.unlocked[job.key];
}

// 방금 끝난 판이 조건을 채웠는지. 채웠으면 그 직업 키를 돌려줍니다.
function classesUnlockedBy(floor, coins) {
  return CLASSES.filter((job) =>
    (job.unlockFloor || job.unlockCoins) &&
    !Save.data.unlocked[job.key] &&
    floor >= (job.unlockFloor || 0) &&
    coins >= (job.unlockCoins || 0));
}
