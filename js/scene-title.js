// ── 타이틀 화면 ───────────────────────────────────────────
//
// 게임을 켜면 **가장 먼저** 이 화면이 섭니다. 매번 섭니다.
//
// 예전에는 켜자마자 직업 고르기부터 나왔습니다. 그러면 이 게임이 무엇인지
// 한 번도 안 보여 준 채로 **고르라는 말부터** 하게 됩니다. 처음 켠 사람에게는
// 무엇을 고르는 것인지 모를 물음이고, 다시 켠 사람에게는 이름조차 없는 게임을
// 여는 셈입니다. 제목이 뜨는 자리가 없으면 제목을 지은 값이 없습니다.
//
// 프롤로그(js/scene-story.js)와 하는 일이 다릅니다.
//
//   타이틀   이 게임이 **어떤 게임인가** — 후반의 한 장면과 제목. 매번.
//   프롤로그 **왜 오르는가** — 네 컷. 처음 켠 사람에게 한 번만.
//
// 그래서 여기 배경은 첫 층이 아니라 **후반부**입니다. 보스를 다섯 넘고
// 전리품을 다 붙인 채 싸우는 한 순간 — 오르면 여기까지 온다는 약속입니다.
//
// ── 순서 ──────────────────────────────────────────────
//
//   0.0초  배경이 어둠에서 떠오름
//   0.7초  제목이 아래에서 살짝 올라오며 나타남
//   1.9초  「터치해서 계속하기」가 깜빡이기 시작
//
// 시간을 나눈 까닭은 **읽을 것을 하나씩 주기** 위해서입니다. 셋이 한꺼번에
// 뜨면 눈이 깜빡이는 글자로 먼저 가서 제목을 안 읽습니다. 깜빡이는 것은
// 언제나 가장 세게 눈을 끌기 때문에, 그것만은 맨 뒤에 두어야 합니다.
//
// **다 뜨기 전에 눌러도 손해가 없습니다.** 누르면 남은 것이 그 자리에서
// 다 차오릅니다 (한 번 더 누르면 넘어갑니다). 기다리게 하는 화면은
// 두 번째부터 문턱이 됩니다.
class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  preload() {
    // 데이터 URI라 네트워크를 안 탑니다. 없으면 아무 일도 안 합니다 —
    // 그때는 어두운 바탕에 제목만 섭니다 (아래 create).
    if (typeof loadStoryArt === 'function') {
      loadStoryArt(this, 'title-art');    // 배경 — 후반 전투
      loadStoryArt(this, 'title-logo');   // 제목을 그림으로 그린 것 (js/logo.js)
      loadStoryArt(this, 'title-hint');   // 「터치해서 계속하기」 금테
    }
  }

  create() {
    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#0a0d18');

    // ── 배경 ────────────────────────────────────────────
    // 그림은 **화면을 덮습니다**(cover) — 안쪽에 맞추면(contain) 위아래에
    // 검은 띠가 생겨서 배경이 아니라 액자에 걸린 그림이 됩니다.
    this.back = [];
    if (this.textures.exists('title-art')) {
      const src = this.textures.get('title-art').getSourceImage();
      const k = Math.max(CFG.width / src.width, CFG.height / src.height);
      this.back.push(this.add.image(cx, CFG.height / 2, 'title-art')
        .setDisplaySize(src.width * k, src.height * k));
      // 그림 위에 글자가 얹히므로 아주 옅게 한 겹만 덮습니다.
      //
      // 예전에는 두 겹이었습니다 — 화면 전체 0.42 에, 아래 320px 만 0.55 를
      // 한 겹 더. 아래쪽이 겹쳐서 **74% 어두웠고**, 그 경계(y=640)가 화면에
      // 가로줄로 보였습니다. 밝기를 재 보니 41 에서 30 으로 뚝 떨어집니다.
      //
      // 그 띠는 「터치해서 계속하기」가 **코드가 찍는 맨 글자**이던 시절의
      // 것입니다. 회색 글자 한 줄을 배경 위에 얹는 것이라 설 자리를 미리
      // 어둡게 깔아 둬야 했습니다. 지금은 금테 판때기가 제 배경을 들고
      // 오므로 뒤가 무엇이든 스스로 읽힙니다 — 지키던 것이 없어졌습니다.
      //
      // 남은 한 겹도 0.42 에서 0.20 으로 내립니다. 새 배경은 아래쪽이
      // 그림의 알맹이(발판·문어·집게)라, 예전의 어두운 그림에 맞춰 둔 값이
      // 이 그림에는 세게 걸립니다. 제목은 제 그림에 검은 번짐이 깔려 있어서
      // 이만큼으로도 읽힙니다.
      this.back.push(this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x0a0d18, 0.20));
    }

    // ── 제목 ────────────────────────────────────────────
    // 그림이 있으면 화면 꼭대기에 붙여 세웁니다. 배경 그림의 위쪽 사분의 일이
    // 비워져 있고(ART.md 7.96절), 그 아래가 곧 주인공입니다.
    // 그림이 아직 없으면 조금 내려서 놓습니다: 빈 화면의 꼭대기에 붙어 있으면
    // 아래가 통째로 비어 만들다 만 화면으로 보입니다.
    //
    // **maxH 가 이 자리의 약속입니다.** 그림이 바뀌어도 여기서 넘어오지
    // 않습니다 — 제목이 300px 을 넘으면 눈과 칼끝을 덮습니다.
    const logo = drawLogo(this, cx, this.back.length ? 20 : 296,
      { scale: 1, maxH: 300 });
    this.logoParts = logo.parts;

    // ── 「터치해서 계속하기」 ──────────────────────────
    // 제목과 같은 규칙입니다: 그림이 있으면 그림, 없으면 글꼴.
    // 아래 어두운 띠 안에 들어가야 하므로 너비를 400 으로 못박습니다
    // (4.74:1 이라 높이 84 — 띠가 320이므로 넉넉히 들어갑니다).
    this.hintLabel = '터치해서 계속하기';
    const hintY = CFG.height - 128;
    if (this.textures.exists('title-hint')) {
      const src = this.textures.get('title-hint').getSourceImage();
      const w = 400;
      this.hint = this.add.image(cx, hintY, 'title-hint')
        .setDisplaySize(w, w * (src.height / src.width));
    } else {
      this.hint = this.add.text(cx, hintY, this.hintLabel, {
        fontFamily: 'sans-serif', fontSize: '22px', color: '#b0bec5',
      }).setOrigin(0.5);
    }

    // ── 셋을 시간에 걸쳐 띄웁니다 ──────────────────────
    this.back.forEach((o) => o.setAlpha(0));
    // 올라올 자리를 물건마다 적어 둡니다. 중간에 눌러 끊었을 때 되돌릴
    // 곳이 있어야 합니다 — 트윈을 죽이면 올라오다 만 자리에 그냥 멈춥니다.
    this.logoParts.forEach((o) => { o.__toY = o.y; o.y += 18; o.setAlpha(0); });
    this.hint.setAlpha(0);
    this.ready = false;   // 다 떴는가 (자동 시험이 보는 자리이기도 합니다)

    this.tweens.add({ targets: this.back, alpha: 1, duration: 700 });
    this.tweens.add({
      targets: this.logoParts, alpha: 1, y: '-=18', delay: 700, duration: 900,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.hint, alpha: { from: 0, to: 1 }, delay: 1900, duration: 700,
      onComplete: () => this.startBlink(),
    });

    // ── 누르면 ──────────────────────────────────────────
    this.input.on('pointerdown', () => this.tap());
    ['keydown-SPACE', 'keydown-ENTER'].forEach((k) =>
      this.input.keyboard.on(k, () => this.tap()));

    window.__title = this;
  }

  // 다 뜬 뒤의 깜빡임. **꺼졌다 켜지는 것이 아니라 옅어졌다 짙어집니다** —
  // 완전히 사라지면 글자가 있었는지조차 헷갈리고, 눈에는 그것이 고장으로
  // 보입니다. 아래 0.3 은 "지금 여기 있다"를 남기는 값입니다.
  startBlink() {
    this.ready = true;
    this.blink = this.tweens.add({
      targets: this.hint, alpha: { from: 1, to: 0.3 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // 다 뜨기 전에 눌렀으면 **넘기는 것이 아니라 앞당깁니다.**
  tap() {
    if (!this.ready) return this.snap();
    this.go();
  }

  // 남은 것을 그 자리에서 다 채웁니다.
  snap() {
    this.tweens.killAll();
    this.back.forEach((o) => o.setAlpha(1));
    this.logoParts.forEach((o) => { o.setAlpha(1); o.y = o.__toY; });
    this.hint.setAlpha(1);
    this.startBlink();
  }

  // ── 어디로 가는가 ──────────────────────────────────────
  // 처음 켠 사람은 프롤로그로, 이미 본 사람은 곧장 직업 고르기로.
  // 이 갈림이 여기 있는 것이 맞습니다 — 프롤로그가 스스로 "나는 안 나온다"를
  // 판단해서 곧장 넘기면, 그 한 프레임 동안 빈 프롤로그 화면이 깜빡입니다.
  go() {
    // **엔딩을 본 뒤에는 다시 못 합니다** (STORY.md 6절). 「한 판 더」가
    // 되면 방금 본 것이 그냥 해금 보상이 됩니다. 크레딧으로 돌려보내면
    // 거기에 「처음부터 다시 하기」가 있습니다 — 닫되 가두지는 않습니다.
    if (Save.endingStage >= 2) return this.scene.start('credits');
    this.scene.start(Save.data.sawStory ? 'select' : 'story');
  }
}
