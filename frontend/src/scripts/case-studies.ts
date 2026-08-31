const root = document.querySelector<HTMLElement>('[data-case-studies]');

if (root) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealTargets = Array.from(root.querySelectorAll<HTMLElement>('.case-reveal'));

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((target) => {
      target.dataset.visible = 'true';
    });
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          target.dataset.visible = 'true';
          observer.unobserve(target);
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    revealTargets.forEach((target) => observer.observe(target));
  }

  root.querySelectorAll<HTMLAnchorElement>('[data-case-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetID = link.dataset.caseTarget;
      if (!targetID) return;

      const target = document.getElementById(targetID);
      if (!target) return;

      if (!reducedMotion) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      target.dataset.active = 'true';
      window.setTimeout(() => {
        delete target.dataset.active;
      }, reducedMotion ? 0 : 760);
    });
  });
}
