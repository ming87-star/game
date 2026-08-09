// 유물 도감. 한 번이라도 가져간 것은 이름과 효과가 보이고,
// 아직 못 만난 것은 물음표로 남습니다 — 무엇이 더 있는지는 알려 주되
// 무엇인지는 직접 만나서 알게 하려는 것입니다.
class RelicBookScene extends Phaser.Scene {
  constructor() {
    super('relicbook');
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    const owned = RELICS.filter((r) => Save.data.relics[r.key]).length;
    this.add.text(cx, 56, '유물 도감', font(40, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, 100, owned + ' / ' + RELICS.length + ' 수집', font(20, '#ffd54f')).setOrigin(0.5);
    this.add.text(cx, 132, '200층부터 100층마다 하나씩 · 셋 중 하나를 고릅니다',
      font(16, '#8794b5')).setOrigin(0.5);

    RELICS.forEach((relic, i) => this.buildRow(relic, cx, 178 + i * 76, font));

    const backY = CFG.height - 52;
    const btn = this.add.rectangle(cx, backY, 380, 58, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    this.add.text(cx, backY, '돌아가기', font(26, '#ffffff')).setOrigin(0.5);
    this.backAt = { x: cx, y: backY };
    btn.on('pointerdown', () => this.scene.start('select'));

    window.__relicbook = this;
  }

  buildRow(relic, cx, y, font) {
    const has = !!Save.data.relics[relic.key];

    this.add.rectangle(cx, y, 460, 66, has ? 0x231a3a : 0x161a28)
      .setStrokeStyle(2, has ? 0x7e6bc4 : 0x252c44);

    this.add.text(cx - 200, y - 14, has ? relic.icon + '  ' + relic.name : '?  ???',
      font(23, has ? '#ffd54f' : '#4a5578'));
    this.add.text(cx - 200, y + 12, has ? relic.detail : '아직 만나지 못했습니다',
      font(16, has ? '#8794b5' : '#3c456b'));

    // 직업 전용은 그 사실만은 미리 알려 줍니다. 왜 안 나오는지 몰라 헤매지 않도록.
    if (relic.jobs) {
      const names = relic.jobs.map((k) => classByKey(k).name).join('·');
      this.add.text(cx + 205, y, names, font(16, has ? '#b39ddb' : '#3c456b')).setOrigin(1, 0.5);
    }
  }
}
