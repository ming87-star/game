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

function hasArt(key) {
  return typeof ART_SVG !== 'undefined' && !!ART_SVG[key];
}

function artSize(key) {
  const a = hasArt(key) && ART_SVG[key];
  return a ? { w: a.w, h: a.h } : null;
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
  if (typeof ART_SVG === 'undefined') return;
  Object.keys(ART_SVG).forEach((key) => {
    // 텍스처는 판을 넘어 남습니다. 다시 구울 이유가 없습니다.
    if (scene.textures.exists(key)) return;
    const a = ART_SVG[key];
    scene.load.svg(key, svgDataUri(a.svg), { width: a.w, height: a.h });
  });
}
