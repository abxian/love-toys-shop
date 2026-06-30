// dulizhan: render our own product-info section at the top of each detail page.
(function(){
  var D={"ina-thrust":{"name":"INA™ Thrust","type":"兔子震動器","price":36000,"cur":"JPY","imgs":["assets/pdp-ina-thrust-0.webp","assets/pdp-ina-thrust-1.webp"],"colors":[{"n":"Black","h":"#000000"},{"n":"Purple Twilight","h":"#756784"}],"desc":"A dual-action design that pairs deep internal movement with external stimulation at the same time. Made from body-safe silicone, fully waterproof and whisper-quiet for refined, lasting pleasure."},"enigma-double-sonic":{"name":"ENIGMA™ Double Sonic","type":"g 點震動器","price":"51000","cur":"JPY","imgs":["assets/pdp-enigma-double-sonic-0.webp","assets/pdp-enigma-double-sonic-1.webp"],"colors":[{"n":"Cyber Purple","h":"#77678A"},{"n":"Black","h":"#000000"}],"desc":"Ergonomically curved to reach the G-spot with smooth, targeted vibration. Body-safe silicone, 100% waterproof and rechargeable — designed for intense, satisfying sensations."},"f1s-v3":{"name":"F1S™ V3","type":"自動男性性玩具","price":37000,"cur":"JPY","imgs":["assets/pdp-f1s-v3-0.webp","assets/pdp-f1s-v3-1.webp","assets/pdp-f1s-v3-2.webp","assets/pdp-f1s-v3-3.webp"],"colors":[],"desc":"An advanced male pleasure device with immersive, real-feel sensations and adjustable intensity. Rechargeable, easy to clean and built for premium comfort."},"soraya-wave":{"name":"SORAYA Wave™","type":"g 點震動器","price":38000,"cur":"JPY","imgs":["assets/pdp-soraya-wave-0.webp","assets/pdp-soraya-wave-1.webp","assets/pdp-soraya-wave-2.webp","assets/pdp-soraya-wave-3.webp","assets/pdp-soraya-wave-4.webp"],"colors":[{"n":"Deep Rose","h":"#9F1888"},{"n":"Black","h":"#000000"},{"n":"Midnight Blue","h":"#34348E"},{"n":"Purple","h":"#7949A4"},{"n":"Soft Pink","h":"#E9CDDC"}],"desc":"Ergonomically curved to reach the G-spot with smooth, targeted vibration. Body-safe silicone, 100% waterproof and rechargeable — designed for intense, satisfying sensations."},"sona-2-cruise":{"name":"SONA™ 2 Cruise","type":"陰蒂震動器","price":22000,"cur":"JPY","imgs":["assets/pdp-sona-2-cruise-0.webp","assets/pdp-sona-2-cruise-1.webp","assets/pdp-sona-2-cruise-2.webp"],"colors":[{"n":"Cerise","h":"#DE1C85"},{"n":"Black","h":"#000000"},{"n":"Purple","h":"#7949A4"}],"desc":"Delivers focused, build-up clitoral stimulation with multiple intensity settings. Soft body-safe silicone, fully waterproof and travel-ready for pleasure anywhere."},"smart-wand-2-large":{"name":"SMART WAND™ 2 Large","type":"魔棒按摩器","price":29000,"cur":"JPY","imgs":["assets/pdp-smart-wand-2-large-0.webp","assets/pdp-smart-wand-2-large-1.webp","assets/pdp-smart-wand-2-large-2.webp"],"colors":[{"n":"Deep Rose","h":"#9F1888"},{"n":"Aqua","h":"#78D5E1"},{"n":"Black","h":"#000000"}],"desc":"A powerful full-body massage wand with deep, rumbly vibration and a flexible head. Cordless and rechargeable — perfect for sensual foreplay and all-over relaxation."},"tor-3":{"name":"TOR™ 3","type":"陰莖環","price":24000,"cur":"JPY","imgs":["assets/pdp-tor-3-0.webp","assets/pdp-tor-3-1.webp","assets/pdp-tor-3-2.webp"],"colors":[{"n":"Violet Dusk","h":"#9B87AA"},{"n":"Black","h":"#000000"},{"n":"Base Blue","h":"#344974"}],"desc":"A comfortable, stretchy vibrating ring that brings shared stimulation to couples. Rechargeable, body-safe and remarkably quiet for intimate play together."},"tiani-3":{"name":"TIANI™ 3","type":"遙控震動器","price":25000,"cur":"JPY","imgs":["assets/pdp-tiani-3-0.webp","assets/pdp-tiani-3-1.webp","assets/pdp-tiani-3-2.webp"],"colors":[{"n":"Deep Rose","h":"#9F1888"},{"n":"Black","h":"#000000"},{"n":"Cerise","h":"#DE1C85"}],"desc":"A discreet wearable massager you can enjoy solo or hand control to a partner. Body-safe silicone, fully waterproof and remote-ready for playful spontaneity."}}, LINK="https://wa.me/8613333333333", WA="<svg viewBox=\"0 0 24 24\"><path d=\"M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.027zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z\"/></svg>";
  var ICON={
    heart:'<svg class="dlz-pi__heart" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.9-9.6-9.3C1 8.4 2.6 5 5.9 5c2 0 3.3 1.2 4.1 2.4C10.8 6.2 12.1 5 14.1 5c3.3 0 4.9 3.4 3.5 6.7C19.5 16.1 12 21 12 21z" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    warranty:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke-width="1.4"/><path d="M9 12l2 2 4-4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pay:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" stroke-width="1.4"/><path d="M3 10h18" stroke-width="1.4"/></svg>',
    box:'<svg viewBox="0 0 24 24"><path d="M3 8l9-4 9 4-9 4-9-4z" stroke-width="1.4" stroke-linejoin="round"/><path d="M3 8v8l9 4 9-4V8" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  };
  function build(){
    if(document.querySelector('.dlz-pdp')) return;
    var m=(location.pathname.match(/([a-z0-9-]+)\.html/)||[])[1];
    var d=m&&D[m]; if(!d) return;
    var imgs=d.imgs&&d.imgs.length?d.imgs:[''];
    var price=d.price?(d.cur+' '+Number(d.price).toLocaleString('en-US')):'';
    var thumbs=imgs.map(function(s,i){return '<button class="dlz-gal__thumb'+(i===0?' active':'')+'" data-i="'+i+'"><img src="'+s+'" alt=""></button>';}).join('');
    var swatches=(d.colors||[]).map(function(c,i){return '<button class="dlz-pi__sw'+(i===0?' active':'')+'" data-i="'+i+'" data-name="'+c.n+'" style="background:'+c.h+'" aria-label="'+c.n+'"></button>';}).join('');
    var firstColor=(d.colors&&d.colors[0])?d.colors[0].n:'';
    var sec=document.createElement('section'); sec.className='dlz-pdp';
    sec.innerHTML=
      '<div class="dlz-gal"><div class="dlz-gal__thumbs">'+thumbs+'</div>'+
        '<div class="dlz-gal__main"><img src="'+imgs[0]+'" alt="'+d.name+'"></div></div>'+
      '<div class="dlz-pi">'+
        '<div class="dlz-pi__top"><div><h1 class="dlz-pi__name">'+d.name+'</h1>'+
          (d.type?'<div class="dlz-pi__type">'+d.type+'</div>':'')+'</div>'+ICON.heart+'</div>'+
        (price?'<div class="dlz-pi__price">'+price+'</div>':'')+
        (swatches?'<div class="dlz-pi__colors">'+swatches+'<span class="dlz-pi__swname">'+firstColor+'</span></div>':'')+
        '<a class="dlz-pi__wa" href="'+LINK+'" target="_blank" rel="noopener">'+WA+' 联系 WhatsApp</a>'+
        '<hr class="dlz-pi__hr">'+
        '<p class="dlz-pi__desc">'+d.desc+'</p>'+
        '<div class="dlz-pi__trust">'+
          '<div>'+ICON.warranty+'1-Year Warranty</div>'+
          '<div>'+ICON.pay+'Safe Shopping</div>'+
          '<div>'+ICON.box+'Discreet Packaging</div>'+
        '</div>'+
      '</div>';
    var anchor=document.querySelector('#specifications');
    if(anchor&&anchor.parentNode){ anchor.parentNode.insertBefore(sec, anchor.nextSibling); }
    else { var content=document.querySelector('.layout-content')||document.querySelector('main')||document.body; content.insertBefore(sec, content.firstChild); }
    // gallery thumb switching
    var main=sec.querySelector('.dlz-gal__main img');
    sec.querySelectorAll('.dlz-gal__thumb').forEach(function(b){ b.addEventListener('click',function(){ var i=+b.getAttribute('data-i'); sec.querySelectorAll('.dlz-gal__thumb').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); main.src=imgs[i]; var sw=sec.querySelector('.dlz-pi__sw[data-i="'+i+'"]'); if(sw){ sec.querySelectorAll('.dlz-pi__sw').forEach(function(x){x.classList.remove('active');}); sw.classList.add('active'); if(nameEl) nameEl.textContent=sw.getAttribute('data-name'); } }); });
    // color select (highlight + name)
    var nameEl=sec.querySelector('.dlz-pi__swname');
    sec.querySelectorAll('.dlz-pi__sw').forEach(function(b){ b.addEventListener('click',function(){ var i=+b.getAttribute('data-i'); sec.querySelectorAll('.dlz-pi__sw').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); if(nameEl) nameEl.textContent=b.getAttribute('data-name'); if(imgs[i]) main.src=imgs[i]; var thumb=sec.querySelector('.dlz-gal__thumb[data-i="'+i+'"]'); if(thumb){ sec.querySelectorAll('.dlz-gal__thumb').forEach(function(x){x.classList.remove('active');}); thumb.classList.add('active'); } }); });
  }
  if(document.readyState!=='loading')build();else document.addEventListener('DOMContentLoaded',build);
})();
