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
}

// 카메라가 움직인 만큼 겹마다 다른 배수로 밉니다. 매 프레임 부릅니다.
function scrollTowerWall(scene, scrollY) {
  const 겹 = scene.wallLayers;
  if (!겹) return;
  for (const { o, 배 } of 겹) o.tilePositionY = scrollY * 배;
}
