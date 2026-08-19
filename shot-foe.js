// 판을 바꾸는 넷을 **처음 만날 때 뜨는 창** 그대로 한 장씩 찍습니다.
//   CHROME_PATH=... node shot-foe.js
//
// 이 창(js/scene-foe.js)은 그림을 96px 상자에 맞춰 키워 보여 줍니다 — 판에서
// 도는 40px보다 두 배 넘게 큽니다. **여기서 뭉개지면 안내가 헛돕니다.**
// 나란히 세워 보는 shot-mon.js 로는 이 크기가 안 보여서 따로 둡니다.
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
 const port=9847; await new Promise(r=>server.listen(port,r));
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const page=await br.newPage({viewport:{width:540,height:960}});
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://localhost:'+port+'/',{waitUntil:'networkidle'});
 await page.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({
   bestFloor:0,deaths:0,runs:0,bestCoins:0,medals:0,weapons:{},boosts:{},
   relics:{},unlocked:{archer:true,rogue:true},lastJob:'warrior',sawStory:true})));
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:8000});
 await page.evaluate(()=>window.__title.go());
 await page.waitForTimeout(900);
 await page.mouse.click(270,278); await page.waitForTimeout(500);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1200);
 await page.waitForTimeout(700);
 await page.evaluate(()=>window.__weaponbook&&window.__weaponbook.leave());
 await page.waitForTimeout(900);

 // 넷을 차례로 띄웁니다. 창은 판 위에 얹히는 것이라 판을 멈춰 두고 씁니다.
 const names=[];
 for (const key of ['shover','slammer','lancer','zapper']) {
   const name=await page.evaluate((key)=>{
     const s=window.__scene;
     if (s.scene.isActive('foe')) s.scene.stop('foe');
     const def=CFG.enemyTypes.find(t=>t.key===key);
     const tell=CFG.foes.tell[key];
     s.scene.launch('foe',{from:s,def,tell});
     return tell.name;
   },key);
   names.push(name);
   await page.waitForTimeout(700);
   await page.screenshot({path:'shots/foe-'+key+'.png'});
 }
 console.log(names.join(' · '));
 console.log(errs.length?'오류: '+errs.slice(0,3).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
