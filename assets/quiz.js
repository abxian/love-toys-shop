// dulizhan: static sex-toy quiz. Recreates lelo's questions + recommends scraped products.
(function(){
  var D={"PRODUCTS":[{"slug":"ina-thrust","name":"INA™ Thrust","tagline":"Dual-stimulation thrusting rabbit","anatomy":"female","play":["solo","couple"],"stim":["g-spot","clitoral"],"budget":"high","level":["intermediate","sexpert"]},{"slug":"enigma-double-sonic","name":"ENIGMA™ Double Sonic","tagline":"A-spot + clitoral sonic massager","anatomy":"female","play":["solo"],"stim":["a-spot","clitoral"],"budget":"high","level":["intermediate","sexpert"]},{"slug":"f1s-v3","name":"F1S™ V3","tagline":"AI-driven male masturbator","anatomy":"male","play":["solo"],"stim":["penis"],"budget":"high","level":["intermediate","sexpert"]},{"slug":"soraya-wave","name":"SORAYA Wave™","tagline":"Come-hither G-spot rabbit","anatomy":"female","play":["solo"],"stim":["g-spot","clitoral"],"budget":"high","level":["newbie","intermediate","sexpert"]},{"slug":"sona-2-cruise","name":"SONA™ 2 Cruise","tagline":"Clitoral sonic stimulator","anatomy":"female","play":["solo"],"stim":["clitoral"],"budget":"mid","level":["newbie","intermediate"]},{"slug":"smart-wand-2-large","name":"SMART WAND™ 2 Large","tagline":"Full-body massage wand","anatomy":"female","play":["solo","couple"],"stim":["clitoral"],"budget":"high","level":["newbie","intermediate","sexpert"]},{"slug":"tor-3","name":"TOR™ 3","tagline":"Couples’ vibrating ring","anatomy":"male","play":["couple"],"stim":["penis","clitoral"],"budget":"mid","level":["newbie","intermediate"]},{"slug":"tiani-3","name":"TIANI™ 3","tagline":"Wearable couples’ massager","anatomy":"female","play":["couple"],"stim":["g-spot","clitoral"],"budget":"high","level":["intermediate","sexpert"]}],"QUESTIONS":[{"key":"age","q":"How old are you?","opts":["18-24","25-34","35-44","45-54","55-64","65+"]},{"key":"identity","q":"How do you identify as?","opts":["Straight","Gay","Lesbian","Bisexual","Queer","Other"]},{"key":"level","q":"What's your experience level?","opts":["Newbie","Intermediate","Sexpert"],"map":{"Newbie":"newbie","Intermediate":"intermediate","Sexpert":"sexpert"}},{"key":"tried","q":"Have you already tried LELO products?","opts":["First timer","Only once","I'm a huge fan","I prefer other brands"]},{"key":"forwho","q":"Are you treating yourself or looking for a gift?","opts":["Myself","Gift"]},{"key":"budget","q":"What's your budget?","opts":["I'll decide after","Mid-range","Money is not an issue"],"map":{"I'll decide after":"any","Mid-range":"mid","Money is not an issue":"high"}},{"key":"anatomy","q":"What type of anatomy are you looking to satisfy?","opts":["Female","Male"],"map":{"Female":"female","Male":"male"}},{"key":"play","q":"Playing solo or with someone?","opts":["Solo","Couple"],"map":{"Solo":"solo","Couple":"couple"}},{"key":"stim","q":"What stimulation type are you looking for?","optsBy":{"female":["G-spot","Clitoral","A-spot","Anal"],"male":["Penis","Prostate","Anal"]},"map":{"G-spot":"g-spot","Clitoral":"clitoral","A-spot":"a-spot","Anal":"anal","Penis":"penis","Prostate":"prostate"}}]};
  var imgOf=function(s){return 'assets/grid-'+s+'.webp';};
  var ans={}, order=[], idx=0, modal;

  function visibleQuestions(){
    return D.QUESTIONS.map(function(q){
      var o=Object.assign({},q);
      if(q.optsBy){ o.opts=q.optsBy[ans.anatomy]||q.optsBy.female; }
      return o;
    });
  }
  function score(){
    return D.PRODUCTS.map(function(p){
      var s=0;
      if(ans.anatomy && p.anatomy===ans.anatomy) s+=4;
      if(ans.play && p.play.indexOf(ans.play)>=0) s+=3;
      if(ans.stim && p.stim.indexOf(ans.stim)>=0) s+=4;
      if(ans.budget && ans.budget!=='any' && p.budget===ans.budget) s+=1;
      if(ans.level && p.level.indexOf(ans.level)>=0) s+=1;
      return {p:p,s:s};
    }).sort(function(a,b){return b.s-a.s;});
  }

  function render(){
    var qs=visibleQuestions();
    modal.querySelector('.dlz-quiz-progress').style.width=Math.round(idx/qs.length*100)+'%';
    var body=modal.querySelector('.dlz-quiz-inner');
    if(idx>=qs.length){ return renderResult(body); }
    var q=qs[idx];
    var html='<div class="dlz-quiz-step">Question '+(idx+1)+' / '+qs.length+'</div>'+
      '<h2 class="dlz-quiz-q">'+q.q+'</h2>'+
      '<div class="dlz-quiz-opts'+(q.opts.length<=2?' one':'')+'">'+
      q.opts.map(function(o){return '<button class="dlz-quiz-opt" data-v="'+o+'">'+o+'</button>';}).join('')+'</div>'+
      (idx>0?'<button class="dlz-quiz-back">← Back</button>':'');
    body.innerHTML=html;
    body.querySelectorAll('.dlz-quiz-opt').forEach(function(b){
      b.onclick=function(){
        var raw=b.getAttribute('data-v');
        ans[q.key]=q.map?(q.map[raw]||raw):raw;
        idx++; render();
      };
    });
    var back=body.querySelector('.dlz-quiz-back');
    if(back) back.onclick=function(){ idx=Math.max(0,idx-1); render(); };
  }

  function renderResult(body){
    modal.querySelector('.dlz-quiz-progress').style.width='100%';
    var ranked=score(), top=ranked[0], rest=ranked.slice(1,4);
    function card(o,isTop){
      var p=o.p;
      return '<a class="dlz-quiz-card'+(isTop?' top':'')+'" href="'+p.slug+'.html">'+
        (isTop?'<div><img src="'+imgOf(p.slug)+'" alt="'+p.name+'"></div><div>'+
          '<span class="dlz-quiz-badge">Your perfect match</span>'+
          '<div class="nm">'+p.name+'</div><div class="tl">'+p.tagline+'</div>'+
          '<span class="vp">View product</span></div>'
        :'<img src="'+imgOf(p.slug)+'" alt="'+p.name+'"><div class="nm">'+p.name+'</div>'+
          '<div class="tl">'+p.tagline+'</div><span class="vp">View product</span>')+'</a>';
    }
    body.innerHTML='<div class="dlz-quiz-result-h">Quiz complete</div>'+
      '<h2 class="dlz-quiz-result-t">We found your matches</h2>'+
      '<div class="dlz-quiz-cards">'+card(top,true)+rest.map(function(o){return card(o,false);}).join('')+'</div>'+
      '<button class="dlz-quiz-restart">Retake quiz</button>';
    body.querySelector('.dlz-quiz-restart').onclick=function(){ ans={};idx=0;render(); };
  }

  function open(){ ans={};idx=0; if(!modal) build(); modal.classList.add('open'); document.body.style.overflow='hidden'; render(); }
  function close(){ modal.classList.remove('open'); document.body.style.overflow=''; }
  function build(){
    modal=document.createElement('div');
    modal.className='dlz-quiz-modal';
    modal.innerHTML='<div class="dlz-quiz-progress"></div><button class="dlz-quiz-close" aria-label="Close">×</button><div class="dlz-quiz-inner"></div>';
    document.body.appendChild(modal);
    modal.querySelector('.dlz-quiz-close').onclick=close;
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }

  // Hijack lelo's "Start quiz" button (Drupal AJAX is dead offline).
  document.addEventListener('click',function(e){
    var t=e.target.closest('.quiz_sex_toy__cta, #edit-start, input[value="Start quiz" i], button, a');
    if(!t) return;
    var label=(t.value||t.textContent||'').trim().toLowerCase();
    if(t.classList.contains('quiz_sex_toy__cta')||t.id==='edit-start'||label==='start quiz'){
      e.preventDefault(); e.stopPropagation(); open();
    }
  },true);
})();
