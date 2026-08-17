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
// 그래서 보스마다 제 것을 하나씩 내놓습니다. 무엇을 내놓느냐는 **그 놈의
// 생김새에서 나옵니다** — 첫 놈(탑의 수문장)은 크게 뜬 두 눈이 얼굴의 전부라,
// 그 눈 하나가 떨어져 나와 따라다닙니다.
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
    key: 'eye',
    name: '감시하는 눈',
    icon: '👁',
    detail: '떠다니며 스스로 쏩니다',
    lore: '수문장의 눈 하나가 떨어져 나와 그대로 따라옵니다. 무엇을 보고 있는지는 아무도 모릅니다.',
  },
};

// 그 보스가 내놓는 것.
//
// **아직 넷은 제 것이 없습니다.** 수문장 말고 넷(외눈 · 집게 · 알주머니 ·
// 가면)은 저마다 다른 것을 내놓아야 맞지만, 지금은 눈을 하나 더 줍니다 —
// 아무것도 안 주면 그 보스를 잡을 이유가 없어지기 때문입니다. 눈은 최대
// 셋까지 쌓입니다 (CFG.trophy.maxEyes).
function trophyForBoss() {
  return TROPHIES.eye;
}

// ── 따라다니는 눈 ─────────────────────────────────────────
//
// 주인공 둘레를 타원으로 돌면서, 제 시계로 가까운 적에게 한 발씩 쏩니다.
// 사람이 하는 일은 아무것도 없습니다 — 그래서 **보조**입니다. 세기는 지금
// 든 자루의 초당 피해에 비례합니다 (CFG.trophy.eye.dpsShare). 고정값으로
// 두면 아래층에서는 주인공보다 세고 위층에서는 있으나 마나가 됩니다.
class Trophies {
  constructor(scene) {
    this.scene = scene;
    this.taken = [];   // 얻은 순서대로 (이름을 적을 때 씁니다)
    this.eyes = [];
  }

  get count() { return this.taken.length; }

  has(key) { return this.taken.some((t) => t.key === key); }

  // 하나 얻습니다. 이미 한도까지 찼으면 아무 일도 안 하고 false 를 돌려줍니다 —
  // 부른 쪽이 "무엇을 얻었다"고 적을지 말지를 그것으로 정합니다.
  take(trophy) {
    if (!trophy) return false;
    if (trophy.key === 'eye') {
      if (this.eyes.length >= CFG.trophy.maxEyes) return false;
      this.addEye();
    }
    this.taken.push(trophy);
    return true;
  }

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

  // 매 프레임. 자리를 잡고, 제 시계가 되면 한 발 쏩니다.
  update(time) {
    if (!this.eyes.length) return;
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
      const target = this.pick(eye);
      if (!target) { eye.nextShotAt = time + 200; return; }
      eye.nextShotAt = time + e.rate;
      s.fireEyeBolt(eye.x, eye.y, target, this.boltDamage());
    });
  }

  // 사거리 안에서 가장 가까운 놈. 보스도 셉니다.
  pick(eye) {
    const s = this.scene;
    let best = null;
    let bestGap = CFG.trophy.eye.range;
    s.enemies.getChildren().forEach((en) => {
      if (!s.targetable(en)) return;
      const gap = Phaser.Math.Distance.Between(eye.x, eye.y, en.x, en.y);
      if (gap < bestGap) { bestGap = gap; best = en; }
    });
    return best;
  }

  // 한 발의 세기. 주인공 초당 피해의 dpsShare 를 이 발사 간격에 나눠 담습니다.
  boltDamage() {
    const e = CFG.trophy.eye;
    return Math.max(1, Math.round(this.scene.weapon.dps * e.dpsShare * e.rate / 1000));
  }

  // 판이 끝나거나 다시 시작할 때. 이어서 진행할 때도 여기를 지납니다 —
  // **전리품은 상점 자리와 함께 되살아나지 않습니다.**
  reset() {
    this.eyes.forEach((eye) => { eye.glow.destroy(); eye.destroy(); });
    this.eyes = [];
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
}
