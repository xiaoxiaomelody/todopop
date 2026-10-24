import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'todopop-audio-'));
await writeFile(join(dir,'state.json'),JSON.stringify({schemaVersion:2,tasks:[{id:'sound',title:'Audio QA',urgency:2,completed:false,position:{x:300,y:220},createdAt:Date.now()}],settings:{tutorialDone:true,interactionVersion:2}}));
let app;const consoleErrors=[];
try {
 app=await electron.launch({executablePath:process.env.TODOPOP_QA_EXECUTABLE||'/private/tmp/todopop-qa048/TODOPOP.app/Contents/MacOS/TODOPOP',args:[],env:{...process.env,TODOPOP_DATA_DIR:dir,TODOPOP_TEST_PORT:'17848'}});
 const p=await app.firstWindow();p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});await p.waitForSelector('.control-bar');
 await p.evaluate(()=>{
  window.__qaAudio=[];window.__qaAudioEvents=0;
  window.todopop.onPopSound(()=>window.__qaAudioEvents++);
  const original=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){
    const entry={src:this.src,volume:this.volume,event:'called'};window.__qaAudio.push(entry);
    const voice=this;voice.addEventListener('playing',()=>{entry.event='playing';entry.time=voice.currentTime;});
    voice.addEventListener('ended',()=>{entry.event='ended';entry.time=voice.currentTime;});
    return original.call(this).catch(e=>{entry.event='failed';entry.error=e.name+': '+e.message;throw e;});
  };
 });
 await p.evaluate(()=>window.todopop.act('sound','complete'));
 await p.waitForTimeout(1800);
 const result=await p.evaluate(()=>({events:window.__qaAudioEvents,audio:window.__qaAudio}));
 result.consoleErrors=consoleErrors;
 result.passed=result.events===1&&result.audio.some(a=>['playing','ended'].includes(a.event));
 await writeFile('docs/qa-0.4.8/audio-acceptance.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
 if(!result.passed)process.exitCode=1;
}finally{await app?.close();}
