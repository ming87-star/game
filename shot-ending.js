// 33층 시퀀스를 눌러 보고 컷을 찍습니다.
//   CHROME_PATH=... OUT=... node shot-ending.js
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=__dirname;const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{const f=path.join(ROOT,q.url==='/'?'index.html':q.url.split('?')[0]);
fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(b);});});
const OUT=process.env.OUT||ROOT;
(async()=>{await new Promise(r=>server.listen(9861,r));
const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
const pg=await br.newPage({viewport:{width:540,height:960}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:9861/',{waitUntil:'networkidle'});

// 마흔여덟 개 중 마흔일곱 개를 사 둔 저장을 만듭니다 — 마지막 하나를
// 눌러서 여는 순간을 실제로 겪습니다.
await pg.evaluate(()=>{
  const perks={};
  window.localStorage.setItem('tower-climb-v1',JSON.stringify({
    sawStory:true, medals:99, endingStage:0,
    unlocked:{archer:true,rogue:true,monk:true,necro:true,digger:true,wizard:true,hunter:true},
    perks, lastJob:'warrior'}));
});
await pg.reload({waitUntil:'networkidle'});
await pg.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:8000});
// 저장을 코드로 채웁니다 (직업표를 읽어야 하므로 판이 뜬 뒤에).
const 채움=await pg.evaluate(()=>{
  let n=0, 마지막=null;
  CLASSES.forEach(j=>{ medalItemsFor(j).forEach(it=>{ n++; 마지막={job:j.key,key:it.key}; }); });
  CLASSES.forEach(j=>{ medalItemsFor(j).forEach(it=>{
    if(j.key===마지막.job && it.key===마지막.key) return;   // 하나만 남깁니다
    window.__save.addPerk(j.key,it.key); }); });
  return {전부:n, 남긴것:마지막, 다샀나:boughtAll()};
});
console.log('저장 채움', JSON.stringify(채움));

// 그 하나를 실제로 삽니다.
const 열림=await pg.evaluate(async(마지막)=>{
  // **장면 플러그인으로 넘깁니다.** game.scene.start() 는 지금 도는 장면을
  // 안 끄고 새로 하나 더 띄웁니다 — 타이틀이 밑에 깔린 채로 돌아서 컷이
  // 어긋났습니다. 장면 안에서 부르는 this.scene.start() 라야 앞을 끕니다.
  window.__title.scene.start('medal',{jobKey:마지막.job});
  await new Promise(r=>setTimeout(r,700));
  const s=window.__medal;
  const item=s.items.find(i=>i.key===마지막.key);
  s.buy(item);
  await new Promise(r=>setTimeout(r,600));
  return {다샀나:boughtAll(), 단계:window.__save.endingStage,
    지금장면:window.__game.scene.getScenes(true).map(x=>x.scene.key)};
},채움.남긴것);
console.log('마지막 하나를 삼', JSON.stringify(열림));
await pg.waitForTimeout(600);
await pg.screenshot({path:path.join(OUT,'ending-1-line.png')});

// 대사가 다 뜰 때까지 기다렸다가 넘깁니다.
await pg.waitForFunction(()=>window.__endingline&&window.__endingline.ready(),null,{timeout:15000});
await pg.screenshot({path:path.join(OUT,'ending-2-line-full.png')});
await pg.evaluate(()=>window.__endingline.go());
await pg.waitForFunction(()=>window.__endingwatch,null,{timeout:10000});

// 보는 장면의 마디마다 찍습니다.
const 찍기=async(단계,이름)=>{
  // **인자는 두 번째 자리입니다.** 처음에 옵션 뒤에 붙였더니 단계가 통째로
  // 무시되고 n 이 null 로 들어가, `step >= null` 이 `0 >= 0` 이라 **모든
  // 기다림이 그냥 통과**했습니다. 그래서 컷이 전부 첫 프레임이었습니다.
  await pg.waitForFunction((n)=>window.__endingwatch&&window.__endingwatch.step>=n,단계,{timeout:60000});
  await pg.screenshot({path:path.join(OUT,'ending-'+이름+'.png')});
};
await 찍기(2,'3-blow');
await 찍기(4,'4-rise');
await 찍기(5,'5-pass');
await 찍기(7,'6-above');
await 찍기(9,'7-cloak');
console.log('마지막 단계', await pg.evaluate(()=>window.__endingwatch.step));

// ── 8~11번 — 마지막 판과 크레딧 ───────────────────────
// 보는 장면이 끝나면 타이틀로 돌아옵니다. 거기서부터 평소 흐름 그대로
// 판을 시작해서, 바닥의 겉옷을 짚습니다.
await pg.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:30000});
const 단계=await pg.evaluate(()=>window.__save.endingStage);
console.log('보는 장면 뒤 단계', 단계);

await pg.evaluate(()=>{window.__title.scene.start('game',{jobKey:'warrior'});});
await pg.waitForFunction(()=>window.__scene&&window.__scene.player&&!window.__scene.dead,null,{timeout:15000});
await pg.waitForTimeout(900);
const 겉옷=await pg.evaluate(()=>{const s=window.__scene;
  return {있나:!!s.finalCloak, x:s.finalCloak?Math.round(s.finalCloak.x):null,
    나x:Math.round(s.player.x)};});
console.log('판 바닥의 겉옷', JSON.stringify(겉옷));
await pg.screenshot({path:path.join(OUT,'ending-8-run.png')});

// 짚습니다 — 주인공을 겉옷 자리로 옮기면 update 가 알아봅니다.
await pg.evaluate(()=>{const s=window.__scene;
  s.player.x=s.finalCloak.x; s.player.y=s.finalCloak.y;});
await pg.waitForFunction(()=>window.__credits,null,{timeout:20000});
await pg.waitForFunction(()=>window.__credits.shown,null,{timeout:20000});
await pg.waitForTimeout(1800);
await pg.screenshot({path:path.join(OUT,'ending-9-credits.png')});
console.log('끝난 뒤 단계', await pg.evaluate(()=>window.__save.endingStage));

// 엔딩 뒤에는 다시 못 합니다 — 타이틀에서 눌러도 크레딧으로 돌아옵니다.
const 닫힘=await pg.evaluate(async()=>{
  window.__credits.scene.start('title');
  await new Promise(r=>setTimeout(r,900));
  window.__title.go();
  await new Promise(r=>setTimeout(r,700));
  return window.__game.scene.getScenes(true).map(x=>x.scene.key).join(',');
});
console.log('타이틀에서 시작하면', 닫힘);
console.log(errs.length?'오류:\n'+errs.join('\n'):'오류 없음');
await br.close();server.close();})();
