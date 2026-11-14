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
  try{ var qp=new URLSearchParams(location.search).get('q'); if(qp&&qi){ qi.value=qp; state.q=qp; } }catch(e){}
  if(qi) qi.addEventListener('input',function(){ state.q=qi.value.trim(); render(); try{ var u=new URL(location.href); if(state.q) u.searchParams.set('q',state.q); else u.searchParams.delete('q'); history.replaceState(null,'',u); }catch(e){} });
  function norm(t){ t=String(t||''); try{ t=t.normalize('NFKC'); }catch(e){} return t.replace(/台/g,'臺').replace(/\s+/g,'').toLowerCase(); }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function card(s){
    var TYPE={'地下':'underground','立體':'multistorey','平面':'surface'};
    var cap='', img='', im;
    if(s.img){ img='<img src="assets/img/sites/'+s.img+'.jpg" alt="'+esc(s.name)+'" loading="lazy">'; if(s.imgNote==='暫用') cap='<span class="imcap">暫用照片</span>'; }
    else if(TYPE[s.type]){ img='<img src="assets/img/sites/type-'+TYPE[s.type]+'.jpg" alt="" loading="lazy">'; cap='<span class="imcap"><span>場型示意</span><span class="sep">｜</span><span>非現場照片</span></span>'; }
    im=img?'<div class="im">'+img+cap+'</div>':'<div class="im ph-img"><span class="imcap">照片準備中</span></div>';
    var credit=s.imgCredit?'<a class="credit" href="'+esc(s.imgCredit.url)+'" target="_blank" rel="noopener">'+esc(s.imgCredit.label)+'</a>':'';
    var status=s.status==='營運中'?'<span class="chip g">營運中</span>':(s.status?'<span class="chip o">'+esc(s.status)+'</span>':'');
    var map=s.map?'<a class="map" href="'+esc(s.map)+'" target="_blank" rel="noopener" aria-label="在地圖上查看'+esc(s.name)+(s.mapLabel?'周邊':'')+'">'+esc(s.mapLabel||'地圖')+'</a>':'';
    var loc=(s.address||map)?'<div class="loc">'+(s.address?'<span class="addr">'+esc(s.address)+'</span>':'')+map+'</div>':'';
    return '<article class="site"><div class="bd"><h3>'+esc(s.name)+'</h3><div class="meta"><span class="chip">'+esc(s.city)+(s.district?' '+esc(s.district):'')+'</span><span class="chip b">'+esc(s.type)+'</span>'+status+'</div><span class="co">'+esc(s.company)+'</span>'+credit+loc+'</div>'+im+'</article>';
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

// 合作洽詢：組成電子郵件（不經伺服器）
(function(){
  var f=document.getElementById('cform'); if(!f) return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var st=document.getElementById('cstatus');
    if(!f.checkValidity()){st.style.color='#b4501a';st.textContent='請填寫姓名、電子郵件與內容。';return;}
    var v=function(id){return document.getElementById(id).value.trim();};
    var subject='【官網洽詢】'+v('c-type')+'｜'+(v('c-org')||v('c-name'));
    var body='姓名：'+v('c-name')+'\n單位：'+v('c-org')+'\n電話：'+v('c-tel')+'\n電子郵件：'+v('c-mail')+'\n類別：'+v('c-type')+'\n\n'+v('c-msg');
    var to=f.dataset.to;
    window.location.href='mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    st.style.color='';st.textContent='已開啟您的郵件程式，請按「傳送」完成寄出。若沒有開啟，請直接寄信至 '+to+'。';
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
    var sec=v.closest('section'), b=sec&&sec.querySelector('.bgtoggle'), user=false, vis=false, mobileOk=v.dataset.mobile==='1';
    if(rm){ if(b) b.hidden=true; return; }
    function allowed(){ return mobileOk || mqD.matches; }
    function setBtn(paused){ if(!b) return; b.hidden=!allowed(); b.setAttribute('aria-pressed',paused); b.setAttribute('aria-label',paused?'播放背景影片':'暫停背景影片'); }
    function go(){ if(allowed() && vis && !user){ if(!v.getAttribute('src')){ v.src=v.dataset.src; } var r=v.play(); if(r&&r.catch) r.catch(function(){}); setBtn(false); } else { v.pause(); setBtn(true); } }
    if(b) b.addEventListener('click',function(){ user=!user; go(); });
    if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ es.forEach(function(e){ vis=e.isIntersecting; go(); }); },{threshold:.1}).observe(sec||v); } else { vis=true; go(); }
    if(mqD.addEventListener) mqD.addEventListener('change',go);
  });
})();

// 叁肆行品牌浮層：Esc 或點外面收合，焦點回到摘要
(function(){
  var ds=document.querySelectorAll('details.brands'); if(!ds.length) return;
  document.addEventListener('keydown',function(e){ if(e.key!=='Escape') return; ds.forEach(function(d){ if(d.open){ d.open=false; var s=d.querySelector('summary'); if(s) s.focus(); } }); });
  document.addEventListener('click',function(e){ ds.forEach(function(d){ if(d.open && !d.contains(e.target)) d.open=false; }); });
})();
