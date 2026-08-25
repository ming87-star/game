const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,s)=>{let f=q.url.split('?')[0];if(f==='/')f='/index.html';
 const p=path.join(__dirname,f);if(!fs.existsSync(p))return s.writeHead(404),s.end();
 s.writeHead(200,{'Content-Type':{'.js':'text/javascript','.html':'text/html'}[path.extname(p)]||'text/plain'});
 s.end(fs.readFileSync(p));}).listen(0);
(async()=>{const port=srv.address().port;
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const pg=await b.newPage({viewport:{width:540,height:960}});
 pg.on('pageerror',e=>console.log('!!',e.message));
 await pg.goto('http://localhost:'+port+'/');
 await pg.evaluate(()=>localStorage.setItem('tower-climb-v1',JSON.stringify({sawStory:true,
   unlocked:{archer:1,rogue:1,monk:1,hunter:1,necro:1,wizard:1,digger:1}})));
 await pg.reload({waitUntil:'networkidle'});await pg.waitForTimeout(1200);
 for (const job of ['warrior','monk','rogue']) {
   await pg.evaluate((j)=>window.__game.scene.start('game',{jobKey:j}),job);
   await pg.waitForFunction(()=>window.__scene&&window.__scene.player,null,{timeout:8000});
   await pg.waitForTimeout(400);
   const r=await pg.evaluate(async()=>{
     const s=window.__scene;
     const 층별=[]; let 이번=0; let 마지막=s.floorIndex;
     const 원래공격=s.attack.bind(s);
     s.attack=function(now){ const before=s.swings||0; const out=원래공격(now);
       if((s.swings||0)>before) 이번++; return out; };
     for(let i=0;i<900;i++){
       if(s.dead) break;
       if(s.floorIndex!==마지막){ 층별.push(이번); 이번=0; 마지막=s.floorIndex; }
       // 사거리 안에 적이 있으면 머뭅니다 — 사람이 하는 것과 같습니다.
       const 닿는=s.job.attack==='ranged'? s.weapon.range*0.6 : s.weapon.reach;
       const 있나=s.enemies.getChildren().some(e=>e.active&&
         Phaser.Math.Distance.Between(e.x,e.y,s.player.x,s.player.y)<=닿는);
       if(!있나 && !s.jumping && !s.shop.open && !s.choosing && !s.bossFight) s.jump(0);
       await new Promise(r=>setTimeout(r,70));
     }
     const a=층별.filter(x=>x>0);
     const 합=a.reduce((x,y)=>x+y,0);
     return {오른층:층별.length, 싸운층:a.length, 총타격:합,
       한층평균: a.length? 합/a.length : 0,
       열대이상:a.filter(x=>x>=10).length, 다섯대이상:a.filter(x=>x>=5).length,
       셋이상:a.filter(x=>x>=3).length};
   });
   console.log(job.padEnd(8),
     '오른 층',String(r.오른층).padStart(3),
     '· 싸운 층',String(r.싸운층).padStart(3),
     '· 싸운 층에서 평균',r.한층평균.toFixed(1)+'대',
     '· 3대↑',r.셋이상, '5대↑',r.다섯대이상, '10대↑',r.열대이상);
 }
 await b.close();srv.close();})();
