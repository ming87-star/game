package com.projectjhs.whileclimbing;

import android.annotation.SuppressLint;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

/**
 * 게임은 통째로 WebView 안에서 돕니다.
 *
 * assets/game.html 한 장에 그림·소리·코드가 다 들어 있습니다 (build.js 가
 * 만든 dist/index.html 을 make-android.js 가 옮겨 놓습니다). 인터넷이 없어도
 * 처음부터 끝까지 돌아갑니다 — 네트워크는 순위표·업적에만 씁니다.
 *
 * 이 파일이 하는 일은 셋뿐입니다.
 *   1. WebView 를 전체 화면으로 띄우고 그 한 장을 엽니다
 *   2. 「뒤로」를 게임에게 물어봅니다
 *   3. 순위표·업적 다리(GamesBridge)를 JS 쪽에 물립니다
 */
public class MainActivity extends AppCompatActivity {

    private WebView web;
    private GamesBridge games;
    private long 뒤로누른때 = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        // **이 줄이 없으면 저장이 통째로 안 남습니다.** 게임의 기록은 전부
        // localStorage 에 있습니다 (js/save.js).
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        // 손가락으로 확대되면 안 됩니다 — 탭으로 노는 게임이라 두 손가락이
        // 스치기만 해도 화면이 어긋납니다.
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);   // 소리는 첫 손길에 깨웁니다

        // 노치와 아래 막대까지 덮습니다. 게임은 540×960 을 화면에 맞춰
        // 늘리므로(Phaser.Scale.FIT) 남는 자리는 어차피 같은 색입니다.
        전체화면으로();

        games = new GamesBridge(this);
        // JS 쪽 이름은 **AndroidGames** 입니다. js/games.js 가 이 이름을 찾습니다.
        web.addJavascriptInterface(games, "AndroidGames");

        web.loadUrl("file:///android_asset/game.html");

        // ── 뒤로 ────────────────────────────────────────────
        //
        // **게임에게 먼저 물어봅니다.** 탑에서 뒤로를 누르면 앱이 닫히는 것이
        // 아니라 멈춤 창이 떠야 합니다 — 오르던 판이 통째로 날아가는 것이
        // 안드로이드에서 가장 흔한 원망입니다.
        //
        // 게임이 「내가 처리했다」(true)고 하면 여기서는 아무것도 안 합니다.
        // 타이틀처럼 물러설 데가 없는 자리에서만 거짓이 오고, 그때 두 번
        // 누르면 나갑니다.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                web.evaluateJavascript(
                    "(function(){try{return !!(window.__androidBack && window.__androidBack());}"
                        + "catch(e){return false;}})()",
                    value -> {
                        if ("true".equals(value)) return;   // 게임이 처리했습니다
                        long 이제 = System.currentTimeMillis();
                        if (이제 - 뒤로누른때 < 2000L) {
                            finish();
                        } else {
                            뒤로누른때 = 이제;
                            Toast.makeText(MainActivity.this, R.string.back_again, Toast.LENGTH_SHORT).show();
                        }
                    });
            }
        });
    }

    private void 전체화면으로() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (has) 전체화면으로();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (games != null) games.깨우기();
    }

    @Override
    protected void onPause() {
        // **판을 멈춰 둡니다.** 전화가 오면 탑 위의 사람이 그대로 서서
        // 맞고 있습니다.
        if (web != null) {
            web.evaluateJavascript(
                "(function(){try{var s=window.__scene;"
                    + "if(s&&s.pauseGame)s.pauseGame();}catch(e){}})()", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
