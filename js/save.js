// 판을 넘어 남는 기록. 직업 해금과 죽음 보상이 여기에 기댑니다.
//
// localStorage는 브라우저 설정에 따라 막혀 있을 수 있습니다 (사파리 비공개 모드 등).
// 그때도 게임은 굴러가야 하므로, 읽고 쓰기가 실패하면 메모리에만 들고 갑니다.

const SAVE_KEY = 'tower-climb-v1';

const Save = {
  data: { bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, unlocked: {} },
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

  get bestFloor() { return this.data.bestFloor; },
  get deaths() { return this.data.deaths; },

  // 개발·시험용. 브라우저 콘솔에서 __save.reset() 으로 처음부터 다시.
  reset() {
    this.data = { bestFloor: 0, deaths: 0, runs: 0, bestCoins: 0, unlocked: {} };
    this.flush();
  },
};

Save.load();
window.__save = Save;
