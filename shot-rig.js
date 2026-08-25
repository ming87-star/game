// 새 컷 리그가 게임 안에서 어떻게 서는지 봅니다.
//   CHROME_PATH=... node shot-rig.js [warrior|archer|rogue]
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
 const port=9843; await new Promise(r=>server.listen(port,r));
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
 const page=await br.newPage({viewport:{width:540,height:960}});
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
 await page.goto('http://localhost:'+port+'/',{waitUntil:'networkidle'});
 await page.evaluate(j=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({
   bestFloor:0,deaths:0,runs:0,bestCoins:0,medals:0,weapons:{},boosts:{},
   relics:{},unlocked:{archer:true,rogue:true},lastJob:j,sawStory:true})),job);
 await page.reload({waitUntil:'networkidle'});
 await page.waitForTimeout(900);
 // 자리를 손으로 적지 않고 화면에 물어봅니다 — 고르기 화면이 카드에서
 // 격자로 바뀌면서, 적어 둔 좌표는 오류 없이 엉뚱한 데를 눌렀습니다.
 const cell=await page.evaluate((j)=>window.__select.jobAt(j),job);
 await page.mouse.click(cell.x,cell.y); await page.waitForTimeout(300);
 const go=await page.evaluate(()=>window.__select.startAt);
 await page.mouse.click(go.x,go.y); await page.waitForTimeout(500);
 const st=await page.evaluate(()=>window.__medal.startAt);
 await page.mouse.click(st.x,st.y); await page.waitForTimeout(1200);
  // 메달 상점 다음은 무기 도감입니다. 잡혀 있는 자루를 그대로 들고 나갑니다.
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__weaponbook && window.__weaponbook.leave());
  await page.waitForTimeout(900);
 const info=await page.evaluate(()=>{const s=window.__scene;const r=s.rig;
   return {cut:!!(r&&r.cut),key:r&&r.key,scale:r&&r.scale,
     sheets:typeof SHEET_ART==='undefined'?0:Object.keys(SHEET_ART).length,
     tex:s.textures.exists('w-'+s.job.key+'-0')};});
 console.log(JSON.stringify(info));
 await page.screenshot({path:`/tmp/claude-0/-home-user-CRETEC-test/589e2d63-5001-53ca-91ea-464e907f5b5a/scratchpad/rig-${job}.png`});
 console.log(errs.length?'오류: '+errs.slice(0,4).join(' | '):'오류 없음');
 await br.close(); server.close();
})();
