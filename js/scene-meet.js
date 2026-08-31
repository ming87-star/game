// 탑에서 만나는 사람 — 직업이 열리는 순간의 한 컷.
//
// 해금은 **쓰러졌을 때** 일어납니다 (한 판에 500층·1000코인이면 궁수,
// 700층·2000코인이면 도적). 그래서 이 만남은 "쓰러진 자리에서 누군가가
// 내려다보고 있었다"입니다 — 그 한 장면이 두 가지를 한꺼번에 설명합니다.
//
//   왜 저 사람을 다음 판에 쓸 수 있는가  탑은 한 번에 하나만 올려보냅니다.
//                                        다음 차례는 그 사람입니다
//   왜 나는 또 바닥에서 시작하는가        그가 당신을 업고 내려왔으니까요
//
// 죽음 화면에서 **무엇을 가져갈지 고른 다음**에 나옵니다. 고르기 전에
// 끼워 넣으면 방금 끝난 판의 결과를 읽던 사람을 끊어 놓습니다.
// 「~로도」인지 「~으로도」인지. 그냥 '으로도'로 못박으면 "궁수으로도"가
// 됩니다 — 화면에 그대로 나오는 글이라 티가 납니다.
//
// 셈은 js/classes.js 의 roParticle 하나만 씁니다. 여기 따로 두었더니
// 직업 고르기 화면에서도 같은 셈이 필요해졌을 때 **같은 이름의 함수 둘**이
// 서로를 덮어썼습니다 (모듈이 없어 전역 하나를 나눠 씁니다).
function withRo(word) {
  return roParticle(word) + '도';
}

class MeetScene extends Phaser.Scene {
  constructor() {
    super('meet');
  }

  // jobs 이 열린 직업 키들, next 가 이 컷이 끝난 뒤 갈 곳입니다.
  init(data) {
    this.jobs = ((data && data.jobs) || []).filter((k) => this.textFor(k));
    this.next = (data && data.next) || { key: 'select' };
    this.at = 0;
  }

  textFor(key) {
    return CFG.story && CFG.story.meetings && CFG.story.meetings[key];
  }

  preload() {
    this.jobs.forEach((k) => loadStoryArt(this, 'meet-' + k));
  }

  create() {
    if (!this.jobs.length) return this.leave();

    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#0d1120');
    this.add.rectangle(cx, CFG.height / 2, 500, CFG.height, 0x141a2e);

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    // 오프닝과 같은 자리·같은 크기를 씁니다. 같은 종류의 화면이라는 것이
    // 배치로 읽혀야 합니다 — 여기만 다르게 생기면 딴 게임 같습니다.
    this.frameX = cx;
    this.frameY = 372;
    this.frameW = 452;
    this.add.rectangle(this.frameX, this.frameY, this.frameW + 8, this.frameW + 8, 0x0d1120)
      .setStrokeStyle(2, 0x3f4a78);

    this.art = this.add.image(this.frameX, this.frameY, '__none__').setVisible(false);
    this.blank = this.add.text(this.frameX, this.frameY, '', font(20, '#3c456b')).setOrigin(0.5);

    this.kicker = this.add.text(cx, 636, '탑에서 만난 사람', font(18, '#8794b5')).setOrigin(0.5);
    this.titleText = this.add.text(cx, 674, '', font(30, '#ffffff')).setOrigin(0.5);
    this.bodyText = this.add.text(cx, 726, '', font(20, '#b0bec5'))
      .setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);

    // 이제부터 이 사람으로도 오를 수 있다는 것 — 만남의 결과입니다.
    this.gainText = this.add.text(cx, CFG.height - 116, '', font(22, '#a5d6a7')).setOrigin(0.5);

    const btnY = CFG.height - 46;
    this.nextAt = { x: cx, y: btnY, w: 220, h: 48 };
    this.add.rectangle(cx, btnY, this.nextAt.w, this.nextAt.h, 0x1b2138)
      .setStrokeStyle(2, 0x3f4a78);
    this.nextLabel = this.add.text(cx, btnY, '', font(20, '#8794b5')).setOrigin(0.5);

    // 오프닝과 같은 조작 — 아무 데나 눌러 넘기고, 단추 자리만 걸러 냅니다.
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard.on('keydown-SPACE', () => this.advance());
    this.input.keyboard.on('keydown-ESC', () => this.leave());

    this.show(0);
    window.__meet = this;
  }

  show(n) {
    const key = this.jobs[n];
    const t = this.textFor(key);
    if (!t) return this.leave();
    this.at = n;

    const artKey = 'meet-' + key;
    if (this.textures.exists(artKey)) {
      const src = this.textures.get(artKey).getSourceImage();
      this.art.setTexture(artKey).setVisible(true)
        .setDisplaySize(this.frameW, this.frameW * (src.height / src.width))
        .setPosition(this.frameX, this.frameY);
      this.blank.setText('');
    } else {
      // 그림이 아직 없어도 흐름은 확인할 수 있어야 합니다.
      this.art.setVisible(false);
      this.blank.setText('「' + t.title + '」 컷이 들어올 자리');
    }

    const job = classByKey(key);
    this.titleText.setText(t.title);
    this.bodyText.setText((t.lines || []).join('\n'));
    this.gainText.setText('이제 ' + withRo(job.name) + ' 오를 수 있습니다');
    this.nextLabel.setText(n < this.jobs.length - 1 ? '다음' : '계속');

    [this.titleText, this.bodyText, this.gainText].forEach((o) => {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 260 });
    });
  }

  advance() {
    if (this.at >= this.jobs.length - 1) return this.leave();
    this.show(this.at + 1);
  }

  // 죽음 화면에서 고른 곳으로 그대로 이어 갑니다.
  leave() {
    this.scene.start(this.next.key, this.next.data);
  }
}
