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
    // 상점은 장면이 아니라 판 위에 뜨는 창입니다. 그래서 켜진것 에는
    // 'game' 만 보이고, pauseGame() 은 **상점이 열려 있으면 되돌아갑니다.**
    // 그대로 두면 상점에서 뒤로가기가 아무 일도 안 합니다 — 실기에서
    // 「상점에서만 뒤로가기가 안 된다」로 나온 것이 이 자리입니다.
    // 겹쳐 뜬 창은 그것부터 닫는 것이 안드로이드의 셈법입니다.
    if (s && s.shop && s.shop.open) { s.shop.close(); return true; }
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

// ── 캔버스 바깥 여백을 캔버스 가장자리에 맞춰 칠합니다 ─────
//
// 세로는 게임이 알아서 채웁니다 (js/config.js 의 세로맞추기). 남는 것은
// **가로**입니다 — 태블릿처럼 넓은 화면에서 좌우에 여백이 생깁니다
// (갤탭 16:10 은 한쪽 40px, 아이패드 4:3 은 96px).
//
// 그 자리는 캔버스 바깥이라 게임이 못 그립니다. 그렇다고 CSS 의 % 로
// 그라데이션을 주면 캔버스 폭이 기기마다 달라 이음매가 안 맞습니다 —
// 화면 기준 타원으로 해 봤더니 96px 여백에서 밝기가 10 에서 14 로만
// 변해서 눈에는 그냥 검정 한 색이었습니다.
//
// 그래서 **캔버스의 실제 자리를 재서 px 로** 칠합니다. 캔버스가 닿는
// 자리는 탑 가장자리 색(--edge, 재서 맞춘 #0a0e1b)이라 이음매가 안 보이고,
// 화면 끝으로 갈수록 --deep 에 잠깁니다.
(function 여백() {
  const 값 = (이름) => getComputedStyle(document.documentElement)
    .getPropertyValue(이름).trim() || '#04060c';

  function 여백맞추기() {
    const c = document.querySelector('#game canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const 가 = Math.round(r.left), 나 = Math.round(r.right);
    const 다 = Math.round(r.top), 라 = Math.round(r.bottom);
    const 끝 = 값('--deep'), 테 = 값('--edge');
    const 겹 = [];
    // 위아래 여백이 있으면 그쪽을 먼저 얹습니다 (있으면 보통 아주 얇습니다).
    if (다 > 1 || H - 라 > 1) {
      겹.push(`linear-gradient(180deg, ${끝} 0px, ${테} ${다}px,`
        + ` rgba(0,0,0,0) ${다}px, rgba(0,0,0,0) ${라}px, ${테} ${라}px, ${끝} ${H}px)`);
    }
    겹.push(`linear-gradient(90deg, ${끝} 0px, ${테} ${가}px, ${테} ${나}px, ${끝} ${W}px)`);
    document.body.style.background = 겹.join(', ');
  }

  // ── 가로로 눕혔을 때 ─────────────────────────────────────
  //
  // 안드로이드 앱은 세로로 못박아 두었으니 이건 **웹에서만** 나옵니다.
  // 그리고 **손가락으로 하는 기기에서만** 띄웁니다 — 데스크톱 브라우저는
  // 창이 거의 늘 가로인데 거기서 「돌려 주세요」를 띄우면 돌릴 수가 없어
  // 게임을 아예 못 하게 됩니다.
  const 손가락 = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function 눕힘살피기() {
    const 덮개 = document.getElementById('turn');
    if (!덮개) return;
    const 누웠나 = 손가락 && window.innerWidth > window.innerHeight * 1.05;
    덮개.classList.toggle('on', !!누웠나);
  }

  const 다시 = () => { 여백맞추기(); 눕힘살피기(); };
  window.addEventListener('resize', () => setTimeout(다시, 60));
  window.addEventListener('orientationchange', () => setTimeout(다시, 260));
  // 캔버스는 게임이 선 뒤에야 생깁니다. 몇 번 두드려 봅니다.
  [0, 200, 700, 1600, 3500].forEach((ms) => setTimeout(다시, ms));
})();
