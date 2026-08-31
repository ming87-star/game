// 33층 시퀀스의 **여는 말** (STORY.md 5절).
//
//   탑의 꼭대기에 오르기 위해
//   내가 할 수 있는 건 다 한 것 같다.
//   이제 나로서는 방법이 없다.
//
// 메달로 마흔여덟 개를 **다 사는 그 순간**에 뜹니다. 여는 조건과 말이
// 맞물립니다 — 「다 샀다」가 곧 「할 수 있는 건 다 했다」입니다.
//
// **판 한가운데에 넣지 않습니다.** 겉옷을 짚기 직전에 넣는 안이 있었는데,
// 그러면 마지막 판의 「아무 일 없었다는 듯이」가 깨집니다. 마지막 판에
// 독백이 뜨면 그게 바로 「특별한 판이 시작됩니다」입니다.
//
// 말투는 「나」입니다 (STORY.md 7절). 오프닝도 전부 그렇습니다.
class EndingLineScene extends Phaser.Scene {
  constructor() {
    super('endingline');
  }

  create() {
    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#05070d');

    // 한 줄씩 뜹니다. 세 줄을 한꺼번에 띄우면 읽는 박자가 없어집니다 —
    // 이 대사는 **체념이 쌓이는 말**이라 쌓이는 것이 보여야 합니다.
    const 줄 = [
      '탑의 꼭대기에 오르기 위해',
      '내가 할 수 있는 건 다 한 것 같다.',
      '이제 나로서는 방법이 없다.',
    ];
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    this.lines = 줄.map((t, i) => this.add.text(cx, 380 + i * 58, t,
      font(i === 2 ? 27 : 24, i === 2 ? '#e8eaf6' : '#b0bec5'))
      .setOrigin(0.5).setAlpha(0));

    // 마지막 줄이 다 뜬 뒤에야 넘어갈 수 있습니다. 그 전에 눌러서
    // 건너뛰면 이 대사가 없는 것과 같아집니다.
    //
    // **다 떴는지를 시계로 재지 않습니다.** 처음에는 「켠 지 4.3초」로
    // 쟀는데, 프레임이 길어지면 트윈은 프레임으로 가고 time.now 는 실제
    // 시간으로 가서 둘이 벌어집니다 — 첫 줄이 아직 0.17 인데 「다 떴다」가
    // 참이었습니다. 마지막 줄의 트윈이 끝났는지로 봅니다. 그것이 곧
    // 사람이 화면에서 보는 것입니다.
    this.lines.forEach((o, i) => {
      this.tweens.add({
        targets: o, alpha: 1, duration: 700, delay: 500 + i * 1500,
        onComplete: () => { if (i === this.lines.length - 1) this.allShown(); },
      });
    });

    this.hint = this.add.text(cx, 640, '터치해서 계속하기', font(17, '#4a5578'))
      .setOrigin(0.5).setAlpha(0);

    this.input.on('pointerdown', () => this.go());

    window.__endingline = this; // 시험이 상태를 보기 위한 통로
  }

  // 세 줄이 다 떴습니다. 이제야 넘길 수 있습니다.
  allShown() {
    this.shown = true;
    this.tweens.add({ targets: this.hint, alpha: 1, duration: 600, delay: 500 });
  }

  ready() { return !!this.shown; }

  go() {
    if (this.leaving || !this.ready()) return;
    this.leaving = true;
    // 흰 화면이 이 시퀀스의 이음매입니다 (STORY.md 5절). 여기서 처음
    // 씌우고, 뒤의 장면들이 같은 연출을 이어 씁니다.
    const 덮개 = this.add.rectangle(CFG.width / 2, CFG.height / 2,
      CFG.width, CFG.height, 0xffffff, 0).setDepth(500);
    this.tweens.add({ targets: 덮개, alpha: 1, duration: 900,
      onComplete: () => this.scene.start('endingwatch') });
  }
}

// 33층 시퀀스의 **보는 장면** (STORY.md 5절의 1~7번).
//
// 플레이어는 아무것도 조작하지 않습니다. 보기만 합니다.
//
//   1  붉은 겉옷의 사람이 30층부터 오릅니다
//   2  33층에서 **피할 수 있는데 안 피하고** 죽습니다
//   3  같은 33층에서 다시 일어섭니다
//   4  다시 오릅니다 — **이제 적들이 그를 공격하지 않습니다**
//   5  화면이 하얗게 차오릅니다
//   6  탑을 벗어나 그 위에 선 모습. 옷이 흰옷으로 바뀌어 있습니다
//   7  잠시 후 1층 바닥으로 붉은 겉옷이 천천히 떨어집니다
//
// **2번이 알맹이입니다.** 져서 죽는 것과 안 피하고 죽는 것은 다릅니다.
// 그래서 몬스터가 오는 것이 먼저 보이고, 피할 자리가 있고, 그런데 안
// 움직입니다 — 그 사이(CFG.ending.dodgeWindowMs)가 없으면 그냥 맞아 죽은
// 것이 됩니다.
//
// **4번은 한 줄도 설명하지 않습니다.** 값을 이미 치렀다는 것을 「적이 더는
// 건드리지 않는다」로만 보여 줍니다.
class EndingWatchScene extends Phaser.Scene {
  constructor() {
    super('endingwatch');
  }

  create() {
    buildTextures(this);
    const c = CFG.ending;
    this.cameras.main.setBackgroundColor('#0b0e18');
    const cx = CFG.width / 2;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    // 네 층을 세로로 놓습니다. 30층이 아래, 33층이 위입니다.
    this.floorY = {};
    [30, 31, 32, 33].forEach((n, i) => {
      const y = c.baseY - i * c.floorGap;
      this.floorY[n] = y;
      this.add.rectangle(cx, y + 14, 300, 12, 0x3f4a78).setAlpha(0.9);
      this.add.text(cx - 172, y + 4, n + '층', font(15, '#4a5578')).setOrigin(0.5, 0);
    });

    // 붉은 겉옷의 사람. 30층에서 시작합니다.
    this.him = this.add.image(cx, this.floorY[30] - 10, 'cloak-red').setDepth(10);

    this.step = 0;          // 시험이 어디까지 왔는지 읽는 값
    this.foes = [];
    window.__endingwatch = this;

    this.time.delayedCall(600, () => this.climbTo(31));
  }

  // 한 층 오릅니다. 걸음마다 살짝 튀어 오르게 해서 「오르고 있다」가 보이게.
  climbTo(n, then) {
    this.tweens.add({
      targets: this.him, y: this.floorY[n] - 10, duration: CFG.ending.climbMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.at = n;
        if (then) then();
        else if (n < 33) this.time.delayedCall(260, () => this.climbTo(n + 1));
        else this.time.delayedCall(400, () => this.theBlow());
      },
    });
  }

  // ── 2번 — 피할 수 있는데 안 피합니다 ───────────────────
  theBlow() {
    this.step = 2;
    const c = CFG.ending;
    const 놈 = this.add.image(CFG.width / 2 + 240, this.floorY[33] - 8, 'e-crawler')
      .setDepth(9);
    this.foes.push(놈);
    // 먼저 **보입니다.** 오는 것이 보이고, 피할 자리가 있고, 그런데
    // 안 움직입니다 — 그 사이가 이 장면의 전부입니다.
    this.tweens.add({
      targets: 놈, x: this.him.x + 34, duration: c.dodgeWindowMs, ease: 'Sine.easeIn',
      onComplete: () => {
        this.step = 3;
        this.cameras.main.shake(140, 0.006);
        // 쓰러집니다. 겉옷이 바닥에 눕습니다.
        this.tweens.add({ targets: this.him, angle: -78, y: this.floorY[33] + 4,
          duration: 420, ease: 'Quad.easeIn',
          onComplete: () => this.time.delayedCall(c.restMs, () => this.riseAgain()) });
      },
    });
  }

  // ── 3번 — 같은 33층에서 다시 일어섭니다 ────────────────
  riseAgain() {
    this.step = 4;
    this.tweens.add({
      targets: this.him, angle: 0, y: this.floorY[33] - 10, duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => this.time.delayedCall(500, () => this.pass()),
    });
  }

  // ── 4번 — 적들이 더는 건드리지 않습니다 ────────────────
  //
  // 말로 안 합니다. 달려들던 놈이 **돌아서서 물러납니다.** 한 줄도 안 적고
  // 지나가는 것이 이 장면의 규칙입니다.
  pass() {
    this.step = 5;
    this.foes.forEach((놈) => {
      this.tweens.add({ targets: 놈, x: 놈.x + 190, alpha: 0, duration: 900 });
    });
    // 위로 오릅니다. 이번에는 아무도 막지 않습니다.
    this.tweens.add({
      targets: this.him, y: this.floorY[33] - 10 - CFG.ending.floorGap * 2.2,
      alpha: 0.9, duration: CFG.ending.riseMs, ease: 'Sine.easeIn',
      onComplete: () => this.whiteOut(),
    });
  }

  // ── 5번 — 흰 화면 ──────────────────────────────────────
  whiteOut() {
    this.step = 6;
    const 덮개 = this.add.rectangle(CFG.width / 2, CFG.height / 2,
      CFG.width, CFG.height, 0xffffff, 0).setDepth(500);
    this.tweens.add({ targets: 덮개, alpha: 1, duration: 1100,
      onComplete: () => this.aboveTower(덮개) });
  }

  // ── 6번 — 탑을 벗어나 그 위에 ──────────────────────────
  //
  // **꼭대기(방)는 여전히 안 그립니다.** 그리는 순간 그건 그냥 어떤 방이
  // 됩니다. 그리는 것은 방이 아니라 **떠난 사람**입니다.
  aboveTower(덮개) {
    this.children.list.slice().forEach((o) => { if (o !== 덮개) o.destroy(); });
    this.cameras.main.setBackgroundColor('#eceff1');

    const cx = CFG.width / 2;
    // 저 아래 탑의 끝만 걸칩니다. 탑이 어디서 끝나는지가 보여야
    // 「벗어났다」가 읽힙니다.
    this.add.rectangle(cx, CFG.height - 40, 190, 200, 0xb0bec5).setAlpha(0.5);
    this.add.rectangle(cx, CFG.height - 138, 210, 14, 0x90a4ae).setAlpha(0.7);

    // **지붕을 밟고 서면 안 됩니다.** 처음에 탑 끝에 붙여 세웠더니
    // 「꼭대기에 닿았다」로 읽혔습니다 — 이 게임이 처음부터 아니라고
    // 해 온 바로 그것입니다. 탑과 사람 사이를 크게 벌립니다. 닿은 것이
    // 아니라 **떠난 것**입니다.
    this.him = this.add.image(cx, CFG.height - 430, 'cloak-white')
      .setDepth(10).setAlpha(0).setScale(1.5);
    this.tweens.add({ targets: 덮개, alpha: 0, duration: 1200 });
    // **다 뜬 뒤에** 7번으로 칩니다. 뜨기 시작할 때 세어 버리면 시험이
    // 아직 안 보이는 화면을 찍고 「탑 밖에 섰다」로 적습니다 — 실제로
    // 그렇게 빈 하늘만 찍혔습니다.
    this.tweens.add({ targets: this.him, alpha: 1, duration: 1200, delay: 300,
      onComplete: () => {
        this.step = 7;
        this.time.delayedCall(CFG.ending.restMs, () => this.dropCloak());
      } });
  }

  // ── 7번 — 붉은 겉옷이 1층 바닥으로 ─────────────────────
  //
  // 예전 안은 33층에 널브러진 것을 보여 주고 끝이었습니다. 그러면
  // **33층까지 못 가는 사람은 겉옷을 못 만납니다.** 떨어뜨리면 모두가
  // 시작하는 자리에 놓입니다 — 「층수로 잡지 않는다」는 여는 조건과
  // 같은 뜻입니다.
  dropCloak() {
    this.step = 8;
    // 먼저 **화면 밖으로** 떨어집니다. 탑 몸통 위에 얹히면 「1층 바닥으로」가
    // 아니라 「지붕에 떨어졌다」가 됩니다 — 실제로 처음에 그랬습니다.
    const 옷 = this.add.image(this.him.x, this.him.y + 10, 'cloak-fallen')
      .setDepth(11).setAlpha(0.95);
    this.tweens.add({
      targets: 옷, y: CFG.height + 60, angle: 18,
      duration: CFG.ending.fallMs, ease: 'Sine.easeIn',
      onComplete: () => this.groundBelow(),
    });
  }

  // 저 아래 1층. 모두가 시작하는 자리입니다 — 33층까지 못 가는 사람도
  // 여기서는 겉옷을 만납니다.
  groundBelow() {
    this.children.list.slice().forEach((o) => o.destroy());
    this.cameras.main.setBackgroundColor('#0b0e18');
    const cx = CFG.width / 2;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const 바닥 = CFG.height - 260;
    this.add.rectangle(cx, 바닥 + 14, 300, 12, 0x3f4a78).setAlpha(0.9);
    this.add.text(cx - 172, 바닥 + 4, '1층', font(15, '#4a5578')).setOrigin(0.5, 0);

    const 옷 = this.add.image(cx, -30, 'cloak-fallen').setDepth(11).setAngle(18);
    this.tweens.add({
      targets: 옷, y: 바닥 - 4, angle: 6,
      duration: CFG.ending.fallMs, ease: 'Sine.easeIn',
      onComplete: () => {
        this.step = 9;
        this.time.delayedCall(1200, () => this.leave());
      },
    });
  }

  // ── 8번으로 — 평소와 똑같이 ────────────────────────────
  //
  // 여기서 「특별한 판이 시작됩니다」 같은 말을 얹으면 전부 망칩니다.
  // 늘 켜던 자리로 그냥 돌아갑니다.
  leave() {
    if (this.left) return;
    this.left = true;
    this.scene.start('title');
  }
}

// 엔딩 크레딧 (STORY.md 5절 11번 · 6절).
//
// **아무것도 안 넣습니다.** 한 줄뿐입니다.
//
//   Project JHS
//
// 꼭대기를 안 그리는 것과 같은 결입니다. 여기에 만든 사람들과 고마운
// 사람들과 쓴 도구를 늘어놓으면, 방금 본 것이 그 목록의 앞머리가 됩니다.
//
// **엔딩을 본 뒤에는 다시 못 합니다.** 「한 판 더」가 되면 방금 본 것이
// 그냥 해금 보상이 됩니다. 대신 **처음부터 다시 하기**를 둡니다 —
// 기록을 통째로 지우고 처음으로 돌아가는 길입니다. 닫되 가두지는 않습니다.
class CreditsScene extends Phaser.Scene {
  constructor() {
    super('credits');
  }

  create() {
    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#05070d');
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    this.name = this.add.text(cx, CFG.height / 2 - 20, 'Project JHS',
      font(30, '#e8eaf6')).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: this.name, alpha: 1, duration: 2200, delay: 900,
      onComplete: () => this.offerRestart() });

    window.__credits = this;
  }

  offerRestart() {
    const cx = CFG.width / 2;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    this.shown = true;

    const box = this.add.rectangle(cx, CFG.height - 190, 300, 62, 0x141826)
      .setStrokeStyle(1, 0x2f3a5c).setInteractive({ useHandCursor: true }).setAlpha(0);
    const label = this.add.text(cx, CFG.height - 190, '처음부터 다시 하기',
      font(21, '#8794b5')).setOrigin(0.5).setAlpha(0);
    this.restartAt = { x: cx, y: CFG.height - 190 };
    this.tweens.add({ targets: [box, label], alpha: 1, duration: 900, delay: 1400 });

    // 한 번 더 묻습니다. 여기를 잘못 누르면 **여태 쌓은 것이 전부**
    // 사라집니다 — 되돌릴 길이 없는 자리에는 문이 둘이라야 합니다.
    box.on('pointerdown', () => {
      if (this.asking) return this.wipe();
      this.asking = true;
      label.setText('정말 지울까요? 한 번 더');
      label.setColor('#ef9a9a');
    });
  }

  wipe() {
    if (this.wiping) return;
    this.wiping = true;
    Save.reset();
    const 덮개 = this.add.rectangle(CFG.width / 2, CFG.height / 2,
      CFG.width, CFG.height, 0xffffff, 0).setDepth(500);
    this.tweens.add({ targets: 덮개, alpha: 1, duration: 800,
      onComplete: () => window.location.reload() });
  }
}
