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
    key: 'armor', price: 1,
    title: '덧댄 갑옷', desc: '방어력 +12%로 시작합니다 (도적은 회피 +5%)',
  },
  {
    key: 'plus', price: 2,
    title: '벼려둔 날', desc: '무기에 +1 강화 셋을 붙이고 시작합니다',
  },
  {
    key: 'haste', price: 2,
    title: '가벼운 손', desc: '공격 속도 강화 넷을 붙이고 시작합니다',
  },
  {
    // 공격 속도에는 한계가 있습니다. 그 한계를 미는 것은 메달로만 됩니다 —
    // 지도에서 아무리 주워도 넘지 못하는 선이라, 이 물건이 값어치를 갖습니다.
    key: 'speedcap', price: 3,
    title: '풀린 손목',
    desc: '공격 속도 한계가 ×' + CFG.speedCapBase.toFixed(1) +
      ' → ×' + (CFG.speedCapBase + CFG.speedCapBonus).toFixed(1),
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
  // 갑옷을 안 입는 직업에게는 같은 값을 회피로 줍니다 — 진열에서 빼면
  // 도적만 살 것이 하나 적어지고, 그건 값을 매기는 문제와 상관없는 손해입니다.
  if (boosts.armor) {
    if (scene.job.usesArmor) {
      scene.armor = Math.min(scene.armorMax, scene.armor + 12);
      applied.push('방어 +12%');
    } else {
      scene.dodge = Math.min(scene.dodgeMax, scene.dodge + CFG.dodge.shopGain);
      applied.push('회피 +' + Math.round(CFG.dodge.shopGain * 100) + '%');
    }
  }

  // 속도 한계부터 올립니다. 아래에서 붙이는 속도 강화가 옛 한계에 잘리지 않도록.
  if (boosts.speedcap) {
    scene.weapon.capBonus = CFG.speedCapBonus;
    applied.push('속도 한계 ×' + scene.weapon.speedCap.toFixed(1));
  }

  // 무기 계승이 그다음입니다. 단계를 갈아 끼운 뒤에 강화를 얹어야
  // 얹은 강화가 초기화되지 않습니다 (UP은 +1과 속도를 지웁니다).
  if (boosts.weapon) {
    // 단계와 공격력 강화만 넘어옵니다. 공격 속도는 무기가 아니라 손에 붙는 것이라
    // 판이 끝나면 사라져야 합니다 — 넘겨 주면 매 판 한계에서 시작하게 됩니다.
    const w = boosts.weapon;
    scene.weapon.tier = Math.min(scene.weapon.table.length - 1, w.tier);
    scene.weapon.plus = w.plus || 0;
    applied.push('계승  ' + scene.weapon.name);
  } else if (boosts.tier) {
    scene.weapon.upgrade();
    applied.push(scene.weapon.name);
  }

  if (boosts.plus) {
    for (let i = 0; i < 3; i++) scene.weapon.addPlus();
    applied.push('+1 ×3');
  }
  if (boosts.haste) {
    for (let i = 0; i < 4; i++) scene.weapon.addHaste();
    applied.push('공격 속도 ×' + scene.weapon.speedMult.toFixed(2));
  }

  return applied;
}
