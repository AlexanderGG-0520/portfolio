type RuntimeSnapshot = {
  status: string;
  service: string;
  serverTime: string;
  runtime: {
    language: string;
    version: string;
    startedAt: string;
    uptimeSeconds: number;
  };
  release: {
    version: string;
    revision: string;
    builtAt: string;
  };
  deployment: {
    environment: string;
    orchestrator: string;
    instance: string;
  };
  capabilities: string[];
};

const root = document.querySelector<HTMLElement>('[data-live-runtime]');

const set = (selector: string, value: string) => {
  root?.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = value;
  });
};

let observedUptime = 0;
let observedAt = performance.now();
let uptimeTimer = 0;
let pollTimer = 0;

function formatUptime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function renderUptime() {
  const elapsed = (performance.now() - observedAt) / 1000;
  set('[data-runtime-uptime]', formatUptime(observedUptime + elapsed));
}

function applySnapshot(snapshot: RuntimeSnapshot, latency: number) {
  if (!root) return;

  root.dataset.runtimeState = snapshot.status === 'healthy' ? 'healthy' : 'offline';
  set('[data-runtime-http]', snapshot.status === 'healthy' ? '200 / healthy' : snapshot.status);
  set('[data-runtime-latency]', `${Math.max(0, Math.round(latency))} ms`);
  set('[data-runtime-service]', snapshot.service);
  set('[data-runtime-status]', snapshot.status);
  set('[data-runtime-environment]', snapshot.deployment.environment);
  set('[data-runtime-orchestrator]', snapshot.deployment.orchestrator);
  set('[data-runtime-instance]', snapshot.deployment.instance);
  set('[data-runtime-go]', `${snapshot.runtime.language} / ${snapshot.runtime.version}`);
  set('[data-runtime-version]', snapshot.release.version);
  set('[data-runtime-revision]', snapshot.release.revision);
  set('[data-runtime-started]', snapshot.runtime.startedAt);
  set('[data-runtime-time]', snapshot.serverTime);

  observedUptime = snapshot.runtime.uptimeSeconds;
  observedAt = performance.now();
  renderUptime();
}

function markOffline() {
  if (!root) return;
  root.dataset.runtimeState = 'offline';
  set('[data-runtime-http]', 'unavailable');
  set('[data-runtime-status]', 'offline');
  set('[data-runtime-latency]', '-- ms');
}

async function refreshRuntime() {
  if (!root) return;
  const started = performance.now();

  try {
    const response = await fetch('/api/runtime', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`runtime endpoint returned ${response.status}`);

    const snapshot = await response.json() as RuntimeSnapshot;
    applySnapshot(snapshot, performance.now() - started);
  } catch {
    markOffline();
  }
}

if (root) {
  void refreshRuntime();
  uptimeTimer = window.setInterval(renderUptime, 1000);
  pollTimer = window.setInterval(() => void refreshRuntime(), 15000);

  window.addEventListener('pagehide', () => {
    window.clearInterval(uptimeTimer);
    window.clearInterval(pollTimer);
  }, { once: true });
}
