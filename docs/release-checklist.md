# 上架清單（Google Play：沒有廣告，只賣完整版）

> 建立於 2026-10-01。2026-10-04 改為不放廣告（使用者決定），AdMob 相關項目已移除。依序往下做；做完一項就把 `[ ]` 改成 `[x]` 並寫上日期。「你」是使用者本人才能做的（帳號、付款、決定），「Agent」是可以交給 AI 做的。
> 相關文件：`docs/android-apk-handoff.md`（包 APK 的步驟）、`docs/store-listing.md`（商店頁文字與表單答案）、`CLAUDE.md` 第 4.2 節（盈利模式）。

## 一、帳號與決定（你）

- [x] 決定 appId：`com.jjy.supermaze`（2026-10-01）。第一次上傳到 Play Console 之後就不能再改。
- [ ] 註冊 Google Play 開發者帳號（一次 US$25），完成身分驗證。
- [ ] **找 12 位以上的封閉測試者**：新的個人開發者帳號必須先做封閉測試，至少 12 人、連續 14 天，才能申請正式上架（以 Play Console 當時規定為準）。這一項最花時間，越早開始越好。
- [ ] 註冊 RevenueCat，建立專案、連結 Play Console（服務帳戶金鑰），記下 Android 的公開 SDK 金鑰（`goog_…`）。
- [ ] Play Console 建立一次性商品 `full_version`，設定價格（US$2.99，台灣手動設 NT$60，2026-10-04 定案）；RevenueCat 建立權益 `full_version` 並把商品掛上去。
- [ ] 準備聯絡信箱，填入 `apps/client/public/privacy.html` 的兩個空格。
- [ ] 確認素材都能商用：背景音樂（Suno 要用付費方案產生的歌）、首頁插畫與 App 圖示的來源。

## 二、程式（Agent，2026-10-01 已完成的打勾）

- [x] Capacitor 8 與外掛的 JS 端：`@capacitor/app`、`@revenuecat/purchases-capacitor`（`apps/client/package.json`；`@capacitor-community/admob` 已於 2026-10-04 移除）。
- [x] 完整版接 RevenueCat；網頁版維持佔位（`apps/client/src/monetize/`）。沒有廣告（2026-10-04 拿掉 AdMob）。
- [x] 返回鍵（`apps/client/src/native/backButton.ts`）。
- [x] 上架版建置 `npm run build:release`：關閉連線對戰（顯示「即將推出」）、關閉 F3／F4 除錯工具。
- [x] 隱私權政策頁 `apps/client/public/privacy.html`（中英文，GitHub Pages 部署後就有網址）。
- [x] 商店頁文字與表單答案草稿 `docs/store-listing.md`。
- [x] `capacitor.config.ts` 與原生專案 `apps/client/android/`（2026-10-01）。
- [x] 原生專案設定：release 簽名讀 `keystore.properties`、橫向、全螢幕、依語言的 App 名稱（2026-10-01，待實機確認）。
- [x] App 圖示與啟動畫面（`scripts/make_app_assets.sh`，2026-10-01）。
- [x] GitHub Actions 編譯 debug APK（`.github/workflows/android.yml`，2026-10-01）：從 Actions 頁下載 `super-maze-debug-apk`。

## 三、編譯與實機測試（你，或 Agent 在你的電腦上做）

- [ ] 從 GitHub Actions 的 android 工作下載 debug APK（或在 WSL2 依 `docs/android-apk-handoff.md` 第 3 節裝好 JDK 與 Android SDK 後 `npm run android:apk`），裝到手機跑一遍該文件第 5 節的驗收清單。
- [ ] 建立上架用的簽名金鑰（keystore）。**備份到安全的地方，絕不放進 git**；弄丟就再也不能更新這個 App。在 `apps/client/android/keystore.properties`（不進 git）寫上 `storeFile`、`storePassword`、`keyAlias`、`keyPassword`。
- [ ] 在 `apps/client/.env.production.local`（不進 git）填入 `VITE_REVENUECAT_KEY`。
- [ ] 用授權測試人員的帳號實際買一次完整版（不會扣款），確認購買、恢復購買、重裝後自動恢復。要用 `android:release` 的版本經內部測試軌道安裝；debug APK 的購買是佔位，不連商店。
- [ ] `npm run android:release` 出 AAB（同時也出一份可直接安裝的 release APK），上傳到 Play Console 的封閉測試軌道。

## 四、商店頁（你）

- [ ] 貼上 `docs/store-listing.md` 的中英文標題與說明。
- [ ] 圖片：512×512 圖示、1024×500 主圖、手機截圖（中英文各一套）。
- [ ] 隱私權政策網址、資料安全性表單、內容分級問卷、目標年齡層、廣告聲明（不含廣告；答案草稿在 `docs/store-listing.md`）。

## 五、佔位素材（不擋上架，影響品質）

- [ ] 背景音樂（`apps/client/public/music/`，README 有提示詞）。
- [ ] 八個音效（`apps/client/public/sounds/`）。
- [ ] 鬼的模型（`apps/client/public/models/ghost.glb`）。
- [ ] 英文角色預設名（`apps/client/src/characterNames.ts`）。

## 六、封閉測試 → 正式上架

- [ ] 封閉測試滿 14 天、12 人以上，期間修掉回報的問題。
- [ ] 在 Play Console 申請正式版，審核通過後發布。可以先只開放部分國家或分階段推出。
