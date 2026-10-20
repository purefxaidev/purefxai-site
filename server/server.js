// PureFxAi backend: serves site, proxies Gemini text chat + Gemini Live WebSocket. API key stays server-side.
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer,WebSocket}=require('ws');
const PORT=process.env.PORT||8080,KEY=process.env.GEMINI_API_KEY||'';
const MODEL=process.env.GEMINI_MODEL||'gemini-3.8-flash';
const LIVE_MODEL=process.env.GEMINI_LIVE_MODEL||'gemini-3.8-live';
const ROOT=path.join(__dirname,'..');
const SYSTEM=`You are the friendly customer assistant of PureFxAi, a brand selling AI courses. Reply in the user's language (Thai or English), concise.
Courses: AI Fundamentals (AI พื้นฐาน), AI for Forex/Gold Trading (educational only, no profit guarantee, trading is risky), Prompt Engineering, AI Automation, Vibe Coding (build websites/apps by talking to AI such as Cursor and ChatGPT: prompts to code to deploy; included from Pro up).
Packages: Starter, Pro (recommended), VIP Mentor, Lifetime. All prices are placeholders "฿X,XXX" — say prices will be confirmed by the team; never invent prices, dates, instructor credentials, or results.
Free resources: 6-episode AI basics videos (incl. Vibe Coding) and AI Tutor exercises on the site. For enrollment, direct users to the contact form on the page. Never give financial advice. Do not use emoji; plain text only.`;;
const MIME={'.html':'text/html; charset=utf-8','.png':'image/png','.js':'text/javascript','.css':'text/css','.json':'application/json','.apk':'application/vnd.android.package-archive','.jpg':'image/jpeg','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8'};

// ---- Shorts: likes + comments with JSON persistence ----
const DATA=path.join(process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(__dirname,'data'),'shorts.json');fs.mkdirSync(path.dirname(DATA),{recursive:true});
let SH={};try{SH=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch(e){}
let saveT;function save(){clearTimeout(saveT);saveT=setTimeout(()=>{const tmp=DATA+'.tmp';fs.writeFileSync(tmp,JSON.stringify(SH));fs.renameSync(tmp,DATA)},200)}
const esc=x=>String(x).replace(/[&<>"'`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
const RL=new Map();function limited(ip,key,max,win){const k=ip+key,now=Date.now(),a=(RL.get(k)||[]).filter(t=>now-t<win);a.push(now);RL.set(k,a);return a.length>max}
setInterval(()=>RL.clear(),10*60*1000).unref();
async function body(req,max=4096){let b='';for await(const c of req){b+=c;if(b.length>max)throw new Error('too_large')}return b?JSON.parse(b):{}}
function shorts(req,res,u){const m=u.pathname.match(/^\/api\/shorts\/([a-z0-9-]{2,40})(?:\/(like|comments))?$/);if(!m)return false;
 const ep=m[1],act=m[2],ip=req.socket.remoteAddress||'';const E=SH[ep]||(SH[ep]={likes:0,comments:[]});
 const J=(c,o)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o))};
 (async()=>{try{
  if(req.method==='GET'&&!act)return J(200,{likes:E.likes,comments:E.comments.slice(-100).reverse()});
  if(req.method==='POST'&&act==='like'){if(limited(ip,'like'+ep,5,60000))return J(429,{error:'rate_limited'});const b=await body(req);E.likes=Math.max(0,E.likes+(b.unlike?-1:1));save();return J(200,{likes:E.likes})}
  if(req.method==='POST'&&act==='comments'){if(limited(ip,'cm',5,60000))return J(429,{error:'rate_limited'});const b=await body(req);
   const name=String(b.name||'').trim().slice(0,40)||'Guest',text=String(b.text||'').trim();
   if(!text||text.length>300)return J(400,{error:'invalid_length'});
   const c={name:esc(name),text:esc(text),at:new Date().toISOString()};E.comments.push(c);if(E.comments.length>1000)E.comments.shift();save();return J(201,c)}
  J(405,{error:'method'})}catch(e){J(400,{error:String(e.message||'bad_request')})}})();return true}
const lms=require('./lms'),studio=require('./studio');let social=()=>false;try{social=require('./social')}catch(e){}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://x');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), geolocation=(), microphone=(self)');res.setHeader('Cross-Origin-Opener-Policy','same-origin');
 res.setHeader('Content-Security-Policy',u.pathname==='/studio.html'?"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"
  :"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' ws: wss:; frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
 if(social(req,res,u))return;
 if(studio(req,res,u))return;
 if(lms(req,res,u))return;
 {const m=u.pathname.match(/^\/api\/admin-shorts\/([a-z0-9-]{2,40})\/comment$/);if(m&&req.method==='POST'){res.setHeader('content-type','application/json');
  if(req.headers['x-pfx']!=='1'||!lms.isAdmin(req)){res.writeHead(401);return res.end('{"error":"admin_required"}')}
  let b='';for await(const c of req){b+=c;if(b.length>2000)break}let at='';try{at=JSON.parse(b).at}catch(e){}
  const E=SH[m[1]];const n=E?E.comments.length:0;if(E)E.comments=E.comments.filter(c=>c.at!==at);save();return res.end(JSON.stringify({removed:n-(E?E.comments.length:0)}))}}
 if(u.pathname==='/api/shorts-stats'&&req.method==='GET'){const eps={},rec=[];for(const[k,E]of Object.entries(SH)){eps[k]={likes:E.likes||0,comments:(E.comments||[]).length};for(const c of(E.comments||[]).slice(-10))rec.push({ep:k,...c})}rec.sort((a,b)=>a.at<b.at?1:-1);res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({eps,recent:rec.slice(0,12)}))}
 if(shorts(req,res,u))return;
 if(u.pathname==='/api/status'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({configured:!!KEY}))}
 if(u.pathname==='/api/chat'&&req.method==='POST'){
  let b='';for await(const c of req)b+=c;res.setHeader('content-type','application/json');
  if(!KEY){res.writeHead(503);return res.end(JSON.stringify({error:'not_configured'}))}
  try{const {messages=[]}=JSON.parse(b||'{}');
   const contents=messages.slice(-20).map(m=>({role:m.role==='user'?'user':'model',parts:[{text:String(m.text).slice(0,2000)}]}));
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':KEY},
    body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents})});
   const j=await r.json();const text=j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';
   if(!r.ok)throw new Error(j?.error?.message||r.status);return res.end(JSON.stringify({text}))}
  catch(e){res.writeHead(502);return res.end(JSON.stringify({error:'upstream',detail:String(e.message||e)}))}}
 let p=u.pathname==='/'?'/index.html':u.pathname;const f=path.normalize(path.join(ROOT,p));
 if(!f.startsWith(ROOT)||f.includes(path.sep+'server')){res.writeHead(404);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}const H={'content-type':MIME[path.extname(f)]||'application/octet-stream'};if(/[\\/]subs[\\/][\w-]+\.(vtt|json)$/.test(f)){H['access-control-allow-origin']='*';H['cache-control']='public, max-age=600'}res.writeHead(200,H);res.end(d)});
});
// Live voice proxy: browser <-> /api/live <-> Gemini Live (key added server-side)
const wss=new WebSocketServer({server,path:'/api/live'});
wss.on('connection',client=>{
 if(!KEY){client.send(JSON.stringify({error:'not_configured'}));return client.close()}
 const up=new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${KEY}`);
 const queue=[];
 up.on('open',()=>{up.send(JSON.stringify({setup:{model:`models/${LIVE_MODEL}`,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:SYSTEM}]}}}));queue.splice(0).forEach(m=>up.send(m))});
 up.on('message',d=>client.readyState===1&&client.send(d.toString()));
 up.on('close',(c,r)=>{client.readyState===1&&client.send(JSON.stringify({closed:c,reason:String(r)}));client.close()});
 up.on('error',e=>{client.readyState===1&&client.send(JSON.stringify({error:'upstream',detail:e.message}));client.close()});
 client.on('message',m=>{m=m.toString();if(m.length>1e6)return;up.readyState===1?up.send(m):queue.push(m)});
 client.on('close',()=>up.close());
});
server.listen(PORT,()=>console.log(`PureFxAi on http://localhost:${PORT} (Gemini ${KEY?'configured':'NOT configured'})`));
