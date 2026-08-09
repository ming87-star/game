// 탑의 층을 만들어 냅니다. 그리기와는 분리된 순수 로직입니다.

const LANES = ['left', 'mid', 'right'];

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

// ── UP의 자리 ───────────────────────────────────────────
// UP만은 확률로 뿌리지 않습니다. shopEvery 층마다 정확히 한 번,
// 그 구간 안의 무작위한 층에 놓입니다. 상점에서도 한 번 살 수 있으니
// 무기 단계는 한 구간에 최대 두 번 오릅니다 — 운이 아니라 계획의 문제가 됩니다.
let upFloorByBand = new Map();

function resetTowerRun() {
  upFloorByBand = new Map();
}

function upFloorFor(index) {
  const band = Math.floor((index - 1) / CFG.shopEvery);
  if (!upFloorByBand.has(band)) {
    // 구간의 마지막 층은 상점이므로 비워 둡니다.
    const start = band * CFG.shopEvery + 1;
    upFloorByBand.set(band, start + Math.floor(Math.random() * (CFG.shopEvery - 1)));
  }
  return upFloorByBand.get(band);
}

// ── 한 칸에 무엇이 놓일까 ───────────────────────────────
function pickKind(index) {
  const c = CFG.slotChance;
  const enemyChance = Math.min(c.enemyMax, c.enemyBase + index * c.enemyPerFloor);

  const r = Math.random();
  if (r < enemyChance) return SLOT.ENEMY;

  let acc = enemyChance;
  if (r < (acc += c.plus)) return SLOT.PLUS;
  if (r < (acc += c.heal)) return SLOT.HEAL;
  if (r < (acc += c.double)) return SLOT.DOUBLE;
  return SLOT.EMPTY;
}

function enemyCountFor(index) {
  const base = 1 + Math.floor(index / 22);
  return Math.min(3, base + (Math.random() < 0.25 ? 1 : 0));
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

function blankSlot(index, lane, kind) {
  return {
    lane, kind,
    x: CFG.laneX[lane],
    y: floorY(index),
    enemyCount: 0, enemyTypes: [], taken: false, spawned: false,
    armed: false, armedAt: 0, expired: false,
  };
}

function makeSlot(index, lane) {
  const slot = blankSlot(index, lane, pickKind(index));
  if (slot.kind === SLOT.ENEMY) {
    slot.enemyCount = enemyCountFor(index);
    for (let i = 0; i < slot.enemyCount; i++) slot.enemyTypes.push(pickEnemyType(index));
  }
  return slot;
}

// ── 한 층 ───────────────────────────────────────────────
// 길이 늘 셋인 것은 아닙니다. 둘로 좁아지거나 외길이 되기도 합니다.
function pickLanes(index) {
  if (index <= 2) return LANES.slice();

  const r = Math.random();
  if (r < 0.45) return LANES.slice();
  if (r < 0.90) {
    const drop = LANES[Math.floor(Math.random() * LANES.length)];
    return LANES.filter((l) => l !== drop);
  }
  return [LANES[Math.floor(Math.random() * LANES.length)]];
}

// 같은 아이템이 둘 이상 놓이면 고를 것이 없으니 한쪽을 다시 굴립니다.
// 빈 칸끼리·적끼리는 그냥 둡니다. 여기서까지 다시 굴리면 "빈 칸이 남을 확률"이
// 사라져서, 기본 확률을 아무리 낮춰도 아이템이 넘쳐납니다.
function dedupeItems(floor, index, lanes) {
  for (let pass = 0; pass < 4; pass++) {
    const seen = new Set();
    let clash = null;

    for (const lane of lanes) {
      const kind = floor.slots[lane].kind;
      if (!ITEM_KINDS.has(kind)) continue;
      if (seen.has(kind)) { clash = lane; break; }
      seen.add(kind);
    }
    if (!clash) return;
    floor.slots[clash] = makeSlot(index, clash);
  }
}

function makeFloor(index) {
  const floor = { index, y: floorY(index), slots: {}, shop: false };

  if (index === 0) {
    LANES.forEach((lane) => { floor.slots[lane] = blankSlot(0, lane, SLOT.EMPTY); });
    return floor;
  }

  // 상점 층은 가운데 넓은 발판 하나뿐입니다. 어느 쪽을 눌러도 여기로 옵니다.
  if (isShopFloor(index)) {
    floor.shop = true;
    floor.slots.mid = blankSlot(index, 'mid', SLOT.SHOP);
    return floor;
  }

  const lanes = pickLanes(index);
  lanes.forEach((lane) => { floor.slots[lane] = makeSlot(index, lane); });
  dedupeItems(floor, index, lanes);

  // 이 구간에 하나뿐인 UP이 놓이는 층입니다.
  if (index === upFloorFor(index)) {
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    floor.slots[lane] = blankSlot(index, lane, SLOT.UPGRADE);
  }

  return floor;
}
