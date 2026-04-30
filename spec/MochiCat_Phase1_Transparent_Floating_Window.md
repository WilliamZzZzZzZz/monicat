# MochiCat Phase 1 开发文档：透明悬浮桌面宠物窗口

版本：v0.1  
阶段：Phase 1  
前置条件：Phase 0 已完成，Electron + React + TypeScript + Vite 项目可以成功启动。  
目标：将普通 Electron 窗口改造成透明、无边框、置顶的桌面宠物窗口。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只实现“桌面宠物窗口形态”，不实现拖拽、动画、菜单、托盘、设置系统。

---

## 1. Phase 1 的目标

Phase 1 的核心目标是：

> 把 Phase 0 中的普通 Electron 窗口改造成一个 300 x 300、透明背景、无边框、默认置顶的桌面宠物窗口，并在窗口中心显示一个临时猫咪占位符。

完成 Phase 1 后，启动应用时，桌面上应该只看到一个小型猫咪占位符，而不是普通应用窗口。

---

## 2. Phase 1 的完成效果

Phase 1 完成后，应用应具备以下表现：

```text
1. Electron 应用可以通过 npm start 启动。
2. 窗口尺寸为 300 x 300。
3. 窗口没有 macOS 标题栏。
4. 窗口没有系统边框。
5. 窗口背景透明。
6. 页面背景透明。
7. 桌面上只显示猫咪占位符。
8. 窗口默认置顶。
9. 窗口不可被用户手动 resize。
10. Electron 安全设置保持不变。
```

---

## 3. Phase 1 不做什么

本阶段只处理窗口形态，不做宠物行为。

禁止实现：

```text
拖拽窗口
帧动画系统
宠物状态机
右键菜单
系统托盘
设置持久化
点击穿透
开机自启
多显示器适配
AI 对话
真实猫咪素材接入
```

原因：

```text
透明窗口是桌面宠物的基础能力。
如果透明窗口不稳定，后续拖拽、动画、菜单都会建立在错误基础上。
```

---

## 4. 当前项目状态

Phase 0 已经完成：

```text
Electron + React + TypeScript + Vite 项目已创建
npm start 可以启动应用
窗口中可以显示 React 页面
页面显示 "MochiCat Desktop Pet - Phase 0"
```

Phase 1 将在这个基础上修改：

```text
Electron BrowserWindow 配置
React 页面内容
Renderer CSS 样式
```

---

## 5. 推荐修改文件

根据 Electron Forge Vite + TypeScript 模板，实际文件名可能略有差异。Codex 应先检查项目结构，再修改对应文件。

常见需要修改的文件：

```text
src/main.ts
src/renderer.tsx 或 src/renderer.ts
src/App.tsx
src/style.css 或 src/index.css
src/index.html
```

如果项目已经拆分为目录结构，也可能是：

```text
src/main/main.ts
src/main/window.ts
src/renderer/main.tsx
src/renderer/App.tsx
src/renderer/styles/global.css
```

Phase 1 不应大规模重构目录。  
如果 Phase 0 是 Electron Forge 默认结构，则优先沿用默认结构。

---

## 6. BrowserWindow 配置 Spec

### 6.1 目标窗口配置

Electron 主进程中创建窗口时，需要将 BrowserWindow 改成桌面宠物窗口。

目标配置：

```ts
const mainWindow = new BrowserWindow({
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
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

注意：

```text
1. preload 的实际写法取决于当前模板。
2. 不要破坏 Phase 0 中已经可用的 preload 配置。
3. 不要为了快速运行而打开 nodeIntegration。
4. 不要关闭 contextIsolation。
```

---

## 7. macOS 窗口行为要求

### 7.1 窗口置顶

需要默认置顶：

```ts
mainWindow.setAlwaysOnTop(true, 'floating');
```

如果 `'floating'` 在当前环境表现异常，可以先使用：

```ts
mainWindow.setAlwaysOnTop(true);
```

### 7.2 所有桌面空间显示

可以加入：

```ts
mainWindow.setVisibleOnAllWorkspaces(true, {
  visibleOnFullScreen: true,
});
```

如果该 API 在当前环境导致报错，可以暂时移除。  
Phase 1 的硬性要求是透明、无边框、置顶，不强制完成所有桌面空间适配。

### 7.3 DevTools

开发阶段可以保留 DevTools，但建议不要默认打开。

推荐策略：

```text
development 环境：
- 可以通过快捷键或代码临时打开 DevTools

production 环境：
- 不自动打开 DevTools
```

Phase 1 中如果窗口太小不方便调试，可以临时打开 DevTools。  
验收最终效果时应关闭 DevTools。

---

## 8. Renderer 页面 Spec

### 8.1 App 组件目标

Phase 1 不再显示大段文本，而是显示一个简单猫咪占位符。

示例：

```tsx
export default function App() {
  return (
    <main className="pet-window">
      <div className="pet-placeholder" aria-label="MochiCat placeholder">
        🐱
      </div>
    </main>
  );
}
```

### 8.2 Renderer 样式目标

HTML、body、root、React 容器都必须透明。

示例 CSS：

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

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  user-select: none;
}

.pet-window {
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.pet-placeholder {
  font-size: 96px;
  line-height: 1;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.18));
}
```

### 8.3 重要 CSS 原则

必须确认：

```text
1. html 背景透明。
2. body 背景透明。
3. #root 背景透明。
4. App 根容器背景透明。
5. 不要给 body 设置白色背景。
6. 不要给 root 设置白色背景。
7. 不要保留 Phase 0 的 max-width、padding、大段文字样式。
```

Phase 0 中类似下面的样式需要删除或替换：

```css
body {
  margin: auto;
  max-width: 38rem;
  padding: 2rem;
}
```

这些样式适合普通网页，但不适合桌面宠物窗口。

---

## 9. Codex 执行任务 Prompt

可以直接把以下内容交给 Codex。

```text
We have completed Phase 0 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The renderer displays:
  "MochiCat Desktop Pet - Phase 0"
- Now we are starting Phase 1.

Current phase:
Phase 1 - Transparent Floating Pet Window

Goal:
Convert the normal Electron window into a desktop pet style window.

Requirements:
1. Modify the Electron BrowserWindow configuration.
2. The window should be 300 x 300.
3. The window should be frameless.
4. The window should have a transparent background.
5. The window should be non-resizable.
6. The window should be always on top.
7. The window should not appear in the taskbar / Dock if possible.
8. Use backgroundColor: '#00000000'.
9. Keep Electron security settings:
   - contextIsolation: true
   - nodeIntegration: false
   - preload script enabled
10. Do not implement dragging yet.
11. Do not implement animation yet.
12. Do not implement tray yet.
13. Do not implement settings yet.
14. Only implement the transparent desktop pet window.

Renderer requirements:
1. Replace the Phase 0 page with a simple centered placeholder pet.
2. Use a simple emoji or placeholder element for now, for example 🐱.
3. The renderer background must be transparent.
4. The html, body, and root elements must not have white background.
5. The visible content should be centered inside the 300 x 300 window.
6. Remove Phase 0 page layout styles such as max-width, margin auto, and large text page layout.

Before writing code:
1. Inspect the current project structure.
2. List the files you will modify.
3. Explain the BrowserWindow changes.
4. Then implement the changes.

After implementation:
1. Explain how to run the app.
2. Explain how to verify Phase 1 is complete.
3. List the files changed.
```

---

## 10. 建议 Codex 修改步骤

Codex 应按以下顺序修改：

```text
1. 查看当前项目结构。
2. 找到 BrowserWindow 创建位置。
3. 修改 BrowserWindow 配置。
4. 保留 preload 和安全配置。
5. 找到 React App 组件。
6. 删除 Phase 0 的文字页面。
7. 替换为猫咪占位符。
8. 找到全局 CSS。
9. 将 html、body、root 背景改为 transparent。
10. 移除普通网页布局样式。
11. 运行 npm start。
12. 根据实际报错修正。
```

---

## 11. Phase 1 验收标准

完成后逐项检查：

```text
[ ] npm start 可以正常启动应用。
[ ] Electron 窗口尺寸约为 300 x 300。
[ ] 窗口没有 macOS 标题栏。
[ ] 窗口没有系统边框。
[ ] 窗口背景透明。
[ ] 页面背景透明。
[ ] 桌面上只显示一个猫咪占位符。
[ ] 没有白色矩形背景。
[ ] 窗口默认置顶。
[ ] 窗口不可手动调整大小。
[ ] 页面不再显示 Phase 0 大标题。
[ ] TypeScript 没有编译错误。
[ ] DevTools Console 没有明显运行时报错。
```

---

## 12. 手动测试流程

### 12.1 启动应用

```bash
npm start
```

观察：

```text
1. 是否出现 300 x 300 小窗口。
2. 是否只显示猫咪占位符。
3. 是否还有标题栏。
4. 是否有白色背景。
5. 是否可以 resize。
```

### 12.2 测试透明背景

测试方法：

```text
1. 把窗口移动到不同颜色的桌面背景或不同应用窗口上方。
2. 观察猫咪占位符周围是否透明。
3. 如果猫咪周围出现白色或黑色方块，说明透明背景未完成。
```

### 12.3 测试置顶

测试方法：

```text
1. 打开任意普通应用窗口，例如 Finder 或 VS Code。
2. 将普通应用窗口移动到猫咪位置。
3. 如果猫咪仍然显示在上方，置顶成功。
```

### 12.4 测试不可 resize

测试方法：

```text
1. 尝试拖动窗口边缘。
2. 如果窗口大小不能改变，resizable: false 生效。
```

---

## 13. 常见问题与处理方式

### 13.1 仍然出现白色背景

可能原因：

```text
1. BrowserWindow 没有设置 transparent: true。
2. BrowserWindow 没有设置 backgroundColor: '#00000000'。
3. CSS 中 body 仍然有白色背景。
4. CSS 中 #root 或 App 容器仍然有背景色。
5. Phase 0 的页面样式没有清理。
```

处理：

```text
1. 检查 BrowserWindow 配置。
2. 检查 html、body、#root 的 CSS。
3. 检查 App 根元素是否设置了 background。
4. 删除普通网页布局样式。
```

---

### 13.2 仍然有标题栏

可能原因：

```text
BrowserWindow 没有设置 frame: false。
```

处理：

```ts
frame: false
```

---

### 13.3 窗口不是 300 x 300

可能原因：

```text
1. BrowserWindow width / height 没有修改。
2. 应用保存了旧窗口尺寸。
3. CSS 容器尺寸和 BrowserWindow 尺寸不一致。
```

处理：

```ts
width: 300,
height: 300,
resizable: false,
```

CSS 中：

```css
.pet-window {
  width: 300px;
  height: 300px;
}
```

---

### 13.4 窗口太小，DevTools 无法使用

处理方式：

```text
开发调试阶段可以临时把窗口改大，例如 600 x 400。
验收 Phase 1 时必须改回 300 x 300。
```

或者临时打开外部 DevTools，调试完成后关闭。

---

### 13.5 macOS 透明窗口不生效

检查：

```text
1. BrowserWindow 是否设置 transparent: true。
2. backgroundColor 是否为 '#00000000'。
3. CSS 背景是否 transparent。
4. 是否有其它父元素设置背景。
5. 是否有 DevTools 停靠在窗口内影响观察。
```

注意：

```text
打开 DevTools 时，窗口本身会显示 DevTools 区域。
验收透明效果时应关闭 DevTools。
```

---

### 13.6 窗口无法移动

这是 Phase 1 的正常现象。

原因：

```text
Phase 1 设置了 frame: false。
无边框窗口没有系统标题栏，因此不能通过标题栏拖动。
```

解决：

```text
Phase 2 会实现自定义拖拽。
Phase 1 不需要处理窗口拖拽。
```

---

## 14. Phase 1 完成后的 Git 提交建议

如果 Phase 1 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add transparent floating pet window"
```

---

## 15. 下一阶段预告

Phase 1 完成后进入：

```text
Phase 2 - Custom Window Dragging
```

Phase 2 目标：

```text
1. 用户可以用鼠标按住猫咪占位符拖动窗口。
2. 拖拽开始时切换为 drag 状态。
3. 拖拽结束后回到 idle 状态。
4. 通过 IPC 让 renderer 请求 main process 移动 BrowserWindow。
```

Phase 2 之前不要实现完整动画系统。  
拖拽是桌面宠物最核心的交互基础，应该先独立完成。
