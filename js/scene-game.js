const STAND_OFFSET = CFG.platformH / 2 + 24; // 발판 위에 발이 닿는 높이

class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    buildTextures(this);

    this.dead = false;
    this.jumping = false;
    this.floorIndex = 0;
    this.lane = 'left';
    this.hp = CFG.player.hp;
    this.itemLevels = 0;
    this.weaponLevel = 0;
    this.kills = 0;
    this.bonus = 0;
    this.lastHitAt = -9999;
    this.lastShotAt = 0;
    this.target = null;

    this.floors = new Map();
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();

    this.drawBackground();

    for (let i = 0; i <= 10; i++) this.addFloor(i);

    const start = this.floors.get(0).slots.left;
    this.player = this.physics.add.sprite(start.x, start.y - STAND_OFFSET, 'player');
    this.player.setDepth(10);
    this.player.body.setSize(26, 40).setOffset(6, 6);
    this.player.body.setAllowGravity(false);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyTouch, null, this);

    this.cameras.main.setScroll(0, this.player.y - CFG.height * 0.68);

    this.buildHud();
    this.bindInput();

    this.ambientAt = this.time.now + CFG.ambient.baseDelay;

    window.__scene = this; // 브라우저 콘솔·자동 플레이테스트에서 상태를 보기 위한 통로
  }

  // ── 배경 ──────────────────────────────────────────────
  drawBackground() {
    this.cameras.main.setBackgroundColor('#141a2e');
    // 탑 안쪽 벽. 화면에 고정해서 아무리 올라가도 끊기지 않게 합니다.
    this.add.rectangle(CFG.width / 2, CFG.height / 2, 330, CFG.height, 0x1d2542)
      .setScrollFactor(0).setDepth(-5);
  }

  // ── 층 만들기 / 지우기 ────────────────────────────────
  addFloor(index) {
    if (this.floors.has(index)) return;
    const floor = makeFloor(index);
    floor.views = [];

    for (const lane of ['left', 'right']) {
      const slot = floor.slots[lane];
      if (!slot) continue;

      const bar = this.add.rectangle(slot.x, slot.y, CFG.platformW, CFG.platformH, 0x5c6bc0);
      const lip = this.add.rectangle(slot.x, slot.y - CFG.platformH / 2 + 3, CFG.platformW, 6, 0x9fa8da);
      floor.views.push(bar, lip);

      // 올라가기 전에 무엇이 있는지 보이게 해서, 좌우 선택이 판단이 되게 합니다.
      if (slot.kind === SLOT.ITEM) {
        slot.view = this.add.sprite(slot.x, slot.y - 34, 'item').setDepth(5);
        this.tweens.add({ targets: slot.view, y: slot.y - 46, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      } else if (slot.kind === SLOT.HEAL) {
        slot.view = this.add.sprite(slot.x, slot.y - 34, 'heal').setDepth(5);
        this.tweens.add({ targets: slot.view, y: slot.y - 46, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      } else if (slot.kind === SLOT.ENEMY) {
        slot.view = this.add.text(slot.x, slot.y - 40, '⚠ ' + slot.enemyCount, {
          fontFamily: 'sans-serif', fontSize: '20px', color: '#ff8a80',
        }).setOrigin(0.5).setDepth(5);
      }
      if (slot.view) floor.views.push(slot.view);
    }

    this.floors.set(index, floor);
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
    for (const lane of ['left', 'right']) {
      const slot = floor.slots[lane];
      if (!slot || slot.kind !== SLOT.ENEMY || slot.spawned) continue;
      slot.spawned = true;
      for (let i = 0; i < slot.enemyCount; i++) {
        this.spawnEnemy(slot.x + Phaser.Math.Between(-60, 60), slot.y - 50 - i * 26, index);
      }
      // 실제로 나왔으니 예고 표시는 지웁니다.
      if (slot.view) { slot.view.destroy(); slot.view = null; }
    }
  }

  // ── 적 ────────────────────────────────────────────────
  spawnEnemy(x, y, floorForStats) {
    if (this.enemies.countActive(true) >= CFG.maxEnemies) return null;
    const e = this.enemies.create(x, y, 'enemy');
    e.body.setAllowGravity(false);
    e.body.setCircle(15, 1, 1);
    e.setDepth(8);
    e.maxHp = CFG.enemy.baseHp + floorForStats * CFG.enemy.hpPerFloor;
    e.hp = e.maxHp;
    e.speed = Math.min(CFG.enemy.maxSpeed, CFG.enemy.speed + floorForStats * CFG.enemy.speedPerFloor);
    this.tweens.add({ targets: e, scaleX: 1.12, scaleY: 0.9, duration: 420, yoyo: true, repeat: -1 });
    return e;
  }

  spawnAmbient() {
    // 화면 위쪽 가장자리에서 무작위로 들어옵니다.
    const cam = this.cameras.main;
    const x = Phaser.Math.Between(60, CFG.width - 60);
    const y = cam.scrollY - 40;
    const count = Math.min(CFG.ambient.maxCount, 1 + Math.floor(this.floorIndex / 10));
    for (let i = 0; i < count; i++) {
      this.spawnEnemy(x + Phaser.Math.Between(-40, 40), y - i * 30, this.floorIndex);
    }
  }

  // ── 조작 ──────────────────────────────────────────────
  bindInput() {
    this.input.on('pointerdown', (p) => {
      if (this.dead) return this.scene.restart();
      this.jump(p.x < this.scale.width / 2 ? 'left' : 'right');
    });
    this.input.keyboard.on('keydown-LEFT', () => this.dead ? this.scene.restart() : this.jump('left'));
    this.input.keyboard.on('keydown-RIGHT', () => this.dead ? this.scene.restart() : this.jump('right'));
  }

  jump(lane) {
    if (this.jumping || this.dead) return;
    const next = this.floors.get(this.floorIndex + 1);
    if (!next) return;

    // 누른 쪽에 발판이 없으면 남은 한쪽으로 갑니다. 점프는 실패하지 않습니다.
    const slot = next.slots[lane] || next.slots[lane === 'left' ? 'right' : 'left'];
    if (!slot) return;

    this.jumping = true;
    this.player.setFlipX(slot.x < this.player.x);

    const fromX = this.player.x;
    const fromY = this.player.y;
    const toX = slot.x;
    const toY = slot.y - STAND_OFFSET;
    const arc = { t: 0 };

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

  land(slot) {
    if (slot.kind === SLOT.ITEM && !slot.taken) {
      slot.taken = true;
      this.takeItem();
      slot.view && slot.view.destroy();
    } else if (slot.kind === SLOT.HEAL && !slot.taken) {
      slot.taken = true;
      this.hp = Math.min(CFG.player.hp, this.hp + CFG.heal);
      this.popup('+' + CFG.heal, '#a5d6a7');
      slot.view && slot.view.destroy();
    }

    // 앞쪽 층을 계속 채워두고, 지나온 층은 정리합니다.
    for (let i = this.floorIndex; i <= this.floorIndex + 10; i++) this.addFloor(i);
    for (let i = this.floorIndex - 6; i < this.floorIndex - 3; i++) this.removeFloor(i);
    for (let i = 1; i <= 2; i++) this.wakeFloor(this.floorIndex + i);
  }

  // 무기 등급 = (아이템 수 + 처치 점수) / pointsPerLevel
  syncWeapon() {
    const points = this.itemLevels + Math.floor(this.kills / CFG.killsPerPoint);
    const lvl = Math.min(
      CFG.weapons.length - 1,
      Math.floor(points / CFG.pointsPerLevel));
    if (lvl === this.weaponLevel) return;
    this.weaponLevel = lvl;
    this.popup(CFG.weapons[lvl].name, '#ffd54f');
  }

  takeItem() {
    if (this.weaponLevel >= CFG.weapons.length - 1) {
      // 이미 최고 등급이면 점수로 돌려줍니다.
      this.bonus += 150;
      this.popup('+150', '#ffd54f');
      return;
    }
    this.itemLevels++;
    const before = this.weaponLevel;
    this.syncWeapon();
    if (this.weaponLevel === before) this.popup('강화 +1', '#ffd54f');
  }

  // ── 자동 공격 ─────────────────────────────────────────
  autoAttack(now) {
    const w = CFG.weapons[this.weaponLevel];
    if (now - this.lastShotAt < w.rate) return;

    const dist = (e) => Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
    const inRange = (e) => e.active && dist(e) <= w.range;

    const pool = this.enemies.getChildren().filter(inRange).sort((a, b) => dist(a) - dist(b));
    if (!pool.length) { this.target = null; return; }

    // 한 번 노린 적은 죽거나 사거리를 벗어날 때까지 계속 노립니다.
    // 매번 가장 가까운 적로 갈아타면 피해가 흩어져 아무도 죽지 않습니다.
    if (!this.target || !inRange(this.target)) this.target = pool[0];

    // 추가 탄은 다른 적에게, 없으면 같은 적에게 몰아줍니다.
    const others = pool.filter((e) => e !== this.target);
    const targets = [this.target, ...others];

    this.lastShotAt = now;

    for (let i = 0; i < w.shots; i++) {
      const target = targets[Math.min(i, targets.length - 1)];
      const b = this.bullets.create(this.player.x, this.player.y - 6, 'bullet');
      b.body.setAllowGravity(false);
      b.setTint(w.color).setDepth(9);
      b.dmg = w.dmg;
      b.bornAt = now;
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y - 6, target.x, target.y);
      // 같은 적을 여럿이 노릴 때는 살짝 벌려 쏩니다.
      const spread = (i - (w.shots - 1) / 2) * 0.12;
      this.physics.velocityFromRotation(angle + spread, w.speed, b.body.velocity);
    }
  }

  onBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    enemy.hp -= bullet.dmg;
    bullet.destroy();

    const spark = this.add.sprite(enemy.x, enemy.y, 'spark').setDepth(11);
    this.tweens.add({ targets: spark, scale: 2.4, alpha: 0, duration: 160, onComplete: () => spark.destroy() });

    if (enemy.hp <= 0) {
      enemy.destroy();
      this.kills++;
      this.syncWeapon();
    } else {
      enemy.setTint(0xffffff);
      this.time.delayedCall(60, () => enemy.active && enemy.clearTint());
    }
  }

  onEnemyTouch(player, enemy) {
    if (this.dead || this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    this.lastHitAt = this.time.now;
    this.hp -= CFG.player.contactDamage;
    this.cameras.main.shake(140, 0.008);
    this.popup('-' + CFG.player.contactDamage, '#ff8a80');
    this.tweens.add({ targets: player, alpha: 0.3, duration: 90, yoyo: true, repeat: 3 });
    if (this.hp <= 0) this.gameOver();
  }

  // ── HUD ───────────────────────────────────────────────
  buildHud() {
    const font = { fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff' };

    // 발판이 HUD 뒤로 지나가도 글씨가 읽히도록 어두운 띠를 깝니다.
    this.add.rectangle(0, 0, CFG.width, 96, 0x0d1120, 0.82)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(99);

    this.hpBg =this.add.rectangle(24, 30, 240, 22, 0x000000, 0.45).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.hpBar = this.add.rectangle(27, 30, 234, 16, 0x66bb6a).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

    this.floorText = this.add.text(CFG.width - 24, 18, '', { ...font, fontSize: '30px' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.scoreText = this.add.text(CFG.width - 24, 54, '', { ...font, fontSize: '22px', color: '#b0bec5' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.weaponText = this.add.text(24, 56, '', { ...font, fontSize: '22px', color: '#ffd54f' })
      .setScrollFactor(0).setDepth(100);

    this.hint = this.add.text(CFG.width / 2, CFG.height - 70, '화면 왼쪽 / 오른쪽을 눌러 길을 고르세요', {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0.8);
  }

  updateHud() {
    this.hpBar.width = Math.max(0, 234 * (this.hp / CFG.player.hp));
    this.hpBar.fillColor = this.hp > 50 ? 0x66bb6a : this.hp > 25 ? 0xffb74d : 0xef5350;
    this.floorText.setText(this.floorIndex + '층');
    this.scoreText.setText('점수 ' + this.score());
    this.weaponText.setText(CFG.weapons[this.weaponLevel].name);
  }

  score() {
    return this.floorIndex * 5 + this.kills * CFG.enemy.score + this.bonus;
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
    this.physics.pause();
    this.enemies.getChildren().forEach((e) => e.setTint(0x555555));

    const cam = this.cameras.main;
    this.add.rectangle(CFG.width / 2, CFG.height / 2, CFG.width, CFG.height, 0x000000, 0.66)
      .setScrollFactor(0).setDepth(200);
    this.add.text(CFG.width / 2, CFG.height / 2 - 80, this.floorIndex + '층', {
      fontFamily: 'sans-serif', fontSize: '72px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(CFG.width / 2, CFG.height / 2, '점수 ' + this.score() + '   처치 ' + this.kills, {
      fontFamily: 'sans-serif', fontSize: '30px', color: '#b0bec5',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(CFG.width / 2, CFG.height / 2 + 90, '눌러서 다시 시작', {
      fontFamily: 'sans-serif', fontSize: '30px', color: '#ffd54f',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
  }

  // ── 매 프레임 ─────────────────────────────────────────
  update(time, delta) {
    if (this.dead) return;

    // 카메라는 주인공을 화면 아래쪽에 두고 따라 올라갑니다.
    const cam = this.cameras.main;
    const want = this.player.y - CFG.height * 0.68;
    cam.scrollY += (want - cam.scrollY) * Math.min(1, delta / 130);

    if (this.floorIndex > 0 && this.hint.alpha > 0) this.hint.setAlpha(Math.max(0, this.hint.alpha - delta / 800));

    // 적은 주인공을 향해 곧장 다가옵니다.
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
      this.physics.velocityFromRotation(angle, e.speed, e.body.velocity);
      if (e.y > cam.scrollY + CFG.height + 300) e.destroy();
    });

    this.bullets.getChildren().forEach((b) => {
      if (b.active && time - b.bornAt > 1600) b.destroy();
    });

    this.autoAttack(time);

    // 무작위 등장 — 높이 올라갈수록 간격이 짧아집니다.
    if (this.floorIndex >= CFG.ambient.startFloor && time > this.ambientAt) {
      this.spawnAmbient();
      const delay = Math.max(CFG.ambient.minDelay, CFG.ambient.baseDelay - this.floorIndex * CFG.ambient.delayPerFloor);
      this.ambientAt = time + delay;
    }

    this.updateHud();
  }
}
