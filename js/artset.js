// 그려 둔 그림(art/*.svg → js/artdata.js)을 게임에 답니다.
//
// ── 왜 1배로 굽는가 ─────────────────────────────────────
// 이 엔진은 **충돌 상자가 그림 배율을 따라가지 않습니다.** 그림을 4배로 구워
// 놓고 화면에서만 줄이면, 보이는 것은 32px인데 부딪히는 상자는 128px로 남습니다.
// 적이 허공에서 걸리고 발판에 얹히지 않습니다. 상자를 손으로 맞추려면
// setSize·setOffset 이 원본 픽셀인지 화면 픽셀인지까지 따져야 하는데,
// 그 계산이 틀리면 눈에는 안 보이고 판만 이상해집니다.
//
// viewBox 크기 그대로(1배) 구우면 그림 픽셀 = 게임 픽셀이라, 지금까지의
// 충돌·사거리·마릿수 계산이 **한 줄도 안 바뀌고** 그대로 맞습니다.
// 도형을 그리던 것과 해상도가 같으므로 잃는 것도 없습니다.
//
// 촘촘한 화면에서 더 또렷하게 하려면 배율을 올리고 상자를 전부 다시 재야
// 합니다 — 그건 따로, 조심해서 할 일입니다.
//
// ── 순서 ────────────────────────────────────────────────
// preload 에서 이것들을 먼저 굽고, create 의 buildTextures 는 **이미 있는 키를
// 건너뜁니다**. 그래서 그림이 있는 것은 그림이, 없는 것은 도형이 쓰입니다.
// 그림을 한 장 더 그려 넣으면 그 순간 도형을 밀어냅니다.

// 그림은 두 곳에서 옵니다. 어느 쪽이든 게임에서는 똑같이 씁니다.
//   ART_SVG     손으로 그린 art/*.svg (bake-art.js)
//   SPRITE_ART  gen-sprite.js 가 그린 assets/*.png (bake-sprites.js)
// 같은 이름이 양쪽에 있으면 **손그림이 이깁니다** — bake-sprites.js 가
// 그런 것은 아예 담지 않으므로 여기서는 순서만 지키면 됩니다.
function spriteArt(key) {
  return typeof SPRITE_ART !== 'undefined' && SPRITE_ART ? SPRITE_ART[key] : null;
}

function hasArt(key) {
  if (typeof ART_SVG !== 'undefined' && ART_SVG[key]) return true;
  return !!spriteArt(key);
}

function artSize(key) {
  const a = typeof ART_SVG !== 'undefined' && ART_SVG[key];
  if (a) return { w: a.w, h: a.h };
  const p = spriteArt(key);
  return p ? { w: p.w, h: p.h } : null;
}

// 한글 주석은 굽는 과정에서 빠지지만, 그림 안에 한글이 들어올 수도 있으므로
// utf-8 을 거쳐 base64 로 만듭니다. btoa 는 바이트 하나짜리 글자만 받습니다.
function svgDataUri(svg) {
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:image/svg+xml;base64,' + btoa(bin);
}

function loadArt(scene) {
  if (typeof ART_SVG !== 'undefined') {
    Object.keys(ART_SVG).forEach((key) => {
      // 텍스처는 판을 넘어 남습니다. 다시 구울 이유가 없습니다.
      if (scene.textures.exists(key)) return;
      const a = ART_SVG[key];
      scene.load.svg(key, svgDataUri(a.svg), { width: a.w, height: a.h });
    });
  }

  // 래스터로 그린 것들 (bake-sprites.js). 이미 1배로 줄여 담겨 있으므로
  // 그냥 얹으면 그림 픽셀 = 게임 픽셀입니다.
  if (typeof SPRITE_ART !== 'undefined' && SPRITE_ART) {
    Object.keys(SPRITE_ART).forEach((key) => {
      if (scene.textures.exists(key)) return;
      scene.load.image(key, SPRITE_ART[key].uri);
    });
  }
}

// 주인공의 공격 컷(js/sheetdata.js). 무기 한 자루가 띠 한 장이고, 그 안에
// 여덟 칸이 가로로 들어 있습니다 — Phaser 가 fw 로 잘라 줍니다.
//
// **그 직업 것만 굽습니다.** 서른여섯 자루를 다 구우면 288장을 풀어야 하는데,
// 한 판에서 쓰는 것은 열두 자루뿐입니다. 판을 새로 시작해도 텍스처는 남으므로
// 직업을 바꿔 가며 놀면 그때그때 필요한 것만 쌓입니다.
function loadSheets(scene, jobKey) {
  if (typeof SHEET_ART === 'undefined') return;
  // 내 편의 시트는 **그 직업일 때만** 함께 싣습니다. 곰은 곰사냥꾼의 것이라
  // 다른 직업으로 놀 때까지 풀어 둘 까닭이 없습니다.
  //
  // 이 줄이 없어서 곰 시트를 구워 놓고도 **못 찾았습니다** — SHEET_ART 에는
  // 있는데 텍스처가 없으니 bearSheet 가 null 을 돌려주고, 곰이 그림 한 장으로
  // 물러섰습니다. 오류는 안 났습니다.
  const 내편 = jobKey && classByKey(jobKey) && classByKey(jobKey).bear
    ? 'sheet-ally-bear' : null;
  Object.keys(SHEET_ART).forEach((key) => {
    if (jobKey && key !== 내편 && !key.startsWith('sheet-w-' + jobKey + '-')) return;
    if (scene.textures.exists(key)) return;
    const s = SHEET_ART[key];
    scene.load.spritesheet(key, s.url, { frameWidth: s.fw, frameHeight: s.fh });
  });
}
