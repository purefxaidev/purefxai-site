// Gemini content pipeline: fetch public AI news (RSS) -> rewrite into original TH/EN articles -> drafts -> publish.
const KEY=()=>process.env.GEMINI_API_KEY||'';const MODEL=process.env.GEMINI_MODEL||'gemini-3.8-flash';
const SOURCES=[
 {id:'google',name:'Google AI Blog',url:'https://blog.google/technology/ai/rss/'},
 {id:'openai',name:'OpenAI News',url:'https://openai.com/news/rss.xml'},
 {id:'hf',name:'Hugging Face Blog',url:'https://huggingface.co/blog/feed.xml'},
 {id:'verge',name:'The Verge AI',url:'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'},
 {id:'deepmind',name:'Google DeepMind',url:'https://deepmind.google/blog/rss.xml'}];
const CATS=['voice','image','video','updates','basics','prompt','automation','vibe','trading'];
const strip=h=>String(h||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&#039;/g,"'").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ').trim();
async function get(url,ms=15000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(url,{signal:ac.signal,headers:{'user-agent':'Mozilla/5.0 PureFxAiBot/1.0'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(t)}}
function parseFeed(x,src){const items=[];const re=/<(item|entry)[\s>][\s\S]*?<\/\1>/g;let m;while((m=re.exec(x))&&items.length<15){const b=m[0],g=t=>{const r=new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`).exec(b);return r?strip(r[1]):''};
 let link=g('link');if(!link){const l=/<link[^>]*href="([^"]+)"/.exec(b);link=l?l[1]:''}items.push({title:g('title'),link,date:g('pubDate')||g('updated')||g('published'),summary:(g('description')||g('summary')||g('content')).slice(0,1500),source:src.name})}return items}
async function fetchFeeds(){const out=[];await Promise.all(SOURCES.map(async s=>{try{out.push(...parseFeed(await get(s.url),s))}catch(e){out.push({error:s.name+': '+e.message})}}));
 return out.filter(i=>!i.error).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)).concat(out.filter(i=>i.error))}
async function gemini(prompt){if(!KEY())throw new Error('not_configured');
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':KEY()},
  body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.6}})});
 const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||('gemini '+r.status));const t=j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';return JSON.parse(t)}
async function rewrite({title,url,text,source,topic}){
 const material=topic&&!url?`TOPIC: ${topic}`:`SOURCE TITLE: ${title||''}\nSOURCE: ${source||''} ${url||''}\nSOURCE TEXT (for facts only, do not copy):\n${String(text||'').slice(0,12000)}`;
 const p=`You are the editor of PureFxAi, a Thai AI-education brand. Write an ORIGINAL short educational article based on the material below.
Rules: summarize and explain in your own words; never copy sentences; do not invent facts, numbers, dates or quotes not present in the material (for a TOPIC, stay general and well-established); no emoji; no hype; no financial advice; neutral, practical tone; add "how to use / why it matters for learners" at the end.
Thai must be natural Thai. Each body 180-350 words, plain text with short paragraphs separated by blank lines (no markdown symbols).
Choose category from: ${CATS.join(', ')} (voice=audio/TTS/music, image=image generation/editing, video=video generation/editing, updates=general AI news, prompt, automation, vibe=AI coding, basics, trading).
Return JSON: {"category":"...","title_th":"...","title_en":"...","body_th":"...","body_en":"...","quality":"ok|weak","reason":"short"}
MATERIAL:
${material}`;
 const o=await gemini(p);if(!CATS.includes(o.category))o.category='updates';return o}
async function fromUrl(url){const html=await get(url,20000);const tt=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);const md=/<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]*)"/i.exec(html);
 const body=/<article[\s\S]*?<\/article>/i.exec(html);return{title:tt?strip(tt[1]):url,text:(md?strip(md[1])+' ':'')+strip(body?body[0]:html).slice(0,15000),url,source:new URL(url).hostname}}
module.exports={SOURCES,fetchFeeds,rewrite,fromUrl,strip};
