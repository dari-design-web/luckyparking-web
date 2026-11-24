// 選單（手機）
(function(){
  var b=document.getElementById('burger'), m=document.getElementById('menu');
  if(b&&m){
    function setOpen(o){ m.classList.toggle('open',o); b.setAttribute('aria-expanded',o); b.setAttribute('aria-label',o?'關閉選單':'開啟選單'); document.body.classList.toggle('menu-open',o); }
    b.addEventListener('click',function(){ setOpen(!m.classList.contains('open')); });
    m.addEventListener('click',function(e){ if(e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&m.classList.contains('open')){ setOpen(false); b.focus(); } });
    window.addEventListener('resize',function(){ if(window.innerWidth>1040) setOpen(false); });
  }
})();

// 停車場篩選
(function(){
  var data=document.getElementById('parking-data'); if(!data) return;
  var sites=JSON.parse(data.textContent);
  var grid=document.getElementById('sites-grid'), cnt=document.getElementById('results');
  var state={city:'全部',company:'全部',q:''};
  var qi=document.getElementById('q');
  try{ var sp=new URLSearchParams(location.search), qp=sp.get('q'), sc=sp.get('s'); if(!qp&&sc){ for(var k=0;k<sites.length;k++){ if(sites[k].code===sc){ qp=sites[k].name; break; } } } if(qp&&qi){ qi.value=qp; state.q=qp; } }catch(e){}  // ?s=場站代碼 直接列出該場（給 Google 地圖等外部連結用）
  if(qi) qi.addEventListener('input',function(){ state.q=qi.value.trim(); render(); try{ var u=new URL(location.href); if(state.q) u.searchParams.set('q',state.q); else u.searchParams.delete('q'); history.replaceState(null,'',u); }catch(e){} });
  function norm(t){ t=String(t||''); try{ t=t.normalize('NFKC'); }catch(e){} return t.replace(/台/g,'臺').replace(/\s+/g,'').toLowerCase(); }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var SEG=(window.Intl&&Intl.Segmenter)?new Intl.Segmenter('zh-Hant',{granularity:'word'}):null, CJK=/[\u3400-\u9fff]/;
  var KEEP=['地下停車場','立體停車場','平面停車場','停車場','教育館','科學教育館','服務中心','原住民族','國際金融中心','青少年活動中心','流行音樂中心','東三東四','親水公園','運動公園'];
  function ph(t){ if(!SEG||!CJK.test(t)) return esc(t); var segs=[],cuts={},pos=0; for(var it=SEG.segment(t)[Symbol.iterator](),r=it.next();!r.done;r=it.next()) segs.push(r.value.segment);
    segs.forEach(function(g,i){ if(i>0){ var prev=segs[i-1]; var single=g.length===1&&CJK.test(g)&&CJK.test(prev.slice(-1)); if(!single) cuts[pos]=1; } pos+=g.length; });
    KEEP.forEach(function(k){ var i=t.indexOf(k); while(i>=0){ for(var j=i+1;j<i+k.length;j++) delete cuts[j]; i=t.indexOf(k,i+1);} });
    var out=''; for(var i=0;i<t.length;i++){ if(cuts[i]&&CJK.test(t[i-1]||'')&&CJK.test(t[i])) out+='<wbr>'; out+=esc(t[i]); } return out; }
  function card(s){
    var TYPE={'地下':'underground','立體':'multistorey','平面':'surface'};
    var cap='', img='', im;
    if(s.img){ img='<img src="assets/img/sites/'+s.img+'.jpg" alt="'+esc(s.name)+'" loading="lazy">'; if(s.imgNote==='暫用') cap='<span class="imcap">暫用照片</span>'; }
    else if(TYPE[s.type]){ img='<img src="assets/img/sites/type-'+TYPE[s.type]+'.jpg" alt="" loading="lazy">'; cap='<span class="imcap"><span>場型示意</span><span class="sep">｜</span><span>非現場照片</span></span>'; }
    im=img?'<div class="im">'+img+cap+'</div>':'<div class="im ph-img"><span class="imcap">照片準備中</span></div>';
    var credit=s.imgCredit?'<a class="credit" href="'+esc(s.imgCredit.url)+'" target="_blank" rel="noopener">'+esc(s.imgCredit.label)+'</a>':'';
    var map=s.map?'<a class="map" href="'+esc(s.map)+'" target="_blank" rel="noopener" aria-label="在地圖上查看'+esc(s.name)+(s.mapLabel?'周邊':'')+'（另開新視窗）">'+esc(s.mapLabel||'地圖')+'</a>':'';
    var tel=s.phone?'<a class="tel num" href="tel:'+String(s.phone).replace(/\D/g,'').replace(/^0/,'+886')+'" aria-label="撥打'+esc(s.name)+'電話 '+esc(s.phone)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>'+esc(s.phone)+'</a>':'';
    var addr=s.address?'<p class="addr"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg><span>'+esc(s.address).replace(/\s+(B\d[^\s]*)$/,' <span class="fl">$1</span>')+'</span></p>':'';
    var soon=(!s.phone&&s.soon)?'<span class="soon">'+esc(s.soon)+'</span>':'';
    var loc=(tel||soon||map)?'<div class="loc">'+tel+soon+map+'</div>':'';
    return '<article class="site"><div class="bd"><h3>'+ph(s.name)+'</h3><div class="meta"><span class="chip">'+esc(s.city)+(s.district?' '+esc(s.district):'')+'</span><span class="chip b">'+esc(s.type)+'</span></div>'+addr+credit+loc+'</div>'+im+'</article>';
  }

  function render(){
    var raw=String(state.q||'').trim(), whole=norm(raw);
    var toks=raw.split(/[\s,，、\/／;；]+/).map(norm).filter(Boolean);
    var list=sites.filter(function(s){
      if(!(state.city==='全部'||s.city===state.city)) return false;
      if(!(state.company==='全部'||s.company===state.company)) return false;
      if(!whole) return true;
      var h=norm(s.name+(s.district||'')+s.city+(s.address||''));
      if(h.indexOf(whole)>-1) return true;
      for(var i=0;i<toks.length;i++){ if(h.indexOf(toks[i])<0) return false; }
      return toks.length>0;
    });
    grid.innerHTML=list.map(card).join('');
    var filtered=!(state.city==='全部'&&state.company==='全部');
    cnt.textContent=list.length?('共 '+list.length+' 處'):'沒有符合條件的停車場';
    var qh=document.getElementById('qhint'), qt=document.getElementById('qhint-t'), qg=document.getElementById('qhint-go'), qc=document.getElementById('qhint-clear');
    if(qh&&qt){ var msg=state.q?(list.length?('找到 '+list.length+' 處'):('找不到符合「'+state.q+'」的停車場'+(filtered?'，可清除關鍵字或縣市、公司篩選。':'，請換個關鍵字。'))):''; if(qt.textContent!==msg) qt.textContent=msg; qh.classList.toggle('on',!!state.q); if(qg) qg.hidden=!(state.q&&list.length); if(qc) qc.hidden=!state.q; }
    var z=document.getElementById('zero'); if(z){ z.hidden=!(!list.length&&filtered); }
    document.querySelectorAll('[data-f]').forEach(function(btn){btn.setAttribute('aria-pressed',state[btn.dataset.f]===btn.dataset.v);});
  }
  document.querySelectorAll('[data-f]').forEach(function(btn){btn.addEventListener('click',function(){state[btn.dataset.f]=btn.dataset.v;render();});});
  var cqb=document.getElementById('qhint-clear'), cfb=document.getElementById('clear-f');
  if(cqb) cqb.addEventListener('click',function(){ state.q=''; if(qi){ qi.value=''; } try{ var u=new URL(location.href); u.searchParams.delete('q'); history.replaceState(null,'',u);}catch(e){} render(); if(qi) qi.focus(); });
  if(cfb) cfb.addEventListener('click',function(){ state.city='全部'; state.company='全部'; render(); document.querySelectorAll('.citymap .cm').forEach(function(x){ x.setAttribute('aria-pressed','false'); }); });
  function toResults(quiet){ try{ cnt.scrollIntoView({block:'start'}); }catch(e){ cnt.scrollIntoView(); } if(quiet) cnt.classList.add('quiet'); try{ cnt.focus({preventScroll:true}); }catch(e){ cnt.focus(); } }
  cnt.addEventListener('blur',function(){ cnt.classList.remove('quiet'); });
  var qg0=document.getElementById('qhint-go'); if(qg0) qg0.addEventListener('click',function(e){ e.preventDefault(); toResults(); });
  render();
  if(state.q){ requestAnimationFrame(function(){ var r=cnt.getBoundingClientRect(); if(r.top>window.innerHeight*0.6) toResults(true); }); }
})();

// 合作洽詢：有設定 data-endpoint 時直接寄出（Google Apps Script），否則組成郵件草稿
(function(){
  var f=document.getElementById('cform'); if(!f) return;
  var fb=f.querySelector('button[type="submit"]'); if(fb) fb.disabled=false;
  var t0=Date.now(), ep=f.dataset.endpoint, to=f.dataset.to, tel=f.dataset.tel;
  var fallback=function(){ return '請直接來信 '+to+(tel?' 或來電 '+tel:'')+'。'; };
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var st=document.getElementById('cstatus');
    var v=function(id){return document.getElementById(id).value.trim();};
    var telOk=/^(\+?886|0)9\d{8}$/.test(v('c-tel').replace(/[\s\-()]/g,''));
    if(!v('c-name')||!v('c-msg')||!v('c-tel')){st.style.color='#b4501a';st.textContent='請填寫姓名、手機號碼與內容。';return;}
    if(!telOk){st.style.color='#b4501a';st.textContent='手機號碼格式不正確，請輸入 09 開頭的 10 碼號碼。';document.getElementById('c-tel').focus();return;}
    if(!f.checkValidity()){st.style.color='#b4501a';st.textContent='電子郵件格式不正確，或請留空。';document.getElementById('c-mail').focus();return;}
    if(ep){
      var data=new URLSearchParams({name:v('c-name'),org:v('c-org'),mail:v('c-mail'),tel:v('c-tel'),type:v('c-type'),msg:v('c-msg'),website:(f.elements.website||{}).value||'',t:String(Date.now()-t0)});
      fb.disabled=true; var label=fb.textContent; fb.textContent='傳送中…'; st.style.color=''; st.textContent='';
      fetch(ep,{method:'POST',body:data}).then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){ f.reset(); st.style.color='#1d7a46'; st.textContent='已收到您的洽詢，我們會盡快與您聯繫，謝謝。'; }
        else { st.style.color='#b4501a'; st.textContent=(j&&j.error==='rate'?'剛剛已送出過，請稍候一分鐘再試；':'目前無法送出，')+fallback(); }
      }).catch(function(){ st.style.color='#b4501a'; st.textContent='目前無法送出，'+fallback(); })
      .then(function(){ fb.disabled=false; fb.textContent=label; });
      return;
    }
    var subject='【官網洽詢】'+v('c-type')+'｜'+(v('c-org')||v('c-name'));
    var body='姓名：'+v('c-name')+'\n單位：'+v('c-org')+'\n手機號碼：'+v('c-tel')+'\n電子郵件：'+v('c-mail')+'\n類別：'+v('c-type')+'\n\n'+v('c-msg');
    window.location.href='mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    st.style.color='';st.textContent='若已開啟郵件草稿，請在郵件程式確認內容後寄出。若沒有開啟，'+fallback();
  });
})();

// 有聲影片彈窗
(function(){
  var d=document.getElementById('vdialog'); if(!d||!d.showModal) return;
  var v=d.querySelector('video'), c=d.querySelector('.vclose');
  document.querySelectorAll('[data-video]').forEach(function(btn){
    btn.addEventListener('click',function(){ v.src=btn.getAttribute('data-video'); d.setAttribute('aria-label',btn.getAttribute('data-title')||'影片播放'); d.showModal(); var r=v.play(); if(r&&r.catch) r.catch(function(){}); });
  });
  function close(){ v.pause(); d.close(); }
  c.addEventListener('click',close);
  d.addEventListener('click',function(e){ if(e.target===d) close(); });
  d.addEventListener('close',function(){ v.pause(); });
})();

// v0.2：捲動淡入、數字跑動、縣市分布卡
(function(){
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!('IntersectionObserver' in window)) return;
  if(!rm){
    document.documentElement.classList.add('js-rv');
    var els=document.querySelectorAll('.band .head, .ph .wrap > *, .stat, .pillar, .tile, .vcard, .svc article, .news > a, .nlist article, .coop article, .venue, .ghg, .report, .group article, .tl > div, .site');
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }); },{rootMargin:'0px 0px -8% 0px'});
    els.forEach(function(el,i){ var r=el.getBoundingClientRect(); if(r.top<window.innerHeight){ return; } el.classList.add('rv'); el.style.transitionDelay=((i%3)*80)+'ms'; io.observe(el); });
  }
  var cus=document.querySelectorAll('.cu[data-to]');
  if(cus.length && !rm){
    var io2=new IntersectionObserver(function(es){ es.forEach(function(e){ if(!e.isIntersecting) return; io2.unobserve(e.target); var el=e.target, to=+el.dataset.to, t0=null, d=1100;
      function step(t){ if(!t0) t0=t; var p=Math.min(1,(t-t0)/d); el.textContent=Math.round(to*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(step); }
      el.textContent='0'; requestAnimationFrame(step); }); },{threshold:.6});
    cus.forEach(function(el){ io2.observe(el); });
  }
})();
(function(){
  var cms=document.querySelectorAll('.citymap .cm'); if(!cms.length) return;
  cms.forEach(function(b){ b.addEventListener('click',function(){ var on=b.getAttribute('aria-pressed')==='true'; var target=document.querySelector('[data-f="city"][data-v="'+(on?'全部':b.dataset.city)+'"]'); if(target) target.click(); cms.forEach(function(x){ x.setAttribute('aria-pressed', (!on && x===b)?'true':'false'); }); }); });
  document.querySelectorAll('[data-f="city"]').forEach(function(f){ f.addEventListener('click',function(){ cms.forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.city===f.dataset.v?'true':'false'); }); }); });
})();

// 背景影片（首頁主視覺、太陽早餐、獎項區、頁首）
// 規則：未開「減少動態」才載入播放（開了就只顯示海報、不顯示暫停鍵）；頁首／獎項只在桌機播放；進入畫面才載入；可暫停，手動暫停後保持暫停
(function(){
  var vids=document.querySelectorAll('video.bgv'); if(!vids.length) return;
  var mqD=window.matchMedia('(min-width: 701px)'), rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  vids.forEach(function(v){
    var sec=v.closest('section'), b=sec&&sec.querySelector('.bgtoggle'), user=false, vis=false, mobileOk=v.dataset.mobile==='1', once=v.dataset.once==='1', done=false;
    if(rm){ if(b) b.hidden=true; return; }
    function allowed(){ return mobileOk || mqD.matches; }
    function setBtn(paused){ if(!b) return; b.hidden=!allowed(); b.setAttribute('aria-pressed',paused); b.setAttribute('aria-label',paused?'播放背景影片':'暫停背景影片'); }
    if(once) v.addEventListener('ended',function(){ done=true; setBtn(true); });
    function go(){ if(done){ setBtn(true); return; } if(allowed() && vis && !user){ if(!v.getAttribute('src')){ v.src=v.dataset.src; } var r=v.play(); if(r&&r.catch) r.catch(function(){}); setBtn(false); } else { v.pause(); setBtn(true); } }
    if(b) b.addEventListener('click',function(){ if(done){ done=false; user=false; try{ v.currentTime=0; }catch(e){} } else { user=!user; } go(); });
    if('IntersectionObserver' in window){ var th=once?.5:.1; new IntersectionObserver(function(es){ es.forEach(function(e){ vis=e.isIntersecting&&e.intersectionRatio>=th-.01; go(); }); },{threshold:[0,.1,.5]}).observe(v.dataset.obs==='self'?v:(sec||v)); } else { vis=true; go(); }
    if(mqD.addEventListener) mqD.addEventListener('change',go);
  });
})();

// 叁肆行品牌浮層：Esc 或點外面收合，焦點回到摘要
(function(){
  var ds=document.querySelectorAll('details.brands'); if(!ds.length) return;
  document.addEventListener('keydown',function(e){ if(e.key!=='Escape') return; ds.forEach(function(d){ if(d.open){ d.open=false; var s=d.querySelector('summary'); if(s) s.focus(); } }); });
  document.addEventListener('click',function(e){ ds.forEach(function(d){ if(d.open && !d.contains(e.target)) d.open=false; }); });
  ds.forEach(function(d){ d.addEventListener('toggle',function(){ if(!d.open||window.innerWidth>980) return; var p=d.querySelector('.bpanel')||d; setTimeout(function(){ try{ p.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){ p.scrollIntoView(false); } },30); }); });
})();
