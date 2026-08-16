// 손에 든 무기 한 자루. 무기 주머니는 직업이 들고 옵니다 (js/classes.js).
//
// ── 사다리를 걷어냈습니다 ─────────────────────────────────
//
// 예전에는 `tier` 가 0부터 11까지 오르는 **계단**이었습니다. `UP` 을 밟으면
// 한 칸 올라가고, 다음 무기는 늘 지금 것보다 셌습니다. 문제가 셋이었습니다.
//
//   1. 고를 것이 없었습니다. 더 센 것이 나왔으니 밟으면 그만입니다
//   2. 275층 언저리에서 꼭대기에 닿고, 그 뒤로는 무기가 아무 일도 안 합니다
//   3. 꼭대기에 닿았는데 적은 계속 세지니, 어려운 것이 아니라 **답답해집니다**
//
// 지금은 계단이 아니라 **주머니**입니다. `index` 는 주머니에서 몇 번째냐일
// 뿐이고 높낮이가 아닙니다. 필드에서 무기를 만나면 판이 멈추고 지금 것과
// 나란히 놓고 고릅니다 (js/scene-swap.js). 뒤쪽 자루가 조금 낫기는 해도,
// 만듦새에 따라 앞쪽 자루가 더 맞을 수 있습니다.
//
// ── 강화는 무기에 붙습니다 ───────────────────────────────
//
// `+1` · `속` · `×2` 는 **그 자루에 붙어 있다가 갈아타면 같이 사라집니다.**
// 그래서 갈아타는 것이 늘 이득인 결정이 아닙니다 — 오래 들고 다니며 벼려 놓은
// 자루를 버리는 값이 있어야, 새 무기를 만났을 때 실제로 멈춰 서서 재게 됩니다.
// 갈아타기 창이 **강화까지 넣은 값**으로 두 자루를 견주는 이유가 이것입니다.
class Weapon {
  constructor(job, index) {
    this.job = job;
    this.table = buildWeaponPool(job);
    this.index = index || 0;
    this.plus = 0;
    this.haste = 0;
    this.mult = 1;
    this.capBonus = 0;
    this.relics = [];
  }

  get base() { return this.table[this.index]; }
  get name() { return this.base.name; }
  get color() { return this.base.color; }
  get detail() { return this.base.detail || ''; }
  get forge() { return FORGES[this.base.forge] || FORGES.plain; }

  // ── 공격력 ────────────────────────────────────────────
  // 한 값이 아니라 **범위**입니다. 같은 무기로 같은 적을 때려도 매번 조금씩
  // 다르게 들어갑니다. 만듦새가 그 폭을 조절합니다 — 은장은 고르고 흑철은
  // 들쭉날쭉합니다 (js/forge.js).
  //
  // 강화(`+1`)는 범위 전체를 같은 비율로 밀어 올립니다. 아래쪽만 올리면
  // "최소 공격력"이 곧 실제 공격력이 되어 범위라는 것이 뜻을 잃습니다.
  get plusValue() { return this.plus * (this.job.plusScale || 1); }
  get boost() { return 1 + this.plusValue * CFG.plusStep; }
  get dmgMin() { return Math.max(1, Math.round(this.base.dmgMin * this.boost)); }
  get dmgMax() { return Math.max(1, Math.round(this.base.dmgMax * this.boost)); }
  // 가운뎃값. 초당 피해처럼 "그래서 얼마냐"에 답할 때 씁니다.
  get dmg() { return Math.round((this.dmgMin + this.dmgMax) / 2); }

  // 한 대. 부를 때마다 범위 안에서 굴립니다.
  rollDamage() {
    return Phaser.Math.Between(this.dmgMin, this.dmgMax);
  }

  // ── 정확도 ────────────────────────────────────────────
  // 빗나가면 피해가 아예 안 들어갑니다 ('빗나감'이 뜹니다).
  //
  // 회피(맞는 쪽이 흘리는 것)와는 다른 값입니다. 이건 **때리는 쪽이 놓치는**
  // 것이고, 무기의 성격입니다 — 흑철은 무거워서 빗나가고 창은 곧아서 안 빗나갑니다.
  get accuracy() { return Phaser.Math.Clamp(this.base.acc + this.relicSum('accBonus'), 0.5, 1); }
  hits() { return Math.random() < this.accuracy; }

  // ── 공격 속도 ─────────────────────────────────────────
  // 속은 더하기, ×2는 곱하기. 둘을 합친 값이 한계에서 잘립니다.
  // 한계는 직업마다 다릅니다 — 전사는 낮고 도적은 높습니다.
  get speedCap() {
    return (this.job.speedCap || CFG.speedCapBase) + this.capBonus + this.relicSum('capBonus');
  }
  get rawSpeed() { return (1 + this.haste * CFG.hasteStep) * this.mult; }
  get speedMult() { return Math.min(this.speedCap, this.rawSpeed); }
  // 한계에 닿았으면 그 뒤로 줍는 속은 헛것입니다. 화면에 그렇다고 적어 줘야 합니다.
  get speedCapped() { return this.rawSpeed >= this.speedCap; }

  get rate() { return this.base.rate / this.speedMult; }

  // ── 유물 ──────────────────────────────────────────────
  // 여러 개를 겹쳐 들 수 있으므로, 효과는 모아서 더하거나 곱합니다.
  // **유물은 무기에 안 붙습니다** — 갈아타도 그대로 따라옵니다.
  relicSum(prop) { return this.relics.reduce((a, r) => a + (r[prop] || 0), 0); }
  relicMul(prop) { return this.relics.reduce((a, r) => a * (r[prop] || 1), 1); }
  hasRelic(key) { return this.relics.some((r) => r.key === key); }

  // 근접 — 이 거리 안의 적을 한 번에 모두 벱니다.
  get reach() { return (this.base.reach || 0) * this.relicMul('reachScale'); }

  // 사거리 끝에서 남는 피해의 몫. 유물이 없으면 1 — 끝까지 온전히 들어갑니다.
  //
  // 더하기도 곱하기도 아닌 **가장 작은 값**을 씁니다. 감쇠는 여러 개를 겹쳐
  // 들어도 가장 가혹한 것 하나로 정해지는 것이 읽기 쉽습니다. 두 개를 곱하면
  // 유물 둘을 든 사람이 영문도 모르고 1%만 넣게 됩니다.
  get farFalloff() {
    return this.relics.reduce(
      (a, r) => Math.min(a, r.falloff === undefined ? 1 : r.falloff), 1);
  }

  // 원거리 — 한 발이 적 하나를 칩니다.
  get range() { return this.base.range || 0; }
  get shots() { return this.base.shots || 1; }
  get bounce() { return this.relicSum('bounce'); }
  get homing() { return !!this.base.homing; }

  // 도적의 절도. 유물이 있으면 확률과 액수가 함께 오릅니다.
  get stealChance() { return this.job.steal + this.relicSum('stealBonus'); }
  get stealAmount() { return 1 + this.relicSum('stealAmount'); }

  // ── 초당 피해 ─────────────────────────────────────────
  // **이 숫자 하나가 "그래서 센가?"에 답합니다.**
  //
  // 공격력만 보여 주면 두 가지가 거짓말이 됩니다.
  //   · `속`(공격 속도)을 아무리 주워도 숫자가 안 움직입니다. 그러면 주운
  //     사람은 "이건 아무것도 안 하는구나"로 배웁니다.
  //   · 무기끼리 공격력과 속도를 맞바꿉니다. 공격력만 보면 느린 무기가 더 세 보입니다.
  //
  // 정확도까지 곱합니다. 빗나가는 무기는 그만큼 덜 들어가는 것이 사실이고,
  // 흑철(정확도 -9%p)과 은장(+7%p)을 견주려면 이 값에 그게 들어 있어야 합니다.
  //
  // 근접은 사거리 안의 적을 한 번에 다 벱니다. 그러니 이 값은 **한 놈에게
  // 들어가는 몫**이고, 여럿에 둘러싸이면 실제로는 이보다 큽니다.
  get dps() { return Math.round(this.dmg * this.shots * this.accuracy * 1000 / this.rate); }

  // 어떤 자루를 들면 얼마가 되는가. **갈아타기 창이 쓰는 자입니다.**
  //
  // 강화는 무기에 붙어 있다가 갈아타면 사라지므로, 새 자루는 강화 없이
  // 세야 합니다. 그 차이를 화면에 안 보여 주면 "왜 갈아탔더니 약해졌지"가 됩니다.
  dpsOf(entry, withBoost) {
    const mul = withBoost ? this.boost : 1;
    const mid = (entry.dmgMin + entry.dmgMax) / 2 * mul;
    // 속도 강화도 같이 사라집니다. 새 자루는 맨 속도로 셉니다.
    const speed = withBoost ? this.speedMult : 1;
    return Math.round(mid * (entry.shots || 1) * entry.acc * 1000 / (entry.rate / speed));
  }

  addPlus() { this.plus++; }

  addHaste() { this.haste++; }

  // 가짜 함정에 당했을 때. 0 아래로는 내려가지 않습니다.
  losePlus(n) { this.plus = Math.max(0, this.plus - n); }
  loseHaste(n) { this.haste = Math.max(0, this.haste - n); }

  // ×2는 겹치지 않습니다. 한 번으로 이미 한계까지 밀어 올리기 때문입니다.
  addDouble() { this.mult = Math.min(CFG.maxMult, this.mult * 2); }

  takeRelic(relic) {
    if (!relic || this.hasRelic(relic.key)) return false;
    this.relics.push(relic);
    return true;
  }

  // 지금 상태를 도감에 남깁니다. 죽을 때 여기서 하나를 뽑아 계승합니다.
  // 자루를 갈아탈 때와 죽을 때 부르면 각 자루의 "마지막 상태"가 모입니다.
  record() {
    Save.recordWeapon(this.job.key, this.index, this.plus, this.mult, this.haste);
  }

  // 다른 자루로 갈아탑니다. **강화는 전부 두고 갑니다.**
  //
  // 유물과 속도 한계 메달(capBonus)은 남습니다 — 그것들은 자루에 붙은 것이
  // 아니라 그 판에서 얻은 것이라, 무기를 바꾼다고 잃을 이유가 없습니다.
  swapTo(entry) {
    if (!entry || entry.index === this.index) return false;
    this.record(); // 두고 가는 자루를 도감에 남기고 갈아탑니다
    this.index = entry.index;
    this.plus = 0;
    this.haste = 0;
    this.mult = 1;
    return true;
  }
}
