// 탑의 층을 만들어 냅니다. 그리기와는 분리된 순수 로직입니다.

const SLOT = {
  EMPTY: 'empty',
  ENEMY: 'enemy',
  ITEM: 'item',
  HEAL: 'heal',
};

function floorY(index) {
  return CFG.groundY - index * CFG.floorHeight;
}

function pickKind(index) {
  // 층이 높아질수록 적이 있는 발판이 늘어납니다.
  const enemyChance = Math.min(0.55, 0.20 + index * 0.012);
  const r = Math.random();
  if (r < enemyChance) return SLOT.ENEMY;
  if (r < enemyChance + 0.09) return SLOT.ITEM;
  if (r < enemyChance + 0.15) return SLOT.HEAL;
  return SLOT.EMPTY;
}

function enemyCountFor(index) {
  const base = 1 + Math.floor(index / 14);
  return Math.min(3, base + (Math.random() < 0.3 ? 1 : 0));
}

function makeSlot(index, lane) {
  const kind = pickKind(index);
  return {
    lane,
    kind,
    x: CFG.laneX[lane],
    y: floorY(index),
    enemyCount: kind === SLOT.ENEMY ? enemyCountFor(index) : 0,
    taken: false,   // 아이템을 이미 먹었는지
    spawned: false, // 적을 이미 내보냈는지
  };
}

// 한 층을 만듭니다. 양쪽이 같은 내용이면 한쪽을 다시 굴려서
// "어느 쪽으로 갈까"가 늘 의미 있는 선택이 되게 합니다.
function makeFloor(index) {
  const floor = { index, y: floorY(index), slots: {} };

  if (index === 0) {
    floor.slots.left = { lane: 'left', kind: SLOT.EMPTY, x: CFG.laneX.left, y: floorY(0), enemyCount: 0, taken: false, spawned: false };
    floor.slots.right = { lane: 'right', kind: SLOT.EMPTY, x: CFG.laneX.right, y: floorY(0), enemyCount: 0, taken: false, spawned: false };
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
