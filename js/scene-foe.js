// ── 처음 만나는 놈을 알려 주는 창 ─────────────────────────
//
// 판을 바꾸는 넷(미는 놈 · 내리찍는 놈 · 가르는 놈 · 전류를 뿜는 놈)을 **처음
// 만나는 순간 판이 멈추고 한 장이 펼쳐집니다.**
//
// 앞의 열넷은 한가운데에 이름 한 줄이 떴다 사라지는 것으로 충분했습니다.
// 「빨간 덩어리가 하나 늘었다」가 아니라는 것만 알리면 됐으니까요.
//
// 이 넷은 다릅니다. **무엇을 하는지 모르면 한 번은 반드시 당합니다** —
// 밀려서 층을 잃거나, 세 층이 막힌 줄로 올라가거나, 안전한 자리인 줄 알고
// 그 옆에 서 있거나. 그건 어려운 것이 아니라 **안 알려 준 것**입니다.
// 어려움은 알고도 못 하는 것이어야 합니다.
//
// 전리품 창(js/scene-trophy.js)과 같은 규칙입니다 — 알고 나면 판단이 되는
// 것은 판을 멈추고 한 장으로 보여 줍니다. 고를 것이 없으니 단추도 하나입니다.
class FoeScene extends Phaser.Scene {
  constructor() {
    super('foe');
  }

  init(data) {
    this.from = data.from;      // 게임 장면
    this.def = data.def;        // 그 놈 (CFG.enemyTypes 의 한 칸)
    this.tell = data.tell;      // 무엇을 알려 줄까 (CFG.foes.tell)
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const t = this.tell;

    // 뒤가 비쳐 보여야 「끝난 것」이 아니라 「멈춘 것」으로 읽힙니다.
    this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x1a0d14, 0.93);

    this.add.text(cx, 150, '처음 보는 것', font(20, '#8794b5')).setOrigin(0.5);
    this.add.text(cx, 192, t.name, font(38, '#ff8a80')).setOrigin(0.5);

    // ── 그림 ──────────────────────────────────────────
    // **판에서 실제로 도는 그 그림**입니다. 여기서 처음 보는 모양이면
    // 판에 돌아가서 못 알아봅니다.
    const key = 'e-' + this.def.key;
    const top = 244;
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(96 / src.width, 96 / src.height);
      this.add.image(cx, top + 48, key).setDisplaySize(src.width * k, src.height * k);
    }

    // ── 무엇을 하는가 ─────────────────────────────────
    // 한 줄입니다. 이 한 줄이 이 화면의 이유입니다.
    const what = this.add.text(cx, top + 112, t.what.replace(/\*\*/g, ''), font(22, '#ffffff'))
      .setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(430).setLineSpacing(6);

    // ── 재어 본 값 ────────────────────────────────────
    const facts = this.facts();
    const factY = what.y + what.height + 26;
    const boxW = 132;
    const span = boxW * facts.length + 10 * (facts.length - 1);
    facts.forEach((f, i) => {
      const x = cx - span / 2 + boxW / 2 + i * (boxW + 10);
      this.add.rectangle(x, factY + 34, boxW, 68, 0x24141c).setStrokeStyle(2, 0x6d4550);
      this.add.text(x, factY + 22, f.big, font(26, '#ffd54f')).setOrigin(0.5);
      this.add.text(x, factY + 50, f.small, font(13, '#a3adc9')).setOrigin(0.5);
    });

    // ── 무엇을 조심하는가 ─────────────────────────────
    // 「어렵다」가 아니라 **「이렇게 하면 된다」**를 적습니다. 알고도 못 하는
    // 것이 어려움이고, 모르고 당하는 것은 그냥 안 알려 준 것입니다.
    const panelTop = factY + 96;
    const body = this.add.text(cx, panelTop + 22, t.care.replace(/\*\*/g, ''),
      font(18, '#a5d6a7')).setOrigin(0.5, 0).setAlign('center')
      .setWordWrapWidth(420).setLineSpacing(8);
    this.add.rectangle(cx, panelTop + body.height / 2 + 22, 470, body.height + 44, 0x24141c)
      .setStrokeStyle(2, 0x6d4550).setDepth(-1);

    // ── 단추 하나 — 다만 **잠시 뒤에** ────────────────
    // 이 자리가 판에서는 점프 단추입니다. 오르던 손가락이 이미 얹혀 있어서,
    // 창이 뜨는 순간 눌러 버리고 아무것도 못 읽습니다. 자리를 옮겨 봐야
    // 단추가 하나뿐이라 옮긴 자리가 다음번 오조작의 자리가 됩니다.
    // 그래서 **시간으로 막습니다** (CFG.foes.tellDelayMs).
    //
    // 처음부터 자리를 차지하고 서 있되 꺼져 있습니다 — 나중에 툭 나타나면
    // 그 아래 글이 밀려서, 읽던 줄을 놓칩니다.
    const wait = (CFG.foes && CFG.foes.tellDelayMs) || 0;
    const btnY = CFG.height - 130;
    this.ready = !wait;
    const box = this.add.rectangle(cx, btnY, 380, 68, this.ready ? 0x4e3f8a : 0x2b2540)
      .setStrokeStyle(2, this.ready ? 0x9575cd : 0x4a4270);
    const label = this.add.text(cx, btnY, '알겠습니다', font(28, '#ffffff'))
      .setOrigin(0.5).setAlpha(this.ready ? 1 : 0.3);
    this.closeAt = { x: cx, y: btnY };

    if (this.ready) {
      box.setInteractive({ useHandCursor: true });
    } else {
      // 얼마나 남았는지 **보여야** 합니다. 안 보이면 안 눌리는 단추는
      // 기다리라는 뜻이 아니라 고장으로 읽힙니다.
      const barW = 380;
      const bar = this.add.rectangle(cx - barW / 2, btnY + 42, 0, 4, 0x9575cd, 0.8)
        .setOrigin(0, 0.5);
      this.tweens.add({
        targets: bar, width: barW, duration: wait, ease: 'Linear',
        onComplete: () => {
          bar.destroy();
          this.ready = true;
          box.setFillStyle(0x4e3f8a).setStrokeStyle(2, 0x9575cd)
            .setInteractive({ useHandCursor: true });
          label.setAlpha(1);
        },
      });
    }

    box.on('pointerdown', () => this.close());
    this.input.keyboard.on('keydown-SPACE', () => this.close());

    window.__foe = this; // 자동 시험이 누를 자리를 찾는 통로
  }

  // 재어 본 값 셋. **글로 적힌 성격 옆에 숫자가 있어야** 「무섭다」가 느낌이
  // 아니라 셈이 됩니다 — 몇 번 때려야 하는지, 한 대에 얼마나 잃는지.
  //
  // 숫자는 여기서 **그때그때 셉니다.** CFG 에 글로 박아 두면 값을 고친 날
  // 창이 옛날 숫자를 계속 말하게 되는데, 그건 안 알려 준 것보다 나쁩니다.
  facts() {
    const f = CFG.foes || {};
    const back = this.from;
    const out = [];

    const hits = (f.hits && f.hits[this.def.key]) || 4;
    const wild = back && f.fierce && back.floorIndex >= f.fierce.from;
    out.push({ big: (hits + (wild ? f.fierce.hits : 0)) + '번', small: '때려야 사라짐' });

    const pct = ((f.dmgPct && f.dmgPct[this.def.key]) || 0.1) * (wild ? f.fierce.dmg : 1);
    out.push({ big: Math.round(pct * 100) + '%', small: '한 대에 잃는 체력' });

    // 회피는 **가진 사람에게만** 적습니다. 0인 사람에게 「절반만 듣는다」는
    // 것은 알려 줄 것이 아니라 없는 것을 걱정시키는 말입니다.
    if (back && back.dodge > 0 && f.dodgeScale) {
      out.push({ big: '½', small: '회피가 듣는 몫' });
    }
    return out;
  }

  close() {
    // 늦게 뜨는 단추 (CFG.foes.tellDelayMs). 뜨기 전에는 눌러도 안 닫힙니다 —
    // 이 한 줄이 없으면 스페이스나 자동 시험이 문을 앞질러 열어 버립니다.
    if (!this.ready) return;
    // 창을 닫고 나서 판을 돌립니다. 먼저 돌리면 그 한 프레임에 이 창이 아직
    // 떠 있어서, 판이 도는 것이 창 뒤로 비쳐 보입니다 (전리품 창과 같은 순서).
    const back = this.from;
    this.scene.stop();
    this.scene.resume('game');
    if (back && back.closeFoe) back.closeFoe();
  }
}
