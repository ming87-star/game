// 아이템을 게임 안 발판 위에 **실제 크기 그대로** 늘어놓고 찍습니다.
// 진짜와 가짜를 위아래로 붙여 둡니다 — 다가가기 전과 뒤가 짝이어야 합니다.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=__dirname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const f=path.join(ROOT,req.url==='/'?'index.html':req.url.split('?')[0]);
  fs.readFile(f,(e,b)=>{ if(e){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(b);});
});
const PAIRS=[
  ['item-plus','item-fake-plus','UP'],
  ['item-haste','item-fake-haste','속도'],
  ['item-armor-warrior','item-fake-armor','방어(전사)'],
  ['item-armor-archer','item-fake-armor-archer','방어(궁수)'],
  ['item-dodge','item-fake-dodge','회피'],
  ['item-heal','item-fake-heal','회복'],
  ['item-treasure','item-fake-treasure','보물'],
];
const SOLO=[['item-double','두 배'],['item-medal','메달'],['item-relic','유물'],
            ['item-bomb','폭탄'],['item-plus-anvil','모루'],['item-plus-hammer','망치']];
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
 await page.waitForTimeout(900);
 await page.mouse.click(270,278); await page.waitForTimeout(500);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1200);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
 await page.evaluate(({pairs,solo})=>{
   const s=window.__scene;
   s.enemies.getChildren().slice().forEach(e=>e.destroy());
   s.children.list.slice().filter(o=>o.depth>=11&&o.depth<=120).forEach(o=>o.destroy());
   s.scene.pause();
   if(s.rig&&s.rig.view) s.rig.view.setVisible(false);
   s.player.setVisible(false);
   const cam=s.cameras.main, x0=cam.scrollX+50, y0=cam.scrollY+300;
   const font={fontFamily:'sans-serif',fontSize:'11px',color:'#8794b5'};
   pairs.forEach(([real,fake,name],i)=>{
     const x=x0+i*70;
     s.add.image(x,y0,real).setDepth(500);
     s.add.image(x,y0+46,fake).setDepth(500);
     s.add.text(x,y0+72,name,font).setOrigin(0.5).setDepth(501);
   });
   solo.forEach(([k,name],i)=>{
     const x=x0+i*70;
     s.add.image(x,y0+120,k).setDepth(500);
     s.add.text(x,y0+146,name,font).setOrigin(0.5).setDepth(501);
   });
   s.add.text(x0-34,y0-30,'위 진짜 · 아래 가짜',
     {fontFamily:'sans-serif',fontSize:'12px',color:'#cfd8dc'}).setDepth(501);
 },{pairs:PAIRS,solo:SOLO});
 await page.waitForTimeout(400);
 await page.screenshot({path:'/tmp/claude-0/-home-user-CRETEC-test/589e2d63-5001-53ca-91ea-464e907f5b5a/scratchpad/items-ingame.png',
   clip:{x:0,y:255,width:540,height:225}});
 console.log(errs.length?'오류: '+errs.slice(0,3).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
