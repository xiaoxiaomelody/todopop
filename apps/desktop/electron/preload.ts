import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, Snapshot } from '@todopop/shared';
const api: DesktopApi & { hit(hit: boolean): void; onPop(callback: () => void): () => void } = {
  snapshot: () => ipcRenderer.invoke('state:get'),
  subscribe: (callback) => {
    const listener = (_: unknown, state: Snapshot) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => {
      ipcRenderer.removeListener('state:changed', listener);
    };
  },
  create: (input) => ipcRenderer.invoke('task:create', input),
  update: (id, input) => ipcRenderer.invoke('task:update', id, input),
  act: (id, action) => ipcRenderer.invoke('task:act', id, action),
  open: (id) => ipcRenderer.invoke('task:open', id),
  edit: (id) => ipcRenderer.invoke('task:edit', id),
  pairing: () => ipcRenderer.invoke('pairing:get'),
  onEdit: (callback) => {
    const listener = (_: unknown, id: string) => callback(id);
    ipcRenderer.on('task:edit', listener);
    return () => {
      ipcRenderer.removeListener('task:edit', listener);
    };
  },
  hide: () => ipcRenderer.send('panel:hide'),
  resize: (height) => ipcRenderer.send('panel:resize', height),
  drag: (phase, x, y) => ipcRenderer.send('bubble:drag', phase, x, y),
  hit: (hit) => ipcRenderer.send('bubble:hit', hit),
  onPop: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('bubble:pop', listener);
    return () => {
      ipcRenderer.removeListener('bubble:pop', listener);
    };
  },
};
contextBridge.exposeInMainWorld('todopop', api);
