// 화면 위쪽 정보 띠. 카메라에 고정됩니다.
class Hud {
  constructor(scene) {
    this.scene = scene;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const fixed = (o) => o.setScrollFactor(0).setDepth(100);

    // 발판이 뒤로 지나가도 글씨가 읽히도록 어두운 띠를 깝니다.
    fixed(scene.add.rectangle(0, 0, CFG.width, 108, 0x0d1120, 0.85).setOrigin(0, 0));

    // 체력바와 그 아래 붙은 방어력 띠. 둘을 한 덩어리로 보이게 붙여 둡니다.
    this.hpBg = fixed(scene.add.rectangle(24, 28, 240, 22, 0x000000, 0.45).setOrigin(0, 0.5));
    this.hpBar = fixed(scene.add.rectangle(27, 28, 234, 16, 0x66bb6a).setOrigin(0, 0.5)).setDepth(101);
    this.hpText = fixed(scene.add.text(276, 28, '', font(18, '#b0bec5')).setOrigin(0, 0.5));

    this.armorBg = fixed(scene.add.rectangle(24, 47, 240, 12, 0x000000, 0.55).setOrigin(0, 0.5));
    this.armorBar = fixed(scene.add.rectangle(27, 47, 0, 8, 0xb0bec5).setOrigin(0, 0.5)).setDepth(101);
    this.armorText = fixed(scene.add.text(276, 47, '', font(15, '#cfd8dc')).setOrigin(0, 0.5));

    this.floorText = fixed(scene.add.text(CFG.width - 24, 14, '', font(30, '#ffffff')).setOrigin(1, 0));
    this.coinText = fixed(scene.add.text(CFG.width - 24, 52, '', font(24, '#ffd54f')).setOrigin(1, 0));

    this.weaponText = fixed(scene.add.text(24, 66, '', font(24, '#ffffff')));
    this.plusText = fixed(scene.add.text(0, 68, '', font(22, '#ffd54f')));
    this.multText = fixed(scene.add.text(0, 68, '', font(22, '#4fc3f7')));
    this.relicText = fixed(scene.add.text(CFG.width - 24, 96, '', font(17, '#ffd54f')).setOrigin(1, 0));

    this.hint = fixed(scene.add.text(CFG.width / 2, CFG.height - 70,
      '왼쪽 · 위 · 오른쪽 — 한 칸씩만 옮겨 갑니다', font(22, '#ffffff')).setOrigin(0.5)).setAlpha(0.85);

    // 누르는 자리에 그 방향을 그려 둡니다. 화면을 삼등분한 가운데에 하나씩.
    this.arrows = [-1, 0, 1].map((step, i) => {
      const x = CFG.width / 6 * (1 + i * 2);
      const y = CFG.height - 168;
      const ring = fixed(scene.add.circle(x, y, 36, 0xffffff, 0.05).setStrokeStyle(2, 0xffffff, 0.16));
      const glyph = fixed(scene.add.text(x, y, ['◀', '▲', '▶'][i], font(34, '#ffffff')).setOrigin(0.5));
      return { step, ring, glyph };
    });
    this.setArrows([true, true, true]);
  }

  // 그 방향에 실제로 발판이 있는지에 따라 밝기를 달리합니다.
  setArrows(available) {
    this.arrows.forEach((a, i) => {
      const on = available[i];
      a.ring.setFillStyle(0xffffff, on ? 0.06 : 0.02).setStrokeStyle(2, 0xffffff, on ? 0.2 : 0.07);
      a.glyph.setAlpha(on ? 0.75 : 0.2);
    });
  }

  // 눌린 방향을 잠깐 부풀려 눌렸다는 것을 알려 줍니다.
  flashArrow(step) {
    const a = this.arrows.find((x) => x.step === step);
    if (!a) return;
    this.scene.tweens.killTweensOf([a.ring, a.glyph]);
    a.ring.setScale(1);
    a.glyph.setScale(1);
    this.scene.tweens.add({
      targets: [a.ring, a.glyph], scale: 1.25, duration: 90, yoyo: true, ease: 'Quad.out',
    });
  }

  update() {
    const s = this.scene;
    const w = s.weapon;

    this.hpBar.width = Math.max(0, 234 * (s.hp / s.maxHp));
    this.hpBar.fillColor = s.hp > s.maxHp * 0.5 ? 0x66bb6a : s.hp > s.maxHp * 0.25 ? 0xffb74d : 0xef5350;
    this.hpText.setText(Math.max(0, Math.ceil(s.hp)) + ' / ' + s.maxHp);

    // 방어력은 체력바에 붙은 띠로 보여 줍니다. 가득 차면 CFG.armor.max 입니다.
    // 갑옷을 안 입는 직업은 그 자리에 회피를 보여 줍니다.
    if (s.job.usesArmor) {
      this.armorBar.width = 234 * Math.min(1, s.armor / CFG.armor.max);
      this.armorText.setText('방어 ' + s.armor + '%');
    } else {
      this.armorBar.width = 234 * s.job.dodge;
      this.armorBar.fillColor = 0xce93d8;
      this.armorText.setText('회피 ' + Math.round(s.job.dodge * 100) + '%');
    }

    this.floorText.setText(s.floorIndex + '층');
    this.coinText.setText('◎ ' + s.coins);

    // 무기 이름 뒤에 강화 현황을 붙입니다. 없으면 표시하지 않습니다.
    this.weaponText.setText(w.name);
    let x = this.weaponText.x + this.weaponText.width + 10;

    // 도적은 +1이 절반 값이라 실제 붙은 양을 그대로 적습니다 (+2.5 처럼).
    const shown = Number(w.plusValue.toFixed(1));
    this.plusText.setText(shown ? '+' + shown : '').setX(x);
    if (shown) x += this.plusText.width + 8;

    this.multText.setText(w.mult > 1 ? '×' + w.mult : '').setX(x);

    this.relicText.setText(w.relic ? '★ ' + w.relic.name : '');
  }

  fadeHint(delta) {
    if (this.hint.alpha > 0) this.hint.setAlpha(Math.max(0, this.hint.alpha - delta / 800));
  }
}
