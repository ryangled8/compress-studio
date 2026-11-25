// Simple line icons. Any element with data-icon="name" gets the matching SVG.
const ICONS = {
  image:   '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 9"/>',
  video:   '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  gif:     '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10H8.5A1.5 1.5 0 0 0 7 11.5v1A1.5 1.5 0 0 0 8.5 14H10v-2M13 10v4M16 14v-4h2M16 12h1.5"/>',
  upload:  '<path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5"/><path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  folder:  '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/>',
  help:    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  x:       '<path d="M6 6l12 12M18 6 6 18"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  eye:     '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  keep:    '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  up:      '<path d="M12 19V5M6 11l6-6 6 6"/>',
  check:   '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  play:    '<path d="M8 5.5v13l10.5-6.5z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  bulb:    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  stack:   '<rect x="4" y="8" width="16" height="12" rx="2.5"/><path d="M7 5h10M9 2.5h6"/>',
  warn:    '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
  route:   '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  star:    '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
};

function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.dataset.iconDone === el.dataset.icon) return;
    el.innerHTML = iconSvg(el.dataset.icon);
    el.dataset.iconDone = el.dataset.icon;
  });
}
