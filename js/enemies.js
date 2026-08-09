// 적의 등장과 움직임. 종류마다 다르게 굴러갑니다.

function enemyDef(key) {
  return CFG.enemyTypes.find((t) => t.key === key) || CFG.enemyTypes[0];
}

function spawnEnemy(scene, x, y, floor, typeKey) {
  if (scene.enemies.countActive(true) >= CFG.maxEnemies) return null;

  const def = enemyDef(typeKey);
  const e = scene.enemies.create(x, y, 'e-' + def.key);
  e.body.setAllowGravity(false);
  e.setDepth(8);
  e.setScale(def.scale || 1);
  e.body.setCircle(e.width / 2, 0, 0);

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

function fireEnemyShot(scene, enemy, angle) {
  const b = scene.enemyBullets.create(enemy.x, enemy.y, 'enemy-bullet');
  b.body.setAllowGravity(false);
  b.setDepth(9);
  b.bornAt = scene.time.now;
  b.dmg = Math.round(CFG.enemyShot.damage * (1 + enemy.floor * CFG.enemy.dmgPerFloor));
  scene.physics.velocityFromRotation(angle, CFG.enemyShot.speed, b.body.velocity);
}
