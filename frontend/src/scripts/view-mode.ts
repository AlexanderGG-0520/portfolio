type ViewMode = 'skim' | 'inspect';

const root = document.documentElement;
const toggleSelector = '[data-view-mode-toggle]';
const inspectSelector = '[data-view-mode-inspect]';
const labelSelector = '[data-view-mode-label]';

function currentMode(): ViewMode {
  return root.dataset.viewMode === 'inspect' ? 'inspect' : 'skim';
}

function nearestAnchor(source?: Element | null) {
  if (source) {
    const local = source.closest<HTMLElement>('[data-case-study], .evidence-system, .live-runtime-layer, section');
    if (local) return local;
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('main > section, [data-case-study], .evidence-system'));
  const line = Math.min(180, window.innerHeight * 0.22);

  return candidates
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > line && rect.top < window.innerHeight;
    })
    .sort((a, b) => Math.abs(a.getBoundingClientRect().top - line) - Math.abs(b.getBoundingClientRect().top - line))[0] ?? null;
}

function updateControls(mode: ViewMode) {
  document.querySelectorAll<HTMLElement>(labelSelector).forEach((node) => {
    node.textContent = mode;
  });

  document.querySelectorAll<HTMLButtonElement>(toggleSelector).forEach((button) => {
    button.setAttribute('aria-pressed', mode === 'inspect' ? 'true' : 'false');
    button.setAttribute('aria-label', mode === 'inspect' ? 'Switch to skim view' : 'Switch to inspect view');
  });
}

function setMode(mode: ViewMode, source?: Element | null) {
  if (mode === currentMode() && root.dataset.viewMode) return;

  const anchor = nearestAnchor(source);
  const before = anchor?.getBoundingClientRect().top ?? 0;

  root.dataset.viewMode = mode;
  updateControls(mode);

  requestAnimationFrame(() => {
    if (anchor) {
      const after = anchor.getBoundingClientRect().top;
      const delta = after - before;
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    }

    window.dispatchEvent(new CustomEvent('portfolio:view-mode', { detail: { mode } }));
  });
}

root.dataset.viewMode = root.dataset.viewMode === 'inspect' ? 'inspect' : 'skim';
updateControls(currentMode());

document.addEventListener('click', (event) => {
  const target = event.target as Element | null;
  const toggle = target?.closest<HTMLButtonElement>(toggleSelector);
  if (toggle) {
    setMode(currentMode() === 'skim' ? 'inspect' : 'skim', toggle);
    return;
  }

  const inspect = target?.closest<HTMLButtonElement>(inspectSelector);
  if (inspect) setMode('inspect', inspect);
});
