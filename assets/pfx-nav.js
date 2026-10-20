/* PureFxAi shared clip-page menu: mobile bottom tabs, desktop overlay, More drawer, Continue watching, episode menu, report. */
(function(){
const S=(p)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I={home:S('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>'),cat:S('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
stu:S('<path d="m12 3 2.2 5.3L20 9l-4.4 3.8L17 19l-5-3-5 3 1.4-6.2L4 9l5.8-.7z"/>'),app:S('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),pro:S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
menu:S('<path d="M4 6h16M4 12h16M4 18h16"/>'),x:S('<path d="M18 6 6 18M6 6l12 12"/>'),play:S('<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>'),ser:S('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6"/>'),
eps:S('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),share:S('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
flag:S('<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>'),book:S('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>'),
tag:S('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),in:S('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>'),
out:S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),hist:S('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>')};
const TX={th:{home:"หน้าแรก",cat:"หมวดหมู่",stu:"สตูดิโอ",app:"แอป",pro:"โปรไฟล์",more:"เพิ่มเติม",menu:"เมนู",cont:"ดูต่อ",contE:"ยังไม่มีเรื่องที่ดูค้างไว้ เริ่มดูตอนไหนก็ได้ ระบบจะจำให้",series:"ซีรีส์ทั้งหมด",eps:"ตอนทั้งหมด",share:"แชร์ตอนนี้",report:"รายงานตอนนี้",courses:"คอร์สเรียน AI",pricing:"ราคาแพ็กเกจ",login:"เข้าสู่ระบบ",logout:"ออกจากระบบ",ep:"ตอนนี้",at:"ถึงนาที",resume:"ดูต่อ",copied:"คัดลอกลิงก์แล้ว",rT:"รายงานเนื้อหา",r1:"เนื้อหาไม่เหมาะสม",r2:"เสียงหรือภาพมีปัญหา",r3:"ซับไม่ตรง",r4:"ละเมิดลิขสิทธิ์",r5:"อื่นๆ",rNote:"รายละเอียดเพิ่มเติม (ไม่บังคับ)",rSend:"ส่งรายงาน",rOk:"ส่งรายงานแล้ว ขอบคุณครับ",sync:"ซิงก์กับบัญชีแล้ว"},
en:{home:"Home",cat:"Categories",stu:"Studio",app:"App",pro:"Profile",more:"More",menu:"Menu",cont:"Continue watching",contE:"Nothing in progress yet. Start any episode and we will remember where you stopped.",series:"All series",eps:"Episodes",share:"Share this episode",report:"Report this episode",courses:"AI courses",pricing:"Pricing",login:"Log in",logout:"Log out",ep:"This episode",at:"at",resume:"Resume",copied:"Link copied",rT:"Report content",r1:"Inappropriate content",r2:"Audio or video problem",r3:"Subtitles out of sync",r4:"Copyright issue",r5:"Other",rNote:"More details (optional)",rSend:"Send report",rOk:"Report sent. Thank you.",sync:"Synced to your account"}};
const lg=()=>(document.documentElement.lang||localStorage.getItem('pfx_lang')||'th').slice(0,2)=='en'?'en':'th',tt=k=>TX[lg()][k];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>{s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const P={me:null,ud:{history:{}},man:null};window.PfxNav=P;
const LH=()=>{try{return JSON.parse(localStorage.getItem('pfx_hist')||'{}')}catch(e){return{}}};
const onIndex=!!document.getElementById('fdFeed'),page=location.pathname.split('/').pop()||'index.html';
async function load(){try{P.man=(typeof MAN!=='undefined'&&MAN)||await (await fetch('/api/lms/series')).json()}catch(e){}
 try{const r=await fetch('/api/lms/me');if(r.ok){P.me=(await r.json()).user;const u=await fetch('/api/lms/me/shorts');if(u.ok)P.ud=await u.json()}}catch(e){}
 if(P.me)await merge();render()}
/* guest history -> account after login (once per newer entry) */
async function merge(){const h=LH(),sv=P.ud.history||{};let n=0;for(const[id,v]of Object.entries(h)){const s=sv[id];if(s&&s.at>=v.at)continue;if(!(v.pos>0))continue;
 try{const r=await fetch('/api/lms/me/shorts',{method:'POST',headers:{'content-type':'application/json','x-pfx':'1'},body:JSON.stringify({ep:id,action:'progress',pos:v.pos,dur:v.dur||0})});if(r.ok){P.ud=await r.json();n++}}catch(e){}}
 if(n&&typeof UD!=='undefined')UD=P.ud;}
function epIndex(){const m={};if(P.man)for(const s of P.man.series)for(const e of s.episodes)m[e.id]={s,e};return m}
/* one entry per series: latest episode watched + position */
function contList(){const H={...LH(),...(P.ud.history||{})},M=epIndex(),by={};
 for(const[id,h]of Object.entries(H)){const x=M[id];if(!x||!h||!(h.pos>2))continue;const done=h.dur&&h.pos>=h.dur-3;
  const cur=by[x.s.id];if(!cur||h.at>cur.h.at)by[x.s.id]={...x,h,done}}
 return Object.values(by).map(c=>{if(c.done){const nx=c.s.episodes.find(e=>e.n==c.e.n+1&&e.available);if(!nx)return null;return{s:c.s,e:nx,h:{pos:0,dur:0,at:c.h.at}}}return c}).filter(Boolean).sort((a,b)=>a.h.at>b.h.at?-1:1)}
P.contList=contList;P.resumeFor=sid=>contList().find(c=>c.s.id==sid);
function go(id,pos){pos=Math.floor(pos||0);close();if(onIndex&&typeof openEp==='function'){openEp(id,pos);history.replaceState(null,'','#v/'+id+(pos?'/'+pos:''))}else location.href='index.html#v/'+id+(pos?'/'+pos:'')}
P.go=go;
const cover=(s,e)=>(e&&e.coverOk?e.cover:s.coverOk?s.cover:'');
function contHTML(){const l=contList();if(!l.length)return `<div class="emp">${tt('contE')}</div>`;
 return l.slice(0,12).map(c=>`<button class="it" data-go="${esc(c.e.id)}" data-pos="${c.h.pos||0}"><div class="cv" style="background-image:url('${esc(cover(c.s,c.e))}')">${c.h.dur?`<i style="width:${Math.min(100,c.h.pos/c.h.dur*100)}%"></i>`:''}</div><div><b>${esc(c.s[lg()])}</b><small>EP${c.e.n} ${esc(c.e[lg()]||'')}</small><span class="pn-res">${tt('resume')} EP${c.e.n}${c.h.pos?' · '+fmt(c.h.pos):''}</span></div></button>`).join('')}
/* drawer */
const dr=document.createElement('div');dr.className='pn-dr';dr.innerHTML='<div class="bk"></div><div class="pn"><div class="pn-hd"><h4 id="pnT"></h4><button id="pnX" aria-label="close">'+I.x+'</button></div><div class="pn-bd" id="pnB"></div></div>';
function open(title,html){dr.querySelector('#pnT').textContent=title;const b=dr.querySelector('#pnB');b.innerHTML=html;dr.classList.add('open');
 b.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go,+x.dataset.pos||0));b.querySelectorAll('[data-act]').forEach(x=>x.onclick=()=>act(x.dataset.act))}
function close(){dr.classList.remove('open')}
const curEp=()=>onIndex&&typeof SHORTS!=='undefined'&&SHORTS[fI]||null;
function menuHTML(){const e=curEp(),it=(ic,lab,attr)=>`<${attr.startsWith('href')?'a':'button'} class="it" ${attr}>${I[ic]}<span>${lab}</span></${attr.startsWith('href')?'a':'button'}>`;
 return `<div class="sec">${tt('cont')}</div>${contHTML()}`+(e?`<div class="sec">${tt('ep')}: EP${e.n} ${esc(e[lg()]||'')}</div>${it('eps',tt('eps'),'data-act="eps"')}${it('share',tt('share'),'data-act="share"')}${it('flag',tt('report'),'data-act="report"')}`:'')+
 `<div class="sec">${tt('menu')}</div>${it('home',tt('home'),'href="index.html"')}${it('ser',tt('series'),'href="series.html"')}${it('cat',tt('cat'),'href="series.html#cats"')}${it('stu',tt('stu'),'href="studio.html"')}${it('app',tt('app'),'href="app.html"')}${it('pro',tt('pro'),'href="profile.html"')}
 <div class="sec">${tt('more')}</div>${it('book',tt('courses'),'href="learn.html"')}${it('tag',tt('pricing'),'href="learn.html#checkout"')}${P.me?it('out',tt('logout')+' ('+esc(P.me.name||P.me.email||'')+')','data-act="logout"'):it('in',tt('login'),'href="learn.html#login"')}`}
P.openMenu=()=>open(tt('menu'),menuHTML());P.openCont=()=>open(tt('cont'),contHTML());
async function act(a){const e=curEp();
 if(a==='eps'){close();document.getElementById('fdList')?.click()}
 else if(a==='share'){close();document.getElementById('fdShare')?.click()}
 else if(a==='logout'){try{await fetch('/api/lms/logout',{method:'POST',headers:{'x-pfx':'1'}})}catch(x){}location.reload()}
 else if(a==='report'&&e){open(tt('rT'),`<div class="rs">${['r1','r2','r3','r4','r5'].map((k,i)=>`<label><input type="radio" name="pnr" value="${k}" ${i?'':'checked'}>${tt(k)}</label>`).join('')}</div><textarea id="pnN" maxlength="280" placeholder="${tt('rNote')}"></textarea><button class="pn-btn" id="pnS">${tt('rSend')}</button>`);
  dr.querySelector('#pnS').onclick=async()=>{const why=TX.en[dr.querySelector('input[name=pnr]:checked').value],note=dr.querySelector('#pnN').value.slice(0,280);
   try{await fetch(`/api/shorts/${e.id}/report`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({why,note})})}catch(x){}
   dr.querySelector('#pnB').innerHTML=`<div class="emp">${tt('rOk')}</div>`}}}
/* mobile tab bar */
const tab=document.createElement('div');tab.className='pn-tab';tab.setAttribute('aria-label','tabs');
function tabs(){const on=k=>({home:page=='index.html',cat:page=='series.html',stu:page=='studio.html',app:page=='app.html',pro:page=='profile.html'})[k]?'on':'';
 tab.innerHTML=[['home','index.html'],['cat','series.html'],['stu','studio.html'],['app','app.html'],['pro','profile.html']].map(([k,h])=>`<a href="${h}" class="${on(k)}">${I[k]}<span>${tt(k)}</span></a>`).join('')}
/* feed overlay */
function overlay(){const ph=document.querySelector('.fd-ph');if(!ph||ph.querySelector('.pn-ov'))return;
 const o=document.createElement('div');o.className='pn-ov';o.innerHTML=`<button class="ic" id="pnM" aria-label="menu">${I.menu}</button><button id="pnC">${I.hist}<span></span></button>`;ph.appendChild(o);
 o.querySelector('#pnM').onclick=P.openMenu;o.querySelector('#pnC').onclick=P.openCont;
 const chips=document.getElementById('fdChips');if(chips)chips.style.top='60px';
 const sd=document.createElement('div');sd.className='pn-side';document.getElementById('shorts').appendChild(sd);}
function side(){const sd=document.querySelector('.pn-side');if(!sd)return;const a=(ic,lab,h)=>`<a href="${h}">${I[ic]}<span>${lab}</span></a>`;
 sd.innerHTML=a('home',tt('home'),'index.html')+a('ser',tt('series'),'series.html')+a('cat',tt('cat'),'series.html#cats')+a('stu',tt('stu'),'studio.html')+a('app',tt('app'),'app.html')+a('pro',tt('pro'),'profile.html')+`<button id="pnSC">${I.hist}<span>${tt('cont')}</span></button><button id="pnSM">${I.menu}<span>${tt('more')}</span></button>`;
 sd.querySelector('#pnSC').onclick=P.openCont;sd.querySelector('#pnSM').onclick=P.openMenu}
/* "ดูต่อ EPx" badges on series cards and episode drawer */
function badges(){if(!onIndex)return;const L=contList(),M=epIndex();
 document.querySelectorAll('#series .pc').forEach(a=>{const x=M[a.dataset.ep];if(!x)return;const c=L.find(q=>q.s.id==x.s.id);a.querySelector('.pn-res')?.remove();if(!c)return;
  a.setAttribute('href','#v/'+c.e.id+'/'+Math.floor(c.h.pos||0));a.dataset.ep=c.e.id;const b=document.createElement('span');b.className='pn-res';b.textContent=tt('resume')+' EP'+c.e.n+(c.h.pos?' · '+fmt(c.h.pos):'');(a.querySelector('small')||a).after(b)});
 const body=document.getElementById('fdBody');if(body&&document.getElementById('fdSheet').classList.contains('eps')){const H={...LH(),...(P.ud.history||{})};
  body.querySelectorAll('.eli').forEach(el=>{const e=SHORTS[+el.dataset.i];if(!e||el.querySelector('.pn-res'))return;const h=H[e.id];if(!h||!(h.pos>2)||(h.dur&&h.pos>=h.dur-3))return;
   const b=document.createElement('span');b.className='pn-res';b.textContent=tt('resume')+' '+fmt(h.pos);b.onclick=ev=>{ev.stopPropagation();fdSheet.classList.remove('open');openEp(e.id,h.pos)};el.lastElementChild.appendChild(b)})}}
function render(){tabs();side();const c=document.querySelector('#pnC span');if(c){const l=contList();c.textContent=l.length?tt('resume')+' EP'+l[0].e.n:tt('cont')}badges()}
P.render=render;
function init(){document.body.appendChild(tab);document.body.appendChild(dr);dr.querySelector('.bk').onclick=close;dr.querySelector('#pnX').onclick=close;overlay();render();
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 const sg=document.getElementById('serGrid');if(sg)new MutationObserver(()=>setTimeout(badges,0)).observe(sg,{childList:true});
 const fb=document.getElementById('fdBody');if(fb)new MutationObserver(()=>setTimeout(badges,0)).observe(fb,{childList:true});
 setInterval(()=>{if(typeof UD!=='undefined'&&UD.history)P.ud=UD;const c=document.querySelector('#pnC span');if(c){const l=contList();c.textContent=l.length?tt('resume')+' EP'+l[0].e.n:tt('cont')}},10000);load()}
document.readyState=='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
