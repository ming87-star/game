// ── 글줄이 제 자리 안에 들어가는가 ───────────────────────
//
// 문구를 손볼 때마다 "이 정도면 들어가겠지"로 어림하면 반드시 넘칩니다.
// 실제로 그려 보고 남는 자리를 픽셀로 셉니다.
//
// 이 검사를 만든 까닭: 유물 설명 열두 줄이 이미 카드 밖으로 넘고 있었는데
// 아무도 몰랐습니다. 넘친 글은 잘리는 것이 아니라 **카드 밖으로 흘러나가서**,
// 글자 겹침 검사(verify-layout.js)도 조용히 지나갑니다 — 옆에 겹칠 글이
// 없으면 겹침이 아니니까요. 자리가 모자라니 문구를 자꾸 줄이게 되고, 줄이다
// 보면 뜻이 뭉개집니다. 그 고리를 여기서 끊습니다.
//
// 자리는 **글이 시작하는 곳부터 그 줄에서 다른 것이 시작하는 곳까지**입니다.
// 값(◎ 250)이나 직업 표가 오른쪽에 붙는 줄은 그만큼 좁습니다.
//
// 그리고 `**`는 여기서 함께 잡습니다. 처음 보는 놈 안내 창(js/scene-foe.js)만
// 그 표를 떼고 그리므로, 다른 데 적힌 `**`는 별표째 화면에 뜹니다.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

let bad = 0;

(async () => {
  const port = Number(process.env.PORT) || 9771;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const out = await page.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0];
    const font = (size) => ({ fontFamily: 'sans-serif', fontSize: size + 'px' });
    // 실제로 그려 보고 폭만 읽은 뒤 지웁니다. 글꼴 셈은 브라우저가 하는
    // 것이라, 글자 수로 어림하는 것과 달리 여기서 나온 값이 곧 화면입니다.
    const width = (text, size) => {
      const t = scene.add.text(0, -9999, text, font(size));
      const w = Math.round(t.width);
      t.destroy();
      return w;
    };

    const rows = [];
    // 줄바꿈이 있는 글은 **줄마다 따로** 잽니다. 통째로 재면 두 줄짜리 글이
    // 늘 넘친 것으로 나옵니다 — 화면에서는 나뉘어 그려지는데.
    const put = (곳, 열쇠, 글, 크기, 자리) => {
      if (!글) return;
      String(글).split('\n').forEach((줄, i, 전체) => {
        if (!줄) return;
        rows.push({ 곳, 열쇠: 열쇠 + (전체.length > 1 ? ' ' + (i + 1) + '줄' : ''),
          글: 줄, 폭: width(줄, 크기), 자리 });
      });
    };

    // 유물 고르는 카드 (js/scene-game.js 의 openRelicChoice) — 상자 460 폭에
    // 글은 cx-200 부터. 오른쪽 끝(cx+230)까지 430 이 답니다.
    RELICS.forEach((r) => {
      put('유물 desc', r.key, r.desc, 20, 430);
      put('유물 detail', r.key, r.detail, 17, 430);
      // 유물 도감 (js/scene-relicbook.js) — 같은 글을 더 작게 쓰지만, 직업
      // 전용이면 오른쪽 끝(cx+205)에 직업 이름이 붙어 그만큼 좁아집니다.
      // 그 이름도 재서 뺍니다 — 「전사·도적」과 「궁수」는 자리가 다릅니다.
      const 직업표 = r.jobs ? width(r.jobs.map((k) => classByKey(k).name).join('·'), 16) : 0;
      put('도감 detail', r.key, r.detail, 16, 405 - 직업표 - (직업표 ? 10 : 0));
    });

    // 상점 줄 (js/shop.js 의 buildRow) — 글은 cx-190 부터, 값은 cx+190 에
    // 오른쪽 맞춤. 값이 「◎ 9999」까지 가므로 그만큼 뺍니다.
    // 진열이 다섯이면 글꼴이 작아지므로(TIGHT) 둘 다 재 둡니다.
    Object.entries(SHOP_ITEMS).forEach(([key, it]) => {
      put('상점 desc', key, it.desc, 18, 300);
      put('상점 desc(좁은 진열)', key, it.desc, 16, 300);
      put('상점 title', key, it.title, 26, 300);
    });

    // 메달 상점 줄 (js/scene-medal.js 의 buildRow) — 상자 440, 글은 cx-200
    // 부터, 값(🏅 8)이 cx+200 에 오른쪽 맞춤.
    MEDAL_ITEMS.forEach((it) => {
      put('메달 desc', it.key, it.desc, 17, 340);
      put('메달 title', it.key, it.title, 24, 340);
    });

    // 직업 고르기 (js/scene-select.js) — 격자 아래 세부 패널. 글은 cx-230
    // 부터 468 이 답니다. **이름 줄만 좁습니다** — 격자 한 칸이 109 라,
    // 이름이 그보다 길면 옆 칸을 밟습니다.
    CLASSES.forEach((job) => {
      put('직업 이름(격자 칸)', job.key, job.name, 19, 105);
      put('직업 blurb', job.key, job.blurb, 19, 468);
      put('직업 detail', job.key, job.detail, 17, 468);
      put('직업 소문', job.key, job.rumor, 19, 468);
      // 잠긴 줄 — 「한 판에서 700층 · 코인 2000」
      if (job.unlockFloor) {
        put('직업 해금 조건', job.key,
          '한 판에서  ' + job.unlockFloor + '층 · 코인 ' + job.unlockCoins, 20, 468);
      }
      // 맨 아랫줄은 왼쪽(무기 n/25)과 오른쪽(전용 유물)이 마주 봅니다.
      const mine = RELICS.find((r) => r.jobs && r.jobs.includes(job.key) && r.jobs.length === 1);
      if (mine) put('직업 전용 유물', job.key, '전용 유물  ' + mine.name, 17, 468 - 90);
    });

    // 처음 보는 놈 안내 창은 `**`를 떼고 그리므로 뗀 뒤의 길이로 잽니다.
    // 여기만 가운데 맞춤에 줄바꿈이 걸려 있어 폭 대신 표만 봅니다.
    const starred = [];
    const scan = (곳, 열쇠, 글) => {
      if (typeof 글 === 'string' && 글.includes('**')) starred.push(곳 + ' · ' + 열쇠);
    };
    RELICS.forEach((r) => { scan('유물', r.key, r.desc); scan('유물', r.key, r.detail); });
    Object.entries(SHOP_ITEMS).forEach(([k, it]) => { scan('상점', k, it.desc); scan('상점', k, it.title); });
    MEDAL_ITEMS.forEach((it) => { scan('메달', it.key, it.desc); scan('메달', it.key, it.title); });
    Object.values(TROPHIES).forEach((t) => { scan('전리품', t.key, t.detail); });

    return { rows, starred };
  });

  const over = out.rows.filter((r) => r.폭 > r.자리);
  if (over.length) {
    bad += over.length;
    console.log('자리를 넘는 줄 ' + over.length + '개\n');
    over.forEach((r) => {
      console.log(`틀림  [${r.곳}] ${r.열쇠}  ${r.폭}px / ${r.자리}px  (+${r.폭 - r.자리})`);
      console.log(`      ${r.글}`);
    });
    console.log('');
  } else {
    console.log('OK    ' + out.rows.length + '줄이 모두 제 자리 안에 들어감');
  }

  // `**`는 그리는 쪽에서 떼는 자리(scene-foe.js)에만 있어야 합니다.
  if (out.starred.length) {
    bad += out.starred.length;
    out.starred.forEach((s) => console.log('틀림  ' + s + ' 에 `**` 가 남아 있음 (별표가 그대로 뜹니다)'));
  } else {
    console.log('OK    그려지는 글에 `**` 가 남아 있지 않음');
  }

  console.log('\n가장 아슬아슬한 것들 (아직 안 넘음)');
  out.rows.filter((r) => r.폭 <= r.자리).sort((a, b) => (b.폭 - b.자리) - (a.폭 - a.자리))
    .slice(0, 6).forEach((r) => {
      console.log(`  [${r.곳}] ${r.열쇠}  ${r.폭}px / ${r.자리}px  (남은 자리 ${r.자리 - r.폭})`);
    });

  console.log(bad ? `\n${bad}건 어긋남` : '\n글줄이 모두 제 자리에 들어갑니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');

  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
