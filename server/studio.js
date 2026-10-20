// PureFxAi Video Engine: free public image-to-video. Backend-only proxy to a private render node (COMFY_URL env, no default).
// Browser never sees the render node; all errors are generic; outputs re-encoded without metadata.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFile}=require('child_process'),Busboy=require('busboy');
let sharp;try{sharp=require('sharp')}catch(e){}
const lms=require('./lms');
const NODE=()=>(process.env.COMFY_URL||'').replace(/\/$/,'');
const DIR=path.join(process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(__dirname,'data'),'studio');fs.mkdirSync(DIR,{recursive:true});
const SF=path.join(DIR,'settings.json'),WF={video:path.join(__dirname,'studio-workflow.json'),music:path.join(__dirname,'studio-music.json'),image:path.join(__dirname,'studio-image.json')};
const SALT=process.env.STUDIO_SALT||crypto.randomBytes(16).toString('hex');
const KINDS=['video','music','image'];let S={video:{enabled:true,perIp:2,dailyCap:20,maxQueue:10},music:{enabled:true,perIp:3,dailyCap:40,maxQueue:10},image:{enabled:true,perIp:5,dailyCap:60,maxQueue:15}};
try{const o=JSON.parse(fs.readFileSync(SF,'utf8'));if('perIp'in o)Object.assign(S.video,o);else for(const k of KINDS)Object.assign(S[k],o[k]||{})}catch(e){}
let imageModel=false; // auto-detected from render node object_info
const saveS=()=>fs.writeFileSync(SF,JSON.stringify(S));
const day=()=>new Date().toISOString().slice(0,10);const U0=()=>({day:day(),video:{total:0,ip:{}},music:{total:0,ip:{}},image:{total:0,ip:{}}});let usage=U0();
const jobs=new Map(),queue=[];let running=null,avgSec=240;
const hashIp=ip=>crypto.createHash('sha256').update(SALT+ip).digest('hex').slice(0,16);
const log=(...a)=>console.log('[studio]',...a);
const J=(res,c,o)=>{res.writeHead(c,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(o))};
function clientIp(req){const r=req.socket.remoteAddress||'';if(/^(::ffff:)?127\.|^::1$/.test(r))return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||r).split(',')[0].trim();return r}
const BLOCK=[/\b(nude|naked|nsfw|porn|sex|sexual|erotic|explicit|topless|lingerie|undress|fetish|onlyfans|boob|breast|genital|xxx)\b/i,
 /\b(child|children|kid|kids|minor|underage|teen|teenager|loli|schoolgirl|schoolboy|baby|toddler)\b/i,
 /\b(gore|blood|bloody|kill|killing|murder|behead|decapitat|torture|shoot(ing)?|gun|stab|suicide|corpse|dismember|terror|bomb)\b/i,
 /\b(deepfake|face ?swap|celebrity|politician|president|prime minister|real person|elon musk|trump|biden|taylor swift)\b/i,
 /(โป๊|เปลือย|ลามก|อนาจาร|ทางเพศ|เซ็กซ์|เย็ด|หื่น|นมโป๊|โชว์นม|ถอดเสื้อ|เด็ก|ผู้เยาว์|นักเรียนหญิง|ทารก|เลือด|ฆ่า|ฆาตกรรม|ตัดหัว|ทรมาน|ยิง|แทง|ฆ่าตัวตาย|ศพ|ระเบิด|ก่อการร้าย|ดีปเฟค|เปลี่ยนหน้า|ดารา|นักการเมือง|นายก|คนจริง)/];
const badPrompt=p=>BLOCK.some(r=>r.test(p));
const tok=()=>crypto.randomBytes(24).toString('base64url');
const pos=j=>{const i=queue.indexOf(j);return i<0?0:i+1};
const pub=j=>({kind:j.kind,status:j.status,position:pos(j),eta:j.status==='done'?0:Math.round((pos(j)+(running?1:0))*avgSec-(j.status==='running'?(Date.now()-j.started)/1000:0)),error:j.error,expires:j.expires,duration:j.duration});
// ---- outbound to render node: minimal headers, generic UA, timeouts ----
async function nf(p,o={},ms=30000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(NODE()+p,{...o,signal:ac.signal,headers:{'user-agent':'Mozilla/5.0',...(o.headers||{})}});if(!r.ok)throw new Error('node_http_'+r.status);return r}finally{clearTimeout(t)}}
async function nodeBusy(){const q=await (await nf('/queue',{},15000)).json();return (q.queue_running||[]).length+(q.queue_pending||[]).length>0}
const ff=(args,ms=600000)=>new Promise((ok,bad)=>execFile('ffmpeg',args,{timeout:ms},e=>e?bad(e):ok()));
async function getOut(pid,node,re){const t0=Date.now();while(Date.now()-t0<25*60e3){await new Promise(r=>setTimeout(r,4000));const h=await (await nf('/history/'+pid,{},20000)).json();const e=h[pid];if(!e)continue;
  if(e.status&&e.status.status_str==='error')throw new Error('node_failed');const o=e.outputs&&e.outputs[node];if(o){const f=[].concat(o.videos||[],o.gifs||[],o.audio||[],o.images||[]).find(x=>re.test(x.filename));if(f)return f}}throw new Error('timeout')}
async function fetchOut(f){const r=await nf(`/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder||'')}&type=${encodeURIComponent(f.type||'output')}`,{},120000);return Buffer.from(await r.arrayBuffer())}
async function submit(w){const pr=await (await nf('/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:w,client_id:crypto.randomUUID()})})).json();if(!pr.prompt_id)throw new Error('no_prompt_id');return pr.prompt_id}
const rnd=n=>crypto.randomBytes(n).toString('hex');
async function renderMusic(j){const w=JSON.parse(fs.readFileSync(WF.music,'utf8')),seed=crypto.randomInt(1,2**31);
 Object.assign(w['13'].inputs,{caption:j.style,lyrics:j.lyrics,seed,max_duration:j.duration});w['15'].inputs.seconds=j.duration;w['9'].inputs.seed=seed;w['35'].inputs.filename_prefix='audio/pfx_'+rnd(6);
 const f=await getOut(await submit(w),'35',/\.(mp3|flac|wav|ogg|opus)$/i);const raw=path.join(DIR,rnd(12)+'.raw');fs.writeFileSync(raw,await fetchOut(f));const dst=path.join(DIR,rnd(16)+'.mp3');
 try{await ff(['-v','error','-y','-i',raw,'-map','0:a:0','-c:a','libmp3lame','-q:a','2','-map_metadata','-1','-fflags','+bitexact','-flags:a','+bitexact','-id3v2_version','3','-metadata','title=PureFxAi Music Engine','-metadata','artist=PureFxAi',dst])}finally{fs.rmSync(raw,{force:true})}return dst}
const IMG_SIZES={'1:1':[1024,1024],'9:16':[768,1344],'16:9':[1344,768]};
async function renderImage(j){const w=JSON.parse(fs.readFileSync(WF.image,'utf8')),[W,H]=IMG_SIZES[j.aspect]||IMG_SIZES['1:1'];
 w['452'].inputs.prompt=j.prompt;Object.assign(w['456'].inputs,{width:W,height:H});w['458'].inputs.seed=crypto.randomInt(1,2**31);w['461'].inputs.filename_prefix='img/pfx_'+rnd(6);
 const f=await getOut(await submit(w),'461',/\.(png|jpe?g|webp)$/i);const buf=await fetchOut(f),dst=path.join(DIR,rnd(16)+'.jpg');
 const fs_=Math.round(H/40),svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="${W-fs_}" y="${H-fs_}" text-anchor="end" font-family="sans-serif" font-size="${fs_}" fill="white" fill-opacity=".75" stroke="black" stroke-opacity=".35" stroke-width="1">PureFxAi</text></svg>`);
 await sharp(buf).resize(W,H,{fit:'cover'}).composite([{input:svg}]).jpeg({quality:90,mozjpeg:true}).toFile(dst);return dst} // sharp output carries no source metadata
async function checkImageModel(){if(!NODE())return;try{const o=await (await nf('/object_info/UNETLoader',{},20000)).json();const l=o?.UNETLoader?.input?.required?.unet_name?.[0]||[];imageModel=l.some(n=>/qwen_image_2\.1/i.test(n))}catch(e){}}
setTimeout(checkImageModel,3000);setInterval(checkImageModel,600e3).unref();
const ready=k=>!!NODE()&&!!sharp&&S[k].enabled&&(k!=='image'||imageModel);
async function render(j){if(j.kind==='music')return renderMusic(j);if(j.kind==='image')return renderImage(j);const name='in_'+crypto.randomBytes(8).toString('hex')+'.png';
 const fd=new FormData();fd.append('image',new Blob([fs.readFileSync(j.img)],{type:'image/png'}),name);fd.append('overwrite','true');
 const up=await (await nf('/upload/image',{method:'POST',body:fd},60000)).json();
 const w=JSON.parse(fs.readFileSync(WF.video,'utf8'));w['136'].inputs.image=up.subfolder?up.subfolder+'/'+up.name:up.name;w['157'].inputs.prompt=j.prompt;w['159'].inputs.value=j.duration;
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
 finally{if(j.img)fs.rmSync(j.img,{force:true});running=null}}
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
 (async()=>{try{if(usage.day!==day())usage=U0();const iph=hashIp(clientIp(req));let m;
  if(r==='config'&&M==='GET'){const o={queue:queue.length+(running?1:0)};for(const k of KINDS)o[k]={enabled:ready(k),soon:k==='image'&&!imageModel,perIp:S[k].perIp,remaining:Math.max(0,S[k].perIp-(usage[k].ip[iph]||0))};o.video.durations=[5,10,15];o.music.durations=[30,60];o.image.aspects=Object.keys(IMG_SIZES);return J(res,200,o)}
  if((m=r.match(/^jobs(?:\/(video|music|image))?$/))&&M==='POST'){const kind=m[1]||'video',C=S[kind],UK=usage[kind];
   if(!ready(kind))return J(res,503,{error:'disabled'});
   if((UK.ip[iph]||0)>=C.perIp)return J(res,429,{error:'ip_limit'});if(UK.total>=C.dailyCap)return J(res,429,{error:'daily_cap'});if(queue.filter(x=>x.kind===kind).length>=C.maxQueue||queue.length>=40)return J(res,429,{error:'queue_full'});
   if(!/^multipart\/form-data/.test(req.headers['content-type']||''))return J(res,400,{error:'bad_form'});
   const {f,file,big}=await upload(req);if(big)return J(res,413,{error:'too_large'});if(f.agree!=='1')return J(res,400,{error:'terms'});
   const clean=(v,n)=>String(v||'').replace(/[\u0000-\u0008\u000b-\u001f<>]/g,' ').trim().slice(0,n);let j;
   if(kind==='music'){const style=clean(f.style,400),lyrics=clean(f.lyrics,3000);if(style.length<3)return J(res,400,{error:'no_prompt'});if(badPrompt(style+' '+lyrics))return J(res,400,{error:'blocked_prompt'});
    j={kind,style,lyrics:lyrics||'[Instrumental]',duration:[30,60].includes(Number(f.duration))?Number(f.duration):30}}
   else if(kind==='image'){const prompt=clean(f.prompt,800);if(prompt.length<3)return J(res,400,{error:'no_prompt'});if(badPrompt(prompt))return J(res,400,{error:'blocked_prompt'});j={kind,prompt,aspect:IMG_SIZES[f.aspect]?f.aspect:'1:1'}}
   else{if(!file||!file.length)return J(res,400,{error:'no_image'});const prompt=clean(f.prompt,600).replace(/\n/g,' ');if(prompt.length<3)return J(res,400,{error:'no_prompt'});
    if(badPrompt(prompt))return J(res,400,{error:'blocked_prompt'});const duration=[5,10,15].includes(Number(f.duration))?Number(f.duration):5;
    let meta;try{meta=await sharp(file,{limitInputPixels:40e6}).metadata()}catch(e){return J(res,415,{error:'bad_image'})}
    if(!['jpeg','png','webp'].includes(meta.format)||meta.width<256||meta.height<256||meta.width>6000||meta.height>6000)return J(res,415,{error:'bad_image'});
    const img=path.join(DIR,crypto.randomBytes(16).toString('hex')+'.png');
    await sharp(file,{limitInputPixels:40e6}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).removeAlpha().png().toFile(img);j={kind,prompt,duration,img}}
   const t=tok();Object.assign(j,{id:t,iph,status:'queued',created:Date.now()});jobs.set(t,j);queue.push(j);UK.ip[iph]=(UK.ip[iph]||0)+1;UK.total++;log('queued',kind,t.slice(0,6),'ip',iph);
   tick().catch(()=>{});return J(res,201,{token:t,...pub(j)})}
  if((m=r.match(/^jobs\/([\w-]{32})$/))&&M==='GET'){const j=jobs.get(m[1]);return j?J(res,200,pub(j)):J(res,404,{error:'not_found'})}
  if((m=r.match(/^result\/([\w-]{32})$/))&&M==='GET'){const j=jobs.get(m[1]);if(!j||j.status!=='done'||!j.out||!fs.existsSync(j.out))return J(res,404,{error:'not_found'});
   const st=fs.statSync(j.out),rg=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');const ext=path.extname(j.out),h={'content-type':ext==='.mp3'?'audio/mpeg':ext==='.jpg'?'image/jpeg':'video/mp4','accept-ranges':'bytes','cache-control':'private, no-store'};if(u.searchParams.get('dl'))h['content-disposition']=`attachment; filename="purefxai-${j.kind}${ext}"`;
   if(rg){const a=rg[1]?+rg[1]:0,b=rg[2]?Math.min(+rg[2],st.size-1):st.size-1;if(a>=st.size){res.writeHead(416);return res.end()}res.writeHead(206,{...h,'content-range':`bytes ${a}-${b}/${st.size}`,'content-length':b-a+1});return fs.createReadStream(j.out,{start:a,end:b}).pipe(res)}
   res.writeHead(200,{...h,'content-length':st.size});return fs.createReadStream(j.out).pipe(res)}
  if(r==='admin'){if(!lms.isAdmin(req))return J(res,401,{error:'admin_required'});
   if(M==='POST'){let b='';for await(const c of req){b+=c;if(b.length>4000)break}let o={};try{o=JSON.parse(b)}catch(e){}
    for(const k of KINDS){const x=o[k];if(!x)continue;if('enabled'in x)S[k].enabled=!!x.enabled;for(const f of['perIp','dailyCap','maxQueue'])if(x[f]!=null)S[k][f]=Math.max(0,Math.min(1000,parseInt(x[f])||0))}saveS()}
   return J(res,200,{settings:S,configured:!!NODE(),imageModel,today:Object.fromEntries(KINDS.map(k=>[k,{total:usage[k].total,ips:Object.keys(usage[k].ip).length}])),queue:queue.length,running:!!running,avgSec})}
  J(res,404,{error:'not_found'})}catch(e){log('error',String(e.message).slice(0,40));if(!res.headersSent)J(res,500,{error:'server_error'})}})();return true};
