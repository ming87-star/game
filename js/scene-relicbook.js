// 유물 도감. 한 번이라도 가져간 것은 이름과 효과가 보이고,
// 아직 못 만난 것은 물음표로 남습니다 — 무엇이 더 있는지는 알려 주되
// 무엇인지는 직접 만나서 알게 하려는 것입니다.
//
// ── 끌어서 넘깁니다 ──────────────────────────────────────
// 유물이 아홉이던 시절에는 한 화면에 다 들어갔습니다(아홉 줄 = 786px).
// 서른으로 늘리면서 줄만 늘렸더니 마지막 줄이 y=2382 에 그려졌습니다 —
// 화면은 960 이라 **스물한 줄이 가려지거나 화면 밖**이었고, 열아홉은 아예
// 닿을 수가 없었습니다. 도감인데 3분의 2를 못 보는 셈이었습니다.
//
// 자리를 좁혀 서른을 욱여넣는 길도 있었지만, 그러면 한 줄이 24px가 되어
// 이름과 효과를 같이 못 적습니다. 줄은 그대로 두고 화면을 움직입니다.
//
// 카메라를 움직이는 쪽을 골랐습니다 (컨테이너에 마스크를 씌우는 대신).
// 이 게임은 이미 HUD 를 `setScrollFactor(0)` 으로 붙박아 두는 식으로 짜여
// 있어서(js/hud.js), 머리글과 단추에 같은 표를 달면 줄만 흘러갑니다.
// 흘러가는 줄이 머리글 밑으로 들어가 보이는 것은 깊이로 가립니다.
class RelicBookScene extends Phaser.Scene {
  constructor() {
    super('relicbook');
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    this.cameras.main.setBackgroundColor('#0d1120');
    // 바탕은 붙박이입니다 — 줄만 흘러가고 판 자체는 안 움직여야 합니다.
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e).setScrollFactor(0);

    const rowTop = 178;
    const rowGap = 76;
    RELICS.forEach((relic, i) => this.buildRow(relic, cx, rowTop + i * rowGap, font));

    // ── 붙박이 머리글 ─────────────────────────────────
    // 줄이 그 밑으로 흘러 들어가야 하므로 바탕을 깔고 깊이로 덮습니다.
    const headBottom = 152;
    this.add.rectangle(cx, headBottom / 2, 500, headBottom, 0x141a2e)
      .setScrollFactor(0).setDepth(9);
    const owned = RELICS.filter((r) => Save.data.relics[r.key]).length;
    const head = (y, text, size, color) => this.add.text(cx, y, text, font(size, color))
      .setOrigin(0.5).setScrollFactor(0).setDepth(10);
    head(56, '유물 도감', 40, '#ffffff');
    head(100, owned + ' / ' + RELICS.length + ' 수집', 20, '#ffd54f');
    head(132, '200층부터 100층마다 하나씩 · 셋 중 하나를 고릅니다', 16, '#8794b5');

    // ── 붙박이 단추 ───────────────────────────────────
    const backY = CFG.height - 52;
    const footTop = backY - 34;
    this.add.rectangle(cx, (footTop + CFG.height) / 2, 500, CFG.height - footTop, 0x141a2e)
      .setScrollFactor(0).setDepth(9);
    const btn = this.add.rectangle(cx, backY, 380, 58, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setScrollFactor(0).setDepth(10)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, backY, '돌아가기', font(26, '#ffffff'))
      .setOrigin(0.5).setScrollFactor(0).setDepth(10);
    this.backAt = { x: cx, y: backY };
    // 끌다가 손을 뗀 것이 단추 누름으로 새면 안 됩니다 (아래 dragged).
    btn.on('pointerup', () => { if (!this.dragged) this.scene.start('select'); });

    // ── 얼마나 흘릴 수 있나 ───────────────────────────
    // 마지막 줄의 아래끝이 단추 바탕 바로 위에 서면 끝입니다.
    const lastBottom = rowTop + (RELICS.length - 1) * rowGap + 33;
    this.maxScroll = Math.max(0, lastBottom + 16 - footTop);
    this.bindDrag();

    window.__relicbook = this;
  }

  // 끌어서 넘기기. 손가락으로 끄는 만큼 그대로 따라옵니다 — 관성은 두지
  // 않았습니다. 서른 줄짜리 짧은 목록이라 던져 놓고 기다릴 것이 없습니다.
  bindDrag() {
    const clamp = (v) => Phaser.Math.Clamp(v, 0, this.maxScroll);
    let from = 0;
    let at = 0;
    this.dragged = false;

    this.input.on('pointerdown', (p) => { from = p.y; at = this.cameras.main.scrollY; this.dragged = false; });
    this.input.on('pointermove', (p) => {
      if (!p.isDown) return;
      // 살짝 흔들린 것까지 끌기로 치면 단추가 안 눌립니다.
      if (Math.abs(p.y - from) > 6) this.dragged = true;
      this.cameras.main.scrollY = clamp(at - (p.y - from));
    });
    // 손가락이 없는 데(개발 중 브라우저)에서도 굴러가게 휠도 받습니다.
    this.input.on('wheel', (p, over, dx, dy) => {
      this.cameras.main.scrollY = clamp(this.cameras.main.scrollY + dy);
    });
  }

  buildRow(relic, cx, y, font) {
    const has = !!Save.data.relics[relic.key];

    this.add.rectangle(cx, y, 460, 66, has ? 0x231a3a : 0x161a28)
      .setStrokeStyle(2, has ? 0x7e6bc4 : 0x252c44);

    this.add.text(cx - 200, y - 14, has ? relic.icon + '  ' + relic.name : '?  ???',
      font(23, has ? '#ffd54f' : '#4a5578'));
    this.add.text(cx - 200, y + 12, has ? relic.detail : '아직 만나지 못했습니다',
      font(16, has ? '#8794b5' : '#3c456b'));

    // 직업 전용은 그 사실만은 미리 알려 줍니다. 왜 안 나오는지 몰라 헤매지 않도록.
    if (relic.jobs) {
      const names = relic.jobs.map((k) => classByKey(k).name).join('·');
      this.add.text(cx + 205, y, names, font(16, has ? '#b39ddb' : '#3c456b')).setOrigin(1, 0.5);
    }
  }
}
