// 이미지 파일 없이 도형으로 그림을 만들어 씁니다.
// 나중에 진짜 그림이 나오면 이 파일만 걷어내고 load.image()로 바꾸면 됩니다.

function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });

  // 그림(art/*.svg)이 이미 구워져 있는 키는 건너뜁니다. 도형은 그림이 없는
  // 것들의 자리를 메우는 밑그림입니다 — 그림이 한 장 늘 때마다 하나씩 물러납니다.
  const bake = (key, w, h) => {
    if (scene.textures.exists(key)) return;
    g.generateTexture(key, w, h);
  };

  // ── 주인공 ────────────────────────────────────────────
  // 직업마다 실루엣을 다르게 둡니다. 어깨·후드·망토처럼 윤곽에서 갈리게 해야
  // 작게 줄여도 구분됩니다. 색만 바꾸면 멀리서 똑같아 보입니다.

  // 전사 — 각진 어깨와 투구. 셋 중 가장 넓습니다.
  g.clear();
  g.fillStyle(0x546e7a, 1);
  g.fillRoundedRect(3, 20, 32, 24, 4);        // 어깨 갑옷
  g.fillStyle(0x78909c, 1);
  g.fillRect(6, 26, 26, 5);                    // 가슴 띠
  g.fillStyle(0xef9a9a, 1);
  g.fillRoundedRect(9, 40, 20, 8, 3);          // 허리 아래
  g.fillStyle(0x90a4ae, 1);
  g.fillRoundedRect(8, 4, 22, 18, 6);          // 투구
  g.fillStyle(0x263238, 1);
  g.fillRect(11, 12, 16, 4);                   // 눈 구멍
  g.fillStyle(0xef5350, 1);
  g.fillTriangle(19, 0, 15, 6, 23, 6);         // 투구 깃
  bake('player-warrior', 38, 48);

  // 궁수 — 뾰족한 후드와 등에 멘 활. 몸이 가늡니다.
  g.clear();
  g.fillStyle(0x66bb6a, 1);
  g.lineStyle(3, 0x33691e, 1);
  g.beginPath();
  g.arc(28, 24, 12, Phaser.Math.DegToRad(-72), Phaser.Math.DegToRad(72), false);
  g.strokePath();                              // 등 뒤 활
  g.fillStyle(0x81c784, 1);
  g.fillRoundedRect(9, 20, 20, 22, 5);         // 몸
  g.fillStyle(0x4caf50, 1);
  g.fillRoundedRect(11, 40, 16, 8, 3);
  g.fillStyle(0xffe0b2, 1);
  g.fillCircle(19, 14, 8);                     // 얼굴
  g.fillStyle(0x2e7d32, 1);
  g.fillTriangle(8, 16, 19, 0, 30, 16);        // 뾰족한 후드
  g.fillStyle(0xffe0b2, 1);
  g.fillCircle(19, 15, 6);
  bake('player-archer', 42, 48);

  // 도적 — 낮게 웅크린 자세, 펄럭이는 망토, 얼굴 가리개.
  g.clear();
  g.fillStyle(0x7e57c2, 1);
  g.fillTriangle(2, 22, 16, 20, 10, 46);       // 뒤로 날리는 망토
  g.fillStyle(0xb39ddb, 1);
  g.fillRoundedRect(11, 22, 19, 20, 6);        // 몸
  g.fillStyle(0x5e35b1, 1);
  g.fillRoundedRect(13, 40, 15, 8, 3);
  g.fillStyle(0xffe0b2, 1);
  g.fillCircle(21, 15, 8);
  g.fillStyle(0x4527a0, 1);
  g.fillRoundedRect(12, 5, 18, 11, 5);         // 후드
  g.fillRect(13, 16, 16, 5);                   // 얼굴 가리개
  g.fillStyle(0xffee58, 1);
  g.fillCircle(18, 14, 2);                     // 눈
  g.fillCircle(25, 14, 2);
  bake('player-rogue', 40, 48);

  // ── 적 ────────────────────────────────────────────────
  // 종류마다 실루엣과 색을 다르게 해서 멀리서도 구분되게 합니다.

  // 코인벌레 — 아주 처음부터 만나는, 한 대에 죽는 상대.
  // 작고 동글동글하고 황금빛입니다. 다른 적이 전부 붉거나 어두운 쪽이라
  // 이것만 반짝이면 "잡아도 되는 것"으로 먼저 읽힙니다.
  g.clear();
  g.fillStyle(0xffca28, 1);
  g.fillEllipse(14, 14, 22, 16);
  g.fillStyle(0xff8f00, 1);
  for (let i = 0; i < 3; i++) g.fillRect(3 + i * 8, 19, 3, 5); // 짧은 다리
  g.fillStyle(0x5d4037, 1);
  g.fillCircle(10, 12, 2.2);
  g.fillCircle(18, 12, 2.2);
  g.fillStyle(0xfff9c4, 1);
  g.fillCircle(19, 8, 2); // 등껍질의 윤
  bake('e-coinbug', 28, 26);

  // 기는 것 — 납작하고 다리가 달린 작은 놈
  g.clear();
  g.fillStyle(0xef5350, 1);
  g.fillEllipse(16, 18, 28, 20);
  g.fillStyle(0xb71c1c, 1);
  for (let i = 0; i < 4; i++) g.fillRect(3 + i * 8, 26, 4, 6);
  g.fillStyle(0x3e2723, 1);
  g.fillCircle(11, 15, 3);
  g.fillCircle(21, 15, 3);
  bake('e-crawler', 32, 32);

  // 단단한 놈 — 각지고 두꺼운 갑옷
  g.clear();
  g.fillStyle(0x8d6e63, 1);
  g.fillRoundedRect(2, 4, 28, 26, 4);
  g.fillStyle(0x5d4037, 1);
  g.fillRect(2, 14, 28, 5);
  g.fillRect(14, 4, 5, 26);
  g.fillStyle(0xffab91, 1);
  g.fillCircle(10, 10, 3);
  g.fillCircle(22, 10, 3);
  bake('e-brute', 32, 34);

  // 날것 — 날개 달린 보라색
  g.clear();
  g.fillStyle(0x7e57c2, 1);
  g.fillCircle(18, 16, 11);
  g.fillStyle(0x9575cd, 1);
  g.fillTriangle(8, 16, 0, 6, 2, 24);
  g.fillTriangle(28, 16, 36, 6, 34, 24);
  g.fillStyle(0xede7f6, 1);
  g.fillCircle(15, 14, 3);
  g.fillCircle(22, 14, 3);
  bake('e-flyer', 36, 32);

  // 빠른 놈 — 앞으로 쏠린 화살 모양
  g.clear();
  g.fillStyle(0xffca28, 1);
  g.fillTriangle(0, 4, 0, 26, 30, 15);
  g.fillStyle(0xf57f17, 1);
  g.fillTriangle(0, 10, 0, 20, 14, 15);
  g.fillStyle(0x3e2723, 1);
  g.fillCircle(18, 15, 3);
  bake('e-dasher', 32, 30);

  // 거인 — 크고 어둡고 뿔이 있음
  g.clear();
  g.fillStyle(0xad1457, 1);
  g.fillRoundedRect(2, 8, 32, 28, 8);
  g.fillStyle(0x880e4f, 1);
  g.fillTriangle(2, 10, 10, 0, 12, 12);
  g.fillTriangle(34, 10, 26, 0, 24, 12);
  g.fillStyle(0xff8a80, 1);
  g.fillCircle(12, 20, 4);
  g.fillCircle(24, 20, 4);
  bake('e-giant', 36, 38);

  // 사수 — 눈 하나에 포신
  g.clear();
  g.fillStyle(0x26a69a, 1);
  g.fillCircle(16, 16, 13);
  g.fillStyle(0x004d40, 1);
  g.fillRect(14, 26, 12, 6);
  g.fillStyle(0xe0f2f1, 1);
  g.fillCircle(16, 14, 6);
  g.fillStyle(0x004d40, 1);
  g.fillCircle(16, 14, 3);
  bake('e-shooter', 34, 34);

  // 뛰는 것 — 뒷다리가 굵은 개구리꼴
  g.clear();
  g.fillStyle(0x8bc34a, 1);
  g.fillEllipse(17, 16, 30, 22);
  g.fillStyle(0x558b2f, 1);
  g.fillEllipse(6, 24, 12, 12);   // 뒷다리
  g.fillEllipse(28, 24, 12, 12);
  g.fillStyle(0xf1f8e9, 1);
  g.fillCircle(12, 12, 4);
  g.fillCircle(22, 12, 4);
  g.fillStyle(0x33691e, 1);
  g.fillCircle(12, 12, 2);
  g.fillCircle(22, 12, 2);
  bake('e-hopper', 34, 32);

  // 황금개구리 — 뛰는 것과 같은 몸이지만 온통 금빛입니다.
  // 실루엣을 일부러 같이 둡니다. 움직임을 이미 아는 놈이어야 "쫓아갈까"를
  // 바로 정할 수 있습니다 — 색만 보고 값어치를 알아보면 됩니다.
  g.clear();
  g.fillStyle(0xffca28, 1);
  g.fillEllipse(17, 16, 30, 22);
  g.fillStyle(0xf9a825, 1);
  g.fillEllipse(6, 24, 12, 12);   // 뒷다리
  g.fillEllipse(28, 24, 12, 12);
  g.fillStyle(0xfff9c4, 1);
  g.fillCircle(12, 12, 4);
  g.fillCircle(22, 12, 4);
  g.fillStyle(0x5d4037, 1);
  g.fillCircle(12, 12, 2);
  g.fillCircle(22, 12, 2);
  g.fillStyle(0xfff59d, 1);
  g.fillCircle(17, 20, 3); // 배에 얹힌 금빛
  bake('e-goldfrog', 34, 32);

  // 돌진병 — 앞으로 내민 방패
  g.clear();
  g.fillStyle(0x795548, 1);
  g.fillRoundedRect(8, 6, 24, 26, 6);
  g.fillStyle(0xa1887f, 1);
  g.fillRoundedRect(0, 2, 10, 34, 3); // 방패
  g.fillStyle(0xffe082, 1);
  g.fillCircle(5, 19, 3);
  g.fillStyle(0xff8a80, 1);
  g.fillCircle(20, 16, 4);
  g.fillCircle(28, 16, 4);
  bake('e-charger', 36, 38);

  // 폭탄충 — 도화선이 달린 둥근 몸
  g.clear();
  g.fillStyle(0x546e7a, 1);
  g.fillCircle(17, 20, 14);
  g.fillStyle(0x263238, 1);
  g.fillRect(15, 2, 4, 8); // 심지
  g.fillStyle(0xffa726, 1);
  g.fillCircle(17, 2, 4);  // 불꽃
  g.fillStyle(0xff5252, 1);
  g.fillCircle(12, 19, 3);
  g.fillCircle(22, 19, 3);
  bake('e-bomber', 34, 36);

  // 쪼개지는 것 — 가운데 금이 간 덩어리
  g.clear();
  g.fillStyle(0x00897b, 1);
  g.fillRoundedRect(2, 4, 32, 28, 10);
  g.fillStyle(0x004d40, 1);
  g.fillRect(16, 4, 4, 28); // 갈라질 자리
  g.fillStyle(0xb2dfdb, 1);
  g.fillCircle(10, 16, 4);
  g.fillCircle(26, 16, 4);
  bake('e-splitter', 36, 36);

  // 급강하 — 접은 날개에 뾰족한 부리
  g.clear();
  g.fillStyle(0x5c6bc0, 1);
  g.fillTriangle(2, 2, 18, 14, 2, 20);
  g.fillTriangle(34, 2, 18, 14, 34, 20);
  g.fillStyle(0x283593, 1);
  g.fillEllipse(18, 16, 16, 22);
  g.fillStyle(0xffca28, 1);
  g.fillTriangle(13, 26, 23, 26, 18, 36); // 부리
  g.fillStyle(0xffffff, 1);
  g.fillCircle(14, 13, 3);
  g.fillCircle(22, 13, 3);
  bake('e-diver', 36, 38);

  // 유령 — 아래가 너울거리는 반투명한 것
  g.clear();
  g.fillStyle(0xb39ddb, 0.85);
  g.fillCircle(17, 15, 14);
  g.fillTriangle(3, 15, 10, 34, 17, 20);
  g.fillTriangle(17, 20, 24, 34, 31, 15);
  g.fillStyle(0x311b92, 1);
  g.fillCircle(12, 13, 3.5);
  g.fillCircle(22, 13, 3.5);
  bake('e-ghost', 34, 36);

  // ── 박쥐 ──────────────────────────────────────────────
  // 도둑 — 자루를 든 보라색 박쥐
  g.clear();
  g.fillStyle(0x7e57c2, 1);
  g.fillTriangle(0, 4, 14, 14, 0, 22);   // 왼 날개
  g.fillTriangle(40, 4, 26, 14, 40, 22); // 오른 날개
  g.fillStyle(0x5e35b1, 1);
  g.fillRoundedRect(13, 6, 14, 18, 6);
  g.fillTriangle(13, 8, 17, 0, 20, 8);   // 귀
  g.fillTriangle(27, 8, 23, 0, 20, 8);
  g.fillStyle(0xffe082, 1);
  g.fillCircle(17, 13, 2.5);
  g.fillCircle(23, 13, 2.5);
  g.fillStyle(0xffca28, 1);
  g.fillCircle(20, 26, 5); // 훔친 것을 담는 자루
  bake('bat-thief', 40, 32);

  // 무는 놈 — 붉고 이빨이 보임
  g.clear();
  g.fillStyle(0xc62828, 1);
  g.fillTriangle(0, 4, 14, 14, 0, 22);
  g.fillTriangle(40, 4, 26, 14, 40, 22);
  g.fillStyle(0x8e0000, 1);
  g.fillRoundedRect(13, 6, 14, 18, 6);
  g.fillTriangle(13, 8, 17, 0, 20, 8);
  g.fillTriangle(27, 8, 23, 0, 20, 8);
  g.fillStyle(0xffcdd2, 1);
  g.fillCircle(17, 12, 2.5);
  g.fillCircle(23, 12, 2.5);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(16, 20, 19, 20, 17.5, 26); // 송곳니
  g.fillTriangle(21, 20, 24, 20, 22.5, 26);
  bake('bat-biter', 40, 32);

  // ── 보스 ──────────────────────────────────────────────
  // 투기장 폭을 거의 다 덮는 덩치. 어느 줄에 서 있어도 근접이 닿아야 합니다.
  g.clear();
  g.fillStyle(0x311b92, 1);
  g.fillRoundedRect(10, 40, 300, 190, 40);
  g.fillStyle(0x4527a0, 1);
  g.fillRoundedRect(30, 60, 260, 120, 34);
  // 뿔
  g.fillStyle(0x1a237e, 1);
  g.fillTriangle(10, 46, 52, 0, 74, 56);
  g.fillTriangle(310, 46, 268, 0, 246, 56);
  // 눈 — 크고 붉게. 무엇을 보고 있는지 알 수 있게
  g.fillStyle(0xff5252, 1);
  g.fillCircle(112, 112, 30);
  g.fillCircle(208, 112, 30);
  g.fillStyle(0xfff59d, 1);
  g.fillCircle(112, 112, 13);
  g.fillCircle(208, 112, 13);
  // 아래턱 — 여기가 발판 가까이 내려옵니다
  g.fillStyle(0x1a237e, 1);
  g.fillRoundedRect(80, 186, 160, 44, 16);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 5; i++) g.fillTriangle(96 + i * 32, 186, 116 + i * 32, 186, 106 + i * 32, 214);
  bake('boss', 320, 240);

  // 보스가 내리꽂는 것 — 크고 무겁게
  g.clear();
  g.fillStyle(0x7c4dff, 1);
  g.fillCircle(18, 18, 16);
  g.fillStyle(0xe1bee7, 1);
  g.fillCircle(18, 18, 8);
  bake('boss-shot', 36, 36);

  // ── 탄 ────────────────────────────────────────────────
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 5);
  bake('bullet', 12, 12);

  g.clear();
  g.fillStyle(0xff5252, 1);
  g.fillCircle(8, 8, 7);
  g.fillStyle(0xffcdd2, 1);
  g.fillCircle(8, 8, 3);
  bake('enemy-bullet', 16, 16);

  // 파동 — 날아가는 초승달
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  g.arc(20, 22, 18, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false);
  g.arc(8, 22, 20, Phaser.Math.DegToRad(70), Phaser.Math.DegToRad(-70), true);
  g.closePath();
  g.fillPath();
  bake('wave', 44, 44);

  // 검을 휘두른 자국 — 눈썹 모양. 실제 사거리에 맞춰 늘려 씁니다.
  //
  // 예전에는 굵기가 일정한 호였습니다. 그러니 칼을 휘두른 자국이 아니라
  // 파동을 쏜 것처럼 보였습니다. 가운데가 두껍고 양 끝이 뾰족해야
  // "칼이 지나간 자리"로 읽힙니다.
  //
  // 바깥 호를 한 바퀴 그린 뒤, 안쪽 호를 거꾸로 되짚어 와서 그 사이를 채웁니다.
  // 안쪽 반지름을 양 끝에서 바깥에 붙여 두면 그 자리가 저절로 뾰족해집니다.
  g.clear();
  g.fillStyle(0xffffff, 1);
  {
    const cx = 70, cy = 70, outer = 62, inner = 42;
    const from = Phaser.Math.DegToRad(-52), to = Phaser.Math.DegToRad(52);
    const steps = 28;
    const angleAt = (i) => from + (to - from) * (i / steps);
    // 가운데(sin이 1)에서 가장 두껍고 양 끝(sin이 0)에서 두께가 0이 됩니다.
    const innerAt = (i) => outer - (outer - inner) * Math.sin(Math.PI * (i / steps));

    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = angleAt(i);
      const x = cx + Math.cos(a) * outer, y = cy + Math.sin(a) * outer;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const a = angleAt(i), r = innerAt(i);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fillPath();
  }
  bake('slash', 140, 140);

  // 화살 — 촉·대·깃. 날아가는 방향으로 돌려 씁니다.
  // 예전에는 그냥 흰 공이라 "공을 쏘는" 것처럼 보였습니다.
  g.clear();
  g.fillStyle(0xd7ccc8, 1);
  g.fillRect(6, 6, 22, 3);              // 대
  g.fillStyle(0xeceff1, 1);
  g.fillTriangle(28, 1, 28, 12, 38, 6.5); // 촉
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(0, 0, 8, 6.5, 0, 13);   // 깃
  g.fillTriangle(5, 0, 12, 6.5, 5, 13);
  bake('arrow', 38, 13);

  // 화살이 지나간 자리에 남는 흐릿한 선
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 18, 3);
  bake('arrow-trail', 18, 3);

  // ── 그 밖 ─────────────────────────────────────────────
  g.clear();
  g.fillStyle(0xffd54f, 1);
  g.fillCircle(9, 9, 8);
  g.fillStyle(0xf9a825, 1);
  g.fillCircle(9, 9, 5);
  g.fillStyle(0xfff9c4, 1);
  g.fillCircle(6, 6, 2);
  bake('coin', 18, 18);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(5, 5, 5);
  bake('spark', 10, 10);

  // ── 보스 전리품 ───────────────────────────────────────
  // **그림 파일을 안 씁니다.** 무기 일흔두 자루와 같은 방식으로 도형에서
  // 짓습니다 (아래 buildWeaponIcons). 전리품은 화면에서 아주 작게 도는
  // 물건이라 그림 한 장을 새로 뜰 값어치가 없습니다 — 주인공 키의 1/10 이면
  // 5px 쯤이고, 그 크기에서 살아남는 것은 **윤곽과 색 두 단**뿐입니다.
  //
  // 넉넉한 크기(40px)로 구워 두고 쓸 때 줄입니다. 반대로 하면 계단이 집니다.

  // 감시하는 눈 — 수문장의 눈. 흰자 · 붉은 홍채 · 검은 눈동자 · 흰 반짝임.
  g.clear();
  g.fillStyle(0xfff8e1, 1);
  g.fillCircle(20, 20, 18);
  g.fillStyle(0xff5252, 1);
  g.fillCircle(20, 20, 11);
  g.fillStyle(0x7f0000, 1);
  g.fillCircle(20, 20, 6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(15, 14, 4);
  bake('trophy-eye', 40, 40);

  // 그 뒤에 까는 옅은 빛. **빛은 눈이 아닙니다** — 크기는 시킨 대로 두고
  // 어두운 벽에서 5px 짜리가 묻히지 않게만 합니다.
  g.clear();
  for (let i = 6; i >= 1; i--) {
    g.fillStyle(0xff8a80, 0.06);
    g.fillCircle(24, 24, i * 4);
  }
  bake('trophy-eye-glow', 48, 48);

  // 눈이 쏘는 것. 화살이 아니라 **눈빛**이라 촉도 깃도 없습니다.
  g.clear();
  g.fillStyle(0xff8a80, 0.35);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0xffcdd2, 1);
  g.fillCircle(8, 8, 4.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 2);
  bake('trophy-bolt', 16, 16);

  g.destroy();

  buildWeaponIcons(scene);
}

// ── 무기 그림 ───────────────────────────────────────────
// 무기는 직업마다 열두 자루, 모두 서른여섯 자루입니다. 서른여섯 장을 손으로
// 그리는 대신 몇 가지 값으로 모양을 지어냅니다 (classes.js 의 icon).
//
// 지금은 전부 흰 외곽선입니다. 나중에 같은 무기라도 희귀도를 색으로 나눌 텐데,
// 그때는 ICON.stroke 를 희귀도만큼 돌려 가며 여러 벌 구우면 됩니다 —
// 모양을 짓는 코드는 그대로 두고 키에 희귀도만 붙이면 됩니다.
// 무기 아이콘의 칠. 예전에는 흰 선에 속이 빈 **기호**였습니다. 기호는 무엇인지
// 알려 주지만 갖고 싶게 만들지는 않습니다.
//
// 지금은 이 게임의 서른 장이 지키는 규칙을 그대로 씁니다 — 어두운 외곽선,
// 덩어리마다 세 단(어두운 면 · 바탕 · 밝은 면), 쇠붙이는 강철빛, 부속은 금빛.
// 날의 바탕색은 **그 무기의 색**입니다 (무기표의 color). 그래서 열두 자루가
// 색으로도 갈리고, 손에 든 무기와 HUD 의 그림이 같은 색으로 짝이 맞습니다.
//
// 나중에 희귀도가 붙으면 `rim` 을 희귀도 색으로 바꿔 테두리만 갈아입히면 됩니다 —
// 모양을 짓는 코드는 그대로 두고 색만 도는 자리입니다.
const ICON = {
  size: 48,
  stroke: 0x131826,   // 어두운 외곽선
  blade: 0xc3d4e4,    // 날의 바탕 — buildWeaponIcons 가 무기 색으로 갈아 끼웁니다
  shine: 0xffffff,    // 밝은 면
  gold: 0xffc94d,     // 코등이·구슬
  goldLit: 0xffe9a8,
  wood: 0x8d6e63,     // 자루·활대
  grip: 0x4e342e,
  fill: 0x0f1626,
  fillAlpha: 0.8,
  weight: 1.8,
};

// 색을 밝게/어둡게. 한 색에서 세 단을 만들 때 씁니다.
function iconShade(color, k) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * k));
  const b = Math.min(255, Math.round((color & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// 이 덩어리는 이 색으로. 외곽선은 늘 어둡습니다.
function iconPaint(g, fill) {
  g.fillStyle(fill, 1);
  g.lineStyle(ICON.weight, ICON.stroke, 1);
}

function weaponIconKey(jobKey, tier) {
  return 'w-' + jobKey + '-' + tier;
}

function iconPoly(g, pts) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function iconDot(g, x, y, r) {
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
}

// 날. 아래(baseY)에서 위(tipY)로 올라가며 끝에서 뾰족해집니다.
// curve 를 주면 한쪽으로 휘어 도(刀)가 됩니다.
function bladePoints(cx, baseY, tipY, hw, curve) {
  const steps = 10;
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = baseY + (tipY - baseY) * t;
    // 끝 4분의 1에서만 좁아집니다. 처음부터 좁히면 날이 아니라 송곳이 됩니다.
    const w = hw * Math.min(1, (1 - t) / 0.24);
    const bend = (curve || 0) * Math.sin(Math.PI * t) * 4.5;
    left.push([cx + bend - w, y]);
    right.push([cx + bend + w, y]);
  }
  return left.concat(right.reverse());
}

function iconGuard(g, cx, y, spec) {
  const gw = (spec.gw || 14) / 2; // spec 의 gw 는 코등이 전체 너비입니다
  switch (spec.guard) {
    case 'bar':
      iconPoly(g, [[cx - gw, y - 2.6], [cx + gw, y - 2.6], [cx + gw, y + 2.6], [cx - gw, y + 2.6]]);
      break;
    case 'cross': // 양 끝이 아래로 벌어진 십자
      iconPoly(g, [[cx - gw, y + 4], [cx - gw + 5, y - 3], [cx + gw - 5, y - 3], [cx + gw, y + 4]]);
      break;
    case 'wing': // 위로 젖혀 올린 뿔 한 쌍
      iconPoly(g, [[cx - 2, y + 3], [cx - gw, y - 9], [cx - gw * 0.5, y + 3]]);
      iconPoly(g, [[cx + 2, y + 3], [cx + gw, y - 9], [cx + gw * 0.5, y + 3]]);
      iconPoly(g, [[cx - 6, y - 1], [cx + 6, y - 1], [cx + 6, y + 3], [cx - 6, y + 3]]);
      break;
    case 'ring': // 가로대 양 끝에 고리
      iconPoly(g, [[cx - gw + 4, y - 2.2], [cx + gw - 4, y - 2.2], [cx + gw - 4, y + 2.2], [cx - gw + 4, y + 2.2]]);
      iconDot(g, cx - gw + 2, y, 3.4);
      iconDot(g, cx + gw - 2, y, 3.4);
      break;
    default:
      break;
  }
}

// 이가 빠진 자국. 날 옆에 작은 삼각형을 얹어 톱니처럼 보이게 합니다.
function iconNotches(g, cx, baseY, tipY, hw) {
  for (let i = 0; i < 3; i++) {
    const y = baseY - (baseY - tipY) * (0.3 + i * 0.18);
    iconPoly(g, [[cx + hw - 1, y], [cx + hw + 3.4, y - 2.4], [cx + hw - 1, y - 5]]);
  }
}

function drawSword(g, spec) {
  const cx = ICON.size / 2;
  const gripLen = spec.art === 'dagger' ? 8 : 10;
  // 아래에서부터 자루 끝 구슬 · 자루 · 코등이 순으로 자리를 떼어 주고,
  // 남는 위쪽이 전부 날입니다. 날이 아이콘의 절반은 넘어야 검으로 읽힙니다.
  const guardY = ICON.size - 3.4 - gripLen - 3.4;
  const span = guardY - 3;
  // len 은 "가장 긴 날(0.76)에 견준 길이"입니다. 도적의 짧은 날이 0.4 언저리입니다.
  const tipY = guardY - span * Phaser.Math.Clamp(spec.len / 0.76, 0.4, 1);

  // 날 — 바탕을 깔고 **왼쪽에 좁은 밝은 면**을 겹칩니다. 그 한 겹이
  // 납작한 도형을 쇠붙이로 만듭니다 (빛은 늘 왼쪽 위에서 옵니다).
  const blade = (bx, hw, curve, top) => {
    iconPaint(g, ICON.blade);
    iconPoly(g, bladePoints(bx, guardY, top, hw, curve));
    g.fillStyle(iconShade(ICON.blade, 1.35), 0.85);
    g.lineStyle(0, 0, 0);
    iconPoly(g, bladePoints(bx - hw * 0.34, guardY - 1, top + 2.5, hw * 0.42, curve));
    iconPaint(g, ICON.blade);
  };

  if (spec.twin) {
    // 두 자루. 살짝 벌려 세워 한 자루와 실루엣이 갈리게 합니다.
    blade(cx - 5, spec.hw * 0.62, -0.35, tipY + 3);
    blade(cx + 5, spec.hw * 0.62, 0.35, tipY + 3);
  } else {
    blade(cx, spec.hw, spec.curve, tipY);
    if (spec.notch) {
      g.lineStyle(ICON.weight, ICON.stroke, 1);
      iconNotches(g, cx, guardY, tipY, spec.hw);
    }
  }

  iconPaint(g, ICON.gold);
  iconGuard(g, cx, guardY, spec);

  // 자루와 자루 끝
  iconPaint(g, ICON.grip);
  iconPoly(g, [[cx - 3, guardY], [cx + 3, guardY],
    [cx + 3, guardY + gripLen], [cx - 3, guardY + gripLen]]);
  iconPaint(g, ICON.gold);
  iconDot(g, cx, guardY + gripLen + 3.2, 3.4);
  g.fillStyle(ICON.goldLit, 1);
  g.lineStyle(0, 0, 0);
  g.fillCircle(cx - 1, guardY + gripLen + 2.2, 1.1);

  // 날 밑동의 보석 — 이름에 힘이 붙은 무기임을 한 점으로 알립니다.
  if (spec.gem) {
    const y = guardY - 9;
    iconPaint(g, iconShade(ICON.blade, 1.5));
    iconPoly(g, [[cx, y - 4.5], [cx + 3.6, y], [cx, y + 4.5], [cx - 3.6, y]]);
  }
}

function drawSpear(g) {
  const cx = ICON.size / 2;
  // 자루 — 아래에서 위까지 곧게. 검과 갈리는 것은 이 긴 대입니다.
  iconPaint(g, ICON.wood);
  iconPoly(g, [[cx - 1.7, 18], [cx + 1.7, 18], [cx + 1.7, ICON.size - 5], [cx - 1.7, ICON.size - 5]]);
  // 촉 — 좁고 긴 잎사귀. 왼쪽에 밝은 면을 겹칩니다
  iconPaint(g, ICON.blade);
  iconPoly(g, bladePoints(cx, 25, 3, 3.8, 0));
  g.fillStyle(iconShade(ICON.blade, 1.35), 0.85);
  g.lineStyle(0, 0, 0);
  iconPoly(g, bladePoints(cx - 1.3, 24, 5.5, 1.6, 0));
  // 촉 아래 가로대
  iconPaint(g, ICON.gold);
  iconPoly(g, [[cx - 8, 22.5], [cx + 8, 22.5], [cx + 8, 25.5], [cx - 8, 25.5]]);
  iconDot(g, cx, ICON.size - 4, 2.8);
}

// 활 — 오른쪽으로 배가 불룩하고, 시위가 그 왼쪽에 곧게 섭니다.
// 화살은 시위에 메겨 오른쪽을 향합니다. shots 가 많은 활일수록 여러 대입니다.
function drawBow(g, spec) {
  const cx = ICON.size / 2, cy = ICON.size / 2;
  const r = spec.big ? 20 : 17;
  const ox = cx - 7;
  const span = Phaser.Math.DegToRad(spec.recurve ? 62 : 74);

  // 활대 — 어두운 심 위에 밝은 결을 겹칩니다. 굵은 선 하나면 막대로 보입니다.
  g.lineStyle(ICON.weight + 3.2, ICON.stroke, 1);
  g.beginPath();
  g.arc(ox, cy, r, -span, span, false);
  g.strokePath();
  g.lineStyle(ICON.weight + 1.4, ICON.wood, 1);
  g.beginPath();
  g.arc(ox, cy, r, -span, span, false);
  g.strokePath();
  g.lineStyle(1, iconShade(ICON.wood, 1.4), 0.9);
  g.beginPath();
  g.arc(ox, cy, r - 1, -span * 0.9, span * 0.2, false);
  g.strokePath();

  const tipX = ox + Math.cos(span) * r, tipY = Math.sin(span) * r;

  // 각궁 — 끝이 반대로 젖혀집니다. 굽은 방향이 뒤집히는 것이 각궁의 표입니다.
  if (spec.recurve) {
    [[ICON.weight + 3.2, ICON.stroke], [ICON.weight + 1.4, ICON.wood]].forEach(([wd, col]) => {
      g.lineStyle(wd, col, 1);
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.arc(tipX - 5, cy + s * (tipY + 4), 6,
          Phaser.Math.DegToRad(s > 0 ? -95 : 5), Phaser.Math.DegToRad(s > 0 ? -5 : 95), false);
        g.strokePath();
      });
    });
  }

  // 시위 — 밝아야 활대와 갈립니다
  g.lineStyle(1.4, 0xf5efe0, 0.95);
  g.lineBetween(tipX, cy - tipY, tipX, cy + tipY);

  // 메긴 화살. 세 대까지입니다 — 그 위로는 빗살무늬가 되어 활이 안 보입니다.
  // 촉은 **그 무기의 색**입니다. 활은 나무라 색이 안 붙으니, 단계가 오른 것이
  // 보이는 자리는 여기뿐입니다.
  const rows = Math.min(3, spec.arrows || 1);
  for (let i = 0; i < rows; i++) {
    const y = cy + (i - (rows - 1) / 2) * (rows > 2 ? 8 : 9);
    g.lineStyle(2.6, ICON.stroke, 1);
    g.lineBetween(tipX - 12, y, tipX + 13, y);
    g.lineStyle(1.2, ICON.wood, 1);
    g.lineBetween(tipX - 12, y, tipX + 13, y);
    iconPaint(g, ICON.blade);
    iconPoly(g, [[tipX + 18, y], [tipX + 11, y - 3.6], [tipX + 11, y + 3.6]]);
  }

  if (spec.gem) {
    iconPaint(g, iconShade(ICON.blade, 1.5));
    iconPoly(g, [[ox + r - 2, cy - 5], [ox + r + 3, cy], [ox + r - 2, cy + 5], [ox + r - 7, cy]]);
  }
}

// 석궁 — 활을 가로로 눕혀 개머리에 얹은 것.
//
// 처음에는 활대를 호(arc)로 그렸는데, 젖힌 끝이 날개처럼 보여서 새인지 활인지
// 알 수가 없었습니다. 얕은 초승달 하나로 눕히고 개머리를 곧게 세우니
// "T자 위에 활을 얹은 것"이라는 실루엣이 한눈에 잡힙니다.
function drawCrossbow(g, spec) {
  const cx = ICON.size / 2, cy = ICON.size / 2 + 2;
  const half = spec.big ? 19 : 16;
  const rise = spec.big ? 9 : 7;

  // 개머리 — 세로로 곧게. 아래는 어깨에 닿는 자리라 살짝 넓힙니다.
  iconPaint(g, ICON.wood);
  iconPoly(g, [[cx - 3.4, cy - 10], [cx + 3.4, cy - 10],
    [cx + 3.4, cy + 12], [cx + 6, cy + 19], [cx - 6, cy + 19], [cx - 3.4, cy + 12]]);
  // 방아쇠
  iconPaint(g, ICON.gold);
  iconPoly(g, [[cx + 3.4, cy + 7], [cx + 8.5, cy + 12], [cx + 3.4, cy + 12]]);

  // 활대 — 위로 얕게 휜 초승달
  iconPaint(g, iconShade(ICON.wood, 0.85));
  iconPoly(g, [
    [cx - half, cy - 1], [cx - half * 0.5, cy - rise * 0.8], [cx, cy - rise],
    [cx + half * 0.5, cy - rise * 0.8], [cx + half, cy - 1],
    [cx + half, cy + 2.6], [cx + half * 0.5, cy - rise * 0.8 + 3.4], [cx, cy - rise + 3.6],
    [cx - half * 0.5, cy - rise * 0.8 + 3.4], [cx - half, cy + 2.6],
  ]);

  // 시위 — 활대 두 끝을 곧게 잇습니다. 밝아야 활대와 갈립니다
  g.lineStyle(1.4, 0xf5efe0, 0.95);
  g.lineBetween(cx - half + 1, cy + 1, cx + half - 1, cy + 1);

  // 메긴 볼트 — 개머리를 따라 앞을 향합니다. 촉이 **그 무기의 색**입니다
  g.lineStyle(2.6, ICON.stroke, 1);
  g.lineBetween(cx, cy + 1, cx, cy - 14);
  g.lineStyle(1.2, ICON.wood, 1);
  g.lineBetween(cx, cy + 1, cx, cy - 14);
  iconPaint(g, ICON.blade);
  iconPoly(g, [[cx, cy - 20], [cx - 3.4, cy - 13], [cx + 3.4, cy - 13]]);

  if (spec.gem) {
    iconPaint(g, iconShade(ICON.blade, 1.5));
    iconPoly(g, [[cx, cy + 4], [cx + 3.6, cy + 8.5], [cx, cy + 13], [cx - 3.6, cy + 8.5]]);
  }
}

function buildWeaponIcons(scene) {
  const g = scene.make.graphics({ add: false });

  CLASSES.forEach((job) => {
    // **주머니를 통째로 굽습니다** (job.weapons 가 아니라 job.pool).
    //
    // 자루는 열둘이지만 만듦새까지 하면 스물넷입니다. 예전 코드가 자루만
    // 돌았더니 열두 번째부터 텍스처가 없어서, 무기 칸과 HUD 와 갈아타기 창에
    // **초록 X 상자**가 떴습니다 (Phaser 가 없는 텍스처에 놓는 그림입니다).
    //
    // 그림은 여기서 도형으로 지어지므로 자루를 늘리는 데 그림 파일이 한 장도
    // 안 듭니다 — 만듦새는 날 색 한 줄(w.color)만 갈아 끼웁니다.
    buildWeaponPool(job).forEach((w, index) => {
      const key = weaponIconKey(job.key, index);
      if (scene.textures.exists(key)) return;

      g.clear();
      // 날의 바탕을 그 무기의 색으로. 이 한 줄이 열두 자루를 갈라 놓습니다.
      ICON.blade = w.color || 0xc3d4e4;
      iconPaint(g, ICON.blade);

      const spec = w.icon || { art: 'sword', hw: 4.5, len: 0.6, guard: 'bar', gw: 14 };
      if (spec.art === 'bow') drawBow(g, spec);
      else if (spec.art === 'crossbow') drawCrossbow(g, spec);
      else if (spec.art === 'spear') drawSpear(g);
      else drawSword(g, spec);

      g.generateTexture(key, ICON.size, ICON.size);
    });
  });

  // ── 아직 못 만난 자루 ──────────────────────────────────
  // 도감의 빈칸입니다 (js/scene-weaponbook.js). 그림을 아예 안 놓으면
  // 빈칸이 그냥 빈 상자라 "여기 뭔가 들어올 자리"라는 것이 안 읽힙니다.
  // 물음표 하나로 두되, 만난 자루의 그림보다 확실히 어둡게 그립니다.
  if (!scene.textures.exists('w-unknown')) {
    g.clear();
    const c = ICON.size / 2;
    const q = ICON.size * 0.2;
    g.lineStyle(ICON.weight * 1.8, 0x5a6790, 1);
    // 위쪽 갈고리와 아래로 내려오는 획, 그리고 점 하나.
    g.beginPath();
    g.arc(c, c - q * 0.75, q * 0.9, Math.PI * 0.95, Math.PI * 0.3, false);
    g.strokePath();
    g.beginPath();
    g.moveTo(c + q * 0.64, c - q * 0.36);
    g.lineTo(c, c + q * 0.45);
    g.strokePath();
    g.fillStyle(0x5a6790, 1);
    g.fillCircle(c, c + q * 1.3, ICON.weight * 1.6);
    g.generateTexture('w-unknown', ICON.size, ICON.size);
  }

  g.destroy();
}
