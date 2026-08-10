// 무기 한 자루의 상태. 무기표는 직업이 들고 옵니다.
//
// 단계(tier)와 강화(+1, 속, ×2)가 따로 놉니다.
//   +1  공격력을 올림
//   속  공격 속도를 올림 (더하기)
//   ×2  공격 속도 두 배 — 귀합니다
//   UP  다음 단계로. 대신 강화는 전부 초기화
//
// 유물(relics)은 강화가 아닙니다. 200층부터 구간마다 하나씩, 셋 중 골라
// 가져옵니다. 여러 개를 겹쳐 들 수 있고 UP을 먹어도 사라지지 않습니다.
// 속도 한계(capBonus)도 강화가 아닙니다 — 메달로 산 것이라 판 내내 남습니다.
class Weapon {
  constructor(job) {
    this.job = job;
    this.tier = 0;
    this.plus = 0;
    this.haste = 0;
    this.mult = 1;
    this.capBonus = 0;
    this.relics = [];
  }

  get table() { return this.job.weapons; }
  get base() { return this.table[this.tier]; }
  get name() { return this.base.name; }
  get color() { return this.base.color; }

  // 도적은 +1 하나가 절반 값입니다 (job.plusScale).
  get plusValue() { return this.plus * (this.job.plusScale || 1); }
  get dmg() { return Math.round(this.base.dmg * (1 + this.plusValue * CFG.plusStep)); }

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
  relicSum(prop) { return this.relics.reduce((a, r) => a + (r[prop] || 0), 0); }
  relicMul(prop) { return this.relics.reduce((a, r) => a * (r[prop] || 1), 1); }
  hasRelic(key) { return this.relics.some((r) => r.key === key); }

  // 근접 — 이 거리 안의 적을 한 번에 모두 벱니다.
  get reach() { return (this.base.reach || 0) * this.relicMul('reachScale'); }

  // 원거리 — 한 발이 적 하나를 칩니다.
  get range() { return this.base.range || 0; }
  get shots() { return this.base.shots || 1; }
  get bounce() { return this.relicSum('bounce'); }
  get homing() { return !!this.base.homing; }

  // 도적의 절도. 유물이 있으면 확률과 액수가 함께 오릅니다.
  get stealChance() { return this.job.steal + this.relicSum('stealBonus'); }
  get stealAmount() { return 1 + this.relicSum('stealAmount'); }

  get atMaxTier() { return this.tier >= this.table.length - 1; }
  get nextName() { return this.atMaxTier ? null : this.table[this.tier + 1].name; }

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
  // 단계를 갈아탈 때와 죽을 때 부르면 각 단계의 "마지막 상태"가 모입니다.
  record() {
    Save.recordWeapon(this.job.key, this.tier, this.plus, this.mult, this.haste);
  }

  // 다음 단계로. 공격력 강화는 잃지만 공격 속도는 남습니다.
  //
  // 속도를 같이 지우면 25층마다 한 번씩 원점으로 돌아가서, 속을 아무리 주워도
  // ×1.3 언저리를 맴돕니다. 그러면 한계도 그것을 미는 메달도 뜻이 없어집니다.
  // 속도는 칼날이 아니라 손에 붙는 것으로 봅니다 — 무기를 바꿔도 남습니다.
  // 유물과 속도 한계도 같은 이유로 남습니다.
  upgrade() {
    if (this.atMaxTier) return false;
    this.record(); // 두고 가는 무기를 도감에 남기고 올라갑니다
    this.tier++;
    this.plus = 0;
    return true;
  }
}
