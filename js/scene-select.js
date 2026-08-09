// 시작 화면 — 직업을 고릅니다.
// 셋은 강약이 아니라 "코인을 버는 방법"이 다릅니다. 그 차이가 읽히도록 적어 둡니다.
class SelectScene extends Phaser.Scene {
  constructor() {
    super('select');
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    this.add.text(cx, 96, '탑 오르기', font(52, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, 152, '직업을 고르세요', font(22, '#8794b5')).setOrigin(0.5);

    CLASSES.forEach((job, i) => this.buildCard(job, cx, 268 + i * 210));
  }

  buildCard(job, cx, y) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const tint = '#' + job.color.toString(16).padStart(6, '0');

    const box = this.add.rectangle(cx, y, 460, 186, 0x1b2138)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true });

    this.add.text(cx - 205, y - 66, job.name, font(34, tint));
    this.add.text(cx - 205, y - 26, job.blurb, font(20, '#b0bec5'));
    this.add.text(cx - 205, y + 6, job.detail, font(17, '#8794b5')).setLineSpacing(4);

    // 그 직업만 얻을 수 있는 유물. 한 판에 한 번 나올까 말까 합니다.
    this.add.text(cx - 205, y + 66, '유물  ' + job.relic.name, font(17, '#ffd54f'));

    box.on('pointerover', () => box.setStrokeStyle(2, job.color));
    box.on('pointerout', () => box.setStrokeStyle(2, 0x3f4a78));
    box.on('pointerdown', () => this.scene.start('game', { jobKey: job.key }));
  }
}
