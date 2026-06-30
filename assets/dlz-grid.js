// dulizhan: render a static product grid on category pages.
(function(){
  var PRODUCTS=[{"slug":"ina-thrust","name":"INA™ Thrust","url":"ina-thrust.html","img":"assets/grid-ina-thrust.webp","anatomy":"female","play":["solo","couple"],"stim":["g-spot","clitoral"],"type":["rabbit"]},{"slug":"enigma-double-sonic","name":"ENIGMA™ Double Sonic","url":"enigma-double-sonic.html","img":"assets/grid-enigma-double-sonic.webp","anatomy":"female","play":["solo"],"stim":["a-spot","clitoral"],"type":["rabbit"]},{"slug":"f1s-v3","name":"F1S™ V3","url":"f1s-v3.html","img":"assets/grid-f1s-v3.webp","anatomy":"male","play":["solo"],"stim":["penis"],"type":[]},{"slug":"soraya-wave","name":"SORAYA Wave™","url":"soraya-wave.html","img":"assets/grid-soraya-wave.webp","anatomy":"female","play":["solo"],"stim":["g-spot","clitoral"],"type":["rabbit"]},{"slug":"sona-2-cruise","name":"SONA™ 2 Cruise","url":"sona-2-cruise.html","img":"assets/grid-sona-2-cruise.webp","anatomy":"female","play":["solo"],"stim":["clitoral"],"type":[]},{"slug":"smart-wand-2-large","name":"SMART WAND™ 2 Large","url":"smart-wand-2-large.html","img":"assets/grid-smart-wand-2-large.webp","anatomy":"female","play":["solo","couple"],"stim":["clitoral"],"type":["wand"]},{"slug":"tor-3","name":"TOR™ 3","url":"tor-3.html","img":"assets/grid-tor-3.webp","anatomy":"male","play":["couple"],"stim":["penis","clitoral"],"type":["ring"]},{"slug":"tiani-3","name":"TIANI™ 3","url":"tiani-3.html","img":"assets/grid-tiani-3.webp","anatomy":"female","play":["couple"],"stim":["g-spot","clitoral"],"type":["wearable"]}];
  function emptyProductSlot(){
    // the homepage's empty Algolia products placeholder = the natural mid-page slot
    var s=document.querySelector('.helper-inline-blockproducts-block');
    if(s) return s;
    var blocks=[].slice.call(document.querySelectorAll('[class*="products-block"],[class*="product-list"]'));
    for(var i=0;i<blocks.length;i++){ if(blocks[i].querySelectorAll('img,a').length===0) return blocks[i]; }
    return null;
  }
  function place(wrap){
    var p=location.pathname; var isHome=(p==='/'||p.indexOf('/index.html')>=0);
    var pc=document.querySelector('.product-container');
    if(pc&&!isHome){
      // category pages: show products at the TOP, and collapse the broken/empty
      // React-Algolia listing block (it reserves a big empty gap). Re-assert for late renders.
      var n2=0, t2=setInterval(function(){
        var pcc=document.querySelector('.product-container'); if(!pcc) return;
        [].forEach.call(pcc.children,function(c){
          if(c===wrap) return;
          if(c.querySelector('[class*="Skeleton-sc"],[class*="BodyWrapper-sc"],[class*="ais-"]') && !c.querySelector('.dlz-card,img[src*="grid-"]')){
            c.style.display='none';
          }
        });
        if(pcc.firstElementChild!==wrap) pcc.insertBefore(wrap,pcc.firstElementChild); // products first
        if(++n2>20) clearInterval(t2);
      },400);
      return;
    }
    // homepage: keep the grid in the empty product slot (re-assert against late reflows)
    var n=0, t=setInterval(function(){
      var slot=emptyProductSlot();
      if(slot){ if(slot.lastElementChild!==wrap){ slot.appendChild(wrap); slot.style.display=''; } }
      else { var f=document.querySelector('footer'); if(f&&f.parentNode){ if(f.previousElementSibling!==wrap) f.parentNode.insertBefore(wrap,f); } else if(!wrap.parentNode){ (document.querySelector('main')||document.body).appendChild(wrap); } }
      if(++n>40) clearInterval(t);   // ~20s
    },500);
  }
  // pick products relevant to the current category page (fallback: all)
  function productsForPage(){
    var path=location.pathname;
    var has=function(arr,v){return arr&&arr.indexOf(v)>=0;};
    var CAT={
      'sex-toys-for-women':function(p){return p.anatomy==='female';},
      'sex-toys-for-men':function(p){return p.anatomy==='male';},
      'sex-toys-for-couples':function(p){return has(p.play,'couple');},
      'clitoral-vibrators':function(p){return has(p.stim,'clitoral');},
      'g-spot-vibrators':function(p){return has(p.stim,'g-spot');},
      'rabbit-vibrators':function(p){return has(p.type,'rabbit');}
    };
    var key=Object.keys(CAT).filter(function(k){return path.indexOf('/'+k+'.html')>=0;})[0];
    if(!key) return PRODUCTS;                  // homepage / bestsellers -> all
    var list=PRODUCTS.filter(CAT[key]);
    return list.length?list:PRODUCTS;          // never show an empty grid
  }
  function build(){
    if(document.querySelector('.dlz-grid-wrap'))return;
    var wrap=document.createElement('section');
    wrap.className='dlz-grid-wrap';
    var h=document.createElement('h2');h.textContent='Featured Products';wrap.appendChild(h);
    var grid=document.createElement('div');grid.className='dlz-grid';
    productsForPage().forEach(function(p){
      var a=document.createElement('a');a.className='dlz-card';a.href=p.url;
      a.innerHTML='<div class="dlz-card__img"><img src="'+p.img+'" alt="'+p.name+'"></div>'+
        '<div class="dlz-card__name">'+p.name+'</div><div class="dlz-card__cta">View product</div>';
      grid.appendChild(a);
    });
    wrap.appendChild(grid);
    place(wrap);
  }
  if(document.readyState!=='loading')build();
  else document.addEventListener('DOMContentLoaded',build);
})();
