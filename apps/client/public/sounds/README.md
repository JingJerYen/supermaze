# 音效檔放這裡

檔名對應 `apps/client/src/audio/sfx.ts` 的 `SOUND_FILES`。要換音效就用同名檔覆蓋；
缺檔時該音效靜音，不會報錯。目前的檔案是 `scripts/sfx_gen.py` 合成的佔位音效：

```bash
python3 scripts/sfx_gen.py apps/client/public/sounds
```

| 檔名 | 時機 |
| --- | --- |
| `key.wav` | 有人撿到鑰匙（自己的全音量，別人的較小聲） |
| `box.wav` | 自己開箱或收回傳送端點 |
| `trap.wav` | 有人踩到陷阱、鐵籠落下 |
| `light-on.wav` / `light-off.wav` | 全圖開燈／關燈，所有人都聽得到 |
| `caught.wav` | 有人被鬼抓到 |
| `catch.wav` | 自己當鬼抓到人 |
| `climb.wav` | 有人登上塔頂 |

格式：瀏覽器能解碼的都可以（wav、mp3、ogg），但檔名要維持 `.wav` 或同時修改 `SOUND_FILES`。
建議單聲道、一秒以內。音量在 `apps/client/src/tuning.ts` 的 `audio`。遊戲中按 `M` 靜音，
網址加 `?mute` 則一開始就靜音。
