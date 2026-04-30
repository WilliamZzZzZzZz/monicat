# MochiCat Phase 4 开发文档：帧动画系统

版本：v0.1  
阶段：Phase 4  
前置条件：Phase 3 已基本完成，桌面宠物已经具备基础状态与交互反馈。  
目标：将 Phase 3 的 emoji / CSS 状态反馈升级为可扩展的图片帧动画系统。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只实现“根据 PetState 播放对应帧序列”的动画基础设施，不接入复杂菜单、托盘、设置持久化或真实 AI 角色生产 pipeline。

---

## 1. Phase 4 的目标

Phase 4 的核心目标是：

> 建立一个可复用的帧动画系统，让当前宠物状态 `PetState` 可以驱动不同图片帧序列播放。

Phase 3 已经实现：

```text
idle
dragging
happy
sleeping
```

Phase 4 要做的是：

```text
idle 状态播放 idle 图片帧
dragging 状态播放 dragging 图片帧
happy 状态播放 happy 图片帧
sleeping 状态播放 sleeping 图片帧
```

本阶段不要求马上使用你家猫的最终素材。  
可以先使用临时占位 PNG / SVG 帧验证动画系统。  
真实猫咪素材后续只要按同样目录和命名规则替换即可。

---

## 2. Phase 4 完成效果

Phase 4 完成后，应用应具备以下表现：

```text
1. npm start 可以正常启动。
2. 桌面宠物窗口仍然透明、无边框、置顶。
3. 小猫仍然可以被拖拽。
4. Phase 3 的 idle / dragging / happy / sleeping 状态逻辑仍然有效。
5. UI 不再主要依赖 emoji 显示状态。
6. 每个 PetState 对应一组动画帧。
7. 当前 PetState 改变时，动画帧序列自动切换。
8. idle 动画可以循环播放。
9. sleeping 动画可以循环播放。
10. dragging 可以显示单帧或低帧率循环。
11. happy 可以播放一次，也可以短暂循环，由当前 Phase 3 状态计时器控制回 idle。
12. 帧切换速度可以通过 fps 配置。
13. TypeScript 无编译错误。
14. Console 无明显运行时报错。
```

---

## 3. Phase 4 不做什么

本阶段只实现帧动画基础设施。

禁止实现：

```text
真实 AI 猫咪形象生成
复杂图片编辑工作流
Live2D / Spine / Rive
骨骼动画
右键菜单
系统托盘
设置持久化
点击穿透
多皮肤系统
资源下载器
云端素材同步
复杂随机行为
完整情绪系统
```

原因：

```text
Phase 4 的重点是让状态机和帧动画系统打通。
真实猫咪素材可以在系统稳定后替换。
```

---

## 4. 当前项目状态

Phase 3 已基本完成：

```text
Electron + React + TypeScript + Vite 项目可以启动
窗口透明、无边框、置顶
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
存在简单 speech bubble
```

Phase 4 要在不破坏这些能力的前提下，替换或升级视觉渲染层。

---

## 5. 推荐技术方案

### 5.1 MVP 推荐方式

使用：

```text
PNG / SVG 单帧图片
+
React <img>
+
useAnimation hook
+
animationConfig
```

最终真实素材推荐：

```text
透明背景 PNG
512 x 512
按状态分类
按帧编号命名
```

开发占位素材可以临时使用：

```text
SVG
PNG
或者简单几张不同颜色/姿态的占位图
```

但是最终猫咪素材建议统一为 PNG。

### 5.2 不推荐现在使用

Phase 4 不建议使用：

```text
GIF
WebP 动画
CSS sprite sheet
Canvas 渲染
Live2D
Spine
Rive
```

这些都可以后续优化。  
当前最适合的是最简单、最可控的逐帧 `<img>` 渲染。

---

## 6. 推荐文件结构

根据当前项目结构，Codex 应先检查文件，再决定具体路径。

如果当前项目仍然较简单，推荐逐步演进为：

```text
src/
├── App.tsx
├── style.css
├── types/
│   └── pet.ts
├── animation/
│   ├── animationTypes.ts
│   └── animationConfig.ts
├── hooks/
│   └── useAnimation.ts
├── components/
│   ├── PetSprite.tsx
│   └── SpeechBubble.tsx
└── assets/
    └── cat/
        ├── idle/
        │   ├── idle_000.png
        │   ├── idle_001.png
        │   ├── idle_002.png
        │   └── idle_003.png
        ├── dragging/
        │   └── dragging_000.png
        ├── happy/
        │   ├── happy_000.png
        │   ├── happy_001.png
        │   ├── happy_002.png
        │   └── happy_003.png
        └── sleeping/
            ├── sleeping_000.png
            ├── sleeping_001.png
            └── sleeping_002.png
```

如果当前项目是 Electron Forge + Vite 默认结构，也可以是：

```text
src/
├── App.tsx
├── renderer.tsx
├── style.css
├── animation/
├── hooks/
├── components/
├── types/
└── assets/
```

关键原则：

```text
1. 不要大规模重构 Electron main / preload。
2. Phase 4 主要修改 renderer 侧。
3. 图片资源应靠近 renderer 代码。
4. 不要把动画逻辑写死在 App.tsx 中。
```

---

## 7. 图片资源规范

### 7.1 最终推荐格式

```text
格式：PNG
背景：透明
尺寸：512 x 512 px
颜色：sRGB
主体：居中
角色占画布比例：70% - 85%
```

### 7.2 开发阶段占位资源

如果暂时没有真实猫咪 PNG，可以使用占位图。

最低要求：

```text
每个状态至少 1 张图
idle 至少 2 张图更容易验证循环
happy 至少 2 张图更容易验证切换
sleeping 至少 2 张图更容易验证循环
dragging 可以只有 1 张图
```

### 7.3 最小资源集

```text
src/assets/cat/
├── idle/
│   ├── idle_000.png
│   └── idle_001.png
├── dragging/
│   └── dragging_000.png
├── happy/
│   ├── happy_000.png
│   └── happy_001.png
└── sleeping/
    ├── sleeping_000.png
    └── sleeping_001.png
```

### 7.4 正式资源集建议

```text
idle: 4-8 frames
dragging: 1-2 frames
happy: 4-8 frames
sleeping: 3-6 frames
walk_left: 后续 Phase 引入
walk_right: 后续 Phase 引入
```

---

## 8. Vite 资源引用策略

### 8.1 推荐方式：new URL

在 Vite + Electron renderer 中，推荐用 `new URL(..., import.meta.url).href` 引用本地资源。

原因：

```text
1. Vite 可以正确处理资源路径。
2. 打包后路径更可靠。
3. 不依赖 file:// 下的绝对路径。
4. 比直接写 '/assets/...' 更稳。
```

示例：

```ts
const idle000 = new URL('../assets/cat/idle/idle_000.png', import.meta.url).href;
```

### 8.2 不推荐直接依赖绝对路径

不建议在 Phase 4 中直接写：

```ts
'/assets/cat/idle/idle_000.png'
```

原因：

```text
开发环境可能能工作。
但 Electron 打包后 file:// 环境下可能路径不稳定。
```

如果项目已经使用 public 目录并验证可行，也可以保留。  
但本阶段推荐使用 `src/assets` + `new URL`。

---

## 9. 类型设计

### 9.1 PetState

沿用 Phase 3 的状态：

```ts
export type PetState =
  | 'idle'
  | 'dragging'
  | 'happy'
  | 'sleeping';
```

如果当前项目已有 `PetState`，不要重复定义。  
应复用已有类型。

### 9.2 AnimationDefinition

新增：

```ts
import type { PetState } from '../types/pet';

export interface AnimationDefinition {
  fps: number;
  loop: boolean;
  frames: string[];
}

export type AnimationConfig = Record<PetState, AnimationDefinition>;
```

文件建议：

```text
src/animation/animationTypes.ts
```

---

## 10. animationConfig 设计

### 10.1 目标

`animationConfig` 负责定义每个状态对应的动画参数。

文件建议：

```text
src/animation/animationConfig.ts
```

### 10.2 示例代码

```ts
import type { AnimationConfig } from './animationTypes';

const idle000 = new URL('../assets/cat/idle/idle_000.png', import.meta.url).href;
const idle001 = new URL('../assets/cat/idle/idle_001.png', import.meta.url).href;

const dragging000 = new URL('../assets/cat/dragging/dragging_000.png', import.meta.url).href;

const happy000 = new URL('../assets/cat/happy/happy_000.png', import.meta.url).href;
const happy001 = new URL('../assets/cat/happy/happy_001.png', import.meta.url).href;

const sleeping000 = new URL('../assets/cat/sleeping/sleeping_000.png', import.meta.url).href;
const sleeping001 = new URL('../assets/cat/sleeping/sleeping_001.png', import.meta.url).href;

export const animationConfig: AnimationConfig = {
  idle: {
    fps: 4,
    loop: true,
    frames: [idle000, idle001],
  },
  dragging: {
    fps: 1,
    loop: true,
    frames: [dragging000],
  },
  happy: {
    fps: 6,
    loop: true,
    frames: [happy000, happy001],
  },
  sleeping: {
    fps: 3,
    loop: true,
    frames: [sleeping000, sleeping001],
  },
};
```

### 10.3 注意

Phase 3 中 happy 状态已经有 2.5 秒定时恢复。  
所以 Phase 4 中 happy 动画可以 `loop: true`，由状态机负责切回 idle。

如果后续希望动画自身播放完成后切状态，可以再支持 `onComplete`。

---

## 11. useAnimation Hook Spec

### 11.1 目标

`useAnimation` 负责根据当前 `PetState` 返回当前应该显示的图片帧。

文件建议：

```text
src/hooks/useAnimation.ts
```

### 11.2 接口设计

```ts
import type { PetState } from '../types/pet';

export function useAnimation(state: PetState): {
  currentFrame: string;
  frameIndex: number;
  frameCount: number;
};
```

### 11.3 行为要求

```text
1. 接收当前 PetState。
2. 从 animationConfig 读取对应配置。
3. 根据 fps 定时切换 frameIndex。
4. state 变化时重置 frameIndex = 0。
5. loop = true 时循环播放。
6. loop = false 时停在最后一帧。
7. 组件卸载时清理 interval。
8. frames 为空时不崩溃。
```

### 11.4 示例实现逻辑

```ts
import { useEffect, useState } from 'react';
import type { PetState } from '../types/pet';
import { animationConfig } from '../animation/animationConfig';

export function useAnimation(state: PetState) {
  const definition = animationConfig[state];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [state]);

  useEffect(() => {
    if (!definition || definition.frames.length <= 1 || definition.fps <= 0) {
      return;
    }

    const intervalMs = 1000 / definition.fps;

    const timerId = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;

        if (next >= definition.frames.length) {
          return definition.loop ? 0 : definition.frames.length - 1;
        }

        return next;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [definition, state]);

  return {
    currentFrame: definition.frames[frameIndex] ?? definition.frames[0] ?? '',
    frameIndex,
    frameCount: definition.frames.length,
  };
}
```

### 11.5 依赖注意

如果 `animationConfig[state]` 每次 render 都是稳定对象，则上述依赖可接受。  
如果 Codex 改写导致 definition 不稳定，应改为依赖：

```ts
[state]
```

或将 config 保持为模块级常量。

---

## 12. PetSprite 组件 Spec

### 12.1 目标

新增一个专门渲染宠物图片的组件：

```text
src/components/PetSprite.tsx
```

### 12.2 接口

```ts
import type { MouseEventHandler } from 'react';
import type { PetState } from '../types/pet';

interface PetSpriteProps {
  state: PetState;
  onMouseDown: MouseEventHandler<HTMLButtonElement>;
  onDoubleClick: MouseEventHandler<HTMLButtonElement>;
}
```

### 12.3 示例结构

```tsx
import type { MouseEventHandler } from 'react';
import type { PetState } from '../types/pet';
import { useAnimation } from '../hooks/useAnimation';

interface PetSpriteProps {
  state: PetState;
  onMouseDown: MouseEventHandler<HTMLButtonElement>;
  onDoubleClick: MouseEventHandler<HTMLButtonElement>;
}

export function PetSprite({
  state,
  onMouseDown,
  onDoubleClick,
}: PetSpriteProps) {
  const { currentFrame } = useAnimation(state);

  return (
    <button
      className={`pet-sprite-button pet-${state}`}
      type="button"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      aria-label="MochiCat desktop pet"
    >
      {currentFrame ? (
        <img
          className="pet-sprite-image"
          src={currentFrame}
          alt=""
          draggable={false}
        />
      ) : (
        <span className="pet-sprite-fallback">🐱</span>
      )}
    </button>
  );
}
```

### 12.4 原则

```text
1. PetSprite 不负责状态切换。
2. PetSprite 只负责根据 state 显示动画帧。
3. App 或 hook 继续负责拖拽、双击、睡眠等行为。
```

---

## 13. CSS 更新 Spec

### 13.1 容器透明背景

必须保持：

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

### 13.2 pet window

```css
.pet-window {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
```

### 13.3 sprite button

```css
.pet-sprite-button {
  width: 220px;
  height: 220px;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 160ms ease, opacity 160ms ease, filter 160ms ease;
}

.pet-sprite-button.pet-dragging {
  cursor: grabbing;
  transform: scale(0.96) rotate(-3deg);
}

.pet-sprite-button.pet-happy {
  transform: scale(1.08) translateY(-6px);
}

.pet-sprite-button.pet-sleeping {
  transform: scale(0.96) translateY(8px);
  opacity: 0.85;
}
```

### 13.4 sprite image

```css
.pet-sprite-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.18));
}

.pet-sprite-fallback {
  font-size: 96px;
  line-height: 1;
}
```

### 13.5 图片不可拖拽

必须设置：

```tsx
draggable={false}
```

同时 CSS：

```css
.pet-sprite-image {
  pointer-events: none;
}
```

否则浏览器可能触发图片自身拖拽行为，干扰 Electron 窗口拖拽。

---

## 14. App 集成 Spec

### 14.1 App 负责状态逻辑

App 继续保留 Phase 3 的状态逻辑：

```text
petState
bubbleText
drag logic
double click logic
inactivity timer
```

### 14.2 App 只替换显示层

将原来的 emoji 占位符替换成：

```tsx
<PetSprite
  state={petState}
  onMouseDown={handleMouseDown}
  onDoubleClick={handleDoubleClick}
/>
```

保留：

```tsx
<SpeechBubble ... />
```

### 14.3 不要破坏拖拽逻辑

原先 Phase 2 / Phase 3 中的拖拽逻辑必须继续工作。

特别注意：

```text
1. onMouseDown 必须绑定到 PetSprite 的 button。
2. img 本身 pointer-events: none。
3. button 背景必须 transparent。
4. 不要把 onMouseDown 绑定到 speech bubble 上。
```

---

## 15. 占位素材生成建议

如果项目中还没有 PNG 文件，Codex 可以先生成简单的 SVG 占位文件，或者你手动放置 PNG。

### 15.1 更推荐：手动准备 PNG

可以先用任意透明小猫 PNG，复制为不同状态帧，验证系统。

例如：

```text
idle_000.png
idle_001.png
```

即使两张一样，也能先跑通资源加载。

### 15.2 临时 SVG 方案

如果不想立即准备 PNG，Codex 可以创建简单 SVG 文件：

```text
idle_000.svg
idle_001.svg
happy_000.svg
...
```

然后 animationConfig 引用 `.svg`。

但注意：

```text
最终正式素材仍建议替换为 PNG。
```

### 15.3 本阶段验收重点

Phase 4 验收的是：

```text
状态驱动帧切换机制
```

不是：

```text
最终猫咪画得是否好看
```

---

## 16. Debug 建议

Phase 4 可以临时显示 debug 信息，但默认不建议显示在最终 UI。

可选 debug 内容：

```text
petState
frameIndex
frameCount
currentFrame
```

临时写法：

```tsx
{import.meta.env.DEV && (
  <div className="debug-panel">
    {petState} frame {frameIndex + 1}/{frameCount}
  </div>
)}
```

如果窗口太小，debug panel 可能影响观察。  
建议只在排查问题时临时开启。

---

## 17. Codex 执行任务 Prompt

可以直接把以下内容交给 Codex。

```text
We have completed Phase 3 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The app shows a transparent frameless 300x300 always-on-top desktop pet window.
- The pet can be dragged around the macOS desktop.
- The app has basic pet states:
  - idle
  - dragging
  - happy
  - sleeping
- Double click triggers happy.
- Inactivity triggers sleeping.
- Speech bubbles exist.
- The current UI still mainly uses emoji / CSS state feedback.

Now we are starting Phase 4.

Current phase:
Phase 4 - Frame-Based Animation System

Goal:
Replace the emoji-based visual state display with a reusable frame-based image animation system.

Requirements:
1. Reuse the existing PetState type:
   - idle
   - dragging
   - happy
   - sleeping
2. Add an AnimationDefinition type:
   - fps: number
   - loop: boolean
   - frames: string[]
3. Add an AnimationConfig type:
   - Record<PetState, AnimationDefinition>
4. Create animationConfig for all current states.
5. Add local placeholder image assets for each state if no real assets exist yet.
6. Prefer src/assets with Vite new URL(..., import.meta.url).href for resource paths.
7. Implement a useAnimation hook.
8. useAnimation should:
   - accept the current PetState
   - reset frameIndex when state changes
   - advance frames according to fps
   - support loop true / false
   - clear timers on cleanup
   - return currentFrame, frameIndex, and frameCount
9. Add a PetSprite component.
10. PetSprite should:
   - receive current state
   - use useAnimation(state)
   - render the current frame using <img>
   - keep draggable={false}
   - preserve mouse down and double click handlers
   - provide emoji fallback if currentFrame is missing
11. Update App to render PetSprite instead of directly rendering state emoji.
12. Preserve all Phase 3 behavior:
   - dragging still works
   - double click still triggers happy
   - inactivity still triggers sleeping
   - speech bubbles still work
13. Preserve transparent window styling.
14. Do not implement tray, menu, settings, or persistence.
15. Do not implement Live2D, Spine, Rive, or GIF animation.
16. Avoid changing unrelated Electron main/preload logic unless necessary.

Before writing code:
1. Inspect the current project structure.
2. List the files you will create or modify.
3. Explain the frame animation data flow.
4. Then implement the changes.

After implementation:
1. Explain how to run the app.
2. Explain how to verify Phase 4 is complete.
3. List all files changed.
```

---

## 18. 推荐 Codex 修改步骤

Codex 应按以下顺序执行：

```text
1. 查看当前项目结构。
2. 找到 PetState 定义。
3. 如果没有单独 PetState 文件，考虑抽到 src/types/pet.ts。
4. 创建 animationTypes.ts。
5. 创建 animationConfig.ts。
6. 添加临时图片资源目录。
7. 创建 useAnimation.ts。
8. 创建 PetSprite.tsx。
9. 修改 App.tsx，将 emoji 渲染替换为 PetSprite。
10. 修改 CSS，添加 pet-sprite-button 和 pet-sprite-image 样式。
11. 确保 speech bubble 不阻挡鼠标事件。
12. 运行 npm start。
13. 如果报错，只修复 Phase 4 相关问题。
```

---

## 19. Phase 4 验收标准

完成后逐项检查：

```text
[ ] npm start 可以正常启动。
[ ] 桌面上仍然显示透明背景宠物窗口。
[ ] 窗口仍然无边框。
[ ] 窗口仍然置顶。
[ ] 宠物不再主要依赖 emoji 展示。
[ ] 宠物显示为图片帧。
[ ] idle 状态图片帧可以循环。
[ ] 双击后切换到 happy 图片帧。
[ ] happy 状态 2-3 秒后回到 idle。
[ ] 拖拽时切换到 dragging 图片帧。
[ ] 拖拽结束后回到 idle 图片帧。
[ ] 无操作 15 秒后切换到 sleeping 图片帧。
[ ] sleeping 状态双击后切换到 happy。
[ ] 气泡仍然正常显示。
[ ] 图片不会被浏览器自身拖拽。
[ ] 拖拽窗口仍然流畅。
[ ] 背景仍然透明，没有白色方块。
[ ] TypeScript 没有编译错误。
[ ] Console 没有明显运行时报错。
```

---

## 20. 手动测试流程

### 20.1 启动应用

```bash
npm start
```

预期：

```text
桌面上出现透明背景宠物窗口。
宠物显示为图片素材，而不是纯 emoji 文本。
```

### 20.2 测试 idle 动画

操作：

```text
不操作，观察 5 秒。
```

预期：

```text
idle 图片帧循环切换。
如果占位资源差异很小，可以临时查看 debug frameIndex。
```

### 20.3 测试 happy 动画

操作：

```text
双击宠物。
```

预期：

```text
切换到 happy 图片帧。
显示“喵～”或对应气泡。
2-3 秒后回到 idle 图片帧。
```

### 20.4 测试 dragging 动画

操作：

```text
按住宠物并拖动。
```

预期：

```text
切换到 dragging 图片帧。
窗口仍然跟随鼠标移动。
松开后回到 idle。
```

### 20.5 测试 sleeping 动画

操作：

```text
开发模式下等待 15 秒不操作。
```

预期：

```text
切换到 sleeping 图片帧。
显示“Zzz...”气泡。
```

### 20.6 测试唤醒

操作：

```text
在 sleeping 状态下双击。
```

预期：

```text
进入 happy 状态。
显示“醒啦！”气泡。
随后回到 idle。
```

---

## 21. 常见问题与处理方式

### 21.1 图片不显示

可能原因：

```text
1. 资源路径错误。
2. 图片文件不存在。
3. Vite 没有正确处理静态资源。
4. new URL 的相对路径写错。
```

处理：

```text
1. 检查 animationConfig 中路径。
2. 确认文件真实存在。
3. 优先使用 new URL('../assets/xxx.png', import.meta.url).href。
4. 在 DevTools Network 或 Console 中查看加载错误。
```

---

### 21.2 TypeScript 找不到 png 模块

如果使用 `import idle000 from '../assets/xxx.png'` 可能需要声明模块。  
但如果使用 `new URL(..., import.meta.url).href` 通常不需要额外声明。

如果仍然报错，可以新增：

```text
src/types/assets.d.ts
```

内容：

```ts
declare module '*.png' {
  const src: string;
  export default src;
}
```

不过 Phase 4 推荐 `new URL`，避免不必要类型配置。

---

### 21.3 动画不播放

可能原因：

```text
1. 当前状态只有一张图片。
2. fps 设置为 0。
3. useAnimation 没有启动 interval。
4. frameIndex 每次 render 被重置。
5. animationConfig 对象在组件内部反复创建。
```

处理：

```text
1. 确保该状态至少有 2 张图。
2. 确保 fps > 0。
3. 确认 animationConfig 是模块级常量。
4. useEffect 依赖不要导致每次 render 重启。
```

---

### 21.4 状态切换后动画没有从第一帧开始

处理：

```ts
useEffect(() => {
  setFrameIndex(0);
}, [state]);
```

---

### 21.5 拖拽失效

可能原因：

```text
1. onMouseDown 没有传给 PetSprite。
2. onMouseDown 绑定在 img 上，但 img 设置 pointer-events: none。
3. button 被 speech bubble 或其他元素遮挡。
4. button 尺寸太小。
```

处理：

```text
1. onMouseDown 绑定到 PetSprite 的 button。
2. img 保持 pointer-events: none。
3. speech bubble 保持 pointer-events: none。
4. 检查 button 宽高。
```

---

### 21.6 图片被浏览器拖走

处理：

```tsx
<img draggable={false} />
```

并添加：

```css
.pet-sprite-image {
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
```

---

### 21.7 透明背景变成白色

可能原因：

```text
1. 新增组件或 CSS 加了背景色。
2. button 默认样式没有清理。
3. img 外层容器背景不是 transparent。
```

处理：

```css
.pet-sprite-button {
  background: transparent;
  border: none;
}
```

并确认：

```css
html,
body,
#root,
.pet-window {
  background: transparent;
}
```

---

## 22. 代码质量要求

Phase 4 代码应满足：

```text
1. PetState 类型复用，不重复定义冲突类型。
2. animationConfig 与 useAnimation 分离。
3. PetSprite 只负责显示，不负责业务状态切换。
4. App 保持状态逻辑。
5. useAnimation 清理 interval。
6. 图片资源路径稳定。
7. 不破坏 Phase 2 拖拽。
8. 不破坏 Phase 3 交互反馈。
9. Electron 安全配置不变。
```

---

## 23. Phase 4 完成后的 Git 提交建议

如果 Phase 4 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add frame-based pet animation system"
```

---

## 24. 下一阶段预告

Phase 4 完成后建议进入：

```text
Phase 5 - Native Context Menu and Tray
```

Phase 5 目标：

```text
1. 右键宠物打开 Electron 原生菜单。
2. 菜单可以触发：
   - 摸摸猫猫
   - 让它睡觉
   - 唤醒猫猫
   - 隐藏窗口
   - 退出应用
3. 添加系统托盘图标。
4. 托盘菜单可以显示 / 隐藏 / 退出。
```

Phase 5 会开始引入更多 main process 和 renderer 之间的事件通信。  
因此 Phase 4 需要先把状态驱动动画这条链路稳定下来。

---

## 25. Thread B 衔接说明：真实猫咪素材如何接入

Phase 4 完成后，Thread B 产出的真实猫咪素材只需要满足以下结构：

```text
src/assets/cat/
├── idle/
│   ├── idle_000.png
│   ├── idle_001.png
│   └── ...
├── dragging/
│   ├── dragging_000.png
│   └── ...
├── happy/
│   ├── happy_000.png
│   ├── happy_001.png
│   └── ...
└── sleeping/
    ├── sleeping_000.png
    ├── sleeping_001.png
    └── ...
```

然后修改：

```text
src/animation/animationConfig.ts
```

把占位图片路径替换为真实猫咪 PNG 路径即可。

换句话说：

```text
Phase 4 建立动画播放器。
Thread B 提供猫咪动画素材。
animationConfig 是两者之间的接口。
```
