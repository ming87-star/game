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

  create(data) {
    // 코드로 들어온 **미리보기**는 기록에 아무것도 안 적습니다 (js/codes.js).
    // 주소에 붙이던 방식은 저장을 통째로 세워야 해서 백업까지 떠야 했는데,
    // 코드는 그냥 보여 주기만 하면 됩니다 — 되돌릴 일이 없어집니다.
    this.preview = !!(data && data.preview);
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
    const 덮개 = makeVeil(this, 0xffffff).setDepth(500);
    this.tweens.add({ targets: 덮개, alpha: 1, duration: 900,
      onComplete: () => this.scene.start('endingwatch', { preview: this.preview }) });
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
//   5  **오르는 동안** 화면이 하얗게 차오릅니다
//   6  탑을 벗어나 그 위에 선 모습. 옷이 흰옷으로 바뀌어 있습니다
//   7  장면이 끊기고, 탑 안 1층에 **이미 떨어지고 있는** 붉은 겉옷
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

  create(data) {
    this.preview = !!(data && data.preview);   // 코드로 들어온 미리보기
    buildTextures(this);
    const c = CFG.ending;
    buildTowerWall(this);
    lightTowerWall(this, 33);   // 33층의 밝기 — 판에서 그 층에 섰을 때와 같게

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

  // 한 층 **뛰어오릅니다.**
  //
  // 예전에는 900ms 짜리 직선 트윈이었습니다. 그러면 사람이 오르는 것이
  // 아니라 그림이 위로 밀려 올라갑니다 — 발이 땅을 안 밉니다.
  // 판에서 뛰는 것과 **같은 식**으로 갑니다: 직선 보간에서 sin 만큼 빼는
  // 포물선(js/scene-game.js 의 jump). 판은 옆 줄로 건너뛰므로 호가 95 지만,
  // 여기는 곧장 위라서 그 값을 쓰면 층을 훌쩍 넘겼다가 도로 내려앉습니다.
  climbTo(n, then) {
    const c = CFG.ending;
    const 부터 = this.him.y;
    const 까지 = this.floorY[n] - 33;
    const 호 = { t: 0 };
    this.tweens.add({
      targets: 호, t: 1, duration: c.hopMs, ease: 'Linear',
      onUpdate: () => {
        this.him.y = Phaser.Math.Linear(부터, 까지, 호.t) - Math.sin(Math.PI * 호.t) * c.hopArc;
      },
      onComplete: () => {
        this.him.y = 까지;
        this.at = n;
        if (then) then();
        else if (n < 33) this.time.delayedCall(c.hopRestMs, () => this.climbTo(n + 1));
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
        this.crumble();
      },
    });
  }

  // 쓰러지는 것은 **꺾이는 것이 아니라 무너지는 것**입니다.
  //
  // 예전에는 그림을 78도로 눕혔습니다. 겉옷 그림은 사람 모양이라, 그대로
  // 돌리면 사람이 쓰러진 것이 아니라 **널빤지가 옆으로 넘어간 것**으로
  // 보였습니다. 그림 한 장을 돌려서 「쓰러졌다」를 만들 수는 없습니다.
  //
  // 그래서 두 단으로 무너뜨리고, 바닥에서는 **다른 그림**으로 바꿉니다 —
  // 떨어진 겉옷 더미(cloak-fallen), 마지막 판에서 짚어 드는 바로 그것입니다.
  // 이 사람은 겉옷입니다. 사람이 넘어지는 것이 아니라 옷이 무너져 내리는
  // 것이 이 장면에서는 더 맞습니다.
  crumble() {
    const c = CFG.ending;
    const 바닥 = this.floorY[33];
    this.tweens.add({
      // 1단 — 무릎이 꺾입니다. 짧게, 아래로만
      targets: this.him, y: 바닥 - 20, angle: -10,
      duration: Math.round(c.crumbleMs * 0.35), ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({
          // 2단 — 앞으로 무너지면서 사라집니다
          targets: this.him, y: 바닥 - 8, angle: -34, alpha: 0,
          duration: Math.round(c.crumbleMs * 0.65), ease: 'Quad.easeIn',
          onComplete: () => {
            // 3단 — 그 자리에 천 더미가 남습니다
            const h = hasArt('cloak-fallen') ? artSize('cloak-fallen').h : 48;
            this.him.setTexture(hasArt('cloak-fallen') ? 'cloak-fallen' : 'cloak-red');
            this.him.setAngle(0).setAlpha(1);
            this.him.y = 바닥 - h / 2;
            this.fallenY = this.him.y;
            this.time.delayedCall(c.restMs, () => this.riseAgain());
          },
        });
      },
    });
  }

  // ── 3번 — 같은 33층에서 다시 일어섭니다 ────────────────
  //
  // **여기서 서두르면 맞은 것이 아무 일도 아닌 게 됩니다.** 700ms 짜리
  // 트윈 하나로 벌떡 일어섰더니 그랬습니다. 세 단으로 나누고, 일어서기
  // 전에 **먼저 움찔합니다** — 움직이기 전의 한 박자가 「스스로 일어난다」를
  // 만듭니다. 그게 없으면 누가 일으켜 세운 것처럼 보입니다.
  riseAgain() {
    this.step = 4;
    const c = CFG.ending;
    // **발치를 붙들고 키로 일어섭니다.**
    //
    // 처음에는 y 만 옮겨서 세웠습니다. 그런데 천 더미(68×48)는 선 사람
    // (36×46)과 키가 비슷해서, 잰 값으로 9px 밖에 안 움직였습니다 — 트윈은
    // 1.5초를 도는데 화면에서는 아무 일도 안 일어납니다.
    // 일어서는 것은 자리를 옮기는 것이 아니라 **키가 자라는 것**입니다.
    // 그래서 발치(발이 닿는 줄)를 고정하고 scaleY 를 0.3 에서 1 로 폅니다.
    const h = hasArt('cloak-red') ? artSize('cloak-red').h : 46;
    const 발치 = this.floorY[33] - 33 + h / 2;

    // 1단 — 천 더미가 한 번 부풀었다 가라앉습니다. 아직 사람이 아닙니다
    this.tweens.add({
      targets: this.him, scaleY: 1.18, scaleX: 0.94, duration: 260,
      ease: 'Sine.easeOut', yoyo: true,
      onComplete: () => {
        // 2단 — 다시 사람이 됩니다. 웅크린 채로, 낮게
        this.him.setTexture('cloak-red');
        this.him.setAngle(-20);
        const 키 = { s: 0.3 };
        this.him.setScale(1, 키.s);
        this.him.y = 발치 - (h * 키.s) / 2;
        // 3단 — 천천히 폅니다. 각이 먼저 서고 키가 끝까지 자랍니다
        this.tweens.add({
          targets: this.him, angle: 0,
          duration: Math.round(c.riseSlowMs * 0.45), ease: 'Sine.easeOut',
        });
        this.tweens.add({
          targets: 키, s: 1, duration: c.riseSlowMs, ease: 'Cubic.easeOut',
          onUpdate: () => {
            this.him.setScale(1, 키.s);
            this.him.y = 발치 - (h * 키.s) / 2;
          },
          onComplete: () => {
            this.him.setScale(1);
            this.him.y = this.floorY[33] - 33;
            this.time.delayedCall(700, () => this.pass());
          },
        });
      },
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
    });
    // **오르는 동안** 밝아집니다.
    //
    // 예전에는 다 오른 뒤에 흰 화면을 시작했습니다. 그러면 오르기가 한 번
    // 끝나고, 화면이 잠깐 멈춘 채로 하얘지기 시작합니다 — 두 동작이 이어
    // 붙지 않고 사이가 뜹니다. 오르는 것과 밝아지는 것은 **한 동작**이어야
    // 합니다. 그가 올라가서 밝아지는 것이니까요.
    this.whiteOut();
  }

  update() {
    if (this.following) {
      this.cameras.main.scrollY = Math.min(0, this.him.y - this.camAnchor);
    }
    scrollTowerWall(this, this.cameras.main.scrollY);
  }

  // ── 5번 — 오르면서 하얘집니다 ──────────────────────────
  //
  // 4번의 오르기와 **같이 돕니다.** 오르기가 riseMs 인데 밝아지기는 그보다
  // 조금 늦게 시작해서 조금 늦게 끝납니다 — 다 밝아진 뒤에도 그가 아직
  // 오르고 있어야 「올라가면서 사라졌다」로 읽힙니다.
  whiteOut() {
    this.step = 6;
    const c = CFG.ending;
    const 덮개 = makeVeil(this, 0xffffff).setScrollFactor(0).setDepth(500);
    // **다 하얘질 때까지 그는 아직 오르고 있어야 합니다.** 처음에는
    // 0.25 늦게 시작해 0.95 동안 덮었더니 끝이 오르기보다 440ms 늦어서,
    // 마지막에 「멈춘 채로 하얘지는」 참이 생겼습니다. 오르기(riseMs)의
    // 0.95 지점에 다 덮이도록 맞춥니다.
    this.tweens.add({
      targets: 덮개, alpha: 1,
      delay: Math.round(c.riseMs * 0.15),
      duration: Math.round(c.riseMs * 0.8),
      ease: 'Sine.easeIn',
      onComplete: () => this.aboveTower(덮개),
    });
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
    // 그림이 오면 그 한 장이 하늘을 통째로 맡습니다 (ART.md 8.35절).
    // 아직 없으면 아래에서 도형으로 짓습니다 — 네모 둘로는 「엉성하다」는
    // 말을 들었고, 그건 맞는 말이었습니다.
    //
    // 구운 그림은 마침 화면과 같은 540×960 이지만, 크기를 못박아 둡니다 —
    // 나중에 다른 크기로 받아도 화면을 덮는 것은 그대로여야 합니다.
    if (hasArt('above-tower')) {
      this.add.image(cx, CFG.height / 2, 'above-tower')
        .setDisplaySize(CFG.width, CFG.height).setDepth(0);
    } else {
      this.paintSky(cx);
    }

    // **지붕을 밟고 서면 안 됩니다.** 처음에 탑 끝에 붙여 세웠더니
    // 「꼭대기에 닿았다」로 읽혔습니다 — 이 게임이 처음부터 아니라고
    // 해 온 바로 그것입니다. 탑과 사람 사이를 크게 벌립니다. 닿은 것이
    // 아니라 **떠난 것**입니다.
    //
    // 크기는 1.5배에서 2.8배로 올렸습니다. 하늘 한 장에 사람 하나뿐인
    // 화면에서 55px 짜리 사람은 티끌입니다.
    // 세우는 높이는 **구름 꼭대기를 재서** 잡았습니다. 그림의 구름선은
    // 옆기둥에서 592~616 입니다. 430 위에 두면 발치가 594 — 구름 꼭대기에
    // 딱 걸려서 **구름을 밟고 선 사람**이 됩니다. 밟을 것이 없어야 하므로
    // 발밑에 하늘을 아흔 픽셀 비웁니다.
    this.him = this.add.image(cx, CFG.height - 520, 'cloak-white')
      .setDepth(10).setAlpha(0).setScale(2.8);
    this.tweens.add({ targets: 덮개, alpha: 0, duration: 1200 });
    // **다 뜬 뒤에** 7번으로 칩니다. 뜨기 시작할 때 세어 버리면 시험이
    // 아직 안 보이는 화면을 찍고 「탑 밖에 섰다」로 적습니다 — 실제로
    // 그렇게 빈 하늘만 찍혔습니다.
    // 아주 느리게 오르내립니다. 가만히 있으면 붙여 놓은 그림이고,
    // 이 여섯 픽셀이 「떠 있다」를 만듭니다.
    this.tweens.add({ targets: this.him, y: this.him.y - 12, duration: 2600,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.him, alpha: 1, duration: 1200, delay: 300,
      onComplete: () => {
        this.step = 7;
        this.time.delayedCall(CFG.ending.restMs, () => this.cutToTower());
      } });
  }

  // 그림이 오기 전까지의 하늘. 도형으로 짓습니다.
  //
  // 세 가지만 지킵니다 — **구름이 가득할 것**, **빛이 위에서 쏟아질 것**,
  // **탑은 저 아래에서 끝나 있을 것**. 이 셋이 다 있어야 「탑을 벗어나
  // 그 위에 있다」가 됩니다. 하나만 빠져도 그냥 밝은 빈 화면입니다.
  paintSky(cx) {
    const H = CFG.height;
    const W = CFG.width;
    const g = this.add.graphics().setDepth(0);

    // 하늘 — 위는 눈부시게 희고 아래로 갈수록 푸릇해집니다. 스무 겹으로
    // 끊어 칠합니다 (Phaser 의 도형에는 그러데이션이 없습니다).
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xfffdf6),
        Phaser.Display.Color.ValueToColor(0xa9c4dd), 23, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 24) * i - 1, W, H / 24 + 2);
      void t;
    }

    // 빛 — 위 한가운데에서 쏟아집니다. 동그라미를 겹쳐 부드럽게 만듭니다.
    for (let i = 12; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.055);
      g.fillCircle(cx, 96, i * 34);
    }
    // 갈래 — 빛줄기 다섯. 가늘고 길게 내려옵니다
    for (let i = -2; i <= 2; i++) {
      g.fillStyle(0xffffff, 0.10);
      g.fillTriangle(cx - 12, 84, cx + 12, 84, cx + i * 150, H - 120);
    }

    // 구름 바다 — 세 겹입니다. 뒤로 갈수록 옅고 높습니다.
    const 겹 = [
      { y: H - 250, r: 96, n: 9, a: 0.35, c: 0xffffff },
      { y: H - 175, r: 118, n: 8, a: 0.62, c: 0xffffff },
      { y: H - 96, r: 142, n: 7, a: 0.95, c: 0xfdfdff },
    ];
    겹.forEach((층, k) => {
      g.fillStyle(층.c, 층.a);
      for (let i = 0; i < 층.n; i++) {
        // 늘 같은 하늘이어야 합니다 — 볼 때마다 구름이 달라지면 안 됩니다
        const x = (i + 0.5) * (W / 층.n) + ((i * 37 + k * 13) % 29) - 14;
        const dy = ((i * 53 + k * 29) % 34) - 17;
        g.fillCircle(x, 층.y + dy, 층.r * (0.62 + ((i * 17 + k * 7) % 40) / 100));
      }
      g.fillRect(0, 층.y, W, H - 층.y);
    });

    // 탑 — 저 아래 구름 속에서 끝나 있습니다. **지붕도 방도 없습니다.**
    //
    // 처음에는 300px 짜리 기둥에 갓돌까지 얹어 사람 바로 밑에 세웠습니다.
    // 그랬더니 탑이 아니라 **받침대**로 보였습니다 — 사람이 그 위에 올라선
    // 것처럼요. 이 장면이 아니라고 말하려는 바로 그것입니다.
    // 그래서 구름선 바로 위까지 낮추고, 갓돌을 없애고, 좁혔습니다.
    // 보이는 것은 구름 위로 삐죽 나온 돌 끝 한 뼘뿐입니다.
    const 탑 = this.add.graphics().setDepth(0);
    const 탑끝 = H - 268;
    // 멀리 있는 것은 대기에 씻겨 옅어집니다. 이 알파 하나가 「저 아래」를
    // 만듭니다 — 또렷하게 칠하면 바로 코앞의 기둥이 됩니다.
    탑.fillStyle(0x9aabbe, 0.85);
    탑.fillRect(cx - 48, 탑끝, 96, 268);
    탑.fillStyle(0x7d8ea3, 0.85);
    탑.fillRect(cx + 14, 탑끝, 34, 268);
    // 돌 줄눈 몇 줄. 이게 없으면 그냥 회색 기둥입니다
    탑.fillStyle(0x63748a, 0.3);
    for (let y = 탑끝 + 16; y < H - 150; y += 22) 탑.fillRect(cx - 48, y, 96, 2);
    // 꼭대기의 **곧은 가로선 하나가** 탑을 상자 뚜껑으로 만듭니다.
    // 옅은 안개 한 자락을 걸쳐서 그 선을 끊습니다.
    탑.fillStyle(0xffffff, 0.45);
    탑.fillEllipse(cx - 6, 탑끝 + 4, 190, 26);
    탑.fillStyle(0xffffff, 0.3);
    탑.fillEllipse(cx + 30, 탑끝 + 22, 150, 20);

    // 밑동을 구름에 묻습니다. **앞 구름 한 겹을 통째로 다시 덮으면 탑이
    // 아예 안 보입니다** — 처음에 그렇게 했다가 하늘만 남았습니다.
    // 탑이 어디서 끝나는지가 안 보이면 「벗어났다」가 안 읽힙니다.
    // 그래서 밑동에만 뭉치 몇 개를 얹습니다.
    탑.fillStyle(0xfdfdff, 0.95);
    [[-108, -128, 78], [-30, -104, 92], [58, -132, 74], [126, -110, 86]]
      .forEach(([dx, dy, r]) => 탑.fillCircle(cx + dx, H + dy, r));
    탑.fillRect(0, H - 96, W, 96);
  }

  // ── 7번 — 장면을 끊고, 탑 안으로 ───────────────────────
  //
  // **흰 옷 입은 사람에게서 붉은 옷이 떨어지면 안 됩니다.**
  //
  // 예전에는 탑 위에 선 사람 발치에서 붉은 옷을 떨어뜨려 화면 밖으로
  // 내려보냈습니다. 그러면 「저 사람이 옷을 벗어 던졌다」가 됩니다 —
  // 그는 이미 겉옷을 두고 온 사람이고, 벗는 장면은 여기가 아닙니다.
  // 게다가 탑 꼭대기에서 떨어뜨린 것이 탑 **안쪽** 1층에 놓이는 것도
  // 앞뒤가 안 맞습니다.
  //
  // 그래서 여기서 한 번 **끊습니다.** 하얗게 덮고, 걷으면 탑 안입니다.
  // 그리고 붉은 옷은 **이미 떨어지고 있습니다** — 어디서 떨어졌는지는
  // 안 보여 줍니다. 보여 주는 순간 그건 설명이 됩니다.
  cutToTower() {
    this.step = 8;
    const 덮개 = makeVeil(this, 0xffffff).setScrollFactor(0).setDepth(500);
    this.tweens.add({
      targets: 덮개, alpha: 1, duration: 900, ease: 'Sine.easeIn',
      onComplete: () => this.groundBelow(덮개),
    });
  }

  // 저 아래 1층. 모두가 시작하는 자리입니다 — 33층까지 못 가는 사람도
  // 여기서는 겉옷을 만납니다. 여기도 판과 같은 벽, 같은 발판입니다.
  groundBelow(덮개) {
    this.children.list.slice().forEach((o) => { if (o !== 덮개) o.destroy(); });
    this.cameras.main.setBackgroundColor('#000000');
    buildTowerWall(this);
    lightTowerWall(this, 0);    // 여기는 탑의 바닥입니다. 가장 어둡습니다
    const cx = CFG.laneX.mid;
    // **발판이 아니라 탑의 바닥입니다.** 떨어진 옷이 발판 위에 얹히면
    // 「누가 놓고 갔다」가 되고, 바닥에 놓여야 「떨어졌다」가 됩니다.
    // 판의 0층과 같은 그림입니다 (`plat-ground`).
    //
    // 260 위에 두면 벽의 벽감(480 주기 중 아래것)이 **겉옷 바로 뒤에**
    // 옵니다. 떨어진 옷이 등불에 비쳐 놓이는 자리입니다 — 우연히 맞은 것을
    // 알고 나서 고정했습니다. 이 값을 옮기면 그 빛이 사라집니다.
    const 바닥 = CFG.height - 260;
    if (hasArt('plat-ground')) {
      this.add.image(CFG.width / 2, 바닥 - CFG.platformH / 2, 'plat-ground')
        .setOrigin(0.5, 0).setDepth(0);
    } else {
      this.add.rectangle(CFG.width / 2, 바닥, CFG.width, CFG.platformH, 0x4a5699).setDepth(0);
    }

    // 떨어지는 동안과 놓인 뒤는 **다른 그림**입니다. 바닥에 쌓인 더미를
    // 그대로 띄우면 더미가 공중에 떠 내려오는 것으로 보입니다 — 떨어지는
    // 동안은 바람에 펼쳐져 있어야 합니다 (ART.md 8.3절).
    // 떨어지는 그림이 없으면 예전처럼 더미 하나로 갑니다.
    const 나는옷 = hasArt('cloak-falling') ? 'cloak-falling' : 'cloak-fallen';
    // 놓인 뒤의 더미 높이로 착지 자리를 잡습니다. 그림이 커지면(DIV) 이
    // 값도 같이 따라가야 옷이 바닥에 파묻히지 않습니다.
    const 더미h = hasArt('cloak-fallen') ? artSize('cloak-fallen').h : 24;
    const 옷 = this.add.image(cx, -60, 나는옷).setDepth(11).setAngle(18);

    // **덮개를 걷으면 옷은 이미 떨어지고 있습니다.** 여기가 7번의 알맹이
    // 입니다 — 어디서 떨어졌는지는 안 보여 줍니다.
    if (덮개) this.tweens.add({ targets: 덮개, alpha: 0, duration: 900 });

    this.tweens.add({
      targets: 옷, y: 바닥 - 더미h / 2, angle: 6,
      duration: CFG.ending.fallMs, ease: 'Sine.easeIn',
      onComplete: () => {
        // 닿는 순간 더미로 바꿔 놓습니다.
        if (나는옷 !== 'cloak-fallen') 옷.setTexture('cloak-fallen');
        this.step = 9;
        this.time.delayedCall(CFG.ending.floorRestMs, () => this.toBlack());
      },
    });
  }

  // 놓인 겉옷을 잠깐 보고 있다가, 검게 덮고 나갑니다.
  //
  // 예전에는 1.2초 뒤에 곧장 타이틀로 넘겼습니다. 마지막으로 보는 그림이
  // 이 겉옷인데 놓이자마자 화면이 갈아치워지니 **놓였다는 것을 볼 새가**
  // 없었습니다. 그리고 밝은 탑 안에서 타이틀로 바로 튀면 이음매가 튑니다 —
  // 검은 화면 한 장이 사이에 있어야 「끝났다」가 됩니다.
  toBlack() {
    const c = CFG.ending;
    const 덮개 = makeVeil(this, 0x000000).setDepth(600);
    this.tweens.add({
      targets: 덮개, alpha: 1, duration: c.blackMs, ease: 'Sine.easeIn',
      onComplete: () => this.time.delayedCall(c.blackHoldMs, () => this.leave()),
    });
  }

  // ── 8번으로 — 평소와 똑같이 ────────────────────────────
  //
  // 여기서 「특별한 판이 시작됩니다」 같은 말을 얹으면 전부 망칩니다.
  // 늘 켜던 자리로 그냥 돌아갑니다.
  leave() {
    if (this.left) return;
    this.left = true;
    // **여기서야 「봤다」입니다.** 산 순간이 아니라 끝까지 본 순간입니다 —
    // 그 사이에 창을 닫은 사람은 다음에 켰을 때 처음부터 다시 봅니다
    // (js/save.js 의 sawEnding).
    //
    // 미리보기(코드로 들어온 것)는 **아무것도 안 적습니다.** 적어 버리면
    // 한 번 눌러 본 것이 「이 사람은 엔딩을 봤다」가 되어 판이 닫힙니다.
    if (!this.preview) Save.markEndingSeen();
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

  create(data) {
    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#05070d');
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    // 엔딩을 마친 **그 자리**에서 온 것이 아니라, 뒤에 다시 켜서 온 것이면
    // 이름이 떠오르는 것을 기다리게 하지 않습니다. 처음 한 번은 크레딧이지만
    // 그 뒤로는 **「처음부터 다시 하기」 한 단추짜리 화면**입니다.
    this.straight = !!(data && data.straight);

    // **여기를 안 지우면 기록이 한 번에 날아갑니다.** Phaser 는 장면 객체를
    // 다시 쓰므로, 크레딧을 나갔다 돌아오면 asking 이 참인 채로 남습니다 —
    // 「정말 지울까요」를 이미 물은 셈이 되어, 처음 누른 한 번이 곧 지우기가
    // 됩니다. 되돌릴 길이 없는 자리에는 문이 둘이라야 합니다.
    this.shown = false;
    this.asking = false;
    this.wiping = false;

    this.name = this.add.text(cx, CFG.height / 2 - 20, 'Project JHS',
      font(30, '#e8eaf6')).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: this.name, alpha: 1,
      duration: this.straight ? 300 : 2200, delay: this.straight ? 0 : 900,
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
    this.tweens.add({ targets: [box, label], alpha: 1,
      duration: this.straight ? 250 : 900, delay: this.straight ? 0 : 1400 });

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
    const 덮개 = makeVeil(this, 0xffffff).setDepth(500);
    this.tweens.add({ targets: 덮개, alpha: 1, duration: 800,
      onComplete: () => window.location.reload() });
  }
}
