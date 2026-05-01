# MochiCat Phase 9.1 Prompt：增强窗口上沿吸附效果并接入现有 Perch 代码

## 任务标题

增强 MochiCat 拖拽靠近窗口上沿时的吸附效果，并修复当前 Perch Mode 几乎没有生效的问题。

---

## 背景

当前用户反馈：

```text
拖动小猫靠近其他桌面窗口上沿时，吸附效果不明显，几乎感受不到吸附。
```

请先基于当前仓库代码修复，不要重新设计整套项目。

我已经检查过当前仓库，发现当前代码中已经存在一部分 Perch / Snap 相关代码，但没有完整接入，因此用户几乎感受不到吸附效果。

---

## 当前仓库中的关键事实

### 1. 已存在 `useWindowPerchSnap.ts`

路径：

```text
mochi-cat/src/hooks/useWindowPerchSnap.ts
```

其中已经定义了：

```ts
SNAP_THRESHOLD_Y = 28
SNAP_HORIZONTAL_MARGIN = 24
PERCH_OVERLAP_PX = 8
REFRESH_INTERVAL_MS = 750
```

也已经实现了：

```text
findBestSnapCandidate
getPerchGeometry
trySnapToWindowTop
detachFromPerch
perchMovementBounds
```

但这些阈值偏保守，吸附距离太短，用户难以感知。

---

### 2. `App.tsx` 没有接入 `useWindowPerchSnap`

当前 `App.tsx` 只调用了：

```ts
useWalkingMovement({
  petState,
  isDragging,
  isWindowVisible,
  onWalkComplete: triggerIdle,
});
```

没有：

```text
import useWindowPerchSnap
调用 useWindowPerchSnap
在 drag end 后调用 trySnapToWindowTop
在 drag start 时 detachFromPerch
把 perchMovementBounds 传给 useWalkingMovement
```

这意味着即使 `useWindowPerchSnap.ts` 文件存在，实际 UI 中也几乎不会产生吸附效果。

---

### 3. `useWalkingMovement.ts` 已经支持 perched bounds

当前 `useWalkingMovement.ts` 的参数里已经有：

```ts
perchMovementBounds?: PerchMovementBounds | null;
```

并且 walking 时会优先使用 `activePerchBounds`。

但是 `App.tsx` 当前调用 `useWalkingMovement` 时没有传入：

```ts
perchMovementBounds
```

因此窗口上沿模式下的左右走动边界并没有真正接入。

---

### 4. `preload.ts` 已暴露一部分 API，但 main process 可能缺 handler

当前 `preload.ts` 已暴露：

```ts
window.mochiCat.window.getBounds()
window.mochiCat.window.getDisplayBounds()
window.mochiCat.externalWindows.getVisibleWindows()
```

但需要检查 `main.ts` 是否真正注册了对应 IPC handler：

```text
window:get-bounds
window:get-display-bounds
external-windows:get-visible-windows
```

如果 main process 没有注册这些 handler，`useWindowPerchSnap` 会失败或只能 catch 返回空数组，导致永远吸附不到窗口。

---

### 5. `PetSprite.tsx` 当前没有 forwardRef

当前 `PetSprite.tsx` 只是普通组件：

```tsx
export function PetSprite({ state, onMouseDown, onDoubleClick, onContextMenu }: PetSpriteProps) {
  ...
}
```

它没有暴露 DOM ref。  
但 `useWindowPerchSnap` 需要 `petVisualRectInWindow`，而最准确的方式是从 `PetSprite` DOM 元素读取：

```ts
buttonRef.current.getBoundingClientRect()
```

因此需要给 `PetSprite` 增加 `forwardRef`，或者在 `App.tsx` 中包一层可测量容器。

---

## 目标

本次任务的目标不是从零重写，而是：

```text
1. 完整接入已经存在的 useWindowPerchSnap。
2. 实现缺失的 main process IPC handlers。
3. 增强吸附阈值和吸附视觉反馈。
4. 让拖拽靠近任意窗口上边沿时明显吸附。
5. 吸附后，小猫可以在目标窗口上沿 idle / sleep / happy / walk_left / walk_right。
6. walk_left / walk_right 不能超过目标窗口左右边界。
```

---

## 不要做什么

不要实现：

```text
复杂物理引擎
真实窗口嵌入
拖拽阴影预览
新动画素材
AI 对话
音效
多宠物
复杂路径规划
```

不要破坏：

```text
idle / dragging / happy / sleeping / walk_left / walk_right
手动拖拽
顶部空气墙 bug 的修复
右键菜单
托盘
尺寸滑动条
随机行为
设置持久化
透明窗口
Electron 安全设置
```

Electron 安全设置必须保持：

```text
contextIsolation: true
nodeIntegration: false
不要暴露 raw ipcRenderer
```

---

## 必须修改的核心点

---

# Part A：让 `useWindowPerchSnap` 真正接入 App

## A1. 在 `App.tsx` 中引入 hook

新增：

```ts
import { useWindowPerchSnap } from './hooks/useWindowPerchSnap';
```

实际路径按当前仓库为准。

---

## A2. 获取 PetSprite visual rect

需要在 `App.tsx` 中维护：

```ts
const petSpriteRef = useRef<HTMLButtonElement | null>(null);
const [petVisualRectInWindow, setPetVisualRectInWindow] = useState<SpriteRectInWindow>({
  left: 0,
  top: 0,
  width: localSizePx,
  height: localSizePx,
});
```

创建函数：

```ts
function updatePetVisualRect() {
  const rect = petSpriteRef.current?.getBoundingClientRect();
  if (!rect) return;

  setPetVisualRectInWindow({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
}
```

在以下时机调用：

```text
1. mount 后
2. localSizePx 改变后
3. drag start 前
4. drag end 前 / snap 前
```

---

## A3. 修改 `PetSprite.tsx` 支持 ref

将 `PetSprite` 改为 `forwardRef<HTMLButtonElement, PetSpriteProps>`。

示例方向：

```tsx
import { forwardRef, type MouseEventHandler } from 'react';

export const PetSprite = forwardRef<HTMLButtonElement, PetSpriteProps>(
  function PetSprite({ state, onMouseDown, onDoubleClick, onContextMenu }, ref) {
    const { currentFrame } = useAnimation(state);

    return (
      <button
        ref={ref}
        className={`pet-sprite-button pet-${state}`}
        type="button"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        aria-label="MochiCat desktop pet"
      >
        ...
      </button>
    );
  }
);
```

在 `App.tsx` 中：

```tsx
<PetSprite
  ref={petSpriteRef}
  state={petState}
  onMouseDown={handleMouseDown}
  onDoubleClick={handleDoubleClick}
  onContextMenu={handleContextMenu}
/>
```

---

## A4. 调用 `useWindowPerchSnap`

在 `App.tsx` 中调用：

```ts
const {
  detachFromPerch,
  trySnapToWindowTop,
  perchMovementBounds,
  isPerched,
} = useWindowPerchSnap({
  isDragging,
  isWindowVisible,
  petVisualRectInWindow,
});
```

如果当前 hook 没有返回 `isPerched`，请扩展返回值：

```ts
isPerched: perchState.mode === 'perched'
```

或者返回完整：

```ts
perchState
```

---

## A5. drag start 时 detach

在 `handleMouseDown` 中，在进入 dragging 之前：

```ts
detachFromPerch();
updatePetVisualRect();
await window.mochiCat.window.dragStart(event.screenX, event.screenY, petVisualRectInWindow);
```

注意：

当前 `preload.ts` 的 `dragStart` 类型接受第三个参数 `spriteRect`，但 `App.tsx` 目前调用时只传了两个参数。需要修正。

如果 main process 当前不使用第三个参数，也可以先传入，保持 API 一致，后续拖拽/吸附都能复用。

---

## A6. drag end 后尝试吸附

在当前 `stopDragging` 中，`dragEnd` 后应尝试吸附。

建议逻辑：

```ts
await window.mochiCat.window.dragEnd();
setIsDragging(false);
markUserInteraction();

let snapped = false;
if (didDrag) {
  updatePetVisualRect();
  snapped = await trySnapToWindowTop();
}

if (didDrag) {
  petStateRef.current = 'idle';
  setPetState('idle');
}

if (snapped) {
  showBubble('坐好啦');
}
```

注意：

```text
trySnapToWindowTop 必须在 drag end 后调用。
否则用户永远感受不到吸附。
```

---

## A7. walking movement 传入 perchMovementBounds

把当前：

```ts
useWalkingMovement({
  petState,
  isDragging,
  isWindowVisible,
  onWalkComplete: triggerIdle,
});
```

改为：

```ts
useWalkingMovement({
  petState,
  isDragging,
  isWindowVisible,
  perchMovementBounds,
  onWalkComplete: triggerIdle,
});
```

这样吸附后小猫走路才会被限制在窗口上沿左右边界内。

---

# Part B：修复 / 补齐 main process IPC

检查 `mochi-cat/src/main.ts`。

当前 `preload.ts` 暴露了这些 API：

```ts
getBounds
getDisplayBounds
externalWindows.getVisibleWindows
```

main process 必须注册对应 handler。

---

## B1. 添加 `window:get-bounds`

```ts
ipcMain.handle('window:get-bounds', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: 0, width: 300, height: 300 };
  }
  return mainWindow.getBounds();
});
```

---

## B2. 添加 `window:get-display-bounds`

```ts
ipcMain.handle('window:get-display-bounds', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return screen.getPrimaryDisplay().bounds;
  }
  return screen.getDisplayMatching(mainWindow.getBounds()).bounds;
});
```

---

## B3. 添加 `external-windows:get-visible-windows`

必须实现：

```text
查询 macOS 当前可见窗口 bounds
过滤 MochiCat 自己
过滤无效窗口
返回 ExternalWindowBounds[]
```

建议实现方式：

```text
macOS: osascript / AppleScript 查询 System Events
非 macOS: 返回 []
权限不足: 返回 []
```

不要让权限错误导致 app 崩溃。

### 推荐 AppleScript 思路

在 main process 中使用：

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
```

执行：

```text
osascript
```

查询可见进程窗口的 position 与 size。

返回格式建议用分隔符文本，避免复杂 AppleScript JSON。比如每行：

```text
appName|||windowTitle|||x|||y|||width|||height
```

然后在 TS 中 parse。

### 必须过滤

过滤条件：

```text
width < 120
height < 80
title 为空且 appName 可疑
appName 包含 MochiCat / monicat / Electron 当前应用
x/y/width/height 不是数字
窗口尺寸为 0
```

注意：

如果获取不到权限，返回 [] 并 log：

```text
MochiCat: external window query failed. Accessibility permission may be required.
```

不要 throw 到 renderer。

---

# Part C：增强吸附效果

当前常量太保守：

```ts
SNAP_THRESHOLD_Y = 28
SNAP_HORIZONTAL_MARGIN = 24
PERCH_OVERLAP_PX = 8
```

请改为更明显的参数：

```ts
const SNAP_THRESHOLD_Y = 72;
const SNAP_HORIZONTAL_MARGIN = 80;
const PERCH_OVERLAP_PX = 12;
const SNAP_ANIMATION_MS = 160;
const SNAP_DEBUG = import.meta.env.DEV;
```

说明：

```text
SNAP_THRESHOLD_Y = 72：用户靠近窗口上沿 72px 内即可吸附。
SNAP_HORIZONTAL_MARGIN = 80：允许小猫中心略超出窗口左右范围时仍可吸附。
PERCH_OVERLAP_PX = 12：小猫底部轻微压到窗口上沿，看起来更像坐上去。
```

---

## C1. 吸附位置应明显“贴上去”

当前 `getPerchGeometry` 的思想可以保留：

```ts
y = targetWindow.y - (rect.top + rect.height) + PERCH_OVERLAP_PX;
```

但需要保证：

```text
吸附后小猫底部与目标窗口 top 的关系稳定。
```

吸附后：

```ts
visiblePetBottom = newWindowY + rect.top + rect.height
```

应满足：

```ts
visiblePetBottom ≈ targetWindow.y + PERCH_OVERLAP_PX
```

请添加 DEV log 验证该关系。

---

## C2. 增加吸附后的反馈

吸附成功后，必须有一个用户可感知反馈：

```text
显示气泡：“坐好啦”
```

可选：

```text
触发 happy 0.5–1 秒后回 idle
```

但不要强制进入 happy 太久，避免影响 perched idle。

推荐：

```ts
if (snapped) showBubble('坐好啦');
```

---

## C3. 添加吸附调试日志

开发模式下，当 `trySnapToWindowTop()` 被调用时输出：

```text
petBounds
candidate count
best candidate
verticalDistance
withinVerticalRange
withinHorizontalRange
targetWindow appName/title/x/y/width/height
snap success / fail reason
```

这一步非常重要。用户现在的问题是“感受不到吸附”，必须能确认到底是：

```text
1. 没有调用 trySnapToWindowTop
2. externalWindows 返回 []
3. 阈值太小
4. 坐标系不一致
5. 候选窗口被过滤掉
6. 吸附成功但没有反馈
```

---

# Part D：坐标系校准

外部窗口 bounds 的坐标必须与 Electron BrowserWindow 坐标一致。

如果 AppleScript 返回的 y 坐标与 Electron 坐标系不一致，吸附会失败。

必须在 DEV log 中打印：

```text
mainWindow.getBounds()
external window candidates
screen display bounds
```

如果发现 AppleScript 坐标需要转换，必须修正。

macOS 常见问题：

```text
AppleScript window position 通常是左上角坐标，但多显示器/Retina 下可能存在 scale 或菜单栏影响。
Electron screen bounds 也是 DIP 坐标。
通常可以直接使用，但必须通过日志验证。
```

不要盲目假设坐标一定一致。

---

# Part E：让吸附失败时不影响拖拽

如果：

```text
没有权限
没有外部窗口
没有候选窗口
坐标查询失败
```

必须：

```text
1. 不崩溃。
2. 不影响普通拖拽。
3. 不影响 walking/random/menu/tray。
4. 只是保持 free mode。
```

---

# Part F：随机走路与 perched bounds

吸附成功后：

```text
小猫仍然可以 idle / sleeping / happy / walk_left / walk_right。
```

当处于 perched mode：

```text
useWalkingMovement 必须使用 perchMovementBounds。
```

窗口上沿走路约束：

```text
minX = targetWindow.x - rect.left
maxX = targetWindow.x + targetWindow.width - (rect.left + rect.width)
y = targetWindow.y - (rect.top + rect.height) + PERCH_OVERLAP_PX
```

如果走到边界：

```text
停止 walking
返回 idle
```

---

# Part G：尺寸变化后的吸附位置更新

如果用户打开尺寸滑动条修改大小，而当前处于 perched mode：

```text
petVisualRectInWindow 会变化。
useWindowPerchSnap 应根据新 rect 重新计算 perch y 和 x clamp。
```

当前 hook 已有 refresh 逻辑，确保依赖包含：

```text
petVisualRectInWindow
```

并且不要造成无限 setPosition 循环。

---

## 验收标准

必须逐项验证：

```text
[ ] npm start 正常启动。
[ ] App.tsx 真正调用 useWindowPerchSnap。
[ ] drag end 后真正调用 trySnapToWindowTop。
[ ] useWalkingMovement 接收到 perchMovementBounds。
[ ] main process 存在 window:get-bounds handler。
[ ] main process 存在 window:get-display-bounds handler。
[ ] main process 存在 external-windows:get-visible-windows handler。
[ ] 拖动小猫靠近 Finder / VS Code / 浏览器窗口上沿时，小猫明显吸附。
[ ] 不需要像素级贴近，距离窗口上沿 50–70px 内就应有吸附机会。
[ ] 吸附后显示“坐好啦”或类似反馈。
[ ] 吸附后小猫底部轻微压在窗口上沿附近。
[ ] 吸附后小猫可以 idle。
[ ] 吸附后小猫可以 sleeping。
[ ] 吸附后小猫可以 walk_left / walk_right。
[ ] perched walking 不超过目标窗口左右边界。
[ ] 再次拖动小猫时会脱离 perched mode。
[ ] external window 查询失败时 app 不崩溃。
[ ] 没有 Accessibility 权限时 app 不崩溃，只是不能吸附。
[ ] 右键菜单仍然正常。
[ ] 托盘仍然正常。
[ ] 尺寸滑动条仍然正常。
[ ] 随机行为仍然正常。
[ ] 普通 walking 仍然正常。
[ ] TypeScript 无错误。
[ ] Renderer Console 无异常。
[ ] Main Process terminal 无异常。
```

---

## Agent 执行 Prompt

```text
We need to strengthen and actually wire up MochiCat window-top-edge snap / perch behavior.

Current user-visible problem:
Dragging the cat near another app window’s top edge produces almost no noticeable snapping effect. The user can barely feel any attraction or snap.

Important repository findings:
1. mochi-cat/src/hooks/useWindowPerchSnap.ts already exists and implements snap geometry, trySnapToWindowTop, detachFromPerch, and perchMovementBounds.
2. App.tsx currently does not import or call useWindowPerchSnap.
3. App.tsx currently calls useWalkingMovement without passing perchMovementBounds.
4. preload.ts exposes getBounds, getDisplayBounds, and externalWindows.getVisibleWindows.
5. main.ts must be checked because it may not register handlers for:
   - window:get-bounds
   - window:get-display-bounds
   - external-windows:get-visible-windows
6. PetSprite.tsx currently does not expose a ref, so App cannot reliably compute petVisualRectInWindow.

Goal:
Make the window-top-edge snapping behavior obvious and functional.

Implementation requirements:

Part 1 - Wire up useWindowPerchSnap in App.tsx:
- Import useWindowPerchSnap.
- Track PetSprite DOM ref.
- Measure PetSprite getBoundingClientRect() as petVisualRectInWindow.
- Call useWindowPerchSnap({ isDragging, isWindowVisible, petVisualRectInWindow }).
- On drag start, call detachFromPerch().
- On drag end, call trySnapToWindowTop().
- If snap succeeds, show a visible bubble such as “坐好啦”.
- Pass perchMovementBounds into useWalkingMovement.

Part 2 - Modify PetSprite.tsx:
- Convert PetSprite to forwardRef<HTMLButtonElement, PetSpriteProps>.
- Attach the ref to the button element.

Part 3 - Fix IPC:
- Ensure main.ts implements:
  - window:get-bounds
  - window:get-display-bounds
  - external-windows:get-visible-windows
- If external window query fails because of macOS Accessibility permission, return [] and log a warning. Do not crash.
- Do not expose raw ipcRenderer.
- Keep contextIsolation true and nodeIntegration false.

Part 4 - Implement external window query on macOS:
- Use osascript / AppleScript or an existing compatible method.
- Return ExternalWindowBounds[] with appName, title, x, y, width, height.
- Exclude MochiCat’s own window.
- Filter invalid tiny / zero-size windows.
- If platform is not darwin, return [].

Part 5 - Strengthen snap thresholds:
In useWindowPerchSnap.ts, change the constants to stronger values:
- SNAP_THRESHOLD_Y = 72
- SNAP_HORIZONTAL_MARGIN = 80
- PERCH_OVERLAP_PX = 12

Add DEV-only debug logging around trySnapToWindowTop:
- candidate count
- petBounds
- target candidate
- vertical distance
- horizontal range check
- success / fail reason

Part 6 - Perch geometry:
After snapping, ensure:
visiblePetBottom = windowY + rect.top + rect.height
is approximately:
targetWindow.y + PERCH_OVERLAP_PX

The snap should look like the cat is sitting lightly on the window top edge.

Part 7 - Walking while perched:
- useWalkingMovement must receive perchMovementBounds.
- When perched, walk_left / walk_right must use target-window left/right bounds.
- The cat must not walk outside the target window’s horizontal boundaries.

Part 8 - Safety:
Do not break existing:
- manual dragging
- top-boundary drag fix
- idle / dragging / happy / sleeping / walk_left / walk_right
- random behavior
- right-click menu
- tray
- size slider
- settings persistence
- transparent window

Validation:
1. Run npm start.
2. Open a Finder / VS Code / browser window.
3. Drag the cat near the top edge of that window.
4. Within roughly 50–70px of the top edge, the cat should snap clearly.
5. The cat should show “坐好啦”.
6. The cat should visually sit on the window top edge.
7. The cat can idle / sleep / walk while perched.
8. Walking while perched does not exceed target window left/right boundaries.
9. Dragging the cat again detaches from perched mode.
10. If Accessibility permission is missing, app does not crash.
11. TypeScript and runtime logs are clean.

Before coding:
1. Inspect App.tsx.
2. Inspect PetSprite.tsx.
3. Inspect useWindowPerchSnap.ts.
4. Inspect useWalkingMovement.ts.
5. Inspect preload.ts.
6. Inspect main.ts.
7. List exact files to modify.
8. Explain why current snap is not obvious.
9. Then implement.

After coding:
1. List changed files.
2. Explain how snap is triggered after drag end.
3. Explain how external window bounds are obtained.
4. Explain how perchMovementBounds is passed to walking.
5. Explain what debug logs show.
6. Explain how to test with and without Accessibility permission.
```

---

## 建议修改文件清单

Agent 大概率需要修改：

```text
mochi-cat/src/App.tsx
mochi-cat/src/components/PetSprite.tsx
mochi-cat/src/hooks/useWindowPerchSnap.ts
mochi-cat/src/main.ts
mochi-cat/src/preload.ts
mochi-cat/src/types/global.d.ts
mochi-cat/src/types/ipc.ts
```

其中 `preload.ts`、`global.d.ts`、`ipc.ts` 可能已经有相关类型，只需校验和补齐。

---

## 最终判断标准

这个任务只有在以下条件满足时才算完成：

```text
1. useWindowPerchSnap 被 App.tsx 实际调用。
2. drag end 后会执行 trySnapToWindowTop。
3. main process 能返回真实 external windows。
4. 吸附阈值明显扩大。
5. 吸附成功后有视觉反馈。
6. walk_left / walk_right 在 perched mode 下被限制在目标窗口左右边界内。
7. 权限失败时不崩溃。
```
