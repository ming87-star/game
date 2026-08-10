// 판을 넘어 남는 기록. 직업 해금과 메달 경제가 여기에 기댑니다.
//
// localStorage는 브라우저 설정에 따라 막혀 있을 수 있습니다 (사파리 비공개 모드 등).
// 그때도 게임은 굴러가야 하므로, 읽고 쓰기가 실패하면 메모리에만 들고 갑니다.

const SAVE_KEY = 'tower-climb-v1';

// 새 칸을 늘릴 때는 여기에도 넣어야 합니다. 예전 저장을 읽어도 빈 칸이 없도록
// 불러온 값을 이 위에 덮어씁니다.
function blankSave() {
  return {
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0,
    unlocked: {},
    medals: 0,
    // 직업별 무기 도감. { warrior: { 2: { plus: 6, mult: 2 } } }
    // 단계마다 "가장 좋았던 상태"만 남깁니다. 유물 도감처럼 구경하는 용도입니다.
    weapons: {},
    // 직전 판에서 손에 넣은 무기들 (얻은 순서). 죽음 화면의 계승이 여기 둘째를 씁니다.
    lastRun: { job: '', got: [] },
    // 메달 상점에서 사 둔 것. 다음 판 시작 때 쓰이고 비워집니다.
    boosts: {},
    // 유물 도감. 한 번이라도 가져간 것은 여기 남습니다.
    relics: {},
    lastJob: 'warrior',
  };
}

const Save = {
  data: blankSave(),
  usable: true,

  load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) {
      this.usable = false; // 저장이 막힌 환경. 이번 판만 기억합니다.
    }
    return this.data;
  },

  flush() {
    if (!this.usable) return;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      this.usable = false;
    }
  },

  // 한 판이 끝났을 때. 최고 기록을 갱신하고 죽은 횟수를 셉니다.
  // 메달은 여기서 넣지 않습니다 — 죽음 화면에서 고른 뒤에 들어갑니다.
  finishRun(floor, coins) {
    this.data.runs++;
    this.data.deaths++;
    if (floor > this.data.bestFloor) this.data.bestFloor = floor;
    if (coins > this.data.bestCoins) this.data.bestCoins = coins;
    this.flush();
  },

  unlock(key) {
    this.data.unlocked[key] = true;
    this.flush();
  },

  collectRelic(key) {
    if (this.data.relics[key]) return false;
    this.data.relics[key] = true;
    this.flush();
    return true;
  },

  addMedals(n) {
    this.data.medals += n;
    this.flush();
  },

  spendMedals(n) {
    if (this.data.medals < n) return false;
    this.data.medals -= n;
    this.flush();
    return true;
  },

  // ── 무기 도감 ─────────────────────────────────────────
  // 들었던 무기를 단계별로 기록합니다. 같은 단계를 다시 들었을 때는
  // 더 좋았던 쪽만 남깁니다 — "최종 업그레이드 상태"가 그 뜻입니다.
  // 좋고 나쁨은 공격력×속도로 견줍니다.
  recordWeapon(jobKey, tier, plus, mult, haste) {
    const book = this.data.weapons[jobKey] || (this.data.weapons[jobKey] = {});
    const old = book[tier];
    // 예전 저장에는 haste 칸이 없으므로 0으로 봅니다.
    const worth = (s) =>
      (1 + s.plus * CFG.plusStep) * (1 + (s.haste || 0) * CFG.hasteStep) * s.mult;
    if (!old || worth({ plus, mult, haste }) > worth(old)) {
      book[tier] = { plus, mult, haste };
      this.flush();
    }
  },

  // 방금 끝난 판에서 손에 넣은 무기들을 얻은 순서대로 적어 둡니다.
  setLastRun(jobKey, got) {
    this.data.lastRun = { job: jobKey, got: got.slice() };
    this.flush();
  },

  // 계승할 무기 — 직전 판에서 "두 번째로 얻은" 것.
  //
  // 예전에는 도감에서 아무거나 뽑았습니다. 그러면 운 좋게 좋은 무기가 뜬 판은
  // 시작부터 밸런스가 무너졌습니다. 둘째로 고정하면 계승의 값어치가 늘 같습니다 —
  // 직전 판에서 얼마나 빨리 무기를 갈아탔는지가 그대로 다음 판의 밑천이 됩니다.
  //
  // 공격 속도는 넘기지 않습니다. 속도는 무기가 아니라 손에 붙는 것이니까요.
  carryWeapon(jobKey) {
    const run = this.data.lastRun;
    if (!run || run.job !== jobKey || !run.got || run.got.length < 2) return null;
    const w = run.got[1];
    return { tier: w.tier, plus: w.plus };
  },

  // ── 다음 판에 들고 갈 것 ──────────────────────────────
  setBoost(key, value) {
    this.data.boosts[key] = value;
    this.flush();
  },

  // 판이 시작될 때 한 번만 꺼내 씁니다. 꺼내면 사라집니다 — 일회성이니까요.
  takeBoosts() {
    const boosts = this.data.boosts;
    this.data.boosts = {};
    this.flush();
    return boosts;
  },

  setJob(key) {
    this.data.lastJob = key;
    this.flush();
  },

  get bestFloor() { return this.data.bestFloor; },
  get deaths() { return this.data.deaths; },
  get medals() { return this.data.medals; },

  // 개발·시험용. 브라우저 콘솔에서 __save.reset() 으로 처음부터 다시.
  reset() {
    this.data = blankSave();
    this.flush();
  },
};

Save.load();
window.__save = Save;
