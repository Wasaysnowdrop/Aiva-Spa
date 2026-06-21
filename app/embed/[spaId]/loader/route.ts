import { headers } from "next/headers"

const SCRIPT = `(function () {
  if (window.AivaSpa) return;
  var d = document;
  var s = d.getElementById('aivaspa-loader');
  if (s) return;

  var spaId =
    (d.currentScript && d.currentScript.getAttribute('data-spa-id')) ||
    (function () {
      var scripts = d.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].getAttribute('src') || '';
        if (src.indexOf('/embed/') !== -1) {
          var m = src.match(/\\/embed\\/([^/]+)\\//);
          if (m) return m[1];
        }
      }
      return null;
    })();

  if (!spaId) {
    console.warn('[AivaSpa] Missing data-spa-id attribute on the loader script.');
    return;
  }

  var origin = (function () {
    try {
      var s2 = d.currentScript;
      if (s2 && s2.src) {
        var u = new URL(s2.src);
        return u.origin;
      }
    } catch (e) {}
    return window.location.origin;
  })();

  var configLoaded = fetch(origin + '/api/widget/config?spaId=' + encodeURIComponent(spaId), { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; });

  var locked = false;

  window.AivaSpa = {
    open: function () { if (!locked) open(); },
    close: close,
    toggle: function () { if (!locked) toggle(); },
    refresh: function () { if (!locked) refresh(); },
    destroy: destroy,
  };

  var styleEl = d.createElement('style');
  styleEl.id = 'aivaspa-style';
  styleEl.textContent = baseCss();
  d.head.appendChild(styleEl);

  var host = d.createElement('div');
  host.id = 'aivaspa-host';
  host.setAttribute('aria-hidden', 'true');
  d.body.appendChild(host);

  var bubble = d.createElement('button');
  bubble.id = 'aivaspa-bubble';
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.innerHTML = bubbleIcon();
  bubble.addEventListener('click', function () {
    if (locked) return;
    open();
  });
  host.appendChild(bubble);

  var iframe = null;
  var mounted = false;

  function bubbleIcon() {
    return [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7',
      '   8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8',
      '   8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
      '</svg>',
    ].join('');
  }

  function setBubbleContent(cfg) {
    bubble.innerHTML = '';
    var url =
      cfg && typeof cfg.bubbleLogoUrl === 'string' && cfg.bubbleLogoUrl.trim().length > 0
        ? cfg.bubbleLogoUrl.trim()
        : '';
    if (url) {
      var img = d.createElement('img');
      img.src = url;
      img.alt = '';
      img.draggable = false;
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () {
        bubble.innerHTML = '';
        bubble.appendChild(makeInitialSpan(cfg));
      });
      bubble.appendChild(img);
      return;
    }
    var initialSpan = makeInitialSpan(cfg);
    if (initialSpan) {
      bubble.appendChild(initialSpan);
    } else {
      bubble.innerHTML = bubbleIcon();
    }
  }

  function makeInitialSpan(cfg) {
    var initial =
      cfg && typeof cfg.logoInitial === 'string' && cfg.logoInitial.trim().length > 0
        ? cfg.logoInitial.trim()
        : '';
    if (!initial) return null;
    var span = d.createElement('span');
    span.textContent = initial;
    return span;
  }

  function buildUrl() {
    return origin + '/embed/' + encodeURIComponent(spaId) + '?parent=' + encodeURIComponent(window.location.href);
  }

  function ensureIframe() {
    if (iframe) return;
    iframe = d.createElement('iframe');
    iframe.src = buildUrl();
    iframe.title = spaId + ' chat';
    iframe.allow = 'clipboard-write';
    iframe.setAttribute('aria-label', 'Med spa chat');
    iframe.loading = 'lazy';
    // Start hidden and non-interactive so it can never swallow clicks on
    // the bubble. open() flips these back.
    try { iframe.inert = true; } catch (e) {}
    host.appendChild(iframe);
  }

  function postMessage(payload) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(Object.assign({ source: 'aivaspa-parent' }, payload), origin);
  }

  function open() {
    host.setAttribute('aria-hidden', 'false');
    ensureIframe();
    host.classList.add('aivaspa-open');
    mounted = true;
    if (iframe) {
      // Re-enable interaction in case it was inert from a previous close.
      try { iframe.inert = false; } catch (e) {}
    }
    postMessage({ type: 'open' });
  }

  function close() {
    host.classList.remove('aivaspa-open');
    host.setAttribute('aria-hidden', 'true');
    if (iframe) {
      // Make sure the hidden iframe cannot swallow any clicks meant for
      // the bubble. inert + display:none + visibility:hidden together
      // cover all browser edge cases.
      try { iframe.inert = true; } catch (e) {}
    }
  }

  function toggle() { mounted && host.classList.contains('aivaspa-open') ? close() : open(); }

  function refresh() {
    if (iframe) iframe.src = buildUrl() + '&t=' + Date.now();
  }

  function destroy() {
    if (iframe) iframe.remove();
    iframe = null;
    if (styleEl) styleEl.remove();
    if (host) host.remove();
    mounted = false;
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'aivaspa-iframe') return;
    if (e.data.type === 'ready') {
      configLoaded.then(function (cfg) {
        postMessage({ type: 'config', config: cfg });
      });
    } else if (e.data.type === 'close') {
      close();
    } else if (e.data.type === 'resize') {
      if (iframe && typeof e.data.height === 'number' && e.data.height > 0) {
        var h = Math.ceil(e.data.height);
        // Cap the top so very long transcripts don't push the iframe
        // past the viewport, but allow it to shrink so the chat always
        // hugs its content (no empty bar at the bottom).
        if (h > 640) h = 640;
        if (h < 360) h = 360;
        iframe.style.height = h + 'px';
        iframe.style.width = '380px';
      }
    }
  });

  configLoaded.then(function (cfg) {
    if (!cfg) return;
    var pos = cfg.position || 'bottom-right';
    host.classList.add('aivaspa-pos-' + pos);
    if (cfg.locked) {
      locked = true;
      host.classList.add('aivaspa-locked');
      setBubbleContent(cfg);
      return;
    }
    if (cfg.primaryColor) {
      host.style.setProperty('--aiva-accent', cfg.primaryColor);
    }
    setBubbleContent(cfg);
    if (cfg.proactiveEnabled) {
      var delay = Math.max(2000, (cfg.proactiveDelaySeconds || 8) * 1000);
      setTimeout(function () {
        if (!mounted) {
          postMessage({ type: 'proactive', message: cfg.proactiveMessage });
          open();
        }
      }, delay);
    }
  });

  function baseCss() {
    return [
      '#aivaspa-host {',
      '  position: fixed;',
      '  z-index: 2147483000;',
      '  bottom: 24px;',
      '  width: 0;',
      '  height: 0;',
      '  pointer-events: none;',
      '}',
      '#aivaspa-host.aivaspa-pos-bottom-right { right: 24px; }',
      '#aivaspa-host.aivaspa-pos-bottom-left  { left:  24px; }',
      '#aivaspa-bubble {',
      '  position: absolute;',
      '  bottom: 0;',
      '  right: 0;',
      '  z-index: 2;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 56px;',
      '  height: 56px;',
      '  padding: 0;',
      '  border: 0;',
      '  border-radius: 50%;',
      '  background: var(--aiva-accent, #E2E54B);',
      '  color: #08090A;',
      '  cursor: pointer;',
      '  pointer-events: auto;',
      '  box-shadow: 0 10px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06);',
      '  transition: transform 180ms ease, box-shadow 180ms ease;',
      '}',
      '#aivaspa-host.aivaspa-pos-bottom-left #aivaspa-bubble { right: auto; left: 0; }',
      '#aivaspa-bubble:hover { transform: scale(1.06); }',
      '#aivaspa-bubble:focus-visible { outline: 2px solid var(--aiva-accent, #E2E54B); outline-offset: 3px; }',
      '#aivaspa-bubble svg { width: 24px; height: 24px; display: block; }',
      '#aivaspa-bubble > span {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  font-size: 26px;',
      '  line-height: 1;',
      '  font-weight: 700;',
      '  letter-spacing: -0.02em;',
      '  max-width: 44px;',
      '  overflow: hidden;',
      '  text-align: center;',
      '  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;',
      '}',
      '#aivaspa-bubble > img {',
      '  width: 100%;',
      '  height: 100%;',
      '  object-fit: cover;',
      '  border-radius: 50%;',
      '  display: block;',
      '  pointer-events: none;',
      '}',
      '#aivaspa-host.aivaspa-open #aivaspa-bubble { display: none; }',
      '#aivaspa-host.aivaspa-locked #aivaspa-bubble {',
      '  background: #2A2C31;',
      '  color: #62666D;',
      '  cursor: not-allowed;',
      '  box-shadow: 0 6px 16px rgba(0,0,0,0.3);',
      '}',
      '#aivaspa-host iframe {',
      '  position: absolute;',
      '  bottom: 0;',
      '  right: 0;',
      '  display: none;',
      '  width: 0;',
      '  height: 0;',
      '  border: 0;',
      '  background: transparent;',
      '  pointer-events: none;',
      '  visibility: hidden;',
      '  opacity: 0;',
      '  border-radius: 18px;',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.04);',
      '  overflow: hidden;',
      '  z-index: 1;',
      '}',
      '#aivaspa-host.aivaspa-pos-bottom-left iframe { right: auto; left: 0; }',
      '#aivaspa-host.aivaspa-open iframe {',
      '  display: block;',
      '  width: 380px;',
      '  height: 560px;',
      '  opacity: 1;',
      '  pointer-events: auto;',
      '  visibility: visible;',
      '}',
      '@media (max-width: 480px) {',
      '  #aivaspa-host.aivaspa-open iframe { width: calc(100vw - 24px); height: calc(100dvh - 96px); }',
      '  #aivaspa-host.aivaspa-pos-bottom-right { right: 12px; bottom: 12px; }',
      '  #aivaspa-host.aivaspa-pos-bottom-left  { left:  12px; bottom: 12px; }',
      '}',
    ].join('\\n');
  }
})();
`

export async function GET() {
  // The SCRIPT template derives the script's origin at runtime via
  // `currentScript.src` (see SCRIPT body), so the static template does
  // not need a placeholder.
  void headers

  return new Response(SCRIPT, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      "access-control-allow-origin": "*",
      "x-robots-tag": "none",
      "x-content-type-options": "nosniff",
    },
  })
}
