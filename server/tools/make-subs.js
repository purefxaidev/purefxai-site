#!/usr/bin/env node
// Make soft subtitles for one short-drama episode.
// Usage: node server/tools/make-subs.js shorts/ep01 [--force] [--langs en,zh,ja,ko,lo,my,vi]
// Reads <dir>/script.md (## Shot N (m:ss-m:ss) + quoted Thai lines in the "motion prompt"),
// writes <dir>/subs/th.vtt, translates ALL languages in ONE Gemini request, writes <lang>.vtt + index.json.
// Results are cached in the repo; the site never calls Gemini per viewer.
// GEMINI_API_KEY from env or /home/box/secrets/render.env.
const fs=require('fs'),path=require('path');
const args=process.argv.slice(2),dir=path.resolve(args.find(a=>!a.startsWith('--'))||'.');
const force=args.includes('--force'),li=args.indexOf('--langs');
const LANGS=(li>=0?args[li+1]:'en,zh,ja,ko,lo,my,vi').split(',').filter(Boolean);
const NAMES={th:'ไทย',en:'English',zh:'中文',ja:'日本語',ko:'한국어',lo:'ລາວ',my:'မြန်မာ',vi:'Tiếng Việt'};
function key(){if(process.env.GEMINI_API_KEY)return process.env.GEMINI_API_KEY;try{const m=/^GEMINI_API_KEY=(.*)$/m.exec(fs.readFileSync('/home/box/secrets/render.env','utf8'));return m?m[1].trim().replace(/^['"]|['"]$/g,''):''}catch(e){return''}}
const ts=s=>{const[m,x]=s.split(':').map(Number);return m*60+x};
const fmt=t=>{const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=(t%60).toFixed(3).padStart(6,'0');return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${s}`};
function parse(md){const cues=[];const shots=md.split(/^## Shot /m).slice(1);
 for(const sh of shots){const tm=/\((\d+:\d\d)\s*-\s*(\d+:\d\d)\)/.exec(sh);if(!tm)continue;const a=ts(tm[1]),b=ts(tm[2]);
  const mot=(sh.split('\n').find(l=>/motion prompt|dialogue|บทพูด/i.test(l))||'');const lines=[];const re=/([A-Za-z][\w ]{0,30})?[^"“]{0,60}?["“]([^"”]*[\u0E00-\u0E7F][^"”]*)["”]/g;let m,last=0;
  while((m=re.exec(mot))){const qi=m.index+m[0].length-m[2].length-2,pre=mot.slice(last,qi);last=m.index+m[0].length;const sys=/system/i.test(pre);lines.push((sys?'ระบบ: ':'')+m[2].trim())}
  if(!lines.length)continue;const s0=a+1,s1=b-.6,tot=lines.reduce((x,l)=>x+l.length+8,0);let t=s0;
  for(const l of lines){const d=(s1-s0)*(l.length+8)/tot;cues.push({start:t,end:t+Math.min(d-.15,2+l.length*.16),text:l});t+=d}}
 return cues}
const vtt=c=>'WEBVTT\n\n'+c.map((x,i)=>`${i+1}\n${fmt(x.start)} --> ${fmt(x.end)}\n${x.text}\n`).join('\n');
async function translate(cues){const k=key();if(!k)throw new Error('no GEMINI_API_KEY');const model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
 const prompt=`Translate these Thai subtitle lines from a short drama into: ${LANGS.map(l=>l+' ('+NAMES[l]+')').join(', ')}. Keep them short and natural for subtitles, keep the speaker prefix "ระบบ:" translated as the word for "System:". Return ONLY JSON: {"<lang>":[strings in same order, same count]}.\n`+JSON.stringify(cues.map(c=>c.text));
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':k},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:.3}})});
 const j=await r.json();if(!r.ok)throw new Error('gemini '+r.status+' '+JSON.stringify(j).slice(0,300));
 return JSON.parse(j.candidates[0].content.parts.map(p=>p.text||'').join(''))}
(async()=>{const md=fs.readFileSync(path.join(dir,'script.md'),'utf8'),cues=parse(md);if(!cues.length)throw new Error('no dialogue found in script.md');
 const out=path.join(dir,'subs');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'th.vtt'),vtt(cues));
 const have=['th'],todo=force?LANGS:LANGS.filter(l=>!fs.existsSync(path.join(out,l+'.vtt')));
 const old=l=>{try{return fs.readFileSync(path.join(out,l+'.vtt'),'utf8').replace(/\r/g,'').split(/\n\n+/).filter(b=>b.includes('-->')).map(b=>b.split('\n').slice(2).join('\n'))}catch(e){return null}};
 // reuse cached translations (re-timed) when the line count is unchanged: no Gemini call
 const reuse={};if(!force)for(const l of LANGS){const o=old(l);if(o&&o.length===cues.length)reuse[l]=o}
 for(const l in reuse)fs.writeFileSync(path.join(out,l+'.vtt'),vtt(cues.map((c,i)=>({...c,text:reuse[l][i]}))));
 if(todo.length&&todo.some(l=>!reuse[l])){const tr=await translate(cues);for(const l of LANGS){const a=tr[l];if(!Array.isArray(a)||a.length!==cues.length){console.warn('skip',l,'bad length');continue}
  fs.writeFileSync(path.join(out,l+'.vtt'),vtt(cues.map((c,i)=>({...c,text:String(a[i]).trim()}))))}}
 for(const l of LANGS)if(fs.existsSync(path.join(out,l+'.vtt')))have.push(l);
 fs.writeFileSync(path.join(out,'index.json'),JSON.stringify({langs:have.map(l=>({code:l,name:NAMES[l]||l})),source:'script',cues:cues.length},null,1));
 console.log('subs:',out,have.join(','),cues.length,'cues')})().catch(e=>{console.error(e.message);process.exit(1)});
