# 背景音樂放這裡

檔名固定：

| 檔名 | 何時播放 |
| --- | --- |
| `menu.m4a` 或 `menu.mp3` | 首頁、大廳、爬塔準備畫面、遊戲規則 |
| `game.m4a` 或 `game.mp3` | 對局中（含結算畫面），該地圖主題沒有自己的曲子時 |
| `game-<主題>.m4a` 或 `.mp3` | 該主題地圖的對局；主題是 `stone`、`garden`、`factory`、`candy`、`ice`、`desert` |

主題曲可以只做幾首：例如只放 `game-candy.mp3`，糖果地圖就播它，其他主題照樣播 `game`。

沒有檔案時播放程式合成的佔位曲（`apps/client/src/audio/placeholderMusic.ts`），不需要任何檔案。
同一首同時有 `.m4a` 和 `.mp3` 時用 `.m4a`。

- 格式：AAC（`.m4a`）或 MP3，iPhone、Android 與日後的 App 都能播。建議 96 kbps 立體聲，60～90 秒一首約 0.7～1 MB。
- 不必是完美循環：開頭與結尾的靜音會自動去掉，結尾最後 1.5 秒（`tuning.ts` 的 `audio.musicLoopBlendSec`）會淡入接回開頭。Suno 這類有前奏與結尾的整首歌也能直接放。
- 音量在 `tuning.ts` 的 `audio.musicVolume`（相對於主音量）。對局最後 30 秒與鬼抓人期間會稍微加速（`musicHurryRate`、`musicGhostRate`）。
- 網址加 `?nomusic` 關掉背景音樂；`M` 鍵與畫面右側喇叭同時靜音音效與音樂。

## Suno 提示詞

在 Suno 打開 Instrumental（純音樂），把下面英文貼到風格欄。挑一段中段平穩、沒有大起大落的版本；走迷宮時需要專心，旋律簡單、節奏穩定比華麗重要。

| 檔名 | 風格欄 |
| --- | --- |
| `menu.mp3` | instrumental, cozy fantasy adventure menu theme, warm piano, soft strings, light harp, gentle and inviting, 85 bpm, loopable, no vocals |
| `game.mp3` | instrumental, light puzzle adventure, soft marimba, plucked strings, gentle percussion, steady and focused, 100 bpm, loopable, no vocals |
| `game-stone.mp3` | instrumental, medieval fantasy dungeon, lute, harp, soft frame drum, low recorder, mysterious but calm, steady 100 bpm, loopable, no vocals |
| `game-garden.mp3` | instrumental, whimsical garden at sunset, pizzicato strings, acoustic guitar, glockenspiel, airy flute, warm and relaxed, 95 bpm, loopable, no vocals |
| `game-factory.mp3` | instrumental, sci-fi factory, soft synth arpeggios, muted electronic beat, warm pads, subtle mechanical percussion, focused, 105 bpm, loopable, no vocals |
| `game-candy.mp3` | instrumental, cute candy land, music box, marimba, ukulele, light sleigh bells, bouncy but gentle, 110 bpm, playful, loopable, no vocals |
| `game-ice.mp3` | instrumental, frozen crystal palace, celesta, glassy bells, soft strings, airy pads, sparkling and calm, 90 bpm, loopable, no vocals |
| `game-desert.mp3` | instrumental, ancient desert temple, oud, darbuka hand drums, ney flute, hijaz scale, mysterious, steady 100 bpm, loopable, no vocals |

歌詞欄填 `[Instrumental]`。想要更安靜可以在風格欄再加 `minimal, background music, no drops`。
