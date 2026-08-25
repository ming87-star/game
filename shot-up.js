// 발판 위의 UP(무기) 칸이 실제로 어떻게 보이는지 찍습니다.
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
 const job=process.argv[2]||'warrior';
 const port=9849; await new Promise(r=>server.listen(port,r));
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const page=await br.newPage({viewport:{width:540,height:960}});
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://localhost:'+port+'/',{waitUntil:'networkidle'});
 await page.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({
   bestFloor:0,deaths:0,runs:0,bestCoins:0,medals:0,weapons:{},boosts:{},
   relics:{},unlocked:{archer:true,rogue:true},lastJob:'warrior',sawStory:true})));
 await page.reload({waitUntil:'networkidle'});
 await page.waitForTimeout(900);
 const row={warrior:0,archer:1,rogue:2}[job]||0;
 await page.evaluate((i) => window.__select.go(CLASSES[i].key), row);
 await page.waitForTimeout(500);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1200);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
 // 판에 실제로 놓인 UP 칸을 찾아 카메라를 그리로 옮깁니다.
 const out=await page.evaluate(()=>{
   const s=window.__scene;
   s.enemies.getChildren().slice().forEach(e=>e.destroy());
   let found=null;
   s.floors.forEach((f)=>{
     if(found) return;
     for(const lane of LANES){
       const slot=f.slots[lane];
       if(slot&&slot.kind===SLOT.UPGRADE&&slot.view){found={slot,f,lane};break;}
     }
   });
   if(!found) return ['UP 칸을 못 찾았습니다'];
   s.cameras.main.scrollY=found.slot.view.y-360;
   s.scene.pause();
   const key=weaponIconKey(s.job.key,s.nextTier());
   const src=s.textures.get(key).getSourceImage();
   return [`${found.f.index}층 ${found.lane} · 다음 무기 ${s.job.weapons[s.nextTier()].name}`
     +` (${key} ${src.width}×${src.height})`,
     `화면 자리 ${Math.round(found.slot.view.x)},${Math.round(found.slot.view.y-s.cameras.main.scrollY)}`];
 });
 console.log(out.join('\n'));
 await page.waitForTimeout(400);
 await page.screenshot({path:`/tmp/claude-0/-home-user-CRETEC-test/589e2d63-5001-53ca-91ea-464e907f5b5a/scratchpad/up-${job}.png`,
   clip:{x:0,y:250,width:540,height:260}});
 console.log(errs.length?'오류: '+errs.slice(0,3).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
