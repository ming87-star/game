// 게임의 모든 수치를 여기 모아둡니다. 밸런스는 이 파일만 고치면 됩니다.
const CFG = {
  width: 540,
  height: 960,

  // 탑 구조
  floorHeight: 165,
  laneX: { left: 95, mid: 270, right: 445 },
  platformW: 140,
  platformH: 20,
  groundY: 880,

  // 점프 — 실패하지 않습니다. 방향만 고르는 조작입니다.
  jumpDuration: 320,
  jumpArc: 95,

  shopEvery: 50, // 이 층마다 상점

  player: {
    hp: 185,
    invulnMs: 1100,
  },

  // ── 무기 ────────────────────────────────────────────────
  // 주무기는 근접입니다. reach 안에 있는 적을 한 번에 모두 벱니다.
  // 적이 발판 위에 뭉쳐 있으므로, 여럿을 동시에 치는 것이 근접의 값어치입니다.
  //
  //   +1  공격력을 올림
  //   ×2  공격 속도 두 배 (주무기·보조무기 모두)
  //   UP  다음 단계 무기로. 대신 강화는 전부 초기화
  //
  // 단계 사이 화력(dmg ÷ rate) 차이를 약 1.8배로 벌려 뒀습니다.
  // plusStep이 0.12이므로 +1을 7~10개쯤 쌓아야 UP이 손해가 됩니다.
  // 사거리는 제 발판을 덮는 정도까지만입니다 (발판 폭 140, 옆 길까지는 175).
  // 옆 발판을 쓸어버리면 근접이 아니라 그냥 원거리가 됩니다.
  //
  // 주기(rate)가 짧은 이유: 주인공은 한 층에 1초 남짓 머뭅니다. 그 사이에
  // 네다섯 번은 휘둘러야 "여러 대 때려서 잡는" 그림이 나옵니다.
  // 느리게 두면 몇 대 치다 올라가 버려서 아무것도 못 잡습니다.
  weapons: [
    { name: '녹슨 단검', dmg: 24,  rate: 205, reach: 95,  color: 0xcfd8dc },
    { name: '강철 검',   dmg: 43,  rate: 195, reach: 102, color: 0x90caf9 },
    { name: '쌍날 검',   dmg: 69,  rate: 175, reach: 110, color: 0xa5d6a7 },
    { name: '은빛 창',   dmg: 118, rate: 165, reach: 118, color: 0xb0bec5 },
    { name: '마력 검',   dmg: 199, rate: 155, reach: 124, color: 0xce93d8 },
    { name: '화염도',    dmg: 322, rate: 140, reach: 129, color: 0xff8a65 },
    { name: '뇌전검',    dmg: 515, rate: 125, reach: 133, color: 0x81d4fa },
    { name: '용살검',    dmg: 772, rate: 105, reach: 137, color: 0xffb74d },
  ],
  plusStep: 0.12, // +1 하나당 기본 공격력의 12%. 흔한 아이템이라 한 개는 작게 올립니다
  maxMult: 4,     // ×2는 두 번까지만 겹칩니다

  // 보조무기 — 은빛 창(3단계)부터 딸려 옵니다.
  // 가장 가까운 적 하나를 멀리서 칩니다. 주무기를 대신하지 않도록 약하게 둡니다.
  // ── 방어구 ──────────────────────────────────────────────
  // 근접이라 적에게 붙어야 합니다. 그만큼 맞는 것을 덜어 줍니다.
  // 방어력은 그대로 "받는 피해 몇 % 감소"입니다 — 계산이 눈에 보여야 고르기 쉽습니다.
  armor: {
    start: 20,    // 처음부터 입고 시작하는 만큼
    perItem: 8,   // 지도에서 줍는 방어구 하나당
    shopGain: 15, // 상점에서 사면
    max: 70,      // 이 위로는 올라가지 않습니다
  },

  sub: {
    fromTier: 3,
    dmgRatio: 0.35, // 주무기 공격력의 이만큼
    rate: 700,
    range: 330,
    speed: 640,
    color: 0xffe082,
  },

  // ── 발판에 무엇이 놓일까 ────────────────────────────────
  // 한 칸 기준 확률입니다. 한 층에 길이 최대 셋이라 실제로 마주칠 확률은
  // 1-(1-p)³ 로 세 배 가까이 됩니다. 여기 숫자를 조금만 올려도 체감은 크게 바뀝니다.
  //
  // UP은 여기 없습니다. 확률이 아니라 shopEvery 층마다 정확히 한 번,
  // 구간 안의 무작위한 층에 놓입니다 (tower.js의 upFloorFor).
  // 상점에서도 한 번 살 수 있으니 한 구간에 최대 두 번 오릅니다.
  slotChance: {
    enemyBase: 0.25,
    enemyPerFloor: 0.004,
    enemyMax: 0.26,

    plus: 0.075,  // 한 층에 마주칠 확률 약 14%
    armor: 0.030, // 약 6%
    double: 0.008, // 약 2% — 가장 귀합니다

    // 회복만은 고정 확률이 아닙니다. 체력이 가득 차 있으면 거의 안 나오고,
    // 깎일수록 자주 나옵니다. 어차피 길을 골라 가야 하니 자주 나와도
    // 공짜가 아닙니다 — 회복을 집으려면 다른 길을 포기해야 합니다.
    healFull: 0.010, // 체력이 가득할 때 (한 층 기준 약 2%)
    healHurt: 0.130, // 체력이 healFloor 이하일 때 (약 28%)
    healFloor: 0.40, // 이 비율 아래로 떨어지면 최대치
  },

  // ── 적 ──────────────────────────────────────────────────
  maxEnemies: 13,
  enemy: {
    // 한 방에 죽으면 근접의 손맛이 없습니다. 보통 적이 서너 대,
    // 단단한 놈이 예닐곱 대, 거인이 열 대쯤 맞고 쓰러지도록 잡았습니다.
    // survey.js 끝 표의 "몇 대"를 보고 조정하세요.
    baseHp: 110,
    hpPerFloor: 0,
    // 무기 단계는 25층에 하나씩 오르고 단계마다 화력이 약 1.8배입니다.
    // 즉 주인공의 화력은 곱으로 자랍니다. 적 체력을 더하기로 올리면
    // 위로 갈수록 전투가 싱거워집니다 — 그래서 여기도 곱입니다.
    // survey.js 끝의 "한 마리 잡는 시간"이 서서히 늘어나면 맞은 것입니다.
    hpGrowth: 1.022,
    // 적의 공격력도 같이 올라야 합니다. 안 그러면 못 죽이는데 죽지도 않는 교착이 됩니다.
    dmgPerFloor: 0.016,
    baseSpeed: 55,
    speedPerFloor: 0.9,
    maxSpeed: 210,
  },

  // hp·speed·dmg는 위 기본값에 곱하는 배수입니다.
  // from 층부터 나오고, w0은 그 종류가 한창일 때의 등장 비중입니다.
  //
  // 비중은 파도처럼 움직입니다. 등장한 뒤 rampFloors 층에 걸쳐 흔해지고,
  // 다음 종류가 풀리면 fadeHalfLife 층마다 절반으로 줄어듭니다.
  // 그래서 "약한 적이 점점 늘다가, 새 적이 나오면서 물러나는" 흐름이 됩니다.
  //
  // ground  땅을 딛는가. 중력을 받고 발판 위를 걸어다닙니다.
  //         주인공이 멀면 발판 끝에서 돌아서며 순찰하고, 가까우면 쫓아옵니다.
  //         쫓을 때는 낭떠러지를 개의치 않으므로 그대로 떨어집니다.
  //         날개 달린 것만 false입니다. (보스를 넣는다면 그것도 false로)
  // move    chase 주인공 쪽으로 · wave 좌우로 흔들며 (공중 전용) · ranged 거리 두고 사격
  enemyWave: { rampFloors: 12, fadeHalfLife: 26, minWeight: 0.06 },
  enemyTypes: [
    { key: 'crawler', name: '기는 것',   from: 0,  hp: 0.8, speed: 0.55, dmg: 8,  coin: 2,  scale: 0.85, ground: true,  move: 'chase',  w0: 4.0 },
    { key: 'brute',   name: '단단한 놈', from: 12, hp: 2.4, speed: 0.70, dmg: 13, coin: 5,  scale: 1.15, ground: true,  move: 'chase',  w0: 2.2 },
    { key: 'flyer',   name: '날것',     from: 25, hp: 1.0, speed: 1.20, dmg: 10, coin: 4,  scale: 0.95, ground: false, move: 'wave',   w0: 2.0 },
    { key: 'dasher',  name: '빠른 놈',   from: 40, hp: 0.7, speed: 2.20, dmg: 10, coin: 4,  scale: 0.9,  ground: true,  move: 'chase',  w0: 1.8 },
    { key: 'giant',   name: '거인',     from: 55, hp: 3.5, speed: 0.50, dmg: 19, coin: 10, scale: 1.9,  ground: true,  move: 'chase',  w0: 1.6 },
    { key: 'shooter', name: '사수',     from: 72, hp: 1.2, speed: 0.75, dmg: 8,  coin: 6,  scale: 1.0,  ground: true,  move: 'ranged', w0: 1.6 },
  ],

  // 땅을 딛는 적이 걸을 때 쓰는 값
  ground: {
    gravity: 1100,
    turnDeadzone: 12,  // 주인공과 x가 이만큼 안이면 방향을 유지합니다 (덜덜 떨지 않게)
    // 같은 발판에 올라섰을 때만 달려듭니다. 한 층 아래에서도 반응하게 두면
    // 주인공이 도착하기 전에 발판 밖으로 걸어 나가 떨어져 버립니다.
    // 그러면 잡을 적도, 코인도 남지 않습니다.
    chaseWithin: 0.45,
    edgeProbe: 0.6,    // 몸 너비의 이만큼 앞을 짚어 발판이 있는지 봅니다
  },

  // 사수가 쏘는 탄
  enemyShot: {
    speed: 250,
    damage: 12,
    interval: 1900,
    standoff: 250, // 이 거리까지만 다가와서 멈춰 쏩니다
  },

  // 층이 올라갈수록 무작위 등장이 잦아집니다.
  ambient: {
    startFloor: 3,
    baseDelay: 5000,
    delayPerFloor: 4,
    minDelay: 900,
    maxCount: 3,
  },

  heal: 35,

  // 발판 위 아이템은 오래 기다려 주지 않습니다.
  // 주인공이 armWithin 층 안으로 들어오면 시간이 흐르기 시작하고,
  // blinkAt 부터 깜빡이다가 life 에 사라집니다.
  // 서서 버티는 것보다 빨리 오르는 편이 이득이 되게 하려는 장치입니다.
  item: {
    armWithin: 5,
    blinkAt: 4200,
    life: 7000,
  },

  // ── 상점 ────────────────────────────────────────────────
  shop: {
    offers: 3,
    prices: {
      plus:    { base: 30,  perShop: 18 },
      double:  { base: 110, perShop: 70 },
      upgrade: { base: 45,  perShop: 30 },
      heal:    { base: 35,  perShop: 15 },
      maxhp:   { base: 90,  perShop: 40 },
      armor:   { base: 60,  perShop: 35 },
    },
    maxhpGain: 25,
  },
};
