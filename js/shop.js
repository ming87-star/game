// 50층마다 나오는 상점. 모아둔 코인으로 강화를 삽니다.
// 여기 있는 동안은 적이 나오지 않습니다 — 한숨 돌리는 자리이기도 합니다.

// 패널 위쪽부터의 세로 좌표. 상품 칸은 높이 96이라 rowY - 48 부터 자리를 씁니다.
const SHOP_LAYOUT = {
  width: 470,
  height: 620,
  titleY: 26,
  coinY: 74,
  rowY: 148,
  rowGap: 112,
  buttonY: 532,
  bonusY: 70,      // 큰 상점의 도착 보상 한 줄
  bonusRoom: 34,   // 그 줄이 들어갈 만큼 패널을 키웁니다
};

const SHOP_ITEMS = {
  plus:    { title: '공격력 +1',    desc: '지금 무기의 공격력을 올립니다' },
  haste:   { title: '공격 속도 +',  desc: '휘두르는 속도가 조금 빨라집니다' },
  upgrade: { title: '다음 무기',     desc: '강화는 초기화됩니다' },
  heal:    { title: '체력 회복',     desc: '체력을 가득 채웁니다' },
  maxhp:   { title: '최대 체력 +' + CFG.shop.maxhpGain, desc: '최대치가 늘고 그만큼 회복합니다' },
  armor:   { title: '방어구 +' + CFG.armor.shopGain + '%', desc: '받는 피해가 그만큼 줄어듭니다' },
  dodge:   { title: '회피 +' + Math.round(CFG.dodge.shopGain * 100) + '%', desc: '그만큼 더 흘려 넘깁니다' },
};

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
    if (!this.scene.weapon.atMaxTier) picked.push('upgrade');

    // 갑옷을 안 입는 직업에게는 방어구를 팔지 않습니다.
    // ×2는 상점에서 팔지 않습니다. 지도에서 아주 드물게만 나오는 물건으로 남깁니다.
    const rest = ['plus', 'haste', 'heal', 'maxhp'];
    if (this.scene.job.usesArmor) rest.push('armor');
    while (picked.length < CFG.shop.offers && rest.length) {
      picked.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    }
    return picked.map((key) => ({ key, price: this.priceOf(key, shopNo), sold: false }));
  }

  show(floorIndex) {
    const s = this.scene;
    this.open = true;
    this.shopNo = Math.floor(floorIndex / CFG.shopEvery);
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
    const title = offer.key === 'upgrade' && s.weapon.nextName ? s.weapon.nextName : info.title;

    const box = add(s.add.rectangle(cx, y, 420, 96, 0x232b47)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true }));

    // 다음 무기만은 그림을 같이 답니다. 값을 치르고 사는 것이 무엇인지
    // 이름만으로는 안 보입니다 — 발판 위 UP과 같은 그림이라 짝이 맞습니다.
    let left = cx - 190;
    if (offer.key === 'upgrade' && !s.weapon.atMaxTier) {
      add(s.add.image(left + 20, y - 8, weaponIconKey(s.job.key, s.nextTier()))
        .setDisplaySize(40, 40));
      left += 48;
    }

    const name = add(s.add.text(left, y - 26, title, font(26, '#ffffff')));
    const desc = add(s.add.text(left, y + 8, info.desc, font(18, '#8794b5')));
    const price = add(s.add.text(cx + 190, y, '◎ ' + offer.price, font(24, '#ffd54f')).setOrigin(1, 0.5));

    box.on('pointerdown', () => this.buy(offer));
    return { offer, box, name, desc, price };
  }

  buy(offer) {
    const s = this.scene;
    if (offer.sold || s.coins < offer.price) return;

    s.coins -= offer.price;
    offer.sold = true;

    switch (offer.key) {
      case 'plus': s.weapon.addPlus(); break;
      case 'haste': s.weapon.addHaste(); break;
      case 'upgrade': if (s.weapon.upgrade()) s.noteWeapon(); break;
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
    }
    this.refresh();
  }

  // 살 수 있는 것과 없는 것을 눈에 보이게 구분합니다.
  refresh() {
    const s = this.scene;
    this.coinLabel.setText('가진 코인  ◎ ' + s.coins);

    this.rows.forEach(({ offer, box, name, desc, price }) => {
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
        // 잃는 것은 공격력 강화뿐입니다. 공격 속도는 무기를 바꿔도 남습니다.
        const stack = w.plus ? '+' + w.plus : '';
        if (stack) {
          desc.setText('지금 강화를 잃습니다   ' + stack).setColor(can ? '#ff8a80' : '#6b7599');
        } else {
          desc.setText(SHOP_ITEMS.upgrade.desc).setColor(can ? '#8794b5' : '#4a5578');
        }
      } else {
        desc.setColor(can ? '#8794b5' : '#4a5578');
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
