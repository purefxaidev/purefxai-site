const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports=function render({name,courseTh,courseEn,dateTh,dateEn,id,sample,lang,qrSvg,verifyUrl}){
const seal=`<svg viewBox="0 0 200 200" class="seal"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e3a1"/><stop offset=".5" stop-color="#c9952f"/><stop offset="1" stop-color="#8a5f17"/></linearGradient><path id="cp" d="M100,100 m-66,0 a66,66 0 1,1 132,0 a66,66 0 1,1 -132,0"/></defs>
<g>${Array.from({length:36},(_,i)=>`<polygon points="100,4 106,22 94,22" fill="url(#g)" transform="rotate(${i*10} 100 100)"/>`).join('')}</g>
<circle cx="100" cy="100" r="80" fill="url(#g)"/><circle cx="100" cy="100" r="72" fill="none" stroke="#fff6d6" stroke-width="1.5" opacity=".8"/><circle cx="100" cy="100" r="50" fill="none" stroke="#6b4710" stroke-width="1"/>
<text font-family="Cinzel,serif" font-size="12" letter-spacing="3" fill="#4a300a"><textPath href="#cp">PUREFXAI ACADEMY • CERTIFIED • PUREFXAI ACADEMY • CERTIFIED •</textPath></text>
<text x="100" y="96" text-anchor="middle" font-family="Cinzel,serif" font-weight="700" font-size="22" fill="#4a300a">PFX</text><text x="100" y="118" text-anchor="middle" font-family="Cinzel,serif" font-size="10" letter-spacing="2" fill="#4a300a">EXCELLENCE</text></svg>`;
return `<!DOCTYPE html><html lang="${lang||'th'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate - PureFxAi</title>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cinzel:wght@400;700&family=Kanit:wght@300;400;600&family=Cormorant+Garamond:ital,wght@0,500;1,500&display=swap" rel="stylesheet"><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#0b0d12;font-family:Kanit,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.c{position:relative;width:1123px;max-width:100%;aspect-ratio:297/210;background:#0f1117;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.in{position:relative;height:100%;background:radial-gradient(ellipse at 50% 40%,#fbf6e8,#f1e6c8 75%,#e6d5a8);border:3px solid #b8892c;outline:1px solid #b8892c;outline-offset:-12px;text-align:center;padding:52px 90px 40px;display:flex;flex-direction:column;align-items:center;color:#2a2214;overflow:hidden}
.in:before{content:"";position:absolute;inset:22px;border:1px solid rgba(184,137,44,.55)}
.cor{position:absolute;width:70px;height:70px;border:3px solid #b8892c}.tl{top:30px;left:30px;border-right:0;border-bottom:0}.tr{top:30px;right:30px;border-left:0;border-bottom:0}.bl{bottom:30px;left:30px;border-right:0;border-top:0}.br{bottom:30px;right:30px;border-left:0;border-top:0}
.brand{font-family:Cinzel,serif;letter-spacing:8px;color:#9a6f1e;font-size:15px;font-weight:700}
h1{margin:10px 0 0;font-family:Kanit;font-weight:600;font-size:40px;color:#7a5512}.en{font-family:Cinzel,serif;letter-spacing:6px;font-size:18px;color:#9a6f1e;margin-top:2px}
.rule{width:260px;height:2px;background:linear-gradient(90deg,transparent,#b8892c,transparent);margin:14px auto}
.s{font-size:15px;color:#5c4d33}.s i{font-family:'Cormorant Garamond',serif;font-size:17px}
.n{font-size:46px;font-weight:600;color:#1d1609;margin:6px 0 4px;padding:0 50px 4px;border-bottom:1.5px solid #b8892c}
.co{font-size:26px;font-weight:600;color:#7a5512;margin:6px 0 0}.coe{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:18px;color:#6b5a3a}
.f{position:absolute;left:90px;right:90px;bottom:48px;display:flex;justify-content:space-between;align-items:flex-end}
.col{width:240px;font-size:13px;color:#5c4d33}.col b{display:block;font-size:15px;color:#2a2214;font-weight:600;border-top:1px solid #b8892c;padding-top:6px;margin-bottom:2px}
.sig{font-family:'Great Vibes',cursive;font-size:52px;color:#1b2340;line-height:1;margin-bottom:-4px;transform:rotate(-4deg)}
.qr{position:absolute;top:118px;left:62px;width:96px;text-align:center;font-size:9px;color:#6b5a3a;line-height:1.3}.qr svg{width:84px;height:84px;display:block;margin:0 auto 3px;background:#fffaf0;padding:4px;border:1px solid #b8892c}.seal{width:150px;height:150px;filter:drop-shadow(0 6px 10px rgba(90,60,10,.35))}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-size:120px;font-weight:700;color:rgba(160,30,30,.12);transform:rotate(-18deg);pointer-events:none;letter-spacing:10px}
.tag{position:absolute;top:44px;right:60px;background:#a01e1e;color:#fff;font-size:13px;padding:5px 14px;letter-spacing:2px}
button{position:fixed;top:16px;right:16px;padding:10px 18px;border-radius:20px;border:0;background:#e8b84a;font-family:inherit;cursor:pointer;z-index:9}@media print{button{display:none}body{padding:0;background:none}.c{box-shadow:none;width:297mm;height:210mm}}
</style></head><body><button onclick="print()">บันทึกเป็น PDF / Save as PDF</button>
<div class="c"><div class="in"><span class="cor tl"></span><span class="cor tr"></span><span class="cor bl"></span><span class="cor br"></span>
${sample?'<div class="wm">ตัวอย่าง SAMPLE</div><div class="tag">ตัวอย่าง / SAMPLE</div>':''}
${qrSvg?`<div class="qr">${qrSvg}ตรวจสอบ / Verify</div>`:''}<div class="brand">PUREFXAI ACADEMY</div><h1>ประกาศนียบัตร</h1><div class="en">CERTIFICATE OF COMPLETION</div><div class="rule"></div>
<div class="s">ขอมอบให้ไว้เพื่อแสดงว่า <i>/ This certifies that</i></div><div class="n">${esc(name)}</div>
<div class="s">ได้สำเร็จการเรียนหลักสูตร <i>/ has successfully completed the course</i></div><div class="co">${esc(courseTh)}</div>${courseEn&&courseEn!==courseTh?`<div class="coe">${esc(courseEn)}</div>`:''}
<div class="f"><div class="col"><b>${esc(dateTh)}</b>${esc(dateEn)}<br>วันที่ / Date<div style="margin-top:8px">ID: ${esc(id)}</div></div>${seal}
<div class="col"><div class="sig">PureFxAi</div><b>PureFxAi Academy</b>Instructor / ผู้สอน</div></div></div></div></body></html>`};
