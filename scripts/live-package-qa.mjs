import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';
const dir=await mkdtemp(join(tmpdir(),'todopop-native-qa-'));
await mkdir('docs/qa-0.4.8',{recursive:true});
await writeFile(join(dir,'state.json'),JSON.stringify({schemaVersion:2,tasks:[{id:'qa-local',title:'QA local reminder',groupId:'School',urgency:3,completed:false,createdAt:Date.now()},{id:'qa-link',title:'QA linked task',groupId:'Work',urgency:2,url:'https://example.com/todopop-qa',completed:false,createdAt:Date.now()}],settings:{tutorialDone:true,interactionVersion:2}}));
const app=await electron.launch({executablePath:'/private/tmp/todopop-qa048/TODOPOP.app/Contents/MacOS/TODOPOP',args:[],env:{...process.env,TODOPOP_DATA_DIR:dir,TODOPOP_TEST_PORT:'17848'},timeout:20000});
const p=await app.firstWindow();await p.waitForSelector('.control-bar');
await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('#'));w.setTitle('TODOPOP QA · 0.4.8');globalThis.__qaMedia=[];w.webContents.on('media-started-playing',()=>globalThis.__qaMedia.push({event:'started',at:Date.now()}));w.webContents.on('audio-state-changed',(e)=>globalThis.__qaMedia.push({event:'audio',audible:e.audible,at:Date.now()}));});
console.log('READY '+JSON.stringify({version:await app.evaluate(({app})=>app.getVersion()),path:await app.evaluate(()=>process.execPath),isolatedData:dir}));
const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:false});
try{
 for await(const line of rl){
  try{
   const cmd=JSON.parse(line);let value;
   if(cmd.op==='quit'){break;}
   else if(cmd.op==='meta')value=await app.evaluate(({app,BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('#'));return {version:app.getVersion(),path:process.execPath,appHidden:app.isHidden(),dock:{visible:w.isVisible(),allSpaces:w.isVisibleOnAllWorkspaces(),onTop:w.isAlwaysOnTop(),focused:w.isFocused(),bounds:w.getBounds()},preferences:w.webContents.getLastWebPreferences().autoplayPolicy,media:globalThis.__qaMedia};});
   else if(cmd.op==='audio')value=await p.evaluate(async()=>{
     const sources=performance.getEntriesByType('resource').filter(e=>e.name.includes('.mp3')).map(e=>e.name);
     const url=sources[0]||new URL('./assets/bubble-pop-BOycs8V_.mp3',location.href).href;
     const a=new Audio(url); a.volume=.2;
     try { await a.play(); return {ok:true,url,sources,ready:a.readyState}; }
     catch(e){return {ok:false,error:e.name,message:e.message,code:a.error?.code,detail:a.error?.message,url,sources};}
   });
   else if(cmd.op==='snap')value=await p.evaluate(()=>window.todopop.snapshot());
   else if(cmd.op==='capture'){await p.screenshot({path:'docs/qa-0.4.8/'+cmd.name+'.png',omitBackground:true});value='saved';}
   else if(cmd.op==='click') {await p.getByRole('button',{name:cmd.name,exact:true}).click();value='clicked';}
   else if(cmd.op==='pop') {const b=app.windows().find(w=>w.url().includes('#bubble='+cmd.id));await b.locator('.organic-hit').click({delay:1000});value=await p.evaluate(()=>window.todopop.snapshot());}
   else if(cmd.op==='focus') {await p.evaluate(id=>window.todopop.open(id),cmd.id);value='focused';}
   else if(cmd.op==='exit') {await p.evaluate(()=>window.todopop.exitFocus());value='returned';}
   else if(cmd.op==='enter-fullscreen'){await app.browserWindow(p).then(w=>w.evaluate(w=>w.setFullScreen(true)));value='fullscreen';}
   else throw new Error('Unknown operation');
   if(cmd.op==='meta') value.dom = await p.evaluate(()=>({visibility:document.visibilityState,focused:document.hasFocus()}));
   console.log('RESULT '+JSON.stringify({op:cmd.op,value}));
  }catch(e){console.log('ERROR '+JSON.stringify({message:String(e),stack:e.stack}));}
 }
}finally {await app.close();}
