// 이미지 파일 없이 도형으로 그림을 만들어 씁니다.
// 나중에 진짜 그림이 나오면 이 파일만 걷어내고 load.image()로 바꾸면 됩니다.

function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });

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
  g.generateTexture('player-warrior', 38, 48);

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
  g.generateTexture('player-archer', 42, 48);

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
  g.generateTexture('player-rogue', 40, 48);

  // ── 적 ────────────────────────────────────────────────
  // 종류마다 실루엣과 색을 다르게 해서 멀리서도 구분되게 합니다.

  // 기는 것 — 납작하고 다리가 달린 작은 놈
  g.clear();
  g.fillStyle(0xef5350, 1);
  g.fillEllipse(16, 18, 28, 20);
  g.fillStyle(0xb71c1c, 1);
  for (let i = 0; i < 4; i++) g.fillRect(3 + i * 8, 26, 4, 6);
  g.fillStyle(0x3e2723, 1);
  g.fillCircle(11, 15, 3);
  g.fillCircle(21, 15, 3);
  g.generateTexture('e-crawler', 32, 32);

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
  g.generateTexture('e-brute', 32, 34);

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
  g.generateTexture('e-flyer', 36, 32);

  // 빠른 놈 — 앞으로 쏠린 화살 모양
  g.clear();
  g.fillStyle(0xffca28, 1);
  g.fillTriangle(0, 4, 0, 26, 30, 15);
  g.fillStyle(0xf57f17, 1);
  g.fillTriangle(0, 10, 0, 20, 14, 15);
  g.fillStyle(0x3e2723, 1);
  g.fillCircle(18, 15, 3);
  g.generateTexture('e-dasher', 32, 30);

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
  g.generateTexture('e-giant', 36, 38);

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
  g.generateTexture('e-shooter', 34, 34);

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
  g.generateTexture('e-hopper', 34, 32);

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
  g.generateTexture('e-charger', 36, 38);

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
  g.generateTexture('e-bomber', 34, 36);

  // 쪼개지는 것 — 가운데 금이 간 덩어리
  g.clear();
  g.fillStyle(0x00897b, 1);
  g.fillRoundedRect(2, 4, 32, 28, 10);
  g.fillStyle(0x004d40, 1);
  g.fillRect(16, 4, 4, 28); // 갈라질 자리
  g.fillStyle(0xb2dfdb, 1);
  g.fillCircle(10, 16, 4);
  g.fillCircle(26, 16, 4);
  g.generateTexture('e-splitter', 36, 36);

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
  g.generateTexture('e-diver', 36, 38);

  // 유령 — 아래가 너울거리는 반투명한 것
  g.clear();
  g.fillStyle(0xb39ddb, 0.85);
  g.fillCircle(17, 15, 14);
  g.fillTriangle(3, 15, 10, 34, 17, 20);
  g.fillTriangle(17, 20, 24, 34, 31, 15);
  g.fillStyle(0x311b92, 1);
  g.fillCircle(12, 13, 3.5);
  g.fillCircle(22, 13, 3.5);
  g.generateTexture('e-ghost', 34, 36);

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
  g.generateTexture('bat-thief', 40, 32);

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
  g.generateTexture('bat-biter', 40, 32);

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
  g.generateTexture('boss', 320, 240);

  // 보스가 내리꽂는 것 — 크고 무겁게
  g.clear();
  g.fillStyle(0x7c4dff, 1);
  g.fillCircle(18, 18, 16);
  g.fillStyle(0xe1bee7, 1);
  g.fillCircle(18, 18, 8);
  g.generateTexture('boss-shot', 36, 36);

  // ── 탄 ────────────────────────────────────────────────
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 5);
  g.generateTexture('bullet', 12, 12);

  g.clear();
  g.fillStyle(0xff5252, 1);
  g.fillCircle(8, 8, 7);
  g.fillStyle(0xffcdd2, 1);
  g.fillCircle(8, 8, 3);
  g.generateTexture('enemy-bullet', 16, 16);

  // 파동 — 날아가는 초승달
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  g.arc(20, 22, 18, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false);
  g.arc(8, 22, 20, Phaser.Math.DegToRad(70), Phaser.Math.DegToRad(-70), true);
  g.closePath();
  g.fillPath();
  g.generateTexture('wave', 44, 44);

  // 검을 휘두른 자국 — 반달 모양. 실제 사거리에 맞춰 늘려 씁니다.
  g.clear();
  g.lineStyle(15, 0xffffff, 1);
  g.beginPath();
  g.arc(70, 70, 56, Phaser.Math.DegToRad(-54), Phaser.Math.DegToRad(54), false);
  g.strokePath();
  g.generateTexture('slash', 140, 140);

  // ── 그 밖 ─────────────────────────────────────────────
  g.clear();
  g.fillStyle(0xffd54f, 1);
  g.fillCircle(9, 9, 8);
  g.fillStyle(0xf9a825, 1);
  g.fillCircle(9, 9, 5);
  g.fillStyle(0xfff9c4, 1);
  g.fillCircle(6, 6, 2);
  g.generateTexture('coin', 18, 18);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(5, 5, 5);
  g.generateTexture('spark', 10, 10);

  g.destroy();
}
