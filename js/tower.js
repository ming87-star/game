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
  DODGE: 'dodge',     // 회  피해를 통째로 흘릴 확률. 갑옷을 안 입는 직업용
  UPGRADE: 'upgrade', // UP  다음 단계 무기 (강화는 초기화)
  RELIC: 'relic',     // ★  직업 유물. 한 판에 하나뿐
  MEDAL: 'medal',     // 🏅 판을 넘어 남는 화폐. 지도에서는 아주 드물게만
  BOMB: 'bomb',       // 폭 밟으면 체력을 잃습니다. 대놓고 보입니다
  MIMIC: 'mimic',     // 좋은 것인 척하는 함정. 겉모습은 slot.disguise 를 따릅니다
  SHOP: 'shop',
  BOSS: 'boss',       // 보스 투기장. 발판도 상점도 없습니다
  GOLDFROG: 'goldfrog', // 낮은 확률로 필드에 나오는 특별한 몬스터. 잡으면 코인을 왕창 줍니다
  TREASURE: 'treasure', // 보물상자. UP·유물처럼 구간마다 자리를 정해 둡니다
};

// 시간이 지나면 사라지는 것들. 상점과 적(황금개구리 포함)은 해당하지 않습니다 —
// 그것들은 아이템이 아니라 잡아야 하는 몬스터입니다.
const ITEM_KINDS = new Set([SLOT.PLUS, SLOT.HASTE, SLOT.DOUBLE, SLOT.UPGRADE, SLOT.HEAL, SLOT.ARMOR, SLOT.DODGE, SLOT.RELIC, SLOT.MEDAL, SLOT.BOMB, SLOT.MIMIC, SLOT.TREASURE]);

// 함정. 좋은 것과 수명이 다릅니다 — 훨씬 빨리 삭습니다.
const TRAP_KINDS = new Set([SLOT.BOMB, SLOT.MIMIC]);

// 그 칸의 시계가 얼마나 빨리 가는가. armWithin·blinkAt·life 세 값을 씁니다.
function slotTiming(kind) {
  return TRAP_KINDS.has(kind) ? CFG.trap : CFG.item;
}

// 발판 위에 띄울 표시.
//
// `art` 가 있고 그 그림이 실려 있으면 **그림만** 놓입니다 — 동그라미도 글자도
// 없습니다. 그림이 없으면 여기 적힌 동그라미와 글자로 되돌아갑니다.
// 그림 한 장을 지워도 그 칸만 글자로 돌아가고 게임은 그대로 돕니다.
const SLOT_MARK = {
  [SLOT.PLUS]:    { label: '+1', color: 0xffd54f, text: '#3e2723', art: 'item-plus' },
  [SLOT.HASTE]:   { label: '속', color: 0x4fc3f7, text: '#01579b', art: 'item-haste' },
  [SLOT.DOUBLE]:  { label: '×2', color: 0x00e5ff, text: '#006064', art: 'item-double' },
  [SLOT.UPGRADE]: { label: 'UP', color: 0xff8a65, text: '#3e2723' }, // 무기 그림을 따로 씁니다
  [SLOT.HEAL]:    { label: '＋', color: 0x66bb6a, text: '#1b5e20', art: 'item-heal' },
  [SLOT.ARMOR]:   { label: '방', color: 0x90a4ae, text: '#263238', art: 'item-armor-warrior' },
  [SLOT.DODGE]:   { label: '회', color: 0xce93d8, text: '#4a148c', art: 'item-dodge' },
  [SLOT.RELIC]:   { label: '★', color: 0xffd54f, text: '#3e2723', art: 'item-relic' },
  [SLOT.MEDAL]:   { label: '메', color: 0xffca28, text: '#4e342e', art: 'item-medal' },
  [SLOT.BOMB]:    { label: '폭', color: 0x8e0000, text: '#ffcdd2', art: 'item-bomb' },
  [SLOT.TREASURE]: { label: '보물', color: 0xffc94d, text: '#3e2415', art: 'item-treasure' },
};

// 방어구만 직업을 탑니다. 전사는 강철 방패, 궁수는 가죽 방패 — 경로는 같고
// 칠만 다릅니다. 같은 「방」인데 그림까지 같으면 내 것이라는 느낌이 없고,
// 모양이 다르면 같은 아이템으로 안 읽힙니다.
function slotArtKey(kind, jobKey) {
  const mark = SLOT_MARK[kind];
  if (!mark || !mark.art) return null;
  if (kind === SLOT.ARMOR && jobKey === 'archer') return 'item-armor-archer';
  return mark.art;
}

// 가짜가 드러났을 때 갈아 끼울 그림. **같은 물건의 망가진 모습**입니다 —
// 실루엣은 그대로 두고 안쪽만 부숩니다. 모루에 금이 가고, 깃털이 꺾이고,
// 방패에 구멍이 나고, 약병이 깨집니다. 딴 물건으로 바뀌면 그건 배신이 아니라
// 그냥 다른 칸입니다.
function fakeArtKey(disguise, jobKey) {
  if (disguise === SLOT.ARMOR) {
    return jobKey === 'archer' ? 'item-fake-armor-archer' : 'item-fake-armor';
  }
  const map = {
    [SLOT.PLUS]: 'item-fake-plus',
    [SLOT.HASTE]: 'item-fake-haste',
    [SLOT.DODGE]: 'item-fake-dodge',
    [SLOT.HEAL]: 'item-fake-heal',
    [SLOT.TREASURE]: 'item-fake-treasure',
  };
  return map[disguise] || null;
}

// 가짜가 흉내 낼 수 있는 것들. 메달과 ×2는 뺐습니다 —
// 워낙 귀해서 가짜였을 때의 배신감이 재미를 넘어섭니다.
//
// 보물상자는 101층부터(CFG.trap.fromFloor) 함정이 섞이는 그 순간부터 같이
// 흉내낼 수 있는 대상이 됩니다. 그 전까지 보물상자는 늘 진짜입니다 —
// 함정을 아직 안 배운 사람에게 "상자도 의심해야 한다"까지 얹으면 배우는 게
// 아니라 겁만 먹습니다.
const MIMIC_DISGUISES = [SLOT.PLUS, SLOT.HASTE, SLOT.ARMOR, SLOT.DODGE, SLOT.HEAL, SLOT.TREASURE];

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
let treasureFloorByBand = new Map();

function resetTowerRun() {
  upFloorByBand = new Map();
  relicFloorByBand = new Map();
  treasureFloorByBand = new Map();
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

// ── 보물상자의 자리 ─────────────────────────────────────
// 확률로만 뿌리면 운이 나쁠 때 보스 하나를 지나는 내내 한 번도 못 볼 수
// 있습니다. UP·유물과 같은 방식으로 구간마다 정확히 한 번씩 자리를 정해
// 둡니다 — every(50)가 shopEvery 와 같고 bossEvery(200)를 나누어떨어지므로,
// **상점 구간마다 하나 = 보스 하나를 지나는 동안 네 번**입니다.
//
// every 가 보스 간격을 나누어떨어지지 않으면 구간이 보스를 걸치고, 걸친
// 구간의 상자가 보스 너머에 떨어진 판은 세 번을 못 채웁니다. 까닭은
// CFG.treasure 옆에 적어 뒀습니다.
function treasureFloorFor(index) {
  const t = CFG.treasure;
  if (index < (t.from || 0)) return -1;

  const band = Math.floor((index - t.from) / t.every);
  if (!treasureFloorByBand.has(band)) {
    const start = t.from + band * t.every;
    const pick = () => start + Math.floor(Math.random() * t.every);
    let floor = pick();
    for (let i = 0; i < 12 &&
      (isShopFloor(floor) || isBossFloor(floor) ||
       floor === relicFloorFor(floor) || floor === upFloorFor(floor)); i++) floor = pick();
    treasureFloorByBand.set(band, floor);
  }
  return treasureFloorByBand.get(band);
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

// 층이 오를수록 좋은 것이 드물어집니다.
//
// 아래층은 "무엇을 주우러 갈까"의 게임이고, 위층은 "무엇을 포기할까"의 게임입니다.
// 같은 조작인데 묻는 것이 달라지는 것 — 그게 이 한 줄이 하는 일입니다.
// 회복과 함정은 여기 안 걸립니다. 회복까지 마르면 위층이 그냥 벽이 되고,
// 함정은 원래 좋은 것이 아니라 값입니다.
function itemFadeAt(index) {
  const f = CFG.slotChance.itemFade;
  if (!f || index <= f.from) return 1;
  return Math.max(f.min, Math.pow(0.5, (index - f.from) / f.halfLife));
}

function pickKind(index, need, usesArmor = true) {
  const c = CFG.slotChance;
  const enemyChance = Math.min(c.enemyMax, c.enemyBase + index * c.enemyPerFloor);
  const fade = itemFadeAt(index);

  const r = Math.random();
  if (r < enemyChance) return SLOT.ENEMY;

  let acc = enemyChance;
  // 메달을 가장 먼저 봅니다. 확률이 워낙 작아 순서는 사실 상관없지만,
  // 뒤에 두면 앞의 확률을 만질 때마다 같이 흔들려서 눈에 띄게 해 둡니다.
  if (r < (acc += c.medal)) return SLOT.MEDAL;
  // 황금개구리. 보물상자와 달리 자리를 정해 두지 않습니다 — 몇 번을 보든
  // 순전히 운입니다 (js/enemies.js 의 spawnGoldFrog).
  if (r < (acc += c.goldfrog)) return SLOT.GOLDFROG;
  if (r < (acc += c.plus * fade)) return SLOT.PLUS;
  if (r < (acc += c.haste * fade)) return SLOT.HASTE;
  if (r < (acc += healChance(need))) return SLOT.HEAL;
  // 방어 칸. 갑옷을 입는 직업에게는 방어구가, 아닌 직업에게는 회피가 나옵니다.
  if (r < (acc += c.armor * fade)) return usesArmor ? SLOT.ARMOR : SLOT.DODGE;
  if (r < (acc += c.double * fade)) return SLOT.DOUBLE;
  // 함정은 정해진 층부터 섞입니다. 그 전까지는 아예 놓이지 않습니다 —
  // 규칙을 배우는 동안 속이면 배우는 대신 겁만 먹습니다.
  if (index >= (CFG.trap.fromFloor || 0)) {
    if (r < (acc += c.bomb)) return SLOT.BOMB;
    if (r < (acc += c.mimic)) return SLOT.MIMIC;
  }
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

// 한 종류가 살아 있는 구간 [from, until).
//
// **한 층에 도는 종류는 넷을 넘지 않습니다** (CFG.enemyWave.maxKinds).
// 목록에서 넷 뒤의 종류가 풀리는 층이 곧 이 종류가 물러나는 층입니다 —
// 새 얼굴이 하나 들어오면 가장 먼저 나왔던 얼굴이 하나 빠지는 식입니다.
//
// 예전에는 열세 종류가 전부 남아서, 500층에서도 첫 층의 코인벌레가 섞여
// 나왔습니다. 그러면 새 종류가 풀려도 만날 확률이 1/13이라 "새로운 것이
// 나왔다"는 느낌이 없고, 화면에는 늘 잡동사니가 깔립니다.
//
// 목록 끝의 넷(쪼개지는 것·사수·급강하·유령)은 뒤가 없으므로 끝까지 남습니다.
// 황금개구리는 애초에 이 목록에 없어서 이 규칙을 타지 않습니다 — 층과 상관없이
// 아주 낮은 확률로 따로 나타납니다.
function typeSpan(def) {
  const list = CFG.enemyTypes;
  const out = list[list.indexOf(def) + CFG.enemyWave.maxKinds];
  return { from: def.from, until: out ? out.from : Infinity };
}

// 한 종류의 등장 비중. 나온 뒤 서서히 흔해지고, 물러날 때가 되면 옅어집니다.
function typeWeight(def, index) {
  const w = CFG.enemyWave;
  const span = typeSpan(def);
  if (index < span.from || index >= span.until) return 0;

  // 등장 직후엔 드물다가 rampFloors 층에 걸쳐 제 비중까지 올라옵니다.
  const ramp = Math.min(1, 0.3 + 0.7 * (index - def.from) / w.rampFloors);

  // 물러날 층이 정해져 있으므로 반감기가 아니라 **그 층까지 고르게** 옅어집니다.
  // 다음 종류가 풀리는 순간부터 시작해서, 물러나는 층에서 정확히 0이 됩니다.
  // 그래야 마지막 층에서 뚝 끊기지 않고 자연스럽게 자리를 내줍니다.
  const next = CFG.enemyTypes.find((t) => t.from > def.from);
  const fade = next && span.until < Infinity && index > next.from
    ? Math.max(0, 1 - (index - next.from) / (span.until - next.from))
    : 1;

  return Math.max(w.minWeight, def.w0 * ramp) * fade;
}

// 그 층에 나올 수 있는 적 종류 중 하나를 비중에 따라 고릅니다.
function pickEnemyType(index) {
  // 비중이 0인 것은 아예 후보에서 뺍니다. 남겨 두면 아래 마지막 줄의
  // 안전장치가 이미 물러난 종류를 집어 올릴 수 있습니다.
  const pool = CFG.enemyTypes.filter((t) => typeWeight(t, index) > 0);
  if (!pool.length) return CFG.enemyTypes[0].key;
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
    enemyCount: 0, enemyTypes: [], disguise: null, revealed: false, taken: false, spawned: false,
    armed: false, armedAt: 0, expired: false, blinking: false,
  };
}

function makeSlot(index, lane, need, usesArmor) {
  const slot = blankSlot(index, lane, pickKind(index, need, usesArmor));

  // 가짜는 무엇인 척할지 정합니다. 갑옷을 안 입는 직업에게 갑옷인 척해 봐야
  // 진짜도 안 나오는 것이라 들통납니다.
  if (slot.kind === SLOT.MIMIC) {
    const pool = MIMIC_DISGUISES.filter((k) =>
      k !== (usesArmor ? SLOT.DODGE : SLOT.ARMOR));
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

  // 이 구간의 보물상자. UP·유물과 같은 자리(가운데)를 씁니다 — 한 칸씩만
  // 옮겨 가므로 양 끝에 두면 반대편에 있던 판은 통째로 놓칩니다.
  if (index === treasureFloorFor(index)) {
    floor.slots.mid = blankSlot(index, 'mid', SLOT.TREASURE);
  }

  // 이 구간에 하나뿐인 UP이 놓이는 층입니다.
  // 가운데에 둡니다 — 한 칸씩만 옮겨 갈 수 있으니 양 끝에 놓으면
  // 반대편에 서 있던 판은 그 구간의 UP을 통째로 놓칩니다.
  if (index === upFloorFor(index)) {
    floor.slots.mid = blankSlot(index, 'mid', SLOT.UPGRADE);
  }

  return floor;
}
