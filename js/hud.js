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
    // 메달은 코인 왼쪽에 나란히 붙습니다. 자리는 코인 글자 너비에 따라
    // 매번 다시 잡습니다 (아래 update). 0일 때는 자리를 비웁니다 —
    // 아직 하나도 없는 첫 판에 설명 없는 기호가 떠 있으면 그냥 노이즈입니다.
    this.medalText = fixed(scene.add.text(0, 55, '', font(20, '#ffca28')).setOrigin(1, 0));

    // 들고 있는 무기. 이름만 적어 두면 열두 자루가 전부 같은 글자 덩어리로 보여서,
    // 방금 UP을 밟아 무엇이 바뀌었는지가 눈에 안 들어옵니다. 그림이 있어야
    // 발판 위의 다음 무기 그림과 짝이 맞습니다 — 저것을 밟으면 이게 저것이 됩니다.
    fixed(scene.add.circle(40, 81, 19, 0x232b47).setStrokeStyle(2, 0x3f4a78));
    this.weaponIcon = fixed(scene.add.image(40, 81, weaponIconKey('warrior', 0)))
      .setDisplaySize(34, 34).setDepth(101);
    this.weaponText = fixed(scene.add.text(60, 66, '', font(24, '#ffffff')));
    this.plusText = fixed(scene.add.text(0, 68, '', font(22, '#ffd54f')));
    this.multText = fixed(scene.add.text(0, 68, '', font(22, '#4fc3f7')));
    this.relicText = fixed(scene.add.text(CFG.width - 24, 96, '', font(17, '#ffd54f')).setOrigin(1, 0));

    // 초당 피해. **"그래서 센가?"에 답하는 유일한 숫자입니다.**
    // 공격력만 적으면 `속`을 주워도 숫자가 안 움직여서, 주운 사람이
    // "이건 아무것도 안 하는구나"로 배웁니다 (js/weapon.js 의 dps).
    //
    // 무기 이름 **아래 줄**에 둡니다. 오른쪽에 붙였더니 코인·메달과 겹쳤습니다.
    this.dpsText = fixed(scene.add.text(60, 90, '', font(19, '#ff8a65')));

    // 수호 부적. 가지고 있는 동안만 보입니다 — 안 보이면 샀는지 깨졌는지를
    // 알 길이 없어서, 깨지고 나서 죽으면 "부적이 안 들었다"가 됩니다.
    // 글자로 적습니다 — 방패 그림문자는 기기에 따라 하트로 떨어집니다.
    this.charmText = fixed(scene.add.text(0, 90, '', font(17, '#4dd0e1')));

    // ── 보스 체력 ──────────────────────────────────────
    // 보스와 싸우는 동안만 보입니다. 얼마나 남았는지 안 보이면
    // 끝이 안 나는 싸움처럼 느껴집니다.
    this.bossBox = fixed(scene.add.rectangle(CFG.width / 2, 132, 448, 30, 0x000000, 0.55));
    this.bossBar = fixed(scene.add.rectangle(CFG.width / 2 - 220, 132, 440, 22, 0xef5350)
      .setOrigin(0, 0.5)).setDepth(101);
    this.bossName = fixed(scene.add.text(CFG.width / 2, 132, '', font(18, '#ffffff')).setOrigin(0.5))
      .setDepth(102);
    this.setBoss(null);

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

  // 보스가 있으면 띠를 켜고, 없으면 통째로 숨깁니다.
  setBoss(boss) {
    const on = !!(boss && boss.active);
    [this.bossBox, this.bossBar, this.bossName].forEach((o) => o.setVisible(on));
    if (!on) return;
    const left = Math.max(0, boss.hp / boss.maxHp);
    this.bossBar.width = 440 * left;
    // 체력이 닳을수록 보스가 몰아치므로, 띠 색도 같이 달아오릅니다.
    this.bossBar.fillColor = left > 0.5 ? 0xef5350 : left > 0.25 ? 0xff7043 : 0xffca28;
    // 이름은 놈마다 다릅니다 (CFG.boss.kinds).
    const name = (boss.def && boss.def.name) || '탑의 수문장';
    this.bossName.setText(name + '   ' + Math.ceil(left * 100) + '%');
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
      // 방어력은 막을 때마다 조금씩 닳습니다. 띠가 눈에 띄게 줄어들어야
      // "채워 넣어야 하는 것"으로 읽힙니다.
      this.armorBar.width = 234 * Math.min(1, s.armor / s.armorMax);
      this.armorBar.fillColor = s.armor > 25 ? 0xb0bec5 : 0xff8a65;
      this.armorText.setText('방어 ' + Math.round(s.armor) + '%');
    } else {
      // 회피도 판 안에서 자랍니다 ('회' 아이템). 갑옷 띠 자리를 그대로 씁니다.
      this.armorBar.width = 234 * Math.min(1, s.dodge / (s.dodgeMax || 1));
      this.armorBar.fillColor = 0xce93d8;
      this.armorText.setText('회피 ' + Math.round(s.dodge * 100) + '%');
    }

    this.setBoss(s.boss);

    this.floorText.setText(s.floorIndex + '층');
    this.coinText.setText('◎ ' + s.coins);
    this.medalText.setText(s.medals ? '🏅 ' + s.medals : '')
      .setX(this.coinText.x - this.coinText.width - 16);

    // 무기 이름 뒤에 강화 현황을 붙입니다. 없으면 표시하지 않습니다.
    const icon = weaponIconKey(s.job.key, w.tier);
    if (this.weaponIcon.texture.key !== icon) {
      this.weaponIcon.setTexture(icon).setDisplaySize(34, 34);
    }
    this.weaponText.setText(w.name);
    this.dpsText.setText('초당 ' + shortNum(w.dps));
    this.charmText.setText(s.charm ? '· 수호 부적' : '')
      .setX(this.dpsText.x + this.dpsText.width + 12);
    let x = this.weaponText.x + this.weaponText.width + 10;

    // 도적은 +1이 절반 값이라 실제 붙은 양을 그대로 적습니다 (+2.5 처럼).
    const shown = Number(w.plusValue.toFixed(1));
    this.plusText.setText(shown ? '+' + shown : '').setX(x);
    if (shown) x += this.plusText.width + 8;

    // 속도는 속(더하기)과 ×2(곱하기)가 섞여서 한계에서 잘립니다. 그래서 쌓은
    // 개수가 아니라 합쳐진 결과를 그대로 보여 줍니다. 한계에 닿았으면 그렇다고
    // 적어 줘야, 다음에 속을 보고 그냥 지나칠지 판단할 수 있습니다.
    const speed = w.speedMult;
    this.multText.setText(speed > 1.001 ? '×' + speed.toFixed(2) + (w.speedCapped ? ' 한계' : '') : '')
      .setColor(w.speedCapped ? '#ffb74d' : '#4fc3f7')
      .setX(x);

    // 유물은 여러 개를 겹쳐 듭니다. 이름을 다 적으면 줄이 넘치므로
    // 아이콘을 나열하고 개수만 붙입니다. 자세한 것은 죽음 화면에서 봅니다.
    this.relicText.setText(w.relics.length
      ? w.relics.map((r) => r.icon).join(' ') + (w.relics.length > 2 ? '  ×' + w.relics.length : '')
      : '');
  }

  fadeHint(delta) {
    if (this.hint.alpha > 0) this.hint.setAlpha(Math.max(0, this.hint.alpha - delta / 800));
  }
}

// 큰 수를 짧게. 후반에는 초당 피해가 십만을 넘어가는데, 자릿수를 다 적으면
// 읽는 데 시간이 걸려서 **비교**가 안 됩니다 — 이 숫자는 어차피 크기를 견주는
// 데 씁니다. 만 아래는 그대로 적어 정확히 보이게 둡니다.
function shortNum(n) {
  if (n < 10000) return n.toLocaleString('ko-KR');
  if (n < 100000000) return (n / 10000).toFixed(n < 100000 ? 1 : 0) + '만';
  return (n / 100000000).toFixed(1) + '억';
}
