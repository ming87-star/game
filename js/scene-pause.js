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
    const s = this.scene.get('game');
    const w = s && s.weapon;

    // 완전히 가리지 않습니다. 뒤가 비쳐 보여야 "끝난 것"이 아니라
    // "멈춘 것"으로 읽힙니다.
    this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x0d1120, 0.82);

    this.add.text(cx, 168, '일시정지', font(38, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, 210, '적도 시간도 여기서 함께 멈췄습니다', font(16, '#8794b5')).setOrigin(0.5);

    let bottom = 300;
    if (w) bottom = this.weaponPanel(cx, 262, s, w);

    const btnY = Math.min(CFG.height - 120, bottom + 70);
    const btn = this.add.rectangle(cx, btnY, 280, 66, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    this.add.text(cx, btnY, '이어서 하기', font(26, '#ffffff')).setOrigin(0.5);
    this.resumeAt = { x: cx, y: btnY }; // 자동 플레이테스트가 누를 자리

    btn.on('pointerdown', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());

    window.__pause = this;
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
    if (w.plus) boosts.push('+' + Number(w.plusValue.toFixed(1)));
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
    this.scene.resume('game');
    this.scene.stop();
  }
}
