// dulizhan: fully disable login on the static clone.
// Loads FIRST in <head>, before the React app — stubs Google Identity Services
// and blocks the GSI client script so no FedCM/login calls ever fire.
(function () {
  function isAuthUrl(u) {
    return typeof u === 'string' &&
      /(accounts\.google\.com\/gsi|gsi\/client|apis\.google\.com\/js|gstatic\.com\/[^"']*gsi|connect\.facebook\.net|appleid\.cdn-apple\.com)/i.test(u);
  }

  // No-op Google Identity Services API so any caller silently does nothing.
  var idStub = {
    initialize: function () {}, prompt: function () {}, renderButton: function () {},
    disableAutoSelect: function () {}, storeCredential: function () {}, cancel: function () {},
    revoke: function () {}, setLogLevel: function () {}
  };
  var googleStub = {
    accounts: {
      id: idStub,
      oauth2: {
        initTokenClient: function () { return { requestAccessToken: function () {} }; },
        initCodeClient: function () { return { requestCode: function () {} }; },
        hasGrantedAllScopes: function () { return false; },
        revoke: function () {}
      }
    }
  };
  try {
    Object.defineProperty(window, 'google', {
      configurable: true, get: function () { return googleStub; }, set: function () {}
    });
  } catch (e) { window.google = googleStub; }

  // Block FedCM credential requests outright.
  if (navigator.credentials && navigator.credentials.get) {
    navigator.credentials.get = function () { return Promise.reject(new DOMException('disabled', 'NotAllowedError')); };
  }

  // Drop <script> elements that try to load auth SDKs.
  var origCreate = document.createElement.bind(document);
  document.createElement = function (tag) {
    var el = origCreate(tag);
    if (String(tag).toLowerCase() === 'script') {
      try {
        Object.defineProperty(el, 'src', {
          configurable: true,
          get: function () { return el.getAttribute('src') || ''; },
          set: function (v) { if (!isAuthUrl(v)) el.setAttribute('src', v); }
        });
      } catch (e) {}
    }
    return el;
  };

  // Also block fetch/XHR to auth endpoints (belt & suspenders).
  if (window.fetch) {
    var of = window.fetch;
    window.fetch = function (u) { return isAuthUrl(typeof u === 'string' ? u : (u && u.url)) ? Promise.reject(new Error('auth disabled')) : of.apply(this, arguments); };
  }
})();
