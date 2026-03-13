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
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  /* --- 3D Tilt Effect --- */
  function initTiltEffect() {
    const tiltCards = document.querySelectorAll('.tilt-card');

    // Disable on small screens or if user prefers reduced motion
    if (prefersReduced || !tiltCards.length || window.matchMedia('(max-width: 768px)').matches) return;

    tiltCards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        card.style.transition = 'none';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.style.transition = 'transform 0.5s ease';
      });

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'transform 0.1s ease';
      });
    });
  }

  /* --- Cursor Background Glow --- */
  function initCursorGlow() {
    if (prefersReduced || window.matchMedia('(max-width: 768px)').matches) return;

    const glow = document.createElement('div');
    glow.style.position = 'fixed';
    glow.style.top = '0';
    glow.style.left = '0';
    glow.style.width = '600px';
    glow.style.height = '600px';
    glow.style.borderRadius = '50%';
    glow.style.background = 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, rgba(6, 182, 212, 0) 70%)';
    glow.style.pointerEvents = 'none';
    glow.style.transform = 'translate(-50%, -50%)';
    glow.style.zIndex = '0';
    glow.style.transition = 'opacity 0.3s ease';
    glow.style.opacity = '0';

    document.body.appendChild(glow);

    document.addEventListener('mousemove', e => {
      glow.style.opacity = '1';
      requestAnimationFrame(() => {
        glow.style.left = `${e.clientX}px`;
        glow.style.top = `${e.clientY}px`;
      });
    });

    document.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });
  }

  function initThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle) return;

    const icon = themeToggle.querySelector('i');
    const storageKey = 'portfolio-theme';

    function setIcon(isLight) {
      if (!icon) return;
      icon.classList.toggle('fa-moon', !isLight);
      icon.classList.toggle('fa-sun', isLight);
    }

    function applyTheme(theme) {
      const isLight = theme === 'light';
      document.body.classList.toggle('light-theme', isLight);
      setIcon(isLight);
      themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    }

    function getInitialTheme() {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === 'light' || saved === 'dark') return saved;
      } catch (error) {
        // Ignore localStorage failures and fall back to system preference.
      }

      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    applyTheme(getInitialTheme());

    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
      applyTheme(nextTheme);
      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch (error) {
        // Ignore localStorage failures.
      }
    });
  }

  function initProjectsSlider() {
    const sliders = document.querySelectorAll('.projects-slider');
    if (!sliders.length) return;

    sliders.forEach((slider) => {
      const viewport = slider.querySelector('.projects-viewport');
      const track = slider.querySelector('.projects-track');
      const slides = Array.from(slider.querySelectorAll('.project-item'));
      const card = slider.closest('.projects-card');
      const prevBtn = card ? card.querySelector('.projects-nav.prev') : null;
      const nextBtn = card ? card.querySelector('.projects-nav.next') : null;
      const dotsContainer = slider.querySelector('.projects-dots');

      if (!viewport || !track || slides.length <= 1 || !prevBtn || !nextBtn) return;

      let currentIndex = 0;

      function getVisibleSlides() {
        return window.matchMedia('(max-width: 700px)').matches ? 1 : 2;
      }

      function getMaxIndex() {
        return Math.max(0, slides.length - getVisibleSlides());
      }

      function getStepWidth() {
        const slideWidth = slides[0].getBoundingClientRect().width;
        const styles = window.getComputedStyle(track);
        const gapValue = styles.columnGap || styles.gap || '0';
        const gap = Number.parseFloat(gapValue) || 0;
        return slideWidth + gap;
      }

      function renderDots() {
        if (!dotsContainer) return;
        const count = getMaxIndex() + 1;
        dotsContainer.innerHTML = '';

        for (let i = 0; i < count; i += 1) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'projects-dot';
          dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
          dot.addEventListener('click', () => {
            currentIndex = i;
            updateSlider();
          });
          dotsContainer.appendChild(dot);
        }
      }

      function updateDots() {
        if (!dotsContainer) return;
        const dots = dotsContainer.querySelectorAll('.projects-dot');
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === currentIndex);
        });
      }

      function updateSlider() {
        const maxIndex = getMaxIndex();
        currentIndex = Math.min(currentIndex, maxIndex);
        const offset = currentIndex * getStepWidth();
        track.style.transform = `translateX(-${offset}px)`;
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex >= maxIndex;
        updateDots();
      }

      prevBtn.addEventListener('click', () => {
        currentIndex = Math.max(0, currentIndex - 1);
        updateSlider();
      });

      nextBtn.addEventListener('click', () => {
        currentIndex = Math.min(getMaxIndex(), currentIndex + 1);
        updateSlider();
      });

      window.addEventListener('resize', () => {
        const previousCount = dotsContainer ? dotsContainer.childElementCount : 0;
        const nextCount = getMaxIndex() + 1;
        if (previousCount !== nextCount) {
          renderDots();
        }
        updateSlider();
      });

      renderDots();
      updateSlider();
    });
  }

  function initChatWidget() {
    const widget = document.querySelector('.chat-widget');
    if (!widget) return;

    const launcher = widget.querySelector('.chat-launcher');
    const panel = widget.querySelector('.chat-panel');
    const closeBtn = widget.querySelector('.chat-close');
    const form = widget.querySelector('.chat-form');
    const input = widget.querySelector('.chat-input');
    const chatBody = widget.querySelector('.chat-body');
    const sendBtn = widget.querySelector('.chat-send');
    const statusLabel = widget.querySelector('.chat-status-text');
    const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : 'https://personal-portfolio-backend-eight.vercel.app';
    const chatEndpoint = `${apiBase}/chat`;
    const conversationStorageKey = 'portfolio-chat-conversation-id';
    const lastSeenStorageKey = 'portfolio-chat-last-seen';

    let conversationId = '';
    let pollTimer = null;
    let lastSeenAt = '';

    if (!launcher || !panel || !closeBtn || !form || !input || !chatBody || !sendBtn || !statusLabel) return;

    try {
      conversationId = localStorage.getItem(conversationStorageKey) || '';
      lastSeenAt = localStorage.getItem(lastSeenStorageKey) || '';
    } catch (error) {
      conversationId = '';
      lastSeenAt = '';
    }

    function normalizeAssistantReply(text) {
      function normalizeContactValue(value) {
        return String(value || '')
          .trim()
          .replace(/^mailto:/i, '')
          .replace(/^https?:\/\/(www\.)?/i, '')
          .replace(/\/$/, '')
          .toLowerCase();
      }

      return String(text || '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
          const cleanLabel = String(label || '').trim();
          const cleanUrl = String(url || '').trim();
          const normalizedLabel = normalizeContactValue(cleanLabel.replace(/:$/, ''));
          const normalizedUrl = normalizeContactValue(cleanUrl);

          if (normalizedLabel && normalizedLabel === normalizedUrl) {
            return cleanUrl.replace(/^mailto:/i, '');
          }

          return `${cleanLabel}: ${cleanUrl.replace(/^mailto:/i, '')}`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/^[ \t]*[*-][ \t]+/gm, '- ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/([^\n:]+:\s*)(https?:\/\/)?(www\.)?([^\s]+)\s*\n\s*(https?:\/\/[^\s]+)/gi, (match, prefix, protocolA, wwwA, pathA, fullUrl) => {
          const firstValue = `${protocolA || ''}${wwwA || ''}${pathA}`;
          return normalizeContactValue(firstValue) === normalizeContactValue(fullUrl)
            ? `${prefix}${fullUrl}`
            : match;
        })
        .replace(/([^\n:]+:\s*)([^\s]+@[^\s]+)\s*\n\s*\(?mailto:[^)\s]+\)?/gi, '$1$2')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function setStatus(text, active = false) {
      statusLabel.textContent = text;
      statusLabel.classList.toggle('is-active', active);
    }

    function formatLastActive(isoString) {
      if (!isoString) return '';
      const ts = new Date(isoString).getTime();
      if (Number.isNaN(ts)) return '';
      const diffMs = Date.now() - ts;
      const minutes = Math.max(1, Math.floor(diffMs / 60000));

      if (minutes < 60) {
        return `${minutes}m ago`;
      }

      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return `${hours}h ago`;
      }

      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }

    function persistConversationState() {
      try {
        if (conversationId) {
          localStorage.setItem(conversationStorageKey, conversationId);
        }
        if (lastSeenAt) {
          localStorage.setItem(lastSeenStorageKey, lastSeenAt);
        }
      } catch (error) {
        // Ignore storage failures.
      }
    }

    function bubbleExists(messageId) {
      return Boolean(chatBody.querySelector(`[data-message-id="${messageId}"]`));
    }

    function appendBubble(text, variant, messageId = '') {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${variant}`;
      if (messageId) {
        bubble.dataset.messageId = messageId;
      }
      bubble.textContent = variant === 'chat-bubble-reply' ? normalizeAssistantReply(text) : text;
      chatBody.appendChild(bubble);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function applyConversationStatus(status) {
      if (status && status.humanActive) {
        setStatus('Carla joined the chat', true);
      } else {
        const lastActive = formatLastActive(status?.operatorLastSeenAt);
        if (lastActive) {
          setStatus(`Carla is away now - last active ${lastActive}`, false);
        } else {
          setStatus('Carla is away now - AI assistant is replying', false);
        }
      }
    }

    async function pollConversation() {
      if (!conversationId) return;

      try {
        const params = new URLSearchParams();
        if (lastSeenAt) {
          params.set('since', lastSeenAt);
        }

        const response = await fetch(`${apiBase}/conversations/${conversationId}?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || `Conversation poll failed (${response.status}).`);
        }

        const incomingMessages = Array.isArray(data.messages) ? data.messages : [];
        incomingMessages.forEach((message) => {
          if (!message || message.role === 'user' || bubbleExists(message.id)) return;
          appendBubble(message.text, 'chat-bubble-reply', message.id);
          lastSeenAt = message.createdAt || lastSeenAt;
        });

        if (!incomingMessages.length && data.status?.updatedAt) {
          lastSeenAt = data.status.updatedAt;
        }

        applyConversationStatus(data.status);
        persistConversationState();
      } catch (error) {
        setStatus('Waiting for connection', false);
      }
    }

    function startPolling() {
      if (pollTimer) return;
      pollTimer = window.setInterval(() => {
        void pollConversation();
      }, 3500);
    }

    function stopPolling() {
      if (!pollTimer) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    }

    async function requestChatReply(message, attempt = 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(chatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message, conversationId }),
          signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));

        // Retry once for temporary backend/model issues.
        if (!response.ok && attempt === 0 && [429, 500, 502, 503, 504].includes(response.status)) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          return requestChatReply(message, attempt + 1);
        }

        if (!response.ok) {
          const details = data?.details || data?.error || `Request failed (${response.status}).`;
          throw new Error(details);
        }

        if (typeof data?.conversationId === 'string' && data.conversationId) {
          conversationId = data.conversationId;
        }

        if (data?.status) {
          applyConversationStatus(data.status);
          lastSeenAt = data.status.updatedAt || lastSeenAt;
        }

        persistConversationState();
        return {
          reply: data?.reply || 'Thanks for your message. Carla will get back to you soon.',
          status: data?.status || null,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }

    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      if (open) {
        startPolling();
        void pollConversation();
        setTimeout(() => input.focus(), 0);
      } else {
        stopPolling();
      }
    }

    launcher.addEventListener('click', () => {
      setOpen(panel.hidden);
    });

    closeBtn.addEventListener('click', () => {
      setOpen(false);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      appendBubble(message, 'chat-bubble-user');
      input.value = '';
      input.disabled = true;
      sendBtn.disabled = true;
      setStatus('Sending...', false);

      try {
        const { reply, status } = await requestChatReply(message);
        appendBubble(reply, 'chat-bubble-reply');
        if (status) {
          applyConversationStatus(status);
        }
        startPolling();
        void pollConversation();
      } catch (error) {
        const errorMessage = error && typeof error.message === 'string' ? error.message : '';
        const hint = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')
          ? (apiBase.includes('localhost')
            ? 'Local chat server is not reachable. Start it with: node server.js in gemini-portfolio-chatbot.'
            : 'Chat service is temporarily unavailable. Please try again in a moment.')
          : errorMessage || 'I could not reach the AI assistant right now. Please try again in a moment.';

        appendBubble(hint, 'chat-bubble-reply');
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        setOpen(false);
      }
    });

    setStatus('AI assistant is replying first', false);

    if (conversationId) {
      startPolling();
    }
  }

  // Run initializations
  revealOnLoad();
  initScrollObserver();
  initTiltEffect();
  initCursorGlow();
  initThemeToggle();
  initProjectsSlider();
  initChatWidget();

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
