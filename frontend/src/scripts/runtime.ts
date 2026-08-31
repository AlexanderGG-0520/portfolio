type Profile = {
  role: string;
  thesis: string;
};

const setText = (selector: string, value: string) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = value;
  });
};

async function hydrateRuntime() {
  try {
    const [healthResponse, profileResponse] = await Promise.all([
      fetch('/api/health', { headers: { Accept: 'application/json' } }),
      fetch('/api/profile', { headers: { Accept: 'application/json' } }),
    ]);

    if (!healthResponse.ok || !profileResponse.ok) throw new Error('backend unavailable');
    const profile = (await profileResponse.json()) as Profile;
    setText('[data-api-status]', 'healthy');
    setText('[data-profile-role]', profile.role);
    setText('[data-profile-thesis]', profile.thesis);
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
