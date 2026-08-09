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
    this.lane = 'mid';
    resetTowerRun(); // 이번 판의 UP 배치를 새로 뽑습니다

    this.maxHp = CFG.player.hp;
    this.hp = this.maxHp;
    this.weapon = new Weapon();
    this.coins = 0;
    this.totalCoins = 0;
    this.kills = 0;

    this.lastHitAt = -9999;
    this.lastShotAt = 0;
    this.target = null;
    this.pickups = [];
    this.seenTypes = new Set(); // 처음 만나는 적은 이름을 띄워 줍니다

    this.floors = new Map();
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();

    this.drawBackground();
    for (let i = 0; i <= 10; i++) this.addFloor(i);

    const start = this.floors.get(0).slots.mid;
    this.player = this.physics.add.sprite(start.x, start.y - STAND_OFFSET, 'player');
    this.player.setDepth(10);
    this.player.body.setSize(26, 40).setOffset(6, 6);
    this.player.body.setAllowGravity(false);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyTouch, null, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.onEnemyShotHit, null, this);

    this.cameras.main.setScroll(0, this.player.y - CFG.height * 0.68);

    this.hud = new Hud(this);
    this.shop = new Shop(this);
    this.bindInput();

    this.ambientAt = this.time.now + CFG.ambient.baseDelay;
    this.armItems();

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
    const floor = makeFloor(index);
    floor.views = [];

    for (const lane of LANES) {
      const slot = floor.slots[lane];
      if (!slot) continue;

      const wide = slot.kind === SLOT.SHOP;
      const w = wide ? CFG.width - 80 : CFG.platformW;
      const color = wide ? 0xffb74d : 0x5c6bc0;
      const lipColor = wide ? 0xffe0b2 : 0x9fa8da;

      floor.views.push(
        this.add.rectangle(slot.x, slot.y, w, CFG.platformH, color),
        this.add.rectangle(slot.x, slot.y - CFG.platformH / 2 + 3, w, 6, lipColor));

      const mark = this.makeMark(slot);
      if (mark) { slot.view = mark; floor.views.push(mark); }
    }

    this.floors.set(index, floor);
  }

  // 올라가기 전에 무엇이 있는지 보이게 해서, 좌우 선택이 판단이 되게 합니다.
  // 나중에 아이템 그림이 나오면 이 함수만 바꾸면 됩니다.
  makeMark(slot) {
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
    const kind = slot.kind === SLOT.UPGRADE && this.weapon.atMaxTier ? SLOT.HEAL : slot.kind;
    const mark = SLOT_MARK[kind];
    if (!mark) return null;

    const badge = this.add.container(slot.x, slot.y - 38, [
      this.add.circle(0, 0, 18, mark.color),
      this.add.text(0, 0, mark.label, {
        fontFamily: 'sans-serif', fontSize: '20px', color: mark.text,
      }).setOrigin(0.5),
    ]).setDepth(5);

    this.tweens.add({ targets: badge, y: badge.y - 12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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
    const cam = this.cameras.main;
    const x = Phaser.Math.Between(60, CFG.width - 60);
    const count = Math.min(CFG.ambient.maxCount, 1 + Math.floor(this.floorIndex / 14));
    for (let i = 0; i < count; i++) {
      spawnEnemy(this, x + Phaser.Math.Between(-40, 40), cam.scrollY - 40 - i * 30,
        this.floorIndex, pickEnemyType(this.floorIndex));
    }
  }

  // ── 조작 ──────────────────────────────────────────────
  bindInput() {
    this.input.on('pointerdown', (p) => {
      if (this.shop.open) return; // 상점 버튼은 상점이 직접 받습니다
      if (this.dead) return this.scene.restart();
      // 화면을 세로로 삼등분해서 누른 자리의 길로 갑니다.
      const third = this.scale.width / 3;
      this.jump(p.x < third ? 'left' : p.x < third * 2 ? 'mid' : 'right');
    });
    const key = (lane) => () => {
      if (this.shop.open) return;
      if (this.dead) return this.scene.restart();
      this.jump(lane);
    };
    this.input.keyboard.on('keydown-LEFT', key('left'));
    this.input.keyboard.on('keydown-UP', key('mid'));
    this.input.keyboard.on('keydown-DOWN', key('mid'));
    this.input.keyboard.on('keydown-RIGHT', key('right'));
  }

  jump(lane) {
    if (this.jumping || this.dead || this.shop.open) return;
    const next = this.floors.get(this.floorIndex + 1);
    if (!next) return;

    // 누른 쪽에 발판이 없으면 가장 가까운 길로 갑니다. 점프는 실패하지 않습니다.
    const slot = next.slots[lane] || LANES
      .map((l) => next.slots[l])
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.x - CFG.laneX[lane]) - Math.abs(b.x - CFG.laneX[lane]))[0];
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
    if (!slot.taken && !slot.expired) {
      slot.taken = true;
      switch (slot.kind) {
        case SLOT.PLUS:
          this.weapon.addPlus();
          this.popup('공격력 +1', '#ffd54f');
          break;
        case SLOT.DOUBLE:
          this.weapon.addDouble();
          this.popup('발사체 ×' + this.weapon.mult, '#4fc3f7');
          break;
        case SLOT.UPGRADE:
          if (this.weapon.upgrade()) this.popup(this.weapon.name, '#ff8a65');
          else { this.hp = Math.min(this.maxHp, this.hp + CFG.heal); this.popup('+' + CFG.heal, '#a5d6a7'); }
          break;
        case SLOT.HEAL:
          this.hp = Math.min(this.maxHp, this.hp + CFG.heal);
          this.popup('+' + CFG.heal, '#a5d6a7');
          break;
        default:
          slot.taken = false; // 먹을 게 없던 발판은 그대로 둡니다
      }
      if (slot.taken && slot.view) { slot.view.destroy(); slot.view = null; }
    }

    // 앞쪽 층을 계속 채워두고, 지나온 층은 정리합니다.
    for (let i = this.floorIndex; i <= this.floorIndex + 10; i++) this.addFloor(i);
    for (let i = this.floorIndex - 6; i < this.floorIndex - 3; i++) this.removeFloor(i);
    this.armItems();

    if (slot.kind === SLOT.SHOP) return this.enterShop();
    for (let i = 1; i <= 2; i++) this.wakeFloor(this.floorIndex + i);
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
          slot.view.setAlpha(Math.floor(age / period) % 2 ? 0.2 : 1);
        }
      }
    });
  }

  // ── 상점 ──────────────────────────────────────────────
  enterShop() {
    // 쫓아오던 적은 물러갑니다. 상점은 한숨 돌리는 자리입니다.
    this.enemies.getChildren().slice().forEach((e) => {
      this.tweens.add({ targets: e, alpha: 0, duration: 260, onComplete: () => e.destroy() });
    });
    this.enemyBullets.clear(true, true);
    this.target = null;
    this.shop.show(this.floorIndex);
  }

  onShopClosed() {
    // 상점을 나서는 순간부터 다시 몰려옵니다.
    this.ambientAt = this.time.now + CFG.ambient.baseDelay;
    for (let i = 1; i <= 2; i++) this.wakeFloor(this.floorIndex + i);

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
  autoAttack(now) {
    const w = this.weapon;
    if (now - this.lastShotAt < w.rate) return;

    const dist = (e) => Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
    const inRange = (e) => e.active && dist(e) <= w.range;

    const pool = this.enemies.getChildren().filter(inRange).sort((a, b) => dist(a) - dist(b));
    if (!pool.length) { this.target = null; return; }

    // 한 번 노린 적은 죽거나 사거리를 벗어날 때까지 계속 노립니다.
    // 매번 가장 가까운 적으로 갈아타면 피해가 흩어져 아무도 죽지 않습니다.
    if (!this.target || !inRange(this.target)) this.target = pool[0];

    const targets = [this.target, ...pool.filter((e) => e !== this.target)];
    this.lastShotAt = now;

    const shots = w.shots;
    for (let i = 0; i < shots; i++) {
      const target = targets[Math.min(i, targets.length - 1)];
      const b = this.bullets.create(this.player.x, this.player.y - 6, 'bullet');
      b.body.setAllowGravity(false);
      b.setTint(w.color).setDepth(9);
      b.dmg = w.dmg;
      b.bornAt = now;
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y - 6, target.x, target.y);
      // 같은 적을 여럿이 노릴 때는 살짝 벌려 쏩니다.
      const spread = (i - (shots - 1) / 2) * 0.1;
      this.physics.velocityFromRotation(angle + spread, w.speed, b.body.velocity);
    }
  }

  onBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    enemy.hp -= bullet.dmg;
    bullet.destroy();

    const spark = this.add.sprite(enemy.x, enemy.y, 'spark').setDepth(11);
    this.tweens.add({ targets: spark, scale: 2.4, alpha: 0, duration: 160, onComplete: () => spark.destroy() });

    if (enemy.hp > 0) {
      enemy.setTint(0xffffff);
      this.time.delayedCall(60, () => enemy.active && enemy.clearTint());
      return;
    }

    this.dropCoin(enemy.x, enemy.y, enemy.coin);
    enemy.destroy();
    this.kills++;
  }

  onEnemyTouch(player, enemy) {
    if (this.dead || this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    this.hurt(enemy.contactDamage);
  }

  onEnemyShotHit(player, bullet) {
    bullet.destroy();
    if (this.dead || this.time.now - this.lastHitAt < CFG.player.invulnMs) return;
    this.hurt(bullet.dmg || CFG.enemyShot.damage);
  }

  hurt(amount) {
    this.lastHitAt = this.time.now;
    this.hp -= amount;
    this.cameras.main.shake(140, 0.008);
    this.popup('-' + amount, '#ff8a80');
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: 3 });
    if (this.hp <= 0) this.gameOver();
  }

  // ── 코인 ──────────────────────────────────────────────
  dropCoin(x, y, value) {
    const sprite = this.add.sprite(x, y, 'coin').setDepth(12);
    this.tweens.add({ targets: sprite, y: y - 26, duration: 200, ease: 'Quad.out' });
    this.pickups.push({ sprite, value, speed: 90 });
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

  // ── 그 밖 ─────────────────────────────────────────────
  score() {
    return this.floorIndex * 10 + this.totalCoins * 2;
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

    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const cy = CFG.height / 2;
    const add = (o) => o.setScrollFactor(0).setDepth(200);

    add(this.add.rectangle(cx, cy, CFG.width, CFG.height, 0x000000, 0.66));
    add(this.add.text(cx, cy - 90, this.floorIndex + '층', font(72, '#ffffff')).setOrigin(0.5));
    add(this.add.text(cx, cy - 10, '점수 ' + this.score(), font(32, '#ffffff')).setOrigin(0.5));
    add(this.add.text(cx, cy + 34, '처치 ' + this.kills + '   코인 ' + this.totalCoins, font(24, '#b0bec5')).setOrigin(0.5));
    add(this.add.text(cx, cy + 74, this.weapon.name +
      (this.weapon.plus ? ' +' + this.weapon.plus : '') +
      (this.weapon.mult > 1 ? ' ×' + this.weapon.mult : ''), font(24, '#ffd54f')).setOrigin(0.5));
    add(this.add.text(cx, cy + 140, '눌러서 다시 시작', font(30, '#ffd54f')).setOrigin(0.5));
  }

  // ── 매 프레임 ─────────────────────────────────────────
  update(time, delta) {
    if (this.dead) return;

    // 카메라는 주인공을 화면 아래쪽에 두고 따라 올라갑니다.
    const cam = this.cameras.main;
    const want = this.player.y - CFG.height * 0.68;
    cam.scrollY += (want - cam.scrollY) * Math.min(1, delta / 130);

    this.updatePickups(delta);
    this.hud.update();

    if (this.shop.open) return; // 상점에서는 시간이 멈춘 셈 칩니다

    this.updateItems(time);
    if (this.floorIndex > 0) this.hud.fadeHint(delta);

    updateEnemies(this, time, delta);

    this.bullets.getChildren().forEach((b) => {
      if (b.active && time - b.bornAt > 1600) b.destroy();
    });
    this.enemyBullets.getChildren().forEach((b) => {
      if (b.active && time - b.bornAt > 3000) b.destroy();
    });

    this.autoAttack(time);

    // 무작위 등장 — 높이 올라갈수록 간격이 짧아집니다.
    if (this.floorIndex >= CFG.ambient.startFloor && time > this.ambientAt) {
      this.spawnAmbient();
      const delay = Math.max(CFG.ambient.minDelay, CFG.ambient.baseDelay - this.floorIndex * CFG.ambient.delayPerFloor);
      this.ambientAt = time + delay;
    }
  }
}
