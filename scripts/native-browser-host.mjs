import { chromium } from 'playwright';
import readline from 'node:readline';
const browser=await chromium.launch({headless:false});
const page=await browser.newPage();await page.goto('about:blank');
console.log('HOST_READY '+JSON.stringify({path:chromium.executablePath()}));
const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:false});
for await(const line of rl){if(line.trim()==='quit')break;}
await browser.close();
