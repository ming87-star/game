// 탑의 층을 만들어 냅니다. 그리기와는 분리된 순수 로직입니다.

const SLOT = {
  EMPTY: 'empty',
  ENEMY: 'enemy',
  HEAL: 'heal',
  PLUS: 'plus',       // +1  현재 무기 공격력 상승
  DOUBLE: 'double',   // ×2  발사체 두 배
  UPGRADE: 'upgrade', // UP  다음 단계 무기 (강화는 초기화)
  SHOP: 'shop',
};

// 시간이 지나면 사라지는 것들. 상점과 적은 해당하지 않습니다.
const ITEM_KINDS = new Set([SLOT.PLUS, SLOT.DOUBLE, SLOT.UPGRADE, SLOT.HEAL]);

// 발판 위에 띄울 표시. 나중에 아이템 그림이 나오면 여기만 바꾸면 됩니다.
const SLOT_MARK = {
  [SLOT.PLUS]:    { label: '+1', color: 0xffd54f, text: '#3e2723' },
  [SLOT.DOUBLE]:  { label: '×2', color: 0x4fc3f7, text: '#01579b' },
  [SLOT.UPGRADE]: { label: 'UP', color: 0xff8a65, text: '#3e2723' },
  [SLOT.HEAL]:    { label: '＋', color: 0x66bb6a, text: '#1b5e20' },
};

function floorY(index) {
  return CFG.groundY - index * CFG.floorHeight;
}

function isShopFloor(index) {
  return index > 0 && index % CFG.shopEvery === 0;
}

function pickKind(index) {
  // 층이 높아질수록 적이 있는 발판이 늘어납니다.
  const enemyChance = Math.min(0.5, 0.20 + index * 0.011);
  const r = Math.random();
  if (r < enemyChance) return SLOT.ENEMY;

  let acc = enemyChance;
  if (r < (acc += 0.14)) return SLOT.PLUS;
  if (r < (acc += 0.08)) return SLOT.HEAL;
  if (r < (acc += 0.06)) return SLOT.UPGRADE;
  if (r < (acc += 0.02)) return SLOT.DOUBLE;
  return SLOT.EMPTY;
}

function enemyCountFor(index) {
  const base = 1 + Math.floor(index / 18);
  return Math.min(3, base + (Math.random() < 0.3 ? 1 : 0));
}

// 그 층에 나올 수 있는 적 종류 중 하나를 비중에 따라 고릅니다.
function pickEnemyType(index) {
  const pool = CFG.enemyTypes.filter((t) => index >= t.from);
  const weights = pool.map((t) => Math.max(0.2, t.w0 + (index - t.from) * t.wGrow));
  const total = weights.reduce((a, b) => a + b, 0);

  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].key;
  }
  return pool[pool.length - 1].key;
}

function makeSlot(index, lane) {
  const kind = pickKind(index);
  const slot = {
    lane,
    kind,
    x: CFG.laneX[lane],
    y: floorY(index),
    enemyCount: 0,
    enemyTypes: [],
    taken: false,
    spawned: false,
    armed: false,   // 사라지는 시계가 돌기 시작했는지
    armedAt: 0,     // 그 시계를 켠 시각 (게임 시작 직후면 0일 수 있습니다)
    expired: false, // 시간이 다 되어 사라졌는지
  };

  if (kind === SLOT.ENEMY) {
    slot.enemyCount = enemyCountFor(index);
    for (let i = 0; i < slot.enemyCount; i++) slot.enemyTypes.push(pickEnemyType(index));
  }
  return slot;
}

function blankSlot(index, lane, kind) {
  return {
    lane, kind,
    x: CFG.laneX[lane],
    y: floorY(index),
    enemyCount: 0, enemyTypes: [], taken: false, spawned: false,
    armed: false, armedAt: 0, expired: false,
  };
}

// 한 층을 만듭니다. 양쪽이 같은 내용이면 한쪽을 다시 굴려서
// "어느 쪽으로 갈까"가 늘 의미 있는 선택이 되게 합니다.
function makeFloor(index) {
  const floor = { index, y: floorY(index), slots: {}, shop: false };

  if (index === 0) {
    floor.slots.left = blankSlot(0, 'left', SLOT.EMPTY);
    floor.slots.right = blankSlot(0, 'right', SLOT.EMPTY);
    return floor;
  }

  // 상점 층은 가운데 넓은 발판 하나뿐입니다. 어느 쪽을 눌러도 여기로 옵니다.
  if (isShopFloor(index)) {
    floor.shop = true;
    const slot = blankSlot(index, 'left', SLOT.SHOP);
    slot.x = CFG.width / 2;
    floor.slots.left = slot;
    return floor;
  }

  // 가끔 한쪽 길만 나옵니다. 이때는 어느 쪽을 눌러도 그 길로 갑니다.
  if (index > 2 && Math.random() < 0.15) {
    const lane = Math.random() < 0.5 ? 'left' : 'right';
    floor.slots[lane] = makeSlot(index, lane);
    return floor;
  }

  floor.slots.left = makeSlot(index, 'left');
  floor.slots.right = makeSlot(index, 'right');

  let guard = 0;
  while (floor.slots.left.kind === floor.slots.right.kind && guard++ < 6) {
    floor.slots.right = makeSlot(index, 'right');
  }
  return floor;
}
