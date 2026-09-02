# 껍데기 — 안드로이드

게임은 통째로 WebView 안에서 돕니다. `assets/game.html` 한 장에 그림·소리·
코드가 다 들어 있고, **인터넷이 없어도 처음부터 끝까지 돌아갑니다.**
네트워크는 순위표·업적에만 씁니다.

> **이 폴더는 저장소에서 컴파일된 적이 없습니다.**
> 만든 환경에 안드로이드 SDK 가 없었고(`dl.google.com` 이 막혀 있습니다),
> 그래서 자바는 **한 줄도 컴파일해 보지 못했습니다.** 이름이 맞는지는
> `node verify-shell.js` 가 글로 맞춰 보지만, 그건 컴파일이 아닙니다.
> **처음 빌드할 때 오류가 나는 것을 정상으로 여기고 시작하세요.**

## Capacitor 를 안 쓴 까닭

이 게임은 오프라인으로 도는 HTML **한 장**입니다. Capacitor 의 자산
파이프라인이 살 것이 없고, 순위표는 공식 안드로이드 SDK 가 있어서
`Games.bridge`(`signedIn`/`submit`/`unlock`)가 `@JavascriptInterface`
클래스 하나에 1:1 로 붙습니다. 파일이 훨씬 적고, node·gradle 플러그인
사슬이 낡을 걱정이 없습니다.

## 빌드

```bash
# 1. 게임을 한 장으로 합치고 껍데기 안으로 옮깁니다
node build.js && node make-android.js

# 2. Android Studio 로 android/ 를 엽니다 (권함)
#    또는 명령줄에서:
cd android && ./gradlew assembleDebug
```

`make-android.js` 는 `dist/index.html` 이 `js/` 보다 **낡았으면 멈춥니다.**
안 그러면 고친 것이 안 들어간 채 폰에 깔리고, 「고쳤는데 그대로다」로
반나절을 씁니다.

Gradle 래퍼(`gradlew`)는 여기 없습니다. Android Studio 로 한 번 열면
저절로 만들어지고, 명령줄만 쓰시면 `gradle wrapper` 를 한 번 돌리세요.

## 서명 키 — **잃어버리면 그 앱을 영영 갱신 못 합니다**

```bash
keytool -genkeypair -v -keystore ~/오탑무-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias 오탑무
```

만든 `.jks` 와 비밀번호는 **이 저장소에 절대 넣지 마세요.** 대신
`~/.gradle/gradle.properties` 에 둡니다:

```properties
TOWER_STORE_FILE=/절대/경로/오탑무-release.jks
TOWER_STORE_PASSWORD=...
TOWER_KEY_ALIAS=오탑무
TOWER_KEY_PASSWORD=...
```

그리고 `app/build.gradle` 의 `release` 에 `signingConfig` 를 붙입니다.
(지금은 안 붙여 두었습니다 — 키가 없는 채로 `assembleRelease` 를 돌리면
무슨 일이 나는지가 헷갈리기 때문입니다.)

스토어에 올리는 것은 APK 가 아니라 **AAB** 입니다:
```bash
./gradlew bundleRelease      # app/build/outputs/bundle/release/app-release.aab
```

## 순위표·업적을 붙이는 순서

1. Play Console 에서 앱을 만듭니다 (패키지명 `com.projectjhs.whileclimbing`)
2. **Play Games Services → 구성** 에서 게임을 만듭니다 → **앱 ID** 가 나옵니다
3. 순위표 둘, 업적 스물넷을 등록합니다 (이름은 `js/games.js` 의 표 그대로)
4. 각각의 **긴 ID**(`CgkI…`)를 `res/values/strings.xml` 의 빈 칸에 채웁니다
5. OAuth 클라이언트를 만들 때 **서명 인증서의 SHA-1** 이 필요합니다:
   ```bash
   keytool -list -v -keystore ~/오탑무-release.jks -alias 오탑무
   ```

**채우기 전에도 게임은 그대로 돕니다.** 비어 있으면 `GamesBridge` 가 그냥
안 보냅니다.

## 스토어에 올리기 전에

- [x] **아이콘을 그림으로 바꿨습니다.** `assets/app-icon.png` 한 장이
      있으면 `gen-icon.js` 가 그것으로 굽습니다(없으면 SVG 도형으로).
      적응형 앞겹은 **칸을 꽉 채웁니다** — 66% 로 줄여 앉히면 마스크
      테두리에 뒷겹 색이 비쳐서 이음매가 보입니다.

      `assets/app-icon-night.png` 를 같이 두면 **어두운 모드용 한 벌**이
      `mipmap-*-night` 폴더에 따로 구워집니다. 테마 아이콘 칸
      (`<monochrome>`) 은 **일부러 비워 두었습니다** — 그 칸은 알파만 쓰고
      색은 시스템이 갈아 끼우므로 꽉 찬 그림을 물리면 덩어리가 됩니다.
      비워 두면 테마 아이콘을 켜도 그림이 그대로 나옵니다. 다만 런처가
      아이콘을 캐시하니 어두운 모드로 바꾸자마자 안 바뀔 수 있고,
      `-night` 를 아예 안 보는 런처도 있습니다(그럴 땐 낮 것이 나옵니다).

      다시 그릴 때는:

      ```
      GEMINI_API_KEY=... node gen-sprite.js app-icon   # 또는 PROVIDER=openai
      node gen-icon.js
      node verify-shell.js
      ```
- [ ] 서명 키를 만들고 **안전한 곳에** 둡니다
- [ ] `strings.xml` 의 Play Games ID 를 채웁니다
- [ ] 개인정보처리방침 주소가 살아 있는지 확인합니다

## 첫 실기 시험에서 꼭 볼 것

여기서 확인 못 한 것들입니다.

- [ ] **소리가 나는가** — 첫 손길에 깨우게 해 두었습니다 (`js/sound.js`)
- [ ] **뒤로 가기** — 탑에서 누르면 멈춤 창, 타이틀에서 두 번 누르면 나감
- [ ] **저장이 남는가** — 판을 하고 앱을 껐다 켜서 층수 확인
- [ ] **자동 백업** — 앱을 지웠다 다시 깔았을 때 기록이 돌아오는가
      (`backup_rules.xml`. WebView 의 localStorage 가 실제로 담기는지는
      문서로만 알고 있고 **재 본 적이 없습니다**)
- [ ] **첫 켬이 얼마나 걸리는가** — 헤드리스에서 3.6초, CPU 4배 늦추면
      7.4초였습니다. 실기는 다를 수 있습니다
- [ ] **노치와 아래 막대** — 전체 화면으로 덮게 해 두었습니다
- [ ] **판이 몇 프레임으로 도는가** — 헤드리스는 ~14fps 라 아무 뜻이 없습니다
