// 코드 입력 화면과, 타이틀의 들어가는 자리를 찍습니다.
//   node shot-code.js  → shots/code.png · shots/code-title.png
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{const f=path.join(ROOT,q.url==='/'?'index.html':q.url.split('?')[0]);
fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(b);});});
(async()=>{await new Promise(r=>server.listen(9912,r));
const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-gl=swiftshader']});
const pg=await br.newPage({viewport:{width:540,height:960}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:9912/',{waitUntil:'networkidle'});
await pg.evaluate(()=>window.localStorage.setItem('tower-climb-v1',JSON.stringify({sawStory:true,lastJob:'warrior',unlocked:{}})));
await pg.goto('http://localhost:9912/',{waitUntil:'networkidle'});
await pg.waitForFunction(()=>window.__title&&window.__title.ready,null,{timeout:20000});
await pg.waitForTimeout(900);
await pg.screenshot({path:path.join(ROOT,'shots/code-title.png')});
const at=await pg.evaluate(()=>window.__title.codeAt);
await pg.mouse.click(at.x,at.y); await pg.waitForTimeout(700);
// 몇 자리 눌러 둔 모습으로 찍습니다 — 빈 화면보다 쓰임새가 보입니다
await pg.evaluate(()=>{['3','3','0'].forEach(k=>window.__code.press(k));});
await pg.waitForTimeout(300);
await pg.screenshot({path:path.join(ROOT,'shots/code.png')});
console.log(errs.length?'오류 '+errs.join(' / '):'오류 없음');
await br.close();server.close();})();
