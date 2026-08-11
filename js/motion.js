// 공격 모션 — 무기마다 그려 둔 여덟 컷을 갈아 끼웁니다.
//
// ── 여기까지 온 길 ──────────────────────────────────────
// 1. 그림 한 장을 통째로 기울였습니다. 검이 몸과 같은 각도로만 움직이고 발이
//    같이 미끄러졌습니다. 그건 모션이 아닙니다.
// 2. 몸을 세 조각(다리·몸통·팔)으로 잘라 따로 돌렸습니다. 훨씬 나아졌지만
//    조각을 돌리는 것으로 낼 수 있는 자세는 한계가 있습니다 — 몸이 웅크리지도
//    늘어나지도 못하고, 칼이 지나간 잔상을 그릴 수도 없습니다.
// 3. 지금 — 무기 서른여섯 자루마다 **여덟 컷을 그려 두었습니다**
//    (gen-sheet.js → assets/sheets → bake-sheets.js → js/sheetdata.js).
//    예비동작 · 극단 자세 · 스미어 · 팔로스루가 그림 안에 들어 있습니다.
//    코드가 할 일은 그 여덟 장을 **어떤 박자로 넘길지** 정하는 것뿐입니다.
//
// ── 무엇이 없어졌는가 ───────────────────────────────────
// 조각(art/p-*.svg)도, 손에 쥐는 무기 그림(art/hand-*.svg)도, 조각마다의
// 자세 트랙(MOTIONS)도 없습니다. 그림이 자세를 갖고 있으므로 코드가 자세를
// 만들 이유가 없습니다. 조각 시절의 코드는 git 기록에 남아 있습니다.
//
// ── 왜 물리 몸을 직접 안 바꾸는가 (이건 그대로입니다) ──────
// `scene.player` 는 물리 몸입니다. 그 x·y 는 이미 셋이 잡고 있습니다 —
// 층을 뛰어오르는 트윈, 줄을 옮기는 트윈, 도적이 뛰며 도는 회전. 거기에
// 모션까지 얹으면 트윈끼리 서로를 덮어씁니다. 물리 몸은 그대로 두고 안 보이게
// 하고, 겉몸 한 장이 매 프레임 그 자리를 따라갑니다.
// 충돌 상자(26×40)도 사거리도 한 줄 안 바뀝니다.
//
// ── 시트가 없으면 ──────────────────────────────────────
// js/sheetdata.js 가 없거나 그 무기의 시트가 없으면 물리 몸 그림을 그대로
// 보여 줍니다. 모션만 없을 뿐 게임은 그대로 돕니다.

// 화면에서 주인공의 머리끝에서 발까지. 물리 몸은 26×40 이고 그림 상자는
// 38×48 이었습니다 — 그림은 상자보다 조금 커도 됩니다. 부딪히는 것은 상자니까.
const HERO_H = 52;

// 물리 몸 한가운데에서 발바닥까지. 물리 몸 그림이 38×48 이고 발이 그 바닥에
// 닿게 그려져 있었으므로 절반인 24 입니다. 시트의 `ground` 줄을 여기 맞춥니다.
const FEET_DY = 24;

// ── 여덟 컷을 어떤 박자로 넘기는가 ──────────────────────
//
// 여기가 이제 모션의 전부입니다. 컷을 똑같은 간격으로 넘기면 그림이 아무리
// 좋아도 밋밋합니다. 애니메이션에서 오래된 규칙 하나가 있습니다 —
// **컷을 더 그리는 것보다, 예비동작을 늦추고 타격을 빠르게 하는 것이 낫다.**
//
// 값은 그 컷을 **얼마나 오래 붙들고 있는가**입니다. 서로의 비율만 뜻하므로
// 무기가 빨라져 판이 짧아져도 박자는 그대로입니다.
//
// 여덟 컷의 뜻은 시트마다 같습니다 (gen-sheet.js 가 그렇게 시킵니다):
//   0 준비  1 들기  2 끝까지 든 자리  3 **때리는 컷(스미어)**
//   4 지나간 자리  5 실린 몸  6 돌아오는 중  7 자세 잡기
//
// `hit` 은 때리는 컷의 번호입니다. 칼자국·파동·화살을 이 컷이 뜨는 순간에
// 맞춰 내보냅니다 — 몸이 지나가기도 전에 빛이 번지면 거짓말이 됩니다.
const BEATS = {
  // 검 — 크게 들었다가 내리찍습니다. 드는 세 컷이 때리는 두 컷의 두 배쯤
  // 걸립니다. 이 비율이 "묵직하다"의 정체입니다.
  sword:     { hold: [0.85, 0.80, 0.95, 0.42, 0.45, 1.25, 0.95, 1.00], hit: 3 },
  // 창 — 찌르기는 뻗는 순간이 검보다 더 짧고, 되돌리는 데 더 오래 걸립니다.
  spear:     { hold: [0.80, 0.90, 1.10, 0.35, 0.55, 1.10, 0.85, 0.95], hit: 3 },
  // 단검 — 전부 짧습니다. 예비동작까지 짧아야 "빠르다"가 됩니다.
  dagger:    { hold: [0.70, 0.75, 0.85, 0.32, 0.40, 1.00, 0.85, 0.95], hit: 3 },
  // 쌍단검 — 두 번 긋습니다. 되돌아오는 쪽에도 힘이 실려 있어 뒤가 덜 늘어집니다.
  daggerTwin:{ hold: [0.62, 0.68, 0.75, 0.30, 0.35, 0.72, 0.70, 0.85], hit: 3 },
  // 활 — 당기는 동안이 길고 놓는 순간은 없다시피 합니다.
  bow:       { hold: [0.70, 0.85, 1.05, 0.30, 0.50, 1.05, 0.90, 1.00], hit: 3 },
  // 석궁 — 겨누는 동안 멈춰 있다가 반동으로 밀립니다. 밀린 자리를 오래 붙듭니다.
  crossbow:  { hold: [0.75, 0.85, 1.00, 0.28, 0.60, 1.15, 0.90, 1.00], hit: 3 },
};

// 붙드는 값을 **0…1 위의 자리**로 바꿔 둡니다 (누적). 판마다 다시 셀 이유가
// 없으므로 파일을 읽을 때 한 번만 셉니다.
Object.keys(BEATS).forEach((k) => {
  const b = BEATS[k];
  const sum = b.hold.reduce((a, v) => a + v, 0);
  let run = 0;
  b.at = b.hold.map((v) => { const s = run / sum; run += v; return s; });
  b.at.push(1);
  b.lead = b.at[b.hit];        // 때리는 컷이 뜨는 자리
});

// 컷 수가 시트와 다르면(여덟이 아니면) 고르게 나눕니다.
function beatFor(beat, n) {
  if (beat.hold.length === n) return beat;
  const at = [];
  for (let i = 0; i <= n; i++) at.push(i / n);
  return { at, hit: Math.min(beat.hit, n - 1), lead: Math.min(beat.hit, n - 1) / n };
}

class PlayerRig {
  constructor(scene) {
    this.scene = scene;
    this.body = scene.player;
    this.jobKey = scene.job.key;

    this.view = null;      // 겉몸 한 장
    this.data = null;      // 지금 시트의 잰 값 (js/sheetdata.js)
    this.n = 0;
    this.key = null;
    this.frame = 0;
    this.tw = null;
    this.views = [];       // 주인공 그림을 만지는 다른 코드를 위한 목록

    // 첫 무기의 시트를 바로 붙입니다. 없으면 물리 몸 그림이 그대로 보입니다.
    if (scene.weapon) this.setWeapon(scene.job, scene.weapon);
  }

  // 시트로 돌고 있는가. 겉몸이 붙었다는 뜻입니다.
  get cut() { return !!this.view; }

  // 들고 있는 무기가 바뀌면 **시트를 통째로 갈아 끼웁니다.**
  // 예전에는 손에 쥔 그림만 바꾸고 몸은 그대로였습니다. 지금은 무기마다
  // 몸짓까지 다 그려 두었으므로 갈아 끼우는 것이 곧 다른 사람이 되는 것입니다.
  setWeapon(job, weapon) {
    const key = sheetKey(job, weapon);
    if (key === this.key) return;
    const d = typeof SHEET_ART !== 'undefined' && SHEET_ART[key];
    if (!d || !this.scene.textures.exists(key)) return;   // 시트가 없으면 그대로 둡니다

    this.key = key;
    this.data = d;
    this.n = d.n;
    if (!this.view) {
      this.view = this.scene.add.sprite(this.body.x, this.body.y, key, 0)
        .setDepth(this.body.depth);
      this.views = [this.view];
      // 겉몸이 생긴 뒤에야 물리 몸을 감춥니다 — 먼저 감추면 시트가 없는 판에서
      // 주인공이 통째로 사라집니다.
      this.body.setVisible(false);
    }
    this.view.setTexture(key, Math.min(this.frame, this.n - 1));
    // 발을 딛는 자리를 축으로 삼습니다. 축이 발이면 좌우를 뒤집어도 발이
    // 제자리에 남고, 몸이 통째로 돌 때도 발을 중심으로 돕니다.
    this.view.setOrigin(d.foot / d.fw, d.ground / d.fh);
    // 무기마다 휘두르는 폭이 달라서 인물이 몇 %씩 다르게 구워졌습니다.
    // 잰 키로 나눠 주면 서른여섯 자루가 화면에서 같은 키로 섭니다.
    this.scale = HERO_H / d.hero;
  }

  // 매 프레임 물리 몸을 그대로 베낍니다. 알파까지 따라가야 맞을 때 깜빡이는
  // 것이 겉몸에도 보입니다.
  sync() {
    const b = this.body;
    if (!this.view) return;

    // 몸 한가운데에서 발까지. 몸이 통째로 돌면(도적이 뛰며 한 바퀴) 이 벡터도
    // 같이 돌아야 합니다 — 축이 발이라 그림은 발을 중심으로 돌고, 그 발이
    // 몸 한가운데를 돌아서 결국 몸 한가운데를 축으로 도는 것이 됩니다.
    const rot = b.rotation;
    let dx = 0, dy = FEET_DY;
    if (rot) {
      const c = Math.cos(rot), s = Math.sin(rot);
      const nx = dx * c - dy * s;
      dy = dx * s + dy * c;
      dx = nx;
    }
    this.view.setPosition(b.x + dx, b.y + dy);
    this.view.setFlipX(b.flipX);
    this.view.rotation = rot;
    this.view.setScale(this.scale);
    this.view.setAlpha(b.alpha);
    this.view.setDepth(b.depth);
  }

  // 때리는 쪽으로 몸을 돌립니다.
  //
  // 뛰는 도중에는 안 돌립니다 — 그때의 방향은 가는 쪽이 맞고, 공중에서 몸만
  // 홱 돌면 착지가 미끄러져 보입니다.
  face(x) {
    if (this.scene.jumping) return;
    this.body.setFlipX(x < this.body.x);
  }

  // 한 판의 모션을 겁니다. 앞의 것이 아직 돌고 있으면 끊고 새로 시작합니다 —
  // 빠른 무기는 앞 동작이 끝나기 전에 다음 대가 나갑니다.
  play(beat, ms) {
    if (!this.view) return;
    if (this.tw) this.tw.remove();
    const clock = { t: 0 };
    this.tw = this.scene.tweens.add({
      targets: clock, t: 1, duration: ms, ease: 'Linear',
      onUpdate: () => this.frameAt(beat, clock.t),
      onComplete: () => { this.tw = null; this.rest(); },
    });
  }

  // 판의 어느 지점(t)에서 몇 번째 컷인가. 붙드는 시간이 컷마다 다르므로
  // t 를 그냥 컷 수로 나누면 안 됩니다.
  frameAt(beat, t) {
    const b = beatFor(beat, this.n);
    let i = this.n - 1;
    for (let k = 0; k < this.n; k++) { if (t < b.at[k + 1]) { i = k; break; } }
    this.setFrame(i);
  }

  setFrame(i) {
    if (i === this.frame || !this.view) return;
    this.frame = i;
    this.view.setFrame(i);
  }

  // 쉬는 자세는 첫 컷입니다. 마지막 컷(자세 잡기)에서 첫 컷으로 넘어가는 것은
  // 곧 다음 대의 예비동작이라 눈에 안 걸립니다.
  rest() { this.setFrame(0); }
}

// 이 무기의 시트 이름. gen-sheet.js 가 만든 이름과 같아야 합니다.
function sheetKey(job, weapon) {
  return 'w-' + job.key + '-' + weapon.tier;
}

// 지금 든 무기의 박자. 무기표의 `icon.art` 를 그대로 씁니다 —
// 그림이 창이면 박자도 창이어야 하고, 그 둘이 갈리면 어느 쪽이든 거짓말이 됩니다.
function motionFor(job, weapon) {
  const icon = (weapon.base && weapon.base.icon) || {};
  const art = icon.art || (job.attack === 'ranged' ? 'bow' : 'sword');
  if ((art === 'dagger' || art === 'sword') && icon.twin) return BEATS.daggerTwin;
  return BEATS[art] || BEATS.sword;
}

// 한 판의 길이. **다음 대가 나가기 전에 끝나야** 합니다 — 안 그러면 앞 동작이
// 매번 잘려서, 여덟 컷 중 앞의 서넛만 보고 살게 됩니다.
//
// 그래서 아래쪽으로는 안 자릅니다. 공격 속도를 끝까지 올리면 한 대가 85ms 마다
// 나가는데, 거기에 "적어도 90ms"를 박아 두면 그 순간부터 규칙이 깨집니다.
// 빠른 무기의 몸짓이 짧은 것은 흠이 아니라 그 무기의 성격입니다.
function motionMs(rate) {
  return Math.min(rate * 0.85, 320);
}

// 이펙트를 늦출 시간 — **때리는 컷이 뜨는 순간**입니다.
//
// 위로 100ms 를 넘기지 않습니다. 피해는 곧장 들어가므로, 그림이 그보다 더
// 늦으면 맞은 티가 먼저 나고 칼이 나중에 지나갑니다. 조각 시절에는 70ms 였는데,
// 지금은 예비동작이 그림 안에 제대로 들어 있어 때리는 컷이 더 뒤에 옵니다.
// 조금 늦춰 주는 편이 그림과 맞습니다.
function motionLead(beat, ms) {
  return Math.min(beat.lead * ms, 100);
}
