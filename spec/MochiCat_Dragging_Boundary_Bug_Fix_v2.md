# MochiCat Manual Dragging Top Boundary Bug Fix Prompt v2

## 任务标题

彻底修复 MochiCat 手动拖拽时无法进入屏幕上方区域的“空气墙”问题。

---

## 背景

当前 MochiCat 在 macOS 桌面上拖拽时仍然存在 bug：

```text
用户拖动小猫到屏幕上方时，无法继续向上移动。
屏幕顶部大约一部分区域像有一堵“空气墙”。
即使之前已经把 event.screenX / event.screenY 传入 IPC，问题仍然存在。
```

上一轮修复只解决了一个问题：

```text
dragStart / dragMove 从 renderer 传入 event.screenX / event.screenY，避免主进程用 getCursorScreenPoint() 读取延迟后的鼠标位置。
```

但这并没有解决最终现象。说明问题不只在鼠标坐标读取，还可能存在以下问题：

```text
1. main process 仍然存在 y clamp。
2. renderer 仍然存在 y clamp。
3. 手动拖拽仍然使用 display.workArea。
4. BrowserWindow 的 top-left 被限制为 y >= 0 或 y >= workArea.y。
5. 实际可见小猫在 BrowserWindow 内有 top padding / internal offset，因此即使 window.y = 0，小猫视觉主体仍然离屏幕顶部很远。
6. PetSprite / pet-window / size slider 之后的布局导致视觉猫咪位置与 BrowserWindow 位置不一致。
7. walking movement 的边界逻辑被误用于 manual dragging。
```

这次必须彻底定位并修复。

---

## 最终目标

手动拖拽时必须满足：

```text
小猫的可见主体可以被拖动到整个桌面可见区域，包括屏幕最上方区域。
不应出现顶部 20% 空间无法进入的空气墙。
```

更准确地说：

```text
用户拖拽的是“小猫视觉主体”，不是 BrowserWindow 的左上角。
边界限制应该基于可见小猫主体或完全不限制，而不是粗暴限制 BrowserWindow top-left。
```

---

## 当前项目状态

项目已经支持：

```text
Electron + React + TypeScript + Vite
透明 frameless always-on-top BrowserWindow
手动拖拽
真实透明 PNG 猫咪素材
状态：
- idle
- dragging
- happy
- sleeping
- walk_left
- walk_right

右键菜单
系统托盘
尺寸滑动条
随机行为
走路行为
窗口上沿吸附/Perch mode 可能正在开发或已计划
settings.json 持久化
```

修复此 bug 时，不要破坏这些功能。

---

## 必须保留

```text
1. idle / dragging / happy / sleeping / walk_left / walk_right 动画正常。
2. 右键菜单正常。
3. 托盘菜单正常。
4. 尺寸滑动条正常。
5. 随机行为正常。
6. walking movement 正常。
7. 设置持久化正常。
8. 透明窗口正常。
9. Electron 安全设置不变。
```

Electron 安全要求：

```text
contextIsolation: true
nodeIntegration: false
不要暴露 raw ipcRenderer
```

---

## 关键判断：这次不要只修鼠标坐标

上一轮已经做了：

```text
dragStart(x, y)
dragMove(x, y)
renderer 传 event.screenX / event.screenY
main process 不再使用 getCursorScreenPoint()
```

如果问题仍然存在，下一步必须检查：

```text
1. 是否仍然有任何手动拖拽 clamp。
2. clamp 的对象是不是 BrowserWindow，而不是猫咪可见主体。
3. BrowserWindow 内部是否有大量 top padding，导致 window.y = 0 时猫咪仍然下移。
4. 是否有 CSS transform / top / margin / padding 影响 PetSprite 位置。
5. 是否需要允许 BrowserWindow 的 y 为负数，才能让可见猫咪靠近屏幕顶部。
```

---

## 必须先做诊断日志

在修改之前，先增加临时诊断日志或调试输出，确认真实原因。

拖拽过程中至少记录以下值：

```text
1. mouseScreenX / mouseScreenY
2. currentWindowX / currentWindowY
3. dragOffsetX / dragOffsetY
4. requestedWindowX / requestedWindowY
5. finalWindowX / finalWindowY after clamp
6. display.bounds
7. display.workArea
8. BrowserWindow width / height
9. PetSprite 在 BrowserWindow 内部的 visual rect：
   - spriteLeftInWindow
   - spriteTopInWindow
   - spriteWidth
   - spriteHeight
10. 可见小猫全局位置：
   - visiblePetTop = windowY + spriteTopInWindow
   - visiblePetBottom = windowY + spriteTopInWindow + spriteHeight
```

如果日志太多，可以只在 y < 200 时输出。

必须回答：

```text
当空气墙发生时，到底是哪一个值被 clamp 住了？
是 requestedWindowY 已经不能更小？
还是 finalWindowY 被 clamp？
还是 windowY 已经到达 0，但 spriteTopInWindow 很大？
```

---

## 高概率根因

### 根因 A：BrowserWindow top-left 被限制为 y >= 0

如果代码类似：

```ts
const clampedY = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - windowHeight));
```

这会导致：

```text
BrowserWindow 的 y 不能小于 0。
但如果猫咪图片在 BrowserWindow 内部不是贴着顶部，而是有 top padding，
则小猫可见主体永远无法到达屏幕顶部。
```

正确做法不是简单限制 BrowserWindow top-left，而是：

```text
基于可见 PetSprite 的 rect 来计算边界。
```

例如：

```ts
minWindowY = display.bounds.y - spriteTopInWindow;
```

这样允许：

```text
windowY < 0
```

只要可见小猫本体仍在屏幕内即可。

---

### 根因 B：使用 workArea 限制手动拖拽

如果使用：

```ts
display.workArea.y
```

在 macOS 上它可能排除了菜单栏区域。  
手动拖拽不应被 workArea 严格限制。

手动拖拽应优先使用：

```ts
display.bounds
```

或者完全不 clamp。

walking movement 可以继续使用 workArea 或安全边界。

---

### 根因 C：CSS 布局造成视觉偏移

检查以下 CSS：

```text
.pet-window
.pet-sprite-button
.pet-sprite-image
.size-slider-panel
body / #root
```

重点检查：

```text
padding-top
margin-top
align-items
justify-content
transform
translateY
top
height
```

如果 BrowserWindow 比小猫视觉图大很多，且小猫居中，那么 window.y = 0 时小猫仍然离顶部有一大段距离。

这时必须使用：

```text
sprite visual rect offset
```

而不是 BrowserWindow bounds 作为拖拽边界。

---

## 推荐修复方案：手动拖拽基于可见小猫主体边界

### 1. Renderer 提供 PetSprite visual rect

在 renderer 中提供当前 PetSprite 在 BrowserWindow 内部的位置。

可在拖拽开始时从 DOM 读取：

```ts
const rect = petSpriteElement.getBoundingClientRect();
```

并传给 main process 或在 renderer 内参与计算：

```ts
spriteRectInWindow = {
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
};
```

注意：

```text
rect.left / rect.top 是相对于 renderer viewport 的坐标。
对于 frameless BrowserWindow，它可以表示 PetSprite 在 BrowserWindow 内部的偏移。
```

---

### 2. 手动拖拽 clamp 逻辑基于 PetSprite，而不是 BrowserWindow

如果要防止小猫完全拖出屏幕，应使用：

```ts
minWindowX = display.bounds.x - spriteLeftInWindow;
maxWindowX = display.bounds.x + display.bounds.width - (spriteLeftInWindow + spriteWidth);

minWindowY = display.bounds.y - spriteTopInWindow;
maxWindowY = display.bounds.y + display.bounds.height - (spriteTopInWindow + spriteHeight);
```

然后：

```ts
finalX = clamp(requestedWindowX, minWindowX, maxWindowX);
finalY = clamp(requestedWindowY, minWindowY, maxWindowY);
```

这样能保证：

```text
可见小猫主体可以到达屏幕顶部
同时不会完全丢失在屏幕外
```

---

### 3. 如果当前实现复杂，MVP 可以先完全取消手动拖拽 clamp

为了确认 bug，先做一个最小验证版本：

```ts
mainWindow.setPosition(Math.round(x), Math.round(y));
```

不进行任何 y clamp。

如果取消 clamp 后顶部空气墙消失，说明问题 100% 是 clamp / visual offset 造成的。

然后再加“基于 PetSprite visual rect 的安全 clamp”。

不要继续用 BrowserWindow top-left clamp。

---

## 手动拖拽和 walking movement 必须分离

必须区分两套边界策略：

```text
Manual drag:
- 用户直接控制，必须尽可能自由。
- 允许 window.y 为负数，只要可见猫咪没有完全丢失。
- 不应使用 walking 的安全边界。

Autonomous walking:
- 系统自动移动，必须安全。
- 可以使用 workArea 或 screen bounds。
- 如果 perched mode 存在，则使用目标窗口左右边界。
```

不要把 walking 的 clamp 复用到 manual drag。

---

## 正确拖拽流程

### dragStart

Renderer 应传入：

```text
event.screenX
event.screenY
spriteRectInWindow
```

Main process 或 renderer 应记录：

```text
windowX
windowY
mouseScreenX
mouseScreenY
dragOffsetX = mouseScreenX - windowX
dragOffsetY = mouseScreenY - windowY
spriteRectInWindow
```

### dragMove

Renderer 每次 mousemove 传入：

```text
event.screenX
event.screenY
```

计算：

```ts
requestedX = mouseScreenX - dragOffsetX;
requestedY = mouseScreenY - dragOffsetY;
```

然后对 requestedX/Y 进行：

```text
无 clamp
或基于 PetSprite visual rect 的 clamp
```

最后：

```ts
mainWindow.setPosition(Math.round(finalX), Math.round(finalY));
```

---

## 不允许的修复方式

不要继续使用：

```text
display.workArea.y 作为 manual drag 顶部边界
window.innerHeight 推算屏幕边界
screen.availHeight 推算 y clamp
固定 20% / 15% / 100px / 80px 顶部偏移
BrowserWindow y >= 0 作为唯一顶部边界
walking clamp 作为 manual drag clamp
```

不要只说“已经使用 event.screenY”就结束。这个 bug 当前已经证明不是单纯坐标延迟问题。

---

## 实现要求

### 必须检查并修改的文件

Agent 应先定位实际文件，通常可能包括：

```text
src/App.tsx
src/main.ts
src/preload.ts
src/types/global.d.ts
src/hooks/useWalkingMovement.ts
src/hooks/useWindowDrag.ts（如果存在）
src/utils/clampPosition.ts（如果存在）
```

不要盲目假设文件名。

---

## 推荐逐步修复流程

### Step 1：添加诊断

先输出拖拽时的：

```text
requestedY
finalY
display.bounds.y
display.workArea.y
spriteTopInWindow
visiblePetTop
```

确认空气墙出现时是哪一项被限制。

### Step 2：临时禁用 manual drag clamp

将手动拖拽改为：

```ts
mainWindow.setPosition(Math.round(requestedX), Math.round(requestedY));
```

验证顶部空气墙是否消失。

如果消失，继续 Step 3。

### Step 3：实现基于 PetSprite visual rect 的 clamp

用：

```ts
minWindowY = display.bounds.y - spriteTopInWindow;
maxWindowY = display.bounds.y + display.bounds.height - (spriteTopInWindow + spriteHeight);
```

而不是：

```ts
minWindowY = display.bounds.y
```

### Step 4：保留 walking clamp

walking movement 不要跟着改坏。  
walking 仍然可以使用：

```text
workArea / display bounds / perched target bounds
```

但 manual drag 不能被 walking bounds 限制。

### Step 5：移除临时日志或保留 gated debug

修复完成后：

```text
移除大量 console log
或放到 DEBUG_DRAG 开关后面
```

---

## 验收标准

必须逐项验证：

```text
[ ] npm start 正常启动。
[ ] 小猫可以被拖动到屏幕最上方区域。
[ ] 小猫可以靠近 macOS menu bar。
[ ] 小猫可以进入原本无法进入的顶部 20% 区域。
[ ] 没有顶部空气墙。
[ ] 拖拽开始时不跳动。
[ ] 拖拽过程中鼠标和小猫相对位置稳定。
[ ] 拖拽释放后状态正常回到 idle。
[ ] 小猫不会因为允许负 windowY 而完全丢失。
[ ] 如果拖到屏幕边缘，至少可见主体仍能找回。
[ ] walking movement 仍然正常。
[ ] walking 不会走出屏幕。
[ ] random behavior 仍然正常。
[ ] 右键菜单仍然正常。
[ ] 托盘仍然正常。
[ ] 尺寸 slider 仍然正常。
[ ] 调整尺寸后拖拽顶部仍然正常。
[ ] TypeScript 无错误。
[ ] Renderer Console 无异常。
[ ] Main Process terminal 无异常。
```

尤其要测试不同尺寸：

```text
petSizePx 最小值
petSizePx 中等值
petSizePx 最大值
```

因为 spriteTopInWindow 可能随尺寸变化。

---

## Agent 执行 Prompt

```text
We need to fix the MochiCat manual dragging top-boundary bug for real.

Previous attempted fix:
The previous fix changed dragStart and dragMove to pass event.screenX/event.screenY from renderer to main process instead of letting main process call getCursorScreenPoint(). However, the bug still exists.

Current bug:
When dragging the pet upward on macOS, the pet still cannot enter approximately the top part of the desktop. There is still an invisible top wall.

This means the issue is not only cursor IPC delay. You must now inspect and fix all drag boundary / clamp / visual offset logic.

Critical goal:
The visible cat sprite, not merely the BrowserWindow top-left corner, must be draggable across the whole desktop area, including the top region near the macOS menu bar.

Do not break:
- idle / dragging / happy / sleeping / walk_left / walk_right animations
- real transparent PNG assets
- manual dragging
- walking movement
- random behavior
- right-click menu
- tray menu
- size slider
- settings persistence
- transparent frameless window
- Electron security settings

Keep:
- contextIsolation: true
- nodeIntegration: false
- no raw ipcRenderer exposure

Before changing logic, add temporary diagnostics and identify the exact cause:
During drag near the top area, log:
- mouseScreenX / mouseScreenY
- currentWindowX / currentWindowY
- dragOffsetX / dragOffsetY
- requestedWindowX / requestedWindowY
- finalWindowX / finalWindowY after any clamp
- display.bounds
- display.workArea
- BrowserWindow size
- PetSprite visual rect inside the BrowserWindow:
  - spriteLeftInWindow
  - spriteTopInWindow
  - spriteWidth
  - spriteHeight
- visiblePetTop = windowY + spriteTopInWindow

Determine whether:
1. requestedWindowY is already wrong,
2. finalWindowY is being clamped,
3. workArea is being used,
4. BrowserWindow y is clamped to >= 0,
5. PetSprite has top padding/offset inside the BrowserWindow.

Likely real cause:
Manual drag is clamping BrowserWindow top-left using display.bounds.y, display.workArea.y, or y >= 0. But the visible cat sprite is inside the BrowserWindow with top padding / centering / CSS offset. Therefore, when window.y reaches 0, the visible cat is still far below the top of the screen, creating the apparent invisible wall.

Required fix:
Manual dragging must not clamp based only on BrowserWindow top-left.

Either:
A. Temporarily remove manual drag clamp entirely and call:
   mainWindow.setPosition(Math.round(requestedX), Math.round(requestedY));

or preferably:
B. Implement manual drag clamp based on the visible PetSprite rect inside the BrowserWindow.

The correct visual-sprite-based clamp is:

minWindowX = display.bounds.x - spriteLeftInWindow
maxWindowX = display.bounds.x + display.bounds.width - (spriteLeftInWindow + spriteWidth)

minWindowY = display.bounds.y - spriteTopInWindow
maxWindowY = display.bounds.y + display.bounds.height - (spriteTopInWindow + spriteHeight)

finalX = clamp(requestedWindowX, minWindowX, maxWindowX)
finalY = clamp(requestedWindowY, minWindowY, maxWindowY)

This allows windowY to become negative when necessary, so the visible cat sprite can reach the top of the screen.

Important:
Manual dragging and autonomous walking must use separate boundary policies.
- Manual dragging: permissive and based on visible sprite bounds.
- Walking movement: safe and bounded by screen/workArea/perched target bounds.

Do not reuse walking clamp for manual drag.

Implementation requirements:
1. Inspect current drag implementation.
2. Inspect all clampPosition logic.
3. Inspect CSS layout of pet-window and PetSprite.
4. Pass PetSprite visual rect from renderer to dragStart if needed.
5. Use event.screenX/event.screenY for mouse coordinates.
6. Use display.bounds, not workArea, for manual drag visual clamp.
7. Allow BrowserWindow y to be negative if required by spriteTopInWindow.
8. Keep walking movement bounds safe and unchanged unless necessary.
9. Remove or gate temporary logs after verification.

Validation:
Test with pet size small, medium, and large.
Verify:
1. The pet can be dragged into the top 20% area.
2. The pet can be dragged near the macOS menu bar.
3. The invisible top wall is gone.
4. Dragging does not jump.
5. Cursor-to-pet offset remains stable.
6. Dragging still works after resize slider changes.
7. Walking still works and remains bounded.
8. Random behavior still works.
9. Menu, tray, size slider, settings still work.
10. TypeScript and runtime logs are clean.

Before writing code:
1. List files to inspect.
2. Explain the actual root cause after diagnostics.
3. List files to modify.
4. Explain whether you will use no-clamp or visual-sprite-based clamp.
5. Then implement.

After implementation:
1. List all changed files.
2. Explain the final manual drag coordinate calculation.
3. Explain how spriteTopInWindow is used.
4. Explain why windowY may be allowed to become negative.
5. Explain why walking bounds are unaffected.
6. Confirm the top invisible wall is removed.
```

---

## 最终判断标准

这个 bug 只有在以下条件都满足时才算修复完成：

```text
1. 不是只修改 event.screenY。
2. 明确定位并移除/替换了错误的顶部 clamp。
3. 允许可见猫咪主体进入屏幕顶部区域。
4. 不再以 BrowserWindow top-left 作为唯一拖拽边界。
5. 尺寸变化后仍然可以拖到顶部。
```
