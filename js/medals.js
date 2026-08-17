// 메달 상점에 진열되는 물건.
//
// ── 한 판짜리에서 영구로 ──────────────────────────────────
//
// 예전에는 여기서 산 것이 **이번 판 시작 상태**였습니다. 한 판 쓰면 사라지고,
// 다음 판에는 다시 사야 했습니다. 그러면 이 화면이 "매 판 거쳐 가는 절차"가
// 되고, 죽고 나서 손에 남는 것이 없습니다.
//
// **메달 상점이 하는 일은 하나입니다 — 죽어도 또 켜게 만드는 것.**
// 그러려면 다음 판이 지난 판보다 나아야 합니다. 그래서 지금은 한 번 사면
// **그 직업에게 영영** 붙습니다 (js/save.js 의 perks).
//
// 직업마다 따로 쌓입니다. 전사로 산 것이 궁수에게 붙으면, 새 직업을 여는 것이
// 곧 다 갖춘 채로 시작하는 것이 되어 여는 재미가 없어집니다. 메달 자체는
// 하나의 주머니라, 전사로 번 것으로 궁수 것을 사도 됩니다.
//
// ── 값과 크기를 같이 손봤습니다 ───────────────────────────
//
// 영구가 되었으니 **값은 오르고 크기는 내려가야** 합니다.
//   · 값 2~3배 — 한 번 사면 끝이므로 그만큼 멀리 있어야 합니다
//   · 크기 3~4할 인하 — 매 판 붙는 것이라 예전 크기면 곧 게임이 싱거워집니다
//
// 값은 메달 단위입니다. 상점 하나당 메달 하나(50층), 큰 상점은 둘(100층),
// 보스는 셋. 200층까지 가는 판이 대략 일곱입니다 — 3메달짜리는 "한 판 반",
// 8메달짜리는 "네댓 판"이라는 뜻입니다. 이 환산을 염두에 두고 값을 매기세요.
//
// 「벼려 둔 자루」(둘째 무기를 들고 시작)는 뺐습니다. 무기가 사다리에서
// 주머니로 바뀌면서 "둘째 자루"라는 것이 더 좋은 것을 뜻하지 않게 됐습니다 —
// 첫 자루의 만듦새 판일 뿐이라, 값을 치르고 사기에는 무엇을 사는 건지가
// 흐렸습니다.
const MEDAL_ITEMS = [
  {
    key: 'coins', price: 2,
    title: '노잣돈', desc: '코인 70을 들고 시작합니다',
  },
  {
    key: 'hp', price: 3,
    title: '튼튼한 몸', desc: '최대 체력 +25',
  },
  {
    key: 'armor', price: 3,
    title: '덧댄 갑옷', desc: '방어력 +8% (도적은 회피 +3%)',
  },
  {
    key: 'plus', price: 5,
    title: '벼려둔 날', desc: '무기에 +1 강화 둘을 붙이고 시작합니다',
  },
  {
    key: 'haste', price: 5,
    title: '가벼운 손', desc: '공격 속도 강화 둘을 붙이고 시작합니다',
  },
  {
    // 공격 속도에는 한계가 있습니다. 그 한계를 미는 것은 메달로만 됩니다 —
    // 지도에서 아무리 주워도 넘지 못하는 선이라, 이 물건이 값어치를 갖습니다.
    // 가장 비쌉니다. 다른 것들은 숫자를 올리지만 이것만은 **천장을 옮깁니다.**
    key: 'speedcap', price: 8,
    title: '풀린 손목', desc: '공격 속도 한계 +' + CFG.speedCapBonus.toFixed(1),
  },
];

// 갑옷을 안 입는 직업(도적)에게는 방어구를 팔지 않습니다.
function medalItemsFor(job) {
  return MEDAL_ITEMS.filter((it) => !it.needsArmor || job.usesArmor);
}

// 산 것을 실제 상태에 바릅니다. 판이 시작될 때 한 번 불립니다.
// scene은 GameScene입니다 — maxHp·hp·armor·coins·weapon이 이미 준비된 뒤여야 합니다.
//
// perks 는 그 직업이 **영영 지닌 것**, boosts 는 이번 판에만 쓰는 것(무기 계승)입니다.
function applyBoosts(scene, perks, boosts) {
  const applied = [];

  if (perks.hp) {
    scene.maxHp += 25;
    scene.hp = scene.maxHp;
    applied.push('체력 +25');
  }
  if (perks.coins) {
    scene.coins = 70;
    scene.totalCoins = 70;
    applied.push('코인 70');
  }
  // 갑옷을 안 입는 직업에게는 같은 값을 회피로 줍니다 — 진열에서 빼면
  // 도적만 살 것이 하나 적어지고, 그건 값을 매기는 문제와 상관없는 손해입니다.
  if (perks.armor) {
    if (scene.job.usesArmor) {
      scene.armor = Math.min(scene.armorMax, scene.armor + 8);
      applied.push('방어 +8%');
    } else {
      scene.dodge = Math.min(scene.dodgeMax, scene.dodge + 0.03);
      applied.push('회피 +3%');
    }
  }

  // 속도 한계부터 올립니다. 아래에서 붙이는 속도 강화가 옛 한계에 잘리지 않도록.
  if (perks.speedcap) {
    scene.weapon.capBonus = CFG.speedCapBonus;
    applied.push('속도 한계 ×' + scene.weapon.speedCap.toFixed(2));
  }

  // 무기 계승이 그다음입니다. 자루를 갈아 끼운 뒤에 강화를 얹어야
  // 얹은 강화가 초기화되지 않습니다 (갈아타면 강화가 지워집니다).
  if (boosts.weapon) {
    // 자루와 공격력 강화만 넘어옵니다. 공격 속도는 판이 끝나면 사라져야 합니다 —
    // 넘겨 주면 매 판 한계에서 시작하게 됩니다.
    const w = boosts.weapon;
    scene.weapon.index = Math.min(scene.weapon.table.length - 1, w.index || 0);
    scene.weapon.plus = w.plus || 0;
    applied.push('계승  ' + scene.weapon.name);
  }

  if (perks.plus) {
    for (let i = 0; i < 2; i++) scene.weapon.addPlus();
    applied.push('+1 ×2');
  }
  if (perks.haste) {
    for (let i = 0; i < 2; i++) scene.weapon.addHaste();
    applied.push('공격 속도 ×' + scene.weapon.speedMult.toFixed(2));
  }

  return applied;
}
