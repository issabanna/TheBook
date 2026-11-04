(() => {
  'use strict';
  const states = new WeakMap();
  function artwork(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    try {
      const url = new URL(image.getAttribute('src'), location.href);
      return url.origin === location.origin && /^\/(?:Testing\/)?media\//.test(url.pathname);
    } catch { return false; }
  }
  function stateFor(image) {
    const source = image.getAttribute('src');
    let state = states.get(image);
    if (!state || (source !== state.source && source !== state.current)) {
      if (state?.timer) clearTimeout(state.timer);
      state?.button?.remove();
      state = {source, current: source, attempts: 0};
      states.set(image, state);
    }
    return state;
  }
  function reload(image, state) {
    if (!image.isConnected || states.get(image) !== state) return;
    const url = new URL(state.source, location.href);
    url.searchParams.set('artwork-retry', String(Date.now()) + '-' + state.attempts);
    state.current = url.pathname + url.search;
    // A failed srcset candidate would otherwise keep overriding the retry src.
    // Fall back to the small default image for this recovery attempt.
    image.removeAttribute('srcset');
    image.setAttribute('src', state.current);
  }
  function failed(image) {
    if (!artwork(image)) return;
    const state = stateFor(image);
    if (state.timer || state.button) return;
    if (state.attempts < 2) {
      const delay = [400, 1400][state.attempts++];
      state.timer = setTimeout(() => {
        state.timer = null;
        reload(image, state);
      }, delay);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'artwork-reload';
    button.textContent = 'Reload artwork';
    button.setAttribute('aria-label', 'Reload artwork: ' + (image.alt || 'book illustration'));
    button.style.cssText = 'position:relative;z-index:1;display:block;margin:8px auto;padding:8px 12px;min-height:36px;border:1px solid #d9dfe1;border-radius:6px;background:#f4f7f7;color:#233b50;font:600 12px/1.4 Arial,sans-serif;cursor:pointer';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      button.remove();
      state.button = null;
      state.attempts = 0;
      reload(image, state);
    });
    state.button = button;
    // Keep the recovery button outside links to sample PDFs and book pages.
    const link = image.closest('a');
    (link || image.closest('.cover-shelf') || image).insertAdjacentElement('afterend', button);
  }
  document.addEventListener('error', event => failed(event.target), true);
  document.addEventListener('load', event => {
    const state = states.get(event.target);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.button?.remove();
    state.button = null;
  }, true);
  function inspect() {
    for (const image of document.querySelectorAll('img')) {
      if (image.complete && image.naturalWidth === 0 && image.getAttribute('src')) failed(image);
    }
  }
  inspect();
  window.addEventListener('online', inspect);
})();
