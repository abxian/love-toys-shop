// dulizhan: WhatsApp contact — replaces newsletter form + chat widget.
(function(){
  var LINK="https://wa.me/8613333333333", NUM="+86 133 3333 3333", ICON="<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.027zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z\"/></svg>";
  function replaceNewsletter(){
    var block=document.querySelector('.newsletter_block, .newsletter-custom-block');
    if(!block||block.dataset.waDone)return;
    var body=block.querySelector('.field_newsletter_body');
    if(body)body.innerHTML='<p>Have a question? Chat with us directly on WhatsApp — we usually reply within minutes.</p>';
    var sub=block.querySelector('#block-play-subscriptionblock')||block.querySelector('#hil-newsletter-lelo-newsletter');
    if(sub){
      sub.innerHTML='<a class="dlz-wa-cta" href="'+LINK+'" target="_blank" rel="noopener">'+ICON+' Contact us on WhatsApp</a>'+
        '<div class="dlz-wa-num">'+NUM+'</div>';
    }
    block.dataset.waDone='1';
  }
  function addFloat(){
    if(document.querySelector('.dlz-wa-float'))return;
    var a=document.createElement('a');
    a.className='dlz-wa-float';a.href=LINK;a.target='_blank';a.rel='noopener';
    a.setAttribute('aria-label','Contact us on WhatsApp');
    a.innerHTML=ICON+'<span>Chat on WhatsApp</span>';
    document.body.appendChild(a);
  }
  function killChat(){
    ['#launcher','#webWidget'].forEach(function(s){document.querySelectorAll(s).forEach(function(n){n.style.setProperty('display','none','important');});});
    document.querySelectorAll('iframe').forEach(function(f){
      var t=(f.title||'').toLowerCase();
      var b=f.getBoundingClientRect();
      // small iframe pinned to a bottom corner = chat/proactive-message widget (locale-proof)
      var corner=b.width>0&&b.height>0&&b.width<320&&b.height<160&&
        b.top>window.innerHeight-240&&(b.left<280||b.right>window.innerWidth-280);
      if(/chat|messag|unread|help|消息|客服|启动/.test(t)||corner)
        f.style.setProperty('display','none','important');
    });
  }
  function run(){ replaceNewsletter(); addFloat(); killChat(); }
  if(document.readyState!=='loading')run();else document.addEventListener('DOMContentLoaded',run);
  // chat widget loads late — keep hiding it for a while
  var n=0,t=setInterval(function(){killChat();replaceNewsletter();if(++n>20)clearInterval(t);},400);
  new MutationObserver(killChat).observe(document.documentElement,{childList:true,subtree:true});
})();
