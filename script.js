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
});
