# 遠景圖片放這裡（尚未接上程式）

每個地圖主題一張橫向全景圖，之後會繞在地圖四周當遠景，接在程式畫的漸層天空與地面（`src/render/backdrop.ts`）之間。

檔名：`<主題>.webp`，主題是 `stone`、`garden`、`factory`、`candy`、`ice`、`desert`。

- 尺寸：很寬的橫幅，建議 3072×1024（3:1）；生不出這麼寬時，可以先生 3:2 再向左右擴圖。
- 內容：只有遠景與天空，不要近處的地面、人物或文字；地平線在畫面下方約三分之一。
- 下緣：最下面一小段淡成提示詞裡寫的顏色，那是程式畫的地面最遠處的顏色，這樣接起來看不到縫。
- 左右兩端最好能接起來（圖會繞一圈）；接不起來也沒關係，程式可以左右鏡射。
- 大小：轉成 WebP 後每張 200～400 KB。

## 提示詞（英文直接貼到 Midjourney 等圖片生成工具）

| 主題 | 提示詞 |
| --- | --- |
| `stone` 石頭 | Wide panoramic landscape background for a stylized 3D maze game, seen from ground level. Distant medieval fantasy countryside at dusk: silhouettes of far-off castle towers and crumbling stone ruins on rolling hills, misty pine forests, the first stars in a deep navy-blue sky that fades to pale blue-grey at the horizon. Distant scenery only, nothing in the foreground, horizon at the lower third, the bottom edge fades into flat #6C7FA6 haze. Soft painterly low-poly style, calm mood, no people, no text, seamless left and right edges --ar 3:1 |
| `garden` 花園 | Wide panoramic landscape background for a stylized 3D maze game, seen from ground level. Distant gentle green hills with rows of round trees and clipped hedges, a far-off windmill and a small cottage, the golden evening sun just above the horizon, sky from soft blue at the top to warm orange near the horizon with fluffy pink clouds. Distant scenery only, nothing in the foreground, horizon at the lower third, the bottom edge fades into flat #F2B884 haze. Soft painterly low-poly style, warm and peaceful, no people, no text, seamless left and right edges --ar 3:1 |
| `factory` 工廠 | Wide panoramic landscape background for a stylized 3D maze game, seen from ground level. A sci-fi industrial skyline on a space station: distant factory towers, cooling stacks and antenna masts with cyan glowing lights, a large ringed planet and scattered stars in a dark navy sky, a soft cyan glow along the horizon. Distant scenery only, nothing in the foreground, horizon at the lower third, the bottom edge fades into flat #1F5A8A haze. Clean stylized low-poly sci-fi style, no people, no text, seamless left and right edges --ar 3:1 |
| `candy` 糖果 | Wide panoramic landscape background for a stylized 3D maze game, seen from ground level. A cute candy land: distant chocolate mountains with pink icing caps, giant swirl lollipop trees, gumdrop hills and cotton-candy clouds, sky from lavender at the top to soft pink near the horizon. Distant scenery only, nothing in the foreground, horizon at the lower third, the bottom edge fades into flat #FFD0E0 haze. Soft pastel low-poly style, playful, no people, no text, seamless left and right edges --ar 3:1 |
| `ice` 冰雪 | Wide panoramic landscape background for a stylized 3D maze game, seen from ground level. The frozen north at night: green and teal aurora borealis over jagged snowy mountains, floating ice islands with frozen waterfalls, tall ice crystal spires, stars in a deep indigo sky that turns teal near the horizon. Distant scenery only, nothing in the foreground, horizon at the lower third, the bottom edge fades into flat #2E8A96 haze. Soft painterly low-poly style, magical and calm, no people, no text, seamless left and right edges --ar 3:1 |
| `desert` 沙漠 | Wide panoramic landscape background for a stylized 3D maze game, seen from ground level. An ancient desert: distant pyramids and an obelisk, red sandstone cliffs, rolling sand dunes, a small palm-tree oasis and broken stone columns, a warm afternoon sky from red-brown at the top to golden near the horizon. Distant scenery only, nothing in the foreground, horizon at the lower third, the bottom edge fades into flat #F6D49A haze. Soft painterly low-poly style, warm, no people, no text, seamless left and right edges --ar 3:1 |

不是用 Midjourney 時去掉最後的 `--ar 3:1`，另外在工具裡選最寬的比例。
