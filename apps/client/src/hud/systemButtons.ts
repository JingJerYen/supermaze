import { sfx } from "../audio/sfx.js";
import { t } from "../i18n/index.js";

const CSS = `
.sys{position:fixed;right:max(10px,env(safe-area-inset-right));top:42%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;z-index:7}
.sys button{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.4);color:#fff;font-size:18px;line-height:1;
  padding:0;cursor:pointer;touch-action:manipulation;opacity:.75;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}
.sys button.off{opacity:.5}
.sys button.ask{width:auto;padding:0 14px;border-radius:20px;background:rgba(190,40,40,.92);border-color:#ffb4b4;font-size:14px;font-weight:500;opacity:1;white-space:nowrap;align-self:flex-end}
`;

/** How long the exit button waits for the confirming second tap. */
const CONFIRM_MS = 3000;

/**
 * Two small round buttons on the right edge, out of the thumbs' way: mute, and
 * leave the match. Leaving asks for a second tap within a few seconds rather
 * than opening a dialog, which would drop a phone out of full screen.
 */
export class SystemButtons {
  private readonly root: HTMLDivElement;
  private readonly mute: HTMLButtonElement;
  private readonly exit: HTMLButtonElement | null = null;
  private confirmTimer: number | null = null;
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(parent: HTMLElement, onExit: (() => void) | null) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.className = "sys";

    this.mute = document.createElement("button");
    this.mute.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.mute.addEventListener("click", () => {
      sfx.setMuted(!sfx.isMuted);
      this.refreshMute();
    });
    this.root.appendChild(this.mute);
    this.refreshMute();
    // The M key mutes too; keep the icon in step with it.
    this.onKey = (e) => {
      if (e.code === "KeyM") queueMicrotask(() => this.refreshMute());
    };
    window.addEventListener("keydown", this.onKey);

    if (onExit) {
      const exit = document.createElement("button");
      // The Android back button presses this too, so it keeps the two-step confirm.
      exit.dataset["back"] = "";
      exit.addEventListener("pointerdown", (e) => e.stopPropagation());
      exit.addEventListener("click", () => {
        if (this.confirmTimer !== null) {
          this.clearConfirm();
          onExit();
          return;
        }
        exit.className = "ask";
        exit.textContent = t("hud.sys.quitConfirm");
        this.confirmTimer = window.setTimeout(() => this.clearConfirm(), CONFIRM_MS);
      });
      this.exit = exit;
      this.root.appendChild(exit);
      this.clearConfirm();
    }
    parent.appendChild(this.root);
  }

  private refreshMute(): void {
    this.mute.textContent = sfx.isMuted ? "🔇" : "🔊";
    this.mute.className = sfx.isMuted ? "off" : "";
    this.mute.title = t(sfx.isMuted ? "hud.sys.soundOn" : "hud.sys.mute");
  }

  private clearConfirm(): void {
    if (this.confirmTimer !== null) clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
    if (!this.exit) return;
    this.exit.className = "";
    this.exit.textContent = "✕";
    this.exit.title = t("hud.sys.quit");
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    if (this.confirmTimer !== null) clearTimeout(this.confirmTimer);
    this.root.remove();
  }
}
