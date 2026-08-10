// 탑의 층을 만들어 냅니다. 그리기와는 분리된 순수 로직입니다.

const LANES = ['left', 'mid', 'right'];

const SLOT = {
  EMPTY: 'empty',
  ENEMY: 'enemy',
  HEAL: 'heal',
  PLUS: 'plus',       // +1  현재 무기 공격력 상승
  HASTE: 'haste',     // 속  공격 속도 상승 (더하기)
  DOUBLE: 'double',   // ×2  공격 속도 두 배. 아주 귀합니다
  ARMOR: 'armor',     // 방  받는 피해 감소
  UPGRADE: 'upgrade', // UP  다음 단계 무기 (강화는 초기화)
  RELIC: 'relic',     // ★  직업 유물. 한 판에 하나뿐
  MEDAL: 'medal',     // 🏅 판을 넘어 남는 화폐. 지도에서는 아주 드물게만
  BOMB: 'bomb',       // 폭 밟으면 체력을 잃습니다. 대놓고 보입니다
  MIMIC: 'mimic',     // 좋은 것인 척하는 함정. 겉모습은 slot.disguise 를 따릅니다
  SHOP: 'shop',
  BOSS: 'boss',       // 보스 투기장. 발판도 상점도 없습니다
};

// 시간이 지나면 사라지는 것들. 상점과 적은 해당하지 않습니다.
const ITEM_KINDS = new Set([SLOT.PLUS, SLOT.HASTE, SLOT.DOUBLE, SLOT.UPGRADE, SLOT.HEAL, SLOT.ARMOR, SLOT.RELIC, SLOT.MEDAL, SLOT.BOMB, SLOT.MIMIC]);

// 발판 위에 띄울 표시. 나중에 아이템 그림이 나오면 여기만 바꾸면 됩니다.
const SLOT_MARK = {
  [SLOT.PLUS]:    { label: '+1', color: 0xffd54f, text: '#3e2723' },
  [SLOT.HASTE]:   { label: '속', color: 0x4fc3f7, text: '#01579b' },
  [SLOT.DOUBLE]:  { label: '×2', color: 0x00e5ff, text: '#006064' },
  [SLOT.UPGRADE]: { label: 'UP', color: 0xff8a65, text: '#3e2723' },
  [SLOT.HEAL]:    { label: '＋', color: 0x66bb6a, text: '#1b5e20' },
  [SLOT.ARMOR]:   { label: '방', color: 0x90a4ae, text: '#263238' },
  [SLOT.RELIC]:   { label: '★', color: 0xffd54f, text: '#3e2723' },
  [SLOT.MEDAL]:   { label: '메', color: 0xffca28, text: '#4e342e' },
  [SLOT.BOMB]:    { label: '폭', color: 0x8e0000, text: '#ffcdd2' },
};

// 가짜가 흉내 낼 수 있는 것들. 메달과 ×2는 뺐습니다 —
// 워낙 귀해서 가짜였을 때의 배신감이 재미를 넘어섭니다.
const MIMIC_DISGUISES = [SLOT.PLUS, SLOT.HASTE, SLOT.ARMOR, SLOT.HEAL];

function floorY(index) {
  return CFG.groundY - index * CFG.floorHeight;
}

// 보스 층이 먼저입니다. 200층은 상점 층이기도 하지만 투기장이 이깁니다.
function isBossFloor(index) {
  return index > 0 && index % CFG.bossEvery === 0;
}

function isShopFloor(index) {
  return index > 0 && index % CFG.shopEvery === 0 && !isBossFloor(index);
}

// 큰 상점 — 도착만 해도 체력을 돌려주는 자리입니다.
function isBigShopFloor(index) {
  return index > 0 && index % CFG.bigShopEvery === 0;
}

// ── UP의 자리 ───────────────────────────────────────────
// UP만은 확률로 뿌리지 않습니다. shopEvery 층마다 정확히 한 번,
// 그 구간 안의 무작위한 층에 놓입니다. 상점에서도 한 번 살 수 있으니
// 무기 단계는 한 구간에 최대 두 번 오릅니다 — 운이 아니라 계획의 문제가 됩니다.
let upFloorByBand = new Map();
let relicFloorByBand = new Map();

function resetTowerRun() {
  upFloorByBand = new Map();
  relicFloorByBand = new Map();
}

// ── 유물의 자리 ─────────────────────────────────────────
// relic.from 층부터 relic.every 층 구간마다 하나씩. 상점 층과 보스 층은 비웁니다.
// -1이면 그 층에는 유물이 없다는 뜻입니다.
function relicFloorFor(index) {
  const r = CFG.relic;
  if (index < r.from) return -1;

  const band = Math.floor((index - r.from) / r.every);
  if (!relicFloorByBand.has(band)) {
    const start = r.from + band * r.every;
    const pick = () => start + Math.floor(Math.random() * r.every);
    let floor = pick();
    for (let i = 0; i < 12 && (isShopFloor(floor) || isBossFloor(floor)); i++) floor = pick();
    relicFloorByBand.set(band, floor);
  }
  return relicFloorByBand.get(band);
}

function upFloorFor(index) {
  const band = Math.floor((index - 1) / CFG.shopEvery);
  if (!upFloorByBand.has(band)) {
    // 구간의 마지막 층은 상점이므로 비워 둡니다.
    const start = band * CFG.shopEvery + 1;
    const pick = () => start + Math.floor(Math.random() * (CFG.shopEvery - 1));

    // 유물도 가운데 칸을 쓰고 UP보다 먼저 놓입니다. 같은 층에 걸리면 UP이
    // 통째로 사라져서 그 구간의 무기 단계 하나를 잃습니다. 자리를 비켜 줍니다.
    let floor = pick();
    for (let i = 0; i < 8 && floor === relicFloorFor(floor); i++) floor = pick();
    upFloorByBand.set(band, floor);
  }
  return upFloorByBand.get(band);
}

// ── 한 칸에 무엇이 놓일까 ───────────────────────────────
// need는 "회복이 얼마나 급한가" 0~1입니다. 체력이 가득이면 0, healFloor 이하면 1.
function healChance(need) {
  const c = CFG.slotChance;
  return c.healFull + (c.healHurt - c.healFull) * need;
}

function pickKind(index, need, usesArmor = true) {
  const c = CFG.slotChance;
  const enemyChance = Math.min(c.enemyMax, c.enemyBase + index * c.enemyPerFloor);

  const r = Math.random();
  if (r < enemyChance) return SLOT.ENEMY;

  let acc = enemyChance;
  // 메달을 가장 먼저 봅니다. 확률이 워낙 작아 순서는 사실 상관없지만,
  // 뒤에 두면 앞의 확률을 만질 때마다 같이 흔들려서 눈에 띄게 해 둡니다.
  if (r < (acc += c.medal)) return SLOT.MEDAL;
  if (r < (acc += c.plus)) return SLOT.PLUS;
  if (r < (acc += c.haste)) return SLOT.HASTE;
  if (r < (acc += healChance(need))) return SLOT.HEAL;
  if (usesArmor && r < (acc += c.armor)) return SLOT.ARMOR;
  if (r < (acc += c.double)) return SLOT.DOUBLE;
  if (r < (acc += c.bomb)) return SLOT.BOMB;
  if (r < (acc += c.mimic)) return SLOT.MIMIC;
  return SLOT.EMPTY;
}

// 체력 비율을 "회복이 급한 정도"로 바꿉니다.
function healNeedFrom(hp, maxHp) {
  const ratio = maxHp > 0 ? hp / maxHp : 1;
  const floor = CFG.slotChance.healFloor;
  if (ratio >= 1) return 0;
  if (ratio <= floor) return 1;
  return (1 - ratio) / (1 - floor);
}

// 땅을 딛는 적은 위층까지 쫓아오지 못합니다. 대신 발판을 지키고 있으므로,
// 마릿수로 밀도를 맞춥니다. 한 발판에 여럿이 진을 치고 있는 그림입니다.
function enemyCountFor(index) {
  const c = CFG.enemyCount;
  const base = 1 + Math.floor(index / c.per);
  const cap = Math.min(c.capMax,
    Math.floor(c.capBase + Math.floor(index / CFG.shopEvery) * c.capPerShop));
  return Math.max(1, Math.min(cap, base + (Math.random() < 0.3 ? 1 : 0)));
}

// 한 종류의 등장 비중. 나온 뒤 서서히 흔해지고, 다음 종류가 풀리면 물러납니다.
function typeWeight(def, index) {
  if (index < def.from) return 0;
  const w = CFG.enemyWave;

  // 등장 직후엔 드물다가 rampFloors 층에 걸쳐 제 비중까지 올라옵니다.
  const ramp = Math.min(1, 0.3 + 0.7 * (index - def.from) / w.rampFloors);

  // 다음 종류가 풀린 뒤부터 절반씩 줄어듭니다.
  const next = CFG.enemyTypes.find((t) => t.from > def.from);
  const fade = next
    ? Math.pow(0.5, Math.max(0, index - next.from) / w.fadeHalfLife)
    : 1;

  return Math.max(w.minWeight, def.w0 * ramp * fade);
}

// 그 층에 나올 수 있는 적 종류 중 하나를 비중에 따라 고릅니다.
function pickEnemyType(index) {
  const pool = CFG.enemyTypes.filter((t) => index >= t.from);
  const weights = pool.map((t) => typeWeight(t, index));
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
    enemyCount: 0, enemyTypes: [], disguise: null, taken: false, spawned: false,
    armed: false, armedAt: 0, expired: false,
  };
}

function makeSlot(index, lane, need, usesArmor) {
  const slot = blankSlot(index, lane, pickKind(index, need, usesArmor));

  // 가짜는 무엇인 척할지 정합니다. 갑옷을 안 입는 직업에게 갑옷인 척해 봐야
  // 진짜도 안 나오는 것이라 들통납니다.
  if (slot.kind === SLOT.MIMIC) {
    const pool = MIMIC_DISGUISES.filter((k) => usesArmor || k !== SLOT.ARMOR);
    slot.disguise = pool[Math.floor(Math.random() * pool.length)];
  }

  if (slot.kind === SLOT.ENEMY) {
    slot.enemyCount = enemyCountFor(index);
    for (let i = 0; i < slot.enemyCount; i++) slot.enemyTypes.push(pickEnemyType(index));
  }
  return slot;
}

// ── 한 층 ───────────────────────────────────────────────
// 길이 늘 셋인 것은 아닙니다. 둘로 좁아지거나 외길이 되기도 합니다.
//
// 다만 가운데 길은 반드시 있습니다. 주인공은 한 번에 한 칸씩만 옮겨 가므로,
// 왼쪽 끝에 서 있는데 다음 층에 오른쪽 길만 있으면 갈 곳이 없어집니다.
// 가운데가 늘 열려 있으면 어느 자리에서든 최소한 한 곳은 닿습니다.
function pickLanes(index) {
  if (index <= 2) return LANES.slice();

  const r = Math.random();
  if (r < 0.45) return LANES.slice();
  if (r < 0.90) return Math.random() < 0.5 ? ['left', 'mid'] : ['mid', 'right'];
  return ['mid'];
}

// 같은 아이템이 둘 이상 놓이면 고를 것이 없으니 한쪽을 다시 굴립니다.
// 빈 칸끼리·적끼리는 그냥 둡니다. 여기서까지 다시 굴리면 "빈 칸이 남을 확률"이
// 사라져서, 기본 확률을 아무리 낮춰도 아이템이 넘쳐납니다.
function dedupeItems(floor, index, lanes, need, usesArmor) {
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
    floor.slots[clash] = makeSlot(index, clash, need, usesArmor);
  }
}

function makeFloor(index, need = 0, usesArmor = true) {
  const floor = { index, y: floorY(index), slots: {}, shop: false };

  if (index === 0) {
    LANES.forEach((lane) => { floor.slots[lane] = blankSlot(0, lane, SLOT.EMPTY); });
    return floor;
  }

  // 보스 투기장. 상점 층보다 먼저 봅니다 — 200층은 둘 다에 걸립니다.
  if (isBossFloor(index)) {
    floor.boss = true;
    floor.slots.mid = blankSlot(index, 'mid', SLOT.BOSS);
    return floor;
  }

  // 상점 층은 가운데 넓은 발판 하나뿐입니다. 어느 쪽을 눌러도 여기로 옵니다.
  if (isShopFloor(index)) {
    floor.shop = true;
    floor.slots.mid = blankSlot(index, 'mid', SLOT.SHOP);
    return floor;
  }

  const lanes = pickLanes(index);
  lanes.forEach((lane) => { floor.slots[lane] = makeSlot(index, lane, need, usesArmor); });
  dedupeItems(floor, index, lanes, need, usesArmor);

  // 이 구간의 유물. UP과 같은 이유로 가운데에 둡니다.
  if (index === relicFloorFor(index)) {
    floor.slots.mid = blankSlot(index, 'mid', SLOT.RELIC);
    return floor;
  }

  // 이 구간에 하나뿐인 UP이 놓이는 층입니다.
  // 가운데에 둡니다 — 한 칸씩만 옮겨 갈 수 있으니 양 끝에 놓으면
  // 반대편에 서 있던 판은 그 구간의 UP을 통째로 놓칩니다.
  if (index === upFloorFor(index)) {
    floor.slots.mid = blankSlot(index, 'mid', SLOT.UPGRADE);
  }

  return floor;
}
