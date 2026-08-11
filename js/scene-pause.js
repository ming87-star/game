// 일시정지 화면. 게임 장면(GameScene)을 그대로 얼려 놓고 그 위에 띄웁니다.
//
// 게임 장면을 없애지 않고 멈추기만 하는 것이 요령입니다. 멈춘 장면은 그리기는
// 계속하므로 뒤에 판이 그대로 비쳐 보이고, 되돌아올 때 아무것도 다시 짓지
// 않습니다 — 서 있던 자리도, 날아가던 화살도, 반쯤 닳은 함정도 그대로입니다.
class PauseScene extends Phaser.Scene {
  constructor() {
    super('pause');
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const cy = CFG.height / 2;

    // 완전히 가리지 않습니다. 뒤가 비쳐 보여야 "끝난 것"이 아니라
    // "멈춘 것"으로 읽힙니다.
    this.add.rectangle(cx, cy, CFG.width, CFG.height, 0x0d1120, 0.78);

    this.add.text(cx, cy - 90, '일시정지', font(40, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, cy - 46, '적도 시간도 여기서 함께 멈췄습니다', font(17, '#8794b5')).setOrigin(0.5);

    const btn = this.add.rectangle(cx, cy + 40, 280, 68, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 40, '이어서 하기', font(28, '#ffffff')).setOrigin(0.5);
    this.resumeAt = { x: cx, y: cy + 40 }; // 자동 플레이테스트가 누를 자리

    btn.on('pointerdown', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());

    window.__pause = this;
  }

  resumeGame() {
    this.scene.resume('game');
    this.scene.stop();
  }
}
