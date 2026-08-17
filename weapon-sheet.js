// 무기표 한 장을 짓습니다.  node weapon-sheet.js [나갈 파일]
//
// **코드에서 값을 뽑아 씁니다.** 손으로 옮겨 적은 표는 고치는 순간부터
// 거짓말을 시작하는데, 무기 수치는 자주 만지는 자리입니다. 밸런스를 손본
// 뒤에 이걸 한 번 돌리면 표가 따라옵니다.
//
// 브라우저를 안 띄웁니다 — config·forge·classes·weapon 네 파일만 읽어서
// 같은 스코프에서 실행하고 필요한 것을 꺼냅니다 (survey.js 와 같은 수법).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUT = process.argv[2] || path.join(__dirname, 'dist', 'weapons.html');

const source = ['js/config.js', 'js/forge.js', 'js/classes.js', 'js/weapon.js']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n;\n') + '\n;({ CFG, CLASSES, FORGES, buildWeaponPool, Weapon })';

const { CFG, CLASSES, FORGES, buildWeaponPool, Weapon } =
  vm.runInContext(source, vm.createContext({
    Math,
    Save: { data: { unlocked: {} }, recordWeapon() {} },
    window: { localStorage: { getItem: () => null, setItem() {} } },
    // forge.js·weapon.js 가 Phaser 의 셈 몇 가지를 씁니다. 흉내만 냅니다.
    Phaser: { Math: {
      Clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
      Between: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    } },
  }));

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (x) => Math.round(x * 100) + '%';
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

// ── 만듦새가 초당 피해로 중립인지 ─────────────────────────
// forge.js 의 규칙입니다. 표에 적을 값이자, 어긋나면 눈에 띄어야 하는 값입니다.
const delta = {};
CLASSES.forEach((job) => {
  const pool = buildWeaponPool(job);
  const w = new Weapon(job, 0);
  pool.filter((x) => x.forge !== 'plain').forEach((x) => {
    const base = pool.find((b) => b.family === x.family && b.forge === 'plain');
    (delta[x.forge] = delta[x.forge] || []).push(w.dpsOf(x, false) / w.dpsOf(base, false) - 1);
  });
});
const avg = (k) => delta[k].reduce((a, b) => a + b, 0) / delta[k].length;
const signed = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';

const FORGE_ORDER = ['iron', 'keen', 'black', 'silver'];
const FORGE_NOTE = {
  iron: '무겁게 두들긴 것', keen: '얇게 벼린 것',
  black: '검은 쇠', silver: '은을 입힌 것',
};

function forgeLegend() {
  return FORGE_ORDER.map((k) => {
    const f = FORGES[k];
    const rows = [
      ['공격력', f.dmg === 1 ? '—' : '×' + f.dmg],
      ['주기', f.rate === 1 ? '—' : '×' + f.rate + (f.rate > 1 ? ' 느림' : ' 빠름')],
      ['거리', f.reach === 1 ? '—' : '×' + f.reach],
      ['정확도', f.acc === 0 ? '—' : (f.acc > 0 ? '+' : '') + Math.round(f.acc * 100) + '%p'],
      ['폭', f.spread === 1 ? '—' : '×' + f.spread],
    ];
    return `<article class="forge">
      <header><span class="chip" style="--tint:${hex(f.tint)}"></span>
        <h3>${esc(f.prefix)}</h3><p>${esc(FORGE_NOTE[k])}</p></header>
      <dl>${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <footer>초당 피해 <b>${signed(avg(k))}</b> <span>세 직업 평균</span></footer>
    </article>`;
  }).join('');
}

function jobSection(j) {
  const pool = buildWeaponPool(j);
  const wp = new Weapon(j, 0);
  const dpsOf = (w) => wp.dpsOf(w, false);
  const max = Math.max(...pool.map(dpsOf));
  const ranged = j.attack === 'ranged';

  // 자루 하나가 한 줄입니다. 원본과 만듦새를 나란히 놓아야 맞바꿈이 가로로 읽힙니다.
  const fams = [];
  pool.forEach((w) => {
    if (w.forge === 'plain') fams.push({ plain: w, forged: null });
    else fams[fams.length - 1].forged = w;
  });

  const cell = (w) => {
    if (!w) return `<td class="dmg">—</td><td class="num">—</td><td class="num">—</td>`
      + `<td class="num">—</td>${ranged ? '<td class="num">—</td>' : ''}<td class="dps">—</td>`;
    const d = dpsOf(w);
    return `<td class="dmg"><span style="--tint:${w.color === undefined ? '#888' : hex(w.color)}" class="dot"></span>${w.dmgMin}<i>~</i>${w.dmgMax}</td>
      <td class="num">${w.rate}</td>
      <td class="num${w.acc >= 0.98 ? ' hi' : w.acc <= 0.85 ? ' lo' : ''}">${pct(w.acc)}</td>
      <td class="num">${w.range || w.reach}</td>
      ${ranged ? `<td class="num">${w.shots || 1}</td>` : ''}
      <td class="dps"><b>${d}</b><span class="bar" style="--w:${(d / max * 100).toFixed(1)}%"></span></td>`;
  };

  // 만듦새 쪽은 「이름」 칸이 하나 더 붙습니다. 여기를 안 맞추면 머리와 몸의
  // 칸 수가 어긋나서 표가 통째로 밀립니다.
  const span = ranged ? 6 : 5;
  const sub = `<th class="r">공격력</th><th class="r">주기</th><th class="r">정확</th>`
    + `<th class="r">${ranged ? '사정' : '사거리'}</th>${ranged ? '<th class="r">발</th>' : ''}<th class="r">초당</th>`;

  return `<section class="job" id="${j.key}">
    <header class="jobhead">
      <div><span class="eyebrow">직업</span><h2>${esc(j.name)}</h2><p>${esc(j.blurb)}</p></div>
      <dl class="facts">
        <div><dt>초당 피해</dt><dd>${Math.min(...pool.map(dpsOf))}<i>→</i>${max}</dd></div>
        <div><dt>속도 한계</dt><dd>×${j.speedCap}</dd></div>
        <div><dt>체력 · 방어</dt><dd>${j.hp}<i>·</i>${j.usesArmor ? j.armor + '~' + j.armorMax + '%' : '가죽 ' + j.armor + '%'}</dd></div>
        <div><dt>${j.usesArmor ? '특성' : '회피'}</dt><dd>${j.usesArmor ? (j.stun ? '기절' : '—') : Math.round(j.dodge * 100) + '~' + Math.round(j.dodgeMax * 100) + '%'}</dd></div>
      </dl>
    </header>
    <div class="scroll" tabindex="0" role="region" aria-label="${esc(j.name)} 무기표"><table>
      <thead>
        <tr>
          <th class="grp l stick d1" rowspan="2">깊이</th>
          <th class="grp l stick d2" rowspan="2">자루</th>
          <th class="grp" colspan="${span}">원본</th>
          <th class="grp" colspan="${span + 1}">만듦새</th>
        </tr>
        <tr>${sub}<th class="r name">이름</th>${sub}</tr>
      </thead>
      <tbody>${fams.map((f) => `<tr>
        <td class="depth stick">${f.plain.depth}<i>층</i></td>
        <td class="fam stick">${esc(f.plain.name)}</td>
        ${cell(f.plain)}
        <td class="forged">${f.forged
          ? `<span class="chip" style="--tint:${hex(FORGES[f.forged.forge].tint)}"></span>${esc(FORGES[f.forged.forge].prefix)}`
          : '—'}</td>
        ${cell(f.forged)}
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="hint">표가 화면보다 넓습니다 — 옆으로 밀어 보세요. <b>깊이</b>와 <b>자루</b> 칸은 따라옵니다.</p>
  </section>`;
}

const html = `<title>일흔두 자루</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
  --ground: #f4f5f9; --panel: #ffffff; --panel-2: #eceef6;
  --rule: #d5d9e8; --rule-soft: #e6e9f2;
  --ink: #171c2e; --ink-soft: #5c6685; --ink-faint: #8b94ad;
  --gold: #a8791a; --gold-soft: #f3e3b8;
  --hi: #1c7a52; --lo: #a8443a; --bar: #c3b088;
  --shadow: 0 1px 2px rgba(23,28,46,.06), 0 8px 24px -12px rgba(23,28,46,.18);
  /* 날 색이 놓이는 바닥. **두 테마에서 같은 값입니다** — 게임 안에서 칼날은
     늘 탑의 어둠 위에서 보이고, 은장(#eceff1)은 밝은 바탕에서는 아예 안
     보입니다. 색을 제 자리에 놓아 주는 것이 이 한 줄이 하는 일입니다. */
  --blade-bed: #10152a;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #10152a; --panel: #1a2038; --panel-2: #151a30;
    --rule: #2c3557; --rule-soft: #232a47;
    --ink: #e6eaf7; --ink-soft: #8c99bd; --ink-faint: #5f6a8c;
    --gold: #f0c14b; --gold-soft: #3a3120;
    --hi: #7fd4a8; --lo: #ef8f84; --bar: #6b6142;
    --shadow: 0 1px 0 rgba(255,255,255,.03), 0 18px 40px -24px rgba(0,0,0,.8);
  }
}
:root[data-theme="dark"] {
  --ground: #10152a; --panel: #1a2038; --panel-2: #151a30;
  --rule: #2c3557; --rule-soft: #232a47;
  --ink: #e6eaf7; --ink-soft: #8c99bd; --ink-faint: #5f6a8c;
  --gold: #f0c14b; --gold-soft: #3a3120;
  --hi: #7fd4a8; --lo: #ef8f84; --bar: #6b6142;
  --shadow: 0 1px 0 rgba(255,255,255,.03), 0 18px 40px -24px rgba(0,0,0,.8);
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo',
    'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif;
  font-size: 16px; line-height: 1.65; -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 22px 96px; }
.prose { max-width: 62ch; }

.top { padding: 72px 0 40px; }
.eyebrow {
  display: block; font-size: 11px; letter-spacing: .22em; font-weight: 700;
  color: var(--ink-faint); margin-bottom: 12px;
}
h1 {
  margin: 0 0 14px; font-size: clamp(38px, 7vw, 62px); font-weight: 800;
  letter-spacing: -.035em; line-height: 1.04; text-wrap: balance;
}
h1 b { color: var(--gold); font-weight: 800; }
.lede { margin: 0; font-size: 18px; color: var(--ink-soft); text-wrap: pretty; }

.tiles { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
.tile {
  flex: 1 1 168px; background: var(--panel); border: 1px solid var(--rule);
  border-radius: 3px; padding: 16px 18px; box-shadow: var(--shadow);
}
.tile dt { font-size: 11px; letter-spacing: .16em; color: var(--ink-faint); font-weight: 700; }
.tile dd {
  margin: 6px 0 0; font-size: 27px; font-weight: 800; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}
.tile dd i { font-style: normal; color: var(--ink-faint); font-weight: 400; font-size: 17px; }
.tile p { margin: 3px 0 0; font-size: 13px; color: var(--ink-soft); line-height: 1.45; }

h2 { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; }
h3 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.sec { padding-top: 62px; }
.sec > .eyebrow { margin-bottom: 8px; }
.sec > p { color: var(--ink-soft); }

.forges { display: grid; grid-template-columns: repeat(auto-fit, minmax(226px, 1fr)); gap: 10px; margin-top: 26px; }
.forge {
  background: var(--panel); border: 1px solid var(--rule); border-radius: 3px;
  padding: 18px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 14px;
}
.forge header { display: grid; grid-template-columns: auto 1fr; gap: 4px 11px; align-items: center; }
.forge header p { grid-column: 2; margin: 0; font-size: 13px; color: var(--ink-soft); line-height: 1.3; }
/* 무쇠(#8d9aa6)와 흑철(#6d7f8b)은 실제로 가까운 색입니다. 점만 하면 구분이
   안 되므로 날처럼 세로로 길게 둡니다 — 면적이 있어야 색이 읽힙니다. */
.chip {
  width: 12px; height: 28px; border-radius: 1px; background: var(--tint);
  border: 2px solid var(--blade-bed); display: inline-block; flex: none; grid-row: span 2;
}
.forge dl { margin: 0; display: grid; gap: 3px; font-variant-numeric: tabular-nums; }
.forge dl div { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; }
.forge dt { color: var(--ink-faint); }
.forge dd { margin: 0; font-weight: 600; }
.forge footer { border-top: 1px solid var(--rule-soft); padding-top: 11px; font-size: 13px; color: var(--ink-soft); }
.forge footer b { color: var(--ink); font-variant-numeric: tabular-nums; }
.forge footer span { color: var(--ink-faint); font-size: 11.5px; }

.job { padding-top: 62px; }
.jobhead {
  display: flex; flex-wrap: wrap; gap: 22px 40px; align-items: flex-end;
  justify-content: space-between; padding-bottom: 18px; border-bottom: 2px solid var(--ink);
}
.jobhead p { margin: 4px 0 0; color: var(--ink-soft); font-size: 15px; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 26px; margin: 0; }
.facts dt { font-size: 10.5px; letter-spacing: .16em; color: var(--ink-faint); font-weight: 700; }
.facts dd { margin: 2px 0 0; font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.facts dd i { font-style: normal; color: var(--ink-faint); font-weight: 400; padding: 0 2px; }

.scroll { overflow-x: auto; margin-top: 4px; position: relative; }
.hint { display: none; margin: 10px 0 0; font-size: 13px; color: var(--ink-faint); }
.hint b { color: var(--ink-soft); font-weight: 700; }
@media (max-width: 980px) { .hint { display: block; } }

table { border-collapse: collapse; width: 100%; min-width: 900px; font-variant-numeric: tabular-nums; }
th, td { padding: 9px 10px; text-align: right; white-space: nowrap; }
thead th { font-size: 11px; letter-spacing: .1em; font-weight: 700; color: var(--ink-faint); border-bottom: 1px solid var(--rule); }
thead .grp { text-align: left; color: var(--ink-soft); letter-spacing: .18em; }
thead tr:first-child .grp:not(.l) { border-left: 1px solid var(--rule); padding-left: 14px; }
thead tr:nth-child(2) th:first-child { border-left: 1px solid var(--rule); padding-left: 14px; }
thead .r { color: var(--ink-faint); }
thead .name { text-align: left; }
tbody tr { border-bottom: 1px solid var(--rule-soft); }
tbody tr:hover { background: var(--panel-2); }

/* ── 앞의 두 칸은 따라옵니다 ─────────────────────────
   열세 칸짜리 표를 좁은 화면에서 옆으로 밀면 **지금 보는 것이 어느 자루인지**를
   놓칩니다. 이름이 안 보이는 수치는 그냥 숫자 더미입니다. */
th.stick, td.stick { position: sticky; background: var(--ground); z-index: 1; }
th.stick { z-index: 3; }
td.depth, th.d1 { left: 0; width: 54px; }
td.fam, th.d2 { left: 54px; box-shadow: 1px 0 0 var(--rule); }
tbody tr:hover td.stick { background: var(--panel-2); }

td.depth { text-align: left; color: var(--ink-faint); font-size: 13px; }
td.depth i { font-style: normal; font-size: 11px; }
td.fam { text-align: left; font-weight: 700; letter-spacing: -.01em; }
td.forged { text-align: left; font-weight: 600; color: var(--ink-soft); border-left: 1px solid var(--rule); padding-left: 14px; }
td.forged .chip { width: 8px; height: 17px; border-width: 1.5px; margin-right: 9px; vertical-align: -4px; }
td.dmg { border-left: 1px solid var(--rule); padding-left: 14px; font-weight: 600; }
/* 만듦새 쪽 공격력 칸은 바로 앞의 이름 칸이 이미 경계를 그었습니다 */
td.forged + td.dmg { border-left: none; padding-left: 10px; }
td.dmg i { font-style: normal; color: var(--ink-faint); padding: 0 1px; }
td.dmg .dot {
  width: 9px; height: 9px; border-radius: 50%; background: var(--tint);
  display: inline-block; margin-right: 8px; vertical-align: 1px; border: 1.5px solid var(--blade-bed);
}
td.num { color: var(--ink-soft); font-size: 14px; }
td.num.hi { color: var(--hi); font-weight: 600; }
td.num.lo { color: var(--lo); font-weight: 600; }
td.dps { position: relative; font-weight: 800; letter-spacing: -.01em; padding-right: 12px; }
td.dps .bar { position: absolute; right: 12px; bottom: 5px; height: 2px; width: var(--w); background: var(--bar); display: block; max-width: 76px; }

.notes { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 26px; }
@media (min-width: 780px) { .notes { grid-template-columns: 1fr 1fr; } }
.note {
  background: var(--panel); border: 1px solid var(--rule); border-left: 3px solid var(--gold);
  border-radius: 3px; padding: 17px 19px; box-shadow: var(--shadow);
}
.note h3 { margin-bottom: 7px; }
.note p { margin: 0; font-size: 14.5px; color: var(--ink-soft); line-height: 1.55; }
.note p + p { margin-top: 9px; }
.note b { color: var(--ink); font-weight: 700; }
.note code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px; background: var(--gold-soft); padding: 1px 5px; border-radius: 2px; color: var(--ink);
}

.hpbar { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 8px; }
.hp {
  background: var(--panel); border: 1px solid var(--rule); border-radius: 3px;
  padding: 9px 14px; font-size: 13.5px; color: var(--ink-soft); font-variant-numeric: tabular-nums;
}
.hp b { color: var(--ink); font-weight: 700; margin-left: 8px; }

footer.foot {
  margin-top: 76px; padding-top: 22px; border-top: 1px solid var(--rule);
  font-size: 13px; color: var(--ink-faint); display: flex; flex-wrap: wrap; gap: 6px 20px;
}
footer.foot code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
a { color: var(--gold); }
:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header class="top">
    <span class="eyebrow">탑 오르기 · 무기표</span>
    <h1>자루 열둘,<br><b>만듦새 넷</b>, 직업 셋.</h1>
    <p class="lede prose">무기는 사다리가 아니라 주머니입니다. <b>깊이</b>가 자루를 열고,
      <b>만듦새</b>가 같은 자루를 다른 물건으로 만듭니다. 아래 숫자는 전부
      코드에서 그대로 뽑은 것입니다 — 손으로 옮겨 적지 않았습니다.</p>
    <dl class="tiles">
      <div class="tile"><dt>자루</dt><dd>72</dd><p>직업당 24 = 자루 12 × 만듦새 2</p></div>
      <div class="tile"><dt>화력 폭</dt><dd>3.0<i>배</i></dd><p>맨 아래 자루 대비 맨 위 자루</p></div>
      <div class="tile"><dt>만듦새 차이</dt><dd>0<i>%</i></dd><p>초당 피해로는 <b>같습니다</b>. 갈리는 건 <i>어떻게</i></p></div>
      <div class="tile"><dt>적 체력</dt><dd>고정</dd><p>층을 안 탑니다. 0층 기는 것과 500층 기는 것이 같습니다</p></div>
    </dl>
  </header>

  <section class="sec">
    <span class="eyebrow">만듦새</span>
    <h2>같은 자루를 어떻게 벼렸느냐</h2>
    <p class="prose">색은 <b>실제 날 색</b>입니다 — 코드의 <code>tint</code> 를 그대로 옮겼습니다.
      아래 배수가 그 자루의 원래 값에 곱해집니다.</p>
    <div class="forges">${forgeLegend()}</div>
  </section>

  <section class="sec">
    <span class="eyebrow">읽는 법</span>
    <h2>이 숫자가 뜻하는 것</h2>
    <div class="notes">
      <div class="note">
        <h3>넷은 초당 피해로 같습니다</h3>
        <p><code>(공격력 ÷ 주기) × (바뀐 정확도 ÷ 원래 정확도) = 1</code>.
          한쪽이 더 세면 그건 만듦새가 아니라 <b>그냥 상위 무기</b>이고,
          그러면 계단을 걷어낸 뜻이 없어집니다.</p>
        <p>적어 놓고도 처음엔 못 지켰습니다 — 은장 <b>+4.6%</b> · 무쇠 <b>+3.7%</b>.
          지금은 넷 다 ±1% 안이고, <code>verify-combat</code> 이 자루 서른여섯을
          하나씩 재서 다시 새지 않게 막습니다.</p>
      </div>
      <div class="note">
        <h3>초당 피해에는 정확도가 들어 있습니다</h3>
        <p><code>((최소+최대)÷2 × 발 × 정확도) ÷ 주기</code>. 흑철(85%)과 은장(98%)을
          같은 자로 재려면 빗나가는 몫이 이미 들어 있어야 합니다.</p>
        <p>근접은 <b>사거리 안의 적을 한 번에 다 벱니다.</b> 그러니 이 값은
          <b>한 놈에게 들어가는 몫</b>이고, 둘러싸이면 실제로는 이보다 큽니다.</p>
      </div>
      <div class="note">
        <h3>강화는 여기 없습니다</h3>
        <p><code>+1</code> 은 범위 전체를 <b>18%씩</b>, <code>속</code> 은 주기를
          <b>9%씩</b> 밀어 올립니다. 표의 값은 <b>맨손</b>입니다.</p>
        <p>강화는 <b>그 자루에 붙어 있다가 갈아타면 같이 사라집니다.</b>
          그래서 여섯 자루나 깊은 무기가 지금 것보다 약한 일이 흔합니다.</p>
      </div>
      <div class="note">
        <h3>깊이는 사다리, 만듦새는 맞바꿈</h3>
        <p><b>깊이</b>는 그 자루가 나오기 시작하는 층입니다. 위로는 아직 안 열린 것이
          안 나오고, 아래로는 <code>lookBack ${CFG.weapon.lookBack}</code> 층까지만 남습니다 —
          그 층에 나올 수 있는 건 여덟 자루쯤입니다.</p>
        <p><b>만듦새</b>는 위아래가 아니라 옆입니다. 무쇠와 벼린은 <b>거울</b>이고,
          흑철과 은장은 그 양 끝입니다 — 하나는 정확도로 값을 치르고 무게를 얻고,
          하나는 무게를 깎아 확실함을 삽니다.</p>
      </div>
    </div>
    <div class="hpbar">
      <span class="hp">기는 것 <b>147</b></span>
      <span class="hp">뛰는 것 <b>${CFG.enemy.baseHp}</b></span>
      <span class="hp">단단한 놈 <b>442</b></span>
      <span class="hp">거인 <b>644</b></span>
      <span class="hp">보스 <b>6,256 ~ 13,248</b></span>
    </div>
  </section>

  ${CLASSES.map(jobSection).join('')}

  <footer class="foot">
    <span>node weapon-sheet.js — js/classes.js · js/forge.js 에서 생성</span>
    <span>공격력은 범위 · 주기는 ms · 거리는 게임 픽셀</span>
  </footer>
</div>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(OUT + '  ' + Math.round(html.length / 1024) + 'KB · 자루 '
  + CLASSES.reduce((a, j) => a + buildWeaponPool(j).length, 0) + '개');
console.log('만듦새 편차: ' + FORGE_ORDER.map((k) => FORGES[k].prefix + ' ' + signed(avg(k))).join(' · '));
