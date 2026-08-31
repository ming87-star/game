// 탑 벽에 남은 것들.
//
// ── 무엇을 말하려는가 ───────────────────────────────────
// 이 탑은 원래 꽃으로 가득한 곳이었습니다. 지금은 전부 말라 있습니다.
//
// 그 말을 **글로 하지 않습니다.** 알림도 도감도 없고, 밟히지도 주워지지도
// 않습니다. 그냥 벽에 있습니다. 처음에는 벽의 얼룩으로 보이다가, 시든 꽃을
// 한 번 알아본 뒤에 **그게 다 무엇이었는지 뒤늦게** 읽히면 됩니다.
//
// ── 두 겹인 까닭 ────────────────────────────────────────
// 꽃 한 송이를 백 층에 하나씩 놓으면 「여기 꽃이 한 송이 있었다」가 됩니다.
// 「이 탑이 꽃밭이었다」는 그 말로는 안 나옵니다. 그래서 둘로 나눴습니다.
//
//   마른 덩굴  자주 · 아주 흐리게   — 여긴 전부 이랬다
//   시든 꽃    드물게 · 조금 또렷   — 눈에 걸리는 것
//
// ── 왜 Math.random 을 안 쓰는가 ─────────────────────────
// 층 생성은 Math.random 을 씁니다. 그래서 씨앗을 안 준 판에서는 300층이
// 매번 다르게 생깁니다. 흔적은 그러면 안 됩니다 — **다시 올라갔을 때 같은
// 자리에 있어야** 「내내 있었구나」가 됩니다. 층 번호에서 직접 뽑습니다.

const DECOR = {
  size: 64,
  // 색이 빠져 있어야 합니다. 이 게임의 아이템은 전부 쨍한 색이라, 채도가
  // 없으면 주울 것으로 안 읽힙니다 — 「시든」이 그 문제를 스스로 풉니다.
  dry: 0x6b6157,
  dryLit: 0x8a7f70,
  stem: 0x585043,
};

// 층 번호 하나로 0…1 을 뽑습니다. 씨앗과 무관하고, 같은 층은 늘 같은 값입니다.
function decorHash(index, salt) {
  let t = (index * 374761393 + (salt || 0) * 668265263) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

// ── 그림 둘 ──────────────────────────────────────────────

// 마른 덩굴 — 벽을 타고 오르다 만 줄기. 잎은 몇 안 남았습니다.
function drawDryVine(g) {
  g.lineStyle(2, DECOR.stem, 1);
  g.beginPath();
  g.moveTo(32, 62);
  g.lineTo(29, 48);
  g.lineTo(35, 34);
  g.lineTo(30, 20);
  g.lineTo(34, 6);
  g.strokePath();
  // 마른 잎 — 아래로 처져 있습니다.
  g.fillStyle(DECOR.dry, 1);
  [[29, 46, -1], [35, 32, 1], [30, 18, -1]].forEach(([x, y, dir]) => {
    g.fillTriangle(x, y, x + dir * 9, y + 3, x + dir * 4, y + 8);
  });
  // 곁가지 하나
  g.lineStyle(1.5, DECOR.stem, 1);
  g.beginPath();
  g.moveTo(31, 40);
  g.lineTo(22, 44);
  g.strokePath();
}

// 시든 꽃 — 목이 지팡이처럼 꺾이고 꽃잎이 아래로 늘어졌습니다.
//
// 처음에는 곧은 줄기 끝에 꽃잎을 부챗살로 둘렀더니, 색만 빠진 **멀쩡한 꽃**
// 으로 보였습니다. 시들었다는 것은 색이 아니라 **모양**입니다 — 목이 꺾이고
// 꽃잎이 제 무게로 처져야 합니다.
function drawDeadFlower(g) {
  // 줄기 — 올라가다 오른쪽으로 넘어가 고개를 떨굽니다.
  g.lineStyle(2.2, DECOR.stem, 1);
  g.beginPath();
  g.moveTo(26, 62);
  g.lineTo(28, 46);
  g.lineTo(30, 32);
  g.lineTo(34, 22);   // 넘어가는 목
  g.lineTo(40, 20);
  g.lineTo(43, 25);   // 꺾여 내려온 끝
  g.strokePath();

  // 마른 잎 둘 — 아래로 처져 있습니다.
  g.fillStyle(DECOR.dry, 1);
  g.fillTriangle(28, 44, 17, 48, 24, 52);
  g.fillTriangle(30, 34, 41, 38, 34, 42);

  // 꽃받침 — 꺾인 목 끝에 매달립니다.
  g.fillStyle(DECOR.stem, 1);
  g.fillCircle(43, 27, 3.2);

  // 꽃잎 — **거의 아래로** 늘어뜨립니다. 좁게 모여야 처진 것으로 보입니다.
  g.fillStyle(DECOR.dry, 1);
  [-26, -9, 9, 26].forEach((deg) => {
    const a = (deg + 90) * Math.PI / 180;
    const x = 43 + Math.cos(a) * 2.5;
    const y = 28 + Math.sin(a) * 2.5;
    g.fillTriangle(x - 1.8, y, x + 1.8, y,
      x + Math.cos(a) * 12, y + Math.sin(a) * 12);
  });
  // 한 장은 이미 떨어져 아래에 있습니다.
  g.fillStyle(DECOR.dry, 0.75);
  g.fillTriangle(36, 52, 41, 54, 37, 56);
}

function buildDecorArt(scene) {
  const g = scene.make.graphics({ add: false });
  [['decor-vine', drawDryVine], ['decor-flower', drawDeadFlower]].forEach(([key, draw]) => {
    if (scene.textures.exists(key)) return;
    g.clear();
    draw(g);
    g.generateTexture(key, DECOR.size, DECOR.size);
  });
  g.destroy();
}

// ── 층에 놓기 ────────────────────────────────────────────
//
// 부른 쪽(scene-game 의 addFloor)이 돌려받은 것을 floor.views 에 넣습니다.
// 그러면 층이 사라질 때 같이 사라집니다 — 따로 치우는 코드가 없어도 됩니다.
//
// 자리는 **층과 층 사이**입니다. 발판은 20px 밖에 안 되고 층 사이가 165px
// 이라, 그 가운데께는 발판·아이템·적 어느 것과도 안 겹칩니다.
function decorFor(scene, index) {
  if (index <= 0) return [];
  const out = [];
  const y = floorY(index) - 92;          // 발판보다 한참 위, 다음 층보다 아래

  // 시든 꽃 — 백 층마다 하나. 눈에 걸리라고 두는 것이라 자리를 고정합니다.
  //
  // **100의 배수는 피합니다.** 거기는 전부 상점층입니다(50층마다). 처음에
  // 100·200·300 에 놓았더니 수레와 주인 옆에 나란히 서서, 가장 붐비는 층에서
  // 가장 조용해야 할 것이 묻혔습니다. 70 은 상점층도 보스층도 아닙니다.
  if (index % 100 === 70) {
    const left = decorHash(index, 7) < 0.5;
    out.push(scene.add.image(left ? 46 : 494, y, 'decor-flower')
      .setDepth(-7).setAlpha(0.85).setFlipX(!left));
    return out;
  }

  // 마른 덩굴 — 네댓 층에 한 번. 아주 흐려서 처음에는 벽 얼룩으로 보입니다.
  if (decorHash(index, 3) >= 0.22) return out;
  const left = decorHash(index, 11) < 0.5;
  const x = left ? 34 + decorHash(index, 13) * 20 : 486 - decorHash(index, 13) * 20;
  out.push(scene.add.image(x, y + (decorHash(index, 17) - 0.5) * 40, 'decor-vine')
    .setDepth(-7).setAlpha(0.3).setFlipX(!left)
    .setScale(0.8 + decorHash(index, 19) * 0.4));
  return out;
}
