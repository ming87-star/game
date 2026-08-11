// 공격 모션 — 몸을 조각으로 나눠 따로 움직입니다.
//
// ── 왜 다시 만들었는가 ──────────────────────────────────
// 처음에는 그림 한 장을 통째로 기울였다 세웠습니다. 그건 모션이 아닙니다.
// 그렇게 하면 세 가지가 한꺼번에 거짓말을 합니다.
//
//   1. 검이 몸과 **같은 각도로만** 움직입니다. 실제로는 몸이 20도 도는 동안
//      검은 120도를 돕니다. 휘두르는 것은 검이지 몸통이 아닙니다.
//   2. 발까지 같이 미끄러집니다. 사람은 발을 딛고 그 위에서 몸을 던집니다.
//      발이 제자리에 남아야 "밀었다"가 아니라 "실었다"가 됩니다.
//   3. 망토가 몸에 붙어 한 덩어리로 움직입니다. 천은 늘 몸보다 **늦게**
//      따라오고, 몸이 멈춘 뒤에 한 번 더 흔들립니다.
//
// 그래서 주인공 그림을 네 조각으로 잘랐습니다 (art/p-*.svg — 원본에서 칠도
// 좌표도 안 바꾸고 떼어 온 것입니다). 조각마다 축이 있고, 조각마다 다른
// 가락으로 움직입니다.
//
//   망토(cape)  등 뒤. 몸을 늦게 따라옵니다
//   다리(legs)  골반이 축. 거의 안 움직입니다 — 딛는 것이 일입니다
//   몸통(body)  허리가 축. 사람은 벨 때 허리부터 돕니다
//   팔(arm)     어깨가 축. **여기가 모션의 전부입니다**
//
// ── 왜 몸을 직접 안 움직이는가 ──────────────────────────
// `scene.player` 는 물리 몸입니다. 그 x·y 는 이미 셋이 잡고 있습니다 —
// 층을 뛰어오르는 트윈, 줄을 옮기는 트윈, 도적이 뛰며 도는 회전. 거기에
// 모션까지 얹으면 트윈끼리 서로를 덮어써서, 뛰는 도중에 때리면 주인공이
// 발판 밖으로 미끄러집니다. 물리 몸은 그대로 두고 안 보이게 하고,
// 조각들이 매 프레임 그 자리를 따라갑니다. 충돌·사거리·이동은 안 바뀝니다.
//
// ── 조각이 없으면 ──────────────────────────────────────
// 그림 조각이 하나라도 없으면 예전처럼 **한 장짜리 그림**으로 돌아가서,
// 몸 전체를 기울이는 것까지만 합니다. 조용히 덜 움직일 뿐 게임은 그대로 돕니다.

// 조각의 축과 **매달린 곳**. 좌표는 원본 그림 그대로입니다 (왼쪽 위가 0,0).
// z 는 앞뒤 — 망토가 가장 뒤, 무기 쥔 팔이 가장 앞입니다.
//
// `on: 'body'` 는 그 조각이 **몸통에 매달려 있다**는 뜻입니다. 어깨와 목덜미는
// 허리가 돌면 같이 따라 돕니다. 이걸 안 하고 조각마다 제자리에서 따로 돌렸더니
// 허리를 젖히는 순간 **망토와 팔만 그 자리에 남아** 몸에서 떨어져 나갔습니다.
//
// 다리는 몸통에 안 매답니다. 발은 땅에 붙어 있고, 허리가 젖혀져도 따라 젖혀지면
// 안 됩니다 — 다리가 몸통을 받치는 것이지 매달린 것이 아닙니다.
const RIGS = {
  warrior: {
    body: [19, 32],
    parts: [
      { key: 'cape', art: 'p-warrior-cape', pivot: [14, 18], z: -2, on: 'body' },
      { key: 'legs', art: 'p-warrior-legs', pivot: [19, 33], z: -1 },
      { key: 'body', art: 'p-warrior-body', pivot: [19, 32], z: 0 },
      { key: 'arm', art: 'p-warrior-arm', pivot: [22.5, 26.5], z: 1, on: 'body' },
    ],
  },
  rogue: {
    body: [23, 32],
    parts: [
      { key: 'cape', art: 'p-rogue-cape', pivot: [22, 19], z: -2, on: 'body' },
      { key: 'legs', art: 'p-rogue-legs', pivot: [20, 33], z: -1 },
      { key: 'body', art: 'p-rogue-body', pivot: [23, 32], z: 0 },
      { key: 'arm', art: 'p-rogue-arm', pivot: [29.6, 25.6], z: 1, on: 'body' },
    ],
  },
  archer: {
    body: [23, 31],
    parts: [
      { key: 'cape', art: 'p-archer-back', pivot: [20, 22], z: -2, on: 'body' },
      { key: 'legs', art: 'p-archer-legs', pivot: [24, 31], z: -1 },
      { key: 'body', art: 'p-archer-body', pivot: [23, 31], z: 0 },
      { key: 'arm', art: 'p-archer-arm', pivot: [29.4, 21], z: 1, on: 'body' },
    ],
  },
};

const PART_KEYS = ['cape', 'legs', 'body', 'arm'];

class PlayerRig {
  constructor(scene) {
    this.scene = scene;
    this.body = scene.player;
    this.jobKey = scene.job.key;

    const spec = RIGS[this.jobKey];
    const whole = this.body.texture.key;
    this.parts = [];
    this.pose = {};

    // 조각이 다 있을 때만 나눠 씁니다. 하나라도 없으면 한 장짜리로 갑니다.
    const cut = spec && spec.parts.every((p) => scene.textures.exists(p.art));
    if (cut) {
      const src = scene.textures.get(whole).getSourceImage();
      this.half = { x: src.width / 2, y: src.height / 2 };
      // 몸통의 축이 그림 한가운데에서 얼마나 떨어져 있는지. 매달린 조각들은
      // 이 점을 중심으로 같이 돕니다.
      this.hip = { x: spec.body[0] - this.half.x, y: spec.body[1] - this.half.y };
      spec.parts.forEach((p) => {
        const img = scene.textures.get(p.art).getSourceImage();
        const view = scene.add.sprite(this.body.x, this.body.y, p.art)
          .setOrigin(p.pivot[0] / img.width, p.pivot[1] / img.height)
          .setDepth(this.body.depth + p.z * 0.01);
        // 축이 그림 한가운데에서 얼마나 떨어져 있는지. 조각을 이만큼 옮겨 놓아야
        // 네 조각이 원래 한 장이던 자리에 그대로 겹칩니다.
        this.parts.push({
          key: p.key, view, on: p.on || null,
          ox: p.pivot[0] - this.half.x, oy: p.pivot[1] - this.half.y,
        });
        this.pose[p.key] = { dx: 0, dy: 0, rot: 0 };
      });
      this.body.setVisible(false);
    } else {
      // 한 장짜리. 물리 몸을 그대로 보여 주고 뿌리 자세만 얹습니다.
      this.parts = [];
      this.half = { x: 0, y: 0 };
    }

    this.cut = cut;
    this.root = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    this.tw = null;
    // 겉모습이 바뀌는 곳은 여기 하나뿐입니다. 다른 코드가 주인공 그림을
    // 만질 일이 있으면 이 목록을 봐야 합니다.
    this.views = this.parts.map((p) => p.view);
  }

  // 매 프레임 물리 몸을 그대로 베끼고 모션만 더합니다.
  // 알파까지 따라가야 맞을 때 깜빡이는 것이 겉몸에도 보입니다.
  sync() {
    const b = this.body;
    const r = this.root;
    const s = b.flipX ? -1 : 1;

    if (!this.cut) {
      // 한 장짜리 — 물리 몸 자체에 얹을 수는 없으므로 아무것도 안 합니다.
      // (조각이 없는 판에서는 모션 없이 이펙트만 나갑니다)
      return;
    }

    const cx = b.x + r.dx * s;
    const cy = b.y + r.dy;
    const spin = this.pose.body ? this.pose.body.rot : 0;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);

    this.parts.forEach((p) => {
      const q = this.pose[p.key];
      let ox = p.ox + q.dx;
      let oy = p.oy + q.dy;
      let rot = r.rot + q.rot;

      // 몸통에 매달린 조각은 **허리가 도는 만큼 같이 실려 갑니다.**
      // 축의 자리를 허리 둘레로 돌려 놓고, 각도에도 허리의 몫을 더합니다.
      if (p.on === 'body') {
        const rx = ox - this.hip.x;
        const ry = oy - this.hip.y;
        ox = this.hip.x + rx * cos - ry * sin;
        oy = this.hip.y + rx * sin + ry * cos;
        rot += spin;
        // 몸통 자신이 dx·dy 로 움직였으면 매달린 것도 그만큼 따라갑니다.
        ox += this.pose.body.dx;
        oy += this.pose.body.dy;
      }

      // 좌우를 뒤집으면 앞쪽도 각도도 같이 뒤집힙니다.
      p.view.setPosition(cx + ox * s, cy + oy);
      p.view.setFlipX(b.flipX);
      p.view.rotation = b.rotation + rot * s;
      p.view.setScale(r.sx, r.sy);
      p.view.setAlpha(b.alpha);
    });
  }

  // 때리는 쪽으로 몸을 돌립니다.
  //
  // 예전에는 뒤를 보고도 앞쪽 적을 벴습니다. 좌우 뒤집기가 **가는 쪽**으로만
  // 정해졌기 때문입니다. 뛰는 도중에는 안 돌립니다 — 그때의 방향은 가는 쪽이
  // 맞고, 공중에서 몸만 홱 돌면 착지가 미끄러져 보입니다.
  face(x) {
    if (this.scene.jumping) return;
    this.body.setFlipX(x < this.body.x);
  }

  // 한 판의 모션을 겁니다. 앞의 것이 아직 돌고 있으면 끊고 새로 시작합니다 —
  // 빠른 무기는 앞 동작이 끝나기 전에 다음 대가 나갑니다.
  play(motion, ms) {
    if (this.tw) this.tw.remove();
    const clock = { t: 0 };
    this.tw = this.scene.tweens.add({
      targets: clock, t: 1, duration: ms, ease: 'Linear',
      onUpdate: () => this.applyAt(motion, clock.t),
      onComplete: () => { this.tw = null; this.rest(); },
    });
  }

  rest() {
    this.root.dx = 0; this.root.dy = 0; this.root.rot = 0;
    this.root.sx = 1; this.root.sy = 1;
    PART_KEYS.forEach((k) => {
      const q = this.pose[k];
      if (q) { q.dx = 0; q.dy = 0; q.rot = 0; }
    });
  }

  // 한 판의 어느 지점(t)에서 각 조각이 어떤 자세인지.
  applyAt(motion, t) {
    trackInto(motion.root, t, this.root);
    PART_KEYS.forEach((k) => {
      if (this.pose[k]) trackInto(motion[k], t, this.pose[k]);
    });
  }
}

// 마디와 마디 사이를 잇습니다. 가속을 **도착하는 마디**가 정합니다 —
// 칼을 드는 마디는 부드럽게 서고(out/in), 내리치는 마디는 앞이 급해야(snap) 합니다.
function trackInto(keys, t, out) {
  if (!keys || !keys.length) {
    out.dx = 0; out.dy = 0; out.rot = 0;
    if (out.sx !== undefined) { out.sx = 1; out.sy = 1; }
    return;
  }
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].at) { a = keys[i - 1]; b = keys[i]; break; }
  }
  const span = b.at - a.at;
  const k = span <= 0 ? 1 : EASE[b.ease || 'linear']((t - a.at) / span);
  const pick = (key, name, dflt) => (key[name] === undefined ? dflt : key[name]);
  out.dx = lerp(pick(a, 'dx', 0), pick(b, 'dx', 0), k);
  out.dy = lerp(pick(a, 'dy', 0), pick(b, 'dy', 0), k);
  out.rot = lerp(pick(a, 'rot', 0), pick(b, 'rot', 0), k);
  if (out.sx !== undefined) {
    out.sx = lerp(pick(a, 'sx', 1), pick(b, 'sx', 1), k);
    out.sy = lerp(pick(a, 'sy', 1), pick(b, 'sy', 1), k);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// 가속 곡선을 직접 씁니다. 이름 넷이면 충분하고, 엔진이 바뀌어도 그대로 돕니다.
const EASE = {
  linear: (t) => t,
  in: (t) => t * t,                       // 서서히 실린다 — 힘을 모으는 마디
  out: (t) => 1 - (1 - t) * (1 - t),      // 부드럽게 선다 — 자세를 잡는 마디
  snap: (t) => 1 - Math.pow(1 - t, 4),    // 앞이 급하다 — 때리는 마디
};

// ── 무기마다 다른 몸짓 ──────────────────────────────────
//
// 자리는 전부 **한 판을 1로 놓은 비율**입니다. 무기가 빨라지면 판이 통째로
// 짧아지므로, 마디의 비율은 그대로 두고 길이만 줄어듭니다.
//
// `windup` 은 때리는 마디가 시작되는 자리입니다. 칼자국·파동·화살을 이만큼
// 늦춰서 내보내야 **몸이 지나간 그 자리에** 이펙트가 뜹니다. 늦추는 것은
// 그림뿐이고 피해는 그대로 곧장 들어갑니다.
//
// 조각마다 가락이 다릅니다. 셋을 지켰습니다:
//   · 팔은 몸통보다 **크게** 돕니다 (검은 대여섯 배)
//   · 다리는 거의 안 움직입니다. 딛는 것이 다리의 일입니다
//   · 망토는 몸보다 **늦게** 도착하고, 몸이 선 뒤에 한 번 더 흔들립니다
const MOTIONS = {
  // 검 — 어깨 뒤로 크게 들었다가 내리찍습니다.
  // 팔이 1.9rad(약 110도)을 도는 동안 몸통은 0.30rad(약 17도)만 돕니다.
  sword: {
    windup: 0.26,
    root: [
      { at: 0 },
      { at: 0.26, dx: -3, dy: -1, ease: 'in' },
      { at: 0.48, dx: 8, dy: 2, ease: 'snap' },
      { at: 0.70, dx: 3, dy: 0, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    body: [
      { at: 0 },
      { at: 0.26, rot: -0.24, dy: -1, ease: 'in' },     // 허리를 뒤로 젖힌다
      { at: 0.48, rot: 0.30, dy: 1, ease: 'snap' },     // 허리부터 돌아 나온다
      { at: 1, ease: 'out' },
    ],
    arm: [
      { at: 0 },
      { at: 0.26, rot: -0.98, dx: -1, dy: -2, ease: 'in' },  // 어깨 뒤로 든다
      { at: 0.48, rot: 0.74, dx: 2, dy: 1, ease: 'snap' },   // 내리찍는다 — 수평에서 선다
      { at: 0.66, rot: 0.56, ease: 'out' },                  // 무게에 끌려 조금 더
      { at: 1, ease: 'out' },
    ],
    legs: [
      { at: 0 },
      { at: 0.26, dx: -1, ease: 'in' },
      { at: 0.48, dx: 3, rot: 0.06, ease: 'snap' },     // 앞발로 버틴다
      { at: 1, ease: 'out' },
    ],
    cape: [
      { at: 0 },
      { at: 0.30, rot: 0.16, dx: 2, ease: 'out' },      // 몸이 뒤로 가니 천은 앞으로
      { at: 0.60, rot: -0.30, dx: -3, ease: 'out' },    // 몸이 나가니 천은 뒤로 — 늦게
      { at: 0.82, rot: 0.10, dx: 1, ease: 'out' },      // 되돌아오며 한 번 더
      { at: 1, ease: 'out' },
    ],
  },

  // 창 — **돌리지 않습니다.** 어깨가 앞뒤로 밀립니다.
  // 검과 갈리는 것은 이 한 가지입니다. 창을 휘두르면 창이 아니라 몽둥이입니다.
  spear: {
    windup: 0.30,
    root: [
      { at: 0 },
      { at: 0.30, dx: -7, sx: 0.94, ease: 'in' },
      { at: 0.42, dx: 16, sx: 1.06, ease: 'snap' },
      { at: 0.66, dx: 6, sx: 1, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    body: [
      { at: 0 },
      { at: 0.30, rot: -0.10, dx: -2, ease: 'in' },     // 몸을 뒤로 뺀다
      { at: 0.42, rot: 0.14, dx: 3, ease: 'snap' },     // 앞으로 민다 — 검의 절반도 안 돈다
      { at: 1, ease: 'out' },
    ],
    arm: [
      { at: 0 },
      { at: 0.30, dx: -5, dy: 3, rot: 0.18, ease: 'in' },  // 자루를 허리께로 당긴다
      { at: 0.42, dx: 15, dy: 1, rot: 0.22, ease: 'snap' }, // 곧게 내지른다 — 각도가 거의 안 변한다
      { at: 0.62, dx: 5, dy: 1, rot: 0.14, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    legs: [
      { at: 0 },
      { at: 0.30, dx: -2, ease: 'in' },
      { at: 0.42, dx: 5, ease: 'snap' },                // 앞발이 한 걸음 나간다
      { at: 0.70, dx: 2, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    cape: [
      { at: 0 },
      { at: 0.34, rot: 0.12, dx: 2, ease: 'out' },
      { at: 0.58, rot: -0.26, dx: -4, ease: 'out' },
      { at: 0.80, rot: 0.08, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
  },

  // 단검 — 짧고 빠릅니다. 몸을 낮추고 어깨를 찔러 넣습니다.
  dagger: {
    windup: 0.18,
    root: [
      { at: 0 },
      { at: 0.18, dx: -3, dy: 2, ease: 'in' },          // 몸을 낮춘다
      { at: 0.34, dx: 10, dy: 1, ease: 'snap' },
      { at: 0.60, dx: 3, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    body: [
      { at: 0 },
      { at: 0.18, rot: -0.14, dy: 1, ease: 'in' },
      { at: 0.34, rot: 0.26, dy: -1, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
    arm: [
      { at: 0 },
      { at: 0.18, dx: -5, rot: -0.34, ease: 'in' },     // 팔을 접어 당긴다
      { at: 0.34, dx: 9, rot: 0.46, ease: 'snap' },     // 찔러 넣는다
      { at: 0.56, dx: 2, rot: 0.16, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    legs: [
      { at: 0 },
      { at: 0.34, dx: 3, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
    cape: [
      { at: 0 },
      { at: 0.24, rot: 0.14, ease: 'out' },
      { at: 0.52, rot: -0.34, dx: -4, ease: 'out' },
      { at: 0.78, rot: 0.12, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
  },

  // 쌍단검 — 같은 동작을 **두 번** 합니다. 한 대인데 두 번 번쩍이는 것이
  // 두 자루를 든 이유입니다. 둘째가 첫째보다 얕아야 되돌아오는 흐름이 보입니다.
  daggerTwin: {
    windup: 0.14,
    root: [
      { at: 0 },
      { at: 0.14, dx: -3, dy: 2, ease: 'in' },
      { at: 0.28, dx: 10, dy: 1, ease: 'snap' },
      { at: 0.44, dx: 1, dy: 2, ease: 'out' },
      { at: 0.58, dx: 8, dy: 1, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
    body: [
      { at: 0 },
      { at: 0.14, rot: -0.12, ease: 'in' },
      { at: 0.28, rot: 0.24, ease: 'snap' },
      { at: 0.44, rot: -0.10, ease: 'out' },
      { at: 0.58, rot: 0.20, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
    arm: [
      { at: 0 },
      { at: 0.14, dx: -5, rot: -0.32, ease: 'in' },
      { at: 0.28, dx: 9, rot: 0.44, ease: 'snap' },     // 첫 칼
      { at: 0.44, dx: -4, rot: -0.28, ease: 'out' },    // 되당긴다
      { at: 0.58, dx: 7, rot: 0.38, ease: 'snap' },     // 둘째 칼
      { at: 0.76, dx: 2, rot: 0.12, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    legs: [
      { at: 0 },
      { at: 0.28, dx: 3, ease: 'snap' },
      { at: 0.58, dx: 2, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
    cape: [
      { at: 0 },
      { at: 0.22, rot: 0.14, ease: 'out' },
      { at: 0.48, rot: -0.32, dx: -4, ease: 'out' },
      { at: 0.72, rot: -0.16, dx: -2, ease: 'out' },
      { at: 0.88, rot: 0.10, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
  },

  // 활 — 당기는 마디가 가장 깁니다. 활 든 팔은 앞으로 뻗어 **버티고**,
  // 몸이 뒤로 눕습니다. 활에서 힘이 실리는 곳은 놓을 때가 아니라 당길 때입니다.
  bow: {
    windup: 0.42,
    root: [
      { at: 0 },
      { at: 0.42, dx: -6, dy: -1, ease: 'in' },
      { at: 0.54, dx: 4, dy: 1, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
    body: [
      { at: 0 },
      { at: 0.42, rot: -0.22, dx: -2, ease: 'in' },     // 뒤로 눕는다
      { at: 0.54, rot: 0.10, dx: 2, ease: 'snap' },     // 놓는 순간 앞으로 선다
      { at: 0.72, rot: -0.04, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    arm: [
      { at: 0 },
      // 몸통에 매달려 있으므로 허리가 젖혀지면 활도 같이 눕습니다. 활은 표적을
      // 향해 **버텨야** 하므로 허리가 젖힌 만큼(-0.22)을 여기서 되돌립니다.
      { at: 0.42, dx: 5, rot: 0.24, ease: 'in' },       // 활 든 팔은 앞으로 뻗어 버틴다
      { at: 0.50, dx: 6, rot: 0.22, ease: 'out' },
      { at: 0.58, dx: 1, rot: -0.14, ease: 'snap' },    // 놓는 순간 활이 앞으로 튕긴다
      { at: 0.74, dx: 2, rot: 0.04, ease: 'out' },      // 한 번 떤다
      { at: 1, ease: 'out' },
    ],
    legs: [
      { at: 0 },
      { at: 0.42, dx: -2, ease: 'in' },
      { at: 0.58, dx: 1, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    cape: [
      { at: 0 },
      { at: 0.46, rot: 0.10, dx: 2, ease: 'out' },
      { at: 0.68, rot: -0.14, dx: -2, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
  },

  // 석궁 — **당기는 마디가 없습니다.** 이미 걸려 있는 것을 놓을 뿐이라
  // 몸이 앞으로 나가지 않고 반동으로 **뒤로 밀립니다.** 그리고 천천히 되감습니다.
  // 활과 석궁이 같은 몸짓이면 둘을 나눠 놓은 뜻이 없습니다.
  crossbow: {
    windup: 0,
    root: [
      { at: 0 },
      { at: 0.14, dx: -11, dy: -2, ease: 'snap' },      // 반동
      { at: 0.36, dx: -4, dy: 0, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    body: [
      { at: 0 },
      { at: 0.14, rot: -0.20, ease: 'snap' },
      { at: 0.40, rot: -0.06, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    arm: [
      { at: 0 },
      { at: 0.12, dx: -6, rot: -0.26, ease: 'snap' },   // 팔이 통째로 튀어 오른다
      { at: 0.40, dx: -2, rot: -0.06, ease: 'out' },
      { at: 0.72, dx: -3, rot: 0.08, ease: 'in' },      // 되감는다 — 느리게 아래로
      { at: 1, ease: 'out' },
    ],
    legs: [
      { at: 0 },
      { at: 0.14, dx: -3, ease: 'snap' },               // 반동을 발로 받는다
      { at: 0.44, dx: -1, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
    cape: [
      { at: 0 },
      { at: 0.20, rot: 0.20, dx: 3, ease: 'out' },      // 몸이 뒤로 밀리니 천은 앞으로
      { at: 0.50, rot: -0.08, ease: 'out' },
      { at: 1, ease: 'out' },
    ],
  },
};

// 지금 든 무기의 몸짓. 무기표의 `icon.art` 를 그대로 씁니다 —
// 그림이 창이면 몸짓도 창이어야 하고, 그 둘이 갈리면 어느 쪽이든 거짓말이 됩니다.
function motionFor(job, weapon) {
  const icon = (weapon.base && weapon.base.icon) || {};
  const art = icon.art || (job.attack === 'ranged' ? 'bow' : 'sword');
  if ((art === 'dagger' || art === 'sword') && icon.twin) return MOTIONS.daggerTwin;
  return MOTIONS[art] || MOTIONS.sword;
}

// 한 판의 길이. **다음 대가 나가기 전에 끝나야** 합니다 — 안 그러면 앞 동작이
// 매번 잘려서, 몸이 돌아오는 마디를 한 번도 못 보게 됩니다.
//
// 그래서 아래쪽으로는 안 자릅니다. 공격 속도를 끝까지 올리면 한 대가 85ms 마다
// 나가는데, 거기에 "적어도 90ms"를 박아 두면 그 순간부터 규칙이 깨집니다.
// 빠른 무기의 몸짓이 짧은 것은 흠이 아니라 그 무기의 성격입니다.
function motionMs(rate) {
  return Math.min(rate * 0.85, 320);
}

// 이펙트를 늦출 시간. 아무리 느린 무기라도 **70ms 를 넘기지 않습니다** —
// 피해는 곧장 들어가므로, 그림이 그보다 더 늦으면 맞은 티가 먼저 나고
// 칼이 나중에 지나갑니다.
function motionLead(motion, ms) {
  return Math.min(motion.windup * ms, 70);
}
