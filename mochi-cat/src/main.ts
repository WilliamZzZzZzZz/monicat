import { app, BrowserWindow, ipcMain, screen, Menu, Tray } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { settingsService } from './main/settings';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;
// Must be module-level to prevent garbage collection
let tray: Tray | null = null;

const createWindow = () => {
    // Create the desktop pet window.
    mainWindow = new BrowserWindow({
        width: 300,
        height: 300,
        transparent: true,
        frame: false,
        resizable: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Apply alwaysOnTop from persisted settings
    const initialSettings = settingsService.load();
    mainWindow.setAlwaysOnTop(initialSettings.alwaysOnTop, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Notify renderer when visibility changes
    mainWindow.on('show', () => {
        mainWindow?.webContents.send('window:visibility-changed', true);
    });
    mainWindow.on('hide', () => {
        mainWindow?.webContents.send('window:visibility-changed', false);
    });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(
            path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        );
    }
};

type PetMenuAction = 'pet' | 'feed' | 'sleep' | 'wake' | 'openSizePanel' | 'walkLeft' | 'walkRight';

function sendPetMenuAction(action: PetMenuAction) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('pet:menu-action', action);
}

function buildPetContextMenu(): Menu {
    const s = settingsService.load();
    return Menu.buildFromTemplate([
        { label: '摸摸猫猫', click: () => sendPetMenuAction('pet') },
        { label: '喂小鱼干', click: () => sendPetMenuAction('feed') },
        { label: '让它睡觉', click: () => sendPetMenuAction('sleep') },
        { label: '唤醒猫猫', click: () => sendPetMenuAction('wake') },
        { type: 'separator' },
        { label: '向左走动', click: () => sendPetMenuAction('walkLeft') },
        { label: '向右走动', click: () => sendPetMenuAction('walkRight') },
        { type: 'separator' },
        {
            label: '调整尺寸...',
            click: () => sendPetMenuAction('openSizePanel'),
        },
        {
            label: `气泡：${s.speechBubbleEnabled ? '开' : '关'}`,
            click: () => applyAndBroadcastSettings({ speechBubbleEnabled: !s.speechBubbleEnabled }),
        },
        {
            label: '随机行为',
            type: 'checkbox',
            checked: s.randomBehaviorEnabled,
            click: () => applyAndBroadcastSettings({ randomBehaviorEnabled: !s.randomBehaviorEnabled }),
        },
        {
            label: `始终置顶：${s.alwaysOnTop ? '开' : '关'}`,
            click: () => applyAndBroadcastSettings({ alwaysOnTop: !s.alwaysOnTop }),
        },
        { type: 'separator' },
        {
            label: mainWindow?.isVisible() ? '隐藏猫猫' : '显示猫猫',
            click: () => {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.setAlwaysOnTop(settingsService.load().alwaysOnTop, 'floating');
                }
                tray?.setContextMenu(buildTrayMenu());
            },
        },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
    ]);
}

function buildTrayMenu(): Menu {
    const s = settingsService.load();
    return Menu.buildFromTemplate([
        {
            label: mainWindow?.isVisible() ? '隐藏猫猫' : '显示猫猫',
            click: () => {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.setAlwaysOnTop(true, 'floating');
                }
                tray?.setContextMenu(buildTrayMenu());
            },
        },
        { label: '摸摸猫猫', click: () => sendPetMenuAction('pet') },
        { label: '让它睡觉', click: () => sendPetMenuAction('sleep') },
        {
            label: '随机行为',
            type: 'checkbox',
            checked: s.randomBehaviorEnabled,
            click: () => applyAndBroadcastSettings({ randomBehaviorEnabled: !s.randomBehaviorEnabled }),
        },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
    ]);
}

ipcMain.handle('menu:open-pet-menu', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const menu = buildPetContextMenu();
    menu.popup({ window: mainWindow });
});

// ---- Settings IPC ----
function applyAndBroadcastSettings(partial: Parameters<typeof settingsService.update>[0]): void {
    const updated = settingsService.update(partial);
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Apply alwaysOnTop immediately
    if (partial.alwaysOnTop !== undefined) {
        mainWindow.setAlwaysOnTop(updated.alwaysOnTop, 'floating');
    }
    // Push updated settings to renderer
    mainWindow.webContents.send('settings:changed', updated);
}

ipcMain.handle('settings:get', () => settingsService.load());

ipcMain.handle('settings:update', (_event, partial: Parameters<typeof settingsService.update>[0]) => {
    applyAndBroadcastSettings(partial);
    return settingsService.load();
});

ipcMain.handle('settings:reset', () => {
    const fresh = settingsService.reset();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(fresh.alwaysOnTop, 'floating');
        mainWindow.webContents.send('settings:changed', fresh);
    }
    return fresh;
});

ipcMain.handle('window:set-always-on-top', (_event, enabled: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setAlwaysOnTop(enabled, 'floating');
});

// Drag state tracked entirely in main process to avoid coordinate system mismatch
interface DragState {
    initialMousePos: { x: number; y: number };
    initialWindowPos: [number, number];
}
let dragState: DragState | null = null;

ipcMain.handle('window:drag-start', (_event, mouseScreenX: number, mouseScreenY: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [wx, wy] = mainWindow.getPosition();
    dragState = { initialMousePos: { x: mouseScreenX, y: mouseScreenY }, initialWindowPos: [wx, wy] };
});

// Fire-and-forget: renderer sends on every mousemove, no response needed
ipcMain.on('window:drag-move', (_event, mouseScreenX: number, mouseScreenY: number) => {
    if (!mainWindow || mainWindow.isDestroyed() || !dragState) return;
    mainWindow.setPosition(
        Math.round(dragState.initialWindowPos[0] + mouseScreenX - dragState.initialMousePos.x),
        Math.round(dragState.initialWindowPos[1] + mouseScreenY - dragState.initialMousePos.y),
    );
});

ipcMain.handle('window:drag-end', () => {
    dragState = null;
});

ipcMain.handle('window:get-position', () => {
    return mainWindow?.getPosition() ?? [0, 0];
});

ipcMain.handle('window:set-position', (_event, x: number, y: number) => {
    mainWindow?.setPosition(Math.round(x), Math.round(y));
});

ipcMain.handle('window:get-work-area', () => {
    if (!mainWindow) return { x: 0, y: 0, width: 1280, height: 800 };
    const bounds = mainWindow.getBounds();
    return screen.getDisplayMatching(bounds).workArea;
});

ipcMain.handle('window:get-bounds', () => {
    return mainWindow?.getBounds() ?? { x: 0, y: 0, width: 300, height: 300 };
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow();

    // Create tray after window exists so buildTrayMenu() can reference mainWindow
    const trayIconPath = path.join(__dirname, '..', '..', 'src', 'assets', 'tray', 'trayTemplate.png');
    tray = new Tray(trayIconPath);
    tray.setToolTip('MochiCat — 单击显示/隐藏');
    tray.setContextMenu(buildTrayMenu());
    // Left-click directly toggles window visibility (more intuitive than opening menu)
    tray.on('click', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.setAlwaysOnTop(true, 'floating');
        }
        // Keep context menu label in sync
        tray?.setContextMenu(buildTrayMenu());
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
