// 탑 안쪽 벽. 판에서도 엔딩에서도 같은 벽을 씁니다.
//
// ── 화면에 고정하고 무늬만 흘립니다 ─────────────────────
// 벽을 세상 좌표에 두면 500×960 짜리를 몇 백 장 깔아야 하고, 그 이음매마다
// 선이 보입니다. 화면에 고정한 채 tilePositionY 를 카메라만큼 밀면, 한 장으로
// 끝없이 이어지고 오르는 느낌도 그대로 남습니다.
//
// ── 왜 세 겹인가 ────────────────────────────────────────
// 한 장이 카메라와 똑같이 흐르면, 아무리 잘 그려도 **벽이 통째로 따라
// 올라옵니다** — 오른 거리가 안 느껴집니다. 겹마다 속도를 달리하면 멀리 있는
// 돌은 천천히, 코앞의 사슬은 빠르게 지나가면서 탑이 통이 됩니다.
//
//   뒤   돌벽      0.55배   멀리 있는 것은 천천히 지나갑니다
//   중간 기둥·벽감  1.00배   발판 바로 뒤라 오르는 거리와 어긋나면 안 됩니다
//   앞   쇠사슬     1.45배   좌우 끝에만. 가운데에 두면 발판과 적을 가립니다
//
// 그늘만은 **안 흐릅니다.** 통이 둥글게 말려 들어가는 느낌은 화면에 붙어
// 있어야 합니다 — 같이 흐르면 벽이 도는 것처럼 보입니다.
//
// 깊이는 발판(0)보다 뒤이고, 벽에 남은 것들(js/decor.js, -7)을 중간과 앞
// 사이에 끼웁니다 — 마른 덩굴은 벽에 붙어 있고 사슬은 그 앞에 걸려 있습니다.
const WALL_LAYERS = [
  ['wall-far', -9, 0.55],
  ['wall-mid', -8, 1],
  ['wall-near', -6, 1.45],
];

function buildTowerWall(scene) {
  scene.cameras.main.setBackgroundColor('#141a2e');
  scene.wallLayers = [];

  // 그림이 한 장이라도 없으면 단색으로 물러납니다. 게임은 그대로 돕니다.
  if (!WALL_LAYERS.every(([key]) => hasArt(key))) {
    scene.add.rectangle(CFG.width / 2, CFG.height / 2, 500, CFG.height, 0x1d2542)
      .setScrollFactor(0).setDepth(-5);
    return;
  }

  WALL_LAYERS.forEach(([key, depth, 배]) => {
    const a = artSize(key);
    scene.wallLayers.push({
      o: scene.add.tileSprite(CFG.width / 2, CFG.height / 2, a.w, CFG.height, key)
        .setScrollFactor(0).setDepth(depth),
      배,
    });
  });
  if (hasArt('wall-shade')) {
    scene.add.image(CFG.width / 2, CFG.height / 2, 'wall-shade')
      .setScrollFactor(0).setDepth(-5);
  }
  scene.wallStep = undefined;
  scene.wallLit = undefined;
}

// ── 오를수록 밝아집니다 ─────────────────────────────────
//
// 500층마다 한 칸씩. 바닥이 가장 어둡고, 오를수록 조금씩 걷힙니다.
//
// **위로는 지금 그림보다 밝아지지 않습니다.** 천장이 1.00 — 즉 그려 둔
// 그대로입니다. 아래에서 어둡게 시작해 올라오는 것이지, 위에서 밝아지는
// 것이 아닙니다. 이 방향이라야 「적과 아이템이 언제나 배경보다 밝다」는
// 규칙이 안 깨집니다 (art/wall-*.svg 는 이미 그 선에 맞춰 그려져 있고,
// 어둡게 하는 것은 그 선을 넘지 않습니다).
//
// 여덟 칸이면 다 걷힙니다 — 0층이 0.68 이고 한 칸에 0.04 이므로 **4000층**
// 에서 1.00 입니다 (칸은 floor(층/500) 이라 3500층은 아직 일곱 칸입니다).
const WALL_LIGHT = {
  every: 500,     // 몇 층마다 한 칸
  steps: 8,       // 몇 칸까지. 8 × 500 = 4000층에서 다 걷힙니다
  floor: 0.68,    // 0층의 밝기
  step: 0.04,     // 한 칸에 얼마씩
  ms: 1600,       // 칸이 바뀔 때 갈아입는 시간
};

function wallLightAt(floorIndex) {
  const 칸 = Math.max(0, Math.min(WALL_LIGHT.steps, Math.floor(floorIndex / WALL_LIGHT.every)));
  // **1 을 넘기면 안 됩니다.** 넘으면 255 를 지나 값이 되감겨서 벽이 갑자기
  // 시커메집니다 (0.9 로 잡아 봤더니 250 다음이 14 였습니다). 위 값들이
  // 딱 1.00 에서 멎지만, 여기를 손대는 날 조용히 그렇게 됩니다.
  return { 칸, 밝기: Math.min(1, WALL_LIGHT.floor + 칸 * WALL_LIGHT.step) };
}

// 층이 바뀔 때마다 부릅니다. 칸이 안 바뀌면 아무 일도 안 합니다.
//
// **툭 바뀌지 않게 갈아입힙니다.** 500층을 넘는 순간 한 프레임에 밝아지면
// 그건 분위기가 아니라 고장으로 보입니다. Phaser 의 tint 는 트윈이 안 되므로
// 값 하나를 트윈하고 그 값으로 매 프레임 칠합니다.
function lightTowerWall(scene, floorIndex) {
  if (!scene.wallLayers || !scene.wallLayers.length) return;
  const { 칸, 밝기 } = wallLightAt(floorIndex);
  if (칸 === scene.wallStep) return;
  const 처음 = scene.wallStep === undefined;
  scene.wallStep = 칸;

  const 칠하기 = (v) => {
    const c = Math.round(255 * v);
    const tint = (c << 16) | (c << 8) | c;
    scene.wallLayers.forEach(({ o }) => o.setTint(tint));
  };
  if (처음) return 칠하기(밝기);

  if (scene.wallFade) scene.wallFade.remove();
  const 값 = { v: scene.wallLit === undefined ? 밝기 : scene.wallLit };
  scene.wallFade = scene.tweens.add({
    targets: 값, v: 밝기, duration: WALL_LIGHT.ms, ease: 'Sine.easeInOut',
    onUpdate: () => { scene.wallLit = 값.v; 칠하기(값.v); },
  });
  scene.wallLit = 밝기;
}

// 카메라가 움직인 만큼 겹마다 다른 배수로 밉니다. 매 프레임 부릅니다.
function scrollTowerWall(scene, scrollY) {
  const 겹 = scene.wallLayers;
  if (!겹) return;
  for (const { o, 배 } of 겹) o.tilePositionY = scrollY * 배;
}
