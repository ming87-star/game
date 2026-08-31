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
  // ── 공격력 강화의 한계 ────────────────────────────────
  // **자루마다 다릅니다.** 보통은 열(CFG.plusMax)에서 멎고, 무명(無名)만
  // 쉰까지 받습니다 (js/classes.js). 한계가 없던 시절에는 한 자루를
  // 오래 들고 다니며 계속 벼리는 것이 늘 옳아서, 갈아타기 창이 물어보는
  // 것이 사실은 물어보는 것이 아니었습니다.
  get plusMax() { return this.base.plusMax || CFG.plusMax; }
  get plusCapped() { return this.plus >= this.plusMax; }
  // +1 하나가 올려 주는 몫도 자루마다 다릅니다. 무명은 늦게 시작해서 멀리
  // 가야 하므로 걸음이 두 배 남짓입니다 (직업마다 조금씩 다릅니다).
  get plusStep() { return this.base.plusStep || CFG.plusStep; }

  get plusValue() { return this.plus * (this.job.plusScale || 1); }
  get boost() { return 1 + this.plusValue * this.plusStep; }
  get dmgMin() { return Math.max(1, Math.round(this.base.dmgMin * this.boost * this.heavier)); }
  get dmgMax() { return Math.max(1, Math.round(this.base.dmgMax * this.boost * this.heavier)); }
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

  // ── 자루가 스스로 지닌 것 넷 ────────────────────────────
  // 마법사의 지팡이는 피해만 주지 않습니다 (js/classes.js). 여기 있던 넷은
  // 지금까지 **유물에만** 붙어 있었습니다 — 자루도 지닐 수 있게 엽니다.
  //
  // 관통만 유물과 더합니다. 「관통하는 기름」을 꿰뚫는 지팡이에 발라 두면
  // 더 깊이 뚫리는 것이 자연스럽습니다. 나머지 셋은 자루의 것이거나 아니거나
  // 둘 중 하나라 더하지 않습니다.

  // 맞은 자리가 계속 탑니다. 한 대의 몇 할이 지속 피해로 얹히는가.
  get burn() { return (this.base.burn || 0) * this.relicMul('springMul'); }

  // 뒤에 선 것까지 꿰뚫습니다. 이만큼 더 지나갑니다.
  get pierce() {
    return Math.round((this.base.pierce || 0) * this.relicMul('springMul'))
      + this.relicSum('pierceOil');
  }

  // 닿은 자리가 터집니다. 곁에 선 것도 함께 맞습니다.
  get aoe() { return this.base.aoe || 0; }

  // 연쇄번개 — 맞은 놈에서 곁으로 이만큼 더 튑니다.
  // 「마르지 않는 샘물」이 지팡이에 걸린 것을 세게 하므로 여기도 걸립니다
  // (화상·관통과 같은 자리). 반올림해서 0.5 이상이면 한 번 더 튑니다.
  get chain() { return Math.round((this.base.chain || 0) * this.relicMul('springMul')); }

  // 장판 — 닿은 자리에 남는 것. 한 대의 몇 할이 그 자리에 깔리는가.
  get field() { return (this.base.field || 0) * this.relicMul('springMul'); }

  // ── 무엇이 날아가는가 ─────────────────────────────────
  //
  // **마법사도 화살을 쏘고 있었습니다.** 깃까지 달린 `arrow` 를 자루
  // 색으로 물들여 쓰는 바람에, 화염폭풍은 분홍 화살이고 서리 지팡이는
  // 흰 화살이었습니다 — 유물 아이콘의 「관통하는 기름」과 같은 병입니다.
  //
  // 지팡이는 **지닌 마법에 따라** 다른 것을 날립니다. 순서가 곧 우선순위
  // 입니다: 튀는 것 > 타는 것 > 뚫거나 어는 것 > 그냥 구슬. 여럿 지닌
  // 자루는 가장 눈에 띄는 것을 앞세웁니다.
  //
  // 활과 석궁은 그대로 화살입니다 — 화살이 맞으니까요.
  get projectile() {
    if (this.job.key !== 'wizard') return 'arrow';
    if (this.chain > 0) return 'cast-spark';
    if (this.burn > 0) return 'cast-flame';
    if (this.pierce > 0 || (this.base.spread || 0) > 0) return 'cast-shard';
    return 'cast-orb';
  }

  // 몸을 감싸는 것이 함께 섭니다. 받는 피해를 이만큼 나눕니다
  // (1.3 이면 100 이 77 로 들어옵니다). 없으면 1 입니다.
  // 「마르지 않는 샘물」이 지팡이에 걸린 것을 세게 합니다 (js/relics.js).
  // 보호막만 따로 낮게 곱합니다 — 받는 피해를 **나누는** 값이라 같은 배수를
  // 쓰면 수호의 지팡이가 1.3 → 1.95 가 되어 절반 아래로 떨어집니다.
  get shield() {
    const base = this.base.shield || 1;
    if (base <= 1) return 1;
    return 1 + (base - 1) * this.relicMul('springShieldMul');
  }

  // 「많이 질수록」 — 지닌 유물 하나당 공격력이 오릅니다 (자기도 셉니다).
  get heavier() {
    const step = this.relicSum('heavierStep');
    return step > 0 ? 1 + this.relics.length * step : 1;
  }

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
    const mul = withBoost ? this.boost : this.giftBoost(entry);
    const mid = (entry.dmgMin + entry.dmgMax) / 2 * mul;
    const speed = withBoost ? this.speedMult : this.giftSpeed(entry);
    return Math.round(mid * (entry.shots || 1) * entry.acc * 1000 / (entry.rate / speed));
  }

  // ── 주워 든 자루에 이미 벼려져 있는 몫 ──────────────────
  // 없으면 1 입니다 (js/forge.js 의 withPickupGift).
  //
  // **`this.boost`·`this.speedMult` 를 쓰면 안 됩니다.** 그건 지금 든
  // 자루의 것이고, plusStep 은 자루마다 다릅니다 (무명은 두 배 남짓).
  giftBoost(entry) {
    const plus = (entry && entry.gift && entry.gift.plus) || 0;
    if (!plus) return 1;
    const step = entry.plusStep || CFG.plusStep;
    return 1 + plus * (this.job.plusScale || 1) * step;
  }

  giftSpeed(entry) {
    const g = (entry && entry.gift) || null;
    if (!g) return 1;
    const raw = (1 + (g.haste || 0) * CFG.hasteStep) * (g.mult || 1);
    // 속도 한계는 자루가 아니라 사람에게 걸립니다 — 갈아타도 그대로입니다.
    return Math.min(this.speedCap, raw);
  }

  // 한계에 닿았으면 아무 일도 안 하고 false 를 돌려줍니다 — 부른 쪽이
  // "붙었다"고 적을지 "이미 한계"라고 적을지를 그것으로 정합니다.
  addPlus() {
    if (this.plusCapped) return false;
    this.plus++;
    return true;
  }

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
    // 주워 든 자루는 **이미 벼려져 있을 수 있습니다** (js/forge.js 의
    // withPickupGift). 벼려진 몫이 그대로 딸려 옵니다 — 든 것을 넘지
    // 않는 선에서 얹힌 것이라, 갈아타도 늘 조금은 잃습니다.
    const g = entry.gift || null;
    this.plus = (g && g.plus) || 0;
    this.haste = (g && g.haste) || 0;
    this.mult = (g && g.mult) || 1;
    return true;
  }
}
