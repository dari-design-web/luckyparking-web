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
  var grid=document.getElementById('sites-grid'), cnt=document.getElementById('count');
  var state={city:'全部',company:'全部'};
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function card(s){
    var img=s.img?'<div class="im"><img src="assets/img/sites/'+s.img+'.jpg" alt="'+esc(s.name)+'" loading="lazy">'+(s.imgNote?'<span class="tag">'+esc(s.imgNote)+'</span>':'')+'</div>':'<div class="im ph-img">照片準備中</div>';
    var credit=s.imgCredit?'<a class="credit" href="'+esc(s.imgCredit.url)+'" target="_blank" rel="noopener">'+esc(s.imgCredit.label)+'</a>':'';
    var status=s.status==='營運中'?'<span class="chip g">營運中</span>':(s.status?'<span class="chip o">'+esc(s.status)+'</span>':'');
    return '<article class="site">'+img+'<div class="bd"><h3>'+esc(s.name)+'</h3><div class="meta"><span class="chip">'+esc(s.city)+(s.district?' '+esc(s.district):'')+'</span><span class="chip b">'+esc(s.type)+'</span>'+status+'</div><span class="muted" style="font-size:13px">'+esc(s.company)+'</span>'+credit+(s.map?'<a class="map" href="'+esc(s.map)+'" target="_blank" rel="noopener">地圖</a>':'')+'</div></article>';
  }
  function render(){
    var list=sites.filter(function(s){return (state.city==='全部'||s.city===state.city)&&(state.company==='全部'||s.company===state.company);});
    grid.innerHTML=list.map(card).join('');
    cnt.textContent='共 '+list.length+' 處';
    document.querySelectorAll('[data-f]').forEach(function(btn){btn.setAttribute('aria-pressed',state[btn.dataset.f]===btn.dataset.v);});
  }
  document.querySelectorAll('[data-f]').forEach(function(btn){btn.addEventListener('click',function(){state[btn.dataset.f]=btn.dataset.v;render();});});
  render();
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

// 首頁背景影片：暫停／播放；系統設定「減少動態」時不自動播放
(function(){
  var v=document.getElementById('hero-video'), b=document.getElementById('vtoggle'); if(!v||!b) return;
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function set(p){ if(p){v.pause();}else{var r=v.play(); if(r&&r.catch) r.catch(function(){});} b.setAttribute('aria-pressed',p); b.setAttribute('aria-label',p?'播放背景影片':'暫停背景影片'); }
  if(rm) set(true);
  b.addEventListener('click',function(){ set(!v.paused ? true : false); });
})();

// 背景影片（太陽早餐等）：暫停鍵、離開畫面時暫停、減少動態時不播
(function(){
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.sunband').forEach(function(sec){
    var v=sec.querySelector('video.sunbg'), b=sec.querySelector('.bgtoggle'); if(!v) return;
    var user=false;
    function set(p){ if(p){v.pause();}else{var r=v.play(); if(r&&r.catch) r.catch(function(){});} if(b){b.setAttribute('aria-pressed',p); b.setAttribute('aria-label',p?'播放背景影片':'暫停背景影片');} }
    if(rm){ set(true); user=true; }
    if(b) b.addEventListener('click',function(){ user=!v.paused; set(!v.paused); });
    if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ es.forEach(function(e){ if(user) return; if(e.isIntersecting){ set(false); } else { v.pause(); } }); },{threshold:.15}).observe(sec); }
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
