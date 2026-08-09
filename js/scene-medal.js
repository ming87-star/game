// 메달 상점. 직업을 고른 뒤, 그리고 죽어서 메달을 받기로 한 뒤에 열립니다.
//
// 여기서 사는 것은 전부 "이번 판 시작 상태"입니다. 한 판 쓰면 사라집니다.
// 그래서 이 화면은 매 판 다시 지나갑니다 — 무엇을 살지가 판마다 새로 생기는 선택입니다.
class MedalScene extends Phaser.Scene {
  constructor() {
    super('medal');
  }

  init(data) {
    this.job = classByKey((data && data.jobKey) || Save.data.lastJob);
    // 방금 판에서 벌어 온 메달. 죽음 화면에서 넘어왔을 때만 있습니다.
    this.earned = (data && data.earned) || 0;
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    this.add.text(cx, 60, '메달 상점', font(44, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, 108, this.job.name + ' — 이번 판에만 적용됩니다',
      font(20, '#8794b5')).setOrigin(0.5);

    this.medalLabel = this.add.text(cx, 152, '', font(28, '#ffd54f')).setOrigin(0.5);

    // 방금 벌어 온 만큼을 따로 알려 줍니다. 상점에 도착한 것이 곧 수입이라는
    // 연결이 여기서 보여야, 다음 판에 한 층이라도 더 올라갈 이유가 됩니다.
    if (this.earned) {
      const gained = this.add.text(cx, 186, '+' + this.earned + ' 방금 판에서',
        font(20, '#a5d6a7')).setOrigin(0.5);
      this.tweens.add({ targets: gained, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    }

    this.items = medalItemsFor(this.job);
    this.rows = this.items.map((item, i) => this.buildRow(item, cx, 250 + i * 84));

    const btnY = CFG.height - 96;
    const btn = this.add.rectangle(cx, btnY, 420, 66, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    this.add.text(cx, btnY, '탑에 오르기', font(30, '#ffffff')).setOrigin(0.5);
    this.startAt = { x: cx, y: btnY };
    btn.on('pointerdown', () => this.scene.start('game', { jobKey: this.job.key }));

    const backY = CFG.height - 34;
    const back = this.add.text(cx, backY, '직업 다시 고르기', font(20, '#8794b5'))
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.backAt = { x: cx, y: backY };
    back.on('pointerdown', () => this.scene.start('select'));

    this.refresh();
    window.__medal = this; // 자동 시험에서 좌표를 읽어 가기 위한 통로
  }

  buildRow(item, cx, y) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    const box = this.add.rectangle(cx, y, 440, 72, 0x232b47)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true });
    const name = this.add.text(cx - 200, y - 20, item.title, font(24, '#ffffff'));
    const desc = this.add.text(cx - 200, y + 8, item.desc, font(17, '#8794b5'));
    const price = this.add.text(cx + 200, y, '🏅 ' + item.price, font(22, '#ffd54f')).setOrigin(1, 0.5);

    box.on('pointerdown', () => this.buy(item));
    return { item, box, name, desc, price };
  }

  buy(item) {
    // 같은 것을 두 번 사도 겹치지 않습니다. 한 판에 하나씩입니다.
    if (Save.data.boosts[item.key]) return;
    if (!Save.spendMedals(item.price)) return;
    Save.setBoost(item.key, true);
    this.refresh();
  }

  // 살 수 있는 것 · 이미 산 것 · 메달이 모자란 것을 눈에 보이게 나눕니다.
  refresh() {
    this.medalLabel.setText('가진 메달  🏅 ' + Save.medals);

    this.rows.forEach(({ item, box, name, desc, price }) => {
      if (Save.data.boosts[item.key]) {
        box.setFillStyle(0x171c2e).setStrokeStyle(2, 0x2a3252);
        name.setColor('#4a5578');
        desc.setColor('#3c456b');
        price.setColor('#4a5578').setText('구입함');
        return;
      }
      const can = Save.medals >= item.price;
      box.setFillStyle(can ? 0x232b47 : 0x1c2136).setStrokeStyle(2, can ? 0x3f4a78 : 0x2a3252);
      name.setColor(can ? '#ffffff' : '#6b7599');
      desc.setColor(can ? '#8794b5' : '#4a5578');
      price.setColor(can ? '#ffd54f' : '#6b7599').setText('🏅 ' + item.price);
    });
  }
}
