# 背景音樂放這裡

兩首，檔名固定：

| 檔名 | 何時播放 |
| --- | --- |
| `menu.m4a` 或 `menu.mp3` | 首頁、大廳、爬塔準備畫面、遊戲規則 |
| `game.m4a` 或 `game.mp3` | 對局中（含結算畫面） |

沒有檔案時播放程式合成的佔位曲（`apps/client/src/audio/placeholderMusic.ts`），不需要任何檔案。
同一首同時有 `.m4a` 和 `.mp3` 時用 `.m4a`。

- 格式：AAC（`.m4a`）或 MP3，iPhone、Android 與日後的 App 都能播。建議 96 kbps 立體聲，60～90 秒一首約 0.7～1 MB。
- 不必是完美循環：開頭與結尾的靜音會自動去掉，結尾最後 1.5 秒（`tuning.ts` 的 `audio.musicLoopBlendSec`）會淡入接回開頭。Suno 這類有前奏與結尾的整首歌也能直接放。
- 音量在 `tuning.ts` 的 `audio.musicVolume`（相對於主音量）。對局最後 30 秒與鬼抓人期間會稍微加速（`musicHurryRate`、`musicGhostRate`）。
- 網址加 `?nomusic` 關掉背景音樂；`M` 鍵與畫面右側喇叭同時靜音音效與音樂。
