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
    enemyBase: 0.14,
    enemyPerFloor: 0.007,
    enemyMax: 0.26,

    plus: 0.065,  // 한 층에 마주칠 확률 약 14%
    heal: 0.040,  // 약 9%
    double: 0.008, // 약 2% — 가장 귀합니다
  },

  // ── 적 ──────────────────────────────────────────────────
  maxEnemies: 14,
  enemy: {
    baseHp: 14,
    hpPerFloor: 0.55,
    // 주인공의 화력은 강화가 겹치며 곱으로 자랍니다. 적 체력도 곱으로 자라지 않으면
    // 어느 층부터는 아무것도 위협이 되지 않습니다. 결국 탑이 이깁니다.
    hpGrowth: 1.005,
    // 적의 공격력도 같이 올라야 합니다. 안 그러면 못 죽이는데 죽지도 않는 교착이 됩니다.
    dmgPerFloor: 0.016,
    baseSpeed: 55,
    speedPerFloor: 0.9,
    maxSpeed: 210,
  },

  // hp·speed·dmg는 위 기본값에 곱하는 배수입니다.
  // from 층부터 나오고, w0은 등장 비중, wGrow는 층당 비중 변화입니다.
  //
  // from을 넓게 벌려 뒀습니다. 한 판이 대략 80~110층에서 끝나므로,
  // 15~20층에 하나씩 새 적이 풀리고 마지막 하나는 꽤 올라가야 봅니다.
  // 처음 만나는 종류는 화면에 이름이 뜹니다 (scene-game.js의 announceEnemy).
  enemyTypes: [
    { key: 'crawler', name: '기는 것',   from: 0,  hp: 0.8, speed: 0.75, dmg: 10, coin: 1, scale: 0.85, move: 'chase',  w0: 4,   wGrow: -0.05 },
    { key: 'brute',   name: '단단한 놈', from: 12,  hp: 2.4, speed: 0.60, dmg: 15, coin: 3, scale: 1.15, move: 'chase',  w0: 1.2, wGrow: 0.01 },
    { key: 'flyer',   name: '날것',     from: 25, hp: 1.0, speed: 1.20, dmg: 12, coin: 2, scale: 0.95, move: 'wave',   w0: 1.2, wGrow: 0.01 },
    { key: 'dasher',  name: '빠른 놈',   from: 40, hp: 0.7, speed: 2.00, dmg: 12, coin: 3, scale: 0.9,  move: 'chase',  w0: 1.0, wGrow: 0.015 },
    { key: 'giant',   name: '거인',     from: 55, hp: 3.5, speed: 0.45, dmg: 24, coin: 7, scale: 1.9,  move: 'chase',  w0: 0.8, wGrow: 0.012 },
    { key: 'shooter', name: '사수',     from: 72, hp: 1.2, speed: 0.70, dmg: 10, coin: 4, scale: 1.0,  move: 'ranged', w0: 1.0, wGrow: 0.015 },
  ],

  // 사수가 쏘는 탄
  enemyShot: {
    speed: 250,
    damage: 12,
    interval: 1900,
    standoff: 250, // 이 거리까지만 다가와서 멈춰 쏩니다
  },

  // 층이 올라갈수록 무작위 등장이 잦아집니다.
  ambient: {
    startFloor: 8,
    baseDelay: 5200,
    delayPerFloor: 14,
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
      upgrade: { base: 55,  perShop: 40 },
      heal:    { base: 35,  perShop: 15 },
      maxhp:   { base: 90,  perShop: 40 },
    },
    maxhpGain: 25,
  },
};
