// 일시정지 화면. 게임 장면(GameScene)을 그대로 얼려 놓고 그 위에 띄웁니다.
//
// 게임 장면을 없애지 않고 멈추기만 하는 것이 요령입니다. 멈춘 장면은 그리기는
// 계속하므로 뒤에 판이 그대로 비쳐 보이고, 되돌아올 때 아무것도 다시 짓지
// 않습니다 — 서 있던 자리도, 날아가던 화살도, 반쯤 닳은 함정도 그대로입니다.
//
// **여기가 지금 든 무기를 자세히 보는 자리이기도 합니다.** 위쪽 띠(HUD)에는
// 한 줄밖에 못 넣는데, 무기가 사다리가 아니라 자루마다 성격이 다른 것이
// 되면서 봐야 할 값이 늘었습니다. 판을 멈춘 김에 다 펼쳐 놓습니다 —
// 다음에 만나는 자루와 견주려면 지금 것을 알고 있어야 합니다.
class PauseScene extends Phaser.Scene {
  constructor() {
    super('pause');
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    // 장면은 다시 지어지지 않고 **다시 쓰입니다.** 지난번에 물어보다 만
    // 흔적이 남아 있으면 이번에는 「그만둘까요」가 안 뜹니다 (asking 이
    // 차 있으면 물음을 새로 안 세우므로).
    this.asking = null;
    const s = this.scene.get('game');
    const w = s && s.weapon;

    // 완전히 가리지 않습니다. 뒤가 비쳐 보여야 "끝난 것"이 아니라
    // "멈춘 것"으로 읽힙니다.
    this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x0d1120, 0.82);

    this.add.text(cx, 168, '일시정지', font(38, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, 210, '적도 시간도 여기서 함께 멈췄습니다', font(16, '#8794b5')).setOrigin(0.5);

    let bottom = 300;
    if (w) bottom = this.weaponPanel(cx, 262, s, w);

    const btnY = Math.min(CFG.height - 196, bottom + 60);
    const btn = this.add.rectangle(cx, btnY, 280, 66, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    this.add.text(cx, btnY, '이어서 하기', font(26, '#ffffff')).setOrigin(0.5);
    this.resumeAt = { x: cx, y: btnY }; // 자동 플레이테스트가 누를 자리

    btn.on('pointerdown', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());

    // ── 그만두기 ────────────────────────────────────────
    // **작게, 그리고 떨어뜨려 둡니다.** 되돌릴 수 없는 단추가 돌아갈 단추와
    // 같은 크기로 나란히 있으면 손이 미끄러집니다. 색도 파랑을 안 씁니다 —
    // 이 화면에서 파랑은 「판으로 돌아간다」는 뜻으로 이미 쓰고 있습니다.
    const giveY = btnY + 84;
    const give = this.add.rectangle(cx, giveY, 220, 52, 0x2a1c26)
      .setStrokeStyle(2, 0x6d4550).setInteractive({ useHandCursor: true });
    this.add.text(cx, giveY, '게임 포기하기', font(20, '#e08a92')).setOrigin(0.5);
    this.giveUpAt = { x: cx, y: giveY };
    give.on('pointerdown', () => this.askGiveUp());

    window.__pause = this;
  }

  // ── 정말 그만둘까 ──────────────────────────────────────
  //
  // **한 번 더 묻습니다.** 이건 판이 끝나는 단추인데 일시정지는 사람이 자주
  // 여는 화면이라, 한 번의 오탭으로 판이 사라지면 그건 선택이 아니라 사고입니다.
  //
  // 새 장면을 띄우지 않고 이 화면 위에 한 겹 덮습니다. 일시정지는 이미 게임
  // 장면을 얼려 놓고 그 위에 선 화면이라, 여기서 또 하나를 띄우면 장면이
  // 셋으로 겹칩니다 — 되돌아갈 때 무엇을 멈추고 무엇을 살릴지가 헷갈립니다.
  askGiveUp() {
    if (this.asking) return;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const cy = CFG.height / 2;
    const parts = [];
    const keep = (o) => { parts.push(o); return o; };

    // 아래를 짙게 덮습니다. 여기서는 뒤가 비쳐 보일 이유가 없습니다 —
    // 물어보는 동안 읽어야 할 것은 이 물음뿐입니다.
    keep(this.add.rectangle(cx, cy, CFG.width, CFG.height, 0x0d1120, 0.92)
      .setDepth(400).setInteractive());   // 뒤의 단추가 눌리지 않도록 막습니다

    keep(this.add.rectangle(cx, cy, 440, 344, 0x1b1420)
      .setStrokeStyle(2, 0x6d4550).setDepth(401));
    keep(this.add.text(cx, cy - 126, '정말 그만둘까요', font(30, '#ffffff'))
      .setOrigin(0.5).setDepth(402));

    const s = this.scene.get('game');
    const floor = s ? s.floorIndex : 0;
    keep(this.add.text(cx, cy - 80, floor + '층에서 판이 끝납니다',
      font(19, '#b0bec5')).setOrigin(0.5).setDepth(402));
    // 잃는 것을 적어 둡니다. 모르고 눌러서 잃으면 그건 함정입니다 —
    // 죽음 화면의 단추들이 지키는 규칙과 같습니다.
    keep(this.add.text(cx, cy - 46,
      '스스로 그만둔 판은 상점에서 이어서 갈 수 없습니다',
      font(16, '#e08a92')).setOrigin(0.5).setDepth(402));
    keep(this.add.text(cx, cy - 18,
      s && s.medals ? '번 메달 ' + s.medals + '개는 그대로 받습니다'
        : '이번 판에 번 메달은 없습니다',
      font(16, '#8794b5')).setOrigin(0.5).setDepth(402));

    // 「돌아가기」가 큰 쪽입니다. 물어보는 자리에서 큰 단추는 **아무 일도
    // 안 일어나는 쪽**이어야 합니다.
    const backY = cy + 46;
    const back = keep(this.add.rectangle(cx, backY, 340, 60, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setDepth(401).setInteractive({ useHandCursor: true }));
    keep(this.add.text(cx, backY, '아니요, 계속 합니다', font(22, '#ffffff'))
      .setOrigin(0.5).setDepth(402));

    const yesY = cy + 116;
    const yes = keep(this.add.rectangle(cx, yesY, 220, 50, 0x2a1c26)
      .setStrokeStyle(2, 0x6d4550).setDepth(401).setInteractive({ useHandCursor: true }));
    keep(this.add.text(cx, yesY, '그만두기', font(19, '#e08a92'))
      .setOrigin(0.5).setDepth(402));

    this.asking = parts;
    this.askBackAt = { x: cx, y: backY };
    this.askYesAt = { x: cx, y: yesY };
    back.on('pointerdown', () => this.closeAsk());
    yes.on('pointerdown', () => this.giveUp());
  }

  closeAsk() {
    if (!this.asking) return;
    this.asking.forEach((o) => o.destroy());
    this.asking = null;
  }

  // 판을 **먼저 되살리고** 끝냅니다. 멈춰 있는 장면에 죽음 화면을 세우면
  // 그려지기는 하는데 단추가 안 눌립니다 — 멈춘 장면은 입력을 안 받습니다.
  giveUp() {
    const s = this.scene.get('game');
    this.closeAsk();
    this.scene.resume('game');
    this.scene.stop();
    if (s) s.gameOver('스스로 그만두었습니다', { noResume: true });
  }

  // 지금 든 자루. 화면에 적히는 값은 **전부 강화까지 넣은 실제 값**입니다 —
  // 무기표의 맨값을 적으면 `+1`을 여섯 개 주운 사람이 제 무기를 못 알아봅니다.
  weaponPanel(cx, top, s, w) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const panelW = 400;
    const base = w.base;

    // 강화는 따로 한 줄로 뽑습니다. **갈아타면 잃는 것들**이라, 무기 값과
    // 섞어 놓으면 무엇이 자루의 몫이고 무엇이 쌓아 온 몫인지가 흐려집니다.
    const boosts = [];
    if (w.plus) {
      boosts.push('+' + Number(w.plusValue.toFixed(1))
        + (w.plusCapped ? ' (한계)' : ' / ' + w.plusMax));
    }
    if (w.speedMult > 1.001) {
      boosts.push('속도 ×' + w.speedMult.toFixed(2) + (w.speedCapped ? ' (한계)' : ''));
    }

    const rows = [
      ['공격력', w.dmgMin + ' ~ ' + w.dmgMax],
      ['정확도', Math.round(w.accuracy * 100) + '%'],
      [w.range ? '사정거리' : '사거리', String(Math.round(w.range || w.reach))],
      ['공격주기', Math.round(w.rate) + 'ms'],
      ['초당 피해', shortNum(Math.round(w.dps / DPS_DISPLAY_DIV))],
    ];
    if (w.shots > 1) rows.splice(3, 0, ['한 번에', w.shots + '곳']);
    // **한계가 남다른 자루만** 한 줄을 씁니다. 열은 어차피 다들 그러하므로
    // 적어 봐야 줄만 늘어납니다 — 서른짜리(무명)는 그것이 그 자루의 전부입니다.
    if (w.plusMax !== CFG.plusMax) {
      rows.push(['공격력 한계', '+' + w.plusMax + '   (다른 자루는 +' + CFG.plusMax + ')']);
    }
    if (boosts.length) rows.push(['강화', boosts.join('   ')]);
    if (w.relics.length) rows.push(['유물', w.relics.map((r) => r.icon + ' ' + r.name).join('  ')]);
    // 전리품은 자루에도 유물에도 안 붙는 따로 난 줄입니다 — 보스를 넘어선
    // 값이고, 이어서 진행하면 사라집니다 (js/trophies.js).
    if (s.trophies && s.trophies.count) rows.push(['전리품', s.trophies.label()]);

    const height = 116 + rows.length * 28;
    this.add.rectangle(cx, top + height / 2, panelW, height, 0x161b2e)
      .setStrokeStyle(2, 0x3f4a78);

    this.add.image(cx - panelW / 2 + 46, top + 44, weaponIconKey(s.job.key, w.index))
      .setDisplaySize(48, 48);
    this.add.text(cx - panelW / 2 + 84, top + 24, w.name, font(24, '#ffffff'));
    // 만듦새 한 줄. 이 자루가 왜 이런 수치인지를 말로 적어 줍니다.
    this.add.text(cx - panelW / 2 + 84, top + 54, w.detail || base.detail || '',
      font(14, '#8794b5'));

    rows.forEach(([label, value], i) => {
      const y = top + 96 + i * 28;
      this.add.text(cx - panelW / 2 + 24, y, label, font(16, '#6b7599'));
      this.add.text(cx + panelW / 2 - 24, y, value, font(17, '#e3e8f5')).setOrigin(1, 0);
    });

    return top + height;
  }

  resumeGame() {
    // 물어보는 창이 떠 있는 동안에는 P·ESC 로도 안 빠져나갑니다 —
    // 물음이 화면에 남은 채 판이 도는 것이 가장 나쁩니다.
    if (this.asking) return;
    this.scene.resume('game');
    this.scene.stop();
  }
}
