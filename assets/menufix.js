// dulizhan: custom slide-in category menu (replaces lelo's broken accordion).
(function(){
  var LOCAL={index:1,'ina-thrust':1,'enigma-double-sonic':1,'f1s-v3':1,'soraya-wave':1,
    'sona-2-cruise':1,'smart-wand-2-large':1,'tor-3':1,'tiani-3':1,bestsellers:1,
    'sex-toys-for-women':1,'sex-toys-for-men':1,'sex-toys-for-couples':1,
    'clitoral-vibrators':1,'g-spot-vibrators':1,'rabbit-vibrators':1};
  var panel, overlay, built=false;

  // collect category links from lelo's (hidden) native menu, preserving order + level
  function collect(){
    var out=[], seen={};
    document.querySelectorAll('#block-play-main-menu .main-menu__item').forEach(function(li){
      var a=li.querySelector(':scope > a[href]')||li.querySelector('a[href]');
      if(!a) return;
      var href=(a.getAttribute('href')||'').trim();
      var m=href.match(/([a-z0-9-]+)\.html/);
      if(!m||!LOCAL[m[1]]) return;
      var lvl=parseInt(li.getAttribute('data-level')||'0',10);
      var text=(a.textContent||'').trim();
      var key=href+'|'+text;
      if(seen[key]) return; seen[key]=1;
      out.push({href:href,text:text,level:lvl});
    });
    return out;
  }

  function build(){
    if(built) return;
    var items=collect();
    overlay=document.createElement('div'); overlay.className='dlz-menu-overlay';
    overlay.addEventListener('click',close);
    panel=document.createElement('nav'); panel.className='dlz-menu'; panel.setAttribute('aria-label','Categories');
    var html='<button class="dlz-menu__close" aria-label="Close">×</button>'+
      '<div class="dlz-menu__title">Categories</div>';
    var lastTop=true;
    items.forEach(function(it){
      var isSub=it.level>0;
      if(!isSub && !lastTop) html+='<hr>';
      html+='<a class="'+(isSub?'dlz-menu__sub':'dlz-menu__top')+'" href="'+it.href+'">'+it.text+'</a>';
      lastTop=!isSub;
    });
    panel.innerHTML=html;
    document.body.appendChild(overlay); document.body.appendChild(panel);
    panel.querySelector('.dlz-menu__close').addEventListener('click',close);
    // links navigate normally (plain <a href>); nothing intercepts them
    built=true;
  }
  function open(){ build(); panel.classList.add('open'); overlay.classList.add('show'); document.body.style.overflow='hidden'; }
  function close(){ if(panel){panel.classList.remove('open'); overlay.classList.remove('show');} document.body.style.overflow=''; }
  function toggle(){ build(); panel.classList.contains('open')?close():open(); }

  // hamburger toggles our menu (capture phase so lelo's dead handler can't matter)
  document.addEventListener('click',function(e){
    var icon=e.target.closest('[class*="menu__icon"]');
    if(icon){ e.preventDefault(); e.stopPropagation(); toggle(); }
  },true);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });

  // eager-load images so lazy lifestyle/video sections actually render (theme JS dead)
  function eager(){ document.querySelectorAll('img[loading="lazy"]').forEach(function(i){ i.loading='eager'; }); }
  if(document.readyState!=='loading') eager(); else document.addEventListener('DOMContentLoaded',eager);
  var en=0,et=setInterval(function(){ eager(); if(++en>10) clearInterval(et); },500);
})();
