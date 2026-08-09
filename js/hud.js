// 화면 위쪽 정보 띠. 카메라에 고정됩니다.
class Hud {
  constructor(scene) {
    this.scene = scene;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const fixed = (o) => o.setScrollFactor(0).setDepth(100);

    // 발판이 뒤로 지나가도 글씨가 읽히도록 어두운 띠를 깝니다.
    fixed(scene.add.rectangle(0, 0, CFG.width, 108, 0x0d1120, 0.85).setOrigin(0, 0));

    this.hpBg = fixed(scene.add.rectangle(24, 30, 240, 22, 0x000000, 0.45).setOrigin(0, 0.5));
    this.hpBar = fixed(scene.add.rectangle(27, 30, 234, 16, 0x66bb6a).setOrigin(0, 0.5)).setDepth(101);
    this.hpText = fixed(scene.add.text(276, 30, '', font(18, '#b0bec5')).setOrigin(0, 0.5));

    this.floorText = fixed(scene.add.text(CFG.width - 24, 14, '', font(30, '#ffffff')).setOrigin(1, 0));
    this.coinText = fixed(scene.add.text(CFG.width - 24, 52, '', font(24, '#ffd54f')).setOrigin(1, 0));

    this.weaponText = fixed(scene.add.text(24, 56, '', font(24, '#ffffff')));
    this.plusText = fixed(scene.add.text(0, 58, '', font(22, '#ffd54f')));
    this.multText = fixed(scene.add.text(0, 58, '', font(22, '#4fc3f7')));

    this.hint = fixed(scene.add.text(CFG.width / 2, CFG.height - 70,
      '왼쪽 / 가운데 / 오른쪽을 눌러 길을 고르세요', font(22, '#ffffff')).setOrigin(0.5)).setAlpha(0.85);
  }

  update() {
    const s = this.scene;
    const w = s.weapon;

    this.hpBar.width = Math.max(0, 234 * (s.hp / s.maxHp));
    this.hpBar.fillColor = s.hp > s.maxHp * 0.5 ? 0x66bb6a : s.hp > s.maxHp * 0.25 ? 0xffb74d : 0xef5350;
    this.hpText.setText(Math.max(0, Math.ceil(s.hp)) + ' / ' + s.maxHp);

    this.floorText.setText(s.floorIndex + '층');
    this.coinText.setText('◎ ' + s.coins);

    // 무기 이름 뒤에 강화 현황을 붙입니다. 없으면 표시하지 않습니다.
    this.weaponText.setText(w.name);
    let x = this.weaponText.x + this.weaponText.width + 10;

    this.plusText.setText(w.plus ? '+' + w.plus : '').setX(x);
    if (w.plus) x += this.plusText.width + 8;

    this.multText.setText(w.mult > 1 ? '×' + w.mult : '').setX(x);
  }

  fadeHint(delta) {
    if (this.hint.alpha > 0) this.hint.setAlpha(Math.max(0, this.hint.alpha - delta / 800));
  }
}
