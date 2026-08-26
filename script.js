document.getElementById('year').textContent = new Date().getFullYear();

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
  const MARQUEE_MIN_REVIEWS = 2;
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

    if (!isDuplicate) {
      const viewMore = document.createElement('a');
      viewMore.className = 'testimonial-view-more';
      viewMore.href = review.id != null ? `/reviews#review-${review.id}` : '/reviews';
      viewMore.textContent = 'View more';
      viewMore.hidden = true;
      item.appendChild(viewMore);
      // Deferred: the quote isn't laid out with its line-clamp yet, so
      // scrollHeight vs. clientHeight can't be measured until it's in the DOM.
      item.dataset.pendingTruncationCheck = 'true';
    }

    item.appendChild(name);

    return item;
  }

  // Line-clamp only clips visually — it doesn't tell us whether a quote was
  // actually cut short. Measure each one once it's laid out in the live DOM
  // and reveal "View more" only where text was truly truncated.
  function revealTruncatedLinks(track) {
    track.querySelectorAll('.testimonial-item[data-pending-truncation-check]').forEach((item) => {
      delete item.dataset.pendingTruncationCheck;
      const quote = item.querySelector('.testimonial-quote');
      const link = item.querySelector('.testimonial-view-more');
      if (!quote || !link) return;
      if (quote.scrollHeight > quote.clientHeight + 1) {
        link.hidden = false;
      }
    });
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

  // Trailing divider after every item (including the last) so two copies of
  // this unit placed back-to-back are pixel-identical halves — the marquee
  // can then loop by exactly 50% with no seam or jump.
  function appendReviewUnit(track, reviews, isDuplicate) {
    reviews.forEach((review) => {
      track.appendChild(renderTestimonialItem(review, isDuplicate));
      track.appendChild(renderDivider());
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

  // No reviews yet: keep the moving wheel out of the DOM flow entirely —
  // only the static Kind Words / Leave a Review invitation shows. The wheel
  // reappears the moment a review exists. A single review (or too few to
  // loop meaningfully) renders as one clean centered card instead of an
  // infinite marquee — the rotating behavior only earns its keep once
  // there's a real set of reviews to cycle through.
  function renderTestimonialStrip(reviews) {
    stripReviews = Array.isArray(reviews) ? reviews : [];
    stripViewport.innerHTML = '';

    if (stripReviews.length === 0) {
      stripEl.hidden = true;
      return;
    }

    stripEl.hidden = false;

    const track = document.createElement('div');
    track.className = 'testimonial-track';
    stripViewport.appendChild(track);

    const useMarquee = !prefersReducedMotion && stripReviews.length >= MARQUEE_MIN_REVIEWS;

    if (!useMarquee) {
      stripEl.classList.add('is-static');
      appendReviewSet(track, stripReviews, false);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => revealTruncatedLinks(track)));
      return;
    }

    stripEl.classList.remove('is-static');
    appendReviewUnit(track, stripReviews, false);
    appendReviewUnit(track, stripReviews, true);

    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      updateMarqueeSpeed();
      revealTruncatedLinks(track);
    }));
  }

  window.addEventListener('resize', debounce(() => {
    if (!prefersReducedMotion) updateMarqueeSpeed();
  }, 200));

  async function loadReviews() {
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      allReviews = Array.isArray(data.reviews) ? data.reviews : [];
    } catch (err) {
      allReviews = [];
    }
    renderTestimonialStrip(allReviews);
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

// ---------- Full reviews page (/reviews) ----------
(function initFullReviewsPage() {
  const list = document.getElementById('fullReviewsList');
  if (!list) return;

  const statusEl = document.getElementById('fullReviewsStatus');

  function starGlyphs(rating) {
    const full = Math.round(rating);
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += i <= full ? '★' : '<span class="star-empty">★</span>';
    }
    return out;
  }

  function renderFullReview(review) {
    const article = document.createElement('article');
    article.className = 'full-review';
    if (review.id != null) article.id = `review-${review.id}`;

    const stars = document.createElement('div');
    stars.className = 'full-review-stars';
    stars.setAttribute('aria-hidden', 'true');
    stars.innerHTML = starGlyphs(review.rating);

    const quote = document.createElement('blockquote');
    quote.className = 'full-review-quote';
    quote.textContent = `“${review.review_text}”`;

    const name = document.createElement('cite');
    name.className = 'full-review-name';
    name.textContent = `— ${review.name}`;

    article.appendChild(stars);
    article.appendChild(quote);
    article.appendChild(name);
    return article;
  }

  async function loadFullReviews() {
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];

      if (reviews.length === 0) {
        if (statusEl) statusEl.textContent = 'No reviews yet — be the first to share your experience.';
        return;
      }

      if (statusEl) statusEl.remove();
      reviews.forEach((review) => list.appendChild(renderFullReview(review)));

      if (location.hash.startsWith('#review-')) {
        const target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView({ block: 'center' });
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Reviews are temporarily unavailable. Please try again shortly.';
    }
  }

  loadFullReviews();
})();
