// 보스 다섯과 그놈들의 탄을 게임 안에 **실제 크기 그대로** 세워 찍습니다.
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
 const port=9848; await new Promise(r=>server.listen(port,r));
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const page=await br.newPage({viewport:{width:540,height:960}});
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://localhost:'+port+'/',{waitUntil:'networkidle'});
 await page.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({
   bestFloor:0,deaths:0,runs:0,bestCoins:0,medals:0,weapons:{},boosts:{},
   relics:{},unlocked:{archer:true,rogue:true},lastJob:'warrior',sawStory:true})));
 await page.reload({waitUntil:'networkidle'});
 await page.waitForTimeout(900);
 await page.mouse.click(270,278); await page.waitForTimeout(500);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1200);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
 const out=await page.evaluate(()=>{
   const s=window.__scene;
   s.enemies.getChildren().slice().forEach(e=>e.destroy());
   s.children.list.slice().filter(o=>o.depth>=11&&o.depth<=120).forEach(o=>o.destroy());
   s.scene.pause();
   if(s.rig&&s.rig.view) s.rig.view.setVisible(false);
   s.player.setVisible(false);
   const cam=s.cameras.main;
   const kinds=(typeof BOSS_KINDS!=='undefined'&&BOSS_KINDS)||null;
   const list=[['boss-warden','boss-shot','탑의 수문장'],['boss-gazer','boss-shot-gazer','외눈의 감시자'],
     ['boss-crusher','boss-shot-crusher','불집게'],['boss-brood','boss-shot-brood','알주머니'],
     ['boss-phantom','boss-shot-phantom','갈라진 가면']];
   const info=[];
   list.forEach(([k,shot,name],i)=>{
     const y=cam.scrollY+120+i*168;
     const b=s.add.image(cam.scrollX+200,y,k).setDepth(500);
     s.add.image(cam.scrollX+430,y,shot).setDepth(500);
     s.add.text(cam.scrollX+352,y+34,name,
       {fontFamily:'sans-serif',fontSize:'14px',color:'#cfd8dc'}).setOrigin(0.5).setDepth(501);
     info.push(`${k} ${Math.round(b.displayWidth)}×${Math.round(b.displayHeight)}`);
   });
   return info;
 });
 console.log(out.join(' · '));
 await page.waitForTimeout(400);
 await page.screenshot({path:'/tmp/claude-0/-home-user-CRETEC-test/589e2d63-5001-53ca-91ea-464e907f5b5a/scratchpad/boss-ingame.png',
   clip:{x:0,y:20,width:540,height:880}});
 console.log(errs.length?'오류: '+errs.slice(0,3).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
