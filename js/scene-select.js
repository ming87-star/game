// 시작 화면 — 직업을 고릅니다.
// 셋은 강약이 아니라 "코인을 버는 방법"이 다릅니다. 그 차이가 읽히도록 적어 둡니다.
// 카드 한 장의 크기와 사이. 세 군데(자리 잡기 · 카드 짓기 · 시험)가 같은
// 값을 봐야 해서 밖에 냅니다 — 예전에는 200 과 176 이 따로 적혀 있었습니다.
// 높이는 **소개가 가장 긴 직업**이 정합니다. 궁수와 도적의 소개는 네 줄이
// 되는데, 176 이던 시절에는 그 네 줄이 맨 아랫줄(전용 유물)을 밟고 지나갔습니다.
const CARD_W = 460;
const CARD_H = 212;
const CARD_GAP = 16;

class SelectScene extends Phaser.Scene {
  constructor() {
    super('select');
  }

  // 카드에 설 초상화 셋만 받습니다 (bake-sprites.js 의 PORTRAITS).
  // loadArt 를 통째로 부르면 마흔아홉 장을 다 푸는데, 이 화면에 필요한 것은
  // 셋뿐입니다. 텍스처는 장면을 넘어 남으므로 판이 시작될 때 또 받지 않습니다.
  preload() {
    if (typeof SPRITE_ART === 'undefined' || !SPRITE_ART) return;
    CLASSES.forEach((job) => {
      const key = 'face-' + job.key;
      if (SPRITE_ART[key] && !this.textures.exists(key)) this.load.image(key, SPRITE_ART[key].uri);
    });
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    // 제목이 문장이라 로고로 세웁니다 (js/logo.js). 밋밋한 한 줄로 두면
    // 스물두 자가 화면 너비에 안 들어가고, 억지로 줄이면 아무 데서도 안 읽힙니다.
    // 여기서는 **탑 표시를 뺍니다** (mark: false). 카드 셋이 화면을 거의 다
    // 쓰는 자리라, 표시가 52px 을 먹으면 「직업을 고르세요」가 첫 카드 밑으로
    // 밀려 들어갑니다. 표시는 자리가 넉넉한 오프닝 제목 컷에서 봅니다.
    // 여기서 제목은 **머리글**입니다 — 타이틀 화면에서 이미 크게 봤습니다.
    // 그래서 손으로 쓴 그림이 아니라 글꼴로 짓습니다 (art: false). 그림을
    // 이만한 크기로 줄이면 획의 결이 죽고, 흐린 윗줄이 바탕에 묻힙니다.
    const logo = drawLogo(this, cx, 24, { scale: 0.75, mark: false, art: false });

    const best = Save.bestFloor;
    this.add.text(cx, logo.bottom + 18, best
      ? '최고 기록  ' + best + '층   ·   ' + Save.deaths + '번 도전'
      : '직업을 고르세요', font(20, '#8794b5')).setOrigin(0.5, 0);
    this.add.text(cx, logo.bottom + 46, '가진 메달  🏅 ' + Save.medals,
      font(19, '#ffca28')).setOrigin(0.5, 0);

    // 카드 자리는 **머리글이 끝난 곳에서** 잽니다. 못박아 두면 제목이 글꼴에서
    // 그림으로 바뀌는 것만으로 카드 밑에 글이 깔립니다 (실제로 그랬습니다).
    const cardTop = logo.bottom + 74 + CARD_H / 2;
    CLASSES.forEach((job, i) => this.buildCard(job, cx, cardTop + i * (CARD_H + CARD_GAP), best));

    // 아래 두 자리 — 유물 도감과 이야기. 둘 다 판을 **시작하지 않는** 곳이라
    // 나란히 두고, 판을 시작하는 직업 카드와는 떨어뜨려 놓습니다.
    const bookY = CFG.height - 44;
    const owned = RELICS.filter((r) => Save.data.relics[r.key]).length;
    const book = this.add.rectangle(cx - 98, bookY, 184, 52, 0x1b2138)
      .setStrokeStyle(2, 0x5c4a8a).setInteractive({ useHandCursor: true });
    this.add.text(cx - 98, bookY, '유물 ' + owned + ' / ' + RELICS.length,
      font(21, '#ffd54f')).setOrigin(0.5);
    this.bookAt = { x: cx - 98, y: bookY };
    book.on('pointerdown', () => this.scene.start('relicbook'));

    // 오프닝은 처음 켠 사람에게만 저절로 나옵니다. 다시 보고 싶은 사람을 위한
    // 자리를 여기 둡니다 — 없으면 한 번 지나친 이야기는 영영 못 봅니다.
    this.storyAt = { x: cx + 98, y: bookY };
    const story = this.add.rectangle(this.storyAt.x, this.storyAt.y, 184, 52, 0x1b2138)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true });
    this.add.text(this.storyAt.x, this.storyAt.y, '이야기 다시 보기',
      font(18, '#8794b5')).setOrigin(0.5);
    story.on('pointerdown', () => this.scene.start('story', { replay: true }));
  }

  // ── 직업 카드 한 장 ────────────────────────────────────
  //
  //   ┌────────────────────────────────┐
  //   │ ▓▓▓  전사                       │
  //   │ ▓▓▓  두껍게 막고 크게 벤다       │
  //   │ ▓▓▓  두껍게 막으니 발판에서      │
  //   │ ▓▓▓  물러설 필요가 없습니다      │
  //   │      전용 유물 ⋯       무기 1/25 │
  //   └────────────────────────────────┘
  //     116px        글 자리 302px
  //
  // **글 폭은 코드가 지킵니다** (setWordWrapWidth). 예전에는 줄바꿈을 글에
  // 손으로 넣어 두었는데, 궁수는 72px, 도적은 115px 씩 카드 밖으로 나가
  // 있었습니다 — 글자 수를 세어 맞추는 방식은 글꼴이 바뀌거나 문구를 한 자
  // 고치는 순간 다시 샙니다. 폭을 못박고, 그 폭에서 읽히게 문구를 씁니다.
  //
  // 세로 자리도 쌓아서 잽니다. 못박아 두면 소개가 두 줄인 직업과 세 줄인
  // 직업에서 아래 줄이 서로 다른 자리에 섭니다.
  buildCard(job, cx, y, best) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const open = classUnlocked(job);
    const tint = '#' + job.color.toString(16).padStart(6, '0');
    const W = CARD_W;
    const H = CARD_H;

    const box = this.add.rectangle(cx, y, W, H, open ? 0x1b2138 : 0x141826)
      .setStrokeStyle(2, open ? 0x3f4a78 : 0x252c44);

    // ── 초상화 ──────────────────────────────────────────
    // 셋이 저마다 조금씩 다른 크기라(152·168·160 × 192) **같은 칸에 담아**
    // 안쪽에 맞춥니다. 칸을 안 정하고 높이만 맞추면 글 시작점이 직업마다
    // 어긋나서, 카드 셋을 세로로 훑을 때 글줄이 들쭉날쭉해 보입니다.
    const boxW = 116;
    const boxH = 140;
    const artX = cx - W / 2 + 14 + boxW / 2;
    const key = 'face-' + job.key;
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(boxW / src.width, boxH / src.height);
      const face = this.add.image(artX, y, key)
        .setDisplaySize(src.width * k, src.height * k);
      // 잠긴 직업은 **어둡게 깔아 실루엣으로** 둡니다. 무엇이 기다리는지는
      // 보여 주되 지금 고를 수는 없다는 것이, 이 카드의 나머지가 지키는 규칙입니다.
      if (!open) face.setTint(0x2b3350).setAlpha(0.75);
    }

    // ── 글 ──────────────────────────────────────────────
    const textX = cx - W / 2 + 14 + boxW + 16;
    const room = cx + W / 2 - 20 - textX;
    let top = y - H / 2 + 16;
    const line = (text, size, color, gap) => {
      const t = this.add.text(textX, top, text, font(size, color))
        .setWordWrapWidth(room).setLineSpacing(4);
      top = t.y + t.height + (gap === undefined ? 6 : gap);
      return t;
    };

    line(job.name, 30, open ? tint : '#4a5578', 2);
    line(job.blurb, 18, open ? '#b0bec5' : '#3c456b', 8);

    if (!open) {
      // 잠긴 직업은 소개 대신 **조건**입니다. 무엇을 해야 열리는지와,
      // 지금 어디까지 왔는지를 나란히 둡니다.
      line('한 판에서  ' + job.unlockFloor + '층 · 코인 ' + job.unlockCoins, 19, '#8794b5', 4);
      line('최고  ' + Save.bestFloor + '층 · 코인 ' + Save.data.bestCoins, 16, '#4a5578');
      return;
    }

    box.setInteractive({ useHandCursor: true });
    line(job.detail, 16, '#8794b5');

    // ── 맨 아랫줄 ───────────────────────────────────────
    // 이 둘은 소개가 몇 줄이든 **카드 바닥에 붙습니다.** 왼쪽은 그 직업에게만
    // 나오는 유물, 오른쪽은 무기 도감을 몇 자루나 채웠는지 — 고르기 전에
    // "저쪽은 아직 넷뿐이네"가 보여야 그것도 고르는 이유가 됩니다.
    const footY = y + H / 2 - 16;
    const mine = RELICS.find((r) => r.jobs && r.jobs.includes(job.key) && r.jobs.length === 1);
    if (mine) {
      this.add.text(textX, footY, '전용 유물  ' + mine.name, font(16, '#ffd54f')).setOrigin(0, 1);
    }
    const pool = buildWeaponPool(job);
    const found = pool.filter((w) => Save.hasWeapon(job.key, w.index)).length;
    this.add.text(cx + W / 2 - 20, footY, '무기 ' + found + ' / ' + pool.length,
      font(16, '#8794b5')).setOrigin(1, 1);

    box.on('pointerover', () => box.setStrokeStyle(2, job.color));
    box.on('pointerout', () => box.setStrokeStyle(2, 0x3f4a78));

    // 직업을 고르면 곧장 탑이 아니라 메달 상점을 거칩니다.
    // 쌓아 둔 메달로 이번 판의 시작 상태를 손보는 자리입니다.
    box.on('pointerdown', () => this.scene.start('medal', { jobKey: job.key }));
  }
}
