// 적의 등장과 움직임.
//
// 크게 둘로 나뉩니다.
//   땅을 딛는 것(ground)  중력을 받고 발판 위를 걸어다닙니다. 위층으로는 못 쫓아옵니다.
//                        대신 주인공이 올라설 발판을 지키고 있습니다.
//   나는 것(!ground)      허공을 가로질러 곧장 옵니다. 지금은 날것뿐이고,
//                        보스를 넣는다면 그쪽도 여기에 붙입니다.

function enemyDef(key) {
  return CFG.enemyTypes.find((t) => t.key === key) || CFG.enemyTypes[0];
}

// 층에 따른 체력 배수.
//
// 무기 단계가 남아 있는 동안(hpTaperFrom 아래)에는 주인공도 곱으로 세지므로
// 적도 곱으로 자랍니다. 마지막 무기를 든 뒤로는 주인공의 화력이 거의 평평해지니
// 적의 증가율도 같이 꺾습니다. 안 그러면 넘을 수 없는 벽이 생깁니다 —
// 1.022를 그대로 두면 500층 적은 175층의 1,180배가 됩니다.
function enemyHpScale(floor) {
  const e = CFG.enemy;
  const knee = e.hpTaperFrom;
  if (floor <= knee) return Math.pow(e.hpGrowth, floor);
  return Math.pow(e.hpGrowth, knee) * Math.pow(e.hpGrowthLate, floor - knee);
}

function spawnEnemy(scene, x, y, floor, typeKey) {
  if (scene.enemies.countActive(true) >= CFG.maxEnemies) return null;

  const def = enemyDef(typeKey);
  const e = scene.enemies.create(x, y, 'e-' + def.key);
  e.setDepth(8);
  e.setScale(def.scale || 1);

  if (def.ground) {
    e.body.setAllowGravity(true);
    e.body.setGravityY(CFG.ground.gravity);
    e.dir = Math.random() < 0.5 ? -1 : 1;
  } else {
    e.body.setAllowGravity(false);
    e.body.setCircle(e.width / 2, 0, 0);
  }

  e.def = def;
  e.maxHp = Math.round((CFG.enemy.baseHp + floor * CFG.enemy.hpPerFloor)
    * enemyHpScale(floor) * def.hp);
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
    // 땅을 딛는 적은 더 일찍 걷어냅니다. 주인공이 지나온 아래층에 남아 있어 봐야
    // 다시 만날 일이 없는데, 등장 한도만 차지해서 위층이 텅 비게 됩니다.
    // 보스는 투기장에 붙박이라 정리 대상이 아닙니다.
    const floorBelow = player.y + CFG.floorHeight * 2.5;
    if (!e.isBoss && (e.y > camBottom || (e.def.ground && e.y > floorBelow))) { e.destroy(); return; }

    if (e.isBat) return batStep(scene, e, player, time);
    if (e.isBoss) return bossStep(scene, e, player, time);
    if (e.def.ground) return groundStep(scene, e, player, time);
    return airStep(scene, e, player, time);
  });
}

// ── 땅을 딛는 적 ──────────────────────────────────────────
// 주인공이 멀면 발판 끝에서 돌아서며 순찰합니다. 그래야 올라가 보면 거기 있습니다.
// 가까워지면 낭떠러지를 개의치 않고 쫓아오다가 그대로 떨어집니다.
function groundStep(scene, e, player, time) {
  const near = Math.abs(player.y - e.y) < CFG.floorHeight * CFG.ground.chaseWithin;
  const dx = player.x - e.x;

  // 사수는 사거리 안에 들면 멈춰 서서 쏩니다.
  if (e.def.move === 'ranged' && near && Math.abs(dx) < CFG.enemyShot.standoff) {
    e.body.velocity.x = 0;
    if (time > e.nextShotAt) {
      e.nextShotAt = time + CFG.enemyShot.interval;
      fireEnemyShot(scene, e, Phaser.Math.Angle.Between(e.x, e.y, player.x, player.y));
    }
    return;
  }

  if (near) {
    if (Math.abs(dx) > CFG.ground.turnDeadzone) e.dir = Math.sign(dx);
  } else if (e.body.blocked.down && !groundAhead(scene, e)) {
    e.dir *= -1; // 발판 끝이니 돌아섭니다
  }

  e.body.velocity.x = e.dir * e.speed;
  e.setFlipX(e.dir < 0);
}

// 진행 방향 바로 앞에 발판이 있는지 짚어 봅니다.
function groundAhead(scene, e) {
  const ahead = e.x + e.dir * e.displayWidth * CFG.ground.edgeProbe;
  const feet = e.y + e.displayHeight / 2;

  return scene.platforms.getChildren().some((p) => {
    if (Math.abs(p.y - CFG.platformH / 2 - feet) > 20) return false;
    return ahead > p.x - p.displayWidth / 2 && ahead < p.x + p.displayWidth / 2;
  });
}

// ── 나는 적 ───────────────────────────────────────────────
function airStep(scene, e, player, time) {
  const angle = Phaser.Math.Angle.Between(e.x, e.y, player.x, player.y);
  const dist = Phaser.Math.Distance.Between(e.x, e.y, player.x, player.y);

  if (e.def.move === 'ranged') {
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
}

function fireEnemyShot(scene, enemy, angle) {
  const b = scene.enemyBullets.create(enemy.x, enemy.y, 'enemy-bullet');
  b.body.setAllowGravity(false);
  b.setDepth(9);
  b.bornAt = scene.time.now;
  b.dmg = Math.round(CFG.enemyShot.damage * (1 + enemy.floor * CFG.enemy.dmgPerFloor));
  scene.physics.velocityFromRotation(angle, CFG.enemyShot.speed, b.body.velocity);
}

// ── 보스 ──────────────────────────────────────────────────
// 투기장 위에 붙박이로 떠 있습니다. 몸이 워낙 커서 어느 줄에 서 있든
// 근접 사거리 안에 들어옵니다 — 원거리와 같은 조건으로 때릴 수 있게 하려는 것입니다.
//
// 접촉 피해는 없습니다. 몸이 화면을 덮고 있어서 닿는 것을 피할 방법이 없고,
// 그러면 붙어야 하는 근접 직업만 일방적으로 손해입니다.
// 대신 줄을 골라 내리꽂습니다. 피하는 것은 좌우 이동으로만 합니다.
function spawnBoss(scene, floor, x, y) {
  const def = {
    key: 'boss', name: '탑의 수문장', hp: 0, speed: 0,
    dmg: 0, coin: CFG.boss.coin, ground: false, move: 'boss',
  };

  const e = scene.enemies.create(x, y, 'boss');
  e.setDepth(8);
  e.def = def;
  e.isBoss = true;
  e.body.setAllowGravity(false);
  e.body.setSize(e.width * 0.8, e.height * 0.8);

  e.maxHp = Math.round(CFG.enemy.baseHp * enemyHpScale(floor) * CFG.boss.hpMult);
  e.hp = e.maxHp;
  e.floor = floor;
  e.contactDamage = 0; // 위 주석 참고
  e.coin = CFG.boss.coin;
  // 근접이 닿는지는 몸 표면까지의 거리로 봅니다. 중심까지 재면 이만한 덩치는
  // 어떤 무기로도 닿지 않습니다. 넓적하므로 원이 아니라 사각형으로 잽니다 —
  // 원으로 잡으면 양옆 줄에서 안 닿아서 근접만 불리해집니다.
  e.hitW = e.displayWidth * 0.45;
  e.hitH = e.displayHeight * 0.42;
  e.nextVolleyAt = scene.time.now + CFG.boss.entryMs;
  e.nextAddAt = scene.time.now + CFG.boss.addEvery;

  scene.tweens.add({
    targets: e, scaleX: 1.04, scaleY: 0.96,
    duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut',
  });
  return e;
}

function bossStep(scene, e, player, time) {
  e.body.velocity.set(0, 0);
  if (scene.bossEntering) return;

  // 체력이 닳을수록 몰아칩니다.
  const left = Math.max(0, e.hp / e.maxHp);
  const gap = CFG.boss.minVolleyMs + (CFG.boss.volleyMs - CFG.boss.minVolleyMs) * left;

  if (time > e.nextVolleyAt) {
    e.nextVolleyAt = time + gap;
    bossVolley(scene, e, player);
  }

  if (time > e.nextAddAt && scene.enemies.countActive(true) < CFG.boss.maxAdds + 1) {
    e.nextAddAt = time + CFG.boss.addEvery;
    const type = pickEnemyType(e.floor);
    const add = spawnEnemy(scene, Phaser.Math.Between(90, CFG.width - 90),
      scene.cameras.main.scrollY - 30, e.floor, type);
    // 투기장에는 발판이 없습니다. 땅을 딛는 졸개를 부르면 그대로 떨어집니다.
    if (add) { add.body.setAllowGravity(false); add.def = Object.assign({}, add.def, { ground: false, move: 'chase' }); }
  }
}

// 세 줄 중 한둘을 골라 예고한 뒤 내리꽂습니다.
// 셋 다 덮으면 피할 수가 없으므로 최소 한 줄은 반드시 비웁니다.
function bossVolley(scene, boss, player) {
  const lanes = LANES.slice();
  const count = Math.random() < 0.45 ? 2 : 1;
  const targets = [];
  while (targets.length < count) {
    targets.push(lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0]);
  }

  const top = boss.y + boss.displayHeight * 0.35;
  const bottom = scene.arenaY;

  targets.forEach((lane) => {
    const x = CFG.laneX[lane];
    // 예고. 어디로 떨어지는지 보여 주지 않으면 피하는 것이 아니라 운입니다.
    const warn = scene.add.rectangle(x, (top + bottom) / 2, 96, bottom - top, 0xff5252, 0.16)
      .setDepth(6);
    scene.tweens.add({ targets: warn, alpha: 0.42, duration: 180, yoyo: true, repeat: -1 });

    scene.time.delayedCall(CFG.boss.telegraphMs, () => {
      warn.destroy();
      if (!boss.active || scene.dead) return;
      const b = scene.enemyBullets.create(x, top, 'boss-shot');
      b.body.setAllowGravity(false);
      b.setDepth(9);
      b.bornAt = scene.time.now;
      b.dmg = Math.round(CFG.boss.shotDamage * (1 + boss.floor * CFG.enemy.dmgPerFloor));
      b.body.velocity.set(0, 620);
    });
  });
}

// ── 박쥐 ──────────────────────────────────────────────────
// 상점을 떠난 뒤 오래 머무를수록 몰려듭니다.
// 도둑 박쥐는 코인이나 발판 위 아이템을 채 가고, 무는 박쥐는 체력을 깎습니다.
// 둘 다 한 번 일을 치르면 곧장 달아납니다 — 계속 따라붙으면 그냥 적입니다.
function spawnBat(scene, kind, floor) {
  const e = scene.enemies.create(
    Phaser.Math.Between(60, CFG.width - 60),
    scene.cameras.main.scrollY - 40, kind === 'biter' ? 'bat-biter' : 'bat-thief');

  e.setDepth(9);
  e.isBat = true;
  e.batKind = kind;
  e.def = { key: 'bat', name: '박쥐', ground: false, move: 'chase', coin: 0 };
  e.body.setAllowGravity(false);
  e.maxHp = Math.round(CFG.enemy.baseHp * enemyHpScale(floor) * 0.35);
  e.hp = e.maxHp;
  e.floor = floor;
  e.coin = 0; // 잡아도 코인은 안 나옵니다. 쫓아내는 것이 목적입니다
  e.speed = CFG.bats.speed;
  e.contactDamage = kind === 'biter'
    ? Math.round(CFG.bats.damage * (1 + floor * CFG.enemy.dmgPerFloor)) : 0;
  e.phase = Math.random() * Math.PI * 2;

  // 도둑 박쥐는 가끔 주인공 대신 발판 위 아이템을 노립니다.
  if (kind === 'thief' && Math.random() < CFG.bats.itemOdds) e.itemTarget = findLootSlot(scene);

  scene.tweens.add({ targets: e, scaleX: 1.25, scaleY: 0.8, duration: 150, yoyo: true, repeat: -1 });
  return e;
}

// 아직 아무도 안 가져간 위층 아이템 하나를 고릅니다.
function findLootSlot(scene) {
  const found = [];
  for (let i = 1; i <= 4; i++) {
    const floor = scene.floors.get(scene.floorIndex + i);
    if (!floor) continue;
    for (const lane of LANES) {
      const slot = floor.slots[lane];
      if (slot && slot.view && !slot.taken && !slot.expired && ITEM_KINDS.has(slot.kind)) found.push(slot);
    }
  }
  return found.length ? found[Math.floor(Math.random() * found.length)] : null;
}

function batStep(scene, e, player, time) {
  // 일을 치렀으면 위로 달아납니다.
  if (e.fleeing) {
    e.body.velocity.set(e.fleeDir * 90, -300);
    if (e.y < scene.cameras.main.scrollY - 120) e.destroy();
    return;
  }

  // 아이템을 노리는 놈은 그 발판으로 갑니다.
  const t = e.itemTarget;
  if (t && !t.taken && !t.expired && t.view) {
    const angle = Phaser.Math.Angle.Between(e.x, e.y, t.x, t.y - 38);
    scene.physics.velocityFromRotation(angle, e.speed, e.body.velocity);
    if (Phaser.Math.Distance.Between(e.x, e.y, t.x, t.y - 38) < 26) scene.batStealsItem(e, t);
    return;
  }
  e.itemTarget = null;

  const angle = Phaser.Math.Angle.Between(e.x, e.y, player.x, player.y);
  const sway = Math.sin(time / 180 + e.phase) * 0.5;
  scene.physics.velocityFromRotation(angle + sway, e.speed, e.body.velocity);
}
