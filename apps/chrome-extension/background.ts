import { connect, reconnect, sendContext } from './connection';
let revision = 0;
async function report() {
  const current = ++revision;
  try {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal', 'popup'] });
    const tabs =
      win.id === undefined ? [] : await chrome.tabs.query({ active: true, windowId: win.id });
    if (current !== revision) return;
    const candidate = tabs[0]?.pendingUrl || tabs[0]?.url || null;
    const url = candidate && /^https?:\/\//.test(candidate) ? candidate : null;
    sendContext({
      type: 'CONTEXT_CHANGED',
      browser: 'chrome',
      isFocused: Boolean(win.focused),
      url,
    });
  } catch {
    if (current === revision)
      sendContext({ type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused: false, url: null });
  }
}
function refresh() {
  void connect(report);
  void report();
}
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (tab.active && (change.url || change.status)) refresh();
});
chrome.tabs.onRemoved.addListener(refresh);
chrome.tabs.onReplaced.addListener(refresh);
chrome.windows.onRemoved.addListener(refresh);
chrome.windows.onFocusChanged.addListener((id) => {
  revision++;
  if (id === chrome.windows.WINDOW_ID_NONE)
    sendContext({ type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused: false, url: null });
  else refresh();
});
chrome.runtime.onStartup.addListener(refresh);
chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
  refresh();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'reconnect') refresh();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.token) reconnect(report);
});
void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
void chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
refresh();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || message.type !== 'RECONNECT') return;
  reconnect(report);
  respond({ ok: true });
});
