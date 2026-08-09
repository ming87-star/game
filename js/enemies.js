// 적의 등장과 움직임. 종류마다 다르게 굴러갑니다.

function enemyDef(key) {
  return CFG.enemyTypes.find((t) => t.key === key) || CFG.enemyTypes[0];
}

function spawnEnemy(scene, x, y, floor, typeKey) {
  if (scene.enemies.countActive(true) >= CFG.maxEnemies) return null;

  const def = enemyDef(typeKey);
  const e = scene.enemies.create(x, y, 'e-' + def.key);
  e.setDepth(8);
  e.setScale(def.scale || 1);

  if (def.move === 'walk') {
    // 기는 것만 중력을 받습니다. 발판 위에 내려앉아 걷다가 끝에서 떨어집니다.
    e.body.setAllowGravity(true);
    e.body.setGravityY(CFG.crawl.gravity);
    e.dir = Math.random() < 0.5 ? -1 : 1;
  } else {
    e.body.setAllowGravity(false);
    e.body.setCircle(e.width / 2, 0, 0);
  }

  e.def = def;
  e.maxHp = Math.round((CFG.enemy.baseHp + floor * CFG.enemy.hpPerFloor)
    * Math.pow(CFG.enemy.hpGrowth, floor) * def.hp);
  e.hp = e.maxHp;
  e.speed = Math.min(
    CFG.enemy.maxSpeed,
    (CFG.enemy.baseSpeed + floor * CFG.enemy.speedPerFloor) * def.speed);
  e.floor = floor;
  e.contactDamage = Math.round(def.dmg * (1 + floor * CFG.enemy.dmgPerFloor));
  e.coin = def.coin;
  e.phase = Math.random() * Math.PI * 2;
  e.nextShotAt = scene.time.now + CFG.enemyShot.interval * (0.5 + Math.random());

  // 거인은 무겁게, 빠른 놈은 팔딱거리게 — 움직임만 봐도 구분되게 합니다.
  const beat = def.key === 'giant' ? 900 : def.key === 'dasher' ? 220 : 420;
  scene.tweens.add({ targets: e, scaleX: (def.scale || 1) * 1.12, scaleY: (def.scale || 1) * 0.9, duration: beat, yoyo: true, repeat: -1 });

  if (!scene.seenTypes.has(def.key)) {
    scene.seenTypes.add(def.key);
    scene.announceEnemy(def);
  }
  return e;
}

function updateEnemies(scene, time, delta) {
  const player = scene.player;
  const camBottom = scene.cameras.main.scrollY + CFG.height + 320;

  scene.enemies.getChildren().forEach((e) => {
    if (!e.active) return;

    // 한참 아래로 처진 적은 정리합니다.
    if (e.y > camBottom) { e.destroy(); return; }

    const angle = Phaser.Math.Angle.Between(e.x, e.y, player.x, player.y);
    const dist = Phaser.Math.Distance.Between(e.x, e.y, player.x, player.y);

    if (e.def.move === 'walk') {
      walkStep(scene, e, player);
      return;
    }

    if (e.def.move === 'ranged') {
      // 일정 거리까지만 다가와서 멈춰 쏩니다.
      if (dist > CFG.enemyShot.standoff) {
        scene.physics.velocityFromRotation(angle, e.speed, e.body.velocity);
      } else {
        e.body.velocity.set(0, 0);
        if (time > e.nextShotAt) {
          e.nextShotAt = time + CFG.enemyShot.interval;
          fireEnemyShot(scene, e, angle);
        }
      }
      return;
    }

    if (e.def.move === 'wave') {
      // 좌우로 흔들며 다가옵니다.
      const sway = Math.sin(time / 260 + e.phase) * 0.7;
      scene.physics.velocityFromRotation(angle + sway, e.speed, e.body.velocity);
      return;
    }

    scene.physics.velocityFromRotation(angle, e.speed, e.body.velocity);
  });
}

// 기는 것의 걸음. 주인공이 멀면 발판 위를 순찰하고, 가까우면 쫓아옵니다.
// 쫓을 때는 발판 끝을 개의치 않으므로 그대로 떨어집니다.
function walkStep(scene, e, player) {
  const chasing = Math.abs(player.y - e.y) < CFG.floorHeight * CFG.crawl.chaseWithin;

  if (chasing) {
    if (Math.abs(player.x - e.x) > CFG.crawl.turnDeadzone) e.dir = Math.sign(player.x - e.x);
  } else if (e.body.blocked.down && !groundAhead(scene, e)) {
    e.dir *= -1; // 발판 끝이니 돌아섭니다
  }

  e.body.velocity.x = e.dir * e.speed;
  e.setFlipX(e.dir < 0);
}

// 진행 방향 바로 앞에 발판이 있는지 짚어 봅니다.
function groundAhead(scene, e) {
  const ahead = e.x + e.dir * e.displayWidth * CFG.crawl.edgeProbe;
  const feet = e.y + e.displayHeight / 2;

  return scene.platforms.getChildren().some((p) => {
    if (Math.abs(p.y - CFG.platformH / 2 - feet) > 20) return false;
    return ahead > p.x - p.displayWidth / 2 && ahead < p.x + p.displayWidth / 2;
  });
}

function fireEnemyShot(scene, enemy, angle) {
  const b = scene.enemyBullets.create(enemy.x, enemy.y, 'enemy-bullet');
  b.body.setAllowGravity(false);
  b.setDepth(9);
  b.bornAt = scene.time.now;
  b.dmg = Math.round(CFG.enemyShot.damage * (1 + enemy.floor * CFG.enemy.dmgPerFloor));
  scene.physics.velocityFromRotation(angle, CFG.enemyShot.speed, b.body.velocity);
}
