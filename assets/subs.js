/* PureFxAi soft subtitles: overlay renderer + CC toggle/lang menu. Loads <video dir>/subs/index.json + <lang>.vtt (static, cached). */
(function(){const LS='pfx_subs',CACHE={};
const pref=()=>{try{return JSON.parse(localStorage.getItem(LS)||'null')}catch(e){return null}};
const save=p=>localStorage.setItem(LS,JSON.stringify(p));
const site=()=>(localStorage.getItem('pfx_lang')||document.documentElement.lang||'th').slice(0,2);
function cur(){const p=pref();return{on:p?p.on!==false:true,lang:p&&p.lang?p.lang:site()}}
const tsec=s=>{const p=s.trim().split(':').map(Number);return p.length==3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1]};
function parse(t){const out=[];t.replace(/\r/g,'').split(/\n\n+/).forEach(b=>{const l=b.split('\n'),i=l.findIndex(x=>x.includes('-->'));if(i<0)return;const[a,z]=l[i].split('-->');out.push({s:tsec(a),e:tsec(z.split(' ')[1]||z),t:l.slice(i+1).join('\n')})});return out}
const dirOf=src=>src.replace(/[?#].*$/,'').replace(/\/[^/]*$/,'')+'/subs/';
async function get(u){if(!CACHE[u])CACHE[u]=fetch(u).then(r=>{if(!r.ok)throw 0;return u.endsWith('.json')?r.json():r.text()}).catch(()=>null);return CACHE[u]}
const ICON='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10.2a2.5 2.5 0 1 0 0 3.6M17 10.2a2.5 2.5 0 1 0 0 3.6"/></svg>';
const st=document.createElement('style');st.textContent=`.pfx-sub{position:absolute;left:6%;right:6%;bottom:var(--pfx-sub-b,26%);text-align:center;pointer-events:none;z-index:4;display:flex;justify-content:center}
.pfx-sub>span{display:inline-block!important;max-width:100%;background:rgba(0,0,0,.66)!important;color:#fff!important;margin:0!important;font:600 clamp(14px,4.2vw,19px)/1.45 system-ui,"Noto Sans Thai",sans-serif;padding:.25em .6em;border-radius:8px;text-shadow:0 1px 2px #000;white-space:pre-line}
.pfx-sub:empty{display:none}.pfx-sub.inl{position:static;margin:0 0 12px;left:auto;right:auto;width:100%;flex:0 0 100%;order:-1;box-sizing:border-box}.pfx-cc{position:relative}.pfx-cc.off svg{opacity:.45}.pfx-cc.off::after{content:"";position:absolute;left:22%;right:22%;top:50%;height:2px;background:currentColor;transform:rotate(-35deg)}
.pfx-menu{position:fixed;z-index:9999;background:#15171f;border:1px solid #333;border-radius:12px;padding:6px;min-width:150px;box-shadow:0 10px 30px #0008}
.pfx-menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#eee;padding:9px 12px;border-radius:8px;font:14px system-ui;cursor:pointer}.pfx-menu button:hover,.pfx-menu button.on{background:#2a2410;color:#f5c542}`;document.head.append(st);
const views=new Set();
async function attach(video,src,box){box=box||video.parentElement;src=src||video.getAttribute('src');if(!src||video._pfxSub)return;const base=dirOf(src);
 const el=document.createElement('div');el.className='pfx-sub';const ov=box.querySelector('.fd-ov,.cap');if(ov){el.classList.add('inl');ov.prepend(el)}else box.append(el);const v={video,el,base,cues:[],idx:null};video._pfxSub=v;views.add(v);
 video.addEventListener('timeupdate',()=>draw(v));v.idx=await get(base+'index.json');await load(v)}
async function load(v){const c=cur();v.cues=[];v.el.innerHTML='';if(!c.on||!v.idx)return;const codes=v.idx.langs.map(l=>l.code);const lg=codes.includes(c.lang)?c.lang:(codes.includes('en')&&c.lang!='th'?'en':codes[0]);
 const t=await get(v.base+lg+'.vtt');v.cues=t?parse(t):[];draw(v)}
function draw(v){const t=v.video.currentTime,q=v.cues.find(c=>t>=c.s&&t<=c.e),h=q?q.t:'';if(v.el._h!==h){v.el._h=h;v.el.innerHTML=h?'<span></span>':'';if(h)v.el.firstChild.textContent=h}}
function refresh(){views.forEach(v=>{if(!v.video.isConnected){views.delete(v);v.el.remove();return}load(v)});document.querySelectorAll('.pfx-cc').forEach(b=>b.classList.toggle('off',!cur().on))}
function menu(btn,langs){document.querySelectorAll('.pfx-menu').forEach(m=>m.remove());const c=cur(),m=document.createElement('div');m.className='pfx-menu';
 const th=site()=='th';m.innerHTML=`<button data-o="0" class="${c.on?'':'on'}">${th?'ปิดซับ':'Subtitles off'}</button>`+langs.map(l=>`<button data-l="${l.code}" class="${c.on&&c.lang==l.code?'on':''}">${l.name}${l.code!='th'?' <small style="opacity:.6">AI</small>':''}</button>`).join('');
 document.body.append(m);const r=btn.getBoundingClientRect();m.style.top=Math.max(8,Math.min(innerHeight-m.offsetHeight-8,r.top))+'px';m.style.left=Math.max(8,r.left-m.offsetWidth-8)+'px';
 m.onclick=e=>{e.stopPropagation();const b=e.target.closest('button');if(!b)return;save(b.dataset.o?{on:false,lang:c.lang}:{on:true,lang:b.dataset.l});m.remove();refresh()};
 setTimeout(()=>addEventListener('click',function x(){m.remove();removeEventListener('click',x)}),0)}
function button(getSrc,cls){const b=document.createElement('button');b.type='button';b.className='pfx-cc '+(cls||'');b.setAttribute('aria-label','Subtitles');b.title='CC';b.innerHTML=ICON;b.classList.toggle('off',!cur().on);
 b.onclick=async e=>{e.stopPropagation();e.preventDefault();const s=getSrc();const idx=s?await get(dirOf(s)+'index.json'):null;menu(b,idx?idx.langs:[{code:'th',name:'ไทย'}])};return b}
addEventListener('storage',e=>{if(e.key==LS||e.key=='pfx_lang')refresh()});
window.PfxSubs={attach,button,refresh,langChanged:()=>refresh()};})();
