// 게임의 모든 수치를 여기 모아둡니다. 밸런스는 이 파일만 고치면 됩니다.
const CFG = {
  width: 540,
  height: 960,

  // 탑 구조
  floorHeight: 165,
  laneX: { left: 145, right: 395 },
  platformW: 200,
  platformH: 20,
  groundY: 880,

  // 점프 — 실패하지 않습니다. 방향만 고르는 조작입니다.
  jumpDuration: 320,
  jumpArc: 95,

  player: {
    hp: 100,
    contactDamage: 16,
    invulnMs: 800,
  },

  // 무기는 두 갈래로 올라갑니다. 아이템을 먹으면 한 단계,
  // 적을 killsPerLevel 마리 잡을 때마다 또 한 단계.
  // 그래서 "아이템 발판"과 "적 발판" 중 어느 쪽을 고를지가 진짜 선택이 됩니다.
  // 아이템 1개 = 1점, 적 killsPerPoint 마리 = 1점. pointsPerLevel 점마다 무기가 한 단계 오릅니다.
  pointsPerLevel: 2,
  killsPerPoint: 30,
  // 사거리를 화면 절반보다 좁게 둡니다. 적이 코앞까지 오게 해야 긴장이 생깁니다.
  weapons: [
    { name: '녹슨 단검', dmg: 16, rate: 400, range: 230, shots: 1, speed: 560, color: 0xcfd8dc },
    { name: '강철 검',   dmg: 22, rate: 380, range: 240, shots: 1, speed: 600, color: 0x90caf9 },
    { name: '쌍날 검',   dmg: 20, rate: 340, range: 250, shots: 2, speed: 620, color: 0xa5d6a7 },
    { name: '은빛 창',   dmg: 28, rate: 320, range: 260, shots: 2, speed: 650, color: 0xb0bec5 },
    { name: '마력 검',   dmg: 34, rate: 300, range: 270, shots: 2, speed: 670, color: 0xce93d8 },
    { name: '화염도',    dmg: 38, rate: 270, range: 280, shots: 3, speed: 690, color: 0xff8a65 },
    { name: '뇌전검',    dmg: 46, rate: 240, range: 290, shots: 3, speed: 710, color: 0x81d4fa },
    { name: '용살검',    dmg: 60, rate: 200, range: 300, shots: 4, speed: 740, color: 0xffb74d },
  ],

  // 화면이 적으로 뒤덮이지 않도록 상한을 둡니다. 못 잡으면 계속 쌓이는 악순환을 끊습니다.
  maxEnemies: 20,

  enemy: {
    baseHp: 14,
    hpPerFloor: 1.5,
    speed: 60,
    speedPerFloor: 1.2,
    maxSpeed: 210,
    score: 10,
  },

  // 층이 올라갈수록 무작위 등장이 잦아집니다.
  ambient: {
    startFloor: 4,
    baseDelay: 4000,
    delayPerFloor: 50,
    minDelay: 900,
    maxCount: 4,
  },

  heal: 20,
};
