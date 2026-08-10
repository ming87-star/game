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
    // 방어는 셋 중 가장 두껍고, 손은 가장 느립니다.
    // 무거운 것을 크게 휘두르는 직업이라는 것이 수치로도 보여야 합니다.
    armorMax: 82,
    speedCap: 1.65,
    plusScale: 1,
    attack: 'melee',
    dodge: 0,
    steal: 0,

    // 근접: 사거리 안을 한 번에 벱니다. 사거리가 길어 여럿이 함께 맞습니다.
    //
    // icon 은 그림을 짓는 값입니다 (js/textures.js). 흰 외곽선으로 굽습니다.
    //   art    sword 검 · dagger 짧은 검 · spear 창 · bow 활 · crossbow 석궁
    //   hw     날의 반너비 · len 날 길이 (가장 긴 날 0.76에 견줘서) · curve 휘어진 정도
    //   guard  none · bar 가로대 · cross 십자 · wing 젖힌 뿔 · ring 고리 (gw 는 그 너비)
    //   twin   두 자루 · notch 이 빠진 날 · gem 밑동의 보석
    weapons: [
      { name: '녹슨 장검', dmg: 48,  rate: 410, reach: 100, color: 0xcfd8dc,
        icon: { art: 'sword', hw: 4.0, len: 0.60, guard: 'bar', gw: 12, notch: true } },
      { name: '강철 검',   dmg: 86,  rate: 390, reach: 108, color: 0x90caf9,
        icon: { art: 'sword', hw: 4.6, len: 0.63, guard: 'bar', gw: 15 } },
      { name: '쌍날 검',   dmg: 138,  rate: 350, reach: 116, color: 0xa5d6a7,
        icon: { art: 'sword', twin: true, hw: 5.0, len: 0.62, guard: 'bar', gw: 16 } },
      { name: '은빛 창',   dmg: 236, rate: 330, reach: 124, color: 0xb0bec5,
        icon: { art: 'spear' } },
      { name: '마력 검',   dmg: 398, rate: 310, reach: 130, color: 0xce93d8,
        icon: { art: 'sword', hw: 4.8, len: 0.66, guard: 'ring', gw: 14, gem: true } },
      { name: '화염도',    dmg: 644, rate: 280, reach: 135, color: 0xff8a65,
        icon: { art: 'sword', hw: 5.4, len: 0.66, curve: 1.1, guard: 'bar', gw: 12 } },
      { name: '뇌전검',    dmg: 1030, rate: 250, reach: 139, color: 0x81d4fa,
        icon: { art: 'sword', hw: 4.6, len: 0.68, guard: 'wing', gw: 15, gem: true } },
      { name: '용살검',    dmg: 1544, rate: 210, reach: 143, color: 0xffb74d,
        icon: { art: 'sword', hw: 6.6, len: 0.70, guard: 'cross', gw: 19 } },
      // 여기서부터는 275층 언저리에서야 손에 들어옵니다. 한 판에 다 보기는 어렵고,
      // 메달과 무기 계승으로 판을 거듭해야 닿는 구간입니다.
      { name: '파천검',    dmg: 2620, rate: 200, reach: 147, color: 0xf48fb1,
        icon: { art: 'sword', hw: 7.0, len: 0.70, curve: 0.6, guard: 'cross', gw: 20, notch: true } },
      { name: '성흔검',    dmg: 4460, rate: 190,  reach: 151, color: 0xfff59d,
        icon: { art: 'sword', hw: 5.6, len: 0.73, guard: 'ring', gw: 17, gem: true } },
      { name: '혼돈의 대검', dmg: 7560, rate: 180, reach: 155, color: 0x9575cd,
        icon: { art: 'sword', hw: 8.0, len: 0.72, guard: 'wing', gw: 21, gem: true } },
      { name: '천공검',    dmg: 12740, rate: 170,  reach: 159, color: 0x80cbc4,
        icon: { art: 'sword', hw: 6.4, len: 0.76, curve: 0.5, guard: 'wing', gw: 19, gem: true, notch: true } },
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
    // 전사의 방어 한계를 82까지 올리자 궁수가 그 아래로 내려앉았습니다
    // (같은 128층에서 남은 체력 궁수 19% · 전사 60% · 도적 85%).
    // 전사보다는 낮되 너무 벌어지지 않게 72로 둡니다.
    armorMax: 72,
    speedCap: 2.05,
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
    // icon 값의 뜻은 전사 쪽 주석을 보세요. 활은 recurve(각궁처럼 끝이 젖힌 것)와
    // big(큰 활), arrows(메긴 화살 수)로 갈립니다.
    weapons: [
      { name: '낡은 단궁',   dmg: 70,  rate: 320, range: 300, shots: 1, color: 0xd7ccc8,
        icon: { art: 'bow', arrows: 1 } },
      { name: '사냥꾼의 활', dmg: 120,  rate: 304, range: 315, shots: 1, color: 0xbcaaa4,
        icon: { art: 'bow', big: true, arrows: 1 } },
      { name: '각궁',       dmg: 100,  rate: 280, range: 330, shots: 2, color: 0xa5d6a7,
        icon: { art: 'bow', recurve: true, arrows: 1 } },
      { name: '강철 석궁',   dmg: 172,  rate: 264, range: 345, shots: 2, color: 0xb0bec5,
        icon: { art: 'crossbow' } },
      { name: '바람의 활',   dmg: 198,  rate: 248, range: 360, shots: 3, color: 0x80deea,
        icon: { art: 'bow', recurve: true, arrows: 2 } },
      { name: '불꽃 장궁',   dmg: 320, rate: 226, range: 375, shots: 3, color: 0xff8a65,
        icon: { art: 'bow', big: true, arrows: 2 } },
      { name: '뇌명궁',     dmg: 382, rate: 204, range: 390, shots: 4, color: 0x81d4fa,
        icon: { art: 'bow', recurve: true, big: true, arrows: 2 } },
      // 특수 무기 — 화살이 표적을 끝까지 쫓습니다. 아주 긴 판에서만 손에 들어옵니다.
      { name: '용뼈 대궁',   dmg: 576, rate: 178,  range: 410, shots: 4, homing: true, color: 0xffb74d,
        icon: { art: 'crossbow', big: true } },
      // 여기서부터는 유도가 기본입니다. 275층 언저리의 구간이라,
      // 메달과 무기 계승으로 판을 거듭해야 닿습니다.
      { name: '질풍 대궁',   dmg: 956,  rate: 164, range: 425, shots: 4, homing: true, color: 0xf48fb1,
        icon: { art: 'bow', big: true, arrows: 3 } },
      { name: '성좌궁',     dmg: 1270,  rate: 152, range: 440, shots: 5, homing: true, color: 0xfff59d,
        icon: { art: 'bow', recurve: true, big: true, arrows: 3 } },
      { name: '심연 장궁',   dmg: 2110,  rate: 140, range: 455, shots: 5, homing: true, color: 0x9575cd,
        icon: { art: 'crossbow', big: true, gem: true } },
      { name: '천뢰궁',     dmg: 2892, rate: 128, range: 470, shots: 6, homing: true, color: 0x80cbc4,
        icon: { art: 'bow', recurve: true, big: true, arrows: 3, gem: true } },
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
    // 갑옷을 안 입는 대신 회피를 주워 올립니다 (필드의 '회' 아이템).
    dodgeMax: 0.62,
    // 손이 셋 중 가장 빠릅니다.
    speedCap: 2.5,
    // +1 하나가 제값을 다 주지는 않습니다. 공격 속도가 워낙 빨라서
    // 공격력까지 온전히 붙으면 곱해진 값이 감당이 안 됩니다.
    plusScale: 1,
    attack: 'melee',
    // 갑옷이 없는 대신 회피가 방어를 대신합니다.
    // 전사는 방어구를 쌓아 47%까지 갑니다 — 실질 체력이 도적의 두 배 가까이 됩니다.
    // 회피가 그 자리를 메워야 도적이 발판 위에 버틸 수 있습니다.
    dodge: 0.38,  // 시작 회피. 필드에서 '회'를 주워 dodgeMax 까지 올립니다
    // 때릴 때마다 이 확률로 코인을 훔칩니다 (잡지 않아도).
    // 0.32였습니다. 같은 씨앗에서 도적이 번 코인이 전사의 두 배였습니다
    // (1294 대 630) — 훔치는 것이 잡는 것보다 큰 벌이가 되면 도적만
    // 상점에서 다른 게임을 합니다. 보스에게서는 아예 훔치지 못합니다.
    steal: 0.17,
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
    // icon 값의 뜻은 전사 쪽 주석을 보세요. 도적은 날이 짧아 art 가 dagger 입니다 —
    // 자루가 짧고 코등이가 작아, 같은 검이라도 전사 것과 실루엣이 갈립니다.
    weapons: [
      { name: '이 빠진 단도', dmg: 44,  rate: 230, reach: 78, color: 0xcfd8dc,
        icon: { art: 'dagger', hw: 3.6, len: 0.40, guard: 'none', notch: true } },
      { name: '사냥칼',      dmg: 82,  rate: 220, reach: 82, color: 0x90caf9,
        icon: { art: 'dagger', hw: 4.0, len: 0.44, guard: 'bar', gw: 9 } },
      { name: '쌍단도',      dmg: 128,  rate: 196,  reach: 86, color: 0xa5d6a7,
        icon: { art: 'dagger', twin: true, hw: 4.4, len: 0.44, guard: 'bar', gw: 11 } },
      { name: '독니',        dmg: 218,  rate: 184,  reach: 91, color: 0x9ccc65,
        icon: { art: 'dagger', hw: 4.0, len: 0.45, curve: 1.3, guard: 'none' } },
      { name: '그림자 단검',  dmg: 366, rate: 174,  reach: 95, color: 0xce93d8,
        icon: { art: 'dagger', hw: 4.0, len: 0.48, guard: 'bar', gw: 10, gem: true } },
      { name: '월아도',      dmg: 594, rate: 156,  reach: 98, color: 0xff8a65,
        icon: { art: 'dagger', hw: 5.0, len: 0.50, curve: 1.8, guard: 'bar', gw: 10 } },
      { name: '뇌전 비수',    dmg: 948, rate: 140,  reach: 101, color: 0x81d4fa,
        icon: { art: 'dagger', hw: 4.0, len: 0.50, guard: 'wing', gw: 11, gem: true } },
      { name: '용아 단검',    dmg: 1420, rate: 120,  reach: 104, color: 0xffb74d,
        icon: { art: 'dagger', hw: 4.8, len: 0.52, curve: 1.1, guard: 'cross', gw: 12 } },
      // 275층 언저리 구간.
      { name: '그믐 비수',    dmg: 2376,  rate: 112, reach: 107,  color: 0xf48fb1,
        icon: { art: 'dagger', hw: 4.2, len: 0.53, curve: 1.6, guard: 'bar', gw: 10, gem: true } },
      { name: '사혼도',      dmg: 3936, rate: 104, reach: 110, color: 0xfff59d,
        icon: { art: 'dagger', hw: 5.2, len: 0.55, curve: 1.2, guard: 'ring', gw: 12 } },
      { name: '심연의 이빨',  dmg: 6510, rate: 96, reach: 113, color: 0x9575cd,
        icon: { art: 'dagger', twin: true, hw: 5.0, len: 0.54, guard: 'wing', gw: 13, gem: true } },
      { name: '천살 단검',    dmg: 10668, rate: 88, reach: 116, color: 0x80cbc4,
        icon: { art: 'dagger', hw: 5.0, len: 0.58, guard: 'ring', gw: 13, gem: true, notch: true } },
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
