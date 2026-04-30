# MochiCat Phase 0 开发文档：项目初始化

版本：v0.1  
阶段：Phase 0  
目标：从 0 个代码文件开始，初始化一个可运行的 Electron + React + TypeScript + Vite 项目骨架。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只搭建工程基础，不实现桌面宠物功能。

---

## 1. Phase 0 的目标

Phase 0 的唯一目标是：

> 创建一个可以成功启动的 Electron + React + TypeScript 项目，并在 Electron 窗口中显示一个最简单的 React 页面。

完成 Phase 0 后，项目应该满足：

```text
npm install 成功
npm start 成功
Electron 应用可以启动
Electron 窗口中显示 React 页面
项目使用 TypeScript
项目具备 main / preload / renderer 三层结构
```

---

## 2. Phase 0 不做什么

Phase 0 不实现任何桌面宠物功能。

本阶段禁止实现：

```text
透明窗口
无边框窗口
置顶窗口
桌面宠物动画
猫咪拖拽
右键菜单
系统托盘
设置持久化
点击穿透
随机行为状态机
AI 对话
猫咪图片生成
```

原因：

```text
Phase 0 的重点是建立稳定工程骨架。
如果项目初始化阶段就加入太多功能，后续调试会变得混乱。
```

---

## 3. 推荐技术栈

```text
Electron
React
ReactDOM
TypeScript
Vite
Electron Forge
```

推荐初始化模板：

```bash
npx create-electron-app@latest mochi-cat --template=vite-typescript
```

之后再加入 React：

```bash
cd mochi-cat
npm install react react-dom
npm install -D @types/react @types/react-dom
```

---

## 4. Phase 0 最终目录目标

完成后，项目应大致包含：

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
│   ├── main.ts
│   ├── preload.ts
│   ├── renderer.ts
│   ├── index.html
│   ├── App.tsx
│   └── style.css
│
└── node_modules/
```

如果 Electron Forge 模板生成的文件名或结构略有不同，可以接受。  
Phase 0 的重点不是目录完全一致，而是项目能够稳定启动。

---

## 5. Codex 执行任务 Prompt

你可以把下面这段直接交给 Codex 执行。

```text
We are starting a new project from zero code files.

Project name:
mochi-cat

Current phase:
Phase 0 - Project Initialization

Goal:
Initialize the foundation of a macOS desktop pet app using Electron + React + TypeScript + Vite.

The final app will become a transparent desktop pet app, but Phase 0 should only create a working project foundation.

Requirements:
1. Create a new Electron project using Electron Forge with the Vite + TypeScript template.
2. Add React and ReactDOM to the renderer process.
3. Configure the renderer to render a simple React App component.
4. The Electron window should display this text:
   "MochiCat Desktop Pet - Phase 0"
5. Keep Electron security settings:
   - contextIsolation: true
   - nodeIntegration: false
   - use a preload script
6. Use TypeScript.
7. Keep the code modular and readable.
8. Do not implement desktop pet behavior yet.
9. Do not implement transparent window yet.
10. Do not implement animation, dragging, tray, settings, or complex IPC yet.

Before writing code:
1. Tell me the exact shell commands you will run.
2. Tell me the files you will create or modify.

After implementation:
1. Explain how to run the app.
2. Explain how to verify Phase 0 is complete.
3. List the files changed.
```

---

## 6. Codex 应执行的 Shell 命令

建议命令：

```bash
npx create-electron-app@latest mochi-cat --template=vite-typescript
cd mochi-cat
npm install react react-dom
npm install -D @types/react @types/react-dom
npm start
```

如果 Codex 已经在 `mochi-cat` 目录内部执行，则不要重复创建项目目录。  
此时应只执行：

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
npm start
```

---

## 7. Phase 0 代码要求

### 7.1 React App 组件

需要创建或修改 `App.tsx`。

目标页面内容：

```tsx
export default function App() {
  return (
    <main className="app">
      <h1>MochiCat Desktop Pet - Phase 0</h1>
      <p>Electron + React + TypeScript is running.</p>
    </main>
  );
}
```

### 7.2 Renderer 入口

Renderer 入口需要使用 ReactDOM 渲染 App。

示例：

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 7.3 HTML 入口

`index.html` 中需要包含：

```html
<div id="root"></div>
```

### 7.4 Electron 安全设置

Main process 中的 BrowserWindow 必须保持：

```ts
webPreferences: {
  preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY 或对应 preload 路径,
  contextIsolation: true,
  nodeIntegration: false,
}
```

具体变量名取决于 Electron Forge 模板生成结果。

---

## 8. Phase 0 验收标准

完成后逐项检查：

```text
[ ] 项目目录 mochi-cat 已创建。
[ ] package.json 存在。
[ ] npm install 成功完成。
[ ] React 和 ReactDOM 已安装。
[ ] TypeScript 类型依赖已安装。
[ ] npm start 可以启动应用。
[ ] Electron 窗口成功出现。
[ ] 页面显示 "MochiCat Desktop Pet - Phase 0"。
[ ] 页面显示 "Electron + React + TypeScript is running."。
[ ] DevTools 或终端中没有明显 TypeScript 编译错误。
[ ] DevTools 或终端中没有 preload / renderer / main process 报错。
```

---

## 9. 常见问题与处理方式

### 9.1 npm start 报错找不到 React

可能原因：

```text
react 或 react-dom 没有安装。
```

解决：

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
```

---

### 9.2 页面空白

可能原因：

```text
index.html 中没有 root 节点
renderer 入口没有正确挂载 React
Vite renderer 配置路径不正确
```

检查：

```text
1. index.html 是否有 <div id="root"></div>
2. renderer.tsx 是否调用 createRoot
3. App.tsx 是否默认导出 App
4. 控制台是否有报错
```

---

### 9.3 TypeScript 报 JSX 错误

可能原因：

```text
tsconfig 没有启用 JSX。
```

检查 `tsconfig.json` 中是否有：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

---

### 9.4 preload 路径报错

不要手写猜测路径。  
优先沿用 Electron Forge Vite 模板生成的 preload 入口变量或路径。

原则：

```text
Phase 0 不重构 preload。
只保证 preload 存在，并且 BrowserWindow 正确加载。
```

---

## 10. Phase 0 完成后的 Git 提交建议

完成 Phase 0 后建议提交：

```bash
git add .
git commit -m "chore: initialize Electron React TypeScript app"
```

---

## 11. 下一阶段预告

Phase 0 完成后，进入 Phase 1：

```text
Phase 1 - Transparent Pet Window

目标：
将普通 Electron 窗口改造成桌面宠物窗口。

功能：
1. 300 x 300 窗口
2. 透明背景
3. 无边框
4. 不可调整大小
5. 默认置顶
6. 显示占位猫咪图片
```

Phase 1 之前不要急着写动画系统。  
先保证桌面宠物的窗口形态正确。
