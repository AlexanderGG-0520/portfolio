const visualViewport = window.visualViewport;
const touchFirst = window.matchMedia('(hover: none) and (pointer: coarse)');
const productionPortfolio = document.body.dataset.design === 'c';
const supportsCssZoom = CSS.supports('zoom', '1');

if (visualViewport && touchFirst.matches && productionPortfolio && supportsCssZoom) {
  const touchPointers = new Set<number>();
  let platformScale = Math.min(1, Math.max(0.5, visualViewport.scale || 1));
  let userScale = 1;
  let active = platformScale < 0.98;
  let gestureUntil = 0;
  let frame = 0;

  const clampPlatformScale = (value: number) => Math.min(1, Math.max(0.5, value));

  const applyCompensation = () => {
    if (!active) {
      document.body.style.removeProperty('zoom');
      delete document.documentElement.dataset.browserScaleCompensated;
      document.documentElement.style.removeProperty('--browser-platform-scale');
      document.documentElement.style.removeProperty('--browser-scale-compensation');
      return;
    }

    const compensation = 1 / platformScale;
    document.body.style.setProperty('zoom', compensation.toFixed(6));
    document.documentElement.dataset.browserScaleCompensated = 'true';
    document.documentElement.style.setProperty('--browser-platform-scale', platformScale.toFixed(6));
    document.documentElement.style.setProperty('--browser-scale-compensation', compensation.toFixed(6));
  };

  const userZoomGestureActive = () => touchPointers.size >= 2 || performance.now() < gestureUntil;

  const reconcile = () => {
    frame = 0;

    if (!touchFirst.matches || document.body.dataset.design !== 'c') {
      active = false;
      applyCompensation();
      return;
    }

    const rawScale = visualViewport.scale || 1;
    if (!Number.isFinite(rawScale) || rawScale <= 0) return;

    if (!active) {
      if (rawScale >= 0.98) return;
      platformScale = clampPlatformScale(rawScale);
      userScale = 1;
      active = true;
    } else if (userZoomGestureActive()) {
      /*
       * Preserve intentional pinch / trackpad zoom as a multiplier above the
       * browser-managed Android desktop scale. The platform compensation stays
       * fixed while the user gesture is active.
       */
      userScale = Math.max(0.5, rawScale / platformScale);
    } else {
      /*
       * No zoom gesture is active, so a raw VisualViewport scale change is
       * browser/platform-owned. Chromium's Android desktop zoom can change its
       * transparent platform factor at runtime; absorb that change while
       * preserving any user zoom multiplier recorded above.
       */
      platformScale = clampPlatformScale(rawScale / userScale);
    }

    applyCompensation();
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(reconcile);
  };

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    touchPointers.add(event.pointerId);
    if (touchPointers.size >= 2) gestureUntil = performance.now() + 300;
  }, { passive: true });

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' && touchPointers.size >= 2) {
      gestureUntil = performance.now() + 300;
    }
  }, { passive: true });

  const releasePointer = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    touchPointers.delete(event.pointerId);
    gestureUntil = performance.now() + 300;
    schedule();
  };

  window.addEventListener('pointerup', releasePointer, { passive: true });
  window.addEventListener('pointercancel', releasePointer, { passive: true });

  window.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    gestureUntil = performance.now() + 350;
  }, { passive: true });

  window.addEventListener('dblclick', () => {
    gestureUntil = performance.now() + 350;
  }, { passive: true });

  visualViewport.addEventListener('resize', schedule, { passive: true });
  visualViewport.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(() => {
      const rawScale = visualViewport.scale || 1;
      platformScale = clampPlatformScale(rawScale);
      userScale = 1;
      active = platformScale < 0.98;
      applyCompensation();
    });
  }, { passive: true });

  applyCompensation();
}
