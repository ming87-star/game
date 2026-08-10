const STAND_OFFSET = CFG.platformH / 2 + 24; // 발판 위에 발이 닿는 높이

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  init(data) {
    this.job = classByKey((data && data.jobKey) || Save.data.lastJob || 'warrior');
    Save.setJob(this.job.key);
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
    this.coins = 0;
    this.totalCoins = 0;
    this.kills = 0;
    this.medals = 0; // 이번 판에 번 메달. 죽을 때 받을지 말지 고릅니다.

    // 메달 상점에서 사 둔 것과 계승해 온 무기를 여기서 한 번에 바릅니다.
    // 꺼내면 사라집니다 — 전부 이번 판에만 붙는 것들입니다.
    this.boosts = applyBoosts(this, Save.takeBoosts());

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
    this.batsWarned = false;

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

    this.drawBackground();
    for (let i = 0; i <= 7; i++) this.addFloor(i);

    const start = this.floors.get(0).slots.mid;
    this.player = this.physics.add.sprite(start.x, start.y - STAND_OFFSET, 'player-' + this.job.key);
    this.player.setDepth(10);
    this.player.body.setSize(26, 40).setOffset(6, 6);
    this.player.body.setAllowGravity(false);

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

  // ── 배경 ──────────────────────────────────────────────
  drawBackground() {
    this.cameras.main.setBackgroundColor('#141a2e');
    // 탑 안쪽 벽. 화면에 고정해서 아무리 올라가도 끊기지 않게 합니다.
    this.add.rectangle(CFG.width / 2, CFG.height / 2, 500, CFG.height, 0x1d2542)
      .setScrollFactor(0).setDepth(-5);
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

      slot.deck = [
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
  // 나중에 아이템 그림이 나오면 이 함수만 바꾸면 됩니다.
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

    const badge = this.add.container(slot.x, slot.y - 38, [
      this.add.circle(0, 0, 18, mark.color),
      this.add.text(0, 0, mark.label, {
        fontFamily: 'sans-serif', fontSize: '20px', color: mark.text,
      }).setOrigin(0.5),
    ]).setDepth(5);

    // 흔들리는 폭과 주기가 유일한 표입니다. 겉모습을 똑같이 두면 아이템을 집는
    // 일이 그냥 도박이 되고, 아예 다르게 두면 함정이 뜻을 잃습니다.
    // 알아채려면 눈여겨봐야 하지만, 알고 나면 보입니다.
    const fake = slot.kind === SLOT.MIMIC;
    const t = CFG.trap;
    this.tweens.add({
      targets: badge,
      y: badge.y - 12 * (fake ? t.bobScale : 1),
      duration: 900 * (fake ? t.bobSlower : 1),
      yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    return badge;
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
      this.add.text(cx, 348, '탑의 수문장', font(50, '#ffffff')).setOrigin(0.5),
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
    this.batsWarned = false;
    this.cameras.main.shake(300, 0.01);
  }

  land(slot) {
    if (!slot.taken && !slot.expired) {
      slot.taken = true;
      switch (slot.kind) {
        case SLOT.PLUS:
          this.weapon.addPlus();
          this.popup('공격력 +1', '#ffd54f');
          break;
        case SLOT.RELIC:
          // 자동으로 붙지 않습니다. 판이 멈추고 세 장 중 하나를 고릅니다.
          this.openRelicChoice();
          break;
        case SLOT.ARMOR:
          this.armor = Math.min(CFG.armor.max, this.armor + CFG.armor.perItem);
          this.popup('방어 ' + Math.round(this.armor) + '%', '#b0bec5');
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
          if (this.weapon.upgrade()) this.popup(this.weapon.name, '#ff8a65');
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
    for (let i = 1; i <= CFG.item.armWithin; i++) {
      const floor = this.floors.get(this.floorIndex + i);
      if (!floor) continue;
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || slot.armed || !ITEM_KINDS.has(slot.kind)) continue;
        slot.armed = true;
        slot.armedAt = now;
      }
    }
  }

  updateItems(now) {
    this.floors.forEach((floor) => {
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (!slot || !slot.view || !slot.armed || slot.taken || slot.expired) continue;
        if (!ITEM_KINDS.has(slot.kind)) continue;

        const age = now - slot.armedAt;
        if (age >= CFG.item.life) {
          slot.expired = true;
          slot.view.destroy();
          slot.view = null;
          continue;
        }
        if (age >= CFG.item.blinkAt) {
          // 사라질 때가 가까울수록 빠르게 깜빡입니다.
          const period = CFG.item.life - age < 1400 ? 80 : 170;
          // 0.2까지 낮추면 글자가 안 보여 정체불명의 덩어리처럼 보입니다.
          slot.view.setAlpha(Math.floor(age / period) % 2 ? 0.35 : 1);
        }
      }
    });
  }

  // ── 상점 ──────────────────────────────────────────────
  enterShop() {
    // 상점에 닿았으니 박쥐 시계를 되돌립니다. 이게 서두를 이유입니다.
    this.lastShopAt = this.time.now;
    this.batsWarned = false;
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
    for (let i = 1; i <= CFG.item.armWithin; i++) {
      const floor = this.floors.get(this.floorIndex + i);
      if (!floor) continue;
      for (const lane of LANES) {
        const slot = floor.slots[lane];
        if (slot && !slot.expired && slot.view) { slot.armed = false; slot.view.setAlpha(1); }
      }
    }
    this.armItems();
  }

  // ── 자동 공격 ─────────────────────────────────────────
  // 전사·도적은 근접 (사거리 안을 한 번에), 궁수는 원거리 (적 하나씩).
  attack(now) {
    if (this.job.attack === 'ranged') this.shoot(now);
    else this.swing(now);
  }

  distTo(e) {
    return Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
  }

  // ── 근접 ──────────────────────────────────────────────
  swing(now) {
    const w = this.weapon;
    if (now - this.lastSwingAt < w.rate) return;

    const hit = this.enemies.getChildren().filter((e) => this.targetable(e) && this.meleeDist(e) <= w.reach);

    // 파동검을 들었으면 사거리 밖도 노립니다. 그 한 마리를 향해 파동이 날아갑니다.
    const wave = w.relicSum('wave');
    const far = wave > 0 ? this.nearestWithin(CFG.waveRange) : null;
    if (!hit.length && !far) return; // 허공에 휘두르지는 않습니다

    this.lastSwingAt = now;

    const nearest = hit.length
      ? hit.reduce((a, b) => (this.meleeDist(a) < this.meleeDist(b) ? a : b)) : far;
    this.showSlash(Phaser.Math.Angle.Between(
      this.player.x, this.player.y - 6, nearest.x, nearest.y), w);

    if (wave > 0 && nearest) this.fireWave(nearest, Math.round(w.dmg * wave));

    hit.forEach((e) => {
      // 도적은 때리면서 주머니를 텁니다. 잡지 않아도 코인이 나옵니다.
      // 코인은 이제 확률로 나오므로 훔치는 것도 같은 확률을 탑니다.
      if (w.stealChance > 0 && Math.random() < w.stealChance &&
          Math.random() < CFG.coin.dropChance) {
        this.dropCoin(e.x, e.y - 10, Math.round(w.stealAmount * CFG.coin.dropBonus));
      }
      this.hitEnemy(e, w.dmg);
    });
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

  // 파동 — 벤 자리에서 날아가 여럿을 꿰뚫습니다.
  fireWave(target, dmg) {
    const b = this.bullets.create(this.player.x, this.player.y - 6, 'wave');
    b.body.setAllowGravity(false);
    b.setTint(this.weapon.color).setDepth(9);
    b.dmg = dmg;
    b.bounce = 0;
    b.pierce = 2;      // 이만큼 더 꿰뚫고 갑니다
    b.hitSet = new Set();
    b.from = null;     // 파동은 표적을 쫓지 않습니다. 직선으로 나갑니다
    b.bornAt = this.time.now;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y - 6, target.x, target.y);
    b.setRotation(angle);
    this.physics.velocityFromRotation(angle, CFG.waveSpeed, b.body.velocity);
  }

  showSlash(angle, w) {
    const arc = this.add.sprite(this.player.x, this.player.y - 6, 'slash')
      .setDepth(11).setTint(w.color).setRotation(angle);

    const full = w.reach / 56; // 텍스처의 반지름이 56입니다
    arc.setScale(full * 0.65);
    this.tweens.add({
      targets: arc, scale: full, alpha: 0, duration: 170,
      ease: 'Quad.out', onComplete: () => arc.destroy(),
    });
  }

  // ── 원거리 ────────────────────────────────────────────
  shoot(now) {
    const w = this.weapon;
    if (now - this.lastSubAt < w.rate) return;

    const inRange = (e) => this.targetable(e) && this.meleeDist(e) <= w.range;
    const pool = this.enemies.getChildren().filter(inRange)
      .sort((a, b) => this.meleeDist(a) - this.meleeDist(b));
    if (!pool.length) { this.subTarget = null; return; }

    // 한 번 노린 적은 죽거나 사거리를 벗어날 때까지 계속 노립니다.
    // 매 발 가장 가까운 적으로 갈아타면 피해가 흩어져 아무도 죽지 않습니다.
    // 궁수는 멈추지 않고 지나가므로 이걸 안 하면 처치가 0이 됩니다.
    if (!this.subTarget || !inRange(this.subTarget)) this.subTarget = pool[0];

    this.lastSubAt = now;
    const others = pool.filter((e) => e !== this.subTarget);
    for (let i = 0; i < w.shots; i++) {
      const target = i === 0 ? this.subTarget : (others[i - 1] || this.subTarget);
      this.fireArrow(this.player.x, this.player.y - 6, target, w.dmg, w.bounce);
    }
  }

  fireArrow(x, y, target, dmg, bounce) {
    const b = this.bullets.create(x, y, 'bullet');
    b.body.setAllowGravity(false);
    b.setTint(this.weapon.color).setDepth(9);
    b.dmg = dmg;
    b.bounce = bounce;
    b.from = target;
    b.homing = this.weapon.homing;
    b.bornAt = this.time.now;
    this.physics.velocityFromRotation(
      Phaser.Math.Angle.Between(x, y, target.x, target.y), CFG.arrowSpeed, b.body.velocity);
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
      enemy.setTint(0xffffff);
      this.time.delayedCall(60, () => enemy.active && enemy.clearTint());
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
    enemy.destroy();
    this.kills++;
    if (at.def.onDeath === 'explode') this.explodeAt(at);
    else if (at.def.onDeath === 'split') this.splitAt(at);
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
    if (!this.boosts.length) return;
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
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
      default:
        this.springTrap(t.mimicHeal, '가짜!');
        return;
    }
    this.cameras.main.shake(120, 0.006);
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

    bullet.destroy();
    if (this.dead || this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    this.hurt(bullet.dmg || CFG.enemyShot.damage);
  }

  hurt(amount, source) {
    // 도적은 일정 확률로 통째로 흘려 넘깁니다.
    if (this.job.dodge > 0 && Math.random() < this.job.dodge) {
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

    if (this.hp <= 0) this.gameOver();
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
    const late = time - this.lastShopAt - b.graceMs;
    if (late < 0) return;

    if (!this.batsWarned) {
      this.batsWarned = true;
      this.warnBats();
      this.nextBatAt = time + 600;
    }
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

  warnBats() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const parts = [
      this.add.text(CFG.width / 2, 300, '박쥐가 몰려옵니다', font(30, '#b39ddb')).setOrigin(0.5),
      this.add.text(CFG.width / 2, 340, '상점까지 서두르세요', font(20, '#8794b5')).setOrigin(0.5),
    ];
    parts.forEach((t) => {
      t.setScrollFactor(0).setDepth(150).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1500,
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
    // 죽을 때 들고 있던 무기도 도감에 남깁니다. 바로 아래에서 뽑을 후보가 됩니다.
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
  // 그래서 "무기 계승"과 "직업 바꾸기"에는 값이 붙습니다 — 고민이 생기는 자리입니다.
  // 잃는 것은 버튼에 그대로 적어 둡니다. 모르고 눌러서 잃으면 그건 함정입니다.
  buildDeathChoices(add, font, cx) {
    const earned = this.medals;
    const cost = earned ? '이번 판 메달 ' + earned + '개를 버립니다' : '이번 판에 번 메달은 없습니다';
    // 무엇이 뽑혔는지는 눌러 보기 전에 보여 줍니다. 좋은 것이 떴는지 보고
    // 고르는 것이 이 선택의 전부입니다 — 가려 두면 그냥 도박이 됩니다.
    const carry = Save.rollWeapon(this.job.key);
    this.deathCarry = carry; // 자동 시험에서 "뽑힌 것"과 "들고 시작한 것"을 맞춰 보는 통로

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
        carry ? cost : '무기를 들어 본 적이 있어야 뜹니다', !!carry, () => {
          Save.setBoost('weapon', carry);
          this.scene.start('game', { jobKey: this.job.key });
        }),

      // 3 — 직업을 바꾸러. 무기 도감은 직업마다 따로라 갈아타면 처음부터입니다.
      choice(710, 0x5c6bc0, '직업 바꾸기', cost, true,
        () => this.scene.start('select')),
    ];
  }

  // 도감에서 뽑힌 무기를 사람이 읽을 이름으로. 단계는 직업의 무기표에서 찾습니다.
  // 속도는 속과 ×2가 섞인 결과를 하나로 합쳐 보여 줍니다 — 뽑기를 보고
  // 고르는 것이므로, 쌓인 개수보다 "얼마나 빠른가"가 바로 읽혀야 합니다.
  carryName(carry) {
    const table = this.job.weapons;
    const base = table[Math.min(table.length - 1, carry.tier)];
    const speed = Math.min(CFG.speedCapBase,
      (1 + (carry.haste || 0) * CFG.hasteStep) * carry.mult);
    return base.name +
      (carry.plus ? ' +' + carry.plus : '') +
      (speed > 1.001 ? ' ×' + speed.toFixed(2) : '');
  }

  // ── 매 프레임 ─────────────────────────────────────────
  update(time, delta) {
    if (this.dead) return;
    if (this.lastShopAt === 0) this.lastShopAt = time; // 첫 판의 시계는 여기서 시작합니다

    // 카메라는 주인공을 화면 아래쪽에 두고 따라 올라갑니다.
    const cam = this.cameras.main;
    const want = this.player.y - CFG.height * 0.68;
    cam.scrollY += (want - cam.scrollY) * Math.min(1, delta / 130);

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
