// 공격 모션 — 이펙트만으로는 **때린 것**으로 안 보입니다.
//
// 지금까지는 칼자국과 화살만 있고 몸은 가만히 서 있었습니다. 그러면 무기가
// 사람에게서 나온 것이 아니라 **사람 옆에서 저절로 생긴 것**처럼 보입니다.
// 한 대의 무게는 이펙트의 크기가 아니라 몸이 얼마나 실렸는가에서 옵니다.
//
// ── 왜 몸을 직접 안 움직이는가 ──────────────────────────
// `scene.player` 는 물리 몸입니다. 그 x·y 는 이미 세 곳이 잡고 있습니다 —
// 층을 뛰어오르는 트윈, 투기장에서 줄을 옮기는 트윈, 그리고 도적이 뛰며
// 한 바퀴 도는 회전. 여기에 공격 모션까지 같은 값을 만지면 트윈끼리 서로를
// 덮어써서, 뛰는 도중에 때리면 주인공이 발판 밖으로 미끄러집니다.
//
// 그래서 **보이는 몸을 따로 세웁니다.** 물리 몸은 그대로 두고 안 보이게 하고,
// 겉몸(`view`)이 매 프레임 물리 몸을 따라가며 거기에 모션만 얹습니다.
// 충돌·사거리·이동은 한 줄도 안 바뀝니다.
//
// ── 왜 손에 무기를 안 들리는가 ──────────────────────────
// 무기 그림 서른여섯 자루가 이미 있으니 손에 들려 흔들 수도 있습니다. 그런데
// 주인공 그림 셋에는 **이미 무기가 그려져 있습니다** (전사는 검, 도적은 쌍단검,
// 궁수는 등에 활). 거기 또 한 자루를 얹으면 무기가 둘로 보입니다.
// 몸이 움직이면 들고 있는 것도 같이 움직이므로, 지금 그림 그대로 두고
// **몸의 움직임**으로 무기를 구분합니다 — 찌르는 몸과 베는 몸은 다릅니다.
class PlayerRig {
  constructor(scene) {
    this.scene = scene;
    this.body = scene.player;
    this.body.setVisible(false);

    this.view = scene.add.sprite(this.body.x, this.body.y, this.body.texture.key)
      .setDepth(this.body.depth);

    // 지금 얹혀 있는 모션. 전부 **바라보는 쪽 기준**입니다 —
    // dx 가 양수면 앞으로, rot 이 양수면 앞으로 기웁니다. 좌우 뒤집기는 sync 가 봅니다.
    this.pose = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    this.tw = null;
  }

  // 매 프레임 물리 몸을 그대로 베끼고 모션만 더합니다.
  // 알파까지 따라가야 맞을 때 깜빡이는 것이 겉몸에도 보입니다.
  sync() {
    const b = this.body;
    const p = this.pose;
    const s = b.flipX ? -1 : 1;
    this.view.setPosition(b.x + p.dx * s, b.y + p.dy);
    this.view.setFlipX(b.flipX);
    this.view.rotation = b.rotation + p.rot * s;
    this.view.setScale(p.sx, p.sy);
    this.view.setAlpha(b.alpha);
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
  play(keys, ms) {
    if (this.tw) this.tw.remove();
    const clock = { t: 0 };
    this.tw = this.scene.tweens.add({
      targets: clock, t: 1, duration: ms, ease: 'Linear',
      onUpdate: () => this.applyAt(keys, clock.t),
      onComplete: () => { this.tw = null; this.rest(); },
    });
  }

  rest() {
    this.pose.dx = 0; this.pose.dy = 0; this.pose.rot = 0;
    this.pose.sx = 1; this.pose.sy = 1;
  }

  // 마디와 마디 사이를 잇습니다. 가속을 **도착하는 마디**가 정합니다 —
  // 칼을 드는 마디는 부드럽게 서고(out), 내리치는 마디는 앞이 급해야(snap) 합니다.
  applyAt(keys, t) {
    let a = keys[0];
    let b = keys[keys.length - 1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].at) { a = keys[i - 1]; b = keys[i]; break; }
    }
    const span = b.at - a.at;
    const k = span <= 0 ? 1 : EASE[b.ease || 'linear']((t - a.at) / span);
    const at = (key, name, dflt) => (key[name] === undefined ? dflt : key[name]);
    this.pose.dx = lerp(at(a, 'dx', 0), at(b, 'dx', 0), k);
    this.pose.dy = lerp(at(a, 'dy', 0), at(b, 'dy', 0), k);
    this.pose.rot = lerp(at(a, 'rot', 0), at(b, 'rot', 0), k);
    this.pose.sx = lerp(at(a, 'sx', 1), at(b, 'sx', 1), k);
    this.pose.sy = lerp(at(a, 'sy', 1), at(b, 'sy', 1), k);
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
const MOTIONS = {
  // 검 — 들었다가 **돌려서** 내리칩니다. 몸통의 회전이 중심입니다.
  sword: {
    windup: 0.26,
    keys: [
      { at: 0 },
      { at: 0.26, dx: -4, dy: -3, rot: -0.38, ease: 'in' },   // 든다
      { at: 0.48, dx: 12, dy: 3, rot: 0.34, ease: 'snap' },   // 내리친다
      { at: 1, ease: 'out' },                                 // 되돌린다
    ],
  },

  // 창 — **돌리지 않습니다.** 몸이 통째로 앞으로 나갔다 빠집니다.
  // 검과 갈리는 것은 이 한 가지입니다. 창을 휘두르면 창이 아니라 몽둥이입니다.
  //
  // 회전을 아예 0으로 두었더니 옆으로 미끄러지는 것처럼만 보였습니다. 사람이
  // 창을 지를 때는 몸이 앞으로 조금 기웁니다 — 검의 3분의 1만 기울입니다.
  // 그 차이가 "돌려서 벤다"와 "밀어 넣는다"를 가릅니다.
  spear: {
    windup: 0.30,
    keys: [
      { at: 0 },
      { at: 0.30, dx: -9, dy: 2, sx: 0.90, ease: 'in' },      // 당긴다 — 움츠러든다
      { at: 0.42, dx: 20, dy: -1, sx: 1.12, rot: 0.10, ease: 'snap' }, // 찌른다 — 가장 짧고 급하다
      { at: 1, sx: 1, ease: 'out' },                          // 뺀다
    ],
  },

  // 단검 — 짧고 빠릅니다. 크게 휘두르지 않고 몸을 낮춰 찔러 넣습니다.
  dagger: {
    windup: 0.18,
    keys: [
      { at: 0 },
      { at: 0.18, dx: -4, dy: 2, rot: -0.18, ease: 'in' },
      { at: 0.34, dx: 13, dy: 3, rot: 0.30, ease: 'snap' },
      { at: 1, ease: 'out' },
    ],
  },

  // 쌍단검 — 같은 동작을 **두 번** 합니다. 한 대인데 두 번 번쩍이는 것이
  // 두 자루를 든 이유입니다. 둘째가 첫째보다 얕아야 되돌아오는 흐름이 보입니다.
  daggerTwin: {
    windup: 0.14,
    keys: [
      { at: 0 },
      { at: 0.14, dx: -4, rot: -0.16, ease: 'in' },
      { at: 0.28, dx: 13, dy: 3, rot: 0.30, ease: 'snap' },   // 첫 칼
      { at: 0.44, dx: 0, dy: 0, rot: -0.14, ease: 'out' },
      { at: 0.58, dx: 10, dy: 2, rot: 0.22, ease: 'snap' },   // 둘째 칼
      { at: 1, ease: 'out' },
    ],
  },

  // 활 — 당기는 마디가 가장 깁니다. 몸이 뒤로 눕고, 놓는 순간 앞으로 섭니다.
  // 활에서 힘이 실리는 곳은 놓을 때가 아니라 **당길 때**입니다.
  bow: {
    windup: 0.42,
    keys: [
      { at: 0 },
      { at: 0.42, dx: -9, dy: -1, rot: -0.20, sx: 0.94, ease: 'in' }, // 당긴다
      { at: 0.54, dx: 6, dy: 1, rot: 0.10, sx: 1.03, ease: 'snap' },  // 놓는다
      { at: 1, sx: 1, ease: 'out' },
    ],
  },

  // 석궁 — **당기는 마디가 없습니다.** 이미 걸려 있는 것을 놓을 뿐이라,
  // 몸이 앞으로 나가지 않고 반동으로 **뒤로 밀립니다.** 그리고 천천히 되감습니다.
  // 활과 석궁이 같은 몸짓이면 둘을 나눠 놓은 뜻이 없습니다.
  crossbow: {
    windup: 0,
    keys: [
      { at: 0 },
      { at: 0.14, dx: -14, dy: -2, rot: -0.22, ease: 'snap' },// 반동 — 뒤로 밀린다
      { at: 0.36, dx: -5, dy: 0, rot: -0.07, ease: 'out' },
      { at: 1, ease: 'out' },                                 // 되감기 — 여기가 가장 깁니다
    ],
  },
};

// 지금 든 무기의 몸짓. 무기표의 `icon.art` 를 그대로 씁니다 —
// 그림이 창이면 몸짓도 창이어야 하고, 그 둘이 갈리면 어느 쪽이든 거짓말이 됩니다.
function motionFor(job, weapon) {
  const icon = (weapon.base && weapon.base.icon) || {};
  const art = icon.art || (job.attack === 'ranged' ? 'bow' : 'sword');
  if (art === 'dagger' && icon.twin) return MOTIONS.daggerTwin;
  if (art === 'sword' && icon.twin) return MOTIONS.daggerTwin;
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
