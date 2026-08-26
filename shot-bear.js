// 곰을 판 위에 세워 놓고 **실제 크기로** 찍습니다.
//   CHROME_PATH=... node shot-bear.js
//
// 시트로 갈아탈 때 크기가 어긋나기 쉬운 자리입니다 — 시트는 4배로 그려
// 굽고 그림 한 장은 1배라, 안 줄이면 곰이 발판을 다 덮습니다.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=__dirname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const f=path.join(ROOT,req.url==='/'?'index.html':req.url.split('?')[0]);
  fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(b);});
});
(async()=>{
 const port=9851; await new Promise(r=>server.listen(port,r));
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const page=await br.newPage({viewport:{width:540,height:960}});
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://localhost:'+port+'/',{waitUntil:'networkidle'});
 await page.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({
   bestFloor:0,deaths:0,runs:0,bestCoins:0,medals:0,weapons:{},boosts:{},
   relics:{},unlocked:{archer:true,rogue:true,monk:true,hunter:true,
     necro:true,wizard:true,digger:true},lastJob:'hunter',sawStory:true})));
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:8000});
 await page.evaluate(()=>window.__title.go());
 await page.waitForTimeout(900);
 const cell=await page.evaluate(()=>window.__select.jobAt('hunter'));
 await page.mouse.click(cell.x,cell.y); await page.waitForTimeout(300);
 const go=await page.evaluate(()=>window.__select.startAt);
 await page.mouse.click(go.x,go.y); await page.waitForTimeout(700);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1000);
 await page.evaluate(()=>window.__weaponbook&&window.__weaponbook.leave());
 await page.waitForTimeout(1200);

 const info=await page.evaluate(()=>{
   const s=window.__scene;
   if(!s.bear) return {none:true};
   const b=s.bear.sprite;
   return { sheet:!!s.bear.sheet, key:b.texture.key,
     size:Math.round(b.displayWidth)+'×'+Math.round(b.displayHeight),
     scale:+(b.scaleX.toFixed(3)) };
 });
 console.log(JSON.stringify(info));
 // 걷기 넉 컷과 무는 것 넉 컷을 차례로 세워 봅니다
 for (const [name,frames] of [['걷기',[0,1,2,3]],['무는 것',[4,5,6,7]]]) {
   for (const f of frames) {
     await page.evaluate((f)=>{ const s=window.__scene;
       if(s.bear&&s.bear.sheet) s.bear.sprite.setFrame(f); },f);
     await page.waitForTimeout(120);
     await page.screenshot({path:`shots/bear-${name==='걷기'?'walk':'bite'}-${f}.png`,
       clip:{x:0,y:300,width:540,height:340}});
   }
 }
 console.log(errs.length?'오류: '+errs.slice(0,2).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
