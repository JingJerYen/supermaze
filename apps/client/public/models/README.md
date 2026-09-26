# 模型檔放這裡

把 glb 檔丟進這個資料夾，檔名對應 `apps/client/src/render/models.ts` 的 `MODEL_MANIFEST`：

| 檔名 | 用途 | 自動縮放到 |
| --- | --- | --- |
| `key.glb` | 未拾取的鑰匙（頭頂光柱由程式加） | 最大邊 0.6 格 |
| `box.glb` | 道具箱 | 最大邊 0.6 格 |

規則：

- 只需要 glb（或 gltf）。obj 請在 Blender 匯出成 glb。
- 座標系 Y 朝上。尺度與原點不用在意：載入後會自動縮放到表格中的大小、底部貼地、xz 置中。
- 模型正面若不是 +Z，在 `MODEL_MANIFEST` 填 `rotationYDeg` 調整。
- 檔案不存在時自動用程式畫的佔位模型，不會報錯。開發伺服器執行中放入檔案後重新整理頁面即可。
- 這些檔案是靜態資源，由網頁伺服器提供並被瀏覽器快取，不會經過遊戲連線傳輸。
- 目前不支援 Draco 壓縮的 glb；匯出時請關閉壓縮。

## 人物

`characters/` 內是 Kenney Mini Characters（CC0），12 個 glb 共用 `Textures/colormap.png`，
內含 `idle`、`walk` 等骨架動畫。玩家依 id 決定性地分到其中一個，所有客戶端看到同一人。
要換人物：放入同名 glb 覆蓋即可；要增減人物：改 `apps/client/src/render/characters.ts` 的名單。
輪椅模型刻意不收錄。
