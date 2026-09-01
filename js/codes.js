// 타이틀에서 넣는 **여섯 자리 코드**.
//
// 두 가지에 씁니다.
//   개발용   엔딩을 손으로 눌러 보기 (메달 마흔여덟 개를 다 안 사고도)
//   베타 보상 도와준 사람에게 무언가를 하나 주기
//
// ── 주소에 붙이던 방식을 걷어냈습니다 ───────────────────
// 예전에는 주소 끝에 `#ending` 을 붙였습니다. 손은 편했지만 **의도 없이도
// 열립니다** — 주소를 잘못 만지면 저장이 통째로 세워지고, 그걸 되돌리려고
// 백업까지 따로 떠야 했습니다. 코드는 여섯 자리를 눌러야 하므로 우연히
// 열릴 일이 없고, 나중에 보상으로 쓸 자리도 같이 생깁니다.
//
// ── 저장을 안 건드립니다 ────────────────────────────────
// 그래서 백업도, 되돌리기도 없습니다. 엔딩 코드는 **미리보기**로 돌아서
// 기록에 아무것도 안 적습니다. 주소 방식이 저장을 세워야 했던 것과 다릅니다.
//
// ── 이 코드들은 비밀이 아닙니다 ─────────────────────────
// 저장소가 공개고 게임은 파일 한 장입니다. 뒤지면 나옵니다. 여기서 막으려는
// 것은 **우연히 열리는 일**이지 알아내는 사람이 아닙니다. 정말 감추려면
// 서버가 있어야 하는데 이 게임에는 없습니다 — 그러니 그런 척하지 않습니다.
//
// ── 하나 더할 때 ────────────────────────────────────────
// 아래 표에 한 줄 보태면 끝입니다. `once: true` 면 한 판에 한 번만 받습니다
// (js/save.js 의 usedCodes). 나중에 레어 무기나 펫 같은 것이 생기면 그때
// `run` 안에서 주면 됩니다 — 지금은 그 시스템이 없으므로 안 만듭니다.
const CODES = [
  {
    code: '330033',
    title: '엔딩 보기',
    // **기록을 안 건드립니다.** 보고 나면 타이틀로 돌아올 뿐입니다.
    note: '기록은 그대로 둡니다',
    run(scene) { scene.scene.start('endingline', { preview: true }); },
  },
  {
    code: '331133',
    title: '엔딩 보기 — 보는 장면부터',
    note: '여는 말을 건너뜁니다',
    run(scene) { scene.scene.start('endingwatch', { preview: true }); },
  },
  {
    code: '770077',
    title: '다음 사람이 열립니다',
    // 사슬의 **바로 다음 한 사람**만 엽니다 (js/classes.js 의 unlockBy).
    // 아무나 열어 주면 사슬이 뜻을 잃습니다 — 도와준 값으로 한 칸입니다.
    once: true,
    run() {
      const 다음 = CLASSES.find((j) => !classUnlocked(j) && j.unlockBy
        && classUnlocked(classByKey(j.unlockBy)));
      if (!다음) return { fail: '이미 다 열려 있습니다' };
      Save.unlock(다음.key);
      // 조사를 이름에 맞춥니다. 「궁수 이(가)」처럼 적으면 그 한 글자가
      // 화면에서 제일 먼저 눈에 띕니다 (js/classes.js 의 roParticle 과 같은 결).
      const 받침 = (다음.name.charCodeAt(다음.name.length - 1) - 0xac00) % 28 > 0;
      return { said: 다음.name + (받침 ? '이' : '가') + ' 열렸습니다' };
    },
  },
];

function codeFor(digits) {
  return CODES.find((c) => c.code === digits) || null;
}

// 코드를 씁니다. 돌려주는 것:
//   { ok:false, why:'없는 코드입니다' }        그런 코드가 없음
//   { ok:false, why:'이미 쓴 코드입니다' }      한 번짜리를 또 넣음
//   { ok:true, said:'…', 장면바뀜:true }        됐음
function redeemCode(scene, digits) {
  const c = codeFor(digits);
  if (!c) return { ok: false, why: '없는 코드입니다' };
  if (c.once && Save.usedCode(c.code)) return { ok: false, why: '이미 쓴 코드입니다' };

  const 결과 = c.run(scene) || {};
  if (결과.fail) return { ok: false, why: 결과.fail };
  if (c.once) Save.markCodeUsed(c.code);
  return { ok: true, said: 결과.said || c.title, 장면바뀜: !결과.said };
}
