// Open a link in a NEW WINDOW of the person's default browser (not a tab in an existing one),
// filling the screen. On a Mac, Chrome, Edge, Brave, Vivaldi and Safari are sized to the whole
// screen through AppleScript; elsewhere the browser chooses the new window's size.
// Chrome, Edge, Brave, Vivaldi, Opera, Chromium, Firefox and Safari are recognised; anything else
// (or if detection fails) falls back to the browser's normal behaviour.
const { shell } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const run = (cmd, args) => new Promise(res => execFile(cmd, args, { timeout: 4000, windowsHide: true }, (err, out) => res(err ? '' : String(out))));
const launch = (cmd, args) => new Promise(res => {
  try { const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }); p.on('error', () => res(false)); p.unref(); setTimeout(() => res(true), 300); }
  catch (e) { res(false); }
});

// browser id → how to ask it for a new window
const KINDS = [
  { re: /chrome|chromium|edge|brave|vivaldi|opera/i, flag: '--new-window' },
  { re: /firefox|librewolf|waterfox/i, flag: '-new-window' },
];
const kindOf = (id) => KINDS.find(k => k.re.test(id));

let cached; // detect once per run
async function defaultBrowser() {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    if (process.platform === 'darwin') {
      const plist = path.join(os.homedir(), 'Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist');
      if (fs.existsSync(plist)) {
        const json = await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plist]);
        const h = (JSON.parse(json || '{}').LSHandlers || []).find(x => x.LSHandlerURLScheme === 'https' || x.LSHandlerURLScheme === 'http');
        const id = h && (h.LSHandlerRoleAll || h.LSHandlerRoleViewer);
        cached = { id: id || 'com.apple.safari' };
      } else cached = { id: 'com.apple.safari' };
    } else if (process.platform === 'win32') {
      const q = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId']);
      const prog = (q.match(/ProgId\s+REG_SZ\s+(\S+)/) || [])[1];
      if (prog) {
        const c = await run('reg', ['query', `HKCR\\${prog}\\shell\\open\\command`, '/ve']);
        const exe = (c.match(/"([^"]+\.exe)"/i) || c.match(/REG_SZ\s+(\S+\.exe)/i) || [])[1];
        cached = { id: prog + ' ' + (exe || ''), exe };
      }
    } else {
      const d = (await run('xdg-settings', ['get', 'default-web-browser'])).trim(); // e.g. google-chrome.desktop
      if (d) cached = { id: d, exe: d.replace(/\.desktop$/, '') };
    }
  } catch (e) { cached = null; }
  return cached;
}

// Chromium browsers on a Mac share Chrome's AppleScript dictionary
const MAC_SCRIPTABLE = /^(com\.google\.chrome(\.beta|\.canary)?|com\.microsoft\.edgemac|com\.brave\.browser|com\.vivaldi\.vivaldi)$/i;
// waits for the script, so if macOS says no (Automation permission), we fall back to a plain open
const osa = (script) => new Promise(res => execFile('/usr/bin/osascript', ['-e', script], { timeout: 8000 }, (err) => res(!err)));
const asStr = (v) => JSON.stringify(String(v)); // AppleScript strings use the same escaping as JSON for our purposes

async function openInNewWindow(url, area) {
  const a = area || { x: 0, y: 0, width: 1440, height: 900 };
  const bounds = `{${a.x}, ${a.y}, ${a.x + a.width}, ${a.y + a.height}}`;
  if (!/^(https?|file):/i.test(url)) return shell.openExternal(url);
  const b = await defaultBrowser();
  let ok = false;
  if (b) {
    const k = kindOf(b.id);
    if (process.platform === 'darwin') {
      if (/safari/i.test(b.id)) {
        ok = await osa(`tell application "Safari"\nmake new document with properties {URL:${asStr(url)}}\nset bounds of front window to ${bounds}\nactivate\nend tell`);
      } else if (MAC_SCRIPTABLE.test(b.id)) {
        ok = await osa(`tell application id ${asStr(b.id)}\nset w to make new window\nset URL of active tab of w to ${asStr(url)}\nset bounds of w to ${bounds}\nactivate\nend tell`);
      } else if (k) ok = await launch('/usr/bin/open', ['-n', '-b', b.id, '--args', k.flag, url]);
    } else if (k && b.exe) {
      ok = await launch(b.exe, [k.flag, ...(/firefox|wolf/i.test(b.id) ? [] : ['--start-maximized']), url]);
    }
  }
  if (!ok) shell.openExternal(url);
}

module.exports = { openInNewWindow };
// TODOPOP: touched 2026-11-08
