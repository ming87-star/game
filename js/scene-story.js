// 오프닝 — 네 컷 만화를 한 컷씩 넘깁니다.
//
// 그림은 **한 장**입니다 (art/story.webp → js/storydata.js). 2×2로 그린 네 컷을
// 사분면으로 잘라 하나씩 보여 줍니다. 한 장에 넷을 다 펼치고 그 아래 문단을
// 붙이는 쪽이 만들기는 쉬운데, 그러면 사람은 글을 안 읽습니다 —
// **넘길 것이 있어야 읽고 넘깁니다.**
//
// 처음 켠 사람에게만 저절로 나옵니다 (Save.data.sawStory). 그 뒤로는 시작
// 화면의 「이야기 다시 보기」로만 나옵니다. 한 판 더 하려고 켰는데 매번
// 이야기부터 보게 하면 그건 이야기가 아니라 문턱입니다.
//
// 그림이 아직 없어도 돌아갑니다. 그때는 자리를 빈 네모로 그리고 몇 번째
// 컷인지만 적습니다 — 글과 넘김은 그대로라, 그림이 붙기 전에도 흐름을
// 확인할 수 있습니다.
// 구워 둔 이야기 그림 하나를 장면에 답니다 (js/storydata.js).
// 그림이 아직 없으면 아무 일도 하지 않습니다 — 부르는 쪽이 빈 자리를 그립니다.
function loadStoryArt(scene, key) {
  const uri = typeof STORY_ART !== 'undefined' && STORY_ART && STORY_ART[key];
  if (uri && !scene.textures.exists(key)) scene.load.image(key, uri);
}

class StoryScene extends Phaser.Scene {
  constructor() {
    super('story');
  }

  init(data) {
    this.replay = !!(data && data.replay);
  }

  preload() {
    // 데이터 URI라 네트워크를 타지 않습니다. 이미 구웠으면 다시 굽지 않습니다.
    // 낱장 넷과 2×2 한 장, 둘 다 받습니다 (bake-story.js 위쪽 참고).
    loadStoryArt(this, 'story');
    // 2×2 한 장에는 넷까지만 들어갑니다. 다섯째(후반 전투)는 **낱장**으로만
    // 옵니다 — 한 장에 다섯을 우겨넣으면 사분면 자르기가 무너집니다.
    const cuts = ((CFG.story && CFG.story.panels) || []).length;
    for (let i = 1; i <= cuts; i++) loadStoryArt(this, 'story-' + i);
    // 마지막 제목 컷의 바탕이 되는 **메인 이미지**. 아직 없어도 돌아갑니다 —
    // 그때는 어두운 바탕에 로고만 섭니다 (아래 show).
    loadStoryArt(this, 'key-art');
  }

  create() {
    // 이미 본 사람은 그대로 통과합니다. 「이야기 다시 보기」로 들어온 때만
    // (replay) 다시 보여 줍니다 — 한 판 더 하려고 켠 사람을 붙잡지 않습니다.
    if (Save.data.sawStory && !this.replay) return this.scene.start('select');

    this.panels = (CFG.story && CFG.story.panels) || [];
    this.at = 0;

    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    // ── 컷이 놓이는 자리 ────────────────────────────────
    // 한 컷은 정사각형입니다 (2×2로 자른 한 칸). 세로로 긴 화면이므로
    // 그림을 위쪽에 큼직하게 두고 글은 그 아래에 둡니다.
    this.frameX = cx;
    this.frameY = 372;
    this.frameW = 452;

    this.add.rectangle(this.frameX, this.frameY, this.frameW + 8, this.frameW + 8, 0x0d1120)
      .setStrokeStyle(2, 0x3f4a78);

    // 컷마다 낱장이 있으면 그쪽이 이깁니다 — 자를 일이 없으니 어긋날 일도
    // 없습니다. 없으면 2×2 한 장을 사분면으로 자릅니다.
    this.cutKeys = this.panels.map((_, i) => 'story-' + (i + 1))
      .map((k) => (this.textures.exists(k) ? k : null));
    this.sheet = this.textures.exists('story');
    this.hasArt = this.sheet || this.cutKeys.some(Boolean);

    if (this.hasArt) {
      if (this.sheet) {
        // crop 은 원본 픽셀 기준이라, 원본이 몇 픽셀이든 절반씩 나누면
        // 사분면이 됩니다 — 크기를 못박지 않아도 됩니다.
        const src = this.textures.get('story').getSourceImage();
        this.cutW = Math.floor(src.width / 2);
        this.cutH = Math.floor(src.height / 2);
      }
      this.art = this.add.image(this.frameX, this.frameY, this.sheet ? 'story' : 'story-1');
      // 낱장만 있는 컷과 2×2만 있는 컷이 섞여 있을 수 있으므로,
      // 빈 자리를 적을 글도 같이 준비해 둡니다.
      this.placeholder = this.add.text(this.frameX, this.frameY, '', {
        fontFamily: 'sans-serif', fontSize: '20px', color: '#3c456b',
      }).setOrigin(0.5);
    } else {
      this.add.text(this.frameX, this.frameY - 16, '네 컷 만화가 들어올 자리', {
        fontFamily: 'sans-serif', fontSize: '20px', color: '#3c456b',
      }).setOrigin(0.5);
      this.placeholder = this.add.text(this.frameX, this.frameY + 20, '', {
        fontFamily: 'sans-serif', fontSize: '44px', color: '#2a3252',
      }).setOrigin(0.5);
    }

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    this.titleText = this.add.text(cx, 664, '', font(30, '#ffffff')).setOrigin(0.5);
    this.bodyText = this.add.text(cx, 724, '', font(21, '#b0bec5'))
      .setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);

    // 몇 컷 중 몇 번째인지. 끝이 보여야 사람이 끝까지 봅니다.
    this.dots = this.panels.map((_, i) =>
      this.add.circle(cx - (this.panels.length - 1) * 11 + i * 22, 856, 5, 0xffffff, 0.18));

    // ── 넘기기와 건너뛰기 ───────────────────────────────
    // 아무 데나 눌러도 넘어갑니다. 다만 건너뛰기 단추 위는 뺍니다 —
    // 화면 전체가 넘김을 받으므로, 자리로 걸러 내지 않으면 한 번 누른 것이
    // 양쪽에 먹힙니다 (게임 화면의 일시정지 단추와 같은 자리의 문제입니다).
    const skipY = CFG.height - 46;
    this.skipAt = { x: cx, y: skipY, w: 200, h: 48 };
    this.add.rectangle(cx, skipY, this.skipAt.w, this.skipAt.h, 0x1b2138)
      .setStrokeStyle(2, 0x3f4a78);
    this.skipLabel = this.add.text(cx, skipY, '건너뛰기', font(20, '#8794b5')).setOrigin(0.5);

    this.input.on('pointerdown', (p) => {
      const s = this.skipAt;
      if (Math.abs(p.x - s.x) <= s.w / 2 && Math.abs(p.y - s.y) <= s.h / 2) return this.finish();
      this.next();
    });
    this.input.keyboard.on('keydown-SPACE', () => this.next());
    this.input.keyboard.on('keydown-RIGHT', () => this.next());
    this.input.keyboard.on('keydown-ESC', () => this.finish());

    this.show(0);
    window.__story = this;
  }

  // n번째 컷으로. 그림과 글이 같이 바뀝니다.
  show(n) {
    const p = this.panels[n];
    if (!p) return this.finish();
    this.at = n;

    // ── 제목 컷 ────────────────────────────────────────
    // 마지막은 만화가 아니라 **제목**입니다. 앞의 넷이 「또 1층」에서 끝나므로,
    // 그 자리에서 제목이 뜨면 제목이 곧 그 사람의 물음이 됩니다.
    if (p.logo) return this.showLogo(p);
    this.hideLogo();

    const cut = this.cutKeys && this.cutKeys[n];
    if (cut) {
      // 낱장 — 자르지 않고 그대로 액자에 맞춥니다.
      const src = this.textures.get(cut).getSourceImage();
      this.art.setVisible(true).setCrop().setTexture(cut).setScale(1)
        .setDisplaySize(this.frameW, this.frameW * (src.height / src.width))
        .setPosition(this.frameX, this.frameY);
      this.placeholder.setText('');
    } else if (this.sheet && n < 4) {
      // 2×2 한 장에서 잘라 쓰는 것은 앞의 넷뿐입니다. 다섯째를 여기로
      // 흘리면 없는 사분면(row 2)을 잘라서 빈 칸이 나옵니다.
      this.art.setVisible(true).setTexture('story');
      this.placeholder.setText('');
      // 왼위 → 오른위 → 왼아래 → 오른아래
      const col = n % 2;
      const row = Math.floor(n / 2);
      this.art.setCrop(col * this.cutW, row * this.cutH, this.cutW, this.cutH);

      // setCrop 은 **자른 만큼만 그리되 자리는 원본 기준**입니다. 그냥 두면
      // 오른아래 컷은 화면 오른아래로 밀려 나갑니다. 잘라 낸 칸의 한가운데가
      // 액자 한가운데에 오도록 그림 전체를 되밀어 줍니다.
      //
      //   원본(가운데 정렬)이 그려지는 왼쪽 끝 = x - 원본너비/2 × 배율
      //   거기서 잘라 낸 칸의 한가운데 = 왼쪽 끝 + (자른x + 자른너비/2) × 배율
      //   이것이 액자 한가운데와 같아야 하므로 정리하면 아래 두 줄이 됩니다.
      const scale = this.frameW / this.cutW;
      this.art.setScale(scale);
      this.art.setPosition(
        this.frameX + this.cutW * scale * (0.5 - col),
        this.frameY + this.cutH * scale * (0.5 - row));
    } else if (this.placeholder) {
      // 그림이 아직 없는 컷.
      if (this.art) this.art.setVisible(false);
      this.placeholder.setText(this.hasArt
        ? (n + 1) + '컷이 들어올 자리'
        : (n + 1) + ' / ' + this.panels.length);
    }

    this.titleText.setVisible(true).setText(p.title || '');
    this.bodyText.setText((p.lines || []).join('\n'));
    this.dots.forEach((d, i) => d.setFillStyle(0xffffff, i === n ? 0.8 : 0.18));

    // 마지막 컷에서는 「건너뛰기」가 아니라 「시작하기」입니다 —
    // 다 본 사람에게 건너뛰라고 하면 무엇을 건너뛰는지 알 수 없습니다.
    this.skipLabel.setText(n === this.panels.length - 1 ? '시작하기' : '건너뛰기');

    // 컷이 바뀌는 것이 눈에 보여야 넘어간 줄 압니다.
    [this.titleText, this.bodyText].forEach((t) => {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 220 });
    });
  }

  next() {
    if (this.at >= this.panels.length - 1) return this.finish();
    this.show(this.at + 1);
  }

  // ── 제목 컷 ────────────────────────────────────────────
  // 액자 자리에 **메인 이미지**를 깔고 그 위에 로고를 세웁니다.
  // 그림이 아직 없으면 어두운 바탕에 로고만 섭니다 — 글과 넘김은 그대로라,
  // 그림이 붙기 전에도 흐름을 확인할 수 있습니다 (이 장면의 다른 컷과 같은 규칙).
  showLogo(p) {
    if (this.art) this.art.setVisible(false);
    if (this.placeholder) this.placeholder.setText('');
    this.titleText.setVisible(false);
    this.bodyText.setText((p.lines || []).join('\n'));
    this.dots.forEach((d, i) => d.setFillStyle(0xffffff, i === this.at ? 0.8 : 0.18));
    this.skipLabel.setText('시작하기');

    if (this.logoParts) return;   // 한 번만 짓습니다
    this.logoParts = [];
    const cx = this.frameX;

    // 메인 이미지가 있으면 액자를 채우고, 위쪽을 어둡게 덮어 글자가 뜨게 합니다.
    if (this.textures.exists('key-art')) {
      const src = this.textures.get('key-art').getSourceImage();
      const img = this.add.image(cx, this.frameY, 'key-art')
        .setDisplaySize(this.frameW, this.frameW * (src.height / src.width));
      this.logoParts.push(img);
      this.logoParts.push(this.add.rectangle(cx, this.frameY, this.frameW, this.frameW, 0x0d1120, 0.45));
    }

    // 메인 이미지가 있으면 위쪽 삼분의 일에, 없으면 액자 한가운데에 세웁니다.
    // 빈 액자의 위쪽에 붙여 두면 아래가 통째로 비어 만들다 만 화면으로 보입니다.
    const hasArt = this.textures.exists('key-art');
    const probe = drawLogo(this, -9999, 0, { scale: 0.95, width: this.frameW });
    const h = probe.height;
    probe.parts.forEach((o) => o.destroy());
    const at = hasArt ? this.frameY - this.frameW * 0.34 : this.frameY - h / 2;
    const logo = drawLogo(this, cx, at, { scale: 0.95, width: this.frameW });
    this.logoParts.push(...logo.parts);
  }

  hideLogo() {
    if (!this.logoParts) return;
    this.logoParts.forEach((o) => o.destroy());
    this.logoParts = null;
  }

  finish() {
    Save.markStorySeen();
    this.scene.start('select');
  }
}
