// 메달 상점에 진열되는 물건.
//
// 메달로 사는 것은 전부 "이번 판 시작 상태"입니다. 영구 강화가 아닙니다 —
// 한 판 쓰고 사라지므로, 매번 무엇을 살지 다시 고르게 됩니다.
//
// 값은 메달 단위입니다. 상점 하나당 메달 하나이므로 50층에 하나꼴입니다.
// 3메달짜리를 사려면 150층을 올라야 한다는 뜻입니다 — 이 환산을 염두에 두고
// 값을 매기세요. 난이도를 조절하면서 여기 물건을 갈아 끼우면 됩니다.
const MEDAL_ITEMS = [
  {
    key: 'hp', price: 1,
    title: '튼튼한 몸', desc: '최대 체력 +40으로 시작합니다',
  },
  {
    key: 'coins', price: 1,
    title: '노잣돈', desc: '코인 120을 들고 시작합니다',
  },
  {
    key: 'armor', price: 1, needsArmor: true,
    title: '덧댄 갑옷', desc: '방어력 +12%로 시작합니다',
  },
  {
    key: 'plus', price: 2,
    title: '벼려둔 날', desc: '무기에 +1 강화 셋을 붙이고 시작합니다',
  },
  {
    key: 'double', price: 3,
    title: '가벼운 손', desc: '공격 속도 ×2로 시작합니다',
  },
  {
    key: 'tier', price: 4,
    title: '한 단계 위', desc: '두 번째 무기를 들고 시작합니다',
  },
];

// 갑옷을 안 입는 직업(도적)에게는 방어구를 팔지 않습니다.
function medalItemsFor(job) {
  return MEDAL_ITEMS.filter((it) => !it.needsArmor || job.usesArmor);
}

// 산 것을 실제 상태에 바릅니다. 판이 시작될 때 한 번 불립니다.
// scene은 GameScene입니다 — maxHp·hp·armor·coins·weapon이 이미 준비된 뒤여야 합니다.
function applyBoosts(scene, boosts) {
  const applied = [];

  if (boosts.hp) {
    scene.maxHp += 40;
    scene.hp = scene.maxHp;
    applied.push('체력 +40');
  }
  if (boosts.coins) {
    scene.coins = 120;
    scene.totalCoins = 120;
    applied.push('코인 120');
  }
  if (boosts.armor && scene.job.usesArmor) {
    scene.armor = Math.min(CFG.armor.max, scene.armor + 12);
    applied.push('방어 +12%');
  }

  // 무기 계승이 먼저입니다. 단계를 갈아 끼운 뒤에 강화를 얹어야
  // 얹은 강화가 초기화되지 않습니다 (UP은 +1과 ×2를 지웁니다).
  if (boosts.weapon) {
    const w = boosts.weapon;
    scene.weapon.tier = Math.min(scene.weapon.table.length - 1, w.tier);
    scene.weapon.plus = w.plus;
    scene.weapon.mult = w.mult;
    applied.push('계승  ' + scene.weapon.name);
  } else if (boosts.tier) {
    scene.weapon.upgrade();
    applied.push(scene.weapon.name);
  }

  if (boosts.plus) {
    for (let i = 0; i < 3; i++) scene.weapon.addPlus();
    applied.push('+1 ×3');
  }
  if (boosts.double) {
    scene.weapon.addDouble();
    applied.push('공격 속도 ×' + scene.weapon.mult);
  }

  return applied;
}
