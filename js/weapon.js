// 무기 한 자루의 상태. 단계(tier)와 강화(+1, ×2)를 따로 들고 있습니다.
class Weapon {
  constructor() {
    this.tier = 0;
    this.plus = 0;  // +1 을 먹은 횟수
    this.mult = 1;  // ×2 를 먹을 때마다 두 배
  }

  get base() { return CFG.weapons[this.tier]; }
  get name() { return this.base.name; }
  get rate() { return this.base.rate; }
  get range() { return this.base.range; }
  get color() { return this.base.color; }
  get speed() { return this.base.speed; }

  get dmg() { return Math.round(this.base.dmg * (1 + this.plus * CFG.plusStep)); }
  get shots() { return Math.min(CFG.maxShots, this.base.shots * this.mult); }

  get atMaxTier() { return this.tier >= CFG.weapons.length - 1; }
  get nextName() { return this.atMaxTier ? null : CFG.weapons[this.tier + 1].name; }

  addPlus() { this.plus++; }

  // 두 배가 계속 겹치면 지수로 늘어나 손쓸 수 없게 됩니다. 상한을 둡니다.
  addDouble() { this.mult = Math.min(CFG.maxMult, this.mult * 2); }
  get multMaxed() { return this.mult >= CFG.maxMult; }

  // 다음 단계로. 강화는 전부 잃습니다 — 그래서 먹을지 말지가 판단이 됩니다.
  upgrade() {
    if (this.atMaxTier) return false;
    this.tier++;
    this.plus = 0;
    this.mult = 1;
    return true;
  }
}
