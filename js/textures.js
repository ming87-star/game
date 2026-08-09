// 이미지 파일 없이 도형으로 그림을 만들어 씁니다.
// 나중에 진짜 그림이 나오면 이 파일만 걷어내고 load.image()로 바꾸면 됩니다.

function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });

  // ── 주인공 ────────────────────────────────────────────
  g.clear();
  g.fillStyle(0x4dd0e1, 1);
  g.fillRoundedRect(6, 14, 26, 30, 6);
  g.fillStyle(0xffe0b2, 1);
  g.fillCircle(19, 11, 10);
  g.fillStyle(0x00838f, 1);
  g.fillRect(6, 40, 26, 6);
  g.generateTexture('player', 38, 48);

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
