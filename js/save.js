// 판을 넘어 남는 기록. 직업 해금과 메달 경제가 여기에 기댑니다.
//
// localStorage는 브라우저 설정에 따라 막혀 있을 수 있습니다 (사파리 비공개 모드 등).
// 그때도 게임은 굴러가야 하므로, 읽고 쓰기가 실패하면 메모리에만 들고 갑니다.

const SAVE_KEY = 'tower-climb-v1';

// ── 저장의 판 번호 ─────────────────────────────────────
//
// **한 번 내보내고 나면 저장 모양을 마음대로 못 바꿉니다.** 이미 오르고 있던
// 사람의 폰에 예전 모양이 들어 있고, 새 판이 그걸 읽어야 하니까요.
// 그래서 나가기 전에 번호를 붙여 둡니다.
//
// 번호를 올릴 때는 MIGRATIONS 에 「n 에서 n+1 로 옮기는 함수」를 더합니다.
// 옛 저장은 제 번호에서 시작해 차례로 밟아 올라옵니다.
//
// **칸을 더하기만 할 때는 번호를 안 올려도 됩니다.** blankSave() 위에
// 덮어쓰는 구조라 없는 칸은 저절로 기본값이 됩니다. 번호가 필요한 것은
// **뜻이 바뀔 때**입니다 — 칸 이름을 바꾸거나, 단위를 바꾸거나(코인 100 이
// 예전의 10 이 되는 식), 있던 것을 쪼갤 때.
const SAVE_VERSION = 1;

// 판 번호를 올린 자리마다 한 줄씩 늘어납니다.
//
//   1: 처음 붙인 번호. 그전 저장에는 version 이 아예 없습니다 —
//      그것도 1 로 봅니다 (모양이 같습니다).
//
// 예시 — 나중에 이런 모양이 됩니다:
//   2: (옛) coins 를 (새) coins·bankedCoins 둘로 쪼갬
//      (d) => { d.bankedCoins = 0; return d; }
const MIGRATIONS = {
  // 2: (d) => d,
};

// 숫자 자리에 숫자가 아닌 것이 들어 있으면 **NaN 이 게임 전체로 번집니다.**
// 메달이 NaN 이면 상점에서 아무것도 못 사고, 층이 NaN 이면 해금이 영영
// 안 열립니다. 그리고 NaN 은 저장에 null 로 적혀서 다음 판에도 남습니다.
// 깨진 저장 하나가 그 폰을 영영 못 쓰게 만드는 길입니다.
const 숫자칸 = ['bestFloor', 'deaths', 'runs', 'bestCoins', 'medals', 'endingStage',
  'frogsCaught'];
const 그릇칸 = ['unlocked', 'weapons', 'startWeapon', 'perks', 'relics', 'bestBy',
  'usedCodes', 'bossesBeaten'];

function 성한값으로(d) {
  숫자칸.forEach((k) => {
    const v = Number(d[k]);
    d[k] = Number.isFinite(v) && v >= 0 ? v : 0;
  });
  그릇칸.forEach((k) => {
    if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {};
  });
  if (typeof d.lastJob !== 'string' || !d.lastJob) d.lastJob = 'warrior';
  ['muted', 'sawEnding', 'sawStory'].forEach((k) => { d[k] = !!d[k]; });
  return d;
}

// 새 칸을 늘릴 때는 여기에도 넣어야 합니다. 예전 저장을 읽어도 빈 칸이 없도록
// 불러온 값을 이 위에 덮어씁니다.
function blankSave() {
  return {
    // 이 저장을 어느 판이 썼는가 (위의 SAVE_VERSION).
    version: SAVE_VERSION,
    bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0,
    // 소리를 껐는가. **끈 것만 적습니다** — 없으면 켜진 것입니다.
    muted: false,
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
    // 33층 시퀀스를 어디까지 봤는가 (STORY.md 5절).
    //   0  아직 안 열림
    //   1  열렸습니다 — 마흔여덟째를 산 그 순간
    //   2  끝났습니다 — 다시 못 합니다
    //
    // 숫자로 두는 까닭: 「봤다/안 봤다」 두 값으로는 **보는 장면과 마지막
    // 판 사이**를 못 적습니다. 그 사이에 게임을 끄면 다음에 켰을 때 처음부터
    // 다시 보여 주게 되고, 그러면 8번의 「평소와 똑같이」가 두 번째부터는
    // 「또 그 장면」이 됩니다.
    endingStage: 0,
    // 보는 장면(1~7)을 **끝까지 봤는가.**
    //
    // 이 칸이 없어서 시퀀스를 통째로 건너뛸 수 있었습니다. 단계는 마흔여덟째를
    // **사는 순간** 1이 되는데, 바로 뒤에 뜨는 보는 장면은 조작 없이 40초쯤
    // 갑니다. 그 사이에 창을 닫거나 새로고침하면 다음에 켰을 때 곧장 직업
    // 고르기로 가고, 판을 켜면 겉옷이 놓여 있고, 짚으면 크레딧입니다 —
    // **여는 말도 33층도 「내려온 것」도 흰옷도 한 번을 안 보고** 끝납니다.
    // 전화 한 통이면 일어나는 일입니다.
    //
    // 그래서 「샀다」와 「봤다」를 갈랐습니다. 못 본 사람은 타이틀에서 다시
    // 보는 장면으로 갑니다 (js/scene-title.js).
    sawEnding: false,
    lastJob: 'warrior',
    // 오프닝을 이미 봤는지. 처음 켠 사람에게만 저절로 나오고, 그 뒤로는
    // 시작 화면에서 직접 눌러야 다시 나옵니다 — 한 판 더 하려고 켰는데
    // 매번 이야기부터 보게 하면 그건 이야기가 아니라 문턱입니다.
    sawStory: false,
    // 한 번만 쓸 수 있는 코드 중 이미 쓴 것 (js/codes.js)
    usedCodes: {},
    // ── 업적이 보는 칸 둘 (js/games.js) ────────────────
    //
    // 나머지 업적은 이미 있는 칸으로 셉니다 (해금·유물·메달·엔딩·도감).
    // 이 둘만 아무 데도 안 남고 있었습니다.
    //
    // **칸을 더하는 것은 판 번호를 안 올려도 됩니다** — 옛 저장에는 없고,
    // 없으면 blankSave 의 빈 값이 그대로 쓰입니다.
    bossesBeaten: {},   // { 'boss-warden': true, ... } 다섯 종
    frogsCaught: 0,     // 황금개구리를 잡은 수
  };
}

const Save = {
  data: blankSave(),

  // 저장이 어떤 꼴이었는지 — 화면에서 알려 줄 일이 생기면 여기를 봅니다.
  usable: true,      // 쓸 수 있는가 (막혔거나, 미래에서 온 저장이면 아니오)
  recovered: false,  // 깨져 있어서 새로 시작했는가
  fromFuture: false, // 더 새 판이 쓴 저장인가
  migrated: 0,       // 몇 판을 건너 올라왔는가

  load() {
    this.data = blankSave();
    this.usable = true;
    this.recovered = false;
    this.fromFuture = false;
    this.migrated = 0;

    let raw = null;
    // ① 저장소 자체가 막혔는가 (사파리 비공개 모드 등).
    //    **이건 읽기 실패와 다릅니다** — 이쪽은 쓰기도 못 합니다.
    try {
      raw = window.localStorage.getItem(SAVE_KEY);
    } catch (e) {
      this.usable = false;
      if (typeof Sfx !== 'undefined') Sfx.setMuted(false);
      return this.data;
    }
    if (!raw) {
      if (typeof Sfx !== 'undefined') Sfx.setMuted(false);
      return this.data;   // 처음 켠 사람
    }

    // ② 읽었는데 깨져 있는가.
    //
    //    예전에는 여기서 usable = false 로 넘어갔습니다. 그러면 **그 뒤로
    //    영영 저장이 안 됩니다** — 한 바이트가 상한 것 때문에 그 폰에서는
    //    다시는 아무것도 안 남습니다. 아무 말도 없이요.
    //    깨진 것은 버리고 새로 시작하되, **쓰는 것은 살려 둡니다.**
    let 옛것 = null;
    try {
      옛것 = JSON.parse(raw);
    } catch (e) {
      this.recovered = true;
      if (typeof Sfx !== 'undefined') Sfx.setMuted(false);
      this.flush();          // 성한 것으로 덮어써 둡니다
      return this.data;
    }
    if (!옛것 || typeof 옛것 !== 'object' || Array.isArray(옛것)) {
      this.recovered = true;
      if (typeof Sfx !== 'undefined') Sfx.setMuted(false);
      this.flush();
      return this.data;
    }

    // ③ 어느 판이 쓴 것인가. version 이 아예 없으면 1 입니다 —
    //    번호를 붙이기 전의 저장이고, 모양은 1 과 같습니다.
    const 옛판 = Number(옛것.version) || 1;

    if (옛판 > SAVE_VERSION) {
      // ④ **더 새 판이 쓴 저장입니다.**
      //
      //    스토어에서 새 판을 받았다가 되돌린 사람에게 일어납니다.
      //    아는 칸만 읽어 들이되 **쓰지는 않습니다.** 여기서 덮어쓰면
      //    새 판이 적어 둔 것을 옛 판이 지워 버립니다 — 사람이 다시
      //    새 판으로 올렸을 때 기록이 사라져 있습니다.
      Object.assign(this.data, 옛것);
      성한값으로(this.data);
      this.data.version = 옛판;   // 남의 번호를 낮춰 적지 않습니다
      this.usable = false;
      this.fromFuture = true;
      if (typeof Sfx !== 'undefined') Sfx.setMuted(!!this.data.muted);
      return this.data;
    }

    // ⑤ 옛 저장이면 한 판씩 밟아 올립니다.
    let 값 = 옛것;
    for (let v = 옛판; v < SAVE_VERSION; v++) {
      const 옮기기 = MIGRATIONS[v + 1];
      if (옮기기) {
        try { 값 = 옮기기(값) || 값; } catch (e) { /* 한 칸이 막혀도 나머지는 살립니다 */ }
      }
      this.migrated++;
    }

    Object.assign(this.data, 값);
    성한값으로(this.data);
    this.data.version = SAVE_VERSION;

    // 소리는 저장에서 읽어 곧바로 물려 둡니다. 여기서 안 물리면 껐던
    // 사람이 다음에 켰을 때 소리가 도로 납니다.
    if (typeof Sfx !== 'undefined') Sfx.setMuted(!!this.data.muted);
    // **적힌 번호가 지금 것과 다르면 그 자리에서 적어 둡니다.**
    //
    // 밟아 올라온 경우만 적으면 안 됩니다. 번호가 아예 없던 저장은 밟을
    // 칸이 0 이라 그냥 지나가고, 저장소에는 여전히 번호가 없습니다 —
    // 다음에 켤 때마다 같은 일을 다시 하고, 나중 판이 「이미 손본 옛
    // 저장」과 「손도 안 댄 옛 저장」을 구별할 길이 없어집니다.
    if (Number(옛것.version) !== SAVE_VERSION) this.flush();
    return this.data;
  },

  // 소리 끄기/켜기. **누른 그 자리에서 저장합니다** — 판을 끝까지 안 하고
  // 창을 닫는 사람이 훨씬 많습니다.
  setMuted(on) {
    this.data.muted = !!on;
    if (typeof Sfx !== 'undefined') Sfx.setMuted(this.data.muted);
    this.flush();
  },

  flush() {
    if (!this.usable) return;
    try {
      // 판 번호는 **쓸 때마다** 붙입니다. 어딘가에서 data 를 통째로 갈아
      // 끼워도 번호 없는 저장이 남지 않게.
      this.data.version = SAVE_VERSION;
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
    // 순위표와 업적은 **판이 끝날 때 한 번** 봅니다 (js/games.js).
    // 다리가 없으면(웹에서 돌 때) 셈만 하고 조용히 돌아갑니다.
    if (typeof Games !== 'undefined') Games.report(this.data);
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

  // 33층 시퀀스가 어디까지 왔는가. 뒤로는 안 갑니다 — 한 번 본 것을
  // 다시 보게 만들 길을 아예 안 둡니다.
  setEndingStage(n) {
    if (n <= this.data.endingStage) return;
    this.data.endingStage = n;
    this.flush();
  },

  get endingStage() { return this.data.endingStage || 0; },

  // 보는 장면을 끝까지 봤다고 적습니다 (EndingWatchScene.leave).
  markEndingSeen() {
    if (this.data.sawEnding) return;
    this.data.sawEnding = true;
    this.flush();
  },

  get sawEnding() { return !!this.data.sawEnding; },

  // ── 한 번만 쓰는 코드 (js/codes.js) ────────────────────
  // 베타 보상처럼 **한 판에 한 번만** 받는 코드가 있습니다. 쓴 것을 여기
  // 적어 두지 않으면 같은 코드를 몇 번이고 다시 넣을 수 있습니다.
  usedCode(code) { return !!(this.data.usedCodes || {})[code]; },

  markCodeUsed(code) {
    if (!this.data.usedCodes) this.data.usedCodes = {};
    this.data.usedCodes[code] = true;
    this.flush();
  },

  setJob(key) {
    this.data.lastJob = key;
    this.flush();
  },

  get bestFloor() { return this.data.bestFloor; },
  get deaths() { return this.data.deaths; },
  get medals() { return this.data.medals; },

  // 보스를 처음 눕힌 종. 다섯 종을 다 눕히면 업적 하나입니다.
  markBoss(key) {
    if (!key || this.data.bossesBeaten[key]) return false;
    this.data.bossesBeaten[key] = true;
    this.flush();
    return true;
  },

  // 황금개구리를 잡은 수.
  markFrog() {
    this.data.frogsCaught = (this.data.frogsCaught || 0) + 1;
    this.flush();
  },

  // 개발·시험용. 브라우저 콘솔에서 __save.reset() 으로 처음부터 다시.
  reset() {
    this.data = blankSave();
    this.flush();
  },
};

Save.load();
window.__save = Save;
