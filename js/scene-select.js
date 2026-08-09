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

    this.add.text(cx, 88, '탑 오르기', font(52, '#ffffff')).setOrigin(0.5);

    const best = Save.bestFloor;
    this.add.text(cx, 140, best ? '최고 기록  ' + best + '층   ·   ' + Save.deaths + '번 도전'
      : '직업을 고르세요', font(21, '#8794b5')).setOrigin(0.5);
    this.add.text(cx, 174, '가진 메달  🏅 ' + Save.medals, font(20, '#ffca28')).setOrigin(0.5);

    CLASSES.forEach((job, i) => this.buildCard(job, cx, 278 + i * 200, best));

    // 유물 도감 — 무엇을 모았고 무엇이 남았는지 보는 자리입니다.
    const bookY = CFG.height - 44;
    const owned = RELICS.filter((r) => Save.data.relics[r.key]).length;
    const book = this.add.rectangle(cx, bookY, 380, 52, 0x1b2138)
      .setStrokeStyle(2, 0x5c4a8a).setInteractive({ useHandCursor: true });
    this.add.text(cx, bookY, '유물 도감  ' + owned + ' / ' + RELICS.length,
      font(22, '#ffd54f')).setOrigin(0.5);
    this.bookAt = { x: cx, y: bookY };
    book.on('pointerdown', () => this.scene.start('relicbook'));
  }

  buildCard(job, cx, y, best) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const open = classUnlocked(job);
    const tint = '#' + job.color.toString(16).padStart(6, '0');

    const box = this.add.rectangle(cx, y, 460, 176, open ? 0x1b2138 : 0x141826)
      .setStrokeStyle(2, open ? 0x3f4a78 : 0x252c44);

    // 잠긴 직업은 이름과 조건만 보여 줍니다. 무엇이 기다리는지는 알려 주되,
    // 지금 고를 수는 없어야 목표가 됩니다.
    if (!open) {
      this.add.text(cx - 205, y - 66, job.name, font(34, '#4a5578'));
      this.add.text(cx - 205, y - 22, job.blurb, font(20, '#3c456b'));
      this.add.text(cx, y + 26, '한 판에서  ' + job.unlockFloor + '층 · 코인 ' + job.unlockCoins,
        font(21, '#8794b5')).setOrigin(0.5);
      this.add.text(cx, y + 58, '최고  ' + Save.bestFloor + '층 · 코인 ' + Save.data.bestCoins,
        font(17, '#4a5578')).setOrigin(0.5);
      return;
    }

    box.setInteractive({ useHandCursor: true });
    this.add.text(cx - 205, y - 66, job.name, font(34, tint));
    this.add.text(cx - 205, y - 26, job.blurb, font(20, '#b0bec5'));
    this.add.text(cx - 205, y + 6, job.detail, font(17, '#8794b5')).setLineSpacing(4);

    // 그 직업에게만 나오는 유물. 공용 유물은 도감에서 봅니다.
    const mine = RELICS.find((r) => r.jobs && r.jobs.includes(job.key) && r.jobs.length === 1);
    if (mine) this.add.text(cx - 205, y + 62, '전용 유물  ' + mine.name, font(17, '#ffd54f'));

    box.on('pointerover', () => box.setStrokeStyle(2, job.color));
    box.on('pointerout', () => box.setStrokeStyle(2, 0x3f4a78));
    // 직업을 고르면 곧장 탑이 아니라 메달 상점을 거칩니다.
    // 쌓아 둔 메달로 이번 판의 시작 상태를 손보는 자리입니다.
    box.on('pointerdown', () => this.scene.start('medal', { jobKey: job.key }));
  }
}
