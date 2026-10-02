import { LOCALE_NAMES, nextLocale, t } from "../i18n/index.js";
import { ICONS } from "./homeIcons.js";

/**
 * The home screen: painted background, logo, and a panel with the character
 * setup, the tower run and the way into online play (onlineScreen.ts). Images come from public/ui (built by scripts/make_ui.sh). Buttons are
 * three-slice border images: the decorated ends keep their shape and only the
 * middle stretches. Everything is sized in em off a font size that follows the
 * window height, with a compact arrangement for landscape phones.
 */
const UI = `${import.meta.env.BASE_URL}ui/`;
const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

/** End-cap width of each button plate as a share of its height (source px / 200). */
const CAP = { gold: 0.35, blue: 0.45, stone: 0.35 };
const plate = (name: keyof typeof CAP) =>
  `border-style:solid;border-width:0 calc(var(--bh) * ${CAP[name]});border-color:transparent;` +
  `border-image:url(${UI}btn-${name}.webp) 0 ${Math.round(CAP[name] * 200)} fill / 0 calc(var(--bh) * ${CAP[name]}) stretch;` +
  `background:none;height:var(--bh)`;

export const HOME_CSS = `
.lb{background:#061127 url(${UI}home-bg.webp) 72% center / cover no-repeat}
.lb.home{justify-content:flex-start;align-items:stretch}
.lb.home::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,9,24,.72) 0%,rgba(3,9,24,.45) 38%,rgba(3,9,24,0) 60%);pointer-events:none}
.hm{position:relative;font-size:clamp(11px,1.9vh,17px);display:flex;flex-direction:column;gap:.9em;padding:1.6em 0 1.6em max(2.2em,env(safe-area-inset-left));width:min(34em,52vw);overflow:auto}
.hm-logo{display:flex;align-items:center;gap:.9em}
.hm-logo img{width:7.4em;height:7.4em;border-radius:1.4em;box-shadow:0 0 1.6em rgba(80,170,255,.55)}
.hm-title{font:900 3.3em/1 "Arial Black","Segoe UI Black",Impact,"Noto Sans TC",sans-serif;letter-spacing:.02em;white-space:nowrap}
.hm-title span{background:linear-gradient(#f4fbff,#9cc6ee 55%,#5f8fc4);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:.05em #16213d;filter:drop-shadow(0 .06em 0 #0b1122)}
.hm-title span+span{background-image:linear-gradient(#fff3b0,#ffc53a 50%,#d98a0c)}
.hm-name{display:flex;flex-direction:column;gap:.25em}
.hm-zh{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;letter-spacing:.12em}
/* Chinese strokes are dense: an outline fills them in, so a dark rim of shadows does the job instead. */
.hm-zh span{-webkit-text-stroke:0;filter:drop-shadow(0 .05em 0 #0b1122) drop-shadow(0 0 .03em #16213d) drop-shadow(0 0 .03em #16213d)}
.hm-panel{background:linear-gradient(180deg,rgba(20,30,52,.9),rgba(10,16,32,.92));border:.18em solid #3d4658;border-radius:1.1em;box-shadow:inset 0 0 0 .12em #10151f,inset 0 0 1.6em rgba(80,150,255,.12),0 .6em 2em rgba(0,0,0,.5);padding:1.3em 1.5em;display:flex;flex-direction:column;gap:.85em;margin:auto 0}
.hm-field{display:flex;align-items:center;gap:.7em}
.hm-field label{display:flex;align-items:center;gap:.4em;width:5.2em;flex:none;color:#8fb6ff;font-size:1.05em}
.hm-field label svg{font-size:1.3em;color:#c9d3e6}
.lb .hm input{flex:1;min-width:0;height:2.6em;font-size:1em;border-radius:.5em;border:1px solid #3a4560;background:rgba(4,8,18,.75);color:#fff;padding:0 .8em}
.lb .hm button{font-family:inherit;color:#fff;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;gap:.5em;border-radius:0}
.lb .hm button:hover{filter:brightness(1.1)}
.lb .hm button:active{filter:brightness(.92);transform:translateY(1px)}
.lb .hm-gold{--bh:3.8em;${plate("gold")};color:#3b1d00!important;font-size:1.35em!important;font-weight:900;letter-spacing:.12em;text-shadow:0 1px 0 rgba(255,240,190,.6)}
.hm-gold svg{font-size:1.3em}
.lb .hm-stone{--bh:3.2em;${plate("stone")};font-size:1.1em!important;font-weight:700;letter-spacing:.06em;width:100%}
.hm-stone svg{font-size:1.25em;color:#cfe0ff}
.hm-pair{display:grid;grid-template-columns:1fr 1fr;gap:.8em;align-items:start}
.hm-join{display:flex;flex-direction:column;gap:.5em}
.hm-code{position:relative;display:flex;align-items:center}
.hm-code svg{position:absolute;left:.7em;color:#8fa0c0}
.lb .hm .hm-profile{justify-content:flex-start;gap:.7em;height:3.2em;padding:0 .8em 0 .3em;border-radius:.6em;border:1px solid #3a4560;background:rgba(4,8,18,.75)}
.hm-profile img{width:2.6em;height:2.6em;border-radius:.5em;background:#2a3450}
.hm-profile .n{font-size:1.15em;font-weight:700}
.hm-profile .s{margin-left:auto;display:flex;align-items:center;gap:.3em;color:#8fb6ff;font-size:.95em}
.lb .hm .hm-code input{padding-left:2.2em;text-transform:uppercase;letter-spacing:.2em}
.hm-note{color:#ffd66b;font-size:.92em;text-align:center;min-height:1.3em}
.hm-note.err{color:#ff8a8a}
#lb-home-notice:empty{display:none}
.lb .hm .hm-online{--bh:3.6em;font-size:1.25em!important;letter-spacing:.12em}
.hm-soon{font-size:.62em;letter-spacing:.04em;font-weight:700;color:#3b1d00;background:#ffd23f;border-radius:1em;padding:.15em .6em}
.lb .hm-blue{--bh:5.4em;${plate("blue")};color:#082a4a!important;justify-content:flex-start!important;padding-left:.4em!important}
.hm-blue>svg:first-child{font-size:2.6em;color:#0b2c52;margin-right:.2em}
.hm-blue .t{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;text-align:left}
.hm-blue .t b{font-size:1.8em;font-weight:900;letter-spacing:.1em}
.hm-blue .t small{font-size:.95em;font-weight:700;opacity:.85}
.hm-blue>svg:last-child{margin-left:auto;font-size:1.8em;margin-right:.1em}
.hm-rules{position:fixed;z-index:1;top:max(1em,env(safe-area-inset-top));right:max(1.2em,env(safe-area-inset-right));font-size:clamp(11px,1.9vh,17px);display:flex;flex-direction:column;align-items:stretch;gap:.5em}
.lb .hm-rules button{--bh:2.8em;${plate("stone")};color:#fff;font-size:1.05em;font-weight:700;padding:0 .3em;display:flex;align-items:center;gap:.4em;cursor:pointer}
.hm-rules svg{font-size:1.3em;color:#cfe0ff}
.hm-rules #lb-store svg{color:#ffd23f}
.hm-rules #lb-ach svg{color:#ffb84d}
.hm-rules #lb-store.owned{color:#ffe08a}
@media (max-height:520px){
  .hm{font-size:clamp(10px,3.1vh,14px);gap:.5em;padding-top:.8em;padding-bottom:.8em;width:min(40em,58vw)}
  .hm-logo img{width:4.8em;height:4.8em;border-radius:.9em}
  .hm-title{font-size:2.2em}
  .hm-panel{padding:.8em 1em;gap:.55em}
  .hm-field label{width:auto}
  .hm-field label span{display:none}
  .lb .hm-gold{--bh:3.1em}
  .lb .hm-stone{--bh:2.7em}
  .lb .hm-blue{--bh:4.3em}
  .lb .hm .hm-online{--bh:3em}
}
`;

/** App icon, the SUPER MAZE word mark and the Chinese name at the same size, top left of the home and online pages. */
export const LOGO = `<div class="hm-logo"><img src="${ICON}" alt="" /><div class="hm-name"><div class="hm-title"><span>SUPER</span> <span>MAZE</span></div>${zhLine()}</div></div>`;

/** The name under the word mark in two tones, like SUPER MAZE; nothing in a language without one. */
function zhLine(): string {
  const name = t("app.nameZh");
  if (!name) return "";
  const half = Math.ceil(name.length / 2);
  return `<div class="hm-title hm-zh"><span>${name.slice(0, half)}</span><span>${name.slice(half)}</span></div>`;
}

export interface HomeView {
  /** The player's name and portrait (character setup). */
  name: string;
  portrait?: string | undefined;
  error?: string | undefined;
  best?: { score: number; floor: number } | null | undefined;
  /** Owns the full version: the store button says so. */
  premium?: boolean;
  /** Online play is in this build; otherwise its button says 即將推出. */
  online: boolean;
}

export function homeHtml(v: HomeView): string {
  const sub = v.best ? t("lobby.home.towerSubBest", { floor: v.best.floor, score: v.best.score }) : t("lobby.home.towerSubNew", { floors: 20 });
  return `
    ${LOGO}
    <div class="hm-panel">
      <button class="hm-profile" id="lb-profile">${v.portrait ? `<img src="${v.portrait}" alt="" />` : ICONS.user}<span class="n">${escapeHtml(v.name)}</span><span class="s">${ICONS.user}${t("lobby.home.profile")}</span></button>
      <button class="hm-blue" id="lb-local">${ICONS.tower}<span class="t"><b>${t("lobby.home.towerRun")}</b><small>${sub}</small></span>${ICONS.chevron}</button>
      <button class="hm-stone hm-online" id="lb-online">${ICONS.swords}${t("lobby.home.online")}${v.online ? "" : `<span class="hm-soon">${t("lobby.home.soon")}</span>`}</button>
      <div class="hm-note ${v.error ? "err" : ""}" id="lb-home-notice">${v.error ?? ""}</div>
    </div>
    <div class="hm-rules">
      <button id="lb-rules">${ICONS.book}${t("lobby.home.rules")}</button>
      <button id="lb-ach">${ICONS.trophy}${t("lobby.home.achievements")}</button>
      <button id="lb-store" class="${v.premium ? "owned" : ""}">${ICONS.star}${v.premium ? t("lobby.home.fullVersionOwned") : t("lobby.home.fullVersion")}</button>
      <button id="lb-lang" title="${t("lobby.home.language")}">${ICONS.globe}${LOCALE_NAMES[nextLocale()]}</button>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
