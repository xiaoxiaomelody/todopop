import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, Snapshot } from '@todopop/shared';
const api: DesktopApi & {
  show(): void;
  closeEdit(): void;
  resizeEdit(height: number): void;
  hit(hit: boolean): void;
  onPop(callback: () => void): () => void;
  onPopSound(callback: () => void): () => void;
} = {
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
  exitFocus: () => ipcRenderer.invoke('focus:exit'),
  selectGroup: (id) => ipcRenderer.invoke('groups:select', id),
  dragGroup: (phase, x, y, groupId) => ipcRenderer.send('groups:drag', phase, x, y, groupId),
  pairing: () => ipcRenderer.invoke('pairing:get'),
  onEdit: (callback) => {
    const listener = (_: unknown, id: string) => callback(id);
    ipcRenderer.on('task:edit', listener);
    return () => {
      ipcRenderer.removeListener('task:edit', listener);
    };
  },
  setSettings: (input) => ipcRenderer.invoke('settings:set', input),
  growthMode: (mode) => ipcRenderer.invoke('growth:mode', mode),
  groups: (action, input) => ipcRenderer.invoke('groups:change', action, input),
  arrange: (side) => ipcRenderer.invoke('layout:arrange', side),
  reorder: (ids) => ipcRenderer.invoke('tasks:reorder', ids),
  undo: (id) => ipcRenderer.invoke('task:undo', id),
  closeEdit: () => ipcRenderer.send('edit:close'),
  resizeEdit: (height) => ipcRenderer.send('edit:resize', height),
  show: () => ipcRenderer.send('panel:show'),
  hide: () => ipcRenderer.send('panel:hide'),
  resize: (height, width) => ipcRenderer.send('panel:resize', height, width),
  dragPanel: (phase, x, y) => ipcRenderer.send('panel:drag', phase, x, y),
  drag: (phase, x, y) => ipcRenderer.send('bubble:drag', phase, x, y),
  contour: (size, points) => ipcRenderer.send('bubble:contour', size, points),
  hit: (hit) => ipcRenderer.send('bubble:hit', hit),
  onPopSound: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('audio:pop', listener);
    return () => ipcRenderer.removeListener('audio:pop', listener);
  },
  onPop: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('bubble:pop', listener);
    return () => {
      ipcRenderer.removeListener('bubble:pop', listener);
    };
  },
};
contextBridge.exposeInMainWorld('todopop', api);
