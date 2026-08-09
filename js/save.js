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
    // 단계마다 "가장 좋았던 상태"만 남깁니다. 죽을 때 여기서 하나를 뽑아 줍니다.
    weapons: {},
    // 메달 상점에서 사 둔 것. 다음 판 시작 때 쓰이고 비워집니다.
    boosts: {},
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
  recordWeapon(jobKey, tier, plus, mult) {
    const book = this.data.weapons[jobKey] || (this.data.weapons[jobKey] = {});
    const old = book[tier];
    const worth = (s) => (1 + s.plus * CFG.plusStep) * s.mult;
    if (!old || worth({ plus, mult }) > worth(old)) {
      book[tier] = { plus, mult };
      this.flush();
    }
  },

  // 그 직업으로 들었던 무기 중 하나를 무작위로. 없으면 null.
  rollWeapon(jobKey) {
    const book = this.data.weapons[jobKey];
    const tiers = book ? Object.keys(book) : [];
    if (!tiers.length) return null;
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    return { tier: Number(tier), plus: book[tier].plus, mult: book[tier].mult };
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
