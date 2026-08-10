// 씨앗을 심을 수 있는 난수.
//
// 밸런스를 잴 때 판마다 탑이 달라지면, 직업 사이의 차이가 운에 묻힙니다.
// 실제로 같은 설정에서 도적 다섯 판이 47~158층으로 흩어졌습니다 — 그 폭 안에서는
// 20~30층짜리 차이를 가려낼 수가 없습니다.
//
// 씨앗을 주면 같은 탑이 다시 만들어지므로, 세 직업을 같은 탑에 올려놓고
// 견줄 수 있습니다 (짝지어 비교). 씨앗을 안 주면 예전과 똑같이 매번 다른 탑입니다.
//
// 씨앗은 주소의 ?seed=123 이나 localStorage 의 tower-seed 로 줍니다.
// 게임 코드 곳곳의 Math.random 을 하나하나 고치는 대신 여기서 통째로 바꿔 끼웁니다 —
// 빠뜨린 자리가 생기면 그 자리만 운에 휘둘려서 재현이 깨지기 때문입니다.
(function seedRandom() {
  let seed = null;
  try {
    const q = new URLSearchParams(window.location.search).get('seed');
    seed = q !== null ? Number(q) : Number(window.localStorage.getItem('tower-seed'));
  } catch (e) {
    seed = null;
  }
  if (!seed || !isFinite(seed)) return; // 씨앗이 없으면 손대지 않습니다

  let a = seed >>> 0;
  Math.random = function mulberry32() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__seed = seed;
})();
