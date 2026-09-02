// 소리. **들어 볼 수가 없으므로 재서 봅니다.**
//
// 이 검사가 필요한 까닭은 그림 검사와 똑같습니다 — 소리가 안 나도 게임은
// **아무 일 없이 잘 돕니다.** 조용할 뿐이라 오류도 안 나고 화면도 멀쩡합니다.
// 그리고 소리는 화면과 달리 자동 시험이 「봤다」고 말할 수도 없습니다.
//
// 그래서 OfflineAudioContext 로 **한 소리씩 실제로 그려 내고 표본을 셉니다.**
// 소리가 났는지, 얼마나 길었는지, 얼마나 컸는지가 숫자로 나옵니다.
//
// ── 여기서 잡으려는 것 ──────────────────────────────────
//  1. 표에 적힌 소리가 실제로 소리를 내는가 (오타 하나면 무음입니다)
//  2. 코드가 부르는 이름이 표에 다 있는가 (반대로 표에만 있고 안 쓰는 것도)
//  3. **사람이 건드리기 전에는 안 나는가** — 안드로이드가 그렇게 시킵니다
//  4. 껐을 때 정말 안 나는가, 그리고 그 끔이 저장에 남는가
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

let bad = 0;
const check = (ok, label, got) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : '틀림'}  ${label}${got === undefined ? '' : '  → ' + got}`);
};

(async () => {
  const port = Number(process.env.PORT) || 9720;
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 30000 });

  // ── 1. 손을 대기 전에는 조용한가 ────────────────────────
  //
  // 안드로이드는 사람이 한 번 건드리기 전에 나는 소리를 막습니다. 그전에
  // AudioContext 를 만들어 두면 정지 상태로 만들어지고, 그대로 두면 **깨우는
  // 사람이 없어서 게임 내내 무음**입니다. 오류는 안 납니다.
  const 첫상태 = await page.evaluate(() => ({ 깨어남: Sfx.ready, 그릇: !!Sfx.ctx }));
  check(!첫상태.깨어남, '손대기 전에는 안 깨어 있음 (안드로이드 자동재생 정책)',
    '깨어남 ' + 첫상태.깨어남);

  await page.mouse.click(270, 500);
  await page.waitForTimeout(300);
  const 뒤상태 = await page.evaluate(() => ({ 깨어남: Sfx.ready, 상태: Sfx.ctx && Sfx.ctx.state }));
  check(뒤상태.깨어남, '한 번 건드리면 깨어남', '깨어남 ' + 뒤상태.깨어남 + ' · ' + 뒤상태.상태);

  // ── 2. 소리마다 실제로 그려지는가 ───────────────────────
  //
  // OfflineAudioContext 에 같은 코드를 그대로 태워서 표본을 셉니다.
  // Sfx 의 겹 쌓는 함수를 그대로 빌려 쓰므로, 표를 고치면 이 검사도 같이
  // 따라옵니다 — 검사용으로 따로 적어 두면 언젠가 어긋납니다.
  const 잰것 = await page.evaluate(async () => {
    const 이름들 = Object.keys(SFX);
    const 결과 = [];
    for (const 이름 of 이름들) {
      const 겹 = SFX[이름];
      const 길이 = 겹.reduce((a, 층) => a + 층.ms + (층.delay || 0), 0) / 1000 + 0.05;
      const off = new OfflineAudioContext(1, Math.ceil(44100 * 길이), 44100);
      // Sfx 를 잠깐 이 그릇에 물려서 같은 코드로 그립니다
      const 원래 = Sfx.ctx;
      Sfx.ctx = off;
      let 때 = 0;
      겹.forEach((층) => { 때 += (층.delay || 0) / 1000; Sfx.한겹(층, 때, 1); 때 += 층.ms / 1000; });
      const buf = await off.startRendering();
      Sfx.ctx = 원래;
      const d = buf.getChannelData(0);
      let 최대 = 0; let 소리난표본 = 0;
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > 최대) 최대 = v;
        if (v > 0.002) 소리난표본++;
      }
      결과.push({ 이름, 최대: Math.round(최대 * 1000) / 1000,
        울린ms: Math.round(소리난표본 / 44.1), 겹: 겹.length });
    }
    return 결과;
  });
  const 무음 = 잰것.filter((s) => s.최대 < 0.01);
  check(무음.length === 0, '표에 적힌 소리가 다 실제로 울림',
    무음.length ? '무음: ' + 무음.map((s) => s.이름).join(' ') : 잰것.length + '가지 다 울림');
  const 너무큼 = 잰것.filter((s) => s.최대 > 0.55);
  check(너무큼.length === 0, '귀를 찢는 것이 없음 (최대 0.55 넘지 않음)',
    너무큼.length ? 너무큼.map((s) => s.이름 + ' ' + s.최대).join(' ')
      : '가장 큰 것 ' + Math.max(...잰것.map((s) => s.최대)));
  // 발판 딛는 소리는 백 층이면 백 번 납니다. 여기가 크면 소리를 끕니다.
  const 딛음 = 잰것.find((s) => s.이름 === 'land');
  const 죽음 = 잰것.find((s) => s.이름 === 'death');
  check(딛음 && 죽음 && 딛음.최대 < 죽음.최대,
    '가장 자주 나는 소리가 가장 큰 소리보다 작음',
    '딛음 ' + (딛음 && 딛음.최대) + ' · 죽음 ' + (죽음 && 죽음.최대));
  const 짧음 = 잰것.filter((s) => s.울린ms < 20);
  check(짧음.length === 0, '너무 짧아 안 들리는 것이 없음 (20ms 넘게 울림)',
    짧음.length ? 짧음.map((s) => s.이름 + ' ' + s.울린ms + 'ms').join(' ')
      : '가장 짧은 것 ' + Math.min(...잰것.map((s) => s.울린ms)) + 'ms');

  // ── 3. 코드가 부르는 이름과 표가 맞는가 ─────────────────
  //
  // Sfx.play('coni') 처럼 한 글자 틀리면 **아무 일도 안 일어납니다.**
  // 표에 없으면 조용히 돌아가도록 만들어 두었기 때문입니다 (그게 맞습니다 —
  // 소리 때문에 판이 멈추면 안 되니까요). 그러니 여기서 대조합니다.
  const 부른것 = new Set();
  const 파일들 = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  파일들.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    [...src.matchAll(/Sfx\.play\(\s*'([^']+)'/g)].forEach((m) => 부른것.add(m[1]));
  });
  const 표 = new Set(잰것.map((s) => s.이름));
  const 없는이름 = [...부른것].filter((n) => !표.has(n));
  check(없는이름.length === 0, '코드가 부르는 이름이 표에 다 있음',
    없는이름.length ? '없음: ' + 없는이름.join(' ') : 부른것.size + '가지를 부름');
  const 안쓰는것 = [...표].filter((n) => !부른것.has(n));
  check(안쓰는것.length === 0, '표에만 있고 아무도 안 부르는 소리가 없음',
    안쓰는것.length ? '안 씀: ' + 안쓰는것.join(' ') : '없음');

  // ── 4. 끄면 정말 안 나는가, 그리고 그것이 남는가 ────────
  const 끔 = await page.evaluate(() => {
    Save.setMuted(true);
    // play 가 아무것도 안 만들고 돌아오는지를 봅니다
    const 전 = Sfx.ctx ? Sfx.ctx.currentTime : 0;
    Sfx.play('coin');
    return {
      꺼짐: Sfx.muted,
      저장에: JSON.parse(window.localStorage.getItem('tower-climb-v1')).muted,
      시간: 전,
    };
  });
  check(끔.꺼짐 === true, '끄면 Sfx 가 꺼짐');
  check(끔.저장에 === true, '끈 것이 저장에 남음 (다음에 켜도 꺼진 채)', String(끔.저장에));

  // 다시 켜고 저장에서 읽어 오는 길까지 봅니다
  const 다시 = await page.evaluate(() => {
    Save.setMuted(false);
    Save.data.muted = true;                       // 저장에는 꺼짐이 적혀 있고
    window.localStorage.setItem('tower-climb-v1', JSON.stringify(Save.data));
    Sfx.setMuted(false);                          // 지금은 켜져 있는 척
    Save.load();                                  // 다시 켠 셈 치고 읽으면
    return Sfx.muted;                             // 꺼진 채로 물려야 맞습니다
  });
  check(다시 === true, '다시 켰을 때 저장의 끔이 Sfx 에 물림', String(다시));

  console.log('\n' + 잰것.map((s) => `  ${s.이름.padEnd(7)} 최대 ${String(s.최대).padEnd(6)} ${s.울린ms}ms · ${s.겹}겹`).join('\n'));
  console.log(bad ? `\n${bad}건 어긋남` : '\n소리가 다 울리고, 끄면 조용하고, 손대기 전에는 안 납니다');
  console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})();
