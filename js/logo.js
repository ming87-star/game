// ── 로고 ──────────────────────────────────────────────────
//
// 제목이 **문장**이라 로고도 글자로 짓습니다 (CFG.title).
//
//   ▲      ← 탑 표시. 층이 위로 겹쳐 오르는 모양
//   오늘도 탑을 오르는 나는     (작게 · 흐리게)
//   무슨 생각을 해야 하나       (크게 · 밝게)
//
// 위아래로 나눈 자리가 중요합니다. 스물두 자를 한 줄로 두면 화면 너비에
// 안 들어가고, 억지로 줄이면 아무 데서도 안 읽힙니다. 두 토막으로 나누면
// **뒷줄이 물음이 되어** 그 자체로 무게가 생깁니다.
//
// 그림이 오면 그림이 이깁니다 (art/title-logo.webp → 'title-logo'). 제목 글자를
// 손으로 그린 것은 글꼴로 찍은 것과 무게가 다릅니다 — 획의 끝이 갈라지고,
// 자간이 글자마다 다르고, 「탑」의 받침이 옆 글자 밑으로 파고듭니다.
//
// 그림이 없으면 아래 도형과 글꼴로 짓습니다. **이 자리는 비어 있으면 안 되는
// 자리**라서, 그림을 기다리는 동안에도 제목이 서 있어야 흐름을 볼 수 있습니다.
// 덤으로 **제목을 고치면 글꼴 쪽은 저절로 따라옵니다.**

// 로고 한 벌을 놓습니다. 돌려주는 것은 만든 물건들과 잰 높이입니다 —
// 부르는 쪽이 그 아래에 무엇을 놓을지 정할 수 있게.
//
//   scale  1이 기준입니다. 좁은 화면에서는 0.8 쯤으로 줄여 씁니다
//   mark   위의 탑 표시를 놓을지 (제목만 필요한 자리에서는 끕니다)
function drawLogo(scene, x, y, opts) {
  const o = opts || {};
  const k = o.scale === undefined ? 1 : o.scale;
  const t = CFG.title;

  // ── 그린 로고가 있으면 그것으로 ──────────────────────
  // 너비를 기준으로 맞춥니다. 높이로 맞추면 그림의 여백이 얼마인지에 따라
  // 글자 크기가 들쭉날쭉해집니다 — 로고는 **가로로 얼마나 차지하는가**로
  // 자리를 잡는 물건입니다.
  if (scene.textures.exists('title-logo')) {
    const room = (o.width || CFG.width) - 32;
    const src = scene.textures.get('title-logo').getSourceImage();
    const w = Math.min(room, room * k);
    const h = w * (src.height / src.width);
    const img = scene.add.image(x, y, 'title-logo').setDisplaySize(w, h).setOrigin(0.5, 0);
    return { parts: [img], bottom: y + h, height: h };
  }

  const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: Math.round(size * k) + 'px', color });
  const parts = [];
  let top = y;

  // ── 탑 표시 ──────────────────────────────────────────
  // 층이 위로 겹쳐 오르는 모양. 위로 갈수록 좁아지고 밝아집니다 —
  // 이 게임에서 위는 「더 깊은 곳」이라 밝기가 곧 거리입니다.
  if (o.mark !== false) {
    const w = 66 * k;
    const h = 9 * k;
    const gap = 3 * k;
    for (let i = 0; i < 4; i++) {
      const ww = w * (1 - i * 0.18);
      const yy = top + (3 - i) * (h + gap);
      parts.push(scene.add.rectangle(x, yy, ww, h, [0x3f4a78, 0x5c6bc0, 0x7e6bc4, 0xb39ddb][i])
        .setOrigin(0.5, 0));
    }
    top += 4 * (h + gap) + 16 * k;
  }

  // ── 두 줄 ────────────────────────────────────────────
  const line1 = scene.add.text(x, top, t.top, font(21, '#8794b5')).setOrigin(0.5, 0);
  parts.push(line1);
  top += line1.height + 6 * k;

  const line2 = scene.add.text(x, top, t.bottom, font(35, '#ffffff')).setOrigin(0.5, 0);
  parts.push(line2);
  top += line2.height;

  // 좁은 화면에서 뒷줄이 넘치면 그만큼만 줄입니다. 글자를 지우는 것보다
  // 낫습니다 — 제목의 뒷줄이 이 게임의 물음이라 통째로 읽혀야 합니다.
  const room = (o.width || CFG.width) - 32;
  if (line2.width > room) line2.setScale(room / line2.width);

  // 밑줄 한 가닥. 문장형 제목은 끝이 어디인지가 안 보여서, 마침표 대신 씁니다.
  const rule = scene.add.rectangle(x, top + 12 * k, Math.min(line2.displayWidth, room), 2 * k,
    0x7e6bc4, 0.7);
  parts.push(rule);
  top += 14 * k;

  return { parts, bottom: top, height: top - y };
}
