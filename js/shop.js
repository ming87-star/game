// 50층마다 나오는 상점. 모아둔 코인으로 강화를 삽니다.
// 여기 있는 동안은 적이 나오지 않습니다 — 한숨 돌리는 자리이기도 합니다.

// 패널 위쪽부터의 세로 좌표. 상품 칸은 높이 96이라 rowY - 48 부터 자리를 씁니다.
const SHOP_LAYOUT = {
  width: 470,
  height: 760,
  titleY: 26,
  coinY: 72,
  // 첫 칸의 상자는 이 자리에서 위아래 48px 씩 뻗습니다. 예전 140 은 상자
  // 윗변이 92 라 「가진 코인」 줄(74~99)의 아랫동아리를 덮었습니다 —
  // 큰 상점에서는 둘이 나란히 밀려서 겹침이 그대로 따라왔습니다.
  rowY: 156,
  rowGap: 100,
  buttonY: 676,
  bonusY: 70,      // 큰 상점의 도착 보상 한 줄
  bonusRoom: 34,   // 그 줄이 들어갈 만큼 패널을 키웁니다
};

// ── 상점 주인이 서는 자리 ──────────────────────────────────
//
// 처음에는 진열 아래 빈 자리에 세웠는데, 그 빈 자리는 **세 칸짜리 상점에만**
// 있었습니다. 다섯 칸이 서는 상점에서는 3~5번 칸이 주인 위에 그대로 덮였습니다.
//
// 두 갈래를 만들어 견줬습니다. 패널을 위로 올려 **바깥**에 세우는 쪽은,
// 960px 중 패널이 760 을 쓰는 터라 남는 자리가 160 뿐이라 주인이 테두리를
// 밟거나 잘렸습니다 — 억지로 넣은 티가 났습니다.
//
// 그래서 **진열을 촘촘하게 줄이고 그 자리를 냅니다.** 값은 글자가 3px
// 작아지는 것뿐이고, 그 대가로 주인이 이 화면의 일부가 됩니다.
//
// 칸 하나가 96 → 74 로 줄고 사이도 좁아집니다.
const TIGHT = { rowH: 74, rowGap: 78, name: 23, desc: 16, price: 22, nameY: -16, descY: 10 };

// ── 지도와 무엇이 다른가 ────────────────────────────────
// 지도의 아이템을 대폭 줄이고 나니, 상점이 성장의 주된 통로가 됐습니다.
// 그러면 상점이 "지도에서 못 주운 것을 돈으로 메우는 곳"에 그쳐서는 안 됩니다.
// 세 가지로 갈라 둡니다.
//
//   1. 덩이가 큽니다   지도의 +1 은 하나, 여기 「날붙이 갈기」는 한 번에 셋.
//                     줍는 것은 부스러기, 사는 것은 한 걸음입니다
//   2. 여기에만 있는 것 최대 체력 · 무기 단계 · 방어 한계 · 부적.
//                     지도에는 절대 안 나옵니다 — 돈을 벌 이유가 여기서 생깁니다
//   3. 고르게 합니다   다섯을 펼치고 살 수 있는 것은 둘셋뿐입니다.
//                     무엇을 사느냐가 아니라 무엇을 포기하느냐가 내용입니다
const SHOP_ITEMS = {
  plus:    { title: '날붙이 갈기', desc: '공격력 +' + CFG.shop.bundle.plus + ' (지도에서는 하나씩)' },
  haste:   { title: '가벼운 손',   desc: '공격 속도 +' + CFG.shop.bundle.haste + ' (지도에서는 하나씩)' },
  upgrade: { title: '다음 무기',   desc: '강화는 초기화됩니다' },
  heal:    { title: '응급 처치',   desc: '체력을 가득 채웁니다' },
  maxhp:   { title: '단단한 몸',   desc: '최대 체력 +' + CFG.shop.maxhpGain + ' · 그만큼 회복' },
  armor:   { title: '두꺼운 갑옷', desc: '방어구 +' + CFG.armor.shopGain + '% (한계까지)' },
  dodge:   { title: '가벼운 발',   desc: '회피 +' + Math.round(CFG.dodge.shopGain * 100) + '%' },
  // ── 여기에만 있는 것 둘 ────────────────────────────
  // 지도에는 한계를 올려 주는 것도, 죽음을 한 번 무르는 것도 없습니다.
  // 후반에 아이템을 포기하고 뛰기 시작하면 이 둘이 살 이유가 됩니다.
  cap:     { title: '여벌 갑옷',   desc: '방어·회피의 **한계**를 올립니다' },
  charm:   { title: '수호 부적',   desc: '쓰러질 때 한 번만 버팁니다' },
};

// 진열에서 산 것이든 보물상자에서 나온 것이든, 실제로 주는 효과는 하나입니다.
function applyShopEffect(scene, key) {
  const s = scene;
  switch (key) {
    // 지도에서는 하나씩, 상점에서는 뭉치로. 그것이 상점의 값어치입니다.
    case 'plus': for (let i = 0; i < CFG.shop.bundle.plus; i++) s.weapon.addPlus(); break;
    case 'haste': for (let i = 0; i < CFG.shop.bundle.haste; i++) s.weapon.addHaste(); break;
    // 상점의 무기 칸은 여기 없습니다 — 아래 buy 가 갈아타기 창으로 넘깁니다.
    case 'heal': s.hp = s.maxHp; break;
    case 'maxhp':
      s.maxHp += CFG.shop.maxhpGain;
      s.hp = Math.min(s.maxHp, s.hp + CFG.shop.maxhpGain);
      break;
    case 'armor':
      s.armor = Math.min(s.armorMax, s.armor + CFG.armor.shopGain);
      break;
    case 'dodge':
      s.dodge = Math.min(s.dodgeMax, s.dodge + CFG.dodge.shopGain);
      break;
    // 한계를 올립니다. 지도에는 이런 것이 없습니다 — 지도의 방어구는
    // 한계 안을 채울 뿐이고, 그 한계를 미는 것은 여기서만 삽니다.
    case 'cap':
      if (s.job.usesArmor) {
        s.armorMax += CFG.shop.capGain.armor;
        s.armor = Math.min(s.armorMax, s.armor + CFG.shop.capGain.armor);
      } else {
        // 절대 천장(CFG.dodge.hardMax)을 넘지 않습니다. 안 막으면 계속 사서
        // 회피 100%에 닿는데, 그건 아무것도 안 맞는 몸이라 판이 없어집니다.
        s.dodgeMax = Math.min(CFG.dodge.hardMax, s.dodgeMax + CFG.shop.capGain.dodge);
        s.dodge = Math.min(s.dodgeMax, s.dodge + CFG.shop.capGain.dodge);
      }
      break;
    case 'charm':
      s.charm = true;
      break;
  }
}

// 보물상자에서 나올 수 있는 것. 상점 진열과 같은 종류입니다 — 다만 값을 안 치릅니다.
//
// **아무것도 안 주는 것이 나오면 안 됩니다.** 상점에서는 진열을 보고 고르므로
// 이미 한계에 닿은 것을 굳이 살 이유가 없고, 사려 들면 「이미 한계입니다」라고
// 적어 줍니다. 그런데 상자는 고를 수가 없습니다 — 화면을 가득 채우는 이펙트를
// 터뜨려 놓고 실제로는 아무 일도 안 일어나면, 그건 보상이 아니라 놀림입니다.
//
// 그래서 **지금 실제로 값이 움직이는 것만** 후보에 넣습니다.
// (시험이 이걸 잡아냈습니다 — 스무 번 열어 세 번이 빈손이었습니다.)
function rollChestLoot(scene) {
  const s = scene;
  const pool = ['maxhp'];
  // 「한계」는 갑옷 쪽에는 천장이 없지만 회피 쪽에는 있습니다
  // (CFG.dodge.hardMax). 닿았으면 후보에서 뺍니다 — 이펙트만 터지고 아무
  // 일도 안 일어나면 그건 보상이 아니라 놀림입니다.
  if (s.job.usesArmor || s.dodgeMax < CFG.dodge.hardMax) pool.push('cap');
  // 공격력도 열(무명은 서른)에서 멎습니다. 닿았으면 후보에서 뺍니다 —
  // 화면을 가득 채우는 이펙트를 터뜨려 놓고 아무 일도 안 일어나면 놀림입니다.
  if (!s.weapon.plusCapped) pool.push('plus');
  if (!s.weapon.speedCapped) pool.push('haste');
  if (s.hp < s.maxHp) pool.push('heal');
  if (s.job.usesArmor) {
    if (s.armor < s.armorMax) pool.push('armor');
  } else if (s.dodge < s.dodgeMax) {
    pool.push('dodge');
  }
  if (s.shopWeapon) pool.push('upgrade');
  if (!s.charm) pool.push('charm');
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── 무엇이 가장 이득인가 ────────────────────────────────
// 화력과 맷집은 단위가 달라서 그냥은 못 견줍니다. 곱으로 묶으면 견줄 수 있습니다.
//
//   힘 = 초당 피해 × 실질 체력
//
// 이 곱이 뜻하는 것은 **화력 10%와 맷집 10%가 같은 값**이라는 것입니다.
// 둘 다 "쓰러지기 전에 넣을 수 있는 피해"를 꼭 10% 늘리니까요. 그래야
// 「날붙이 갈기」와 「두꺼운 갑옷」을 한 자로 잽니다.
//
// 실질 체력에는 **지금 체력**을 씁니다 (최대 체력이 아니라). 그래야 반죽은
// 채로 들어온 사람에게 회복이 제값으로 보이고, 가득 찬 사람에게는 0이 됩니다.
function powerOf(dps, hp, armor, dodge) {
  const taken = Math.max(0.01, (1 - dodge) * (1 - armor / 100));
  return dps * (hp / taken);
}

function powerNow(s) {
  return powerOf(s.weapon.dps, s.hp, s.armor, s.dodge);
}

// 그것을 샀을 때의 힘. **실제로 사 보지 않고** 셈으로만 냅니다 —
// applyShopEffect 를 불러서 되돌리는 길도 있지만, 되돌리기를 한 군데라도
// 빠뜨리면 사지도 않은 것이 붙은 채로 판이 굴러갑니다.
function powerAfter(s, key) {
  const w = s.weapon;
  let dps = w.dps;
  let hp = s.hp;
  let armor = s.armor;
  let dodge = s.dodge;
  const c = CFG.shop;

  switch (key) {
    case 'plus': {
      // 공격력은 밑값에 비례합니다. 붙는 양만큼 비율로 밀어 줍니다.
      // **한계를 넘겨서 세면 안 됩니다.** +9 에서 뭉치(셋)를 사면 실제로는
      // 하나만 붙는데, 셋으로 세면 추천 표가 헛것을 가리킵니다.
      const room = Math.max(0, w.plusMax - w.plus);
      const gain = Math.min(c.bundle.plus, room) * (s.job.plusScale || 1);
      const before = 1 + w.plusValue * w.plusStep;
      const after = 1 + (w.plusValue + gain) * w.plusStep;
      dps = dps * after / before;
      break;
    }
    case 'haste': {
      // 한계에 닿아 있으면 아무 일도 안 일어납니다 — 그러면 이득이 0입니다.
      const raw = (1 + (w.haste + c.bundle.haste) * CFG.hasteStep) * w.mult;
      dps = dps * Math.min(w.speedCap, raw) / w.speedMult;
      break;
    }
    case 'upgrade':
      // 갈아타면 강화가 전부 날아갑니다. 그래서 **강화 없이** 셉니다 —
      // 손해로 나오는 것이 흔하고, 그게 사실입니다.
      dps = s.shopWeapon ? w.dpsOf(s.shopWeapon, false) : dps;
      break;
    case 'heal':
      hp = s.maxHp;
      break;
    case 'maxhp':
      hp = Math.min(s.maxHp + c.maxhpGain, hp + c.maxhpGain);
      break;
    case 'armor':
      armor = Math.min(s.armorMax, armor + CFG.armor.shopGain);
      break;
    case 'dodge':
      dodge = Math.min(s.dodgeMax, dodge + CFG.dodge.shopGain);
      break;
    case 'cap':
      if (s.job.usesArmor) armor = Math.min(s.armorMax + c.capGain.armor, armor + c.capGain.armor);
      else dodge = Math.min(Math.min(CFG.dodge.hardMax, s.dodgeMax + c.capGain.dodge),
        dodge + c.capGain.dodge);
      break;
    case 'charm':
      // 부적은 **미뤄 둔 회복**입니다. 쓰러질 때 최대 체력의 charmHeal 만큼으로
      // 일어납니다 (js/scene-game.js 의 breakCharm). 그만큼을 지금 받은 셈 칩니다.
      // 판이 안 끝난다는 값어치는 여기 안 들어갑니다 — 그것까지 세면 부적이
      // 늘 이겨서 추천이 한 칸에 못 박힙니다.
      hp += s.maxHp * c.charmHeal;
      break;
  }
  return powerOf(dps, hp, armor, dodge);
}

class Shop {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.parts = [];
  }

  priceOf(key, shopNo) {
    const p = CFG.shop.prices[key];
    const n = shopNo - 1;
    return Math.round((p.base + p.perShop * n) * Math.pow(CFG.shop.priceGrowth, n));
  }

  rollOffers(shopNo) {
    // 다음 무기는 늘 팝니다. 지도에서는 구간마다 딱 한 번뿐이라,
    // 상점까지 운에 맡기면 무기 단계가 사실상 오르지 않습니다.
    // 지도에서 얻거나 여기서 사거나 — 두 길을 확실히 열어 둡니다.
    const picked = [];
    if (this.scene.shopWeapon) picked.push('upgrade');

    // 갑옷을 안 입는 직업에게는 방어구 대신 회피를 팝니다.
    // ×2는 상점에서 팔지 않습니다. 지도에서 아주 드물게만 나오는 물건으로 남깁니다.
    const rest = ['plus', 'haste', 'heal', 'maxhp', 'cap'];
    rest.push(this.scene.job.usesArmor ? 'armor' : 'dodge');
    // 부적은 이미 하나 지니고 있으면 팔지 않습니다. 쌓이면 죽음이 값을 잃습니다.
    if (!this.scene.charm) rest.push('charm');
    while (picked.length < CFG.shop.offers && rest.length) {
      picked.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    }
    return picked.map((key) => ({ key, price: this.priceOf(key, shopNo), sold: false }));
  }

  // 지금 진열에서 **가장 이득인 것** 하나. 없으면 null 입니다.
  //
  // 살 수 있는 것 중에서만 고릅니다 — 못 사는 것을 가리켜 봐야 약만 오릅니다.
  // 그리고 이득이 0 이하면 아무것도 안 가리킵니다. 속도가 한계라 「가벼운 손」이
  // 헛것이거나, 체력이 가득이라 「응급 처치」가 헛것인 판이 실제로 있습니다 —
  // 그럴 때 억지로 하나를 골라 주면 그 추천이 거짓말이 됩니다.
  bestKey() {
    const s = this.scene;
    const now = powerNow(s);
    if (!(now > 0)) return null;

    let best = null;
    let bestGain = 0.0001; // 이보다 못 하면 추천할 값어치가 없습니다
    this.offers.forEach((o) => {
      if (o.sold || s.coins < o.price) return;
      const gain = powerAfter(s, o.key) / now - 1;
      if (gain > bestGain) { bestGain = gain; best = o.key; }
    });
    return best;
  }

  show(floorIndex) {
    const s = this.scene;
    this.open = true;
    this.shopNo = Math.floor(floorIndex / CFG.shopEvery);

    // 이 상점이 들여놓은 자루. **진열을 뽑기 전에** 굴려야 합니다 —
    // rollOffers 가 "팔 무기가 있느냐"를 보고 무기 칸을 넣을지 정하고,
    // 이름과 그림과 손익도 전부 이 한 자루에서 나옵니다.
    // 지금 든 것과 같은 자루면 팔 것이 없으므로 비웁니다.
    const offered = rollWeapon(s.job, floorIndex);
    s.shopWeapon = offered.index === s.weapon.index ? null : offered;

    this.offers = this.rollOffers(this.shopNo);

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const add = (o) => { this.parts.push(o.setScrollFactor(0).setDepth(300)); return o; };

    // 패널 안 세로 자리. 큰 상점은 보상 한 줄이 더 들어가므로 그만큼 키웁니다.
    const L = SHOP_LAYOUT;
    const big = isBigShopFloor(floorIndex);
    const shift = big ? L.bonusRoom : 0;

    // 주인이 서면 진열을 촘촘하게 줄입니다. 그림이 없으면 예전 그대로입니다.
    const hasKeeper = s.textures.exists('shop-keeper');
    const tight = hasKeeper;
    this.tight = tight;

    // 촘촘하게 줄이면 칸마다 22px 씩 벌어 옵니다. 다섯 칸이면 88px —
    // 거기에 주인이 섭니다.
    const rowGap = tight ? TIGHT.rowGap : L.rowGap;
    const rows = this.offers.length;
    const rowsEnd = L.rowY + shift + (rows - 1) * rowGap + (tight ? TIGHT.rowH : 96) / 2;
    const keeperH = 150;
    const keeperRoom = tight ? keeperH + 24 : 0;
    const buttonY = tight ? rowsEnd + keeperRoom + 46 : L.buttonY + shift;
    const height = tight ? buttonY + 62 : L.height + shift;

    const top = CFG.height / 2 - height / 2;
    this.panelTop = top;
    this.panelH = height;

    add(s.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x000000, 0.72));
    add(s.add.rectangle(cx, CFG.height / 2, L.width, height, 0x1b2138)
      .setStrokeStyle(3, big ? 0xffb74d : 0x5c6bc0));

    add(s.add.text(cx, top + L.titleY, floorIndex + (big ? '층 큰 상점' : '층 상점'),
      font(34, big ? '#ffcc80' : '#ffffff')).setOrigin(0.5, 0));

    // 큰 상점은 도착 자체가 보상입니다. 그 자리에서 알려 줘야 다음을 기다리게 됩니다.
    if (big) {
      const healed = s.bigShopHeal || 0;
      add(s.add.text(cx, top + L.bonusY,
        healed ? '도착 보상 — 체력 ' + healed + ' 회복' : '도착 보상 — 체력이 이미 가득합니다',
        font(19, '#a5d6a7')).setOrigin(0.5, 0));
    }

    this.coinLabel = add(s.add.text(cx, top + L.coinY + shift, '', font(22, '#ffd54f')).setOrigin(0.5, 0));

    this.rows = this.offers.map((offer, i) =>
      this.buildRow(offer, cx, top + L.rowY + shift + i * rowGap));

    const btnY = top + buttonY;

    // ── 상점 주인 ──────────────────────────────────────
    // 값을 치르는 화면에 값을 받는 사람이 하나도 없었습니다.
    if (hasKeeper) {
      const src = s.textures.get('shop-keeper').getSourceImage();
      const h = keeperH;
      const w = h * (src.width / src.height);
      // 왼쪽 끝에 세웁니다. 한가운데에 두면 가격표와 단추 사이를 갈라 놓아
      // 「고르고 → 누른다」가 한 줄로 안 읽힙니다. 그리고 오른쪽이 비어야
      // 말풍선이 설 자리가 생깁니다 (아래).
      const kx = cx - L.width / 2 + 26 + w / 2;
      const ky = top + rowsEnd + 12 + h;
      add(s.add.image(kx, ky, 'shop-keeper').setDisplaySize(w, h).setOrigin(0.5, 1));
      this.keeperAt = { x: Math.round(kx), y: Math.round(ky) };
      this.buildBubble(cx + L.width / 2 - 22, kx + w / 2 + 12, ky - h + 10, ky - 24,
        floorIndex, big);
    }

    const btn = add(s.add.rectangle(cx, btnY, 420, 62, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true }));
    add(s.add.text(cx, btnY, '계속 오르기', font(28, '#ffffff')).setOrigin(0.5));
    this.exitAt = { x: cx, y: btnY };
    btn.on('pointerdown', () => this.close());

    this.refresh();
  }

  // ── 어느 말을 꺼낼까 ───────────────────────────────────
  //
  // 한 판에 상점을 **스무 번 가까이** 지나므로(50층마다, 보스 층만 빼고),
  // 한 주머니에서 무작위로 뽑으면 800층에서 「처음이시죠?」가 나옵니다.
  // 그 한 줄이 여태 쌓아 온 것을 통째로 무너뜨립니다.
  //
  // 그래서 **층이 묶음을 고릅니다.** 어디서나 하는 말(any)에 그 자리의 말을
  // 얹습니다 — 처음에는 반갑고, 중반에는 얼버무리고, 위로 갈수록 주인도
  // 낯설어합니다. 되풀이를 숨기는 대신 되풀이를 이야기로 씁니다.
  keeperPool(floorIndex, big) {
    const K = CFG.keeperLines || {};
    const band = floorIndex <= CFG.shopEvery ? 'first'
      : floorIndex <= 150 ? 'early'
        : floorIndex <= 450 ? 'mid'
          : floorIndex <= 750 ? 'deep' : 'top';
    return {
      band: [].concat(K[band] || [], big ? (K.big || []) : [], this.nowLines()),
      any: (K.any || []).slice(),
    };
  }

  // ── 지금 이 손님을 보고 하는 말 ────────────────────────
  //
  // 위의 묶음은 **자리**가 고르고 이것은 **손님**이 고릅니다. 들어맞는 것만
  // 모아 옵니다 — 하나도 안 맞으면 빈 배열이고, 그때는 예전 그대로입니다.
  //
  // **훈수가 아닙니다.** 무엇을 사야 하는지는 가격표와 「추천」 표가 이미
  // 말합니다. 이 사람은 보고 한마디 할 뿐이고, 사든 말든 자기 알 바 아닙니다.
  nowLines() {
    const s = this.scene;
    const N = (CFG.keeperLines || {}).now || {};
    const out = [];
    const prices = this.offers.map((o) => o.price);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    const whole = prices.reduce((a, b) => a + b, 0);

    if (cheapest && s.coins < cheapest) out.push(...(N.broke || []));
    // 진열을 통째로 사고도 남을 만큼. 「좀 있다」가 아니라 「주체를 못 한다」
    // 여야 이 말이 우스워집니다.
    else if (whole && s.coins >= whole * 1.2) out.push(...(N.rich || []));

    if (s.hp / s.maxHp < 0.34) out.push(...(N.hurt || []));
    if (s.weapon && s.weapon.plusCapped) out.push(...(N.capped || []));
    // 무명(無名) — 한계가 남다른 자루는 이것 하나뿐입니다.
    if (s.weapon && s.weapon.plusMax !== CFG.plusMax) out.push(...(N.unnamed || []));
    if (s.trophies && s.trophies.count) out.push(...(N.trophy || []));
    // 죽고 나서 이 상점부터 다시 시작한 판. 주인만 그 자리에 그대로 있습니다.
    if (s.resume) out.push(...(N.resumed || []));
    return out;
  }

  // ── 두 주머니를 번갈아 ─────────────────────────────────
  //
  // 그냥 합쳐서 섞으면 **어디서나 하는 말이 그 자리의 말을 밀어냅니다.**
  // 950층에서 다섯 마디를 이어 들었더니 전부 「값은 매번 달라요」 같은
  // 어디서나 말이었습니다 — 층을 갈라 둔 값이 사라집니다 (열둘 대 여덟이라
  // 확률상 그렇게 됩니다).
  //
  // 그래서 한 마디 걸러 한 마디씩 그 자리의 말이 나오게 엮습니다. 각각을
  // 따로 섞으므로 순서는 매번 다르고, **같은 말이 한 바퀴 안에 두 번
  // 나오지는 않습니다.**
  weaveLines(pool) {
    const A = Phaser.Utils.Array.Shuffle(pool.band.slice());
    const B = Phaser.Utils.Array.Shuffle(pool.any.slice());
    const out = [];
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      if (i < A.length) out.push(A[i]);
      if (i < B.length) out.push(B[i]);
    }
    return out;
  }

  // ── 주인의 말풍선 ──────────────────────────────────────
  //
  // 주인의 오른쪽 빈 자리에 섭니다. 몇 초마다 한 마디씩 바뀝니다.
  //
  // **말은 정보를 안 줍니다.** 무엇이 이득인지는 「추천」 표와 가격이 이미
  // 말합니다. 이 자리가 하는 일은 다릅니다 — 이 탑에 장사를 하러 들어온
  // 사람이 하나 있고, 그 사람은 다음에도 여기 있다는 것.
  //
  // 그래서 **읽든 말든 괜찮아야 합니다.** 누르면 넘어가는 것도 아니고,
  // 다 읽어야 다음이 나오는 것도 아닙니다. 상점의 알맹이는 진열이고
  // 말풍선은 그 옆에서 혼자 흘러갑니다.
  buildBubble(right, left, top, bottom, floorIndex, big) {
    const s = this.scene;
    const pool = this.keeperPool(floorIndex, big);
    if (!pool.band.length && !pool.any.length) return;
    this.bubblePool = pool;
    const add = (o) => { this.parts.push(o.setScrollFactor(0).setDepth(302)); return o; };

    const w = right - left;
    const h = bottom - top;
    const cxb = left + w / 2;
    const cyb = top + h / 2;

    // 둥근 네모 하나와 왼쪽으로 뻗은 꼬리. 꼬리가 없으면 그냥 글상자라,
    // 누가 하는 말인지가 안 읽힙니다.
    const g = add(s.add.graphics());
    g.fillStyle(0x2b3350, 0.95);
    g.lineStyle(2, 0x5c6bc0, 1);
    g.fillRoundedRect(left, top, w, h, 12);
    g.strokeRoundedRect(left, top, w, h, 12);
    const tailY = top + h * 0.62;
    g.fillStyle(0x2b3350, 0.95);
    g.beginPath();
    g.moveTo(left + 1, tailY - 11);
    g.lineTo(left - 13, tailY);
    g.lineTo(left + 1, tailY + 11);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x5c6bc0, 1);
    g.beginPath();
    g.moveTo(left + 1, tailY - 11);
    g.lineTo(left - 13, tailY);
    g.lineTo(left + 1, tailY + 11);
    g.strokePath();

    this.bubbleText = add(s.add.text(cxb, cyb, '', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#dfe4f5',
    }).setOrigin(0.5).setAlign('center').setWordWrapWidth(w - 26).setLineSpacing(5));

    // 엮어 두고 앞에서부터 꺼내 씁니다. 매번 무작위로 뽑으면 같은 말이
    // 연달아 두 번 나오는 일이 생기는데, 그러면 고장으로 보입니다.
    this.bubbleBag = this.weaveLines(pool);
    this.bubbleAt = 0;

    // **들어서자마자 하는 말은 손님을 보고 합니다.** 뒤에 섞여 있으면
    // 「나를 보고 하는 말」인 줄 모르고 지나갑니다 — 알아본 티는 첫 마디에
    // 내야 알아본 것이 됩니다. 그 뒤로는 그 자리의 말들 사이에 섞여 돕니다.
    const now = this.nowLines();
    if (now.length) {
      const lead = Phaser.Utils.Array.GetRandom(now);
      this.bubbleBag = [lead].concat(this.bubbleBag.filter((t) => t !== lead));
    }
    this.sayNext(false);
    this.bubbleTimer = s.time.addEvent({
      delay: 4600, loop: true, callback: () => this.sayNext(true),
    });
  }

  sayNext(fade) {
    if (!this.bubbleText) return;
    if (this.bubbleAt >= this.bubbleBag.length) {
      this.bubbleBag = this.weaveLines(this.bubblePool);
      this.bubbleAt = 0;
    }
    const line = this.bubbleBag[this.bubbleAt++];
    if (!fade) { this.bubbleText.setText(line); return; }
    // 글자가 툭 바뀌면 눈이 그쪽으로 끌려갑니다. 진열을 보는 중이라면
    // 그건 방해입니다 — 옅어졌다 짙어지게 해서 곁눈에만 걸리게 합니다.
    this.scene.tweens.add({
      targets: this.bubbleText, alpha: 0, duration: 260,
      onComplete: () => {
        if (!this.bubbleText || !this.bubbleText.scene) return;
        this.bubbleText.setText(line);
        this.scene.tweens.add({ targets: this.bubbleText, alpha: 1, duration: 260 });
      },
    });
  }

  buildRow(offer, cx, y) {
    const s = this.scene;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const add = (o) => { this.parts.push(o.setScrollFactor(0).setDepth(301)); return o; };

    const info = SHOP_ITEMS[offer.key];
    const title = offer.key === 'upgrade' && s.shopWeapon ? s.shopWeapon.name : info.title;

    const T = this.tight ? TIGHT : null;
    const box = add(s.add.rectangle(cx, y, 420, T ? T.rowH : 96, 0x232b47)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true }));

    // 다음 무기만은 그림을 같이 답니다. 값을 치르고 사는 것이 무엇인지
    // 이름만으로는 안 보입니다 — 발판 위 UP과 같은 그림이라 짝이 맞습니다.
    let left = cx - 190;
    if (offer.key === 'upgrade' && s.shopWeapon) {
      add(s.add.image(left + 20, y - 8, weaponIconKey(s.job.key, s.shopWeapon.index))
        .setDisplaySize(40, 40));
      left += 48;
    }

    const name = add(s.add.text(left, y + (T ? T.nameY : -26), title,
      font(T ? T.name : 26, '#ffffff')));
    const desc = add(s.add.text(left, y + (T ? T.descY : 8), info.desc,
      font(T ? T.desc : 18, '#8794b5')));
    const price = add(s.add.text(cx + 190, y, '◎ ' + offer.price,
      font(T ? T.price : 24, '#ffd54f')).setOrigin(1, 0.5));

    // 「추천」 표. 자리와 켜고 끄는 것은 refresh 가 정합니다 — 무엇이 이득인지는
    // 하나 살 때마다 바뀌고(공격력을 사면 다음엔 맷집이 아쉬워집니다), 코인이
    // 줄면 못 사게 되는 것도 생기기 때문입니다.
    const recY = y + (T ? T.nameY - 2 : -24);
    const recBg = add(s.add.rectangle(0, recY, 54, 24, 0x2e7d32)
      .setStrokeStyle(1, 0xa5d6a7).setVisible(false));
    const rec = add(s.add.text(0, recY, "추천", font(16, "#c8e6c9"))
      .setOrigin(0.5).setVisible(false));

    box.on('pointerdown', () => this.buy(offer));
    return { offer, box, name, desc, price, rec, recBg };
  }

  buy(offer) {
    const s = this.scene;
    if (offer.sold || s.coins < offer.price) return;

    // ── 무기만은 견주어 보고 삽니다 ──────────────────────
    //
    // 예전에는 여기서 곧장 갈아탔습니다. "상점은 값을 치르고 고르는 자리이니
    // 또 묻는 것은 같은 질문을 두 번 하는 셈"이라고 여겼는데, 거꾸로였습니다 —
    // **상점 쪽이 더 물어봐야 하는 자리**입니다. 필드에서는 강화만 잃지만
    // 여기서는 코인까지 함께 나가는데, 진열의 한 줄로는 두 자루를 견줄 수가
    // 없습니다. 필드와 같은 창을 띄웁니다 (js/scene-swap.js).
    //
    // **코인은 「산다」를 눌렀을 때만 나갑니다.** 먼저 빼 두고 되돌리는 길도
    // 있지만, 되돌리기를 한 군데라도 빠뜨리면 사지도 않은 값을 물게 됩니다.
    if (offer.key === 'upgrade') {
      s.offerWeapon(s.shopWeapon, {
        price: offer.price,
        done: (took) => {
          if (!took) return;
          s.coins -= offer.price;
          offer.sold = true;
          this.refresh();
        },
      });
      return;
    }

    s.coins -= offer.price;
    offer.sold = true;
    applyShopEffect(s, offer.key);
    this.refresh();
  }

  // 살 수 있는 것과 없는 것을 눈에 보이게 구분합니다.
  refresh() {
    const s = this.scene;
    this.coinLabel.setText('가진 코인  ◎ ' + s.coins);

    // 하나 살 때마다 다시 셉니다. 공격력을 사고 나면 다음엔 맷집이 아쉬워지고,
    // 코인이 줄면 못 사게 되는 것도 생깁니다 — 표가 그걸 따라가야 뜻이 있습니다.
    const best = this.bestKey();

    this.rows.forEach(({ offer, box, name, desc, price, rec, recBg }) => {
      const showRec = !offer.sold && offer.key === best;
      rec.setVisible(showRec);
      recBg.setVisible(showRec);

      if (offer.sold) {
        box.setFillStyle(0x171c2e).setStrokeStyle(2, 0x2a3252);
        name.setColor('#4a5578');
        desc.setColor('#3c456b').setText('구입함');
        price.setColor('#4a5578');
        return;
      }
      const can = s.coins >= offer.price;
      box.setFillStyle(can ? 0x232b47 : 0x1c2136).setStrokeStyle(2, can ? 0x3f4a78 : 0x2a3252);
      name.setColor(can ? '#ffffff' : '#6b7599');
      price.setColor(can ? '#ffd54f' : '#6b7599');

      // 다음 무기는 쌓아둔 강화를 지웁니다. 한 자리에서 여러 개를 사는 상점에서는
      // 이게 안 보이면 방금 산 강화가 조용히 사라집니다. 잃을 것을 그대로 적어 둡니다.
      // 속도가 이미 한계라면 사도 헛돈입니다. 사기 전에 알려 줘야 합니다.
      if (offer.key === 'haste' && s.weapon.speedCapped) {
        desc.setText('공격 속도가 이미 한계입니다').setColor('#ff8a80');
      } else if (offer.key === 'plus' && s.weapon.plusCapped) {
        desc.setText('공격력이 이미 한계입니다 (+' + s.weapon.plusMax + ')').setColor('#ff8a80');
      } else if (offer.key === 'upgrade') {
        const w = s.weapon;
        // **초당 피해가 얼마나 달라지는지를 먼저 적습니다.** 그것이 사는 이유이자
        // 안 사는 이유입니다 — 강화를 많이 쌓아 두었으면 오히려 손해입니다.
        // 잃는 것은 공격력 강화뿐입니다. 공격 속도는 무기를 바꿔도 남습니다.
        const next = s.shopWeapon ? w.dpsOf(s.shopWeapon, false) : 0;
        const pct = (next && w.dps) ? Math.round((next / w.dps - 1) * 100) : null;
        const gain = pct === null ? SHOP_ITEMS.upgrade.desc
          : '초당 피해 ' + (pct >= 0 ? '+' : '') + pct + '%';
        const lost = w.plus ? '   (+' + w.plus + ' 잃음)' : '';
        desc.setText(gain + lost)
          .setColor(!can ? '#6b7599' : (pct === null || pct >= 0) ? '#a5d6a7' : '#ff8a80');
      } else {
        desc.setColor(can ? '#8794b5' : '#4a5578');
      }

      // 이름 뒤에 붙입니다. 이름 길이가 저마다 다르고(「다음 무기」는 무기
      // 이름이라 더 깁니다) 무기 그림이 붙으면 왼쪽 끝도 밀리므로,
      // **글자를 다 적은 뒤에** 실제 너비를 재서 자리를 잡습니다.
      if (showRec) {
        const x = name.x + name.width + 34;
        rec.setX(x);
        recBg.setX(x);
      }
    });
  }

  close() {
    // 시계를 안 끄면 창이 닫힌 뒤에도 계속 돌면서 이미 지워진 글상자를
    // 건드립니다. 다음 상점에서 두 벌이 겹쳐 돌기도 합니다.
    if (this.bubbleTimer) { this.bubbleTimer.remove(); this.bubbleTimer = null; }
    this.bubbleText = null;
    this.parts.forEach((p) => p.destroy());
    this.parts = [];
    this.rows = [];
    this.open = false;
    this.scene.onShopClosed();
  }
}
