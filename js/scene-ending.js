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
    // **Phaser 는 장면 객체를 다시 씁니다.** 다시 켜도 create 만 다시 돌 뿐
    // 인스턴스는 그대로라, 지난번에 세운 깃발이 남아 있습니다. 여기서 안
    // 지우면 두 번째로 들어온 사람은 첫 프레임부터 「다 떴다」가 됩니다.
    this.shown = false;
    this.leaving = false;

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
// 그래서 놈이 오는 것이 먼저 보이고, 옆 발판이 비어 있고, 그런데 안
// 움직입니다 — 그 사이(CFG.ending.dodgeWindowMs)가 없으면 그냥 맞아 죽은
// 것이 됩니다.
//
// **4번은 한 줄도 설명하지 않습니다.** 값을 이미 치렀다는 것을 「적이 더는
// 건드리지 않는다」로만 보여 줍니다.
//
// ── 판과 같은 화면입니다 ────────────────────────────────
// 처음에는 회색 슬래브 네 줄에 적 하나였습니다. 그러면 이 장면이 **딴
// 게임**이 됩니다 — 여태 이백 시간을 오른 그 탑에서 벌어지는 일로 안
// 읽힙니다. 벽도(js/wall.js) 발판도(plat) 적도(e-*) 판이 쓰는 그것을
// 그대로 씁니다. 층 간격도 CFG.floorHeight 그대로입니다.
//
// 적은 **그 층에 실제로 나오는 놈들**만 세웁니다. 33층에는 코인벌레와
// 기는 것뿐입니다 — 탑에서 가장 약한 둘입니다. 그 둘 사이에서 죽는 것이
// 이 장면의 뜻입니다. 층이 낮아서 진 것이 아닙니다.
class EndingWatchScene extends Phaser.Scene {
  constructor() {
    super('endingwatch');
  }

  // 타이틀 → 메달 상점에서 곧장 올 수 있습니다. 판을 한 번도 안 거쳤으면
  // 벽도 발판도 적도 안 실려 있으므로 여기서 싣습니다.
  preload() {
    loadArt(this);
  }

  create() {
    buildTextures(this);
    const c = CFG.ending;
    buildTowerWall(this);

    // 층 자리. **진짜 층 간격**을 그대로 씁니다 — 여기서만 좁히면 오르는
    // 걸음이 판과 다른 박자가 됩니다.
    this.floorY = {};
    this.slots = {};
    this.foes = [];
    // 30층 아래로도 몇 층 깔아 둡니다. 30층이 화면 아래끝이면 탑이 거기서
    // 시작하는 것처럼 보입니다 — 그는 이미 서른 층을 올라온 사람입니다.
    for (let n = 27; n <= 40; n++) {
      const y = c.baseY - (n - 30) * CFG.floorHeight;
      this.floorY[n] = y;
      this.buildFloor(n, y);
    }

    // 붉은 겉옷의 사람. 30층 한가운데에서 시작합니다.
    this.him = this.add.image(CFG.laneX.mid, this.floorY[30] - 33, 'cloak-red').setDepth(10);

    // 30~33층이 한 화면에 다 들어옵니다. 오르기 시작하는 4번부터만
    // 카메라가 따라붙습니다 (update).
    this.camAnchor = this.floorY[33] - 33;
    this.following = false;

    this.step = 0;          // 시험이 어디까지 왔는지 읽는 값
    this.left = false;      // 장면 객체는 다시 쓰이므로 깃발을 손으로 지웁니다
    this.comer = null;
    window.__endingwatch = this;

    this.time.delayedCall(600, () => this.climbTo(31));
  }

  // 한 층을 짓습니다. 발판 둘과 그 위에 선 적들.
  //
  // 가운데 줄은 **늘 있습니다** — 그가 오르는 길입니다. 옆 줄은 한 칸씩
  // 번갈아 놓습니다. 33층에서 옆이 비어 있어야 「피할 수 있었다」가 눈에
  // 보입니다.
  buildFloor(n, y) {
    const 옆 = n % 2 === 0 ? 'right' : 'left';
    this.slots[n] = {};
    ['mid', 옆].forEach((lane) => {
      const x = CFG.laneX[lane];
      this.slots[n][lane] = { x, y };
      if (hasArt('plat')) this.add.image(x, y, 'plat').setDepth(0);
      else this.add.rectangle(x, y, CFG.platformW, CFG.platformH, 0x4a5699).setDepth(0);
    });

    // 33층은 비워 둡니다. 그가 죽는 자리에 구경꾼을 세우면 그쪽으로 눈이
    // 갑니다 — 안 피하는 것을 보게 하려면 화면에 그와 놈뿐이어야 합니다.
    if (n === 33) return;
    const 무리 = CFG.enemyTypes.filter((t) => t.from <= n && !isFoeType(t));
    if (!무리.length) return;
    const 몇 = n % 3 === 0 ? 2 : 1;
    for (let i = 0; i < 몇; i++) {
      const def = 무리[(n + i) % 무리.length];
      const key = 'e-' + def.key;
      if (!hasArt(key)) continue;
      const a = artSize(key);
      const k = def.scale || 1;
      const s = this.slots[n][옆];
      this.foes.push(this.add.image(s.x - 34 + i * 52, s.y - 10 - (a.h * k) / 2, key)
        .setDepth(8).setScale(k));
    }
  }

  // 한 층 오릅니다.
  climbTo(n, then) {
    this.tweens.add({
      targets: this.him, y: this.floorY[n] - 33, duration: CFG.ending.climbMs,
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
  //
  // 죽이는 것은 **「내려온 것」** 입니다 (art/ending-foe.svg). 게임 안의 어느
  // 층에도 안 나옵니다. 층이 올라서 만나는 놈이면 「더 오르면 이긴다」가
  // 되고, 그러면 엔딩이 그냥 하나 남은 벽이 됩니다.
  //
  // 이 탑의 모든 것은 오릅니다. 이것만 **내려옵니다.**
  theBlow() {
    this.step = 2;
    const c = CFG.ending;
    const y = this.floorY[33];
    const 놈 = this.add.image(this.him.x + 8, y - 660, 'ending-foe').setDepth(9);
    this.comer = 놈;

    // 먼저 **보입니다.** 내려오는 것이 보이고, 왼쪽 발판이 비어 있고,
    // 그런데 안 움직입니다 — 그 사이가 이 장면의 전부입니다.
    this.tweens.add({
      // **그를 가리면 안 됩니다.** 처음에 y-104 에서 멈췄더니 놈이 그를
      // 통째로 덮어서, 화면에 놈만 남고 「안 피하는 사람」이 안 보였습니다.
      // 머리 위로 한 뼘 띄웁니다.
      targets: 놈, y: y - 132, duration: c.dodgeWindowMs, ease: 'Sine.easeIn',
      onComplete: () => {
        // **여기가 3번입니다** — 놈은 코앞에 있고 옆 발판은 비어 있고 그는
        // 그대로 서 있습니다. 처음에는 내리치기 시작할 때를 3번으로 삼았는데,
        // 그러면 시험이 찍는 컷이 늘 **이미 쓰러지는 중**이었습니다.
        // 이 장면에서 봐야 하는 것은 맞는 순간이 아니라 안 피하는 참입니다.
        this.step = 3;
        this.time.delayedCall(280, () => this.strike());
      },
    });
  }

  strike() {
    // 내리치는 것은 짧아야 합니다. 여기가 길면 아직 피할 수 있는 시간이 되고,
    // 그러면 「안 피했다」가 「못 피했다」로 바뀝니다.
    this.tweens.add({
      targets: this.comer, y: this.comer.y + 46, duration: 110, ease: 'Quad.easeIn',
      onComplete: () => {
        this.cameras.main.shake(160, 0.007);
        this.tweens.add({
          targets: this.him, angle: -78, y: this.floorY[33] - 12,
          duration: 420, ease: 'Quad.easeIn',
          onComplete: () => this.time.delayedCall(CFG.ending.restMs, () => this.riseAgain()),
        });
      },
    });
  }

  // ── 3번 — 같은 33층에서 다시 일어섭니다 ────────────────
  riseAgain() {
    this.step = 4;
    this.tweens.add({
      targets: this.him, angle: 0, y: this.floorY[33] - 33, duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => this.time.delayedCall(500, () => this.pass()),
    });
  }

  // ── 4번 — 적들이 더는 건드리지 않습니다 ────────────────
  //
  // 말로 안 합니다. 내려온 것은 **도로 올라가고**, 위층의 적들은 돌아서서
  // 물러납니다. 한 줄도 안 적고 지나가는 것이 이 장면의 규칙입니다.
  pass() {
    this.step = 5;
    if (this.comer) {
      this.tweens.add({ targets: this.comer, y: this.floorY[33] - 700, alpha: 0,
        duration: 1400, ease: 'Sine.easeInOut' });
    }
    this.foes.forEach((놈, i) => {
      this.tweens.add({ targets: 놈, x: 놈.x + (i % 2 ? 150 : -150), alpha: 0,
        duration: 900, delay: i * 60 });
    });

    // 위로 오릅니다. 이번에는 아무도 막지 않습니다. 여기서부터 카메라가
    // 따라붙고, 벽 세 겹이 저마다 다른 속도로 흘러갑니다.
    this.following = true;
    this.tweens.add({
      targets: this.him, y: this.floorY[39] - 33, alpha: 0.92,
      duration: CFG.ending.riseMs, ease: 'Sine.easeIn',
      onComplete: () => this.whiteOut(),
    });
  }

  update() {
    if (this.following) {
      this.cameras.main.scrollY = Math.min(0, this.him.y - this.camAnchor);
    }
    scrollTowerWall(this, this.cameras.main.scrollY);
  }

  // ── 5번 — 흰 화면 ──────────────────────────────────────
  whiteOut() {
    this.step = 6;
    const 덮개 = this.add.rectangle(CFG.width / 2, CFG.height / 2,
      CFG.width, CFG.height, 0xffffff, 0).setScrollFactor(0).setDepth(500);
    this.tweens.add({ targets: 덮개, alpha: 1, duration: 1100,
      onComplete: () => this.aboveTower(덮개) });
  }

  // ── 6번 — 탑을 벗어나 그 위에 ──────────────────────────
  //
  // **꼭대기(방)는 여전히 안 그립니다.** 그리는 순간 그건 그냥 어떤 방이
  // 됩니다. 그리는 것은 방이 아니라 **떠난 사람**입니다.
  //
  // 여기만은 판과 안 닮아야 합니다. 탑 안이 아니니까요.
  aboveTower(덮개) {
    this.following = false;
    this.wallLayers = null;   // 아래에서 통째로 지웁니다. 지운 것을 밀면 터집니다
    this.cameras.main.setScroll(0, 0);
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
  // 여기서는 겉옷을 만납니다. 여기도 판과 같은 벽, 같은 발판입니다.
  groundBelow() {
    this.children.list.slice().forEach((o) => o.destroy());
    buildTowerWall(this);
    const cx = CFG.laneX.mid;
    // 바닥을 260 위에 두면 벽의 벽감(480 주기 중 아래것)이 **겉옷 바로 뒤에**
    // 옵니다. 떨어진 옷이 등불에 비쳐 서는 자리입니다 — 우연히 맞은 것을
    // 알고 나서 고정했습니다. 이 값을 옮기면 그 빛이 사라집니다.
    const 바닥 = CFG.height - 260;
    if (hasArt('plat')) this.add.image(cx, 바닥, 'plat').setDepth(0);
    else this.add.rectangle(cx, 바닥, CFG.platformW, CFG.platformH, 0x4a5699).setDepth(0);

    const 옷 = this.add.image(cx, -30, 'cloak-fallen').setDepth(11).setAngle(18);
    this.tweens.add({
      targets: 옷, y: 바닥 - 20, angle: 6,
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

    // **여기를 안 지우면 기록이 한 번에 날아갑니다.** Phaser 는 장면 객체를
    // 다시 쓰므로, 크레딧을 나갔다 돌아오면 asking 이 참인 채로 남습니다 —
    // 「정말 지울까요」를 이미 물은 셈이 되어, 처음 누른 한 번이 곧 지우기가
    // 됩니다. 되돌릴 길이 없는 자리에는 문이 둘이라야 합니다.
    this.shown = false;
    this.asking = false;
    this.wiping = false;

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
