// 앱 아이콘과 스토어 자산을 그립니다.
//
// ── 왜 로고 글자를 안 쓰는가 ────────────────────────────
// 제목이 「오늘도 탑을 오르는 나는 무슨 생각을 해야 할까」입니다. 48px
// 짜리 아이콘에 글자를 넣으면 아무것도 안 읽힙니다. 아이콘은 **무슨
// 게임인지 한눈에** 말해야 하고, 이 게임은 「어두운 탑을 오르는 것」입니다.
//
//   · 어두운 탑 실루엣이 아래에서 위로
//   · 위에서 내려오는 빛 한 줄기
//   · 그 안에 **붉은 점 하나** — 이 게임에서 붉은 것은 하나뿐입니다
//
// 적응형 아이콘은 **바깥 33%가 잘려 나갑니다** (원·둥근네모·물방울 등
// 제조사마다 다릅니다). 도형 아이콘은 그래서 가운데 66% 안에만 그립니다.
// 그린 그림(assets/app-icon.png)은 반대로 칸을 꽉 채웁니다 — 까닭은
// 아래 아이콘() 안에 적어 두었습니다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const OUT = path.join(ROOT, 'store');

// mipmap 크기 (안드로이드가 화면 밀도마다 골라 씁니다)
const 밀도 = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

// 그림 한 장을 SVG 로 짓습니다. 안전칸(safe)이 참이면 가운데 66% 안에만
// 그립니다 — 적응형 아이콘의 앞겹에 쓸 때입니다.
function 탑그림(w, h, opt) {
  const o = opt || {};
  const 안전 = o.safe ? 0.66 : 1;
  const cx = w / 2;
  const 바탕 = o.bg === false ? '' :
    `<rect width="${w}" height="${h}" fill="#141a2e"/>`;
  // 그림이 들어갈 칸
  const S = Math.min(w, h) * 안전;
  const 위 = h / 2 - S / 2;
  const 탑w = S * 0.30;
  const 탑x = cx - 탑w / 2;
  const 탑위 = 위 + S * 0.30;
  const 탑아래 = 위 + S;
  // 돌 줄눈
  let 줄 = '';
  for (let y = 탑위 + S * 0.10; y < 탑아래; y += S * 0.105) {
    줄 += `<rect x="${탑x}" y="${y.toFixed(1)}" width="${탑w}" height="${(S * 0.012).toFixed(1)}" fill="#0e1426" opacity=".55"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff8e1" stop-opacity=".85"/>
      <stop offset="100%" stop-color="#fff8e1" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe9a8" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#ffe9a8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${바탕}
  <!-- 위에서 내려오는 빛 -->
  <path d="M ${cx - S * 0.055} ${위} L ${cx + S * 0.055} ${위}
           L ${cx + S * 0.30} ${탑아래} L ${cx - S * 0.30} ${탑아래} Z"
        fill="url(#shaft)" opacity=".55"/>
  <ellipse cx="${cx}" cy="${위 + S * 0.06}" rx="${S * 0.26}" ry="${S * 0.13}" fill="url(#glow)"/>
  <!-- 탑 — 위가 부서져 있습니다. 꼭대기는 이 게임이 안 그리는 것입니다 -->
  <path d="M ${탑x} ${탑아래}
           L ${탑x} ${탑위 + S * 0.05}
           L ${탑x + 탑w * 0.22} ${탑위}
           L ${탑x + 탑w * 0.40} ${탑위 + S * 0.055}
           L ${탑x + 탑w * 0.62} ${탑위 - S * 0.02}
           L ${탑x + 탑w * 0.82} ${탑위 + S * 0.04}
           L ${탑x + 탑w} ${탑위 + S * 0.012}
           L ${탑x + 탑w} ${탑아래} Z"
        fill="#39445e"/>
  <!-- 오른쪽 어두운 면 -->
  <rect x="${탑x + 탑w * 0.62}" y="${탑위 + S * 0.03}" width="${탑w * 0.38}" height="${탑아래 - 탑위 - S * 0.03}" fill="#2b3347"/>
  ${줄}
  <!-- 붉은 것 하나. 탑 가운데쯤에서 오르고 있습니다 -->
  <ellipse cx="${cx}" cy="${탑위 + S * 0.33}" rx="${S * 0.075}" ry="${S * 0.055}" fill="#ffd9d0" opacity=".18"/>
  <path d="M ${cx - S * 0.035} ${탑위 + S * 0.365}
           q 0 -${S * 0.075} ${S * 0.035} -${S * 0.075}
           q ${S * 0.035} 0 ${S * 0.035} ${S * 0.075} Z"
        fill="#c02020"/>
</svg>`;
}

async function 굽기(page, svg, w, h, 파일) {
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  const png = await page.evaluate(async ([src, w, h]) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/png');
  }, [uri, w, h]);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, Buffer.from(png.split(',')[1], 'base64'));
  return fs.statSync(파일).size;
}

// ── 그림이 오면 그쪽을 씁니다 ───────────────────────────
//
// assets/app-icon.png (1024×1024) 가 있으면 아래 도형 대신 그것을 씁니다
// — 하늘 한 장(above-tower)과 같은 규칙입니다. 그림 세션이 그리는 법은
// gen-sprite.js 의 app-icon 항목에 있습니다:
//
//     GEMINI_API_KEY=... node gen-sprite.js app-icon
//
// 도형은 지우지 않습니다. 그림을 다시 그리는 동안에도 아이콘 없는 앱이
// 되면 안 되니까요.
const 그린것 = path.join(ROOT, 'assets', 'app-icon.png');
const 그림있나 = fs.existsSync(그린것);

// ── 어두운 모드용 한 장 ─────────────────────────────────
//
// assets/app-icon-night.png 가 있으면 **mipmap-night-* 폴더**에 따로 굽습니다.
// 폰이 어두운 모드일 때 안드로이드가 이쪽을 골라 씁니다.
//
// **테마 아이콘(monochrome) 자리가 아닙니다.** 그 칸은 알파만 쓰고 색은
// 시스템이 통째로 갈아 끼우기 때문에 그림을 넣으면 덩어리가 됩니다.
// 실루엣을 그려 넣어 봤지만 사장님이 그림 쪽을 골랐고, 그래서 monochrome
// 은 아예 뺐습니다 — 빼면 테마 아이콘을 켜도 그냥 이 그림이 나옵니다.
//
// 다만 **런처가 아이콘을 캐시합니다.** 어두운 모드로 바꾸자마자 안 바뀔
// 수 있고, 런처에 따라 -night 를 아예 안 보기도 합니다. 그래도 낮 아이콘이
// 그대로 나올 뿐이라 잃는 것은 없습니다.
const 밤것 = path.join(ROOT, 'assets', 'app-icon-night.png');
const 밤있나 = fs.existsSync(밤것);

// 아이콘 한 장을 SVG 로 감쌉니다. 그림이 있으면 그것을, 없으면 도형을.
function 아이콘(w, h, opt) {
  const o = opt || {};
  if (!그림있나) return 탑그림(w, h, opt);
  const 쓸것 = o.밤 ? 밤것 : 그린것;
  const uri = 'data:image/png;base64,' + fs.readFileSync(쓸것).toString('base64');
  if (!o.safe) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
      + `<image href="${uri}" x="0" y="0" width="${w}" height="${h}"/></svg>`;
  }
  // 적응형 앞겹 — 그림이 **108dp 칸을 꽉 채웁니다**.
  //
  // 처음에는 도형 아이콘과 같이 가운데 66% 안에 줄여 앉혔는데, 그러면
  // 마스크(원·둥근네모) 가 그림보다 커서 **테두리에 뒷겹 색이 비칩니다**.
  // 그 이음매는 뒷겹 색을 아무리 잘 골라도 안 없어집니다 — 그림 위쪽
  // 테두리는 빛기둥이라 #4a4132(금색), 아래쪽은 #050c18(거의 검정)
  // 이어서 **한 가지 색으로 맞출 수가 없습니다**.
  //
  // 그린 그림은 이미 가장자리까지 채운 한 장이고 붉은 사람은 한가운데에
  // 있습니다. 꽉 채우면 바깥 33% 가 잘리지만 잘리는 것은 빛의 꼭대기와
  // 탑 밑동뿐이고, 대신 48px 에서 붉은 사람이 훨씬 크게 읽힙니다.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    + `<image href="${uri}" x="0" y="0" width="${w}" height="${h}"/></svg>`;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const 만든것 = [그림있나 ? '그림(assets/app-icon.png)으로 굽습니다'
    : '아직 그림이 없어 도형으로 굽습니다 (gen-sprite.js app-icon)'];
  if (밤있나) 만든것.push('어두운 모드는 assets/app-icon-night.png (mipmap-night-* 폴더)');

  // ── 폰에 들어가는 열다섯 장 (밤 그림이 있으면 서른 장) ──
  //
  // 옛 방식(안드로이드 7 까지)은 아이콘 한 장이 통째로 들어가고,
  // 적응형(8 이상)은 108dp 칸에 앞겹을 넣습니다. 도형은 가운데 66% 안에,
  // 그린 그림은 칸을 꽉 채웁니다 — 까닭은 아이콘() 안에 있습니다.
  //
  // **폴더 이름의 한정자에는 정해진 차례가 있습니다.** 어두운 모드(night)는
  // 밀도(hdpi)보다 **앞**에 와야 합니다 — `mipmap-night-hdpi` 입니다.
  // 처음에 `mipmap-hdpi-night` 로 지었다가 첫 빌드가 여기서 멈췄습니다:
  //
  //     mipmap-hdpi-night: Error: Invalid resource directory name
  //
  // 이 잘못은 **여기서는 아무 표시도 안 납니다.** 폴더가 만들어지고 그림도
  // 잘 구워집니다. 안드로이드가 자원을 합칠 때에야 걸립니다.
  const 밤낮 = 밤있나 ? [{ 밤: false, 머리: '' }, { 밤: true, 머리: 'night-' }]
    : [{ 밤: false, 머리: '' }];
  for (const { 밤, 머리 } of 밤낮) {
    for (const [d, n] of Object.entries(밀도)) {
      const 방 = path.join(RES, 'mipmap-' + 머리 + d);
      const 크기 = await 굽기(page, 아이콘(n, n, { 밤 }), n, n, path.join(방, 'ic_launcher.png'));
      await 굽기(page, 아이콘(n, n, { 밤 }), n, n, path.join(방, 'ic_launcher_round.png'));
      const N = Math.round(n * 108 / 48);   // 적응형은 108dp 칸입니다
      await 굽기(page, 아이콘(N, N, { safe: true, bg: false, 밤 }), N, N,
        path.join(방, 'ic_launcher_foreground.png'));
      만든것.push(`mipmap-${머리}${d}  ${n}×${n}  ${Math.round(크기 / 1024)}KB`);
    }
  }

  // ── 스토어 자산 ─────────────────────────────────────────
  const 아이콘512 = await 굽기(page, 아이콘(512, 512), 512, 512,
    path.join(OUT, 'icon-512.png'));
  만든것.push(`store/icon-512.png  512×512  ${Math.round(아이콘512 / 1024)}KB`);

  // ── 피처 그래픽 ─────────────────────────────────────────
  //
  // 스토어 목록 맨 위에 걸립니다. **글자는 코드가 얹습니다** — 그림
  // 모델은 한글을 제대로 못 씁니다. 획이 뭉개지거나 없는 글자를 지어냅니다.
  // 그림은 오른쪽 절반을 맡고, 왼쪽은 제목 자리로 비워 둡니다.
  //
  // 그림을 x=256 에 놓아 **아이콘의 가운데 띠**가 오른쪽 칸에 오게 합니다.
  // x=512 였을 때는 아이콘의 왼쪽 절반만 보였는데, 아이콘의 붉은 사람은
  // 한가운데(x≈515)에 서 있어서 **오른쪽 끝에 반쯤 잘려** 나왔습니다.
  // 이 배너에서 유일한 붉은 것이라 잘리면 안 됩니다.
  const 피처그림 = 그림있나
    ? `<defs><clipPath id="cut"><rect x="512" y="0" width="512" height="500"/></clipPath></defs>
       <image href="data:image/png;base64,${fs.readFileSync(그린것).toString('base64')}"
              x="256" y="-262" width="1024" height="1024" clip-path="url(#cut)" preserveAspectRatio="xMidYMid slice"/>
       <rect x="512" y="0" width="150" height="500" fill="url(#fade)"/>`
    : `<path d="M 700 0 L 760 0 L 900 500 L 560 500 Z" fill="url(#sh)" opacity=".5"/>
       <rect x="686" y="120" width="96" height="380" fill="#39445e"/>
       <rect x="746" y="120" width="36" height="380" fill="#2b3347"/>
       <path d="M 686 130 L 708 118 L 726 136 L 748 112 L 768 132 L 782 120 L 782 140 L 686 145 Z" fill="#0d1120"/>
       <path d="M 720 240 q 0 -26 12 -26 q 12 0 12 26 Z" fill="#c02020"/>`;
  const 피처 = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1120"/><stop offset="100%" stop-color="#1a2136"/>
    </linearGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff8e1" stop-opacity=".5"/>
      <stop offset="100%" stop-color="#fff8e1" stop-opacity="0"/>
    </linearGradient>
    <!-- 그림과 글자 자리의 이음매. 딱 끊기면 두 장을 붙인 것으로 보입니다. -->
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0d1120" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0d1120" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  ${피처그림}
  <text x="86" y="222" font-family="sans-serif" font-size="34" fill="#7b88ad">오늘도 탑을 오르는 나는</text>
  <text x="86" y="292" font-family="sans-serif" font-size="62" font-weight="700" fill="#e8eefc">무슨 생각을 해야 할까</text>
  <text x="86" y="352" font-family="sans-serif" font-size="27" fill="#5f6d99">한 손으로 오르는 탑 · 직업 여덟 · 유물 서른다섯</text>
</svg>`;
  const 피처크기 = await 굽기(page, 피처, 1024, 500, path.join(OUT, 'feature-1024x500.png'));
  만든것.push(`store/feature-1024x500.png  1024×500  ${Math.round(피처크기 / 1024)}KB`);

  await browser.close();
  console.log(만든것.join('\n'));
})();
