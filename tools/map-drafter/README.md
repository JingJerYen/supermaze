# map-drafter

以 Python 腳本產生與檢查地圖草稿。只需要 Python 3，預覽圖另外需要 `rsvg-convert`（librsvg）。
產生的地圖仍然是 `content/maps/` 裡的一般 JSON，遊戲與驗證器不知道它是腳本產生的；
腳本只是讓地圖可以重現、可以改參數重做。

```bash
python3 tools/map-drafter/maps/maze_05.py      # 重新產生 maze-05.json 與 out/maze-05.png
python3 tools/map-drafter/check.py maze-03     # 檢查任何一張地圖（手繪的也可以）並輸出預覽
python3 tools/map-drafter/check.py maze-07 --stairs --ruler
npm run validate-maps                          # 最後仍以正式驗證器為準
```

預覽圖寫在 `tools/map-drafter/out/`（不進 git）。圖例：米色道路、灰或彩色是牆（同色表示牆頂相連，
有白點表示可經由樓梯走上去）、綠 S 樓梯、藍 = 橋、金色塔；黃 K/k 鑰匙、紅 B/b 道具箱、青 L 開關、
棕 O 障礙物、粉 A 陷阱、紫色箭頭是單向門（圓點那端是通行方向）。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `mapkit.py` | `Canvas`（畫牆、道路、塔，`maze()` 在奇數格點上挖深度優先迷宮，可加偏好與迴圈數）、`Map`（與模擬層相同的移動規則，含固定物）、候選點自動擺放、預覽、寫出 JSON |
| `fixtures.py` | 自動擺放單向門、障礙物、陷阱，每放一個就重新檢查整張圖 |
| `finish.py` | 每張產生式地圖共用的收尾：樓梯、橋、手放固定物 → 自動固定物 → 候選點 → 檢查 → 寫檔 |
| `check.py` | 對任何地圖做檢查、列出鑰匙步數、輸出預覽 |
| `maps/maze_NN.py` | 各地圖（maze-04～14）的產生腳本；檔頭註解寫該圖的設計概念；加 `--explore` 只看地形與可放樓梯的位置 |

## `check.py` 比驗證器多檢查的事

- 固定物公平性：把障礙物當牆、單向門只能順箭頭進出，確認任何走得到的格子都走得回塔（不會被單向門困住），
  且所有鑰匙、道具箱、開關都不需要鐵鎚就拿得到。障礙物可以擋捷徑，但不會是唯一的路。
- 每把鑰匙從塔邊出發要走幾步（含繞牆頂），用來判斷難度。

## 做一張新圖的流程

1. 複製一個 `maps/maze_NN.py`，改地形：`Canvas` 從全牆開始，`c.tower()` 放塔與塔周一圈廣場，
   `c.maze(cells, seed, bias, loops)` 挖迷宮，或用 `put`、`hline`、`vline`、`rect` 手畫。
   格點慣例同 `content/maps/AUTHORING.md` 第 4 節：奇數座標是路口，走道自然一格寬。
2. 先用 `--explore` 執行（腳本裡呼叫 `explore(id, rows)`），看每個牆頂區可以在哪裡放樓梯，預覽寫在 `out/<id>-terrain.png`。
   `loops` 越多，道路迴圈越多，牆頂也被切成越多塊島。
3. 呼叫 `finish(...)`：`stairs`、`bridges` 是座標列表；`manual` 是手放的固定物 `(x, y, 字元)`；
   `doors`、`traps`、`obstacles` 是自動擺放的上限（找不到公平的位置就少放）；`candidates` 傳給
   `auto_candidates`，例如 `n_keys`、`n_road_keys`（其餘放牆頂）、`wall_cap`（每象限牆頂鑰匙上限）、`fixed_keys`、
   `key_filter`／`box_filter`／`switch_filter`（限定範圍）、`keys_on_dead_ends=False`（小圖死路不夠時）；`meta` 寫進地圖 JSON，
   例如 `difficulty`、`boxes`（`itemBoxCount`）、`switches`（`lightSwitchCount`）。`c.maze(..., algo="prim")` 產生短死路很多的迷宮。
4. 看 `out/` 的預覽與鑰匙步數，再以 CPU 對局試跑確認破得了、時間夠。

同一個腳本在任何機器上重跑都產生完全相同的地圖（亂數都有固定種子，走訪順序也固定）。
直接手改 JSON 之後就不要再重跑該圖的腳本，否則手改的部分會被蓋掉。
