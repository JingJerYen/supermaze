/**
 * The left-hand panel shared by the character setup and the tower run's floor
 * prep; the game canvas behind it shows the character on its stage.
 */
const CSS = `
.sp{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));bottom:max(12px,env(safe-area-inset-bottom));
  width:min(430px,56vw);display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:16px;z-index:25;overflow:auto;
  background:rgba(16,19,24,.82);border:1px solid rgba(255,255,255,.14);color:#fff;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}
.sp *{box-sizing:border-box}
.sp h2{margin:0;font-size:20px;font-weight:500;color:#ffd23f}
.sp .sp-sub{font-size:12px;color:#c9d2e3;margin-top:-6px}
.sp label{font-size:12px;color:#c9d2e3;display:block;margin-bottom:4px}
.sp input{width:9em;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:15px;padding:0 10px}
.sp-chars{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.sp-chars button{aspect-ratio:1;padding:0;border-radius:10px;border:2px solid transparent;background:#2a3450;cursor:pointer;overflow:hidden}
.sp-chars button img{width:100%;height:100%;display:block}
.sp-chars button.on{border-color:#ffd23f;box-shadow:0 0 0 2px rgba(255,210,63,.35)}
.sp-who{display:flex;align-items:center;gap:10px;font-size:15px}
.sp-who img{width:44px;height:44px;border-radius:10px;background:#2a3450}
.sp-skills{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.sp-skills button{text-align:left;padding:6px 8px;border-radius:10px;border:2px solid rgba(255,255,255,.15);background:rgba(110,70,200,.25);color:#fff;cursor:pointer;font-size:13px;line-height:1.3}
.sp-skills button b{display:block;font-size:14px}
.sp-skills button small{color:#d8d0f0;font-size:11px}
.sp-skills button.on{border-color:#c9a6ff;background:rgba(110,70,200,.6)}
.sp-skills button{position:relative}
.sp-skills button i{position:absolute;top:3px;right:5px;font-style:normal;font-size:10px;font-weight:700;background:#c9a6ff;color:#2a1460;border-radius:4px;padding:0 4px}
.sp-skills button:disabled{cursor:default;opacity:.45}
.sp-skills button.on:disabled{opacity:1}
.sp-row{display:flex;gap:8px;align-items:center}
.sp-row button{flex:1;height:42px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:15px;cursor:pointer}
.sp-row button.primary{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:500}
.sp-row button.skill{background:#6e46c8;border-color:#b48cff}
.sp-row button:disabled{opacity:.45;cursor:default}
.sp-row button.owned,.sp-row button.owned:disabled{opacity:1;background:#2f7a45;border-color:#7fd08e;color:#fff}
.sp-note{font-size:12px;color:#c9d2e3}
.sp-floors{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.sp-floors button{height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.15);background:rgba(70,110,200,.3);color:#fff;font-size:15px;font-weight:600;cursor:pointer;position:relative}
.sp-floors button.on{border-color:#ffd23f;background:rgba(255,210,63,.3)}
.sp-floors button.top::after{content:"最高";position:absolute;top:-7px;right:-4px;font-size:9px;font-weight:600;background:#ffd23f;color:#412402;border-radius:4px;padding:0 3px}
.sp-floors button:disabled{opacity:.35;cursor:default;font-size:12px}
.sp-perks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.sp-perks li{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:10px;background:rgba(255,210,63,.1);border:1px solid rgba(255,210,63,.3)}
.sp-perks b{font-size:15px;font-weight:600}
.sp-perks span{font-size:12px;color:#d8dbe6}
.sp-spacer{flex:1}
/* Phones in landscape: a narrower panel so the character on the right stays clear; portraits keep two rows of six, skills two rows of three. */
@media (max-height:520px){.sp{width:min(320px,44vw);padding:10px 12px;gap:6px}.sp h2{font-size:17px}.sp-chars{gap:4px}
  .sp-skills button{padding:4px 5px}.sp-skills button small{display:none}.sp-row button{height:36px}
  .sp-floors{gap:4px}.sp-floors button{height:30px;font-size:13px}.sp-perks{gap:5px}.sp-perks li{padding:5px 8px}.sp-perks b{font-size:13px}.sp-perks span{font-size:11px}}
`;

/** A fresh panel on `root`, with the shared styles installed once. */
export function createSidePanel(root: HTMLElement): HTMLDivElement {
  if (!document.getElementById("sp-css")) {
    const style = document.createElement("style");
    style.id = "sp-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const panel = document.createElement("div");
  panel.className = "sp";
  root.appendChild(panel);
  return panel;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
