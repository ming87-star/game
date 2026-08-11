// 오프닝 네 컷을 한 장에 묶어 찍습니다.
//
// **여기서 꼭 봐야 하는 것은 컷이 제대로 잘렸는가입니다.** setCrop 은 자른
// 만큼만 그리되 자리는 원본 기준이라, 되밀어 주는 셈을 틀리면 오른아래 컷이
// 화면 밖으로 나가 버립니다. 그런데 그림이 네 컷 다 비슷하게 생기면 눈으로는
// "좀 이상한데" 정도로만 보입니다 — 그래서 시험용 그림은 사분면마다 색과
// 막대 개수가 다르게 그려 두었습니다 (art/story.png).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});

(async () => {
  await new Promise((r) => server.listen(9900, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:9900/', { waitUntil: 'networkidle' });
  // 처음 켠 사람 그대로 — 오프닝이 저절로 나와야 합니다.
  await page.evaluate(() => window.localStorage.removeItem('tower-climb-v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const n = await page.evaluate(() => (window.__story ? window.__story.panels.length : 0));
  if (!n) { console.log('오프닝이 안 나왔습니다'); process.exit(1); }

  const names = [];
  for (let i = 0; i < n; i++) {
    if (i) { await page.mouse.click(270, 400); await page.waitForTimeout(320); }
    const f = 'story-' + (i + 1) + '.png';
    await page.screenshot({ path: path.join(ROOT, 'shots/' + f) });
    names.push(f);
  }

  // 시작 화면의 「이야기 다시 보기」 자리도 같이 봐 둡니다.
  await page.evaluate(() => window.__story.finish());
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ROOT, 'shots/story-select.png') });
  names.push('story-select.png');

  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'shots', f)).toString('base64');
  const titles = ['1컷 (왼위)', '2컷 (오른위)', '3컷 (왼아래)', '4컷 (오른아래)', '시작 화면'];
  const sheet = await browser.newPage({ viewport: { width: 1400, height: 560 } });
  await sheet.setContent(`<style>html,body{margin:0;background:#0d1120;font-family:sans-serif;color:#8794b5}
    .row{display:flex;gap:12px;padding:10px 12px}figure{margin:0}
    img{width:260px;border:1px solid #2a3252;border-radius:5px;display:block}
    figcaption{text-align:center;font-size:14px;padding-top:5px}</style>
    <div class="row">${names.map((f, i) =>
      `<figure><img src="${b64(f)}"><figcaption>${titles[i]}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(300);
  await sheet.screenshot({ path: path.join(ROOT, 'shots/story-sheet.png') });

  console.log(errs.length ? '오류:\n' + errs.join('\n') : '오류 없음');
  await browser.close(); server.close();
  process.exit(errs.length ? 1 : 0);
})();
