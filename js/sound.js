// 소리. **파일이 하나도 없습니다 — 코드가 그 자리에서 만듭니다.**
//
// ── 왜 합성인가 ─────────────────────────────────────────
// 이 게임은 한 장으로 합쳐서 돕니다 (build.js → dist/index.html, 12MB).
// 소리를 파일로 넣으면 그 12MB 에 얹히는데, 방금 그 12MB 때문에 첫 화면이
// 5초 빈 채였던 것을 고친 참입니다. 짧은 효과음 열몇 개라도 수백 KB 이고,
// 무엇보다 **받아 쓸 소리의 출처와 라이선스**를 이 저장소가 감당해야 합니다.
//
// WebAudio 로 만들면 바이트가 0 입니다. 값이 코드에 있으니 「조금 낮게」
// 같은 주문도 숫자 하나로 끝납니다.
//
// ── 폰에서 반드시 걸리는 것 ─────────────────────────────
// 브라우저는 **사람이 화면을 한 번 건드리기 전에는 소리를 안 냅니다**
// (자동재생 정책). 안드로이드 WebView 도 같습니다. 그래서 AudioContext 를
// 미리 만들어 두지 않고, 첫 손길에 만들어 깨웁니다 (Sfx.wake).
// 이걸 안 하면 코드는 멀쩡히 돌고 오류도 없는데 **소리만 안 납니다.**
//
// ── 없는 자리에서도 안 죽습니다 ─────────────────────────
// AudioContext 가 없는 환경(옛 WebView, 자동 시험)에서도 게임은 그대로
// 돌아야 합니다. 만들기부터 실패하면 조용히 꺼진 채로 둡니다.

// 소리 한 벌의 설계. 다 「소리 하나 = 몇 겹」입니다.
//
//   f0·f1   시작·끝 주파수 (Hz). 내려가면 떨어지는 느낌, 올라가면 얻는 느낌
//   type    파형. square/triangle 은 옛 게임기, sine 은 부드럽게, saw 는 거칠게
//   ms      길이
//   gain    크기 (0~1)
//   noise   잡음을 섞는 몫 (0~1). 베기·부딪힘처럼 「음정이 없는 것」에 씁니다
//   lp      잡음에 씌우는 저역 필터 (Hz)
//   delay   **소리가 시작한 때부터** 이만큼 뒤에 (ms). 없으면 0 — 같이 울립니다
//
// ── delay 의 뜻을 바꾼 까닭 ─────────────────────────────
// 처음에는 「앞의 겹이 끝나고 이만큼 뒤에」였습니다. 그러면 delay 를 안
// 적어도 겹이 **줄줄이 이어서** 울립니다. 실기에서 「소리가 늦고
// 부자연스럽다」는 말을 듣고 파형을 렌더해서 재 봤더니:
//
//   land  |.=.      .    |   0~30ms 에 한 번, **90ms 에 또 한 번**
//   hit   |.=.     .     |   같음
//
// 한 번의 충격이어야 할 소리(음 + 잡음)가 **메아리처럼 두 번** 났습니다.
// 부딪히는 소리의 잡음은 음과 **같은 순간**에 나야 합니다. 그래서 기준을
// 「소리의 시작」으로 바꾸고, 이어서 울려야 하는 것(coin·good 의 음계)만
// 어긋남을 적어 둡니다.
const SFX = {
  // 발판을 딛고 한 층. 가장 자주 나므로 **가장 작고 가장 짧습니다.**
  // 여기가 크면 백 층만 올라도 사람이 소리를 끕니다.
  //
  // 뛸 때와 딛을 때를 따로 두었다가 **딛는 것 하나만** 남겼습니다. 한 층에
  // 두 번 울리면 백 층에 이백 번입니다. 뛰는 것은 내가 누른 것이라 이미
  // 알고, 딛는 것은 「도착했다」라 알려 줄 값이 있습니다.
  land:   [{ type: 'sine', f0: 240, f1: 120, ms: 80, gain: 0.13 },
           { noise: 1, lp: 900, ms: 60, gain: 0.07 }],

  // 벰. 음정이 아니라 **바람 소리**입니다 — 잡음을 위에서 아래로 쓸어 냅니다.
  swing:  [{ noise: 1, lp: 3200, lp1: 700, ms: 130, gain: 0.13 }],
  // 맞았을 때. 벰과 달리 낮고 짧게 «턱» 하고 끊깁니다.
  hit:    [{ type: 'square', f0: 180, f1: 90, ms: 70, gain: 0.15 },
           { noise: 1, lp: 1600, ms: 50, gain: 0.10 }],
  // 적이 죽음. 아래로 떨어뜨립니다.
  kill:   [{ type: 'triangle', f0: 420, f1: 120, ms: 180, gain: 0.15 },
           { noise: 1, lp: 1200, ms: 90, gain: 0.08 }],

  // 코인. **높고 짧은 두 음**이 「얻었다」의 만국 공통입니다.
  coin:   [{ type: 'square', f0: 988, f1: 988, ms: 45, gain: 0.10 },
           { type: 'square', f0: 1319, f1: 1319, ms: 90, gain: 0.10, delay: 55 }],
  // 물건을 집음. 코인보다 낮고 길게 — 코인과 헷갈리면 안 됩니다.
  item:   [{ type: 'triangle', f0: 523, f1: 784, ms: 130, gain: 0.14 }],

  // 내가 맞음. **유일하게 불쾌해도 되는 소리**입니다.
  ouch:   [{ type: 'sawtooth', f0: 260, f1: 110, ms: 200, gain: 0.17 },
           { noise: 1, lp: 800, ms: 120, gain: 0.10 }],
  // 죽음. 길게 가라앉습니다.
  death:  [{ type: 'triangle', f0: 330, f1: 60, ms: 700, gain: 0.18 },
           { noise: 1, lp: 500, ms: 400, gain: 0.08 }],

  // 좋은 일 — 메달, 해금, 유물. 올라가는 세 음.
  good:   [{ type: 'triangle', f0: 523, f1: 523, ms: 80, gain: 0.11 },
           { type: 'triangle', f0: 659, f1: 659, ms: 80, gain: 0.11, delay: 90 },
           { type: 'triangle', f0: 880, f1: 880, ms: 200, gain: 0.12, delay: 180 }],
  // 보스. 낮고 무겁게 한 번.
  boss:   [{ type: 'sawtooth', f0: 110, f1: 55, ms: 600, gain: 0.20 },
           { noise: 1, lp: 300, ms: 500, gain: 0.12 }],
  // 단추. 있는 듯 없는 듯해야 합니다.
  tap:    [{ type: 'sine', f0: 700, f1: 900, ms: 45, gain: 0.09 }],
  // 안 되는 것을 눌렀을 때.
  nope:   [{ type: 'square', f0: 200, f1: 150, ms: 110, gain: 0.11 }],
};

const Sfx = {
  ctx: null,
  ready: false,     // 사람이 한 번 건드려서 깨어났는가
  broken: false,    // 이 환경에는 소리가 없습니다
  muted: false,

  // **첫 손길에 부릅니다.** 그전에 만들면 브라우저가 정지 상태로 만들어
  // 놓고, 그대로 두면 아무 소리도 안 납니다 (오류도 없습니다).
  wake() {
    if (this.broken || this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.broken = true; return; }
      // latencyHint: 'interactive' 는 기본값이지만 **적어 둡니다.** 폰
      // WebView 는 판마다 기본이 다를 수 있고, 여기가 흐리면 손가락과
      // 소리 사이가 벌어집니다.
      if (!this.ctx) this.ctx = new AC({ latencyHint: 'interactive' });
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.ready = true;
    } catch (e) {
      this.broken = true;
    }
  },

  setMuted(on) {
    this.muted = !!on;
  },

  // 소리 하나. 이름이 표에 없으면 아무 일도 안 합니다 — 오타로 게임이
  // 멈추면 안 됩니다.
  play(name, 배 = 1) {
    if (this.muted || this.broken || !this.ready || !this.ctx) return;
    const 겹 = SFX[name];
    if (!겹) return;
    try {
      // **지금 이 순간을 기준으로** 겹마다 제 어긋남만큼 밀어 둡니다.
      // 앞 겹의 길이는 더하지 않습니다 — 그러면 안 적은 겹까지 줄줄이
      // 뒤로 밀려서 한 번의 충격이 메아리가 됩니다.
      const 시작 = this.ctx.currentTime;
      겹.forEach((층) => this.한겹(층, 시작 + (층.delay || 0) / 1000, 배));
    } catch (e) { /* 소리 때문에 판이 멈추면 안 됩니다 */ }
  },

  한겹(층, 때, 배) {
    const ctx = this.ctx;
    const 길이 = 층.ms / 1000;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    // 시작을 0 에서 올렸다가 끝을 0 으로 내립니다. 딱 끊으면 «틱» 소리가
    // 납니다 — 스피커가 갑자기 멈추는 소리라 어떤 파형에서도 납니다.
    // **|| 를 쓰면 안 됩니다.** gain: 0 을 적어 두면 0 이 거짓이라 기본값
    // 0.1 로 바뀌어, 「소리 없음」이라고 적은 것이 오히려 소리를 냅니다.
    const 크기 = (층.gain === undefined ? 0.1 : 층.gain) * 배;
    g.gain.setValueAtTime(0.0001, 때);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 크기), 때 + Math.min(0.012, 길이 * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, 때 + 길이);

    if (층.noise) {
      // 잡음은 짧은 버퍼 하나를 그 자리에서 채웁니다.
      const n = Math.max(1, Math.floor(ctx.sampleRate * 길이));
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(층.lp || 2000, 때);
      if (층.lp1) lp.frequency.exponentialRampToValueAtTime(층.lp1, 때 + 길이);
      src.connect(lp); lp.connect(g);
      src.start(때); src.stop(때 + 길이);
      return;
    }

    const o = ctx.createOscillator();
    o.type = 층.type || 'sine';
    o.frequency.setValueAtTime(층.f0, 때);
    if (층.f1 && 층.f1 !== 층.f0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(1, 층.f1), 때 + 길이);
    }
    o.connect(g);
    o.start(때); o.stop(때 + 길이);
  },
};

// 첫 손길에 깨웁니다. 한 번이면 됩니다.
if (typeof window !== 'undefined' && window.addEventListener) {
  const 깨우기 = () => { Sfx.wake(); };
  ['pointerdown', 'touchstart', 'keydown'].forEach((e) =>
    window.addEventListener(e, 깨우기, { once: false, passive: true }));
}
