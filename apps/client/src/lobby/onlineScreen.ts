import { t } from "../i18n/index.js";
import { ICONS } from "./homeIcons.js";
import { LOGO } from "./homeScreen.js";

/**
 * The online page, opened from the home screen's 連線對戰 button: server
 * field, quick match, and creating or joining a private room. Same look as
 * the home screen (HOME_CSS).
 *
 * Online play can be switched off for a build (the first store release ships
 * the offline tower run only): build with VITE_ONLINE=off and the home button
 * says 即將推出 instead of opening this page. `?online=0` or `?online=1` in the
 * address overrides the build for testing.
 */
export function onlineAvailable(): boolean {
  const param = new URLSearchParams(location.search).get("online");
  if (param === "0" || param === "1") return param === "1";
  return import.meta.env["VITE_ONLINE"] !== "off";
}

export const ONLINE_CSS = `
.lb .hm-back{--bh:2.8em;font-size:1em!important;font-weight:700;width:auto!important;align-self:flex-start;padding:0 .4em!important}
.hm-head{display:flex;align-items:center;gap:.5em;font-size:1.3em;font-weight:900;letter-spacing:.08em;color:#ffe08a}
.hm-head svg{font-size:1.2em}
`;

export function onlineHtml(error?: string): string {
  return `
    ${LOGO}
    <div class="hm-panel">
      <div class="hm-head">${ICONS.swords}${t("lobby.online.title")}</div>
      <div class="hm-field"><label for="lb-server">${ICONS.server}<span>${t("lobby.online.server")}</span></label><input id="lb-server" placeholder="wss://…" /></div>
      <button class="hm-gold" id="lb-quick">${ICONS.swords}${t("lobby.online.quickMatch")}</button>
      <div class="hm-pair">
        <button class="hm-stone" id="lb-create">${ICONS.users}${t("lobby.online.create")}</button>
        <div class="hm-join">
          <button class="hm-stone" id="lb-join">${ICONS.doorIn}${t("lobby.online.join")}</button>
          <div class="hm-code">${ICONS.key}<input id="lb-code" maxlength="4" placeholder="${t("lobby.online.codePlaceholder")}" /></div>
        </div>
      </div>
      <div class="hm-note ${error ? "err" : ""}" id="lb-online-notice">${error ?? t("lobby.online.hint")}</div>
      <button class="hm-stone hm-back" id="lb-back">${ICONS.back}${t("lobby.online.home")}</button>
    </div>`;
}
