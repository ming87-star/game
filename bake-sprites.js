// assets/*.png 로 그려 둔 스프라이트를 js/spritedata.js 한 장으로 묶습니다.
//
//   CHROME_PATH=... node bake-sprites.js
//
// ── art/*.svg 와 무엇이 다른가 ────────────────────────────
// 손으로 그린 것은 art/*.svg 에 있고 bake-art.js 가 묶습니다. 그런데 적 여덟과
// 박쥐 둘은 gen-sprite.js 가 그려서 assets/*.png 로 나왔습니다 (원본이 래스터라
// SVG 로 만들 길이 없습니다). 그것들이 갈 자리가 없어서 게임에서는 여태
// **도형이 대신 서 있었습니다** — 그림은 다 그려 놓고 아무도 안 쓰고 있었습니다.
//
// ── 왜 4배를 1배로 줄이는가 ──────────────────────────────
// **이 엔진은 충돌 상자가 그림 배율을 따라가지 않습니다.** 128×128 로 구워 놓고
// 화면에서만 줄이면, 보이는 것은 32px인데 부딪히는 상자는 128px 로 남습니다.
// 적이 허공에서 걸리고 발판에 안 얹힙니다 (자세한 것은 js/artset.js 맨 위).
//
// art/*.svg 는 viewBox 크기 그대로(1배) 굽습니다. 그림은 4배로 그려 두었으므로
// 여기서 4로 나눠 같은 규칙에 맞춥니다 — 그래야 지금까지의 충돌·사거리 계산이
// 한 줄도 안 바뀌고 그대로 맞습니다.
//
// ── 왜 webp 인가 ─────────────────────────────────────────
// 알파가 있어야 하는데 PNG 는 무겁습니다. 32×32 로 줄이고 나면 어차피 작지만,
// 같은 그림이 PNG 의 몇 분의 일입니다. bake-sheets.js 와 같은 이유입니다.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ART = path.join(ROOT, 'art');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'js', 'spritedata.js');

const SCALE = 4;      // 그림은 4배로 그려져 있습니다 (ART.md)
const QUALITY = 0.92; // 32px 까지 줄이고 나면 화질이 아까우므로 넉넉히 줍니다

// 이 목록에 있는 것만 굽습니다. assets/ 에는 미리보기로 구워 둔 것(art/*.svg 를
// render-art.js 로 뽑은 것)도 섞여 있어서, 통째로 쓸어 담으면 손으로 그린 SVG 를
// 그 미리보기가 덮어씁니다.
//
// 이 규칙 때문에 **그려 놓고 아무도 안 쓰는 그림**이 두 번 나왔습니다. 적 넷과
// 아이템 스무 장이 그랬습니다 — AI 판이 assets/ 에 진작 있었는데 art/*.svg 가
// 먼저 걸려서 건너뛰었습니다. 지금은 그 SVG 들을 지웠으므로 AI 쪽이 씁니다.
//
// art/ 에 남은 SVG 는 **AI 가 실패한 것들**뿐입니다 — 벽과 발판 셋. 돌벽만
// 그리라고 했는데 모델이 그 위에 드워프 전사를 그려 넣었습니다 (ART.md 11절).
// 그리고 주인공 셋과 보스 다섯은 손대지 않기로 한 것들입니다.
const WANT = [
  // 적 열여덟 + 박쥐 둘 — 게임에 나오는 적 전부입니다.
  // 아직 안 그린 것도 여기 적어 둡니다. 그래야 굽고 나서 「아직 없는 그림」에
  // 이름이 뜨고, 그린 날 파일만 넣으면 저절로 붙습니다.
  'e-coinbug', 'e-crawler', 'e-hopper', 'e-goldfrog', 'e-flyer', 'e-brute',
  'e-charger', 'e-dasher', 'e-bomber', 'e-giant', 'e-splitter', 'e-shooter',
  'e-diver', 'e-ghost',
  'e-shover', 'e-slammer', 'e-lancer', 'e-zapper',
  'bat-thief', 'bat-biter',
  // 내 편 둘 — 곰사냥꾼의 곰과 사령술사의 부하 (ART.md 2.5절).
  // 적과 같은 자리에 서므로 적 목록 바로 뒤에 둡니다.
  'ally-bear', 'ally-thrall',
  // 발판 위에 놓이는 것 스무 장. 가짜는 진짜와 **짝을 이뤄야** 합니다 —
  // 하나만 갈아 끼우면 다가가기 전과 뒤의 그림체가 달라져서 미리 들킵니다.
  'item-plus', 'item-fake-plus', 'item-plus-anvil', 'item-plus-hammer',
  'item-haste', 'item-fake-haste', 'item-double',
  'item-armor-warrior', 'item-armor-archer', 'item-fake-armor', 'item-fake-armor-archer',
  'item-dodge', 'item-fake-dodge', 'item-heal', 'item-fake-heal',
  'item-treasure', 'item-fake-treasure', 'item-medal', 'item-relic', 'item-bomb',
  // 보스 다섯과 그놈들의 탄 다섯. 보스는 320×240 이라 여기서 제일 무겁습니다 —
  // 다섯을 합쳐 200KB 남짓 붙습니다. 순간의 무게가 가장 큰 그림이라 값을 합니다.
  'boss-warden', 'boss-gazer', 'boss-crusher', 'boss-brood', 'boss-phantom',
  'boss-shot', 'boss-shot-gazer', 'boss-shot-crusher', 'boss-shot-brood', 'boss-shot-phantom',
  // 상점 층. 발판(plat-shop)은 그대로 두고 그 **뒤와 위**에 붙는 둘입니다.
  'shop-back', 'shop-npc',
  // 붉은 겉옷 셋 (ART.md 8.3절). **아직 안 그렸습니다** — 지금은
  // js/textures.js 의 도형이 서 있습니다. 여기 미리 적어 두면 구울 때마다
  // 「아직 없는 그림」에 이름이 떠서, 그린 날 assets/ 에 파일만 넣으면
  // 저절로 붙습니다 (buildTextures 는 이미 있는 키를 건너뜁니다).
  'cloak-red', 'cloak-white', 'cloak-fallen',
];

// 4로 안 나누는 것들. 기본은 4배로 그려 온다는 약속이지만(위 SCALE),
// 그리는 쪽에서 1840px 짜리 가로 그림을 뽑기가 어렵습니다. 배경은 2배로
// 받습니다 — 920×300 → 460×150.
const DIV = { 'shop-back': 1 };

// ── 투명한 여백을 잘라 내는 것들 ───────────────────────────
//
// 상점 배경은 920×300 으로 왔는데 **그림이 실제로 든 칸은 610×186** 이었습니다
// (위쪽 38%가 통째로 비어 있습니다). 그대로 460 폭에 맞추면 그림은 305px 밖에
// 안 되어, 발판(460) 옆에서 작아 보입니다 — 처음 붙였을 때 그랬습니다.
//
// 여백을 잘라 내면 **그림이 곧 칸**이 되어, 부르는 쪽에서 「발판 너비에 맞춰라」
// 한 줄로 끝납니다. 다음에 여백이 다른 그림이 와도 저절로 맞습니다.
//
// 사람이나 적에게는 안 씁니다 — 그쪽은 발치가 칸 바닥에 맞춰져 있어야
// 발판 위에 제대로 섭니다.
const TRIM = new Set(['shop-back']);

// assets/ 에 있지만 **일부러** 안 굽는 것들. 여기 없으면 아래에서
// "그려는 놨는데 목록에 없다"고 알려 줍니다.
//
//   이펙트 여덟  코드가 무기 색을 입혀 씁니다 (setTint). 색이 들어간 그림을
//                넣으면 그 색이 먹혀서 무기마다 다른 빛깔이 안 나옵니다.
//                흰색으로 다시 뽑아야 붙일 수 있습니다.
//   벽·발판·주인공  art/*.svg 가 원본이고 assets/ 쪽은 그 미리보기입니다
//                (주인공의 SVG 는 화면에 안 나옵니다 — 물리 몸 껍데기입니다).
// ── 카드에 서는 초상화 셋 ──────────────────────────────────
//
// assets/player-*.png 는 **판에 나오는 그림이 아닙니다.** 판 위의 주인공은
// 조각 리그(art/p-*.svg)로 짓고, art/player-*.svg 는 38×48 짜리 물리 몸
// 껍데기입니다. 이 PNG 셋은 그와 별개로 그려 둔 온전한 초상화인데 여태
// 아무 데도 안 붙어 있었습니다 — 직업 고르기 카드가 그 자리입니다.
//
// 그래서 **두 가지를 비켜 갑니다.**
//   · 이름을 face- 로 바꿉니다. player- 로 두면 「판 위의 주인공」과
//     같은 이름이 되어, 나중에 누가 어느 쪽을 부르는지 헷갈립니다
//   · 4로 안 나눕니다. 판 위의 적들은 32px 로 서지만 이건 카드에서
//     140px 로 섭니다 — 4로 나누면 38×48 이 되어 세 배로 늘려 뭉갭니다
const PORTRAITS = [
  { key: 'face-warrior', from: 'player-warrior' },
  { key: 'face-archer', from: 'player-archer' },
  { key: 'face-rogue', from: 'player-rogue' },
  // 새 직업 다섯. 그림은 그림 세션에서 먼저 와 있었고, **직업이 실제로
  // 게임에 붙는 날** 여기 더하라고 적혀 있던 자리입니다. 오늘입니다.
  { key: 'face-monk', from: 'player-monk' },
  { key: 'face-hunter', from: 'player-hunter' },
  { key: 'face-necro', from: 'player-necro' },
  { key: 'face-wizard', from: 'player-wizard' },
  { key: 'face-digger', from: 'player-digger' },
  // 상점 화면 안에 서는 주인. 판 위의 작은 주인(shop-npc)과 **다른 그림**입니다 —
  // 하나는 38px 로 서고 하나는 190px 로 섭니다.
  { key: 'shop-keeper', from: 'shop-keeper' },
];

const ON_PURPOSE = new Set([
  'coin', 'slash', 'spark', 'wave', 'bullet', 'enemy-bullet', 'arrow', 'arrow-trail',
  'wall-far', 'wall-mid', 'wall-near', 'wall-shade',
  'plat', 'plat-shop', 'plat-boss', 'plat-ground',
  // 33층 시퀀스에만 나오는 놈. 손으로 그린 SVG 가 있으므로 래스터는 안 굽습니다
  'ending-foe',
  'player-warrior', 'player-archer', 'player-rogue',
  // 새 직업 다섯. 판에서는 시트가 돌고 고르는 화면에는 face-* 로 구워지므로,
  // 이 파일 자체는 스프라이트로 안 굽습니다 (위 셋과 같은 까닭).
  // PORTRAITS 에는 더했습니다.
  'player-monk', 'player-hunter', 'player-necro', 'player-wizard', 'player-digger',
  // 처음에 그렸던 남자 상인. 상점 주인은 여자로 갔지만 그림은 멀쩡하므로
  // 이름만 바꿔 남겨 둡니다 — 나중에 다른 사람으로 쓸 자리가 있을 겁니다.
  'shop-keeper-man', 'shop-npc-man',
]);

(async () => {
  const jobs = [];
  const skipped = [];
  const missing = [];

  for (const key of WANT) {
    // **손으로 그린 SVG 가 있으면 그쪽이 이깁니다.** assets/ 의 같은 이름은
    // 그 SVG 의 미리보기일 뿐이라, 덮어쓰면 원본을 잃습니다.
    if (fs.existsSync(path.join(ART, key + '.svg'))) { skipped.push(key); continue; }
    const png = path.join(ASSETS, key + '.png');
    if (!fs.existsSync(png)) { missing.push(key); continue; }
    jobs.push({ key, png, div: DIV[key] || SCALE, trim: TRIM.has(key) });
  }

  // 초상화는 WANT 를 안 탑니다 — 같은 이름의 SVG 가 있어서 위 규칙에
  // 걸리고, 배율도 다릅니다.
  for (const { key, from } of PORTRAITS) {
    const png = path.join(ASSETS, from + '.png');
    if (fs.existsSync(png)) jobs.push({ key, png, div: 1 });
    else missing.push(key);
  }

  const out = {};
  if (jobs.length) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || undefined,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();

    for (const { key, png, div, trim } of jobs) {
      const uri = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
      const r = await page.evaluate(async ([src, div, q, trim]) => {
        const img = new Image();
        await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });

        // 자를 칸. 기본은 그림 전체입니다.
        let sx = 0; let sy = 0; let sw = img.width; let sh = img.height;
        if (trim) {
          const m = document.createElement('canvas');
          m.width = img.width; m.height = img.height;
          const mg = m.getContext('2d');
          mg.drawImage(img, 0, 0);
          const px = mg.getImageData(0, 0, img.width, img.height).data;
          let L = img.width; let R = -1; let T = img.height; let B = -1;
          for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
              if (px[(y * img.width + x) * 4 + 3] > 16) {
                if (x < L) L = x; if (x > R) R = x;
                if (y < T) T = y; if (y > B) B = y;
              }
            }
          }
          if (R >= L && B >= T) { sx = L; sy = T; sw = R - L + 1; sh = B - T + 1; }
        }

        const c = document.createElement('canvas');
        c.width = Math.round(sw / div);
        c.height = Math.round(sh / div);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        return { uri: c.toDataURL('image/webp', q), w: c.width, h: c.height, from: img.width };
      }, [uri, div, QUALITY, !!trim]);

      out[key] = { w: r.w, h: r.h, uri: r.uri };
      const was = Math.round(fs.statSync(png).size / 1024);
      const now = Math.round(r.uri.length * 0.75 / 1024);
      console.log(`${key}  ${r.from}px ${was}KB → ${r.w}×${r.h} ${now}KB`);
    }
    await browser.close();
  }

  fs.writeFileSync(OUT,
    '// node bake-sprites.js 가 만든 파일입니다. 손으로 고치지 마세요.\n' +
    '// assets/*.png (4배로 그린 것)를 1배로 줄여 담았습니다 — 게임 픽셀 = 그림 픽셀.\n' +
    'const SPRITE_ART = ' + JSON.stringify(out, null, 0) + ';\n');

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\njs/spritedata.js  ${kb}KB  (${Object.keys(out).length}장)`);
  if (missing.length) console.log('아직 없는 그림: ' + missing.join(' ') + ' (도형이 자리를 지킵니다)');

  // ── 놓치기 쉬운 두 가지를 크게 알려 줍니다 ──────────────
  // 둘 다 **오류가 안 나는** 실수입니다. 그림이 안 붙으면 게임은 조용히
  // 도형으로 돌아갈 뿐이라, 여기서 안 짚어 주면 눈으로 보기 전에는 모릅니다.
  // 실제로 이것 때문에 그려 놓은 그림 서른네 장이 두 번이나 묻혔습니다.
  if (skipped.length) {
    console.log('\n⚠ 같은 이름의 art/*.svg 가 있어서 **안 구운** 것 ' + skipped.length + '장:');
    console.log('    ' + skipped.join(' '));
    console.log('  손그림을 지키려는 규칙인데, AI 그림으로 갈아타는 중이라면');
    console.log('  이건 그냥 묻히는 것입니다. 갈아탈 것이면 SVG 부터 지우세요:');
    console.log('    rm ' + skipped.map((k) => 'art/' + k + '.svg').join(' '));
  }

  // assets/ 에 그림이 있는데 WANT 에 이름이 없으면 그것도 안 들어갑니다.
  // 초상화(PORTRAITS)는 WANT 를 안 타지만 분명히 쓰이고 있습니다. 그 원본
  // 이름까지 세어 줘야 「목록에 없다」고 잘못 알리지 않습니다 —
  // 실제로 shop-keeper 를 두고 그렇게 알렸습니다.
  const listed = new Set(WANT.concat(PORTRAITS.map((q) => q.from)));
  const orphan = fs.readdirSync(ASSETS)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -4))
    .filter((k) => !listed.has(k) && !ON_PURPOSE.has(k));
  if (orphan.length) {
    console.log('\n⚠ assets/ 에 그림은 있는데 WANT 에 이름이 없는 것 ' + orphan.length + '장:');
    console.log('    ' + orphan.join(' '));
    console.log('  이대로면 게임에서는 도형이 계속 서 있습니다. 쓸 것이면 WANT 에 넣으세요.');
    console.log('  일부러 빼 둔 것이면 ON_PURPOSE 에 넣어 이 경고를 끄면 됩니다.');
  }
})();
