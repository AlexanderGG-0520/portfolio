const layer = document.querySelector<HTMLElement>('[data-mobile-nav]');
const opener = document.querySelector<HTMLButtonElement>('[data-mobile-nav-open]');
const closers = document.querySelectorAll<HTMLElement>('[data-mobile-nav-close]');
const links = document.querySelectorAll<HTMLElement>('[data-mobile-nav-link]');
const terminalButton = document.querySelector<HTMLElement>('[data-mobile-nav-terminal]');
const compactQuery = window.matchMedia('(max-width: 1180px), (hover: none) and (pointer: coarse)');

let lastFocused: HTMLElement | null = null;

function focusableItems() {
  if (!layer) return [];
  return Array.from(layer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
    .filter((item) => item.tabIndex !== -1 && !item.hasAttribute('inert'));
}

function setOpen(open: boolean, restoreFocus = true) {
  if (!layer || !opener) return;

  if (open) {
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : opener;
  }

  layer.dataset.open = open ? 'true' : 'false';
  layer.setAttribute('aria-hidden', open ? 'false' : 'true');
  layer.toggleAttribute('inert', !open);
  opener.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.documentElement.dataset.mobileNav = open ? 'open' : 'closed';
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) {
    requestAnimationFrame(() => {
      focusableItems()[1]?.focus();
    });
  } else if (restoreFocus) {
    requestAnimationFrame(() => lastFocused?.focus());
  }
}

opener?.addEventListener('click', () => setOpen(true));
closers.forEach((closer) => closer.addEventListener('click', () => setOpen(false)));
links.forEach((link) => link.addEventListener('click', () => setOpen(false, false)));
terminalButton?.addEventListener('click', () => setOpen(false, false));

window.addEventListener('keydown', (event) => {
  if (layer?.dataset.open !== 'true') return;

  if (event.key === 'Escape') {
    event.preventDefault();
    setOpen(false);
    return;
  }

  if (event.key !== 'Tab') return;
  const items = focusableItems();
  if (!items.length) return;

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
});

compactQuery.addEventListener('change', (event) => {
  if (!event.matches && layer?.dataset.open === 'true') setOpen(false, false);
});
