/**
 * Making Science Website Assistant — single-file embed loader.
 *
 * Usage (the ONLY thing the host page needs):
 *   <script src="https://<host>/ms-assistant.js" defer></script>
 *
 * Everything else — the Google chat SDK, Making Science theming, the widget
 * markup, the open/close button, and two reliability fixes — is injected by
 * this file. Updating this file updates every site that embeds it; the host
 * page never changes.
 *
 * Optional overrides (define BEFORE the script tag):
 *   window.MS_ASSISTANT_CONFIG = { deploymentName: "...", chatTitle: "..." };
 */
(function () {
  'use strict';

  if (window.__msAssistantLoaded) return; // idempotent: ignore double-embeds
  window.__msAssistantLoaded = true;

  // Resolve our own URL so companion assets (logo) load from wherever this
  // file is hosted, regardless of the host page's origin.
  var self = document.currentScript ||
    document.querySelector('script[src*="ms-assistant"]');
  var base = (self && self.src) ? self.src.replace(/[^\/]*$/, '') : '';

  var cfg = Object.assign({
    deploymentName: 'projects/109044558918/locations/eu/apps/6e6b11a6-c0e5-43b3-813a-28f21963fbcb/deployments/c881ca00-3252-4443-9356-76061fa75a4a',
    chatTitle: 'Making Science Assistant',
    chatTitleIcon: base + 'ms-logo.png',
    sdkVersion: 'v1.16'
  }, window.MS_ASSISTANT_CONFIG || {});

  var SDK_BASE = 'https://www.gstatic.com/chat-messenger/sdk/prod/' + cfg.sdkVersion + '/';

  // ── SDK stylesheets (safe to add immediately) ──────────────────────────
  [SDK_BASE + 'themes/chat-messenger-default.css',
   SDK_BASE + 'themes/chat-messenger-layout.css'].forEach(function (href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  });

  // ── Making Science theming + page-owned visibility CSS ─────────────────
  // (documented palette tokens + internal tokens for titlebar/launcher that
  // the default theme doesn't expose; chat visibility is page-owned — see
  // chatToggle below — because the SDK's own launcher/close desync.)
  var style = document.createElement('style');
  style.textContent =
    'chat-messenger {' +
    '  --chat-messenger-color--primary: #f0076f;' +
    '  --chat-messenger-color--on-primary: #ffffff;' +
    '  --chat-messenger-color--outline-active: #f0076f;' +
    '  --chat-messenger-color--link: #0d1b3d;' +
    '  --chat-messenger-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
    '  --chat-messenger-internal-primary-color: #f0076f;' +
    '  --chat-messenger-internal-titlebar-background: #0d1b3d;' +
    '  --chat-messenger-internal-titlebar-background-color: #0d1b3d;' +
    '  --chat-messenger-internal-titlebar-font-color: #ffffff;' +
    '  --chat-messenger-internal-titlebar-icon-font-color: #ffffff;' +
    '  --chat-messenger-internal-titlebar-button-color: #ffffff;' +
    '  --chat-messenger-internal-titlebar-button-color-hover: #f0076f;' +
    '  --chat-messenger-internal-chat-bubble-background: #f0076f;' +
    '  --chat-messenger-internal-chat-bubble-background-color: #f0076f;' +
    '  --chat-messenger-internal-chat-bubble-icon-color: #ffffff;' +
    '}' +
    'body.ms-chat-hidden chat-messenger { display: none !important; }' +
    'body.ms-chat-hidden { overflow: auto !important; padding-right: 0 !important; }' +
    '#ms-chat-fab {' +
    '  position: fixed; right: 24px; bottom: 24px; z-index: 2147483000;' +
    '  width: 56px; height: 56px; border-radius: 50%; border: none;' +
    '  background: #f0076f; color: #fff; font-size: 24px; line-height: 56px;' +
    '  text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,.3); cursor: pointer; padding: 0;' +
    '}' +
    '#ms-chat-fab.docked {' +
    '  position: static; width: 32px; height: 32px; border-radius: 50%;' +
    '  background: #fff; color: #333; font-size: 16px; line-height: 32px;' +
    '  box-shadow: none; margin: 0 4px 0 0;' +
    '}';
  document.head.appendChild(style);

  // ── Deployment registration (listener must exist before the SDK runs) ──
  window.addEventListener('chat-messenger-loaded', function () {
    window.chatSdk.registerContext(
      window.chatSdk.prebuilts.ces.createContext({
        deploymentName: cfg.deploymentName,
        tokenBroker: {
          enableTokenBroker: true,
          enableRecaptcha: false
        }
      })
    );
  });

  // ── Session/token guard (fix for a known SDK bug) ──────────────────────
  // The SDK stores the session id and its auth token as SEPARATE
  // sessionStorage keys; when the 30-min session expires it clears the
  // session keys but NOT the token, then mints a new session that reuses the
  // stale token → every request 403s with "Session claim does not match the
  // session name" and Retry can never recover. Drop the stale token so the
  // broker mints a fresh one.
  (function sessionTokenGuard() {
    function tokenSessionClaim(tok) {
      try {
        var payload = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        var m = JSON.stringify(payload).match(/dfMessenger-[0-9a-fA-F-]+/);
        return m ? m[0] : null;
      } catch (e) { return null; }
    }
    function dropStaleToken() {
      try {
        var SS = window.sessionStorage;
        var tok = SS.getItem('chat-messenger-access-token');
        if (!tok) return false;
        var sid = SS.getItem('chat-messenger-sessionID');
        var exp = SS.getItem('chat-messenger-session-id-expires-at');
        var claim = tokenSessionClaim(tok);
        var sessionGone = !sid || (exp && new Date(exp) < new Date());
        var mismatch = !!(claim && sid && claim !== sid);
        if (sessionGone || mismatch) {
          SS.removeItem('chat-messenger-access-token');
          SS.removeItem('chat-messenger-access-token-expires-at');
          return true;
        }
      } catch (e) {}
      return false;
    }
    dropStaleToken();
    var recovered = false;
    window.addEventListener('chat-messenger-error', function () {
      if (dropStaleToken() && !recovered) {
        recovered = true;
        setTimeout(function () { window.location.reload(); }, 400);
      }
    });
  })();

  // ── Widget markup + page-owned open/close toggle ────────────────────────
  // Injected once the DOM is ready, BEFORE the SDK script is added — same
  // order as a static page (element first, deferred SDK second), which is
  // the arrangement this widget is verified against.
  function init() {
    // Markup: no close-button on purpose — the SDK's own launcher and
    // close-button desync from each other (dead bubble); open/close is
    // page-owned instead.
    var mount = document.createElement('div');
    mount.innerHTML =
      '<chat-messenger url-allowlist="*" render-mode="slide-in">' +
      '  <chat-messenger-container' +
      '    chat-title="' + cfg.chatTitle.replace(/"/g, '&quot;') + '"' +
      '    chat-title-icon="' + cfg.chatTitleIcon.replace(/"/g, '&quot;') + '"' +
      '    enable-file-upload' +
      '    enable-audio-input>' +
      '    <chat-reset-session-button slot="titlebar-actions" title-text="Start new chat"></chat-reset-session-button>' +
      '    <chat-toggle-dialog-button slot="titlebar-actions" title-text-expanded="Collapse" title-text-collapsed="Expand"></chat-toggle-dialog-button>' +
      '  </chat-messenger-container>' +
      '</chat-messenger>';
    while (mount.firstChild) document.body.appendChild(mount.firstChild);

    // Page-owned toggle: body.ms-chat-hidden hides the widget layer; one
    // button floats bottom-right when closed and docks into the titlebar as
    // a ✕ when open. The SDK reserves body padding + locks scroll via its
    // own !important rules while it thinks the chat is open — only INLINE
    // styles beat those, so we set/remove them on close/open. The SDK's
    // internal state is never touched, so the conversation survives
    // open/close cycles.
    document.body.classList.add('ms-chat-hidden'); // start closed

    var fab = document.createElement('button');
    fab.id = 'ms-chat-fab'; fab.type = 'button'; fab.textContent = '💬';
    fab.setAttribute('aria-label', 'Open chat');

    function setOpen(open) {
      document.body.classList.toggle('ms-chat-hidden', !open);
      if (open) {
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
      } else {
        document.body.style.setProperty('padding-right', '0', 'important');
        document.body.style.setProperty('overflow', 'auto', 'important');
      }
      fab.textContent = open ? '✕' : '💬';
      fab.classList.toggle('docked', open);
      fab.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      // Dock into the titlebar-actions slot while open: renders next to the
      // SDK's own buttons and rides into the top layer in expanded (dialog)
      // mode — a fixed-position button would be buried.
      var container = document.querySelector('chat-messenger-container');
      if (open && container) {
        fab.setAttribute('slot', 'titlebar-actions');
        container.appendChild(fab);
      } else {
        fab.removeAttribute('slot');
        document.body.appendChild(fab);
      }
    }
    setOpen(false);
    fab.addEventListener('click', function () {
      setOpen(document.body.classList.contains('ms-chat-hidden'));
    });
    document.body.appendChild(fab);

    // SDK last, mirroring the verified static-page load order.
    var s = document.createElement('script');
    s.src = SDK_BASE + 'chat-messenger.js';
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
