// 이미지 파일 없이 도형으로 그림을 만들어 씁니다.
// 나중에 진짜 그림이 나오면 이 파일만 걷어내고 load.image()로 바꾸면 됩니다.

function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });

  // 주인공 — 몸통에 머리를 얹은 단순한 모양
  g.clear();
  g.fillStyle(0x4dd0e1, 1);
  g.fillRoundedRect(6, 14, 26, 30, 6);
  g.fillStyle(0xffe0b2, 1);
  g.fillCircle(19, 11, 10);
  g.fillStyle(0x00838f, 1);
  g.fillRect(6, 40, 26, 6);
  g.generateTexture('player', 38, 48);

  // 적 — 뾰족한 눈이 달린 덩어리
  g.clear();
  g.fillStyle(0xef5350, 1);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0x3e2723, 1);
  g.fillCircle(11, 13, 3.2);
  g.fillCircle(21, 13, 3.2);
  g.fillStyle(0xb71c1c, 1);
  g.fillTriangle(4, 6, 12, 2, 10, 9);
  g.fillTriangle(28, 6, 20, 2, 22, 9);
  g.generateTexture('enemy', 32, 32);

  // 총알 — 흰색으로 만들고 무기 색으로 tint 합니다
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 5);
  g.generateTexture('bullet', 12, 12);

  // 무기 아이템
  g.clear();
  g.fillStyle(0xffd54f, 1);
  g.fillTriangle(14, 0, 28, 14, 14, 28);
  g.fillTriangle(14, 0, 0, 14, 14, 28);
  g.fillStyle(0xfff9c4, 1);
  g.fillCircle(14, 14, 4);
  g.generateTexture('item', 28, 28);

  // 회복 아이템
  g.clear();
  g.fillStyle(0x66bb6a, 1);
  g.fillRoundedRect(0, 9, 26, 8, 3);
  g.fillRoundedRect(9, 0, 8, 26, 3);
  g.generateTexture('heal', 26, 26);

  // 타격 효과
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(5, 5, 5);
  g.generateTexture('spark', 10, 10);

  g.destroy();
}
