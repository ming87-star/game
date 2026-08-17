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
    // 상점의 무기 칸. 진열을 펼칠 때 굴려 둔 자루로 곧장 갈아탑니다 —
    // 상점은 이미 판이 멈춰 있고 값을 치르고 고르는 자리라, 여기서 또
    // 갈아탈지 묻는 창을 띄우면 같은 질문을 두 번 하는 셈입니다.
    case 'upgrade': if (s.weapon.swapTo(s.shopWeapon)) s.noteWeapon(); break;
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
        s.dodgeMax += CFG.shop.capGain.dodge;
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
  const pool = ['maxhp', 'cap', 'plus']; // 이 셋은 한계가 없어 언제나 값이 움직입니다
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
      const before = 1 + w.plusValue * CFG.plusStep;
      const after = 1 + (w.plusValue + c.bundle.plus * (s.job.plusScale || 1)) * CFG.plusStep;
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
      else dodge = Math.min(s.dodgeMax + c.capGain.dodge, dodge + c.capGain.dodge);
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
    const height = L.height + shift;
    const top = CFG.height / 2 - height / 2;

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
      this.buildRow(offer, cx, top + L.rowY + shift + i * L.rowGap));

    const btnY = top + L.buttonY + shift;
    const btn = add(s.add.rectangle(cx, btnY, 420, 62, 0x3949ab)
      .setStrokeStyle(2, 0x9fa8da).setInteractive({ useHandCursor: true }));
    add(s.add.text(cx, btnY, '계속 오르기', font(28, '#ffffff')).setOrigin(0.5));
    this.exitAt = { x: cx, y: btnY };
    btn.on('pointerdown', () => this.close());

    this.refresh();
  }

  buildRow(offer, cx, y) {
    const s = this.scene;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const add = (o) => { this.parts.push(o.setScrollFactor(0).setDepth(301)); return o; };

    const info = SHOP_ITEMS[offer.key];
    const title = offer.key === 'upgrade' && s.shopWeapon ? s.shopWeapon.name : info.title;

    const box = add(s.add.rectangle(cx, y, 420, 96, 0x232b47)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true }));

    // 다음 무기만은 그림을 같이 답니다. 값을 치르고 사는 것이 무엇인지
    // 이름만으로는 안 보입니다 — 발판 위 UP과 같은 그림이라 짝이 맞습니다.
    let left = cx - 190;
    if (offer.key === 'upgrade' && s.shopWeapon) {
      add(s.add.image(left + 20, y - 8, weaponIconKey(s.job.key, s.shopWeapon.index))
        .setDisplaySize(40, 40));
      left += 48;
    }

    const name = add(s.add.text(left, y - 26, title, font(26, '#ffffff')));
    const desc = add(s.add.text(left, y + 8, info.desc, font(18, '#8794b5')));
    const price = add(s.add.text(cx + 190, y, '◎ ' + offer.price, font(24, '#ffd54f')).setOrigin(1, 0.5));

    // 「추천」 표. 자리와 켜고 끄는 것은 refresh 가 정합니다 — 무엇이 이득인지는
    // 하나 살 때마다 바뀌고(공격력을 사면 다음엔 맷집이 아쉬워집니다), 코인이
    // 줄면 못 사게 되는 것도 생기기 때문입니다.
    const recBg = add(s.add.rectangle(0, y - 24, 54, 24, 0x2e7d32)
      .setStrokeStyle(1, 0xa5d6a7).setVisible(false));
    const rec = add(s.add.text(0, y - 24, '추천', font(16, '#c8e6c9'))
      .setOrigin(0.5).setVisible(false));

    box.on('pointerdown', () => this.buy(offer));
    return { offer, box, name, desc, price, rec, recBg };
  }

  buy(offer) {
    const s = this.scene;
    if (offer.sold || s.coins < offer.price) return;

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
    this.parts.forEach((p) => p.destroy());
    this.parts = [];
    this.rows = [];
    this.open = false;
    this.scene.onShopClosed();
  }
}
