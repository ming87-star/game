// ── 처음 만나는 놈을 알려 주는 창 ─────────────────────────
//
// 판을 바꾸는 넷(미는 놈 · 내리찍는 놈 · 가르는 놈 · 전류를 뿜는 놈)을 **처음
// 만나는 순간 판이 멈추고 한 장이 펼쳐집니다.**
//
// 앞의 열넷은 한가운데에 이름 한 줄이 떴다 사라지는 것으로 충분했습니다.
// 「빨간 덩어리가 하나 늘었다」가 아니라는 것만 알리면 됐으니까요.
//
// 이 넷은 다릅니다. **무엇을 하는지 모르면 한 번은 반드시 당합니다** —
// 밀려서 층을 잃거나, 세 층이 막힌 줄로 올라가거나, 안전한 자리인 줄 알고
// 그 옆에 서 있거나. 그건 어려운 것이 아니라 **안 알려 준 것**입니다.
// 어려움은 알고도 못 하는 것이어야 합니다.
//
// 전리품 창(js/scene-trophy.js)과 같은 규칙입니다 — 알고 나면 판단이 되는
// 것은 판을 멈추고 한 장으로 보여 줍니다. 고를 것이 없으니 단추도 하나입니다.
class FoeScene extends Phaser.Scene {
  constructor() {
    super('foe');
  }

  init(data) {
    this.from = data.from;      // 게임 장면
    this.def = data.def;        // 그 놈 (CFG.enemyTypes 의 한 칸)
    this.tell = data.tell;      // 무엇을 알려 줄까 (CFG.foes.tell)
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const t = this.tell;

    // 뒤가 비쳐 보여야 「끝난 것」이 아니라 「멈춘 것」으로 읽힙니다.
    this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x1a0d14, 0.93);

    this.add.text(cx, 176, '처음 보는 것', font(20, '#8794b5')).setOrigin(0.5);
    this.add.text(cx, 218, t.name, font(38, '#ff8a80')).setOrigin(0.5);

    // ── 그림 ──────────────────────────────────────────
    // **판에서 실제로 도는 그 그림**입니다. 여기서 처음 보는 모양이면
    // 판에 돌아가서 못 알아봅니다.
    const key = 'e-' + this.def.key;
    const top = 286;
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(96 / src.width, 96 / src.height);
      this.add.image(cx, top + 48, key).setDisplaySize(src.width * k, src.height * k);
    }

    // ── 무엇을 하는가 ─────────────────────────────────
    // 한 줄입니다. 이 한 줄이 이 화면의 이유입니다.
    this.add.text(cx, top + 118, t.what.replace(/\*\*/g, ''), font(22, '#ffffff'))
      .setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(430).setLineSpacing(6);

    // ── 무엇을 조심하는가 ─────────────────────────────
    // 「어렵다」가 아니라 **「이렇게 하면 된다」**를 적습니다. 알고도 못 하는
    // 것이 어려움이고, 모르고 당하는 것은 그냥 안 알려 준 것입니다.
    const panelTop = top + 176;
    const body = this.add.text(cx, panelTop + 22, t.care.replace(/\*\*/g, ''),
      font(18, '#a5d6a7')).setOrigin(0.5, 0).setAlign('center')
      .setWordWrapWidth(420).setLineSpacing(8);
    this.add.rectangle(cx, panelTop + body.height / 2 + 22, 470, body.height + 44, 0x24141c)
      .setStrokeStyle(2, 0x6d4550).setDepth(-1);

    // ── 단추 하나 ─────────────────────────────────────
    const btnY = CFG.height - 130;
    const box = this.add.rectangle(cx, btnY, 380, 68, 0x4e3f8a)
      .setStrokeStyle(2, 0x9575cd).setInteractive({ useHandCursor: true });
    this.add.text(cx, btnY, '알겠습니다', font(28, '#ffffff')).setOrigin(0.5);
    this.closeAt = { x: cx, y: btnY };
    box.on('pointerdown', () => this.close());
    this.input.keyboard.on('keydown-SPACE', () => this.close());

    window.__foe = this; // 자동 시험이 누를 자리를 찾는 통로
  }

  close() {
    // 창을 닫고 나서 판을 돌립니다. 먼저 돌리면 그 한 프레임에 이 창이 아직
    // 떠 있어서, 판이 도는 것이 창 뒤로 비쳐 보입니다 (전리품 창과 같은 순서).
    const back = this.from;
    this.scene.stop();
    this.scene.resume('game');
    if (back && back.closeFoe) back.closeFoe();
  }
}
