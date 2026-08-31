// 유물.
//
// 200층부터 100층 구간마다 하나씩 놓입니다. 밟으면 게임이 멈추고 세 장이
// 펼쳐집니다 — 그중 하나만 가져갑니다. 한 판에 여러 개를 겹쳐 쓸 수 있고,
// UP을 먹어도 사라지지 않습니다.
//
// 예전에는 직업마다 하나뿐이었고 38층부터 나왔습니다. 너무 이르고, 너무 셌고,
// 무엇보다 고를 것이 없었습니다. 지금은 종류를 늘리고 자리를 뒤로 미뤘습니다.
//
// jobs 가 있으면 그 직업에게만 나옵니다. 없으면 셋 다에게 나옵니다.
// 아래 필드들이 실제 효과입니다 — weapon.js 와 scene-game.js 가 읽습니다.
//
//   reachScale   근접 사거리 배수
//   bounce       화살이 튕기는 횟수
//   stealBonus   절도 확률 가산 · stealAmount 절도 액수 가산
//   capBonus     공격 속도 한계 가산
//   wave         벨 때마다 날아가는 파동 (근접 전용)
//   reflect      적 투사체를 튕겨낼 확률
//   lifesteal    준 피해의 이 비율만큼 회복
//   thorns       접촉한 적에게 돌려주는 피해 (내가 맞은 피해 대비)
//   coinBonus    코인 획득 배수 가산
//
//   needsArmor      갑옷을 입는 직업(usesArmor)에게만 보임
//   oilFamily       같은 값을 가진 것끼리는 한 자리를 나눠 씀 (새로 고르면 전에 것이 벗겨짐)
//   pierceOil       화살이 이 수만큼 더 뚫고 나감
//   executeMul       남은 체력이 낮은 적에게 곱하는 배수 (CFG.relicFx.executionerHp 아래)
//   firstStrikeMul   그 적에게 넣는 첫 대에만 곱하는 배수
// 그 밖의 스물한 가지(투명망토·탑은 둥글다 등)는 이름만으로 키를 찾아
// scene-game.js·enemies.js 가 `weapon.hasRelic(key)` 로 직접 묻습니다 —
// 값이 하나뿐이거나 자리마다 손질이 달라서 공통 필드로 묶기보다 그때그때
// 코드에서 다룹니다. 자세한 동작은 CFG.relicFx (js/config.js) 를 보세요.
const RELICS = [
  {
    key: 'waveblade', name: '파동검', icon: '≋',
    desc: '다섯 번에 한 번 파동이 날아갑니다',
    detail: '적을 쫓지 않고 휘두른 쪽으로만 갑니다',
    jobs: ['warrior', 'rogue'], // 원거리 직업에게는 뜻이 없습니다
    // 벨 때마다 나가고 본체의 55%였습니다. 그러면 근접이 사실상 원거리가 되어
    // 유물 하나로 직업이 바뀝니다. 다섯 번에 한 번(CFG.waveEvery) · 절반으로 낮췄습니다.
    wave: 0.28, // 파동 피해는 본체 공격의 이만큼
  },
  {
    key: 'mirrorplate', name: '반사 갑옷', icon: '◇',
    desc: '날아오는 것을 튕겨냅니다',
    detail: '적의 투사체를 절반쯤 되돌려 보냅니다',
    reflect: 0.5,
  },
  {
    key: 'bloodcloak', name: '흡혈 망토', icon: '❦',
    desc: '준 피해의 일부를 회복합니다',
    detail: '깎은 체력의 2.5%, 초당 최대 체력의 3%까지',
    // 5%였습니다. 보스전에서 거의 죽지 않는다는 말이 나왔습니다.
    //
    // 비율만 낮추는 것으로는 모자랍니다. 피해는 층을 오를수록 곱으로 자라는데
    // 최대 체력은 그렇지 않아서, 위층에서는 한 대만 넣어도 체력이 가득 찹니다.
    // 그래서 뚜껑을 함께 씌웠습니다. 처음에는 **한 대당**이었는데, 그러면
    // 후반에는 늘 뚜껑에 닿아서 실제 회복량이 `뚜껑 × 초당 대수`가 됩니다 —
    // 도적이 초당 48%를 채웠습니다. 지금은 **초당 몫**입니다
    // (CFG.lifestealPerSec). 셋이 같은 회복량을 갖습니다.
    lifesteal: 0.025,
  },
  {
    key: 'thornmail', name: '가시 갑옷', icon: '✷',
    desc: '닿은 적에게 되돌려 줍니다',
    detail: '맞은 피해의 2.5배를 그 적에게',
    thorns: 2.5,
  },
  {
    key: 'swiftboots', name: '바람 각반', icon: '⟫',
    desc: '공격 속도 한계가 올라갑니다',
    detail: '한계 +0.4',
    capBonus: 0.4,
  },
  {
    key: 'coinpurse', name: '도둑의 주머니', icon: '◎',
    desc: '코인이 더 들어옵니다',
    detail: '획득량 +50%',
    coinBonus: 0.5,
  },
  // ── 직업 전용 ────────────────────────────────────────
  {
    key: 'farblade', name: '먼 그림자 검', icon: '✚',
    desc: '멀리 닿지만 끝이 무딥니다',
    detail: '사거리 1.5배, 멀수록 약해져 끝에서는 10%',
    jobs: ['warrior'],
    reachScale: 1.5, // 1.9였던 것을 낮췄습니다. 혼자서 판을 끝내던 값이었습니다
    // 그림자는 멀리 뻗을수록 옅어집니다. 코앞이면 100%, 사거리 끝이면 10%.
    //
    // 늘어난 사거리를 그대로 두고 피해만 깎은 이유가 있습니다. 이 유물의 값은
    // "닿는다"는 데 있지 "닿는 곳마다 똑같이 벤다"는 데 있지 않습니다. 멀리
    // 있는 놈을 긁어 두고 다가가서 끝내는 무기가 됩니다.
    falloff: 0.1,
  },
  {
    key: 'echobow', name: '메아리 활', icon: '↺',
    desc: '화살이 다른 적에게 튕깁니다',
    detail: '한 번 더 튕겨 나갑니다',
    jobs: ['archer'],
    bounce: 1,
  },
  {
    key: 'goblinglove', name: '고블린의 장갑', icon: '✋',
    desc: '훔칠 확률과 액수가 늡니다',
    detail: '확률 +25% · 액수 +2',
    jobs: ['rogue'],
    stealBonus: 0.25,
    stealAmount: 2,
  },

  // ── 새로 늘어난 스물하나 ────────────────────────────────
  //
  // 아홉은 전부 "때리는 값"이나 "버티는 값"을 만졌습니다. 유물을 서른 개로
  // 늘리면서 비어 있던 자리를 먼저 채웠습니다 — 오르는 동안의 판단(투명망토·
  // 탑은 둥글다·로켓장화), 진짜/가짜를 아는 것(혜안), 판단 없이 도는 것
  // (도깨비불), 위기에 강해지는 것(위기는 기회다) — 지금까지 하나도 없던
  // 결입니다.
  //
  // **기름 셋(관통하는·뜨거운·차가운)은 겹쳐 쓸 수 없습니다.** `oilFamily`
  // 로 묶어 두고, 새 기름을 고르면 scene-game.js 의 takeRelic 이 전에 바른
  // 것을 벗겨 냅니다 — 자리 하나를 두고 세 결 중 하나를 고르는 것입니다.
  //
  // 밸런스는 첫 판입니다. 서른 개를 한꺼번에 등록하고, 재는 것은 다음 손질로
  // 미뤘습니다.

  // ── 오르는 것 ────────────────────────────────────────
  {
    key: 'invisijump', name: '투명망토', icon: '◌',
    desc: '점프하는 동안 적이 나를 못 봅니다',
    detail: '이미 날아온 화살과 전류는 그대로 맞습니다',
  },
  {
    key: 'roundtower', name: '탑은 둥글다', icon: '⊙',
    desc: '바깥으로 뛰면 반대쪽 끝으로 넘어갑니다',
    detail: '왼쪽 끝에서 왼쪽으로 뛰면 위층 오른쪽 끝에 섭니다',
  },
  {
    key: 'quietwake', name: '고요한 걸음', icon: '☾',
    desc: '위층 적이 조금 늦게 깨어납니다',
    detail: '올라선 순간 바로 달려들지 않습니다',
  },
  {
    key: 'rocketboots', name: '로켓장화', icon: '⇑',
    desc: '가운데를 길게 누르면 두 칸을 한 번에 뜁니다',
    detail: '짧게 누르면 평소처럼 한 칸입니다',
  },
  {
    key: 'sandoftime', name: '시간의 모래', icon: '⧗',
    desc: '적 전체가 조금 느려집니다',
    detail: '이동·공격 속도 -10% (보스는 안 듣습니다)',
  },

  // ── 아는 것 ──────────────────────────────────────────
  {
    // 천리안(千里眼)과 짝이 되라고 「혜안(慧眼)」입니다 — 둘 다 `-안(眼)`으로
    // 끝나야 상점의 천리안과 한 쌍으로 읽힙니다. 처음에는 「참눈」이었는데
    // 지어낸 말이라 그 짝이 안 맞았습니다.
    //
    // **열쇠(trueeye)는 그대로 둡니다.** 유물 도감에 모은 기록이 이 열쇠로
    // 저장되어 있어서(Save.data.relics), 열쇠를 바꾸면 이미 만난 사람의
    // 도감이 「아직 만나지 못했습니다」로 되돌아갑니다.
    key: 'trueeye', name: '혜안', icon: '☉',
    desc: '가짜가 훨씬 멀리서부터 드러납니다',
    detail: '천리안이 「어디」라면 혜안은 「진짜인지」입니다',
  },

  // ── 때리는 것 ────────────────────────────────────────
  {
    key: 'willowisp', name: '도깨비불', icon: '❂',
    desc: '주인공 곁을 도는 불꽃이 스치는 적을 태웁니다',
    detail: '겨누지 않아도 닿으면 들어갑니다',
  },
  {
    key: 'executionermark', name: '처형인의 표식', icon: '☠',
    desc: '체력이 많이 깎인 적에게 크게 들어갑니다',
    detail: '남은 체력 25% 아래인 적에게 두 배',
    executeMul: 2,
  },
  {
    key: 'firststrike', name: '초전박살', icon: '⚡',
    desc: '그 적에게 넣는 첫 대가 셉니다',
    detail: '처음 한 대만 세 배 — 그다음부터는 평소대로',
    firstStrikeMul: 3,
  },
  {
    key: 'piercingoil', name: '관통하는 기름', icon: '➳', oilFamily: 'oil',
    // 「화살이 하나를 뚫고」였습니다. 공용 유물인데 활을 쓰지 않는 넷에게는
    // 글도 효과도 헛돌았습니다 — 근접판을 만들면서 글도 둘 다 담습니다
    // (근접에서 어떻게 도는지는 CFG.relicFx.piercingoil).
    desc: '앞의 하나를 뚫고 뒤의 하나까지 닿습니다',
    detail: '화살도 휘두름도 하나 더 · 기름은 하나만 바릅니다',
    pierceOil: 1,
  },
  {
    key: 'hotoil', name: '뜨거운 기름', icon: '♨', oilFamily: 'oil',
    // 「벤 적이」였습니다. 기름은 자루에 바르는 것이라 화살에도 묻습니다
    // (scene-game.js 의 applyOil 은 근접과 화살 둘 다에서 불립니다).
    desc: '맞은 적이 잠깐 불타며 조금씩 더 깎입니다',
    detail: '타는 적은 붉게 보입니다 · 기름은 하나만 바릅니다',
  },
  {
    key: 'coldoil', name: '차가운 기름', icon: '❄', oilFamily: 'oil',
    desc: '맞은 적이 잠깐 느려집니다',
    detail: '언 적은 파랗게 보입니다 · 기름은 하나만 바릅니다',
  },

  // ── 버티는 것 ────────────────────────────────────────
  {
    key: 'secondheart', name: '두 번째 심장', icon: '♡',
    desc: '최대 체력을 올리는 물건이 더 크게 듭니다',
    detail: '상점 「단단한 몸」이 +25 대신 +40',
  },
  {
    key: 'ironskin', name: '강철 살갗', icon: '⛨', needsArmor: true,
    desc: '방어력이 훨씬 천천히 닳습니다',
    detail: '닳는 속도 80% 감소',
  },
  {
    key: 'dragonscale', name: '용 비늘 투구', icon: '⛊',
    desc: '보스에게 받는 피해가 줄어듭니다',
    detail: '보스 공격 -50% · 졸개에게는 안 듣습니다',
  },
  {
    key: 'blackiron', name: '흑철갑옷', icon: '▦', needsArmor: true,
    desc: '방어 한계가 오르는 대신 뛰기가 느려집니다',
    detail: '방어 한계 +50% · 점프가 40% 더디어집니다',
  },
  {
    key: 'crisis', name: '위기는 기회다', icon: '☯',
    desc: '체력이 반 아래로 내려가면 오히려 강해집니다',
    detail: '받는 피해 -30% · 공격 속도 +20%',
  },

  // ── 버는 것 · 판을 바꾸는 것 ──────────────────────────
  {
    key: 'goldhand', name: '황금 손', icon: '☞',
    desc: '코인이 훨씬 멀리서부터 끌려옵니다',
    detail: '보이는 코인이 모두 끌려옵니다 (평소에는 바로 옆만)',
  },
  {
    key: 'tiltedscale', name: '기울어진 저울', icon: '⚖',
    desc: '상점 값이 쌉니다',
    detail: '-40%',
  },
  {
    key: 'purplemedal', name: '보라빛 메달', icon: '⊛',
    desc: '보스를 넘길 때마다 메달을 하나씩 받습니다',
    // 이 판에서 번 메달은 죽을 때 「메달 받기」를 골라야 남습니다.
    // 「이어서 진행」을 고르면 통째로 버려집니다 (buildDeathChoices).
    detail: '죽을 때 「메달 받기」를 골라야 남습니다',
  },
  {
    key: 'mirrorshard', name: '거울 조각', icon: '◆',
    desc: '보스에게 처음 맞는 한 대를 그대로 돌려줍니다',
    detail: '그 싸움에서 한 번뿐입니다',
  },
  // ── 새 직업 다섯의 전용 유물 ──────────────────────────────
  // 전용 유물은 **그 직업의 알맹이를 키웁니다.** 새 수단을 주는 것이 아니라
  // 이미 있는 축을 밉니다 — 먼 그림자 검이 전사의 사거리를, 메아리 활이
  // 궁수의 「여럿을 노림」을, 고블린의 장갑이 도적의 절도를 키우듯이.

  {
    key: 'backhand', name: '뒷손', icon: '✊',
    desc: '열 번째 한 대가 사거리 안 전체에 들어갑니다',
    detail: '다 찬 한 대가 사거리 안 모두에게',
    jobs: ['monk'],
    // 권법사의 결정은 지금 「열 번째를 큰 놈에게」 하나뿐입니다. 이것이
    // 붙으면 **「열 번째를 몰려 있을 때 쓸까」**가 더해집니다 — HUD 의 점
    // 열 개가 갑자기 훨씬 중요해집니다.
    backhand: 1,
  },
  {
    key: 'huntmark', name: '사냥꾼의 표식', icon: '◎',
    desc: '곰이 문 적을 먼저 겨누고 크게 맞힙니다',
    detail: '곰이 문 적을 먼저 노리고 1.5배로',
    jobs: ['hunter'],
    // **우선 겨눔이 없으면 이 유물은 거의 아무 일도 안 합니다.** 이 게임에는
    // 겨누기가 없어서(탭하면 가까운 것부터 자동으로 맞힙니다) 곰이 문 적을
    // 맞히는 것이 우연이 됩니다. 표식과 겨눔은 한 벌입니다.
    huntMarkMul: 1.5,
  },
  {
    key: 'undying', name: '썩지 않는 것', icon: '☠',
    desc: '부하가 더 오래 버팁니다',
    detail: '부하의 체력 2배',
    jobs: ['necro'],
    // **안 죽게 하는 것이 아닙니다.** 안 죽으면 강한 적 앞에서 약한 아군을
    // 달고 싸우는 판이 됩니다 — 그건 더 나쁩니다. 잘 안 삭게 할 뿐입니다.
    thrallHpMul: 2,
  },
  {
    key: 'spring', name: '마르지 않는 샘물', icon: '≈',
    desc: '지팡이에 걸린 것이 세집니다',
    detail: '화상·관통 1.5배, 보호막 1.25배',
    jobs: ['wizard'],
    // 어느 지팡이를 들든 **그 지팡이가** 세집니다. 고른 것을 밀어 주는
    // 쪽이라 「고르는 것이 곧 성격」과 맞물립니다.
    //
    // 보호막만 따로 1.25 입니다. 받는 피해를 **나누는** 값이라 1.5 를 곱하면
    // 수호의 지팡이가 1.3 → 1.95 가 되어 절반 아래로 떨어집니다.
    springMul: 1.5,
    springShieldMul: 1.25,
  },
  {
    key: 'heavier', name: '많이 질수록', icon: '▲',
    desc: '유물을 든 수만큼 세집니다',
    detail: '지닌 유물 하나당 공격력 +6% (이것도 셉니다)',
    jobs: ['digger'],
    // 도굴꾼의 다섯 칸은 지금 「많이 들 수 있다」일 뿐 그 자체가 세기는
    // 아닙니다. 이것이 붙으면 **칸을 채우는 것이 곧 강해지는 것**이 됩니다.
    // 자기도 세므로 다섯째 칸에 들면 +30% 입니다.
    heavierStep: 0.06,
  },

];

function relicByKey(key) {
  return RELICS.find((r) => r.key === key) || null;
}

// 그 직업이 얻을 수 있는 것들.
//
// needsArmor 는 갑옷을 입는 직업(usesArmor)에게만 나옵니다. 도적처럼 갑옷이
// 없는 직업에게 「방어력」을 만지는 유물을 보여 줘 봐야 고를 이유가 없는
// 유물이 하나 자리만 차지합니다 (js/medals.js 의 medalItemsFor 와 같은 규칙).
function relicsFor(jobKey) {
  const job = classByKey(jobKey);
  return RELICS.filter((r) => (!r.jobs || r.jobs.includes(jobKey))
    && (!r.needsArmor || (job && job.usesArmor)));
}

// 펼쳐 보일 세 장. 이미 들고 있는 것은 빼고 무작위로 뽑습니다.
// 후보가 셋보다 적으면 있는 만큼만 보여 줍니다.
function rollRelicChoices(jobKey, held, count = 3) {
  const pool = relicsFor(jobKey).filter((r) => !held.some((h) => h.key === r.key));
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}
