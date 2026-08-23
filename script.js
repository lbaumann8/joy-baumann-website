document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');
const siteHeader = document.querySelector('.site-header');

navToggle.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen);
});

siteNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Sticky nav: shrink slightly once the page has scrolled
(function initHeaderScroll() {
  if (!siteHeader) return;
  const SCROLL_THRESHOLD = 24;
  let ticking = false;

  function updateHeaderState() {
    siteHeader.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeaderState);
      ticking = true;
    }
  }, { passive: true });

  updateHeaderState();
})();

// Active nav state: scroll-spy on the homepage, static on /contact
(function initNavActiveState() {
  const allNavLinks = Array.from(siteNav.querySelectorAll('a'));
  if (allNavLinks.length === 0) return;

  const navIndicator = document.getElementById('navIndicator');

  function moveIndicatorTo(link) {
    if (!navIndicator || !link) return;
    const navRect = siteNav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    navIndicator.style.left = `${linkRect.left - navRect.left}px`;
    navIndicator.style.width = `${linkRect.width}px`;
    navIndicator.classList.add('is-active');
  }

  const isContactPage = window.location.pathname.replace(/\/index\.html$/, '/') === '/contact'
    || window.location.pathname.endsWith('/contact.html');

  function setActiveLink(href) {
    let activeLink = null;
    allNavLinks.forEach((link) => {
      const isMatch = link.getAttribute('href') === href;
      link.classList.toggle('is-active', isMatch);
      if (isMatch) activeLink = link;
    });
    if (activeLink) moveIndicatorTo(activeLink);
  }

  let navResizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(navResizeTimer);
    navResizeTimer = window.setTimeout(() => {
      const current = allNavLinks.find((link) => link.classList.contains('is-active'));
      if (current) moveIndicatorTo(current);
    }, 200);
  });

  if (isContactPage) {
    setActiveLink('/contact');
    return;
  }

  const hashLinks = allNavLinks
    .map((link) => ({ link, hash: (link.getAttribute('href') || '').split('#')[1] }))
    .filter((entry) => entry.hash)
    .map((entry) => ({ ...entry, section: document.getElementById(entry.hash) }))
    .filter((entry) => entry.section);

  if (hashLinks.length === 0 || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length > 0) {
        const match = hashLinks.find((entry) => entry.section === visible[0].target);
        if (match) setActiveLink(match.link.getAttribute('href'));
      }
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  hashLinks.forEach((entry) => observer.observe(entry.section));
})();

// Scroll reveal: sections, cards, images fade/rise into place; the story
// line draws in as its connector crosses the viewport.
(function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal, .reveal-card, .reveal-img').forEach((el) => el.classList.add('is-visible'));
    document.querySelectorAll('.story-connector').forEach((el) => el.classList.add('is-drawn'));
    return;
  }

  const revealTargets = document.querySelectorAll('.reveal, .reveal-card, .reveal-img');
  if (revealTargets.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  const connectorTargets = document.querySelectorAll('.story-connector');
  if (connectorTargets.length > 0) {
    const connectorObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-drawn');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    connectorTargets.forEach((el) => connectorObserver.observe(el));
  }
})();

// Reviews motif: a few pixels of parallax drift, decorative only
(function initMotifParallax() {
  const motif = document.querySelector('.reviews-motif');
  if (!motif) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;

  function update() {
    const rect = motif.parentElement.getBoundingClientRect();
    const center = rect.top + rect.height / 2 - window.innerHeight / 2;
    const offset = Math.max(-14, Math.min(14, center * -0.04));
    motif.style.transform = `translate(-50%, calc(-50% + ${offset}px))`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
})();

// Contact form (placeholder submit handler — no backend wired up yet)
const contactForm = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formNote.textContent = 'Thank you — your message has been received.';
    contactForm.reset();
  });
}

// ---------- Reviews ----------
(function initReviews() {
  const section = document.getElementById('reviews');
  if (!section) return;

  const REVIEW_TEXT_MAX = 1500;

  const leaveReviewBtn = document.getElementById('leaveReviewBtn');

  const overlay = document.getElementById('reviewModalOverlay');
  const modal = document.getElementById('reviewModal');
  const closeBtn = document.getElementById('reviewModalClose');
  const formView = document.getElementById('reviewFormView');
  const successView = document.getElementById('reviewSuccessView');
  const successCloseBtn = document.getElementById('reviewSuccessCloseBtn');
  const form = document.getElementById('reviewForm');
  const nameInput = document.getElementById('reviewName');
  const textInput = document.getElementById('reviewText');
  const ratingHidden = document.getElementById('reviewRating');
  const starRating = document.getElementById('starRating');
  const starBtns = Array.from(starRating.querySelectorAll('.star-btn'));
  const charCountEl = document.getElementById('reviewCharCount');
  const formErrorEl = document.getElementById('reviewFormError');
  const submitBtn = document.getElementById('reviewSubmitBtn');

  const fieldErrorEls = {
    name: document.getElementById('reviewNameError'),
    rating: document.getElementById('reviewRatingError'),
    review_text: document.getElementById('reviewTextError'),
  };
  const fieldInputEls = {
    name: nameInput,
    review_text: textInput,
  };

  let allReviews = [];
  let lastFocusedEl = null;
  let currentRating = 0;

  function starGlyphs(rating) {
    const full = Math.round(rating);
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += i <= full ? '★' : '<span class="star-empty">★</span>';
    }
    return out;
  }

  function addNewReview(review) {
    allReviews = [review, ...allReviews];
    renderTestimonialStrip(allReviews);
  }

  // ----- Featured review wheel: slow, continuous, seamless horizontal marquee -----
  const stripEl = document.getElementById('testimonialStrip');
  const stripViewport = document.getElementById('testimonialViewport');

  const MARQUEE_SPEED_PX_S = 42;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stripReviews = [];

  function renderTestimonialItem(review, isDuplicate) {
    const item = document.createElement('div');
    item.className = 'testimonial-item';
    item.setAttribute('role', 'group');
    item.setAttribute('aria-roledescription', 'review');
    if (isDuplicate) item.setAttribute('aria-hidden', 'true');

    const stars = document.createElement('div');
    stars.className = 'testimonial-stars';
    stars.setAttribute('aria-hidden', 'true');
    stars.innerHTML = starGlyphs(review.rating);

    const quote = document.createElement('blockquote');
    quote.className = 'testimonial-quote';
    quote.textContent = `“${review.review_text}”`;

    const name = document.createElement('cite');
    name.className = 'testimonial-name';
    name.textContent = `— ${review.name}`;

    item.appendChild(stars);
    item.appendChild(quote);
    item.appendChild(name);
    return item;
  }

  function renderDivider() {
    const divider = document.createElement('span');
    divider.className = 'testimonial-divider';
    divider.setAttribute('aria-hidden', 'true');
    divider.textContent = '✦';
    return divider;
  }

  function appendReviewSet(track, reviews, isDuplicate) {
    reviews.forEach((review, i) => {
      if (i > 0) track.appendChild(renderDivider());
      track.appendChild(renderTestimonialItem(review, isDuplicate));
    });
  }

  function updateMarqueeSpeed() {
    const track = stripViewport.querySelector('.testimonial-track');
    if (!track) return;
    const halfWidth = track.scrollWidth / 2;
    const duration = Math.max(halfWidth / MARQUEE_SPEED_PX_S, 20);
    track.style.setProperty('--marquee-duration', `${duration}s`);
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), wait);
    };
  }

  function renderTestimonialStrip(reviews) {
    stripReviews = Array.isArray(reviews) ? reviews : [];
    stripViewport.innerHTML = '';
    stripEl.hidden = false;

    const track = document.createElement('div');
    track.className = 'testimonial-track';
    stripViewport.appendChild(track);

    if (stripReviews.length === 0) {
      stripEl.classList.add('is-empty');
      const empty = document.createElement('p');
      empty.className = 'testimonial-empty';
      empty.textContent = 'Be the first to share your experience.';
      track.appendChild(empty);
      return;
    }

    stripEl.classList.remove('is-empty');

    if (prefersReducedMotion) {
      stripEl.classList.add('is-static');
      appendReviewSet(track, stripReviews, false);
      return;
    }

    stripEl.classList.remove('is-static');
    appendReviewSet(track, stripReviews, false);
    track.appendChild(renderDivider());
    appendReviewSet(track, stripReviews, true);

    window.requestAnimationFrame(() => window.requestAnimationFrame(updateMarqueeSpeed));
  }

  window.addEventListener('resize', debounce(() => {
    if (!prefersReducedMotion) updateMarqueeSpeed();
  }, 200));

  async function loadReviews() {
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      allReviews = Array.isArray(data.reviews) ? data.reviews : [];
      renderTestimonialStrip(allReviews);
    } catch (err) {
      renderTestimonialStrip([]);
    }
  }

  // ----- Modal open/close -----
  function getFocusableEls() {
    return Array.from(
      modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]')
    ).filter((el) => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
  }

  function openModal() {
    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    showFormView();
    window.setTimeout(() => nameInput.focus(), 20);
    document.addEventListener('keydown', onKeydown);
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = getFocusableEls();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  leaveReviewBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  successCloseBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  function showFormView() {
    formView.hidden = false;
    successView.hidden = true;
    modal.classList.remove('is-success');
  }

  function showSuccessView() {
    formView.hidden = true;
    successView.hidden = false;
    modal.classList.add('is-success');
    successCloseBtn.focus();
  }

  // ----- Star rating -----
  function setRating(value) {
    currentRating = value;
    ratingHidden.value = String(value);
    starBtns.forEach((btn) => {
      const btnValue = Number(btn.dataset.value);
      const filled = btnValue <= value;
      btn.classList.toggle('is-filled', filled);
      btn.setAttribute('aria-checked', String(btnValue === value));
    });
    clearFieldError('rating');
  }

  function previewRating(value) {
    starBtns.forEach((btn) => {
      const btnValue = Number(btn.dataset.value);
      btn.classList.toggle('is-hover', value > 0 && btnValue <= value);
    });
  }

  starBtns.forEach((btn) => {
    btn.addEventListener('click', () => setRating(Number(btn.dataset.value)));
    btn.addEventListener('mouseenter', () => previewRating(Number(btn.dataset.value)));
    btn.addEventListener('focus', () => previewRating(Number(btn.dataset.value)));
  });
  starRating.addEventListener('mouseleave', () => previewRating(0));
  starRating.addEventListener('focusout', (e) => {
    if (!starRating.contains(e.relatedTarget)) previewRating(0);
  });
  starRating.addEventListener('keydown', (e) => {
    const currentIndex = starBtns.indexOf(document.activeElement);
    if (currentIndex === -1) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = starBtns[Math.min(currentIndex + 1, starBtns.length - 1)];
      next.focus();
      setRating(Number(next.dataset.value));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = starBtns[Math.max(currentIndex - 1, 0)];
      prev.focus();
      setRating(Number(prev.dataset.value));
    }
  });

  // ----- Character count -----
  textInput.addEventListener('input', () => {
    const len = textInput.value.length;
    charCountEl.textContent = `${len} / ${REVIEW_TEXT_MAX}`;
    clearFieldError('review_text');
  });
  nameInput.addEventListener('input', () => clearFieldError('name'));

  function clearFieldError(field) {
    if (fieldErrorEls[field]) fieldErrorEls[field].textContent = '';
    if (fieldInputEls[field]) fieldInputEls[field].classList.remove('field-invalid');
  }

  function setFieldError(field, message) {
    if (fieldErrorEls[field]) fieldErrorEls[field].textContent = message;
    if (fieldInputEls[field]) fieldInputEls[field].classList.add('field-invalid');
    if (field === 'rating') starRating.classList.add('field-invalid');
  }

  function clearAllErrors() {
    Object.keys(fieldErrorEls).forEach(clearFieldError);
    starRating.classList.remove('field-invalid');
    formErrorEl.textContent = '';
  }

  function validateClientSide() {
    const errors = {};
    const name = nameInput.value.trim();
    if (name.length < 2 || name.length > 80) {
      errors.name = 'Name must be between 2 and 80 characters.';
    }
    if (currentRating < 1 || currentRating > 5) {
      errors.rating = 'Please select a rating between 1 and 5.';
    }
    const text = textInput.value.trim();
    if (text.length === 0) {
      errors.review_text = 'Please write a review before submitting.';
    } else if (text.length > REVIEW_TEXT_MAX) {
      errors.review_text = `Review must be ${REVIEW_TEXT_MAX} characters or fewer.`;
    }
    return errors;
  }

  function resetForm() {
    form.reset();
    setRating(0);
    ratingHidden.value = '';
    currentRating = 0;
    charCountEl.textContent = `0 / ${REVIEW_TEXT_MAX}`;
    clearAllErrors();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const errors = validateClientSide();
    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([field, message]) => setFieldError(field, message));
      const firstField = Object.keys(errors)[0];
      if (fieldInputEls[firstField]) fieldInputEls[firstField].focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const payload = {
        name: nameInput.value.trim(),
        rating: currentRating,
        review_text: textInput.value.trim(),
        website: document.getElementById('reviewWebsite').value,
      };
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        resetForm();
        showSuccessView();
        if (data.review) addNewReview(data.review);
      } else if (res.status === 400 && data.errors) {
        Object.entries(data.errors).forEach(([field, message]) => setFieldError(field, message));
      } else {
        formErrorEl.textContent = data.error || 'Something went wrong. Please try again.';
      }
    } catch (err) {
      formErrorEl.textContent = 'Something went wrong. Please check your connection and try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Review';
    }
  });

  loadReviews();
})();
