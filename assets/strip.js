// dulizhan: neutralize cart / checkout / payment / login on the static clone.
// Blocks navigation/clicks to commerce & auth endpoints, and removes any
// cart/account UI the React app injects after load.
(function () {
  var KILL_HREF = /\/(cart|checkout|user\/login|user\/register|user\/logout|login|logout|register|signin|sign-in|wishlist|my-account|account)(\/|$|\?)/i;

  // Block clicks that lead to commerce/auth.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a,button,[role="button"]');
    if (!el) return;
    var href = el.getAttribute && (el.getAttribute('href') || '');
    var txt = (el.textContent || '').toLowerCase();
    if (KILL_HREF.test(href) ||
        /add to (cart|bag)|buy now|checkout|sign in|log in|add to wishlist/.test(txt)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Remove dynamically-injected commerce/account nodes (React renders after load).
  var SELECTORS = [
    '#block-play-shopping-cart', '#block-reactcart', '#block-react-google', '#react-google',
    '#block-play-account-menu-menu',
    '.block-commerce-cart', '.block-commerce_cart', '.block-lelo-api-user',
    '.block-react_google', '.block-reactcart', '.block-hil-wishlist', '.block-hil_wishlist',
    '[class*="add-to-cart"]', '[class*="addToCart"]', '[class*="add-to-bag"]',
    '[class*="buy-now"]', '[class*="checkout"]', '[class*="mini-cart"]', '[class*="minicart"]',
    '[class*="wishlist"]', '[class*="account-menu"]', '[class*="sign-in"]'
  ];
  function sweep() {
    SELECTORS.forEach(function (s) {
      document.querySelectorAll(s).forEach(function (n) { n.style.setProperty('display', 'none', 'important'); });
    });
  }
  if (document.readyState !== 'loading') sweep();
  else document.addEventListener('DOMContentLoaded', sweep);
  // keep sweeping briefly to catch late React renders
  var n = 0, t = setInterval(function () { sweep(); if (++n > 20) clearInterval(t); }, 300);
  new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
})();
