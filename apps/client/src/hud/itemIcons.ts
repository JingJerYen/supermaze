/**
 * 2D icons for the inventory slots, drawn as inline SVG so they need no image
 * files and scale to any slot size. Each one is a flat reading of the matching
 * 3D prop in render/itemModels.ts, using the same colours, so what you carry
 * looks like what you will put down. The teleport node's pad is `currentColor`:
 * the slot sets its CSS colour to the team colour.
 */
const VIEW = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"';

const ICONS: Record<string, string> = {
  // Two dark posts and a lintel, a translucent blue pane, and the pass-direction arrow.
  oneWayDoor: `<svg ${VIEW}>
  <rect x="10" y="9" width="28" height="34" fill="#5eb8ff" opacity=".42"/>
  <rect x="5" y="9" width="5" height="36" rx="1" fill="#2f3b52" stroke="#7b8aa8" stroke-width="1"/>
  <rect x="38" y="9" width="5" height="36" rx="1" fill="#2f3b52" stroke="#7b8aa8" stroke-width="1"/>
  <rect x="4" y="4" width="40" height="5" rx="1.5" fill="#2f3b52" stroke="#7b8aa8" stroke-width="1"/>
  <path d="M24 39 V23" stroke="#bfe6ff" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M14 25 L24 13 L34 25 Z" fill="#bfe6ff"/>
</svg>`,

  // Striped road barrier on two dark feet.
  obstacle: `<svg ${VIEW}>
  <rect x="7" y="12" width="5" height="32" rx="1" fill="#2b2f3a"/>
  <rect x="36" y="12" width="5" height="32" rx="1" fill="#2b2f3a"/>
  <g>
    <rect x="4" y="13" width="8" height="13" fill="#f28c28"/><rect x="12" y="13" width="8" height="13" fill="#f4f1ea"/>
    <rect x="20" y="13" width="8" height="13" fill="#f28c28"/><rect x="28" y="13" width="8" height="13" fill="#f4f1ea"/>
    <rect x="36" y="13" width="8" height="13" fill="#f28c28"/>
    <rect x="4" y="13" width="40" height="13" rx="2" fill="none" stroke="#2b2f3a" stroke-width="1.5"/>
  </g>
  <g>
    <rect x="4" y="30" width="8" height="9" fill="#f4f1ea"/><rect x="12" y="30" width="8" height="9" fill="#f28c28"/>
    <rect x="20" y="30" width="8" height="9" fill="#f4f1ea"/><rect x="28" y="30" width="8" height="9" fill="#f28c28"/>
    <rect x="36" y="30" width="8" height="9" fill="#f4f1ea"/>
    <rect x="4" y="30" width="40" height="9" rx="2" fill="none" stroke="#2b2f3a" stroke-width="1.5"/>
  </g>
</svg>`,

  // Wooden handle, steel head with a lit top face, tilted like it is mid-swing.
  hammer: `<svg ${VIEW}>
  <g transform="rotate(-38 24 24)">
    <rect x="21.5" y="14" width="5" height="30" rx="2.5" fill="#8a5a2b"/>
    <rect x="21.5" y="14" width="2" height="30" rx="1" fill="#b07a3e" opacity=".7"/>
    <rect x="11" y="4" width="26" height="14" rx="2.5" fill="#9aa3b2"/>
    <rect x="11" y="4" width="26" height="5" rx="2.5" fill="#c3cad4"/>
    <rect x="11" y="4" width="26" height="14" rx="2.5" fill="none" stroke="#5c6572" stroke-width="1.2"/>
  </g>
</svg>`,

  // Dark red disc seen at a low angle, pale spikes, glowing red core.
  trap: `<svg ${VIEW}>
  <ellipse cx="24" cy="31" rx="19" ry="9" fill="#7f1d1d" stroke="#b03a3a" stroke-width="1.5"/>
  <path d="M7 30 L11 12 L15 30 Z" fill="#fca5a5"/>
  <path d="M33 30 L37 12 L41 30 Z" fill="#fca5a5"/>
  <path d="M19.5 34 L24 15 L28.5 34 Z" fill="#fca5a5"/>
  <circle cx="24" cy="29" r="7.5" fill="#ff3b3b" opacity=".35"/>
  <circle cx="24" cy="29" r="4" fill="#ff3b3b"/>
</svg>`,

  // Team-coloured floor pad with a dark rim, white inner ring with two notches, and a faint beam.
  teleportNode: `<svg ${VIEW}>
  <path d="M19 30 L29 30 L27 3 L21 3 Z" fill="currentColor" opacity=".3"/>
  <ellipse cx="24" cy="31" rx="19" ry="10" fill="currentColor"/>
  <ellipse cx="24" cy="31" rx="19" ry="10" fill="none" stroke="#1b1f2a" stroke-width="2"/>
  <ellipse cx="24" cy="30" rx="10" ry="5" fill="none" stroke="#ffffff" stroke-width="3" opacity=".92"/>
  <rect x="12" y="29" width="5" height="2.2" fill="#1b1f2a"/>
  <rect x="31" y="29" width="5" height="2.2" fill="#1b1f2a"/>
</svg>`,
};

/** SVG markup for an item kind, or null for an unknown kind (the caller falls back to text). */
export function itemIconSvg(kind: string): string | null {
  return ICONS[kind] ?? null;
}
