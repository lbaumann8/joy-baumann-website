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

  const isContactPage = window.location.pathname.replace(/\/index\.html$/, '/') === '/contact'
    || window.location.pathname.endsWith('/contact.html');

  function setActiveLink(href) {
    allNavLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === href);
    });
  }

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

  // ----- Featured review strip: slow, continuous, non-interactive carousel -----
  const stripEl = document.getElementById('testimonialStrip');
  const stripViewport = document.getElementById('testimonialViewport');
  const stripDots = document.getElementById('testimonialDots');

  const STRIP_INTERVAL_MS = 7000;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stripReviews = [];
  let stripIndex = 0;
  let stripTimer = null;

  function renderStripSlide(review, index, total) {
    const slide = document.createElement('div');
    slide.className = 'testimonial-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `Review ${index + 1} of ${total}`);

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

    slide.appendChild(stars);
    slide.appendChild(quote);
    slide.appendChild(name);
    return slide;
  }

  function renderEmptyStripSlide() {
    const slide = document.createElement('div');
    slide.className = 'testimonial-slide';

    const quote = document.createElement('blockquote');
    quote.className = 'testimonial-quote';
    quote.textContent = 'Be the first to share your experience.';

    slide.appendChild(quote);
    return slide;
  }

  function updateStripActive() {
    Array.from(stripViewport.children).forEach((slide, i) => {
      slide.classList.toggle('is-active', i === stripIndex);
    });
    Array.from(stripDots.children).forEach((dot, i) => {
      dot.classList.toggle('is-active', i === stripIndex);
    });
  }

  function stopStripTimer() {
    if (stripTimer) {
      window.clearInterval(stripTimer);
      stripTimer = null;
    }
  }

  function startStripTimer() {
    stopStripTimer();
    if (prefersReducedMotion || stripReviews.length <= 1) return;
    stripTimer = window.setInterval(() => goToStripSlide(stripIndex + 1), STRIP_INTERVAL_MS);
  }

  function goToStripSlide(index) {
    if (stripReviews.length === 0) return;
    stripIndex = (index + stripReviews.length) % stripReviews.length;
    updateStripActive();
  }

  function renderTestimonialStrip(reviews) {
    stripReviews = Array.isArray(reviews) ? reviews : [];
    stopStripTimer();
    stripViewport.innerHTML = '';
    stripDots.innerHTML = '';
    stripIndex = 0;

    if (stripReviews.length === 0) {
      stripEl.hidden = false;
      stripViewport.appendChild(renderEmptyStripSlide());
      updateStripActive();
      return;
    }

    stripEl.hidden = false;

    stripReviews.forEach((review, i) => {
      stripViewport.appendChild(renderStripSlide(review, i, stripReviews.length));

      const dot = document.createElement('span');
      dot.className = 'testimonial-dot';
      stripDots.appendChild(dot);
    });

    stripDots.hidden = stripReviews.length <= 1;

    updateStripActive();
    startStripTimer();
  }

  stripEl.addEventListener('mouseenter', stopStripTimer);
  stripEl.addEventListener('mouseleave', () => {
    if (stripReviews.length > 1) startStripTimer();
  });

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
