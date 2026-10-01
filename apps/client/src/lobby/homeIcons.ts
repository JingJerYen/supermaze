/**
 * Line icons for the home screen, drawn in code like the HUD item icons.
 * 24x24, stroked in currentColor; a designer may replace any string here.
 */
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  user: svg(`<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5" fill="currentColor"/>`),
  server: svg(`<rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01M8 17.5h.01"/>`),
  swords: svg(`<path d="M4 4l10 10M4 4h4M4 4v4"/><path d="M20 4L10 14M20 4h-4M20 4v4"/><path d="M12 16l-3 3M8 13l-3 3M5 16l3 3M12 16l3 3M16 13l3 3M19 16l-3 3"/>`),
  users: svg(`<circle cx="9" cy="8" r="3.5" fill="currentColor"/><path d="M2.5 20c.8-4 3.5-6 6.5-6s5.7 2 6.5 6" fill="currentColor"/><circle cx="17" cy="9" r="2.8"/><path d="M17.5 14c2.2.4 3.6 2.2 4 5"/>`),
  doorIn: svg(`<path d="M14 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/><path d="M3 12h11M10 8l4 4-4 4"/>`),
  key: svg(`<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>`),
  tower: svg(`<path d="M6 21V9h12v12"/><path d="M5 9V4h3v2h2V4h4v2h2V4h3v5z" fill="currentColor"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M4 21h16"/>`),
  book: svg(`<path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z"/><path d="M12 6v13.5"/>`),
  chevron: svg(`<path d="M9 5l7 7-7 7"/>`),
  back: svg(`<path d="M15 5l-7 7 7 7"/>`),
  star: svg(`<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor"/>`),
} as const;
