// 메달 상점. 직업을 고른 뒤, 그리고 죽어서 메달을 받기로 한 뒤에 열립니다.
//
// **여기서 산 것은 그 직업에게 영영 남습니다.** 한 판 쓰고 사라지던 것을
// 바꿨습니다 — 매 판 다시 사야 하면 이 화면은 그냥 거쳐 가는 절차이고,
// 죽고 나서 손에 남는 것이 없습니다.
//
// 이 화면이 하는 일은 하나입니다 — **죽어도 또 켜게 만드는 것.**
// 그러려면 다음 판이 지난 판보다 나아야 하고, 그건 산 것이 남아야 됩니다.
// 그래서 이 화면은 판이 거듭될수록 **줄이 하나씩 꺼져 가는** 화면입니다.
// 직업 색을 글자 색 문자열로. 직업표의 color 는 숫자(0xef9a9a)이고
// Phaser 의 Text 는 '#...' 를 받습니다.
function jobColor(job) {
  return '#' + (job.color >>> 0).toString(16).padStart(6, '0');
}

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

    this.add.text(cx, 56, '메달 상점', font(42, '#ffffff')).setOrigin(0.5);
    // 직업 이름을 그 직업의 색으로 적습니다. 산 것이 직업마다 따로 쌓이므로,
    // **지금 누구의 것을 사고 있는지**가 한눈에 보여야 합니다.
    this.add.text(cx, 100, this.job.name, font(22, jobColor(this.job)))
      .setOrigin(0.5);
    this.add.text(cx, 128, '한 번 사면 이 직업에게 영영 남습니다',
      font(17, '#8794b5')).setOrigin(0.5);

    this.medalLabel = this.add.text(cx, 166, '', font(26, '#ffd54f')).setOrigin(0.5);

    // 방금 벌어 온 만큼을 따로 알려 줍니다. 상점에 도착한 것이 곧 수입이라는
    // 연결이 여기서 보여야, 다음 판에 한 층이라도 더 올라갈 이유가 됩니다.
    if (this.earned) {
      const gained = this.add.text(cx, 196, '+' + this.earned + ' 방금 판에서',
        font(19, '#a5d6a7')).setOrigin(0.5);
      this.tweens.add({ targets: gained, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    }

    this.items = medalItemsFor(this.job);
    this.rows = this.items.map((item, i) => this.buildRow(item, cx, 258 + i * 80));

    // ── 얼마나 모았나 ─────────────────────────────────
    // **이 화면의 목적이 "죽어도 또 켜게"라면, 남은 것이 보여야 합니다.**
    // 한 판짜리였을 때는 매번 같은 진열이라 셀 것이 없었지만, 지금은 줄이
    // 하나씩 꺼져 갑니다 — 그 진행이 곧 다음 판을 켤 이유입니다.
    //
    // 열린 직업만 적습니다. 아직 못 연 직업의 빈칸은 알려 줄 것이 없고,
    // 열려 있으면 "저쪽은 아직 하나도 없네"가 그 자체로 이유가 됩니다.
    this.progressLabel = this.add.text(cx, CFG.height - 158, '', font(17, '#8794b5'))
      .setOrigin(0.5);

    const btnY = CFG.height - 96;
    const btn = this.add.rectangle(cx, btnY, 420, 66, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    // **탑에 바로 오르지 않습니다.** 다음이 무기 도감입니다 — 만나 본 자루
    // 중에서 무엇을 들고 오를지 고르는 자리 (js/scene-weaponbook.js).
    this.add.text(cx, btnY, '무기 고르기', font(30, '#ffffff')).setOrigin(0.5);
    this.startAt = { x: cx, y: btnY };
    btn.on('pointerdown', () => this.scene.start('weaponbook', { jobKey: this.job.key }));

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
    // 한 번 사면 끝입니다. 두 번 살 것이 없습니다.
    if (Save.hasPerk(this.job.key, item.key)) return;
    if (!Save.spendMedals(item.price)) return;
    Save.addPerk(this.job.key, item.key);
    this.refresh();
  }

  // 열린 직업마다 몇을 지녔는가. 지금 보고 있는 직업은 색으로 표시합니다.
  progressLine() {
    const total = MEDAL_ITEMS.length;
    return CLASSES.filter((j) => classUnlocked(j)).map((j) => {
      const n = Object.keys(Save.perksFor(j.key)).length;
      const mark = j.key === this.job.key ? '▸ ' : '';
      return mark + j.name + ' ' + n + '/' + total;
    }).join('     ');
  }

  // 살 수 있는 것 · 이미 지닌 것 · 메달이 모자란 것을 눈에 보이게 나눕니다.
  refresh() {
    this.medalLabel.setText('가진 메달  🏅 ' + Save.medals);
    this.progressLabel.setText(this.progressLine());

    this.rows.forEach(({ item, box, name, desc, price }) => {
      // 이미 지닌 것은 꺼 두되 **글자는 「지님」**입니다. 「구입함」은 지난
      // 거래를 가리키는 말이라 한 판짜리에게 맞았습니다. 지금은 영영 붙어
      // 있는 것이라, 지나간 일이 아니라 지금의 상태를 적어야 합니다.
      if (Save.hasPerk(this.job.key, item.key)) {
        box.setFillStyle(0x1b2440).setStrokeStyle(2, 0x3a5a46);
        name.setColor('#7f9b8c');
        desc.setColor('#5a7166');
        price.setColor('#7fd4a8').setText('✓ 지님');
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
