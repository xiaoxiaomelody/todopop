export {};
const status = document.querySelector<HTMLDivElement>('#status')!;
const input = document.querySelector<HTMLInputElement>('#token')!;
async function render() {
  const data = await chrome.storage.local.get(['status', 'token']);
  status.textContent = typeof data.status === 'string' ? data.status : 'Pair with the desktop app';
}
document.querySelector<HTMLFormElement>('#pair')!.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = input.value.trim();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    status.textContent = 'Paste the full pairing code.';
    return;
  }
  await chrome.storage.local.set({ token });
  input.value = '';
  status.textContent = 'Connecting…';
});
document.querySelector('#disconnect')!.addEventListener('click', async () => {
  await chrome.storage.local.remove('token');
  await render();
});
chrome.storage.onChanged.addListener(() => {
  void render();
});
void render();
