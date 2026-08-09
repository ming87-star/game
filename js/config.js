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
    hp: 140,
    invulnMs: 950,
  },

  // ── 무기 ────────────────────────────────────────────────
  // 단계(tier)와 강화(+1, ×2)가 따로 놉니다.
  //   +1  현재 무기의 공격력을 올림
  //   ×2  한 번에 나가는 발사체를 두 배로
  //   UP  다음 단계 무기로. 대신 강화는 전부 초기화
  // 그래서 "지금 무기를 계속 키울까, 갈아탈까"가 판단이 됩니다.
  // 단계 사이 화력 차이를 약 1.8배로 벌려 뒀습니다. plusStep이 0.12이므로
  // +1을 7~10개쯤 쌓아야 비로소 UP이 손해가 됩니다. 그 지점이 판단이 생기는 자리입니다.
  // (dmg × shots ÷ rate 가 그 무기의 대략적인 화력입니다)
  weapons: [
    { name: '녹슨 단검', dmg: 24,  rate: 400, range: 230, shots: 1, speed: 560, color: 0xcfd8dc },
    { name: '강철 검',   dmg: 43,  rate: 380, range: 240, shots: 1, speed: 600, color: 0x90caf9 },
    { name: '쌍날 검',   dmg: 44,  rate: 340, range: 250, shots: 2, speed: 620, color: 0xa5d6a7 },
    { name: '은빛 창',   dmg: 75,  rate: 320, range: 260, shots: 2, speed: 650, color: 0xb0bec5 },
    { name: '마력 검',   dmg: 125, rate: 300, range: 270, shots: 2, speed: 670, color: 0xce93d8 },
    { name: '화염도',    dmg: 135, rate: 270, range: 280, shots: 3, speed: 690, color: 0xff8a65 },
    { name: '뇌전검',    dmg: 215, rate: 240, range: 290, shots: 3, speed: 710, color: 0x81d4fa },
    { name: '용살검',    dmg: 330, rate: 200, range: 300, shots: 4, speed: 740, color: 0xffb74d },
  ],
  plusStep: 0.12, // +1 하나당 기본 공격력의 12%. 흔한 아이템이라 한 개는 작게 올립니다
  maxShots: 8,    // ×2가 겹쳐도 이보다 많이 쏘지는 않습니다
  maxMult: 4,     // ×2는 두 번까지만 겹칩니다

  // ── 발판에 무엇이 놓일까 ────────────────────────────────
  // 한 칸 기준 확률입니다. 한 층에 길이 최대 셋이라 실제로 마주칠 확률은
  // 1-(1-p)³ 로 세 배 가까이 됩니다. 여기 숫자를 조금만 올려도 체감은 크게 바뀝니다.
  //
  // UP은 여기 없습니다. 확률이 아니라 shopEvery 층마다 정확히 한 번,
  // 구간 안의 무작위한 층에 놓입니다 (tower.js의 upFloorFor).
  // 상점에서도 한 번 살 수 있으니 한 구간에 최대 두 번 오릅니다.
  slotChance: {
    enemyBase: 0.22,
    enemyPerFloor: 0.004,
    enemyMax: 0.26,

    plus: 0.075,  // 한 층에 마주칠 확률 약 14%
    double: 0.008, // 약 2% — 가장 귀합니다

    // 회복만은 고정 확률이 아닙니다. 체력이 가득 차 있으면 거의 안 나오고,
    // 깎일수록 자주 나옵니다. 어차피 길을 골라 가야 하니 자주 나와도
    // 공짜가 아닙니다 — 회복을 집으려면 다른 길을 포기해야 합니다.
    healFull: 0.010, // 체력이 가득할 때 (한 층 기준 약 2%)
    healHurt: 0.130, // 체력이 healFloor 이하일 때 (약 28%)
    healFloor: 0.40, // 이 비율 아래로 떨어지면 최대치
  },

  // ── 적 ──────────────────────────────────────────────────
  maxEnemies: 12,
  enemy: {
    baseHp: 16,
    hpPerFloor: 0,
    // 무기 단계는 25층에 하나씩 오르고 단계마다 화력이 약 1.8배입니다.
    // 즉 주인공의 화력은 곱으로 자랍니다. 적 체력을 더하기로 올리면
    // 위로 갈수록 전투가 싱거워집니다 — 그래서 여기도 곱입니다.
    // survey.js 끝의 "한 마리 잡는 시간"이 서서히 늘어나면 맞은 것입니다.
    hpGrowth: 1.026,
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
  // move: chase 곧장 추격 · wave 좌우로 흔들며 접근 · ranged 거리 두고 사격
  //       walk  발판 위를 걸어다니다 끝에서 떨어짐 (유일하게 중력을 받습니다)
  enemyWave: { rampFloors: 12, fadeHalfLife: 26, minWeight: 0.06 },
  enemyTypes: [
    { key: 'crawler', name: '기는 것',   from: 0,  hp: 0.8, speed: 0.55, dmg: 10, coin: 2,  scale: 0.85, move: 'walk',   w0: 4.0 },
    { key: 'brute',   name: '단단한 놈', from: 12, hp: 2.4, speed: 0.60, dmg: 15, coin: 5,  scale: 1.15, move: 'chase',  w0: 2.2 },
    { key: 'flyer',   name: '날것',     from: 25, hp: 1.0, speed: 1.20, dmg: 12, coin: 4,  scale: 0.95, move: 'wave',   w0: 2.0 },
    { key: 'dasher',  name: '빠른 놈',   from: 40, hp: 0.7, speed: 2.00, dmg: 12, coin: 4,  scale: 0.9,  move: 'chase',  w0: 1.8 },
    { key: 'giant',   name: '거인',     from: 55, hp: 3.5, speed: 0.45, dmg: 24, coin: 10, scale: 1.9,  move: 'chase',  w0: 1.6 },
    { key: 'shooter', name: '사수',     from: 72, hp: 1.2, speed: 0.70, dmg: 10, coin: 6,  scale: 1.0,  move: 'ranged', w0: 1.6 },
  ],

  // 기는 것이 발판 위를 걸을 때 쓰는 값
  crawl: {
    gravity: 1100,
    turnDeadzone: 12, // 주인공과 x가 이만큼 안이면 방향을 유지합니다 (덜덜 떨지 않게)
    // 주인공이 멀면 발판 위를 왔다갔다 순찰합니다. 그래야 올라가 보면 거기 있습니다.
    // 이 층수 안으로 들어오면 낭떠러지를 개의치 않고 쫓아옵니다 — 그러다 떨어집니다.
    chaseWithin: 1.3,
    edgeProbe: 0.6, // 몸 너비의 이만큼 앞을 짚어 발판이 있는지 봅니다
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
    },
    maxhpGain: 25,
  },
};
