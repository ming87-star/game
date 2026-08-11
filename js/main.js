// window.__game은 자동 시험에서 "지금 어느 화면인가"를 묻는 통로입니다.
// 장면을 바꿔도 window.__scene은 직전 장면을 가리킨 채 남아 있어서,
// 그것만 보고 판단하면 넘어간 화면을 잘못 읽습니다.
window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CFG.width,
  height: CFG.height,
  backgroundColor: '#141a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  // 오프닝 → 직업 고르기 → 메달 상점 → 탑.
  // 죽으면 무엇을 가져갈지에 따라 셋 중 하나로 갈립니다.
  //
  // 맨 앞이 오프닝인 것은 **처음 켠 사람**을 위해서입니다. 이미 본 사람은
  // StoryScene 이 첫 프레임에 곧장 select 로 넘깁니다 (Save.data.sawStory).
  // 일시정지는 탑 위에 겹쳐 띄웁니다 — 혼자 시작되는 화면이 아니라 맨 뒤에 둡니다.
  scene: [StoryScene, SelectScene, MedalScene, RelicBookScene, MeetScene, GameScene, PauseScene],
});
