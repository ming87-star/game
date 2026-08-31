// ── 유물 서른다섯이 여덟 직업에서 다 도는가 ───────────────
//
//   CHROME_PATH=... node relic-audit.js
//
// 유물은 대부분 **직업을 가리지 않습니다.** 그런데 효과가 무기 갈래에
// 매여 있으면, 그 갈래를 안 쓰는 직업에게는 **아무 일도 안 하는 유물**이
// 유물 칸 하나를 차지하고 앉습니다. 오류도 안 나고 카드도 멀쩡히 뜹니다.
//
//   「관통하는 기름」 — 공용인데 pierce 는 화살에만 걸립니다.
//                      근접 다섯 직업에게는 죽은 유물입니다.
//
// 글도 같은 병이 있습니다. 「**벤** 적이 잠깐 불탄다」는 활과 지팡이를
// 쓰는 직업에게는 틀린 말입니다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = __dirname;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});
(async () => {
  await new Promise((r) => server.listen(8499, r));
  const br = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox','--use-gl=swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8499/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);

  const out = await pg.evaluate(() => {
    // 효과가 어느 갈래에서만 도는가. 코드를 읽고 손으로 적은 표입니다 —
    // 여기가 틀리면 아래가 통째로 헛돕니다.
    // pierceOil 은 예전에 여기 있었습니다. 지금은 근접에도 길이 있어
    // (swing 의 「관통하는 기름 (근접판)」) 어느 갈래에서도 헛돌지 않습니다.
    const 원거리만 = {
      bounce: '화살이 튕기는 것 (fireArrow 의 bounce)',
      huntMarkMul: '곰이 문 적을 화살로 크게 (shoot)',
    };
    const 근접만 = {
      wave: '휘두른 쪽으로 파동 (swing 의 fireWave)',
      reachScale: '근접 사거리 (weapon.reach)',
      falloff: '멀수록 무뎌짐 (swing 의 scaleAt)',
      stealBonus: '때리면서 훔치기 (swing)',
      stealAmount: '때리면서 훔치기 (swing)',
      backhand: '열 번째 한 대가 둘레로 (swing)',
    };
    const 갈래말 = ['화살', '활', '벤 ', '베는', '휘두', '날붙이', '칼', '검'];

    // 걸렸지만 틀리지 않은 것. 까닭을 적어 두지 않으면 다음 사람이 다시
    // 고치려 듭니다.
    const 봐줌 = {
      // 「이미 날아온 화살과 전류는 그대로 맞습니다」 — **적이 쏜** 화살입니다.
      // 내 자루와 아무 상관이 없어 여덟 직업 모두에게 맞는 말입니다.
      invisijump: '「화살」이 적이 쏜 것입니다',
    };

    const 직업 = CLASSES.map((c) => ({ key: c.key, name: c.name, 원거리: c.attack === 'ranged' }));
    const rows = [];
    RELICS.forEach((r) => {
      const 헛도는곳 = [];
      직업.forEach((j) => {
        // 그 직업이 이 유물을 얻을 수 있는가.
        if (!relicsFor(j.key).some((x) => x.key === r.key)) return;
        const 원 = Object.keys(원거리만).filter((k) => r[k]);
        const 근 = Object.keys(근접만).filter((k) => r[k]);
        if (원.length && !j.원거리) 헛도는곳.push({ j: j.name, why: 원.map((k) => 원거리만[k]) });
        if (근.length && j.원거리) 헛도는곳.push({ j: j.name, why: 근.map((k) => 근접만[k]) });
      });
      const 글 = (r.desc || '') + '  ' + (r.detail || '');
      const 걸린말 = 갈래말.filter((w) => 글.includes(w));
      // 그 말이 틀리는 직업이 있는가 — 공용인데 갈래를 가리키면 틀립니다.
      const 얻는직업 = 직업.filter((j) => relicsFor(j.key).some((x) => x.key === r.key));
      const 활 = ['화살', '활'].some((w) => 글.includes(w));
      const 칼 = ['벤 ', '베는', '휘두', '날붙이', '칼', '검'].some((w) => 글.includes(w));
      // 양쪽을 다 말하면 틀린 것이 아닙니다 — 갈래마다 다르게 도는 유물은
      // 「화살은 이렇게, 휘두름은 이렇게」라고 적는 것이 맞는 글입니다.
      const 말이틀린곳 = 걸린말.length && 얻는직업.length > 1 && !봐줌[r.key] && !(활 && 칼)
        ? 얻는직업.filter((j) => (활 && !j.원거리) || (칼 && j.원거리)).map((j) => j.name) : [];
      if (헛도는곳.length || 말이틀린곳.length) {
        rows.push({ 이름: r.name, jobs: r.jobs ? r.jobs.join(',') : '공용',
          헛도는곳, 말이틀린곳, 걸린말 });
      }
    });
    return { rows, 총: RELICS.length };
  });

  console.log(`  유물 ${out.총}개를 여덟 직업에 다 대 봤습니다.\n`);
  if (!out.rows.length) console.log('  헛도는 것도 틀린 말도 없습니다.');
  out.rows.forEach((r) => {
    console.log(`  ■ ${r.이름}  (${r.jobs})`);
    if (r.헛도는곳.length) {
      const 누구 = [...new Set(r.헛도는곳.map((x) => x.j))];
      console.log(`      효과가 안 돎 → ${누구.join(' · ')}`);
      console.log(`      까닭: ${r.헛도는곳[0].why.join(' / ')}`);
    }
    if (r.말이틀린곳.length) {
      console.log(`      글이 틀림 → ${r.말이틀린곳.join(' · ')}   (「${r.걸린말.join('」「')}」)`);
    }
  });
  console.log('\n' + (errs.length ? '오류:\n' + errs.join('\n') : '오류 없음'));
  await br.close(); server.close();
})();
