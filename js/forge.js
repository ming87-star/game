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
//
// ── 규칙: 넷은 초당 피해로 전부 같습니다 (±1%) ──────────
//
// **이 규칙이 만듦새의 전부입니다.** 위에 적어 놓고도 지키지 못했습니다.
// 재 보니 넷 중 셋이 어겼습니다 — 은장 +4.6% · 무쇠 +3.7% · 흑철 +1.1%.
//
// 은장이 가장 심했던 까닭이 분명합니다. **정확도 +7%p 가 초당 피해에 그대로
// 들어오는데 내주는 것이 「폭이 좁아짐」뿐**이었습니다. 폭은 좁으나 넓으나
// 평균이 같으니 값이 아니었던 것입니다. 벼린은 반대로 초당 피해가 0%인 채로
// 사거리와 정확도를 둘 다 덤으로 받고 있었습니다 — **덤이 있으면 그건
// 맞바꿈이 아닙니다.**
//
// 지금은 넷 다 이 식을 1로 맞춰서 잡습니다.
//
//   초당 피해 배수 = (공격력 배수 ÷ 주기 배수) × (바뀐 정확도 ÷ 원래 정확도)
//
// 정확도를 올리면 그만큼 공격력을 깎고, 주기를 늦추면 그만큼 얹습니다.
// verify-combat 이 자루마다 이 값을 확인합니다 — 다시 새지 않게.
//
// ── 그러면 무엇이 갈리나 ────────────────────────────────
//
// 초당 피해 밖의 축들입니다. **서로 맞물리게 짝을 지었습니다.**
//
//              한 대   빠르기  사거리  정확   폭
//   무쇠        ++      −−      −       ·      ·
//   벼린        −−      ++      +       ·      ·
//   흑철       +++     −−−      −       −      +
//   은장        −        ·      ·       +      −
//
// 무쇠와 벼린은 **거울**입니다 — 하나는 사거리를 내주고 무게를 얻고, 하나는
// 무게를 내주고 사거리를 얻습니다. 흑철은 무쇠를 끝까지 민 것이라 정확도로
// 값을 치르고 넓은 폭을 얻습니다. 은장은 그 반대편 끝 — 한 대를 깎아
// 확실함을 삽니다.
const FORGES = {
  // 원본. 접두어도 없고 아무것도 안 바꿉니다.
  plain: { prefix: '', dmg: 1, rate: 1, reach: 1, acc: 0, spread: 1 },

  // 무겁게 두들긴 것. 한 대가 무거운 대신 느리고 짧습니다.
  //   1.16 ÷ 1.16 = 1.000
  iron: {
    prefix: '무쇠', tint: 0x8d9aa6,
    detail: '두껍게 두들겼습니다. 한 대가 무거운 대신 느리고 짧습니다',
    dmg: 1.16, rate: 1.16, reach: 0.96, acc: 0, spread: 1,
  },

  // 얇게 벼린 것. 한 대가 가벼운 대신 빠르고 멀리 닿습니다.
  //   0.86 ÷ 0.86 = 1.000
  //
  // 정확도 덤(+2%p)을 걷어냈습니다. 사거리 하나만으로도 이미 얻는 쪽인데
  // 정확도까지 얹혀 있었습니다. 얇게 벼린 것이 더 잘 맞는다는 것도
  // 딱히 그럴듯하지 않았습니다.
  keen: {
    prefix: '벼린', tint: 0xb3e5fc,
    detail: '얇게 벼렸습니다. 한 대가 가벼운 대신 빠르고 멀리 닿습니다',
    dmg: 0.86, rate: 0.86, reach: 1.06, acc: 0, spread: 1,
  },

  // 검은 쇠. 가장 무겁게 들어가지만 느리고 손에 잘 안 붙습니다.
  //   (1.30 ÷ 1.20) × (0.85 ÷ 0.92) = 1.001
  black: {
    // 0x546e7a 는 너무 어두워서 어두운 판 위에서 날이 안 보였습니다.
    // "검은 쇠"로 읽히되 실루엣은 남는 밝기로 올렸습니다.
    prefix: '흑철', tint: 0x6d7f8b,
    detail: '검은 쇠. 가장 무겁게 들어가지만 느리고 손에 잘 안 붙습니다',
    dmg: 1.30, rate: 1.20, reach: 0.94, acc: -0.07, spread: 1.6,
  },

  // 은을 입힌 것. 한 대가 가벼운 대신 좀처럼 빗나가지 않고 고릅니다.
  //   0.94 × (0.98 ÷ 0.92) = 1.001
  //
  // 덤을 +7%p 에서 +6%p 로 내린 것은 **천장** 때문입니다. 정확도는 1.00 을
  // 못 넘는데, 원래 잘 맞는 자루에 +7%p 를 얹으면 넘치는 몫이 그냥 버려집니다
  // (은장 성좌궁이 1.03 → 1.00 이었습니다). 버려지는 덤은 값만 치르고 못 받는
  // 것이라, 그 자루 하나만 조용히 손해가 됩니다.
  silver: {
    prefix: '은장', tint: 0xeceff1,
    detail: '은을 입혔습니다. 한 대가 가벼운 대신 좀처럼 빗나가지 않고 고릅니다',
    dmg: 0.94, rate: 1, reach: 1, acc: 0.06, spread: 0.45,
  },
};

// 한 자루의 만듦새 하나를 실제 무기 한 자루로 폅니다.
//
// 원본(plain)도 여기를 지납니다 — 그래야 공격력 범위·정확도 같은 새 값이
// 원본에도 똑같이 붙고, 두 자루를 견줄 때 같은 자로 재게 됩니다.
function forgeWeapon(family, forgeKey, index) {
  const f = FORGES[forgeKey] || FORGES.plain;
  // **가운뎃값은 반올림하지 않습니다.** 화면에 뜨는 것은 위아래 두 값뿐이라
  // 여기서 한 번 더 자를 이유가 없는데, 자르면 그 오차가 그대로 남습니다.
  // 궁수는 화살 한 발이 16~53 이라 1이 어긋나도 2~6%입니다 — 만듦새를 ±1%
  // 안에서 맞춰 놓고 반올림으로 그만큼 흔들리면 맞춘 뜻이 없어집니다.
  const dmg = family.dmg * f.dmg;
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
    dmg: Math.round(dmg), // 도감·표에 적을 가운뎃값 (셈에는 안 씁니다)
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
// 무명(無名)인가. 만듦새를 입혀도 family 는 그대로 남습니다 (forgeWeapon).
function isNameless(w) {
  return !!w && (w.family === 'nameless' || w.key === 'nameless');
}

// 무명의 첫째 문 — **그 직업으로 메달 상품을 셋 사 뒀는가.**
// 둘째 문(120층)은 그냥 depth 라 아래 filter 가 알아서 봅니다.
//
// Save 가 없는 자리(표를 뽑는 도구 따위)에서는 **닫힌 것으로 봅니다.**
// 열린 것으로 보면 아직 못 얻은 자루가 표에 섞여서, 그 표를 보고 잡은
// 밸런스가 실제와 어긋납니다.
function namelessOpen(job) {
  if (typeof Save === 'undefined' || !Save.perksFor) return false;
  const bought = Object.keys(Save.perksFor(job.key) || {}).length;
  return bought >= (CFG.weapon.namelessPerks || 3);
}

function weaponPoolAt(job, floor) {
  const pool = buildWeaponPool(job);
  const wild = namelessOpen(job);
  const open = pool.filter((w) => floor >= w.depth && (wild || !isNameless(w)));
  if (!open.length) return pool.slice(0, 2);
  // 열린 것 중 깊은 쪽에서부터 이만큼만. 자루 수로 세므로 만듦새까지 하면
  // 실제로는 그 두 배쯤이 후보가 됩니다.
  //
  // **무명만은 창을 안 탑니다.** 여기서 얻는 것은 그 판에 쥘 자루가 아니라
  // 도감에 적히는 한 줄이라(다음 판의 첫 자루가 됩니다), 몇 층까지 갔든
  // 한 번은 마주칠 수 있어야 합니다. 창에 태우면 120~299층을 그냥 지나친
  // 판에서는 문을 둘 다 열어 놓고도 영영 못 만납니다.
  const deepest = Math.max(...open.map((w) => w.depth));
  const window = open.filter((w) =>
    isNameless(w) || w.depth >= deepest - CFG.weapon.lookBack);
  return window.length ? window : open;
}

// 그 층에 어울리는 무기 하나를 굴립니다.
//
// `held` 를 주면 **그 자루와 견줄 만하게 벼려서** 돌려줍니다 (CFG.pickup).
// 안 주면 예전처럼 맨 것이 나옵니다 — 도감·시작 무기처럼 「그 자루 자체」를
// 물어보는 자리는 강화가 붙으면 안 됩니다.
function rollWeapon(job, floor, held) {
  const pool = weaponPoolAt(job, floor);
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return held ? withPickupGift(picked, job, held) : picked;
}

// ── 주워 든 자루를 얼마나 벼려 줄 것인가 ──────────────────
//
// **초당 피해를 자로 씁니다.** 공격력만 보면 느린 자루가 과하게 벼려지고,
// 속도만 보면 반대가 됩니다. 실제로 갈아탈지 고르는 값이 초당 피해라
// (갈아타기 창이 그것을 나란히 놓습니다) 여기서도 그것으로 맞춥니다.
//
// ── `+1` 만으로는 안 됩니다 ───────────────────────────────
// 처음에는 `+1` 하나만 얹었습니다. 「속과 ×2 는 자루가 아니라 그 판에서
// 주운 것이니 딸려 오면 안 된다」는 것이 그럴듯해 보였는데, 재 보니
// **후반에 닿을 수가 없었습니다** — 벼림이 +10(한계)에 붙어 있는데도
// 여전히 ×0.3 이었습니다. 든 자루의 속8·×2 를 `+1` 로는 못 넘습니다.
//
//   흑철 천살단검 +10 ×2 속7 을 들었을 때, 주운 것: ×0.29 ~ ×0.36
//
// 그래서 셋을 다 얹되 **든 것을 넘지 않는 선**에서 얹습니다. 그러면
// 「갈아타면 전부 잃는다」가 「조금 잃는다」로 바뀝니다 — 그 값을 치르고
// 사는 것이 **후반에도 갈아탈 수 있다**는 것입니다.
function withPickupGift(entry, job, held) {
  if (!entry || isNameless(entry) || !held) return entry;
  const pool = buildWeaponPool(job);
  const at = pool.indexOf(entry);
  if (at < 0) return entry;

  const 목표 = held.dps * Phaser.Math.FloatBetween(CFG.pickup.lo, CFG.pickup.hi);

  // 실제 값을 만들어 재는 쪽이 어긋날 자리가 없습니다 — plusStep·plusScale·
  // 만듦새·속도 한계가 자루마다 달라서, 식으로 풀면 그중 하나를 빼먹습니다.
  const 재기 = new Weapon(job, at);
  let 가장 = null;
  // ×2 는 든 것과 같은 칸까지만. 속도 한계에서 잘리므로 넘겨 줘도 헛것입니다.
  for (let mult = 1; mult <= held.mult; mult *= 2) {
    for (let haste = 0; haste <= held.haste; haste++) {
      for (let plus = 0; plus <= 재기.plusMax; plus++) {
        재기.plus = plus; 재기.haste = haste; 재기.mult = mult;
        const 차 = Math.abs(재기.dps - 목표);
        // 같은 거리면 **덜 벼려진 쪽**을 고릅니다. 갈아탄 뒤에도 올릴
        // 자리가 남아야 UP 자리가 계속 뜻을 갖습니다.
        if (!가장 || 차 < 가장.차) 가장 = { 차, plus, haste, mult };
      }
    }
  }
  if (!가장 || (!가장.plus && !가장.haste && 가장.mult === 1)) return entry;
  return Object.assign({}, entry, {
    gift: { plus: 가장.plus, haste: 가장.haste, mult: 가장.mult },
  });
}

