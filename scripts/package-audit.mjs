import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const results=[];
await mkdir('docs/qa-0.4.8',{recursive:true});
for(const version of ['0.4.7','0.4.8']) {
 const dir=await mkdtemp(join(tmpdir(),'todopop-package-audit-'));
 const executablePath=`/private/tmp/todopop-qa0${version.slice(-2).replace('.','')}/TODOPOP.app/Contents/MacOS/TODOPOP`;
 // DMGs are mounted read-only; the app receives a disposable user-data directory.
 const actualPath=version==='0.4.7'?'/private/tmp/todopop-qa047/TODOPOP.app/Contents/MacOS/TODOPOP':'/private/tmp/todopop-qa048/TODOPOP.app/Contents/MacOS/TODOPOP';
 await writeFile(join(dir,'state.json'),JSON.stringify({schemaVersion:2,tasks:[],settings:{tutorialDone:true,interactionVersion:2}}));
 let app;
 try {
  app=await electron.launch({executablePath:actualPath,args:[],env:{...process.env,TODOPOP_DATA_DIR:dir,TODOPOP_TEST_PORT:'17848'}});
  const meta=await app.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,path:process.execPath}));
  assert.equal(meta.version,version);assert.equal(meta.packaged,true);
  const p=await app.firstWindow();await p.waitForSelector('.control-bar');
  await p.getByRole('button',{name:'Blow a bubble',exact:true}).click();
  await p.getByRole('button',{name:'Work',exact:true}).click();
  const selected=await p.getByRole('button',{name:'Work',exact:true}).evaluate(el=>({pressed:el.getAttribute('aria-pressed'),bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color}));
  assert.equal(selected.pressed,'true');assert.equal(selected.fg,'rgb(255, 255, 255)');
  assert.equal(await p.locator('.clear-selection').count(),0);
  await p.screenshot({path:`docs/qa-0.4.8/${version}-selected-group.png`,omitBackground:true});
  await p.getByRole('button',{name:'Edit groups',exact:true}).click();
  assert.equal(await p.locator('.group-side-icon').count(),0);
  await p.getByRole('button',{name:'Change color Work',exact:true}).click();
  assert.equal(await p.locator('.group-color-card .side-buttons').count(),0);
  await p.locator('.group-color-card').screenshot({path:`docs/qa-0.4.8/${version}-group-card.png`,omitBackground:true});
  await p.getByRole('button',{name:version==='0.4.7'?'Open tutorial':'Open shortcuts',exact:true}).click();
  const legacy=await p.getByRole('button',{name:'Try it',exact:true}).count();
  const shortcuts=await p.locator('.shortcut-list > div').count();
  assert.equal(legacy,version==='0.4.7'?1:0);assert.equal(shortcuts,version==='0.4.8'?6:0);
  await p.screenshot({path:`docs/qa-0.4.8/${version}-help.png`,omitBackground:true});
  await p.getByRole('button',{name:'Chrome connection',exact:true}).click();
  if(version==='0.4.8') {
    await p.getByRole('link',{name:'Go to Chrome extension ↗',exact:true}).waitFor();
    await p.waitForFunction(()=>document.querySelector('.pairing-code')?.value?.length===64);
  }
  await p.screenshot({path:`docs/qa-0.4.8/${version}-connection.png`,omitBackground:true});
  results.push({...meta,groupSelected:selected,clearBanner:false,groupDirections:false,legacyTour:Boolean(legacy),shortcutRows:shortcuts,connectionPlaceholder:version==='0.4.8'});
  console.log('PASS actual DMG '+version+' '+JSON.stringify(results.at(-1)));
 }finally {await app?.close();}
}
await writeFile('docs/qa-0.4.8/package-audit.json',JSON.stringify({date:new Date().toISOString(),isolatedData:true,results},null,2)+'\n');
