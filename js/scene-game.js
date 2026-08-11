const STAND_OFFSET = CFG.platformH / 2 + 24; // 발판 위에 발이 닿는 높이

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  init(data) {
    this.job = classByKey((data && data.jobKey) || Save.data.lastJob || 'warrior');
    Save.setJob(this.job.key);
    // 「이어서 진행하기」로 들어왔으면 직전 상점을 나서던 자리를 그대로 물려받습니다.
    this.resume = (data && data.resume) || null;
  }

  // 그려 둔 그림을 먼저 굽습니다. create 의 buildTextures 는 이미 있는 키를
  // 건너뛰므로, 그림이 있는 것은 그림이 · 없는 것은 도형이 쓰입니다.
  preload() {
    loadArt(this);
  }

  create() {
    buildTextures(this);

    this.dead = false;
    this.jumping = false;
    this.floorIndex = 0;
    this.lane = 'mid';
    resetTowerRun(); // 이번 판의 UP 배치를 새로 뽑습니다

    this.maxHp = this.job.hp;
    this.hp = this.maxHp;
    this.weapon = new Weapon(this.job);
    this.armor = this.job.armor; // 받는 피해 감소 %
    this.armorMax = this.job.armorMax || CFG.armor.max;
    // 회피도 판 안에서 자랍니다 (갑옷을 안 입는 직업의 '회' 아이템).
    this.dodge = this.job.dodge || 0;
    this.dodgeMax = this.job.dodgeMax || this.dodge;
    // 이번 판에서 손에 넣은 무기를 얻은 순서대로. 죽음 화면의 계승이 둘째를 씁니다.
    this.gotWeapons = [];
    this.coins = 0;
    this.totalCoins = 0;
    this.kills = 0;
    this.medals = 0; // 이번 판에 번 메달. 죽을 때 받을지 말지 고릅니다.
    this.charm = false; // 수호 부적 — 상점에서만 삽니다. 쓰러질 때 한 번 버팁니다

    // 메달 상점에서 사 둔 것과 계승해 온 무기를 여기서 한 번에 바릅니다.
    // 꺼내면 사라집니다 — 전부 이번 판에만 붙는 것들입니다.
    this.boosts = applyBoosts(this, Save.takeBoosts());
    this.noteWeapon(); // 들고 시작한 것이 첫 번째

    // 보스 투기장. 여기 있는 동안은 위로 오르지 못하고 좌우로만 움직입니다.
    this.bossFight = false;
    this.bossEntering = false;
    this.boss = null;
    this.arenaY = 0;
    this.bossFloor = -1;

    // 유물을 고르는 동안은 판이 멈춥니다.
    this.choosing = false;

    // 박쥐 — 상점을 떠난 뒤 흐른 시간으로 잽니다.
    this.lastShopAt = 0;
    this.nextBatAt = 0;
    // 층에 올라설 때 한 번씩 알려 주는 것들 (박쥐 51층 · 함정 101층).
    // 판 하나에 한 번뿐이라 Set 으로 들고 다닙니다.
    this.gatesShown = new Set();
    this.batsFrom = 0; // 알린 뒤 이 시각부터 박쥐가 옵니다

    this.lastHitAt = -9999;
    this.lastSwingAt = 0;
    this.lastSubAt = 0;
    this.subTarget = null;
    this.pickups = [];
    this.seenTypes = new Set(); // 처음 만나는 적은 이름을 띄워 줍니다

    this.floors = new Map();
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    // 기는 것이 밟고 다닐 발판. 보이지 않는 정적 몸체만 깔아 둡니다.
    this.platforms = this.physics.add.staticGroup();

    // 이어서 진행하기. 몇 번 썼는지는 판을 건너 따라옵니다.
    // 위의 초기값이 전부 자리를 잡은 뒤에 덮어써야 합니다 — 중간에 끼워 넣으면
    // 뒤따르는 초기화(seenTypes 등)가 되살린 것을 도로 지웁니다.
    this.continues = this.resume ? this.resume.continues : 0;
    this.resumePoint = null; // 상점을 나설 때마다 여기에 자리를 찍어 둡니다
    if (this.resume) this.applyResume(this.resume);

    this.drawBackground();
    for (let i = this.floorIndex; i <= this.floorIndex + 7; i++) this.addFloor(i);

    // 이어서 진행할 때는 그 상점 발판 위에 섭니다. 상점은 다시 열리지 않습니다 —
    // 이미 쓴 상점이고, 발판을 밟는 순간에만 열리기 때문입니다.
    const start = this.floors.get(this.floorIndex).slots.mid;
    this.player = this.physics.add.sprite(start.x, start.y - STAND_OFFSET, 'player-' + this.job.key);
    this.player.setDepth(10);
    this.player.body.setSize(26, 40).setOffset(6, 6);
    this.player.body.setAllowGravity(false);
    // 보이는 몸은 따로입니다. 물리 몸은 그대로 두고 겉몸에만 모션을 얹습니다
    // (까닭은 js/motion.js 맨 위에).
    this.rig = new PlayerRig(this);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyTouch, null, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.onEnemyShotHit, null, this);
    // 발판에 부딪히는 것은 땅을 딛는 적뿐입니다. 나는 것은 그대로 통과합니다.
    this.physics.add.collider(this.enemies, this.platforms, null,
      (enemy) => enemy.def && enemy.def.ground);

    this.cameras.main.setScroll(0, this.player.y - CFG.height * 0.68);

    this.hud = new Hud(this);
    this.shop = new Shop(this);
    this.bindInput();

    this.ambientAt = this.time.now + CFG.ambient.baseDelay;
    this.armItems();
    this.tapBlockedUntil = 0;
    this.dimmedFloor = -1;
    this.markReach();
    this.announceBoosts();

    window.__scene = this; // 브라우저 콘솔·자동 플레이테스트에서 상태를 보기 위한 통로
  }

  // ── 이어서 진행하기 ───────────────────────────────────
  // 상점을 나설 때마다 그 자리를 찍어 둡니다. 죽었을 때 이 자리로 되돌아갑니다.
  //
  // 죽은 자리가 아니라 **상점을 나서던 자리**인 것이 중요합니다. 죽기 직전의
  // 상태를 그대로 되살리면, 상점 위층에서 주운 것을 챙긴 채 다시 시작하게 되어
  // "죽기 직전까지 긁어모으고 이어하기"가 이득이 됩니다.
  snapshotAtShop() {
    const w = this.weapon;
    this.resumePoint = {
      floor: this.floorIndex,
      hp: this.hp, maxHp: this.maxHp,
      armor: this.armor, dodge: this.dodge,
      coins: this.coins, totalCoins: this.totalCoins,
      kills: this.kills,
      continues: this.continues,
      gotWeapons: this.gotWeapons.map((g) => ({ tier: g.tier, plus: g.plus })),
      seenTypes: [...this.seenTypes],
      gatesShown: [...this.gatesShown],
      weapon: {
        tier: w.tier, plus: w.plus, haste: w.haste, mult: w.mult, capBonus: w.capBonus,
        relics: w.relics.map((r) => r.key),
      },
    };
  }

  applyResume(r) {
    this.floorIndex = r.floor;
    this.maxHp = r.maxHp;
    this.hp = r.hp;
    this.armor = r.armor;
    this.dodge = r.dodge;
    this.coins = r.coins;
    this.totalCoins = r.totalCoins;
    this.kills = r.kills;
    this.gotWeapons = r.gotWeapons.map((g) => ({ tier: g.tier, plus: g.plus }));
    this.seenTypes = new Set(r.seenTypes);
    // 이미 본 알림은 다시 안 띄웁니다. 150층 상점에서 이어서 시작하는데
    // "이제 함정이 섞입니다"가 또 뜨면 새 소식이 아니라 잡음입니다.
    this.gatesShown = new Set(r.gatesShown || []);
    // 메달은 여기 없습니다. 그것이 이어서 진행하는 값입니다.

    const w = this.weapon;
    w.tier = r.weapon.tier;
    w.plus = r.weapon.plus;
    w.haste = r.weapon.haste;
    w.mult = r.weapon.mult;
    w.capBonus = r.weapon.capBonus;
    w.relics = r.weapon.relics
      .map((key) => RELICS.find((x) => x.key === key)).filter(Boolean);

    // 탑은 새로 지어집니다 (resetTowerRun). 층 배치까지 되살릴 수는 없으니,
    // 그 위로는 처음 보는 탑입니다 — 되짚어 오르는 지루함은 없습니다.
    this.resumePoint = { ...r, continues: this.continues };
  }

  // ── 배경 ──────────────────────────────────────────────
  drawBackground() {
    this.cameras.main.setBackgroundColor('#141a2e');

    // 탑 안쪽 벽. 화면에 고정해 두고 **무늬만 흘려 보냅니다.**
    //
    // 벽을 세상 좌표에 두면 500×960 짜리를 몇 백 장 깔아야 하고, 그 이음매마다
    // 선이 보입니다. 화면에 고정한 채 tilePositionY 를 카메라만큼 밀면, 한 장으로
    // 끝없이 이어지고 오르는 느낌도 그대로 남습니다 (update 에서 밉니다).
    if (hasArt('wall')) {
      const a = artSize('wall');
      this.wall = this.add.tileSprite(CFG.width / 2, CFG.height / 2, a.w, CFG.height, 'wall')
        .setScrollFactor(0).setDepth(-5);
    } else {
      this.add.rectangle(CFG.width / 2, CFG.height / 2, 500, CFG.height, 0x1d2542)
        .setScrollFactor(0).setDepth(-5);
    }
  }

  // ── 층 만들기 / 지우기 ────────────────────────────────
  addFloor(index) {
    if (this.floors.has(index)) return;
    // 보스와 싸우는 동안 투기장 위는 비어 있습니다. 오를 곳이 없어야
    // "위로 도망치지 말고 여기서 끝내라"가 규칙으로 읽힙니다.
    if (this.bossFight && index > this.bossFloor) return;
    const floor = makeFloor(index, healNeedFrom(this.hp, this.maxHp), this.job.usesArmor);
    floor.views = [];

    for (const lane of LANES) {
      const slot = floor.slots[lane];
      if (!slot) continue;

      const wide = slot.kind === SLOT.SHOP || slot.kind === SLOT.BOSS;
      const arena = slot.kind === SLOT.BOSS;
      const w = wide ? CFG.width - 80 : CFG.platformW;
      const color = arena ? 0x6a1b9a : wide ? 0xffb74d : 0x5c6bc0;
      const lipColor = arena ? 0xce93d8 : wide ? 0xffe0b2 : 0x9fa8da;

      // 발판 그림은 쓰이는 크기 그대로 그려져 있습니다 (140×20 · 460×20).
      // 늘리거나 줄일 일이 없으므로 그냥 얹으면 됩니다.
      const deckArt = arena ? 'plat-boss' : wide ? 'plat-shop' : 'plat';
      slot.deck = hasArt(deckArt)
        ? [this.add.image(slot.x, slot.y, deckArt)]
        : [
          this.add.rectangle(slot.x, slot.y, w, CFG.platformH, color),
          this.add.rectangle(slot.x, slot.y - CFG.platformH / 2 + 3, w, 6, lipColor),
        ];
      floor.views.push(...slot.deck);

      const solid = this.add.rectangle(slot.x, slot.y, w, CFG.platformH, 0x000000, 0);
      this.physics.add.existing(solid, true);
      this.platforms.add(solid);
      floor.views.push(solid);

      const mark = this.makeMark(slot);
      if (mark) { slot.view = mark; floor.views.push(mark); }
    }

    this.floors.set(index, floor);
  }

  // 올라가기 전에 무엇이 있는지 보이게 해서, 좌우 선택이 판단이 되게 합니다.
  // 무엇을 놓을지는 SLOT_MARK 와 slotArtKey 가 정합니다 (js/tower.js).
  makeMark(slot) {
    if (slot.kind === SLOT.BOSS) {
      return this.add.text(slot.x, slot.y - 46, '보 스', {
        fontFamily: 'sans-serif', fontSize: '28px', color: '#ce93d8',
      }).setOrigin(0.5).setDepth(5);
    }

    if (slot.kind === SLOT.SHOP) {
      return this.add.text(slot.x, slot.y - 44, '상 점', {
        fontFamily: 'sans-serif', fontSize: '26px', color: '#ffcc80',
      }).setOrigin(0.5).setDepth(5);
    }

    if (slot.kind === SLOT.ENEMY) {
      return this.add.text(slot.x, slot.y - 40, '⚠ ' + slot.enemyCount, {
        fontFamily: 'sans-serif', fontSize: '20px', color: '#ff8a80',
      }).setOrigin(0.5).setDepth(5);
    }

    // 최고 단계에서는 UP이 회복으로 대신 쓰이므로, 표시도 회복처럼 보여야 합니다.
    // 가짜는 흉내 내는 것의 표를 그대로 씁니다 — 겉으로는 구분이 안 됩니다.
    let kind = slot.kind === SLOT.UPGRADE && this.weapon.atMaxTier ? SLOT.HEAL : slot.kind;
    if (kind === SLOT.MIMIC) kind = slot.disguise;
    const mark = SLOT_MARK[kind];
    if (!mark) return null;

    // 그림이 있으면 **물건 그 자체**를 놓습니다. 동그라미도 글자도 없습니다.
    //
    // 동그라미 안 글자(`+1` `속` `방`)는 무엇인지 읽어야 알 수 있었습니다.
    // 아이템을 줄여 하나하나가 귀해졌으니, 저 위에 무엇이 놓였는지가
    // **읽기 전에 보여야** 그쪽으로 붙을지 말지를 두 층 밖에서 정할 수 있습니다.
    // UP은 원래부터 다음 무기의 그림을 답니다 — 같은 이유였습니다.
    const artKey = slotArtKey(kind, this.job.key);
    const parts = [];
    let face;
    if (kind === SLOT.UPGRADE) {
      face = this.add.image(0, 0, weaponIconKey(this.job.key, this.nextTier())).setDisplaySize(30, 30);
      parts.push(this.add.circle(0, 0, 18, mark.color), face);
    } else if (artKey && this.textures.exists(artKey)) {
      face = this.add.image(0, 0, artKey);
      parts.push(face);
    } else {
      face = this.add.text(0, 0, mark.label, {
        fontFamily: 'sans-serif', fontSize: '20px', color: mark.text,
      }).setOrigin(0.5);
      parts.push(this.add.circle(0, 0, 18, mark.color), face);
    }

    const badge = this.add.container(slot.x, slot.y - 38, parts).setDepth(5);
    if (kind === SLOT.UPGRADE) slot.upIcon = face;

    // 멀리서는 진짜와 완전히 같이 흔들립니다. 가짜가 드러나는 것은
    // 주인공이 가까이 왔을 때뿐입니다 (updateItems 의 revealMimic).
    this.tweens.add({
      targets: badge, y: badge.y - 12,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // 가짜는 나중에 정체를 드러내야 하므로 조각을 붙들어 둡니다.
    // 그림일 때는 갈아 끼울 한 장뿐이고, 글자일 때는 동그라미와 글자 둘입니다.
    if (slot.kind === SLOT.MIMIC) {
      slot.badgeParts = parts.length === 1
        ? { image: face }
        : { circle: parts[0], label: parts[1] };
    }
    return badge;
  }

  // UP을 밟으면 손에 들어올 무기의 단계. 마지막 무기를 들었으면 그대로입니다.
  nextTier() {
    return Math.min(this.weapon.tier + 1, this.job.weapons.length - 1);
  }

  // 발판은 주인공보다 예닐곱 층 앞서 지어집니다. 그 사이에 상점에서 UP을 사거나
  // 다른 UP을 밟으면, 이미 지어 둔 발판의 그림이 한 단계 뒤진 채로 남습니다.
  // 단계가 바뀌었을 때만 훑어서 고쳐 답니다.
  syncUpgradeMarks() {
    if (this.markedTier === this.weapon.tier) return;
    this.markedTier = this.weapon.tier;

    const key = weaponIconKey(this.job.key, this.nextTier());
    this.floors.forEach((floor) => {
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || !slot.upIcon || !slot.view || slot.taken || slot.expired) continue;

        // 마지막 무기를 들면 UP은 회복으로 쓰입니다. 표시도 회복이어야 합니다 —
        // 무기 그림을 달아 둔 채로 밟으면 안 나오는 것을 기대하게 만듭니다.
        if (this.weapon.atMaxTier) {
          slot.view.destroy();
          slot.upIcon = null;
          slot.view = this.makeMark(slot);
          if (slot.view) floor.views.push(slot.view);
          continue;
        }
        if (slot.upIcon.texture.key !== key) slot.upIcon.setTexture(key).setDisplaySize(30, 30);
      }
    });
  }

  removeFloor(index) {
    const floor = this.floors.get(index);
    if (!floor) return;
    floor.views.forEach((v) => v.destroy());
    this.floors.delete(index);
  }

  // 화면에 들어온 층의 적을 내보냅니다. 어느 쪽으로 가든 쫓아옵니다.
  wakeFloor(index) {
    const floor = this.floors.get(index);
    if (!floor) return;
    for (const lane of LANES) {
      const slot = floor.slots[lane];
      if (!slot || slot.kind !== SLOT.ENEMY || slot.spawned) continue;
      slot.spawned = true;
      slot.enemyTypes.forEach((type, i) => {
        spawnEnemy(this, slot.x + Phaser.Math.Between(-45, 45), slot.y - 50 - i * 30, index, type);
      });
      // 실제로 나왔으니 예고 표시는 지웁니다.
      if (slot.view) { slot.view.destroy(); slot.view = null; }
    }
  }

  // 이 판에서 처음 나온 종류라면 이름을 띄웁니다.
  // 올라갈수록 새 적이 풀리는데, 알려주지 않으면 그냥 빨간 덩어리가 하나 늘 뿐입니다.
  announceEnemy(def) {
    const label = this.add.text(CFG.width / 2, 168, '새로운 적', {
      fontFamily: 'sans-serif', fontSize: '20px', color: '#8794b5',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
    const name = this.add.text(CFG.width / 2, 202, def.name, {
      fontFamily: 'sans-serif', fontSize: '38px', color: '#ff8a80',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);

    [label, name].forEach((t) => {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 260, yoyo: true, hold: 1500,
        onComplete: () => t.destroy() });
    });
  }

  spawnAmbient() {
    // 상점 층은 한숨 돌리는 자리입니다. 여기 서 있는 동안은 아무도 오지 않습니다.
    if (isShopFloor(this.floorIndex)) return;

    const a = CFG.ambient;
    const cap = this.floorIndex >= a.deepFloor ? a.deepCount : a.maxCount;
    const count = Math.min(cap, 1 + Math.floor(this.floorIndex / 14));

    for (let i = 0; i < count; i++) {
      const type = pickEnemyType(this.floorIndex);
      const def = enemyDef(type);

      if (!def.ground) {
        // 나는 것은 화면 위 가장자리에서 곧장 들어옵니다.
        spawnEnemy(this, Phaser.Math.Between(60, CFG.width - 60),
          this.cameras.main.scrollY - 40 - i * 30, this.floorIndex, type);
        continue;
      }

      // 땅을 딛는 적은 허공에 두면 그대로 떨어져 사라집니다.
      // 주인공이 곧 지나갈 위층 발판을 골라 그 위에 내려놓습니다.
      const index = this.floorIndex + Phaser.Math.Between(1, 3);
      const floor = this.floors.get(index);
      if (!floor) continue;

      const lanes = LANES.filter((l) => floor.slots[l]);
      const slot = floor.slots[lanes[Math.floor(Math.random() * lanes.length)]];
      spawnEnemy(this, slot.x + Phaser.Math.Between(-40, 40), slot.y - 70 - i * 26, index, type);
    }
  }

  // ── 조작 ──────────────────────────────────────────────
  bindInput() {
    this.input.on('pointerdown', (p) => {
      if (this.shop.open) return; // 상점 버튼은 상점이 직접 받습니다
      if (this.time.now < this.tapBlockedUntil) return;
      // 죽은 뒤에는 아무 데나 눌러 다시 시작할 수 없습니다. 무엇을 가져갈지
      // 세 갈래 중 하나를 골라야 하고, 그 버튼들이 직접 입력을 받습니다.
      if (this.dead) return;
      // 화면을 삼등분해서 왼쪽이면 한 칸 왼쪽, 가운데면 바로 위, 오른쪽이면 한 칸 오른쪽.
      // 누른 자리의 발판으로 순간이동하는 것이 아니라 방향을 고르는 것입니다.
      const third = this.scale.width / 3;
      const step = p.x < third ? -1 : p.x < third * 2 ? 0 : 1;
      this.hud.flashArrow(step);
      this.jump(step);
    });
    const key = (step) => () => {
      if (this.shop.open || this.dead) return;
      this.hud.flashArrow(step);
      this.jump(step);
    };
    this.input.keyboard.on('keydown-LEFT', key(-1));
    this.input.keyboard.on('keydown-UP', key(0));
    this.input.keyboard.on('keydown-DOWN', key(0));
    this.input.keyboard.on('keydown-RIGHT', key(1));
  }

  // step: -1 왼쪽 · 0 바로 위 · +1 오른쪽. 한 번에 한 칸까지만 옮겨 갑니다.
  jump(step) {
    if (this.jumping || this.dead || this.shop.open || this.choosing) return;
    // 투기장에서는 위로 오르지 않습니다. 좌우로 비켜서 떨어지는 것을 피할 뿐입니다.
    if (this.bossFight) return this.slide(step);
    const next = this.floors.get(this.floorIndex + 1);
    if (!next) return;

    const here = LANES.indexOf(this.lane);
    const want = Phaser.Math.Clamp(here + step, 0, LANES.length - 1);

    // 닿을 수 있는 길은 지금 자리에서 한 칸 이내뿐입니다.
    // 그 안에서 원하는 쪽에 발판이 없으면 가장 가까운 길로 갑니다 — 점프는 실패하지 않습니다.
    const slot = next.slots[LANES[want]] || LANES
      .map((l, i) => ({ slot: next.slots[l], i }))
      .filter((c) => c.slot && Math.abs(c.i - here) <= 1)
      .sort((a, b) => Math.abs(a.i - want) - Math.abs(b.i - want))
      .map((c) => c.slot)[0];
    if (!slot) return;

    this.jumping = true;
    this.player.setFlipX(slot.x < this.player.x);

    const fromX = this.player.x;
    const fromY = this.player.y;
    const toX = slot.x;
    const toY = slot.y - STAND_OFFSET;
    const arc = { t: 0 };

    // 도적은 뛰면서 한 바퀴 돕니다.
    if (this.job.key === 'rogue') {
      this.player.setRotation(0);
      this.tweens.add({
        targets: this.player,
        rotation: (slot.x < fromX ? -1 : 1) * Math.PI * 2,
        duration: CFG.jumpDuration,
        onComplete: () => this.player.setRotation(0),
      });
    }

    this.tweens.add({
      targets: arc,
      t: 1,
      duration: CFG.jumpDuration,
      ease: 'Linear',
      onUpdate: () => {
        this.player.x = Phaser.Math.Linear(fromX, toX, arc.t);
        this.player.y = Phaser.Math.Linear(fromY, toY, arc.t) - Math.sin(Math.PI * arc.t) * CFG.jumpArc;
      },
      onComplete: () => {
        this.jumping = false;
        // 점프 도중에 죽었다면 착지 처리는 하지 않습니다.
        // (그냥 두면 죽은 뒤에 회복 아이템을 먹어 체력이 되살아납니다)
        if (this.dead) return;
        this.floorIndex = next.index;
        this.checkFloorGates();
        this.lane = slot.lane;
        this.land(slot);
      },
    });
  }

  // 투기장에서의 이동. 층은 그대로고 줄만 바뀝니다.
  slide(step) {
    if (!step) return;
    const here = LANES.indexOf(this.lane);
    const want = Phaser.Math.Clamp(here + step, 0, LANES.length - 1);
    if (want === here) return;

    this.lane = LANES[want];
    this.jumping = true;
    this.player.setFlipX(step < 0);
    this.tweens.add({
      targets: this.player, x: CFG.laneX[this.lane],
      duration: 150, ease: 'Quad.out',
      onComplete: () => { this.jumping = false; },
    });
  }

  // ── 보스 ──────────────────────────────────────────────
  startBoss(slot) {
    if (slot.view) { slot.view.destroy(); slot.view = null; }
    this.bossFight = true;
    this.bossEntering = true;
    this.bossFloor = this.floorIndex;
    this.arenaY = slot.y;

    // 따라오던 것들은 물러갑니다. 투기장에는 보스와 주인공뿐입니다.
    this.enemies.getChildren().slice().forEach((e) => e.destroy());
    this.enemyBullets.clear(true, true);
    this.bullets.clear(true, true);
    this.subTarget = null;
    this.clearBats();

    // 위로 오르는 발판이 사라집니다.
    for (const index of Array.from(this.floors.keys())) {
      if (index > this.bossFloor) this.removeFloor(index);
    }
    this.hud.setArrows([true, false, true]);

    this.boss = spawnBoss(this, this.floorIndex, CFG.width / 2, this.arenaY - 560);
    this.announceBoss();

    // 위에서 내려앉습니다. 내려앉는 동안은 공격하지 않습니다.
    this.tweens.add({
      targets: this.boss, y: this.arenaY - 185,
      duration: CFG.boss.entryMs, ease: 'Cubic.out',
      onComplete: () => {
        this.bossEntering = false;
        this.cameras.main.shake(420, 0.016);
      },
    });
  }

  announceBoss() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    const veil = this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x1a0033, 0)
      .setScrollFactor(0).setDepth(140);
    this.tweens.add({ targets: veil, alpha: 0.5, duration: 500, yoyo: true, hold: 1100,
      onComplete: () => veil.destroy() });

    const parts = [
      this.add.text(cx, 300, this.floorIndex + '층', font(22, '#ce93d8')).setOrigin(0.5),
      this.add.text(cx, 348, bossKindFor(this.floorIndex).name, font(50, '#ffffff')).setOrigin(0.5),
      this.add.text(cx, 400, '좌우로만 움직일 수 있습니다', font(20, '#e1bee7')).setOrigin(0.5),
    ];
    parts.forEach((t, i) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0).setScale(i === 1 ? 1.4 : 1);
      this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 420, ease: 'Back.out' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1900, duration: 400,
        onComplete: () => t.destroy() });
    });
    this.cameras.main.shake(600, 0.006);
  }

  bossDefeated(boss) {
    this.bossFight = false;
    this.bossEntering = false;
    this.boss = null;
    this.enemyBullets.clear(true, true);

    // 남은 졸개도 같이 걷힙니다.
    this.enemies.getChildren().slice().forEach((e) => e.destroy());

    const healed = Math.min(Math.round(this.maxHp * CFG.boss.heal), this.maxHp - Math.round(this.hp));
    this.hp += healed;
    this.medals += CFG.boss.medals;
    this.dropCoin(boss.x, boss.y, CFG.boss.coin, true);

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const parts = [
      this.add.text(cx, 320, '수문장을 쓰러뜨렸습니다', font(30, '#ffd54f')).setOrigin(0.5),
      this.add.text(cx, 366, '🏅 +' + CFG.boss.medals +
        (healed ? '    체력 +' + healed : ''), font(24, '#a5d6a7')).setOrigin(0.5),
    ];
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1800,
        onComplete: () => t.destroy() });
    });

    // 길이 다시 열립니다.
    for (let i = this.floorIndex; i <= this.floorIndex + 7; i++) this.addFloor(i);
    this.armItems();
    this.markReach();
    // 방금 싸움이 끝났으니 박쥐 시계도 다시 갑니다.
    this.lastShopAt = this.time.now;
    this.cameras.main.shake(300, 0.01);
  }

  land(slot) {
    if (!slot.taken && !slot.expired) {
      slot.taken = true;
      switch (slot.kind) {
        case SLOT.PLUS:
          this.weapon.addPlus();
          this.forgeFx(slot.x, slot.y - 38);
          this.popup('공격력 +1', '#ffd54f');
          break;
        case SLOT.RELIC:
          // 자동으로 붙지 않습니다. 판이 멈추고 세 장 중 하나를 고릅니다.
          this.openRelicChoice();
          break;
        case SLOT.ARMOR:
          this.armor = Math.min(this.armorMax, this.armor + CFG.armor.perItem);
          this.popup('방어 ' + Math.round(this.armor) + '%', '#b0bec5');
          break;
        case SLOT.DODGE:
          this.dodge = Math.min(this.dodgeMax, this.dodge + CFG.dodge.perItem);
          this.popup('회피 ' + Math.round(this.dodge * 100) + '%', '#ce93d8');
          break;
        case SLOT.HASTE:
          this.weapon.addHaste();
          this.popupSpeed();
          break;
        case SLOT.DOUBLE:
          this.weapon.addDouble();
          this.popupSpeed();
          break;
        case SLOT.UPGRADE:
          if (this.weapon.upgrade()) { this.noteWeapon(); this.popup(this.weapon.name, '#ff8a65'); }
          else { this.hp = Math.min(this.maxHp, this.hp + CFG.heal); this.popup('+' + CFG.heal, '#a5d6a7'); }
          break;
        case SLOT.HEAL:
          this.hp = Math.min(this.maxHp, this.hp + CFG.heal);
          this.popup('+' + CFG.heal, '#a5d6a7');
          break;
        case SLOT.BOMB:
          this.springTrap(CFG.trap.bombDamage, '폭탄!');
          break;
        case SLOT.MIMIC:
          this.springMimic(slot);
          break;
        case SLOT.MEDAL:
          // 스무 판에 한 번 볼까 말까 한 물건입니다. 그냥 지나가면 아까우니
          // 화면 가운데에 크게 알려 줍니다.
          this.medals++;
          this.announceMedal();
          break;
        default:
          slot.taken = false; // 먹을 게 없던 발판은 그대로 둡니다
      }
      if (slot.taken && slot.view) { slot.view.destroy(); slot.view = null; }
    }

    // 앞쪽 층을 계속 채워두고, 지나온 층은 정리합니다.
    for (let i = this.floorIndex; i <= this.floorIndex + 7; i++) this.addFloor(i);
    for (let i = this.floorIndex - 6; i < this.floorIndex - 3; i++) this.removeFloor(i);
    this.armItems();

    this.markReach();

    if (slot.kind === SLOT.BOSS) return this.startBoss(slot);
    if (slot.kind === SLOT.SHOP) return this.enterShop();
    for (let i = 1; i <= 2; i++) this.wakeFloor(this.floorIndex + i);
  }

  // 다음 층에서 닿을 수 없는 길은 흐리게 해 둡니다.
  // 한 칸씩만 옮겨 갈 수 있다는 규칙이 눈에 보여야 합니다.
  markReach() {
    const restore = (index) => {
      const floor = this.floors.get(index);
      if (!floor) return;
      LANES.forEach((lane) => {
        const slot = floor.slots[lane];
        if (slot && slot.deck) slot.deck.forEach((v) => v.setAlpha(1));
      });
    };
    restore(this.dimmedFloor);

    const index = this.floorIndex + 1;
    const floor = this.floors.get(index);
    if (!floor) return;

    const here = LANES.indexOf(this.lane);
    LANES.forEach((lane, i) => {
      const slot = floor.slots[lane];
      if (!slot || !slot.deck) return;
      const alpha = Math.abs(i - here) <= 1 ? 1 : 0.25;
      slot.deck.forEach((v) => v.setAlpha(alpha));
    });
    this.dimmedFloor = index;

    // 눌렀을 때 실제로 그 방향 발판에 닿는지를 화살표에 반영합니다.
    this.hud.setArrows([-1, 0, 1].map((step) => {
      const want = Phaser.Math.Clamp(here + step, 0, LANES.length - 1);
      return !!floor.slots[LANES[want]];
    }));
  }

  // ── 아이템 수명 ───────────────────────────────────────
  // 주인공이 가까이 오면 그때부터 시간이 흐릅니다. 멀리 있는 층의 아이템까지
  // 미리 녹아 없어지면 곤란하니, 사정권에 든 것만 시계를 켭니다.
  armItems() {
    const now = this.time.now;
    for (let i = 1; i <= Math.max(CFG.item.armWithin, CFG.trap.armWithin); i++) {
      const floor = this.floors.get(this.floorIndex + i);
      if (!floor) continue;
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || slot.armed || !ITEM_KINDS.has(slot.kind)) continue;
        // 함정은 코앞에 와서야 시계가 켜집니다. 멀리서 켜면 도착하기 전에
        // 전부 삭아 없어져서 함정이 아예 없는 것과 같아집니다.
        if (i > slotTiming(slot.kind).armWithin) continue;
        slot.armed = true;
        slot.armedAt = now;
      }
    }
  }

  // 가짜의 정체를 드러냅니다. 홀로그램처럼 깜빡이고 빛깔이 식습니다.
  //
  // 한 번만 걸어 두고 slot.revealed 로 표시합니다 — 매 프레임 새 트윈을 걸면
  // 트윈이 쌓여서 깜빡임이 아니라 그냥 반투명한 덩어리가 됩니다.
  revealMimic(slot) {
    if (slot.revealed || !slot.view || !slot.badgeParts) return;
    slot.revealed = true;

    const t = CFG.trap;
    const { circle, label, image } = slot.badgeParts;

    if (image) {
      // **같은 물건의 망가진 모습**으로 갈아 끼웁니다. 모루에 금이 가고,
      // 깃털이 꺾이고, 방패에 구멍이 납니다. 실루엣이 그대로라 "다른 것으로
      // 바뀌었다"가 아니라 "이건 처음부터 망가진 것이었다"로 읽힙니다.
      const broken = fakeArtKey(slot.disguise, this.job.key);
      if (broken && this.textures.exists(broken)) image.setTexture(broken);
    } else if (circle && label) {
      // 그림이 없을 때의 옛 방식 — 빛깔이 식어 가짜티가 납니다.
      circle.setFillStyle(0x4dd0e1, 0.55);
      label.setColor('#e0f7fa');
    }

    // 어긋난 주사선 — 홀로그램이 깨질 때처럼 가로로 흔들립니다.
    this.tweens.add({
      targets: slot.view, alpha: t.flickerAlpha,
      duration: t.flickerMs, yoyo: true, repeat: -1, ease: 'Steps',
    });
    this.tweens.add({
      targets: slot.view, scaleX: 1.18,
      duration: t.flickerMs * 1.7, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  updateItems(now) {
    // 무기 단계가 바뀌었으면 위층 UP의 그림을 고쳐 답니다.
    this.syncUpgradeMarks();

    // 가까이 온 가짜부터 정체를 드러냅니다.
    for (let i = 0; i <= CFG.trap.revealWithin; i++) {
      const floor = this.floors.get(this.floorIndex + i);
      if (!floor) continue;
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (slot && slot.kind === SLOT.MIMIC && !slot.taken && !slot.expired) this.revealMimic(slot);
      }
    }

    this.floors.forEach((floor) => {
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || !slot.view || !slot.armed || slot.taken || slot.expired) continue;
        if (!ITEM_KINDS.has(slot.kind)) continue;

        // 함정은 제 시계가 따로 갑니다 — 훨씬 짧습니다.
        const timing = slotTiming(slot.kind);
        const age = now - slot.armedAt;
        if (age >= timing.life) {
          slot.expired = true;
          this.tweens.killTweensOf(slot.view);
          slot.view.destroy();
          slot.view = null;
          continue;
        }
        if (age < timing.blinkAt) continue;

        // 정체가 드러난 가짜는 홀로그램 깜빡임 트윈을 이미 달고 있습니다.
        // 그 위에 수명 깜빡임을 겹치면 둘이 서로 덮어써서 아무것도 안 보입니다.
        // 사라질 때가 됐으니 트윈을 걷고 수명 깜빡임에 자리를 넘깁니다 —
        // 빛깔은 이미 식어 있어서 걷어 내도 가짜인 것은 그대로 보입니다.
        //
        // 이걸 안 하면 함정만 "언제 사라질지 알 수 없는 것"이 됩니다.
        // 기다렸다 지나가라고 만든 장치인데 언제까지 기다릴지를 안 알려주는 셈입니다.
        if (slot.revealed && !slot.blinking) {
          slot.blinking = true;
          this.tweens.killTweensOf(slot.view);
          slot.view.setScale(1);
        }

        // 사라질 때가 가까울수록 빠르게 깜빡입니다.
        const period = timing.life - age < timing.life * 0.35 ? 80 : 170;
        // 0.2까지 낮추면 글자가 안 보여 정체불명의 덩어리처럼 보입니다.
        slot.view.setAlpha(Math.floor(age / period) % 2 ? 0.35 : 1);
      }
    });
  }

  // ── 상점 ──────────────────────────────────────────────
  enterShop() {
    // 상점에 닿았으니 박쥐 시계를 되돌립니다. 이게 서두를 이유입니다.
    this.lastShopAt = this.time.now;
    this.clearBats();

    // 쫓아오던 적은 물러갑니다. 상점은 한숨 돌리는 자리입니다.
    this.enemies.getChildren().slice().forEach((e) => {
      this.tweens.add({ targets: e, alpha: 0, duration: 260, onComplete: () => e.destroy() });
    });
    this.enemyBullets.clear(true, true);
    this.subTarget = null;

    // 상점에 닿는 것 자체가 메달 수입입니다. 즉 "얼마나 높이 올라갔나"가 곧
    // 다음 판의 밑천이 됩니다. 큰 상점은 두 개.
    const gain = isBigShopFloor(this.floorIndex) ? CFG.medal.perBigShop : CFG.medal.perShop;
    this.medals += gain;
    this.popup('🏅 +' + gain, '#ffca28');

    // 큰 상점은 도착만 해도 체력을 돌려줍니다. 화면에서 바로 알 수 있게 띄웁니다.
    this.bigShopHeal = 0;
    if (isBigShopFloor(this.floorIndex) && this.hp < this.maxHp) {
      this.bigShopHeal = Math.min(
        Math.round(this.maxHp * CFG.bigShopHeal), this.maxHp - Math.round(this.hp));
      this.hp += this.bigShopHeal;
      this.popup('+' + this.bigShopHeal, '#a5d6a7');
    }

    this.shop.show(this.floorIndex);
  }

  onShopClosed() {
    // 상점을 나서도 바로 몰려오지는 않습니다. 위층 적은 실제로 올라설 때 깨어납니다.
    this.ambientAt = this.time.now + CFG.ambient.baseDelay;

    // "계속 오르기"를 누른 그 탭이 상점이 닫힌 뒤 게임 입력으로 한 번 더 먹혀서
    // 곧바로 가운데로 뛰어 버립니다. 잠깐 입력을 막아 그 한 번을 흘립니다.
    this.tapBlockedUntil = this.time.now + 300;

    // 상점에 머문 시간만큼 위층 아이템이 삭아 있으면 억울합니다. 시계를 다시 겁니다.
    for (let i = 1; i <= Math.max(CFG.item.armWithin, CFG.trap.armWithin); i++) {
      const floor = this.floors.get(this.floorIndex + i);
      if (!floor) continue;
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (slot && !slot.expired && slot.view) { slot.armed = false; slot.view.setAlpha(1); }
      }
    }
    this.armItems();

    // 여기가 「이어서 진행하기」로 돌아올 자리입니다. 산 것까지 반영된 뒤에
    // 찍어야, 되돌아왔을 때 상점에서 쓴 코인이 헛돈이 되지 않습니다.
    this.snapshotAtShop();
  }

  // ── 자동 공격 ─────────────────────────────────────────
  // 전사·도적은 근접 (사거리 안을 한 번에), 궁수는 원거리 (적 하나씩).
  attack(now) {
    if (this.job.attack === 'ranged') this.shoot(now);
    else this.swing(now);
  }

  // 무기에 맞는 몸짓을 걸고, **이펙트를 얼마나 늦출지**를 돌려줍니다.
  // 창은 찌르고 검은 베고 석궁은 뒤로 밀립니다 (js/motion.js 의 MOTIONS).
  playAttackMotion(target) {
    const motion = motionFor(this.job, this.weapon);
    const ms = motionMs(this.weapon.rate);
    this.rig.face(target.x);
    this.rig.play(motion, ms);
    return motionLead(motion, ms);
  }

  // 몸이 지나간 뒤에 그림을 띄웁니다. 0ms 면 곧장 부릅니다 —
  // 늦출 것이 없는데 굳이 한 프레임을 흘려보낼 이유가 없습니다.
  //
  // 판이 멈추거나(상점·유물) 주인공이 죽은 뒤에 뒤늦게 터지면 안 되므로
  // 그때는 그냥 버립니다.
  after(ms, fn) {
    if (ms <= 0) return fn();
    this.time.delayedCall(ms, () => { if (!this.dead && this.scene.isActive()) fn(); });
  }

  distTo(e) {
    return Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
  }

  // ── 근접 ──────────────────────────────────────────────
  swing(now) {
    const w = this.weapon;
    if (now - this.lastSwingAt < w.rate) return;

    const hit = this.enemies.getChildren().filter((e) => this.targetable(e) && this.meleeDist(e) <= w.reach);
    if (!hit.length) return; // 허공에 휘두르지는 않습니다

    this.lastSwingAt = now;
    this.swings = (this.swings || 0) + 1;

    const nearest = hit.reduce((a, b) => (this.meleeDist(a) < this.meleeDist(b) ? a : b));
    const angle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y - 6, nearest.x, nearest.y);

    // 몸을 그쪽으로 돌리고 무기에 맞는 몸짓을 겁니다. 칼자국은 **몸이 지나간
    // 뒤에** 떠야 합니다 — 곧장 띄우면 서 있는 사람 옆에서 자국이 저절로 납니다.
    const lead = this.playAttackMotion(nearest);
    this.after(lead, () => this.showSlash(angle, w));

    // 파동검 — 벤 자리에서 **휘두른 방향으로** 나갑니다. 표적을 고르지 않습니다.
    //
    // 예전에는 사거리 밖의 적 하나를 골라 그쪽으로 쐈습니다. 그러니 근접 무기가
    // 아니라 궁수의 화살처럼 보였고, 사거리 안에 아무도 없어도 허공을 향해
    // 칼을 휘두르게 됐습니다. 칼을 휘둘러서 나가는 것이니 나가는 곳도 칼이 간
    // 쪽이어야 합니다 — 맞는 것은 그 선 위에 있던 놈들입니다.
    const wave = w.relicSum('wave');
    if (wave > 0 && this.swings % CFG.waveEvery === 0) {
      this.after(lead, () => this.fireWave(angle, Math.round(w.dmg * wave)));
    }

    hit.forEach((e) => {
      // 도적은 때리면서 주머니를 텁니다. 잡지 않아도 코인이 나옵니다.
      // 코인은 이제 확률로 나오므로 훔치는 것도 같은 확률을 탑니다.
      //
      // 보스는 털 수 없습니다. 몸이 커서 늘 사거리 안에 있는 데다 오래 때리는
      // 상대라, 훔치기가 되면 보스 층이 통째로 도적의 금광이 됩니다.
      if (!e.isBoss && w.stealChance > 0 && Math.random() < w.stealChance &&
          Math.random() < CFG.coin.dropChance) {
        this.stealFx(e.x, e.y - 10);
        this.dropCoin(e.x, e.y - 10, Math.round(w.stealAmount * CFG.coin.dropBonus));
      }
      this.hitEnemy(e, w.dmg);
    });
  }

  // 공격력을 주우면 **망치가 한 번 내리쳐집니다.**
  //
  // 다른 아이템은 주우면 숫자가 오르고 끝인데, 공격력만은 "벼렸다"는 동작이
  // 붙습니다. 무기를 손보는 것이 이 게임에서 가장 자주 하는 일이라, 그 순간에만
  // 짧은 동작을 얹으면 같은 팝업이라도 무게가 달라집니다.
  //
  // 그림이 없으면 아무것도 안 합니다 — 도형으로 흉내 내면 그게 더 어설픕니다.
  forgeFx(x, y) {
    if (!this.textures.exists('item-plus-anvil') || !this.textures.exists('item-plus-hammer')) return;

    const anvil = this.add.image(x, y + 4, 'item-plus-anvil').setDepth(12);
    const hammer = this.add.image(x + 13, y - 13, 'item-plus-hammer')
      .setDepth(13).setAngle(-52).setOrigin(0.28, 0.82);

    this.tweens.add({
      targets: hammer, angle: 8, duration: 130, ease: 'Quad.in',
      onComplete: () => {
        // 맞는 순간에만 불티가 튑니다. 내리치는 동안 튀면 무엇에 맞았는지가 흐려집니다.
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI * (0.15 + Math.random() * 0.7);
          const bit = this.add.sprite(x - 2, y - 4, 'spark')
            .setDepth(14).setScale(0.45).setTint(0xffd54f);
          this.tweens.add({
            targets: bit,
            x: bit.x + Math.cos(a) * (22 + Math.random() * 16),
            y: bit.y + Math.sin(a) * (20 + Math.random() * 14),
            alpha: 0, scale: 0.1, duration: 260 + Math.random() * 120,
            ease: 'Quad.out', onComplete: () => bit.destroy(),
          });
        }
        this.tweens.add({
          targets: [anvil, hammer], alpha: 0, y: '-=10',
          duration: 260, delay: 90, onComplete: () => { anvil.destroy(); hammer.destroy(); },
        });
      },
    });
  }

  // 훔친 순간. 코인만 튀어나오면 잡아서 나온 것인지 훔쳐서 나온 것인지
  // 구분이 안 됩니다. 고리가 **오므라들고** 조각이 주인공 쪽으로 빨려 와야
  // "저놈에게서 빼내 왔다"로 읽힙니다 — 죽을 때의 퍼지는 고리와 반대입니다.
  stealFx(x, y) {
    const ring = this.add.circle(x, y, 22, 0x000000, 0)
      .setStrokeStyle(2.5, 0xce93d8, 0.9).setDepth(12);
    this.tweens.add({
      targets: ring, scale: 0.2, alpha: 0, duration: 220,
      ease: 'Quad.in', onComplete: () => ring.destroy(),
    });

    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const bit = this.add.sprite(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 'spark')
        .setDepth(12).setScale(0.5).setTint(0xffd54f);
      this.tweens.add({
        targets: bit,
        x: this.player.x, y: this.player.y - 6,
        alpha: 0, scale: 0.15,
        duration: 220 + i * 40, ease: 'Quad.in',
        onComplete: () => bit.destroy(),
      });
    }
  }

  // 사거리 안에 드는지는 몸 표면까지의 거리로 봅니다.
  // 보스처럼 큰 것은 중심까지 재면 어떤 무기로도 닿지 않습니다.
  //
  // 보스는 넓적한 사각형이라 원으로 재면 안 됩니다. 원으로 잡으면 양옆 줄에서
  // 닿지 않아, 가운데에서만 때릴 수 있는 싸움이 됩니다 — 근접에게만 불리합니다.
  // 그래서 hitW·hitH 가 있으면 사각형 표면까지의 거리로 잽니다.
  meleeDist(e) {
    if (e.hitW) {
      const dx = Math.max(0, Math.abs(e.x - this.player.x) - e.hitW);
      const dy = Math.max(0, Math.abs(e.y - this.player.y) - e.hitH);
      return Math.sqrt(dx * dx + dy * dy);
    }
    return Math.max(0, this.distTo(e) - (e.hitRadius || 0));
  }

  // 유령은 사라져 있는 동안 때릴 수 없습니다. 노리는 곳마다 이걸 거쳐야
  // 화살이 허공을 쫓거나 근접이 헛도는 일이 없습니다.
  targetable(e) {
    return e.active && !e.phased;
  }

  nearestWithin(range) {
    const pool = this.enemies.getChildren().filter((e) => this.targetable(e) && this.meleeDist(e) <= range);
    if (!pool.length) return null;
    return pool.reduce((a, b) => (this.meleeDist(a) < this.meleeDist(b) ? a : b));
  }

  // 파동 — 벤 자리에서 **휘두른 방향으로** 날아가 여럿을 꿰뚫습니다.
  // 표적이 아니라 각도를 받습니다. 무엇을 맞힐지는 나간 뒤에 정해집니다.
  fireWave(angle, dmg) {
    const b = this.bullets.create(this.player.x, this.player.y - 6, 'wave');
    b.body.setAllowGravity(false);
    b.isArrow = false;
    b.setTint(this.weapon.color).setDepth(9);
    b.dmg = dmg;
    b.bounce = 0;
    b.pierce = 2;      // 이만큼 더 꿰뚫고 갑니다
    b.hitSet = new Set();
    b.from = null;     // 파동은 표적을 쫓지 않습니다. 직선으로 나갑니다
    b.bornAt = this.time.now;
    b.setRotation(angle);
    this.physics.velocityFromRotation(angle, CFG.waveSpeed, b.body.velocity);
  }

  // 칼을 휘두르는 그림. 커지는 것이 아니라 **쓸고 지나가야** 합니다 —
  // 제자리에서 부풀리면 칼자국이 아니라 파동을 쏜 것처럼 보입니다.
  // 크기는 처음부터 사거리에 맞춰 두고, 각도만 위에서 아래로 훑습니다.
  showSlash(angle, w) {
    const sweep = Phaser.Math.DegToRad(62);
    const arc = this.add.sprite(this.player.x, this.player.y - 6, 'slash')
      .setDepth(11).setTint(w.color)
      .setRotation(angle - sweep / 2)
      .setScale(w.reach / 62); // 텍스처의 바깥 반지름이 62입니다

    // 휘두르는 방향은 번갈아 바뀝니다. 늘 같은 쪽으로만 그으면 기계처럼 보입니다.
    this.swingDown = !this.swingDown;
    const dir = this.swingDown ? 1 : -1;
    arc.setRotation(angle - dir * sweep / 2);
    arc.setFlipY(dir < 0);

    this.tweens.add({
      targets: arc,
      rotation: angle + dir * sweep / 2,
      alpha: 0,
      duration: Math.min(200, Math.max(90, w.rate * 0.55)),
      ease: 'Quad.out',
      onComplete: () => arc.destroy(),
    });
  }

  // ── 원거리 ────────────────────────────────────────────
  shoot(now) {
    const w = this.weapon;
    if (now - this.lastSubAt < w.rate) return;

    // 위쪽만 노립니다. 탑은 올라가는 곳이라 아래를 쏘는 것은 이미 지나온 층에
    // 시간을 쓰는 일입니다 — 게다가 아래층 적은 쫓아오지도 못하니, 쏘는 동안
    // 위층의 적에게는 한 발도 안 나갑니다.
    //
    // 같은 발판에 선 적은 발이 땅에 붙어 있어 중심이 주인공보다 조금 아래입니다.
    // 그 몫(CFG.aimBelow)까지는 "위"로 칩니다. 아니면 제 발밑의 적을 못 쏩니다.
    const inRange = (e) => this.targetable(e) &&
      e.y <= this.player.y + CFG.aimBelow &&
      this.meleeDist(e) <= w.range;
    const pool = this.enemies.getChildren().filter(inRange)
      .sort((a, b) => this.meleeDist(a) - this.meleeDist(b));
    if (!pool.length) { this.subTarget = null; return; }

    // 한 번 노린 적은 죽거나 사거리를 벗어날 때까지 계속 노립니다.
    // 매 발 가장 가까운 적으로 갈아타면 피해가 흩어져 아무도 죽지 않습니다.
    // 궁수는 멈추지 않고 지나가므로 이걸 안 하면 처치가 0이 됩니다.
    if (!this.subTarget || !inRange(this.subTarget)) this.subTarget = pool[0];

    this.lastSubAt = now;

    // 활은 당기고 놓습니다. 화살은 **놓는 순간에** 나가야 하므로 그만큼 늦춥니다.
    // 석궁은 당기는 마디가 없어 늦출 것도 없습니다 — 곧장 나가고 몸이 뒤로 밀립니다.
    const lead = this.playAttackMotion(this.subTarget);

    const others = pool.filter((e) => e !== this.subTarget);
    for (let i = 0; i < w.shots; i++) {
      const target = i === 0 ? this.subTarget : (others[i - 1] || this.subTarget);
      // 시위를 당기는 사이에 그놈이 죽을 수 있습니다. 죽은 것을 겨누면 터지고,
      // 그렇다고 화살을 그냥 버리면 **모르는 사이에 궁수가 약해집니다** —
      // 여럿을 상대할수록 자주 죽으니 화살도 자주 사라집니다.
      // 그래서 겨눌 것을 다시 고릅니다. 활은 이미 당겨 놓았으니까요.
      this.after(lead, () => {
        const at = target.active ? target : this.pickAim(inRange);
        if (at) this.fireArrow(this.player.x, this.player.y - 6, at, w.dmg, w.bounce);
      });
    }
  }

  // 사거리 안에서 가장 가까운 놈. 아무도 없으면 아무것도 안 돌려줍니다.
  pickAim(inRange) {
    let best = null;
    let bestGap = Infinity;
    this.enemies.getChildren().forEach((e) => {
      if (!inRange(e)) return;
      const gap = this.meleeDist(e);
      if (gap < bestGap) { bestGap = gap; best = e; }
    });
    return best;
  }

  fireArrow(x, y, target, dmg, bounce) {
    const b = this.bullets.create(x, y, 'arrow');
    b.body.setAllowGravity(false);
    b.body.setSize(14, 10);
    b.setTint(this.weapon.color).setDepth(9);
    b.isArrow = true;
    b.dmg = dmg;
    b.bounce = bounce;
    b.from = target;
    b.homing = this.weapon.homing;
    b.bornAt = this.time.now;
    this.physics.velocityFromRotation(
      Phaser.Math.Angle.Between(x, y, target.x, target.y), CFG.arrowSpeed, b.body.velocity);
  }

  // 화살이 지나간 자리에 흐릿한 선을 남깁니다. 궤적이 보여야 어디서 어디로
  // 날아갔는지 읽히고, 원거리 전투가 "공이 날아다니는 것"으로 보이지 않습니다.
  trailArrow(b, time) {
    if (time - (b.lastTrailAt || 0) < 26) return;
    b.lastTrailAt = time;
    const t = this.add.sprite(b.x, b.y, 'arrow-trail')
      .setDepth(8).setTint(b.tintTopLeft).setRotation(b.rotation).setAlpha(0.5);
    this.tweens.add({
      targets: t, alpha: 0, scaleX: 0.3, duration: 180,
      onComplete: () => t.destroy(),
    });
  }

  onBulletHit(bullet, enemy) {
    if (!bullet.active || !this.targetable(enemy)) return;

    // 파동은 여럿을 꿰뚫습니다. 같은 적을 두 번 세지 않도록 맞은 것을 기억합니다.
    if (bullet.hitSet) {
      if (bullet.hitSet.has(enemy)) return;
      bullet.hitSet.add(enemy);
      this.hitEnemy(enemy, bullet.dmg);
      if (bullet.pierce > 0) { bullet.pierce--; return; }
      bullet.destroy();
      return;
    }

    const { dmg, bounce } = bullet;
    const at = { x: bullet.x, y: bullet.y };
    bullet.destroy();
    this.hitEnemy(enemy, dmg);

    // 메아리 활 — 맞은 자리에서 다른 적에게 한 번 더 튕깁니다.
    if (bounce > 0) {
      const next = this.enemies.getChildren()
        .filter((e) => e.active && e !== enemy &&
          Phaser.Math.Distance.Between(e.x, e.y, at.x, at.y) <= CFG.bounceRange)
        .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, at.x, at.y) -
                        Phaser.Math.Distance.Between(b.x, b.y, at.x, at.y))[0];
      if (next) this.fireArrow(at.x, at.y, next, Math.round(dmg * 0.8), bounce - 1);
    }
  }

  hitEnemy(enemy, dmg) {
    if (!enemy.active) return;
    const before = enemy.hp;
    enemy.hp -= dmg;

    // 흡혈 망토 — 실제로 깎은 만큼만 돌려받습니다. 남은 체력보다 큰 한 방을
    // 그대로 세면 마지막 일격에서 체력이 통째로 차오릅니다.
    const leech = this.weapon.relicSum('lifesteal');
    if (leech > 0 && this.hp < this.maxHp) {
      const real = Math.min(before, dmg);
      const gain = Math.max(1, Math.round(real * leech));
      this.hp = Math.min(this.maxHp, this.hp + gain);
    }

    const spark = this.add.sprite(enemy.x, enemy.y, 'spark').setDepth(11);
    this.tweens.add({ targets: spark, scale: 2.4, alpha: 0, duration: 160, onComplete: () => spark.destroy() });

    if (enemy.hp > 0) {
      // 맞은 표. 흰색을 그냥 물들이면 곱셈이라 아무 변화가 없습니다 —
      // 통째로 채워야 한 프레임 하얗게 번쩍입니다.
      enemy.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(60, () => enemy.active &&
        enemy.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
      return;
    }

    // 도적은 잡을 때마다 기운을 앗아옵니다. 갑옷이 없는 대신 버티는 수단입니다.
    if (this.job.leechOnKill && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.job.leechOnKill);
    }

    // 보스는 죽는 방식이 다릅니다.
    if (enemy.isBoss) {
      enemy.destroy();
      this.kills++;
      this.bossDefeated(enemy);
      return;
    }

    // 모든 적이 코인을 흘리지는 않습니다. 대신 나올 때는 그만큼 더 줍니다.
    if (enemy.coin > 0 && Math.random() < CFG.coin.dropChance) {
      this.dropCoin(enemy.x, enemy.y, Math.round(enemy.coin * CFG.coin.dropBonus));
    }

    // 죽는 방식이 따로 있는 것들. 자리를 먼저 챙겨 두고 없앱니다.
    const at = { x: enemy.x, y: enemy.y, floor: enemy.floor, def: enemy.def };
    this.deathBurst(enemy);
    enemy.destroy();
    this.kills++;
    if (at.def.onDeath === 'explode') this.explodeAt(at);
    else if (at.def.onDeath === 'split') this.splitAt(at);
  }

  // ── 죽는 그림 ─────────────────────────────────────────
  // 마지막 한 대가 그 앞의 대들과 달라야 합니다. 그러려면 사라지는 것이 아니라
  // 터져 나가야 합니다. 세 겹으로 만듭니다.
  //
  //   1. 흰 섬광  — 맞은 그 순간. 아주 짧게, 몸 모양 그대로
  //   2. 부푸는 몸 — 제 빛깔 그대로 부풀며 흩어짐. 무엇을 잡았는지가 남습니다
  //   3. 조각과 고리 — 튀어 나가는 파편, 퍼지는 테두리
  //
  // 몸 그림을 그대로 두 번 쓰는 것이 요령입니다. 적마다 조각 그림을 따로 만들면
  // 열두 종류 × 조각 수만큼 그려야 하는데, 제 몸을 부풀리면 색도 실루엣도 공짜로
  // 맞습니다 — 무엇이 터졌는지 알아볼 수 있는 것이 화려한 것보다 중요합니다.
  deathBurst(enemy) {
    const d = CFG.death;
    const x = enemy.x, y = enemy.y;
    const key = enemy.texture.key;
    const scale = enemy.scaleX || 1;

    // 1. 섬광 — 색을 곱하지 말고 통째로 채워야 흰 실루엣이 됩니다.
    // (흰색을 곱하면 아무 일도 일어나지 않습니다. 눈에 보이는 것이 없습니다.)
    const flash = this.add.sprite(x, y, key).setDepth(12).setScale(scale)
      .setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.tweens.add({
      targets: flash, scale: scale * 1.25, alpha: 0,
      duration: d.ms * 0.4, ease: 'Quad.out', onComplete: () => flash.destroy(),
    });

    // 2. 부푸는 몸
    const body = this.add.sprite(x, y, key).setDepth(11).setScale(scale);
    this.tweens.add({
      targets: body, scale: scale * d.burstScale, alpha: 0, angle: Phaser.Math.Between(-40, 40),
      duration: d.ms, ease: 'Quad.out', onComplete: () => body.destroy(),
    });

    // 3. 고리와 조각
    const ring = this.add.circle(x, y, 8, 0xffffff, 0)
      .setStrokeStyle(3, 0xfff3c4, 0.9).setDepth(11);
    this.tweens.add({
      targets: ring, scale: d.ringRadius / 8, alpha: 0,
      duration: d.ms * 0.75, ease: 'Cubic.out', onComplete: () => ring.destroy(),
    });

    const spin = Math.random() * Math.PI * 2;
    for (let i = 0; i < d.shards; i++) {
      const a = spin + (Math.PI * 2 * i) / d.shards;
      const dist = d.shardDist * Phaser.Math.FloatBetween(0.6, 1.15);
      const shard = this.add.sprite(x, y, 'spark').setDepth(12)
        .setScale(Phaser.Math.FloatBetween(0.5, 0.95) * scale).setTint(0xffe082);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        scale: 0, alpha: 0,
        duration: d.ms * Phaser.Math.FloatBetween(0.7, 1),
        ease: 'Quad.out', onComplete: () => shard.destroy(),
      });
    }

    // 큰 놈은 넘어질 때 바닥이 울립니다. 작은 놈까지 흔들면 화면이 쉬지 못합니다.
    if (scale >= d.bigScale) this.cameras.main.shake(d.shakeMs, d.shakeAmt);
  }

  // 폭탄충 — 죽으면서 터집니다. 가까이 붙어 있으면 같이 맞습니다.
  // 근접에게만 불리하지 않도록 반경을 좁게 두고, 예고 삼아 터지는 그림을 크게 냅니다.
  explodeAt(at) {
    const e = CFG.explode;
    const ring = this.add.circle(at.x, at.y, 12, 0xff7043, 0.5).setDepth(11);
    this.tweens.add({
      targets: ring, radius: e.radius, alpha: 0, duration: 260,
      onUpdate: () => ring.setRadius(ring.radius),
      onComplete: () => ring.destroy(),
    });

    if (Phaser.Math.Distance.Between(at.x, at.y, this.player.x, this.player.y) > e.radius) return;
    if (this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    this.hurt(Math.round(e.damage * (1 + at.floor * CFG.enemy.dmgPerFloor)));
  }

  // 쪼개지는 것 — 죽으면 작은 둘이 됩니다. 그 둘은 다시 쪼개지지 않습니다.
  splitAt(at) {
    const c = CFG.split;
    for (let i = 0; i < c.count; i++) {
      const child = spawnEnemy(this, at.x + (i ? 26 : -26), at.y - 8, at.floor, 'crawler');
      if (!child) return;
      child.maxHp = Math.round(child.maxHp * c.hpScale);
      child.hp = child.maxHp;
      child.setScale((child.def.scale || 1) * c.scale);
    }
  }

  // 메달로 사 둔 것과 계승해 온 무기가 실제로 붙었다는 것을 판 첫머리에 보여 줍니다.
  // 산 것이 조용히 적용되면 메달을 쓴 보람이 안 보입니다.
  announceBoosts() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    // 이어서 진행해 온 판이면 어디서부터 다시 시작하는지 먼저 알려 줍니다.
    // 갑자기 120층에서 시작하면 무슨 일이 일어난 것인지 알 수가 없습니다.
    if (this.resume) {
      const left = CFG.continues.max - this.continues;
      const parts = [
        this.add.text(CFG.width / 2, 300, this.floorIndex + '층 상점에서 이어서',
          font(26, '#4dd0e1')).setOrigin(0.5),
        this.add.text(CFG.width / 2, 340,
          left > 0 ? '남은 이어하기 ' + left + '번' : '마지막 이어하기입니다',
          font(20, '#8794b5')).setOrigin(0.5),
      ];
      parts.forEach((t) => {
        t.setScrollFactor(0).setDepth(150).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1700,
          onComplete: () => t.destroy() });
      });
      return;
    }

    if (!this.boosts.length) return;
    const parts = [
      this.add.text(CFG.width / 2, 300, '메달 상점에서', font(20, '#8794b5')).setOrigin(0.5),
      this.add.text(CFG.width / 2, 340, this.boosts.join('   '), font(26, '#ffca28')).setOrigin(0.5),
    ];
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1700,
        onComplete: () => t.destroy() });
    });
  }

  // ── 함정 ──────────────────────────────────────────────
  // 밟는 순간 터집니다. 무적 시간과 상관없이 언제나 아픕니다 —
  // 방금 맞았다는 이유로 함정이 공짜가 되면 밟는 것이 전략이 됩니다.
  springTrap(base, label) {
    const dmg = Math.round(base * (1 + this.floorIndex * CFG.enemy.dmgPerFloor));
    this.popup(label, '#ff5252');
    this.lastHitAt = -9999;
    this.hurt(dmg);

    const flash = this.add.circle(this.player.x, this.player.y, 14, 0xff7043, 0.6).setDepth(11);
    this.tweens.add({
      targets: flash, radius: 90, alpha: 0, duration: 300,
      onUpdate: () => flash.setRadius(flash.radius),
      onComplete: () => flash.destroy(),
    });
  }

  // 좋은 것인 척했던 것. 흉내 낸 것과 정반대로 갚아 줍니다 —
  // 무엇인 척했는지가 무엇을 잃는지로 이어져야 배운 것이 남습니다.
  springMimic(slot) {
    const t = CFG.trap;
    switch (slot.disguise) {
      case SLOT.PLUS:
        this.weapon.losePlus(t.mimicPlus);
        this.popup('가짜! 공격력 -' + t.mimicPlus, '#ff5252');
        break;
      case SLOT.HASTE:
        this.weapon.loseHaste(t.mimicHaste);
        this.popup('가짜! 속도 ×' + this.weapon.speedMult.toFixed(2), '#ff5252');
        break;
      case SLOT.ARMOR:
        this.armor = Math.max(0, this.armor - t.mimicArmor);
        this.popup('가짜! 방어 ' + Math.round(this.armor) + '%', '#ff5252');
        break;
      case SLOT.DODGE:
        this.dodge = Math.max(0, this.dodge - CFG.dodge.perItem * 2);
        this.popup('가짜! 회피 ' + Math.round(this.dodge * 100) + '%', '#ff5252');
        break;
      default:
        this.springTrap(t.mimicHeal, '가짜!');
        return;
    }
    this.cameras.main.shake(120, 0.006);
  }

  // 무기를 손에 넣을 때마다 부릅니다. 죽음 화면의 계승은 여기 둘째를 씁니다.
  // 같은 단계를 두 번 세지 않도록, 단계가 실제로 바뀌었을 때만 적습니다.
  noteWeapon() {
    const w = this.weapon;
    const last = this.gotWeapons[this.gotWeapons.length - 1];
    if (last && last.tier === w.tier) return;
    this.gotWeapons.push({ tier: w.tier, plus: w.plus });
  }

  // 지도에 떨어진 메달. 상점에서 받는 것과 값은 같지만 만나는 일이 거의 없어서,
  // 만났을 때만은 유물처럼 크게 알려 줍니다.
  announceMedal() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const parts = [
      this.add.text(CFG.width / 2, 300, '메달을 주웠습니다', font(20, '#8794b5')).setOrigin(0.5),
      this.add.text(CFG.width / 2, 340, '🏅 +1', font(44, '#ffca28')).setOrigin(0.5),
      this.add.text(CFG.width / 2, 386, '죽어도 남습니다', font(20, '#ffe082')).setOrigin(0.5),
    ];
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1600,
        onComplete: () => t.destroy() });
    });
  }

  // ── 유물 고르기 ───────────────────────────────────────
  // 유물은 밟는다고 저절로 붙지 않습니다. 판이 멈추고 세 장이 펼쳐집니다.
  // 유물이 강한 만큼, 무엇을 가져갈지가 판을 가르는 결정이어야 합니다.
  openRelicChoice() {
    const picks = rollRelicChoices(this.job.key, this.weapon.relics);
    if (!picks.length) { // 다 모았다면 회복으로 갈음합니다
      this.hp = Math.min(this.maxHp, this.hp + CFG.heal);
      this.popup('+' + CFG.heal, '#a5d6a7');
      return;
    }

    this.choosing = true;
    this.physics.pause();

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const parts = [];
    const add = (o) => { parts.push(o.setScrollFactor(0).setDepth(300)); return o; };

    add(this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x000000, 0.9));
    add(this.add.text(cx, 150, '유물', font(24, '#8794b5')).setOrigin(0.5));
    add(this.add.text(cx, 196, '하나만 가져갑니다', font(34, '#ffd54f')).setOrigin(0.5));

    const rows = [];
    picks.forEach((relic, i) => {
      const y = 320 + i * 150;
      const owned = !!Save.data.relics[relic.key];

      const box = add(this.add.rectangle(cx, y, 460, 130, 0x231a3a)
        .setStrokeStyle(2, 0xffd54f).setInteractive({ useHandCursor: true }));
      add(this.add.text(cx - 200, y - 40, relic.icon + '  ' + relic.name, font(28, '#ffd54f')));
      add(this.add.text(cx - 200, y - 2, relic.desc, font(20, '#ffe082')));
      add(this.add.text(cx - 200, y + 30, relic.detail, font(17, '#8794b5')));
      // 처음 보는 유물이라고 알려 주면 도감을 채우는 재미가 생깁니다.
      if (!owned) add(this.add.text(cx + 200, y - 40, 'NEW', font(17, '#a5d6a7')).setOrigin(1, 0));

      box.on('pointerdown', () => {
        parts.forEach((o) => o.destroy());
        rows.length = 0;
        // 자리가 꽉 찼으면 무엇을 버릴지 한 번 더 고릅니다. 그때까지는 판이 멈춘 채입니다.
        if (this.weapon.relics.length >= CFG.relic.maxHeld) return this.openRelicSwap(relic);
        this.closeChoice();
        this.takeRelic(relic);
      });
      rows.push({ relic, x: cx, y });
    });

    // 자동 시험에서 카드 자리를 읽어 가기 위한 통로
    this.relicChoices = rows;
  }

  // 유물은 CFG.relic.maxHeld 개까지만 듭니다. 꽉 찬 채로 새것을 고르면
  // 들고 있던 것 중 하나를 내놓아야 합니다. 그냥 지나갈 수도 있어야 하고요 —
  // 지금 든 둘이 더 좋을 수도 있으니까요.
  openRelicSwap(incoming) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const parts = [];
    const add = (o) => { parts.push(o.setScrollFactor(0).setDepth(300)); return o; };

    add(this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x000000, 0.9));
    add(this.add.text(cx, 150, '유물은 ' + CFG.relic.maxHeld + '개까지', font(22, '#8794b5')).setOrigin(0.5));
    add(this.add.text(cx, 196, '무엇을 버릴까', font(34, '#ffd54f')).setOrigin(0.5));
    add(this.add.text(cx, 244, '새로 얻는 것 — ' + incoming.icon + ' ' + incoming.name,
      font(20, '#a5d6a7')).setOrigin(0.5));

    const rows = [];
    const held = this.weapon.relics.slice();
    held.forEach((relic, i) => {
      const y = 340 + i * 130;
      const box = add(this.add.rectangle(cx, y, 460, 110, 0x2a1a1a)
        .setStrokeStyle(2, 0xff8a80).setInteractive({ useHandCursor: true }));
      add(this.add.text(cx - 200, y - 28, relic.icon + '  ' + relic.name, font(26, '#ff8a80')));
      add(this.add.text(cx - 200, y + 8, relic.detail, font(17, '#8794b5')));
      add(this.add.text(cx + 200, y - 28, '버리기', font(18, '#ff8a80')).setOrigin(1, 0));

      box.on('pointerdown', () => {
        parts.forEach((o) => o.destroy());
        this.weapon.relics.splice(this.weapon.relics.indexOf(relic), 1);
        this.closeChoice();
        this.takeRelic(incoming);
      });
      rows.push({ relic, x: cx, y });
    });

    // 새것을 포기하는 길도 열어 둡니다.
    const keepY = 340 + held.length * 130;
    const keep = add(this.add.rectangle(cx, keepY, 460, 82, 0x1b2138)
      .setStrokeStyle(2, 0x3f4a78).setInteractive({ useHandCursor: true }));
    add(this.add.text(cx, keepY - 12, '그냥 두기', font(26, '#ffffff')).setOrigin(0.5));
    add(this.add.text(cx, keepY + 20, incoming.name + '을(를) 포기합니다',
      font(17, '#8794b5')).setOrigin(0.5));
    keep.on('pointerdown', () => {
      parts.forEach((o) => o.destroy());
      this.closeChoice();
      this.popup('그냥 두기', '#8794b5');
    });

    this.relicSwaps = rows.concat([{ relic: null, x: cx, y: keepY }]);
  }

  // 고르기가 끝나 판이 다시 흐릅니다.
  closeChoice() {
    this.choosing = false;
    this.physics.resume();
    // 카드를 누른 그 탭이 판이 다시 흐른 뒤 점프로 한 번 더 먹히는 것을 막습니다.
    this.tapBlockedUntil = this.time.now + 300;
  }

  takeRelic(relic) {
    this.weapon.takeRelic(relic);
    Save.collectRelic(relic.key);
    this.popup(relic.icon + ' ' + relic.name, '#ffd54f');
    this.hud.update();
  }

  onEnemyTouch(player, enemy) {
    if (this.dead) return;

    // 도둑 박쥐는 때리는 대신 채 갑니다.
    if (enemy.isBat && enemy.batKind === 'thief' && !enemy.fleeing) return this.batStealsCoins(enemy);

    if (this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    if (!enemy.contactDamage) return;
    this.hurt(enemy.contactDamage, enemy);
    // 무는 박쥐는 한 입 물고 달아납니다. 계속 붙어 다니면 그냥 적입니다.
    if (enemy.isBat) this.batFlees(enemy);
  }

  onEnemyShotHit(player, bullet) {
    // 반사 갑옷 — 날아오던 것을 그대로 되돌려 보냅니다.
    const reflect = this.weapon.relicSum('reflect');
    if (reflect > 0 && Math.random() < reflect) {
      const target = this.nearestWithin(CFG.waveRange);
      bullet.destroy();
      if (target) this.fireArrow(this.player.x, this.player.y - 6, target,
        Math.round((bullet.dmg || CFG.enemyShot.damage) * 2), 0);
      this.popup('튕겨냄', '#80deea');
      return;
    }

    const fromBoss = !!bullet.fromBoss;
    bullet.destroy();
    if (this.dead || this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    this.hurt(bullet.dmg || CFG.enemyShot.damage, null, fromBoss);
  }

  hurt(amount, source, fromBoss) {
    // 도적은 일정 확률로 통째로 흘려 넘깁니다.
    // 다만 보스가 내리꽂는 것에는 덜 통합니다 — 안 그러면 피하지 않아도
    // 절반 넘게 흘러가서, 줄을 고르는 그 싸움을 도적만 안 하게 됩니다.
    const dodge = fromBoss ? this.dodge * CFG.boss.dodgeScale : this.dodge;
    if (dodge > 0 && Math.random() < dodge) {
      this.lastHitAt = this.time.now;
      this.popup('회피', '#ce93d8');
      return;
    }

    this.lastHitAt = this.time.now;
    // 방어력만큼 덜 맞습니다. 아무리 두꺼워도 한 대는 아프도록 최소 1은 들어갑니다.
    const taken = Math.max(1, Math.round(amount * (1 - this.armor / 100)));
    const blocked = Math.max(0, amount - taken);
    this.hp -= taken;

    // 막아 낸 만큼 갑옷이 갈립니다. 방어력은 한 번 올려두면 끝인 값이 아니라
    // 계속 채워 넣어야 하는 소모품입니다. 층이 오르면 적의 공격력도 같이 오르니
    // 닳는 속도도 저절로 빨라집니다.
    const worn = this.wearArmor(blocked);

    this.cameras.main.shake(140, 0.008);
    this.popupHit(taken, blocked, worn);
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: 3 });

    // 가시 갑옷 — 닿은 놈에게 돌려줍니다.
    const thorns = this.weapon.relicSum('thorns');
    if (thorns > 0 && source && source.active) this.hitEnemy(source, Math.round(amount * thorns));

    if (this.hp <= 0) {
      // 수호 부적 — 지도에는 없고 상점에서만 사는 것. 한 번만 버팁니다.
      // 후반에 아이템을 포기하고 뛰기 시작하면, 이것이 코인을 쓸 이유가 됩니다.
      if (this.charm) return this.breakCharm();
      this.gameOver();
    }
  }

  // 부적이 깨지며 대신 맞아 줍니다. 잠깐 무적을 주지 않으면 다음 한 대에
  // 그대로 다시 쓰러져서, 산 보람 없이 사라집니다.
  breakCharm() {
    this.charm = false;
    this.hp = Math.round(this.maxHp * CFG.shop.charmHeal);
    this.lastHitAt = this.time.now + CFG.shop.charmGraceMs;

    this.cameras.main.shake(260, 0.012);
    this.popup('부적이 깨졌다', '#4dd0e1');
    const ring = this.add.circle(this.player.x, this.player.y, 20, 0x000000, 0)
      .setStrokeStyle(4, 0x4dd0e1, 0.95).setDepth(12);
    this.tweens.add({
      targets: ring, scale: 5, alpha: 0, duration: 460,
      ease: 'Cubic.out', onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: this.player, alpha: 0.35, duration: 110, yoyo: true, repeat: 6,
      onComplete: () => this.player.setAlpha(1),
    });
  }

  // ── 코인 ──────────────────────────────────────────────
  // 센 놈이 많이 준다는 것이 눈에 보여야 합니다.
  // 값만 올리면 숫자만 커질 뿐이라, 값이 클수록 여러 개가 쏟아지게 나눕니다.
  dropCoin(x, y, value, big) {
    value = Math.round(value * (1 + this.weapon.relicSum('coinBonus')));
    const n = Phaser.Math.Clamp(Math.round(value / 2.5), 1, big ? 16 : 7);
    const each = Math.floor(value / n);
    const extra = value - each * n;

    for (let i = 0; i < n; i++) {
      const sprite = this.add.sprite(
        x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-8, 8), 'coin').setDepth(12);
      this.tweens.add({
        targets: sprite, y: sprite.y - Phaser.Math.Between(18, 36),
        duration: 200, ease: 'Quad.out',
      });
      this.pickups.push({
        sprite,
        value: each + (i < extra ? 1 : 0),
        speed: 60 + Math.random() * 70,
      });
    }
  }

  // 코인은 잠깐 튀었다가 주인공에게 빨려 들어옵니다.
  updatePickups(delta) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.speed = Math.min(900, p.speed + delta * 2.2);

      const angle = Phaser.Math.Angle.Between(p.sprite.x, p.sprite.y, this.player.x, this.player.y);
      const step = (p.speed * delta) / 1000;
      p.sprite.x += Math.cos(angle) * step;
      p.sprite.y += Math.sin(angle) * step;

      if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.player.x, this.player.y) < 24) {
        this.coins += p.value;
        this.totalCoins += p.value;
        p.sprite.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  // ── 박쥐 ──────────────────────────────────────────────
  // 천천히 가는 것에 값을 매깁니다. 상점을 떠난 뒤 graceMs 가 지나면
  // 날아들기 시작하고, 늦어질수록 한 번에 오는 수가 늘어납니다.
  // 잡을 수는 있지만 코인은 안 나옵니다 — 쫓아내는 것이 목적입니다.
  updateBats(time) {
    if (this.bossFight) return; // 투기장에는 오지 않습니다
    const b = CFG.bats;
    // 첫 상점까지는 아무리 늑장을 부려도 안 옵니다. 규칙을 익히는 구간에서
    // 뒤에서 쫓기면 배우는 대신 도망만 치게 됩니다.
    // 알림은 51층에 올라서는 순간 한 번 뜹니다 (checkFloorGates).
    if (this.floorIndex < (b.fromFloor || 0)) return;
    if (!this.gatesShown.has('bats')) return;
    if (time < this.batsFrom) return; // 글씨를 읽을 틈은 주고 시작합니다

    const late = time - this.lastShopAt - b.graceMs;
    if (late < 0) return;
    if (time < this.nextBatAt) return;

    this.nextBatAt = time + b.spawnEvery;
    // 늦어질수록 한 번에 오는 수가 늘어납니다.
    const wave = Math.min(b.maxAtOnce, 1 + Math.floor(late / b.rampEvery));
    for (let i = 0; i < wave; i++) {
      if (this.batCount() >= b.max) break;
      spawnBat(this, Math.random() < b.biterRatio ? 'biter' : 'thief', this.floorIndex);
    }
  }

  batCount() {
    return this.enemies.getChildren().filter((e) => e.active && e.isBat).length;
  }

  clearBats() {
    this.enemies.getChildren().slice().forEach((e) => { if (e.isBat) e.destroy(); });
  }

  // ── 층에 올라설 때 한 번 알려 주는 것들 ────────────────
  //
  // 규칙을 한 번에 다 얹지 않습니다. 첫 쉰 층은 길과 싸움, 그다음 쉰 층은
  // 서두르는 법(박쥐), 그다음 쉰 층은 의심하는 법(함정). 새 규칙은 그것이
  // 처음 적용되는 층에 **올라서는 순간** 알립니다.
  //
  // 예전에는 박쥐 알림이 "봐주는 시간이 끝나는 순간"에 떴습니다. 그건 이미
  // 늦은 사람에게만 보이는 알림이라 "이런 게 있구나"가 아니라 "당했다"가 됩니다.
  // 층에 걸어 두면 누구에게나 같은 자리에서, 아직 여유가 있을 때 보입니다.
  floorGates() {
    return [
      {
        key: 'bats',
        floor: CFG.bats.warnFloor,
        lines: ['이제 서두르지 않으면', '박쥐에게 아이템을 뺏깁니다',
          '다음 상점에 닿으면 물러갑니다'],
        color: '#b39ddb',
        after: () => { this.batsFrom = this.time.now + (CFG.bats.warnLeadMs || 0); },
      },
      {
        key: 'trap',
        floor: CFG.trap.warnFloor,
        lines: ['이제부터 함정이 섞입니다', '좋아 보이는 것이 가짜일 수 있습니다',
          '두 층 안에 들면 정체가 드러납니다'],
        color: '#ff8a80',
      },
    ];
  }

  // 한 번에 한 가지만 알립니다.
  //
  // 두 알림이 겹칠 일이 있느냐 하면 있습니다. 상점에서 이어서 시작하거나
  // 앞 층을 건너뛰면 밀린 알림이 한꺼번에 조건을 만족합니다. 그때 글자가
  // 그대로 포개져서 아무것도 안 읽힙니다. 밀린 것은 다음 층으로 미룹니다 —
  // 규칙은 어차피 알린 뒤에야 켜지므로, 한 층 늦는 것이 겹쳐 읽히는 것보다 낫습니다.
  checkFloorGates() {
    if (this.time.now < (this.gateUntil || 0)) return;
    const gate = this.floorGates().find((g) =>
      g.floor && this.floorIndex >= g.floor && !this.gatesShown.has(g.key));
    if (!gate) return;
    this.gatesShown.add(gate.key);
    this.announceGate(gate);
    if (gate.after) gate.after();
  }

  announceGate(gate) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    this.gateUntil = this.time.now + 2400; // 글자가 다 사라질 때까지 다음 알림을 막습니다
    const parts = gate.lines.map((line, i) =>
      this.add.text(CFG.width / 2, 296 + i * 36,
        line, font(i === gate.lines.length - 1 ? 19 : 26,
          i === gate.lines.length - 1 ? '#8794b5' : gate.color)).setOrigin(0.5));
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1800,
        onComplete: () => t.destroy() });
    });
  }


  // 코인을 채 갑니다. 물지는 않으므로 무적 시간을 쓰지 않습니다.
  batStealsCoins(bat) {
    const b = CFG.bats;
    const taken = Math.min(this.coins, Math.max(b.stealMin, Math.round(this.coins * b.stealRatio)));
    if (taken > 0) {
      this.coins -= taken;
      this.popup('코인 -' + taken, '#b39ddb');
    } else {
      this.popup('빈손', '#8794b5');
    }
    this.batFlees(bat);
  }

  // 발판 위 아이템을 통째로 채 갑니다.
  batStealsItem(bat, slot) {
    slot.expired = true;
    if (slot.view) { slot.view.destroy(); slot.view = null; }
    bat.itemTarget = null;
    this.popup('아이템을 뺏겼습니다', '#b39ddb');
    this.batFlees(bat);
  }

  batFlees(bat) {
    bat.fleeing = true;
    bat.fleeDir = bat.x < this.player.x ? -1 : 1;
    bat.setAlpha(0.7);
  }

  // ── 그 밖 ─────────────────────────────────────────────
  score() {
    return this.floorIndex * 10 + this.totalCoins * 2;
  }

  // 맞을 때마다 "방어가 얼마나 막았는지"를 같이 보여 줍니다.
  // 방어력이 숫자로만 있으면 올려도 올린 값을 체감하기 어렵습니다.
  // 속도는 더해져서 한계에서 잘립니다. 잘렸다면 그 사실을 그 자리에서 알려 줘야
  // 다음에 속을 보고 "저건 이제 헛것"이라고 판단할 수 있습니다.
  popupSpeed() {
    const w = this.weapon;
    this.popup('공격 속도 ×' + w.speedMult.toFixed(2) + (w.speedCapped ? ' (한계)' : ''),
      w.speedCapped ? '#ffb74d' : '#4fc3f7');
  }

  // 막아 낸 피해에 비례해 방어력을 깎습니다. 실제로 깎인 만큼(%)을 돌려줍니다.
  // 표시용 정수와 속내 실수가 어긋나지 않도록, 깎인 값도 화면에 쓰는 정수로 셉니다.
  wearArmor(blocked) {
    if (!this.job.usesArmor || this.armor <= 0) return 0;
    const before = Math.round(this.armor);
    this.armor = Math.max(0,
      this.armor - CFG.armor.wearPerHit - blocked * CFG.armor.wearPerDamage);
    return before - Math.round(this.armor);
  }

  popupHit(taken, blocked, worn) {
    this.popup('-' + taken, '#ff8a80');
    if (blocked <= 0) return;

    // 막은 값과 그 대가로 갈린 갑옷을 한 줄에 같이 보여 줍니다.
    // 막았다는 것만 보이고 닳는 것이 안 보이면, 방어력이 왜 줄어드는지 알 수 없습니다.
    const label = '방어 ' + blocked + ' 막음' + (worn ? '   갑옷 -' + worn + '%' : '');
    const t = this.add.text(this.player.x, this.player.y - 22, label, {
      fontFamily: 'sans-serif', fontSize: '19px', color: worn ? '#ffab91' : '#b0bec5',
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({ targets: t, y: t.y - 42, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  popup(text, color) {
    const t = this.add.text(this.player.x, this.player.y - 50, text, {
      fontFamily: 'sans-serif', fontSize: '26px', color,
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  gameOver() {
    this.dead = true;
    this.hp = 0;
    // 판을 넘어 남는 기록. 직업 해금이 여기에 기댑니다.
    const wasBest = Save.bestFloor;
    const opened = classesUnlockedBy(this.floorIndex, this.totalCoins);
    opened.forEach((job) => Save.unlock(job.key));
    Save.finishRun(this.floorIndex, this.totalCoins);
    // 죽을 때 들고 있던 무기도 도감에 남깁니다 (구경용).
    this.weapon.record();
    // 그리고 이번 판에 손에 넣은 순서를 남깁니다 — 다음 판의 계승이 여기 둘째를 씁니다.
    Save.setLastRun(this.job.key, this.gotWeapons);
    this.physics.pause();
    this.enemies.getChildren().forEach((e) => e.setTint(0x555555));

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const add = (o) => o.setScrollFactor(0).setDepth(200);

    add(this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x000000, 0.72));
    add(this.add.text(cx, 138, this.job.name, font(24, '#8794b5')).setOrigin(0.5));
    add(this.add.text(cx, 190, this.floorIndex + '층', font(66, '#ffffff')).setOrigin(0.5));
    add(this.add.text(cx, 244, '점수 ' + this.score() + '   처치 ' + this.kills +
      '   코인 ' + this.totalCoins, font(22, '#b0bec5')).setOrigin(0.5));

    // 들고 있던 유물. 어떤 조합으로 여기까지 왔는지가 다음 판의 계획이 됩니다.
    if (this.weapon.relics.length) {
      add(this.add.text(cx, 268,
        this.weapon.relics.map((r) => r.icon + ' ' + r.name).join('   '),
        font(17, '#ffd54f')).setOrigin(0.5));
    }

    // 최고 기록과 다음 해금까지 남은 거리를 같이 보여 줍니다.
    // 죽을 때마다 "얼마나 왔는지"가 보여야 한 판 더 하게 됩니다.
    add(this.add.text(cx, 278,
      this.floorIndex > wasBest ? '최고 기록 경신!' : '최고 기록 ' + Save.bestFloor + '층',
      font(22, this.floorIndex > wasBest ? '#ffd54f' : '#8794b5')).setOrigin(0.5));

    // 해금은 한 판 안에서 층과 코인을 함께 채워야 합니다. 이번 판이 어디까지 왔는지
    // 두 조건을 나란히 보여 줘야 "무엇이 모자랐는지"를 압니다.
    if (opened.length) {
      add(this.add.text(cx, 314, opened.map((j) => j.name).join(' · ') + ' 해금!',
        font(26, '#a5d6a7')).setOrigin(0.5));
    } else {
      const next = CLASSES.find((c) => (c.unlockFloor || c.unlockCoins) && !Save.data.unlocked[c.key]);
      if (next) {
        add(this.add.text(cx, 310,
          next.name + ' 해금  ' + next.unlockFloor + '층 · 코인 ' + next.unlockCoins,
          font(18, '#8794b5')).setOrigin(0.5));
        add(this.add.text(cx, 332, '이번 판  ' + this.floorIndex + '층 · 코인 ' + this.totalCoins,
          font(18, this.floorIndex >= next.unlockFloor || this.totalCoins >= next.unlockCoins
            ? '#ffd54f' : '#4a5578')).setOrigin(0.5));
      }
    }

    this.buildDeathChoices(add, font, cx);
  }

  // ── 죽고 나서 무엇을 가져갈까 ─────────────────────────
  // 셋 중 하나만 고릅니다. 메달을 받지 않으면 이번 판에 번 메달은 사라집니다.
  // 그래서 "무기 계승"과 "이어서 진행"에는 값이 붙습니다 — 고민이 생기는 자리입니다.
  // 잃는 것은 버튼에 그대로 적어 둡니다. 모르고 눌러서 잃으면 그건 함정입니다.
  //
  // 세 번째는 원래 「직업 바꾸기」였습니다. 그런데 메달을 받고 메달 상점에 가면
  // 거기에 「직업 다시 고르기」가 있습니다 — 메달을 통째로 버려 가며 직업을
  // 바꿀 이유가 없었으니, 값을 치를 값어치가 있는 것으로 바꿨습니다.
  buildDeathChoices(add, font, cx) {
    const earned = this.medals;
    const cost = earned ? '이번 판 메달 ' + earned + '개를 버립니다' : '이번 판에 번 메달은 없습니다';
    // 계승할 무기는 이번 판에서 **두 번째로 손에 넣은 것**으로 고정입니다.
    // 예전에는 도감에서 아무거나 뽑았는데, 운 좋게 좋은 것이 뜬 판은 시작부터
    // 밸런스가 무너졌습니다. 둘째로 고정하면 값어치가 늘 같습니다.
    const carry = Save.carryWeapon(this.job.key);
    this.deathCarry = carry; // 자동 시험에서 "고른 것"과 "들고 시작한 것"을 맞춰 보는 통로

    // 이어서 진행하기 — 상점에 한 번은 닿아야 하고, 판마다 두 번까지입니다.
    const left = CFG.continues.max - this.continues;
    const canResume = !!this.resumePoint && left > 0;
    const resumeTitle = this.resumePoint
      ? this.resumePoint.floor + '층 상점에서 이어서'
      : '이어서 진행할 자리 없음';
    const resumeSub = !this.resumePoint
      ? '상점에 한 번은 닿아야 합니다'
      : left <= 0
        ? '이어서 진행은 한 판에 ' + CFG.continues.max + '번까지입니다'
        : cost + '   ·   남은 횟수 ' + left + '번';

    add(this.add.text(cx, 386, '무엇을 가져갈까', font(24, '#ffffff')).setOrigin(0.5));

    const choice = (y, color, title, sub, enabled, onPick) => {
      const box = add(this.add.rectangle(cx, y, 450, 104,
        enabled ? 0x232b47 : 0x171c2e).setStrokeStyle(2, enabled ? color : 0x2a3252));
      add(this.add.text(cx, y - 20, title, font(26, enabled ? '#ffffff' : '#4a5578')).setOrigin(0.5));
      add(this.add.text(cx, y + 20, sub, font(18, enabled ? '#8794b5' : '#3c456b')).setOrigin(0.5));
      if (enabled) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerdown', onPick);
      }
      return { x: cx, y };
    };

    this.deathChoices = [
      // 1 — 번 메달을 받고 상점으로. 쌓아 둔 메달도 여기서만 쓸 수 있습니다.
      choice(470, 0xffca28, '🏅 메달 ' + earned + '개 받기',
        '메달 상점으로 갑니다  (가진 메달 ' + Save.medals + ')', true, () => {
          Save.addMedals(earned);
          this.scene.start('medal', { jobKey: this.job.key, earned });
        }),

      // 2 — 도감에서 무작위로 뽑힌 한 자루. 무엇이 나왔는지 보고 고릅니다.
      //     좋은 것이 뜨면 메달을 버릴 값어치가 있고, 아니면 1번이 낫습니다.
      choice(590, 0xff8a65,
        carry ? this.carryName(carry) + ' 들고 다시' : '계승할 무기 없음',
        carry ? cost : '이번 판에 무기를 두 번은 손에 넣어야 합니다', !!carry, () => {
          Save.setBoost('weapon', carry);
          this.scene.start('game', { jobKey: this.job.key });
        }),

      // 3 — 마지막으로 들른 상점을 나서던 자리로. 무기도 유물도 코인도 그대로입니다.
      //     값은 이번 판에 번 메달 전부, 그리고 판마다 두 번뿐이라는 것.
      choice(710, 0x4dd0e1, resumeTitle, resumeSub, canResume, () => {
        this.scene.start('game', {
          jobKey: this.job.key,
          resume: { ...this.resumePoint, continues: this.continues + 1 },
        });
      }),
    ];

    // 계승할 무기의 그림. 이름 옆에 붙여 두면 다음 판 HUD에 뜰 그림과 같아서,
    // 무엇을 들고 시작하는지가 고르는 자리에서 이미 보입니다.
    if (carry) {
      const tier = Math.min(this.job.weapons.length - 1, carry.tier);
      add(this.add.image(cx - 178, 590, weaponIconKey(this.job.key, tier))
        .setDisplaySize(46, 46));
    }
  }

  // 계승할 무기를 사람이 읽을 이름으로. 공격 속도는 넘어가지 않으므로 적지 않습니다 —
  // 속도는 무기가 아니라 손에 붙는 것입니다.
  carryName(carry) {
    const table = this.job.weapons;
    const base = table[Math.min(table.length - 1, carry.tier)];
    return base.name + (carry.plus ? ' +' + carry.plus : '');
  }

  // ── 매 프레임 ─────────────────────────────────────────
  update(time, delta) {
    if (this.dead) return;
    if (this.lastShopAt === 0) this.lastShopAt = time; // 첫 판의 시계는 여기서 시작합니다

    // 카메라는 주인공을 화면 아래쪽에 두고 따라 올라갑니다.
    const cam = this.cameras.main;
    const want = this.player.y - CFG.height * 0.68;
    cam.scrollY += (want - cam.scrollY) * Math.min(1, delta / 130);
    // 벽은 화면에 붙어 있고 무늬만 흘러갑니다. 한 장으로 끝없이 이어집니다.
    if (this.wall) this.wall.tilePositionY = cam.scrollY;

    this.updatePickups(delta);
    this.hud.update();

    // 상점과 유물 고르기 중에는 시간이 멈춘 셈 칩니다.
    if (this.shop.open || this.choosing) return;

    this.updateItems(time);
    if (this.floorIndex > 0) this.hud.fadeHint(delta);

    updateEnemies(this, time, delta);

    this.bullets.getChildren().forEach((b) => {
      if (!b.active) return;
      if (time - b.bornAt > 1600) { b.destroy(); return; }

      // 화살은 날아가는 쪽을 향해야 합니다. 안 돌리면 옆으로 누워 날아갑니다.
      if (b.isArrow) {
        b.setRotation(Math.atan2(b.body.velocity.y, b.body.velocity.x));
        this.trailArrow(b, time);
      }
      if (b.hitSet) return; // 파동은 직선으로만 나갑니다

      // 화살은 표적을 조금 따라갑니다. 쏘는 순간의 자리로만 날리면
      // 걸어다니는 적을 스쳐 지나가 버려서 좀처럼 맞지 않습니다.
      if (b.from && b.from.active) {
        const want = Phaser.Math.Angle.Between(b.x, b.y, b.from.x, b.from.y);
        const now2 = Math.atan2(b.body.velocity.y, b.body.velocity.x);
        const rate = b.homing ? CFG.arrowHomingTurn : CFG.arrowTurn;
        const turn = Phaser.Math.Angle.RotateTo(now2, want, rate * delta / 1000);
        this.physics.velocityFromRotation(turn, CFG.arrowSpeed, b.body.velocity);
      }
    });
    this.enemyBullets.getChildren().forEach((b) => {
      if (b.active && time - b.bornAt > 3000) b.destroy();
    });

    this.attack(time);

    // 겉몸은 언제나 물리 몸을 따라갑니다. 공격이 없어도 매 프레임 돌아야
    // 뛰거나 줄을 옮길 때 겉몸이 뒤처지지 않습니다.
    this.rig.sync();

    this.updateBats(time);

    // 무작위 등장 — 높이 올라갈수록 간격이 짧아집니다.
    // 투기장에서는 보스가 직접 졸개를 부르므로 여기서는 쉽니다.
    if (!this.bossFight && this.floorIndex >= CFG.ambient.startFloor && time > this.ambientAt) {
      this.spawnAmbient();
      const delay = Math.max(CFG.ambient.minDelay, CFG.ambient.baseDelay - this.floorIndex * CFG.ambient.delayPerFloor);
      this.ambientAt = time + delay;
    }
  }
}
