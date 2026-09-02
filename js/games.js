// 순위표와 업적 (Google Play Games Services).
//
// ── 여기 있는 것과 없는 것 ──────────────────────────────
// **여기에는 무엇을 겨루고 무엇을 업적으로 칠지만 있습니다.** 구글에 실제로
// 올리는 일은 껍데기(안드로이드)와 콘솔 등록이 끝난 뒤에 붙습니다.
// 그때 `Games.bridge` 에 네이티브 다리를 물리면 아래 부름이 그대로 나갑니다.
//
// ── 다리가 없어도 게임은 그대로 돕니다 ──────────────────
// 이 게임은 웹에서도 돕니다 (gh-pages). 거기에는 Play Games 가 없습니다.
// 그러니 다리가 없으면 **아무 일도 안 하고 조용히 돌아갑니다** — 소리(Sfx)와
// 같은 규칙입니다. 순위표 때문에 판이 멈추는 일은 없어야 합니다.
//
// ── 업적은 저장을 보고 셉니다 ───────────────────────────
// 「지금 이 순간」을 잡아서 세지 않습니다. 판이 끝날 때 저장을 한 번 훑어서
// 조건이 찬 것을 올립니다. 그래야:
//   · 어느 자리에서 놓쳐도 다음 판에 따라잡습니다
//   · 이미 오르고 있던 사람도 붙이는 날 한꺼번에 받습니다
//   · 조건을 고쳐도 코드 한 군데만 고치면 됩니다

// ── 순위표 ─────────────────────────────────────────────
//
// **둘뿐입니다.** 많이 두면 아무도 안 봅니다. 이 게임에서 겨룰 만한 것은
// 「얼마나 높이」와 「얼마나 모았나」 둘이고, 둘은 노는 법이 다릅니다 —
// 높이는 살아남기이고, 코인은 도굴꾼과 코인 유물의 판입니다.
const BOARDS = [
  { key: 'floor', name: '가장 높이 오른 층', 값: (d) => d.bestFloor },
  { key: 'coins', name: '한 판에 모은 코인', 값: (d) => d.bestCoins },
];

// ── 업적 스물넷 ────────────────────────────────────────
//
// 전부 **저장에 이미 있는 값**으로 셉니다 (보스 종과 황금개구리 둘만 이번에
// 칸을 늘렸습니다). 숨김(hidden)은 미리 보여 주면 이야기를 흘리는 것들입니다.
const DEEDS = [
  // 오르기 — 이 게임의 뼈대
  { key: 'floor-100', name: '백 층', desc: '100층에 닿았습니다', 참(d) { return d.bestFloor >= 100; } },
  { key: 'floor-500', name: '오백 층', desc: '500층에 닿았습니다', 참(d) { return d.bestFloor >= 500; } },
  { key: 'floor-1000', name: '천 층', desc: '1000층에 닿았습니다', 참(d) { return d.bestFloor >= 1000; } },
  // 2000층은 천장이 서기 시작하는 자리입니다 (CFG.ceiling). 여기부터는
  // 50층마다 세 배씩 세지므로, 넘는 것이 아니라 **닿는 것**이 업적입니다.
  { key: 'floor-2000', name: '천장 앞', desc: '2000층 — 여기서부터 탑이 달라집니다',
    참(d) { return d.bestFloor >= 2000; } },

  // 코인
  { key: 'coins-1000', name: '주머니가 묵직하다', desc: '한 판에 코인 1000', 참(d) { return d.bestCoins >= 1000; } },
  { key: 'coins-3000', name: '도굴꾼의 셈', desc: '한 판에 코인 3000', 참(d) { return d.bestCoins >= 3000; } },

  // 직업 사슬 — 여덟이 한 줄로 이어집니다
  { key: 'job-2', name: '다음 사람', desc: '직업 둘을 열었습니다', 참(d) { return 셈(d.unlocked) >= 2; } },
  { key: 'job-4', name: '절반', desc: '직업 넷을 열었습니다', 참(d) { return 셈(d.unlocked) >= 4; } },
  { key: 'job-8', name: '여덟이 다 섰다', desc: '직업 여덟을 다 열었습니다',
    참(d) { return 셈(d.unlocked) >= 8; } },

  // 유물 서른다섯 (공용 서른 + 직업 전용 다섯)
  { key: 'relic-1', name: '첫 유물', desc: '유물을 하나 가져갔습니다', 참(d) { return 셈(d.relics) >= 1; } },
  { key: 'relic-10', name: '열 가지', desc: '유물 열 가지를 만났습니다', 참(d) { return 셈(d.relics) >= 10; } },
  { key: 'relic-all', name: '도감을 다 채웠다', desc: '유물 서른다섯 가지를 다 만났습니다',
    참(d) { return 셈(d.relics) >= 35; } },

  // 보스 다섯 종
  { key: 'boss-1', name: '수문장을 넘다', desc: '보스를 처음 눕혔습니다',
    참(d) { return 셈(d.bossesBeaten) >= 1; } },
  { key: 'boss-all', name: '다섯을 다 눕히다', desc: '보스 다섯 종을 모두 눕혔습니다',
    참(d) { return 셈(d.bossesBeaten) >= 5; } },

  // 메달 상점 — 여섯 가지 × 여덟 직업 = 마흔여덟
  { key: 'medal-1', name: '첫 메달', desc: '메달로 무언가를 샀습니다', 참(d) { return 산것(d) >= 1; } },
  { key: 'medal-24', name: '절반을 사다', desc: '메달로 스물넷을 샀습니다', 참(d) { return 산것(d) >= 24; } },
  { key: 'medal-all', name: '더 살 것이 없다', desc: '메달로 살 수 있는 마흔여덟을 다 샀습니다',
    참(d) { return 산것(d) >= 48; } },

  // 무기 도감
  { key: 'weapon-12', name: '열두 자루', desc: '무기 열두 자루를 만났습니다', 참(d) { return 자루수(d) >= 12; } },
  { key: 'weapon-36', name: '서른여섯 자루', desc: '무기를 모두 만났습니다', 참(d) { return 자루수(d) >= 36; } },

  // 황금개구리 — 드물게 나오고 도망칩니다
  { key: 'frog-1', name: '개구리를 잡다', desc: '황금개구리를 잡았습니다', 참(d) { return (d.frogsCaught || 0) >= 1; } },
  { key: 'frog-10', name: '개구리 열 마리', desc: '황금개구리를 열 번 잡았습니다',
    참(d) { return (d.frogsCaught || 0) >= 10; } },

  // 되풀이 — 이 게임은 죽고 다시 오르는 게임입니다
  { key: 'runs-50', name: '쉰 번 올랐다', desc: '쉰 판을 했습니다', 참(d) { return d.runs >= 50; } },

  // 33층 시퀀스 — 미리 보여 주면 이야기를 흘립니다
  { key: 'ending-saw', name: '내려온 것', desc: '33층에서 무슨 일이 있었는지 보았습니다',
    hidden: true, 참(d) { return !!d.sawEnding; } },
  { key: 'ending-done', name: '붉은 겉옷', desc: '겉옷을 짚어 들었습니다',
    hidden: true, 참(d) { return (d.endingStage || 0) >= 2; } },
];

function 셈(o) { return o && typeof o === 'object' ? Object.keys(o).length : 0; }

// 메달로 산 것의 수. { warrior: { hp: true, coins: true }, ... }
function 산것(d) {
  const p = d.perks;
  if (!p || typeof p !== 'object') return 0;
  return Object.keys(p).reduce((n, job) => n + 셈(p[job]), 0);
}

// 만나 본 자루의 수. { warrior: { 2: {...}, 5: {...} }, ... }
function 자루수(d) {
  const w = d.weapons;
  if (!w || typeof w !== 'object') return 0;
  return Object.keys(w).reduce((n, job) => n + 셈(w[job]), 0);
}

const Games = {
  // 네이티브 다리. 껍데기(android/)가 WebView 에 물려 줍니다.
  //   { signedIn(), submit(boardKey, value), unlock(deedKey) }
  //
  // 이름이 **AndroidGames** 입니다 — MainActivity 의
  // addJavascriptInterface(games, "AndroidGames") 와 짝입니다.
  // 웹에서는 없으므로 null 이고, 그러면 아래가 다 조용히 지나갑니다.
  bridge: (typeof window !== 'undefined' && window.AndroidGames) || null,
  올린것: {},   // 이번에 켠 동안 이미 올린 업적 (같은 것을 되풀이해 안 보내게)

  boards: BOARDS,
  deeds: DEEDS,

  붙었나() { return !!(this.bridge && this.bridge.signedIn && this.bridge.signedIn()); },

  // 판이 끝날 때 한 번. 순위표에 올리고, 찬 업적을 올립니다.
  //
  // **다리가 없어도 여기까지는 그대로 돕니다** — 조건을 세는 것은 순수한
  // 셈이라 웹에서도 같은 답이 나오고, 보내는 자리에서만 갈립니다.
  report(d) {
    if (!d) return { 순위: [], 업적: [] };
    const 순위 = BOARDS.map((b) => ({ key: b.key, 값: Number(b.값(d)) || 0 }));
    const 업적 = DEEDS.filter((a) => {
      try { return a.참(d); } catch (e) { return false; }
    }).map((a) => a.key);

    if (this.붙었나()) {
      순위.forEach((r) => {
        try { this.bridge.submit(r.key, r.값); } catch (e) { /* 판이 멈추면 안 됩니다 */ }
      });
      업적.forEach((k) => {
        if (this.올린것[k]) return;
        this.올린것[k] = true;
        try { this.bridge.unlock(k); } catch (e) { /* 같음 */ }
      });
    }
    return { 순위, 업적 };
  },
};
