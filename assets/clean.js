// dulizhan: remove language switcher, app/QR, and all off-site/un-scraped links.
(function(){
  var LOCAL=["index","ina-thrust","enigma-double-sonic","f1s-v3","soraya-wave","sona-2-cruise","smart-wand-2-large","tor-3","tiani-3","bestsellers","sex-toys-for-women","sex-toys-for-men","sex-toys-for-couples","clitoral-vibrators","g-spot-vibrators","rabbit-vibrators"];
  var localSet={};LOCAL.forEach(function(s){localSet[s]=1;});

  function isLeloHref(h){ return /(^https?:)?\/\/(www\.)?lelo\.com/i.test(h)||/(^https?:)?\/\/[a-z.]*\.lelo\.com/i.test(h); }
  function isAppHref(h){ return /apps\.apple\.com|play\.google\.com|itunes\.apple\.com|onelink|app\.adjust/i.test(h); }
  function isLocalPage(h){ var m=(h||'').match(/([a-z0-9-]+)\.html(\?|#|$)/i); return m&&localSet[m[1]]; }

  function removeUp(el,stopSel){
    // remove the nearest menu <li> / list wrapper, else the element itself
    var li=el.closest&&el.closest('li');
    if(li){ li.remove(); return; }
    el.remove();
  }
  function unwrap(a){ // replace <a> with its children (keep image/text, drop link)
    var span=document.createElement('span'); span.className='dlz-unlinked';
    while(a.firstChild) span.appendChild(a.firstChild);
    if(a.parentNode) a.parentNode.replaceChild(span,a);
  }

  function clean(){
    // 1) language switcher
    document.querySelectorAll('#block-play-languageswitcher,.language-switcher-language-url').forEach(function(n){n.remove();});
    // 2) app store / google play / QR
    document.querySelectorAll('a[href*="apps.apple.com"],a[href*="play.google.com"],a[href*="itunes.apple.com"]').forEach(function(a){removeUp(a);});
    document.querySelectorAll('[class*="qr-code"],[class*="qrcode"],.micro_qr_code,[class*="app-download"],[class*="app-banner"],[class*="download-app"],.footer-wechat-bazaarvoice,.footer-wechat,.footer-bazaarvoice,#bazaarreviews,.bazaar-reviews-block').forEach(function(n){n.remove();});
    // 3) every anchor — keep ONLY local pages, WhatsApp, and in-page anchors;
    //    remove everything else (lelo.com, social, app stores, un-scraped .html, mailto/tel)
    document.querySelectorAll('a[href]').forEach(function(a){
      var h=(a.getAttribute('href')||'').trim();
      if(!h||h==='#'||h.charAt(0)==='#') return;        // in-page anchor / empty
      if(h.indexOf('wa.me')>=0) return;                  // WhatsApp
      if(isLocalPage(h)) return;                         // a scraped local page
      var li=a.closest&&a.closest('li');
      if(li){ li.remove(); }                             // menu/footer entry -> delete
      else { unwrap(a); }                                // inline link -> keep content, drop link
    });
    // 4) tidy: drop now-empty menu lists / footer columns
    document.querySelectorAll('ul.main-menu li.main-menu__item, .footer-menu li, nav ul li').forEach(function(li){
      if(!li.querySelector('a,button')&&!li.textContent.trim()) li.remove();
    });
    document.querySelectorAll('ul').forEach(function(ul){ if(!ul.children.length) ul.remove(); });
  }

  if(document.readyState!=='loading')clean();else document.addEventListener('DOMContentLoaded',clean);
  // re-run for React-rendered menu/flyout content
  var n=0,t=setInterval(function(){clean();if(++n>15)clearInterval(t);},350);
  new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});
})();
