const trigger = document.querySelector<HTMLAnchorElement>('[data-architecture-trigger]');
const heroField = document.querySelector<HTMLElement>('.system-field');
const architecture = document.querySelector<HTMLElement>('[data-architecture-layer]');

if (architecture) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const revealArchitecture = () => {
    architecture.dataset.visible = 'true';
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          revealArchitecture();
          observer.disconnect();
          break;
        }
      }
    },
    { rootMargin: '-12% 0px -18%', threshold: 0.08 },
  );

  observer.observe(architecture);

  trigger?.addEventListener('click', (event) => {
    event.preventDefault();

    const finishNavigation = () => {
      architecture.scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
        block: 'start',
      });
      history.replaceState(null, '', '#architecture');
      revealArchitecture();
    };

    if (reducedMotion.matches || !heroField) {
      finishNavigation();
      return;
    }

    document.documentElement.dataset.architectureTrace = 'active';

    heroField.animate(
      [
        { transform: 'translate3d(0, -50%, 0) scale(1)', opacity: 1 },
        { transform: 'translate3d(-1.5%, -50%, 0) scale(1.045)', opacity: 1, offset: 0.5 },
        { transform: 'translate3d(-1%, -46%, 0) scale(1.075)', opacity: 0.72 },
      ],
      {
        duration: 420,
        easing: 'cubic-bezier(.2,.78,.2,1)',
        fill: 'none',
      },
    );

    trigger.animate(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: 'translate3d(5px, 0, 0)' },
        { transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: 280, easing: 'cubic-bezier(.2,.78,.2,1)' },
    );

    window.setTimeout(finishNavigation, 155);
    window.setTimeout(() => {
      delete document.documentElement.dataset.architectureTrace;
    }, 780);
  });

  if (window.location.hash === '#architecture') {
    revealArchitecture();
  }
}
