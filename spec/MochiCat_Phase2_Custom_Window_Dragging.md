# MochiCat Phase 2 开发文档：自定义拖拽窗口

版本：v0.1  
阶段：Phase 2  
前置条件：Phase 1 已完成，桌面上已经可以显示 300 x 300、透明、无边框、置顶的小猫占位符。  
目标：实现桌面宠物窗口的自定义拖拽能力。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只实现“拖拽移动窗口”，不实现动画、完整状态机、菜单、托盘、设置持久化。

---

## 1. Phase 2 的目标

Phase 2 的核心目标是：

> 用户可以用鼠标左键按住桌面上的小猫占位符，并将整个 Electron 窗口拖动到桌面任意位置。

Phase 1 中已经将窗口设置为：

```text
transparent: true
frame: false
alwaysOnTop: true
resizable: false
```

因为窗口已经 `frame: false`，macOS 原生标题栏不存在，所以用户不能通过标题栏拖动窗口。  
Phase 2 需要通过 renderer 鼠标事件 + preload 安全 API + IPC + main process 的 `BrowserWindow.setPosition()` 手动实现拖拽。

---

## 2. Phase 2 完成效果

Phase 2 完成后，应用应具备以下表现：

```text
1. npm start 可以正常启动应用。
2. 桌面上仍然只显示透明背景的小猫占位符。
3. 鼠标移动到小猫上时，cursor 显示为 grab。
4. 鼠标左键按住小猫时，cursor 显示为 grabbing。
5. 按住并移动鼠标时，整个桌面宠物窗口跟随鼠标移动。
6. 松开鼠标后，窗口停留在新位置。
7. 拖拽过程中不出现白色背景。
8. Electron 安全配置保持不变。
9. TypeScript 无编译错误。
```

---

## 3. Phase 2 不做什么

本阶段只实现自定义拖拽。

禁止实现：

```text
帧动画系统
完整 PetState 状态机
右键菜单
系统托盘
设置持久化
点击穿透
开机自启
多显示器边界处理
屏幕边缘碰撞检测
AI 对话
真实猫咪素材接入
```

原因：

```text
拖拽是桌面宠物最基础的交互能力。
在动画和状态机之前，必须先确认窗口本身可以被稳定移动。
```

---

## 4. 当前项目状态

Phase 1 已完成：

```text
Electron + React + TypeScript + Vite 项目可以启动
窗口尺寸约为 300 x 300
窗口无边框
窗口背景透明
窗口默认置顶
窗口中央显示猫咪 emoji 占位符
```

Phase 2 将在此基础上增加：

```text
1. Main process 中的窗口位置 IPC handler
2. Preload 中暴露给 renderer 的安全窗口 API
3. Renderer 中的鼠标拖拽逻辑
4. 拖拽状态样式
```

---

## 5. 推荐修改文件

根据 Electron Forge Vite + TypeScript 模板，实际文件名可能略有差异。Codex 应先检查当前项目结构，再修改对应文件。

常见需要修改的文件：

```text
src/main.ts
src/preload.ts
src/App.tsx
src/style.css
```

如果项目已经拆分为目录结构，也可能是：

```text
src/main/main.ts
src/main/ipc.ts
src/main/window.ts
src/preload/preload.ts
src/renderer/App.tsx
src/renderer/hooks/useDragWindow.ts
src/renderer/styles/global.css
src/shared/ipcChannels.ts
src/shared/types.ts
```

本阶段允许新增：

```text
src/shared/ipcChannels.ts
src/renderer/hooks/useDragWindow.ts
src/types/global.d.ts
```

但如果当前项目仍然是简单结构，不建议过度拆分。  
Phase 2 的目标是拖拽跑通，不是重构目录。

---

## 6. 拖拽系统架构

### 6.1 数据流

Phase 2 的拖拽数据流如下：

```text
Renderer 鼠标事件
        ↓
window.mochiCat.window.getPosition()
        ↓
Preload 安全 API
        ↓
ipcRenderer.invoke('window:get-position')
        ↓
Main Process
        ↓
BrowserWindow.getPosition()

Renderer 鼠标移动
        ↓
window.mochiCat.window.setPosition(x, y)
        ↓
Preload 安全 API
        ↓
ipcRenderer.invoke('window:set-position', { x, y })
        ↓
Main Process
        ↓
BrowserWindow.setPosition(x, y)
```

### 6.2 为什么必须通过 IPC

Renderer process 不应该直接访问 Node.js 或 Electron 的主进程能力。

必须保持：

```text
contextIsolation: true
nodeIntegration: false
```

因此，renderer 不能直接调用 `BrowserWindow.setPosition()`。  
正确做法是：

```text
Renderer 只负责计算拖拽偏移量
Main Process 负责真正移动窗口
Preload 负责暴露有限、安全的 API
```

---

## 7. IPC Channel 设计

建议定义两个 IPC channel：

```ts
export const IPC_CHANNELS = {
  WINDOW_GET_POSITION: 'window:get-position',
  WINDOW_SET_POSITION: 'window:set-position',
} as const;
```

如果当前项目还没有 shared 文件夹，可以先直接在 main 和 preload 中使用字符串。  
但从工程可维护性角度，推荐创建：

```text
src/shared/ipcChannels.ts
```

---

## 8. Main Process Spec

### 8.1 需要实现的能力

Main process 需要处理两个请求：

```text
window:get-position
window:set-position
```

### 8.2 getPosition 行为

```ts
ipcMain.handle('window:get-position', () => {
  return mainWindow.getPosition();
});
```

返回值：

```ts
[number, number]
```

含义：

```text
[windowX, windowY]
```

### 8.3 setPosition 行为

```ts
ipcMain.handle('window:set-position', (_event, position: { x: number; y: number }) => {
  mainWindow.setPosition(Math.round(position.x), Math.round(position.y));
});
```

要求：

```text
1. x 和 y 必须是 number。
2. 设置位置前最好 Math.round。
3. 不要在 renderer 中直接移动窗口。
4. 不要打开 nodeIntegration。
```

### 8.4 mainWindow 引用

Main process 需要能够访问当前 BrowserWindow 实例。

如果当前项目中 `mainWindow` 是局部变量，需要注意：

```text
1. IPC handler 必须能访问 mainWindow。
2. 不要创建多个无关窗口。
3. 如果窗口已销毁，应避免调用 setPosition。
```

建议处理：

```ts
if (!mainWindow || mainWindow.isDestroyed()) {
  return;
}
```

---

## 9. Preload Spec

### 9.1 暴露 API

Preload 需要通过 `contextBridge.exposeInMainWorld` 暴露安全 API：

```ts
contextBridge.exposeInMainWorld('mochiCat', {
  window: {
    getPosition: () => ipcRenderer.invoke('window:get-position'),
    setPosition: (x: number, y: number) =>
      ipcRenderer.invoke('window:set-position', { x, y }),
  },
});
```

### 9.2 安全要求

必须保持：

```text
1. 不暴露完整 ipcRenderer。
2. 不暴露 Node.js API。
3. 不允许 renderer 传入任意 channel。
4. 只暴露本阶段需要的 getPosition 和 setPosition。
```

错误示例：

```ts
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);
```

禁止这样做，因为它把过多权限暴露给 renderer。

---

## 10. TypeScript 全局类型声明

为了让 renderer 中的 `window.mochiCat` 不报 TypeScript 错误，建议新增或修改全局声明文件。

示例文件：

```text
src/types/global.d.ts
```

内容：

```ts
export {};

declare global {
  interface Window {
    mochiCat: {
      window: {
        getPosition: () => Promise<[number, number]>;
        setPosition: (x: number, y: number) => Promise<void>;
      };
    };
  }
}
```

如果项目已有类似 `types.d.ts`，可以合并进去。  
不要重复声明多个冲突的 `Window` 类型。

---

## 11. Renderer 拖拽逻辑 Spec

### 11.1 拖拽状态

Renderer 需要维护一个简单状态：

```ts
const [isDragging, setIsDragging] = useState(false);
```

也可以通过 `useRef` 保存拖拽过程数据：

```ts
const dragStartRef = useRef<{
  mouseX: number;
  mouseY: number;
  windowX: number;
  windowY: number;
} | null>(null);
```

### 11.2 mousedown

当用户按下鼠标左键：

```text
1. 如果不是左键，直接忽略。
2. 获取当前鼠标屏幕坐标：
   - event.screenX
   - event.screenY
3. 调用 window.mochiCat.window.getPosition()
4. 保存初始窗口位置：
   - windowX
   - windowY
5. 保存初始鼠标位置：
   - mouseX
   - mouseY
6. 设置 isDragging = true
```

示例逻辑：

```ts
const handleMouseDown = async (event: React.MouseEvent) => {
  if (event.button !== 0) return;

  const [windowX, windowY] = await window.mochiCat.window.getPosition();

  dragStartRef.current = {
    mouseX: event.screenX,
    mouseY: event.screenY,
    windowX,
    windowY,
  };

  setIsDragging(true);
};
```

### 11.3 mousemove

当鼠标移动：

```text
1. 如果当前不是 dragging，忽略。
2. 计算鼠标偏移：
   - deltaX = event.screenX - mouseX
   - deltaY = event.screenY - mouseY
3. 新窗口位置：
   - nextX = windowX + deltaX
   - nextY = windowY + deltaY
4. 通过 IPC 请求 main process 设置窗口位置。
```

示例逻辑：

```ts
const handleMouseMove = async (event: MouseEvent) => {
  const dragStart = dragStartRef.current;
  if (!dragStart) return;

  const deltaX = event.screenX - dragStart.mouseX;
  const deltaY = event.screenY - dragStart.mouseY;

  await window.mochiCat.window.setPosition(
    dragStart.windowX + deltaX,
    dragStart.windowY + deltaY
  );
};
```

### 11.4 mouseup

当鼠标松开：

```text
1. 清空 dragStartRef。
2. 设置 isDragging = false。
```

示例：

```ts
const stopDragging = () => {
  dragStartRef.current = null;
  setIsDragging(false);
};
```

### 11.5 全局 mousemove / mouseup

不要只在猫咪元素上监听 `mousemove` 和 `mouseup`。  
原因是鼠标拖拽很容易离开元素区域。

推荐在拖拽开始后绑定：

```ts
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', stopDragging);
```

拖拽结束后清理：

```ts
window.removeEventListener('mousemove', handleMouseMove);
window.removeEventListener('mouseup', stopDragging);
```

---

## 12. useDragWindow Hook 建议

如果当前项目结构允许，推荐将拖拽逻辑封装为 hook：

```text
src/renderer/hooks/useDragWindow.ts
```

Hook 接口：

```ts
export function useDragWindow(): {
  isDragging: boolean;
  handleMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
}
```

App 中使用：

```tsx
const { isDragging, handleMouseDown } = useDragWindow();

return (
  <main className="pet-window">
    <button
      className={`pet-placeholder ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      aria-label="MochiCat placeholder"
    >
      🐱
    </button>
  </main>
);
```

如果不想使用 button，也可以使用 div。  
但如果使用 button，需要清理默认样式：

```css
.pet-placeholder {
  border: none;
  background: transparent;
  padding: 0;
}
```

---

## 13. CSS 样式要求

### 13.1 普通状态

```css
.pet-placeholder {
  font-size: 96px;
  line-height: 1;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  background: transparent;
  border: none;
  padding: 0;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.18));
}
```

### 13.2 拖拽状态

```css
.pet-placeholder.dragging {
  cursor: grabbing;
  transform: scale(0.96);
}
```

### 13.3 透明背景仍然必须保持

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
}
```

---

## 14. Codex 执行任务 Prompt

可以直接把以下内容交给 Codex。

```text
We have completed Phase 1 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The app shows a transparent frameless 300x300 always-on-top window.
- The renderer displays a centered cat placeholder emoji.
- There is no visible window frame or white background.

Now we are starting Phase 2.

Current phase:
Phase 2 - Custom Window Dragging

Goal:
Allow the user to drag the desktop pet around the macOS desktop by clicking and holding the visible cat placeholder.

Requirements:
1. Implement custom dragging for the frameless transparent Electron window.
2. The user should be able to press the left mouse button on the cat placeholder and drag the whole window.
3. When dragging starts, the renderer should enter a simple "dragging" UI state.
4. When dragging ends, the renderer should leave the "dragging" UI state.
5. Use IPC to move the BrowserWindow from the main process.
6. Do not use nodeIntegration.
7. Keep contextIsolation: true.
8. Expose a safe window movement API from preload.
9. Do not implement animation yet.
10. Do not implement a full pet state machine yet.
11. Do not implement tray, menu, settings, or persistence yet.
12. Only implement custom window dragging.

Implementation requirements:
1. Add IPC channels:
   - window:get-position
   - window:set-position
2. In the main process:
   - handle window:get-position by returning BrowserWindow.getPosition()
   - handle window:set-position by calling BrowserWindow.setPosition(x, y)
3. In the preload script:
   - expose window.mochiCat.window.getPosition()
   - expose window.mochiCat.window.setPosition(x, y)
4. In the renderer:
   - implement mouse down, mouse move, and mouse up logic
   - on mouse down, store the initial mouse screen position and initial window position
   - on mouse move, calculate deltaX and deltaY
   - call setPosition(initialWindowX + deltaX, initialWindowY + deltaY)
   - on mouse up, stop dragging
5. The cat placeholder should show cursor: grab normally and cursor: grabbing while dragging.
6. Avoid changing unrelated files.
7. Preserve the transparent window behavior from Phase 1.

Before writing code:
1. Inspect the current project structure.
2. List the files you will create or modify.
3. Explain how the IPC drag flow will work.
4. Then implement the changes.

After implementation:
1. Explain how to run the app.
2. Explain how to verify Phase 2 is complete.
3. List all files changed.
```

---

## 15. 推荐 Codex 修改步骤

Codex 应按以下顺序执行：

```text
1. 查看当前项目结构。
2. 找到 BrowserWindow 创建位置。
3. 在 main process 中添加 window:get-position 和 window:set-position IPC handler。
4. 找到 preload 文件。
5. 通过 contextBridge 暴露 window.mochiCat.window API。
6. 添加 TypeScript 全局声明。
7. 找到 React App 组件。
8. 添加鼠标拖拽逻辑。
9. 添加 cursor: grab / grabbing 样式。
10. 运行 npm start。
11. 如果报错，只修复 Phase 2 相关问题。
```

---

## 16. Phase 2 验收标准

完成后逐项检查：

```text
[ ] npm start 可以正常启动。
[ ] 桌面上仍然只显示透明小猫。
[ ] 鼠标移动到小猫上时显示 grab。
[ ] 按住小猫时显示 grabbing。
[ ] 按住小猫拖动时，整个窗口跟随鼠标移动。
[ ] 松开鼠标后，窗口停留在新位置。
[ ] 拖拽过程中窗口没有白色背景。
[ ] 拖拽过程中没有明显卡顿。
[ ] Electron 安全设置仍为 contextIsolation: true。
[ ] Electron 安全设置仍为 nodeIntegration: false。
[ ] TypeScript 没有编译错误。
[ ] DevTools Console 没有明显运行时报错。
```

---

## 17. 手动测试流程

### 17.1 启动应用

```bash
npm start
```

观察：

```text
1. 小猫是否正常显示。
2. 透明背景是否仍然生效。
3. 是否没有窗口标题栏。
```

### 17.2 测试拖拽

操作：

```text
1. 鼠标移动到小猫上。
2. 按住左键。
3. 向左、右、上、下拖动。
4. 松开鼠标。
```

预期：

```text
1. 鼠标悬停时是 grab。
2. 按住后是 grabbing。
3. 小猫窗口跟随鼠标移动。
4. 松开后停止移动。
```

### 17.3 测试拖拽边界

操作：

```text
1. 将小猫拖到屏幕左侧。
2. 将小猫拖到屏幕右侧。
3. 将小猫拖到 Dock 附近。
```

预期：

```text
窗口可以移动到目标区域。
Phase 2 不要求边界碰撞或自动贴边。
```

### 17.4 测试透明性

操作：

```text
1. 将小猫拖到不同背景区域。
2. 将小猫拖到其他应用窗口上方。
```

预期：

```text
小猫周围仍然透明。
不会出现白色方块。
```

---

## 18. 常见问题与处理方式

### 18.1 TypeScript 报 window.mochiCat 不存在

原因：

```text
缺少全局类型声明。
```

处理：

```text
新增 global.d.ts，并声明 Window.mochiCat。
确认 tsconfig include 包含该 d.ts 文件。
```

---

### 18.2 拖拽没有反应

可能原因：

```text
1. preload 没有正确暴露 API。
2. contextBridge 名称和 renderer 中使用的名称不一致。
3. ipcMain.handle 没有注册。
4. renderer 的 onMouseDown 没有绑定到猫咪元素。
5. BrowserWindow 引用为空。
```

检查：

```text
1. DevTools Console 是否有 window.mochiCat undefined。
2. Main process 终端是否有 IPC 报错。
3. preload 是否真正被 BrowserWindow 加载。
4. onMouseDown 是否触发。
```

---

### 18.3 鼠标移动太快后拖拽中断

可能原因：

```text
mousemove / mouseup 只绑定在猫咪元素上。
鼠标离开元素后事件丢失。
```

处理：

```text
拖拽开始后，把 mousemove 和 mouseup 绑定到 window。
拖拽结束后移除监听。
```

---

### 18.4 窗口移动有明显延迟

可能原因：

```text
每次 mousemove 都 await setPosition，导致移动阻塞。
```

改进：

```text
可以调用 setPosition 但不 await。
或者后续加入 requestAnimationFrame 节流。
```

MVP 推荐：

```ts
void window.mochiCat.window.setPosition(nextX, nextY);
```

---

### 18.5 拖拽时出现文本选中

处理：

```css
user-select: none;
-webkit-user-select: none;
```

也可以在 mousedown 中：

```ts
event.preventDefault();
```

---

### 18.6 拖拽时出现白色背景

可能原因：

```text
CSS 透明背景被修改。
App 根容器新增了背景色。
button 默认背景没有清理。
```

处理：

```css
.pet-placeholder {
  background: transparent;
  border: none;
}
```

并检查：

```css
html,
body,
#root {
  background: transparent;
}
```

---

## 19. 代码质量要求

Phase 2 的代码应满足：

```text
1. 拖拽逻辑尽量独立，不要混入动画逻辑。
2. IPC channel 命名清晰。
3. preload 不暴露多余权限。
4. renderer 不直接访问 Electron 或 Node.js。
5. TypeScript 类型明确。
6. 不修改无关功能。
```

---

## 20. Phase 2 完成后的 Git 提交建议

如果 Phase 2 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add custom pet window dragging"
```

---

## 21. 下一阶段预告

Phase 2 完成后进入：

```text
Phase 3 - Basic Pet State and Interaction
```

建议 Phase 3 做一个轻量版本的状态系统，而不是直接做完整动画系统。

Phase 3 目标可以是：

```text
1. 定义最小 PetState：
   - idle
   - dragging
   - happy
2. 拖拽开始时进入 dragging。
3. 拖拽结束后回到 idle。
4. 双击小猫时进入 happy。
5. happy 持续 2-3 秒后回到 idle。
6. 不接入真实动画素材，先用 emoji 或 CSS 效果区分状态。
```

不要急着进入完整帧动画。  
先把“交互触发状态变化”跑通，再让状态驱动动画。
