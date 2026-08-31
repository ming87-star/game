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
    // 직업별 무기 도감. { warrior: { 2: { plus: 6, mult: 2, haste: 3 } } }
    // **여기 적힌 것이 곧 "만나 본 자루"입니다** — 판을 시작하기 전에 이 중에서
    // 하나를 골라 들고 오릅니다 (js/scene-weaponbook.js). 값은 그 자루를
    // 가장 잘 벼렸던 상태로, 도감에 구경거리로 적힙니다.
    weapons: {},
    // 직업마다 마지막으로 골라 들고 오른 자루. 매번 같은 것으로 오르는
    // 사람에게 다시 고르게 하면 그건 고르기가 아니라 절차입니다.
    startWeapon: {},
    // 메달 상점에서 산 것. **직업마다 영영 남습니다.**
    //   { warrior: { hp: true, coins: true }, archer: {} }
    perks: {},
    // 유물 도감. 한 번이라도 가져간 것은 여기 남습니다.
    relics: {},
    // 직업마다의 최고 기록. { warrior: { floor: 512, coins: 1180 } }
    //
    // 해금이 사슬이 되면서 필요해졌습니다 (js/classes.js 의 unlockBy) —
    // 「궁수로 550층」이 조건인데 전체 최고 기록만 들고 있으면, 고르는
    // 화면이 「지금까지 얼마나 왔는지」를 **엉뚱한 직업의 숫자로** 알려
    // 주게 됩니다.
    //
    // 층과 코인은 **따로** 가장 좋았던 값입니다. 해금 판정은 한 판 안에서
    // 둘을 함께 채워야 하지만(classesUnlockedBy), 이 값은 판정이 아니라
    // 「얼마나 왔나」를 보여 주는 눈금입니다.
    bestBy: {},
    lastJob: 'warrior',
    // 오프닝을 이미 봤는지. 처음 켠 사람에게만 저절로 나오고, 그 뒤로는
    // 시작 화면에서 직접 눌러야 다시 나옵니다 — 한 판 더 하려고 켰는데
    // 매번 이야기부터 보게 하면 그건 이야기가 아니라 문턱입니다.
    sawStory: false,
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
  finishRun(floor, coins, jobKey) {
    this.data.runs++;
    this.data.deaths++;
    if (floor > this.data.bestFloor) this.data.bestFloor = floor;
    if (coins > this.data.bestCoins) this.data.bestCoins = coins;
    // 직업마다의 최고 기록도 함께. 해금 사슬이 이것을 읽습니다.
    if (jobKey) {
      const b = this.data.bestBy[jobKey] || { floor: 0, coins: 0 };
      this.data.bestBy[jobKey] = {
        floor: Math.max(b.floor || 0, floor),
        coins: Math.max(b.coins || 0, coins),
      };
    }
    this.flush();
  },

  // 그 직업으로 어디까지 갔나. 한 번도 안 골랐으면 0층·0코인입니다.
  bestFor(jobKey) {
    return this.data.bestBy[jobKey] || { floor: 0, coins: 0 };
  },

  unlock(key) {
    this.data.unlocked[key] = true;
    this.flush();
  },

  markStorySeen() {
    if (this.data.sawStory) return;
    this.data.sawStory = true;
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
  // 만난 적 있는 자루를 적어 둡니다. **적히는 순간 다음 판에 들고 오를 수
  // 있게 됩니다** — 그것이 이 기록의 가장 큰 쓰임입니다.
  //
  // 「만났다」는 손에 쥔 것만이 아니라 **갈아타기 창이 떴다**는 것도 셉니다.
  // 그 자리에서 그냥 두기로 한 것이, 다음 판에 그 자루를 못 쓸 이유는 아닙니다.
  findWeapon(jobKey, index) {
    const book = this.data.weapons[jobKey] || (this.data.weapons[jobKey] = {});
    if (book[index]) return false;
    book[index] = { plus: 0, mult: 1, haste: 0 };
    this.flush();
    return true;
  },

  // **첫 자루는 언제나 만난 것으로 칩니다.** 처음 켠 사람의 도감이 통째로
  // 비어 있으면 「무엇을 들고 오를까」에 고를 것이 하나도 없습니다 —
  // 그 판을 시작하면 어차피 손에 쥐게 되는 자루라, 비워 둘 이유가 없습니다.
  foundWeapons(jobKey) {
    const book = this.data.weapons[jobKey] || (this.data.weapons[jobKey] = {});
    if (!book[0]) book[0] = { plus: 0, mult: 1, haste: 0 };
    return book;
  },

  hasWeapon(jobKey, index) {
    return !!this.foundWeapons(jobKey)[index];
  },

  // 도감에서 골라 둔 자루. 없으면 그 직업의 첫 자루(0)입니다 —
  // 첫 자루는 언제나 만난 것이라 빈손으로 오르는 판이 없습니다.
  startWeapon(jobKey) {
    const at = this.data.startWeapon || (this.data.startWeapon = {});
    return at[jobKey] || 0;
  },

  setStartWeapon(jobKey, index) {
    const at = this.data.startWeapon || (this.data.startWeapon = {});
    at[jobKey] = index || 0;
    this.flush();
  },

  // 들었던 무기의 상태를 자루별로 기록합니다. 같은 자루를 다시 들었을 때는
  // 더 좋았던 쪽만 남깁니다 — "가장 잘 벼렸던 상태"가 그 뜻입니다.
  // 좋고 나쁨은 공격력×속도로 견줍니다.
  recordWeapon(jobKey, index, plus, mult, haste) {
    const book = this.data.weapons[jobKey] || (this.data.weapons[jobKey] = {});
    const old = book[index];
    // 예전 저장에는 haste 칸이 없으므로 0으로 봅니다.
    const worth = (s) =>
      (1 + s.plus * CFG.plusStep) * (1 + (s.haste || 0) * CFG.hasteStep) * s.mult;
    if (!old || worth({ plus, mult, haste }) > worth(old)) {
      book[index] = { plus, mult, haste };
      this.flush();
    }
  },

  // ── 메달로 산 것 — **직업마다 영영 남습니다** ──────────
  //
  // 예전에는 한 판 쓰고 사라졌습니다 (takeBoosts 가 꺼내면서 비웠습니다).
  // 그러면 메달 상점이 "매 판 다시 사는 곳"이 되어, 죽고 나서 남는 것이
  // 숫자 몇 개뿐입니다. 메달 상점이 해야 하는 일은 그게 아닙니다 —
  // **죽어도 다음 판이 지난 판보다 나아야** 또 켜게 됩니다.
  //
  // 직업마다 따로 쌓입니다. 전사로 산 것이 궁수에게 붙으면, 새 직업을 여는
  // 것이 곧 다 갖춘 채로 시작하는 것이 되어 여는 재미가 없어집니다.
  // (메달 자체는 하나의 주머니입니다 — 전사로 번 것으로 궁수 것을 사도 됩니다.)
  perksFor(jobKey) {
    return this.data.perks[jobKey] || (this.data.perks[jobKey] = {});
  },

  hasPerk(jobKey, key) {
    return !!this.perksFor(jobKey)[key];
  },

  addPerk(jobKey, key) {
    this.perksFor(jobKey)[key] = true;
    this.flush();
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
