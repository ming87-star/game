// 33층 시퀀스가 실제로 열리고, 실제로 판과 같은 화면이고, 실제로 닫히는지
// 브라우저에서 확인합니다 (STORY.md 5절).
//
// 이 시퀀스는 **한 판에 한 번, 그것도 끝에** 일어납니다. 사람이 손으로
// 확인하려면 메달 마흔여덟 개를 다 사야 하므로, 사실상 아무도 다시 안 봅니다.
// 그래서 여기서 봅니다.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

(async () => {
  const port = Number(process.env.PORT) || 8121;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  let bad = 0;
  const check = (ok, label, got) => {
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
  };

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.setItem('tower-climb-v1', JSON.stringify({
    sawStory: true, medals: 99, endingStage: 0, lastJob: 'warrior',
    unlocked: { archer: true, rogue: true, monk: true, necro: true,
      digger: true, wizard: true, hunter: true },
  })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 15000 });
  console.log('');

  // ── 여는 조건 — 마흔여덟 개를 **다** 사야 합니다 ────────
  //
  // 하나 남았을 때 열리면 안 됩니다. 「할 수 있는 건 다 했다」가 이 시퀀스의
  // 여는 말인데, 하나 남기고 열리면 그 말이 거짓말이 됩니다.
  const 채움 = await page.evaluate(() => {
    let n = 0, 마지막 = null;
    CLASSES.forEach((j) => medalItemsFor(j).forEach((it) => { n++; 마지막 = { job: j.key, key: it.key }; }));
    CLASSES.forEach((j) => medalItemsFor(j).forEach((it) => {
      if (j.key === 마지막.job && it.key === 마지막.key) return;   // 하나만 남깁니다
      window.__save.addPerk(j.key, it.key);
    }));
    return { 전부: n, 남긴것: 마지막, 다샀나: boughtAll(), 단계: window.__save.endingStage };
  });
  check(채움.전부 === 48, '메달로 살 수 있는 것이 마흔여덟 개', 채움.전부 + '개');
  check(!채움.다샀나 && 채움.단계 === 0,
    '하나가 남으면 아직 안 열림', `다샀나 ${채움.다샀나} · 단계 ${채움.단계}`);

  // 그 하나를 실제로 삽니다. 장면 안에서 부르는 this.scene.start() 라야
  // 앞 장면이 꺼집니다 — game.scene.start() 는 하나 더 띄웁니다.
  const 열림 = await page.evaluate(async (마지막) => {
    window.__title.scene.start('medal', { jobKey: 마지막.job });
    await new Promise((r) => setTimeout(r, 700));
    const s = window.__medal;
    s.buy(s.items.find((i) => i.key === 마지막.key));
    await new Promise((r) => setTimeout(r, 700));
    return { 다샀나: boughtAll(), 단계: window.__save.endingStage,
      장면: window.__game.scene.getScenes(true).map((x) => x.scene.key).join(',') };
  }, 채움.남긴것);
  check(열림.다샀나 && 열림.단계 === 1 && 열림.장면 === 'endingline',
    '마지막 하나를 사는 그 자리에서 열림', `단계 ${열림.단계} · ${열림.장면}`);

  // ── 여는 말 — 다 뜨기 전에는 못 넘깁니다 ────────────────
  const 이른 = await page.evaluate(() => {
    window.__endingline.go();
    return { 넘어갔나: !!window.__endingline.leaving, 다떴나: window.__endingline.ready() };
  });
  check(!이른.넘어갔나 && !이른.다떴나, '세 줄이 다 뜨기 전에 누르면 안 넘어감');

  await page.waitForFunction(() => window.__endingline && window.__endingline.ready(),
    null, { timeout: 20000 });
  await page.evaluate(() => window.__endingline.go());
  await page.waitForFunction(() => window.__endingwatch, null, { timeout: 15000 });

  // ── 무너짐·일어남 컷 기록기 ────────────────────────────
  //
  // **장면에 들어가자마자 붙입니다.** 처음에는 「놈이 내려온 뒤」에 붙였는데,
  // 붙기도 전에 무너짐도 일어남도 다 지나가 버려서 0칸으로 읽혔습니다
  // (재 보니 이미 step7 이었습니다). 지나간 것을 뒤늦게 세려 하면 안 됩니다.
  await page.evaluate(() => {
    const 칸 = {}; const 배 = {};
    window.__컷기록 = { 칸, 배, 끝남: false };
    const tick = () => {
      const s = window.__endingwatch;
      if (!s || !s.scene.isActive() || s.step >= 6) { window.__컷기록.끝남 = true; return; }
      const v = s.cutView;
      if (v && v.texture && v.frame) {
        const k = v.texture.key;
        (칸[k] = 칸[k] || {})[v.frame.name] = 1;
        배[k] = Math.round(v.scaleX * 1000) / 1000;
        // **화면에 선 키**도 같이 잽니다 (아래 「키가 안 튄다」 검사).
        window.__컷기록.컷키 = Math.max(window.__컷기록.컷키 || 0,
          Math.round(v.getBounds().height));
      } else if (s.him && s.him.visible && s.step < 5) {
        window.__컷기록.그림키 = Math.round(s.him.getBounds().height);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // ── 보는 장면이 **판과 같은 화면**인가 ──────────────────
  //
  // 여기가 이 파일에서 가장 값진 검사입니다. 회색 네모로 되돌아가도 오류는
  // 안 나고 시퀀스는 멀쩡히 끝까지 돕니다 — 화면을 안 보면 아무도 모릅니다.
  const 화면 = await page.evaluate(() => {
    const s = window.__endingwatch;
    const 텍스처 = (o) => (o && o.texture ? o.texture.key : '');
    return {
      벽: (s.wallLayers || []).map((l) => 텍스처(l.o)).join(' '),
      발판: s.children.list.filter((o) => 텍스처(o) === 'plat').length,
      적: [...new Set(s.foes.map(텍스처))].sort().join(' '),
      층간격: s.floorY[31] - s.floorY[32],
      옆이비었나: !s.slots[33].right,
    };
  });
  check(화면.벽 === 'wall-far wall-mid wall-near',
    '판과 같은 벽 세 겹을 씀 (js/wall.js)', 화면.벽);
  check(화면.발판 >= 20, '판과 같은 발판 그림을 씀', 화면.발판 + '장');
  check(화면.적 === 'e-coinbug e-crawler',
    '33층에 실제로 나오는 놈들만 섬 (탑에서 가장 약한 둘)', 화면.적);
  check(화면.층간격 === 165, '층 간격이 판과 같음', 화면.층간격);
  // 33층 옆 발판이 비어 있어야 「피할 수 있었다」가 눈에 보입니다.
  check(화면.옆이비었나, '33층에서 그가 선 반대쪽이 비어 있음');

  // ── 죽이는 놈은 게임에 **없는** 놈인가 ──────────────────
  //
  // 층이 올라서 만나는 놈이면 「더 오르면 이긴다」가 되고, 그러면 엔딩이
  // 그냥 하나 남은 벽이 됩니다.
  await page.waitForFunction(() => window.__endingwatch.step >= 3, null, { timeout: 60000 });
  const 놈 = await page.evaluate(() => ({
    그림: window.__endingwatch.comer ? window.__endingwatch.comer.texture.key : '(없음)',
    판에있나: CFG.enemyTypes.some((t) => t.key === 'ending-foe' || t.name === '내려온 것'),
    도감에있나: Object.keys(CFG.foes || {}).includes('ending-foe'),
    보스인가: (CFG.boss.kinds || []).some((k) => k.key === 'ending-foe'),
  }));
  check(놈.그림 === 'ending-foe', '「내려온 것」이 그를 덮침', 놈.그림);
  check(!놈.판에있나 && !놈.도감에있나 && !놈.보스인가, '그놈은 판의 어느 층에도 안 나옴');

  // ── 오르면서 **정말로** 밝아지는가 ─────────────────────
  //
  // 이 검사가 생긴 까닭. 흰 화면은 이렇게 만들어져 있었습니다:
  //
  //     this.add.rectangle(x, y, w, h, 0xffffff, 0)   // ← 여섯째는 fillAlpha
  //     this.tweens.add({ targets: 덮개, alpha: 1, ... })
  //
  // 여섯째 인자는 alpha 가 아니라 **fillAlpha** 입니다. 그려질 때 쓰이는
  // 것은 둘의 곱이라 `0 × 1 = 0` — **한 번도 안 그려졌습니다.** 트윈은
  // 정상으로 돌고 alpha 는 0 에서 1 로 잘 올라가고 오류도 안 납니다.
  // 그래서 「덮개의 alpha 가 1 이 되는가」를 묻는 검사는 **통과합니다.**
  //
  // 물어야 하는 것은 **화면이 실제로 밝아졌는가**입니다. 그리는 판을
  // 직접 떠서 밝기를 잽니다. 안 그려지면 밝기가 어두운 채로 있다가
  // 다음 장면이 배경색을 바꾸는 한 프레임에 튑니다 — 중간값이 없습니다.
  const 밝기 = await page.evaluate(() => new Promise((done) => {
    const 잰값 = [];
    const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    g.canvas.width = 8; g.canvas.height = 8;
    const tick = () => {
      const s = window.__endingwatch;
      if (!s || !s.scene || !s.scene.isActive()) return done(잰값);
      if (s.step === 6) {
        try {
          g.drawImage(window.__game.canvas, 10, 10, 8, 8, 0, 0, 8, 8);
          const d = g.getImageData(0, 0, 8, 8).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
          잰값.push(Math.round(sum / (d.length / 4)));
        } catch (e) { /* 못 뜨면 그냥 넘어갑니다 */ }
      }
      if (s.step > 6) return done(잰값);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const 중간 = 밝기.filter((v) => v > 40 && v < 220).length;
  check(중간 >= 3, '오르는 동안 화면이 **단을 밟아** 밝아짐 (한 프레임에 안 튐)',
    '중간 밝기 ' + 중간 + '번 · ' + (밝기.length ? Math.min(...밝기) + '→' + Math.max(...밝기) : '못 쟀음'));
  check(밝기.length && Math.max(...밝기) >= 230, '끝에는 다 하얘짐',
    밝기.length ? Math.max(...밝기) : '못 쟀음');

  // ── 무너지고 일어나는 것이 **컷으로 도는가** ────────────
  //
  // 그림 한 장을 기울이던 시절에는 「옷 안에 아무것도 없다」는 말을
  // 들었습니다. 이제 여덟 컷을 밟습니다 (ART.md 8.36절).
  //
  // 컷이 안 실리면 예전 트윈으로 **조용히** 물러섭니다 — 오류도 안 나고
  // 장면도 끝까지 돕니다. 그러니 「끝까지 돌았는가」로는 못 잡습니다.
  // 컷이 실제로 몇 칸이나 넘어갔는지를 세어야 합니다.
  //
  // 배율도 같이 잽니다. 시트마다 잰 키(hero)를 각자 쓰면 무너진 사람과
  // 일어나는 사람의 **크기가 달라집니다** — cloak-fall 은 93.5 인데
  // cloak-rise 는 절반이 누운 컷이라 62.9 로 나옵니다. 한 배율로 세워야
  // 같은 사람입니다.
  await page.waitForFunction(() => window.__컷기록 && window.__컷기록.끝남,
    null, { timeout: 90000 });
  const 컷 = await page.evaluate(() => ({
    셈: Object.fromEntries(Object.entries(window.__컷기록.칸)
      .map(([k, v]) => [k, Object.keys(v).length])),
    배: window.__컷기록.배,
    컷키: window.__컷기록.컷키 || 0,
    그림키: window.__컷기록.그림키 || 0,
  }));
  check((컷.셈['sheet-cloak-fall'] || 0) >= 5,
    '무너지는 것이 여덟 컷으로 돎 (그림 한 장을 기울이는 것이 아니라)',
    (컷.셈['sheet-cloak-fall'] || 0) + '칸');
  check((컷.셈['sheet-cloak-rise'] || 0) >= 5,
    '일어나는 것도 컷으로 돎', (컷.셈['sheet-cloak-rise'] || 0) + '칸');
  check(컷.배['sheet-cloak-fall'] !== undefined
    && 컷.배['sheet-cloak-fall'] === 컷.배['sheet-cloak-rise'],
    '무너진 사람과 일어나는 사람의 키가 같음 (한 배율로 세움)',
    컷.배['sheet-cloak-fall'] + ' · ' + 컷.배['sheet-cloak-rise']);

  // 컷과 **그림 한 장**의 키가 같은가.
  //
  // 무너질 때 컷으로 갈아타고 다 일어서면 그림 한 장으로 돌아옵니다.
  // 둘의 키가 다르면 갈아타는 그 순간 사람이 커졌다 작아집니다 — 재 보니
  // 컷 70px · 그림 46px 이라 28% 줄었습니다. 시트의 hero 는 후드 쓴 사람의
  // 머리끝을 한참 아래에서 잡아서, 그 값으로 배율을 내면 이렇게 됩니다.
  // tall(0번 칸에 든 그림의 세로 길이)로 내야 맞습니다.
  const 키차 = Math.abs((컷.컷키 || 0) - (컷.그림키 || 0));
  check(컷.그림키 > 0 && 키차 <= 4,
    '컷과 그림 한 장이 같은 키로 섬 (갈아탈 때 안 튐)',
    '컷 ' + 컷.컷키 + 'px · 그림 ' + 컷.그림키 + 'px · 차 ' + 키차);

  // ── 끝까지 돌고 타이틀로 ────────────────────────────────
  await page.waitForFunction(() => window.__endingwatch.step >= 9, null, { timeout: 90000 });
  // **타이틀이 실제로 도는지까지 봅니다.** `window.__title.ready` 만 보면 안
  // 됩니다 — 장면 객체는 다시 쓰이므로 그 값은 **지난번 것이 남아 있습니다.**
  // 보는 장면이 아직 안 끝났는데 참으로 읽혀서, 판을 먼저 띄운 뒤에 타이틀이
  // 그 위로 올라오는 일이 실제로 있었습니다.
  await page.waitForFunction(() =>
    window.__game.scene.getScenes(true).map((x) => x.scene.key).join(',') === 'title'
    && window.__title && window.__title.ready, null, { timeout: 30000 });
  const 뒤 = await page.evaluate(() => window.__save.endingStage);
  check(뒤 === 1, '보는 장면이 끝나도 아직 1단계 (겉옷을 안 짚었으니)', 뒤);
  check(await page.evaluate(() => window.__save.sawEnding),
    '보는 장면을 끝까지 보면 「봤다」로 적힘');

  // ── 마지막 판 — 시작 발판에 붉은 겉옷 ───────────────────
  await page.evaluate(() => window.__title.scene.start('game', { jobKey: 'warrior' }));
  await page.waitForFunction(() => window.__scene && window.__scene.player && !window.__scene.dead,
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
  //
  // **「겉옷이 있는가」만 보면 안 됩니다.** 처음에 그것만 봤다가 놓쳤습니다 —
  // 겉옷을 주인공 발밑에 놓았더니 (1) 주인공이 통째로 가려서 안 보이고,
  // (2) 첫 프레임에 이미 짚은 것으로 쳐서 **마지막 판이 시작하자마자
  // 크레딧으로 넘어갔습니다.** 오류도 안 나고, 시퀀스는 끝까지 멀쩡히
  // 돌아서, 검사는 통과했습니다. 그래서 셋을 따로 봅니다.
  const 겉옷 = await page.evaluate(() => {
    const s = window.__scene;
    return { 있나: !!s.finalCloak,
      떨어짐: s.finalCloak ? Math.round(Math.abs(s.finalCloak.x - s.player.x)) : 0,
      가리나: s.finalCloak ? s.finalCloak.depth >= s.player.depth : false };
  });
  check(겉옷.있나, '마지막 판 바닥에 붉은 겉옷이 놓임');
  check(겉옷.떨어짐 > 100 && !겉옷.가리나,
    '겉옷이 주인공이 선 줄이 아닌 옆 줄에 있음 (안 가리고, 한 칸 옮겨야 닿게)',
    겉옷.떨어짐 + 'px 옆');

  // 2초를 그냥 둡니다. 저절로 짚히면 여기서 걸립니다 —
  // 「짚는다」가 고르는 일이 아니라 그냥 일어나는 일이 되어 있는 것입니다.
  await page.waitForTimeout(2000);
  const 그대로 = await page.evaluate(() => ({
    짚었나: !!window.__scene.tookCloak,
    장면: window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','),
  }));
  check(!그대로.짚었나 && 그대로.장면 === 'game',
    '가만히 두면 안 짚힘 — 마지막 판은 평소처럼 굴러감', 그대로.장면);

  // 짚으면 **짚어 드는 컷**이 돌고 나서 하얘집니다 (ART.md 8.37절).
  //
  // 여기서 반드시 봐야 하는 것이 하나 더 있습니다 — 판 위의 주인공은
  // 물리 몸과 **겉몸(무기 시트)** 둘입니다. 겉몸을 안 감추면 화면에
  // 전사가 둘이 됩니다. 실제로 그랬고, 감추는 줄에 이름을 this.motion 으로
  // 잘못 적어서 아무 일도 안 했습니다 (this.rig 입니다). 오류는 안 났습니다.
  await page.evaluate(() => {
    const 칸 = {}; let 겹침 = 0;
    window.__짚기 = { 칸, 겹침: 0, 끝남: false };
    const tick = () => {
      const s = window.__scene;
      if (!s || !s.scene.isActive()) { window.__짚기.끝남 = true; return; }
      const v = s.children.list.find((o) => o.texture && /^sheet-lift-/.test(o.texture.key));
      if (v && v.frame) {
        칸[v.frame.name] = 1;
        const 겉 = (s.rig && s.rig.views) || [];
        if (s.player.visible || 겉.some((o) => o.visible)) window.__짚기.겹침 = ++겹침;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => {
    const s = window.__scene;
    s.player.x = s.finalCloak.x; s.player.y = s.finalCloak.y;
  });
  await page.waitForFunction(() => window.__credits && window.__credits.shown,
    null, { timeout: 30000 });
  const 크레딧 = await page.evaluate(() => ({
    단계: window.__save.endingStage,
    글: window.__credits.children.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' | '),
  }));
  check(크레딧.단계 === 2, '겉옷을 짚으면 2단계', 크레딧.단계);
  const 짚기 = await page.evaluate(() => ({
    칸수: Object.keys(window.__짚기.칸).length, 겹침: window.__짚기.겹침,
  }));
  check(짚기.칸수 >= 5, '겉옷을 짚어 드는 것이 여덟 컷으로 돎', 짚기.칸수 + '칸');
  check(짚기.겹침 === 0,
    '컷이 도는 동안 주인공이 둘로 안 보임 (물리 몸도 겉몸도 감춰짐)',
    짚기.겹침 + '프레임 겹침');
  check(크레딧.글 === 'Project JHS | 처음부터 다시 하기',
    '크레딧에는 개발자명 한 줄과 다시 하기뿐', 크레딧.글);

  // ── 엔딩 뒤에는 「처음부터 다시 하기」 하나뿐입니다 ─────
  //
  // 한동안은 타이틀이 한 번 서고 누르면 크레딧으로 넘어갔습니다. 그러면
  // 켤 때마다 **「터치해서 계속하기」가 먼저 보입니다** — 계속할 것이 없는데
  // 계속하라고 적힌 화면입니다. 그 한 걸음을 없앴으므로, **누르지 않고**
  // 크레딧에 닿는지를 봅니다.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const 다시켬 = await page.evaluate(() => ({
    장면: window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','),
    단계: window.__save.endingStage,
  }));
  check(다시켬.장면 === 'credits' && 다시켬.단계 === 2,
    '엔딩 뒤에 다시 켜면 아무것도 안 눌러도 크레딧', 다시켬.장면);

  // 그 단추는 **기다리지 않고** 떠 있어야 합니다. 처음 한 번은 크레딧이지만
  // 그 뒤로는 단추 하나짜리 화면입니다 — 볼 때마다 이름이 떠오르기를
  // 기다리게 하면 그건 크레딧이 아니라 문턱입니다.
  await page.waitForFunction(() => window.__credits && window.__credits.shown,
    null, { timeout: 5000 });
  const 곧바로 = await page.evaluate(() => window.__credits.children.list
    .filter((o) => o.type === 'Text').map((o) => o.text).join(' | '));
  check(곧바로 === 'Project JHS | 처음부터 다시 하기',
    '단추가 기다림 없이 떠 있음', 곧바로);

  // 「처음부터 다시 하기」는 이름이 다 뜬 **뒤에야** 나옵니다. 여기서
  // 안 기다리면 아직 없는 단추를 누르게 됩니다.
  await page.waitForFunction(() => window.__credits && window.__credits.shown,
    null, { timeout: 30000 });

  // 「처음부터 다시 하기」는 **두 번** 눌러야 지웁니다. 여기를 잘못 누르면
  // 여태 쌓은 것이 전부 사라집니다 — 되돌릴 길이 없는 자리에는 문이 둘이라야
  // 합니다.
  const 한번 = await page.evaluate(async () => {
    const s = window.__credits;
    const box = s.children.list.find((o) => o.type === 'Rectangle');
    if (!box) return { 글: '단추가 아예 없음: ' + s.children.list.map((o) => o.type).join(',') };
    box.emit('pointerdown');
    await new Promise((r) => setTimeout(r, 300));
    return { 지웠나: !!s.wiping, 물었나: !!s.asking,
      글: s.children.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' | ') };
  });
  check(!한번.지웠나 && 한번.물었나 && 한번.글.includes('한 번 더'),
    '한 번 눌러서는 안 지우고 되묻습니다', 한번.글);


  // ── 시퀀스를 건너뛸 수 있는가 ───────────────────────────
  //
  // 보는 장면은 조작 없이 40초쯤 갑니다. 그 사이에 창을 닫거나 새로고침하는
  // 일은 드물지 않습니다 — 전화 한 통이면 됩니다.
  //
  // 이 검사가 없을 때 그렇게 끊고 다시 켠 사람은 **곧장 직업 고르기로**
  // 갔습니다. 판을 켜면 겉옷이 놓여 있고 짚으면 크레딧이니, 여는 말도 33층도
  // 「내려온 것」도 흰옷도 한 번을 못 보고 엔딩이 끝납니다. 오류는 없습니다.
  const 끊긴사람 = await page.evaluate(async () => {
    const 원래 = JSON.parse(window.localStorage.getItem('tower-climb-v1'));
    원래.endingStage = 1;
    원래.sawEnding = false;            // 샀지만 못 봤습니다
    window.localStorage.setItem('tower-climb-v1', JSON.stringify(원래));
    window.__save.load();
    window.__credits ? window.__credits.scene.start('title') : window.__title.scene.start('title');
    await new Promise((r) => setTimeout(r, 900));
    window.__title.go();
    await new Promise((r) => setTimeout(r, 800));
    return window.__game.scene.getScenes(true).map((x) => x.scene.key).join(',');
  });
  check(끊긴사람 === 'endingline',
    '보는 장면 도중에 끊고 다시 켜면 처음부터 다시 봄', 끊긴사람);

  console.log(bad ? `\n${bad}건 어긋남` : '\n33층 시퀀스가 열리고, 판과 같은 화면으로 돌고, 닫힙니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
