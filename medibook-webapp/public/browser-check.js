/*
 * Medibook runs on Chrome and Edge 111+, Firefox 128+ and Safari 16.4+
 * (docs/SUPPORTED_BROWSERS.md). Older browsers cannot draw it: its styles rely
 * on CSS colour mixing and registered custom properties. This check runs
 * before the app, and an older browser gets a plain message instead of a
 * broken page (PERF-01).
 *
 * Plain ES5 and no inline styles in markup, on purpose: it must run in the
 * browsers it turns away, under the app's Content-Security-Policy.
 */
(function () {
  var css = window.CSS;
  var supported = Boolean(
    css &&
    typeof css.supports === 'function' &&
    css.supports('color', 'color-mix(in srgb, red, blue)') &&
    'registerProperty' in css
  );
  if (supported) return;
  document.documentElement.setAttribute('data-unsupported-browser', 'true');

  function el(tag, text, style) {
    var node = document.createElement(tag);
    if (text) node.appendChild(document.createTextNode(text));
    for (var key in style) node.style[key] = style[key];
    return node;
  }

  function show() {
    var root = document.getElementById('root');
    if (!root) return;
    var box = el('div', '', {
      maxWidth: '520px',
      margin: '15vh auto',
      padding: '32px',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      color: '#111827',
      textAlign: 'center',
    });
    box.appendChild(
      el('h1', 'Please update your browser', { fontSize: '24px', marginBottom: '12px' })
    );
    box.appendChild(
      el(
        'p',
        'Medibook needs a newer browser: Chrome or Edge 111 or later, Firefox 128 or later, or Safari 16.4 or later (on an iPad, iPadOS 16.4 or later). Ask your IT team to update this computer.',
        { fontSize: '16px', lineHeight: '1.5' }
      )
    );
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(box);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
