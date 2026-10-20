// PureFxAi LMS: members, sessions, courses, progress, orders (bank transfer slips), admin.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),bcrypt=require('bcryptjs'),Busboy=require('busboy');
const DIR=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(__dirname,'data'),DB=path.join(DIR,'lms.json'),SLIPS=path.join(DIR,'slips'),MEDIA=path.join(__dirname,'lms-media'),PUB=path.join(__dirname,'..');
fs.mkdirSync(SLIPS,{recursive:true});
const ADMIN_EMAIL=(process.env.ADMIN_EMAIL||'pureai.com@gmail.com').toLowerCase();
const BANK={bank_th:'ธนาคารกรุงศรีอยุธยา',bank_en:'Krungsri (Bank of Ayudhya)',name:'ศรเทพ ธาราสุขสันต์',number:'330-1-47905-7',raw:'3301479057'};
const PKGS=['starter','pro','vip','lifetime'];
let db={users:[],sessions:{},orders:[],progress:{},resets:{},courses:null,settings:{prices:{starter:0,pro:0,vip:0,lifetime:0}},admin:{}};
try{Object.assign(db,JSON.parse(fs.readFileSync(DB,'utf8')))}catch(e){}
if(!db.courses)db.courses=require('./lms-seed.js');
{const CT=require('./lms-cats');db.migrations=db.migrations||{};if(!db.categories)db.categories=CT.CATEGORIES;
 if(!db.migrations.cat1){for(const c of CT.EXTRA)if(!db.courses.some(x=>x.id===c.id))db.courses.push(c);
  for(const c of db.courses){if(!c.category)c.category=CT.COURSE_CAT[c.id]||'basics';if(CT.COURSE_CAT[c.id])c.packages=CT.packagesFor(c.id)}db.migrations.cat1=true}}
const sortUpd=c=>{if(c.updates)for(const m of c.modules)m.lessons.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));return c};
let st;function save(){clearTimeout(st);st=setTimeout(()=>{const t=DB+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,DB)},100)}save();
let SETUP=null;if(!process.env.ADMIN_PASSWORD&&!db.admin.hash){SETUP=crypto.randomBytes(9).toString('hex');console.log(`[LMS] Admin not configured. One-time setup token: ${SETUP} (open /admin.html, email ${ADMIN_EMAIL})`)}
const id=()=>crypto.randomBytes(9).toString('hex'),now=()=>new Date().toISOString();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RL=new Map();function limited(k,max,win){const n=Date.now(),a=(RL.get(k)||[]).filter(t=>n-t<win);a.push(n);RL.set(k,a);return a.length>max}
setInterval(()=>{RL.clear();const n=Date.now();for(const[k,v]of Object.entries(db.sessions))if(v.exp<n)delete db.sessions[k]},15*60e3).unref();
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(c=>c.trim().split('=').map(decodeURIComponent)).filter(a=>a[0]))}
function setSess(res,data,days=14){const t=crypto.randomBytes(24).toString('hex');db.sessions[t]={...data,exp:Date.now()+days*864e5};save();
 res.setHeader('Set-Cookie',`${data.admin?'pfx_admin':'pfx_sess'}=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${days*86400}${process.env.COOKIE_SECURE?'; Secure':''}`)}
function sess(req,name){const t=cookies(req)[name],s=t&&db.sessions[t];return s&&s.exp>Date.now()?{t,...s}:null}
const user=req=>{const s=sess(req,'pfx_sess');const u=s&&db.users.find(x=>x.id===s.uid);return u&&!u.disabled?u:null};
const isAdmin=req=>!!sess(req,'pfx_admin');
const J=(res,c,o)=>{res.writeHead(c,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(o))};
async function body(req,max=200000){let b='';for await(const c of req){b+=c;if(b.length>max)throw new Error('too_large')}return b?JSON.parse(b):{}}
const pub=u=>({id:u.id,email:u.email,name:u.name,avatar:u.avatar?`/api/lms/avatar/${u.id}?v=${u.avatar}`:null,packages:u.packages,extraCourses:u.extraCourses,revoked:u.revoked,disabled:!!u.disabled,created:u.created});
function access(u,c){if(!u)return false;if((u.revoked||[]).includes(c.id))return false;return (u.extraCourses||[]).includes(c.id)||c.packages.some(p=>(u.packages||[]).includes(p))}
const lessons=c=>c.modules.flatMap(m=>m.lessons);
function prog(u,c){const p=db.progress[u.id]||{},ls=lessons(c),d=ls.filter(l=>p[c.id+'/'+l.id]?.done).length;return{done:d,total:ls.length,pct:ls.length?Math.round(d/ls.length*100):0}}
function lessonVideo(c,l){const f=path.join(MEDIA,'lessons',c,l+'.mp4');if(fs.existsSync(f))return{f,standIn:false};
 const r=fs.readdirSync(path.join(PUB,'assets','reviews')).filter(x=>x.endsWith('.mp4')).sort();if(!r.length)return null;
 const h=[...(c+l)].reduce((a,ch)=>a+ch.charCodeAt(0),0);return{f:path.join(PUB,'assets','reviews',r[h%r.length]),standIn:true}}
function stream(req,res,f,type){const size=fs.statSync(f).size,rg=req.headers.range;
 if(rg){const m=/bytes=(\d*)-(\d*)/.exec(rg);let s=m&&m[1]?+m[1]:0,e=m&&m[2]?+m[2]:size-1;if(s>=size||e>=size||s>e){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end()}
  res.writeHead(206,{'Content-Range':`bytes ${s}-${e}/${size}`,'Accept-Ranges':'bytes','Content-Length':e-s+1,'Content-Type':type,'Cache-Control':'private, no-store'});fs.createReadStream(f,{start:s,end:e}).pipe(res)}
 else{res.writeHead(200,{'Content-Length':size,'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'private, no-store'});fs.createReadStream(f).pipe(res)}}
function sniff(b){if(b[0]==0xff&&b[1]==0xd8&&b[2]==0xff)return['image/jpeg','jpg'];if(b.slice(0,4).toString('hex')=='89504e47')return['image/png','png'];
 if(b.slice(0,4).toString()=='RIFF'&&b.slice(8,12).toString()=='WEBP')return['image/webp','webp'];if(b.slice(0,4).toString()=='%PDF')return['application/pdf','pdf'];return null}
function shortsFile(){try{return JSON.parse(fs.readFileSync(path.join(DIR,'shorts.json'),'utf8'))}catch(e){return{}}}
function stats(){const n=Date.now(),wk=n-7*864e5,m0=new Date();m0.setDate(1);m0.setHours(0,0,0,0);
 const ap=db.orders.filter(o=>o.status==='approved'),rev=o=>Number(o.amount)||0,days={};
 for(let i=29;i>=0;i--){const d=new Date(n-i*864e5).toISOString().slice(0,10);days[d]=0}
 ap.forEach(o=>{const d=(o.decided||o.created).slice(0,10);if(d in days)days[d]+=rev(o)});
 const sh=shortsFile();
 return{members:db.users.length,newWeek:db.users.filter(u=>Date.parse(u.created)>wk).length,pending:db.orders.filter(o=>o.status==='pending').length,approved:ap.length,
  revMonth:ap.filter(o=>Date.parse(o.decided||o.created)>=m0).reduce((a,o)=>a+rev(o),0),revTotal:ap.reduce((a,o)=>a+rev(o),0),revDays:days,
  enroll:db.courses.map(c=>({id:c.id,th:c.th,en:c.en,count:db.users.filter(u=>access(u,c)).length})),
  shorts:Object.entries(sh).map(([ep,v])=>({ep,likes:v.likes||0,comments:(v.comments||[]).length})),
  recent:db.users.slice(-8).reverse().map(pub),pendingList:db.orders.filter(o=>o.status==='pending').slice(-8).reverse().map(o=>ordOut(o))}}
function ordOut(o){const u=db.users.find(x=>x.id===o.uid);return{...o,slip:o.slip?{mime:o.slip.mime,size:o.slip.size}:null,email:u?.email,name:u?.name}}
function issueCert(u,c){db.certs=db.certs||[];let r=db.certs.find(x=>x.uid===u.id&&x.course===c.id);
 if(!r){r={id:'PFX-'+String(c.id).toUpperCase().slice(0,12)+'-'+require('crypto').randomBytes(4).toString('hex').toUpperCase(),code:require('crypto').randomBytes(18).toString('base64url'),uid:u.id,name:u.name,course:c.id,courseTh:c.th,courseEn:c.en,issued:new Date().toISOString(),status:'valid'};db.certs.push(r);save()}return r}
function certPub(r){return{id:r.id,name:r.name,courseTh:r.courseTh,courseEn:r.courseEn,issued:r.issued,status:r.status}}
function baseUrl(req){if(process.env.PUBLIC_BASE_URL)return process.env.PUBLIC_BASE_URL.replace(/\/$/,'');const h=String(req.headers['x-forwarded-host']||req.headers.host||'localhost:8080').replace(/[^\w.:-]/g,'');const pr=req.headers['x-forwarded-proto']==='https'||/\.(com|net|io|app|dev|co|th)$/.test(h.split(':')[0])?'https':'http';return pr+'://'+h}
async function cert(u,c,L,req){const r=issueCert(u,c),n=new Date(r.issued),o={year:'numeric',month:'long',day:'numeric'},url=baseUrl(req)+'/verify.html?c='+r.code;
 const qr=await require('qrcode').toString(url,{type:'svg',margin:0,color:{dark:'#2a2214',light:'#0000'}});
 return require('./certtpl')({name:r.name,courseTh:c.th,courseEn:c.en,dateTh:n.toLocaleDateString('th-TH',o),dateEn:n.toLocaleDateString('en-GB',o),id:r.id,lang:L,qrSvg:qr,verifyUrl:url})}


// ---- Shorts series manifest + per-user shorts data ----
const ROOT=path.join(__dirname,'..');
function seriesOut(){const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'shorts-seed.json'),'utf8'));const m=db.shortsManifest||(db.shortsManifest=seed);
 if(m!==seed){let ch=false;for(const g of seed.genres)if(!m.genres.some(x=>x.id===g.id)&&!(m.removed||[]).includes(g.id)){m.genres.push(g);ch=true}for(const x of seed.series)if(!m.series.some(y=>y.id===x.id)&&!(m.removed||[]).includes(x.id)){m.series.push(x);ch=true}if(ch)save()}
 const ok=p=>{try{return /^shorts\/[\w\/.-]+$/.test(p)&&!p.includes('..')&&fs.statSync(path.join(ROOT,p)).size>0}catch(e){return false}};
 return{genres:m.genres,series:m.series.map(s=>({...s,coverOk:ok(s.cover),episodes:s.episodes.map(e=>({...e,available:ok(e.video),coverOk:ok(e.cover)}))}))}}
const SU=uid=>((db.shortsUser||={})[uid]||={saved:[],liked:[],history:{}});
function isFree(c,l){if(typeof l.free==='boolean')return l.free;return lessons(c).indexOf(l)<2}
module.exports=function handle(req,res,u){
 const p=u.pathname;if(!p.startsWith('/api/lms/'))return false;const r=p.slice(9),M=req.method,ip=req.socket.remoteAddress||'';
 // CSRF: state-changing requests must carry custom header (not sendable cross-site without CORS)
 if(M!=='GET'&&req.headers['x-pfx']!=='1'){J(res,403,{error:'csrf'});return true}
 (async()=>{try{
 let m;const me=user(req);
 // ---------- public ----------
 if(r==='config'&&M==='GET')return J(res,200,{bank:BANK,prices:db.settings.prices,packages:PKGS,categories:db.categories,courses:db.courses.map(c=>({id:c.id,th:c.th,en:c.en,packages:c.packages,category:c.category,lessons:lessons(c).length,free:lessons(c).filter(l=>isFree(c,l)).map(l=>({id:l.id,th:l.th,en:l.en}))}))});
 if(r==='signup'&&M==='POST'){if(limited(ip+'su',5,6e5))return J(res,429,{error:'rate_limited'});const b=await body(req);
  const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim().slice(0,80),pw=String(b.password||'');
  if(!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>120)return J(res,400,{error:'invalid_email'});if(!name)return J(res,400,{error:'invalid_name'});if(pw.length<8||pw.length>128)return J(res,400,{error:'weak_password'});
  if(db.users.some(x=>x.email===email))return J(res,409,{error:'email_taken'});
  const nu={id:id(),email,name,hash:await bcrypt.hash(pw,11),packages:[],extraCourses:[],revoked:[],created:now(),verified:false};db.users.push(nu);setSess(res,{uid:nu.id});save();return J(res,201,{user:pub(nu)})}
 if(r==='login'&&M==='POST'){if(limited(ip+'li',10,6e4))return J(res,429,{error:'rate_limited'});const b=await body(req);const x=db.users.find(y=>y.email===String(b.email||'').trim().toLowerCase());
  if(!x||!await bcrypt.compare(String(b.password||''),x.hash))return J(res,401,{error:'bad_credentials'});if(x.disabled)return J(res,403,{error:'disabled'});setSess(res,{uid:x.id});return J(res,200,{user:pub(x)})}
 if(r==='logout'&&M==='POST'){const s=sess(req,'pfx_sess');if(s)delete db.sessions[s.t];save();res.setHeader('Set-Cookie','pfx_sess=; Path=/; Max-Age=0');return J(res,200,{ok:true})}
 if(r==='reset-request'&&M==='POST'){if(limited(ip+'rr',3,6e5))return J(res,429,{error:'rate_limited'});const b=await body(req);const x=db.users.find(y=>y.email===String(b.email||'').trim().toLowerCase());
  if(x){const t=crypto.randomBytes(20).toString('hex');db.resets[t]={uid:x.id,exp:Date.now()+3600e3};save();console.log(`[LMS] Password reset link (email sending not configured): /learn.html#reset=${t}`)}
  return J(res,200,{ok:true})}
 if(r==='reset'&&M==='POST'){const b=await body(req),rs=db.resets[String(b.token||'')];if(!rs||rs.exp<Date.now())return J(res,400,{error:'invalid_token'});
  const pw=String(b.password||'');if(pw.length<8||pw.length>128)return J(res,400,{error:'weak_password'});const x=db.users.find(y=>y.id===rs.uid);x.hash=await bcrypt.hash(pw,11);delete db.resets[b.token];
  for(const[k,v]of Object.entries(db.sessions))if(v.uid===x.id)delete db.sessions[k];save();return J(res,200,{ok:true})}
 // ---------- member ----------
 if((m=r.match(/^verify\/([\w-]{6,64})$/))&&M==='GET'){const q=m[1],x=(db.certs||[]).find(y=>y.code===q||y.id.toUpperCase()===q.toUpperCase());return J(res,x?200:404,x?{cert:certPub(x)}:{error:'not_found'})}
 if(r.startsWith('admin/'))return admin(r.slice(6));
 const acc=c=>!!me&&access(me,c);
 if(r==='courses'&&M==='GET')return J(res,200,{courses:db.courses.map(c=>({id:c.id,th:c.th,en:c.en,packages:c.packages,category:c.category,updates:!!c.updates,latest:c.updates?lessons(sortUpd(c))[0]?.date:undefined,access:acc(c),lessons:lessons(c).length,free:lessons(c).filter(l=>isFree(c,l)).length,progress:me?prog(me,c):null}))});
 if((m=r.match(/^courses\/([\w-]+)$/))&&M==='GET'){const c=db.courses.find(x=>x.id===m[1]);if(c)sortUpd(c);if(!c)return J(res,404,{error:'not_found'});const ok=acc(c),pr=me?(db.progress[me.id]||{}):{};
  return J(res,200,{course:{id:c.id,th:c.th,en:c.en,packages:c.packages,category:c.category,updates:!!c.updates,access:ok,progress:me?prog(me,c):null,guest:!me,modules:c.modules.map(mo=>({...mo,lessons:mo.lessons.map(l=>ok||isFree(c,l)?{...l,free:isFree(c,l),quiz:l.quiz,state:pr[c.id+'/'+l.id]||{},standIn:l.video?lessonVideo(c.id,l.id)?.standIn:undefined}:{id:l.id,type:l.type,th:l.th,en:l.en,date:l.date,locked:true})}))}})}
 if((m=r.match(/^media\/([\w-]+)\/([\w-]+)$/))&&M==='GET'){const c=db.courses.find(x=>x.id===m[1]),l=c&&lessons(c).find(x=>x.id===m[2]);if(!l||!(acc(c)||isFree(c,l)))return J(res,403,{error:'locked'});
  const v=lessonVideo(c.id,l.id);if(!v)return J(res,404,{error:'no_video'});return stream(req,res,v.f,'video/mp4')}
 if((m=r.match(/^files\/([\w-]+)\/([\w-]+)$/))&&M==='GET'){const c=db.courses.find(x=>x.id===m[1]),l=c&&lessons(c).find(x=>x.id===m[2]);if(!l||!l.file||!(acc(c)||isFree(c,l)))return J(res,403,{error:'locked'});
  const f=path.join(MEDIA,'files',path.basename(l.file));if(!fs.existsSync(f))return J(res,404,{error:'missing'});res.setHeader('Content-Disposition',`attachment; filename="${path.basename(f)}"`);return stream(req,res,f,'application/octet-stream')}
 if(r==='series'&&M==='GET')return J(res,200,seriesOut());
 if(r==='avatar/'+(r.split('/')[1]||'')&&M==='GET'){const f=path.join(DIR,'avatars',path.basename(r.split('/')[1])+'.webp');if(!/^[\w-]+$/.test(r.split('/')[1])||!fs.existsSync(f))return J(res,404,{error:'not_found'});res.writeHead(200,{'content-type':'image/webp','cache-control':'public, max-age=300'});return fs.createReadStream(f).pipe(res)}
 if(!me)return J(res,401,{error:'login_required'});
 if(r==='me/shorts'&&M==='GET')return J(res,200,SU(me.id));
 if(r==='me/shorts'&&M==='POST'){const b=await body(req,4000),ep=String(b.ep||'');if(!/^[\w-]{2,40}$/.test(ep))return J(res,400,{error:'invalid'});const d=SU(me.id);
  const tg=(k,on)=>{d[k]=d[k].filter(x=>x!==ep);if(on)d[k].unshift(ep);d[k]=d[k].slice(0,500)};
  if(b.action==='save')tg('saved',true);else if(b.action==='unsave')tg('saved',false);else if(b.action==='like')tg('liked',true);else if(b.action==='unlike')tg('liked',false);
  else if(b.action==='progress'){d.history[ep]={pos:Math.max(0,Number(b.pos)||0),dur:Math.max(0,Number(b.dur)||0),at:now()};const ks=Object.keys(d.history);if(ks.length>300){ks.sort((a,c)=>d.history[a].at<d.history[c].at?-1:1).slice(0,ks.length-300).forEach(k=>delete d.history[k])}}
  else if(b.action==='clear-history')d.history={};else return J(res,400,{error:'invalid'});save();return J(res,200,d)}
 if(r==='me/profile'&&M==='POST'){const ct=req.headers['content-type']||'';
  if(/^multipart/.test(ct)){const parts={};let buf=[],big=false;await new Promise((ok,bad)=>{let bb;try{bb=Busboy({headers:req.headers,limits:{fileSize:3*1024*1024,files:1,fields:3,fieldSize:200}})}catch(e){return bad(e)}bb.on('field',(k,v)=>parts[k]=v);bb.on('file',(k,st)=>{st.on('data',x=>buf.push(x));st.on('limit',()=>big=true)});bb.on('close',ok);bb.on('error',bad);req.pipe(bb)});
   if(big)return J(res,413,{error:'too_large'});if(parts.name!=null){const n=String(parts.name).trim().slice(0,80);if(n)me.name=n}
   if(buf.length){let sharp;try{sharp=require('sharp')}catch(e){return J(res,500,{error:'server_error'})}const b=Buffer.concat(buf);try{const mt=await sharp(b,{limitInputPixels:30e6}).metadata();if(!['jpeg','png','webp'].includes(mt.format))throw 0;
    const dd=path.join(DIR,'avatars');fs.mkdirSync(dd,{recursive:true});await sharp(b).rotate().resize(256,256,{fit:'cover'}).webp({quality:85}).toFile(path.join(dd,me.id+'.webp'));me.avatar=Date.now()}catch(e){return J(res,415,{error:'bad_image'})}}
   save();return J(res,200,{user:pub(me)})}
  const b=await body(req,2000);const n=String(b.name||'').trim().slice(0,80);if(!n)return J(res,400,{error:'invalid_name'});me.name=n;save();return J(res,200,{user:pub(me)})}
 if(r==='me'&&M==='GET')return J(res,200,{user:pub(me),orders:db.orders.filter(o=>o.uid===me.id).reverse().map(ordOut)});
 if((m=r.match(/^progress\/([\w-]+)\/([\w-]+)$/))&&M==='POST'){const c=db.courses.find(x=>x.id===m[1]),l=c&&lessons(c).find(x=>x.id===m[2]);if(!l||!access(me,c))return J(res,403,{error:'locked'});
  const b=await body(req,20000),k=c.id+'/'+l.id,pr=(db.progress[me.id]||={}),s=(pr[k]||={});
  if(b.pos!=null)s.pos=Math.max(0,Number(b.pos)||0);if(b.watched!=null)s.watched=Math.min(100,Math.max(0,Number(b.watched)||0));if(b.score!=null)s.score=Number(b.score)||0;
  if(b.submission!=null)s.submission=String(b.submission).slice(0,5000);if(b.done)s.done=true,s.at=now();save();return J(res,200,{state:s,progress:prog(me,c)})}
 if((m=r.match(/^cert\/([\w-]+)$/))&&M==='GET'){const c=db.courses.find(x=>x.id===m[1]);if(!c||!access(me,c))return J(res,403,{error:'locked'});if(prog(me,c).pct<100)return J(res,403,{error:'incomplete'});
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(await cert(me,c,u.searchParams.get('lang')==='en'?'en':'th',req))}
 if(r==='orders'&&M==='POST'){if(limited(ip+'or',5,6e5))return J(res,429,{error:'rate_limited'});
  if(db.orders.some(o=>o.uid===me.id&&o.status==='pending'&&db.orders.filter(q=>q.uid===me.id&&q.status==='pending').length>=3))return J(res,429,{error:'too_many_pending'});
  const f={};let file=null,tooBig=false;
  await new Promise((ok,bad)=>{let bb;try{bb=Busboy({headers:req.headers,limits:{fileSize:5*1024*1024,files:1,fields:5,fieldSize:2000}})}catch(e){return bad(e)}
   bb.on('field',(k,v)=>f[k]=v);bb.on('file',(k,s)=>{const ch=[];s.on('data',d=>ch.push(d));s.on('limit',()=>tooBig=true);s.on('end',()=>{file=Buffer.concat(ch)})});bb.on('close',ok);bb.on('error',bad);req.pipe(bb)});
  if(tooBig)return J(res,413,{error:'file_too_large'});if(!PKGS.includes(f.package))return J(res,400,{error:'invalid_package'});if(!file||!file.length)return J(res,400,{error:'slip_required'});
  const t=sniff(file);if(!t)return J(res,415,{error:'invalid_file_type'});const oid=id(),fn=oid+'.'+t[1];fs.writeFileSync(path.join(SLIPS,fn),file);
  const o={id:oid,uid:me.id,package:f.package,amount:Number(db.settings.prices[f.package])||0,note:String(f.note||'').slice(0,500),slip:{file:fn,mime:t[0],size:file.length},status:'pending',created:now()};
  db.orders.push(o);save();return J(res,201,{order:ordOut(o)})}
 return J(res,404,{error:'not_found'});

 // ---------- admin ----------
 async function admin(a){
  if(a==='status'&&M==='GET')return J(res,200,{email:ADMIN_EMAIL,setup:!!SETUP,logged:isAdmin(req)});
  if(a==='setup'&&M==='POST'){if(!SETUP)return J(res,400,{error:'not_needed'});if(limited(ip+'as',5,6e5))return J(res,429,{error:'rate_limited'});const b=await body(req);
   if(b.token!==SETUP)return J(res,401,{error:'bad_token'});if(String(b.password||'').length<10)return J(res,400,{error:'weak_password'});db.admin.hash=await bcrypt.hash(String(b.password),12);SETUP=null;save();setSess(res,{admin:true},1);return J(res,200,{ok:true})}
  if(a==='login'&&M==='POST'){if(limited(ip+'al',5,6e4))return J(res,429,{error:'rate_limited'});const b=await body(req),em=String(b.email||'').trim().toLowerCase(),pw=String(b.password||'');
   const ok=em===ADMIN_EMAIL&&(process.env.ADMIN_PASSWORD?pw.length===process.env.ADMIN_PASSWORD.length&&crypto.timingSafeEqual(Buffer.from(pw),Buffer.from(process.env.ADMIN_PASSWORD)):db.admin.hash&&await bcrypt.compare(pw,db.admin.hash));
   if(!ok)return J(res,401,{error:'bad_credentials'});setSess(res,{admin:true},1);return J(res,200,{ok:true})}
  if(a==='logout'&&M==='POST'){const s=sess(req,'pfx_admin');if(s)delete db.sessions[s.t];save();res.setHeader('Set-Cookie','pfx_admin=; Path=/; Max-Age=0');return J(res,200,{ok:true})}
  if(!isAdmin(req))return J(res,401,{error:'admin_required'});
  if(a==='stats'&&M==='GET')return J(res,200,stats());
  if(a==='users'&&M==='GET'){const q=(u.searchParams.get('q')||'').toLowerCase();return J(res,200,{users:db.users.filter(x=>!q||x.email.includes(q)||x.name.toLowerCase().includes(q)).slice(-200).reverse().map(x=>({...pub(x),orders:db.orders.filter(o=>o.uid===x.id).length}))})}
  if((m=a.match(/^users\/(\w+)$/))&&M==='GET'){const x=db.users.find(y=>y.id===m[1]);if(!x)return J(res,404,{error:'not_found'});return J(res,200,{user:pub(x),orders:db.orders.filter(o=>o.uid===x.id).reverse().map(ordOut),courses:db.courses.map(c=>({id:c.id,th:c.th,en:c.en,access:access(x,c),progress:prog(x,c)})),certs:(db.certs||[]).filter(k=>k.uid===x.id).map(certPub)})}
  if((m=a.match(/^certs\/([\w-]+)$/))&&M==='POST'){const k=(db.certs||[]).find(y=>y.id===m[1]);if(!k)return J(res,404,{error:'not_found'});const b=await body(req);if(['valid','revoked'].includes(b.status)){k.status=b.status;k.changed=new Date().toISOString();save()}return J(res,200,{cert:certPub(k)})}
  if((m=a.match(/^users\/(\w+)$/))&&M==='POST'){const x=db.users.find(y=>y.id===m[1]);if(!x)return J(res,404,{error:'not_found'});const b=await body(req);
   if(b.disabled!=null){x.disabled=!!b.disabled;if(x.disabled)for(const[k,v]of Object.entries(db.sessions))if(v.uid===x.id)delete db.sessions[k]}
   if(Array.isArray(b.packages))x.packages=b.packages.filter(p=>PKGS.includes(p));
   if(b.grant){x.extraCourses=[...new Set([...(x.extraCourses||[]),b.grant])];x.revoked=(x.revoked||[]).filter(c=>c!==b.grant)}
   if(b.revoke){x.revoked=[...new Set([...(x.revoked||[]),b.revoke])];x.extraCourses=(x.extraCourses||[]).filter(c=>c!==b.revoke)}
   save();return J(res,200,{user:pub(x)})}
  if(a==='orders'&&M==='GET'){const s=u.searchParams.get('status');return J(res,200,{orders:db.orders.filter(o=>!s||o.status===s).slice().reverse().map(ordOut)})}
  if((m=a.match(/^slip\/(\w+)$/))&&M==='GET'){const o=db.orders.find(x=>x.id===m[1]);if(!o||!o.slip)return J(res,404,{error:'not_found'});return stream(req,res,path.join(SLIPS,path.basename(o.slip.file)),o.slip.mime)}
  if((m=a.match(/^orders\/(\w+)$/))&&M==='POST'){const o=db.orders.find(x=>x.id===m[1]);if(!o)return J(res,404,{error:'not_found'});const b=await body(req);
   if(o.status!=='pending')return J(res,409,{error:'already_decided'});if(!['approve','reject'].includes(b.action))return J(res,400,{error:'bad_action'});
   o.status=b.action==='approve'?'approved':'rejected';o.decided=now();o.reason=String(b.reason||'').slice(0,300);if(b.amount!=null&&b.action==='approve')o.amount=Number(b.amount)||0;
   if(o.status==='approved'){const x=db.users.find(y=>y.id===o.uid);if(x)x.packages=[...new Set([...(x.packages||[]),o.package])]}save();return J(res,200,{order:ordOut(o)})}
  if(a==='courses'&&M==='GET')return J(res,200,{courses:db.courses,packages:PKGS,categories:db.categories});
  if(a==='series'&&M==='GET')return J(res,200,{manifest:db.shortsManifest||seriesOut()&&db.shortsManifest});
  if(a==='series'&&M==='POST'){const b=await body(req,300000),m=b.manifest;const idok=x=>/^[\w-]{2,40}$/.test(x||'');
   if(!m||!Array.isArray(m.genres)||!Array.isArray(m.series)||!m.genres.every(g=>idok(g.id)&&g.th&&g.en)||!m.series.every(s=>idok(s.id)&&s.th&&s.en&&Array.isArray(s.episodes)&&s.episodes.every(e=>idok(e.id)&&/^shorts\/[\w\/.-]+\.mp4$/.test(e.video||'')&&!e.video.includes('..'))))return J(res,400,{error:'invalid_manifest'});
   db.shortsManifest=m;save();return J(res,200,{ok:true})}
  if(a==='content'&&M==='GET')return J(res,200,{drafts:(db.content||[]).slice().reverse(),autoFetch:!!db.settings.autoFetch,lastAuto:db.settings.lastAuto||null,sources:CONTENT.SOURCES});
  if(a==='content/feed'&&M==='GET'){const it=await CONTENT.fetchFeeds();const seen=new Set((db.content||[]).map(d=>d.url));return J(res,200,{items:it.map(i=>({...i,used:seen.has(i.link)}))})}
  if(a==='content/generate'&&M==='POST'){const b=await body(req);try{const d=await genDraft(b);return J(res,201,{draft:d})}catch(e){return J(res,502,{error:String(e.message||e).slice(0,300)})}}
  if(a==='content-settings'&&M==='POST'){const b=await body(req);db.settings.autoFetch=!!b.autoFetch;save();return J(res,200,{autoFetch:db.settings.autoFetch})}
  if((m=a.match(/^content\/(\w+)$/))&&(M==='POST'||M==='DELETE')){const d=(db.content||[]).find(x=>x.id===m[1]);if(!d)return J(res,404,{error:'not_found'});
   if(M==='DELETE'){db.content=db.content.filter(x=>x!==d);save();return J(res,200,{ok:true})}
   const b=await body(req);for(const k of['title_th','title_en','body_th','body_en','category'])if(b[k]!=null)d[k]=String(b[k]).slice(0,k.startsWith('body')?12000:300);
   if(b.publish){const r=publishDraft(d);if(r.error)return J(res,400,r)}save();return J(res,200,{draft:d})}
  if(a==='categories'&&M==='POST'){const b=await body(req);if(!Array.isArray(b.categories))return J(res,400,{error:'invalid'});
   const cs=b.categories.filter(c=>/^[\w-]{2,30}$/.test(c.id||'')&&c.th&&c.en).map((c,i)=>({id:c.id,th:String(c.th).slice(0,60),en:String(c.en).slice(0,60),order:Number(c.order??i)||0}));if(!cs.length)return J(res,400,{error:'invalid'});db.categories=cs;save();return J(res,200,{categories:cs})}
  if(a==='updates'&&M==='POST'){const f={};let file=null,big=false;
   await new Promise((ok,bad)=>{let bb;try{bb=Busboy({headers:req.headers,limits:{fileSize:300*1024*1024,files:1,fields:10,fieldSize:20000}})}catch(e){return bad(e)}
    let wp=Promise.resolve();bb.on('field',(k,v)=>f[k]=v);bb.on('file',(k,st,info)=>{const tmp=path.join(DIR,'upd-'+id()+'.tmp');const ws=fs.createWriteStream(tmp);st.on('limit',()=>big=true);st.pipe(ws);wp=new Promise(d=>ws.on('finish',()=>{file=tmp;d()}))});bb.on('close',()=>wp.then(ok));bb.on('error',bad);req.pipe(bb)});
   const c=db.courses.find(x=>x.updates);if(!c){file&&fs.unlinkSync(file);return J(res,404,{error:'no_updates_course'})}
   if(big){file&&fs.unlinkSync(file);return J(res,413,{error:'file_too_large'})}if(!f.title_th&&!f.title_en){file&&fs.unlinkSync(file);return J(res,400,{error:'title_required'})}
   const date=/^\d{4}-\d{2}-\d{2}$/.test(f.date||'')?f.date:now().slice(0,10),lid='u-'+date+'-'+id().slice(0,4);let hasVid=false;
   if(file){const fd=fs.openSync(file,'r'),hb=Buffer.alloc(12);fs.readSync(fd,hb,0,12,0);fs.closeSync(fd);
    if(fs.statSync(file).size>0){if(hb.slice(4,8).toString()!=='ftyp'){fs.unlinkSync(file);return J(res,415,{error:'mp4_only'})}const dd=path.join(MEDIA,'lessons',c.id);fs.mkdirSync(dd,{recursive:true});fs.renameSync(file,path.join(dd,lid+'.mp4'));hasVid=true}else fs.unlinkSync(file)}
   const l={id:lid,type:hasVid||f.video==='1'?'video':'article',video:hasVid||f.video==='1',date,th:String(f.title_th||f.title_en).slice(0,200),en:String(f.title_en||f.title_th).slice(0,200),notes_th:String(f.body_th||f.body_en||'').slice(0,10000),notes_en:String(f.body_en||f.body_th||'').slice(0,10000),quiz:null};
   c.modules[0].lessons.unshift(l);save();return J(res,201,{lesson:l})}
  if(a==='courses'&&M==='POST'){const b=await body(req,500000),c=b.course;if(!c||!/^[\w-]{2,40}$/.test(c.id||'')||!c.th||!c.en||!Array.isArray(c.modules))return J(res,400,{error:'invalid_course'});
   c.packages=(c.packages||[]).filter(p=>PKGS.includes(p));for(const mo of c.modules){if(!Array.isArray(mo.lessons))return J(res,400,{error:'invalid_module'});for(const l of mo.lessons)if(!/^[\w-]{1,40}$/.test(l.id||''))return J(res,400,{error:'invalid_lesson_id'})}
   const i=db.courses.findIndex(x=>x.id===c.id);i>=0?db.courses[i]=c:db.courses.push(c);save();return J(res,200,{ok:true})}
  if((m=a.match(/^courses\/([\w-]+)$/))&&M==='DELETE'){db.courses=db.courses.filter(x=>x.id!==m[1]);save();return J(res,200,{ok:true})}
  if(a==='settings'&&M==='POST'){const b=await body(req);if(b.prices)for(const k of PKGS)if(b.prices[k]!=null)db.settings.prices[k]=Math.max(0,Number(b.prices[k])||0);save();return J(res,200,{settings:db.settings})}
  if(a==='settings'&&M==='GET')return J(res,200,{settings:db.settings});
  if(a==='shorts'&&M==='GET')return J(res,200,shortsFile());
  return J(res,404,{error:'not_found'})}
 }catch(e){J(res,400,{error:String(e.message||'bad_request')})}})();return true};
module.exports.isAdmin=isAdmin;
// ---- AI content helpers ----
const CONTENT=require('./content');
async function genDraft(b){let src;
 if(b.url){if(!/^https?:\/\//.test(b.url))throw new Error('invalid_url');src=await CONTENT.fromUrl(b.url)}
 else if(b.item&&b.item.link)src={title:b.item.title,url:b.item.link,text:(b.item.summary||'')+' '+((await CONTENT.fromUrl(b.item.link).catch(()=>({text:''}))).text||''),source:b.item.source};
 else if(b.topic)src={topic:String(b.topic).slice(0,300)};else throw new Error('need_url_or_topic');
 const o=await CONTENT.rewrite(src);const d={id:id(),status:'draft',created:now(),url:src.url||'',source:src.source||'',source_title:src.title||'',topic:src.topic||'',category:o.category,title_th:o.title_th,title_en:o.title_en,body_th:o.body_th,body_en:o.body_en,quality:o.quality,reason:o.reason};
 (db.content||=[]).push(d);save();return d}
function publishDraft(d){const c=db.courses.find(x=>x.updates);if(!c)return{error:'no_updates_course'};if(d.status==='published')return{error:'already_published'};
 const credit_th=d.url?`\n\nที่มา / เครดิต: ${d.source_title||d.source} - ${d.url}\nเรียบเรียงใหม่โดย PureFxAi`:'\n\nเรียบเรียงโดย PureFxAi',credit_en=d.url?`\n\nSource / credit: ${d.source_title||d.source} - ${d.url}\nRewritten by PureFxAi`:'\n\nWritten by PureFxAi';
 const date=now().slice(0,10),l={id:'u-'+date+'-'+d.id.slice(0,4),type:'article',video:false,date,tag:d.category,th:d.title_th,en:d.title_en,notes_th:d.body_th+credit_th,notes_en:d.body_en+credit_en,source:d.url||undefined,quiz:null};
 c.modules[0].lessons.unshift(l);d.status='published';d.lesson=l.id;d.published=now();return{ok:true}}
setInterval(async()=>{try{if(!db.settings.autoFetch)return;if(db.settings.lastAuto&&Date.now()-Date.parse(db.settings.lastAuto)<24*3600e3)return;db.settings.lastAuto=now();save();
 const seen=new Set((db.content||[]).map(d=>d.url));const it=(await CONTENT.fetchFeeds()).filter(i=>!i.error&&!seen.has(i.link)).slice(0,3);for(const i of it)await genDraft({item:i}).catch(e=>console.log('[content] auto',e.message))}catch(e){console.log('[content] auto error',e.message)}},3600e3).unref();
module.exports._genDraft=genDraft;module.exports._publish=d=>{const r=publishDraft(d);save();return r};module.exports._db=()=>db;module.exports._save=()=>save();
// Offline import: drop server/content-import.json ([{draft fields..., publish:true}]) and it is merged within 30s, then removed.
setInterval(()=>{const f=path.join(__dirname,'content-import.json');if(!fs.existsSync(f))return;try{const arr=JSON.parse(fs.readFileSync(f,'utf8'));fs.unlinkSync(f);
 for(const x of arr){const d={id:id(),status:'draft',created:now(),...x};delete d.publish;(db.content||=[]).push(d);if(x.publish)publishDraft(d)}save();console.log('[content] imported',arr.length)}catch(e){console.log('[content] import error',e.message)}},30000).unref();
