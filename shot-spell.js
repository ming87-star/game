// 마법 효과를 한 화면에 찍습니다 — 눈으로 견주려는 것입니다.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=__dirname;const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{const f=path.join(ROOT,q.url==='/'?'index.html':q.url.split('?')[0]);
fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(b);});});
(async()=>{await new Promise(r=>server.listen(9851,r));
const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
const pg=await br.newPage({viewport:{width:540,height:960}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:9851/',{waitUntil:'networkidle'});
await pg.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({sawStory:true,unlocked:{wizard:true},lastJob:'wizard'})));
await pg.reload({waitUntil:'networkidle'});
await pg.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:8000});
await pg.evaluate(()=>window.__title.go());
await pg.waitForTimeout(700);
await pg.evaluate(()=>window.__game.scene.start('game',{jobKey:'wizard'}));
await pg.waitForFunction(()=>window.__scene&&window.__scene.player&&!window.__scene.dead,null,{timeout:8000});
await pg.waitForTimeout(900);

// (1) 네 투사체를 크게 펼쳐 봅니다
await pg.evaluate(()=>{const s=window.__scene;
 s.children.list.slice().forEach(o=>o.destroy()); s.boltPool=null;
 s.cameras.main.setBackgroundColor('#0d1120'); s.cameras.main.setScroll(0,0);
 const font=(n,c)=>({fontFamily:'sans-serif',fontSize:n+'px',color:c});
 const 붙박=(o)=>o.setScrollFactor(0);
붙박(s.add.text(270,30,'마법사가 쏘는 것 넷',font(24,'#ffffff')).setOrigin(0.5));
 붙박(s.add.text(270,62,'예전에는 넷 다 깃 달린 화살이었습니다',font(15,'#8794b5')).setOrigin(0.5));
 const 목록=[['arrow','예전 — 화살',0xf48fb1],['cast-orb','구슬 — 아무것도 안 지닌',0xa1887f],
  ['cast-flame','불덩이 — 타는 자루',0xffcc80],['cast-spark','번개탄 — 튀는 자루',0xef9a9a],
  ['cast-shard','서릿조각 — 뚫거나 어는',0xcfd8dc]];
 목록.forEach(([k,이름,색],i)=>{const y=130+i*80;
  붙박(s.add.rectangle(270,y,440,66,0x1b2138).setStrokeStyle(1,0x2f3a5c));
  붙박(s.add.image(120,y,k).setScale(3).setTint(색));
  붙박(s.add.text(180,y-10,이름,font(18,'#ffd54f')));});
});
await pg.waitForTimeout(400);
await pg.screenshot({path:process.env.OUT+'/spell-1-bullets.png'});

// (2) 번개 줄기 — 예전 한 줄 vs 지금 세 겹
await pg.evaluate(()=>{const s=window.__scene;
 s.children.list.slice().forEach(o=>o.destroy()); s.boltPool=null;
 const font=(n,c)=>({fontFamily:'sans-serif',fontSize:n+'px',color:c});
 const 붙박2=(o)=>o.setScrollFactor(0);
붙박2(s.add.text(270,30,'연쇄번개 줄기',font(24,'#ffffff')).setOrigin(0.5));
 붙박2(s.add.text(270,62,'예전: 꺾인 선 하나 · 200ms   /   지금: 겉불+줄기+심 · 120ms',font(14,'#8794b5')).setOrigin(0.5));
 // 예전 방식을 그 자리에서 그려 견줍니다
 붙박2(s.add.text(90,120,'예전',font(16,'#8794b5')));
 const g=s.add.graphics().setDepth(11).setScrollFactor(0); g.lineStyle(3,CFG.chain.tint,0.95);
 const f1={x:120,y:200},t1={x:420,y:260};
 g.beginPath(); g.moveTo(f1.x,f1.y);
 for(let i=1;i<4;i++){const t=i/4;const d=(Math.random()-0.5)*22;
  g.lineTo(f1.x+(t1.x-f1.x)*t,f1.y+(t1.y-f1.y)*t+d);}
 g.lineTo(t1.x,t1.y); g.strokePath();
 붙박2(s.add.text(90,330,'지금',font(16,'#8794b5')));
 s.boltFx({x:120,y:410},{x:420,y:470},0);
 s.boltFx({x:120,y:560},{x:280,y:640},0);
 s.boltFx({x:280,y:640},{x:430,y:580},0);
 붙박2(s.add.text(270,720,'세 갈래가 서로 다르게 꺾이고, 양 끝이 번쩍입니다',font(15,'#8794b5')).setOrigin(0.5));
 // 번개는 판 좌표에 그려지는데 카메라가 멀리 흘러가 있으므로 붙박아야
 // 화면에 들어옵니다. 그리고 **트윈을 멈춥니다** — 120ms 만에 사라지는데
 // 스크린샷이 찍히기까지 그보다 오래 걸려서, 안 멈추면 빈 화면이 나옵니다.
 s.children.list.forEach(o=>{ if(o.type==='Graphics') o.setScrollFactor(0); });
 s.tweens.pauseAll();
});
await pg.waitForTimeout(60);
await pg.screenshot({path:process.env.OUT+'/spell-2-bolt.png'});
// (3) 실제 판 위에서 — 사슬 지팡이로 셋을 상대합니다
await pg.evaluate(()=>window.__game.scene.start('game',{jobKey:'wizard'}));
await pg.waitForFunction(()=>window.__scene&&window.__scene.player&&!window.__scene.dead,null,{timeout:8000});
await pg.waitForTimeout(900);
await pg.evaluate(async()=>{const s=window.__scene;
 s.enemies.getChildren().slice().forEach(e=>e.destroy());
 s.weapon.index=s.weapon.table.findIndex(w=>w.name==='사슬 지팡이');
 s.weapon.plus=0;s.weapon.haste=0;s.weapon.mult=1;s.weapon.relics=[];
 s.weapon.hits=()=>true;
 const f=s.floors.get(s.floorIndex);
 s.player.x=f.slots.mid.x; s.player.y=f.slots.mid.y;
 for(let i=0;i<3;i++){const e=spawnEnemy(s,s.player.x+70+i*40,s.player.y-28,s.floorIndex,'crawler');
  e.maxHp=e.hp=200000;e.hitOnce=true;e.stunUntil=s.time.now+1e9;
  if(e.body)e.body.setAllowGravity(false);}
 s.lastSubAt=-99999;
 s.shoot(s.time.now);
 // 화살이 날아가 닿을 때까지만 기다렸다가 그 순간에 멈춰 세웁니다.
 await new Promise(r=>{const 끝=Date.now()+1200;
  const 보기=()=>((s.enemies.getChildren().some(e=>e.hp<200000)||Date.now()>=끝)?r():setTimeout(보기,8));보기();});
 s.tweens.pauseAll();
});
await pg.screenshot({path:process.env.OUT+'/spell-3-ingame.png'});
// (4) 장판 · 터짐 · 상태 표시
await pg.evaluate(()=>window.__game.scene.start('game',{jobKey:'wizard'}));
await pg.waitForFunction(()=>window.__scene&&window.__scene.player&&!window.__scene.dead,null,{timeout:8000});
await pg.waitForTimeout(900);
await pg.evaluate(async()=>{const s=window.__scene;
 s.enemies.getChildren().slice().forEach(e=>e.destroy());
 s.clearFields();
 s.weapon.index=s.weapon.table.findIndex(w=>w.name==='화염폭풍');
 s.weapon.plus=0;s.weapon.haste=0;s.weapon.mult=1;s.weapon.relics=[];
 const f=s.floors.get(s.floorIndex);
 s.player.x=f.slots.mid.x; s.player.y=f.slots.mid.y;
 const 문잠금=s.shoot.bind(s); s.shoot=()=>{};
 // 장판 둘을 깔고, 그 위에서 터뜨리고, 두 놈에게 불과 얼음을 겁니다.
 s.dropField({x:s.player.x-110,y:s.player.y+4},120);
 s.dropField({x:s.player.x+120,y:s.player.y+4},120);
 const 불놈=spawnEnemy(s,s.player.x-40,s.player.y-26,s.floorIndex,'crawler');
 const 언놈=spawnEnemy(s,s.player.x+50,s.player.y-26,s.floorIndex,'crawler');
 [불놈,언놈].forEach(e=>{e.maxHp=e.hp=200000;e.hitOnce=true;
  e.stunUntil=s.time.now+1e9; if(e.body)e.body.setAllowGravity(false);});
 s.weapon.relics=[relicByKey('hotoil')]; s.applyOil(불놈);
 s.weapon.relics=[relicByKey('coldoil')]; s.applyOil(언놈);
 s.weapon.relics=[];
 s.splash({x:s.player.x,y:s.player.y-20},불놈,90);
 await new Promise(r=>setTimeout(r,90));
 s.tweens.pauseAll();
 s.shoot=문잠금;
});
await pg.screenshot({path:process.env.OUT+'/spell-4-field.png'});
// (5) 상태 표시 — 불과 얼음만 따로
// **판을 새로 켭니다.** 앞 컷에서 트윈을 멈춰 세웠으므로 그 컷의 자국들이
// (제 트윈이 안 끝나 안 지워진 채로) 그대로 남아 있습니다.
await pg.evaluate(()=>window.__game.scene.start('game',{jobKey:'wizard'}));
await pg.waitForFunction(()=>window.__scene&&window.__scene.player&&!window.__scene.dead,null,{timeout:8000});
await pg.waitForTimeout(900);
await pg.evaluate(async()=>{const s=window.__scene;
 s.enemies.getChildren().slice().forEach(e=>e.destroy());
 s.clearFields();
 const 문잠금=s.shoot.bind(s); s.shoot=()=>{};
 const f=s.floors.get(s.floorIndex);
 s.player.x=f.slots.mid.x; s.player.y=f.slots.mid.y;
 const 불놈=spawnEnemy(s,s.player.x-90,s.player.y-26,s.floorIndex,'crawler');
 const 언놈=spawnEnemy(s,s.player.x+90,s.player.y-26,s.floorIndex,'crawler');
 [불놈,언놈].forEach(e=>{e.maxHp=e.hp=200000;e.hitOnce=true;
  e.stunUntil=s.time.now+1e9; if(e.body)e.body.setAllowGravity(false);});
 s.weapon.relics=[relicByKey('hotoil')]; s.applyOil(불놈);
 s.weapon.relics=[relicByKey('coldoil')]; s.applyOil(언놈);
 s.weapon.relics=[];
 await new Promise(r=>setTimeout(r,140));
 s.tweens.pauseAll();
 s.shoot=문잠금;
});
await pg.screenshot({path:process.env.OUT+'/spell-5-status.png'});
console.log(errs.length?'오류:\n'+errs.join('\n'):'오류 없음');
await br.close();server.close();})();
