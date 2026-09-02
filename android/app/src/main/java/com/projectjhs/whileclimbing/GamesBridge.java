package com.projectjhs.whileclimbing;

import android.app.Activity;
import android.webkit.JavascriptInterface;

import com.google.android.gms.games.AchievementsClient;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;

import java.util.HashMap;
import java.util.Map;

/**
 * 순위표와 업적 다리.
 *
 * js/games.js 의 Games.bridge 가 이 세 함수를 그대로 부릅니다:
 *   signedIn()  ·  submit(순위표이름, 값)  ·  unlock(업적이름)
 *
 * ── 여기서 지키는 것 하나 ────────────────────────────────
 * **어떤 일이 있어도 던지지 않습니다.** 로그인이 안 됐든, 콘솔에 아직
 * 등록을 안 했든, 인터넷이 끊겼든 — 게임은 그대로 굴러가야 합니다.
 * 순위표 때문에 판이 멈추면 그건 순위표가 게임을 망친 것입니다.
 * (JS 쪽도 같은 규칙으로 감싸 두었습니다 — 양쪽 다 막습니다.)
 *
 * ── 이름 짝짓기 ──────────────────────────────────────────
 * JS 는 'floor' · 'relic-all' 처럼 읽기 쉬운 이름을 씁니다. 구글은
 * 'CgkI...' 같은 긴 ID 를 줍니다. 그 짝은 res/values/strings.xml 에
 * 있고, 여기서 이름 → ID 로 옮깁니다. **콘솔에서 받기 전에는 비어
 * 있고, 비어 있으면 그냥 안 보냅니다.**
 */
public class GamesBridge {

    private final Activity 판;
    private final Map<String, String> 순위표이름 = new HashMap<>();
    private final Map<String, String> 업적이름 = new HashMap<>();
    private boolean 로그인됨 = false;

    public GamesBridge(Activity 판) {
        this.판 = 판;
        try {
            PlayGamesSdk.initialize(판);
        } catch (Throwable t) { /* 없는 기기에서도 게임은 돕니다 */ }

        순위표이름.put("floor", 판.getString(R.string.board_floor));
        순위표이름.put("coins", 판.getString(R.string.board_coins));

        업적("floor-100", R.string.deed_floor_100);
        업적("floor-500", R.string.deed_floor_500);
        업적("floor-1000", R.string.deed_floor_1000);
        업적("floor-2000", R.string.deed_floor_2000);
        업적("coins-1000", R.string.deed_coins_1000);
        업적("coins-3000", R.string.deed_coins_3000);
        업적("job-2", R.string.deed_job_2);
        업적("job-4", R.string.deed_job_4);
        업적("job-8", R.string.deed_job_8);
        업적("relic-1", R.string.deed_relic_1);
        업적("relic-10", R.string.deed_relic_10);
        업적("relic-all", R.string.deed_relic_all);
        업적("boss-1", R.string.deed_boss_1);
        업적("boss-all", R.string.deed_boss_all);
        업적("medal-1", R.string.deed_medal_1);
        업적("medal-24", R.string.deed_medal_24);
        업적("medal-all", R.string.deed_medal_all);
        업적("weapon-12", R.string.deed_weapon_12);
        업적("weapon-36", R.string.deed_weapon_36);
        업적("frog-1", R.string.deed_frog_1);
        업적("frog-10", R.string.deed_frog_10);
        업적("runs-50", R.string.deed_runs_50);
        업적("ending-saw", R.string.deed_ending_saw);
        업적("ending-done", R.string.deed_ending_done);
    }

    private void 업적(String 이름, int 자원) {
        업적이름.put(이름, 판.getString(자원));
    }

    /**
     * 조용히 로그인해 봅니다. 이미 Play Games 를 쓰는 사람은 창 하나 없이
     * 그대로 들어오고, 아닌 사람은 **아무 일도 안 일어납니다.**
     *
     * 처음 켠 사람에게 로그인 창부터 들이밀지 않습니다 — 이 게임은 계정
     * 없이도 처음부터 끝까지 다 할 수 있습니다.
     */
    public void 깨우기() {
        try {
            GamesSignInClient c = PlayGames.getGamesSignInClient(판);
            c.isAuthenticated().addOnCompleteListener(t ->
                로그인됨 = t.isSuccessful() && t.getResult() != null
                    && t.getResult().isAuthenticated());
        } catch (Throwable t) {
            로그인됨 = false;
        }
    }

    @JavascriptInterface
    public boolean signedIn() {
        return 로그인됨;
    }

    @JavascriptInterface
    public void submit(String 이름, double 값) {
        try {
            String id = 순위표이름.get(이름);
            if (!로그인됨 || id == null || id.isEmpty()) return;
            LeaderboardsClient c = PlayGames.getLeaderboardsClient(판);
            c.submitScore(id, (long) 값);
        } catch (Throwable t) { /* 판이 멈추면 안 됩니다 */ }
    }

    @JavascriptInterface
    public void unlock(String 이름) {
        try {
            String id = 업적이름.get(이름);
            if (!로그인됨 || id == null || id.isEmpty()) return;
            AchievementsClient c = PlayGames.getAchievementsClient(판);
            c.unlock(id);
        } catch (Throwable t) { /* 같음 */ }
    }
}
