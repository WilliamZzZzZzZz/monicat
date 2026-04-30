# MochiCat Phase 5 开发文档：原生右键菜单与系统托盘控制

版本：v0.2  
阶段：Phase 5  
前置条件：Phase 4 已完成；`idle`、`dragging`、`happy`、`sleeping` 四种状态的 3 张连续帧图像已经放入工程目录，并且帧动画系统可以正常播放。  
目标：为 MochiCat 增加 Electron 原生右键菜单和 macOS 系统托盘控制能力。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只实现“菜单控制 + 托盘显示/隐藏/退出 + 菜单触发现有状态”，不新增复杂设置系统，不新增新的动画状态。

---

## 1. Phase 5 的目标

Phase 5 的核心目标是：

> 让用户可以通过右键菜单和系统托盘控制桌面宠物。

目前 Phase 4 已经完成：

```text
PetState -> animationConfig -> useAnimation -> PetSprite -> 当前图片帧
```

Phase 5 要实现：

```text
右键宠物 -> 打开原生 Electron 菜单
菜单项 -> 触发已有宠物状态
托盘图标 -> 显示 / 隐藏 / 退出应用
```

本阶段只复用当前已有状态：

```text
idle
dragging
happy
sleeping
```

不要在 Phase 5 新增：

```text
eat
petting
wake
walk_left
walk_right
angry
curious
```

这些状态留到后续阶段扩展。

---

## 2. 当前项目状态

当前项目应已经具备：

```text
Electron + React + TypeScript + Vite 项目可以启动
窗口透明、无边框、置顶
窗口尺寸约为 300 x 300
小猫可以被拖拽
存在基础 PetState：
- idle
- dragging
- happy
- sleeping

交互逻辑：
- 拖拽开始 -> dragging
- 拖拽结束 -> idle
- 双击 -> happy
- 长时间无操作 -> sleeping
- sleeping 中双击 -> happy

动画系统：
- animationConfig
- useAnimation
- PetSprite
- 本地图片帧资源
- SpeechBubble
```

当前图片资源应至少类似：

```text
src/assets/cat/
├── idle/
│   ├── idle_000.png
│   ├── idle_001.png
│   └── idle_002.png
├── dragging/
│   ├── dragging_000.png
│   ├── dragging_001.png
│   └── dragging_002.png
├── happy/
│   ├── happy_000.png
│   ├── happy_001.png
│   └── happy_002.png
└── sleeping/
    ├── sleeping_000.png
    ├── sleeping_001.png
    └── sleeping_002.png
```

Phase 5 不需要再准备新的猫咪帧图。

---

## 3. Phase 5 完成效果

完成 Phase 5 后，应用应具备以下表现：

```text
1. npm start 可以正常启动。
2. 桌面宠物窗口仍然透明、无边框、置顶。
3. 小猫仍然可以拖拽。
4. idle / dragging / happy / sleeping 四种动画仍然正常播放。
5. 在小猫身上右键，可以打开 Electron 原生菜单。
6. 右键菜单可以触发：
   - 摸摸猫猫
   - 喂小鱼干
   - 让它睡觉
   - 唤醒猫猫
   - 隐藏猫猫
   - 退出
7. macOS 菜单栏出现托盘图标。
8. 托盘菜单可以显示 / 隐藏猫猫。
9. 托盘菜单可以触发部分宠物动作。
10. 托盘菜单可以退出应用。
11. TypeScript 无编译错误。
12. Renderer Console 和 main process 终端无明显运行时报错。
```

---

## 4. Phase 5 不做什么

本阶段禁止实现：

```text
设置持久化
设置面板
开机自启
点击穿透
多皮肤系统
真实 AI 素材生产 pipeline
复杂情绪值系统
复杂随机行为
多宠物系统
打包 dmg / 正式发布
```

原因：

```text
Phase 5 的重点是建立 Electron 原生菜单、托盘以及 main -> renderer 状态触发链路。
设置持久化应放到 Phase 6。
```

---

## 5. Phase 5 需要准备的资源

### 5.1 已有宠物动画帧

你当前已经完成四种状态的 3 张连续帧图像，因此可以直接进入 Phase 5。

Phase 5 不需要新增猫咪状态图片。  
菜单中的动作复用已有状态：

```text
摸摸猫猫 -> happy
喂小鱼干 -> happy
让它睡觉 -> sleeping
唤醒猫猫 -> happy 或 idle
```

### 5.2 新增托盘图标

Phase 5 只建议新增一个托盘图标。

推荐路径：

```text
src/assets/tray/
├── trayTemplate.png
└── trayTemplate@2x.png
```

推荐规格：

```text
trayTemplate.png：16 x 16 或 18 x 18
trayTemplate@2x.png：32 x 32 或 36 x 36
背景：透明
颜色：单色
风格：极简猫头 / 猫耳 / 爪印
```

如果暂时没有正式托盘图标，可以先创建一个简单占位图。  
不要因为托盘图标阻塞 Phase 5。

### 5.3 本阶段不需要 App icon

正式 App 图标，例如 `.icns`，留到打包发布阶段。  
Phase 5 不处理正式应用图标。

---

## 6. 菜单行为设计

### 6.1 右键菜单项

右键宠物时显示：

```text
摸摸猫猫
喂小鱼干
让它睡觉
唤醒猫猫
---
隐藏猫猫 / 显示猫猫
---
退出
```

### 6.2 菜单项对应行为

```text
摸摸猫猫:
- renderer 进入 happy 状态
- 显示气泡：“舒服～”

喂小鱼干:
- renderer 进入 happy 状态
- 显示气泡：“小鱼干！”

让它睡觉:
- renderer 进入 sleeping 状态
- 显示气泡：“Zzz...”

唤醒猫猫:
- renderer 进入 happy 状态
- 显示气泡：“醒啦！”

隐藏猫猫:
- main process 隐藏 BrowserWindow

显示猫猫:
- main process 显示 BrowserWindow

退出:
- app.quit()
```

### 6.3 状态复用原则

不要新增 `feeding`、`petting`、`wake` 等状态。  
本阶段菜单动作只复用已有状态：

```text
pet -> happy
feed -> happy
sleep -> sleeping
wake -> happy
```

---

## 7. Main / Renderer 职责边界

### 7.1 Main Process 负责

```text
创建 Electron 原生菜单
创建 Tray
控制窗口显示 / 隐藏
退出应用
向 renderer 发送菜单动作
```

### 7.2 Renderer 负责

```text
维护 React 状态
维护 PetState
播放动画
显示 speech bubble
响应菜单动作
```

### 7.3 为什么 main process 不直接改 PetState

PetState 是 React UI 状态，应由 renderer 管理。  
Main process 不能直接调用 React setState。

正确数据流：

```text
用户点击菜单项
  ↓
main process 菜单 click handler
  ↓
mainWindow.webContents.send('pet:menu-action', action)
  ↓
preload 安全转发
  ↓
renderer 收到 action
  ↓
React 状态更新
```

---

## 8. IPC 设计

### 8.1 新增 IPC channel

建议在已有 IPC channel 定义中追加：

```ts
export const IPC_CHANNELS = {
  MENU_OPEN_PET_MENU: 'menu:open-pet-menu',
  PET_MENU_ACTION: 'pet:menu-action',
} as const;
```

如果当前项目已有 `src/shared/ipcChannels.ts`，直接在已有文件中追加。  
不要重复创建冲突的常量定义。

### 8.2 菜单动作类型

建议新增：

```ts
export type PetMenuAction =
  | 'pet'
  | 'feed'
  | 'sleep'
  | 'wake';
```

含义：

```text
pet:
摸摸猫猫

feed:
喂小鱼干

sleep:
让它睡觉

wake:
唤醒猫猫
```

---

## 9. 右键菜单实现方案

### 9.1 推荐方案

推荐使用：

```text
renderer 捕获 onContextMenu
  ↓
preload 暴露 openPetMenu()
  ↓
ipcRenderer.invoke('menu:open-pet-menu')
  ↓
main process 创建并弹出 Electron 原生 Menu
```

原因：

```text
1. 可以确保只在宠物区域右键时打开菜单。
2. 不会影响透明窗口其他区域。
3. 符合当前 renderer 负责交互事件的结构。
```

### 9.2 Renderer 右键事件

在 `PetSprite` 或 App 中绑定：

```tsx
function handleContextMenu(event: React.MouseEvent) {
  event.preventDefault();
  void window.mochiCat.menu.openPetMenu();
}
```

然后：

```tsx
<PetSprite
  state={petState}
  onMouseDown={handleMouseDown}
  onDoubleClick={handleDoubleClick}
  onContextMenu={handleContextMenu}
/>
```

如果 `PetSprite` 当前 props 没有 `onContextMenu`，需要给它增加。

### 9.3 Main process 打开菜单

示例：

```ts
ipcMain.handle('menu:open-pet-menu', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const menu = Menu.buildFromTemplate([
    {
      label: '摸摸猫猫',
      click: () => sendPetMenuAction('pet'),
    },
    {
      label: '喂小鱼干',
      click: () => sendPetMenuAction('feed'),
    },
    {
      label: '让它睡觉',
      click: () => sendPetMenuAction('sleep'),
    },
    {
      label: '唤醒猫猫',
      click: () => sendPetMenuAction('wake'),
    },
    { type: 'separator' },
    {
      label: mainWindow.isVisible() ? '隐藏猫猫' : '显示猫猫',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]);

  menu.popup({ window: mainWindow });
});
```

### 9.4 发送菜单动作

```ts
function sendPetMenuAction(action: PetMenuAction) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('pet:menu-action', action);
}
```

---

## 10. Preload API 设计

### 10.1 新增 API

在 preload 中新增：

```ts
window.mochiCat.menu.openPetMenu()
window.mochiCat.pet.onMenuAction(callback)
```

示例：

```ts
contextBridge.exposeInMainWorld('mochiCat', {
  ...existingApis,

  menu: {
    openPetMenu: () => ipcRenderer.invoke('menu:open-pet-menu'),
  },

  pet: {
    onMenuAction: (callback: (action: PetMenuAction) => void) => {
      const listener = (_event: IpcRendererEvent, action: PetMenuAction) => {
        callback(action);
      };

      ipcRenderer.on('pet:menu-action', listener);

      return () => {
        ipcRenderer.removeListener('pet:menu-action', listener);
      };
    },
  },
});
```

### 10.2 安全要求

必须保持：

```text
contextIsolation: true
nodeIntegration: false
```

禁止：

```ts
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);
```

禁止让 renderer 任意传入 IPC channel。  
只暴露本阶段需要的受限 API。

---

## 11. TypeScript 全局类型声明

如果已有 `global.d.ts` 或类似文件，应追加，而不是覆盖。

示例：

```ts
export {};

type PetMenuAction = 'pet' | 'feed' | 'sleep' | 'wake';

declare global {
  interface Window {
    mochiCat: {
      window: {
        getPosition: () => Promise<[number, number]>;
        setPosition: (x: number, y: number) => Promise<void>;
      };
      menu: {
        openPetMenu: () => Promise<void>;
      };
      pet: {
        onMenuAction: (
          callback: (action: PetMenuAction) => void
        ) => () => void;
      };
    };
  }
}
```

注意：

```text
1. 不要删除 Phase 2 已有的 window movement API 类型。
2. 不要创建多个互相冲突的 Window.mochiCat 声明。
3. 如果项目已有 shared 类型，优先复用。
```

---

## 12. Renderer 响应菜单动作

### 12.1 App 中监听菜单事件

在 `App.tsx` 或状态管理 hook 中添加：

```ts
useEffect(() => {
  const unsubscribe = window.mochiCat.pet.onMenuAction((action) => {
    switch (action) {
      case 'pet':
        triggerHappy('舒服～');
        break;

      case 'feed':
        triggerHappy('小鱼干！');
        break;

      case 'sleep':
        triggerSleep('Zzz...');
        break;

      case 'wake':
        triggerHappy('醒啦！');
        break;

      default:
        break;
    }
  });

  return unsubscribe;
}, []);
```

### 12.2 推荐抽象状态函数

如果当前代码中没有这些函数，建议整理为：

```ts
function triggerHappy(bubbleText = '喵～') {
  setPetState('happy');
  showBubble(bubbleText);
  resetInactivityTimer();

  if (happyTimerRef.current) {
    window.clearTimeout(happyTimerRef.current);
  }

  happyTimerRef.current = window.setTimeout(() => {
    setPetState('idle');
    resetInactivityTimer();
  }, HAPPY_DURATION_MS);
}
```

以及：

```ts
function triggerSleep(bubbleText = 'Zzz...') {
  setPetState('sleeping');
  showBubble(bubbleText);
}
```

不要为了 Phase 5 重写整个状态机。  
只需要复用或轻微整理已有 Phase 3 / Phase 4 逻辑。

---

## 13. PetSprite 修改

如果当前 `PetSprite` props 只有：

```ts
state
onMouseDown
onDoubleClick
```

需要增加：

```ts
onContextMenu
```

示例：

```ts
interface PetSpriteProps {
  state: PetState;
  onMouseDown: MouseEventHandler<HTMLButtonElement>;
  onDoubleClick: MouseEventHandler<HTMLButtonElement>;
  onContextMenu: MouseEventHandler<HTMLButtonElement>;
}
```

组件：

```tsx
<button
  className={`pet-sprite-button pet-${state}`}
  type="button"
  onMouseDown={onMouseDown}
  onDoubleClick={onDoubleClick}
  onContextMenu={onContextMenu}
  aria-label="MochiCat desktop pet"
>
  ...
</button>
```

---

## 14. 系统托盘设计

### 14.1 托盘功能

应用启动后创建系统托盘图标。

托盘菜单包含：

```text
显示猫猫 / 隐藏猫猫
摸摸猫猫
让它睡觉
---
退出
```

### 14.2 Tray 对象生命周期

Tray 对象必须保存在模块级变量中，避免被垃圾回收。

示例：

```ts
let tray: Tray | null = null;
```

然后在 `app.whenReady()` 后创建：

```ts
tray = new Tray(trayIconPath);
```

### 14.3 托盘菜单示例

```ts
function createTray(mainWindow: BrowserWindow) {
  const trayIconPath = getTrayIconPath();
  tray = new Tray(trayIconPath);

  tray.setToolTip('MochiCat');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: mainWindow.isVisible() ? '隐藏猫猫' : '显示猫猫',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    {
      label: '摸摸猫猫',
      click: () => sendPetMenuAction('pet'),
    },
    {
      label: '让它睡觉',
      click: () => sendPetMenuAction('sleep'),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}
```

注意：如果菜单中的“显示/隐藏”文字需要动态变化，每次打开菜单前重新构建菜单会更准确。  
MVP 可以先接受静态文字，功能正确优先。

### 14.4 托盘图标路径

Codex 应根据当前工程结构处理图标路径。  
建议优先使用项目中已有静态资源处理方式。

建议路径：

```text
src/assets/tray/trayTemplate.png
src/assets/tray/trayTemplate@2x.png
```

如果 Vite 打包 main process 后无法正确加载 `src/assets`，可以把托盘图标放到项目根的 `assets/tray/` 或 `public/` 目录，再用可靠路径读取。

本阶段要求：

```text
开发环境 npm start 下托盘图标可见。
```

正式打包路径优化可以后续处理。

---

## 15. CSS 要求

Phase 5 基本不需要大幅修改 CSS。

必须保持：

```css
html,
body,
#root,
.pet-window {
  background: transparent;
}
```

确保：

```css
.speech-bubble {
  pointer-events: none;
}
```

否则气泡可能挡住右键或拖拽。

如果右键时出现浏览器默认菜单，说明 `event.preventDefault()` 未正确执行，和 CSS 无关。

---

## 16. Codex 执行任务 Prompt

可以直接把以下内容交给 Codex：

```text
We have completed Phase 4 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The app shows a transparent frameless 300x300 always-on-top desktop pet window.
- The pet can be dragged around the macOS desktop.
- The app has basic pet states:
  - idle
  - dragging
  - happy
  - sleeping
- Each state has 3 local frame images in the project folder.
- The frame-based animation system is complete:
  - animationConfig
  - useAnimation
  - PetSprite
- Speech bubbles exist.
- contextIsolation remains true and nodeIntegration remains false.

Now we are starting Phase 5.

Current phase:
Phase 5 - Native Context Menu and System Tray

Goal:
Add a native Electron context menu and a macOS tray menu for controlling the desktop pet.

Requirements:
1. Add a native right-click menu for the pet.
2. The right-click menu should open only when right-clicking the pet/sprite area.
3. Use Electron's native Menu API.
4. Add right-click menu actions:
   - 摸摸猫猫
   - 喂小鱼干
   - 让它睡觉
   - 唤醒猫猫
   - 隐藏猫猫 / 显示猫猫
   - 退出
5. Add a system tray icon.
6. Tray menu should support:
   - 显示 / 隐藏猫猫
   - 摸摸猫猫
   - 让它睡觉
   - 退出
7. Menu actions that affect pet state should be sent from main process to renderer using safe IPC.
8. Reuse existing PetState values:
   - pet action should trigger happy state with speech bubble “舒服～”
   - feed action should trigger happy state with speech bubble “小鱼干！”
   - sleep action should trigger sleeping state with speech bubble “Zzz...”
   - wake action should trigger happy state with speech bubble “醒啦！”
9. Do not add new animation states in this phase.
10. Do not add new cat frame images in this phase.
11. Do not implement settings persistence yet.
12. Do not implement launch at login yet.
13. Do not disable contextIsolation.
14. Do not enable nodeIntegration.
15. Do not expose raw ipcRenderer to the renderer.
16. Preserve Phase 4 animation and Phase 2 dragging behavior.
17. Avoid changing unrelated files.

Asset requirement:
- Add or use a simple tray icon, preferably:
  src/assets/tray/trayTemplate.png
  src/assets/tray/trayTemplate@2x.png
- If no final icon exists, create a simple placeholder tray icon.

Implementation requirements:
1. Add a menu:open-pet-menu IPC handler.
2. Add a pet:menu-action event from main to renderer.
3. Expose window.mochiCat.menu.openPetMenu() in preload.
4. Expose window.mochiCat.pet.onMenuAction(callback) in preload.
5. Add onContextMenu to PetSprite or its container.
6. In renderer, prevent default context menu and call openPetMenu().
7. In renderer, listen for pet menu actions and trigger existing state functions.
8. Add tray creation in the main process.
9. Keep Tray object alive so it is not garbage collected.
10. Tray menu should show/hide the pet window and quit the app.

Before writing code:
1. Inspect the current project structure.
2. List the files you will create or modify.
3. Explain the menu and tray IPC data flow.
4. Then implement the changes.

After implementation:
1. Explain how to run the app.
2. Explain how to verify Phase 5 is complete.
3. List all files changed.
```

---

## 17. 推荐 Codex 修改步骤

Codex 应按以下顺序执行：

```text
1. 查看当前项目结构。
2. 检查 PetState、PetSprite、App、preload、main process 当前实现。
3. 检查已有 IPC channel 定义方式。
4. 新增 menu:open-pet-menu。
5. 新增 pet:menu-action。
6. 在 main process 中实现右键菜单。
7. 在 preload 中暴露 openPetMenu 和 onMenuAction。
8. 在 PetSprite 或 App 中绑定 onContextMenu。
9. 在 renderer 中监听菜单 action 并调用已有 triggerHappy / triggerSleep 逻辑。
10. 添加 tray icon 资源。
11. 在 main process 中创建 Tray 和 Tray menu。
12. 确保 Tray 对象不会被垃圾回收。
13. 运行 npm start。
14. 如果报错，只修复 Phase 5 相关问题。
```

---

## 18. Phase 5 验收标准

完成后逐项检查：

```text
[ ] npm start 可以正常启动。
[ ] 桌面宠物窗口仍然透明。
[ ] 窗口仍然无边框。
[ ] 窗口仍然置顶。
[ ] 小猫仍然可以被拖拽。
[ ] idle / happy / sleeping / dragging 动画仍然正常。
[ ] 在小猫上右键能打开 Electron 原生菜单。
[ ] 右键时不会显示浏览器默认菜单。
[ ] 点击“摸摸猫猫”后进入 happy 状态。
[ ] 点击“摸摸猫猫”后显示“舒服～”气泡。
[ ] 点击“喂小鱼干”后进入 happy 状态。
[ ] 点击“喂小鱼干”后显示“小鱼干！”气泡。
[ ] 点击“让它睡觉”后进入 sleeping 状态。
[ ] 点击“让它睡觉”后显示“Zzz...”气泡。
[ ] 点击“唤醒猫猫”后进入 happy 或 idle 状态。
[ ] 点击“唤醒猫猫”后显示“醒啦！”气泡。
[ ] 点击“隐藏猫猫”后窗口隐藏。
[ ] 托盘图标在 macOS 菜单栏中可见。
[ ] 托盘菜单可以显示 / 隐藏窗口。
[ ] 托盘菜单可以退出应用。
[ ] 退出后进程彻底结束。
[ ] TypeScript 没有编译错误。
[ ] Renderer Console 没有明显运行时报错。
[ ] Main process 终端没有明显运行时报错。
```

---

## 19. 手动测试流程

### 19.1 启动应用

```bash
npm start
```

预期：

```text
桌面上显示透明背景宠物。
macOS 菜单栏出现 MochiCat 托盘图标。
```

### 19.2 测试右键菜单

操作：

```text
在小猫身上右键。
```

预期：

```text
出现 Electron 原生菜单。
不出现浏览器默认菜单。
```

### 19.3 测试菜单动作

逐项测试：

```text
摸摸猫猫
喂小鱼干
让它睡觉
唤醒猫猫
```

预期：

```text
宠物进入对应状态。
气泡文字正确显示。
动画继续正常播放。
```

### 19.4 测试显示 / 隐藏

操作：

```text
从右键菜单点击隐藏。
从托盘菜单点击显示。
```

预期：

```text
窗口可以隐藏和重新显示。
```

### 19.5 测试退出

操作：

```text
从右键菜单或托盘菜单点击退出。
```

预期：

```text
应用彻底退出。
终端进程结束。
```

---

## 20. 常见问题与处理方式

### 20.1 右键没有菜单

可能原因：

```text
1. onContextMenu 没有绑定到 PetSprite。
2. event.preventDefault() 没有执行。
3. preload 没有暴露 openPetMenu。
4. ipcMain.handle('menu:open-pet-menu') 没有注册。
```

检查：

```text
DevTools Console 是否有 window.mochiCat.menu undefined。
main process 终端是否有 IPC 报错。
```

---

### 20.2 出现浏览器默认菜单

处理：

```ts
event.preventDefault();
```

确保绑定在真正接收右键事件的元素上。

---

### 20.3 菜单点击后状态不变

可能原因：

```text
1. main process 没有 webContents.send。
2. preload 没有监听 pet:menu-action。
3. renderer 没有注册 onMenuAction listener。
4. action 字符串和 switch case 不匹配。
```

处理：

```text
统一 PetMenuAction 类型。
不要手写多个不一致字符串。
```

---

### 20.4 托盘图标不显示

可能原因：

```text
1. 图标路径错误。
2. Tray 对象被垃圾回收。
3. 图片格式不兼容。
4. template icon 在当前菜单栏颜色下不明显。
```

处理：

```text
1. 确认 tray 变量是模块级变量。
2. 确认文件路径真实存在。
3. 先用普通 PNG 测试。
4. 后续再优化为 template icon。
```

---

### 20.5 隐藏后无法恢复

原因：

```text
没有托盘入口或托盘菜单 show 没实现。
```

处理：

```text
确保托盘菜单有“显示猫猫”。
隐藏前必须确认托盘已经创建。
```

---

### 20.6 Speech bubble 挡住右键

原因：

```text
speech-bubble 接收鼠标事件。
```

处理：

```css
.speech-bubble {
  pointer-events: none;
}
```

---

## 21. 代码质量要求

Phase 5 代码应满足：

```text
1. 菜单和托盘逻辑位于 main process。
2. React 状态仍由 renderer 管理。
3. main -> renderer 通过受限 IPC 发送 action。
4. preload 不暴露原始 ipcRenderer。
5. PetMenuAction 类型统一。
6. 不新增无用 PetState。
7. 不破坏 Phase 4 动画系统。
8. 不破坏 Phase 2 拖拽系统。
9. Electron 安全设置不变。
10. 不做设置持久化。
```

---

## 22. Phase 5 完成后的 Git 提交建议

如果 Phase 5 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add context menu and tray controls"
```

---

## 23. 下一阶段预告

Phase 5 完成后建议进入：

```text
Phase 6 - Settings Persistence
```

Phase 6 目标：

```text
1. 保存用户设置到 Electron userData/settings.json。
2. 持久化：
   - petSize
   - alwaysOnTop
   - speechBubbleEnabled
   - randomBehaviorEnabled
3. 设置重启后仍然生效。
4. 菜单项可以读取和修改设置。
```

Phase 6 才开始系统化处理可配置项。  
Phase 5 不要提前把设置系统做复杂。
