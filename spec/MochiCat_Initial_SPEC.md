# MochiCat Desktop Pet 初步开发 Spec

版本：v0.1 Draft  
目标平台：macOS  
开发方式：VS Code + Codex + GitHub Copilot + Vibe Coding  
推荐技术栈：Electron + React + TypeScript + Vite + Zustand  
项目定位：一个基于自家猫咪卡通形象的 macOS 桌面宠物应用

---

## 1. 项目概述

MochiCat 是一个运行在 macOS 桌面上的透明悬浮桌面宠物。用户可以基于自己家猫咪的照片生成专属卡通形象，并让该卡通猫咪常驻桌面。猫咪能够执行基础动画、响应用户操作、显示简单气泡文字，并通过右键菜单或托盘进行控制。

第一阶段目标不是做完整 AI 陪伴应用，而是完成一个稳定、轻量、可互动、可扩展的桌面宠物 MVP。

---

## 2. 产品目标

### 2.1 MVP 目标

MVP 必须实现以下能力：

1. 在 macOS 桌面显示一个透明背景、无边框、置顶的猫咪窗口。
2. 猫咪可以被用户拖拽移动。
3. 猫咪拥有基础动画状态：
   - idle
   - sleep
   - happy
   - drag
   - walk_left
   - walk_right
4. 用户双击猫咪时，猫咪进入 happy 状态。
5. 用户长时间不操作时，猫咪进入 sleep 状态。
6. 猫咪可以根据随机行为规则自动切换动作。
7. 右键猫咪可以打开菜单。
8. 系统托盘中可以显示、隐藏或退出应用。
9. 用户基础设置可以持久化保存。
10. 项目代码结构清晰，便于后续模块化扩展。

### 2.2 非 MVP 目标

以下功能暂不在第一版实现：

1. 不接入 LLM 对话。
2. 不做复杂 Live2D 骨骼动画。
3. 不做 App Store 上架。
4. 不做 Windows / Linux 适配。
5. 不做云端同步。
6. 不做复杂账号系统。
7. 不做多宠物系统。

---

## 3. 推荐技术路线

### 3.1 技术栈

```text
Electron
React
TypeScript
Vite
Zustand
CSS Animation / Frame-based PNG Animation
```

### 3.2 技术分层

```text
Electron Main Process
- 创建桌面宠物窗口
- 管理窗口置顶、尺寸、位置
- 管理系统托盘
- 管理右键菜单
- 管理设置文件
- 处理 IPC 请求

Electron Preload
- 暴露安全 IPC API
- 避免 renderer 直接访问 Node.js

React Renderer
- 渲染猫咪动画
- 管理交互事件
- 显示气泡文字
- 管理状态机
- 管理设置面板

Shared
- 公共类型
- 常量
- IPC channel 名称
```

---

## 4. 项目目录结构

推荐目录结构如下：

```text
mochi-cat/
├── package.json
├── forge.config.ts
├── tsconfig.json
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
│
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── window.ts
│   │   ├── tray.ts
│   │   ├── menu.ts
│   │   ├── settings.ts
│   │   └── ipc.ts
│   │
│   ├── preload/
│   │   └── preload.ts
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── PetSprite.tsx
│   │   │   ├── SpeechBubble.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── DebugPanel.tsx
│   │   ├── hooks/
│   │   │   ├── useAnimation.ts
│   │   │   ├── usePetBehavior.ts
│   │   │   ├── useDragWindow.ts
│   │   │   └── useIdleTimer.ts
│   │   ├── store/
│   │   │   └── petStore.ts
│   │   ├── animation/
│   │   │   ├── animationConfig.ts
│   │   │   └── animationTypes.ts
│   │   ├── styles/
│   │   │   └── global.css
│   │   └── types/
│   │       └── renderer.ts
│   │
│   └── shared/
│       ├── constants.ts
│       ├── ipcChannels.ts
│       └── types.ts
│
├── assets/
│   ├── cat/
│   │   ├── idle/
│   │   ├── sleep/
│   │   ├── happy/
│   │   ├── drag/
│   │   ├── walk_left/
│   │   └── walk_right/
│   ├── tray/
│   └── sounds/
│
└── docs/
    ├── product-spec.md
    ├── asset-guide.md
    ├── prompt-guide.md
    └── development-log.md
```

---

## 5. 核心窗口 Spec

### 5.1 桌面宠物窗口要求

窗口必须满足：

```text
透明背景
无边框
不可调整大小
默认置顶
不显示在 Dock 或任务栏中
尺寸默认为 300 x 300
支持在所有桌面空间显示
```

### 5.2 Electron BrowserWindow 配置

目标配置示例：

```ts
const petWindow = new BrowserWindow({
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
    preload: path.join(__dirname, '../preload/preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

### 5.3 窗口行为

窗口启动后：

```text
1. 加载 React renderer 页面。
2. 显示猫咪占位图。
3. 保持透明背景。
4. 保持在其他普通窗口之上。
5. 默认允许鼠标点击和拖拽。
```

后续可选：

```text
1. 点击穿透模式。
2. 多显示器支持。
3. 自动贴边。
4. 屏幕边界碰撞检测。
```

---

## 6. 宠物状态机 Spec

### 6.1 宠物状态类型

```ts
export type PetState =
  | 'idle'
  | 'sleep'
  | 'happy'
  | 'drag'
  | 'walk_left'
  | 'walk_right';
```

### 6.2 状态说明

```text
idle:
默认待机状态。猫咪轻微呼吸、眨眼、摆尾。

sleep:
睡觉状态。用户长时间不交互后进入。双击或菜单操作可以唤醒。

happy:
开心状态。用户双击、摸猫、喂食后触发。持续短时间后回到 idle。

drag:
拖拽状态。用户按住猫咪移动时触发。松开鼠标后回到 idle。

walk_left:
向左移动状态。随机行为触发。

walk_right:
向右移动状态。随机行为触发。
```

### 6.3 状态优先级

状态优先级从高到低：

```text
drag > user_action > menu_action > random_behavior > idle
```

具体规则：

```text
1. 拖拽中不允许随机行为打断。
2. happy 状态可以被 drag 打断。
3. sleep 状态可以被用户双击打断。
4. random_behavior 不能覆盖用户主动触发的动作。
5. 所有临时动作结束后默认回到 idle。
```

### 6.4 状态切换规则

```text
App start -> idle

idle + double_click -> happy
idle + inactivity_timeout -> sleep
idle + random_walk_left -> walk_left
idle + random_walk_right -> walk_right

sleep + double_click -> happy
sleep + menu_wake -> idle

any_state + drag_start -> drag
drag + drag_end -> idle

happy + timeout -> idle
walk_left + timeout -> idle
walk_right + timeout -> idle
```

---

## 7. 动画系统 Spec

### 7.1 动画实现方式

MVP 使用帧动画，不使用骨骼动画。

每个状态对应一个帧序列：

```text
idle: 6-8 frames
sleep: 6 frames
happy: 8 frames
drag: 1-2 frames
walk_left: 8 frames
walk_right: 8 frames
```

### 7.2 动画配置结构

```ts
export interface AnimationDefinition {
  fps: number;
  loop: boolean;
  frames: string[];
}

export type AnimationConfig = Record<PetState, AnimationDefinition>;
```

示例：

```ts
export const animationConfig: AnimationConfig = {
  idle: {
    fps: 8,
    loop: true,
    frames: [
      '/assets/cat/idle/idle_000.png',
      '/assets/cat/idle/idle_001.png',
      '/assets/cat/idle/idle_002.png',
    ],
  },
  sleep: {
    fps: 4,
    loop: true,
    frames: [
      '/assets/cat/sleep/sleep_000.png',
      '/assets/cat/sleep/sleep_001.png',
    ],
  },
  happy: {
    fps: 10,
    loop: false,
    frames: [
      '/assets/cat/happy/happy_000.png',
      '/assets/cat/happy/happy_001.png',
    ],
  },
  drag: {
    fps: 1,
    loop: true,
    frames: [
      '/assets/cat/drag/drag_000.png',
    ],
  },
  walk_left: {
    fps: 10,
    loop: true,
    frames: [
      '/assets/cat/walk_left/walk_left_000.png',
      '/assets/cat/walk_left/walk_left_001.png',
    ],
  },
  walk_right: {
    fps: 10,
    loop: true,
    frames: [
      '/assets/cat/walk_right/walk_right_000.png',
      '/assets/cat/walk_right/walk_right_001.png',
    ],
  },
};
```

### 7.3 useAnimation Hook 要求

`useAnimation` 负责：

```text
1. 接收当前 PetState。
2. 根据 state 读取 animationConfig。
3. 根据 fps 自动切换当前 frame。
4. 支持 loop 动画。
5. 非 loop 动画播放完成后触发 onComplete 回调。
6. state 切换时重置 frameIndex。
```

函数接口建议：

```ts
function useAnimation(
  state: PetState,
  onComplete?: (state: PetState) => void
): {
  currentFrame: string;
  frameIndex: number;
};
```

---

## 8. 用户交互 Spec

### 8.1 鼠标交互

必须支持：

```text
左键按住并拖拽：
- 切换到 drag 状态
- 移动窗口位置

松开左键：
- 结束拖拽
- 切换回 idle

双击左键：
- 切换到 happy 状态
- 显示气泡：“喵～”

右键：
- 打开原生 Electron 菜单
```

### 8.2 拖拽实现

renderer 负责监听鼠标事件：

```text
mousedown:
- 记录鼠标起始位置
- 通知 main 当前进入 drag 状态

mousemove:
- 计算 offset
- 通过 IPC 请求 main 移动窗口

mouseup:
- 结束拖拽
- 切换状态回 idle
```

main process 负责实际移动窗口：

```text
ipcMain.handle('window:set-position', ...)
ipcMain.handle('window:get-position', ...)
```

### 8.3 右键菜单

右键菜单必须包含：

```text
摸摸猫猫
喂小鱼干
让它睡觉
唤醒猫猫
切换置顶
切换点击穿透
大小：小
大小：中
大小：大
隐藏
退出
```

菜单行为：

```text
摸摸猫猫 -> happy
喂小鱼干 -> happy + speech bubble
让它睡觉 -> sleep
唤醒猫猫 -> idle
切换置顶 -> update setting + update window
切换点击穿透 -> update setting + update window
大小 -> update setting + resize window
隐藏 -> hide window
退出 -> quit app
```

### 8.4 系统托盘

托盘菜单包含：

```text
显示 / 隐藏 MochiCat
置顶开关
设置
退出
```

托盘要求：

```text
1. 应用启动时创建 tray icon。
2. 点击托盘可以显示或隐藏猫咪。
3. 退出必须彻底关闭应用。
```

---

## 9. 设置系统 Spec

### 9.1 用户设置类型

```ts
export interface UserSettings {
  petName: string;
  petSize: 'small' | 'medium' | 'large';
  alwaysOnTop: boolean;
  clickThrough: boolean;
  launchAtLogin: boolean;
  soundEnabled: boolean;
  randomBehaviorEnabled: boolean;
  speechBubbleEnabled: boolean;
}
```

### 9.2 默认设置

```ts
export const defaultSettings: UserSettings = {
  petName: 'Mochi',
  petSize: 'medium',
  alwaysOnTop: true,
  clickThrough: false,
  launchAtLogin: false,
  soundEnabled: true,
  randomBehaviorEnabled: true,
  speechBubbleEnabled: true,
};
```

### 9.3 设置存储

设置保存到 Electron 的 userData 目录。

文件名：

```text
settings.json
```

SettingsService 需要提供：

```ts
class SettingsService {
  load(): UserSettings;
  save(settings: UserSettings): void;
  get<K extends keyof UserSettings>(key: K): UserSettings[K];
  set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void;
}
```

### 9.4 设置 IPC

IPC channel：

```ts
settings:get
settings:update
settings:reset
```

---

## 10. 行为系统 Spec

### 10.1 随机行为

随机行为只在以下条件下触发：

```text
1. randomBehaviorEnabled 为 true。
2. 当前状态不是 drag。
3. 当前没有用户动作正在播放。
4. 当前没有菜单强制动作正在播放。
```

随机行为频率：

```text
每 10 到 30 秒触发一次判定。
```

随机权重：

```text
idle: 50%
walk_left: 15%
walk_right: 15%
sleep: 10%
happy: 10%
```

### 10.2 无操作睡眠

规则：

```text
如果用户 5 分钟没有与猫咪交互，则进入 sleep。
```

MVP 开发阶段可以把时间缩短为 30 秒，方便测试。

```ts
const INACTIVITY_TIMEOUT_MS =
  process.env.NODE_ENV === 'development'
    ? 30_000
    : 5 * 60_000;
```

### 10.3 临时动作持续时间

```text
happy: 3 秒
walk_left: 5 秒
walk_right: 5 秒
sleep: 持续到被用户打断，或随机唤醒
drag: 持续到用户松开鼠标
```

---

## 11. 气泡系统 Spec

### 11.1 气泡显示规则

气泡显示在猫咪上方。

气泡触发场景：

```text
双击猫咪 -> “喵～”
摸摸猫猫 -> “舒服～”
喂小鱼干 -> “小鱼干！”
拖拽猫咪 -> “别拎我！”
进入睡眠 -> “我要睡觉了...”
唤醒猫咪 -> “醒啦？”
```

### 11.2 气泡行为

```text
1. 每次显示 2 秒。
2. 自动淡入淡出。
3. 如果 speechBubbleEnabled 为 false，则不显示。
4. 气泡不能阻挡拖拽操作。
```

React 组件：

```tsx
<SpeechBubble text={bubbleText} visible={bubbleVisible} />
```

---

## 12. 素材规范

### 12.1 图片资源规范

第一版可以使用占位素材。

正式素材要求：

```text
格式：PNG
背景：透明
尺寸：512 x 512
风格：统一 2D cartoon mascot
轮廓：小尺寸下清晰
动作：每个状态独立文件夹
```

命名规范：

```text
assets/cat/idle/idle_000.png
assets/cat/idle/idle_001.png

assets/cat/sleep/sleep_000.png
assets/cat/sleep/sleep_001.png

assets/cat/happy/happy_000.png
assets/cat/happy/happy_001.png

assets/cat/drag/drag_000.png

assets/cat/walk_left/walk_left_000.png
assets/cat/walk_right/walk_right_000.png
```

### 12.2 AI 生成素材提示词模板

```text
请根据我上传的猫咪照片，设计一个可爱的 2D 卡通桌面宠物形象。

要求：
1. 保留真实猫咪的核心外貌特征：
   - 毛色
   - 花纹
   - 眼睛颜色
   - 耳朵形状
   - 尾巴特点
   - 脸型
2. 风格为 clean cute 2D mascot。
3. 适合桌面宠物应用。
4. 背景透明。
5. 角色轮廓清晰。
6. 不要加入复杂背景。
7. 不要加入文字。
8. 不要生成其他动物。
9. 输出多个动作帧：
   - idle
   - sleep
   - happy
   - drag
   - walk_left
   - walk_right
10. 所有动作必须保持同一个角色、同一种画风。
```

---

## 13. IPC 设计

### 13.1 IPC Channel 命名

```ts
export const IPC_CHANNELS = {
  WINDOW_GET_POSITION: 'window:get-position',
  WINDOW_SET_POSITION: 'window:set-position',
  WINDOW_SET_SIZE: 'window:set-size',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
  WINDOW_SET_CLICK_THROUGH: 'window:set-click-through',
  WINDOW_HIDE: 'window:hide',
  WINDOW_SHOW: 'window:show',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',

  PET_SET_STATE: 'pet:set-state',
  PET_TRIGGER_ACTION: 'pet:trigger-action',
} as const;
```

### 13.2 Preload API

```ts
contextBridge.exposeInMainWorld('mochiCat', {
  window: {
    getPosition: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_POSITION),
    setPosition: (x: number, y: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_POSITION, { x, y }),
    setSize: (size: 'small' | 'medium' | 'large') =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_SIZE, size),
    setAlwaysOnTop: (enabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, enabled),
    setClickThrough: (enabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_CLICK_THROUGH, enabled),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (settings: Partial<UserSettings>) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, settings),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
  },
});
```

---

## 14. Renderer 状态管理

### 14.1 Zustand Store

```ts
interface PetStore {
  currentState: PetState;
  previousState: PetState | null;
  isDragging: boolean;
  bubbleText: string | null;
  settings: UserSettings | null;

  setState: (state: PetState) => void;
  startDragging: () => void;
  stopDragging: () => void;
  showBubble: (text: string) => void;
  hideBubble: () => void;
  setSettings: (settings: UserSettings) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}
```

### 14.2 状态变更原则

```text
1. renderer store 管理 UI 状态。
2. main process 管理系统级状态。
3. 设置变更必须先写入 main process，再同步给 renderer。
4. 窗口移动必须通过 IPC 交给 main process。
```

---

## 15. 开发阶段划分

### Phase 0：项目初始化

目标：

```text
创建 Electron + React + TypeScript + Vite 项目。
```

验收：

```text
npm install 成功。
npm start 可以启动应用。
React 页面可以正常显示。
```

Codex 任务：

```text
Initialize an Electron + Vite + TypeScript + React project for a macOS desktop pet app.
Set up the main process, preload process, and renderer process.
Use contextIsolation: true and nodeIntegration: false.
Keep the project structure modular.
```

---

### Phase 1：透明悬浮窗口

目标：

```text
创建透明、无边框、置顶窗口。
```

验收：

```text
桌面出现一个 300x300 的透明窗口。
窗口中显示占位猫图。
窗口没有标题栏。
背景没有白色或黑色方块。
```

Codex 任务：

```text
Create a frameless transparent always-on-top BrowserWindow for the desktop pet.
The window should be 300x300, transparent, non-resizable, and skip the taskbar.
Load the React renderer and display a placeholder cat image.
```

---

### Phase 2：拖拽窗口

目标：

```text
用户可以拖拽猫咪窗口。
```

验收：

```text
鼠标按住猫咪可以移动。
拖拽时状态为 drag。
松开后状态回到 idle。
```

Codex 任务：

```text
Implement custom drag behavior for the pet window.
Use renderer mouse events and IPC to move the BrowserWindow in the main process.
Set the pet state to drag during dragging and return to idle after mouseup.
```

---

### Phase 3：帧动画系统

目标：

```text
根据 PetState 播放不同帧动画。
```

验收：

```text
idle 动画可以循环。
sleep / happy / drag 可以切换。
不同动画支持不同 fps。
```

Codex 任务：

```text
Implement a frame-based animation system.
Create animationConfig.ts, useAnimation.ts, and PetSprite.tsx.
The system should support fps, loop, and onComplete callback.
```

---

### Phase 4：状态机和随机行为

目标：

```text
猫咪拥有自主行为。
```

验收：

```text
双击进入 happy。
无操作进入 sleep。
随机进入 walk_left 或 walk_right。
用户操作优先级高于随机行为。
```

Codex 任务：

```text
Implement the pet behavior state machine.
Add double click happy behavior, inactivity sleep behavior, and random autonomous behavior every 10-30 seconds.
Ensure drag and user actions have higher priority than random behavior.
```

---

### Phase 5：右键菜单和托盘

目标：

```text
通过菜单控制猫咪。
```

验收：

```text
右键菜单可以触发动作。
托盘可以显示、隐藏、退出。
```

Codex 任务：

```text
Implement native Electron context menu and tray menu.
The context menu should support pet, feed, sleep, wake, size change, toggle always-on-top, toggle click-through, hide, and quit.
```

---

### Phase 6：设置持久化

目标：

```text
保存用户设置。
```

验收：

```text
修改大小、置顶、点击穿透后，重启应用仍然生效。
```

Codex 任务：

```text
Implement a SettingsService in the main process.
Store settings in settings.json under Electron userData.
Expose get, update, and reset settings through IPC.
```

---

### Phase 7：气泡系统

目标：

```text
交互时显示猫咪气泡文字。
```

验收：

```text
双击、喂食、睡觉、拖拽时显示对应气泡。
气泡自动消失。
设置关闭后不显示。
```

Codex 任务：

```text
Implement a speech bubble system in React.
The bubble should appear above the pet, fade in and out, and be triggered by interactions.
Respect the speechBubbleEnabled setting.
```

---

## 16. MVP 验收清单

MVP 完成时必须满足：

```text
[ ] 应用可以通过 npm start 启动。
[ ] macOS 桌面显示透明猫咪窗口。
[ ] 窗口无边框。
[ ] 窗口默认置顶。
[ ] 猫咪可以被拖拽。
[ ] 拖拽时切换到 drag 状态。
[ ] 松开鼠标后回到 idle。
[ ] 双击触发 happy 状态。
[ ] 无操作一段时间后进入 sleep。
[ ] 猫咪可以随机 walk_left / walk_right。
[ ] 右键菜单可以正常打开。
[ ] 右键菜单可以退出应用。
[ ] 托盘菜单可以显示或隐藏猫咪。
[ ] 设置可以持久化。
[ ] TypeScript 无编译错误。
[ ] 控制台无明显运行时报错。
```

---

## 17. 开发原则

### 17.1 Vibe Coding 原则

每次只让 LLM 完成一个模块，不要一次性生成整个项目。

推荐流程：

```text
1. 描述当前 phase 的目标。
2. 让 LLM 先列出需要修改的文件。
3. 确认文件结构。
4. 让 LLM 生成代码。
5. 本地运行。
6. 把报错贴给 LLM。
7. 只修当前 phase 的问题。
8. 验收通过后再进入下一 phase。
```

### 17.2 每次 Prompt 模板

```text
We are building MochiCat, a macOS desktop pet app.

Current phase:
[填写当前 phase]

Goal:
[填写本阶段目标]

Existing stack:
Electron + React + TypeScript + Vite + Zustand.

Constraints:
1. Keep code modular.
2. Do not change unrelated files.
3. Use TypeScript types.
4. Use IPC for main-renderer communication.
5. Avoid unsafe Electron settings.
6. Explain how to test after implementing.

Before writing code, list the files you will create or modify.
```

---

## 18. 后续扩展方向

MVP 完成后，可以继续扩展：

```text
1. 心情值系统
2. 饥饿值系统
3. 体力值系统
4. 桌面巡逻
5. 番茄钟陪伴
6. 喝水提醒
7. 日程提醒
8. 天气反应
9. 节日皮肤
10. 桌面道具
11. 鼠标追踪
12. 打字活跃度感知
13. 多动作素材包
14. Live2D / Rive 动画升级
15. LLM 气泡对话
```

---

## 19. 第一阶段最小实现建议

强烈建议第一天只完成以下内容：

```text
1. Electron 项目启动。
2. 透明窗口显示。
3. 显示一张占位猫图。
4. 可以退出应用。
```

不要在第一天实现：

```text
1. AI 对话。
2. 复杂状态机。
3. 设置面板。
4. 多动画资源。
5. 复杂点击穿透。
```

先保证“桌面上真的出现一只透明猫”，再继续扩展。
