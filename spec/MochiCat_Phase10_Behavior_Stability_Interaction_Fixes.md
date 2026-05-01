# MochiCat Phase 10 Prompt：行为稳定化、Happy 裁切修复与点击/拖拽可靠性修复

## 任务标题

MochiCat Phase 10 - Behavior Coordination, Visual Bounds Fixes, and Interaction Reliability

---

## 背景

当前 MochiCat 已经完成了核心桌宠功能：

```text
- 透明 frameless always-on-top 桌面宠物窗口
- 真实透明 PNG 猫咪动画素材
- idle / dragging / happy / sleeping / walk_left / walk_right 状态
- 自定义拖拽
- 双击 happy
- sleeping / wakeUp
- 随机行为
- 左右 walking movement
- 右键菜单
- 系统托盘
- 尺寸滑动条
- settings.json 持久化
```

吸附 / Perch Mode 功能已经被全面删除。  
接下来 Phase 10 的目标不是添加大型新功能，而是稳定现有系统，修复视觉裁切和交互不可靠问题，并统一行为优先级。

---

## 当前必须修复的两个新问题

### Bug 1：Happy 状态小猫被裁切

用户观察到：

```text
happy 状态时，小猫图标整体变大。
happy 时小猫耳朵似乎超出了某个边界。
耳朵顶部被直接平切掉一部分。
```

不确定原因可能是：

```text
1. happy 状态素材本身画布太紧，耳朵已经贴边或被裁切。
2. 系统 CSS 对 happy 状态做了 scale 放大。
3. BrowserWindow / pet-window 画布不足，scale 后超出透明窗口边界。
4. body / #root / .pet-window 设置 overflow: hidden，导致超出部分被裁掉。
5. max pet size 与 happy scale 叠加后超过 300x300 BrowserWindow。
```

无论根因是什么，都必须修复。最终效果是：

```text
happy 状态下，小猫完整显示。
耳朵、尾巴、爪子、阴影都不能被平切。
happy 状态可以有轻微表现，但不能因为放大导致裁切。
```

---

### Bug 2：鼠标点击和拖动偶尔无反应

用户观察到：

```text
有时点击小猫没有反应。
有时拖动小猫没有反应。
点击和拖动检测不够稳定。
```

需要检查并修复：

```text
1. mouse down / drag start / mouse move / mouse up 的事件链路。
2. 是否因为 await dragStart 导致监听器挂载太晚，丢失早期 mousemove。
3. 是否因为透明窗口 / pointer capture 缺失导致拖动中事件丢失。
4. 是否因为 click / double click / drag 的状态判断混乱导致动作被吞掉。
5. 是否因为 PetSprite CSS transform 改变 hit area 或造成事件目标不稳定。
6. 是否因为 speech bubble / size panel / image pointer events 干扰。
```

最终效果是：

```text
点击、双击、拖拽都必须稳定。
按下小猫后拖动应立即进入拖拽链路。
纯点击不应被误判成拖拽。
拖拽不应偶发无反应。
右键菜单不应被破坏。
尺寸 slider 不应触发拖拽。
```

---

## 已知仓库线索

当前代码中需要重点检查：

```text
mochi-cat/src/App.tsx
mochi-cat/src/index.css
mochi-cat/src/components/PetSprite.tsx
mochi-cat/src/hooks/useWalkingMovement.ts
mochi-cat/src/hooks/useRandomBehavior.ts
mochi-cat/src/main.ts
mochi-cat/src/preload.ts
mochi-cat/src/types/global.d.ts
mochi-cat/src/types/ipc.ts
```

重点关注：

```text
1. App.tsx 中 handleMouseDown 当前可能 await window.mochiCat.window.dragStart(...) 后才 setIsDragging(true)。
   这可能导致监听器挂载滞后，从而丢失早期 mousemove。

2. index.css 中 happy 状态可能有：
   .pet-sprite-button.pet-happy {
       transform: scale(1.08) translateY(-6px);
   }
   这可能导致 happy 状态视觉尺寸超出窗口边界。

3. index.css 中 html/body/#root 可能设置 overflow: hidden。
   如果 BrowserWindow 画布不足，任何超出的 ear/tail/shadow 都会被裁切。

4. .pet-window 目前可能是固定 300x300。
   如果 petSizePx 较大，happy scale 后可能超过可显示区域。

5. useWalkingMovement 中仍可能存在固定 windowWidth = 300。
   Phase 10 应顺手修正为读取真实 window bounds，避免尺寸变化后走路边界不准。
```

---

## Phase 10 总目标

Phase 10 的目标：

```text
稳定现有系统，而不是继续堆新功能。
```

具体包括：

```text
1. 确认吸附功能已完全删除，没有残留引用。
2. 修复 happy 状态小猫耳朵/身体被裁切。
3. 修复点击和拖拽偶尔无反应。
4. 统一行为优先级，避免状态互相打断。
5. 调整随机行为和 walking movement 的冷却与节奏。
6. 清理硬编码窗口尺寸。
7. 加入必要 debug 开关，方便后续排查。
8. 完成完整回归测试。
```

---

## 禁止事项

本阶段不要实现：

```text
- 新动画状态
- 新图片素材生成
- 吸附 / Perch Mode
- 外部窗口检测
- 复杂物理系统
- AI 聊天
- 音效
- 多宠物
- 多皮肤
- 打包发布
```

本阶段不要破坏：

```text
- manual dragging
- idle / dragging / happy / sleeping / walk_left / walk_right
- random behavior
- walking movement
- right-click menu
- tray menu
- size slider
- settings persistence
- transparent frameless window
```

Electron 安全要求保持：

```text
contextIsolation: true
nodeIntegration: false
不要暴露 raw ipcRenderer
```

---

# Part A：彻底确认吸附功能已删除

虽然用户已经完成吸附功能删除，但 Phase 10 开始时必须确认没有残留。

搜索并确认以下引用不存在：

```text
useWindowPerchSnap
PerchState
perchMovementBounds
PerchMovementBounds
ExternalWindowBounds
externalWindows
getVisibleWindows
trySnapToWindowTop
detachFromPerch
targetWindow
snap candidate
window top edge snap
```

如果发现残留：

```text
1. 删除运行时代码。
2. 删除无用类型。
3. 删除无用 IPC。
4. 确保 useWalkingMovement 不再接受 perchMovementBounds。
5. 确保 App.tsx drag end 不再尝试 snap。
```

保留旧 spec 文档可以，但必须确保 runtime 没有吸附逻辑。

---

# Part B：修复 Happy 状态裁切 bug

## B1. 先定位根因

Agent 必须先检查：

```text
1. happy 图片素材本身是否裁切。
2. happy 图片 alpha bounding box 是否贴近画布上边界。
3. idle / happy / sleeping / walking 素材尺寸是否一致。
4. CSS 是否对 happy 状态做了 scale 放大。
5. .pet-window / BrowserWindow 是否有足够安全边距。
6. body / #root / .pet-window 是否 overflow hidden。
7. 当前 petSizePx 最大值与 happy scale 后尺寸是否超过窗口。
```

不要直接盲改。先给出根因判断。

---

## B2. 检测素材是否已经裁切

创建或使用一个临时脚本检查动画 PNG 的 alpha bounding box。

建议新增工具：

```text
tools/inspect_asset_bounds.py
```

它应该扫描：

```text
src/assets/cat/idle/
src/assets/cat/happy/
src/assets/cat/sleeping/
src/assets/cat/walk_left/
src/assets/cat/walk_right/
```

输出报告：

```text
processed_assets/asset_bounds_report.txt
```

报告包含：

```text
filename
image size
alpha bounding box
top margin
bottom margin
left margin
right margin
whether alpha touches edge
pass/fail
```

判断标准：

```text
如果 top margin <= 2 px，说明素材内容过于贴近顶部，容易被裁切。
如果 alpha bounding box 已经贴边，则需要给该素材增加透明 padding。
```

---

## B3. 如果素材本身画布太紧

如果 happy 素材本身贴边或被裁切，使用程序化方式修复：

```text
1. 不重绘小猫。
2. 不改变小猫风格。
3. 不改变小猫动作。
4. 给 PNG 增加透明 padding。
5. 输出仍为 RGBA PNG。
6. 不覆盖原图，先输出到 processed_assets。
7. 验证通过后再替换 src/assets/cat/happy。
```

推荐修复：

```text
给所有 happy 帧顶部增加 24–40 px 透明 padding。
最好对所有状态做统一画布归一化，避免动画状态切换时跳动。
```

如果只修 happy，要确保：

```text
happy 状态在 PetSprite 中 object-fit: contain 后仍然大小合理。
不会因为画布变大导致猫突然变小太多。
```

更推荐：

```text
统一 normalize 所有状态帧到同一目标画布，例如 320x320 或按最大素材 bbox + padding 计算。
```

但不要做大规模资源破坏性改动。

---

## B4. 如果是 CSS happy scale 导致裁切

如果发现 CSS 有类似：

```css
.pet-sprite-button.pet-happy {
  transform: scale(1.08) translateY(-6px);
}
```

并且它导致裁切，优先改为：

```css
.pet-sprite-button.pet-happy {
  transform: translateY(-3px);
}
```

或者：

```css
.pet-sprite-button.pet-happy {
  transform: none;
}
```

不要让 happy 状态通过 CSS 大幅放大。

原则：

```text
happy 的表现优先通过 happy 动画帧本身体现。
不要靠 CSS scale 放大整个 PetSprite。
```

如果仍然需要动效，建议：

```css
.pet-sprite-button.pet-happy {
  transform: translateY(-3px);
  filter: brightness(1.03);
}
```

不要使用 `scale(1.08)` 这种容易超过窗口边界的 transform。

---

## B5. 如果是窗口画布不足

如果 petSizePx 最大值 + 状态 transform + drop-shadow 超过 BrowserWindow，需要：

```text
1. 增大 BrowserWindow 固定尺寸。
2. 或动态根据 petSizePx 调整窗口大小。
3. 或给 .pet-window 留安全 padding。
4. 或取消状态 scale。
```

本阶段推荐最稳方案：

```text
取消 happy CSS scale。
保留 BrowserWindow 当前尺寸。
只在必要时对素材加透明 padding。
```

如果仍有裁切，再考虑将 BrowserWindow 从 300x300 调整到 340x340 或 360x360。

要求：

```text
修改窗口尺寸后，拖拽、walking 边界、尺寸 slider 都必须重新测试。
```

---

## B6. Happy 裁切验收

必须验证：

```text
[ ] happy 状态耳朵不再被裁切。
[ ] happy 状态尾巴、爪子、阴影不被裁切。
[ ] petSizePx 最小值时正常。
[ ] petSizePx 默认值时正常。
[ ] petSizePx 最大值时正常。
[ ] 从 idle -> happy -> idle 没有明显跳动。
[ ] happy 状态不再整体异常变大。
[ ] 透明背景仍然正常。
```

---

# Part C：修复点击和拖拽偶尔无反应

## C1. 当前问题假设

当前 `handleMouseDown` 如果是：

```ts
await window.mochiCat.window.dragStart(event.screenX, event.screenY);
setIsDragging(true);
```

这是不稳定的。

原因：

```text
1. dragStart 是 IPC 异步调用。
2. await 期间用户可能已经开始移动鼠标。
3. isDragging 还没变成 true，mousemove listener 还没挂上。
4. 早期 mousemove 可能被丢失。
5. 用户体感就是“拖动没反应”。
```

因此必须修复为：

```text
不要 await dragStart 后才进入 dragging candidate 状态。
先建立本地交互状态和监听，再调用 IPC。
```

---

## C2. 推荐从 MouseEvent 升级到 PointerEvent

建议将 `PetSprite` 的交互从：

```tsx
onMouseDown
onDoubleClick
onContextMenu
```

逐步改为：

```tsx
onPointerDown
onDoubleClick
onContextMenu
```

并在 pointerdown 时：

```ts
event.currentTarget.setPointerCapture(event.pointerId);
```

同时处理：

```text
pointermove
pointerup
pointercancel
lostpointercapture
window blur
```

如果 agent 判断 PointerEvent 改动风险较高，也可以继续用 mouse event，但必须修复 await 和监听器滞后问题。

---

## C3. 建立明确的交互状态机

建议新增 refs：

```ts
const pointerDownRef = useRef(false);
const pointerIdRef = useRef<number | null>(null);
const dragStartedRef = useRef(false);
const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);
const dragStartAtRef = useRef<number>(0);
```

新增阈值：

```ts
const DRAG_START_THRESHOLD_PX = 3;
```

逻辑：

```text
pointerdown:
- 只处理 left button
- markUserInteraction
- pointerDownRef = true
- dragStartedRef = false
- 记录 start screenX / screenY
- 立即调用 dragStart，但不要 await 后才注册交互
- set pointer capture
- 不要立刻把 petState 设置为 dragging，等移动超过阈值

pointermove:
- 如果 pointerDownRef false，忽略
- 计算距离 start 点的移动距离
- 如果距离 >= DRAG_START_THRESHOLD_PX，确认进入拖拽
- 第一次确认拖拽时 setPetState('dragging')
- 调用 dragMove(event.screenX, event.screenY)

pointerup:
- 如果 dragStartedRef true，结束拖拽并回 idle
- 如果 dragStartedRef false，视为普通点击，不要触发 drag
- 清理 pointer state

pointercancel / lostpointercapture / window blur:
- 安全结束拖拽
- 清理状态
```

注意：

```text
纯点击不应被误判为拖拽。
轻微手抖不应触发 dragging。
真正拖动应稳定响应。
```

---

## C4. 不要让 double click 被 drag end 覆盖

当前已有逻辑防止拖拽后 double click 误触发。Phase 10 应继续保留。

要求：

```text
1. 纯 double click -> happy。
2. drag 后释放 -> idle，不触发 happy。
3. click / double-click 不能被 stopDragging 异步覆盖。
4. happy timer 不应被无意义 mouseup 重置。
```

如果使用 pointer event，仍需保持这一逻辑。

---

## C5. size slider 不应触发拖拽

确认 SizeSliderPanel 中：

```text
onMouseDown / onPointerDown stopPropagation
```

必要时加：

```tsx
onPointerDown={(event) => event.stopPropagation()}
onMouseDown={(event) => event.stopPropagation()}
```

要求：

```text
拖动 slider 只改变尺寸，不移动小猫窗口。
```

---

## C6. speech bubble 不应挡住点击

确认：

```css
.speech-bubble {
  pointer-events: none;
}
```

如果已经存在，保持。

---

## C7. 点击/拖拽验收

必须测试：

```text
[ ] 单击小猫不会卡住。
[ ] 双击小猫稳定触发 happy。
[ ] 快速拖动小猫能立即响应。
[ ] 慢速拖动小猫能响应。
[ ] 按下后轻微移动不会误判为拖拽。
[ ] 拖拽过程中不丢事件。
[ ] 拖拽释放后状态回到 idle。
[ ] 拖拽后不会误触发 happy。
[ ] 右键菜单仍然正常。
[ ] size slider 拖动不会移动小猫。
[ ] 鼠标移出窗口后释放不会让拖拽状态卡死。
[ ] window blur 后不会卡在 dragging。
```

---

# Part D：统一行为优先级

Phase 10 应整理行为优先级，防止状态冲突。

推荐优先级：

```text
1. dragging
2. size slider interaction
3. explicit menu action
4. user double-click happy
5. walking
6. sleeping
7. idle
8. random behavior
```

规则：

```text
1. dragging 最高优先级，任何自动行为都不能打断。
2. size slider 使用时不应触发随机 walk。
3. 用户菜单动作优先于随机行为。
4. happy 期间不应被 random sleep / walk 打断。
5. walking 期间不应被 random happy / sleep 打断。
6. sleeping 可以被 wake action 或随机 wakeUp 唤醒。
7. random behavior 只能在 idle 或 sleeping 下调度。
```

---

# Part E：随机行为节奏调优

当前随机行为可以触发：

```text
selfHappy
walkRight
walkLeft
nap
wakeUp
```

Phase 10 应加入更稳的 cooldown 管理，避免太频繁。

建议新增：

```ts
const behaviorCooldownRef = useRef({
  lastAnyBehaviorAt: 0,
  lastWalkAt: 0,
  lastHappyAt: 0,
  lastSleepAt: 0,
});
```

推荐配置：

```ts
globalBehaviorCooldownMs: 8_000,
walkCooldownMs: 20_000,
happyCooldownMs: 10_000,
sleepCooldownMs: 45_000,
```

要求：

```text
1. 刚 walk 完不要马上继续 walk。
2. 刚 happy 完不要马上 sleep。
3. 刚 wakeUp 不要马上 nap。
4. 用户刚交互后继续遵守 recentInteractionCooldownMs。
```

---

# Part F：walking movement 稳定化

## F1. 删除 perch 残留

确认 `useWalkingMovement` 不再有：

```text
perchMovementBounds
PerchMovementBounds
activePerchBounds
```

---

## F2. 修复 windowWidth = 300 硬编码

当前 walking 如果写死：

```ts
windowWidth = 300;
```

应改成读取真实窗口 bounds：

```ts
const bounds = await window.mochiCat.window.getBounds();
const windowWidth = bounds.width;
```

如果当前 preload 没有 getBounds，检查是否已有；没有则用安全 IPC 增加。

走路边界应使用真实窗口宽度：

```ts
maxX = workArea.x + workArea.width - windowWidth;
```

否则尺寸变化或窗口尺寸变化后边界可能不准。

---

## F3. 可选：边缘转向

本阶段可以做轻量优化：

```text
走到屏幕边缘后停止并回 idle。
```

暂时不要做复杂反弹。  
如果实现自动转向，必须非常简单且不引入状态循环 bug。

Phase 10 推荐：

```text
先保持 stop at edge。
重点是稳定。
```

---

# Part G：Debug 开关

新增开发模式 debug 开关，不要在 production 刷屏。

建议：

```ts
const DEBUG_INTERACTION = import.meta.env.DEV && false;
const DEBUG_WALKING = import.meta.env.DEV && false;
const DEBUG_RANDOM = import.meta.env.DEV && false;
```

或者集中在：

```text
src/debug/debugFlags.ts
```

调试内容：

```text
interaction:
- pointerdown
- drag start confirmed
- pointerup
- drag canceled

walking:
- start position
- workArea
- window bounds
- target x
- hit boundary

random:
- scheduled delay
- chosen behavior
- cooldown rejection reason
```

默认关闭。

---

# Part H：Agent 执行 Prompt

```text
We need to implement MochiCat Phase 10: Behavior Coordination, Happy Visual Clipping Fix, and Interaction Reliability.

Current context:
- Window top-edge snap / Perch Mode has been fully removed.
- MochiCat now should remain a free desktop pet.
- Existing stable features must be preserved:
  - idle / dragging / happy / sleeping / walk_left / walk_right
  - manual dragging
  - double-click happy
  - random behavior
  - walking movement
  - right-click menu
  - tray menu
  - size slider
  - settings persistence
  - transparent frameless window

New bugs to fix:
1. In happy state, the cat appears larger and the ears are clipped / flat-cut at the top.
2. Mouse clicking and dragging detection sometimes fails; sometimes clicking or dragging the cat has no response.

Main goals:
1. Remove any remaining snap/perch/external-window code references.
2. Fix happy-state clipping completely.
3. Make click / double-click / drag interaction reliable.
4. Stabilize behavior priority and cooldowns.
5. Make walking movement use real window bounds instead of hardcoded 300px.
6. Preserve all existing stable features.

Part 1 - Confirm snap/perch cleanup:
Search the repo for:
- useWindowPerchSnap
- PerchState
- PerchMovementBounds
- perchMovementBounds
- ExternalWindowBounds
- externalWindows
- getVisibleWindows
- trySnapToWindowTop
- detachFromPerch
- targetWindow
- snap candidate

Remove runtime references if any remain.
Do not keep perch-related runtime code.

Part 2 - Fix happy clipping:
First inspect root cause:
- Check happy PNG alpha bounds and canvas margins.
- Check whether happy assets touch image edges.
- Check CSS transforms, especially .pet-sprite-button.pet-happy.
- Check whether happy uses scale(1.08) or translateY that pushes ears outside window.
- Check .pet-window / BrowserWindow size / overflow hidden.

If CSS scale causes clipping:
- Remove or reduce happy scale.
- Prefer transform: translateY(-3px) or transform: none.
- Do not use CSS scaling that can crop the pet.

If assets are too tightly cropped:
- Create a local script to inspect alpha bounding boxes.
- Add transparent padding to affected happy frames.
- Do not redraw the cat.
- Do not change style or pose.
- Output true RGBA PNG.
- Verify alpha bounds after processing.

Final result:
- happy state must show the full cat.
- Ears must not be clipped.
- Tail/paws/shadow must not be clipped.
- Works at min/default/max pet size.

Part 3 - Fix interaction reliability:
Inspect App.tsx interaction code.
If handleMouseDown awaits dragStart before setting dragging/listeners, fix it.

Do not do:
await dragStart(...);
setIsDragging(true);

Instead:
- Mark pointer/mouse down immediately.
- Set up local interaction state immediately.
- Call dragStart without delaying event capture.
- Confirm dragging only after movement exceeds a small threshold.

Prefer pointer events:
- onPointerDown
- setPointerCapture
- pointermove
- pointerup
- pointercancel
- lostpointercapture

If staying with mouse events, still remove the await/listener delay.

Add a small drag threshold:
DRAG_START_THRESHOLD_PX = 3 or 4

Expected behavior:
- pure click does not become drag
- double-click reliably triggers happy
- real drag responds immediately
- mouse/pointer release outside normal area does not leave stuck dragging state
- dragging the size slider does not move the pet

Part 4 - Behavior priority:
Enforce priority:
1. dragging
2. size slider interaction
3. explicit menu action
4. user double-click happy
5. walking
6. sleeping
7. idle
8. random behavior

Random behavior must not interrupt:
- dragging
- recent user interaction
- happy
- walking
- size slider interaction

Part 5 - Random behavior cooldowns:
Add or refine cooldowns:
- globalBehaviorCooldownMs
- walkCooldownMs
- happyCooldownMs
- sleepCooldownMs

Avoid:
- walk immediately after walk
- sleep immediately after wake
- random happy interrupting walking
- random sleep interrupting happy

Part 6 - Walking movement cleanup:
Remove any perch-specific logic from useWalkingMovement.
Remove perchMovementBounds parameter if still present.
Remove PerchMovementBounds import if still present.

Replace hardcoded windowWidth = 300 with real BrowserWindow bounds:
const bounds = await window.mochiCat.window.getBounds();
const windowWidth = bounds.width;

Use real window width for workArea clamping.

Walking should:
- move left/right naturally
- stop at screen edge
- stop when dragging starts
- stop when window hidden
- return to idle on completion

Part 7 - Debug flags:
Add optional dev-only debug flags for:
- interaction
- walking
- random behavior

Keep them off by default.
Do not spam production logs.

Validation:
1. npm start works.
2. TypeScript has no errors.
3. No snap/perch/external-window references remain.
4. idle / dragging / happy / sleeping / walk_left / walk_right all work.
5. happy state no longer clips ears at min/default/max pet size.
6. happy state no longer visually jumps due to CSS over-scaling.
7. double-click reliably triggers happy.
8. fast drag responds.
9. slow drag responds.
10. slight mouse jitter does not become drag.
11. drag release returns to idle.
12. drag does not get stuck if pointer leaves window or app loses focus.
13. size slider drag does not move pet.
14. right-click menu still works.
15. tray menu still works.
16. random behavior still works.
17. walking still works.
18. walking uses real window bounds, not hardcoded 300.
19. transparent background remains correct.
20. renderer console and main process terminal have no runtime errors.

Before coding:
1. Inspect App.tsx.
2. Inspect index.css.
3. Inspect PetSprite.tsx.
4. Inspect SizeSliderPanel.tsx.
5. Inspect useRandomBehavior.ts.
6. Inspect useWalkingMovement.ts.
7. Inspect animation assets under src/assets/cat.
8. List exact files to modify.
9. Explain root cause of happy clipping.
10. Explain root cause of interaction unreliability.
11. Then implement.

After coding:
1. List changed files.
2. Explain how happy clipping was fixed.
3. Explain how click/drag detection now works.
4. Explain how random behavior cooldowns work.
5. Explain how walking bounds now use real window bounds.
6. Confirm snap/perch code remains removed.
```

---

## Phase 10 验收清单

```text
[ ] 吸附功能无运行时代码残留。
[ ] happy 状态小猫完整显示。
[ ] happy 状态耳朵不被裁切。
[ ] happy 状态不再异常整体变大。
[ ] 点击稳定。
[ ] 双击稳定触发 happy。
[ ] 拖拽稳定响应。
[ ] 拖拽不会卡死。
[ ] 轻微移动不误判为拖拽。
[ ] size slider 不触发拖拽。
[ ] random behavior 不打断用户操作。
[ ] walking 不使用硬编码 windowWidth = 300。
[ ] walking 不越界。
[ ] 右键菜单正常。
[ ] 托盘正常。
[ ] 设置持久化正常。
[ ] TypeScript 无错误。
[ ] 运行时无明显错误。
```

---

## Phase 10 完成后的建议提交

```bash
git status
git add .
git commit -m "fix: stabilize interactions and visual bounds"
```
