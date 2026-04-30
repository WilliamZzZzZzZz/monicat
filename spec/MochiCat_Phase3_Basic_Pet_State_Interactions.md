# MochiCat Phase 3 开发文档：基础宠物状态与交互反馈

版本：v0.1  
阶段：Phase 3  
前置条件：Phase 2 已完成，桌面上的小猫占位符可以被鼠标拖拽移动。  
目标：建立最小可用的宠物状态系统，让用户交互能够驱动小猫状态变化。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只实现“基础状态 + 交互反馈”，不实现完整帧动画系统、右键菜单、托盘、设置持久化。

---

## 1. Phase 3 的目标

Phase 3 的核心目标是：

> 在现有可拖拽的小猫窗口基础上，加入最小宠物状态系统，让小猫能够响应拖拽、双击、空闲等事件，并在 UI 上体现不同状态。

Phase 2 已经解决了“窗口能被移动”的问题。  
Phase 3 要解决的是：

```text
这个小猫不只是一个静态图标，而是开始具备简单的状态和反馈。
```

本阶段暂时不使用真实帧动画。  
先用 emoji、CSS transform、文字气泡、样式变化等轻量方式验证状态机逻辑。

---

## 2. Phase 3 完成效果

Phase 3 完成后，应用应具备以下表现：

```text
1. npm start 可以正常启动应用。
2. 桌面上仍然显示透明背景的小猫占位符。
3. 小猫仍然可以被拖拽。
4. 小猫有基础状态：
   - idle
   - dragging
   - happy
   - sleeping
5. 拖拽开始时进入 dragging 状态。
6. 拖拽结束后回到 idle 状态。
7. 双击小猫时进入 happy 状态。
8. happy 状态持续 2-3 秒后自动回到 idle。
9. 用户长时间不操作时进入 sleeping 状态。
10. sleeping 状态下双击可以唤醒并进入 happy。
11. 不同状态在 UI 上有可见区别。
12. 可以显示简单气泡文字。
```

---

## 3. Phase 3 不做什么

本阶段只实现基础状态和轻量交互反馈。

禁止实现：

```text
完整帧动画系统
PNG 动画序列加载
真实猫咪素材接入
右键菜单
系统托盘
设置持久化
点击穿透
开机自启
复杂随机行为
复杂情绪值系统
饥饿值系统
多宠物系统
AI 对话
```

原因：

```text
完整动画系统应该建立在稳定状态机之上。
Phase 3 先确认“事件 -> 状态 -> UI反馈”的链路可用。
```

---

## 4. 当前项目状态

Phase 2 已完成：

```text
Electron + React + TypeScript + Vite 项目可以启动
窗口透明、无边框、置顶
窗口尺寸约为 300 x 300
小猫占位符可以被鼠标拖拽移动
拖拽通过 renderer + preload + IPC + main process 实现
Electron 安全配置保持 contextIsolation: true 和 nodeIntegration: false
```

Phase 3 将在此基础上增加：

```text
1. PetState 类型定义
2. React 内部状态管理
3. 拖拽状态联动
4. 双击 happy 状态
5. 空闲 sleeping 状态
6. 简单气泡文字
7. 不同状态的 CSS 效果
```

---

## 5. 推荐修改文件

根据当前项目结构，Codex 应先检查文件，再决定最小修改范围。

常见需要修改的文件：

```text
src/App.tsx
src/style.css
src/renderer.tsx 或 src/renderer.ts
```

可选新增文件：

```text
src/types/pet.ts
src/hooks/usePetState.ts
src/hooks/useIdleTimer.ts
src/components/SpeechBubble.tsx
```

如果当前项目结构仍然很简单，可以先不要拆太多文件。  
但是建议至少把状态类型单独定义出来，便于后续 Phase 4 动画系统复用。

推荐新增：

```text
src/types/pet.ts
```

推荐可选新增：

```text
src/components/SpeechBubble.tsx
```

---

## 6. PetState 设计

### 6.1 最小状态集合

Phase 3 只定义四个状态：

```ts
export type PetState =
  | 'idle'
  | 'dragging'
  | 'happy'
  | 'sleeping';
```

### 6.2 状态含义

```text
idle:
默认状态。小猫处于正常待机状态。

dragging:
用户按住并拖动小猫时的状态。

happy:
用户双击小猫、唤醒小猫等主动互动后的状态。

sleeping:
用户长时间没有互动时，小猫进入睡觉状态。
```

### 6.3 状态优先级

状态优先级从高到低：

```text
dragging > happy > sleeping > idle
```

规则说明：

```text
1. dragging 最高优先级，拖拽时不能被 happy 或 sleeping 打断。
2. happy 是用户主动互动反馈，持续短时间后回到 idle。
3. sleeping 是空闲状态，用户双击可以打断。
4. idle 是默认兜底状态。
```

---

## 7. 状态切换规则

### 7.1 启动状态

```text
App start -> idle
```

### 7.2 拖拽

```text
idle + mouse_down_drag -> dragging
happy + mouse_down_drag -> dragging
sleeping + mouse_down_drag -> dragging

dragging + mouse_up -> idle
```

### 7.3 双击

```text
idle + double_click -> happy
sleeping + double_click -> happy
happy + double_click -> happy
```

happy 状态持续：

```text
2.5 秒
```

然后自动回到：

```text
idle
```

### 7.4 空闲睡眠

如果用户一段时间没有与小猫互动：

```text
idle + inactivity_timeout -> sleeping
```

开发阶段建议空闲时间：

```text
15 秒
```

后续正式版本可以改为：

```text
5 分钟
```

建议代码：

```ts
const INACTIVITY_TIMEOUT_MS =
  import.meta.env.DEV ? 15_000 : 5 * 60_000;
```

---

## 8. UI 表现 Spec

Phase 3 不做真实动画。  
使用 emoji 和 CSS 表现不同状态。

### 8.1 状态对应显示

建议：

```text
idle:
显示 🐱

dragging:
显示 😾 或 🐱，并缩小一点

happy:
显示 😸，并轻微放大或跳动

sleeping:
显示 😴，并降低透明度或轻微下沉
```

### 8.2 推荐映射

```ts
const PET_STATE_EMOJI: Record<PetState, string> = {
  idle: '🐱',
  dragging: '😾',
  happy: '😸',
  sleeping: '😴',
};
```

### 8.3 CSS 效果

建议使用 class 控制：

```tsx
<div className={`pet-placeholder pet-${petState}`}>
  {PET_STATE_EMOJI[petState]}
</div>
```

示例 CSS：

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
  transition: transform 160ms ease, opacity 160ms ease, filter 160ms ease;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.18));
}

.pet-placeholder.pet-idle {
  transform: scale(1);
  opacity: 1;
}

.pet-placeholder.pet-dragging {
  cursor: grabbing;
  transform: scale(0.94) rotate(-4deg);
}

.pet-placeholder.pet-happy {
  transform: scale(1.12) translateY(-8px);
}

.pet-placeholder.pet-sleeping {
  transform: scale(0.96) translateY(8px);
  opacity: 0.78;
}
```

---

## 9. 气泡系统 Spec

### 9.1 Phase 3 气泡目标

本阶段实现一个轻量气泡，不做完整消息队列。

气泡触发场景：

```text
双击小猫 -> “喵～”
拖拽开始 -> “别拎我！”
进入睡眠 -> “Zzz...”
唤醒小猫 -> “醒啦！”
```

### 9.2 气泡显示规则

```text
1. 气泡显示在小猫上方。
2. 每次显示 1.5 到 2 秒。
3. 之后自动隐藏。
4. 气泡不能影响拖拽。
5. 气泡背景可以是半透明白色。
```

### 9.3 SpeechBubble 组件

建议新增：

```text
src/components/SpeechBubble.tsx
```

组件接口：

```ts
interface SpeechBubbleProps {
  text: string | null;
  visible: boolean;
}
```

示例：

```tsx
export function SpeechBubble({ text, visible }: SpeechBubbleProps) {
  if (!visible || !text) return null;

  return (
    <div className="speech-bubble">
      {text}
    </div>
  );
}
```

### 9.4 气泡样式

```css
.speech-bubble {
  position: absolute;
  top: 42px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 220px;
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: #222;
  font-size: 14px;
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.16));
}
```

---

## 10. 交互事件设计

### 10.1 拖拽开始

拖拽开始时：

```text
1. 设置 petState = dragging
2. 显示气泡：“别拎我！”
3. 重置空闲计时器
4. 保留 Phase 2 的窗口移动逻辑
```

### 10.2 拖拽结束

拖拽结束时：

```text
1. 设置 petState = idle
2. 清理拖拽数据
3. 重置空闲计时器
```

### 10.3 双击

双击时：

```text
1. 如果当前是 dragging，忽略双击。
2. 如果当前是 sleeping，显示气泡：“醒啦！”
3. 否则显示气泡：“喵～”
4. 设置 petState = happy
5. 2.5 秒后回到 idle
6. 重置空闲计时器
```

### 10.4 空闲

空闲计时器触发时：

```text
1. 如果当前是 idle，则进入 sleeping。
2. 如果当前是 dragging 或 happy，则不进入 sleeping。
3. 显示气泡：“Zzz...”
```

---

## 11. Hook 设计建议

如果当前代码已经比较复杂，建议新增一个 hook：

```text
src/hooks/usePetState.ts
```

接口：

```ts
export function usePetState(): {
  petState: PetState;
  bubbleText: string | null;
  bubbleVisible: boolean;
  setDragging: () => void;
  setIdle: () => void;
  triggerHappy: () => void;
  markInteraction: () => void;
}
```

但如果 Phase 2 代码仍集中在 `App.tsx`，可以先不拆 hook。  
本阶段更重要的是功能跑通，避免过度架构化。

---

## 12. 最小实现伪代码

以下是 Phase 3 的核心逻辑参考。

```tsx
const HAPPY_DURATION_MS = 2500;
const BUBBLE_DURATION_MS = 1800;
const INACTIVITY_TIMEOUT_MS = import.meta.env.DEV ? 15000 : 5 * 60 * 1000;

const [petState, setPetState] = useState<PetState>('idle');
const [bubbleText, setBubbleText] = useState<string | null>(null);

const happyTimerRef = useRef<number | null>(null);
const bubbleTimerRef = useRef<number | null>(null);
const inactivityTimerRef = useRef<number | null>(null);

function showBubble(text: string) {
  setBubbleText(text);

  if (bubbleTimerRef.current) {
    window.clearTimeout(bubbleTimerRef.current);
  }

  bubbleTimerRef.current = window.setTimeout(() => {
    setBubbleText(null);
  }, BUBBLE_DURATION_MS);
}

function resetInactivityTimer() {
  if (inactivityTimerRef.current) {
    window.clearTimeout(inactivityTimerRef.current);
  }

  inactivityTimerRef.current = window.setTimeout(() => {
    setPetState((current) => {
      if (current === 'idle') {
        showBubble('Zzz...');
        return 'sleeping';
      }

      return current;
    });
  }, INACTIVITY_TIMEOUT_MS);
}

function triggerHappy() {
  setPetState('happy');
  showBubble(petState === 'sleeping' ? '醒啦！' : '喵～');
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

注意：实际实现时要处理 React state 闭包问题。  
如果需要读取最新 state，可以使用 ref 或函数式 setState。

---

## 13. 与 Phase 2 拖拽逻辑的集成

Phase 2 已经有拖拽逻辑。Phase 3 不应推翻 Phase 2。

应该做的是在现有逻辑中插入状态更新。

### 13.1 handleMouseDown

在现有 `handleMouseDown` 中增加：

```text
setPetState('dragging')
showBubble('别拎我！')
resetInactivityTimer()
```

### 13.2 stopDragging

在现有 `stopDragging` 中增加：

```text
setPetState('idle')
resetInactivityTimer()
```

### 13.3 onDoubleClick

给小猫元素增加：

```tsx
onDoubleClick={handleDoubleClick}
```

双击处理：

```text
triggerHappy()
```

### 13.4 注意事件冲突

拖拽和双击可能冲突。

MVP 可以接受轻微误触。  
如果双击被拖拽影响，可以后续优化：

```text
1. 记录 mousedown 到 mouseup 的移动距离。
2. 如果移动距离小于 4px，才认为是 click/double click。
3. 如果移动距离较大，则认为是 drag。
```

Phase 3 暂不强制实现这个精细区分。

---

## 14. Codex 执行任务 Prompt

可以直接把以下内容交给 Codex。

```text
We have completed Phase 2 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The app shows a transparent frameless 300x300 always-on-top desktop pet window.
- The cat placeholder can be dragged around the macOS desktop using custom IPC window movement.
- contextIsolation remains true and nodeIntegration remains false.

Now we are starting Phase 3.

Current phase:
Phase 3 - Basic Pet State and Interaction Feedback

Goal:
Add a minimal pet state system and lightweight interaction feedback.

Requirements:
1. Define a minimal PetState type:
   - idle
   - dragging
   - happy
   - sleeping
2. The app should start in idle state.
3. When dragging starts, set state to dragging.
4. When dragging ends, set state back to idle.
5. When the user double-clicks the cat, set state to happy.
6. Happy state should last about 2.5 seconds, then return to idle.
7. If the user does not interact with the pet for 15 seconds in development mode, set state to sleeping.
8. In production, the inactivity timeout should be 5 minutes.
9. If the user double-clicks while sleeping, wake the pet and set state to happy.
10. Show different emoji or visual styling for each state:
    - idle: 🐱
    - dragging: 😾
    - happy: 😸
    - sleeping: 😴
11. Add a simple speech bubble system:
    - double click: "喵～"
    - drag start: "别拎我！"
    - sleep: "Zzz..."
    - wake from sleep: "醒啦！"
12. Speech bubbles should auto-hide after about 1.8 seconds.
13. Speech bubbles must not block mouse interaction.
14. Preserve all Phase 2 drag behavior.
15. Do not implement frame animation yet.
16. Do not implement tray, menu, settings, or persistence yet.
17. Avoid changing unrelated files.

Before writing code:
1. Inspect the current project structure.
2. List the files you will create or modify.
3. Explain how pet state transitions will work.
4. Then implement the changes.

After implementation:
1. Explain how to run the app.
2. Explain how to verify Phase 3 is complete.
3. List all files changed.
```

---

## 15. 推荐 Codex 修改步骤

Codex 应按以下顺序执行：

```text
1. 查看当前项目结构。
2. 找到 Phase 2 的拖拽逻辑。
3. 新增或定义 PetState 类型。
4. 在 React 中添加 petState 状态。
5. 将拖拽开始和拖拽结束接入 petState。
6. 添加 double click 事件。
7. 添加 happy 定时恢复逻辑。
8. 添加 inactivity timer。
9. 添加 speech bubble 状态。
10. 添加不同状态的 emoji 映射。
11. 添加 CSS class 样式。
12. 运行 npm start。
13. 如果报错，只修复 Phase 3 相关问题。
```

---

## 16. Phase 3 验收标准

完成后逐项检查：

```text
[ ] npm start 可以正常启动。
[ ] 桌面上仍然显示透明背景小猫。
[ ] 小猫仍然可以被拖拽。
[ ] 拖拽开始时，小猫进入 dragging 状态。
[ ] 拖拽时显示 😾 或对应 dragging 样式。
[ ] 拖拽结束后，小猫回到 idle 状态。
[ ] idle 状态显示 🐱。
[ ] 双击小猫后进入 happy 状态。
[ ] happy 状态显示 😸 或明显放大/跳动样式。
[ ] happy 状态 2-3 秒后自动回到 idle。
[ ] 开发模式下 15 秒无操作后进入 sleeping。
[ ] sleeping 状态显示 😴。
[ ] sleeping 状态下双击可以进入 happy。
[ ] 双击时显示“喵～”或“醒啦！”气泡。
[ ] 拖拽开始时显示“别拎我！”气泡。
[ ] sleeping 触发时显示“Zzz...”气泡。
[ ] 气泡会自动消失。
[ ] 气泡不会挡住鼠标拖拽。
[ ] TypeScript 没有编译错误。
[ ] Console 没有明显运行时报错。
```

---

## 17. 手动测试流程

### 17.1 启动应用

```bash
npm start
```

预期：

```text
桌面上显示透明背景小猫。
默认显示 idle 状态。
```

### 17.2 测试拖拽状态

操作：

```text
1. 鼠标按住小猫。
2. 拖动到桌面另一处。
3. 松开鼠标。
```

预期：

```text
按住时进入 dragging。
松开后回到 idle。
窗口移动能力不受影响。
```

### 17.3 测试 happy 状态

操作：

```text
双击小猫。
```

预期：

```text
小猫进入 happy。
显示 😸 或放大效果。
显示“喵～”气泡。
2-3 秒后回到 idle。
```

### 17.4 测试 sleeping 状态

操作：

```text
不要操作小猫，等待 15 秒。
```

预期：

```text
小猫进入 sleeping。
显示 😴。
显示“Zzz...”气泡。
```

### 17.5 测试唤醒

操作：

```text
在 sleeping 状态下双击小猫。
```

预期：

```text
小猫进入 happy。
显示“醒啦！”气泡。
2-3 秒后回到 idle。
```

---

## 18. 常见问题与处理方式

### 18.1 双击没有反应

可能原因：

```text
1. onDoubleClick 没有绑定到猫咪元素。
2. 拖拽事件阻止了 double click。
3. 元素使用 pointer-events: none。
```

处理：

```text
检查 pet-placeholder 是否可以接收鼠标事件。
确认 onDoubleClick 绑定在可点击元素上。
```

---

### 18.2 气泡挡住拖拽

原因：

```text
speech-bubble 接收了鼠标事件。
```

处理：

```css
.speech-bubble {
  pointer-events: none;
}
```

---

### 18.3 睡眠状态不断重复触发

可能原因：

```text
inactivity timer 没有正确清理或重复创建。
```

处理：

```text
1. 使用 useRef 保存 timer id。
2. 每次重置前 clearTimeout。
3. 组件卸载时清理 timer。
```

---

### 18.4 happy 状态结束后直接进入 sleeping

可能原因：

```text
happy 结束后没有重置 inactivity timer。
```

处理：

```text
happy 结束回到 idle 时，重新启动 inactivity timer。
```

---

### 18.5 拖拽时状态被 sleeping 覆盖

可能原因：

```text
inactivity timer 没有检查当前状态。
```

处理：

```text
进入 sleeping 前判断当前状态必须是 idle。
dragging 和 happy 不允许被 sleeping 覆盖。
```

---

### 18.6 TypeScript 报 timer 类型错误

在浏览器环境中推荐：

```ts
const timerRef = useRef<number | null>(null);
```

并使用：

```ts
window.setTimeout(...)
window.clearTimeout(...)
```

不要混用 NodeJS.Timeout，避免 Electron + DOM 类型混淆。

---

## 19. 代码质量要求

Phase 3 代码应满足：

```text
1. 状态类型明确，不使用随意字符串。
2. 定时器有清理逻辑。
3. 不破坏 Phase 2 拖拽能力。
4. 不引入完整动画系统。
5. 不引入全局复杂状态库。
6. 不修改 Electron 安全配置。
7. 不暴露多余 IPC 权限。
8. 样式保持透明背景。
```

---

## 20. Phase 3 完成后的 Git 提交建议

如果 Phase 3 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add basic pet state interactions"
```

---

## 21. 下一阶段预告

Phase 3 完成后进入：

```text
Phase 4 - Frame-Based Animation System
```

Phase 4 目标：

```text
1. 将 Phase 3 的 PetState 接入动画系统。
2. 为每个状态准备占位帧资源。
3. 实现 useAnimation hook。
4. 根据当前 petState 播放对应帧序列。
5. 支持 fps、loop、onComplete。
```

到 Phase 4 才开始从 emoji / CSS 反馈过渡到真正的图片帧动画。  
因此 Phase 3 的重点是状态逻辑，不是视觉素材。
