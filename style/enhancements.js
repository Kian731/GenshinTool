(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('header');
  const progress = document.createElement('div');
  progress.className = 'style-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  document.body.prepend(progress);

  function updateScroll() {
    const top = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header?.classList.toggle('is-scrolled', top > 10);
    progress.firstElementChild?.style.setProperty('--progress', `${max > 0 ? Math.min(100, top / max * 100) : 0}%`);
  }

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .06, rootMargin: '0px 0px -18px' });

  function prepareNewCards(root = document) {
    if (reduceMotion.matches) return;
    root.querySelectorAll('.card:not(.reveal-item), .panel:not(.reveal-item)').forEach((element, index) => {
      element.classList.add('reveal-item');
      element.style.transitionDelay = `${Math.min(index % 12, 8) * 24}ms`;
      revealObserver.observe(element);
    });
  }

  const contentObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) prepareNewCards(node.parentElement || document);
    }));
    updateScroll();
  });

  document.querySelectorAll('#grid, #calcview, #pickgrid').forEach(root => contentObserver.observe(root, { childList: true, subtree: true }));

  let frame = 0;
  window.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { updateScroll(); frame = 0; });
  }, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });

  document.addEventListener('keydown', event => {
    const active = document.activeElement;
    const typing = active && /INPUT|SELECT|TEXTAREA/.test(active.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      document.querySelector('#q')?.focus();
    }
  });

  prepareNewCards();
  updateScroll();
})();
