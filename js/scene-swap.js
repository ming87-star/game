// 필드에서 무기를 만났을 때 뜨는 창. 판을 멈추고 두 자루를 나란히 놓습니다.
//
// **이 창이 있어야 무기 개편이 뜻을 갖습니다.**
//
// 예전에는 `UP` 을 밟으면 그냥 다음 단계가 손에 들어왔습니다. 다음 것은 늘
// 더 셌으니 물어볼 것이 없었고, 그래서 무기는 고르는 것이 아니라 줍는
// 것이었습니다. 지금은 자루마다 성격이 다르고, 무엇보다 **갈아타면 그동안
// 쌓은 `+1`·`속`·`×2`가 전부 사라집니다.** 그러니 물어봐야 합니다.
//
// 그래서 이 창의 일은 하나입니다 — **같은 자로 두 자루를 재서 보여 주기.**
// 왼쪽은 강화까지 넣은 지금 값이고, 오른쪽은 강화 없는 새 자루의 값입니다.
// 그 둘을 나란히 놓지 않으면 "왜 갈아탔더니 약해졌지"가 됩니다.
// 세로로 다섯 덩이가 차례로 쌓입니다. 값을 하나 고치면 아래가 통째로
// 따라 내려가도록 자리를 **계산해서** 잡습니다 — 손으로 적어 두었더니
// 카드가 제목을 덮어써서 새 무기 이름이 안 보였습니다.
const SWAP_LAYOUT = {
  headTop: 146,   // 「무기를 찾았습니다」
  cardW: 232,
  // 296. 268로 뒀더니 마지막 줄(공격주기)이 카드 밑변에 걸려 잘렸습니다 —
  // 활은 「한 번에 N곳」이 한 줄 더 붙어서 더 심했습니다.
  cardH: 296,
  gap: 16,
};

class SwapScene extends Phaser.Scene {
  constructor() {
    super('swap');
  }

  init(data) {
    this.from = data.from;       // 게임 장면
    this.entry = data.entry;     // 새로 만난 자루 (주머니의 한 칸)
    // 상점에서 왔으면 값이 함께 넘어옵니다. **코인은 「바꾼다」를 눌러야 나갑니다** —
    // 견주어 보고 그냥 두기로 한 사람에게 값을 물리면 그건 고른 것이 아닙니다.
    this.price = data.price;
  }

  create() {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const cx = CFG.width / 2;
    const L = SWAP_LAYOUT;
    const s = this.from;
    const w = s.weapon;

    // 뒤가 비쳐 보여야 "끝난 것"이 아니라 "멈춘 것"으로 읽힙니다 (일시정지와 같은 규칙).
    // 다만 상점에서 왔을 때는 더 짙게 덮습니다 — 뒤에 있는 것이 발판 몇 개가
    // 아니라 **글자로 꽉 찬 진열**이라, 같은 짙기로는 두 글이 뒤엉킵니다.
    this.add.rectangle(cx, CFG.height / 2, CFG.width, CFG.height, 0x0d1120,
      this.price === undefined ? 0.82 : 0.95);

    this.add.text(cx, L.headTop,
      this.price === undefined ? '무기를 찾았습니다' : '상점에 들어온 자루',
      font(21, '#8794b5')).setOrigin(0.5);
    this.add.text(cx, L.headTop + 40, this.entry.name, font(34, '#ffd54f')).setOrigin(0.5);
    // 만듦새 한 줄. 왜 이런 수치인지를 말로 적어 줍니다.
    this.add.text(cx, L.headTop + 78, this.entry.detail || '', font(15, '#8794b5'))
      .setOrigin(0.5);

    const cardTop = L.headTop + 104 + L.cardH / 2;
    const half = L.cardW / 2 + L.gap / 2;
    // 왼쪽은 강화까지 넣은 지금 값, 오른쪽은 강화 없는 새 자루의 값입니다.
    this.card(cx - half, cardTop, '지금 든 것', w.base, true, 0x3f4a78);
    this.card(cx + half, cardTop, this.price === undefined ? '새로 찾은 것' : '사려는 것',
      this.entry, false, 0x7e6bc4);

    // ── 잃는 것을 크게 적습니다 ────────────────────────
    // 이 줄이 이 창에서 가장 중요합니다. 숫자 표만 보면 새 자루가 커
    // 보이는데, 실제로 손해인 경우가 흔합니다.
    const lost = [];
    // 상점에서는 코인도 잃는 것에 함께 적습니다. 값을 아래 단추에만 적어 두면
    // "무엇을 내주는가"가 두 군데로 갈려서 한눈에 안 들어옵니다.
    if (this.price !== undefined) lost.push('◎ ' + this.price);
    if (w.plus) lost.push('+' + Number(w.plusValue.toFixed(1)));
    if (w.haste) lost.push('속 ×' + w.haste);
    if (w.mult > 1) lost.push('×' + w.mult);
    const lostY = cardTop + L.cardH / 2 + 30;
    this.add.text(cx, lostY, lost.length
      ? '바꾸면 잃습니다 —  ' + lost.join('   ')
      : '아직 잃을 것이 없습니다', font(18, lost.length ? '#ff8a80' : '#5c6890')).setOrigin(0.5);

    // ── 두 단추 ────────────────────────────────────────
    // **손해일 때는 「바꾼다」가 눈에 덜 띄어야 합니다.** 늘 크고 밝게 두면
    // 화면이 "이걸 누르세요"라고 말하는 셈인데, 실제로는 갈아타지 않는 편이
    // 나은 때가 더 많습니다. 이득일 때만 보랏빛으로 밝힙니다.
    const now = w.dps;
    const next = w.dpsOf(this.entry, false);
    const pct = now ? Math.round((next / now - 1) * 100) : 0;
    const good = pct >= 0;

    this.swapAt = this.button(cx, lostY + 62, 300, 64,
      good ? 0x4e3f8a : 0x2a2f4a, good ? 0x9575cd : 0x454d70,
      this.price === undefined ? '바꾼다' : '산다  ◎ ' + this.price,
      (good ? '초당 +' : '초당 ') + pct + '%',
      good ? '#a5d6a7' : '#ff8a80', () => this.choose(true));

    this.keepAt = this.button(cx, lostY + 138, 300, 58,
      good ? 0x232b47 : 0x2f3a63, good ? 0x3f4a78 : 0x7986cb,
      this.price === undefined ? '그냥 둔다' : '안 산다',
      '들고 있던 것을 계속 씁니다',
      good ? '#8794b5' : '#c5cae9', () => this.choose(false));

    window.__swap = this; // 자동 플레이테스트가 누를 자리를 찾는 통로
  }

  // 자루 한 장. **withBoost 가 이 창의 전부입니다** — 왼쪽은 강화를 넣어서,
  // 오른쪽은 빼고 잽니다. 같은 자로 재지 않으면 견주는 뜻이 없습니다.
  card(x, y, title, entry, withBoost, edge) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const L = SWAP_LAYOUT;
    const s = this.from;
    const w = s.weapon;
    const mul = withBoost ? w.boost : 1;
    const speed = withBoost ? w.speedMult : 1;

    this.add.rectangle(x, y, L.cardW, L.cardH, 0x161b2e).setStrokeStyle(2, edge);
    this.add.text(x, y - L.cardH / 2 + 20, title, font(16, '#8794b5')).setOrigin(0.5);

    this.add.image(x, y - L.cardH / 2 + 62, weaponIconKey(s.job.key, entry.index))
      .setDisplaySize(46, 46);
    this.add.text(x, y - L.cardH / 2 + 102, entry.name, font(19, '#ffffff')).setOrigin(0.5);

    // 초당 피해는 따로 크게 뽑습니다. 아래 네 줄을 다 읽지 않아도
    // "그래서 센가"에는 이 한 줄이 답합니다.
    const dps = w.dpsOf(entry, withBoost);
    this.add.text(x, y - L.cardH / 2 + 138, '초당 ' + shortNum(Math.round(dps / DPS_DISPLAY_DIV)),
      font(26, '#ff8a65')).setOrigin(0.5);

    const rows = [
      ['공격력', Math.round(entry.dmgMin * mul) + '~' + Math.round(entry.dmgMax * mul)],
      ['정확도', Math.round(entry.acc * 100) + '%'],
      [entry.range ? '사정거리' : '사거리', String(Math.round(entry.range || entry.reach || 0))],
      ['공격주기', Math.round(entry.rate / speed) + 'ms'],
    ];
    if (entry.shots > 1) rows.push(['한 번에', entry.shots + '곳']);
    // **한계가 남다른 자루만** 한 줄을 씁니다. 이 창은 초당 피해로 두 자루를
    // 견주는데, 무명(無名)은 지금 초당 피해가 아니라 **나중에 갈 수 있는
    // 데**가 값어치라서 숫자만으로는 늘 손해로 보입니다. 그 줄이 없으면
    // 아무도 안 고르고, 그러면 이 자루를 넣은 뜻이 없습니다.
    const cap = entry.plusMax || CFG.plusMax;
    if (cap !== CFG.plusMax) rows.push(['공격력 한계', '+' + cap]);

    rows.forEach(([label, value], i) => {
      const ry = y - L.cardH / 2 + 172 + i * 26;
      this.add.text(x - L.cardW / 2 + 16, ry, label, font(15, '#6b7599'));
      this.add.text(x + L.cardW / 2 - 16, ry, value, font(16, '#e3e8f5')).setOrigin(1, 0);
    });
  }

  button(x, y, w, h, fill, edge, title, sub, subColor, onTap) {
    const font = (size, color) => ({ fontFamily: 'sans-serif', fontSize: size + 'px', color });
    const box = this.add.rectangle(x, y, w, h, fill)
      .setStrokeStyle(2, edge).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 11, title, font(26, '#ffffff')).setOrigin(0.5);
    this.add.text(x, y + 15, sub, font(15, subColor)).setOrigin(0.5);
    box.on('pointerdown', onTap);
    return { x, y };
  }

  choose(take) {
    // 부를 것을 먼저 빼 둡니다. 아래에서 판을 되돌리면 그 자리에서 다음
    // 갈아타기가 시작될 수도 있는데, 그때 남아 있으면 엉뚱한 데서 불립니다.
    const done = this.from.swapDone;
    this.from.swapDone = null;
    if (take) this.from.takeWeapon(this.entry);
    // 창을 닫고 나서 판을 돌립니다. 먼저 돌리면 그 한 프레임에 이 창이
    // 아직 떠 있어서, 판이 도는 것이 창 뒤로 비쳐 보입니다.
    this.scene.stop();
    this.scene.resume('game');
    // 값을 치르는 것은 여기입니다 — 상점이 넘겨준 몫 (js/shop.js 의 buy).
    if (done) done(take);
  }
}
