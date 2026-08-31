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
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // 발판에 몰려 있을 때만 값이 납니다. 하나뿐이면 그냥 느린 근접입니다.
    표에안잡힘: '사거리가 넓어 한 번에 여럿이 맞습니다',
    그럴듯: 1.3,
    name: '전사',
    unlockFloor: 0, unlockCoins: 0, // 처음부터 열려 있는 유일한 직업
    blurb: '두껍게 막고 크게 벤다',
    detail: '두껍게 막으니 발판에서 물러설 필요가 없습니다.\n사거리 안의 적을 한 번에 벱니다.',
    // 붉은색이었습니다(0xef9a9a). 이야기의 마지막에 나오는 **붉은 겉옷** 하나가
    // 이 게임에서 유일한 붉은 것이어야 해서 전사를 군청으로 옮겼습니다
    // (망토·깃·띠까지 — recolor-warrior.js).
    //
    // 이 색은 어두운 바탕 위의 **글자 색**으로도 쓰이므로(직업 고르기·메달
    // 상점) 밝기는 그대로 두고 색만 돌렸습니다. 어둡게 하면 안 읽힙니다.
    color: 0x9ab1ef,

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
      { key: 'steel', name: '강철검', dmg: 49, rate: 400, reach: 108, depth: 40,
        forge: 'keen', sheet: 1, color: 0x90caf9,
        detail: '무게가 손에 잘 붙습니다',
        lore: '산 아래 대장간이 마지막으로 두들긴 자루. 무게를 재고 만든 것이 아니라 손을 재고 만들었습니다.',
        icon: { art: 'sword', hw: 4.6, len: 0.63, guard: 'bar', gw: 15 } },
      { key: 'twin', name: '쌍날검', dmg: 51, rate: 388, reach: 116, depth: 80,
        forge: 'black', sheet: 2, color: 0xa5d6a7, spread: 0.24,
        detail: '두 날이 엇갈립니다. 한 대가 들쭉날쭉합니다',
        lore: '두 자루를 붙여 하나로 만들었습니다. 붙인 사람은 왜 그랬는지 끝내 말하지 않았습니다.',
        icon: { art: 'sword', twin: true, hw: 5.0, len: 0.62, guard: 'bar', gw: 16 } },
      { key: 'spear', name: '장창', dmg: 52, rate: 376, reach: 124, depth: 120,
        forge: 'keen', sheet: 3, color: 0xb0bec5, acc: 0.96, spread: 0.12,
        detail: '곧게 찌릅니다. 좀처럼 빗나가지 않습니다',
        lore: '문지기들이 쓰던 것. 겨눈 자리와 닿는 자리가 같아야 한다는 것이 그들의 유일한 규칙이었습니다.',
        icon: { art: 'spear' } },
      { key: 'arcane', name: '마력검', dmg: 53, rate: 364, reach: 130, depth: 160,
        forge: 'silver', sheet: 4, color: 0xce93d8,
        detail: '날에 빛이 돕니다',
        lore: '날에 글자를 새겼습니다. 무슨 뜻인지는 새긴 사람만 알았고, 그 사람은 탑에서 내려오지 않았습니다.',
        icon: { art: 'sword', hw: 4.8, len: 0.66, guard: 'ring', gw: 14, gem: true } },
      { key: 'flame', name: '화염도', dmg: 55, rate: 352, reach: 135, depth: 200,
        forge: 'iron', sheet: 5, color: 0xff8a65, spread: 0.26,
        detail: '휘어진 날이 크게 훑습니다',
        lore: '불에 달군 채로 식히지 않고 벼렸습니다. 날이 아직도 미지근하다고들 합니다.',
        icon: { art: 'sword', hw: 5.4, len: 0.66, curve: 1.1, guard: 'bar', gw: 12 } },
      { key: 'thunder', name: '뇌전검', dmg: 56, rate: 340, reach: 139, depth: 250,
        forge: 'black', sheet: 6, color: 0x81d4fa,
        detail: '내리칠 때 소리가 늦게 옵니다',
        lore: '벼락 맞은 나무 아래에서 주웠다는 자루. 소리가 늦게 오는 까닭도 그래서라고 합니다.',
        icon: { art: 'sword', hw: 4.6, len: 0.68, guard: 'wing', gw: 15, gem: true } },
      { key: 'dragon', name: '용살검', dmg: 58, rate: 328, reach: 143, depth: 300,
        forge: 'keen', sheet: 7, color: 0xffb74d,
        detail: '큰 것을 베라고 만든 자루',
        lore: '큰 것을 잡으려고 만들었습니다. 다만 그 큰 것을 본 사람이 아직 없습니다.',
        icon: { art: 'sword', hw: 6.6, len: 0.70, guard: 'cross', gw: 19 } },
      { key: 'heaven', name: '파천검', dmg: 59, rate: 316, reach: 147, depth: 350,
        forge: 'silver', sheet: 8, color: 0xf48fb1,
        detail: '이가 빠진 채로도 잘 듭니다',
        lore: '이가 여럿 빠졌습니다. 빠진 자리마다 무엇을 벴는지 세어 두었다는 이야기가 있습니다.',
        icon: { art: 'sword', hw: 7.0, len: 0.70, curve: 0.6, guard: 'cross', gw: 20, notch: true } },
      { key: 'holy', name: '성흔검', dmg: 62, rate: 304, reach: 151, depth: 400,
        forge: 'iron', sheet: 9, color: 0xfff59d, acc: 0.95,
        detail: '겨눈 곳으로 저절로 갑니다',
        lore: '겨눈 곳으로 저절로 간다는 자루. 들어 본 사람은 손이 아니라 자루가 벴다고 말합니다.',
        icon: { art: 'sword', hw: 5.6, len: 0.73, guard: 'ring', gw: 17, gem: true } },
      { key: 'chaos', name: '혼돈대검', dmg: 64, rate: 292, reach: 155, depth: 450,
        forge: 'keen', sheet: 10, color: 0x9575cd, spread: 0.32, acc: 0.88,
        detail: '한 대가 어떻게 들어갈지 스스로도 모릅니다',
        lore: '셋이 함께 벼렸는데 셋이 서로 다른 것을 만들려 했습니다. 한 대가 어떻게 들어갈지 아무도 모릅니다.',
        icon: { art: 'sword', hw: 8.0, len: 0.72, guard: 'wing', gw: 21, gem: true } },
      { key: 'sky', name: '천공검', dmg: 66, rate: 280, reach: 159, depth: 500,
        forge: 'black', sheet: 11, color: 0x80cbc4,
        detail: '가장 멀리, 가장 무겁게',
        lore: '탑 꼭대기에 꽂혀 있었다는 자루. 꼭대기를 본 사람이 없으니 어디서 왔는지도 모릅니다.',
        icon: { art: 'sword', hw: 6.4, len: 0.76, curve: 0.5, guard: 'wing', gw: 19, gem: true, notch: true } },
      // ── 하나뿐인 예외 — 무명(無名) ────────────────────
      // **맨몸이 주머니에서 가장 약한 대신, +1 을 쉰까지 받습니다.**
      //
      // 다른 자루가 열에서 멎는 것이 이 자루의 전부입니다. 열까지는 오히려
      // 한참 뒤처집니다 — 그 무렵 가장 센 자루의 30% 입니다. **마흔에 이르러서야
      // 앞지르고(101%), 쉰에서 124% 가 됩니다.**
      //
      // 예전에는 서른이 한계였고 스물다섯에 뒤집혔습니다. 그런데 지도에서
      // +1 을 만나는 층이 5% 남짓이고 상점이 뭉치로 셋씩 파니, 300층 언저리에
      // 이미 한계에 닿았습니다. **한계에 닿는 순간 이 자루의 이야기가 끝납니다** —
      // 그 뒤로는 줍는 +1 이 전부 버려지고, 「지키는 결정」이 그냥 지나온 일이
      // 됩니다. 천장을 쉰으로 올리고 걸음을 그만큼 줄여서, 꼭대기 높이는
      // 그대로 둔 채 **가는 길만 길게** 했습니다.
      //
      // 그래서 이 자루를 쓰는 것은 **결정 하나를 판 내내 지키는 일**입니다 —
      // 오르는 내내 마주치는 더 좋아 보이는 자루를 전부 그냥 두어야 합니다.
      // 갈아타는 순간 쉰까지 쌓은 것이 통째로 사라집니다.
      //
      // **문이 둘입니다** — 그 직업으로 메달 상품을 셋 사 뒀고(CFG.weapon.
      // namelessPerks), 120층을 넘어야 나옵니다. 그 전에는 주머니에 아예 안
      // 들어옵니다. 판을 굴릴 줄 아는 사람에게만 이득인 자루라, 처음 켠 사람이
      // 첫 판 3층에서 주우면 그냥 약한 무기를 든 것이기 때문입니다.
      //
      // 한 번 열리면 **끝까지 남습니다** — 무명만 lookBack 창을 안 탑니다
      // (js/forge.js 의 weaponPoolAt). 여기서 얻는 것은 손에 쥐는 자루가
      // 아니라 도감에 적히는 한 줄이고, 그것이 **다음 판의 첫 자루**가 됩니다.
      // 위층에서 만나면 벼릴 시간이 없어 그 판에는 못 씁니다 — 처음부터
      // 골라야 뜻이 있습니다 (무기 도감에서 골라 옵니다).
      //
      // forge 가 없습니다. 만듦새는 초당 피해를 맞바꾸는 규칙인데, 이 자루의
      // 성격은 초당 피해가 아니라 **한계**라 맞바꿀 것이 없습니다.
      //
      // plusStep 이 보통의 두 배 남짓(0.18 → 0.33)인 까닭: 맨몸이 최강의 7%
      // 뿐이라 보통 걸음으로 올리면 쉰에서도 절반에 못 미칩니다. 늦게 시작해서
      // 멀리 가려면 걸음이 커야 합니다.
      //
      // **직업마다 값이 조금씩 다릅니다** (0.335 · 0.348 · 0.331). 맨몸과 최강
      // 사이의 거리가 직업마다 달라서, 같은 걸음을 쓰면 뒤집히는 지점이
      // 서른여덟에서 마흔둘까지 흩어집니다. 셋 다 **마흔에서** 뒤집혀야
      // 「마흔」이 약속이 됩니다.
      { key: 'nameless', name: '무명검', dmg: 19, rate: 410, reach: 96, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.335,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름을 새기지 않은 자루. 새길 만한 일을 아직 안 했기 때문이라고, 벼린 이가 말했다고 합니다.',
        icon: { art: 'sword', hw: 3.6, len: 0.56, guard: 'none' } },
    ],

  },

  {
    key: 'archer',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // 싸움을 고르지 않아도 되는 것이 이득입니다. 다만 shots 는 이미 절반씩
    // 세고 있으므로(job-scale) 여기서 또 얹지 않습니다.
    표에안잡힘: '멈추지 않고 지나가며 법니다',
    그럴듯: 1.15,
    name: '궁수',
    // 한 판 안에서 둘 다 채워야 열립니다 — 멀리 가기만 해서도, 벌기만 해서도 안 됩니다.
    unlockFloor: 500, unlockCoins: 1000,
    // ── 잠겨 있는 동안 보이는 한 줄 ──────────────────────
    // 격자에서 잠긴 직업은 **새까만 실루엣**이고 이름은 `???` 입니다
    // (js/scene-select.js). 그 아래 서는 한 줄입니다.
    //
    // **누구인지는 감추되 무엇을 하는지는 알려 줍니다.** 「탑이 그를 기억한다」
    // 같은 줄은 멋있지만 아무것도 안 알려 주고, 그러면 쫓아갈 이유가 안 생깁니다.
    // 무엇을 하는 사람인지 알아야 갖고 싶어집니다.
    //
    // 「~있다고 합니다」로 맺습니다 — 이 탑에서 직업이 열리는 것은 곧
    // **만남**이라(쓰러진 나를 누군가 내려다보는 컷), 아직 못 만난 사람은
    // 소문으로만 있어야 합니다.
    rumor: '멈추지 않고 오르는 사람이 있다고 합니다.',
    blurb: '멈추지 않고 쏜다',
    detail: '멀리서 맞추니 위험하게 다가갈 필요가 없습니다.\n한 발은 약합니다. 좋은 활일수록 여러 발이 나갑니다.',
    color: 0xa5d6a7,

    hp: 200,
    armor: 32,
    usesArmor: true,
    // 유물을 셋까지 듭니다 (다른 둘은 둘 — CFG.relic.maxHeld). 궁수는 몸으로
    // 버티는 것도 정면으로 막는 것도 아니라, 유물처럼 판을 유리하게 만드는
    // 것에 기대는 성격을 좀 더 줍니다.
    relicMax: 3,
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
      { key: 'hunter', name: '사냥활', dmg: 46, rate: 322, range: 310, shots: 1, depth: 40,
        forge: 'iron', sheet: 1, color: 0xbcaaa4,
        detail: '한 발이 무겁습니다',
        lore: '한 발로 끝내라고 배운 사람들의 활. 그들은 두 번째 발을 세지 않았습니다.',
        icon: { art: 'bow', big: true, arrows: 1 } },
      { key: 'horn', name: '각궁', dmg: 24, rate: 310, range: 325, shots: 2, depth: 80,
        forge: 'silver', sheet: 2, color: 0xa5d6a7,
        detail: '두 곳을 한꺼번에 노립니다',
        lore: '뿔을 여러 겹 붙였습니다. 마른 날에는 소리가 맑고 습한 날에는 무겁습니다.',
        icon: { art: 'bow', recurve: true, arrows: 1 } },
      { key: 'crossbow', name: '강철석궁', dmg: 24, rate: 300, range: 340, shots: 2, depth: 120,
        forge: 'black', sheet: 3, color: 0xb0bec5, acc: 0.95, spread: 0.10,
        detail: '기계가 겨눕니다. 흔들림이 없습니다',
        lore: '손이 떨려도 겨눈 자리는 떨리지 않습니다. 그것 하나로 값이 매겨졌습니다.',
        icon: { art: 'crossbow' } },
      { key: 'wind', name: '바람활', dmg: 25, rate: 292, range: 355, shots: 2, depth: 160,
        forge: 'keen', sheet: 4, color: 0x80deea,
        detail: '화살이 바람을 탑니다',
        lore: '시위를 놓으면 화살이 제 길을 조금 고쳐 간다고 합니다.',
        icon: { art: 'bow', recurve: true, arrows: 2 } },
      { key: 'flamebow', name: '불꽃장궁', dmg: 17, rate: 284, range: 370, shots: 3, depth: 200,
        forge: 'iron', sheet: 5, color: 0xff8a65, spread: 0.24,
        detail: '세 곳을 동시에',
        lore: '세 발이 한꺼번에 나가는데, 쏜 사람은 한 발만 쐈다고 느낍니다.',
        icon: { art: 'bow', big: true, arrows: 2 } },
      { key: 'roar', name: '뇌명궁', dmg: 18, rate: 276, range: 385, shots: 3, depth: 250,
        forge: 'silver', sheet: 6, color: 0x81d4fa,
        detail: '시위 소리가 뒤늦게 옵니다',
        lore: '맞은 쪽이 소리를 나중에 듣습니다. 그래서 두 번째 화살까지 피하지 못합니다.',
        icon: { art: 'bow', recurve: true, big: true, arrows: 2 } },
      { key: 'bone', name: '용뼈대궁', dmg: 18, rate: 268, range: 400, shots: 3, depth: 300,
        forge: 'keen', sheet: 7, color: 0xffb74d, homing: true,
        detail: '화살이 표적을 끝까지 쫓습니다',
        lore: '뼈로 지었다는 대궁. 화살이 표적을 끝까지 쫓는 것도 뼈가 기억하기 때문이라고들 합니다.',
        icon: { art: 'crossbow', big: true } },
      { key: 'gale', name: '질풍대궁', dmg: 14, rate: 260, range: 415, shots: 4, depth: 350,
        forge: 'black', sheet: 8, color: 0xf48fb1, homing: true,
        detail: '네 곳을 쫓아갑니다',
        lore: '네 발이 서로 다른 곳을 보고 나갑니다. 겨누는 일은 활이 합니다.',
        icon: { art: 'bow', big: true, arrows: 3 } },
      // 정확도가 0.96 이었습니다. 은장(+6%p)이 붙으면 1.02 가 되어 천장(1.00)에
      // 잘리고, 잘린 몫은 값만 치르고 못 받는 덤이 됩니다. 0.94 로 두면
      // 은장 성좌궁이 정확히 1.00 — 「겨눈 곳을 놓치는 법이 없다」가 됩니다.
      { key: 'star', name: '성좌궁', dmg: 15, rate: 252, range: 430, shots: 4, depth: 400,
        forge: 'silver', sheet: 9, color: 0xfff59d, acc: 0.94,
        detail: '겨눈 곳을 놓치는 법이 없습니다', homing: true,
        icon: { art: 'bow', recurve: true, big: true, arrows: 3 } },
      { key: 'abyss', name: '심연장궁', dmg: 16, rate: 244, range: 445, shots: 4, depth: 450,
        forge: 'iron', sheet: 10, color: 0x9575cd, homing: true, spread: 0.28,
        detail: '한 발 한 발이 다릅니다',
        lore: '깊은 데서 건져 올렸습니다. 한 발 한 발이 다른 까닭은 아직 아무도 밝히지 못했습니다.',
        lore: '밤하늘의 자리를 보고 겨눈다는 활. 놓치는 법이 없다는 말은 과장이 아닙니다.',
        icon: { art: 'crossbow', big: true, gem: true } },
      { key: 'skybow', name: '천뢰궁', dmg: 16, rate: 236, range: 460, shots: 4, depth: 500,
        forge: 'keen', sheet: 11, color: 0x80cbc4, homing: true,
        detail: '가장 멀리, 가장 자주',
        lore: '가장 멀리, 가장 자주. 활이 견디는 한계까지 밀어 놓은 물건입니다.',
        icon: { art: 'bow', recurve: true, big: true, arrows: 3, gem: true } },
      // ── 하나뿐인 예외 — 무명(無名) ────────────────────
      // **맨몸이 주머니에서 가장 약한 대신, +1 을 쉰까지 받습니다.**
      //
      // 다른 자루가 열에서 멎는 것이 이 자루의 전부입니다. 열까지는 오히려
      // 한참 뒤처집니다 — 그 무렵 가장 센 자루의 30% 입니다. **마흔에 이르러서야
      // 앞지르고(101%), 쉰에서 124% 가 됩니다.**
      //
      // 예전에는 서른이 한계였고 스물다섯에 뒤집혔습니다. 그런데 지도에서
      // +1 을 만나는 층이 5% 남짓이고 상점이 뭉치로 셋씩 파니, 300층 언저리에
      // 이미 한계에 닿았습니다. **한계에 닿는 순간 이 자루의 이야기가 끝납니다** —
      // 그 뒤로는 줍는 +1 이 전부 버려지고, 「지키는 결정」이 그냥 지나온 일이
      // 됩니다. 천장을 쉰으로 올리고 걸음을 그만큼 줄여서, 꼭대기 높이는
      // 그대로 둔 채 **가는 길만 길게** 했습니다.
      //
      // 그래서 이 자루를 쓰는 것은 **결정 하나를 판 내내 지키는 일**입니다 —
      // 오르는 내내 마주치는 더 좋아 보이는 자루를 전부 그냥 두어야 합니다.
      // 갈아타는 순간 쉰까지 쌓은 것이 통째로 사라집니다.
      //
      // **문이 둘입니다** — 그 직업으로 메달 상품을 셋 사 뒀고(CFG.weapon.
      // namelessPerks), 120층을 넘어야 나옵니다. 그 전에는 주머니에 아예 안
      // 들어옵니다. 판을 굴릴 줄 아는 사람에게만 이득인 자루라, 처음 켠 사람이
      // 첫 판 3층에서 주우면 그냥 약한 무기를 든 것이기 때문입니다.
      //
      // 한 번 열리면 **끝까지 남습니다** — 무명만 lookBack 창을 안 탑니다
      // (js/forge.js 의 weaponPoolAt). 여기서 얻는 것은 손에 쥐는 자루가
      // 아니라 도감에 적히는 한 줄이고, 그것이 **다음 판의 첫 자루**가 됩니다.
      // 위층에서 만나면 벼릴 시간이 없어 그 판에는 못 씁니다 — 처음부터
      // 골라야 뜻이 있습니다 (무기 도감에서 골라 옵니다).
      //
      // forge 가 없습니다. 만듦새는 초당 피해를 맞바꾸는 규칙인데, 이 자루의
      // 성격은 초당 피해가 아니라 **한계**라 맞바꿀 것이 없습니다.
      //
      // plusStep 이 보통의 두 배 남짓(0.18 → 0.33)인 까닭: 맨몸이 최강의 7%
      // 뿐이라 보통 걸음으로 올리면 쉰에서도 절반에 못 미칩니다. 늦게 시작해서
      // 멀리 가려면 걸음이 커야 합니다.
      //
      // **직업마다 값이 조금씩 다릅니다** (0.335 · 0.348 · 0.331). 맨몸과 최강
      // 사이의 거리가 직업마다 달라서, 같은 걸음을 쓰면 뒤집히는 지점이
      // 서른여덟에서 마흔둘까지 흩어집니다. 셋 다 **마흔에서** 뒤집혀야
      // 「마흔」이 약속이 됩니다.
      { key: 'nameless', name: '무명궁', dmg: 17, rate: 330, range: 290, shots: 1, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.348,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름을 새기지 않은 활. 새길 만한 일을 아직 안 했기 때문이라고, 메운 이가 말했다고 합니다.',
        icon: { art: 'bow' } },
    ],

  },

  {
    key: 'rogue',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // 실판에서 도적이 2105 코인을 벌어 무기를 +10 까지 올릴 때 전사는 919 로
    // +1 이었습니다. 코인이 화력이 되는 고리는 이 자에 안 잡힙니다.
    표에안잡힘: '훔친 코인이 무기가 됩니다',
    그럴듯: 1.25,
    name: '도적',
    unlockFloor: 700, unlockCoins: 2000,
    rumor: '싸우지 않고 가져가는 사람이 있다고 합니다.',
    blurb: '빠르게 찌르고 훔친다',
    detail: '빨리 찌르고 빠지니 오래 맞고 있을 필요가 없습니다.\n얇은 가죽에 기대어 흘려 넘기고, 잡지 않아도 훔칩니다.',
    color: 0xce93d8,

    // 유물을 둘까지 듭니다. CFG.relic.maxHeld(2)와 같은 값이지만, 그 기본값이
    // 나중에 바뀌어도 도적은 이 값을 그대로 지키라는 뜻으로 적어 둡니다.
    relicMax: 2,

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
    //
    // 0.62 → 0.56 → **0.90**. 두 번 손댔습니다.
    //
    // 0.56 은 「위층에서는 전사가 다시 앞선다」를 지키려고 내린 값이었습니다.
    // 그런데 그러면 도적의 성격이 **그냥 얇은 전사**가 됩니다 — 회피는
    // 도박인데, 도박의 상한이 절반 남짓이면 걸어 볼 것이 없습니다.
    //
    // 0.90 은 **판이 갈리는 값**입니다. 열 대에 한 대만 들어오므로 실질
    // 체력이 열 배가 되지만, 그 한 대가 언제 올지는 아무도 모릅니다. 판을
    // 바꾸는 넷에게는 절반만 듣고(CFG.foes.dodgeScale), 보스에게도 덜
    // 듭니다(CFG.boss.dodgeScale) — 도적이 정말 안 맞는 자리는 **평범한
    // 적들 사이**뿐이고, 무서운 것 앞에서는 여전히 얇습니다.
    //
    // 시작 회피(0.38)는 그대로입니다. 한계는 주워 올려야 닿는 자리이고,
    // 그 길이 길어진 것이 이 손질의 값입니다.
    //
    // **0.90 에서 0.70 으로 내렸습니다.** 셋을 같은 자로 재 보니
    // (node job-scale.js) 도적이 전사의 **2.42배**였습니다. 그것도
    // 한쪽을 내주고 다른 쪽을 얻은 것이 아니라 **초당 피해와 실질 체력
    // 둘 다** 1.6배씩이었습니다 — 그건 성격이 아니라 그냥 셉니다.
    //
    // 회피가 방어보다 잘 곱해지는 탓입니다. 방어 66%는 들어오는 몫을
    // 0.34 로 만드는데, 회피 0.90 에 가죽 18%가 겹치면 **0.08** 이 됩니다.
    // 0.70 이면 0.25 라, 전사의 0.34 와 비슷한 자리에 섭니다.
    //
    // 재 보니 2.42배 → 1.88배가 됐습니다.
    //
    // **그리고 다시 0.70 에서 0.55 로 내렸습니다.** 직업이 여덟이 되면서
    // 도적은 더 이상 마지막에 열리는 직업이 아닙니다 — 전사를 100 으로 놓고
    // 재니 도적만 191 로 혼자 위에 있었습니다 (나머지 일곱은 57~115).
    //
    // **다만 회피는 지렛대가 아니었습니다.** 성장을 아예 없애고 0.38 에
    // 묶어도 152 였습니다. 도적의 세기는 회피가 아니라 **자루**에 있습니다 —
    // 자루 기본 화력이 전사의 1.63배입니다 (369 대 227). 회피 0.55 로는
    // 191 → 169 까지만 내려갑니다.
    //
    // 시작 회피 0.38 은 그대로라 주워 올릴 자리는 남습니다.
    //
    // **CFG.dodge.hardMax 도 같이 내려야 합니다.** 거기가 안 내려가면
    // 상점의 「한계」가 이 값을 도로 밀어 올립니다 (verify-shop.js 가 봅니다).
    dodgeMax: 0.55,
    // 손이 셋 중 가장 빠릅니다. 가죽과 함께 올렸습니다 — 도적의 값어치는
    // "빠르다"인데 2.5는 궁수(2.05)와 그리 벌어져 보이지 않았습니다.
    //
    // **한계는 그대로 두고 자루 쪽을 20% 늦췄습니다** (아래 rate).
    // 직업이 여덟이 되면서 도적이 혼자 위에 남았는데(전사 100 기준 191),
    // 회피를 0.90 → 0.70 → 0.55 로 두 번 내려도 169 였습니다. 성장을 아예
    // 없애도 152 였고요 — **세기가 회피가 아니라 자루에 있었습니다.**
    // 자루 기본 화력이 전사의 1.63배(369 대 227)였습니다.
    //
    // 늦춰도 성격은 안 깨집니다. 첫 단도가 212 → 254ms 인데 궁수가 330,
    // 전사가 410 이라 **여전히 여덟 중 가장 빠릅니다.** 도적이 파는 것은
    // 「빠름」 하나가 아니라 빠름·회피·절도 셋이고, 그중 하나만 조금
    // 무디게 한 것입니다.
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
      { key: 'dagger', name: '단도', dmg: 40, rate: 254, reach: 78, depth: 0,
        forge: 'keen', sheet: 0, color: 0xcfd8dc,
        detail: '짧고 빠릅니다',
        lore: '품에 넣고 다니라고 만든 것. 짧은 만큼 늦는 법이 없습니다.',
        icon: { art: 'dagger', hw: 3.6, len: 0.40, guard: 'none', notch: true } },
      { key: 'hunting', name: '사냥칼', dmg: 41, rate: 246, reach: 82, depth: 40,
        forge: 'iron', sheet: 1, color: 0x90caf9,
        detail: '가르는 데 익숙한 날',
        lore: '가죽을 벗기던 날. 쓰던 사람이 무엇을 벗겼는지는 묻지 않는 것이 예의였습니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.44, guard: 'bar', gw: 9 } },
      { key: 'twindagger', name: '쌍단도', dmg: 42, rate: 238, reach: 86, depth: 80,
        forge: 'black', sheet: 2, color: 0xa5d6a7, spread: 0.24,
        detail: '두 손이 번갈아 들어갑니다',
        lore: '왼손과 오른손이 서로를 기다리지 않습니다.',
        icon: { art: 'dagger', twin: true, hw: 4.4, len: 0.44, guard: 'bar', gw: 11 } },
      { key: 'fang', name: '독니', dmg: 43, rate: 229, reach: 91, depth: 120,
        forge: 'silver', sheet: 3, color: 0x9ccc65,
        detail: '휘어진 끝이 걸립니다',
        lore: '끝이 갈고리처럼 휘었습니다. 들어갈 때보다 나올 때가 더 아픕니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.45, curve: 1.3, guard: 'none' } },
      { key: 'shadow', name: '그림자단검', dmg: 43, rate: 221, reach: 95, depth: 160,
        forge: 'keen', sheet: 4, color: 0xce93d8, acc: 0.95,
        detail: '보이지 않는 자리로 들어갑니다',
        lore: '등 뒤로 도는 법을 아는 날. 정면으로 들고 선 사람은 없었다고 합니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.48, guard: 'bar', gw: 10, gem: true } },
      { key: 'moon', name: '월아도', dmg: 45, rate: 214, reach: 98, depth: 200,
        forge: 'iron', sheet: 5, color: 0xff8a65, spread: 0.26,
        detail: '반달처럼 휘었습니다',
        lore: '반달처럼 휘었습니다. 벤 자리도 반달 모양이라고들 합니다.',
        icon: { art: 'dagger', hw: 5.0, len: 0.50, curve: 1.8, guard: 'bar', gw: 10 } },
      { key: 'bolt', name: '뇌전비수', dmg: 46, rate: 206, reach: 101, depth: 250,
        forge: 'black', sheet: 6, color: 0x81d4fa,
        detail: '찌른 자리가 저려옵니다',
        lore: '찌른 자리가 한참 뒤에 저려 옵니다. 그동안이 도망칠 시간입니다.',
        icon: { art: 'dagger', hw: 4.0, len: 0.50, guard: 'wing', gw: 11, gem: true } },
      { key: 'dragonfang', name: '용아단검', dmg: 48, rate: 199, reach: 104, depth: 300,
        forge: 'keen', sheet: 7, color: 0xffb74d,
        detail: '이빨을 갈아 만들었다고 합니다',
        lore: '이빨을 갈아 만들었다고 합니다. 갈아 낸 쪽이 이빨인지 사람인지는 모릅니다.',
        icon: { art: 'dagger', hw: 4.8, len: 0.52, curve: 1.1, guard: 'cross', gw: 12 } },
      { key: 'dark', name: '그믐비수', dmg: 49, rate: 192, reach: 107, depth: 350,
        forge: 'silver', sheet: 8, color: 0xf48fb1,
        detail: '달이 없는 밤의 것',
        lore: '달이 없는 밤에만 꺼냈습니다. 달이 있는 밤에는 보이니까요.',
        icon: { art: 'dagger', hw: 4.2, len: 0.53, curve: 1.6, guard: 'bar', gw: 10, gem: true } },
      { key: 'soul', name: '사혼도', dmg: 51, rate: 186, reach: 110, depth: 400,
        forge: 'iron', sheet: 9, color: 0xfff59d,
        detail: '베인 자리가 늦게 아픕니다',
        lore: '베인 줄 모르고 걷다가 멈춘다고 합니다. 그 자리에서 늦게 아파 옵니다.',
        icon: { art: 'dagger', hw: 5.2, len: 0.55, curve: 1.2, guard: 'ring', gw: 12 } },
      { key: 'abyssfang', name: '심연의이빨', dmg: 53, rate: 180, reach: 113, depth: 450,
        forge: 'keen', sheet: 10, color: 0x9575cd, spread: 0.30, acc: 0.88,
        detail: '두 날이 제멋대로 들어갑니다',
        lore: '두 날이 서로 다른 것을 노립니다. 쥔 사람의 뜻은 셋째입니다.',
        icon: { art: 'dagger', twin: true, hw: 5.0, len: 0.54, guard: 'wing', gw: 13, gem: true } },
      { key: 'skyfang', name: '천살단검', dmg: 55, rate: 174, reach: 116, depth: 500,
        forge: 'black', sheet: 11, color: 0x80cbc4,
        detail: '가장 빠르고 가장 무겁게',
        lore: '가장 빠르고 가장 무겁게. 둘을 함께 가진 물건은 이것 하나뿐입니다.',
        icon: { art: 'dagger', hw: 5.0, len: 0.58, guard: 'ring', gw: 13, gem: true, notch: true } },
      // ── 하나뿐인 예외 — 무명(無名) ────────────────────
      // **맨몸이 주머니에서 가장 약한 대신, +1 을 쉰까지 받습니다.**
      //
      // 다른 자루가 열에서 멎는 것이 이 자루의 전부입니다. 열까지는 오히려
      // 한참 뒤처집니다 — 그 무렵 가장 센 자루의 30% 입니다. **마흔에 이르러서야
      // 앞지르고(101%), 쉰에서 124% 가 됩니다.**
      //
      // 예전에는 서른이 한계였고 스물다섯에 뒤집혔습니다. 그런데 지도에서
      // +1 을 만나는 층이 5% 남짓이고 상점이 뭉치로 셋씩 파니, 300층 언저리에
      // 이미 한계에 닿았습니다. **한계에 닿는 순간 이 자루의 이야기가 끝납니다** —
      // 그 뒤로는 줍는 +1 이 전부 버려지고, 「지키는 결정」이 그냥 지나온 일이
      // 됩니다. 천장을 쉰으로 올리고 걸음을 그만큼 줄여서, 꼭대기 높이는
      // 그대로 둔 채 **가는 길만 길게** 했습니다.
      //
      // 그래서 이 자루를 쓰는 것은 **결정 하나를 판 내내 지키는 일**입니다 —
      // 오르는 내내 마주치는 더 좋아 보이는 자루를 전부 그냥 두어야 합니다.
      // 갈아타는 순간 쉰까지 쌓은 것이 통째로 사라집니다.
      //
      // **문이 둘입니다** — 그 직업으로 메달 상품을 셋 사 뒀고(CFG.weapon.
      // namelessPerks), 120층을 넘어야 나옵니다. 그 전에는 주머니에 아예 안
      // 들어옵니다. 판을 굴릴 줄 아는 사람에게만 이득인 자루라, 처음 켠 사람이
      // 첫 판 3층에서 주우면 그냥 약한 무기를 든 것이기 때문입니다.
      //
      // 한 번 열리면 **끝까지 남습니다** — 무명만 lookBack 창을 안 탑니다
      // (js/forge.js 의 weaponPoolAt). 여기서 얻는 것은 손에 쥐는 자루가
      // 아니라 도감에 적히는 한 줄이고, 그것이 **다음 판의 첫 자루**가 됩니다.
      // 위층에서 만나면 벼릴 시간이 없어 그 판에는 못 씁니다 — 처음부터
      // 골라야 뜻이 있습니다 (무기 도감에서 골라 옵니다).
      //
      // forge 가 없습니다. 만듦새는 초당 피해를 맞바꾸는 규칙인데, 이 자루의
      // 성격은 초당 피해가 아니라 **한계**라 맞바꿀 것이 없습니다.
      //
      // plusStep 이 보통의 두 배 남짓(0.18 → 0.33)인 까닭: 맨몸이 최강의 7%
      // 뿐이라 보통 걸음으로 올리면 쉰에서도 절반에 못 미칩니다. 늦게 시작해서
      // 멀리 가려면 걸음이 커야 합니다.
      //
      // **직업마다 값이 조금씩 다릅니다** (0.335 · 0.348 · 0.331). 맨몸과 최강
      // 사이의 거리가 직업마다 달라서, 같은 걸음을 쓰면 뒤집히는 지점이
      // 서른여덟에서 마흔둘까지 흩어집니다. 셋 다 **마흔에서** 뒤집혀야
      // 「마흔」이 약속이 됩니다.
      { key: 'nameless', name: '무명비수', dmg: 16, rate: 254, reach: 74, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.331,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름을 새기지 않은 날. 새길 만한 일을 아직 안 했기 때문이라고, 간 이가 말했다고 합니다.',
        icon: { art: 'dagger', hw: 3.2, len: 0.42, guard: 'none' } },
    ],

  },

  // ── 새로 들어온 다섯 ────────────────────────────────────
  // 수치는 draft-jobs.js 에서 맞춘 것을 그대로 옮겼습니다. 「초당 피해 ×
  // 실질 체력」으로 재서 전사를 100 으로 놓았을 때 앉는 자리 —
  //
  //   도굴꾼 94 · 전사 100 · 궁수 105 · 권법사 108 · 사령술사 109
  //   마법사 130 · 도적 141 · 곰사냥꾼 144
  //
  // 해금 조건은 대체로 **그 자리 순서 그대로**입니다. 위에 앉을수록 어렵게
  // 열립니다 (궁수 500층 → 곰사냥꾼 1000층). 전사가 공짜라 바닥인 것과
  // 같은 결입니다.
  //
  // **일곱이 층과 코인 양쪽으로 다 한 줄에 섭니다** — 앞의 것을 안 열고
  // 뒤의 것만 여는 판이 없습니다. 그래서 처음 겪는 해금은 언제나 궁수이고,
  // 만남 컷도 궁수가 규칙을 세웁니다 (ART.md 7.95). 새 직업을 끼울 때는
  // 이 두 줄이 계속 오름차순인지 보세요.
  //
  //   층    500 · 550 · 600 · 700 · 750 · 800 · 1000
  //   코인  1000 · 1400 · 1600 · 2000 · 2200 · 2400 · 3000
  //
  // 위 숫자는 다섯을 처음 앉힐 때의 어림입니다. 능력을 다 붙인 뒤 다시
  // 재면(`node job-scale.js`) 자리가 이렇게 바뀌었습니다 —
  //
  //   사령술사 82 · 도굴꾼 94 · 마법사 104 · 권법사 115
  //   궁수 120 · 전사 130 · 곰사냥꾼 162 · 도적 176
  //
  // **도굴꾼 하나만 자리 순서를 벗어나 있습니다.** 300층으로 가장 먼저
  // 열리던 것을 도적 다음(750층)으로 옮겼습니다. 세기로만 보면 앞쪽이
  // 맞지만, 도굴꾼은 **유물 다섯이 곧 직업**이라 유물을 만나 보기도 전에
  // 손에 들어오면 무엇이 좋은 직업인지 알 수가 없습니다 (유물은 200층부터
  // 100층마다 하나입니다). 게다가 job-scale 은 유물을 세지 않으므로 94 는
  // 실제보다 낮게 잡힌 값입니다 — 「많이 질수록」이 다섯 칸을 채우면
  // 공격력이 +30% 입니다.
  //
  // ── 아직 안 붙은 것 셋 ──────────────────────────────────
  // 다섯이 게임에 서기는 하지만 **저마다의 능력은 아직 없습니다.**
  //   권법사   연타가 쌓이는 것
  //   곰사냥꾼 앞서 올라가는 곰 (ally-bear 그림은 있습니다)
  //   사령술사 죽은 적 셋을 부하로 (ally-thrall 그림은 있습니다)
  //   마법사   자루의 burn·pierce·aoe·shield — 값은 적혀 있고 아직 안 읽힙니다
  //   도굴꾼   유물 다섯은 relicMax 로 이미 됩니다
  // 능력이 없으면 표에서 잰 자리보다 약합니다. 붙이기 전까지는 그렇습니다.
  {
    key: 'monk',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // **이제 표에 잡힙니다** — 연타가 층을 넘어서도 이어지고(CFG.combo)
    // 한 바퀴 평균이 ×1.32 라, job-scale 이 그 값을 직접 곱합니다.
    // 남는 것은 「열 번째를 큰 놈에게 맞출까」 하는 노림 정도입니다.
    표에안잡힘: '열 번째 한 대를 골라 맞힐 수 있습니다',
    그럴듯: 1.05,
    name: '권법사',
    unlockFloor: 550, unlockCoins: 1400,
    rumor: '무기 없이 오르는 사람이 있다고 합니다.',
    blurb: '맨손으로 이어 친다',
    detail: '무기를 안 씁니다.\n칠수록 세지다가 열 번째에 크게 들어갑니다.\n그러고는 처음으로 돌아갑니다.',
    color: 0xffd54f,

    hp: 190,
    armor: 15,
    armorMax: 45,
    usesArmor: true,
    speedCap: 2.60,
    plusScale: 1,
    attack: 'melee',
    dodge: 0,
    steal: 0,
    stun: 0,
    relicMax: 2,
    // 칠 때마다 쌓이고 열 번째에 풀립니다 (CFG.combo).
    combo: true,

    weapons: [
      { key: 'bare', name: '맨주먹', dmg: 30, rate: 200, reach: 58, depth: 0,
        forge: 'iron', sheet: 0, color: 0xcfd8dc,
        detail: '아무것도 안 쥡니다. 그게 시작입니다',
        lore: '무기를 잃고도 오르던 사람이 있었습니다. 그가 남긴 것은 자세뿐입니다.',
        icon: { art: 'fist', hw: 3.60, len: 0.52 } },
      { key: 'wrap', name: '붕대', dmg: 31, rate: 194, reach: 61, depth: 40,
        forge: 'keen', sheet: 1, color: 0x90caf9,
        detail: '손등을 감았습니다. 오래 칠 수 있습니다',
        lore: '천을 감는 데 걸리는 시간만큼 마음이 가라앉는다고 했습니다.',
        icon: { art: 'fist', hw: 3.94, len: 0.55 } },
      { key: 'ring', name: '쇠고리', dmg: 33, rate: 187, reach: 63, depth: 80,
        forge: 'black', sheet: 2, color: 0xb0bec5,
        detail: '주먹에 무게가 실립니다',
        lore: '대장간에서 버린 고리를 주워 손에 꿰었습니다.',
        icon: { art: 'fist', hw: 4.28, len: 0.57 } },
      { key: 'iron', name: '철장갑', dmg: 34, rate: 181, reach: 66, depth: 120,
        forge: 'silver', sheet: 3, color: 0xa1887f,
        detail: '치는 쪽이 안 아픕니다',
        lore: '갑옷의 손 부분만 떼어 낸 것. 나머지는 무거워서 버렸습니다.',
        icon: { art: 'fist', hw: 4.62, len: 0.60 } },
      { key: 'spike', name: '가시너클', dmg: 35, rate: 175, reach: 69, depth: 160,
        forge: 'iron', sheet: 4, color: 0xffcc80,
        detail: '스치기만 해도 찢어집니다',
        lore: '가시가 안쪽으로도 나 있어서, 처음 쓰는 사람은 제 손을 찌릅니다.',
        icon: { art: 'fist', hw: 4.96, len: 0.62 } },
      { key: 'stone', name: '돌너클', dmg: 36, rate: 168, reach: 72, depth: 200,
        forge: 'keen', sheet: 5, color: 0xef9a9a,
        detail: '손이 아니라 돌이 됩니다',
        lore: '탑 아래 돌을 깎아 만들었습니다. 쥐면 팔이 무거워집니다.',
        icon: { art: 'fist', hw: 5.30, len: 0.65 } },
      { key: 'bolt', name: '뇌전권갑', dmg: 38, rate: 162, reach: 74, depth: 250,
        forge: 'black', sheet: 6, color: 0x80deea,
        detail: '맞은 자리가 저릿합니다',
        lore: '치고 나면 손끝이 한참 저립니다. 익숙해지는 사람은 드뭅니다.',
        icon: { art: 'fist', hw: 5.64, len: 0.68 } },
      { key: 'scale', name: '용린손갑', dmg: 39, rate: 155, reach: 77, depth: 300,
        forge: 'silver', sheet: 7, color: 0xce93d8,
        detail: '비늘이 손등을 덮습니다',
        lore: '비늘 한 장이 손등만 합니다. 무엇의 비늘인지는 아무도 모릅니다.',
        icon: { art: 'fist', hw: 5.98, len: 0.70 } },
      { key: 'shadow', name: '그림자장갑', dmg: 40, rate: 149, reach: 80, depth: 350,
        forge: 'iron', sheet: 8, color: 0x9fa8da,
        detail: '치는 것이 안 보입니다',
        lore: '검은 천을 여러 겹 감았습니다. 어두운 층에서는 주먹이 안 보입니다.',
        icon: { art: 'fist', hw: 6.32, len: 0.73 } },
      { key: 'adamant', name: '금강너클', dmg: 41, rate: 143, reach: 83, depth: 400,
        forge: 'keen', sheet: 9, color: 0xffe082,
        detail: '부러지지 않습니다',
        lore: '깨지지 않는 것으로만 만들었습니다. 그래서 아주 무겁습니다.',
        icon: { art: 'fist', hw: 6.66, len: 0.75 } },
      { key: 'chaos', name: '혼돈손갑', dmg: 43, rate: 136, reach: 85, depth: 450,
        forge: 'black', sheet: 10, color: 0xb39ddb,
        detail: '한 대가 어떻게 들어갈지 모릅니다',
        lore: '두 손이 서로 다른 세기로 들어갑니다. 쓰는 사람도 모릅니다.',
        icon: { art: 'fist', hw: 7.00, len: 0.78 } },
      { key: 'sky', name: '천공권갑', dmg: 44, rate: 130, reach: 88, depth: 500,
        forge: 'silver', sheet: 11, color: 0xf48fb1,
        detail: '가장 빠르고 가장 많이',
        lore: '가장 높은 층에서 주웠다는 것 말고는 알려진 것이 없습니다.',
        icon: { art: 'fist', hw: 7.34, len: 0.81 } },
      { key: 'nameless', name: '무명권갑', dmg: 12, rate: 200, reach: 55, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.376,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름이 없습니다. 누가 만들었는지도, 몇 사람의 손을 거쳤는지도.',
        icon: { art: 'fist', hw: 3.90, len: 0.52 } },
    ],
  },
  {
    key: 'hunter',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // **이제 표에 잡힙니다** — 곰이 주인공 한 대의 55%로 제 박자에 치므로
    // job-scale 이 그 몫을 더합니다. 남는 것은 **내가 아직 안 간 층에서
    // 먼저 치워 준다**는 것뿐입니다 — 실제로 겪는 마릿수가 줄어드는데,
    // 그건 초당 피해로 안 잡힙니다.
    표에안잡힘: '안 가 본 층을 먼저 치워 둡니다',
    그럴듯: 1.12,
    name: '곰사냥꾼',
    unlockFloor: 1000, unlockCoins: 3000,
    rumor: '혼자 오르지 않는 사람이 있다고 합니다.',
    blurb: '곰을 앞서 보낸다',
    detail: '곰이 한 층 앞서 올라가 먼저 싸웁니다.\n쓰러져도 잠시 뒤에 돌아옵니다.\n내 활은 한 발이 무겁고 느립니다.',
    color: 0xbcaaa4,

    hp: 225,
    armor: 32,
    armorMax: 72,
    usesArmor: true,
    speedCap: 1.70,
    plusScale: 1,
    attack: 'ranged',
    dodge: 0,
    steal: 0,
    stun: 0,
    relicMax: 2,
    // 곰이 한 층 앞서 올라가 먼저 싸웁니다 (CFG.bear).
    bear: true,

    weapons: [
      { key: 'hunt', name: '사냥활', dmg: 55, rate: 420, range: 280, depth: 0,
        forge: 'iron', sheet: 0, color: 0xef9a9a,
        detail: '짐승을 잡던 것입니다',
        lore: '탑에 들기 전에 쓰던 활. 산에서는 이것으로 충분했습니다.',
        icon: { art: 'bow', arrows: 1, wrap: true, curve: 78 } },
      { key: 'horn', name: '각궁', dmg: 57, rate: 411, range: 293, depth: 40,
        forge: 'keen', sheet: 1, color: 0x80deea,
        detail: '뿔을 덧대어 더 멀리 갑니다',
        lore: '뿔을 붙이는 데 반년, 마르는 데 또 반년이 걸립니다.',
        icon: { art: 'bow', arrows: 1, wrap: true, curve: 76 } },
      { key: 'strong', name: '강궁', dmg: 59, rate: 402, range: 305, depth: 80,
        forge: 'black', sheet: 2, color: 0xce93d8,
        detail: '당기는 데 힘이 듭니다',
        lore: '당기지 못하는 사람이 더 많습니다.',
        icon: { art: 'bow', arrows: 1, wrap: true, curve: 74 } },
      { key: 'trap', name: '덫사냥꾼의 활', dmg: 61, rate: 393, range: 318, depth: 120,
        forge: 'silver', sheet: 3, color: 0x9fa8da,
        detail: '기다리는 데 익숙합니다',
        lore: '덫을 놓고 기다리던 사람의 것. 곰을 데리고 다니기 전의 이야기입니다.',
        icon: { art: 'bow', arrows: 1, wrap: true, curve: 72 } },
      { key: 'bone', name: '곰뼈활', dmg: 63, rate: 384, range: 331, depth: 160,
        forge: 'iron', sheet: 4, color: 0xffe082,
        detail: '잡은 것으로 만들었습니다',
        lore: '함께 오르던 곰의 뼈로 만들었다는 말이 있습니다. 본인은 부정합니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 70 } },
      { key: 'steel', name: '철태궁', dmg: 65, rate: 375, range: 344, depth: 200,
        forge: 'keen', sheet: 5, color: 0xb39ddb,
        detail: '쇠를 덧대 무겁습니다',
        lore: '쇠를 덧대면 안 부러지지만 손이 먼저 지칩니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 68 } },
      { key: 'bolt', name: '뇌전장궁', dmg: 68, rate: 365, range: 356, depth: 250,
        forge: 'black', sheet: 6, color: 0xf48fb1,
        detail: '시위 소리가 늦게 옵니다',
        lore: '쏜 뒤에 소리가 옵니다. 맞은 쪽이 먼저 압니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 66 } },
      { key: 'sinew', name: '용근궁', dmg: 70, rate: 356, range: 369, depth: 300,
        forge: 'silver', sheet: 7, color: 0xcfd8dc,
        detail: '힘줄이 늘어나지 않습니다',
        lore: '늘어나지 않는 힘줄로 걸었습니다. 백 번을 쏴도 처음과 같습니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 64 } },
      { key: 'dark', name: '그믐활', dmg: 72, rate: 347, range: 382, depth: 350,
        forge: 'iron', sheet: 8, color: 0x90caf9,
        detail: '달 없는 밤에 쓰던 것',
        lore: '검게 그을려 빛을 안 냅니다. 겨누는 것이 안 보입니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 62 } },
      { key: 'soul', name: '혼궁', dmg: 74, rate: 338, range: 395, depth: 400,
        forge: 'keen', sheet: 9, color: 0xb0bec5,
        detail: '겨눈 것을 놓지 않습니다',
        lore: '한 번 겨눈 것은 시위를 놓아도 따라간다고 합니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 60, gem: true } },
      { key: 'chaos', name: '혼돈장궁', dmg: 76, rate: 329, range: 407, depth: 450,
        forge: 'black', sheet: 10, color: 0xa1887f,
        detail: '한 발 한 발이 다릅니다',
        lore: '두 번 같은 자리에 꽂히는 법이 없습니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 58, gem: true } },
      { key: 'sky', name: '천공대궁', dmg: 78, rate: 320, range: 420, depth: 500,
        forge: 'silver', sheet: 11, color: 0xffcc80,
        detail: '가장 멀리, 가장 무겁게',
        lore: '탑 꼭대기를 겨눌 수 있는 유일한 활이라는 말이 있습니다.',
        icon: { art: 'bow', big: true, arrows: 1, wrap: true, curve: 56, gem: true } },
      { key: 'nameless', name: '무명궁', dmg: 22, rate: 420, range: 263, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.305,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름이 없습니다. 누가 만들었는지도, 몇 사람의 손을 거쳤는지도.',
        icon: { art: 'bow', arrows: 1, wrap: true } },
    ],
  },
  {
    key: 'necro',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // **이제 표에 잡힙니다** — 셋이 각자 내 화력의 3할로 치므로(CFG.thrall)
    // job-scale 이 그 몫을 직접 곱합니다. 남는 것은 「셋을 늘 채워 둘 수
    // 있는가」입니다 — 계속 잡아야 하고, 맞으면 죽고, 층을 옮기면 따라오는
    // 데 시간이 걸립니다. 늘 셋인 판은 드뭅니다.
    표에안잡힘: '셋을 채워 두면 그만큼 더 칩니다',
    그럴듯: 1.15,
    name: '사령술사',
    unlockFloor: 600, unlockCoins: 1600,
    rumor: '쓰러뜨린 것을 두고 가지 않는 사람이 있다고 합니다.',
    blurb: '죽은 것을 데리고 간다',
    detail: '내가 잡은 적이 셋까지 일어나 같이 칩니다.\n맞으면 죽고, 층을 옮기면 따라옵니다.\n여덟 중 가장 얇습니다 — 대신 혼자 싸우지 않습니다.',
    color: 0x4db6ac,

    hp: 155,
    armor: 18,
    armorMax: 45,
    usesArmor: true,
    speedCap: 1.90,
    plusScale: 1,
    attack: 'ranged',
    dodge: 0,
    steal: 0,
    stun: 0,
    relicMax: 3,
    // 내가 잡은 적이 셋까지 일어나 같이 칩니다 (CFG.thrall).
    thralls: true,

    weapons: [
      { key: 'bone', name: '뼈지팡이', dmg: 36, rate: 330, range: 270, depth: 0,
        forge: 'iron', sheet: 0, color: 0xb39ddb,
        detail: '가볍고 잘 부러지지 않습니다',
        lore: '누구의 뼈인지 묻지 않는 것이 이 일의 예의라고 합니다.',
        icon: { art: 'staff', hw: 3.82, len: 0.52 } },
      { key: 'skull', name: '해골지팡이', dmg: 37, rate: 322, range: 282, depth: 40,
        forge: 'keen', sheet: 1, color: 0xf48fb1,
        detail: '끝에 얹힌 것이 무겁습니다',
        lore: '끝에 얹힌 해골이 가끔 방향을 바꾼다고 합니다.',
        icon: { art: 'staff', hw: 4.16, len: 0.55 } },
      { key: 'black', name: '검은 나무', dmg: 39, rate: 315, range: 294, depth: 80,
        forge: 'black', sheet: 2, color: 0xcfd8dc,
        detail: '탑에서 자란 나무로 깎았습니다',
        lore: '이 탑에서 자란 나무는 검습니다. 아무도 이유를 모릅니다.',
        icon: { art: 'staff', hw: 4.50, len: 0.57 } },
      { key: 'bier', name: '상여목', dmg: 40, rate: 307, range: 305, depth: 120,
        forge: 'silver', sheet: 3, color: 0x90caf9,
        detail: '실어 나르던 나무입니다',
        lore: '죽은 이를 실어 나르던 나무. 쓰던 곳을 기억한다고 합니다.',
        icon: { art: 'staff', hw: 4.84, len: 0.60 } },
      { key: 'wisp', name: '혼불지팡이', dmg: 42, rate: 299, range: 317, depth: 160,
        forge: 'iron', sheet: 4, color: 0xb0bec5,
        detail: '끝에 불이 붙어 있습니다',
        lore: '불이 꺼진 적이 없습니다. 무엇을 태우는지는 모릅니다.',
        icon: { art: 'staff', hw: 5.18, len: 0.62 } },
      { key: 'grave', name: '묘비석장', dmg: 43, rate: 291, range: 329, depth: 200,
        forge: 'keen', sheet: 5, color: 0xa1887f,
        detail: '누구의 것인지는 안 적혀 있습니다',
        lore: '이름이 지워진 묘비를 깎아 만들었습니다.',
        icon: { art: 'staff', hw: 5.52, len: 0.65 } },
      { key: 'bolt', name: '뇌전골장', dmg: 45, rate: 284, range: 341, depth: 250,
        forge: 'black', sheet: 6, color: 0xffcc80,
        detail: '뼈를 타고 흐릅니다',
        lore: '뼈를 타고 흐르는 것이 보입니다. 쥔 손에는 안 옵니다.',
        icon: { art: 'staff', hw: 5.86, len: 0.68 } },
      { key: 'dragon', name: '용골장', dmg: 46, rate: 276, range: 353, depth: 300,
        forge: 'silver', sheet: 7, color: 0xef9a9a,
        detail: '큰 것의 뼈로 만들었습니다',
        lore: '큰 것의 뼈 하나가 사람 키만 합니다.',
        icon: { art: 'staff', hw: 6.20, len: 0.70 } },
      { key: 'dark', name: '그믐장', dmg: 48, rate: 268, range: 365, depth: 350,
        forge: 'iron', sheet: 8, color: 0x80deea,
        detail: '들면 주위가 어두워집니다',
        lore: '들고 서 있으면 주위가 한 단 어두워집니다.',
        icon: { art: 'staff', hw: 6.54, len: 0.73 } },
      { key: 'soul', name: '사혼장', dmg: 49, rate: 260, range: 376, depth: 400,
        forge: 'keen', sheet: 9, color: 0xce93d8,
        detail: '부르는 소리가 멀리 갑니다',
        lore: '부르는 소리가 세 층 위까지 간다고 합니다.',
        icon: { art: 'staff', hw: 6.88, len: 0.75 } },
      { key: 'chaos', name: '혼돈골장', dmg: 51, rate: 253, range: 388, depth: 450,
        forge: 'black', sheet: 10, color: 0x9fa8da,
        detail: '무엇이 일어날지 모릅니다',
        lore: '일어난 것이 누구 편인지 확실치 않을 때가 있습니다.',
        icon: { art: 'staff', hw: 7.22, len: 0.78 } },
      { key: 'sky', name: '천장골장', dmg: 52, rate: 245, range: 400, depth: 500,
        forge: 'silver', sheet: 11, color: 0xffe082,
        detail: '가장 멀리 부릅니다',
        lore: '이것으로 부른 것은 돌려보낼 수 없다는 말이 있습니다.',
        icon: { art: 'staff', hw: 7.56, len: 0.81 } },
      { key: 'nameless', name: '무명골장', dmg: 14, rate: 330, range: 254, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.331,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름이 없습니다. 누가 만들었는지도, 몇 사람의 손을 거쳤는지도.',
        icon: { art: 'staff', hw: 3.20, len: 0.52 } },
    ],
  },
  {
    key: 'wizard',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // **화상과 보호막은 이제 표에 잡힙니다** (job-scale 이 burn·shield 를 셉니다).
    // 남은 것은 여럿에게 닿는 둘뿐이라 1.5 에서 1.2 로 내렸습니다 — 전사의
    // 사거리와 같은 자리입니다.
    표에안잡힘: '관통·광역이 여럿에게 닿습니다',
    그럴듯: 1.2,
    name: '마법사',
    unlockFloor: 800, unlockCoins: 2400,
    rumor: '같은 손짓으로 다른 것을 부르는 사람이 있다고 합니다.',
    blurb: '지팡이마다 다른 것이 나간다',
    detail: '지팡이가 피해만 주지 않습니다.\n태우고, 꿰뚫고, 터지고, 감쌉니다.\n무엇을 드느냐가 곧 어떻게 싸우느냐입니다.',
    color: 0x4fc3f7,

    hp: 175,
    armor: 22,
    armorMax: 58,
    usesArmor: true,
    speedCap: 2.00,
    plusScale: 1,
    attack: 'ranged',
    dodge: 0,
    steal: 0,
    stun: 0,
    relicMax: 2,

    weapons: [
      { key: 's0', name: '나무 지팡이', dmg: 50, rate: 340, range: 300, depth: 0,
        forge: 'iron', sheet: 0, color: 0xa1887f,
        detail: '가장 흔한 한 자루',
        lore: '처음 쥐는 지팡이. 아무 재주도 없지만 손에 익습니다.',
        icon: { art: 'staff', hw: 3.93, len: 0.52 } },
      { key: 's1', name: '불의 지팡이', dmg: 42, rate: 332, range: 314, depth: 40,
        forge: 'keen', sheet: 1, color: 0xffcc80, burn: 0.45,
        detail: '맞은 자리가 계속 탑니다',
        lore: '끝이 늘 따뜻합니다. 물에 담가도 식지 않습니다.',
        icon: { art: 'staff', hw: 4.27, len: 0.55 } },
      { key: 's2', name: '쌍갈래 지팡이', dmg: 34, rate: 324, range: 327, depth: 80,
        forge: 'black', sheet: 2, color: 0xef9a9a, shots: 2,
        detail: '한 번에 2갈래로 나갑니다',
        lore: '한 번 휘두르면 둘이 나갑니다. 어느 쪽이 먼저인지는 모릅니다.',
        icon: { art: 'staff', hw: 4.61, len: 0.57 } },
      { key: 's3', name: '꿰뚫는 지팡이', dmg: 49, rate: 315, range: 341, depth: 120,
        forge: 'silver', sheet: 3, color: 0x80deea, pierce: 2,
        detail: '뒤에 선 것까지 꿰뚫습니다',
        lore: '지나간 자리에 구멍이 남습니다.',
        icon: { art: 'staff', hw: 4.95, len: 0.60 } },
      { key: 's4', name: '수호의 지팡이', dmg: 42, rate: 307, range: 355, depth: 160,
        forge: 'iron', sheet: 4, color: 0xce93d8, shield: 1.3,
        detail: '몸을 감싸는 것이 함께 섭니다',
        lore: '쥐고 있으면 등 뒤가 덜 서늘합니다.',
        icon: { art: 'staff', hw: 5.29, len: 0.62 } },
      { key: 's5', name: '터지는 지팡이', dmg: 49, rate: 299, range: 368, depth: 200,
        forge: 'keen', sheet: 5, color: 0x9fa8da, aoe: 1,
        detail: '닿은 자리가 터집니다',
        lore: '끝에 닿은 것은 그 자리에서 터집니다.',
        icon: { art: 'staff', hw: 5.63, len: 0.65 } },
      { key: 's6', name: '세갈래 지팡이', dmg: 29, rate: 291, range: 382, depth: 250,
        forge: 'black', sheet: 6, color: 0xffe082, shots: 3,
        detail: '한 번에 3갈래로 나갑니다',
        lore: '셋으로 갈라지되 힘도 셋으로 갈립니다.',
        icon: { art: 'staff', hw: 5.97, len: 0.68 } },
      { key: 's7', name: '사슬 지팡이', dmg: 51, rate: 283, range: 395, depth: 300,
        forge: 'silver', sheet: 7, color: 0xb39ddb, pierce: 3,
        detail: '뒤에 선 것까지 꿰뚫습니다',
        lore: '한 줄로 선 것들을 한 번에 꿴다고 합니다.',
        icon: { art: 'staff', hw: 6.31, len: 0.70 } },
      { key: 's8', name: '화염폭풍', dmg: 42, rate: 275, range: 409, depth: 350,
        forge: 'iron', sheet: 8, color: 0xf48fb1, burn: 0.55, aoe: 1,
        detail: '맞은 자리가 계속 탑니다. 닿은 자리가 터집니다',
        lore: '불이 번지는 것을 멈추는 법을 아직 아무도 못 찾았습니다.',
        icon: { art: 'staff', hw: 6.65, len: 0.73 } },
      { key: 's9', name: '서리 지팡이', dmg: 61, rate: 266, range: 423, depth: 400,
        forge: 'keen', sheet: 9, color: 0xcfd8dc, acc: 0.96, spread: 0.1,
        detail: '가장 흔한 한 자루',
        lore: '흔들리지 않습니다. 겨눈 곳으로 정확히 갑니다.',
        icon: { art: 'staff', hw: 6.99, len: 0.75 } },
      { key: 's10', name: '별의 지팡이', dmg: 36, rate: 258, range: 436, depth: 450,
        forge: 'black', sheet: 10, color: 0x90caf9, shots: 3, burn: 0.3,
        detail: '한 번에 3갈래로 나갑니다. 맞은 자리가 계속 탑니다',
        lore: '밤하늘을 그대로 담았다고 합니다. 셋이 나가고 셋 다 탑니다.',
        icon: { art: 'staff', hw: 7.33, len: 0.78 } },
      { key: 's11', name: '대마법사의 지팡이', dmg: 36, rate: 250, range: 450, depth: 500,
        forge: 'silver', sheet: 11, color: 0xb0bec5, shots: 3, burn: 0.25, shield: 1.2,
        detail: '한 번에 3갈래로 나갑니다. 맞은 자리가 계속 탑니다. 몸을 감싸는 것이 함께 섭니다',
        lore: '이 지팡이를 든 사람은 더 배울 것이 없다고 합니다.',
        icon: { art: 'staff', hw: 7.67, len: 0.81 } },
      { key: 'nameless', name: '무명지팡이', dmg: 20, rate: 340, range: 282, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.496,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름이 없습니다. 누가 만들었는지도, 몇 사람의 손을 거쳤는지도.',
        icon: { art: 'staff', hw: 3.90, len: 0.52 } },
    ],
  },
  {
    key: 'digger',
    // ── 이 자에 안 잡히는 것 ────────────────────────────
    // node job-scale.js 가 「초당 피해 × 실질 체력」으로 여덟을 같은 자로
    // 잽니다. 그런데 직업마다 그 자에 안 걸리는 이득이 하나씩 있고,
    // **그게 바로 직업을 직업으로 만드는 것**입니다.
    //
    // 짐작한 배수를 곱해서 점수를 맞추면 어떤 답이든 나오므로, 배수를
    // 여기 적어 두고 **셈이 그 값으로 앉는 자리를 내게** 합니다.
    // **이미 점수에 들어가 있습니다** (칸당 ×1.18, 다섯이면 ×1.64). 그 위에
    // 또 얹을 것이 없으므로 1.0 입니다.
    표에안잡힘: '유물을 다섯 듭니다 (나머지는 둘~셋)',
    그럴듯: 1.0,
    name: '도굴꾼',
    unlockFloor: 750, unlockCoins: 2200,
    rumor: '싸우러 온 것이 아닌 사람이 있다고 합니다.',
    blurb: '유물을 다섯 지고 오른다',
    detail: '유물을 다섯 듭니다. 여덟 중 유일합니다.\n대신 곡괭이는 싸우라고 만든 물건이 아닙니다.',
    color: 0xd4e157,

    hp: 185,
    armor: 20,
    armorMax: 56,
    usesArmor: true,
    speedCap: 1.60,
    plusScale: 1,
    attack: 'melee',
    dodge: 0,
    steal: 0,
    stun: 0,
    relicMax: 5,

    weapons: [
      { key: 'pick', name: '곡괭이', dmg: 38, rate: 380, reach: 86, depth: 0,
        forge: 'iron', sheet: 0, color: 0x9fa8da,
        detail: '캐라고 만든 물건입니다',
        lore: '싸우라고 만든 물건이 아닙니다. 그래도 없는 것보다는 낫습니다.',
        icon: { art: 'pick', hw: 4.04, len: 0.52 } },
      { key: 'iron', name: '쇠곡괭이', dmg: 40, rate: 372, reach: 89, depth: 40,
        forge: 'keen', sheet: 1, color: 0xffe082,
        detail: '자루가 쇠라 안 부러집니다',
        lore: '자루가 쇠라 무겁습니다. 대신 부러진 적이 없습니다.',
        icon: { art: 'pick', hw: 4.38, len: 0.55 } },
      { key: 'twin', name: '쌍날곡괭이', dmg: 41, rate: 365, reach: 92, depth: 80,
        forge: 'black', sheet: 2, color: 0xb39ddb,
        detail: '양쪽 다 씁니다',
        lore: '한쪽으로 캐고 한쪽으로 칩니다. 둘 다 어중간합니다.',
        icon: { art: 'pick', hw: 4.72, len: 0.57 } },
      { key: 'hook', name: '갈고리', dmg: 43, rate: 357, reach: 95, depth: 120,
        forge: 'silver', sheet: 3, color: 0xf48fb1,
        detail: '걸어서 당깁니다',
        lore: '벽에 걸고 오르던 것. 사람에게도 걸립니다.',
        icon: { art: 'pick', hw: 5.06, len: 0.60 } },
      { key: 'hammer', name: '돌깨는망치', dmg: 45, rate: 349, reach: 98, depth: 160,
        forge: 'iron', sheet: 4, color: 0xcfd8dc,
        detail: '벽을 부수던 것',
        lore: '탑의 벽을 부수려던 사람의 것. 벽은 멀쩡했습니다.',
        icon: { art: 'pick', hw: 5.40, len: 0.62 } },
      { key: 'spade', name: '도굴꾼의 삽', dmg: 46, rate: 341, reach: 101, depth: 200,
        forge: 'keen', sheet: 5, color: 0x90caf9,
        detail: '파는 데도 치는 데도 씁니다',
        lore: '파는 것이 본업입니다. 치는 것은 어쩌다 하는 일입니다.',
        icon: { art: 'pick', hw: 5.74, len: 0.65 } },
      { key: 'bolt', name: '뇌전곡괭이', dmg: 48, rate: 334, reach: 105, depth: 250,
        forge: 'black', sheet: 6, color: 0xb0bec5,
        detail: '박히면 저릿합니다',
        lore: '박히면 한동안 손이 저립니다. 쥔 쪽도 마찬가지입니다.',
        icon: { art: 'pick', hw: 6.08, len: 0.68 } },
      { key: 'fang', name: '용아곡괭이', dmg: 49, rate: 326, reach: 108, depth: 300,
        forge: 'silver', sheet: 7, color: 0xa1887f,
        detail: '이빨을 박아 넣었습니다',
        lore: '큰 것의 이빨을 끝에 박았습니다. 잘 안 빠집니다.',
        icon: { art: 'pick', hw: 6.42, len: 0.70 } },
      { key: 'dark', name: '그믐괭이', dmg: 51, rate: 318, reach: 111, depth: 350,
        forge: 'iron', sheet: 8, color: 0xffcc80,
        detail: '어두운 데서 씁니다',
        lore: '검게 칠해 두면 무엇을 캐는지 안 보입니다.',
        icon: { art: 'pick', hw: 6.76, len: 0.73 } },
      { key: 'soul', name: '사혼괭이', dmg: 53, rate: 310, reach: 114, depth: 400,
        forge: 'keen', sheet: 9, color: 0xef9a9a,
        detail: '캔 것이 따라온다고 합니다',
        lore: '이것으로 캔 것은 주인을 따라온다고 합니다.',
        icon: { art: 'pick', hw: 7.10, len: 0.75 } },
      { key: 'chaos', name: '혼돈곡괭이', dmg: 54, rate: 303, reach: 117, depth: 450,
        forge: 'black', sheet: 10, color: 0x80deea,
        detail: '어디에 박힐지 모릅니다',
        lore: '휘두를 때마다 무게가 다르게 느껴집니다.',
        icon: { art: 'pick', hw: 7.44, len: 0.78 } },
      { key: 'sky', name: '천공곡괭이', dmg: 56, rate: 295, reach: 120, depth: 500,
        forge: 'silver', sheet: 11, color: 0xce93d8,
        detail: '가장 깊이 박힙니다',
        lore: '탑의 어느 벽이든 한 번은 들어간다는 말이 있습니다.',
        icon: { art: 'pick', hw: 7.78, len: 0.81 } },
      { key: 'nameless', name: '무명괭이', dmg: 15, rate: 380, reach: 81, depth: 120,
        sheet: 0, color: 0x9e9e9e, plusMax: 50, plusStep: 0.316,
        detail: '맨몸은 약합니다. 대신 +1 을 쉰까지 받습니다',
        lore: '이름이 없습니다. 누가 만들었는지도, 몇 사람의 손을 거쳤는지도.',
        icon: { art: 'pick', hw: 3.90, len: 0.52 } },
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
