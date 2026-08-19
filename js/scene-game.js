const STAND_OFFSET = CFG.platformH / 2 + 24; // 발판 위에 발이 닿는 높이

// 화면 위쪽 알림(새 적 · 황금개구리)의 첫 줄 자리.
// HUD 띠(0~140)와 보스 체력 띠(143~173) 아래여야 합니다.
const NOTICE_TOP = 200;

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  init(data) {
    this.job = classByKey((data && data.jobKey) || Save.data.lastJob || 'warrior');
    Save.setJob(this.job.key);
    // 「이어서 진행하기」로 들어왔으면 직전 상점을 나서던 자리를 그대로 물려받습니다.
    this.resume = (data && data.resume) || null;
    // 무기 도감에서 골라 온 자루의 번호 (js/scene-weaponbook.js).
    // 이어서 진행하기로 들어올 때는 그 판의 자루를 그대로 쓰므로 무시됩니다.
    this.startWeapon = (data && data.weaponIndex !== undefined) ? data.weaponIndex : null;
  }

  // 그려 둔 그림을 먼저 굽습니다. create 의 buildTextures 는 이미 있는 키를
  // 건너뛰므로, 그림이 있는 것은 그림이 · 없는 것은 도형이 쓰입니다.
  preload() {
    loadArt(this);
    // 주인공의 공격 컷은 이번 판에서 고른 직업 것만 굽습니다 (js/artset.js).
    loadSheets(this, this.job.key);
  }

  create() {
    buildTextures(this);

    this.dead = false;
    // Phaser 는 장면을 새로 짓지 않고 **같은 것을 다시 씁니다.** 지난 판을
    // 스스로 그만뒀으면 이 표가 그대로 남아서, 다음 판에서 멀쩡히 죽었는데도
    // 「이어서 진행」이 잠겨 있게 됩니다.
    this.noResume = false;
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
    this.coins = 0;
    this.totalCoins = 0;
    this.kills = 0;
    this.medals = 0; // 이번 판에 번 메달. 죽을 때 받을지 말지 고릅니다.
    this.medalBand = 0; // 메달을 받은 가장 깊은 100층 띠 (checkMedalFloor)
    // 보스를 잡아 얻은 것 (js/trophies.js). **이어서 진행하면 사라집니다** —
    // 아래 snapshotAtShop 에 안 들어갑니다.
    this.trophies = new Trophies(this);
    this.charm = false; // 수호 부적 — 상점에서만 삽니다. 쓰러질 때 한 번 버팁니다
    // 천리안 — 사면 판 내내. 화면 밖에 놓인 **다음 아이템 하나**를 알려 줍니다.
    this.farsight = false;
    // 막는 것 넷 — { 놈 열쇠: 남은 횟수 }. 상점에 닿을 때마다 도로 찹니다.
    this.wards = {};
    // 유물복권에 당첨되고 아직 안 고른 몫. 상점을 나설 때 하나씩 엽니다.
    this.pendingRelics = 0;

    // 도감에서 골라 온 자루. 고르지 않았으면 그 직업의 첫 자루입니다
    // (js/scene-weaponbook.js). 강화는 안 딸려 옵니다 — 자루만 넘어옵니다.
    if (this.startWeapon !== null && this.weapon.table[this.startWeapon]) {
      this.weapon.index = this.startWeapon;
    }

    // 메달 상점에서 사 둔 것을 바릅니다. **직업마다 영영 지닌 것**입니다.
    this.boosts = applyBoosts(this, Save.perksFor(this.job.key));
    this.noteWeapon(); // 들고 시작한 자루도 도감에 적힙니다

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

    // 한가운데 알림 줄 (pushNotice). **판이 시작될 때마다 비웁니다** —
    // Phaser 가 장면 인스턴스를 다시 쓰므로, 안 비우면 지난 판에 밀려 있던
    // 알림이 새 판에서 튀어나오고 이미 없어진 글자를 지우려 듭니다.
    this.notices = [];
    this.noticeParts = null;
    this.noticeTimer = null;
    this.announceBoosts();

    this.hurtFlash = null; // 깜빡임을 흔드는 그릇 { a }. flashHurt 가 만듭니다
    // 흡혈의 초당 주머니. **판마다 비웁니다** — Phaser 는 장면을 다시 쓰므로
    // (create 가 다시 돌아도 this 는 그대로), 안 비우면 지난 판의 주머니가
    // 남아서 새 판 첫 대에 한꺼번에 들어옵니다.
    this.leechPool = 0;
    this.leechAt = undefined;

    // 떠오르는 글자 주머니 (floatText). **판이 시작될 때마다 비웁니다.**
    //
    // Phaser 는 `scene.start('game')` 에 장면 **인스턴스를 다시 씁니다** —
    // create 만 다시 돌 뿐 `this` 는 그대로입니다. 그래서 안 비우면 지난 판에서
    // 이미 없어진 Text 들이 주머니에 남아 있고, 다음 판에서 그걸 꺼내는 순간
    // 죽은 물건에 글자를 쓰게 됩니다.
    this.textPool = null;

    // 너무 오래 멈춰 있으면 (js/config.js 의 CFG.idle).
    this.idleMs = 0;
    this.idleWarned = false;
    this.shadowPool = null;
    this.swallowing = false;

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
      // 한계와 부적도 함께 챙깁니다. **상점에서 코인을 주고 산 것들입니다.**
      // 이걸 빠뜨렸더니 부적을 사고 죽어서 이어 가면 부적이 없었습니다 —
      // 값은 치렀는데 물건이 사라진 것이라, 밖에서 보면 "부적이 안 듣는다"입니다.
      armorMax: this.armorMax, dodgeMax: this.dodgeMax,
      charm: this.charm,
      // 천리안과 막는 것도 **코인을 주고 산 것**입니다. 부적과 같은 이유로
      // 함께 챙깁니다 — 안 챙기면 사고 죽어서 이어 갈 때 값만 치른 셈이 됩니다.
      farsight: this.farsight,
      wards: Object.assign({}, this.wards),
      coins: this.coins, totalCoins: this.totalCoins,
      kills: this.kills,
      continues: this.continues,
      // 이번 판에서 이미 메달을 받은 가장 깊은 띠. 안 챙기면 이어서 진행할
      // 때마다 그 아래 100층들을 다시 지나며 메달이 또 들어옵니다.
      medalBand: this.medalBand,
      seenTypes: [...this.seenTypes],
      gatesShown: [...this.gatesShown],
      weapon: {
        index: w.index, plus: w.plus, haste: w.haste, mult: w.mult, capBonus: w.capBonus,
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
    // 예전 기록에는 없던 값들이라 없으면 지금 것을 그대로 씁니다.
    if (r.armorMax !== undefined) this.armorMax = r.armorMax;
    if (r.dodgeMax !== undefined) this.dodgeMax = r.dodgeMax;
    this.charm = !!r.charm;
    this.farsight = !!r.farsight;
    this.wards = Object.assign({}, r.wards || {});
    this.coins = r.coins;
    this.totalCoins = r.totalCoins;
    this.kills = r.kills;
    this.medalBand = r.medalBand || Math.floor(r.floor / CFG.medal.per);
    this.seenTypes = new Set(r.seenTypes);
    // 이미 본 알림은 다시 안 띄웁니다. 150층 상점에서 이어서 시작하는데
    // "이제 함정이 섞입니다"가 또 뜨면 새 소식이 아니라 잡음입니다.
    this.gatesShown = new Set(r.gatesShown || []);
    // 메달은 여기 없습니다. 그것이 이어서 진행하는 값입니다.

    const w = this.weapon;
    w.index = r.weapon.index;
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

      // ── 상점 층 ───────────────────────────────────
      // 발판은 그대로 두고 **뒤와 위**에 둘을 얹습니다. 둘 다 없어도 지금
      // 그대로 돌아갑니다 — 노란 띠 하나로 "저기 상점"은 이미 읽힙니다.
      //
      // 깊이는 벽(-5)과 발판(0) 사이입니다. 배경이 발판보다 앞에 서면
      // 발판 끝이 가려져서 어디를 밟는 자리인지가 흐려집니다.
      if (slot.kind === SLOT.SHOP) {
        if (hasArt('shop-back')) {
          // **발판 너비에 맞춥니다.** 그림은 구울 때 투명한 여백을 잘라
          // 냈으므로(bake-sprites.js 의 TRIM) 칸이 곧 그림입니다 — 처음에는
          // 안 자르고 얹었더니 460 칸 안에서 그림이 305px 밖에 안 됐습니다.
          const a = artSize('shop-back');
          const bw = w * (CFG.shopBackScale || 1);
          floor.views.push(this.add.image(slot.x, slot.y - CFG.platformH / 2, 'shop-back')
            .setDisplaySize(bw, bw * (a.h / a.w))
            .setOrigin(0.5, 1).setDepth(-3));
        }
        // 주인은 **발판 오른쪽 끝**에 섭니다. 한가운데에 두면 「상 점」 글자와
        // 밟고 선 주인공이 그 자리에서 셋이 겹칩니다.
        if (hasArt('shop-npc')) {
          floor.views.push(this.add.image(slot.x + w / 2 - 46, slot.y - CFG.platformH / 2,
            'shop-npc').setOrigin(0.5, 1).setDepth(-1));
        }
      }

      const mark = this.makeMark(slot);
      if (mark) { slot.view = mark; floor.views.push(mark); }
    }

    this.floors.set(index, floor);
  }

  // 올라가기 전에 무엇이 있는지 보이게 해서, 좌우 선택이 판단이 되게 합니다.
  // 무엇을 놓을지는 SLOT_MARK 와 slotArtKey 가 정합니다 (js/tower.js).
  makeMark(slot) {
    // 이 둘은 UP 칸에서만 만들어집니다 (아래). 그런데 **지우는 사람이 없어서**,
    // 한 번 UP 이었던 칸을 다른 것으로 다시 표시하면 앞선 표의 조각을 가리킨
    // 채로 남았습니다 — 그 조각은 이미 부서졌으므로 syncUpgradeMarks 가
    // 손대는 순간 터집니다 (setText → glTexture 가 null).
    // 표를 새로 만들 때마다 여기서 비웁니다. "지금 표에 붙어 있는 것만
    // 가리킨다"가 늘 참이 됩니다.
    slot.upIcon = null;
    slot.upGain = null;

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

    // 황금개구리. 미리 보여야 "쫓아갈까 말까"를 두 층 밖에서 정할 수 있습니다.
    if (slot.kind === SLOT.GOLDFROG) {
      return this.add.text(slot.x, slot.y - 40, '🐸', {
        fontFamily: 'sans-serif', fontSize: '26px', color: '#ffd54f',
      }).setOrigin(0.5).setDepth(5);
    }

    // 가짜는 흉내 내는 것의 표를 그대로 씁니다 — 겉으로는 구분이 안 됩니다.
    let kind = slot.kind;
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
      // **놓인 자루는 여기서 한 번 굴려 두고 그대로 갑니다.** 밟을 때 굴리면
      // 위층에 보이던 그림과 실제로 손에 들어오는 것이 달라져서, 두 층 밖에서
      // 보고 길을 정하는 일이 뜻을 잃습니다. 층이 깊을수록 좋은 자루가 나옵니다.
      if (!slot.weapon) slot.weapon = rollWeapon(this.job, slot.index || this.floorIndex);
      face = this.add.image(0, 0, weaponIconKey(this.job.key, slot.weapon.index))
        .setDisplaySize(30, 30);
      parts.push(this.add.circle(0, 0, 18, mark.color), face);
      // 밟으면 초당 피해가 얼마나 달라지는지. **밟기 전에 알아야 선택입니다.**
      // 그림만으로는 저 자루가 더 센지 알 수 없고, 갈아타면 쌓아 둔 강화가
      // 전부 날아가므로 실제로 손해인 경우가 많습니다.
      slot.upGain = this.add.text(0, 24, '', {
        fontFamily: 'sans-serif', fontSize: '16px', color: '#a5d6a7',
      }).setOrigin(0.5);
      parts.push(slot.upGain);
      this.markUpGain(slot);
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

  // 위층 무기 칸에 적어 둔 손익을 다시 씁니다.
  //
  // **그림은 안 건드립니다.** 놓인 자루는 발판을 지을 때 굴려 놓은 것이라
  // 바뀌지 않습니다 (makeMark). 바뀌는 것은 견주는 쪽 — 내가 `+1`이나 `속`을
  // 하나 주울 때마다 저 자루가 이득인지 손해인지가 달라집니다.
  syncUpgradeMarks() {
    const dps = this.weapon.dps;
    if (this.markedDps === dps) return;
    this.markedDps = dps;

    this.floors.forEach((floor) => {
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || !slot.upIcon || !slot.view || slot.taken || slot.expired) continue;
        this.markUpGain(slot);
      }
    });
  }

  // 무기 발판에 "저것으로 갈아타면 초당 피해가 이만큼 달라진다"를 적습니다.
  //
  // **손해인 경우가 흔합니다.** 갈아타면 쌓아 둔 `+1`·`속`·`×2`가 전부
  // 날아가므로, 오래 벼려 온 자루를 들고 있으면 더 좋은 자루도 지금보다
  // 약합니다. 빨갛게 적어 주면 "지금은 밟지 말자"가 하나의 선택이 됩니다.
  markUpGain(slot) {
    // scene 이 없으면 이미 부서진 것입니다 (Phaser 가 destroy 에서 지웁니다).
    // 위 makeMark 가 근본을 막지만, 여기는 매 프레임 지나가는 자리라
    // 한 겹 더 둡니다 — 터지면 판이 통째로 멈춥니다.
    if (!slot.upGain || !slot.upGain.scene) return;
    const now = this.weapon.dps;
    // 새 자루는 **강화 없이** 셉니다. 갈아타면 지금 강화가 안 따라오니까요.
    const next = slot.weapon ? this.weapon.dpsOf(slot.weapon, false) : 0;
    if (!next || !now) return slot.upGain.setText('');
    const pct = Math.round((next / now - 1) * 100);
    slot.upGain.setText((pct >= 0 ? '+' : '') + pct + '%');
    slot.upGain.setColor(pct >= 0 ? '#a5d6a7' : '#ff8a80');
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
      if (!slot || slot.spawned) continue;

      if (slot.kind === SLOT.GOLDFROG) {
        slot.spawned = true;
        spawnGoldFrog(this, slot.x, slot.y - 50, index);
        this.announceGoldFrog();
        if (slot.view) { slot.view.destroy(); slot.view = null; }
        continue;
      }

      if (slot.kind !== SLOT.ENEMY) continue;
      slot.spawned = true;
      slot.enemyTypes.forEach((type, i) => {
        spawnEnemy(this, slot.x + Phaser.Math.Between(-45, 45), slot.y - 50 - i * 30, index, type);
      });
      // 실제로 나왔으니 예고 표시는 지웁니다.
      if (slot.view) { slot.view.destroy(); slot.view = null; }
    }
  }

  // ── 한가운데 알림 ─────────────────────────────────────
  //
  // 알림은 **한 번에 하나만** 뜹니다.
  //
  // 알리는 자리가 여섯 군데입니다 — 새 적 · 황금개구리 · 메달 · 보스 ·
  // 규칙(함정·박쥐) · 판 첫머리의 지니고 오른 것. 저마다 제 자리에 글자를
  // 놓다 보니, 두 알림이 같은 순간에 뜨면 그대로 포개져서 아무것도 안 읽힙니다.
  // 특히 새 적은 한 발판에 두 종류가 함께 깨어나는 일이 흔해서, 판 첫머리에
  // '새로운 적' 두 장이 완전히 겹쳐 뭉개져 보였습니다.
  //
  // 자리를 옮겨 서로 피하게 하는 방법도 있지만, 알림이 하나 늘 때마다 여섯
  // 군데를 다시 맞춰야 하고 언젠가 반드시 어긋납니다. 자리 대신 **차례**로
  // 풉니다 — 앞 알림이 사라진 뒤에 다음 알림이 뜹니다.
  pushNotice(spec) {
    this.notices = this.notices || [];
    // 앞질러야 하는 알림(보스)은 밀린 것을 걷어내고 바로 뜹니다.
    // 보스가 내려앉는 장면과 글자가 어긋나면 무엇을 알리는지 모르게 됩니다.
    if (spec.now) {
      this.notices.length = 0;
      this.clearNotice();
    } else if (spec.merge) {
      // 아직 안 뜬 같은 종류가 줄에 있으면 새 장을 만들지 않고 거기에 보탭니다.
      const pending = this.notices.find((n) => n.key === spec.key);
      if (pending) return spec.merge(pending);
    }
    this.notices.push(spec);
  }

  // 줄을 푸는 것은 **다음 프레임의 update 하나뿐입니다** (아래 update).
  // 넣는 그 자리에서 바로 띄우면, 한 발판에서 두 종류가 같은 프레임에
  // 깨어날 때 첫 장이 이미 떠 버려서 둘째가 합쳐질 자리를 못 찾습니다.
  pumpNotices() {
    if (this.dead) return;
    if (this.noticeParts || !this.notices || !this.notices.length) return;
    const spec = this.notices.shift();
    this.noticeParts = spec.build(spec) || [];
    // 글자를 치우는 것은 **줄이 맡습니다.** 알림마다 제가 만든 글자를 스스로
    // 지우게 하면, 앞질러 걷어낼 때 무엇이 남았는지 알 길이 없습니다.
    this.noticeTimer = this.time.delayedCall(spec.ms, () => {
      this.noticeTimer = null;
      this.clearNotice();
      this.pumpNotices();
    });
  }

  // 지금 떠 있는 알림을 걷어냅니다. 화면 전체를 덮는 창(유물·갈아타기)이
  // 열릴 때도 씁니다 — 덮개 밑에 글자가 얼어붙은 채로 남기 때문입니다.
  clearNotice() {
    if (this.noticeTimer) { this.noticeTimer.remove(false); this.noticeTimer = null; }
    if (this.noticeParts) {
      this.noticeParts.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
      this.noticeParts = null;
    }
  }

  clearNotices() {
    if (this.notices) this.notices.length = 0;
    this.clearNotice();
  }

  // 알림 한 장을 띄웁니다. 글자들은 흐릿하게 떴다가 스스로 사라집니다.
  showNotice(parts) {
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 280, yoyo: true, hold: 1500 });
    });
    return parts;
  }

  // 황금개구리가 나타났음을 알립니다 (js/enemies.js 의 spawnGoldFrog).
  announceGoldFrog() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    this.pushNotice({ key: 'frog', ms: 2200, build: () => this.showNotice([
      this.add.text(cx, NOTICE_TOP, '황금개구리가 나타났습니다', font(20, '#ffd54f')).setOrigin(0.5),
      this.add.text(cx, NOTICE_TOP + 34, '🐸', font(38, '#ffd54f')).setOrigin(0.5),
      this.add.text(cx, NOTICE_TOP + 70, '잡으면 코인을 왕창 줍니다', font(16, '#8794b5')).setOrigin(0.5),
    ]) });
  }

  // 이 판에서 처음 나온 종류라면 이름을 띄웁니다.
  // 올라갈수록 새 적이 풀리는데, 알려주지 않으면 그냥 빨간 덩어리가 하나 늘 뿐입니다.
  announceEnemy(def) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;

    // ── 판을 바꾸는 넷은 판을 멈추고 알려 줍니다 ──────
    // 이름 한 줄로는 모자랍니다 — 무엇을 하는지 모르면 한 번은 반드시
    // 당하고, 그건 어려운 것이 아니라 안 알려 준 것입니다 (js/scene-foe.js).
    const tell = CFG.foes && CFG.foes.tell && CFG.foes.tell[def.key];
    if (tell && !this.dead && !this.shop.open && !this.choosing) {
      this.clearNotices();
      this.scene.pause();
      this.scene.launch('foe', { from: this, def, tell });
      return;
    }
    this.pushNotice({
      key: 'enemy', ms: 2200, names: [def.name],
      // 한 발판에서 두 종류가 함께 깨어나는 일이 흔합니다. 그때는 알림을 두 번
      // 띄우지 않고 이름만 나란히 붙입니다 — 어차피 같은 순간에 만난 적입니다.
      merge: (n) => { if (!n.names.includes(def.name)) n.names.push(def.name); },
      build: (n) => {
        const name = this.add.text(cx, NOTICE_TOP + 34, n.names.join('   '),
          font(38, '#ff8a80')).setOrigin(0.5);
        // 이름이 여럿이면 화면 밖으로 나갑니다. 넘치는 만큼만 줄입니다.
        const room = CFG.width - 48;
        if (name.width > room) name.setScale(room / name.width);
        return this.showNotice([
          this.add.text(cx, NOTICE_TOP, n.names.length > 1 ? '새로운 적 ' + n.names.length + '종'
            : '새로운 적', font(20, '#8794b5')).setOrigin(0.5),
          name,
        ]);
      },
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
      // 갈래 중 하나를 골라야 하고, 그 버튼들이 직접 입력을 받습니다.
      if (this.dead) return;

      // 일시정지 단추. 화면 전체가 이동 입력을 받으므로, 단추에 따로
      // setInteractive 를 걸면 한 번 누른 것이 단추와 이동 양쪽에 먹힐 수
      // 있습니다. 자리로 걸러 내면 순서에 기대지 않아도 한 번만 먹습니다.
      if (this.hud.hitsPauseButton(p.x, p.y)) { this.pauseGame(); return; }

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
    this.input.keyboard.on('keydown-P', () => this.pauseGame());
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
  }

  // ── 일시정지 ──────────────────────────────────────────
  // 어쩔 수 없이 자리를 비워야 할 때가 있습니다. 그런데 이 게임은 가만히
  // 서 있는 것에 값을 매기므로(updateIdle), 멈출 방법이 없으면 그 규칙이
  // 그냥 벌칙이 됩니다. 둘은 같이 있어야 합니다.
  //
  // 장면을 통째로 멈춥니다 — scene.pause() 는 update 도 물리도 트윈도 그
  // 장면의 시계(this.time.now)도 그 자리에 세웁니다. 박쥐·함정·보스가 전부
  // 절대 시각을 기준으로 잡아 둔 값들인데, 하나하나 "멈춘 동안은 빼고 세라"고
  // 챙기는 대신 장면 자체를 멈춰서 그 문제를 통째로 없앱니다.
  pauseGame() {
    if (this.dead || this.shop.open || this.choosing || this.swallowing) return;
    this.scene.launch('pause');
    this.scene.pause();
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
    // 내리찍는 놈이 뚫고 간 발판은 잠깐 못 딛습니다 (CFG.foes.slam.breakMs).
    // 그 줄이 진짜로 막혀야 「버리거나 서두르거나」가 선택이 됩니다.
    const ok = (sl) => sl && !sl.broken;
    const slot = (ok(next.slots[LANES[want]]) && next.slots[LANES[want]]) || LANES
      .map((l, i) => ({ slot: next.slots[l], i }))
      .filter((c) => ok(c.slot) && Math.abs(c.i - here) <= 1)
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
        this.checkMedalFloor();
        this.checkFloorGates();
        this.lane = slot.lane;
        // 층이 바뀌었으니 "가만히 있는 것"의 시계도 다시 0부터입니다.
        this.idleMs = 0;
        this.idleWarned = false;
        this.clearShadowPool();
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

  // ── 판을 바꾸는 넷이 부르는 것들 ───────────────────────

  // 미는 놈이 밀어냅니다. **한 층 아래로**, 딱 한 층만.
  //
  // 층은 floorIndex-3 까지 살려 두므로 한 층 아래는 언제나 있습니다. 그보다
  // 더 밀면 이미 지워진 층으로 떨어져서 딛을 지형이 없습니다.
  //
  // 아픈 것이 아니라 **되돌아가는 것**이 값입니다. 방금 지나온 층을 다시
  // 뚫어야 하고, 그 층은 아직 적이 서 있습니다.
  shoveDown(from) {
    if (this.dead || this.jumping || this.bossFight || this.shop.open || this.choosing) return;
    // 「박은 신」은 **밀리는 것 자체**를 막습니다. 피해만 막으면 층은 그대로
    // 잃는데, 이 놈이 가져가는 것은 체력이 아니라 층입니다.
    if (from && this.wardBlocks(from.def)) return;
    const below = this.floors.get(this.floorIndex - 1);
    if (!below) return;                       // 바닥이거나 이미 지워진 자리
    const c = CFG.foes.shove;

    // 밀린 쪽으로 한 칸. 벽에 붙어 있으면 제자리에서 떨어집니다.
    const here = LANES.indexOf(this.lane);
    const dir = from.x > this.player.x ? -1 : 1;
    const want = Phaser.Math.Clamp(here + dir, 0, LANES.length - 1);
    const slot = below.slots[LANES[want]] || below.slots[this.lane]
      || LANES.map((l) => below.slots[l]).find(Boolean);
    if (!slot) return;

    this.lane = slot.lane;
    this.floorIndex -= 1;
    this.jumping = true;
    this.lastHitAt = this.time.now + c.graceMs;   // 떨어지는 동안은 안 맞습니다
    this.popup('밀려남', '#ff8a80');
    this.cameras.main.shake(220, 0.010);

    this.tweens.add({
      targets: this.player, x: slot.x, y: slot.y - 34,
      duration: 260, ease: 'Quad.in',
      onComplete: () => {
        this.jumping = false;
        this.wakeFloor(this.floorIndex);
        this.hurt(from.contactDamage || 0, from);
      },
    });
  }

  // 내리찍는 놈이 세 층 위에서 그 줄을 물들입니다. **예고가 곧 이 놈의
  // 전부입니다** — 세 층이 잇달아 막힌다는 것을 미리 봐야 줄을 버릴지
  // 서두를지 고를 수 있습니다.
  markSlamLane(e) {
    const c = CFG.foes.slam;
    for (let i = 1; i <= c.floors; i++) {
      const floor = this.floors.get(this.floorIndex + c.above - i);
      if (!floor) continue;
      const slot = LANES.map((l) => floor.slots[l])
        .filter(Boolean).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
      if (!slot) continue;
      const warn = this.add.rectangle(slot.x, slot.y - 10, CFG.platformW, 4, 0xff5252, 0.8)
        .setDepth(6);
      this.tweens.add({ targets: warn, alpha: 0.15, duration: 260, yoyo: true,
        repeat: Math.ceil(c.markMs / 520), onComplete: () => warn.destroy() });
    }
  }

  // 한 층을 뚫고 지나갑니다. 발판이 잠깐 못 쓰게 되고, 그 자리에 있으면 맞습니다.
  slamThrough(e) {
    const c = CFG.foes.slam;
    this.cameras.main.shake(160, 0.008);
    // 그 줄에 서 있었으면 맞습니다. 세게 아픕니다 — 미리 보여 준 값입니다.
    if (Math.abs(this.player.x - e.x) < CFG.platformW / 2
      && Math.abs(this.player.y - e.y) < CFG.floorHeight * 0.55) {
      this.hurt(e.contactDamage || 0, e);
    }
    // 부서진 발판. 잠깐 딛지 못합니다 — 그 줄이 진짜로 막힙니다.
    const floor = [...this.floors.values()]
      .sort((a, b) => Math.abs(a.y - e.y) - Math.abs(b.y - e.y))[0];
    if (!floor) return;
    const slot = LANES.map((l) => floor.slots[l])
      .filter(Boolean).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
    if (!slot || !slot.deck) return;
    slot.broken = true;
    slot.deck.forEach((d) => d.setAlpha(0.25));
    this.time.delayedCall(c.breakMs, () => {
      slot.broken = false;
      if (slot.deck) slot.deck.forEach((d) => d.setAlpha(1));
    });
  }

  // 가르는 놈 — 제가 선 층을 가로로 관통합니다.
  fireLance(e) {
    const c = CFG.foes.lance;
    const y = e.y - 6;
    const aim = this.add.rectangle(CFG.width / 2, y, CFG.width, 3, c.aimColor, 0.85)
      .setScrollFactor(1).setDepth(7);
    this.tweens.add({ targets: aim, alpha: 0.3, duration: c.chargeMs / 3, yoyo: true, repeat: 1 });
    this.time.delayedCall(c.chargeMs, () => {
      aim.destroy();
      if (this.dead) return;
      const beam = this.add.rectangle(CFG.width / 2, y, CFG.width, c.width, c.color, 0.7)
        .setDepth(7);
      this.tweens.add({ targets: beam, alpha: 0, duration: c.liveMs,
        onComplete: () => beam.destroy() });
      // 그 층에 있으면 맞습니다. 줄은 상관없습니다 — 층 전체입니다.
      if (Math.abs(this.player.y - y) < c.width) this.hurt(e.contactDamage || 0, e);
    });
  }

  // 위층과 아래층으로 **전기가 튑니다.** 제 층은 안전합니다.
  //
  // 처음에는 채찍으로 만들었습니다 — 위아래로 뻗는 긴 팔. 화면에서 재 보니
  // **안 읽혔습니다.** 가로로 누운 가는 막대가 165px 떨어진 곳에 잠깐 떴다
  // 사라지는 것이라, 그 놈이 한 짓인지 그냥 화면 어딘가에 뭐가 번쩍인 건지
  // 구분이 안 됐습니다. 움직임이 커 보이려면 **몸에서 뻗어 나가는 것이
  // 보여야** 하는데, 팔이 몸에 닿아 있지 않았습니다.
  //
  // 전기는 그 문제가 없습니다. **몸에서 목표 층까지 이어진 선**을 그리므로
  // 누가 무엇을 하는지가 선 하나로 읽히고, 지그재그라 짧아도 빨라 보입니다.
  fireZap(e) {
    const c = CFG.foes.zap;
    [-1, 1].forEach((dir) => {
      const toY = e.y + dir * CFG.floorHeight;
      // 예고 — 몸에서 가늘게 뻗어 나가며 깜빡입니다.
      const aim = this.add.rectangle(e.x, (e.y + toY) / 2, 3, CFG.floorHeight, c.aimColor, 0.7)
        .setDepth(7);
      this.tweens.add({ targets: aim, alpha: 0.2, duration: c.chargeMs / 3, yoyo: true, repeat: 1 });

      this.time.delayedCall(c.chargeMs, () => {
        aim.destroy();
        if (this.dead) return;
        const parts = [];
        // 지그재그로 세 토막. 곧은 선보다 훨씬 빨라 보입니다.
        const steps = 3;
        for (let i = 0; i < steps; i++) {
          const y0 = e.y + (toY - e.y) * (i / steps);
          const y1 = e.y + (toY - e.y) * ((i + 1) / steps);
          const seg = this.add.rectangle(e.x + (i % 2 ? 9 : -9), (y0 + y1) / 2,
            6, Math.abs(y1 - y0), c.color, 0.95).setDepth(8)
            .setRotation((i % 2 ? 1 : -1) * 0.22);
          parts.push(seg);
        }
        // 닿은 층에서 좌우로 퍼집니다 — 여기가 아픈 자리라는 표시입니다.
        parts.push(this.add.rectangle(e.x, toY, c.reachX * 2, 10, c.color, 0.8).setDepth(8));
        this.tweens.add({ targets: parts, alpha: 0, duration: c.liveMs,
          onComplete: () => parts.forEach((o) => o.destroy()) });

        if (Math.abs(this.player.y - toY) < 40 && Math.abs(this.player.x - e.x) < c.reachX) {
          this.hurt(e.contactDamage || 0, e);
        }
      });
    });
  }

  // ── 천리안 ────────────────────────────────────────────
  // **화면 밖에 놓인 다음 아이템 하나**를 찾습니다. 몇 층 위, 어느 줄인지.
  //
  // 이미 만들어 둔 층만 봅니다 (floorIndex+7 까지). 아직 안 만든 층을 여기서
  // 굴려 보면 **그때 나온 것과 실제로 갈 때 나오는 것이 달라집니다** — 미리
  // 보여 준 것이 거짓말이 되는데, 그건 안 보여 주는 것보다 나쁩니다.
  //
  // 미믹은 **겉모습 그대로** 알려 줍니다. 정체를 까면 함정이 통째로 죽습니다 —
  // 천리안도 지도와 똑같이 속습니다. 가까이 가야 드러나는 것은 그대로입니다.
  nextItemAhead() {
    for (let i = this.floorIndex + 1; i <= this.floorIndex + 7; i++) {
      const floor = this.floors.get(i);
      if (!floor) continue;
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || slot.taken) continue;
        const kind = slot.kind === SLOT.MIMIC ? slot.disguise : slot.kind;
        if (!kind || !SLOT_MARK[kind]) continue;
        return { up: i - this.floorIndex, lane, kind, label: SLOT_MARK[kind].label };
      }
    }
    return null;
  }

  // ── 보스 ──────────────────────────────────────────────
  startBoss(slot) {
    if (slot.view) { slot.view.destroy(); slot.view = null; }
    this.bossFight = true;
    this.bossEntering = true;
    this.bossFloor = this.floorIndex;
    this.arenaY = slot.y;
    this.clearShadowPool();

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

    // 보스는 기다리지 않습니다 — 내려앉는 장면과 글자가 붙어 있어야 합니다.
    this.pushNotice({ key: 'boss', ms: 2500, now: true, build: () => {
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
        this.tweens.add({ targets: t, alpha: 0, delay: 1900, duration: 400 });
      });
      this.cameras.main.shake(600, 0.006);
      return parts;
    } });
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
    this.dropCoin(boss.x, boss.y, CFG.boss.coin, true);

    // ── 메달이 아니라 전리품입니다 ─────────────────────
    // 메달은 100층마다 층에서 나오는 것 하나로 모았습니다. 보스가 셋을 더
    // 얹으면 그 규칙이 규칙이 아니게 됩니다. 그리고 어렵게 넘어선 값이
    // **다음 판에나 오는 화폐**인 것도 이상했습니다 — 그 자리에서 손에
    // 잡히는 것이어야 합니다 (js/trophies.js).
    const trophy = trophyForBoss(boss.kind);
    const got = this.trophies.take(trophy);

    // 길이 다시 열립니다.
    for (let i = this.floorIndex; i <= this.floorIndex + 7; i++) this.addFloor(i);
    this.armItems();
    this.markReach();
    // 방금 싸움이 끝났으니 박쥐 시계도 다시 갑니다.
    this.lastShopAt = this.time.now;
    this.cameras.main.shake(300, 0.01);

    // ── 판을 멈추고 보여 줍니다 ────────────────────────
    // 예전에는 흐릿하게 떴다 사라지는 알림 두 줄이었습니다. 그런데 이건 판에서
    // 가장 큰 벽을 넘은 자리이고, 손에 들어오는 것도 이 판에 하나뿐인 물건입니다.
    // **지나가면서 읽게 하면 안 되는 것**입니다 — 무엇을 얻었는지도, 그것이
    // 무슨 일을 하는지도 모른 채 다음 발판으로 뛰게 됩니다.
    //
    // 갈아타기 창과 같은 규칙입니다 (js/scene-swap.js): 결정이나 값어치가
    // 걸린 자리는 판을 멈추고 한 장을 펼칩니다.
    this.clearNotices();
    this.scene.pause();
    this.scene.launch('trophy', {
      from: this, boss: boss.kind, trophy, got, healed,
    });
  }

  // 처음 보는 놈 창이 닫히면 여기로 돌아옵니다. 창을 닫은 그 손가락이
  // 그대로 이동으로 먹히지 않게 잠깐 막습니다 (전리품 창과 같은 규칙).
  closeFoe() {
    this.tapBlockedUntil = this.time.now + 300;
  }

  // 전리품 창이 닫히면 여기로 돌아옵니다.
  closeTrophy() {
    // 창을 누른 그 탭이 판이 다시 흐른 뒤 점프로 한 번 더 먹히는 것을 막습니다.
    this.tapBlockedUntil = this.time.now + 300;
  }

  land(slot) {
    if (!slot.taken && !slot.expired) {
      slot.taken = true;
      switch (slot.kind) {
        case SLOT.PLUS:
          // 한계에 닿았으면 망치도 안 내리칩니다. 아무 일도 안 일어나는데
          // 벼리는 시늉만 하면 그건 보상이 아니라 놀림입니다
          // (보물상자에서 빈손이 나오면 안 되는 것과 같은 규칙).
          if (this.weapon.addPlus()) {
            this.forgeFx(slot.x, slot.y - 38);
            this.popup('공격력 +1', '#ffd54f');
          } else {
            this.popup('공격력이 이미 한계입니다', '#8794b5');
          }
          break;
        case SLOT.RELIC:
          // 자동으로 붙지 않습니다. 판이 멈추고 세 장 중 하나를 고릅니다.
          this.openRelicChoice();
          break;
        case SLOT.TREASURE:
          this.openTreasure(slot);
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
          // **판을 멈추고 고릅니다.** 갈아타면 강화가 날아가므로, 지나가면서
          // 저절로 바뀌어서는 안 되는 결정입니다 (js/scene-swap.js).
          this.offerWeapon(slot.weapon);
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

    // 메달은 여기서 안 줍니다 — **100층마다 층에 걸려 있습니다**
    // (아래 checkMedalFloor). 상점 도착에 걸려 있던 시절에는 200·400층이
    // 상점이 아니라 투기장이라 그 판이 조용히 건너뛰어졌습니다.

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
    // 유물복권에 당첨된 몫이 있으면 **여기서** 엽니다. 상점 안에서 열면
    // 두 창이 같은 깊이에 겹쳐 서고, 유물 창은 판을 멈추는데 상점은 이미
    // 멈춰 있는 판 위에 얹혀 있어서 어느 쪽도 제대로 안 닫힙니다.
    if (this.pendingRelics > 0) {
      this.pendingRelics -= 1;
      this.time.delayedCall(360, () => this.openRelicChoice());
    }

    // 상점을 나서도 바로 몰려오지는 않습니다. 위층 적은 실제로 올라설 때 깨어납니다.
    this.ambientAt = this.time.now + CFG.ambient.baseDelay;

    // **박쥐 시계는 여기서 다시 겁니다 — 닿았을 때가 아니라 나설 때부터.**
    // enterShop 에서만 되돌렸더니, 진열을 오래 들여다본 시간이 그대로 시계에
    // 쌓여서 나오자마자 박쥐가 와 있었습니다. 상점은 한숨 돌리는 자리인데
    // 고민한 값을 물리는 셈이었습니다. 서두르라는 재촉은 **오르는 동안**
    // 하는 것이지 무엇을 살지 고르는 동안 하는 것이 아닙니다.
    this.lastShopAt = this.time.now;
    this.clearBats();

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

    // 아래는 치지 않습니다 — 화살과 같은 규칙(CFG.aimBelow)입니다. 탑은 올라가는
    // 곳이라 지나온 층을 향해 칼을 휘두르는 것은 시간을 버리는 일입니다.
    //
    // 맨손 사거리(가장 긴 것이 159)로는 한 층 아래(165)에 닿지 않아 이 줄은
    // 아무 일도 하지 않습니다. 먼 그림자 검을 들어 사거리가 238이 됐을 때에만
    // 뜻이 생깁니다 — 늘어난 팔이 아래층까지 내려가지 않게 잡아 줍니다.
    const hit = this.enemies.getChildren().filter((e) => this.targetable(e) &&
      e.y <= this.player.y + CFG.aimBelow &&
      this.meleeDist(e) <= w.reach);
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

    // 먼 그림자 검을 들었으면 거리만큼 무뎌집니다. 코앞은 그대로, 사거리
    // 끝에서는 falloff(10%)만. 유물이 없으면 falloff 가 1이라 아래 식은
    // 거리에 상관없이 1을 돌려줍니다 — 있는 사람에게만 붙는 대가입니다.
    const far = w.farFalloff;
    const scaleAt = (e) => (far >= 1 || !w.reach ? 1 :
      Phaser.Math.Clamp(1 - (1 - far) * (this.meleeDist(e) / w.reach), far, 1));

    // 빗나간 놈은 안 걸립니다 (전사의 기절).

    hit.forEach((e) => {
      // **정확도를 적마다 굴립니다.** 한 번 굴려 전부에 적용하면, 광역
      // 한 방이 통째로 빗나가서 "가끔 아무 일도 안 일어나는" 무기가 됩니다.
      // 한 놈씩 굴리면 흑철의 낮은 정확도가 "덜 들어간다"로 고르게 퍼집니다.
      if (!w.hits()) return this.missFx(e);

      // 도적은 때리면서 주머니를 텁니다. 잡지 않아도 코인이 나옵니다.
      // 코인은 확률로 나오므로 훔치는 것도 **같은 확률**을 탑니다 — 층을 따라
      // 내려가는 것까지 같습니다 (js/enemies.js 의 coinDropChance).
      //
      // 여기를 안 맞추면 후반 물가 손질이 도적만 비켜 갑니다. 도적은 근접이라
      // 사거리 안을 한 번에 다 때리는데, 그러면 훔치는 횟수가 **마릿수에 그대로
      // 비례**합니다 — 줄이려던 바로 그 곱입니다.
      //
      // 보스는 털 수 없습니다. 몸이 커서 늘 사거리 안에 있는 데다 오래 때리는
      // 상대라, 훔치기가 되면 보스 층이 통째로 도적의 금광이 됩니다.
      if (!e.isBoss && w.stealChance > 0 && Math.random() < w.stealChance &&
          Math.random() < coinDropChance(e.floor)) {
        this.stealFx(e.x, e.y - 10);
        this.dropCoin(e.x, e.y - 10, Math.round(w.stealAmount * CFG.coin.dropBonus));
      }
      // 공격력은 적마다 새로 굴립니다. 한 번 굴려 나눠 주면 범위가 있는 뜻이
      // 반으로 줄어듭니다 — 화면에 뜨는 숫자 여럿이 늘 똑같아집니다.
      this.hitEnemy(e, Math.max(1, Math.round(w.rollDamage() * scaleAt(e))));
      this.stunEnemy(e);
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
        // 화살 한 발마다 정확도와 공격력을 따로 굴립니다. 여러 발을 쏘는
        // 활은 그래서 "몇 발은 빗나가고 몇 발은 크게 들어가는" 손맛이 됩니다.
        if (!at) return;
        if (!w.hits()) return this.missFx(at);
        this.fireArrow(this.player.x, this.player.y - 6, at, w.rollDamage(), w.bounce);
      });
    }
  }

  // 빗나갔다는 표. **적 머리 위**에 뜹니다 — 주인공 위에 띄우면 내가 회피한
  // 것처럼 보이는데, 이건 반대로 내가 놓친 것입니다.
  //
  // 옅은 회색에 작은 글자입니다. 빗나가는 일은 자주 있는데 그때마다 크게
  // 알리면 화면이 「빗나감」으로 도배됩니다.
  missFx(enemy) {
    if (!enemy || !enemy.active) return;
    this.floatText(enemy.x, enemy.y - 18, '빗나감', '#78909c', 15, 26, 420);
  }

  // ── 기절 ──────────────────────────────────────────────
  // 전사가 휘두르면 적이 **그 자리에서 잠깐 멎습니다** (CFG.stun).
  //
  // 처음에는 밀어냈습니다. 발판이 140밖에 안 되는데 절반씩 밀어내니
  // **가장자리에서 맞은 놈이 그대로 떨어져 버렸습니다.** 자리를 옮기는 것은
  // 이 게임의 좁은 발판과 안 맞습니다. 얻으려던 것은 거리가 아니라 **시간**이니,
  // 자리는 그대로 두고 시간만 뺏습니다.
  //
  // **한 번 걸린 놈은 깨어난 뒤 recoverMs 동안 다시 안 걸립니다.**
  // 이게 없으면 스턴이 아니라 전원 스위치입니다 — 공격 주기(215~315ms)가
  // 스턴(480ms)보다 짧아서, 때릴 때마다 다시 걸면 사거리 안의 적은 영영
  // 안 깨어납니다. 뺏는 것이지 없애는 것이 아니어야 합니다.
  stunEnemy(enemy) {
    const c = CFG.stun;
    const power = this.job.stun || 0;
    if (!power || !enemy.active || enemy.isBoss || enemy.isGoldFrog) return;
    const now = this.time.now;
    if (now < (enemy.stunOkAt || 0)) return;

    const ms = c.ms * power;
    enemy.stunUntil = now + ms;
    enemy.stunOkAt = now + ms + c.recoverMs;
    if (enemy.body) enemy.body.velocity.x = 0;
    this.stunFx(enemy, ms);
  }

  // 멎었다는 것이 **보여야** 합니다.
  //
  // 밀어낼 때는 자리가 바뀌니 눈에 그냥 보였는데, 자리를 안 옮기니 가만히
  // 서 있는 것과 구분이 안 됩니다. 맞을 때 나는 흰 번쩍임은 60ms 짜리라
  // 480ms 를 알려 주지 못합니다.
  //
  // 그래서 **몸을 기울입니다.** 휘청하고 기울었다가 스턴이 풀릴 즈음 천천히
  // 바로 섭니다 — 기울어져 있는 동안이 곧 못 움직이는 동안입니다.
  // 도형을 새로 만들지 않으므로 값도 거의 안 듭니다 (트윈 하나).
  stunFx(enemy, ms) {
    this.tweens.killTweensOf(enemy, 'angle');
    const lean = (Math.random() < 0.5 ? -1 : 1) * CFG.stun.lean;
    enemy.setAngle(lean);
    this.tweens.add({
      targets: enemy, angle: 0, duration: ms, ease: 'Sine.in',
      // 죽어서 사라진 뒤에 각도를 건드리면 터집니다.
      onComplete: () => { if (enemy.active) enemy.setAngle(0); },
    });
  }

  // ── 무기를 만났을 때 ──────────────────────────────────
  // **판을 멈추고 고릅니다.** 갈아타면 쌓아 둔 강화가 전부 날아가므로,
  // 지나가면서 저절로 바뀌어서는 안 되는 결정입니다.
  //
  // 상점의 무기 칸도 이 문을 지납니다 (js/shop.js 의 buy). 예전에는 상점에서만
  // 곧장 갈아탔습니다 — "값을 치르고 고르는 자리니 또 묻는 것은 같은 질문을
  // 두 번 하는 셈"이라고 여겼는데, 실제로는 **상점 쪽이 더 물어봐야 하는
  // 자리**였습니다. 필드에서는 잃는 것이 강화뿐이지만 상점에서는 코인까지
  // 함께 나가는데, 진열의 한 줄만 보고는 두 자루를 견줄 수가 없습니다.
  //
  // opts.price 가 있으면 값을 함께 적고, opts.done 은 고른 뒤에 부릅니다.
  offerWeapon(entry, opts) {
    const o = opts || {};
    if (!entry) return;
    // 이미 든 자루와 같으면 고를 것이 없습니다. 회복으로 대신합니다 —
    // 밟았는데 아무 일도 안 일어나면 밟은 사람은 버그로 읽습니다.
    if (entry.index === this.weapon.index) {
      this.hp = Math.min(this.maxHp, this.hp + CFG.heal);
      this.popup('+' + CFG.heal, '#a5d6a7');
      if (o.done) o.done(false);
      return;
    }
    this.noteWeapon(entry); // 만난 것은 그 자리에서 도감에 적힙니다
    this.swapDone = o.done || null;
    // 화면을 통째로 덮으므로 떠 있던 알림은 걷어냅니다. 안 걷으면 장면이
    // 멈춘 동안 시계도 멈춰서, 덮개 밑에 글자가 얼어붙은 채로 남습니다.
    this.clearNotices();
    this.scene.pause();
    this.scene.launch('swap', { from: this, entry, price: o.price });
  }

  // 갈아타기 창이 「바꾼다」를 누르면 여기로 돌아옵니다.
  takeWeapon(entry) {
    if (this.weapon.swapTo(entry)) {
      this.noteWeapon();
      this.rig.setWeapon(this.job, this.weapon);
      this.popup(this.weapon.name, '#ff8a65');
      this.markReach();
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

  // 따라다니는 눈이 쏘는 것 (js/trophies.js). 화살과 같은 주머니를 쓰므로
  // 맞았을 때의 처리(onBulletHit)와 유물의 튕김이 그대로 붙습니다. 다만
  // **화살이 아닙니다** — 돌지도 않고 궤적도 안 남깁니다. 눈빛이니까요.
  fireEyeBolt(x, y, target, dmg) {
    const b = this.bullets.create(x, y, 'trophy-bolt');
    b.body.setAllowGravity(false);
    b.body.setSize(10, 10);
    b.setDepth(9);
    b.isArrow = false;
    b.dmg = dmg;
    b.bounce = 0;
    b.from = target;   // 걸어다니는 적을 스쳐 지나가지 않게 조금 따라갑니다
    b.homing = false;
    b.bornAt = this.time.now;
    this.physics.velocityFromRotation(
      Phaser.Math.Angle.Between(x, y, target.x, target.y),
      CFG.trophy.eye.speed, b.body.velocity);
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
    // 한 대에 채울 수 있는 양에는 뚜껑이 있습니다 — 아래층에서는 닿지도 않는
    // 값이지만, 위층에서 한 방으로 가득 차는 것을 막는 것은 이 한 줄입니다.
    const leech = this.weapon.relicSum('lifesteal');
    if (leech > 0 && this.hp < this.maxHp) {
      const real = Math.min(before, dmg);
      // 한 대에 넣을 수 있는 몫 (몰아 받기 금지)
      const cap = Math.max(1, Math.round(this.maxHp * CFG.lifestealCap));
      const want = Math.min(cap, Math.round(real * leech));
      // **초당 주머니.** 시간이 흐르면 차고, 회복할 때마다 그만큼 빕니다.
      // 한 대마다 뚜껑을 씌우면 빠른 자루가 그 배로 회복하므로(js/config.js
      // 의 lifestealPerSec), 뚜껑을 시간에 걸어 둡니다.
      const cloaks = leech / CFG.lifestealUnit;
      const full = this.maxHp * CFG.lifestealPerSec * cloaks;   // 1초치
      const now = this.time.now;
      if (this.leechAt === undefined) this.leechAt = now;
      // 한 번에 쌓이는 것은 1초치까지입니다. 오래 안 때리다가 몰아 받는 것을
      // 막습니다 — 「싸우면서 차오른다」이지 「쉬면 채워진다」가 아닙니다.
      this.leechPool = Math.min(full, (this.leechPool || 0) + (now - this.leechAt) * full / 1000);
      this.leechAt = now;
      const gain = Math.min(want, Math.floor(this.leechPool));
      if (gain >= 1) {
        this.leechPool -= gain;
        this.hp = Math.min(this.maxHp, this.hp + gain);
      }
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

    // 황금개구리는 확률로 흘리지 않습니다 — 잡으면 무조건, 가진 만큼 그대로.
    // 낮은 확률로 나온 것을 잡았는데 또 확률에 걸려 빈손이면 실망만 남습니다.
    if (enemy.isGoldFrog) {
      this.dropCoin(enemy.x, enemy.y, enemy.coin, true);
    } else if (enemy.coin > 0 && Math.random() < coinDropChance(enemy.floor)) {
      // 모든 적이 코인을 흘리지는 않습니다. 대신 나올 때는 그만큼 더 줍니다.
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
      this.pushNotice({ key: 'resume', ms: 2300, build: () => this.showNotice([
        this.add.text(CFG.width / 2, 300, this.floorIndex + '층 상점에서 이어서',
          font(26, '#4dd0e1')).setOrigin(0.5),
        this.add.text(CFG.width / 2, 340,
          left > 0 ? '남은 이어하기 ' + left + '번' : '마지막 이어하기입니다',
          font(20, '#8794b5')).setOrigin(0.5),
        // 보스 전리품은 안 따라옵니다. 되돌아온 자리가 그 보스보다 아래라면
        // 아직 넘어서지 않은 것이니, 넘어선 값을 들고 있을 수는 없습니다.
        // 화면에 안 적으면 "눈이 사라졌다"가 버그로 읽힙니다.
        this.add.text(CFG.width / 2, 374,
          this.resume.hadTrophy ? '보스에게서 얻은 것은 두고 옵니다' : '',
          font(17, '#ff8a80')).setOrigin(0.5),
      ]) });
      return;
    }

    if (!this.boosts.length) return;
    this.pushNotice({ key: 'boosts', ms: 2300, build: () => this.showNotice([
      this.add.text(CFG.width / 2, 300, '지니고 오른 것', font(20, '#8794b5')).setOrigin(0.5),
      ...this.boostRows(340, font(26, '#ffca28')),
    ]) });
  }

  // ── 지니고 오른 것을 줄로 나눠 놓습니다 ────────────────
  //
  // 메달 상점에서 많이 사고 오면 일곱 가지가 한 줄에 섭니다. 한 줄로 두면
  // 화면 밖으로 나가고, 넘치는 만큼 줄이면(새 적 이름이 쓰는 방법) 글자가
  // 읽을 수 없게 작아집니다 — **거기는 이름 두셋이고 여기는 일곱입니다.**
  //
  // 그래서 줄을 바꿉니다. 몇 줄이 될지는 글자를 실제로 재서 정합니다:
  // 「속도 한계 ×1.30」과 「+1 ×2」는 글자 수도 폭도 다르므로, 개수로 나누면
  // 어떤 줄은 넘치고 어떤 줄은 텅 빕니다.
  boostRows(top, style) {
    const cx = CFG.width / 2;
    const room = CFG.width - 48;
    const SEP = '   ';

    // 재는 자 하나를 화면 밖에 세워 두고 글자만 갈아 끼웁니다 —
    // 항목마다 만들고 버리면 일곱 번 짓게 됩니다.
    const rule = this.add.text(-9999, -9999, '', style);
    const rows = [];
    let line = '';
    this.boosts.forEach((label) => {
      const tryLine = line ? line + SEP + label : label;
      rule.setText(tryLine);
      if (line && rule.width > room) { rows.push(line); line = label; } else line = tryLine;
    });
    if (line) rows.push(line);
    rule.destroy();

    // 줄 사이는 잰 상자 높이에서 옵니다. 한글 상자는 글꼴 크기보다 크므로
    // 26px 짜리를 26px 간격으로 쌓으면 반드시 붙습니다.
    return rows.map((text, i) => {
      const t = this.add.text(cx, top, text, style).setOrigin(0.5, 0);
      t.y = top + i * (t.height + 8);
      return t;
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
      // 상자만은 갚아 주고 끝나지 않습니다 — **일어서서 쫓아옵니다.**
      // 다른 가짜는 밟는 순간 한 번 손해를 보고 끝이지만, 이것은 밟은 뒤부터가
      // 시작입니다. 그래서 여기서 잃는 체력은 첫 한 입뿐이고, 나머지는
      // 달아나느냐 마느냐로 갈립니다.
      case SLOT.TREASURE: {
        this.popup('미믹!', '#ff5252');
        this.cameras.main.shake(220, 0.010);
        const mimic = spawnMimic(this, slot.x, slot.y - 26, this.floorIndex);
        if (mimic) this.chompFx(mimic.x, mimic.y);
        else this.springTrap(t.mimicTreasure, '가짜 상자!'); // 자리가 없으면 옛 방식대로
        return;
      }
      default:
        this.springTrap(t.mimicHeal, '가짜!');
        return;
    }
    this.cameras.main.shake(120, 0.006);
  }

  // 무기를 손에 넣거나 만날 때마다 부릅니다. **도감에 「만났다」고 적습니다**
  // (js/scene-weaponbook.js). 다음 판에 들고 오를 수 있는 것은 여기 적힌 것뿐입니다.
  //
  // 갈아타지 않아도 적습니다 — 창이 떴다는 것은 그 자루를 만났다는 뜻이고,
  // 그때 그냥 두기로 한 것이 다음 판에 그것을 못 쓸 이유는 아닙니다.
  noteWeapon(entry) {
    const w = entry || this.weapon;
    Save.findWeapon(this.job.key, w.index);
  }

  // 지도에 떨어진 메달. 상점에서 받는 것과 값은 같지만 만나는 일이 거의 없어서,
  // 만났을 때만은 유물처럼 크게 알려 줍니다.
  announceMedal() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    this.pushNotice({ key: 'medal', ms: 2300, build: () => this.showNotice([
      this.add.text(CFG.width / 2, 300, '메달을 주웠습니다', font(20, '#8794b5')).setOrigin(0.5),
      this.add.text(CFG.width / 2, 340, '🏅 +1', font(44, '#ffca28')).setOrigin(0.5),
      this.add.text(CFG.width / 2, 386, '죽어도 남습니다', font(20, '#ffe082')).setOrigin(0.5),
    ]) });
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
    this.clearNotices(); // 덮개 밑에 알림이 남지 않게

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

  // ── 보물상자 ──────────────────────────────────────────
  // 아주 낮은 확률로 유물이 들어 있습니다. 이미 유물이 꽉 찼으면 굴리지
  // 않습니다 — 무엇을 버릴지 고르게 하면서까지 상자를 열 이유는 없습니다.
  openTreasure(slot) {
    const canHoldRelic = this.weapon.relics.length < CFG.relic.maxHeld;
    const relic = canHoldRelic && Math.random() < CFG.treasure.relicChance
      ? rollRelicChoices(this.job.key, this.weapon.relics, 1)[0]
      : null;

    if (relic) {
      this.takeRelic(relic);
      this.treasureFx(slot.x, slot.y, true);
      return;
    }

    const key = rollChestLoot(this);
    this.popup(SHOP_ITEMS[key].title, '#ffd54f');
    this.treasureFx(slot.x, slot.y, false);
    // 상자에서 자루가 나왔으면 그것도 견주어 보고 고릅니다 (값은 없습니다).
    // 이펙트를 먼저 터뜨리고 창을 띄웁니다 — 창이 뜨면 판이 멈춰서 그동안
    // 이펙트가 얼어붙는데, 창을 닫는 순간 남은 몫이 마저 흘러갑니다.
    if (key === 'upgrade') return this.offerWeapon(this.shopWeapon);
    applyShopEffect(this, key);
    this.hud.update();
  }

  // 화면을 가득 채우는 화려한 이펙트. 유물이 들어 있었으면 황금빛입니다 —
  // 무엇을 열었는지가 이펙트 색만 보고도 짐작이 가야 합니다.
  treasureFx(x, y, golden) {
    const tint = golden ? 0xffd54f : 0xffe0b2;

    const flash = this.add.rectangle(CFG.width / 2, CFG.height / 2, CFG.width, CFG.height, tint, 0.55)
      .setScrollFactor(0).setDepth(190);
    this.tweens.add({ targets: flash, alpha: 0, duration: golden ? 620 : 420,
      onComplete: () => flash.destroy() });

    this.cameras.main.shake(golden ? 260 : 160, golden ? 0.012 : 0.008);

    const n = golden ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const dist = 60 + Math.random() * (golden ? 140 : 90);
      const spark = this.add.sprite(x, y, 'spark').setDepth(191).setTint(tint);
      this.tweens.add({
        targets: spark, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist,
        scale: golden ? 3 : 2, alpha: 0, duration: 500 + Math.random() * 300,
        onComplete: () => spark.destroy(),
      });
    }

    [0, 120].forEach((delay) => {
      this.time.delayedCall(delay, () => {
        const ring = this.add.circle(x, y, 10, tint, 0).setStrokeStyle(3, tint, 0.8).setDepth(191);
        this.tweens.add({
          targets: ring, radius: golden ? 160 : 100, alpha: 0, duration: 500,
          onUpdate: () => ring.setRadius(ring.radius),
          onComplete: () => ring.destroy(),
        });
      });
    });
  }

  onEnemyTouch(player, enemy) {
    if (this.dead) return;

    // 도둑 박쥐는 때리는 대신 채 갑니다.
    if (enemy.isBat && enemy.batKind === 'thief' && !enemy.fleeing) return this.batStealsCoins(enemy);

    // 미믹은 무적 시간을 타지 않고 제 박자로 씹습니다. 한 입이 작은 대신
    // 붙어 있는 동안 계속 들어가야 "물어뜯긴다"가 됩니다.
    //
    // 물려도 무적 시간은 새로 걸지 않습니다. 걸어 버리면 미믹에게 씹히는
    // 동안 다른 적의 공격이 전부 막혀서, **쫓아오는 놈이 방패가 됩니다.**
    if (enemy.isMimic) return this.mimicBite(enemy);

    if (this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    if (!enemy.contactDamage) return;
    this.hurt(enemy.contactDamage, enemy);
    // 무는 박쥐는 한 입 물고 달아납니다. 계속 붙어 다니면 그냥 적입니다.
    if (enemy.isBat) this.batFlees(enemy);
  }

  // 한 입. 무적 시간을 건드리지 않으므로 앞뒤로 값을 그대로 돌려놓습니다
  // (함정의 `lastHitAt = -9999`과 같은 수법입니다 — 여기서는 반대로,
  //  때린 뒤에 무적을 얻지 않게 하려는 것입니다).
  mimicBite(mimic) {
    if (this.time.now < mimic.nextBiteAt) return;
    mimic.nextBiteAt = this.time.now + CFG.mimic.biteEvery;

    const before = this.lastHitAt;
    this.lastHitAt = -9999;
    this.hurt(mimic.contactDamage, mimic);
    if (!this.dead) this.lastHitAt = before;

    this.chompFx(this.player.x, this.player.y);
  }

  // 씹는 표. 이빨 두 줄이 위아래에서 맞물립니다 — 짧고, 하얗고, 날카롭게.
  // 그림 없이 도형으로 내는 몇 안 되는 것 중 하나인데, 이건 "이빨"이라기보다
  // **물린 자국**이라서 세모 몇 개로도 거짓말이 되지 않습니다.
  chompFx(x, y) {
    const teeth = [];
    for (let i = 0; i < 4; i++) {
      const dx = -18 + i * 12;
      teeth.push(this.add.triangle(x + dx, y - 16, 0, 0, 10, 0, 5, 13, 0xffffff)
        .setDepth(14).setAlpha(0.95));
      teeth.push(this.add.triangle(x + dx + 6, y + 16, 0, 13, 10, 13, 5, 0, 0xffffff)
        .setDepth(14).setAlpha(0.95));
    }
    // 위아래가 가운데에서 맞물리며 사라집니다.
    teeth.forEach((t, i) => {
      this.tweens.add({
        targets: t, y: t.y + (i % 2 ? -14 : 14), alpha: 0,
        duration: CFG.mimic.chompMs, ease: 'Quad.in',
        onComplete: () => t.destroy(),
      });
    });
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

  // 그 놈을 막는 물건이 있고 아직 남았으면 한 번 씁니다.
  //
  // **쓰면 그 자리에서 보여야 합니다.** 안 보이면 「막았다」가 아니라 「안
  // 맞았다」로 읽혀서, 값을 치르고 산 물건이 아무 일도 안 한 것처럼 보입니다.
  wardBlocks(def) {
    if (!def || !isFoeType(def)) return false;
    const left = this.wards[def.key] || 0;
    if (left <= 0) return false;
    this.wards[def.key] = left - 1;
    const w = CFG.foes.ward.of[def.key];
    this.popup((w ? w.name : '막음') + ' ' + (left - 1), '#a5d6a7');
    return true;
  }

  hurt(amount, source, fromBoss) {
    // 그림자에게 삼켜지는 중에는 다른 피해가 끼어들 이유가 없습니다.
    if (this.dead || this.swallowing) return;
    // 도적은 일정 확률로 통째로 흘려 넘깁니다.
    // 다만 보스가 내리꽂는 것에는 덜 통합니다 — 안 그러면 피하지 않아도
    // 절반 넘게 흘러가서, 줄을 고르는 그 싸움을 도적만 안 하게 됩니다.
    //
    // **판을 바꾸는 넷도 같습니다** (CFG.foes.dodgeScale). 피할 자리를 보고
    // 정하는 것이 그 넷의 전부인데, 확률로 절반이 그냥 흘러가면 도적만 그
    // 판단을 안 하게 됩니다. 어려움을 확률로 지우면 어려움이 아니라 운입니다.
    // 막는 물건이 먼저입니다 — 방어력도 회피도 지나기 전에 통째로 없앱니다.
    if (!fromBoss && source && this.wardBlocks(source.def)) return;
    const foeHit = !fromBoss && source && source.def && isFoeType(source.def);
    const dodge = fromBoss ? this.dodge * CFG.boss.dodgeScale
      : foeHit ? this.dodge * ((CFG.foes && CFG.foes.dodgeScale) || 1)
        : this.dodge;
    if (dodge > 0 && Math.random() < dodge) {
      this.lastHitAt = this.time.now;
      this.popup('회피', '#ce93d8');
      return;
    }

    this.lastHitAt = this.time.now;

    // ── 갈라진 가면 — 한 대를 통째로 막습니다 ───────────
    // **방어력보다 먼저 봅니다.** 나중에 보면 방어력이 깎은 뒤의 몫만 막게
    // 되어, 두꺼운 갑옷을 입은 사람에게는 가면이 거의 아무것도 안 하게
    // 됩니다. 가면은 "덜 맞는 것"이 아니라 "그 한 대가 없던 일이 되는 것"입니다.
    //
    // 회피 뒤에 두는 것은 맞습니다 — 흘려 넘긴 대는 애초에 가면이 나설 일이
    // 없고, 나서면 공짜로 얻은 회피에 가면을 하나 버리는 셈이 됩니다.
    if (this.trophies.blockWithMask()) return;

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
    this.flashHurt();

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
    this.flashHurt(0.35, 110, 6);
  }

  // ── 맞았을 때의 깜빡임 ────────────────────────────────
  // **트윈을 하나만 돌립니다.** 겹치면 주인공이 영영 반투명해집니다.
  //
  // 트윈은 시작할 때의 알파를 기억했다가 yoyo 로 거기까지 되돌아옵니다.
  // 그래서 깜빡이는 도중에 또 맞으면, 새 트윈이 **지금의 흐릿한 알파**를
  // 시작값으로 잡고 그 값으로 되돌아갑니다. 1로는 영영 안 돌아옵니다.
  // 한 대 맞을 때마다 조금씩 더 투명해진 채로 굳습니다.
  //
  // 무적 시간(1100ms)이 깜빡임(720ms)보다 길어서 보통은 안 겹칩니다. 그런데
  // **함정은 무적을 무시합니다** (springTrap 이 lastHitAt 을 지웁니다) —
  // 함정은 101층부터 나오고 위로 갈수록 흔해지므로, 오를수록 흐려졌습니다.
  //
  // killTweensOf(player) 로 쓸어버리면 안 됩니다. 도적이 뛰며 도는 회전과
  // 투기장의 좌우 이동도 같은 대상에 걸려 있어서, 같이 죽으면 주인공이
  // 돌다 만 채로 굳거나 줄을 옮기다 멈춥니다. 이 트윈 하나만 붙들어 둡니다.
  // **주인공이 아니라 딴 것을 흔듭니다.** 값 하나짜리 그릇(hurtFlash)을 두고,
  // 그것을 흔들면서 그 값을 주인공의 알파에 옮겨 적습니다.
  //
  // 이 우회가 필요한 까닭: 앞선 깜빡임을 걷어내야 하는데,
  //   · 트윈 손잡이를 들고 stop() 하는 길은 어긋났습니다. stop() 이 그 트윈의
  //     onComplete 를 불러 버려서, **방금 새로 만든 손잡이를 지웁니다.**
  //     그러면 다음 대에는 걷어낼 것을 못 찾고 둘이 겹칩니다
  //   · killTweensOf(player) 로 쓸어버리는 길도 안 됩니다. 도적이 뛰며 도는
  //     회전과 투기장의 좌우 이동이 같은 대상에 걸려 있어서, 같이 죽으면
  //     주인공이 돌다 만 채로 굳거나 줄을 옮기다 멈춥니다
  //
  // 그릇을 따로 두면 **거기 걸린 것은 깜빡임뿐**이라 통째로 쓸어도 안전합니다.
  flashHurt(low = 0.3, duration = 90, repeat = 3) {
    const box = this.hurtFlash || (this.hurtFlash = { a: 1 });
    this.tweens.killTweensOf(box);
    box.a = 1;
    this.player.setAlpha(1);
    this.tweens.add({
      targets: box, a: low, duration, yoyo: true, repeat,
      onUpdate: () => { if (!this.dead && !this.swallowing) this.player.setAlpha(box.a); },
      onComplete: () => { box.a = 1; if (!this.dead && !this.swallowing) this.player.setAlpha(1); },
    });
  }

  // 깜빡임을 걷고 알파를 되돌립니다. 판이 끝나는 자리에서 부릅니다 —
  // 그냥 두면 사라지는 연출 위로 깜빡임이 끼어들어 알파를 도로 1로 올립니다.
  clearHurtFlash() {
    if (!this.hurtFlash) return;
    this.tweens.killTweensOf(this.hurtFlash);
    this.hurtFlash.a = 1;
    this.player.setAlpha(1); // 걷었으면 되돌려 놓아야 합니다. 반쯤 흐린 채로 굳지 않게
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
  // ── 메달은 100층마다 하나 ──────────────────────────────
  //
  // **버는 길은 오르는 것 하나뿐입니다.** 예전에는 상점에 닿을 때마다 줬는데
  // (50층 하나 · 100층 둘) 메달 상점이 영구 해금으로 바뀌면서 값이 달라졌습니다 —
  // 한 직업을 다 여는 데 스물여섯인데 400층 한 판에 여섯이 들어오면 며칠 만에
  // 다 열리고, 그러면 죽어도 또 켤 이유가 없어집니다.
  //
  // **띠로 셉니다** (층 ÷ 100). 층 번호를 그대로 보고 「100의 배수면 준다」로
  // 하면 이어서 진행하기로 100층에 되돌아왔을 때 또 받습니다. 이번 판에서
  // 가장 깊이 지난 띠를 기억해 두면 되돌아와도 다시 안 줍니다.
  checkMedalFloor() {
    const band = Math.floor(this.floorIndex / CFG.medal.per);
    if (band <= this.medalBand) return;
    this.medalBand = band;
    this.medals += CFG.medal.amount;
    this.popup('🏅 +' + CFG.medal.amount, '#ffca28');
  }

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
    this.gateUntil = this.time.now + 2400; // 글자가 다 사라질 때까지 다음 규칙을 막습니다
    this.pushNotice({ key: 'gate', ms: 2400, build: () => this.showNotice(
      gate.lines.map((line, i) =>
        this.add.text(CFG.width / 2, 296 + i * 36,
          line, font(i === gate.lines.length - 1 ? 19 : 26,
            i === gate.lines.length - 1 ? '#8794b5' : gate.color)).setOrigin(0.5))) });
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

  // ── 떠오르는 글자 ────────────────────────────────────
  // 맞을 때마다, 코인을 주울 때마다, 회피할 때마다 한 장씩 떠올랐다 사라집니다.
  // 판에서 가장 자주 만들어지는 물건입니다.
  //
  // 예전에는 부를 때마다 Text 를 새로 만들고 끝나면 버렸습니다. 재 보니
  // **`popupHit` 한 번이 1.65ms** — 60fps 한 프레임 예산(16.7ms)의 10%를
  // 한 함수가 씁니다. 맞을 때마다 화면이 한 번씩 걸렸다는 뜻입니다.
  // Phaser 의 Text 는 만들 때 캔버스를 잡고, 글꼴을 재고, 그려서, GPU 로
  // 올립니다. 그 넷을 한 대 맞을 때마다 두 번씩 했습니다.
  //
  //   새로 만들고 버리기      307µs
  //   있는 것에 다시 쓰기      34µs   ← 아홉 배
  //
  // 그래서 다 쓴 것을 버리지 않고 모아 두었다가 돌려 씁니다. 화면에 한꺼번에
  // 떠 있는 수는 얼마 안 되므로 곧 안 늘어납니다.
  //
  // **주머니를 글자 크기별로 나눕니다.** `setFontSize` 는 글꼴을 다시 재게
  // 만들어서, 크기까지 바꿔 가며 돌려 쓰면 34µs 가 91µs 로 뜁니다. 크기가
  // 같은 것끼리만 돌려 쓰면 그 일이 아예 안 일어납니다.
  floatText(x, y, text, color, size, rise, ms) {
    const pools = this.textPool || (this.textPool = {});
    const pool = pools[size] || (pools[size] = []);

    let t = pool.pop();
    if (t) {
      // 색은 달라졌을 때만 — `setColor` 는 같은 색을 넣어도 다시 그립니다.
      if (t.style.color !== color) t.setColor(color);
      t.setText(text).setAlpha(1).setActive(true).setVisible(true);
    } else {
      t = this.add.text(0, 0, text, {
        fontFamily: 'sans-serif', fontSize: size + 'px', color,
      }).setOrigin(0.5).setDepth(120);
      // 자리 시험(verify-layout.js)에게 "이건 흘러가는 글자"라고 알려 둡니다.
      // 두 대를 잇달아 빗맞으면 「빗나감」 둘이 스치는데, 그건 자리를 잘못
      // 잡은 것이 아니라 그 순간에 두 번 일어난 일입니다.
      t.name = 'float';
    }
    t.setPosition(x, y);

    this.tweens.add({
      targets: t, y: y - rise, alpha: 0, duration: ms,
      // 버리는 대신 주머니에 돌려놓습니다. 안 보이게 꺼 두어야 다음에
      // 쓸 때까지 그리기 목록에서 빠집니다.
      onComplete: () => { t.setActive(false).setVisible(false); pool.push(t); },
    });
    return t;
  }

  popupHit(taken, blocked, worn) {
    this.popup('-' + taken, '#ff8a80');
    if (blocked <= 0) return;

    // 막은 값과 그 대가로 갈린 갑옷을 한 줄에 같이 보여 줍니다.
    // 막았다는 것만 보이고 닳는 것이 안 보이면, 방어력이 왜 줄어드는지 알 수 없습니다.
    const label = '방어 ' + blocked + ' 막음' + (worn ? '   갑옷 -' + worn + '%' : '');
    this.floatText(this.player.x, this.player.y - 22, label,
      worn ? '#ffab91' : '#b0bec5', 19, 42, 800);
  }

  popup(text, color) {
    this.floatText(this.player.x, this.player.y - 50, text, color, 26, 60, 700);
  }

  // opts.noResume — **스스로 그만둔 판**입니다 (일시정지 화면의 「게임 포기하기」).
  // 그만두겠다고 해 놓고 「상점에서 이어서」가 그대로 떠 있으면 그 단추가 곧
  // 그만두기를 없던 일로 만듭니다. 고른 것이 바로 뒤집히는 화면은 고른 것이
  // 아닙니다. 번 메달은 그대로 받습니다 — 그만둔 값은 판을 잃는 것이지
  // 여태 모은 것을 잃는 것이 아닙니다.
  gameOver(reason, opts) {
    if (this.dead) return;
    this.dead = true;
    this.noResume = !!(opts && opts.noResume);
    this.hp = 0;
    this.clearNotices(); // 죽음 화면 위에 알림이 떠 있으면 결과가 안 읽힙니다
    // 판을 넘어 남는 기록. 직업 해금이 여기에 기댑니다.
    const wasBest = Save.bestFloor;
    const opened = classesUnlockedBy(this.floorIndex, this.totalCoins);
    opened.forEach((job) => Save.unlock(job.key));
    // 이번에 열린 사람들은 **고르기가 끝난 뒤** 한 컷씩 만납니다
    // (아래 leaveDeath). 여기서 바로 띄우면 방금 끝난 판의 결과를 읽던
    // 사람을 끊어 놓습니다.
    this.justOpened = opened.map((job) => job.key);
    Save.finishRun(this.floorIndex, this.totalCoins);
    // 죽을 때 들고 있던 자루의 상태를 도감에 남깁니다.
    this.weapon.record();
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
    // 왜 끝났는지는 **맨 위**에 놓습니다. 164 에 두었더니 66px 짜리 층수
    // 글자(190 에 서므로 상자가 152부터입니다) 위로 그대로 겹쳤습니다 —
    // 여태 아무도 reason 을 안 넘겨서 한 번도 안 그려 본 줄이었습니다.
    if (reason) add(this.add.text(cx, 104, reason, font(14, '#b39ddb')).setOrigin(0.5));

    // 여기부터는 **줄이 있을 때만 자리를 씁니다.** 유물 줄은 유물을 하나도
    // 안 들고 죽으면 안 나오는데, 예전에는 아랫줄이 268·278 로 못 박혀 있어서
    // 유물을 들고 죽은 판에서만 「최고 기록」과 12px 겹쳤습니다.
    let y = 268;

    // 들고 있던 유물. 어떤 조합으로 여기까지 왔는지가 다음 판의 계획이 됩니다.
    if (this.weapon.relics.length) {
      add(this.add.text(cx, y,
        this.weapon.relics.map((r) => r.icon + ' ' + r.name).join('   '),
        font(17, '#ffd54f')).setOrigin(0.5));
      y += 32;
    }

    // 최고 기록과 다음 해금까지 남은 거리를 같이 보여 줍니다.
    // 죽을 때마다 "얼마나 왔는지"가 보여야 한 판 더 하게 됩니다.
    add(this.add.text(cx, y,
      this.floorIndex > wasBest ? '최고 기록 경신!' : '최고 기록 ' + Save.bestFloor + '층',
      font(22, this.floorIndex > wasBest ? '#ffd54f' : '#8794b5')).setOrigin(0.5));
    y += 34;

    // 해금은 한 판 안에서 층과 코인을 함께 채워야 합니다. 이번 판이 어디까지 왔는지
    // 두 조건을 나란히 보여 줘야 "무엇이 모자랐는지"를 압니다.
    if (opened.length) {
      add(this.add.text(cx, y + 8, opened.map((j) => j.name).join(' · ') + ' 해금!',
        font(26, '#a5d6a7')).setOrigin(0.5));
    } else {
      const next = CLASSES.find((c) => (c.unlockFloor || c.unlockCoins) && !Save.data.unlocked[c.key]);
      if (next) {
        add(this.add.text(cx, y,
          next.name + ' 해금  ' + next.unlockFloor + '층 · 코인 ' + next.unlockCoins,
          font(18, '#8794b5')).setOrigin(0.5));
        add(this.add.text(cx, y + 24, '이번 판  ' + this.floorIndex + '층 · 코인 ' + this.totalCoins,
          font(18, this.floorIndex >= next.unlockFloor || this.totalCoins >= next.unlockCoins
            ? '#ffd54f' : '#4a5578')).setOrigin(0.5));
      }
    }

    this.buildDeathChoices(add, font, cx);
  }

  // ── 죽고 나서 무엇을 가져갈까 ─────────────────────────
  // **둘 중 하나입니다.** 메달을 받지 않으면 이번 판에 번 메달은 사라지므로,
  // 「이어서 진행」에는 그만큼의 값이 붙습니다 — 거기서 고민이 생깁니다.
  // 잃는 것은 버튼에 그대로 적어 둡니다. 모르고 눌러서 잃으면 그건 함정입니다.
  //
  // 예전에는 셋이었습니다. 가운데가 **무기 계승** — 직전 판에서 두 번째로
  // 얻은 자루를 메달을 버리고 한 번 더 쓰는 것이었습니다. 그 자리는 이제
  // **무기 도감**이 대신합니다 (js/scene-weaponbook.js). 판을 시작하기 전에
  // 만나 본 자루 중에서 고르는 편이 훨씬 낫습니다 — 무엇을 들고 오를지가
  // 죽은 판의 운이 아니라 **모아 온 것 전부**에서 나오고, 값으로 메달을
  // 버릴 이유도 없습니다.
  //
  // 죽음 화면을 떠나는 유일한 문. 이번 판에 누군가가 열렸으면 그 만남을
  // 먼저 보여 주고, 끝나면 원래 가려던 곳으로 이어 줍니다 (js/scene-meet.js).
  leaveDeath(key, data) {
    if (this.justOpened && this.justOpened.length) {
      const jobs = this.justOpened;
      this.justOpened = [];
      return this.scene.start('meet', { jobs, next: { key, data } });
    }
    this.scene.start(key, data);
  }

  buildDeathChoices(add, font, cx) {
    const earned = this.medals;
    const cost = earned ? '이번 판 메달 ' + earned + '개를 버립니다' : '이번 판에 번 메달은 없습니다';

    // 이어서 진행하기 — 상점에 한 번은 닿아야 하고, 판마다 두 번까지입니다.
    const left = CFG.continues.max - this.continues;
    const canResume = !!this.resumePoint && left > 0 && !this.noResume;
    const resumeTitle = this.noResume
      ? '이어서 진행할 수 없음'
      : this.resumePoint
        ? this.resumePoint.floor + '층 상점에서 이어서'
        : '이어서 진행할 자리 없음';
    // 전리품도 값에 넣어 적습니다. 되돌아가는 자리가 그 보스보다 아래라
    // 안 따라오는데, 버튼에 안 적으면 모르고 눌러서 잃게 됩니다.
    const loses = [cost];
    if (this.trophies.count) loses.push('보스 전리품 ' + this.trophies.count + '개');
    const resumeSub = this.noResume
      ? '스스로 그만둔 판입니다'
      : !this.resumePoint
        ? '상점에 한 번은 닿아야 합니다'
        : left <= 0
          ? '이어서 진행은 한 판에 ' + CFG.continues.max + '번까지입니다'
          : loses.join(' · ') + '   ·   남은 횟수 ' + left + '번';

    add(this.add.text(cx, 470, '무엇을 가져갈까', font(24, '#ffffff')).setOrigin(0.5));

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
      choice(570, 0xffca28, '🏅 메달 ' + earned + '개 받기',
        '메달 상점으로 갑니다  (가진 메달 ' + Save.medals + ')', true, () => {
          Save.addMedals(earned);
          this.leaveDeath('medal', { jobKey: this.job.key, earned });
        }),

      // 2 — 마지막으로 들른 상점을 나서던 자리로. 무기도 유물도 코인도 그대로입니다.
      //     값은 이번 판에 번 메달 전부, 그리고 판마다 두 번뿐이라는 것.
      choice(710, 0x4dd0e1, resumeTitle, resumeSub, canResume, () => {
        this.leaveDeath('game', {
          jobKey: this.job.key,
          // hadTrophy 는 되살릴 값이 아니라 **알려 줄 값**입니다. 전리품은
          // 안 따라오는데, 들고 있던 사람에게 말없이 없애면 버그로 읽힙니다.
          resume: { ...this.resumePoint, continues: this.continues + 1,
            hadTrophy: this.trophies.count > 0 },
        });
      }),
    ];
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

    // 한가운데 알림은 여기서만 풉니다 — 덮개가 걷힌 판 위에서만 뜹니다.
    this.pumpNotices();

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
    // 손에 든 무기도 여기서 맞춰 둡니다 — 무기가 그대로면 아무 일도 안 합니다.
    this.rig.setWeapon(this.job, this.weapon);
    this.rig.sync();

    this.trophies.update(time);
    this.updateBats(time);
    this.updateIdle(delta);

    // 무작위 등장 — 높이 올라갈수록 간격이 짧아집니다.
    // 투기장에서는 보스가 직접 졸개를 부르므로 여기서는 쉽니다.
    if (!this.bossFight && this.floorIndex >= CFG.ambient.startFloor && time > this.ambientAt) {
      this.spawnAmbient();
      const delay = Math.max(CFG.ambient.minDelay, CFG.ambient.baseDelay - this.floorIndex * CFG.ambient.delayPerFloor);
      this.ambientAt = time + delay;
    }
  }

  // ── 너무 오래 멈춰 있으면 ─────────────────────────────
  // 위로 오르지 않고 한 자리에 눌러앉아 몰려오는 적만 잡아 코인을 버는 것을
  // 막습니다 (js/config.js 의 CFG.idle). jump()가 층을 옮길 때마다 idleMs를
  // 0으로 되돌리므로, 여기서 세는 것은 순수하게 "가만히 있는 시간"입니다.
  //
  // 상점·유물 고르기·일시정지 중에는 update() 자체가 안 돌아서 자동으로
  // 빠집니다 (상점/고르기는 위쪽의 이른 return, 일시정지는 scene.pause()).
  // 보스전만은 update()가 계속 도니 따로 걸러 줍니다 — 이미 다른 압박(보스의
  // 공격)이 있는 자리라 여기서까지 값을 매길 이유가 없습니다.
  updateIdle(delta) {
    if (this.bossFight) { this.idleMs = 0; this.idleWarned = false; this.clearShadowPool(); return; }

    const c = CFG.idle;
    this.idleMs += delta;

    if (!this.idleWarned && this.idleMs >= c.warnMs) {
      this.idleWarned = true;
      this.warnShadow();
    }

    if (this.shadowPool) {
      const t = Phaser.Math.Clamp((this.idleMs - c.warnMs) / (c.killMs - c.warnMs), 0, 1);
      this.shadowPool.setPosition(this.player.x, this.player.y + 20);
      this.shadowPool.setRadius(6 + t * 46);
      this.shadowPool.setAlpha(0.3 + t * 0.4);
    }

    if (this.idleMs >= c.killMs) this.swallowPlayer();
  }

  // 그림자가 올라오기 전의 경고. 바닥에 옅은 검은 웅덩이도 함께 남겨서,
  // 문구가 사라진 뒤에도 "여기서 자라고 있다"가 눈에 보이게 합니다.
  warnShadow() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const parts = [
      this.add.text(cx, 300, '너무 오래 멈춰 있습니다', font(22, '#b39ddb')).setOrigin(0.5),
      this.add.text(cx, 336, '발밑에서 그림자가 올라옵니다', font(18, '#8794b5')).setOrigin(0.5),
    ];
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1400,
        onComplete: () => t.destroy() });
    });
    this.shadowPool = this.add.circle(this.player.x, this.player.y + 20, 2, 0x000000, 0.5).setDepth(7);
  }

  clearShadowPool() {
    if (this.shadowPool) { this.shadowPool.destroy(); this.shadowPool = null; }
  }

  // 검은 그림자가 캐릭터를 삼킵니다. 방어력도 부적도 소용없습니다 — 자리를
  // 지키고 버티는 것 자체가 값을 치르는 규칙이라, 빠져나갈 구멍을 두면 안 됩니다.
  swallowPlayer() {
    if (this.swallowing || this.dead) return;
    this.swallowing = true;
    this.clearShadowPool();
    this.clearHurtFlash(); // 깜빡임이 남아 있으면 사라지는 도중에 알파를 되돌립니다
    this.physics.pause();
    this.cameras.main.shake(500, 0.01);

    const px = this.player.x, py = this.player.y;
    for (let i = 0; i < 6; i++) {
      const t = this.add.rectangle(
        px + Phaser.Math.Between(-24, 24), py + 20, 6, 4, 0x000000, 0.7).setDepth(9);
      this.tweens.add({
        targets: t, y: py - 30 - Math.random() * 20, scaleY: 8, alpha: 0,
        duration: 700, delay: i * 60, ease: 'Quad.in',
      });
    }

    const cover = this.add.circle(px, py, 4, 0x000000, 0.92).setDepth(195);
    this.tweens.add({ targets: [this.player], alpha: 0, duration: 750, ease: 'Quad.in' });
    this.tweens.add({
      targets: cover, radius: CFG.width, duration: 750, ease: 'Quad.in',
      onUpdate: () => cover.setRadius(cover.radius),
      onComplete: () => this.gameOver('그림자에게 삼켜졌습니다'),
    });
  }
}
