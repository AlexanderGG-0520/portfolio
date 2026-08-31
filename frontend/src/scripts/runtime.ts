const setText = (selector: string, value: string) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = value;
  });
};

async function hydrateRuntime() {
  try {
    const healthResponse = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    if (!healthResponse.ok) throw new Error('backend unavailable');

    setText('[data-api-status]', 'healthy');
    document.documentElement.dataset.backend = 'healthy';
  } catch {
    setText('[data-api-status]', 'offline');
    document.documentElement.dataset.backend = 'offline';
  }
}

let frame = 0;
window.addEventListener('pointermove', (event) => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`);
  });
}, { passive: true });

hydrateRuntime();
