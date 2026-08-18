// ── 보스를 넘고 나서 ──────────────────────────────────────
//
// 보스를 잡으면 **판이 멈추고 한 장이 펼쳐집니다.**
//
// 예전에는 흐릿하게 떴다 사라지는 알림 두 줄이었습니다. 그런데 여기는 판에서
// 가장 큰 벽을 넘은 자리이고, 손에 들어오는 것도 이 판에 하나뿐인 물건입니다.
// **지나가면서 읽게 하면 안 되는 것**입니다 — 실제로 무엇을 얻었는지도,
// 그것이 무슨 일을 하는지도 모른 채 다음 발판으로 뛰게 됐습니다.
//
// 갈아타기 창(js/scene-swap.js)과 같은 규칙입니다: **결정이나 값어치가 걸린
// 자리는 판을 멈추고 한 장을 펼칩니다.** 다만 여기에는 고를 것이 없습니다 —
// 이미 얻은 것을 보여 줄 뿐이라 단추가 하나입니다.
class TrophyScene extends Phaser.Scene {
  constructor() {
    super('trophy');
  }

  init(data) {
    this.from = data.from;         // 게임 장면
    this.boss = data.boss;         // 쓰러뜨린 놈 (CFG.boss.kinds 의 한 칸)
    this.trophy = data.trophy;     // 나온 것 (js/trophies.js)
    this.got = data.got;           // 실제로 붙었는가 (한도까지 찼으면 false)
    this.healed = data.healed || 0;
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const t = this.trophy;

    // 뒤가 비쳐 보여야 "끝난 것"이 아니라 "멈춘 것"으로 읽힙니다 —
    // 다만 여기는 방금 싸움이 끝난 투기장이라 짙게 덮습니다. 보스가 쓰러진
    // 자리가 뒤에서 어른거리면 읽을 것이 두 겹이 됩니다.
    this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x1a0033, 0.93);

    // ── 누구를 넘었는가 ────────────────────────────────
    this.add.text(cx, 150, '쓰러뜨렸습니다', font(20, '#8794b5')).setOrigin(0.5);
    this.add.text(cx, 192, (this.boss && this.boss.name) || '탑의 수문장',
      font(38, '#ce93d8')).setOrigin(0.5);

    // 회복은 곁가지입니다. 전리품 위에 작게 한 줄로 붙입니다 — 크게 적으면
    // 얻은 것이 둘로 보여서 어느 쪽이 이 자리의 알맹이인지 흐려집니다.
    if (this.healed) {
      this.add.text(cx, 232, '체력 +' + this.healed, font(18, '#a5d6a7')).setOrigin(0.5);
    }

    // ── 무엇을 얻었는가 ────────────────────────────────
    const top = 272;
    const panelH = 300;
    this.add.rectangle(cx, top + panelH / 2, 470, panelH, 0x241a38)
      .setStrokeStyle(2, this.got ? 0x9575cd : 0x4a4060);

    // 그림은 화면 안에서 실제로 도는 그것입니다 (js/textures.js 에서 도형으로
    // 굽습니다). 여기서 처음 보는 그림이면 판에 돌아가서 못 알아봅니다.
    const key = 'trophy-' + t.key;
    if (this.textures.exists(key)) {
      this.add.image(cx, top + 74, key).setDisplaySize(76, 76).setAlpha(this.got ? 1 : 0.4);
    } else {
      this.add.text(cx, top + 74, t.icon, font(58, '#ffffff')).setOrigin(0.5)
        .setAlpha(this.got ? 1 : 0.4);
    }

    this.add.text(cx, top + 132, t.name,
      font(30, this.got ? '#ffcdd2' : '#6b7599')).setOrigin(0.5);
    // 하는 일. **이 한 줄이 이 화면의 이유입니다** — 이름만 보고는 눈이
    // 무엇을 하는 물건인지 알 길이 없습니다.
    this.add.text(cx, top + 170, t.detail, font(18, '#a5d6a7')).setOrigin(0.5);

    // 전설. 도감과 같은 글을 씁니다 — 같은 물건을 두 군데서 다르게 적으면
    // 어느 쪽이 맞는지 묻게 됩니다.
    this.add.text(cx, top + 206, t.lore || '', font(15, '#b39ddb'))
      .setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(420).setLineSpacing(4);

    // 한도까지 찼으면 그렇다고 적습니다. 안 적으면 "받았는데 안 붙었다"가 됩니다.
    if (!this.got) {
      this.add.text(cx, top + panelH - 18, '이미 가진 만큼 다 찼습니다', font(16, '#ff8a80'))
        .setOrigin(0.5, 1);
    }

    // ── 잊지 말아야 할 한 줄 ───────────────────────────
    // 전리품은 이어서 진행하면 사라집니다. 얻는 자리에서 한 번 말해 두지
    // 않으면, 나중에 없어진 것을 보고 버그로 읽습니다.
    this.add.text(cx, top + panelH + 34,
      '이어서 진행하면 두고 옵니다 — 보스를 넘어선 값이니까요',
      font(15, '#7e6bc4')).setOrigin(0.5);

    // ── 단추 하나 ──────────────────────────────────────
    const btnY = CFG.height - 120;
    const box = this.add.rectangle(cx, btnY, 380, 68, 0x4e3f8a)
      .setStrokeStyle(2, 0x9575cd).setInteractive({ useHandCursor: true });
    this.add.text(cx, btnY, '계속 오르기', font(28, '#ffffff')).setOrigin(0.5);
    this.closeAt = { x: cx, y: btnY };
    box.on('pointerdown', () => this.close());
    this.input.keyboard.on('keydown-SPACE', () => this.close());

    window.__trophy = this; // 자동 시험이 누를 자리를 찾는 통로
  }

  close() {
    // 창을 닫고 나서 판을 돌립니다. 먼저 돌리면 그 한 프레임에 이 창이
    // 아직 떠 있어서, 판이 도는 것이 창 뒤로 비쳐 보입니다 (갈아타기와 같은 순서).
    const back = this.from;
    this.scene.stop();
    this.scene.resume('game');
    back.closeTrophy();
  }
}
