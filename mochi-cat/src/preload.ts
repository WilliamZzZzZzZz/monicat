// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('mochiCat', {
    window: {
        dragStart: (): Promise<void> => ipcRenderer.invoke('window:drag-start'),
        // Fire-and-forget on every mousemove — no await needed
        dragMove: (): void => ipcRenderer.send('window:drag-move'),
        dragEnd: (): Promise<void> => ipcRenderer.invoke('window:drag-end'),
    },
    menu: {
        openPetMenu: (): Promise<void> => ipcRenderer.invoke('menu:open-pet-menu'),
    },
    pet: {
        onMenuAction: (callback: (action: string) => void): (() => void) => {
            const listener = (_event: IpcRendererEvent, action: string) => callback(action);
            ipcRenderer.on('pet:menu-action', listener);
            return () => ipcRenderer.removeListener('pet:menu-action', listener);
        },
    },
    settings: {
        get: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
        update: (partial: Record<string, unknown>): Promise<unknown> =>
            ipcRenderer.invoke('settings:update', partial),
        reset: (): Promise<unknown> => ipcRenderer.invoke('settings:reset'),
        onChange: (callback: (settings: unknown) => void): (() => void) => {
            const listener = (_event: IpcRendererEvent, settings: unknown) => callback(settings);
            ipcRenderer.on('settings:changed', listener);
            return () => ipcRenderer.removeListener('settings:changed', listener);
        },
    },
});
