// 컷을 실제 속도로 돌려 **동영상으로** 남깁니다. 게임을 안 건드립니다.
//
//   CHROME_PATH=... node shot-motion.js w-warrior-0 w-warrior-5 w-warrior-11
//
// 타이밍은 게임 그대로입니다 — js/motion.js 의 motionMs(rate) = min(rate*0.85, 320).
// 여덟 컷을 그 시간에 나눠 돌리고, 다음 공격까지 남는 시간은 첫 컷으로 쉽니다.
// 그 쉬는 마디가 있어야 "휘두르고 돌아온다"가 보입니다.
const fs=require('fs'), path=require('path'); const { chromium }=require('playwright');
const ROOT=__dirname;
const RATES={}; // classes.js 에서 읽습니다
(function(){
 const src=fs.readFileSync(path.join(ROOT,'js','classes.js'),'utf8');
 ['warrior','archer','rogue'].forEach((job,n)=>{
  const blk=src.split('weapons: [')[n+1];
  [...blk.matchAll(/\{ name: '([^']+)'[\s\S]*?rate: (\d+)/g)].slice(0,12)
   .forEach((m,i)=>{RATES[`w-${job}-${i}`]={label:m[1],rate:+m[2]};});
 });
})();

(async()=>{
 const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
 const keys=args.length?args:['w-warrior-0'];
 const b64=(f)=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
 const cards=keys.map(k=>{
  const dir=path.join(ROOT,'assets','sheets',k);
  if(!fs.existsSync(dir)) return null;
  const frames=[...Array(8)].map((_,i)=>b64(path.join(dir,`${i}.png`)));
  const info=RATES[k]||{label:k,rate:410};
  return {k,frames,label:info.label,rate:info.rate,ms:Math.min(info.rate*0.85,320)};
 }).filter(Boolean);
 if(!cards.length){console.log('시트가 없습니다');return;}

 fs.mkdirSync(path.join(ROOT,'shots','motion'),{recursive:true});
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,
   args:['--no-sandbox','--use-gl=swiftshader']});
 const ctx=await br.newContext({viewport:{width:960,height:420},
   recordVideo:{dir:path.join(ROOT,'shots','motion'),size:{width:960,height:420}}});
 const p=await ctx.newPage();

 const wall=b64(path.join(ROOT,'assets','wall.png'));
 const plat=b64(path.join(ROOT,'assets','plat.png'));
 await p.setContent(`<style>
   html,body{margin:0;background:#141a2e;font-family:sans-serif;color:#8794b5;overflow:hidden}
   .row{display:flex;justify-content:center;gap:24px;padding:14px 10px 0}
   .c{text-align:center}
   .stage{position:relative;width:280px;height:300px;overflow:hidden;
     background-image:url(${wall});background-size:500px 960px;background-position:-110px -300px}
   .big{position:absolute;left:64px;top:36px;width:152px;height:192px;image-rendering:auto}
   .real{position:absolute;left:121px;top:228px;width:38px;height:48px}
   .pf{position:absolute;left:70px;top:276px;width:140px;height:20px}
   .t{font-size:13px;padding:8px 0;color:#cfd8dc}
   </style>
   <div class=row>${cards.map((c,n)=>`
     <div class=c><div class=stage>
       <img class=big id="b${n}" src="${c.frames[0]}">
       <img class=pf src="${plat}">
       <img class=real id="r${n}" src="${c.frames[0]}">
     </div><div class=t>${c.label} · ${c.rate}ms 마다</div></div>`).join('')}</div>
   <script>
   const CARDS=${JSON.stringify(cards.map(c=>({frames:c.frames,ms:c.ms,rate:c.rate})))};
   CARDS.forEach((c,n)=>{
     const big=document.getElementById('b'+n), real=document.getElementById('r'+n);
     const per=c.ms/8;
     let t0=performance.now();
     function tick(now){
       const e=(now-t0)%c.rate;
       const i=e<c.ms?Math.min(7,Math.floor(e/per)):0;   // 남는 시간은 첫 컷으로 쉽니다
       big.src=c.frames[i]; real.src=c.frames[i];
       requestAnimationFrame(tick);
     }
     requestAnimationFrame(tick);
   });
   </script>`);
 await p.waitForTimeout(5200);          // 다섯 판쯤 돌립니다
 await ctx.close();
 await br.close();
 const made=fs.readdirSync(path.join(ROOT,'shots','motion')).filter(f=>f.endsWith('.webm'));
 const latest=made.map(f=>({f,t:fs.statSync(path.join(ROOT,'shots','motion',f)).mtimeMs}))
   .sort((a,b)=>b.t-a.t)[0];
 if(latest){
  const out=path.join(ROOT,'shots','motion','swing.webm');
  fs.renameSync(path.join(ROOT,'shots','motion',latest.f),out);
  console.log('shots/motion/swing.webm  ('+Math.round(fs.statSync(out).size/1024)+'KB)');
 }
 console.log(cards.map(c=>`${c.label} — 8컷 ${Math.round(c.ms)}ms, ${c.rate}ms 주기`).join('\n'));
})();
