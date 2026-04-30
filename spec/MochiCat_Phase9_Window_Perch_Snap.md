# MochiCat Phase 9 开发文档：窗口上沿轻微吸附与 Perch Mode

版本：v0.1  
阶段：Phase 9  
前置条件：Phase 8 已完成；小猫支持 `idle`、`dragging`、`happy`、`sleeping`、`walk_left`、`walk_right`；随机行为、走路、拖拽、右键菜单、托盘、尺寸滑动条、设置持久化均可用。  
目标：当用户拖动小猫靠近任意已打开桌面窗口的上边界时，小猫可以轻微自动吸附到该窗口顶部，并在该窗口上沿自由坐立、睡觉、左右走动，但不能超出该窗口左右边界。  
开发方式：VS Code + Codex / Agent + GitHub Copilot  
当前阶段原则：实现“轻微吸附 + perched 附着模式 + 上沿边界内活动”，不要做复杂物理、不要做窗口嵌入、不要破坏现有拖拽和走路系统。

---

## 1. 核心目标

Phase 9 的目标是：

> 拖动小猫靠近桌面上任意打开窗口的上沿时，小猫自动轻微吸附到该窗口顶部；吸附后，小猫可以在该窗口上沿进行 idle、sleeping、happy、walk_left、walk_right 等行为，并且水平移动范围不能超过该目标窗口的左右边界。

这里的“吸附”不是把 MochiCat 真正嵌入目标窗口，也不是改变目标窗口本身，而是：

```text
MochiCat 仍然是一个独立 always-on-top Electron 透明窗口
但它的位置被约束在目标窗口上沿附近
```

---

## 2. 重要技术现实

Electron 本身不能直接、跨平台、可靠地获取“所有其他应用窗口”的位置。

在 macOS 上，要实现“检测任意打开窗口的边界”，通常需要以下方案之一：

```text
方案 A：使用 macOS Accessibility API / 原生模块
方案 B：使用 AppleScript / osascript 查询 System Events 窗口信息
方案 C：只检测当前前台窗口或用户指定窗口
```

本阶段建议先实现 macOS MVP：

```text
Main process 通过 AppleScript / osascript 或现有可用方式查询可见窗口 bounds
Renderer 负责拖拽时进行吸附判断和 perched 行为控制
```

如果因为系统权限限制无法获取窗口信息，必须优雅降级：

```text
不崩溃
不影响拖拽
不影响随机行为
只禁用窗口吸附
在日志中说明需要 macOS Accessibility 权限
```

不要假装已经检测到窗口。不要用硬编码窗口区域代替真实窗口信息。

---

## 3. 当前项目状态

当前项目已具备：

```text
Electron + React + TypeScript + Vite
透明无边框 always-on-top 桌面宠物窗口
完整拖拽
真实透明 PNG 动画资源
状态：
- idle
- dragging
- happy
- sleeping
- walk_left
- walk_right

帧动画系统
随机行为系统
走路系统
右键菜单
系统托盘
尺寸滑动条
settings.json 持久化
```

Phase 9 不应破坏这些能力。

---

## 4. Phase 9 不做什么

本阶段禁止实现：

```text
复杂物理引擎
重力模拟
弹跳碰撞
把宠物真实嵌入其他 App 窗口
修改其他应用窗口
吸附到窗口左边/右边/底边
跨平台完整窗口管理
AI 对话
音效系统
复杂路径规划
多宠物系统
```

本阶段只实现：

```text
拖拽靠近目标窗口上沿 -> 轻微吸附
吸附后在目标窗口上沿活动
走路范围限制在目标窗口左右边界内
```

---

## 5. 行为定义

### 5.1 普通模式

小猫未吸附到任何窗口时，行为保持现有逻辑：

```text
可自由拖拽
可随机 idle / happy / sleeping / walk_left / walk_right
walk_left / walk_right 在桌面范围内移动
```

### 5.2 Perched Mode / 吸附模式

当用户拖动小猫靠近某个目标窗口上沿时，小猫进入：

```text
perched mode
```

也可以称为：

```text
attachedToWindow
```

此时小猫：

```text
1. 坐在目标窗口上沿。
2. y 坐标锁定在目标窗口 top 附近。
3. x 坐标只能在目标窗口 left 到 right 范围内移动。
4. 可以 idle。
5. 可以 sleeping。
6. 可以 happy。
7. 可以 walk_left / walk_right。
8. walk_left / walk_right 只能沿着目标窗口上沿水平移动。
9. 不能走出目标窗口左右边界。
```

### 5.3 脱离吸附

以下情况应脱离 perched mode：

```text
用户按住小猫重新拖动
目标窗口关闭
目标窗口最小化或不可见
无法继续获取目标窗口 bounds
用户把小猫拖离窗口上沿
随机行为被关闭并不一定要脱离，但应停止自动 walking
```

推荐行为：

```text
用户开始拖拽时，立即 detach from perch，然后进入 dragging
```

这样实现最简单、最自然。

---

## 6. 吸附判定规则

拖拽过程中，系统应检查小猫是否靠近任意可见窗口的上沿。

### 6.1 需要的几何信息

需要知道：

```ts
interface ExternalWindowBounds {
  id?: string;
  appName?: string;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

坐标应与 Electron `BrowserWindow.setPosition(x, y)` 使用同一套屏幕坐标。

### 6.2 小猫窗口信息

需要知道当前小猫窗口 bounds：

```text
petX
petY
petWidth
petHeight
```

小猫底部位置：

```ts
petBottom = petY + petHeight;
```

小猫水平中心：

```ts
petCenterX = petX + petWidth / 2;
```

目标窗口上沿：

```ts
targetTop = targetWindow.y;
targetLeft = targetWindow.x;
targetRight = targetWindow.x + targetWindow.width;
```

### 6.3 吸附阈值

推荐：

```text
snapThresholdY = 28 px
snapHorizontalMargin = 24 px
perchOverlapPx = 8 px
```

吸附条件：

```text
1. 小猫底部接近目标窗口 top：
   abs(petBottom - targetTop) <= snapThresholdY

2. 小猫水平中心在目标窗口水平范围附近：
   petCenterX >= targetLeft - snapHorizontalMargin
   petCenterX <= targetRight + snapHorizontalMargin

3. 目标窗口宽度足够：
   targetWindow.width >= petWidth * 0.8
```

可根据实际效果微调。

### 6.4 多个候选窗口

如果多个窗口都满足条件：

```text
选择 vertical distance 最小的窗口
如果相同，选择 petCenterX 更靠近窗口范围中心的窗口
```

不要随机选择。

---

## 7. 吸附位置计算

进入 perched mode 时，小猫位置应设置为：

```ts
perchY = targetWindow.y - petHeight + perchOverlapPx;
```

含义：

```text
让小猫底部轻微压在目标窗口上沿上
看起来像“坐在窗口边缘”
```

水平位置：

```ts
perchX = clamp(currentPetX, targetLeft, targetRight - petWidth);
```

即：

```ts
newX = Math.max(targetLeft, Math.min(currentPetX, targetRight - petWidth));
newY = perchY;
```

如果目标窗口太靠近屏幕顶部，导致 `perchY` 超出屏幕顶部，可以采用安全策略：

```text
方案 A：不吸附这个窗口
方案 B：允许一小部分贴近屏幕顶部，但不要让宠物不可见
```

MVP 推荐：

```text
如果 perchY 会让宠物大部分不可见，则不吸附该窗口。
```

---

## 8. Perched Mode 下的走路限制

如果当前是 perched mode：

```text
walk_left / walk_right 不再使用普通桌面 workArea 边界
而是使用目标窗口的 left/right 边界
```

### 8.1 walk_right

```text
x 增加
最大不能超过 targetRight - petWidth
达到右边界后停止 walking 并回到 idle
```

### 8.2 walk_left

```text
x 减少
最小不能小于 targetLeft
达到左边界后停止 walking 并回到 idle
```

### 8.3 y 坐标

perched mode 下 y 坐标应保持：

```ts
y = targetTop - petHeight + perchOverlapPx;
```

不要让 walking 时 y 上下跳动。动画帧可以表现步态，窗口位置只水平移动。

---

## 9. 目标窗口移动 / 关闭 / 调整大小

吸附后目标窗口可能发生变化：

```text
用户移动目标窗口
用户调整目标窗口大小
用户关闭目标窗口
用户最小化目标窗口
目标窗口被其他桌面空间切换隐藏
```

Phase 9 需要最小处理：

```text
1. perched mode 下每隔 500–1000 ms 重新查询目标窗口 bounds。
2. 如果目标窗口仍存在，更新 perchY 和左右边界。
3. 如果目标窗口不存在或不可见，detach from perch。
4. 如果小猫 x 超出新窗口边界，clamp 回边界内。
```

不要高频查询所有窗口，避免性能问题。

---

## 10. 窗口检测实现建议

### 10.1 Main process 负责查询外部窗口

Renderer 不应该直接访问 OS 或 Node API。  
Main process 应提供受限 IPC：

```ts
window.mochiCat.externalWindows.getVisibleWindows()
```

或：

```ts
window.mochiCat.window.getSnapCandidates()
```

推荐返回：

```ts
type ExternalWindowBounds = {
  id?: string;
  appName?: string;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
```

### 10.2 macOS AppleScript MVP

Agent 可以用 AppleScript / osascript 实现 MVP。

概念上：

```text
tell application "System Events"
  get visible processes
  for each process, get windows
  get position and size of each window
end tell
```

注意：

```text
1. 这通常需要 Accessibility 权限。
2. 不同 App 返回窗口信息质量不同。
3. 坐标系需要与 Electron 坐标对齐验证。
4. 必须排除 MochiCat 自己的窗口。
5. 必须排除无效窗口、0 尺寸窗口、菜单栏、Dock、桌面伪窗口。
```

如果 AppleScript 不可靠，Agent 应明确报告，不应伪造。

### 10.3 权限处理

如果权限不足，可能出现：

```text
无法读取 System Events
无法获取其他 App 窗口 bounds
返回空数组
```

此时应：

```text
1. 不崩溃。
2. 禁用 snap。
3. 在 main process log 中提示需要 Accessibility 权限。
4. 保留所有原有功能。
```

---

## 11. 推荐新增状态结构

不要新增 PetState。  
PetState 仍然表示动画状态：

```text
idle
dragging
happy
sleeping
walk_left
walk_right
```

吸附状态应作为独立 UI/movement 状态：

```ts
type PerchState =
  | { mode: 'free' }
  | {
      mode: 'perched';
      targetWindow: ExternalWindowBounds;
      attachedAt: number;
    };
```

或：

```ts
interface PerchState {
  isPerched: boolean;
  targetWindow?: ExternalWindowBounds;
}
```

不要把 `perched` 加到 PetState，除非项目架构必须如此。  
原因：

```text
perched 是位置约束模式
idle/sleeping/walk 是动画行为模式
两者应分离
```

---

## 12. 推荐 Hook：useWindowPerchSnap

建议新增：

```text
src/hooks/useWindowPerchSnap.ts
```

职责：

```text
1. 在拖拽过程中检查是否接近外部窗口上沿。
2. 找到最佳 snap candidate。
3. 触发 attach/perch。
4. 提供当前 perchState。
5. 提供 detachFromPerch。
6. perched mode 下定期刷新目标窗口 bounds。
7. 目标窗口消失时自动 detach。
```

建议接口：

```ts
interface UseWindowPerchSnapParams {
  petState: PetState;
  isDragging: boolean;
  petBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  setWindowPosition: (x: number, y: number) => Promise<void>;
  getWindowBounds: () => Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  getExternalWindows: () => Promise<ExternalWindowBounds[]>;
  onPerchChanged?: (isPerched: boolean) => void;
}

interface UseWindowPerchSnapResult {
  perchState: PerchState;
  trySnapToWindowTop: () => Promise<void>;
  detachFromPerch: () => void;
  getPerchMovementBounds: () => {
    minX: number;
    maxX: number;
    y: number;
  } | null;
}
```

实际接口可根据现有代码调整，不必完全一致。

---

## 13. 拖拽流程修改

### 13.1 拖拽开始

如果当前处于 perched mode：

```text
detachFromPerch()
进入 dragging
```

### 13.2 拖拽中

保持现有拖拽逻辑。

拖拽时可以低频检查 snap candidate，例如：

```text
每 100–150 ms 检查一次
或 mouseup 时检查
```

为避免拖拽卡顿，MVP 推荐：

```text
mouseup 时检查是否吸附
```

也可以在拖拽过程中做轻微预判，但不是硬性要求。

### 13.3 拖拽结束

拖拽结束时：

```text
1. 获取当前小猫窗口 bounds。
2. 查询外部窗口 candidates。
3. 检查是否靠近某个窗口上沿。
4. 如果满足条件，自动吸附。
5. 否则保持普通 free mode。
```

这样最稳定，也不会在拖动时频繁调用 OS 窗口查询。

---

## 14. 与 walking movement 集成

需要修改 `useWalkingMovement` 或其等价逻辑。

### 14.1 普通 free mode

使用现有逻辑：

```text
walk_left / walk_right 在屏幕 workArea 或安全 bounds 内移动
```

### 14.2 perched mode

如果 `perchState.mode === 'perched'`：

```text
1. movement bounds = targetWindow.left/right
2. y 固定为 perchY
3. walking 到边界时停止并回 idle
```

建议 `useWalkingMovement` 接收额外参数：

```ts
perchMovementBounds?: {
  minX: number;
  maxX: number;
  y: number;
}
```

如果存在 `perchMovementBounds`：

```text
优先使用该 bounds
```

否则使用普通桌面 bounds。

---

## 15. 与随机行为集成

Perched mode 下随机行为应继续工作。

小猫在窗口上沿可以：

```text
idle
happy
sleeping
walk_left
walk_right
```

随机 walking 在 perched mode 下应受到目标窗口左右边界限制。

推荐行为：

```text
1. 小猫吸附后，进入 idle。
2. 随机行为继续运行。
3. 如果随机选择 walk_left / walk_right，则沿目标窗口上沿走一小段。
4. 如果随机选择 sleeping，则在目标窗口上沿睡觉。
5. 如果随机选择 wakeUp，则醒来后回 idle。
```

不要让 perched mode 禁用随机行为，除非 `randomBehaviorEnabled === false`。

---

## 16. 交互与优先级

### 16.1 用户拖拽优先级最高

如果用户拖拽：

```text
停止 walking
detach from perch
进入 dragging
```

### 16.2 菜单操作

右键菜单动作仍然有效：

```text
摸摸猫猫 -> happy
让它睡觉 -> sleeping
走一走 -> 可选 walk_left/walk_right
调整尺寸 -> 打开尺寸面板
```

如果正在 perched mode：

```text
happy/sleeping 仍在窗口上沿原地播放
walk_left/walk_right 仍限制在目标窗口左右范围内
```

### 16.3 尺寸变化

如果用户通过 slider 改变宠物大小：

```text
1. perched mode 下应重新计算 perchY。
2. x 需要重新 clamp 到目标窗口左右边界。
3. 不要让尺寸变化导致宠物突然掉出窗口边界。
```

---

## 17. UI/反馈要求

吸附时可以有轻微反馈，但不是硬性要求。

可选：

```text
1. 显示气泡：“坐好啦”
2. 或轻微 happy 反应
```

不要过度动画。  
不要新增图片素材。

---

## 18. 推荐文件变更

可能新增：

```text
src/hooks/useWindowPerchSnap.ts
src/types/externalWindow.ts
```

可能修改：

```text
src/App.tsx
src/hooks/useWalkingMovement.ts
src/hooks/useRandomBehavior.ts
src/preload.ts 或 preload 相关文件
src/main.ts 或 main ipc 文件
src/shared/ipcChannels.ts
src/types/global.d.ts
```

Agent 必须先检查实际工程结构，不要盲目创建重复文件。

---

## 19. IPC 设计建议

新增受限 API：

```ts
window.mochiCat.externalWindows.getVisibleWindows()
```

或：

```ts
window.mochiCat.window.getSnapCandidates()
```

返回：

```ts
Promise<ExternalWindowBounds[]>
```

安全要求：

```text
不要暴露 raw ipcRenderer
不要允许 renderer 任意 channel
不要关闭 contextIsolation
不要打开 nodeIntegration
```

Main process handler：

```text
external-windows:get-visible-windows
```

如果权限不足：

```text
返回 []
同时 log warning
```

不要 throw 导致 renderer 崩溃。

---

## 20. 验收标准

### 20.1 吸附验收

```text
[ ] npm start 正常启动。
[ ] 拖动小猫靠近任意打开窗口的上沿时，可以轻微吸附。
[ ] 吸附后小猫看起来坐在窗口上边界。
[ ] 吸附位置自然，不悬空太远，不完全压进窗口。
[ ] 没有吸附到 MochiCat 自己的窗口。
[ ] 没有吸附到 Dock、菜单栏、桌面伪窗口。
```

### 20.2 Perched 行为验收

```text
[ ] 吸附后，小猫可以 idle。
[ ] 吸附后，小猫可以 sleeping。
[ ] 吸附后，小猫可以 happy。
[ ] 吸附后，小猫可以 walk_left。
[ ] 吸附后，小猫可以 walk_right。
[ ] walk_left 不会超过目标窗口左边界。
[ ] walk_right 不会超过目标窗口右边界。
[ ] y 坐标稳定在目标窗口上沿。
```

### 20.3 拖拽脱离验收

```text
[ ] 用户再次拖动小猫时，会脱离 perched mode。
[ ] 拖动后可以移动到桌面任意位置。
[ ] 不会被旧窗口边界继续限制。
```

### 20.4 窗口变化验收

```text
[ ] 目标窗口移动后，小猫位置能更新或安全脱离。
[ ] 目标窗口关闭后，小猫安全脱离。
[ ] 目标窗口缩小后，小猫 x 被 clamp 到新边界内。
[ ] 目标窗口消失时应用不崩溃。
```

### 20.5 原有功能验收

```text
[ ] 普通拖拽仍然正常。
[ ] 顶部 20% invisible wall bug 不复发。
[ ] 普通桌面 walking 仍然正常。
[ ] 随机行为仍然正常。
[ ] 右键菜单仍然正常。
[ ] 托盘仍然正常。
[ ] 尺寸滑动条仍然正常。
[ ] 透明背景仍然正常。
[ ] TypeScript 无错误。
[ ] Renderer Console 无明显错误。
[ ] Main process terminal 无明显错误。
```

---

## 21. Codex / Agent 执行 Prompt

可以直接把以下内容交给 Agent：

```text
We need to implement MochiCat Phase 9: Window Top Edge Snap / Perch Mode.

Current project status:
- MochiCat already supports idle, dragging, happy, sleeping, walk_left, and walk_right.
- The pet can be dragged freely on the desktop.
- Walking behavior works.
- Random behavior works.
- Right-click menu, tray, size slider, settings persistence all work.
- Real transparent PNG assets are integrated.

Goal:
When the user drags the pet near the top edge of any visible desktop window, the pet should lightly snap onto that window’s top edge. After snapping, the pet should be able to idle, sleep, be happy, and walk left/right along the top boundary of that target window. While perched on a window, the pet must not move beyond that window’s left and right boundaries.

Important:
Do not break existing features:
- manual dragging
- walking
- random behavior
- right-click menu
- tray
- size slider
- settings persistence
- transparent window
- Electron security settings

Do not add new animation assets.
Do not add a new PetState called perched. Perched mode should be a separate position/movement mode, not an animation state.

Technical reality:
Electron does not directly expose other applications’ window bounds. On macOS, implement a best-effort MVP using Accessibility / AppleScript / osascript or any existing project-compatible method from the main process. If permissions are missing, do not crash. Return an empty candidate list and log a warning that Accessibility permission may be required.

Required feature:
1. Add a way for main process to return visible external window bounds.
2. Exclude MochiCat’s own window.
3. Exclude invalid windows, zero-size windows, Dock/menu bar/desktop pseudo-windows if possible.
4. During drag end, check whether the pet is near any external window’s top edge.
5. If close enough, snap the pet onto the top edge.
6. Store perched state with the target window bounds.
7. While perched:
   - y position is locked to targetWindow.y - petHeight + overlap
   - x position is clamped between targetWindow.x and targetWindow.x + targetWindow.width - petWidth
   - idle / sleeping / happy animations still work
   - walk_left and walk_right move horizontally along the target window top edge only
8. If the user drags the pet again, detach from perched mode immediately.
9. If the target window moves/resizes, update the bounds or detach safely.
10. If the target window closes/disappears, detach safely.
11. If pet size changes while perched, recompute perch position and clamp x.

Snap detection:
Use the pet window bounds:
- petBottom = petY + petHeight
- petCenterX = petX + petWidth / 2

Use candidate window bounds:
- targetTop = window.y
- targetLeft = window.x
- targetRight = window.x + window.width

Recommended thresholds:
- snapThresholdY = 28 px
- snapHorizontalMargin = 24 px
- perchOverlapPx = 8 px

Snap if:
- abs(petBottom - targetTop) <= snapThresholdY
- petCenterX is within targetLeft - margin and targetRight + margin
- targetWindow.width is large enough for the pet

If multiple candidates match:
- choose the one with the smallest vertical distance.

Snap position:
- newY = targetWindow.y - petHeight + perchOverlapPx
- newX = clamp(currentPetX, targetWindow.x, targetWindow.x + targetWindow.width - petWidth)

If newY would put most of the pet off-screen, do not snap to that window.

Implementation guidance:
- Create a hook such as useWindowPerchSnap.ts.
- Create a type such as ExternalWindowBounds.
- Add safe preload/main IPC such as:
  window.mochiCat.externalWindows.getVisibleWindows()
  or
  window.mochiCat.window.getSnapCandidates()
- Do not expose raw ipcRenderer.
- Do not disable contextIsolation.
- Do not enable nodeIntegration.

Walking integration:
Modify useWalkingMovement or equivalent:
- If not perched, keep current screen/workArea walking bounds.
- If perched, use target window left/right as movement bounds and lock y to perchY.
- When reaching the target window left/right boundary, stop walking and return to idle.

Random behavior:
Random behavior should continue while perched.
The cat can randomly:
- idle
- happy
- sleeping
- walk_left
- walk_right

When perched, walk_left/walk_right must stay on the target window top edge and never exceed the target window boundaries.

Drag integration:
- On drag start, detach from perched mode.
- On drag end, check for snap candidates.
- Do not query external windows on every mousemove unless throttled; MVP can check on mouseup/drag end.

Target window maintenance:
While perched, periodically refresh the target window bounds every 500–1000 ms.
If still present:
- update perchY
- clamp x
If missing:
- detach from perched mode.

Before writing code:
1. Inspect current project structure.
2. Locate drag logic.
3. Locate walking movement logic.
4. Locate random behavior logic.
5. Locate preload/main IPC structure.
6. Explain how external window bounds will be queried on macOS.
7. Explain how permission failure will be handled.
8. List files to create or modify.
9. Then implement.

After implementation:
1. List all changed files.
2. Explain how snap detection works.
3. Explain how perched state is represented.
4. Explain how walking is constrained while perched.
5. Explain how the target window is refreshed or detached.
6. Explain how to test Accessibility permission failure.
7. Explain how to manually test the feature.

Validation:
- Drag pet near the top edge of a Finder/VS Code/browser window.
- Pet should lightly snap onto the top edge.
- Pet should sit naturally on the window boundary.
- Pet should idle/sleep/happy while perched.
- Pet should walk left/right along that window top edge.
- Pet must not exceed the target window’s left/right edges.
- Dragging pet again should detach it.
- Closing/moving/resizing the target window should not crash the app.
- Existing free dragging and walking must still work.
- TypeScript must pass.
- Renderer and main process logs must not show runtime errors.
```

---

## 22. 推荐 Agent 修改步骤

Agent 应按顺序执行：

```text
1. 检查现有拖拽逻辑。
2. 检查现有 walking movement 逻辑。
3. 检查现有 random behavior 逻辑。
4. 检查 preload/main IPC 风格。
5. 实现 external window bounds 查询。
6. 增加 ExternalWindowBounds 类型。
7. 增加 useWindowPerchSnap。
8. 在拖拽结束时调用 snap 检查。
9. 在拖拽开始时 detach。
10. 修改 useWalkingMovement 支持 perched bounds。
11. 处理目标窗口刷新 / 消失。
12. 处理尺寸变化时 perched 位置重算。
13. 测试吸附。
14. 测试 perched walking。
15. 测试拖拽脱离。
16. 测试权限不足降级。
```

---

## 23. 常见问题与处理

### 23.1 无法获取其他窗口 bounds

原因：

```text
macOS Accessibility 权限不足
AppleScript 查询失败
目标 App 不暴露窗口信息
```

处理：

```text
返回空候选列表
禁用 snap
保留原功能
在日志中提示需要权限
```

### 23.2 小猫吸附到错误对象

处理：

```text
过滤无标题 / 0 尺寸 / 极小窗口
过滤 MochiCat 自己
过滤 Dock / menu bar / desktop
按距离选择最接近的正常窗口
```

### 23.3 吸附后走出窗口边界

处理：

```text
检查 perched movement bounds 是否使用 target left/right
检查 petWidth 是否参与 maxX 计算
检查 size 改变后是否重新 clamp
```

### 23.4 拖拽后仍被窗口约束

处理：

```text
确保 drag start 时 detachFromPerch
确保 free mode 下 walking 使用普通 screen bounds
```

---

## 24. 代码质量要求

```text
1. Perched mode 不应污染 PetState。
2. 外部窗口查询必须在 main process。
3. Renderer 只通过安全 IPC 获取候选窗口。
4. 不暴露 raw ipcRenderer。
5. 不破坏现有 dragging / walking。
6. 查询外部窗口不要高频执行。
7. 目标窗口消失时必须安全 detach。
8. 所有 timer / interval 必须清理。
9. 权限失败必须优雅降级。
```

---

## 25. Phase 9 完成后的 Git 提交建议

```bash
git status
git add .
git commit -m "feat: add window top edge perch snapping"
```
