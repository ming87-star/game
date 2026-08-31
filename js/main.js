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
  // 타이틀 → (처음이면 프롤로그) → 직업 고르기 → 메달 상점 → 무기 도감 → 탑.
  // 죽으면 무엇을 가져갈지에 따라 셋 중 하나로 갈립니다.
  //
  // **맨 앞은 타이틀입니다.** 매번 섭니다 — 제목이 뜨는 자리가 없으면 제목을
  // 지은 값이 없습니다. 프롤로그로 갈지 직업 고르기로 갈지는 타이틀이
  // 정합니다 (Save.data.sawStory). 프롤로그가 스스로 판단해서 곧장 넘기면
  // 그 한 프레임 동안 빈 프롤로그 화면이 깜빡입니다.
  //
  // 일시정지와 무기 갈아타기, 전리품 창은 탑 위에 겹쳐 띄웁니다 —
  // 혼자 시작되는 화면이 아니라 맨 뒤에 둡니다.
  scene: [TitleScene, StoryScene, SelectScene, MedalScene, RelicBookScene, WeaponBookScene,
    MeetScene, EndingLineScene, EndingWatchScene, CreditsScene, GameScene, PauseScene, SwapScene, TrophyScene, FoeScene],
});
