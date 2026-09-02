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

// ── 안드로이드의 「뒤로」 ──────────────────────────────────
//
// 껍데기(android/)의 MainActivity 가 뒤로를 누를 때마다 이걸 부릅니다.
// **참을 돌려주면 게임이 알아서 처리한 것**이고, 거짓이면 껍데기가 제
// 방식대로 합니다 (두 번 누르면 나가기).
//
// 이걸 안 두면 탑에서 뒤로를 누르는 순간 앱이 그냥 닫힙니다 — 오르던 판이
// 통째로 날아갑니다. 안드로이드에서 가장 흔한 원망입니다.
//
// 웹에서는 아무도 안 부릅니다. 그래도 여기 두는 까닭은 **여기서 시험할 수
// 있기 때문**입니다 — 껍데기 쪽 자바는 이 환경에서 컴파일도 못 합니다.
window.__androidBack = function () {
  const g = window.__game;
  if (!g) return false;
  const 켜진것 = g.scene.getScenes(true).map((s) => s.scene.key);

  // 겹쳐 뜬 창이 있으면 그것부터 닫습니다.
  if (켜진것.includes('pause')) {
    const p = g.scene.getScene('pause');
    if (p && p.resumeGame) { p.resumeGame(); return true; }
  }
  // 무기 갈아타기·전리품 창은 고르기 전에는 안 닫습니다 — 뒤로 한 번에
  // 창이 사라지면 무엇을 골랐는지 모르는 채로 판이 흘러갑니다.
  if (켜진것.includes('swap') || 켜진것.includes('trophy') || 켜진것.includes('foe')) return true;

  // 탑 위에서는 **나가지 않고 멈춥니다.**
  if (켜진것.includes('game')) {
    const s = g.scene.getScene('game');
    if (s && s.pauseGame) { s.pauseGame(); return true; }
    return true;
  }
  // 곁가지 화면들은 한 걸음 물러섭니다.
  const 돌아갈곳 = {
    code: 'title', relicbook: 'select', weaponbook: 'medal',
    medal: 'select', story: 'title', meet: 'select',
  };
  for (const 키 of 켜진것) {
    if (!돌아갈곳[키]) continue;
    // **그 장면의 제 손으로** 옮깁니다. g.scene.start(…) 는 SceneManager 라
    // 부르는 장면을 **안 닫습니다** — 코드 화면 위에 타이틀이 겹쳐 떠서
    // 두 화면이 포개집니다. 장면이 제 scene.start 를 부르면 저를 닫고 갑니다.
    const 지금 = g.scene.getScene(키);
    if (지금 && 지금.scene) 지금.scene.start(돌아갈곳[키]);
    else g.scene.start(돌아갈곳[키]);
    return true;
  }
  // 타이틀·직업 고르기·크레딧에서는 껍데기에 맡깁니다 (두 번 누르면 나가기).
  return false;
};

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
