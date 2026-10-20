// PureFxAi Video Engine: free public image-to-video. Backend-only proxy to a private render node (COMFY_URL env, no default).
// Browser never sees the render node; all errors are generic; outputs re-encoded without metadata.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFile}=require('child_process'),Busboy=require('busboy');
let sharp;try{sharp=require('sharp')}catch(e){}
const lms=require('./lms');
const NODE=()=>(process.env.COMFY_URL||'').replace(/\/$/,'');
const DIR=path.join(process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(__dirname,'data'),'studio');fs.mkdirSync(DIR,{recursive:true});
const SF=path.join(DIR,'settings.json'),WF=path.join(__dirname,'studio-workflow.json');
const SALT=process.env.STUDIO_SALT||crypto.randomBytes(16).toString('hex');
let S={enabled:true,perIp:2,dailyCap:20,maxQueue:10};try{Object.assign(S,JSON.parse(fs.readFileSync(SF,'utf8')))}catch(e){}
const saveS=()=>fs.writeFileSync(SF,JSON.stringify(S));
const day=()=>new Date().toISOString().slice(0,10);let usage={day:day(),total:0,ip:{}};
const jobs=new Map(),queue=[];let running=null,avgSec=240;
const hashIp=ip=>crypto.createHash('sha256').update(SALT+ip).digest('hex').slice(0,16);
const log=(...a)=>console.log('[studio]',...a);
const J=(res,c,o)=>{res.writeHead(c,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(o))};
function clientIp(req){const r=req.socket.remoteAddress||'';if(/^(::ffff:)?127\.|^::1$/.test(r))return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||r).split(',')[0].trim();return r}
const BLOCK=[/\b(nude|naked|nsfw|porn|sex|sexual|erotic|explicit|topless|lingerie|undress|fetish|onlyfans|boob|breast|genital|xxx)\b/i,
 /\b(child|children|kid|kids|minor|underage|teen|teenager|loli|schoolgirl|schoolboy|baby|toddler)\b/i,
 /\b(gore|blood|bloody|kill|killing|murder|behead|decapitat|torture|shoot(ing)?|gun|stab|suicide|corpse|dismember|terror|bomb)\b/i,
 /\b(deepfake|face ?swap|celebrity|politician|president|prime minister|real person|elon musk|trump|biden|taylor swift)\b/i,
 /(โป๊|เปลือย|ลามก|อนาจาร|ทางเพศ|เซ็กซ์|เย็ด|หื่น|นม|ถอดเสื้อ|เด็ก|ผู้เยาว์|นักเรียนหญิง|ทารก|เลือด|ฆ่า|ฆาตกรรม|ตัดหัว|ทรมาน|ยิง|แทง|ฆ่าตัวตาย|ศพ|ระเบิด|ก่อการร้าย|ดีปเฟค|เปลี่ยนหน้า|ดารา|นักการเมือง|นายก|คนจริง)/];
const badPrompt=p=>BLOCK.some(r=>r.test(p));
const tok=()=>crypto.randomBytes(24).toString('base64url');
const pos=j=>{const i=queue.indexOf(j);return i<0?0:i+1};
const pub=j=>({status:j.status,position:pos(j),eta:j.status==='done'?0:Math.round((pos(j)+(running?1:0))*avgSec-(j.status==='running'?(Date.now()-j.started)/1000:0)),error:j.error,expires:j.expires,duration:j.duration});
// ---- outbound to render node: minimal headers, generic UA, timeouts ----
async function nf(p,o={},ms=30000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(NODE()+p,{...o,signal:ac.signal,headers:{'user-agent':'Mozilla/5.0',...(o.headers||{})}});if(!r.ok)throw new Error('node_http_'+r.status);return r}finally{clearTimeout(t)}}
async function nodeBusy(){const q=await (await nf('/queue',{},15000)).json();return (q.queue_running||[]).length+(q.queue_pending||[]).length>0}
const ff=(args,ms=600000)=>new Promise((ok,bad)=>execFile('ffmpeg',args,{timeout:ms},e=>e?bad(e):ok()));
async function render(j){const name='in_'+crypto.randomBytes(8).toString('hex')+'.png';
 const fd=new FormData();fd.append('image',new Blob([fs.readFileSync(j.img)],{type:'image/png'}),name);fd.append('overwrite','true');
 const up=await (await nf('/upload/image',{method:'POST',body:fd},60000)).json();
 const w=JSON.parse(fs.readFileSync(WF,'utf8'));w['136'].inputs.image=up.subfolder?up.subfolder+'/'+up.name:up.name;w['157'].inputs.prompt=j.prompt;w['159'].inputs.value=j.duration;
 w['155'].inputs.noise_seed=crypto.randomInt(1,2**31);w['142'].inputs.megapixels=0.5;w['92'].inputs.filename_prefix='video/pfx_'+crypto.randomBytes(6).toString('hex');
 const pr=await (await nf('/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:w,client_id:crypto.randomUUID()})})).json();const pid=pr.prompt_id;if(!pid)throw new Error('no_prompt_id');
 const t0=Date.now();let out;while(Date.now()-t0<25*60e3){await new Promise(r=>setTimeout(r,5000));const h=await (await nf('/history/'+pid,{},20000)).json();const e=h[pid];if(!e)continue;
  if(e.status&&e.status.status_str==='error')throw new Error('node_failed');const o=e.outputs&&e.outputs['92'];if(o){out=[].concat(o.videos||[],o.gifs||[],o.images||[]).find(x=>/\.(mp4|webm|mov)$/i.test(x.filename));if(out)break}}
 if(!out)throw new Error('timeout');
 const raw=path.join(DIR,crypto.randomBytes(12).toString('hex')+'.raw'),r=await nf(`/view?filename=${encodeURIComponent(out.filename)}&subfolder=${encodeURIComponent(out.subfolder||'')}&type=${encodeURIComponent(out.type||'output')}`,{},120000);
 fs.writeFileSync(raw,Buffer.from(await r.arrayBuffer()));const dst=path.join(DIR,crypto.randomBytes(16).toString('hex')+'.mp4');
 const vf="drawtext=text='PureFxAi':fontcolor=white@0.75:fontsize=h/28:x=w-tw-h/40:y=h-th-h/40:shadowcolor=black@0.6:shadowx=1:shadowy=1";
 try{await ff(['-v','error','-y','-i',raw,'-map','0:v:0','-map','0:a?','-vf',vf,'-c:v','libx264','-crf','20','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-map_metadata','-1','-map_chapters','-1','-fflags','+bitexact','-flags:v','+bitexact','-flags:a','+bitexact','-metadata','title=PureFxAi Video Engine','-movflags','+faststart',dst])}
 finally{fs.rmSync(raw,{force:true})}return dst}
async function tick(){if(running||!queue.length||!NODE())return;const j=queue[0];
 try{if(await nodeBusy()){j.status='waiting';return}}catch(e){j.status='waiting';return}
 queue.shift();running=j;j.status='running';j.started=Date.now();log('job start',j.id.slice(0,6),'ip',j.iph);
 try{j.out=await render(j);j.status='done';j.expires=new Date(Date.now()+24*3600e3).toISOString();avgSec=Math.round(avgSec*0.6+(Date.now()-j.started)/1000*0.4);log('job done',j.id.slice(0,6),Math.round((Date.now()-j.started)/1000)+'s')}
 catch(e){j.status='failed';j.error='render_failed';log('job failed',j.id.slice(0,6),String(e.message).slice(0,40))}
 finally{fs.rmSync(j.img,{force:true});running=null}}
setInterval(()=>tick().catch(()=>{}),5000).unref();
setInterval(()=>{const now=Date.now();for(const[k,j]of jobs){if(now-j.created>24*3600e3){if(j.out)fs.rmSync(j.out,{force:true});jobs.delete(k)}}},600e3).unref();
function sameOrigin(req){const o=req.headers.origin;if(!o)return true;try{return new URL(o).host===req.headers.host||new URL(o).host===req.headers['x-forwarded-host']}catch(e){return false}}
async function upload(req){return new Promise((ok,bad)=>{const f={};let buf=[],size=0,big=false,files=0;let bb;
 try{bb=Busboy({headers:req.headers,limits:{fileSize:8*1024*1024,files:1,fields:6,fieldSize:2000,parts:8}})}catch(e){return bad(new Error('bad_form'))}
 bb.on('field',(k,v)=>f[k]=v);bb.on('file',(k,st)=>{files++;st.on('data',d=>{size+=d.length;buf.push(d)});st.on('limit',()=>big=true)});
 bb.on('close',()=>ok({f,file:files?Buffer.concat(buf):null,big}));bb.on('error',()=>bad(new Error('bad_form')));req.pipe(bb)})}
module.exports=function(req,res,u){const p=u.pathname;if(!p.startsWith('/api/studio/'))return false;const r=p.slice(12),M=req.method;
 if(!sameOrigin(req)){J(res,403,{error:'origin'});return true}
 if(M!=='GET'&&req.headers['x-pfx']!=='1'){J(res,403,{error:'csrf'});return true}
 (async()=>{try{if(usage.day!==day())usage={day:day(),total:0,ip:{}};const iph=hashIp(clientIp(req));let m;
  if(r==='config'&&M==='GET')return J(res,200,{enabled:S.enabled&&!!NODE()&&!!sharp,perIp:S.perIp,remaining:Math.max(0,S.perIp-(usage.ip[iph]||0)),globalLeft:Math.max(0,S.dailyCap-usage.total),durations:[5,10,15],queue:queue.length+(running?1:0)});
  if(r==='jobs'&&M==='POST'){
   if(!S.enabled||!NODE()||!sharp)return J(res,503,{error:'disabled'});
   if((usage.ip[iph]||0)>=S.perIp)return J(res,429,{error:'ip_limit'});if(usage.total>=S.dailyCap)return J(res,429,{error:'daily_cap'});if(queue.length>=S.maxQueue)return J(res,429,{error:'queue_full'});
   if(!/^multipart\/form-data/.test(req.headers['content-type']||''))return J(res,400,{error:'bad_form'});
   const {f,file,big}=await upload(req);if(big)return J(res,413,{error:'too_large'});if(!file||!file.length)return J(res,400,{error:'no_image'});
   if(f.agree!=='1')return J(res,400,{error:'terms'});const prompt=String(f.prompt||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,600);if(prompt.length<3)return J(res,400,{error:'no_prompt'});
   if(badPrompt(prompt))return J(res,400,{error:'blocked_prompt'});const duration=[5,10,15].includes(Number(f.duration))?Number(f.duration):5;
   let meta;try{meta=await sharp(file,{limitInputPixels:40e6}).metadata()}catch(e){return J(res,415,{error:'bad_image'})}
   if(!['jpeg','png','webp'].includes(meta.format)||meta.width<256||meta.height<256||meta.width>6000||meta.height>6000)return J(res,415,{error:'bad_image'});
   const img=path.join(DIR,crypto.randomBytes(16).toString('hex')+'.png');
   await sharp(file,{limitInputPixels:40e6}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).removeAlpha().png().toFile(img); // re-encode, strips EXIF/metadata
   const t=tok(),j={id:t,iph,prompt,duration,img,status:'queued',created:Date.now()};jobs.set(t,j);queue.push(j);usage.ip[iph]=(usage.ip[iph]||0)+1;usage.total++;log('queued',t.slice(0,6),'ip',iph,'d',duration);
   tick().catch(()=>{});return J(res,201,{token:t,...pub(j)})}
  if((m=r.match(/^jobs\/([\w-]{32})$/))&&M==='GET'){const j=jobs.get(m[1]);return j?J(res,200,pub(j)):J(res,404,{error:'not_found'})}
  if((m=r.match(/^result\/([\w-]{32})$/))&&M==='GET'){const j=jobs.get(m[1]);if(!j||j.status!=='done'||!j.out||!fs.existsSync(j.out))return J(res,404,{error:'not_found'});
   const st=fs.statSync(j.out),rg=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');const h={'content-type':'video/mp4','accept-ranges':'bytes','cache-control':'private, no-store'};if(u.searchParams.get('dl'))h['content-disposition']='attachment; filename="purefxai-video.mp4"';
   if(rg){const a=rg[1]?+rg[1]:0,b=rg[2]?Math.min(+rg[2],st.size-1):st.size-1;if(a>=st.size){res.writeHead(416);return res.end()}res.writeHead(206,{...h,'content-range':`bytes ${a}-${b}/${st.size}`,'content-length':b-a+1});return fs.createReadStream(j.out,{start:a,end:b}).pipe(res)}
   res.writeHead(200,{...h,'content-length':st.size});return fs.createReadStream(j.out).pipe(res)}
  if(r==='admin'){if(!lms.isAdmin(req))return J(res,401,{error:'admin_required'});
   if(M==='POST'){let b='';for await(const c of req){b+=c;if(b.length>2000)break}let o={};try{o=JSON.parse(b)}catch(e){}
    if('enabled'in o)S.enabled=!!o.enabled;for(const k of['perIp','dailyCap','maxQueue'])if(o[k]!=null)S[k]=Math.max(0,Math.min(1000,parseInt(o[k])||0));saveS()}
   return J(res,200,{settings:S,configured:!!NODE(),today:{total:usage.total,ips:Object.keys(usage.ip).length},queue:queue.length,running:!!running,avgSec})}
  J(res,404,{error:'not_found'})}catch(e){log('error',String(e.message).slice(0,40));if(!res.headersSent)J(res,500,{error:'server_error'})}})();return true};
