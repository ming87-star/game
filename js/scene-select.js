// 시작 화면 — 직업을 고릅니다.
//
// ── 왜 카드에서 격자가 됐는가 ───────────────────────────
// 직업이 셋에서 여덟으로 늘어납니다. 카드는 한 장이 212px 이라 셋이면
// 684px 로 들어가는데, **여덟이면 1824px** 입니다. 스크롤이 강제됩니다.
//
// 그런데 이 화면은 **죽을 때마다 지나는 자리**입니다. 여기에 스크롤이 붙으면
// 한 판 시작할 때마다 끌어내리는 손짓이 하나 더 붙습니다. 격자로 바꾸면
// 여덟이 한눈에 들어오고 스크롤이 아예 필요 없습니다.
//
// 대신 카드에 있던 글이 갈 데가 없어집니다. **누르면 아래에 펼칩니다.**
//
// ── 두 번 누르게 되지 않았나 ────────────────────────────
// 됐습니다 — 다만 **마지막에 고른 직업이 이미 골라진 채로** 들어옵니다
// (Save.data.lastJob). 늘 같은 직업으로 오르는 사람은 여전히 한 번만
// 누르면 됩니다. 바꿀 사람만 두 번 누릅니다.
//
// ── 잠긴 직업 ───────────────────────────────────────────
// **새까만 실루엣**입니다. 이름은 `???` 이고 안쪽은 하나도 안 보입니다 —
// 무엇이 기다리는지 아예 모르게 하는 것이 이 화면의 목적입니다.
// 규격과 그리는 쪽 이야기는 ART.md 2.5절에 있습니다.

// ── 격자 ────────────────────────────────────────────────
// 패널이 500 이고 양옆 16 을 비웁니다. 남은 468 에 네 칸과 그 사이 셋:
//   (468 − 10×3) ÷ 4 = 109.5 → 109
const PANEL_W = 500;
const COLS = 4;
const CELL_W = 109;
const CELL_GAP = 10;
const CELL_H = 131;          // 초상화 칸. 이름 줄은 이 아래에 따로 섭니다
const NAME_H = 22;
const ROW_GAP = 12;

// 초상화가 실제로 그려지는 크기. 칸 안쪽으로 6 씩 물립니다.
// **이 두 수가 ART.md 2.5절과 sil-check.js 에 그대로 적혀 있습니다** —
// 여기를 고치면 그쪽도 같이 고쳐야 합니다.
const ART_W = CELL_W - 12;   // 97
const ART_H = CELL_H - 8;    // 123

// ── 잠긴 직업의 실루엣 ──────────────────────────────────
// 새까만 덩어리는 칸 바탕(0x141826)과 너무 가까워서 **모양이 아니라 얼룩**으로
// 보입니다. 검정에서 남는 정보는 윤곽 하나뿐인데 그 윤곽이 안 보이면 아무것도
// 안 남습니다. 외곽선이 그 하나를 살려 냅니다 — 재 보니 외곽선 없이는 전사와
// 도적이 서로 구분되지 않았고, 1px 을 두르자 셋 다 갈렸습니다.
//
// **1px 입니다.** 2px 로 두껍게 하면 얇게 삐져나온 것들이 뭉개지는데, 이
// 화면에서 직업을 갈라 주는 것이 바로 그 얇게 삐져나온 것들입니다 (궁수의 활).
//
// 색은 열린 칸 테두리(0x3f4a78)보다 한 단 밝게. 같은 색이면 잠긴 칸이
// 열린 칸처럼 보입니다.
const OUTLINE = 1;
const OUTLINE_COLOR = '#5a6795';

// 알파가 이만큼 넘으면 「몸」입니다. 그림 가장자리는 흐리게 번져 있는데,
// 문턱을 너무 낮게 잡으면 그 번진 자락까지 몸이 되어 실루엣이 부풀고,
// 너무 높게 잡으면 활시위처럼 얇은 것이 끊깁니다.
const SOLID = 60;

class SelectScene extends Phaser.Scene {
  constructor() {
    super('select');
  }

  // 카드에 설 초상화만 받습니다 (bake-sprites.js 의 PORTRAITS).
  // loadArt 를 통째로 부르면 마흔아홉 장을 다 푸는데, 이 화면에 필요한 것은
  // 직업 수만큼뿐입니다. 텍스처는 장면을 넘어 남으므로 판이 시작될 때 또
  // 받지 않습니다.
  preload() {
    if (typeof SPRITE_ART === 'undefined' || !SPRITE_ART) return;
    CLASSES.forEach((job) => {
      const key = 'face-' + job.key;
      if (SPRITE_ART[key] && !this.textures.exists(key)) this.load.image(key, SPRITE_ART[key].uri);
    });
  }

  create() {
    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, PANEL_W, CFG.height, 0x141a2e);

    // 제목이 문장이라 로고로 세웁니다 (js/logo.js). 여기서는 탑 표시를 빼고
    // (mark: false) 글꼴로 짓습니다 (art: false) — 타이틀 화면에서 이미 크게
    // 봤으므로 여기서는 **머리글**입니다.
    const logo = drawLogo(this, cx, 24, { scale: 0.75, mark: false, art: false });

    const best = Save.bestFloor;
    this.add.text(cx, logo.bottom + 16, best
      ? '최고 기록  ' + best + '층   ·   ' + Save.deaths + '번 도전'
      : '직업을 고르세요', this.font(20, '#8794b5')).setOrigin(0.5, 0);
    this.add.text(cx, logo.bottom + 44, '가진 메달  🏅 ' + Save.medals,
      this.font(19, '#ffca28')).setOrigin(0.5, 0);

    // 격자 자리는 **머리글이 끝난 곳에서** 잽니다. 못박아 두면 제목이 글꼴에서
    // 그림으로 바뀌는 것만으로 격자가 글 밑에 깔립니다 (실제로 그랬습니다).
    this.gridTop = logo.bottom + 78;
    this.cells = {};
    CLASSES.forEach((job, i) => this.buildCell(job, i));

    // ── 세부 패널 ─────────────────────────────────────────
    // **띠 안에서 가운데로 세웁니다.** 격자 바로 밑에 붙여 놓으면 직업이
    // 셋일 때 아래가 300px 넘게 비고, 여덟이 되면 그 여백이 사라집니다 —
    // 같은 코드가 두 시절에 다 멀쩡해야 합니다.
    const rows = Math.ceil(CLASSES.length / COLS);
    this.bandTop = this.gridTop + rows * (CELL_H + NAME_H + ROW_GAP) + 6;
    this.bandBottom = CFG.height - 78;
    this.detail = this.add.container(0, 0);

    // 아래 두 자리 — 유물 도감과 이야기. 둘 다 판을 **시작하지 않는** 곳이라
    // 나란히 두고, 판을 시작하는 자리와는 떨어뜨려 놓습니다.
    const bookY = CFG.height - 44;
    const owned = RELICS.filter((r) => Save.data.relics[r.key]).length;
    const book = this.add.rectangle(cx - 98, bookY, 184, 52, 0x1b2138)
      .setStrokeStyle(2, 0x5c4a8a).setInteractive({ useHandCursor: true });
    this.add.text(cx - 98, bookY, '유물 ' + owned + ' / ' + RELICS.length,
      this.font(21, '#ffd54f')).setOrigin(0.5);
    this.bookAt = { x: cx - 98, y: bookY };
    book.on('pointerdown', () => this.scene.start('relicbook'));

    // 오프닝은 처음 켠 사람에게만 저절로 나옵니다. 다시 보고 싶은 사람을 위한
    // 자리를 여기 둡니다 — 없으면 한 번 지나친 이야기는 영영 못 봅니다.
    this.storyAt = { x: cx + 98, y: bookY };
    const story = this.add.rectangle(this.storyAt.x, this.storyAt.y, 184, 52, 0x1b2138)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true });
    this.add.text(this.storyAt.x, this.storyAt.y, '이야기 다시 보기',
      this.font(18, '#8794b5')).setOrigin(0.5);
    story.on('pointerdown', () => this.scene.start('story', { replay: true }));

    // ── 무엇이 골라진 채로 들어오는가 ─────────────────────
    // 마지막에 오른 직업입니다. 늘 같은 직업으로 오르는 사람은 이 화면에서
    // **한 번만** 누르면 됩니다 (「시작하기」). 잠겼거나 기록이 없으면 전사로.
    const last = CLASSES.find((j) => j.key === Save.data.lastJob && classUnlocked(j));
    this.pick((last || CLASSES[0]).key);

    // 시험과 갈무리 도구가 자리를 짐작하지 않게 합니다. 예전에는 도구마다
    // `270, 278 + 줄×200` 을 손으로 적어 두었는데, 이 화면을 고치는 순간
    // 조용히 엉뚱한 데를 눌렀습니다.
    window.__select = this;
  }

  font(size, color) {
    return { fontFamily: 'sans-serif', fontSize: size + 'px', color };
  }

  // 이 직업의 초상화 열쇠. 진짜 그림이 없으면 도형으로 지은 몸으로 물러섭니다
  // (js/textures.js). 새 직업은 한동안 이쪽으로 섭니다.
  faceKey(job) {
    const face = 'face-' + job.key;
    if (this.textures.exists(face)) return face;
    const body = 'player-' + job.key;
    return this.textures.exists(body) ? body : null;
  }

  // ── 잠긴 직업의 실루엣을 한 장으로 굽습니다 ────────────
  //
  // **Phaser 4 에서 `setTintFill` 은 아무 일도 안 합니다.** 함수는 있는데
  // `tint` 가 안 바뀌고 오류도 안 납니다 — 그대로 두면 잠긴 직업이 **색깔
  // 그대로** 나옵니다. 화면에는 아무 이상이 없어 보입니다. 그래서 엔진에
  // 기대지 않고 **픽셀을 직접 칠해** 텍스처 한 장으로 굽습니다.
  //
  // **그려질 크기 그대로 굽습니다.** 그래야 외곽선 1px 이 화면에서도 정확히
  // 1px 입니다 — 원본(152×192)에 두르고 나서 97 로 줄이면 0.64px 이 되어
  // 흐려집니다.
  silhouetteOf(job, w, h) {
    const key = 'sil-' + job.key;
    if (this.textures.exists(key)) return key;
    const from = this.faceKey(job);
    if (!from) return null;

    const W = Math.ceil(w) + OUTLINE * 2;
    const H = Math.ceil(h) + OUTLINE * 2;
    const cv = this.textures.createCanvas(key, W, H);
    if (!cv) return null;
    const ctx = cv.getContext();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.textures.get(from).getSourceImage(), OUTLINE, OUTLINE, w, h);

    const img = ctx.getImageData(0, 0, W, H);
    const px = img.data;
    const body = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) if (px[p * 4 + 3] > SOLID) body[p] = 1;

    // 몸이면 새까맣게, 몸에 닿아 있으면 외곽선, 나머지는 지웁니다.
    const line = Phaser.Display.Color.HexStringToColor(OUTLINE_COLOR);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        const i = p * 4;
        if (body[p]) { px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255; continue; }
        let near = false;
        for (let dy = -OUTLINE; dy <= OUTLINE && !near; dy++) {
          for (let dx = -OUTLINE; dx <= OUTLINE && !near; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && body[ny * W + nx]) near = true;
          }
        }
        if (near) {
          px[i] = line.red; px[i + 1] = line.green; px[i + 2] = line.blue; px[i + 3] = 255;
        } else {
          px[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    cv.refresh();
    return key;
  }

  // 격자에서 i 번째 칸의 한가운데.
  cellAt(i) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const left = CFG.width / 2 - PANEL_W / 2 + 16;
    return {
      x: left + col * (CELL_W + CELL_GAP) + CELL_W / 2,
      y: this.gridTop + row * (CELL_H + NAME_H + ROW_GAP) + CELL_H / 2,
    };
  }

  // 직업 열쇠로 그 칸의 자리를 돌려 줍니다 (시험·갈무리 도구가 씁니다).
  jobAt(key) {
    const i = CLASSES.findIndex((j) => j.key === key);
    return i < 0 ? null : this.cellAt(i);
  }

  // 고르고 곧장 넘어갑니다. **누르는 길 자체를 재는 시험이 아니라면** 이쪽이
  // 낫습니다 — 좌표를 안 거치므로 화면을 어떻게 고쳐도 안 깨집니다.
  // 누르는 길을 재야 하는 시험은 jobAt · startAt 으로 진짜로 누릅니다.
  go(key) {
    const job = classByKey(key);
    if (!job || !classUnlocked(job)) return false;
    this.scene.start('medal', { jobKey: key });
    return true;
  }

  // ── 격자 한 칸 ─────────────────────────────────────────
  //
  //   ┌─────────┐
  //   │   ▓▓▓   │   ← 초상화 97×123 (잠기면 새까만 실루엣 + 외곽선)
  //   │   ▓▓▓   │
  //   └─────────┘
  //      전사        ← 이름. 잠기면 ???
  //
  buildCell(job, i) {
    const open = classUnlocked(job);
    const at = this.cellAt(i);
    const tint = '#' + job.color.toString(16).padStart(6, '0');

    const box = this.add.rectangle(at.x, at.y, CELL_W, CELL_H, open ? 0x1b2138 : 0x141826)
      .setStrokeStyle(2, open ? 0x3f4a78 : 0x252c44)
      .setInteractive({ useHandCursor: true });

    const key = this.faceKey(job);
    if (key) {
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(ART_W / src.width, ART_H / src.height);
      const w = src.width * k;
      const h = src.height * k;
      // 발이 칸 바닥에 닿게 앉힙니다. 가운데 정렬하면 키가 다른 직업끼리
      // 발 높이가 들쭉날쭉해서, 여덟을 훑을 때 줄이 안 맞아 보입니다.
      const y = at.y + CELL_H / 2 - 4 - h / 2;
      if (open) {
        this.add.image(at.x, y, key).setDisplaySize(w, h);
      } else {
        const sil = this.silhouetteOf(job, w, h);
        // 외곽선만큼 캔버스가 커졌으므로 그만큼 크게 그립니다 — 안쪽 몸은
        // 열린 칸과 정확히 같은 크기로 남습니다.
        if (sil) this.add.image(at.x, y, sil).setDisplaySize(w + OUTLINE * 2, h + OUTLINE * 2);
      }
    }

    // 이름 줄. 잠기면 ??? 입니다 — 이름 자체가 알려 주는 것이 많습니다.
    const label = this.add.text(at.x, at.y + CELL_H / 2 + 4, open ? job.name : '???',
      this.font(open ? 19 : 20, open ? tint : '#4a5578')).setOrigin(0.5, 0);

    this.cells[job.key] = { box, label, open, at };
    box.on('pointerdown', () => this.pick(job.key));
  }

  // ── 고른 칸을 표시하고 아래에 펼칩니다 ─────────────────
  pick(key) {
    this.picked = key;
    Object.keys(this.cells).forEach((k) => {
      const c = this.cells[k];
      const on = k === key;
      const job = classByKey(k);
      // **잠긴 칸은 그 직업의 색으로 표시하지 않습니다.** 도적은 보라, 궁수는
      // 초록인데, 고른 표시에 그 색을 쓰면 실루엣으로 애써 가려 놓고 **테두리가
      // 누구인지 알려 줍니다.** 잠긴 칸은 실루엣 외곽선과 같은 계열로 밝힙니다.
      const mark = c.open ? job.color : 0x8794b5;
      c.box.setStrokeStyle(on ? 3 : 2,
        on ? mark : (c.open ? 0x3f4a78 : 0x252c44));
    });
    this.buildDetail(classByKey(key));
  }

  // ── 세부 패널 ──────────────────────────────────────────
  // 격자 아래에 펼칩니다. 카드에 있던 글이 전부 여기로 옵니다 — 대신 폭이
  // 302 에서 468 로 넓어져서, 예전에 카드 밖으로 새던 줄들이 편해집니다.
  buildDetail(job) {
    this.detail.removeAll(true);
    const cx = CFG.width / 2;
    const open = classUnlocked(job);
    const tint = '#' + job.color.toString(16).padStart(6, '0');
    const left = cx - PANEL_W / 2 + 20;
    const room = PANEL_W - 40;
    // 그릇 안에서는 0 부터 쌓고, 다 쌓은 뒤에 그릇째 가운데로 옮깁니다.
    let top = 0;

    const line = (text, size, color, gap) => {
      const t = this.add.text(left, top, text, this.font(size, color))
        .setWordWrapWidth(room).setLineSpacing(4);
      this.detail.add(t);
      top = t.y + t.height + (gap === undefined ? 6 : gap);
      return t;
    };

    if (!open) {
      // 잠긴 직업 — 이름 대신 `???`, 소개 대신 **소문 한 줄**입니다.
      // **누구인지는 감추되 무엇을 하는지는 알려 줍니다.** 그래야 쫓아갈
      // 이유가 생깁니다 (js/classes.js 의 rumor).
      line('???', 30, '#4a5578', 4);
      line(job.rumor || '아직 만나지 못한 사람이 있습니다.', 19, '#8794b5', 12);

      // **조건은 가립니다 아니라 그대로 보여 줍니다.** 누구인지는 궁금해야
      // 하지만 **어떻게 여는지**까지 가리면 궁금한 것이 아니라 막힌 것입니다.
      line('한 판에서  ' + job.unlockFloor + '층 · 코인 ' + job.unlockCoins, 20, '#b0bec5', 4);
      line('지금까지  ' + Save.bestFloor + '층 · 코인 ' + Save.data.bestCoins, 17, '#4a5578');
      this.center(top);
      this.startAt = null;      // 잠긴 직업에는 시작 단추가 없습니다
      return;
    }

    line(job.name, 30, tint, 2);
    line(job.blurb, 19, '#b0bec5', 8);
    line(job.detail, 17, '#8794b5', 10);

    // 그 직업에게만 나오는 유물과, 무기 도감을 몇 자루나 채웠는지.
    // 고르기 전에 "저쪽은 아직 넷뿐이네"가 보여야 그것도 고르는 이유가 됩니다.
    const mine = RELICS.find((r) => r.jobs && r.jobs.includes(job.key) && r.jobs.length === 1);
    const pool = buildWeaponPool(job);
    const found = pool.filter((w) => Save.hasWeapon(job.key, w.index)).length;
    const foot = this.add.text(left, top, '무기 ' + found + ' / ' + pool.length,
      this.font(17, '#8794b5'));
    this.detail.add(foot);
    if (mine) {
      const r = this.add.text(cx + PANEL_W / 2 - 20, top, '전용 유물  ' + mine.name,
        this.font(17, '#ffd54f')).setOrigin(1, 0);
      this.detail.add(r);
    }
    top = foot.y + foot.height + 14;

    // ── 시작하기 ──────────────────────────────────────────
    // 직업을 고르면 곧장 탑이 아니라 메달 상점을 거칩니다.
    // 쌓아 둔 메달로 이번 판의 시작 상태를 손보는 자리입니다.
    const btnY = top + 27;
    const btn = this.add.rectangle(cx, btnY, 300, 54, 0x1b2138)
      .setStrokeStyle(2, job.color).setInteractive({ useHandCursor: true });
    const btnText = this.add.text(cx, btnY, '시작하기', this.font(23, tint)).setOrigin(0.5);
    this.detail.add(btn);
    this.detail.add(btnText);
    btn.on('pointerdown', () => this.scene.start('medal', { jobKey: job.key }));

    this.center(btnY + 27);
    // 시험과 갈무리 도구가 누를 자리입니다. **그릇을 옮긴 뒤에** 재야 합니다.
    this.startAt = { x: cx, y: this.detail.y + btnY };
  }

  // 다 쌓인 그릇을 격자와 아래 단추 사이 띠의 한가운데로 옮깁니다.
  center(height) {
    const band = this.bandBottom - this.bandTop;
    this.detail.y = this.bandTop + Math.max(0, (band - height) / 2);
  }
}
