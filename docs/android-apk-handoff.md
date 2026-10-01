# 交接：用 Capacitor 包成 Android APK（第一階段）

> 建立於 2026-09-29。接手者（人或 AI Agent）請先讀完根目錄的 `CLAUDE.md`，特別是第 15 節（工作規則）、
> 第 17 節（技術決策）與第 4.1 節（爬塔挑戰）。本文件只描述這一階段要做的事；做完後把結果與新決策寫回 `CLAUDE.md`。

## 1. 目標與範圍

在一台 Windows + WSL2 的電腦上，把現有的網頁客戶端用 Capacitor 包成 Android debug APK，裝到實體手機試玩。

**完成條件**

- 在 WSL2 內一行指令產出 debug APK（例如 `npm run android:apk`），不需要 Android Studio 圖形介面。
- 手機安裝後開啟即是首頁；「爬塔挑戰」可以完整打完一層、進入下一層、失敗後「繼續」；開飛航模式也能玩（單機不需要網路）。
- 橫向、全螢幕（沒有狀態列與導覽列）、有音效、Android 返回鍵行為合理（見第 4 節 T5）。
- 最佳總分在關閉並重開 App 後仍在。
- 記錄實機型號與遊戲中的 fps（量法見 T8），寫進 `CLAUDE.md` 第 17.5 節。
- 網頁版與 GitHub Pages 部署不受影響；`npm run typecheck`、`npm test` 通過。

**不在這一階段**：正式簽章與上架、iOS、廣告與付費（`continueGate()` 維持直接放行）、正式的線上主機。

## 2. 已經定案的背景（不要重新討論）

- 技術路線是 Capacitor 包裝現有的 Three.js 網頁客戶端，不改用 Unity／Godot（`CLAUDE.md` 第 15、17 節）。理由：伺服器、單機、CPU、教學卡片共用 `packages/sim` 同一份 TypeScript 規則；換引擎要重寫規則並與伺服器維持兩份。畫面量很小（約 80 次繪製、7 千個三角形），WebView 的 WebGL2 足夠。
- 第一版上架只打算放單機的爬塔挑戰：完全離線，不需要伺服器。連線對戰需要正式的 `wss://` 主機，之後再做。
- 客戶端一直避免使用 WebView 不支援的 API（`CLAUDE.md` 第 17.1 節），資源路徑都經過 `import.meta.env.BASE_URL`，所以打包時 Vite 的 `base` 用預設的 `/` 即可（`apps/client/vite.config.ts` 讀 `BASE_PATH`，不設就是 `/`）。

## 3. WSL2 環境準備

以下以 Ubuntu 為例；版本號以當時 Capacitor 官方文件為準。

1. **專案放在 WSL 自己的檔案系統**（例如 `~/supermaze`），不要放 `/mnt/c/...`，否則 Gradle 與 npm 會非常慢。
   ```bash
   git clone <repo> ~/supermaze && cd ~/supermaze && npm ci
   ```
2. **Node**：CI 用 22（`.github/workflows/pages.yml`），開發機目前是 26；22 以上都可以。
3. **JDK**：新版 Capacitor 要求 JDK 21（若官方文件寫的版本不同，以官方為準）。
   ```bash
   sudo apt install openjdk-21-jdk unzip
   ```
4. **Android 命令列工具**：到 developer.android.com 的 Android Studio 下載頁，拿「Command line tools only」的 Linux 版 zip。
   ```bash
   mkdir -p ~/Android/Sdk/cmdline-tools
   unzip commandlinetools-linux-*.zip -d ~/Android/Sdk/cmdline-tools
   mv ~/Android/Sdk/cmdline-tools/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
   # 加進 ~/.bashrc 或 ~/.zshrc
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
   ```
   `npx cap add android` 產生專案後，看 `apps/client/android/variables.gradle` 的 `compileSdkVersion`，裝對應版本：
   ```bash
   sdkmanager "platform-tools" "platforms;android-<compileSdk>" "build-tools;<compileSdk>.0.0"
   yes | sdkmanager --licenses
   ```
5. **把 APK 裝到手機**（WSL2 預設看不到 USB，擇一）：
   - 最簡單：把 `app-debug.apk` 複製到 Windows，再傳到手機（雲端硬碟、傳輸線拖檔），在手機上點開安裝，需允許「安裝未知應用程式」。
   - Windows 端裝 platform-tools，用 Windows 的 `adb install <apk>`。
   - Android 11 以上的「無線偵錯」：`adb pair <ip:port>`、`adb connect <ip:port>`；WSL2 開 mirrored 網路模式較容易連上。
   - `usbipd-win` 把手機的 USB 轉接進 WSL，WSL 內的 `adb` 就能直接看到手機。
   - 不建議在 WSL2 跑 Android 模擬器（需要巢狀 KVM，慢且不穩）；要用模擬器就裝在 Windows 端。實機測試才準。

## 4. 實作步驟

每完成一個可運作的步驟就 commit（`CLAUDE.md` 第 15 節）。

### T1 加入 Capacitor

- 在 `apps/client` 安裝：`@capacitor/core`（dependency），`@capacitor/cli`、`@capacitor/android`（devDependency），用 workspace 的方式裝（`npm i -w @supermaze/client ...`）。
- 在 `apps/client` 執行 `npx cap init`，`webDir` 設 `dist`。**appId（例如 `com.xxx.supermaze`）上架後不能改，先問使用者**（見第 7 節）。設定檔用 `capacitor.config.ts`。
- `npx cap add android` 產生 `apps/client/android/`，**原生專案要進 git**（Capacitor 的建議做法；它自己產生的 `.gitignore` 已排除 build 產物與 `local.properties`）。
- 用到的外掛（見後續步驟）：`@capacitor/app`（返回鍵）、`@capacitor/status-bar` 或自己寫幾行 Java（全螢幕）。不要引入第 17 節以外的遊戲引擎或框架。

### T2 打包指令

在 `apps/client/package.json` 加：

```json
"android:sync": "vite build && cap sync android",
"android:apk": "npm run android:sync && cd android && ./gradlew assembleDebug"
```

產出在 `apps/client/android/app/build/outputs/apk/debug/app-debug.apk`。根目錄 `package.json` 可再加一個轉呼叫的 `android:apk`，與 `build:client` 同樣寫法。確認 `BASE_PATH` 沒被設定（要是 `/`）。正式上架的建置要加 `VITE_ONLINE=off`（例如 `VITE_ONLINE=off vite build`），首頁的「連線對戰」會顯示「即將推出」（CLAUDE.md 第 2.1 節）；試玩用的 debug APK 可以不加，保留連線。

### T3 判斷是否在 App 內

用 `Capacitor.isNativePlatform()`（`@capacitor/core`）集中在一個小模組，例如 `apps/client/src/platform.ts`，其他地方只 import 它。網頁版行為一律不變。

### T4 橫向與全螢幕

- 網頁版的 `apps/client/src/fullscreen.ts` 在第一次觸控時要求 Fullscreen API 並鎖橫向；**在 App 內不要呼叫它**（`main.ts` 裡 `fullscreenOnFirstTouch()` 前加判斷）。
- 橫向：在 `android/app/src/main/AndroidManifest.xml` 的 MainActivity 加 `android:screenOrientation="sensorLandscape"`。
- 全螢幕（隱藏狀態列與導覽列、滑動邊緣時暫時出現）：在 `MainActivity.java` 的 `onCreate`／`onWindowFocusChanged` 用 `WindowCompat.getInsetsController(...)` 隱藏 `systemBars()`，behavior 設 `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`；或用外掛達成同樣效果。
- HUD 已使用 `env(safe-area-inset-*)`，`index.html` 已有 `viewport-fit=cover`；在有瀏海或圓角的手機上確認左右兩側的名單、方向鍵與按鈕沒有被切掉。

### T5 Android 返回鍵

用 `@capacitor/app` 的 `backButton` 事件，預設行為（直接離開 App）要改掉：

- 對局中：等同畫面右側 ✕ 的兩段式退出（`apps/client/src/hud/systemButtons.ts`，三秒內再按一次才確認），不要一按就丟掉整個挑戰。
- 規則畫面：回首頁。
- 首頁：離開 App（`App.exitApp()`）或縮到背景。
- 需要一個讓 `Match`／`Session` 註冊「目前返回鍵做什麼」的小介面；規則仍不可放進客戶端（這只是導覽）。

### T6 儲存

目前用 localStorage 的鍵：`supermaze.name`、`supermaze.server`、`supermaze.muted`、`supermaze.towerBest`、`supermaze.reconnectionToken`。Android WebView 的 localStorage 只有在使用者清除 App 資料時才會消失，第一階段可以沿用，只要驗證重開 App 後最佳總分還在。之後做 iOS 或付費時改用 `@capacitor/preferences`（iOS 可能清掉 WebView 儲存）。

### T7 音效

瀏覽器版要在第一次使用者操作後才能發聲（`apps/client/src/audio/sfx.ts`）；Android WebView 預設同樣要求使用者手勢，現有的解鎖機制應可沿用。實機確認第一次點擊後有聲音、靜音鍵（右側喇叭）有效。

### T8 效能量測

- F3 除錯面板（`apps/client/src/debug.ts`，顯示 fps、drawCalls 等）在手機上按不到。請用 **Windows 的 Chrome 開 `chrome://inspect`** 連到手機上的 App（debug 建置的 Capacitor 預設開啟 WebView 遠端偵錯，需 adb 連線），可看主控台、效能分析與 FPS meter；或為測試建置加一個建置期旗標（例如 `VITE_DEBUG_PANEL=1`）讓面板預設顯示，正式版不開。
- 至少在一支中階與一支低階 Android 手機上，打困難層（6 人、43×31 地圖）記錄 fps 與是否發燙。`CLAUDE.md` 第 17.5 節記有一次尚未查明的 32 fps，可用 `?dpr=` 同樣的思路測試降像素比（App 內沒有網址列，需改成設定值或建置旗標）。

### T9 App 內的線上模式（可選，驗證用）

- App 的來源是 `https://localhost`，Android 預設禁止明文連線，所以只能連 `wss://`，`ws://<區網 IP>:2567` 會失敗。要測可用 Cloudflare 快速通道（`CLAUDE.md` 第 16 節）拿到 https 網址，貼進首頁的伺服器欄位（會自動轉成 wss）。
- GitHub Pages 版本來就跨來源連到伺服器，Colyseus 的配對請求應已允許其他來源；仍需實測 App 內能否建立與加入私人房。
- 正式版要不要在 App 內隱藏線上按鈕，是使用者的決定（第 7 節）。第一階段先保留。

### T10 除錯入口

F3、F4 只有鍵盤觸發，手機上碰不到，第一階段可保留；`?local`、`?rules`、`?map=` 這類網址參數在 App 內無法輸入，也不影響。正式上架前再統一移除（`CLAUDE.md` 第 17.1 節已註明 F4 上線前移除）。

## 5. 手機驗收清單

- [ ] 安裝、開啟、首頁背景與按鈕正常，暱稱可輸入（虛擬鍵盤不會把畫面擠壞）
- [ ] 橫向、無狀態列與導覽列；旋轉手機維持橫向
- [ ] 爬塔挑戰：第 1 層可以完整玩完；晉級後「前往下一層」；刻意輸掉後出現總分與「回首頁／繼續」，「繼續」進入下一層且總分延續
- [ ] 飛航模式下爬塔挑戰照常
- [ ] 方向鍵、動作鍵、丟棄鍵的觸控手感；多指操作（一手方向、一手動作）
- [ ] 音效與靜音
- [ ] 遊戲規則畫面 13 張卡片都能播放
- [ ] 返回鍵：對局中兩段式退出、規則畫面回首頁、首頁離開
- [ ] 切到背景再回來：遊戲沒有卡死（固定 tick 迴圈回前景後不應暴衝）；來電或鎖屏後回來
- [ ] 關閉 App 再開，最佳總分還在
- [ ] fps 與機型已記錄

## 6. 之後的階段（這次不做，先知道）

- **正式簽章**：release keystore 一旦遺失就無法更新已上架的 App，要備份在安全的地方，絕不進 git；上架用 AAB（`./gradlew bundleRelease`）。
- **Google Play**：開發者帳號、隱私權政策、資料安全表單、內容分級；個人新帳號須先完成一段封閉測試（十多位測試者、持續約兩週，以 Play Console 當時規定為準）。
- **圖示與啟動畫面**：`apps/client/public/icons/` 已有各尺寸圖示，可用 `@capacitor/assets` 產生原生需要的尺寸。
- **iOS**：必須 macOS + Xcode，或雲端 Mac／CI（GitHub Actions macOS runner、Codemagic）；Apple Developer 帳號。
- **「繼續」的代價**：只改 `apps/client/src/modes/towerRun.ts` 的 `continueGate()`。廣告可用 AdMob 的 Capacitor 外掛（獎勵廣告），付費在 iOS 必須走 App 內購買（可用 RevenueCat 之類同時處理兩平台）；有廣告就要處理 iOS 的 ATT 與歐盟同意視窗。最佳紀錄目前不區分是否用過「繼續」（`CLAUDE.md` 第 4.1 節）。

## 7. 需要使用者決定的事（開始 T1 前先問）

1. **appId**（例如 `com.<名字>.supermaze`）：上架後不可更改。
2. **App 顯示名稱**：正式遊戲名稱仍待確認（`CLAUDE.md` 第 16 節），第一階段可暫用 `Super Maze`。
3. **App 內是否保留線上模式按鈕**：第一階段保留；上架版本待定。
4. **最低支援的 Android 版本**：Capacitor 預設的 `minSdkVersion` 通常即可，除非要支援很舊的手機。

## 8. 完成後要更新的文件

- `CLAUDE.md` 第 16 節（部署）與第 17.1 節（Capacitor 已導入、指令、原生專案位置）、第 17.5 節（實機 fps）、第 18 節（階段 6 進度）。
- `content/maps/AUTHORING.md` 不需要改。
- 本文件：在最上方註明完成日期與結果，或把仍有效的內容併入 `CLAUDE.md` 後刪除本文件。
