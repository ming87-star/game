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

    hp: 200,
    armor: 30,
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

    hp: 200,
    armor: 32,
    usesArmor: true,
    plusScale: 1,
    attack: 'ranged',
    dodge: 0,
    steal: 0,

    // 체력과 방어를 올렸습니다. 셋 중 가장 무른데 광역도 없어서, 같은 탑에
    // 올려놓고 재면 전사보다도 아래였습니다 (53층 대 60층).
    //
    // 원거리: 한 발이 적 하나를 칩니다. shots 만큼 서로 다른 적을 동시에 노립니다.
    // 주기가 짧은 이유: 궁수는 멈추지 않고 지나가며 잡아야 합니다.
    // 한 발이 근접보다 약한 대신 훨씬 자주 나갑니다.
    weapons: [
      { name: '낡은 단궁',   dmg: 35,  rate: 160, range: 300, shots: 1, color: 0xd7ccc8 },
      { name: '사냥꾼의 활', dmg: 60,  rate: 152, range: 315, shots: 1, color: 0xbcaaa4 },
      { name: '각궁',       dmg: 50,  rate: 140, range: 330, shots: 2, color: 0xa5d6a7 },
      { name: '강철 석궁',   dmg: 86,  rate: 132, range: 345, shots: 2, color: 0xb0bec5 },
      { name: '바람의 활',   dmg: 99,  rate: 124, range: 360, shots: 3, color: 0x80deea },
      { name: '불꽃 장궁',   dmg: 160, rate: 113, range: 375, shots: 3, color: 0xff8a65 },
      { name: '뇌명궁',     dmg: 191, rate: 102, range: 390, shots: 4, color: 0x81d4fa },
      // 특수 무기 — 화살이 표적을 끝까지 쫓습니다. 아주 긴 판에서만 손에 들어옵니다.
      { name: '용뼈 대궁',   dmg: 288, rate: 89,  range: 410, shots: 4, homing: true, color: 0xffb74d },
      // 여기서부터는 유도가 기본입니다. 275층 언저리의 구간이라,
      // 메달과 무기 계승으로 판을 거듭해야 닿습니다.
      { name: '질풍 대궁',   dmg: 478,  rate: 82, range: 425, shots: 4, homing: true, color: 0xf48fb1 },
      { name: '성좌궁',     dmg: 635,  rate: 76, range: 440, shots: 5, homing: true, color: 0xfff59d },
      { name: '심연 장궁',   dmg: 1055,  rate: 70, range: 455, shots: 5, homing: true, color: 0x9575cd },
      { name: '천뢰궁',     dmg: 1446, rate: 64, range: 470, shots: 6, homing: true, color: 0x80cbc4 },
    ],

  },

  {
    key: 'rogue',
    name: '도적',
    unlockFloor: 700, unlockCoins: 2000,
    blurb: '빠르게 찌르고 훔친다',
    detail: '사거리는 짧지만 매우 빠릅니다. 갑옷은 입지 않고 흘려 넘깁니다.\n적을 잡지 않아도 코인을 훔칩니다.',
    color: 0xce93d8,

    hp: 200,
    // 도적은 갑옷을 입지 않습니다. 맞으면 그대로 맞고, 대신 흘려 넘깁니다.
    // 방어구 아이템도 도적에게는 나오지 않습니다 (밟아도 아무 일 없으면 빈 칸이니까).
    armor: 0,
    usesArmor: false,
    // +1 하나가 제값을 다 주지는 않습니다. 공격 속도가 워낙 빨라서
    // 공격력까지 온전히 붙으면 곱해진 값이 감당이 안 됩니다.
    plusScale: 1,
    attack: 'melee',
    // 갑옷이 없는 대신 회피가 방어를 대신합니다.
    // 전사는 방어구를 쌓아 47%까지 갑니다 — 실질 체력이 도적의 두 배 가까이 됩니다.
    // 회피가 그 자리를 메워야 도적이 발판 위에 버틸 수 있습니다.
    dodge: 0.46,  // 이 확률로 피해를 통째로 흘립니다 — 거의 절반을 흘립니다
    steal: 0.32,  // 때릴 때마다 이 확률로 코인을 훔칩니다 (잡지 않아도)
    // 잡을 때마다 최대 체력의 이만큼을 앗아옵니다.
    //
    // 갑옷이 없는 도적에게 필요한 것은 더 큰 숫자가 아니라 버틸 수단이었습니다.
    // 공격력을 올려도 순위가 안 바뀌었습니다 — 전사는 사거리가 넓어 한 번에
    // 여럿을 베는데 도적은 그러지 못하니, 화력만으로는 따라잡히지 않습니다.
    //
    // 준 피해에 비례해 회복시키면 안 됩니다. 공격력은 층에 따라 곱으로 커지는데
    // 최대 체력은 그렇지 않아서, 위층에서 한 대에 체력이 가득 차 버립니다.
    // 잡은 수에 매달면 잡는 속도가 저절로 상한이 됩니다.
    leechOnKill: 0.016,

    // 근접이지만 사거리가 짧고 대신 훨씬 빠릅니다.
    // 한 대의 공격력은 셋 중 가장 큽니다 — 사거리가 짧아 한 번에 닿는 수가
    // 전사의 절반쯤이라, 그만큼 한 대가 무거워야 총합이 맞습니다.
    weapons: [
      { name: '이 빠진 단도', dmg: 22,  rate: 115, reach: 78, color: 0xcfd8dc },
      { name: '사냥칼',      dmg: 41,  rate: 110, reach: 82, color: 0x90caf9 },
      { name: '쌍단도',      dmg: 64,  rate: 98,  reach: 86, color: 0xa5d6a7 },
      { name: '독니',        dmg: 109,  rate: 92,  reach: 91, color: 0x9ccc65 },
      { name: '그림자 단검',  dmg: 183, rate: 87,  reach: 95, color: 0xce93d8 },
      { name: '월아도',      dmg: 297, rate: 78,  reach: 98, color: 0xff8a65 },
      { name: '뇌전 비수',    dmg: 474, rate: 70,  reach: 101, color: 0x81d4fa },
      { name: '용아 단검',    dmg: 710, rate: 60,  reach: 104, color: 0xffb74d },
      // 275층 언저리 구간.
      { name: '그믐 비수',    dmg: 1188,  rate: 56, reach: 107,  color: 0xf48fb1 },
      { name: '사혼도',      dmg: 1968, rate: 52, reach: 110, color: 0xfff59d },
      { name: '심연의 이빨',  dmg: 3255, rate: 48, reach: 113, color: 0x9575cd },
      { name: '천살 단검',    dmg: 5334, rate: 44, reach: 116, color: 0x80cbc4 },
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
