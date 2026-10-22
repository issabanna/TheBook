(() => {
  'use strict';
  const ID = 'G-H7Z99E31L4';
  const KEY = 'oportals-analytics-consent-v1';
  const MAX_AGE = 180 * 86400000;
  let enabled = false, loaded = false;
  const banner = document.getElementById('analytics-consent');
  function preference() {
    try { const p = JSON.parse(localStorage.getItem(KEY)); return p && Date.now() - p.at < MAX_AGE && ['accepted', 'rejected'].includes(p.choice) ? p.choice : null; } catch { return null; }
  }
  function save(choice) { try { localStorage.setItem(KEY, JSON.stringify({ choice, at: Date.now() })); } catch {} }
  function cleanLocation() {
    const url = new URL(location.href), safe = new URL(url.origin + url.pathname);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = url.searchParams.get(key); if (value) safe.searchParams.set(key, value.slice(0, 150));
    }
    return safe.href;
  }
  function cleanReferrer() { try { const r = new URL(document.referrer); return r.origin + r.pathname; } catch { return ''; } }
  function enable(withCookies = true) {
    enabled = true;
    window['ga-disable-' + ID] = false;
    if (loaded) { if (withCookies) window.gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    if (withCookies) window.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: cleanLocation(), page_referrer: cleanReferrer() });
    window.gtag('event', 'page_view', { page_location: cleanLocation(), page_referrer: cleanReferrer(), page_title: document.title });
    const script = document.createElement('script'); script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(script);
  }
  function clearCookies() {
    const domains = ['', location.hostname, '.' + location.hostname];
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (/^_ga(?:_|$)/.test(name)) for (const domain of domains) document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax; Secure' + (domain ? '; Domain=' + domain : '');
    }
  }
  function choose(choice) {
    save(choice); if (banner) banner.hidden = true;
    if (choice === 'accepted') enable(true);
    else {
      enabled = false; window['ga-disable-' + ID] = true; clearCookies();
      // A reload unloads an already-running Google script after consent is withdrawn.
      if (loaded) location.reload();
    }
  }
  document.getElementById('measurement-accept')?.addEventListener('click', () => choose('accepted'));
  document.getElementById('measurement-reject')?.addEventListener('click', () => choose('rejected'));
  const stored = preference();
  if (stored === 'accepted') enable(true);
  else if (stored === 'rejected') { window['ga-disable-' + ID] = true; clearCookies(); }
  else enable(true);
  if (banner) banner.hidden = true;
  document.getElementById('analytics-accept')?.addEventListener('click', () => choose('accepted'));
  document.getElementById('analytics-reject')?.addEventListener('click', () => choose('rejected'));
  document.getElementById('analytics-settings')?.addEventListener('click', () => { if (banner) { banner.hidden = false; document.getElementById('analytics-reject')?.focus(); } });
  document.querySelectorAll('a[href="/checkout"]').forEach(link => link.addEventListener('click', event => {
    if (!enabled || !window.gtag || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); let navigated = false;
    const navigate = () => { if (!navigated) { navigated = true; location.assign('/checkout'); } };
    window.gtag('event', 'begin_checkout', { cta_location: link.dataset?.cta || 'unspecified', currency: 'USD', value: 15, items: [{ item_id: 'LIFE-SECRETS', item_name: 'Life Secrets', price: 15, quantity: 1 }], event_callback: navigate, event_timeout: 400 });
    setTimeout(navigate, 450);
  }));
  document.querySelectorAll('a[href="Life-Secrets-Sample.pdf"]').forEach(link => link.addEventListener('click', () => {
    if (enabled && window.gtag) window.gtag('event', 'sample_preview', { item_id: 'LIFE-SECRETS' });
  }));
})();
