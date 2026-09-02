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
    MeetScene, CodeScene, EndingLineScene, EndingWatchScene, CreditsScene, GameScene, PauseScene, SwapScene, TrophyScene, FoeScene],
});

// ── 단추 소리는 **한 군데서** 냅니다 ───────────────────────
//
// 화면마다 단추가 스물 몇 개인데 자리마다 붙이면 반드시 몇 개를 빠뜨립니다.
// 빠뜨린 자리는 오류도 안 나고 그냥 조용해서, 누가 알려 주기 전에는
// 모릅니다.
//
// 그래서 창 전체에서 한 번 듣고, **판 위에서만 안 냅니다.** 탑에서는
// 누르는 것이 곧 오르는 것이라 딛는 소리가 이미 나고, 거기에 단추 소리가
// 겹치면 한 번 누를 때마다 두 번 울립니다.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pointerdown', () => {
    if (typeof Sfx === 'undefined' || !window.__game) return;
    const 켜진것 = window.__game.scene.getScenes(true).map((s) => s.scene.key);
    if (켜진것.includes('game') && !켜진것.includes('pause')
      && !켜진것.includes('swap') && !켜진것.includes('trophy')) return;
    Sfx.play('tap');
  }, { passive: true });
}

// ── 불러오는 화면을 걷습니다 ───────────────────────────────
//
// **첫 장면이 실제로 그려진 뒤에** 걷습니다. new Phaser.Game 이 돌아온
// 순간에 걷으면 아직 캔버스에 아무것도 없어서, 걷힌 자리에 어두운 빈
// 화면이 한 번 더 나옵니다 — 기다린 보람이 거기서 사라집니다.
//
// 타이틀이 그림을 다 불러오고 첫 프레임을 그린 뒤가 그 자리입니다.
// 혹시 그 신호가 안 오더라도 화면이 영영 덮여 있으면 안 되므로, 8초 뒤에는
// 무조건 걷습니다.
(function () {
  const 덮개 = document.getElementById('boot');
  if (!덮개) return;
  let 걷었나 = false;
  const 걷기 = () => {
    if (걷었나) return;
    걷었나 = true;
    덮개.classList.add('gone');
    setTimeout(() => 덮개.remove(), 600);
  };
  window.__bootDone = 걷기;

  // **게임 고리가 돌기 시작한 것으로는 모자랍니다.**
  //
  // 처음에 Phaser 의 'ready' 에 걸었더니 1.76초(중급 폰쯤이면 4.1초)에
  // 걷혔는데, 타이틀이 다 서는 것은 3.7초(8.0초)였습니다. 그 사이 2~4초가
  // 도로 어두운 빈 화면입니다 — 덮개를 씌운 까닭이 그 화면을 없애려는
  // 것이었으니, 이러면 자리만 옮긴 셈입니다.
  //
  // 첫 화면이 **글자까지 다 선 뒤**에 걷습니다.
  const 섰나 = () => (window.__title && window.__title.ready)
    || (window.__credits && window.__credits.shown);
  const 보기 = () => {
    if (섰나()) return requestAnimationFrame(걷기);   // 한 프레임 더 그린 뒤
    requestAnimationFrame(보기);
  };
  requestAnimationFrame(보기);

  // 그 신호가 끝내 안 오더라도 화면이 영영 덮여 있으면 안 됩니다.
  setTimeout(걷기, 12000);
})();
