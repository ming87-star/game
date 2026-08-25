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

  // ── 지금 컷에서 머리가 어디인가 ────────────────────────
  //
  // 갈라진 가면(js/trophies.js)이 얼굴에 씌워지려면 이것이 있어야 합니다.
  // 예전에는 물리 몸 한가운데에서 16px 위에 그냥 놓았는데, **겉몸은 발을
  // 축으로 그려지고 자세마다 머리가 딴 데 가 있습니다** — 도적은 앞으로
  // 크게 숙이고 전사는 뒤로 젖힙니다. 그래서 가면이 얼굴이 아니라 가슴을
  // 덮었습니다.
  //
  // 화면 자리로 돌려 줍니다: { x, y, w }. 시트가 없으면 null 입니다.
  headPoint() {
    if (!this.view || !this.data) return null;
    const h = headAnchors(this.scene, this.key, this.data);
    if (!h) return null;
    const a = h[Math.min(this.frame, h.length - 1)];
    if (!a) return null;

    const d = this.data;
    const k = this.scale;
    // 컷 안의 자리를 겉몸 기준으로. 겉몸의 축은 발(foot, ground)입니다.
    let dx = (a.x - d.foot) * k;
    const dy = (a.y - d.ground) * k;
    if (this.view.flipX) dx = -dx;
    // 몸이 통째로 돌면(도적이 뛰며 한 바퀴) 이 벡터도 같이 돕니다.
    const rot = this.view.rotation;
    let ox = dx, oy = dy;
    if (rot) {
      const c = Math.cos(rot), s = Math.sin(rot);
      ox = dx * c - dy * s;
      oy = dx * s + dy * c;
    }
    return { x: this.view.x + ox, y: this.view.y + oy, w: a.w * k };
  }
}

// ── 시트에서 머리 자리를 찾아 둡니다 ──────────────────────
//
// 시트에는 발 자리(foot·ground)와 키(hero)만 적혀 있고 머리 자리는 없습니다.
// 그림에서 직접 찾습니다 — **컷마다 위쪽 30% 를 훑어 가장 넓은 가로 토막**을
// 고릅니다. 머리는 넓고(14px 쯤) 무기는 가늘어서(칼날 3~5px), 머리 높이에서
// 가장 넓은 덩어리는 거의 언제나 머리입니다. 자루가 서른여섯이라 하나하나
// 손으로 적어 둘 수는 없습니다.
//
// 시트 한 장을 캔버스에 한 번 올려 픽셀을 통째로 읽습니다. 한 자루당 한 번이고
// 그 뒤로는 적어 둔 것을 씁니다 — 매 프레임 하는 일이 아닙니다.
const HEAD_CACHE = {};

function headAnchors(scene, key, d) {
  if (HEAD_CACHE[key] !== undefined) return HEAD_CACHE[key];
  HEAD_CACHE[key] = null;
  try {
    const src = scene.textures.get(key).getSourceImage();
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;

    // 머리끝에서 어깨가 시작될 즈음까지 훑습니다.
    const top = Math.max(0, Math.round(d.ground - d.hero));
    const bottom = Math.min(cv.height - 1, Math.round(d.ground - d.hero * 0.55));
    // 이보다 넓어지면 더는 머리가 아닙니다 (어깨·망토·크게 휘두른 무기).
    const capW = d.hero * 0.42;
    // 덩어리 한가운데가 위아래로 내려가며 이보다 많이 흐르면 머리가 아닙니다.
    // **머리는 제자리에 있고 휘두른 무기는 비스듬히 흘러갑니다** — 전사의
    // 칼이 딱 그렇습니다(x15 에서 x42 로). 넓이만 보면 칼과 머리가 거의
    // 같아서(420 대 418) 동전 던지기가 됩니다.
    const drift = d.hero * 0.15;

    const cands = [];
    for (let i = 0; i < d.n; i++) {
      const x0 = i * d.fw;

      // ── 덩어리로 묶습니다 ─────────────────────────────
      // 「가장 넓은 토막」으로 고르면 안 됩니다. 도적은 머리 높이에 덩어리가
      // 둘인데(왼쪽 망토·오른쪽 후드) 망토 쪽이 더 넓어서, 가면이 등에
      // 붙었습니다. 위에서 아래로 내려가며 겹치는 토막끼리 이어 붙이고,
      // 넓어지다 문턱을 넘으면 거기서 그 덩어리를 닫습니다 — 망토는 계속
      // 넓어지므로 일찍 닫히고, 머리는 제 너비에서 멎습니다.
      let open = [];
      const done = [];
      for (let y = top; y <= bottom; y++) {
        const runs = [];
        let run = 0;
        for (let x = 0; x <= d.fw; x++) {
          // **불투명한 것만 셉니다.** 칼이 지나간 잔상(스미어)은 반투명하게
          // 그려져 있는데, 문턱이 낮으면 그 넓은 호가 머리보다 큰 덩어리로
          // 잡혀서 가면이 잔상에 붙었습니다 (장창의 한 컷이 그랬습니다).
          const on = x < d.fw && px[((y * cv.width) + x0 + x) * 4 + 3] > 160;
          if (on) { run++; continue; }
          if (run > 2) runs.push({ a: x - run, b: x, w: run });
          run = 0;
        }
        const next = [];
        runs.forEach((r) => {
          if (r.w > capW) return;                       // 이미 머리보다 넓습니다
          // 바로 윗줄에서 가로로 겹치는 덩어리에 이어 붙입니다.
          const mid = (r.a + r.b) / 2;
          const up = open.find((c) => r.a < c.b && r.b > c.a);
          if (up) {
            up.a = r.a; up.b = r.b;
            // **가장 넓은 줄을 자리로 삼습니다** — x 는 이 줄에서, y 도 이
            // 줄에서. 예전에는 x 는 가장 넓은 줄에서 가져오고 y 는 위아래
            // 한가운데를 썼는데, 그 둘이 다른 줄이라 초승달처럼 휜 덩어리에서
            // 는 **빈 자리**를 가리켰습니다 (검사가 세 컷을 잡아냈습니다).
            if (r.w > up.w) { up.w = r.w; up.cx = mid; up.cy = y; }
            up.area += r.w;
            up.lo = Math.min(up.lo, mid);
            up.hi = Math.max(up.hi, mid);
            up.y2 = y;
            next.push(up);
          } else {
            next.push({ a: r.a, b: r.b, w: r.w, cx: mid, cy: y, area: r.w,
              lo: mid, hi: mid, y1: y, y2: y });
          }
        });
        open.filter((c) => !next.includes(c)).forEach((c) => done.push(c));
        open = next;
      }
      open.forEach((c) => done.push(c));

      // 머리다울 만한 것들 — 옆으로 안 흐르는, 납작하지 않은 덩어리.
      cands.push(done
        .filter((c) => c.y2 - c.y1 + 1 >= d.hero * 0.10 && c.hi - c.lo <= drift)
        .sort((a, b) => b.area - a.area));
    }

    // ── 컷끼리 견줍니다 ───────────────────────────────────
    // 머리는 컷이 넘어가도 크게 안 움직입니다. 한 컷만 딴 데로 튀면 그건
    // 머리가 아니라 그 컷에서 유난히 커진 무기입니다 — 여덟 컷의 가운뎃값을
    // 잡고, 거기서 너무 먼 것은 다음 후보로 물립니다.
    const firsts = cands.map((c) => (c[0] ? c[0].cx : d.foot)).slice().sort((a, b) => a - b);
    const mid = firsts[Math.floor(firsts.length / 2)];
    // 가운뎃값에서 먼 것은 **아예 못 찾은 것으로 칩니다.** 억지로 그 컷의
    // 1등을 쓰면 가면이 그 컷에서만 칼로 옮겨 갑니다 (전사의 한 컷이 그랬습니다).
    // 못 찾은 자리는 바로 아래에서 이웃 컷을 빌려 메웁니다.
    const picked = cands.map((list) => list.find((c) => Math.abs(c.cx - mid) <= d.hero * 0.30)
      || null);

    // 아무것도 못 찾은 컷은 **이웃 컷에서 빌려 옵니다.** 크게 든 컷이나 스미어
    // 컷에서는 머리가 팔에 묻혀 덩어리가 안 잡힐 때가 있는데, 그때 정해진
    // 자리로 떨어뜨리면 가면이 허공에 뜹니다 — 실제로 전사의 두 컷이 그랬습니다.
    for (let i = 0; i < picked.length; i++) {
      if (picked[i]) continue;
      let near = null;
      for (let k = 1; k < picked.length && !near; k++) {
        near = picked[i - k] || picked[i + k] || null;
      }
      picked[i] = near;
    }

    // 너비는 컷마다 들쭉날쭉합니다 — 팔이 머리에 붙는 컷에서는 머리가 실제보다
    // 훨씬 넓게 잡힙니다. **쉬는 자세(첫 컷)의 너비**를 씁니다. 거기가 머리가
    // 가장 깨끗하게 드러나는 자리이고, 하나로 정해 두면 휘두르는 동안 가면
    // 크기가 출렁이지도 않습니다.
    const ws = picked.filter(Boolean).map((c) => c.w).sort((a, b) => a - b);
    const w = (picked[0] && picked[0].w)
      || (ws.length ? ws[Math.floor(ws.length / 2)] : d.hero * 0.28);

    const out = picked.map((c) => (c
      ? { x: c.cx, y: c.cy, w }
      : { x: d.foot, y: d.ground - d.hero * 0.85, w }));
    HEAD_CACHE[key] = out;
  } catch (e) {
    // 픽셀을 못 읽는 판에서는 가면이 옛 자리로 갑니다 (아래 trophies.js).
    HEAD_CACHE[key] = null;
  }
  return HEAD_CACHE[key];
}

// 이 무기의 시트 이름.
//
// **`sheet-` 를 반드시 붙입니다.** 이걸 뺐다가 한 번 크게 당했습니다 —
// js/textures.js 의 weaponIconKey(job, tier) 가 'w-warrior-0' 을 내놓는데,
// 시트를 같은 이름으로 올리니 buildWeaponIcons 가 "이미 있다"며 건너뛰었고,
// 발판 위 UP 칸과 HUD 의 무기 그림 자리에 **주인공이 통째로 30×30 으로
// 찌그러져** 들어앉았습니다. 텍스처 이름은 게임 전체가 함께 쓰는 이름표입니다.
//
// 자루 번호(base.sheet)를 씁니다. 주머니에는 만듦새까지 해서 스물넷이 있지만
// 시트는 손으로 그린 열두 장뿐입니다 — **만듦새가 달라도 실루엣은 같은
// 자루**이므로 원본의 시트를 그대로 빌립니다. 무쇠 장검과 장검은 색만 다릅니다.
// ── 곰의 시트 ───────────────────────────────────────────
// 곰은 무기를 안 듭니다. 그래서 자루마다 한 장인 주인공 시트와 달리
// **한 장뿐**이고, 격자만 같습니다 (4×2 = 여덟 컷).
//
//   윗줄 0~3   걷기. 앞서 가는 동안 돕니다
//   아랫줄 4~7 무는 것. 한 번 물 때마다 한 바퀴 돌고 걷기로 돌아옵니다
//
// `assets/sheets/ally-bear/0..7.png` 를 넣고 `node bake-sheets.js` 를 돌리면
// 저절로 구워집니다 — 그쪽은 폴더 이름만 보고 훑습니다.
//
// 없으면 null 을 돌려줍니다. 그때는 그림 한 장으로 물러섭니다.
function bearSheet(scene) {
  const key = 'sheet-ally-bear';
  if (typeof SHEET_ART === 'undefined' || !SHEET_ART[key]) return null;
  if (!scene.textures.exists(key)) return null;
  const n = SHEET_ART[key].n || 8;
  // 여덟 컷이 아니면 반으로 갈라 씁니다. 넷이면 걷기 둘 · 무는 것 둘입니다.
  const half = Math.max(1, Math.floor(n / 2));
  const walk = [];
  const bite = [];
  for (let i = 0; i < half; i++) walk.push(i);
  for (let i = half; i < n; i++) bite.push(i);
  return { key, n, walk, bite: bite.length ? bite : walk };
}

function sheetKey(job, weapon) {
  const n = weapon.base && weapon.base.sheet !== undefined ? weapon.base.sheet : 0;
  return 'sheet-w-' + job.key + '-' + n;
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
