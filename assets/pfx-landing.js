/* PureFxAi Netflix-style landing: hero carousel, Top 10, For you, genre rows, series detail modal. Mount: <div id="pfxLanding" data-mode="full|home"> */
(function(){const root=document.getElementById('pfxLanding');if(!root)return;const full=root.dataset.mode!=='home';
const GR={romance:'linear-gradient(160deg,#3a1a2c,#7a2f4d 55%,#e8b84a)',horror:'linear-gradient(160deg,#05070a,#1a2420 60%,#3b0f12)',fantasy:'linear-gradient(160deg,#0f2a3a,#1d5c6b 55%,#c9a24a)',comedy:'linear-gradient(160deg,#3a240a,#b8561f 60%,#f2c14e)',melodrama:'linear-gradient(160deg,#1a0a10,#5a1424 60%,#c99a3a)',action:'linear-gradient(160deg,#0a0a0a,#5a1010 55%,#e85a2a)',mystery:'linear-gradient(160deg,#060a18,#1a2550 60%,#6a4ab8)',isekai:'linear-gradient(160deg,#0f1a3a,#2a3f8a 55%,#e8b84a)',cartoon:'linear-gradient(160deg,#0a2a3a,#1d8a9b 55%,#f5d27a)'};
const TX={th:{play:"ดูเลย",resume:"ดูต่อ",info:"รายละเอียด",top:"Top 10 อันดับวันนี้",fy:"แนะนำสำหรับคุณ",cont:"ดูต่อ",soon:"เร็วๆ นี้",eps:"ตอน",epl:"ตอนทั้งหมด",noep:"ตอนแรกกำลังถ่ายทำ ติดตามเร็วๆ นี้",free:"ดูฟรี",all:"ดูทั้งหมด",feat:"ซีรีส์แนะนำ"},en:{play:"Play",resume:"Resume",info:"More info",top:"Top 10 today",fy:"Recommended for you",cont:"Continue watching",soon:"Coming soon",eps:"episodes",epl:"Episodes",noep:"Episode 1 is in production. Coming soon.",free:"Free",all:"See all",feat:"Featured series"}};
const lg=()=>(document.documentElement.lang||localStorage.getItem('pfx_lang')||'th').slice(0,2)=='en'?'en':'th',tt=k=>TX[lg()][k];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>{s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const PL='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',IN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',XX='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
let MANL=null,ST={eps:{}},hi=0,timer=null;
const bg=s=>`${s.coverOk?`url('${esc(s.cover)}'),`:''}${GR[s.genre]||GR.romance}`;
const avail=s=>s.episodes.filter(e=>e.available);
const score=s=>s.episodes.reduce((a,e)=>{const x=ST.eps[e.id]||{};return a+(x.views||0)+3*(x.likes||0)+2*(x.comments||0)},0);
const nav=()=>window.PfxNav;
function resume(s){return nav()&&nav().resumeFor?nav().resumeFor(s.id):null}
function play(s){const r=resume(s);if(r)return nav().go(r.e.id,r.h.pos);const e=avail(s)[0];if(!e)return detail(s);nav()?nav().go(e.id,0):location.href='index.html#v/'+e.id}
function card(s,i,rank){const r=resume(s);return `<button class="ld-c" data-s="${esc(s.id)}">${rank?`<b>${rank}</b>`:''}<div class="pp" style="background-image:${bg(s)}">${avail(s).length?'':`<span class="sn">${tt('soon')}</span>`}${r?`<span class="rz">${tt('resume')} EP${r.e.n}</span>`:''}<em>${esc(s[lg()])}</em></div><small>${esc(s['tag_'+lg()]||s['desc_'+lg()]||'')}</small></button>`}
function row(title,list,cls,rank){return list.length?`<section class="ld-row ${cls||''}"><h3>${title}</h3><div class="ld-rs">${list.map((s,i)=>card(s,i,rank?i+1:0)).join('')}</div></section>`:''}
function render(){if(!MANL)return;const S=MANL.series,L=lg(),G=(MANL.genres||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
 let feat=S.filter(s=>s.featured);if(!feat.length)feat=S.filter(s=>avail(s).length).concat(S.filter(s=>!avail(s).length&&s.coverOk)).slice(0,5);if(hi>=feat.length)hi=0;
 const scored=S.map((s,i)=>({s,i,v:score(s)})),hasData=scored.some(x=>x.v>0);
 const top=(hasData?scored.slice().sort((a,b)=>b.v-a.v||a.i-b.i):scored).slice(0,10).map(x=>x.s);
 const cl=nav()&&nav().contList?nav().contList():[];const wg={};cl.forEach(c=>wg[c.s.genre]=(wg[c.s.genre]||0)+1);
 const fy=(cl.length?S.filter(s=>wg[s.genre]&&!cl.some(c=>c.s.id==s.id)).concat(S.filter(s=>!wg[s.genre])):scored.slice().sort((a,b)=>b.v-a.v).map(x=>x.s)).slice(0,12);
 const hero=`<div class="ld-hero">${feat.map((s,i)=>{const r=resume(s),g=G.find(x=>x.id==s.genre);return `<div class="ld-sl ${i==hi?'on':''}"><div class="bg" style="background-image:${bg(s)}"></div><div class="po" style="background-image:${bg(s)}"></div><div class="tx"><span class="gn">${esc(g?g[L]:'')}${avail(s).length?'':' · '+tt('soon')}</span><h2>${esc(s[L])}</h2>${s['tag_'+L]?`<p class="tg">${esc(s['tag_'+L])}</p>`:''}<p class="ds">${esc(s['desc_'+L]||'')}</p><button class="ld-b p" data-play="${esc(s.id)}">${PL}${r?tt('resume')+' EP'+r.e.n+(r.h.pos?' · '+fmt(r.h.pos):''):tt('play')}</button><button class="ld-b s" data-s="${esc(s.id)}">${IN}${tt('info')}</button></div></div>`}).join('')}<div class="ld-dots">${feat.map((s,i)=>`<i class="${i==hi?'on':''}" data-i="${i}"></i>`).join('')}</div></div>`;
 let h=hero;
 if(full){h+=`<div class="ld-chips" id="cats">${G.map(g=>`<a href="#g-${esc(g.id)}">${esc(g[L])}</a>`).join('')}</div>`;
  if(cl.length)h+=row(tt('cont'),cl.map(c=>c.s));h+=row(tt('top'),top,'ld-top',1)+row(tt('fy'),fy);
  for(const g of G){const l=S.filter(s=>s.genre==g.id);if(l.length)h+=row(esc(g[L]),l).replace('<section class="ld-row ','<section id="g-'+esc(g.id)+'" class="ld-row ')}}
 else h+=row(tt('top'),top,'ld-top',1)+`<p style="margin:0 6% 10px"><a class="ld-b s" href="series.html">${tt('all')}</a></p>`;
 root.innerHTML=`<div class="ld">${h}</div>`;
 root.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(S.find(s=>s.id==b.dataset.play)));
 root.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>detail(S.find(s=>s.id==b.dataset.s)));
 root.querySelectorAll('.ld-dots i').forEach(d=>d.onclick=()=>{hi=+d.dataset.i;render()});
 clearInterval(timer);timer=setInterval(()=>{const sl=root.querySelectorAll('.ld-sl'),ds=root.querySelectorAll('.ld-dots i');if(!sl.length)return;sl[hi]&&sl[hi].classList.remove('on');ds[hi]&&ds[hi].classList.remove('on');hi=(hi+1)%sl.length;sl[hi].classList.add('on');ds[hi].classList.add('on')},6500);
 if(full&&location.hash.startsWith('#s/')){const s=S.find(x=>x.id==location.hash.slice(3));if(s&&!md.classList.contains('open'))detail(s)}}
const md=document.createElement('div');md.className='ld-md';document.body.appendChild(md);md.onclick=e=>{if(e.target===md)md.classList.remove('open')};
function detail(s){if(!s)return;const L=lg(),r=resume(s),H={...(()=>{try{return JSON.parse(localStorage.getItem('pfx_hist')||'{}')}catch(e){return{}}})(),...((nav()&&nav().ud&&nav().ud.history)||{})};
 md.innerHTML=`<div class="ld-mb"><button class="x" aria-label="close">${XX}</button><div class="hd"><div class="pp" style="background-image:${bg(s)}"></div><div><span class="ld-c"><span class="sn" style="position:static">${avail(s).length?avail(s).length+' / '+s.episodes.length+' '+tt('eps'):tt('soon')}</span></span><h2>${esc(s[L])}</h2>${s['tag_'+L]?`<p style="color:#f3e3b0">${esc(s['tag_'+L])}</p>`:''}<p>${esc(s['desc_'+L]||'')}</p>${avail(s).length?`<button class="ld-b p" data-play>${PL}${r?tt('resume')+' EP'+r.e.n+(r.h.pos?' · '+fmt(r.h.pos):''):tt('play')+' EP1'}</button>`:''}</div></div>
 <div class="ld-el"><h4>${tt('epl')}</h4>${s.episodes.length?s.episodes.map(e=>{const h=H[e.id],ip=h&&h.pos>2&&!(h.dur&&h.pos>=h.dur-3);return `<button class="ld-e ${e.available?'':'dis'}" data-e="${esc(e.id)}" data-pos="${ip?Math.floor(h.pos):0}"><div class="c" style="background-image:url('${esc(e.coverOk?e.cover:s.coverOk?s.cover:'')}')"></div><div><b>EP${e.n} ${esc(e[L]||'')}</b><small>${esc(e['cap_'+L]||'')}</small></div><span class="bd">${e.available?(ip?tt('resume')+' '+fmt(h.pos):tt('free')):tt('soon')}</span></button>`}).join(''):`<p>${tt('noep')}</p>`}</div></div>`;
 md.classList.add('open');md.querySelector('.x').onclick=()=>md.classList.remove('open');
 const pb=md.querySelector('[data-play]');if(pb)pb.onclick=()=>{md.classList.remove('open');play(s)};
 md.querySelectorAll('.ld-e:not(.dis)').forEach(b=>b.onclick=()=>{md.classList.remove('open');nav()?nav().go(b.dataset.e,+b.dataset.pos):location.href='index.html#v/'+b.dataset.e+'/'+b.dataset.pos})}
async function load(){try{MANL=await (await fetch('/api/lms/series')).json()}catch(e){}try{ST=await (await fetch('/api/shorts-stats')).json()}catch(e){}render();setTimeout(render,2500)}
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});load()})();
