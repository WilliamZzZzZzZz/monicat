// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ExternalWindowBounds, SpriteRectInWindow, WindowBounds } from './types/ipc';

contextBridge.exposeInMainWorld('mochiCat', {
    window: {
        dragStart: (mouseScreenX: number, mouseScreenY: number, spriteRect: SpriteRectInWindow): Promise<void> =>
            ipcRenderer.invoke('window:drag-start', mouseScreenX, mouseScreenY, spriteRect),
        // Fire-and-forget on every mousemove — no await needed
        dragMove: (mouseScreenX: number, mouseScreenY: number): void =>
            ipcRenderer.send('window:drag-move', mouseScreenX, mouseScreenY),
        dragEnd: (): Promise<void> => ipcRenderer.invoke('window:drag-end'),
        onVisibilityChanged: (callback: (visible: boolean) => void): (() => void) => {
            const listener = (_event: IpcRendererEvent, visible: boolean) => callback(visible);
            ipcRenderer.on('window:visibility-changed', listener);
            return () => ipcRenderer.removeListener('window:visibility-changed', listener);
        },
        getPosition: (): Promise<[number, number]> => ipcRenderer.invoke('window:get-position'),
        getBounds: (): Promise<WindowBounds> => ipcRenderer.invoke('window:get-bounds'),
        setPosition: (x: number, y: number): Promise<void> => ipcRenderer.invoke('window:set-position', x, y),
        getWorkArea: (): Promise<{ x: number; y: number; width: number; height: number }> =>
            ipcRenderer.invoke('window:get-work-area'),
        getDisplayBounds: (): Promise<WindowBounds> => ipcRenderer.invoke('window:get-display-bounds'),
    },
    externalWindows: {
        getVisibleWindows: (): Promise<ExternalWindowBounds[]> =>
            ipcRenderer.invoke('external-windows:get-visible-windows'),
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
