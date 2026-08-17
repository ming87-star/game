// ── 보스 전리품 ───────────────────────────────────────────
//
// 보스를 잡으면 나오는 것. **메달을 대신합니다.**
//
// 예전에는 보스가 메달 셋을 줬습니다. 그런데 메달을 100층마다 하나로 모으고
// 나니(js/config.js 의 medal), 보스가 주는 셋이 그 규칙을 통째로 덮어썼습니다 —
// 400층 한 판이 「층에서 넷 + 보스에게서 여섯」이 되어, 「100층마다 하나」가
// 규칙이 아니게 됩니다. 그리고 보스를 잡은 보람이 **다음 판에나 오는 화폐**
// 라는 것도 이상했습니다. 어렵게 넘어선 값은 그 자리에서 손에 잡혀야 합니다.
//
// ── 다섯이 저마다 다른 일을 합니다 ──────────────────────
//
// 무엇을 내놓느냐는 **그 놈의 생김새와 하는 짓에서 나옵니다.** 그림에서 색과
// 모양으로 갈라 둔 것이 패턴으로 갈리고(favor), 이제 남기는 것으로도 갈립니다.
//
//    층   놈             생김새            전리품        하는 일
//   200  탑의 수문장    크게 뜬 두 눈      감시하는 눈   자동 사격
//   400  외눈의 감시자  외눈 · 굵은 빔     꿰뚫는 눈길   한 줄 관통
//   600  불집게        달군 날 · 덮침     불집게        붙잡고 태우기
//   800  알주머니      알 · 졸개를 뱉음   깨어난 알     아군 셋
//  1000  갈라진 가면    사라졌다 나타남    갈라진 가면   한 대 막기
//
// **넷이 같은 일을 하면 그건 하나를 네 번 받은 것과 같습니다.** 다섯을 다 모은
// 판이 실제로 달라 보이려면 서로 겹치지 않아야 합니다.
//
// ── 유물과 무엇이 다른가 ────────────────────────────────
//
// 유물은 **판 안에서** 얻고 상점 자리와 함께 되살아납니다. 전리품은 그렇지
// 않습니다 — **보스를 넘어선 값**이라, 죽어서 넘어서기 전 자리로 되돌아가면
// 사라집니다 (300층에서 죽어 250층 상점에서 이어 하면 눈이 없습니다).
// 다시 가지려면 보스를 다시 잡아야 합니다.
//
// 이것이 「이어서 진행」에 값을 하나 더 붙여 줍니다. 예전에는 이번 판에 번
// 메달만 버리면 됐는데, 메달이 층에서 나오게 되면서 그 값이 얇아졌습니다.
const TROPHIES = {
  eye: {
    key: 'eye', name: '감시하는 눈', icon: '👁', stack: 3,
    detail: '떠다니며 스스로 쏩니다',
    lore: '수문장의 눈 하나가 떨어져 나와 그대로 따라옵니다. 무엇을 보고 있는지는 아무도 모릅니다.',
  },
  gaze: {
    key: 'gaze', name: '꿰뚫는 눈길', icon: '⌖', stack: 1,
    detail: '한 줄에 늘어선 것을 한 번에 꿰뚫습니다',
    lore: '감시자가 마지막으로 본 것이 눈길에 그대로 남았습니다. 이제는 그것이 대신 노려봅니다.',
  },
  claw: {
    key: 'claw', name: '불집게', icon: '🦞', stack: 1,
    detail: '둘레의 적을 한꺼번에 집어 태웁니다',
    lore: '달군 채로 식히지 않은 집게. 무엇을 집었는지는 놓고 나서야 알 수 있었다고 합니다.',
  },
  hatch: {
    key: 'hatch', name: '깨어난 알', icon: '🥚', stack: 1,
    detail: '셋이 튀어다니며 갉습니다',
    lore: '알주머니에서 굴러 나온 것 셋. 어미가 쓰러진 줄도 모르고 따라나섰습니다.',
  },
  mask: {
    key: 'mask', name: '갈라진 가면', icon: '🎭', stack: 1,
    detail: '한 대를 통째로 막고 깨졌다가 다시 생깁니다',
    lore: '쓰면 얼굴이 없어진다는 가면. 깨져도 이튿날이면 다시 붙어 있었다고 합니다.',
  },
};

// 그 보스가 내놓는 것 (js/config.js 의 boss.kinds 와 짝).
const BOSS_TROPHY = {
  'boss-warden': 'eye',
  'boss-gazer': 'gaze',
  'boss-crusher': 'claw',
  'boss-brood': 'hatch',
  'boss-phantom': 'mask',
};

function trophyForBoss(kind) {
  return TROPHIES[BOSS_TROPHY[kind && kind.key] || 'eye'];
}

// ── 판 하나가 들고 있는 전리품 전부 ───────────────────────
//
// 다섯이 저마다 제 시계와 제 그림을 갖지만, 켜고 끄고 걷어내는 것은 한
// 군데서 합니다. 판이 끝나거나 이어서 진행할 때 **한 줄로 다 지워야** 하는데,
// 다섯 군데에 흩어 두면 언젠가 하나를 빠뜨립니다.
class Trophies {
  constructor(scene) {
    this.scene = scene;
    this.taken = [];   // 얻은 순서대로
    this.eyes = [];
    this.hatchlings = [];
    this.mask = null;
    this.maskAt = 0;   // 가면이 다시 생기는 시각
    this.gazeAt = 0;
    this.clawAt = 0;
  }

  get count() { return this.taken.length; }

  has(key) { return this.taken.some((t) => t.key === key); }

  countOf(key) { return this.taken.filter((t) => t.key === key).length; }

  // 하나 얻습니다. 이미 한도까지 찼으면 아무 일도 안 하고 false 를 돌려줍니다 —
  // 부른 쪽이 "무엇을 얻었다"고 적을지 말지를 그것으로 정합니다.
  take(trophy) {
    if (!trophy) return false;
    const stack = trophy.stack || 1;
    if (this.countOf(trophy.key) >= (trophy.key === 'eye' ? CFG.trophy.maxEyes : stack)) {
      return false;
    }
    const s = this.scene;
    const now = s.time.now;
    if (trophy.key === 'eye') this.addEye();
    if (trophy.key === 'gaze') this.gazeAt = now + CFG.trophy.gaze.rate;
    if (trophy.key === 'claw') this.clawAt = now + CFG.trophy.claw.rate;
    if (trophy.key === 'hatch') this.addHatchlings();
    if (trophy.key === 'mask') this.wearMask();
    this.taken.push(trophy);
    return true;
  }

  // ── 매 프레임 ───────────────────────────────────────────
  update(time) {
    if (this.eyes.length) this.updateEyes(time);
    if (this.has('gaze') && time >= this.gazeAt) this.fireGaze(time);
    if (this.has('claw') && time >= this.clawAt) this.snapClaw(time);
    if (this.hatchlings.length) this.updateHatchlings(time);
    if (this.has('mask')) this.updateMask(time);
  }

  // ── 감시하는 눈 ─────────────────────────────────────────
  // 주인공 둘레를 타원으로 돌면서, 제 시계로 가까운 적에게 한 발씩 쏩니다.
  // 사람이 하는 일은 아무것도 없습니다 — 그래서 **보조**입니다.
  addEye() {
    const s = this.scene;
    const e = CFG.trophy.eye;
    // 주인공 키의 1/10. 몸이 아니라 **겉몸의 키**를 재야 합니다 — 물리 몸은
    // 그림보다 작게 잡아 두었습니다 (js/scene-game.js 의 setSize).
    const size = Math.max(3, Math.round(s.player.displayHeight * e.scale));
    const eye = s.add.image(s.player.x, s.player.y, 'trophy-eye')
      .setDisplaySize(size, size).setDepth(11);
    // 뒤에 옅은 빛을 하나 깝니다. 5px 짜리는 그냥 두면 어두운 벽에서 안 보입니다 —
    // **빛은 눈이 아닙니다.** 크기는 시킨 대로 두고 보이게만 합니다.
    const glow = s.add.image(s.player.x, s.player.y, 'trophy-eye-glow')
      .setDisplaySize(size * 3.4, size * 3.4).setDepth(10).setAlpha(0.5);
    eye.glow = glow;
    eye.nextShotAt = s.time.now + e.rate * (0.4 + Math.random() * 0.6);
    this.eyes.push(eye);
  }

  updateEyes(time) {
    const s = this.scene;
    const e = CFG.trophy.eye;
    const n = this.eyes.length;
    const spin = (time % e.spinMs) / e.spinMs * Math.PI * 2;

    this.eyes.forEach((eye, i) => {
      // 여럿이면 고르게 벌려 세웁니다. 겹쳐 돌면 하나로 보입니다.
      const a = spin + (Math.PI * 2 * i) / n;
      eye.x = s.player.x + Math.cos(a) * e.orbitR;
      eye.y = s.player.y + e.orbitY + Math.sin(a) * e.orbitRy;
      eye.glow.setPosition(eye.x, eye.y);
      // 뒤로 돌아갈 때는 흐려집니다 — 그것만으로 도는 것이 앞뒤로 읽힙니다.
      const back = Math.sin(a) < 0;
      eye.setAlpha(back ? 0.55 : 1);
      eye.glow.setAlpha(back ? 0.25 : 0.5);

      if (time < eye.nextShotAt) return;
      const target = this.nearest(eye.x, eye.y, e.range);
      if (!target) { eye.nextShotAt = time + 200; return; }
      eye.nextShotAt = time + e.rate;
      s.fireEyeBolt(eye.x, eye.y, target, this.share(e.dpsShare, e.rate));
    });
  }

  // ── 꿰뚫는 눈길 ─────────────────────────────────────────
  // 가장 가까운 놈 쪽으로 겨눴다가, **그 선 위에 있는 것을 한 번에 다** 꿰뚫습니다.
  // 눈과 갈리는 점이 이것입니다 — 눈은 하나씩, 눈길은 늘어선 만큼.
  fireGaze(time) {
    const s = this.scene;
    const g = CFG.trophy.gaze;
    const aim = this.bestLine(s.player.x, s.player.y - 8, g);
    if (!aim) { this.gazeAt = time + 300; return; }
    this.gazeAt = time + g.rate;

    const ang = aim.ang;
    const x0 = s.player.x;
    const y0 = s.player.y - 8;

    // 겨누는 동안 가는 선이 먼저 보입니다. 예고 없이 터지면 무엇에 맞았는지
    // 모르고, 그러면 이건 그냥 가끔 반짝이는 빛입니다.
    const hint = s.add.rectangle(x0, y0, g.len, 2, 0x4dd0e1, 0.5)
      .setOrigin(0, 0.5).setRotation(ang).setDepth(9);
    s.tweens.add({ targets: hint, alpha: 0.9, duration: g.chargeMs,
      onComplete: () => hint.destroy() });

    s.time.delayedCall(g.chargeMs, () => {
      // 겨눈 뒤에 판이 끝났으면 아무 일도 없어야 합니다.
      if (s.dead) return;
      // 쏘는 순간의 자리에서 다시 잽니다 — 겨누는 동안 주인공이 움직입니다.
      const px = s.player.x;
      const py = s.player.y - 8;
      const beam = s.add.rectangle(px, py, g.len, g.width, 0x80deea, 0.75)
        .setOrigin(0, 0.5).setRotation(ang).setDepth(11);
      s.tweens.add({ targets: beam, alpha: 0, scaleY: 0.2, duration: 260,
        onComplete: () => beam.destroy() });

      const dmg = this.share(g.dpsShare, g.rate);
      this.onLine(px, py, ang, g).forEach((en) => s.hitEnemy(en, dmg));
    });
  }

  // ── 어느 쪽으로 쏠까 ────────────────────────────────────
  //
  // **가장 가까운 놈 쪽으로 쏘면 안 됩니다.** 이 자루의 값어치는 늘어선 것을
  // 한 번에 꿰뚫는 것인데, 가까운 놈을 겨누면 각이 가팔라져서 멀리 있는
  // 놈들이 선 밖으로 밀려납니다 — 여섯이 한 줄로 서 있는데 둘만 맞았습니다.
  //
  // 그래서 **가장 많이 꿰뚫는 쪽**을 고릅니다. 후보는 지금 보이는 적들이고
  // (많아야 여덟) 저마다 한 번씩 세어 보면 되므로, 예순네 번 재는 것이 전부입니다.
  bestLine(px, py, g) {
    const s = this.scene;
    const seen = s.enemies.getChildren().filter((en) => s.targetable(en)
      && Phaser.Math.Distance.Between(px, py, en.x, en.y) <= g.len);
    if (!seen.length) return null;
    let best = null;
    seen.forEach((en) => {
      const ang = Phaser.Math.Angle.Between(px, py, en.x, en.y);
      const n = this.onLine(px, py, ang, g).length;
      // 같은 수라면 가까운 쪽을 고릅니다 — 겨누는 동안 도망칠 틈이 적습니다.
      const gap = Phaser.Math.Distance.Between(px, py, en.x, en.y);
      if (!best || n > best.n || (n === best.n && gap < best.gap)) best = { ang, n, gap };
    });
    return best;
  }

  // 그 선 위에 있는 놈들. 시작점에서 잰 **선 방향 거리**와 **선에서 벗어난
  // 거리**로 봅니다.
  onLine(px, py, ang, g) {
    const s = this.scene;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    return s.enemies.getChildren().filter((en) => {
      if (!s.targetable(en)) return false;
      const dx = en.x - px;
      const dy = en.y - py;
      const along = dx * cos + dy * sin;
      if (along < 0 || along > g.len) return false;
      const off = Math.abs(-dx * sin + dy * cos);
      return off <= g.width / 2 + (en.hitH || en.displayHeight * 0.4);
    });
  }

  // ── 불집게 ──────────────────────────────────────────────
  // 둘레의 적을 한꺼번에 집어 못 움직이게 하고 태웁니다.
  //
  // **몇 마리가 잡힐지는 그때그때 다릅니다.** 하나뿐이면 거의 아무 일도 안
  // 일어나고 다섯이 둘러쌌으면 판이 뒤집힙니다 — 그래서 이것 하나가
  // **위험한 자리로 뛰어들 이유**가 됩니다.
  snapClaw(time) {
    const s = this.scene;
    const c = CFG.trophy.claw;
    const near = s.enemies.getChildren()
      .filter((en) => s.targetable(en) && !en.isBoss && !en.isGoldFrog
        && Phaser.Math.Distance.Between(en.x, en.y, s.player.x, s.player.y) <= c.radius)
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, s.player.x, s.player.y)
                    - Phaser.Math.Distance.Between(b.x, b.y, s.player.x, s.player.y))
      .slice(0, c.max);

    // 아무도 없으면 시계를 짧게만 미룹니다 — 빈 곳에서 6초를 버리면 적이
    // 몰려온 순간에 마침 쉬고 있게 됩니다.
    if (!near.length) { this.clawAt = time + 400; return; }
    this.clawAt = time + c.rate;

    // 몇 마리가 잡혔는지는 그 자리에서 보여야 합니다. 둘러싸인 것이 이득이
    // 되는 순간인데, 화면이 조용하면 그 뒤집힘이 안 읽힙니다.
    s.cameras.main.shake(180, 0.006);
    const ring = s.add.circle(s.player.x, s.player.y - 10, 10, 0xff7043, 0)
      .setStrokeStyle(3, 0xffab91, 0.9).setDepth(9);
    s.tweens.add({ targets: ring, radius: c.radius, alpha: 0, duration: 380,
      onUpdate: () => ring.setRadius(ring.radius), onComplete: () => ring.destroy() });

    // **한 번에 들어가는 값은 정수여야 합니다.** 나누고 남은 소수를 그대로
    // 넣으면 적 체력이 200.125 같은 값이 되어, 화면에 뜨는 숫자와 실제가
    // 어긋납니다.
    const each = Math.max(1, Math.round(this.share(c.dpsShare, c.holdMs) / c.ticks));
    near.forEach((en) => this.grab(en, each, time));
  }

  // 한 놈을 집습니다. 자리를 안 옮기고 시간만 뺏는 것은 전사의 기절과 같은
  // 규칙입니다 (js/scene-game.js 의 stunEnemy 위 주석) — 밀면 발판에서 떨어집니다.
  grab(enemy, each, time) {
    const s = this.scene;
    const c = CFG.trophy.claw;
    // 집게가 잡고 있는 동안. 기절(stunUntil)과 따로 두는 것은 **누가 붙잡았는지**를
    // 알아야 하기 때문입니다 — 전사는 휘두를 때마다 기절을 걸므로, 기절만
    // 보면 집게가 한 일과 칼이 한 일이 구분되지 않습니다.
    enemy.clawUntil = time + c.holdMs;
    enemy.stunUntil = Math.max(enemy.stunUntil || 0, time + c.holdMs);
    // **회복 창은 짧게 둡니다.** 전사의 기절이 stunOkAt 을 보고 물러나므로,
    // 여기서 길게 잡으면 집게가 전사의 기절을 도로 막아 버립니다.
    enemy.stunOkAt = Math.max(enemy.stunOkAt || 0, time + c.holdMs);
    if (enemy.body) enemy.body.velocity.set(0, 0);

    const claw = s.add.image(enemy.x, enemy.y, 'trophy-claw')
      .setDisplaySize(enemy.displayWidth * 0.95, enemy.displayHeight * 0.95).setDepth(12);
    // 타는 동안 달아오릅니다. 집힌 놈과 안 집힌 놈이 한눈에 갈려야 합니다.
    enemy.setTint(0xff8a65);

    let n = 0;
    const burn = s.time.addEvent({
      delay: c.holdMs / c.ticks, repeat: c.ticks - 1,
      callback: () => {
        if (!enemy.active || s.dead) { burn.remove(); claw.destroy(); return; }
        claw.setPosition(enemy.x, enemy.y);
        claw.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(n * 1.7)));
        s.hitEnemy(enemy, each);
        if (++n >= c.ticks) {
          if (enemy.active) enemy.clearTint();
          claw.destroy();
        }
      },
    });
  }

  // ── 깨어난 알 ───────────────────────────────────────────
  // 셋이 **땅을 튀어다니며** 갉습니다. 나는 것과 셈은 비슷하지만 눈에 훨씬
  // 사납게 보입니다 — 붙었다 튀고 다시 붙는 것이 계속 보이니까요.
  //
  // 튀는 것은 물리가 아니라 트윈으로 그립니다. 진짜로 중력을 주면 발판에서
  // 떨어지고, 그러면 전사의 넉백을 걷어냈던 그 문제를 또 풀게 됩니다.
  addHatchlings() {
    const s = this.scene;
    const h = CFG.trophy.hatch;
    for (let i = 0; i < h.count; i++) {
      const b = s.add.image(s.player.x, s.player.y, 'trophy-hatch')
        .setDisplaySize(h.size, h.size).setDepth(11);
      b.target = null;
      b.nextBiteAt = 0;
      b.hopUntil = 0;
      b.homeAngle = (Math.PI * 2 * i) / h.count;
      this.hatchlings.push(b);
    }
  }

  updateHatchlings(time) {
    const s = this.scene;
    const h = CFG.trophy.hatch;
    const dmg = this.share(h.dpsShare, h.biteMs);

    this.hatchlings.forEach((b, i) => {
      // 붙어 있던 놈이 쓰러질 때가 되면 미리 떨어집니다 — 어차피 죽을 놈을
      // 마저 갉는 것은 버리는 피해입니다.
      const spent = b.target && (!s.targetable(b.target)
        || b.target.hp <= b.target.maxHp * h.lowHp);
      if (spent) b.target = null;
      if (!b.target) b.target = this.pickBite(b, h);

      if (b.target) {
        // 붙었습니다. 놈의 몸 둘레에 조금씩 흩어져 앉습니다 — 셋이 겹치면
        // 하나로 보입니다.
        const a = b.homeAngle + time / 900;
        const wx = b.target.x + Math.cos(a) * b.target.displayWidth * 0.42;
        const wy = b.target.y + Math.sin(a) * b.target.displayHeight * 0.34;
        this.hopTo(b, wx, wy, time, h);
        if (time >= b.nextBiteAt && time >= b.hopUntil) {
          b.nextBiteAt = time + h.biteMs;
          s.hitEnemy(b.target, dmg);
          // 한 입 물 때마다 몸이 눌립니다. 갉는 것이 보여야 합니다.
          s.tweens.add({ targets: b, scaleX: b.scaleX * 1.25, scaleY: b.scaleY * 0.8,
            duration: 90, yoyo: true });
        }
        return;
      }

      // 갉을 것이 없으면 주인공 발치를 몰려다닙니다.
      const a = b.homeAngle + time / 700;
      this.hopTo(b, s.player.x + Math.cos(a) * 46, s.player.y + 12, time, h);
    });
  }

  // 목표 자리로 **튀어서** 갑니다. 이미 그 자리면 가만히 있습니다.
  hopTo(b, wx, wy, time, h) {
    if (time < b.hopUntil) {
      // 튀는 중 — 포물선으로 그립니다.
      const t = 1 - (b.hopUntil - time) / h.hopMs;
      b.x = Phaser.Math.Linear(b.fromX, b.toX, t);
      b.y = Phaser.Math.Linear(b.fromY, b.toY, t) - Math.sin(Math.PI * t) * h.hopH;
      return;
    }
    b.x = b.toX === undefined ? wx : b.toX;
    b.y = b.toY === undefined ? wy : b.toY;
    if (Phaser.Math.Distance.Between(b.x, b.y, wx, wy) < 6) return;
    b.fromX = b.x; b.fromY = b.y;
    b.toX = wx; b.toY = wy;
    b.hopUntil = time + h.hopMs;
  }

  // 갉을 놈 — 사거리 안에서 **가장 튼튼한** 놈입니다. 가장 가까운 놈으로
  // 잡으면 셋이 다 같은 놈에게 몰려서, 쓰러질 때가 되면 셋이 함께 떠납니다.
  pickBite(b, h) {
    const s = this.scene;
    let best = null;
    let bestHp = 0;
    s.enemies.getChildren().forEach((en) => {
      if (!s.targetable(en)) return;
      if (en.hp <= en.maxHp * h.lowHp) return;
      if (Phaser.Math.Distance.Between(en.x, en.y, s.player.x, s.player.y) > h.range) return;
      if (en.hp > bestHp) { bestHp = en.hp; best = en; }
    });
    return best;
  }

  // ── 갈라진 가면 ─────────────────────────────────────────
  // 얼굴에 씌워집니다. 한 대를 **통째로** 막고 깨졌다가 다시 생깁니다.
  //
  // **머리에 정확히 맞추지 않습니다.** 주인공 셋의 머리가 다르므로(투구·후드·
  // 두건) 머리보다 크게 씌워 덮습니다 — 자리를 재는 대신 가리는 쪽이 셋 다에
  // 들어맞고, 무기 일흔두 자루의 몸짓마다 머리 자리를 다시 재지 않아도 됩니다.
  wearMask() {
    const s = this.scene;
    const m = CFG.trophy.mask;
    if (this.mask) return;
    this.mask = s.add.image(s.player.x, s.player.y + m.y, 'trophy-mask')
      .setDisplaySize(m.size, m.size).setDepth(12);
    this.maskAt = 0;
  }

  updateMask(time) {
    const s = this.scene;
    const m = CFG.trophy.mask;
    if (this.mask) {
      this.mask.setPosition(s.player.x, s.player.y + m.y);
      this.mask.setFlipX(s.player.flipX);
      this.mask.rotation = s.player.rotation;
      this.mask.setAlpha(s.player.alpha);
      return;
    }
    if (this.maskAt && time >= this.maskAt) this.wearMask();
  }

  // 한 대를 막습니다. 막았으면 true — 부른 쪽(scene-game 의 hurt)이 그것으로
  // 피해를 통째로 물립니다.
  blockWithMask() {
    if (!this.mask) return false;
    const s = this.scene;
    const m = CFG.trophy.mask;
    const at = { x: this.mask.x, y: this.mask.y };
    this.mask.destroy();
    this.mask = null;
    this.maskAt = s.time.now + m.regenMs;

    // 깨지는 순간이 곧 알림입니다. 조각이 튀는 것만으로 "방금 한 대 막았다"가
    // 읽혀서, HUD 에 줄을 하나 더 둘 이유가 없어집니다.
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.4;
      const p = s.add.image(at.x, at.y, 'trophy-mask')
        .setDisplaySize(m.size * 0.3, m.size * 0.3).setDepth(12);
      s.tweens.add({
        targets: p, x: at.x + Math.cos(a) * 46, y: at.y + Math.sin(a) * 46 + 20,
        angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: 460,
        onComplete: () => p.destroy(),
      });
    }
    s.popup('가면이 깨졌습니다', '#e1bee7');
    return true;
  }

  // ── 함께 쓰는 것들 ──────────────────────────────────────
  // 사거리 안에서 가장 가까운 놈. 보스도 셉니다.
  nearest(x, y, range) {
    const s = this.scene;
    let best = null;
    let bestGap = range;
    s.enemies.getChildren().forEach((en) => {
      if (!s.targetable(en)) return;
      const gap = Phaser.Math.Distance.Between(x, y, en.x, en.y);
      if (gap < bestGap) { bestGap = gap; best = en; }
    });
    return best;
  }

  // 주인공 초당 피해의 share 만큼을, 이 간격에 나눠 담은 한 번의 값.
  share(ratio, everyMs) {
    return Math.max(1, Math.round(this.scene.weapon.dps * ratio * everyMs / 1000));
  }

  // 판이 끝나거나 다시 시작할 때. 이어서 진행할 때도 여기를 지납니다 —
  // **전리품은 상점 자리와 함께 되살아나지 않습니다.**
  reset() {
    this.eyes.forEach((eye) => { eye.glow.destroy(); eye.destroy(); });
    this.hatchlings.forEach((b) => b.destroy());
    if (this.mask) this.mask.destroy();
    this.eyes = [];
    this.hatchlings = [];
    this.mask = null;
    this.maskAt = 0;
    this.taken = [];
  }

  // 화면에 적을 한 줄. 없으면 빈 글자입니다.
  label() {
    if (!this.taken.length) return '';
    const seen = new Map();
    this.taken.forEach((t) => seen.set(t, (seen.get(t) || 0) + 1));
    return [...seen.entries()]
      .map(([t, n]) => t.icon + ' ' + t.name + (n > 1 ? ' ×' + n : '')).join('   ');
  }

  // HUD 에 붙는 짧은 표. 이름은 길어서 안 들어갑니다.
  marks() {
    if (!this.taken.length) return '';
    const seen = new Map();
    this.taken.forEach((t) => seen.set(t.icon, (seen.get(t.icon) || 0) + 1));
    return [...seen.entries()].map(([icon, n]) => icon + (n > 1 ? '×' + n : '')).join(' ');
  }
}
