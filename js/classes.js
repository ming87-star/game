// 직업. 이 게임의 가장 큰 갈림길입니다.
//
// 땅에 붙은 적은 위층까지 쫓아오지 못하므로, 싸움은 원래 "선택"입니다.
// 그런데 한 번 피하기 시작하면 코인이 없어 강해지지 못하고, 약하니까 또 피하게 됩니다.
// 직업은 그 나선을 끊습니다 — 셋 다 코인을 벌지만 버는 방법이 다릅니다.
//
// 유물은 더 이상 직업마다 하나가 아닙니다. js/relics.js 를 보세요.
//
//   전사  버티고 서서 번다   (두꺼운 방어구 + 긴 사거리 + 광역)
//   궁수  지나가며 번다      (멈출 필요 없는 원거리, 한 방은 약함)
//   도적  훔쳐서 번다        (짧고 빠른 근접 + 회피 + 절도)

const CLASSES = [
  {
    key: 'warrior',
    name: '전사',
    unlockFloor: 0, unlockCoins: 0, // 처음부터 열려 있는 유일한 직업
    blurb: '두껍게 막고 크게 벤다',
    detail: '두껍게 막으니 발판에서 물러설 필요가 없습니다.\n사거리 안의 적을 한 번에 벱니다.',
    color: 0xef9a9a,

    hp: 200,
    armor: 30,
    usesArmor: true,
    // 방어는 셋 중 가장 두껍고, 손은 가장 느립니다.
    // 무거운 것을 크게 휘두르는 직업이라는 것이 수치로도 보여야 합니다.
    armorMax: 82,
    // 기절이 생긴 만큼 손을 더 느리게 잡았습니다 (1.65 → 1.30).
    // 얼려 놓고 빠르기까지 하면 발판 위에서 아무 일도 안 일어납니다.
    speedCap: 1.30,
    plusScale: 1,
    attack: 'melee',
    dodge: 0,
    steal: 0,

    // ── 기절 ───────────────────────────────────────────
    // **휘두를 때마다 적이 그 자리에서 잠깐 멎습니다** (CFG.stun).
    //
    // 전사의 값어치는 원래 "두껍게 막는다" 하나였습니다. 그런데 막는 것은
    // 맞는 속도를 늦출 뿐 아무것도 바꾸지 않습니다 — 궁수는 멈출 필요가
    // 없고 도적은 통째로 흘려 넘기는데, 전사는 맞으면서 때리는 것 말고
    // 할 수 있는 일이 없었습니다. **버티기만으로는 저울이 안 맞습니다.**
    //
    // 멎게 하는 것은 시간을 버는 방어입니다. 사거리가 긴 것과도 맞물립니다 —
    // 멀리서 먼저 닿아 얼려 두고 그동안 계속 벱니다.
    //
    // 처음에는 밀어냈는데, 발판이 좁아서 **적이 밀려 떨어져 버렸습니다.**
    // 자리를 옮기는 것은 이 게임의 발판과 안 맞습니다. 자리는 그대로 두고
    // 시간만 뺏습니다.
    //
    // 1이면 CFG.stun.ms 를 그대로. 0이면 안 걸립니다 (궁수·도적).
    stun: 1,

    // 근접: 사거리 안을 한 번에 벱니다. 사거리가 길어 여럿이 함께 맞습니다.
    //
    // icon 은 그림을 짓는 값입니다 (js/textures.js). 흰 외곽선으로 굽습니다.
    //   art    sword 검 · dagger 짧은 검 · spear 창 · bow 활 · crossbow 석궁
    //   hw     날의 반너비 · len 날 길이 (가장 긴 날 0.76에 견줘서) · curve 휘어진 정도
    //   guard  none · bar 가로대 · cross 십자 · wing 젖힌 뿔 · ring 고리 (gw 는 그 너비)
    //   twin   두 자루 · notch 이 빠진 날 · gem 밑동의 보석
    // ── 자루 열둘 ──────────────────────────────────────
    // **사다리가 아니라 목록입니다.** 예전에는 열두 단계짜리 계단이라
    // 다음 것이 늘 더 셌고, 그래서 고를 것이 없었습니다. 지금은 뒤쪽 자루가
    // 조금 낫기는 해도 만듦새에 따라 앞쪽 자루가 더 맞을 수 있습니다.
    //
    //   dmg     공격력 가운뎃값. 실제로는 ±spread 만큼 흔들립니다
    //   spread  그 흔들리는 폭 (없으면 0.18)
    //   acc     정확도. 빗나가면 '빗나감'이 뜨고 피해가 없습니다 (없으면 0.92)
    //   depth   이 층부터 필드에 나오기 시작합니다
    //   forge   이 자루에 붙는 만듦새 하나 (js/forge.js). 그래서 자루당 둘입니다
    //   sheet   빌려 쓸 몸짓 시트 번호. 만듦새가 달라도 실루엣은 같은 자루입니다
    //
    // icon 은 그림을 짓는 값입니다 (js/textures.js). 흰 외곽선으로 굽습니다.
    //   art    sword 검 · dagger 짧은 검 · spear 창 · bow 활 · crossbow 석궁
    //   hw     날의 반너비 · len 날 길이 (가장 긴 날 0.76에 견줘서) · curve 휘어진 정도
    //   guard  none · bar 가로대 · cross 십자 · wing 젖힌 뿔 · ring 고리 (gw 는 그 너비)
    //   twin   두 자루 · notch 이 빠진 날 · gem 밑동의 보석
    weapons: [
      { key: 'sword', name: '장검', dmg: 48, rate: 410, reach: 100, depth: 0,
        forge: 'iron', sheet: 0, color: 0xcfd8dc,
        detail: '무엇에도 모나지 않은 한 자루',
        lore: '탑에 처음 든 사람이 쥐던 것. 벽에 걸린 채 몇 해가 지나도 이가 나가지 않았습니다.',
        icon: { art: 'sword', hw: 4.0, len: 0.60, guard: 'bar', gw: 12, notch: true } },
      { key: 'steel', name: '강철검', dmg: 52, rate: 400, reach: 108, depth: 40,
        forge: 'keen', sheet: 1, color: 0x90caf9,
        detail: '무게가 손에 잘 붙습니다',
        lore: '산 아래 대장간이 마지막으로 두들긴 자루. 무게를 재고 만든 것이 아니라 손을 재고 만들었습니다.',
        icon: { art: 'sword', hw: 4.6, len: 0.63, guard: 'bar', gw: 15 } },
      { key: 'twin', name: '쌍날검', dmg: 56, rate: 388, reach: 116, depth: 80,
        forge: 'black', sheet: 2, color: 0xa5d6a7, spread: 0.24,
        detail: '두 날이 엇갈립니다. 한 대가 들쭉날쭉합니다',
        lore: '두 자루를 붙여 하나로 만들었습니다. 붙인 사람은 왜 그랬는지 끝내 말하지 않았습니다.',
        icon: { art: 'sword', twin: true, hw: 5.0, len: 0.62, guard: 'bar', gw: 16 } },
      { key: 'spear', name: '장창', dmg: 60, rate: 376, reach: 124, depth: 120,
        forge: 'keen', sheet: 3, color: 0xb0bec5, acc: 0.96, spread: 0.12,
        detail: '곧게 찌릅니다. 좀처럼 빗나가지 않습니다',
        lore: '문지기들이 쓰던 것. 겨눈 자리와 닿는 자리가 같아야 한다는 것이 그들의 유일한 규칙이었습니다.',
        icon: { art: 'spear' } },
      { key: 'arcane', name: '마력검', dmg: 64, rate: 364, reach: 130, depth: 160,
        forge: 'silver', sheet: 4, color: 0xce93d8,
        detail: '날에 빛이 돕니다',
        lore: '날에 글자를 새겼습니다. 무슨 뜻인지는 새긴 사람만 알았고, 그 사람은 탑에서 내려오지 않았습니다.',
        icon: { art: 'sword', hw: 4.8, len: 0.66, guard: 'ring', gw: 14, gem: true } },
      { key: 'flame', name: '화염도', dmg: 68, rate: 352, reach: 135, depth: 200,
        forge: 'iron', sheet: 5, color: 0xff8a65, spread: 0.26,
        detail: '휘어진 날이 크게 훑습니다',
        lore: '불에 달군 채로 식히지 않고 벼렸습니다. 날이 아직도 미지근하다고들 합니다.',
        icon: { art: 'sword', hw: 5.4, len: 0.66, curve: 1.1, guard: 'bar', gw: 12 } },
      { key: 'thunder', name: '뇌전검', dmg: 73, rate: 340, reach: 139, depth: 250,
        forge: 'black', sheet: 6, color: 0x81d4fa,
        detail: '내리칠 때 소리가 늦게 옵니다',
        lore: '벼락 맞은 나무 아래에서 주웠다는 자루. 소리가 늦게 오는 까닭도 그래서라고 합니다.',
        icon: { art: 'sword', hw: 4.6, len: 0.68, guard: 'wing', gw: 15, gem: true } },
      { key: 'dragon', name: '용살검', dmg: 77, rate: 328, reach: 143, depth: 300,
        forge: 'keen', sheet: 7, color: 0xffb74d,
        detail: '큰 것을 베라고 만든 자루',
        lore: '큰 것을 잡으려고 만들었습니다. 다만 그 큰 것을 본 사람이 아직 없습니다.',
        icon: { art: 'sword', hw: 6.6, len: 0.70, guard: 'cross', gw: 19 } },
      { key: 'heaven', name: '파천검', dmg: 82, rate: 316, reach: 147, depth: 350,
        forge: 'silver', sheet: 8, color: 0xf48fb1,
        detail: '이가 빠진 채로도 잘 듭니다',
        lore: '이가 여럿 빠졌습니다. 빠진 자리마다 무엇을 벴는지 세어 두었다는 이야기가 있습니다.',
        icon: { art: 'sword', hw: 7.0, len: 0.70, curve: 0.6, guard: 'cross', gw: 20, notch: true } },
      { key: 'holy', name: '성흔검', dmg: 88, rate: 304, reach: 151, depth: 400,
        forge: 'iron', sheet: 9, color: 0xfff59d, acc: 0.95,
        detail: '겨눈 곳으로 저절로 갑니다',
        lore: '겨눈 곳으로 저절로 간다는 자루. 들어 본 사람은 손이 아니라 자루가 벴다고 말합니다.',
        icon: { art: 'sword', hw: 5.6, len: 0.73, guard: 'ring', gw: 17, gem: true } },
      { key: 'chaos', name: '혼돈대검', dmg: 93, rate: 292, reach: 155, depth: 450,
        forge: 'keen', sheet: 10, color: 0x9575cd, spread: 0.32, acc: 0.88,
        detail: '한 대가 어떻게 들어갈지 스스로도 모릅니다',
        lore: '셋이 함께 벼렸는데 셋이 서로 다른 것을 만들려 했습니다. 한 대가 어떻게 들어갈지 아무도 모릅니다.',
        icon: { art: 'sword', hw: 8.0, len: 0.72, guard: 'wing', gw: 21, gem: true } },
      { key: 'sky', name: '천공검', dmg: 99, rate: 280, reach: 159, depth: 500,
        forge: 'black', sheet: 11, color: 0x80cbc4,
        detail: '가장 멀리, 가장 무겁게',
        lore: '탑 꼭대기에 꽂혀 있었다는 자루. 꼭대기를 본 사람이 없으니 어디서 왔는지도 모릅니다.',
        icon: { art: 'sword', hw: 6.4, len: 0.76, curve: 0.5, guard: 'wing', gw: 19, gem: true, notch: true } },
      // ── 하나뿐인 예외 — 무명(無名) ────────────────────
      // **맨몸이 주머니에서 가장 약한 대신, +1 을 서른까지 받습니다.**
      //
      // 다른 자루가 열에서 멎는 것이 이 자루의 전부입니다. 열까지는 오히려
      // 뒤처집니다 — 그 무렵 가장 센 자루의 45% 입니다. 스물다섯에 이르러서야
      // 앞지르고(103%), 서른에서 122% 가 됩니다.
      //
      // 그래서 이 자루를 쓰는 것은 **결정 하나를 판 내내 지키는 일**입니다 —
      // 오르는 내내 마주치는 더 좋아 보이는 자루를 전부 그냥 두어야 합니다.
      // 갈아타는 순간 서른까지 쌓은 것이 통째로 사라집니다.
      //
      // depth 0 입니다. 위층에서 만나면 벼릴 시간이 없어 그냥 못 쓰는 자루가
      // 됩니다 — 처음부터 골라야 뜻이 있습니다 (무기 도감에서 골라 옵니다).
      //
      // forge 가 없습니다. 만듦새는 초당 피해를 맞바꾸는 규칙인데, 이 자루의
      // 성격은 초당 피해가 아니라 **한계**라 맞바꿀 것이 없습니다.
      //
      // plusStep 이 셋 배(0.18 → 0.54)인 까닭: 맨몸을 60% 로 낮춰 놓고 보통
      // 걸음으로 올리면 서른에서도 최강의 절반에 못 미칩니다. 늦게 시작해서
      // 멀리 가려면 걸음이 커야 합니다.
      { key: 'nameless', name: '무명검', dmg: 29, rate: 410, reach: 96, depth: 0,
        sheet: 0, color: 0x9e9e9e, plusMax: 30, plusStep: 0.54,
        detail: '맨몸은 약합니다. 대신 +1 을 서른까지 받습니다',
        lore: '이름을 새기지 않은 자루. 새길 만한 일을 아직 안 했기 때문이라고, 벼린 이가 말했다고 합니다.',
        icon: { art: 'sword', hw: 3.6, len: 0.56, guard: 'none' } },
    ],

  },

  {
    key: 'archer',
    name: '궁수',
    // 한 판 안에서 둘 다 채워야 열립니다 — 멀리 가기만 해서도, 벌기만 해서도 안 됩니다.
    unlockFloor: 500, unlockCoins: 1000,
    blurb: '멈추지 않고 쏜다',
    detail: '멀리서 맞추니 위험하게 다가갈 필요가 없습니다.\n한 발은 약합니다. 좋은 활일수록 여러 발이 나갑니다.',
    color: 0xa5d6a7,

    hp: 200,
    armor: 32,
    usesArmor: true,
    // 전사의 방어 한계를 82까지 올리자 궁수가 그 아래로 내려앉았습니다
    // (같은 128층에서 남은 체력 궁수 19% · 전사 60% · 도적 85%).
    // 전사보다는 낮되 너무 벌어지지 않게 72로 둡니다.
    armorMax: 72,
    speedCap: 2.05,
    plusScale: 1,
    attack: 'ranged',
    dodge: 0,
    steal: 0,

    // 체력과 방어를 올렸습니다. 셋 중 가장 무른데 광역도 없어서, 같은 탑에
    // 올려놓고 재면 전사보다도 아래였습니다 (53층 대 60층).
    //
    // 원거리: 한 발이 적 하나를 칩니다. shots 만큼 서로 다른 적을 동시에 노립니다.
    // 주기가 짧은 이유: 궁수는 멈추지 않고 지나가며 잡아야 합니다.
    // 한 발이 근접보다 약한 대신 훨씬 자주 나갑니다.
    // icon 값의 뜻은 전사 쪽 주석을 보세요. 활은 recurve(각궁처럼 끝이 젖힌 것)와
    // big(큰 활), arrows(메긴 화살 수)로 갈립니다.
    // 자루 열둘. 값의 뜻은 전사 쪽 주석을 보세요.
    // 활은 recurve(끝이 젖힌 각궁)와 big(큰 활), arrows(메긴 화살 수)로 갈립니다.
    // shots 는 **한 번에 노리는 서로 다른 적의 수**입니다.
    weapons: [
      { key: 'short', name: '단궁', dmg: 45, rate: 330, range: 300, shots: 1, depth: 0,
        forge: 'keen', sheet: 0, color: 0xd7ccc8,
        detail: '가볍고 손에 익습니다',
        lore: '사냥꾼의 첫 활. 짐승보다 사람이 먼저 지치는 일이 없게 만들었습니다.',
        icon: { art: 'bow', arrows: 1 } },
      { key: 'hunter', name: '사냥활', dmg: 48, rate: 322, range: 310, shots: 1, depth: 40,
        forge: 'iron', sheet: 1, color: 0xbcaaa4,
        detail: '한 발이 무겁습니다',
        lore: '한 발로 끝내라고 배운 사람들의 활. 그들은 두 번째 발을 세지 않았습니다.',
        icon: { art: 'bow', big: true, arrows: 1 } },
      { key: 'horn', name: '각궁', dmg: 26, rate: 310, range: 325, shots: 2, depth: 80,
        forge: 'silver', sheet: 2, color: 0xa5d6a7,
        detail: '두 곳을 한꺼번에 노립니다',
        lore: '뿔을 여러 겹 붙였습니다. 마른 날에는 소리가 맑고 습한 날에는 무겁습니다.',
        icon: { art: 'bow', recurve: true, arrows: 1 } },
      { key: 'crossbow', name: '강철석궁', dmg: 28, rate: 300, range: 340, shots: 2, depth: 120,
        forge: 'black', sheet: 3, color: 0xb0bec5, acc: 0.95, spread: 0.10,
        detail: '기계가 겨눕니다. 흔들림이 없습니다',
        lore: '손이 떨려도 겨눈 자리는 떨리지 않습니다. 그것 하나로 값이 매겨졌습니다.',
        icon: { art: 'crossbow' } },
      { key: 'wind', name: '바람활', dmg: 30, rate: 292, range: 355, shots: 2, depth: 160,
        forge: 'keen', sheet: 4, color: 0x80deea,
        detail: '화살이 바람을 탑니다',
        lore: '시위를 놓으면 화살이 제 길을 조금 고쳐 간다고 합니다.',
        icon: { art: 'bow', recurve: true, arrows: 2 } },
      { key: 'flamebow', name: '불꽃장궁', dmg: 21, rate: 284, range: 370, shots: 3, depth: 200,
        forge: 'iron', sheet: 5, color: 0xff8a65, spread: 0.24,
        detail: '세 곳을 동시에',
        lore: '세 발이 한꺼번에 나가는데, 쏜 사람은 한 발만 쐈다고 느낍니다.',
        icon: { art: 'bow', big: true, arrows: 2 } },
      { key: 'roar', name: '뇌명궁', dmg: 23, rate: 276, range: 385, shots: 3, depth: 250,
        forge: 'silver', sheet: 6, color: 0x81d4fa,
        detail: '시위 소리가 뒤늦게 옵니다',
        lore: '맞은 쪽이 소리를 나중에 듣습니다. 그래서 두 번째 화살까지 피하지 못합니다.',
        icon: { art: 'bow', recurve: true, big: true, arrows: 2 } },
      { key: 'bone', name: '용뼈대궁', dmg: 24, rate: 268, range: 400, shots: 3, depth: 300,
        forge: 'keen', sheet: 7, color: 0xffb74d, homing: true,
        detail: '화살이 표적을 끝까지 쫓습니다',
        lore: '뼈로 지었다는 대궁. 화살이 표적을 끝까지 쫓는 것도 뼈가 기억하기 때문이라고들 합니다.',
        icon: { art: 'crossbow', big: true } },
      { key: 'gale', name: '질풍대궁', dmg: 20, rate: 260, range: 415, shots: 4, depth: 350,
        forge: 'black', sheet: 8, color: 0xf48fb1, homing: true,
        detail: '네 곳을 쫓아갑니다',
        lore: '네 발이 서로 다른 곳을 보고 나갑니다. 겨누는 일은 활이 합니다.',
        icon: { art: 'bow', big: true, arrows: 3 } },
      // 정확도가 0.96 이었습니다. 은장(+6%p)이 붙으면 1.02 가 되어 천장(1.00)에
      // 잘리고, 잘린 몫은 값만 치르고 못 받는 덤이 됩니다. 0.94 로 두면
      // 은장 성좌궁이 정확히 1.00 — 「겨눈 곳을 놓치는 법이 없다」가 됩니다.
      { key: 'star', name: '성좌궁', dmg: 21, rate: 252, range: 430, shots: 4, depth: 400,
        forge: 'silver', sheet: 9, color: 0xfff59d, acc: 0.94,
        detail: '겨눈 곳을 놓치는 법이 없습니다', homing: true,
        icon: { art: 'bow', recurve: true, big: true, arrows: 3 } },
      { key: 'abyss', name: '심연장궁', dmg: 23, rate: 244, range: 445, shots: 4, depth: 450,
        forge: 'iron', sheet: 10, color: 0x9575cd, homing: true, spread: 0.28,
        detail: '한 발 한 발이 다릅니다',
        lore: '깊은 데서 건져 올렸습니다. 한 발 한 발이 다른 까닭은 아직 아무도 밝히지 못했습니다.',
        lore: '밤하늘의 자리를 보고 겨눈다는 활. 놓치는 법이 없다는 말은 과장이 아닙니다.',
        icon: { art: 'crossbow', big: true, gem: true } },
      { key: 'skybow', name: '천뢰궁', dmg: 24, rate: 236, range: 460, shots: 4, depth: 500,
        forge: 'keen', sheet: 11, color: 0x80cbc4, homing: true,
        detail: '가장 멀리, 가장 자주',
        lore: '가장 멀리, 가장 자주. 활이 견디는 한계까지 밀어 놓은 물건입니다.',
        icon: { art: 'bow', recurve: true, big: true, arrows: 3, gem: true } },
      // ── 하나뿐인 예외 — 무명(無名) ────────────────────
      // **맨몸이 주머니에서 가장 약한 대신, +1 을 서른까지 받습니다.**
      //
      // 다른 자루가 열에서 멎는 것이 이 자루의 전부입니다. 열까지는 오히려
      // 뒤처집니다 — 그 무렵 가장 센 자루의 45% 입니다. 스물다섯에 이르러서야
      // 앞지르고(103%), 서른에서 122% 가 됩니다.
      //
      // 그래서 이 자루를 쓰는 것은 **결정 하나를 판 내내 지키는 일**입니다 —
      // 오르는 내내 마주치는 더 좋아 보이는 자루를 전부 그냥 두어야 합니다.
      // 갈아타는 순간 서른까지 쌓은 것이 통째로 사라집니다.
      //
      // depth 0 입니다. 위층에서 만나면 벼릴 시간이 없어 그냥 못 쓰는 자루가
      // 됩니다 — 처음부터 골라야 뜻이 있습니다 (무기 도감에서 골라 옵니다).
      //
      // forge 가 없습니다. 만듦새는 초당 피해를 맞바꾸는 규칙인데, 이 자루의
      // 성격은 초당 피해가 아니라 **한계**라 맞바꿀 것이 없습니다.
      //
      // plusStep 이 셋 배(0.18 → 0.54)인 까닭: 맨몸을 60% 로 낮춰 놓고 보통
      // 걸음으로 올리면 서른에서도 최강의 절반에 못 미칩니다. 늦게 시작해서
      // 멀리 가려면 걸음이 커야 합니다.
      { key: 'nameless', name: '무명궁', dmg: 27, rate: 330, range: 290, shots: 1, depth: 0,
        sheet: 0, color: 0x9e9e9e, plusMax: 30, plusStep: 0.54,
        detail: '맨몸은 약합니다. 대신 +1 을 서른까지 받습니다',
        lore: '이름을 새기지 않은 활. 새길 만한 일을 아직 안 했기 때문이라고, 메운 이가 말했다고 합니다.',
        icon: { art: 'bow' } },
    ],

  },

  {
    key: 'rogue',
    name: '도적',
    unlockFloor: 700, unlockCoins: 2000,
    blurb: '빠르게 찌르고 훔친다',
    detail: '빨리 찌르고 빠지니 오래 맞고 있을 필요가 없습니다.\n얇은 가죽에 기대어 흘려 넘기고, 잡지 않아도 훔칩니다.',
    color: 0xce93d8,

    hp: 200,
    // ── 가죽 갑옷 ──────────────────────────────────────
    // 도적은 원래 방어가 0이었습니다. 회피만으로 버티라는 뜻이었는데,
    // **회피는 아무것도 고르게 만들어 주지 않습니다.** 38%로 흘리고 62%로
    // 온전히 맞으니, 평균은 멀쩡해도 운 나쁜 몇 대에 그냥 증발합니다.
    // 전사는 매번 30~47%씩 덜 맞아 죽는 속도가 예측되는데 도적은 그렇지
    // 않아서, 평균이 같아도 **체감이 훨씬 약합니다.**
    //
    // 그래서 얇은 가죽을 한 겹 깔았습니다. 회피의 도박은 그대로 두되
    // 바닥을 받쳐 줍니다 — 최악의 연속이 와도 18%는 덜 맞습니다.
    //
    // usesArmor 는 false 그대로입니다. 그래야 필드에서 '회'를 줍고(방어구가
    // 아니라), 상점에서 회피를 사고, 무엇보다 **가죽이 닳지 않습니다**
    // (scene-game.js 의 wearArmor 가 usesArmor 를 보고 그냥 물러납니다).
    // 갈아 낼 만큼 두껍지가 않아서 그냥 늘 그만큼 덜 맞는 것입니다.
    armor: 18,
    armorMax: 18, // 자라지 않습니다. 늘 가득이라는 뜻입니다
    usesArmor: false,
    // 갑옷을 안 입는 대신 회피를 주워 올립니다 (필드의 '회' 아이템).
    // 가죽을 깔면서 0.62에서 0.56으로 내렸습니다. 시작 회피(0.38)는 그대로라
    // **아래층에서는 확실히 세지고**, 위층에서는 전사가 방어구를 82까지
    // 쌓아 다시 앞섭니다 — 250층에서 실질 체력이 전사 595 대 도적 494입니다.
    // 안 내렸으면 도적이 175층까지 셋 중 가장 단단했습니다. 그러면
    // "전사는 두껍게 막는다"가 표에서부터 거짓말이 됩니다.
    dodgeMax: 0.56,
    // 손이 셋 중 가장 빠릅니다. 가죽과 함께 올렸습니다 — 도적의 값어치는
    // "빠르다"인데 2.5는 궁수(2.05)와 그리 벌어져 보이지 않았습니다.
    speedCap: 2.8,
    // +1 하나가 제값을 다 주지는 않습니다. 공격 속도가 워낙 빨라서
    // 공격력까지 온전히 붙으면 곱해진 값이 감당이 안 됩니다.
    plusScale: 1,
    attack: 'melee',
    // 갑옷이 없는 대신 회피가 방어를 대신합니다.
    // 전사는 방어구를 쌓아 47%까지 갑니다 — 실질 체력이 도적의 두 배 가까이 됩니다.
    // 회피가 그 자리를 메워야 도적이 발판 위에 버틸 수 있습니다.
    dodge: 0.38,  // 시작 회피. 필드에서 '회'를 주워 dodgeMax 까지 올립니다
    // 때릴 때마다 이 확률로 코인을 훔칩니다 (잡지 않아도).
    // 0.32였습니다. 같은 씨앗에서 도적이 번 코인이 전사의 두 배였습니다
    // (1294 대 630) — 훔치는 것이 잡는 것보다 큰 벌이가 되면 도적만
    // 상점에서 다른 게임을 합니다. 보스에게서는 아예 훔치지 못합니다.
    steal: 0.17,
    // 잡을 때마다 최대 체력의 이만큼을 앗아옵니다.
    //
    // 갑옷이 없는 도적에게 필요한 것은 더 큰 숫자가 아니라 버틸 수단이었습니다.
    // 공격력을 올려도 순위가 안 바뀌었습니다 — 전사는 사거리가 넓어 한 번에
    // 여럿을 베는데 도적은 그러지 못하니, 화력만으로는 따라잡히지 않습니다.
    //
    // 준 피해에 비례해 회복시키면 안 됩니다. 공격력은 층에 따라 곱으로 커지는데
    // 최대 체력은 그렇지 않아서, 위층에서 한 대에 체력이 가득 차 버립니다.
    // 잡은 수에 매달면 잡는 속도가 저절로 상한이 됩니다.
    leechOnKill: 0.016,

    // 근접이지만 사거리가 짧고 대신 훨씬 빠릅니다.
    // 한 대의 공격력은 셋 중 가장 큽니다 — 사거리가 짧아 한 번에 닿는 수가
    // 전사의 절반쯤이라, 그만큼 한 대가 무거워야 총합이 맞습니다.
    // icon 값의 뜻은 전사 쪽 주석을 보세요. 도적은 날이 짧아 art 가 dagger 입니다 —
    // 자루가 짧고 코등이가 작아, 같은 검이라도 전사 것과 실루엣이 갈립니다.
    // 자루 열둘. 값의 뜻은 전사 쪽 주석을 보세요.
    // 도적은 날이 짧아 art 가 dagger 입니다 — 자루가 짧고 코등이가 작아,
    // 같은 검이라도 전사 것과 실루엣이 갈립니다.
    weapons: [
      { key: 'dagger', name: '단도', dmg: 40, rate: 212, reach: 78, depth: 0,
        forge: 'keen', sheet: 0, color: 0xcfd8dc,
        detail: '짧고 빠릅니다',
        lore: '품에 넣고 다니라고 만든 것. 짧은 만큼 늦는 법이 없습니다.',
        icon: { art: 'dagger', hw: 3.6, len: 0.40, guard: 'none', notch: true } },
      { key: 'hunting', name: '사냥칼', dmg: 43, rate: 205, reach: 82, depth: 40,
        forge: 'iron', sheet: 1, color: 0x90caf9,
        detail: '가르는 데 익숙한 날',
        lore: '가죽을 벗기던 날. 쓰던 사람이 무엇을 벗겼는지는 묻지 않는 것이 예의였습니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.44, guard: 'bar', gw: 9 } },
      { key: 'twindagger', name: '쌍단도', dmg: 46, rate: 198, reach: 86, depth: 80,
        forge: 'black', sheet: 2, color: 0xa5d6a7, spread: 0.24,
        detail: '두 손이 번갈아 들어갑니다',
        lore: '왼손과 오른손이 서로를 기다리지 않습니다.',
        icon: { art: 'dagger', twin: true, hw: 4.4, len: 0.44, guard: 'bar', gw: 11 } },
      { key: 'fang', name: '독니', dmg: 49, rate: 191, reach: 91, depth: 120,
        forge: 'silver', sheet: 3, color: 0x9ccc65,
        detail: '휘어진 끝이 걸립니다',
        lore: '끝이 갈고리처럼 휘었습니다. 들어갈 때보다 나올 때가 더 아픕니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.45, curve: 1.3, guard: 'none' } },
      { key: 'shadow', name: '그림자단검', dmg: 52, rate: 184, reach: 95, depth: 160,
        forge: 'keen', sheet: 4, color: 0xce93d8, acc: 0.95,
        detail: '보이지 않는 자리로 들어갑니다',
        lore: '등 뒤로 도는 법을 아는 날. 정면으로 들고 선 사람은 없었다고 합니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.48, guard: 'bar', gw: 10, gem: true } },
      { key: 'moon', name: '월아도', dmg: 56, rate: 178, reach: 98, depth: 200,
        forge: 'iron', sheet: 5, color: 0xff8a65, spread: 0.26,
        detail: '반달처럼 휘었습니다',
        lore: '반달처럼 휘었습니다. 벤 자리도 반달 모양이라고들 합니다.',
        icon: { art: 'dagger', hw: 5.0, len: 0.50, curve: 1.8, guard: 'bar', gw: 10 } },
      { key: 'bolt', name: '뇌전비수', dmg: 60, rate: 172, reach: 101, depth: 250,
        forge: 'black', sheet: 6, color: 0x81d4fa,
        detail: '찌른 자리가 저려옵니다',
        lore: '찌른 자리가 한참 뒤에 저려 옵니다. 그동안이 도망칠 시간입니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.50, guard: 'wing', gw: 11, gem: true } },
      { key: 'dragonfang', name: '용아단검', dmg: 64, rate: 166, reach: 104, depth: 300,
        forge: 'keen', sheet: 7, color: 0xffb74d,
        detail: '이빨을 갈아 만들었다고 합니다',
        lore: '이빨을 갈아 만들었다고 합니다. 갈아 낸 쪽이 이빨인지 사람인지는 모릅니다.',
        icon: { art: 'dagger', hw: 4.8, len: 0.52, curve: 1.1, guard: 'cross', gw: 12 } },
      { key: 'dark', name: '그믐비수', dmg: 68, rate: 160, reach: 107, depth: 350,
        forge: 'silver', sheet: 8, color: 0xf48fb1,
        detail: '달이 없는 밤의 것',
        lore: '달이 없는 밤에만 꺼냈습니다. 달이 있는 밤에는 보이니까요.',
        icon: { art: 'dagger', hw: 4.2, len: 0.53, curve: 1.6, guard: 'bar', gw: 10, gem: true } },
      { key: 'soul', name: '사혼도', dmg: 72, rate: 155, reach: 110, depth: 400,
        forge: 'iron', sheet: 9, color: 0xfff59d,
        detail: '베인 자리가 늦게 아픕니다',
        lore: '베인 줄 모르고 걷다가 멈춘다고 합니다. 그 자리에서 늦게 아파 옵니다.',
        icon: { art: 'dagger', hw: 5.2, len: 0.55, curve: 1.2, guard: 'ring', gw: 12 } },
      { key: 'abyssfang', name: '심연의이빨', dmg: 77, rate: 150, reach: 113, depth: 450,
        forge: 'keen', sheet: 10, color: 0x9575cd, spread: 0.30, acc: 0.88,
        detail: '두 날이 제멋대로 들어갑니다',
        lore: '두 날이 서로 다른 것을 노립니다. 쥔 사람의 뜻은 셋째입니다.',
        icon: { art: 'dagger', twin: true, hw: 5.0, len: 0.54, guard: 'wing', gw: 13, gem: true } },
      { key: 'skyfang', name: '천살단검', dmg: 83, rate: 145, reach: 116, depth: 500,
        forge: 'black', sheet: 11, color: 0x80cbc4,
        detail: '가장 빠르고 가장 무겁게',
        lore: '가장 빠르고 가장 무겁게. 둘을 함께 가진 물건은 이것 하나뿐입니다.',
        icon: { art: 'dagger', hw: 5.0, len: 0.58, guard: 'ring', gw: 13, gem: true, notch: true } },
      // ── 하나뿐인 예외 — 무명(無名) ────────────────────
      // **맨몸이 주머니에서 가장 약한 대신, +1 을 서른까지 받습니다.**
      //
      // 다른 자루가 열에서 멎는 것이 이 자루의 전부입니다. 열까지는 오히려
      // 뒤처집니다 — 그 무렵 가장 센 자루의 45% 입니다. 스물다섯에 이르러서야
      // 앞지르고(103%), 서른에서 122% 가 됩니다.
      //
      // 그래서 이 자루를 쓰는 것은 **결정 하나를 판 내내 지키는 일**입니다 —
      // 오르는 내내 마주치는 더 좋아 보이는 자루를 전부 그냥 두어야 합니다.
      // 갈아타는 순간 서른까지 쌓은 것이 통째로 사라집니다.
      //
      // depth 0 입니다. 위층에서 만나면 벼릴 시간이 없어 그냥 못 쓰는 자루가
      // 됩니다 — 처음부터 골라야 뜻이 있습니다 (무기 도감에서 골라 옵니다).
      //
      // forge 가 없습니다. 만듦새는 초당 피해를 맞바꾸는 규칙인데, 이 자루의
      // 성격은 초당 피해가 아니라 **한계**라 맞바꿀 것이 없습니다.
      //
      // plusStep 이 셋 배(0.18 → 0.54)인 까닭: 맨몸을 60% 로 낮춰 놓고 보통
      // 걸음으로 올리면 서른에서도 최강의 절반에 못 미칩니다. 늦게 시작해서
      // 멀리 가려면 걸음이 커야 합니다.
      { key: 'nameless', name: '무명비수', dmg: 24, rate: 212, reach: 74, depth: 0,
        sheet: 0, color: 0x9e9e9e, plusMax: 30, plusStep: 0.54,
        detail: '맨몸은 약합니다. 대신 +1 을 서른까지 받습니다',
        lore: '이름을 새기지 않은 날. 새길 만한 일을 아직 안 했기 때문이라고, 간 이가 말했다고 합니다.',
        icon: { art: 'dagger', hw: 3.2, len: 0.42, guard: 'none' } },
    ],

  },
];

function classByKey(key) {
  return CLASSES.find((c) => c.key === key) || CLASSES[0];
}

// 전사만 처음부터 열려 있습니다. 나머지는 한 판 안에서 층과 코인을 함께 채워야 합니다.
function classUnlocked(job) {
  if (!job.unlockFloor && !job.unlockCoins) return true;
  return !!Save.data.unlocked[job.key];
}

// 방금 끝난 판이 조건을 채웠는지. 채웠으면 그 직업 키를 돌려줍니다.
function classesUnlockedBy(floor, coins) {
  return CLASSES.filter((job) =>
    (job.unlockFloor || job.unlockCoins) &&
    !Save.data.unlocked[job.key] &&
    floor >= (job.unlockFloor || 0) &&
    coins >= (job.unlockCoins || 0));
}
