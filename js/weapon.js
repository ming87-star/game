// 무기 한 자루의 상태. 무기표는 직업이 들고 옵니다.
//
// 단계(tier)와 강화(+1, ×2)가 따로 놉니다.
//   +1  공격력을 올림
//   ×2  공격 속도 두 배
//   UP  다음 단계로. 대신 강화는 전부 초기화
//
// 유물(relic)은 강화가 아닙니다. 한 판에 한 번 나올까 말까 한 물건이고,
// UP을 먹어도 사라지지 않습니다.
class Weapon {
  constructor(job) {
    this.job = job;
    this.tier = 0;
    this.plus = 0;
    this.mult = 1;
    this.relic = null;
  }

  get table() { return this.job.weapons; }
  get base() { return this.table[this.tier]; }
  get name() { return this.base.name; }
  get color() { return this.base.color; }

  // 도적은 +1 하나가 절반 값입니다 (job.plusScale).
  get plusValue() { return this.plus * (this.job.plusScale || 1); }
  get dmg() { return Math.round(this.base.dmg * (1 + this.plusValue * CFG.plusStep)); }
  get rate() { return this.base.rate / this.mult; }

  // 근접 — 이 거리 안의 적을 한 번에 모두 벱니다.
  get reach() {
    const scale = this.relic && this.relic.reachScale ? this.relic.reachScale : 1;
    return (this.base.reach || 0) * scale;
  }

  // 원거리 — 한 발이 적 하나를 칩니다.
  get range() { return this.base.range || 0; }
  get shots() { return this.base.shots || 1; }
  get bounce() { return this.relic && this.relic.bounce ? this.relic.bounce : 0; }
  get homing() { return !!this.base.homing; }

  // 도적의 절도. 유물이 있으면 확률과 액수가 함께 오릅니다.
  get stealChance() {
    return this.job.steal + (this.relic && this.relic.stealBonus ? this.relic.stealBonus : 0);
  }
  get stealAmount() {
    return this.relic && this.relic.stealAmount ? this.relic.stealAmount : 1;
  }

  get atMaxTier() { return this.tier >= this.table.length - 1; }
  get nextName() { return this.atMaxTier ? null : this.table[this.tier + 1].name; }

  addPlus() { this.plus++; }

  // 두 배가 계속 겹치면 지수로 늘어나 손쓸 수 없게 됩니다. 상한을 둡니다.
  addDouble() { this.mult = Math.min(CFG.maxMult, this.mult * 2); }

  takeRelic() {
    if (this.relic) return false;
    this.relic = this.job.relic;
    return true;
  }

  // 다음 단계로. 강화는 잃지만 유물은 남습니다.
  upgrade() {
    if (this.atMaxTier) return false;
    this.tier++;
    this.plus = 0;
    this.mult = 1;
    return true;
  }
}
