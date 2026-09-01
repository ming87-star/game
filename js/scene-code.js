// 코드를 넣는 화면. 타이틀에서 「코드 입력」을 누르면 뜹니다 (js/codes.js).
//
// ── 왜 숫자 키패드인가 ──────────────────────────────────
// 이 게임은 휴대폰으로 하는 게임입니다. HTML 입력칸을 캔버스 위에 올리면
// 기기마다 키보드가 화면을 밀어 올려서 그것부터 따로 잡아야 합니다. 조작
// 단추(◀▲▶)를 이미 화면에 그려 쓰고 있으니, 같은 방식이면 어느 기기에서든
// 똑같이 돕니다. 여섯 자리면 불러 주기도 쉽습니다 — 「삼삼공공삼삼」.
//
// ── 여섯 칸을 먼저 보여 줍니다 ──────────────────────────
// 빈 칸 여섯이 서 있으면 **몇 자리인지 묻지 않아도 압니다.** 「코드를
// 입력하세요」 같은 줄보다 이쪽이 짧고 확실합니다.
const CODE_LEN = 6;

class CodeScene extends Phaser.Scene {
  constructor() {
    super('code');
  }

  create() {
    const cx = CFG.width / 2;
    this.cameras.main.setBackgroundColor('#05070d');
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });

    // 장면 객체는 다시 쓰이므로 손으로 지웁니다 (js/scene-ending.js 와 같은 함정)
    this.digits = '';
    this.busy = false;

    this.add.text(cx, 96, '코드 입력', font(26, '#e8eaf6')).setOrigin(0.5);
    this.말 = this.add.text(cx, 138, '여섯 자리를 누르세요', font(15, '#4a5578')).setOrigin(0.5);

    // ── 여섯 칸 ─────────────────────────────────────────
    this.칸 = [];
    const w = 46, gap = 10;
    const 왼쪽 = cx - (CODE_LEN * w + (CODE_LEN - 1) * gap) / 2 + w / 2;
    for (let i = 0; i < CODE_LEN; i++) {
      const x = 왼쪽 + i * (w + gap);
      this.add.rectangle(x, 200, w, 58, 0x141826).setStrokeStyle(1, 0x2f3a5c);
      this.칸.push(this.add.text(x, 200, '', font(28, '#e3e8f5')).setOrigin(0.5));
    }

    // ── 키패드 ──────────────────────────────────────────
    // 전화기와 같은 배열입니다. 1이 왼쪽 위, 0이 아래 가운데 — 다르게 놓으면
    // 손이 아는 자리를 다시 배워야 합니다.
    const 판 = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['지움', '0', '넣기']];
    const kw = 128, kh = 76, kgap = 12;
    const 시작x = cx - (3 * kw + 2 * kgap) / 2 + kw / 2;
    판.forEach((줄, r) => 줄.forEach((키, c) => {
      const x = 시작x + c * (kw + kgap);
      const y = 300 + r * (kh + kgap);
      const 값매김 = 키 === '넣기' ? '#8ea6ff' : 키 === '지움' ? '#8794b5' : '#e3e8f5';
      const box = this.add.rectangle(x, y, kw, kh, 0x141826)
        .setStrokeStyle(1, 0x2f3a5c).setInteractive({ useHandCursor: true });
      this.add.text(x, y, 키, font(키.length > 1 ? 20 : 30, 값매김)).setOrigin(0.5);
      box.on('pointerdown', () => this.press(키));
    }));

    const 닫기 = this.add.rectangle(cx, 724, 300, 58, 0x141826)
      .setStrokeStyle(1, 0x2f3a5c).setInteractive({ useHandCursor: true });
    this.add.text(cx, 724, '돌아가기', font(21, '#8794b5')).setOrigin(0.5);
    닫기.on('pointerdown', () => this.leave());

    window.__code = this;   // 시험이 누르는 통로
  }

  press(키) {
    if (this.busy) return;
    if (키 === '지움') return this.set(this.digits.slice(0, -1));
    if (키 === '넣기') return this.submit();
    if (this.digits.length >= CODE_LEN) return;
    const 다음 = this.digits + 키;
    this.set(다음);
    // 여섯 자리가 차면 **저절로 넣습니다.** 다 눌러 놓고 「넣기」를 또 찾게
    // 하면 그 한 걸음이 통째로 군더더기입니다. 「넣기」는 지우고 다시 넣은
    // 사람을 위해 남겨 둡니다.
    if (다음.length === CODE_LEN) this.submit();
  }

  set(v) {
    this.digits = v;
    this.칸.forEach((t, i) => t.setText(v[i] || ''));
  }

  submit() {
    if (this.busy || this.digits.length !== CODE_LEN) return;
    this.busy = true;
    const r = redeemCode(this, this.digits);
    if (!r.ok) {
      this.말.setText(r.why).setColor('#ef9a9a');
      this.set('');
      this.busy = false;
      return;
    }
    // 장면을 바꾸는 코드(엔딩 보기)는 이미 넘어갔습니다. 자리에서 끝나는
    // 코드는 **무엇이 됐는지 적어 주고** 머무릅니다 — 아무 말 없이 닫히면
    // 된 것인지 아닌지 알 수가 없습니다.
    if (r.장면바뀜) return;
    this.말.setText(r.said).setColor('#a5d6a7');
    this.set('');
    this.busy = false;
  }

  leave() {
    this.scene.start('title');
  }
}
