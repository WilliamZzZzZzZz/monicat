# Architecture Overview

MochiCat follows the standard Electron three-process model with strict security boundaries enforced via `contextIsolation: true` and `nodeIntegration: false`.

---

## Three Layers

### 1. Main Process (`src/main.ts`)

Runs in Node.js. Responsible for:

- Creating the `BrowserWindow` (300×300, transparent, frameless, alwaysOnTop, skipTaskbar)
- Tray icon and tray context menu
- Native right-click context menu via `Menu.buildFromTemplate`
- All IPC handlers (`ipcMain.handle` / `ipcMain.on`)
- Settings file I/O (read / write `userData/settings.json`)
- Window position get/set via Electron `win.getPosition()` / `win.setBounds()`

The main process never directly manipulates React state. It receives requests from the renderer via IPC and pushes events back.

### 2. Preload Script (`src/preload.ts`)

Bridges the main process and renderer safely using `contextBridge.exposeInMainWorld`. It exposes a typed `window.mochiCat` API to the renderer. No raw `ipcRenderer` is ever exposed.

```
window.mochiCat
  .window   → drag lifecycle, position get/set, bounds, workArea, visibility
  .menu     → openPetMenu
  .pet      → onMenuAction (push subscription)
  .settings → get, update, reset, onChange (push subscription)
```

All subscription methods return a cleanup function (`() => void`) to remove the listener.

### 3. Renderer (`src/renderer.tsx` → `src/App.tsx`)

Runs in a Chromium renderer process. No Node.js access. Responsible for:

- All React UI rendering
- Animation frame cycling (`useAnimation`)
- Action state machine (`usePetActionController`)
- Random behavior scheduling (`useRandomBehavior`)
- Walking movement via RAF (`useWalkingMovement`)
- Settings panel UI (`SettingsPanel`)
- Pointer event handling for custom drag

---

## IPC Security Boundary

```
Renderer
  → window.mochiCat.window.dragMove(x, y)   // fire-and-forget (ipcRenderer.send)
  → window.mochiCat.settings.update({...})  // two-way (ipcRenderer.invoke)

Main
  → win.webContents.send('window:visibility-changed', ...)  // push
  → win.webContents.send('pet:menu-action', action)         // push
  → win.webContents.send('settings:changed', settings)      // push
```

Rules:
- `contextIsolation: true` — renderer cannot access Node globals
- `nodeIntegration: false` — no `require()` in renderer
- Only typed methods from `contextBridge` are accessible

---

## Settings Persistence Flow

1. On startup, `settingsService.load()` reads `userData/settings.json`.
2. If missing, defaults are used. If stale keys exist, `migrateAndMerge` normalises them.
3. Every `settings:update` IPC call calls `settingsService.update(partial)`, persists to disk, then broadcasts `settings:changed` to the renderer.
4. On `settings:reset`, `defaultSettings` is written and broadcast.

---

## Menu / Tray Action Flow

```
User right-clicks pet → main sends 'pet:menu-action' event to renderer
Renderer handleMenuAction() → calls dispatchPetAction(request)
dispatchPetAction → transitions petState, schedules timers
```

Tray menu actions follow the same path via `ipcMain` handlers.

---

## Renderer State vs Main Process State

| Concern | Location |
|---------|----------|
| Pet animation state (`petState`) | Renderer (React state) |
| Window position / bounds | Main process (BrowserWindow) |
| Settings | Main process file + renderer mirror |
| Timers (oneShot, inactivity) | Renderer (window.setTimeout via jsdom) |
| Walking RAF loop | Renderer |
