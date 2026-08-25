// 적을 게임 안에 세워 놓고 **실제 크기 그대로** 나란히 찍습니다.
//   CHROME_PATH=... node shot-mon.js
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
 const port=9846; await new Promise(r=>server.listen(port,r));
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const page=await br.newPage({viewport:{width:540,height:960}});
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://localhost:'+port+'/',{waitUntil:'networkidle'});
 await page.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({
   bestFloor:0,deaths:0,runs:0,bestCoins:0,medals:0,weapons:{},boosts:{},
   relics:{},unlocked:{archer:true,rogue:true},lastJob:'warrior',sawStory:true})));
 await page.reload({waitUntil:'networkidle'});
 // 켜면 타이틀 화면이 먼저 섭니다 (js/scene-title.js). 사람처럼 한 번 지납니다 —
 // 안 지나면 아래가 전부 타이틀 화면 위에서 헛돕니다.
 await page.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:8000});
 await page.evaluate(()=>window.__title.go());
 await page.waitForTimeout(900);
 await page.evaluate(() => window.__select.go('warrior'));  // 좌표 대신 화면에 시킵니다
 await page.waitForTimeout(500);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1200);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);

 const info=await page.evaluate(()=>{
   const s=window.__scene;
   s.enemies.getChildren().slice().forEach(e=>e.destroy());
   s.children.list.slice().filter(o=>o.depth>=11&&o.depth<=120).forEach(o=>o.destroy());
   s.scene.pause();
   if (s.rig&&s.rig.view) s.rig.view.setVisible(false);
   s.player.setVisible(false);
   const cam=s.cameras.main;
   // 적 표의 열셋 + 황금개구리 + 박쥐 둘을 두 줄로 세웁니다.
   const seen=new Set();
   const keys=CFG.enemyTypes.filter(t=>!seen.has(t.key)&&seen.add(t.key))
     .map(t=>['e-'+t.key,t.scale,t.name])
     .concat([['e-goldfrog',1,'황금개구리'],['bat-thief',1,'좀도둑'],['bat-biter',1,'무는 박쥐']]);
   const x0=cam.scrollX+46, y0=cam.scrollY+300;
   const out=[];
   keys.forEach(([k,sc,name],i)=>{
     const col=i%6, row=(i/6)|0;
     const sp=s.add.image(x0+col*76, y0+row*86, k).setDepth(500).setScale(sc);
     s.add.text(x0+col*76, y0+row*86+34, name,
       {fontFamily:'sans-serif',fontSize:'12px',color:'#8794b5'}).setOrigin(0.5).setDepth(501);
     out.push(k+' '+Math.round(sp.displayWidth)+'×'+Math.round(sp.displayHeight));
   });
   return out;
 });
 console.log(info.join(' · '));
 await page.waitForTimeout(400);
 await page.screenshot({path:'shots/mon-ingame.png',
   clip:{x:0,y:250,width:540,height:330}});
 console.log(errs.length?'오류: '+errs.slice(0,3).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
