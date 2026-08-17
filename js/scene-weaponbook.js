// ── 무기 도감 ─────────────────────────────────────────────
//
// 직업의 자루 스물넷을 한 판에 펼치고, **그중 하나를 들고 오릅니다.**
// 메달 상점 다음, 탑에 오르기 바로 앞자리입니다.
//
// 이 화면이 대신하는 것이 있습니다 — 죽음 화면의 **무기 계승**입니다.
// 계승은 직전 판에서 둘째로 얻은 자루를 메달을 버리고 한 번 더 쓰는 것이었는데,
// 두 가지가 나빴습니다.
//
//   1. **고르는 것이 아니었습니다.** 무엇이 나올지는 죽은 판이 정했고,
//      사람은 그것을 받거나 말거나였습니다
//   2. **값이 엉뚱했습니다.** 메달을 통째로 버려야 했는데, 메달은 이제
//      직업을 영영 여는 화폐라 한 자루와 바꿀 물건이 아닙니다
//
// 도감은 반대입니다. 밑천이 죽은 판 하나가 아니라 **여태 만난 것 전부**이고,
// 값을 안 치릅니다. 대신 **만나야 씁니다** — 못 만난 칸은 물음표로 남고,
// 그 물음표를 지우는 것이 탑을 오르는 또 하나의 이유가 됩니다.
//
// 만났다는 것은 손에 쥔 것만이 아니라 **갈아타기 창이 떴다**는 것도 셉니다
// (js/save.js 의 findWeapon). 그 자리에서 그냥 두기로 한 것이 다음 판에
// 그 자루를 못 쓸 이유는 아닙니다.

const BOOK_LAYOUT = {
  cols: 4,
  rows: 6,
  cellW: 116,
  cellH: 74,
  gridTop: 196,
  // 고른 자루를 펼쳐 놓는 자리. 격자 아래에 붙습니다.
  // 마지막 줄의 상자가 636 에서 끝나므로 640 부터입니다.
  panelTop: 640,
  panelH: 172,
};

class WeaponBookScene extends Phaser.Scene {
  constructor() {
    super('weaponbook');
  }

  init(data) {
    this.job = classByKey((data && data.jobKey) || Save.data.lastJob || 'warrior');
    // 도감만 구경하러 왔으면 「들고 오른다」 대신 「돌아가기」가 붙습니다.
    this.browse = !!(data && data.browse);
  }

  // 무기 그림은 게임 장면 밖에서도 필요합니다. 텍스처는 한 번 구우면
  // 남으므로, 이 화면에서 먼저 열어도 그대로 쓰입니다.
  preload() {
    loadArt(this);
  }

  create() {
    buildTextures(this);

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const L = BOOK_LAYOUT;

    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    this.pool = buildWeaponPool(this.job);
    this.found = Save.foundWeapons(this.job.key);
    const owned = this.pool.filter((w) => this.found[w.index]).length;

    const tint = '#' + this.job.color.toString(16).padStart(6, '0');
    this.add.text(cx, 52, '무기 도감', font(38, '#ffffff')).setOrigin(0.5);
    this.add.text(cx, 96, this.job.name + '   ' + owned + ' / ' + this.pool.length + ' 발견',
      font(21, tint)).setOrigin(0.5);
    this.add.text(cx, 130,
      this.browse ? '한 번이라도 만난 자루가 여기 남습니다'
        : '만난 자루 중 하나를 들고 오릅니다', font(17, '#8794b5')).setOrigin(0.5);
    // 깊은 자루가 뒤쪽입니다. 순서가 곧 "언제쯤 만나는가"라는 것을 적어 둡니다.
    this.add.text(cx, 160, '왼쪽 위에서 오른쪽 아래로 갈수록 깊은 층의 자루입니다',
      font(15, '#5c6890')).setOrigin(0.5);

    // ── 스물넷을 격자로 ─────────────────────────────────
    const gridW = L.cols * L.cellW;
    this.cells = this.pool.map((w, i) => this.buildCell(w,
      cx - gridW / 2 + L.cellW * (i % L.cols + 0.5),
      L.gridTop + L.cellH * Math.floor(i / L.cols) + L.cellH / 2));

    // ── 고른 자루를 펼치는 자리 ─────────────────────────
    this.panel = this.buildPanel(cx, L.panelTop, font);

    // ── 아래 두 단추 ────────────────────────────────────
    const btnY = CFG.height - 92;
    this.takeBox = this.add.rectangle(cx, btnY, 420, 64, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true });
    this.takeLabel = this.add.text(cx, btnY, '', font(28, '#ffffff')).setOrigin(0.5);
    this.takeAt = { x: cx, y: btnY };
    this.takeBox.on('pointerdown', () => this.leave());

    const backY = CFG.height - 34;
    const back = this.add.text(cx, backY,
      this.browse ? '직업 고르기로' : '메달 상점으로 돌아가기', font(19, '#8794b5'))
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.backAt = { x: cx, y: backY };
    back.on('pointerdown', () => this.scene.start(this.browse ? 'select' : 'medal',
      { jobKey: this.job.key }));

    // 처음에는 **가장 마지막에 고른 자루**가 잡혀 있습니다. 없으면 첫 자루 —
    // 첫 자루는 언제나 만난 것이라(들고 시작하니까) 빈손인 판이 없습니다.
    const last = Save.startWeapon(this.job.key);
    this.select(this.found[last] ? last : 0);

    window.__weaponbook = this; // 자동 시험이 누를 자리를 찾는 통로
  }

  // 격자 한 칸. 못 만난 것은 물음표로 남되 **자리는 그대로 차지합니다** —
  // 빈칸이 몇 개인지가 보여야 "아직 이만큼 남았다"가 읽힙니다.
  buildCell(w, x, y) {
    const has = !!this.found[w.index];
    const box = this.add.rectangle(x, y, BOOK_LAYOUT.cellW - 8, BOOK_LAYOUT.cellH - 8,
      has ? 0x1b2138 : 0x14192b).setStrokeStyle(2, has ? 0x3f4a78 : 0x242a42);
    const icon = this.add.image(x, y - 10, has ? weaponIconKey(this.job.key, w.index) : 'w-unknown')
      .setDisplaySize(34, 34).setAlpha(has ? 1 : 0.55);
    const name = this.add.text(x, y + 22, has ? w.name : '???',
      { fontFamily: 'sans-serif', fontSize: '13px', color: has ? '#c5cbe0' : '#454d70' })
      .setOrigin(0.5);
    // 이름이 칸보다 길면 (「심연의이빨」처럼) 넘치는 만큼만 줄입니다.
    const room = BOOK_LAYOUT.cellW - 18;
    if (name.width > room) name.setScale(room / name.width);

    if (has) {
      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.select(w.index));
    }
    return { index: w.index, has, box, icon, name };
  }

  // 고른 자루를 펼치는 판. 글자 그릇만 미리 만들어 두고 값은 select 가 씁니다 —
  // 고를 때마다 지웠다 다시 짓지 않으려는 것입니다.
  buildPanel(cx, top, font) {
    const L = BOOK_LAYOUT;
    const panel = this.add.rectangle(cx, top + L.panelH / 2, 470, L.panelH, 0x161b2e)
      .setStrokeStyle(2, 0x3f4a78);
    return {
      panel,
      icon: this.add.image(cx - 196, top + 28, 'w-unknown').setDisplaySize(40, 40),
      name: this.add.text(cx - 166, top + 14, '', font(25, '#ffffff')),
      depth: this.add.text(cx + 202, top + 20, '', font(16, '#8794b5')).setOrigin(1, 0),
      // 전설. 이 화면이 도감인 까닭입니다 — 수치만 적으면 그냥 목록입니다.
      // 줄 수가 자루마다 달라서(한 줄에서 세 줄까지) 아래 만듦새 줄은
      // **재 본 높이만큼 밀어 내립니다** — 못 박아 두면 긴 전설에서 겹칩니다.
      lore: this.add.text(cx, top + 54, '', font(15, '#b39ddb'))
        .setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(430).setLineSpacing(3),
      detail: this.add.text(cx, top + 54, '', font(14, '#6b7599')).setOrigin(0.5, 0),
      // 수치는 판 밑변에 붙입니다. 위가 몇 줄이 되든 자리가 안 흔들립니다.
      stat: this.add.text(cx, top + L.panelH - 12, '', font(16, '#8794b5')).setOrigin(0.5, 1),
    };
  }

  select(index) {
    const w = this.pool[index];
    if (!w || !this.found[index]) return;
    this.picked = index;

    this.cells.forEach((c) => c.box.setStrokeStyle(2,
      c.index === index ? this.job.color : (c.has ? 0x3f4a78 : 0x242a42)));

    const p = this.panel;
    p.icon.setTexture(weaponIconKey(this.job.key, index)).setDisplaySize(40, 40);
    p.name.setText(w.name);
    p.depth.setText(w.depth ? w.depth + '층부터' : '처음부터');
    // 앞은 그 자루의 내력, 뒤는 왜 이런 수치인지입니다.
    p.lore.setText(w.lore || '');
    p.detail.setText(w.detail ? '— ' + w.detail : '').setY(p.lore.y + p.lore.height + 5);
    p.stat.setText(
      w.dmgMin + '~' + w.dmgMax
      + '   정확 ' + Math.round(w.acc * 100) + '%'
      + '   ' + (w.range ? '사정거리 ' : '사거리 ') + Math.round(w.range || w.reach || 0)
      + '   주기 ' + w.rate + 'ms'
      + (w.shots > 1 ? '   ' + w.shots + '곳' : ''));

    this.takeLabel.setText(this.browse ? '이 자루로 정해 두기' : w.name + ' 들고 오르기');
  }

  leave() {
    // 고른 것은 저장에 남습니다. 다음에 이 화면에 다시 오면 그 자루가
    // 잡혀 있습니다 — 늘 같은 자루로 오르는 사람에게 매번 고르게 하면
    // 그건 고르기가 아니라 절차입니다.
    Save.setStartWeapon(this.job.key, this.picked);
    if (this.browse) return this.scene.start('select');
    this.scene.start('game', { jobKey: this.job.key, weaponIndex: this.picked });
  }
}
