document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('nav');

  function setNavOpen(open) {
    if (!nav) return;
    if (open) {
      nav.classList.add('show');
      navToggle.setAttribute('aria-expanded', 'true');
    } else {
      nav.classList.remove('show');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      setNavOpen(!nav.classList.contains('show'));
    });
    // close nav when clicking a link
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNavOpen(false)));
  }

  // Smooth scrolling for internal links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = link.getAttribute('href');
      if (target && target.startsWith('#')) {
        e.preventDefault();
        const el = document.querySelector(target);
        if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
      }
    });
  });

  /* --- Reveal animations (on load + on scroll) --- */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealOnLoad() {
    const els = document.querySelectorAll('.animate-load');
    els.forEach((el, i) => {
      if (prefersReduced) {
        el.classList.add('is-visible');
        return;
      }
      const delay = el.dataset.delay ? Number(el.dataset.delay) : i * 80;
      el.style.transitionDelay = `${delay}ms`;
      // If element is a typing headline, run typing first then reveal
      if (el.classList.contains('typing')) {
        // make visible immediately so typed chars are visible as they appear
        el.classList.add('is-visible');
        const text = el.dataset.text || el.textContent || '';
        const speed = el.dataset.speed ? Number(el.dataset.speed) : 60;
        // clear content then type
        el.textContent = '';
        typeText(el, text, speed).then(() => {
          el.classList.add('typed');
        });
      } else {
        // ensure the class toggles on next frame so transitions run
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
      }
    });
  }

  function initScrollObserver() {
    const items = document.querySelectorAll('.animate-on-scroll');
    if (!items.length) return;
    if (prefersReduced) {
      items.forEach(e => e.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        const el = entry.target;
        const delay = el.dataset.delay ? Number(el.dataset.delay) : 0;
        
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('is-visible');
          
          // Handle typing animation reset and replay
          if (el.classList.contains('typing')) {
            el.classList.remove('typed');
            const text = el.dataset.text || '';
            const speed = el.dataset.speed ? Number(el.dataset.speed) : 60;
            el.textContent = '';
            typeText(el, text, speed).then(() => {
              el.classList.add('typed');
            });
          }
        } else {
          el.style.transitionDelay = '0ms';
          el.classList.remove('is-visible');
          // Reset typing animation state
          if (el.classList.contains('typing')) {
            el.classList.remove('typed');
            el.textContent = '';
          }
        }
      });
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    items.forEach(el => io.observe(el));
  }

  // Run reveals
  revealOnLoad();
  initScrollObserver();

});

/* Typing helper returns a promise that resolves when typing finishes */
function typeText(el, text, speed) {
  return new Promise((resolve) => {
    if (!el) return resolve();
    const chars = Array.from(text);
    let i = 0;
    function step() {
      if (i >= chars.length) return resolve();
      el.textContent += chars[i++];
      // randomized small jitter so it looks more human
      const jitter = Math.random() * 40 - 20;
      const delay = Math.max(12, speed + jitter);
      setTimeout(step, delay);
    }
    // small initial delay so caret shows briefly
    setTimeout(step, 60);
  });
}
