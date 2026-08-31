// 엔딩만 눌러 보기 위한 **뒷문**.
//
//   주소 끝에            무엇이 열리나
//   ────────────────────────────────────────────────────
//   #ending      열리는 순간부터 — 마흔일곱 개를 사 두고 하나만 남깁니다.
//                메달 상점에서 남은 한 칸을 사면 그 자리에서 시작합니다
//   #ending2     보는 장면부터 — 타이틀을 누르면 곧바로 여는 말
//   #ending3     마지막 판만 (8~11번)
//   #restore     원래 기록으로 되돌리기
//
// ── 왜 콘솔이 아니라 주소인가 ───────────────────────────
// 이 시퀀스를 손으로 보려면 메달 마흔여덟 개를 다 사야 합니다. 그래서 저장을
// 손으로 세워 놓고 들어가는데, 그 방법이 콘솔에 코드를 붙여 넣는 것뿐이면
// **휴대폰에서는 아예 못 봅니다.** 정작 이 게임은 휴대폰으로 하는 게임입니다.
//
// ── 기록은 저절로 백업합니다 ────────────────────────────
// 뒷문 하나가 「여태 쌓은 것을 말없이 지우는 단추」가 되면 안 됩니다. 세우기
// 전에 지금 기록을 따로 넣어 두고, 타이틀에 되돌리는 길을 적어 둡니다.
// 이미 세워 둔 판에서 또 들어가도 **처음 백업은 안 덮습니다** — 안 그러면
// 두 번째에 진짜 기록이 사라집니다.
const DEV_BACKUP = 'tower-climb-v1-backup';

function devDoor() {
  const 문 = (location.hash || '').replace(/^#/, '');
  if (!문) return;

  if (문 === 'restore') {
    const 옛 = localStorage.getItem(DEV_BACKUP);
    if (!옛) { console.log('되돌릴 기록이 없습니다'); return; }
    localStorage.setItem('tower-climb-v1', 옛);
    localStorage.removeItem(DEV_BACKUP);
    return 나가기();
  }
  if (문 !== 'ending' && 문 !== 'ending2' && 문 !== 'ending3') return;

  const d = Save.data;
  // 세워 둔 판에서 또 들어온 것이면 처음 백업을 지킵니다
  if (!d.devSeeded) localStorage.setItem(DEV_BACKUP, JSON.stringify(d));

  d.devSeeded = true;
  d.sawStory = true;
  d.unlocked = { archer: 1, rogue: 1, monk: 1, necro: 1, digger: 1, wizard: 1, hunter: 1 };

  if (문 === 'ending') {
    // 마흔여덟 개 중 마흔일곱. 마지막 하나는 사람이 직접 사야 합니다 —
    // 여는 조건과 대사가 맞물리는 자리가 거기입니다.
    let 끝 = null;
    CLASSES.forEach((j) => medalItemsFor(j).forEach((it) => { 끝 = [j.key, it.key]; }));
    d.perks = {};
    CLASSES.forEach((j) => medalItemsFor(j).forEach((it) => {
      if (j.key === 끝[0] && it.key === 끝[1]) return;
      Save.perksFor(j.key)[it.key] = true;
    }));
    d.medals = 99;
    d.endingStage = 0;
    d.sawEnding = false;
    d.lastJob = 끝[0];
    d.devLeft = 끝;          // 타이틀이 「무엇이 남았는지」를 알려 줍니다
  } else {
    d.endingStage = 1;
    d.sawEnding = 문 === 'ending3';   // ending2 는 못 본 것으로 두어 보는 장면부터
    d.devLeft = null;
  }
  Save.flush();
  나가기();
}

// 주소에서 문을 떼고 다시 켭니다. 안 떼면 새로고침마다 저장이 도로 세워져서,
// **판을 하다 새로고침한 사람의 기록이 계속 날아갑니다.**
function 나가기() {
  location.replace(location.pathname + location.search);
}

devDoor();
