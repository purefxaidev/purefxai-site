// PureFxAi mobile app API: bearer-token auth (reuses LMS accounts), drama library, social posts, follow, DM chat, report/block, admin moderation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),bcrypt=require('bcryptjs');
const lms=require('./lms');
const DIR=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(__dirname,'data');fs.mkdirSync(path.join(DIR,'social-img'),{recursive:true});
const F=path.join(DIR,'social.json'),IMG=path.join(DIR,'social-img');
let S={tokens:{},profiles:{},posts:[],follows:{},dms:{},reports:[],blocks:{},lib:{},bans:{}};try{Object.assign(S,JSON.parse(fs.readFileSync(F,'utf8')))}catch(e){}
let st;const save=()=>{clearTimeout(st);st=setTimeout(()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(S));fs.renameSync(F+'.tmp',F)},150)};
const id=()=>crypto.randomBytes(8).toString('hex'),now=()=>new Date().toISOString();
const ORIGINS=['https://localhost','http://localhost','capacitor://localhost','http://localhost:5173','http://localhost:4173'];
const SERIES=[{id:'isekai',cat:'isekai',th:'ระบบ PureFxAi ต่างโลก',en:'PureFxAi System: Another World',cover:'shorts/ep01/cover.jpg',eps:['ep01','ep02','ep03','ep04','ep05']},
 {id:'cartoon',cat:'cartoon',th:'น้องบอทกับแก๊งตลาดน้ำ',en:'Botty & the Floating Market Gang',cover:'shorts/cartoon/cover.jpg',eps:[]}];
const EPS={ep01:{th:'ไอ้ขี้แพ้กับหน้าต่างสีทอง',en:'The Loser and the Golden Window'},ep02:{th:'เมืองตลาดแห่งโชคชะตา',en:'The Market Town of Chance'},ep03:{th:'วินัยเหนือความโลภ',en:'Discipline over Desire'},ep04:{th:'ชายในผ้าคลุม',en:'The Hooded Figure'},ep05:{th:'ระดับเทพ',en:'God Tier'}};
const CATS=[{id:'isekai',th:'ต่างโลก',en:'Isekai'},{id:'cartoon',th:'การ์ตูน',en:'Cartoon'}];
const ROOT=path.join(__dirname,'..');
const BAD=/(เย็ด|หี|ควย|แตด|porn|fuck|xxx|nude|เว็บพนัน|บาคาร่า)/i;
const RL=new Map();const lim=(k,max,win)=>{const n=Date.now(),a=(RL.get(k)||[]).filter(t=>n-t<win);a.push(n);RL.set(k,a);return a.length>max};setInterval(()=>RL.clear(),10*60e3).unref();
const db=()=>lms._db();
const uById=i=>db().users.find(u=>u.id===i);
const prof=i=>S.profiles[i]||(S.profiles[i]={bio:'',avatar:''});
const pubU=u=>u&&({id:u.id,name:u.name,bio:prof(u.id).bio,avatar:prof(u.id).avatar,followers:Object.values(S.follows).filter(a=>a.includes(u.id)).length,following:(S.follows[u.id]||[]).length});
const blocked=(a,b)=>(S.blocks[a]||[]).includes(b)||(S.blocks[b]||[]).includes(a);
function epInfo(e){const clip=fs.existsSync(path.join(ROOT,'shorts',e,e+'.mp4'))?`shorts/${e}/${e}.mp4`:null;const sh=(()=>{try{return JSON.parse(fs.readFileSync(path.join(DIR,'shorts.json'),'utf8'))[e]||{}}catch(x){return{}}})();
 return{id:e,...EPS[e],cover:`shorts/${e}/cover.jpg`,video:clip,likes:sh.likes||0,comments:(sh.comments||[]).length}}
async function body(req,max=3e6){let b='';for await(const c of req){b+=c;if(b.length>max)throw new Error('too_large')}return b?JSON.parse(b):{}}
async function saveImg(data){const m=/^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(String(data||''));if(!m)throw new Error('bad_image');
 const sharp=require('sharp');const out=await sharp(Buffer.from(m[2],'base64')).rotate().resize(1080,1350,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();
 const n=id()+'.jpg';fs.writeFileSync(path.join(IMG,n),out);return '/api/app/img/'+n}
module.exports=function(req,res,u){
 const p=u.pathname;const isApp=p.startsWith('/api/app/'),isSh=p.startsWith('/api/shorts/');if(!isApp&&!isSh)return false;
 const o=req.headers.origin;if(o&&ORIGINS.includes(o)){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','authorization,content-type,x-pfx');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')}
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true}
 if(isSh)return false; // CORS only; existing handler serves it
 const r=p.slice(9),M=req.method,ip=req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress||'';
 const J=(c,x)=>{res.writeHead(c,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(x))};
 let m;
 if((m=r.match(/^img\/([a-f0-9]{16}\.jpg)$/))&&M==='GET'){const f=path.join(IMG,m[1]);if(!fs.existsSync(f)){res.writeHead(404);res.end();return true}res.writeHead(200,{'content-type':'image/jpeg','cache-control':'public, max-age=86400'});fs.createReadStream(f).pipe(res);return true}
 (async()=>{try{
  const tk=(req.headers.authorization||'').replace(/^Bearer /,''),ts=tk&&S.tokens[tk];
  let me=ts&&ts.exp>Date.now()?uById(ts.uid):null;if(me&&(me.disabled||S.bans[me.id]))me=null;
  const need=()=>{if(!me){J(401,{error:'auth_required'});return true}};
  const issue=u=>{const t=crypto.randomBytes(24).toString('hex');S.tokens[t]={uid:u.id,exp:Date.now()+60*864e5};save();return t};
  // ---- auth ----
  if(r==='login'&&M==='POST'){if(lim(ip+'l',10,6e4))return J(429,{error:'rate_limited'});const b=await body(req,4e3);const x=db().users.find(y=>y.email===String(b.email||'').trim().toLowerCase());
   if(!x||!await bcrypt.compare(String(b.password||''),x.hash))return J(401,{error:'bad_credentials'});if(x.disabled||S.bans[x.id])return J(403,{error:'disabled'});return J(200,{token:issue(x),user:pubU(x)})}
  if(r==='signup'&&M==='POST'){if(lim(ip+'s',5,6e5))return J(429,{error:'rate_limited'});const b=await body(req,4e3);const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim().slice(0,40),pw=String(b.password||'');
   if(!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email))return J(400,{error:'invalid_email'});if(!name||BAD.test(name))return J(400,{error:'invalid_name'});if(pw.length<8||pw.length>128)return J(400,{error:'weak_password'});
   if(db().users.some(x=>x.email===email))return J(409,{error:'email_taken'});const nu={id:crypto.randomBytes(9).toString('hex'),email,name,hash:await bcrypt.hash(pw,11),packages:[],extraCourses:[],revoked:[],created:now(),verified:false};db().users.push(nu);lms._save&&lms._save();return J(201,{token:issue(nu),user:pubU(nu)})}
  if(r==='logout'&&M==='POST'){delete S.tokens[tk];save();return J(200,{ok:true})}
  // ---- dramas ----
  if(r==='dramas'&&M==='GET'){let seed=null;try{seed=JSON.parse(fs.readFileSync(path.join(__dirname,'shorts-seed.json'),'utf8'))}catch(e){}
   if(seed&&seed.series){const sh=(()=>{try{return JSON.parse(fs.readFileSync(path.join(DIR,'shorts.json'),'utf8'))}catch(x){return{}}})();const has=v=>v&&fs.existsSync(path.join(ROOT,v));
    return J(200,{categories:(seed.genres||[]).sort((a,b)=>(a.order||0)-(b.order||0)).map(g=>({id:g.id,th:g.th,en:g.en})),series:seed.series.map(s=>({id:s.id,cat:s.genre,th:s.th,en:s.en,cover:s.cover,desc_th:s.desc_th,desc_en:s.desc_en,
     eps:(s.episodes||[]).map(e=>({id:e.id,th:e.th,en:e.en,cover:e.cover||s.cover,video:has(e.video)?e.video:null,likes:(sh[e.id]||{}).likes||0,comments:((sh[e.id]||{}).comments||[]).length}))}))})}
   return J(200,{categories:CATS,series:SERIES.map(s=>({...s,eps:s.eps.map(epInfo)}))})}
  if(r==='me'&&M==='GET'){if(need())return;return J(200,{user:{...pubU(me),email:me.email},lib:S.lib[me.id]||{saved:[],liked:[],history:{}}})}
  if(r==='me'&&M==='PUT'){if(need())return;const b=await body(req);const P=prof(me.id);if(b.bio!=null){const t=String(b.bio).slice(0,160);if(BAD.test(t))return J(400,{error:'blocked_content'});P.bio=t}
   if(b.name){const n=String(b.name).trim().slice(0,40);if(BAD.test(n))return J(400,{error:'blocked_content'});me.name=n;lms._save&&lms._save()}if(b.avatar)P.avatar=await saveImg(b.avatar);save();return J(200,{user:pubU(me)})}
  if((m=r.match(/^lib\/(save|like|history)\/([a-z0-9-]{2,40})$/))&&M==='POST'){if(need())return;const L=S.lib[me.id]||(S.lib[me.id]={saved:[],liked:[],history:{}});const b=await body(req,1e3);
   if(m[1]==='history')L.history[m[2]]={t:Math.max(0,Number(b.t)||0),at:now()};else{const k=m[1]==='save'?'saved':'liked',a=L[k],i=a.indexOf(m[2]);b.on===false?(i>=0&&a.splice(i,1)):(i<0&&a.push(m[2]))}save();return J(200,L)}
  // ---- social ----
  const postOut=x=>({...x,author:pubU(uById(x.uid)),likes:x.likes.length,liked:!!me&&x.likes.includes(me.id),comments:x.comments.length});
  if(r==='posts'&&M==='GET'){const f=u.searchParams.get('feed'),who=u.searchParams.get('user');let a=S.posts.filter(x=>!x.removed&&!(me&&blocked(me.id,x.uid)));
   if(who)a=a.filter(x=>x.uid===who);else if(f==='following'&&me){const fl=S.follows[me.id]||[];a=a.filter(x=>fl.includes(x.uid)||x.uid===me.id)}return J(200,{posts:a.slice(-60).reverse().map(postOut)})}
  if(r==='posts'&&M==='POST'){if(need())return;if(lim(me.id+'p',10,36e5))return J(429,{error:'rate_limited'});const b=await body(req);const text=String(b.text||'').trim().slice(0,1000);
   if(!text&&!b.image)return J(400,{error:'empty'});if(BAD.test(text))return J(400,{error:'blocked_content'});const x={id:id(),uid:me.id,text,image:b.image?await saveImg(b.image):'',at:now(),likes:[],comments:[]};S.posts.push(x);save();return J(201,postOut(x))}
  if((m=r.match(/^posts\/([a-f0-9]+)(?:\/(like|comments))?$/))){const x=S.posts.find(y=>y.id===m[1]&&!y.removed);if(!x)return J(404,{error:'not_found'});
   if(!m[2]&&M==='DELETE'){if(need())return;if(x.uid!==me.id)return J(403,{error:'forbidden'});x.removed=true;save();return J(200,{ok:true})}
   if(m[2]==='like'&&M==='POST'){if(need())return;const i=x.likes.indexOf(me.id);i>=0?x.likes.splice(i,1):x.likes.push(me.id);save();return J(200,postOut(x))}
   if(m[2]==='comments'&&M==='GET')return J(200,{comments:x.comments.filter(c=>!(me&&blocked(me.id,c.uid))).map(c=>({...c,author:pubU(uById(c.uid))}))});
   if(m[2]==='comments'&&M==='POST'){if(need())return;if(lim(me.id+'c',30,6e5))return J(429,{error:'rate_limited'});const b=await body(req,4e3),t=String(b.text||'').trim().slice(0,500);if(!t)return J(400,{error:'empty'});if(BAD.test(t))return J(400,{error:'blocked_content'});
    const c={id:id(),uid:me.id,text:t,at:now()};x.comments.push(c);save();return J(201,{...c,author:pubU(me)})}}
  if((m=r.match(/^users\/([a-f0-9]+)(?:\/(follow|block))?$/))){const t=uById(m[1]);if(!t)return J(404,{error:'not_found'});
   if(!m[2]&&M==='GET')return J(200,{user:pubU(t),following:!!me&&(S.follows[me.id]||[]).includes(t.id),blocked:!!me&&(S.blocks[me.id]||[]).includes(t.id)});
   if(need())return;if(t.id===me.id)return J(400,{error:'self'});const k=m[2]==='follow'?S.follows:S.blocks,a=k[me.id]||(k[me.id]=[]),i=a.indexOf(t.id);i>=0?a.splice(i,1):a.push(t.id);
   if(m[2]==='block'&&i<0&&S.follows[me.id])S.follows[me.id]=S.follows[me.id].filter(y=>y!==t.id);save();return J(200,{on:i<0})}
  if(r==='users'&&M==='GET'){const q=String(u.searchParams.get('q')||'').toLowerCase().slice(0,40);return J(200,{users:db().users.filter(x=>!x.disabled&&!S.bans[x.id]&&(!q||x.name.toLowerCase().includes(q))).slice(0,30).map(pubU)})}
  // ---- chat ----
  const key=(a,b)=>[a,b].sort().join(':');
  if(r==='chats'&&M==='GET'){if(need())return;const out=Object.entries(S.dms).filter(([k])=>k.split(':').includes(me.id)).map(([k,a])=>{const o=k.split(':').find(x=>x!==me.id);const l=a[a.length-1];return{user:pubU(uById(o)),last:l,unread:a.filter(x=>x.to===me.id&&!x.read).length}}).filter(c=>c.user&&c.last).sort((a,b)=>b.last.at.localeCompare(a.last.at));return J(200,{chats:out})}
  if((m=r.match(/^dm\/([a-f0-9]+)$/))){if(need())return;const t=uById(m[1]);if(!t)return J(404,{error:'not_found'});const a=S.dms[key(me.id,t.id)]||[];
   if(M==='GET'){const af=u.searchParams.get('after')||'';let ch=false;a.forEach(x=>{if(x.to===me.id&&!x.read){x.read=true;ch=true}});ch&&save();return J(200,{messages:a.filter(x=>x.at>af).slice(-100),user:pubU(t)})}
   if(M==='POST'){if(blocked(me.id,t.id))return J(403,{error:'blocked'});if(lim(me.id+'d',30,6e4))return J(429,{error:'rate_limited'});const b=await body(req,4e3),tx=String(b.text||'').trim().slice(0,1000);if(!tx)return J(400,{error:'empty'});if(BAD.test(tx))return J(400,{error:'blocked_content'});
    const x={id:id(),from:me.id,to:t.id,text:tx,at:now(),read:false};(S.dms[key(me.id,t.id)]||(S.dms[key(me.id,t.id)]=[])).push(x);if(S.dms[key(me.id,t.id)].length>2000)S.dms[key(me.id,t.id)].shift();save();return J(201,x)}}
  if(r==='report'&&M==='POST'){if(need())return;if(lim(me.id+'r',10,36e5))return J(429,{error:'rate_limited'});const b=await body(req,4e3);S.reports.push({id:id(),by:me.id,type:String(b.type||'').slice(0,10),target:String(b.target||'').slice(0,40),reason:String(b.reason||'').slice(0,300),at:now(),status:'open'});save();return J(201,{ok:true})}
  // ---- admin moderation (LMS admin cookie + x-pfx) ----
  if(r.startsWith('admin/')){if(!lms.isAdmin(req)||(M!=='GET'&&req.headers['x-pfx']!=='1'))return J(401,{error:'admin_required'});const a=r.slice(6);
   if(a==='reports'&&M==='GET')return J(200,{reports:S.reports.slice(-200).reverse(),posts:S.posts.slice(-100).reverse().map(postOut),bans:Object.keys(S.bans)});
   const b=M==='POST'?await body(req,4e3):{};
   if(a==='remove-post'&&M==='POST'){const x=S.posts.find(y=>y.id===b.id);if(x)x.removed=true;save();return J(200,{ok:!!x})}
   if(a==='remove-comment'&&M==='POST'){const x=S.posts.find(y=>y.id===b.post);if(x)x.comments=x.comments.filter(c=>c.id!==b.id);save();return J(200,{ok:!!x})}
   if(a==='ban'&&M==='POST'){b.on===false?delete S.bans[b.uid]:S.bans[b.uid]=now();for(const[k,v]of Object.entries(S.tokens))if(v.uid===b.uid&&b.on!==false)delete S.tokens[k];save();return J(200,{ok:true})}
   if(a==='resolve'&&M==='POST'){const x=S.reports.find(y=>y.id===b.id);if(x)x.status='resolved';save();return J(200,{ok:!!x})}}
  J(404,{error:'not_found'})}catch(e){J(400,{error:String(e.message||'bad_request')})}})();return true};
