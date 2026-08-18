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

// ── 적 체력은 층을 안 탑니다 ───────────────────────────────
//
// 예전에는 층에 따라 **곱으로** 불어났습니다 (1.022^층). 무기가 열두 단계짜리
// 사다리라 주인공도 곱으로 세졌으니 맞춰 놓은 것이었는데, 그 사다리를
// 걷어내면서 같이 걷어냅니다.
//
// 남겨 두면 이렇게 됩니다. 무기가 서로 비슷비슷한 자루들이 되어 화력이
// 평평해지는데 적만 계속 곱으로 자라면, 어느 층부터는 **아무리 잘 골라도
// 안 죽는 벽**이 섭니다. 그건 어렵다기보다 답답합니다 — 실제로 그 말을
// 들었습니다. "최종 무기를 업그레이드해도 적이 잘 죽지 않는다."
//
// 그래서 기는 것은 0층에서나 500층에서나 같은 체력입니다. 위층의 무게는
// **누가 나오느냐**(거인·유령 같은 종류)와 **몇 마리냐**가 집니다 —
// 그 둘은 이미 층을 따라 자라고 있습니다 (enemyTypes 의 창 · enemyCount).
//
// 이 함수는 자리를 지키려고 남깁니다. 보스처럼 아직 이 값을 부르는 곳이
// 있고, 언젠가 "구간마다 한 번씩" 같은 계단을 넣는다면 여기가 그 자리입니다.
// 그 층에서 적이 코인을 흘릴 확률. **층이 깊어질수록 내려갑니다** (CFG.coin).
//
// 체력과는 반대 방향입니다. 체력은 층을 따라 안 자라고(위 enemyHpScale) 대신
// 마릿수와 종류가 자라는데, **그 둘이 그대로 수입이 되어 버리는 것**을 여기서
// 되돌립니다. "센 놈이 많이 준다"는 규칙은 그대로 남습니다 — 줄이는 것은
// 마릿수가 곱으로 붙는 몫입니다.
function coinDropChance(floor) {
  const c = CFG.coin;
  return Math.max(c.minChance, c.dropChance / (1 + Math.max(0, floor) * c.taperPerFloor));
}

function enemyHpScale() {
  return 1;
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
  e.nextHopAt = scene.time.now + Math.random() * CFG.hop.interval;
  e.phaseUntil = scene.time.now + CFG.phase.onMs;
  e.phased = false;

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
    if (e.isGoldFrog) return goldFrogStep(scene, e, player, time);
    if (e.isMimic) return mimicStep(scene, e, player, time);
    if (e.def.ground) return groundStep(scene, e, player, time);
    return airStep(scene, e, player, time);
  });
}

// ── 땅을 딛는 적 ──────────────────────────────────────────
// 주인공이 멀면 발판 끝에서 돌아서며 순찰합니다. 그래야 올라가 보면 거기 있습니다.
// 가까워지면 낭떠러지를 개의치 않고 쫓아오다가 그대로 떨어집니다.
function groundStep(scene, e, player, time) {
  // 기절해 있는 동안은 제자리에 멎습니다 (전사 — scene-game.js 의 stunEnemy).
  // **전사가 버는 시간이 통째로 이 몇 줄입니다.**
  if (e.stunUntil && time < e.stunUntil) {
    if (e.body.blocked.down) e.body.velocity.x = 0;
    return;
  }

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

  // 뛰는 것 — 땅을 딛고 있을 때만 튀어오릅니다. 공중에서는 그대로 날아갑니다.
  if (e.def.move === 'hop') {
    if (e.body.blocked.down) {
      if (time > e.nextHopAt) {
        e.nextHopAt = time + CFG.hop.interval * (0.7 + Math.random() * 0.6);
        e.body.velocity.y = -CFG.hop.up;
        e.body.velocity.x = e.dir * CFG.hop.forward;
      } else {
        e.body.velocity.x = 0; // 착지해서 다음 도약을 준비합니다
      }
    }
    e.setFlipX(e.dir < 0);
    return;
  }

  // 돌진병 — 노려보다가 가로로 내닫습니다. 예고가 있어야 피할 수 있습니다.
  if (e.def.move === 'charge') return chargeStep(scene, e, player, time, near, dx);

  e.body.velocity.x = e.dir * e.speed;
  e.setFlipX(e.dir < 0);
}

// 노려보기 → 돌진 → 숨 고르기. 세 마디를 돕니다.
function chargeStep(scene, e, player, time, near, dx) {
  const c = CFG.charge;
  if (!e.chargePhase) { e.chargePhase = 'walk'; e.phaseUntil = 0; }

  if (time > e.phaseUntil) {
    if (e.chargePhase === 'walk' && near) {
      e.chargePhase = 'windup';
      e.phaseUntil = time + c.windupMs;
      e.chargeDir = Math.sign(dx) || e.dir;
      e.setTint(0xff8a80); // 예고 — 이제 내닫습니다
    } else if (e.chargePhase === 'windup') {
      e.chargePhase = 'dash';
      e.phaseUntil = time + c.dashMs;
      e.clearTint();
    } else if (e.chargePhase === 'dash') {
      e.chargePhase = 'rest';
      e.phaseUntil = time + c.restMs;
    } else {
      e.chargePhase = 'walk';
      e.phaseUntil = time + 200;
    }
  }

  if (e.chargePhase === 'windup' || e.chargePhase === 'rest') {
    e.body.velocity.x = 0;
    return;
  }
  if (e.chargePhase === 'dash') {
    e.body.velocity.x = e.chargeDir * c.speed;
    e.setFlipX(e.chargeDir < 0);
    return;
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
  // 나는 것도 기절하면 그 자리에 멎습니다. 위 groundStep 과 같은 이유입니다.
  if (e.stunUntil && time < e.stunUntil) { e.body.velocity.set(0, 0); return; }

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

  // 급강하 — 머리 위로 올라가 잠깐 멎었다가 곧장 내리꽂습니다.
  if (e.def.move === 'dive') return diveStep(scene, e, player, time);

  // 유령 — 나타났다 사라졌다 합니다. 사라진 동안은 때릴 수 없습니다.
  if (e.def.move === 'phase') {
    if (time > e.phaseUntil) {
      e.phased = !e.phased;
      e.phaseUntil = time + (e.phased ? CFG.phase.offMs : CFG.phase.onMs);
      e.setAlpha(e.phased ? 0.25 : 1);
    }
    scene.physics.velocityFromRotation(angle, e.speed * (e.phased ? 1.4 : 1), e.body.velocity);
    return;
  }

  scene.physics.velocityFromRotation(angle, e.speed, e.body.velocity);
}

// 올라가기 → 겨누기 → 내리꽂기 → 다시 올라가기.
function diveStep(scene, e, player, time) {
  const d = CFG.dive;
  if (!e.divePhase) { e.divePhase = 'rise'; e.phaseUntil = 0; }

  if (e.divePhase === 'rise') {
    // 주인공 머리 위 자리를 잡습니다.
    const wantY = player.y - d.riseY;
    e.body.velocity.y = e.y > wantY ? -d.riseSpeed : d.riseSpeed * 0.4;
    e.body.velocity.x = Phaser.Math.Clamp((player.x - e.x) * 2.4, -e.speed, e.speed);
    if (Math.abs(e.y - wantY) < 26 && Math.abs(e.x - player.x) < 40) {
      e.divePhase = 'aim';
      e.phaseUntil = time + d.holdMs;
      e.setTint(0xffab91);
    }
    return;
  }

  if (e.divePhase === 'aim') {
    e.body.velocity.set(0, 0);
    if (time > e.phaseUntil) { e.divePhase = 'drop'; e.clearTint(); }
    return;
  }

  // 내리꽂는 중. 주인공보다 한참 아래로 내려가면 다시 올라갑니다.
  e.body.velocity.set(0, d.dropSpeed);
  if (e.y > player.y + 160) e.divePhase = 'rise';
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
// 이 층의 보스는 누구인가. 무작위가 아니라 차례입니다 —
// 되풀이해 오르는 게임에서 "다음은 누구"가 계획의 재료가 됩니다.
function bossKindFor(floor) {
  const kinds = (CFG.boss.kinds && CFG.boss.kinds.length) ? CFG.boss.kinds : null;
  if (!kinds) return { key: 'boss', name: '탑의 수문장', shot: 'boss-shot' };
  const band = Math.max(0, Math.round(floor / CFG.bossEvery) - 1);
  return kinds[band % kinds.length];
}

function spawnBoss(scene, floor, x, y) {
  const kind = bossKindFor(floor);
  // 그림이 없으면 도형으로 그려 둔 'boss' 로 물러납니다.
  const skin = scene.textures.exists(kind.key) ? kind.key : 'boss';
  const shot = scene.textures.exists(kind.shot) ? kind.shot : 'boss-shot';

  const def = {
    key: 'boss', name: kind.name, hp: 0, speed: 0,
    dmg: 0, coin: CFG.boss.coin, ground: false, move: 'boss',
  };

  const e = scene.enemies.create(x, y, skin);
  e.kind = kind;
  e.shotKey = shot;
  e.setDepth(8);
  e.def = def;
  e.isBoss = true;
  e.body.setAllowGravity(false);
  e.body.setSize(e.width * 0.8, e.height * 0.8);

  e.maxHp = Math.round(CFG.enemy.baseHp * enemyHpScale(floor) * (kind.hp || CFG.boss.hpMult));
  e.hp = e.maxHp;
  e.floor = floor;
  e.contactDamage = 0; // 위 주석 참고
  e.coin = CFG.boss.coin;
  // 근접이 닿는지는 몸 표면까지의 거리로 봅니다. 중심까지 재면 이만한 덩치는
  // 어떤 무기로도 닿지 않습니다. 넓적하므로 원이 아니라 사각형으로 잽니다 —
  // 원으로 잡으면 양옆 줄에서 안 닿아서 근접만 불리해집니다.
  e.hitW = e.displayWidth * 0.45;
  e.hitH = e.displayHeight * 0.42;
  e.addEvery = kind.addEvery || CFG.boss.addEvery;
  e.maxAdds = kind.maxAdds || CFG.boss.maxAdds;
  e.nextVolleyAt = scene.time.now + CFG.boss.entryMs;
  e.nextAddAt = scene.time.now + e.addEvery;

  scene.tweens.add({
    targets: e, scaleX: 1.04, scaleY: 0.96,
    duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut',
  });
  return e;
}

// ── 황금개구리 ────────────────────────────────────────────
// 아주 낮은 확률로 나타나는 특별한 몬스터 (js/tower.js 의 SLOT.GOLDFROG).
// 보통 적의 종류 목록(CFG.enemyTypes)에는 넣지 않습니다 — 파도에 섞여
// 흔해지는 대신, 늘 낮은 확률로 "어쩌다 한 번" 나와야 특별하게 느껴집니다.
// 잡으면 층에 따라 불어나는 큰 코인을 한꺼번에 줍니다 — 위층 상점 값이
// 오르는 것을 벌충하려는 몫입니다.
function spawnGoldFrog(scene, x, y, floor) {
  if (scene.enemies.countActive(true) >= CFG.maxEnemies) return null;
  const g = CFG.goldfrog;
  const skin = scene.textures.exists('e-goldfrog') ? 'e-goldfrog' : 'e-hopper';
  const def = {
    key: 'goldfrog', name: '황금개구리', from: 0,
    hp: g.hpScale, speed: 1, dmg: g.dmg, coin: 0,
    // move 는 제 것을 씁니다 (goldFrogStep). 「뛰는 것」의 hop 을 물려 썼더니
    // 발판을 넘겨 밟고 떨어져서, 나타나기만 하고 잡을 수가 없었습니다.
    scale: g.visualScale, ground: true, move: 'goldfrog',
  };

  const e = scene.enemies.create(x, y, skin);
  e.setDepth(8);
  e.setScale(def.scale);
  e.body.setAllowGravity(true);
  e.body.setGravityY(CFG.ground.gravity);
  e.dir = Math.random() < 0.5 ? -1 : 1;
  e.def = def;
  e.isGoldFrog = true;
  e.maxHp = Math.round((CFG.enemy.baseHp + floor * CFG.enemy.hpPerFloor)
    * enemyHpScale(floor) * g.hpScale);
  e.hp = e.maxHp;
  e.speed = g.paceSpeed;
  e.floor = floor;
  e.frogFloor = floor;                       // 지금 딛고 있는 층
  e.frogClimbAt = scene.time.now + g.climbEvery;
  e.contactDamage = Math.round(g.dmg * (1 + floor * CFG.enemy.dmgPerFloor));
  e.coin = Math.round(g.coinBase * (1 + floor * g.coinPerFloor));
  e.phase = Math.random() * Math.PI * 2;

  scene.tweens.add({ targets: e, scaleX: def.scale * 1.15, scaleY: def.scale * 0.85, duration: 260, yoyo: true, repeat: -1 });
  return e;
}

// ── 황금개구리의 움직임 ───────────────────────────────────
// 발판 위를 서성이다가, 이따금 **바로 위층 발판으로** 뛰어오릅니다.
//
// 물리로 뛰게 하지 않습니다. 속도를 줘서 던지면 착지 지점이 그때그때
// 달라지는데, 발판은 140 밖에 안 되고 조금만 어긋나면 그대로 떨어집니다
// (그게 원래 버그였습니다). 갈 곳을 먼저 정하고 포물선으로 옮기면
// **빗나갈 수가 없습니다.**
function goldFrogStep(scene, e, player, time) {
  const g = CFG.goldfrog;

  // 뛰어오르는 중에는 트윈이 자리를 몹니다. 물리는 손대지 않습니다.
  if (e.frogHopping) { e.body.velocity.set(0, 0); return; }

  // 주인공을 한참 앞질러 갔으면 사라집니다. 안 쫓아온 사람을 위해 영영
  // 매달아 둘 이유가 없고, 등장 한도만 차지합니다.
  if (player.y - e.y > CFG.floorHeight * g.vanishAbove) { e.destroy(); return; }

  const floor = scene.floors && scene.floors.get(e.frogFloor);
  const slots = floor ? LANES.map((l) => floor.slots[l]).filter(Boolean) : [];
  // reduce 에 null 을 씨앗으로 주면 첫 바퀴에서 그 null 의 x 를 읽어 터집니다.
  // 빈 배열은 위에서 걸렀으므로 씨앗 없이 접습니다.
  const here = slots.length
    ? slots.reduce((a, b) => (Math.abs(b.x - e.x) < Math.abs(a.x - e.x) ? b : a))
    : null;

  // 딛고 선 발판을 못 찾으면(지나간 층이 정리됐을 때) 그냥 제자리를 지킵니다.
  // 예전처럼 허공으로 뛰게 두면 그대로 떨어져 사라집니다.
  if (!here) { e.body.velocity.x = 0; return; }

  // 발판 안에서만 서성입니다. 가장자리에 닿으면 돌아섭니다.
  const half = CFG.platformW / 2 - 16;
  if (e.x < here.x - half) e.dir = 1;
  if (e.x > here.x + half) e.dir = -1;
  e.body.velocity.x = e.dir * g.paceSpeed;
  e.setFlipX(e.dir < 0);

  if (time < e.frogClimbAt) return;

  // ── 위층으로 한 번 뛰어오릅니다 ──────────────────────
  const up = scene.floors.get(e.frogFloor + 1);
  const lanes = up && LANES.map((l) => up.slots[l]).filter(Boolean);
  if (!lanes || !lanes.length) { e.frogClimbAt = time + g.climbEvery; return; }

  // 가장 가까운 줄로 올라갑니다 — 옆으로 크게 튀면 화면 밖으로 나갑니다.
  const to = lanes.reduce((a, b) => (Math.abs(b.x - e.x) < Math.abs(a.x - e.x) ? b : a));
  const fromX = e.x;
  const fromY = e.y;
  const toX = to.x;
  const toY = to.y - 26;

  e.frogHopping = true;
  e.frogClimbAt = time + g.climbEvery + g.climbMs;
  e.body.setAllowGravity(false);
  e.body.velocity.set(0, 0);
  e.setFlipX(toX < fromX);

  const arc = { t: 0 };
  scene.tweens.add({
    targets: arc, t: 1, duration: g.climbMs, ease: 'Linear',
    onUpdate: () => {
      if (!e.active) return;
      e.x = Phaser.Math.Linear(fromX, toX, arc.t);
      e.y = Phaser.Math.Linear(fromY, toY, arc.t) - Math.sin(Math.PI * arc.t) * g.climbArc;
    },
    onComplete: () => {
      if (!e.active) return;
      e.frogHopping = false;
      e.frogFloor += 1;
      e.floor = e.frogFloor;
      e.body.setAllowGravity(true);
    },
  });
}

// ── 미믹 ──────────────────────────────────────────────────
// 보물상자인 척하던 것이 밟히는 순간 일어섭니다 (js/scene-game.js 의 springMimic).
// 황금개구리처럼 CFG.enemyTypes 에는 없습니다 — 파도에 섞이는 것이 아니라
// 가짜 상자를 밟았을 때에만 나오는 것이라, 층별 종류 수(maxKinds)도 안 씁니다.
function spawnMimic(scene, x, y, floor) {
  if (scene.enemies.countActive(true) >= CFG.maxEnemies) return null;
  const m = CFG.mimic;
  // 상자 그림 그대로 일어섭니다. 이빨과 혀가 이미 그려져 있어서, 따로
  // 몬스터를 그리는 것보다 **밟은 그 상자가 살아났다**가 더 잘 읽힙니다.
  const skin = scene.textures.exists('item-fake-treasure') ? 'item-fake-treasure' : 'e-brute';
  const def = {
    key: 'mimic', name: '미믹', from: 0,
    hp: m.hpScale, speed: 1, dmg: m.dmg, coin: 0,
    scale: m.visualScale, ground: false, move: 'mimic',
  };

  const e = scene.enemies.create(x, y, skin);
  e.setDepth(9); // 쫓아오는 것이 무엇에 가려서는 안 됩니다
  e.setScale(def.scale);
  e.body.setAllowGravity(false); // 층을 가로질러 따라 올라옵니다
  e.def = def;
  e.isMimic = true;
  e.maxHp = Math.round((CFG.enemy.baseHp + floor * CFG.enemy.hpPerFloor)
    * enemyHpScale(floor) * m.hpScale);
  e.hp = e.maxHp;
  e.speed = m.speed;
  e.floor = floor;
  e.contactDamage = Math.round(m.dmg * (1 + floor * CFG.enemy.dmgPerFloor));
  e.nextBiteAt = 0;
  e.coin = Math.round(m.coinBase * (1 + floor * m.coinPerFloor));
  e.phase = Math.random() * Math.PI * 2;

  // 씹는 동작. 세로로 눌렸다 펴지는 것이 **입을 닫았다 벌리는 것**으로 읽힙니다.
  // 쫓아오는 내내 딱딱거리고 있어야 "먹으러 온다"가 됩니다.
  scene.tweens.add({
    targets: e, scaleY: def.scale * 0.62, scaleX: def.scale * 1.12,
    duration: m.chompMs, yoyo: true, repeat: -1, ease: 'Quad.in',
  });
  return e;
}

// 곧장, 쉬지 않고, 층을 무시하고 옵니다. 발판도 낭떠러지도 상관하지 않습니다.
function mimicStep(scene, e, player, time) {
  // 미믹도 기절합니다. 쫓기는 쪽에서는 이게 유일하게 숨 돌리는 틈입니다.
  if (e.stunUntil && time < e.stunUntil) { e.body.velocity.set(0, 0); return; }

  // 달아나는 데 성공했으면 놓아줍니다. 붙잡지 못한 것을 영영 매달아 두면
  // 등장 한도만 차지하고, 몇 층 위에서 뜬금없이 다시 나타납니다.
  if (player.y - e.y > CFG.floorHeight * CFG.mimic.vanishAbove) { e.destroy(); return; }

  const angle = Phaser.Math.Angle.Between(e.x, e.y, player.x, player.y);
  scene.physics.velocityFromRotation(angle, e.speed, e.body.velocity);
  e.setFlipX(player.x < e.x);
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

  if (time > e.nextAddAt && scene.enemies.countActive(true) < (e.maxAdds || CFG.boss.maxAdds) + 1) {
    e.nextAddAt = time + (e.addEvery || CFG.boss.addEvery);
    const type = pickEnemyType(e.floor);
    const add = spawnEnemy(scene, Phaser.Math.Between(90, CFG.width - 90),
      scene.cameras.main.scrollY - 30, e.floor, type);
    // 투기장에는 발판이 없습니다. 땅을 딛는 졸개를 부르면 그대로 떨어집니다.
    if (add) { add.body.setAllowGravity(false); add.def = Object.assign({}, add.def, { ground: false, move: 'chase' }); }
  }
}

// ── 보스의 공격 ───────────────────────────────────────────
// 어느 패턴이든 규칙은 하나입니다: 한 번에 세 줄을 다 덮지 않습니다.
// 다 덮으면 피하는 것이 아니라 그냥 맞는 것이고, 그건 실력이 낄 자리가 없습니다.
//
// 딱 하나 예외가 잿비(rain)입니다. 저것만은 세 줄을 다 덮습니다 — 대신
// 한 대가 3할밖에 안 아픕니다. 피할 수 없으면 가벼워야 한다는 뜻입니다.
const BOSS_PATTERNS = ['volley', 'sweep', 'slam', 'rain', 'spray'];
// 체력이 절반 넘게 남아 있는 동안 쓰는 것은 앞에서부터 이만큼입니다.
// 잿비는 처음부터 나옵니다 — 어려운 패턴이 아니라 **숨 돌릴 패턴**이라서,
// 뒤로 미루면 정작 힘든 후반에만 나오는 꼴이 됩니다.
const BOSS_EARLY = 4;

function bossVolley(scene, boss, player) {
  // 체력이 절반 아래로 내려가면 어려운 패턴도 섞습니다.
  const pool = boss.hp / boss.maxHp > 0.5 ? BOSS_PATTERNS.slice(0, BOSS_EARLY) : BOSS_PATTERNS;
  // 놈마다 즐겨 쓰는 것이 있습니다. 생김새가 알려 주는 위험과 하는 짓이
  // 맞아떨어져야 그림이 거짓말을 하지 않습니다.
  const favor = boss.kind && boss.kind.favor;
  const pattern = (favor && pool.indexOf(favor) >= 0 && Math.random() < CFG.boss.favorOdds)
    ? favor
    : pool[Math.floor(Math.random() * pool.length)];
  boss.lastPattern = pattern;

  if (pattern === 'sweep') {
    // 훑기 — 한쪽 끝에서 반대쪽으로 차례차례. 계속 같은 방향으로 도망쳐야 합니다.
    const order = Math.random() < 0.5 ? LANES.slice() : LANES.slice().reverse();
    order.forEach((lane, i) => bossDrop(scene, boss, lane, i * CFG.boss.sweepGapMs));
    return;
  }

  if (pattern === 'slam') {
    // 내리찍기 — 바깥 두 줄이 먼저, 잠시 뒤 가운데.
    // 가운데로 피했다가 다시 바깥으로 나와야 합니다.
    bossDrop(scene, boss, 'left', 0);
    bossDrop(scene, boss, 'right', 0);
    bossDrop(scene, boss, 'mid', CFG.boss.slamGapMs);
    return;
  }

  if (pattern === 'rain') return bossRain(scene, boss);

  if (pattern === 'spray') {
    // 흩뿌리기 — 한 줄에 세 발이 시차를 두고. 그 줄만 오래 위험합니다.
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    for (let i = 0; i < 3; i++) bossDrop(scene, boss, lane, i * 220);
    // 그동안 다른 한 줄에도 한 발.
    const other = LANES.filter((l) => l !== lane);
    bossDrop(scene, boss, other[Math.floor(Math.random() * other.length)], 480);
    return;
  }

  // 기본 — 한둘을 골라 동시에.
  const lanes = LANES.slice();
  const count = Math.random() < 0.45 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    bossDrop(scene, boss, lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0], 0);
  }
}

// ── 잿비 ──────────────────────────────────────────────────
// 줄을 고르는 공격이 아닙니다. 화면 폭 전체에 무작위로 떨어지므로 안전한
// 자리가 없고, 대신 한 대가 3할밖에 안 아픕니다 (CFG.boss.rain).
//
// 예고도 줄이 아니라 **하늘 전체**입니다. 어디가 위험한지가 아니라
// "지금부터 어디든 위험하다"를 알려야 하니까요.
function bossRain(scene, boss) {
  const r = CFG.boss.rain;
  const top = boss.y + boss.displayHeight * 0.35;

  const sky = scene.add.rectangle(CFG.width / 2, (top + scene.arenaY) / 2,
    CFG.width, scene.arenaY - top, 0xff7043, 0.10).setDepth(5);
  scene.tweens.add({ targets: sky, alpha: 0.26, duration: 200, yoyo: true, repeat: -1 });
  scene.time.delayedCall(r.warnMs + r.count * r.gapMs, () => sky.destroy());

  // 떨어질 자리는 **폭을 count 칸으로 나눠 한 칸에 하나씩**입니다.
  // 순서만 섞습니다.
  //
  // 처음에는 x 를 통째로 무작위로 뽑았는데, 그러면 열네 발이 한쪽에 몰려서
  // 반대쪽 한 줄이 통째로 비는 판이 이따금 나옵니다 (시험이 잡아냈습니다).
  // 안전한 줄이 없다는 것이 이 패턴의 전부인데, 그게 확률에 맡겨져 있으면
  // 안 됩니다. 자리는 고르게 두고 **언제 오는지**만 못 맞추게 합니다.
  const band = (CFG.width - r.spread * 2) / r.count;
  const spots = [];
  for (let i = 0; i < r.count; i++) {
    spots.push(Math.round(r.spread + band * (i + 0.5) + Phaser.Math.Between(-band / 3, band / 3)));
  }
  Phaser.Utils.Array.Shuffle(spots);

  for (let i = 0; i < r.count; i++) {
    scene.time.delayedCall(r.warnMs + i * r.gapMs, () => {
      if (!boss.active || scene.dead || !scene.bossFight) return;
      const x = spots[i];
      const b = scene.enemyBullets.create(x, top, boss.shotKey || 'boss-shot');
      b.body.setAllowGravity(false);
      b.setDepth(9).setScale(r.scale);
      b.bornAt = scene.time.now;
      b.dmg = Math.round(CFG.boss.shotDamage * r.damageScale
        * (1 + boss.floor * CFG.enemy.dmgPerFloor));
      // fromBoss 를 안 붙입니다 — 자리로 못 피하는 공격이니 회피까지
      // 깎으면 도적에게는 피할 방법이 하나도 안 남습니다 (위 CFG 주석).
      b.body.velocity.set(0, r.speed);
    });
  }
}

// 한 줄에 하나. 예고를 띄우고 telegraphMs 뒤에 떨어뜨립니다.
// 어디로 떨어지는지 보여 주지 않으면 피하는 것이 아니라 운입니다.
function bossDrop(scene, boss, lane, delay) {
  scene.time.delayedCall(delay, () => {
    if (!boss.active || scene.dead || !scene.bossFight) return;

    const x = CFG.laneX[lane];
    const top = boss.y + boss.displayHeight * 0.35;
    const bottom = scene.arenaY;
    const warn = scene.add.rectangle(x, (top + bottom) / 2, 96, bottom - top, 0xff5252, 0.16)
      .setDepth(6);
    scene.tweens.add({ targets: warn, alpha: 0.42, duration: 180, yoyo: true, repeat: -1 });

    scene.time.delayedCall(CFG.boss.telegraphMs, () => {
      warn.destroy();
      if (!boss.active || scene.dead || !scene.bossFight) return;
      const b = scene.enemyBullets.create(x, top, boss.shotKey || 'boss-shot');
      b.body.setAllowGravity(false);
      b.setDepth(9);
      b.bornAt = scene.time.now;
      b.dmg = Math.round(CFG.boss.shotDamage * (1 + boss.floor * CFG.enemy.dmgPerFloor));
      // 보스가 내리꽂은 것이라는 표. 도적의 회피가 여기에는 덜 통합니다
      // (scene-game.js 의 hurt).
      b.fromBoss = true;
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
