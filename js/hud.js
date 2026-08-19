// ── 초당 피해를 화면에 적을 때 나누는 값 ──────────────────
// 체력은 세 자리(184 → 천 몇백)인데 초당 피해는 만 단위까지 갑니다. 같은
// 화면에 나란히 놓으니 단위가 어긋나 보여서, 둘 중 하나가 잘못 적힌 것처럼
// 읽혔습니다. 숫자의 크기를 서로 맞춰 줍니다.
//
// **표시에서만 나눕니다.** 무기의 피해도 적의 체력도 건드리지 않습니다 —
// 둘을 같은 값으로 나눠 고치는 것과 결과가 완전히 같은데(잡는 데 걸리는
// 대수는 체력÷피해라 나눈 값이 약분됩니다), 서른여섯 개나 되는 무기 피해값을
// 손으로 옮겨 적는 위험만 없습니다. UP 발판의 `+12%` 같은 비율 표시도
// 나누기가 약분되므로 그대로 맞습니다.
//
// 100이 아니라 10인 것은, 100으로 나누면 시작 무기가 `초당 1`이 되어
// "이걸 올려서 뭐하나" 싶은 숫자가 되기 때문입니다.
const DPS_DISPLAY_DIV = 10;

// 화면 위쪽 정보 띠. 카메라에 고정됩니다.
class Hud {
  constructor(scene) {
    this.scene = scene;

    // 지난 프레임에 화면에 적은 값들. `update` 가 여기와 견주어 **달라진 것만**
    // 다시 씁니다 (자세한 것은 update 위 주석). 아래 setBoss 가 벌써 이걸
    // 쓰므로 무엇보다 먼저 세웁니다. 처음에는 비어 있어서 첫 프레임에
    // 모든 줄이 한 번씩 채워집니다.
    this.last = { relicList: [], trophies: 0, plusCapped: null, bossOn: null, bossPct: -1 };

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const fixed = (o) => o.setScrollFactor(0).setDepth(100);

    // 발판이 뒤로 지나가도 글씨가 읽히도록 어두운 띠를 깝니다.
    // 108 → 132 → 140. 무기 한 줄(공격력 범위·정확도·사거리)이 아래에 붙으면서
    // 키웠습니다 — 무기가 사다리가 아니라 자루마다 성격이 다른 것이 되었으니,
    // 지금 든 것이 어떤 자루인지가 늘 보여야 합니다.
    //
    // **줄 간격은 글꼴 크기가 아니라 글자 상자 높이로 잡아야 합니다.**
    // 24px 한글의 상자는 26px 이라, 줄을 24px 간격으로 두었더니 아랫줄이
    // 윗줄 상자 안으로 들어갔습니다 (「장검 +2」와 「초당 18」이 3px 겹쳤습니다).
    // 아래 자리들은 전부 재 본 상자 높이에 몇 px 씩 얹어서 잡았습니다.
    fixed(scene.add.rectangle(0, 0, CFG.width, 140, 0x0d1120, 0.85).setOrigin(0, 0));

    // 체력바와 그 아래 붙은 방어력 띠. 둘을 한 덩어리로 보이게 붙여 둡니다.
    this.hpBg = fixed(scene.add.rectangle(24, 28, 240, 22, 0x000000, 0.45).setOrigin(0, 0.5));
    this.hpBar = fixed(scene.add.rectangle(27, 28, 234, 16, 0x66bb6a).setOrigin(0, 0.5)).setDepth(101);
    this.hpText = fixed(scene.add.text(276, 28, '', font(18, '#b0bec5')).setOrigin(0, 0.5));

    this.armorBg = fixed(scene.add.rectangle(24, 47, 240, 12, 0x000000, 0.55).setOrigin(0, 0.5));
    this.armorBar = fixed(scene.add.rectangle(27, 47, 0, 8, 0xb0bec5).setOrigin(0, 0.5)).setDepth(101);
    this.armorText = fixed(scene.add.text(276, 47, '', font(15, '#cfd8dc')).setOrigin(0, 0.5));

    // 오른쪽 칸은 넷이 세로로 섭니다 — 층 · 코인 · 메달 · 유물.
    // 메달은 예전에 **코인 왼쪽에 나란히** 붙었습니다. 그러면 자리가 왼쪽으로
    // 밀리는데, 그 아래(y 62~88)가 무기 이름과 강화 표시가 뻗어 가는 줄이라
    // 「벼린 혼돈대검 +12 ×1.30 한계」처럼 길어지면 🏅 위로 올라탔습니다.
    // 오른쪽 끝에 맞춰 제 줄에 세우면 왼쪽이 얼마나 길어져도 부딪히지 않습니다.
    this.floorText = fixed(scene.add.text(CFG.width - 24, 14, '', font(30, '#ffffff')).setOrigin(1, 0));
    this.coinText = fixed(scene.add.text(CFG.width - 24, 52, '', font(24, '#ffd54f')).setOrigin(1, 0));
    // 0일 때는 자리를 비웁니다 — 아직 하나도 없는 첫 판에 설명 없는 기호가
    // 떠 있으면 그냥 노이즈입니다.
    this.medalText = fixed(scene.add.text(CFG.width - 24, 84, '', font(20, '#ffca28')).setOrigin(1, 0));

    // 들고 있는 무기. 이름만 적어 두면 열두 자루가 전부 같은 글자 덩어리로 보여서,
    // 방금 UP을 밟아 무엇이 바뀌었는지가 눈에 안 들어옵니다. 그림이 있어야
    // 발판 위의 다음 무기 그림과 짝이 맞습니다 — 저것을 밟으면 이게 저것이 됩니다.
    // 무기 칸은 세 줄입니다. 아이콘은 그 세 줄의 한가운데에 섭니다.
    //
    //   62  이름  +2  ×1.18     (23px · 상자 25)
    //   91  초당 18 · 수호 부적   (19px · 상자 21)
    //  115  53~78 정확 92% 거리   (15px · 상자 16)
    fixed(scene.add.circle(40, 97, 20, 0x232b47).setStrokeStyle(2, 0x3f4a78));
    this.weaponIcon = fixed(scene.add.image(40, 97, weaponIconKey('warrior', 0)))
      .setDisplaySize(34, 34).setDepth(101);
    // 66 부터입니다. 동그라미가 59 에서 끝나는데 60 에 글자를 두었더니
    // 이름 첫 글자가 테두리에 붙어 보였습니다.
    this.weaponText = fixed(scene.add.text(66, 62, '', font(23, '#ffffff')));
    this.plusText = fixed(scene.add.text(0, 64, '', font(20, '#ffd54f')));
    this.multText = fixed(scene.add.text(0, 64, '', font(20, '#4fc3f7')));
    this.relicText = fixed(scene.add.text(CFG.width - 24, 112, '', font(17, '#ffd54f')).setOrigin(1, 0));

    // ── 지금 든 자루가 어떤 물건인가 ───────────────────
    // 이름과 초당 피해만으로는 모자랍니다. 무기가 계단이던 시절에는 이름이
    // 곧 세기였지만, 지금은 같은 초당 피해라도 「74~108 · 92%」와
    // 「101~175 · 83%」가 전혀 다른 자루입니다. 그 차이가 늘 보여야
    // 다음에 만나는 자루를 고를 수 있습니다.
    // 자세한 것은 일시정지 화면에서 봅니다 (js/scene-pause.js).
    this.statText = fixed(scene.add.text(66, 115, '', font(15, '#8794b5')));

    // 초당 피해. **"그래서 센가?"에 답하는 유일한 숫자입니다.**
    // 공격력만 적으면 `속`을 주워도 숫자가 안 움직여서, 주운 사람이
    // "이건 아무것도 안 하는구나"로 배웁니다 (js/weapon.js 의 dps).
    //
    // 무기 이름 **아래 줄**에 둡니다. 오른쪽에 붙였더니 코인·메달과 겹쳤습니다.
    this.dpsText = fixed(scene.add.text(66, 91, '', font(19, '#ff8a65')));

    // 수호 부적. 가지고 있는 동안만 보입니다 — 안 보이면 샀는지 깨졌는지를
    // 알 길이 없어서, 깨지고 나서 죽으면 "부적이 안 들었다"가 됩니다.
    // 글자로 적습니다 — 방패 그림문자는 기기에 따라 하트로 떨어집니다.
    this.charmText = fixed(scene.add.text(0, 93, '', font(17, '#4dd0e1')));

    // ── 보스 체력 ──────────────────────────────────────
    // 보스와 싸우는 동안만 보입니다. 얼마나 남았는지 안 보이면
    // 끝이 안 나는 싸움처럼 느껴집니다.
    //
    // 자리는 **띠 바로 아래**입니다. 예전엔 y=132 로 띠 안에 들어와 있어서
    // 무기 수치 줄(y 115~131) 위에 그대로 얹혔습니다 — 보스와 싸우는 동안만
    // 그러니 눈치채기 어려운 자리였습니다.
    this.bossBox = fixed(scene.add.rectangle(CFG.width / 2, 158, 448, 30, 0x000000, 0.55));
    this.bossBar = fixed(scene.add.rectangle(CFG.width / 2 - 220, 158, 440, 22, 0xef5350)
      .setOrigin(0, 0.5)).setDepth(101);
    this.bossName = fixed(scene.add.text(CFG.width / 2, 158, '', font(18, '#ffffff')).setOrigin(0.5))
      .setDepth(102);
    this.setBoss(null);

    // ── 일시정지 단추 ──────────────────────────────────
    // 오른쪽 아래 구석. 방향 단추 셋과 겹치지 않는 유일한 자리입니다.
    // 스스로 입력을 받지 않습니다 — 화면 전체가 이동 입력을 받으므로 한 번
    // 누른 것이 양쪽에 먹힐 수 있어서, 자리로 걸러 냅니다
    // (js/scene-game.js 의 bindInput 과 아래 hitsPauseButton).
    this.pauseAt = { x: CFG.width - 44, y: CFG.height - 44, r: 30 };
    fixed(scene.add.circle(this.pauseAt.x, this.pauseAt.y, 24, 0xffffff, 0.06)
      .setStrokeStyle(2, 0xffffff, 0.18));
    fixed(scene.add.text(this.pauseAt.x, this.pauseAt.y, '❚❚',
      font(20, '#ffffff')).setOrigin(0.5)).setAlpha(0.6);

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
  //
  // 이것도 매 프레임 불립니다 (update 안에서). 그래서 켜고 끄는 것은 상태가
  // 바뀔 때만 하고, 띠는 남은 체력의 **퍼센트가 달라졌을 때만** 다시 씁니다 —
  // 보스 체력은 한 대에 소수점 아래로 움직이는데 화면에 적히는 것은 정수라,
  // 그대로 두면 초당 예순 번씩 같은 글자를 다시 그립니다.
  setBoss(boss) {
    const L = this.last;
    const on = !!(boss && boss.active);
    if (on !== L.bossOn) {
      L.bossOn = on;
      this.bossBox.setVisible(on);
      this.bossBar.setVisible(on);
      this.bossName.setVisible(on);
      L.bossPct = -1; // 다시 켜질 때는 무조건 한 번 씁니다
    }
    if (!on) return;

    const left = Math.max(0, boss.hp / boss.maxHp);
    const pct = Math.ceil(left * 100);
    this.bossBar.width = 440 * left; // 띠 길이는 매끄럽게 — 값 대입뿐이라 쌉니다
    if (pct === L.bossPct && boss === L.boss) return;
    L.bossPct = pct; L.boss = boss;

    // 체력이 닳을수록 보스가 몰아치므로, 띠 색도 같이 달아오릅니다.
    this.bossBar.fillColor = left > 0.5 ? 0xef5350 : left > 0.25 ? 0xff7043 : 0xffca28;
    // 이름은 놈마다 다릅니다 (CFG.boss.kinds).
    const name = (boss.def && boss.def.name) || '탑의 수문장';
    this.bossName.setText(name + '   ' + pct + '%');
  }

  // 그 방향에 실제로 발판이 있는지에 따라 밝기를 달리합니다.
  setArrows(available) {
    this.arrows.forEach((a, i) => {
      const on = available[i];
      a.ring.setFillStyle(0xffffff, on ? 0.06 : 0.02).setStrokeStyle(2, 0xffffff, on ? 0.2 : 0.07);
      a.glyph.setAlpha(on ? 0.75 : 0.2);
    });
  }

  // 누른 자리가 일시정지 단추 안인지. 화면 전체가 이동 입력을 받으므로
  // 이동보다 **먼저** 물어봐야 합니다.
  hitsPauseButton(x, y) {
    const p = this.pauseAt;
    return Phaser.Math.Distance.Between(x, y, p.x, p.y) <= p.r;
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

  // ── 매 프레임 도는 유일한 UI 코드입니다 ─────────────────
  //
  // **바뀐 값에만 손을 댑니다.** 예전에는 열한 줄을 조건 없이 다시 썼습니다.
  // 화면에 보이는 것은 똑같았지만, 재 보니 이 함수 하나가 한 프레임에 0.32ms —
  // 60fps 예산의 2%였고 다음으로 무거운 것(`swing`)의 2.6배였습니다.
  // 이유가 둘이었습니다.
  //
  //   · **`setColor` 는 같은 색을 넣어도 글자 캔버스를 통째로 다시 그립니다.**
  //     한 번에 17.7µs — 아무 일도 안 하는데 이 함수 비용의 절반이었습니다.
  //     (`setText` 만 같은 글자를 걸러 줍니다. `setColor`·`setFontSize`·
  //     `setStroke` 같은 것은 안 걸러 줍니다.)
  //   · `setText` 가 걸러 주더라도 **넘길 글자를 만드는 일은 그대로** 일어납니다.
  //     붙이기·`toFixed`·`map/join` 이 초당 수천 개의 짧은 문자열을 만들었다
  //     버렸습니다. 기기가 느릴수록 이 쓰레기를 치우는 값이 큽니다.
  //
  // 그래서 아래는 전부 "이 값이 달라졌을 때만" 꼴입니다. 조건이 길어 보이지만
  // **여기서는 그 반복이 요점입니다** — 값 하나를 빼먹으면 화면이 멎습니다.
  // 캐시는 `this.last` 하나에 모읍니다.
  update() {
    const s = this.scene;
    const w = s.weapon;
    const L = this.last;

    // ── 체력 ──────────────────────────────────────────
    if (s.hp !== L.hp || s.maxHp !== L.maxHp) {
      L.hp = s.hp; L.maxHp = s.maxHp;
      this.hpBar.width = Math.max(0, 234 * (s.hp / s.maxHp));
      this.hpBar.fillColor = s.hp > s.maxHp * 0.5 ? 0x66bb6a
        : s.hp > s.maxHp * 0.25 ? 0xffb74d : 0xef5350;
      this.hpText.setText(Math.max(0, Math.ceil(s.hp)) + ' / ' + s.maxHp);
    }

    // ── 방어력, 또는 갑옷을 안 입는 직업에게는 회피 ────
    // 가득 차면 CFG.armor.max 입니다.
    if (s.job.usesArmor) {
      if (s.armor !== L.armor || s.armorMax !== L.armorMax) {
        L.armor = s.armor; L.armorMax = s.armorMax;
        // 방어력은 막을 때마다 조금씩 닳습니다. 띠가 눈에 띄게 줄어들어야
        // "채워 넣어야 하는 것"으로 읽힙니다.
        this.armorBar.width = 234 * Math.min(1, s.armor / s.armorMax);
        this.armorBar.fillColor = s.armor > 25 ? 0xb0bec5 : 0xff8a65;
        this.armorText.setText('방어 ' + Math.round(s.armor) + '%');
      }
    } else if (s.dodge !== L.dodge || s.armor !== L.armor || s.dodgeMax !== L.dodgeMax) {
      L.dodge = s.dodge; L.armor = s.armor; L.dodgeMax = s.dodgeMax;
      // 회피도 판 안에서 자랍니다 ('회' 아이템). 갑옷 띠 자리를 그대로 씁니다.
      this.armorBar.width = 234 * Math.min(1, s.dodge / (s.dodgeMax || 1));
      this.armorBar.fillColor = 0xce93d8;
      // 도적의 가죽은 자라지도 닳지도 않지만, 안 보이면 없는 것과 같습니다 —
      // 부적이 안 보여서 "안 든다"가 됐던 것과 같은 자리입니다.
      this.armorText.setText('회피 ' + Math.round(s.dodge * 100) + '%' +
        (s.armor > 0 ? '  가죽 ' + Math.round(s.armor) + '%' : ''));
    }

    this.setBoss(s.boss);

    if (s.floorIndex !== L.floor) {
      L.floor = s.floorIndex;
      this.floorText.setText(s.floorIndex + '층');
    }

    // 메달은 코인 글자 너비에 붙으므로, 코인이 바뀌면 메달 자리도 다시 잡습니다.
    if (s.coins !== L.coins || s.medals !== L.medals) {
      const coinsChanged = s.coins !== L.coins;
      L.coins = s.coins; L.medals = s.medals;
      if (coinsChanged) this.coinText.setText('◎ ' + s.coins);
      this.medalText.setText(s.medals ? '🏅 ' + s.medals : '');
    }

    // ── 무기 ──────────────────────────────────────────
    if (w.index !== L.index) {
      L.index = w.index;
      const icon = weaponIconKey(s.job.key, w.index);
      if (this.weaponIcon.texture.key !== icon) {
        this.weaponIcon.setTexture(icon).setDisplaySize(34, 34);
      }
      this.weaponText.setText(w.name);
    }

    // 무기 한 줄. 자루가 바뀌거나 `+1`을 주우면 다시 씁니다.
    if (w.index !== L.statIndex || w.dmgMin !== L.dmgMin || w.rate !== L.rate) {
      L.statIndex = w.index; L.dmgMin = w.dmgMin; L.rate = w.rate;
      const far = w.range || w.reach;
      this.statText.setText(w.dmgMin + '~' + w.dmgMax
        + '  정확 ' + Math.round(w.accuracy * 100) + '%'
        + '  거리 ' + Math.round(far)
        + (w.shots > 1 ? '  ' + w.shots + '곳' : ''));
    }

    const dps = Math.round(w.dps / DPS_DISPLAY_DIV);
    if (dps !== L.dps) {
      L.dps = dps;
      this.dpsText.setText('초당 ' + shortNum(dps));
      // 부적 글자는 초당 피해 글자 오른쪽에 붙습니다. 앞이 길어지면 같이 밀립니다.
      L.charm = null;
    }
    if (!!s.charm !== L.charm) {
      L.charm = !!s.charm;
      this.charmText.setText(s.charm ? '· 수호 부적' : '')
        .setX(this.dpsText.x + this.dpsText.width + 12);
    }

    // ── 강화 현황 — 무기 이름 뒤에 이어 붙습니다 ────────
    // `+1`이 사라지면 `×1.30`이 그 자리로 당겨져야 하므로, 둘 중 하나만
    // 바뀌어도 두 글자의 자리를 같이 다시 잡습니다.
    // 도적은 +1이 절반 값이라 실제 붙은 양을 그대로 적습니다 (+2.5 처럼).
    const shown = Number(w.plusValue.toFixed(1));
    // 공격력도 한계에 닿습니다 (자루마다 다릅니다 — 보통 열, 무명은 쉰).
    // 닿았다고 적어 줘야, 다음에 +1 을 보고 그냥 지나칠지 판단할 수 있습니다.
    const plusCapped = w.plusCapped;
    // 속도는 속(더하기)과 ×2(곱하기)가 섞여서 한계에서 잘립니다. 그래서 쌓은
    // 개수가 아니라 합쳐진 결과를 그대로 보여 줍니다. 한계에 닿았으면 그렇다고
    // 적어 줘야, 다음에 속을 보고 그냥 지나칠지 판단할 수 있습니다.
    const speed = w.speedMult;
    const capped = w.speedCapped;
    if (shown !== L.plus || speed !== L.speed || capped !== L.capped
        || plusCapped !== L.plusCapped || w.index !== L.boostIndex) {
      L.plus = shown; L.speed = speed; L.capped = capped; L.boostIndex = w.index;

      let x = this.weaponText.x + this.weaponText.width + 10;
      this.plusText.setText(shown ? '+' + shown + (plusCapped ? ' 한계' : '') : '').setX(x);
      if (plusCapped !== L.plusCapped) {
        L.plusCapped = plusCapped;
        this.plusText.setColor(plusCapped ? '#ffb74d' : '#ffd54f');
      }
      if (shown) x += this.plusText.width + 8;

      this.multText
        .setText(speed > 1.001 ? '×' + speed.toFixed(2) + (capped ? ' 한계' : '') : '')
        .setX(x)
        .setScale(1);
      // 오른쪽 코인 칸까지는 넘지 않게 합니다. 이름이 가장 긴 자루에 강화가
      // 가득 붙고 코인이 여섯 자리가 되는, 판 끝물에만 오는 조합입니다.
      // 글자를 지우는 대신 그만큼만 줄입니다 — 지우면 무엇이 잘렸는지 모릅니다.
      const room = this.coinText.x - this.coinText.width - 12 - x;
      if (this.multText.width > room) {
        this.multText.setScale(Math.max(0.7, room / this.multText.width));
      }
      // 색은 한계에 닿았는지가 바뀔 때만 — 이 한 줄이 예전의 가장 비싼 곳이었습니다.
      if (capped !== L.cappedColor) {
        L.cappedColor = capped;
        this.multText.setColor(capped ? '#ffb74d' : '#4fc3f7');
      }
    }

    // ── 유물 ──────────────────────────────────────────
    // 여러 개를 겹쳐 듭니다. 이름을 다 적으면 줄이 넘치므로 아이콘을 나열하고
    // 개수만 붙입니다. 자세한 것은 죽음 화면에서 봅니다.
    //
    // 개수만 보면 안 됩니다. 꽉 찼을 때 하나를 버리고 하나를 받으면 **개수가
    // 그대로**라, 화면에는 버린 유물의 아이콘이 남습니다. 그래서 하나하나를
    // 대조합니다 — 바뀌었을 때만 복사하므로 평소에는 아무것도 안 만듭니다.
    let relicsChanged = w.relics.length !== L.relicList.length;
    for (let i = 0; !relicsChanged && i < w.relics.length; i++) {
      if (L.relicList[i] !== w.relics[i]) relicsChanged = true;
    }
    // 보스 전리품도 같은 줄에 붙습니다. 눈은 주인공 둘레를 돌고 있어 화면에
    // 이미 보이지만, **몇 개인지**는 도는 것만 봐서는 안 세집니다.
    const trophies = s.trophies ? s.trophies.count : 0;
    if (relicsChanged || trophies !== L.trophies) {
      L.relicList = w.relics.slice();
      L.trophies = trophies;
      const marks = w.relics.map((r) => r.icon);
      if (w.relics.length > 2) marks.push('×' + w.relics.length);
      // 전리품은 종류마다 다른 표입니다 (js/trophies.js 의 marks).
      if (trophies) marks.push(s.trophies.marks());
      this.relicText.setText(marks.join(' '));
    }
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
