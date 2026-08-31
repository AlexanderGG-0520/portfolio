const params = new URLSearchParams(window.location.search);

if (params.get('debugViewport') === '1') {
  type RectSnapshot = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  type Snapshot = {
    at: number;
    reason: string;
    visual: {
      scale: number;
      width: number;
      height: number;
      offsetLeft: number;
      offsetTop: number;
      pageLeft: number;
      pageTop: number;
    } | null;
    window: {
      innerWidth: number;
      innerHeight: number;
      outerWidth: number;
      outerHeight: number;
      scrollX: number;
      scrollY: number;
      dpr: number;
    };
    document: {
      clientWidth: number;
      clientHeight: number;
      bodyWidth: number;
      rootFontPx: number;
      rootZoom: string;
    };
    screen: {
      width: number;
      height: number;
      availWidth: number;
      availHeight: number;
      orientation: string;
    };
    media: {
      compact: boolean;
      coarse: boolean;
      hoverNone: boolean;
    };
    hero: RectSnapshot | null;
    field: RectSnapshot | null;
    canvas: RectSnapshot | null;
    surface: RectSnapshot | null;
  };

  const round = (value: number, digits = 2) => Number(value.toFixed(digits));
  const rectOf = (selector: string): RectSnapshot | null => {
    const node = document.querySelector<HTMLElement>(selector);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
    };
  };

  const readSnapshot = (reason: string): Snapshot => {
    const vv = window.visualViewport;
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      at: performance.now(),
      reason,
      visual: vv
        ? {
            scale: round(vv.scale, 4),
            width: round(vv.width),
            height: round(vv.height),
            offsetLeft: round(vv.offsetLeft),
            offsetTop: round(vv.offsetTop),
            pageLeft: round(vv.pageLeft),
            pageTop: round(vv.pageTop),
          }
        : null,
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        scrollX: round(window.scrollX),
        scrollY: round(window.scrollY),
        dpr: round(window.devicePixelRatio || 1, 4),
      },
      document: {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        bodyWidth: round(document.body.getBoundingClientRect().width),
        rootFontPx: round(Number.parseFloat(rootStyle.fontSize) || 0),
        rootZoom: rootStyle.zoom || 'normal',
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        orientation: window.screen.orientation
          ? `${window.screen.orientation.type} ${window.screen.orientation.angle}deg`
          : 'unknown',
      },
      media: {
        compact: window.matchMedia('(max-width: 1180px), (hover: none) and (pointer: coarse)').matches,
        coarse: window.matchMedia('(pointer: coarse)').matches,
        hoverNone: window.matchMedia('(hover: none)').matches,
      },
      hero: rectOf('.home-copy h1'),
      field: rectOf('.system-field'),
      canvas: rectOf('#gpu-background'),
      surface: rectOf('.site-surface'),
    };
  };

  const metricLines = (snapshot: Snapshot, baseline: Snapshot) => {
    const delta = (now: number, base: number) => {
      const value = round(now - base);
      return `${value >= 0 ? '+' : ''}${value}`;
    };
    const rectLine = (name: string, rect: RectSnapshot | null, base: RectSnapshot | null) => {
      if (!rect || !base) return `${name.padEnd(8)} n/a`;
      return `${name.padEnd(8)} ${rect.width}x${rect.height}  Δ ${delta(rect.width, base.width)} x ${delta(rect.height, base.height)}  @ ${rect.x},${rect.y}`;
    };

    const vv = snapshot.visual;
    const bv = baseline.visual;
    const vvLine = vv && bv
      ? `visual   ${vv.width}x${vv.height} scale=${vv.scale}  Δ ${delta(vv.width, bv.width)} x ${delta(vv.height, bv.height)}  scaleΔ=${delta(vv.scale, bv.scale)}`
      : 'visual   unavailable';

    return [
      vvLine,
      `inner    ${snapshot.window.innerWidth}x${snapshot.window.innerHeight}  Δ ${delta(snapshot.window.innerWidth, baseline.window.innerWidth)} x ${delta(snapshot.window.innerHeight, baseline.window.innerHeight)}`,
      `client   ${snapshot.document.clientWidth}x${snapshot.document.clientHeight}  Δ ${delta(snapshot.document.clientWidth, baseline.document.clientWidth)} x ${delta(snapshot.document.clientHeight, baseline.document.clientHeight)}`,
      `outer    ${snapshot.window.outerWidth}x${snapshot.window.outerHeight}`,
      `screen   ${snapshot.screen.width}x${snapshot.screen.height}  ${snapshot.screen.orientation}`,
      `dpr      ${snapshot.window.dpr}  Δ ${delta(snapshot.window.dpr, baseline.window.dpr)}`,
      `root     ${snapshot.document.rootFontPx}px zoom=${snapshot.document.rootZoom}`,
      rectLine('hero', snapshot.hero, baseline.hero),
      rectLine('field', snapshot.field, baseline.field),
      rectLine('canvas', snapshot.canvas, baseline.canvas),
      rectLine('surface', snapshot.surface, baseline.surface),
      `media    compact=${snapshot.media.compact} coarse=${snapshot.media.coarse} hoverNone=${snapshot.media.hoverNone}`,
      `scroll   ${snapshot.window.scrollX},${snapshot.window.scrollY}`,
    ];
  };

  const materiallyDifferent = (a: Snapshot, b: Snapshot) => {
    const values = (s: Snapshot) => [
      s.visual?.scale ?? 1,
      s.visual?.width ?? 0,
      s.visual?.height ?? 0,
      s.window.innerWidth,
      s.window.innerHeight,
      s.document.clientWidth,
      s.document.clientHeight,
      s.window.dpr,
      s.hero?.width ?? 0,
      s.hero?.height ?? 0,
      s.field?.width ?? 0,
      s.field?.height ?? 0,
      s.canvas?.width ?? 0,
      s.canvas?.height ?? 0,
    ];
    const av = values(a);
    const bv = values(b);
    return av.some((value, index) => Math.abs(value - bv[index]) >= 0.25);
  };

  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Viewport debug telemetry');
  Object.assign(panel.style, {
    position: 'fixed',
    zIndex: '2147483647',
    top: '8px',
    right: '8px',
    width: 'min(460px, calc(100vw - 16px))',
    maxHeight: '52vh',
    overflow: 'auto',
    padding: '10px 12px',
    border: '1px solid rgba(137,180,250,.55)',
    borderRadius: '8px',
    background: 'rgba(17,17,27,.94)',
    color: '#cdd6f4',
    boxShadow: '0 12px 44px rgba(0,0,0,.45)',
    font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    whiteSpace: 'pre-wrap',
    userSelect: 'text',
    pointerEvents: 'auto',
  });

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.gap = '8px';
  header.style.marginBottom = '8px';
  header.innerHTML = '<strong>viewport debug</strong>';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = 'copy';
  Object.assign(copyButton.style, {
    border: '1px solid rgba(137,180,250,.4)',
    borderRadius: '5px',
    padding: '2px 8px',
    background: 'rgba(49,50,68,.75)',
    color: '#cdd6f4',
    font: 'inherit',
  });
  header.append(copyButton);

  const currentPre = document.createElement('pre');
  currentPre.style.margin = '0';
  currentPre.style.font = 'inherit';

  const historyPre = document.createElement('pre');
  historyPre.style.margin = '10px 0 0';
  historyPre.style.paddingTop = '8px';
  historyPre.style.borderTop = '1px solid rgba(69,71,90,.65)';
  historyPre.style.font = 'inherit';
  historyPre.style.color = '#bac2de';

  panel.append(header, currentPre, historyPre);
  document.body.append(panel);

  const baseline = readSnapshot('baseline');
  let previous = baseline;
  const history: Snapshot[] = [baseline];

  const render = (snapshot: Snapshot) => {
    currentPre.textContent = metricLines(snapshot, baseline).join('\n');
    const recent = history.slice(-8).map((entry) => {
      const elapsed = ((entry.at - baseline.at) / 1000).toFixed(2);
      const vv = entry.visual;
      return `${elapsed.padStart(6)}s ${entry.reason.padEnd(18)} vv=${vv ? `${vv.width}x${vv.height}@${vv.scale}` : 'n/a'} inner=${entry.window.innerWidth}x${entry.window.innerHeight} hero=${entry.hero ? `${entry.hero.width}x${entry.hero.height}` : 'n/a'} field=${entry.field ? `${entry.field.width}x${entry.field.height}` : 'n/a'}`;
    });
    historyPre.textContent = `changes\n${recent.join('\n')}`;
  };

  const sample = (reason: string) => {
    const snapshot = readSnapshot(reason);
    if (materiallyDifferent(snapshot, previous)) {
      history.push(snapshot);
      previous = snapshot;
    }
    render(snapshot);
  };

  copyButton.addEventListener('click', async () => {
    const text = `${currentPre.textContent ?? ''}\n\n${historyPre.textContent ?? ''}`;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = 'copied';
      window.setTimeout(() => { copyButton.textContent = 'copy'; }, 1200);
    } catch {
      copyButton.textContent = 'select text';
    }
  });

  window.addEventListener('resize', () => sample('window.resize'), { passive: true });
  window.addEventListener('orientationchange', () => sample('orientationchange'), { passive: true });
  window.visualViewport?.addEventListener('resize', () => sample('visual.resize'), { passive: true });
  window.visualViewport?.addEventListener('scroll', () => sample('visual.scroll'), { passive: true });

  const observed = [
    document.querySelector('.home-copy h1'),
    document.querySelector('.system-field'),
    document.querySelector('#gpu-background'),
    document.querySelector('.site-surface'),
  ].filter((node): node is Element => Boolean(node));

  if ('ResizeObserver' in window && observed.length > 0) {
    const observer = new ResizeObserver(() => sample('ResizeObserver'));
    observed.forEach((node) => observer.observe(node));
  }

  window.setInterval(() => sample('interval'), 250);
  render(baseline);

  (window as typeof window & { __viewportDebugSnapshots?: Snapshot[] }).__viewportDebugSnapshots = history;
}
