const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveals = Array.from(document.querySelectorAll<HTMLElement>('.evidence-reveal'));
const incident = document.querySelector<HTMLElement>('[data-incident-record]');

if (reducedMotion || !('IntersectionObserver' in window)) {
  reveals.forEach((element) => {
    element.dataset.visible = 'true';
  });
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.dataset.visible = 'true';
        observer.unobserve(element);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );

  reveals.forEach((element) => revealObserver.observe(element));
}

if (incident && !reducedMotion && 'IntersectionObserver' in window) {
  const incidentObserver = new IntersectionObserver(
    (entries, observer) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      incident.dataset.active = 'true';
      observer.disconnect();
    },
    { threshold: 0.42 },
  );
  incidentObserver.observe(incident);
}
