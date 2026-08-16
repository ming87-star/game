// ── 만듦새 ────────────────────────────────────────────────
// 같은 자루를 어떻게 벼렸느냐. **이름과 색과 수치가 한 덩어리로 움직입니다.**
//
// 무기 사다리를 걷어내면서 생긴 자리입니다. 예전에는 무기가 열두 단계짜리
// 계단이었습니다 — 다음 것이 늘 더 세니까 고를 것이 없었고, 꼭대기에 닿으면
// 그 뒤로는 아무 일도 안 일어났습니다. 지금은 열두 **자루**가 있고 자루마다
// 만듦새가 갈립니다. "더 센 다음 무기"가 아니라 "다른 무기"로 갈아타는
// 것이 이 게임의 결정이 됩니다.
//
// 만듦새는 새 그림을 한 장도 안 씁니다. 무기 아이콘은 원래 도형으로 지어지고
// (js/textures.js 의 buildWeaponIcons), 날 색 한 줄이 그 자루의 얼굴입니다.
// 만듦새는 그 색을 갈아 끼우고 이름 앞에 두 글자를 붙입니다.
//
// 몸짓 시트(assets/sheets)는 손으로 그린 것이라 못 늘립니다. 만듦새가 달라도
// **실루엣은 같은 자루**이므로 원본의 시트를 그대로 빌려 씁니다 (sheet 필드).
//
// 수치는 서로 맞바꿉니다. 한쪽으로만 좋은 만듦새를 두면 그건 만듦새가 아니라
// 그냥 상위 무기이고, 그러면 사다리를 걷어낸 뜻이 없어집니다.
//
//   dmg    공격력 배수        rate  주기 배수 (1보다 크면 **느림**)
//   reach  사거리·사정거리 배수  acc   정확도에 더하는 값
//   spread 공격력 범위의 폭에 곱하는 값
const FORGES = {
  // 원본. 접두어도 없고 아무것도 안 바꿉니다.
  plain: { prefix: '', dmg: 1, rate: 1, reach: 1, acc: 0, spread: 1 },

  // 무겁게 두들겨 만든 것. 세게 들어가지만 손이 느려집니다.
  iron: {
    prefix: '무쇠', tint: 0x8d9aa6,
    detail: '두껍게 두들겼습니다. 무겁고 세게 들어갑니다',
    dmg: 1.16, rate: 1.12, reach: 0.97, acc: 0, spread: 1,
  },

  // 얇게 벼린 것. 한 대는 가볍지만 빠르고 조금 더 멀리 닿습니다.
  keen: {
    prefix: '벼린', tint: 0xb3e5fc,
    detail: '얇게 벼렸습니다. 가벼운 대신 빠르고 멀리 닿습니다',
    dmg: 0.88, rate: 0.90, reach: 1.05, acc: 0.02, spread: 1,
  },

  // 검은 쇠. 가장 무겁게 들어가는 대신 손에 안 붙어서 빗나갑니다.
  black: {
    // 0x546e7a 는 너무 어두워서 어두운 판 위에서 날이 안 보였습니다.
    // "검은 쇠"로 읽히되 실루엣은 남는 밝기로 올렸습니다.
    prefix: '흑철', tint: 0x6d7f8b,
    detail: '검은 쇠. 가장 무겁게 들어가지만 손에 잘 안 붙습니다',
    dmg: 1.30, rate: 1.16, reach: 0.96, acc: -0.09, spread: 1.5,
  },

  // 은을 입힌 것. 잘 벼려져 빗나가는 일이 거의 없고 들쭉날쭉하지 않습니다.
  silver: {
    prefix: '은장', tint: 0xeceff1,
    detail: '은을 입혔습니다. 좀처럼 빗나가지 않고 한 대가 고릅니다',
    dmg: 0.96, rate: 0.98, reach: 1, acc: 0.07, spread: 0.45,
  },
};

// 한 자루의 만듦새 하나를 실제 무기 한 자루로 폅니다.
//
// 원본(plain)도 여기를 지납니다 — 그래야 공격력 범위·정확도 같은 새 값이
// 원본에도 똑같이 붙고, 두 자루를 견줄 때 같은 자로 재게 됩니다.
function forgeWeapon(family, forgeKey, index) {
  const f = FORGES[forgeKey] || FORGES.plain;
  const dmg = Math.round(family.dmg * f.dmg);
  // 공격력은 한 값이 아니라 범위입니다. spread 는 가운뎃값에서 위아래로
  // 벌어지는 몫이고, 만듦새가 그 폭을 다시 조절합니다 (은장은 좁고 흑철은 넓게).
  const spread = (family.spread === undefined ? 0.18 : family.spread) * f.spread;
  return Object.assign({}, family, {
    index,
    family: family.key,
    forge: forgeKey,
    sheet: family.sheet,
    name: f.prefix ? f.prefix + ' ' + family.name : family.name,
    color: f.tint || family.color,
    detail: f.detail || family.detail || '',
    dmg,
    dmgMin: Math.max(1, Math.round(dmg * (1 - spread))),
    dmgMax: Math.max(1, Math.round(dmg * (1 + spread))),
    rate: Math.round(family.rate * f.rate),
    // 근접은 reach, 원거리는 range 를 씁니다. 없는 쪽은 그대로 없습니다.
    reach: family.reach === undefined ? undefined : Math.round(family.reach * f.reach),
    range: family.range === undefined ? undefined : Math.round(family.range * f.reach),
    // 정확도. 1을 넘지 않고 0.5 아래로도 안 내려갑니다 — 반이나 빗나가는
    // 무기는 성격이 아니라 고장입니다.
    acc: Phaser.Math.Clamp((family.acc === undefined ? 0.92 : family.acc) + f.acc, 0.5, 1),
  });
}

// 한 직업의 무기 주머니. 자루마다 원본 하나와 만듦새 하나, 그래서 두 배입니다.
//
// **깊이(depth)는 그 자루가 나오기 시작하는 층**입니다. 사다리가 아니라
// 창문입니다 — 그 층을 넘으면 주머니에 들어오고, 한참 뒤까지 계속 나옵니다.
// 그래서 위층에서는 좋은 것이 섞일 뿐이지 아래 것이 사라지지는 않습니다.
function buildWeaponPool(job) {
  if (job.pool) return job.pool;
  const pool = [];
  job.weapons.forEach((family) => {
    pool.push(forgeWeapon(family, 'plain', pool.length));
    if (family.forge) pool.push(forgeWeapon(family, family.forge, pool.length));
  });
  job.pool = pool;
  return pool;
}

// 그 층에서 나올 수 있는 무기들.
//
// 아래로는 **최근 것 몇 자루만** 남깁니다. 400층에서 첫 장검이 나오면
// 주운 사람은 그냥 버리게 되고, 그러면 무기 칸이 빈 칸과 다를 바 없습니다.
// 위로는 아직 안 열린 것을 안 줍니다 — 그게 "후반일수록 좋은 무기"입니다.
function weaponPoolAt(job, floor) {
  const pool = buildWeaponPool(job);
  const open = pool.filter((w) => floor >= w.depth);
  if (!open.length) return pool.slice(0, 2);
  // 열린 것 중 깊은 쪽에서부터 이만큼만. 자루 수로 세므로 만듦새까지 하면
  // 실제로는 그 두 배쯤이 후보가 됩니다.
  const deepest = Math.max(...open.map((w) => w.depth));
  const window = open.filter((w) => w.depth >= deepest - CFG.weapon.lookBack);
  return window.length ? window : open;
}

// 그 층에 어울리는 무기 하나를 굴립니다.
function rollWeapon(job, floor) {
  const pool = weaponPoolAt(job, floor);
  return pool[Math.floor(Math.random() * pool.length)];
}
