// 새 직업 다섯의 **수치 초안**입니다. 아직 게임에 안 붙습니다.
//
//   node job-scale.js --draft
//
// ── 왜 따로 두는가 ──────────────────────────────────────
// 직업 하나를 게임에 붙이려면 자루 열둘에 이름·설명·만듦새·그림이 다 붙어야
// 합니다. 그런데 **정해야 하는 것은 그 앞의 숫자 몇 개**입니다 — 체력, 막는
// 값, 속도 한계, 그리고 자루 곡선의 시작과 끝.
//
// 이름 예순 개를 먼저 짓고 나서 "역시 도굴꾼이 너무 세네" 하면 그 예순 개를
// 도로 만져야 합니다. **숫자를 먼저 맞춰 놓고** 살을 붙입니다.
//
// ── 자루 열둘은 곡선으로 냅니다 ─────────────────────────
// 지금 셋을 재 보니 자루 열둘이 전부 같은 사다리를 씁니다 —
// depth 0·40·80·120·160·200·250·300·350·400·450·500. dmg 는 늘고 rate 는
// 줄어드는 매끈한 곡선이고, acc·spread 만 군데군데 튑니다(만듦새의 결).
//
// 그래서 초안에서는 **양 끝만 정합니다.** 가운데는 곧게 잇습니다. 살을 붙일
// 때 acc·spread 를 흔들어 만듦새를 넣으면 되고, 그건 초당 피해의 **한가운데**를
// 거의 안 움직입니다 (job-scale 이 보는 것이 그 한가운데입니다).

const DEPTHS = [0, 40, 80, 120, 160, 200, 250, 300, 350, 400, 450, 500];

// 양 끝을 주면 열둘을 곧게 이어 냅니다.
function ladder(a, b) {
  return DEPTHS.map((_, i) => a + (b - a) * (i / (DEPTHS.length - 1)));
}

// 초안 하나를 진짜 직업 꼴로 폅니다 (job-scale 이 읽는 모양).
function expand(d) {
  const dmg = ladder(d.dmg[0], d.dmg[1]);
  const rate = ladder(d.rate[0], d.rate[1]);
  const reach = ladder(d.reach[0], d.reach[1]);
  const shots = d.shots ? ladder(d.shots[0], d.shots[1]) : null;
  return Object.assign({}, d, {
    weapons: DEPTHS.map((depth, i) => ({
      key: d.key + i,
      name: d.name + (i + 1),
      dmg: Math.round(dmg[i]),
      rate: Math.round(rate[i]),
      depth,
      acc: 0.92,
      spread: 0.18,
      dmgMin: Math.round(dmg[i] * 0.82),
      dmgMax: Math.round(dmg[i] * 1.18),
      shots: shots ? Math.max(1, Math.round(shots[i])) : 1,
      [d.attack === 'ranged' ? 'range' : 'reach']: Math.round(reach[i]),
    })),
  });
}

// ── 다섯 ────────────────────────────────────────────────
//
// ── 왜 「보정」을 안 두는가 ──────────────────────────────
// 처음에는 직업마다 「표에 안 잡히는 이득」을 짐작해서 점수를 깎았습니다.
// 그런데 **깎는 값도 제가 정하고 수치도 제가 정하면 어떤 답이든 나옵니다.**
// 사령술사가 낮으면 부하 값을 올리면 되고, 높으면 내리면 됩니다. 그건 재는
// 것이 아니라 맞추는 것입니다.
//
// 그래서 거꾸로 갑니다. **수치는 성격에서만 정하고**, 표에 안 잡히는 이득은
// 「도적과 같아지려면 몇 배여야 하는가」를 **셈이 내놓게** 합니다. 그러면
// 답이 이렇게 나옵니다 —
//
//   「부하 셋이 실제로 1.9배어치라면 이 수치가 맞습니다」
//
// 1.9배가 말이 되는지는 사람이 판단할 일이고, 말이 안 되면 **그때 수치를
// 고칩니다.** 짐작을 숫자 뒤에 숨기지 않고 앞에 내놓는 쪽입니다.
//
// 아래 수치는 전부 **그 직업이 무엇인가**에서만 나왔습니다.
const DRAFT = [
  {
    key: 'monk', name: '권법사', color: 0xffd54f,
    // **맨손입니다.** 한 대가 여덟 중 가장 가볍고 가장 빠릅니다. 사거리도
    // 가장 짧습니다. 도복 한 겹이라 막는 것은 얇습니다.
    hp: 190, armor: 15, armorMax: 45, usesArmor: true,
    dodge: 0, dodgeMax: 0, steal: 0,
    speedCap: 2.60, plusScale: 1, attack: 'melee', relicMax: 2,
    dmg: [30, 44], rate: [200, 130], reach: [58, 88],
    표에안잡힘: '연타가 쌓이면 세집니다',
  },
  {
    key: 'hunter', name: '곰사냥꾼', color: 0xbcaaa4,
    // 곰이 앞서 갑니다. 본인 활은 **궁수보다 느리고 한 발이 무겁습니다.**
    // 털가죽을 둘렀으니 막는 것은 전사 다음입니다.
    hp: 225, armor: 32, armorMax: 72, usesArmor: true,
    dodge: 0, dodgeMax: 0, steal: 0,
    speedCap: 1.70, plusScale: 1, attack: 'ranged', relicMax: 2,
    // shots 를 1→2 로 두었더니 **여섯 번째 자루에서 초당 피해가 한 번에
    // 두 배로 뜁니다** (반올림이라 1,1,1,1,1,2,2… 로 계단이 집니다).
    // 층에 따라 점수가 58~125 로 흔들렸습니다. 한 발을 무겁게 두는 쪽이
    // 「궁수보다 느리고 한 발이 무겁다」와도 맞습니다.
    dmg: [55, 78], rate: [420, 320], reach: [280, 420],
    표에안잡힘: '곰이 앞서 올라가 먼저 잡습니다',
  },
  {
    key: 'necro', name: '사령술사', color: 0x4db6ac,
    // **여덟 중 가장 얇습니다.** 죽은 적 셋이 대신 싸우는 만큼 본인은 약합니다.
    hp: 155, armor: 18, armorMax: 45, usesArmor: true,
    dodge: 0, dodgeMax: 0, steal: 0,
    speedCap: 1.90, plusScale: 1, attack: 'ranged', relicMax: 3,
    dmg: [36, 52], rate: [330, 245], reach: [270, 400],
    표에안잡힘: '죽은 적 셋이 따라다니며 같이 때립니다',
  },
  {
    key: 'wizard', name: '마법사', color: 0x4fc3f7,
    // 자루마다 나가는 투사체가 다릅니다 — **고르는 것이 곧 성격**입니다.
    // 로브 한 겹. 몸은 얇지만 사령술사보다는 낫습니다.
    hp: 175, armor: 22, armorMax: 58, usesArmor: true,
    dodge: 0, dodgeMax: 0, steal: 0,
    speedCap: 2.00, plusScale: 1, attack: 'ranged', relicMax: 2,
    dmg: [46, 68], rate: [350, 255], reach: [300, 450],
    표에안잡힘: '자루마다 투사체가 달라 상황을 고를 수 있습니다',
  },
  {
    key: 'digger', name: '도굴꾼', color: 0xd4e157,
    // **유물을 다섯 듭니다.** 그 대신 맨몸이 여덟 중 가장 약합니다.
    // 곡괭이는 느리고 무겁습니다.
    hp: 155, armor: 16, armorMax: 42, usesArmor: true,
    dodge: 0, dodgeMax: 0, steal: 0,
    speedCap: 1.60, plusScale: 1, attack: 'melee', relicMax: 5,
    dmg: [44, 64], rate: [370, 285], reach: [86, 120],
    표에안잡힘: '유물을 다섯 듭니다 (나머지는 둘~셋)',
  },
];

// ── 유물 칸은 세기입니다 ────────────────────────────────
// 유물 서른 개를 훑어보니 **열여덟쯤이 초당 피해나 실질 체력을 직접 올립니다.**
// 도깨비불(둘 × 0.22 몫 × 2틱/초)이 +30% 언저리, 초전박살(첫 대 ×3)이 +50%
// 언저리, 강철 살갗(방어 닳는 속도 ×0.2)이 +30~50% 언저리입니다. 나머지 열둘은
// 편의·경제라 이 자에 안 걸립니다.
//
// 그래서 **한 칸당 대략 +18%** 로 봅니다 (걸리는 것 여섯에 안 걸리는 것 넷을
// 섞은 어림). 도적을 2칸으로 놓고 그 차이만큼 곱합니다.
//
// **이것도 짐작입니다.** 다만 짐작을 적어 두고 곱하는 쪽이, 안 세고 넘어가서
// 도굴꾼이 유물 다섯을 든 채 남들과 같은 맨몸으로 서는 것보다 낫습니다.
const 칸값 = 1.18;
const 기준칸 = 2;

module.exports = { DRAFT, expand, 칸값, 기준칸 };
