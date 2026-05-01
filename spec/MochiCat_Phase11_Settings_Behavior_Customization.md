# MochiCat Phase 11 Prompt：完整设置面板、行为参数可配置化与睡眠唤醒后右键走动 Bug 修复

## 任务标题

MochiCat Phase 11 - Settings Panel, Behavior Customization, and Post-Sleep Menu Walk Bug Fix

---

## 背景

当前 MochiCat 已经完成了核心桌宠功能，并且 Phase 10 已完成稳定化：

```text
- Electron + React + TypeScript + Vite
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
- 吸附 / Perch Mode 已删除
- Phase 10 中已修复 happy 裁切、点击/拖拽不可靠等稳定性问题
```

Phase 11 的目标不是继续增加复杂动画状态，而是：

```text
1. 增加完整设置面板。
2. 将关键行为参数从硬编码变为可配置。
3. 修复睡眠状态被右键唤醒后，右键走动无反应的状态机 bug。
4. 继续保持系统稳定，不引入外部窗口吸附、复杂物理或新素材依赖。
```

---

## 当前必须修复的新 Bug

### Bug：睡眠唤醒后，右键走动无反应

用户发现：

```text
1. 一段时间没有点击小猫后，小猫会进入 sleeping 状态，这是正常的。
2. 小猫 sleeping 时，右键点击“唤醒猫猫”，小猫会被唤醒。
3. 接着右键点击“向左走动”或“向右走动”，小猫不会有任何反应。
4. 必须先手动拖动一下小猫，再右键点击“向左走动”或“向右走动”，小猫才会正确执行走动动作。
```

这是必须在 Phase 11 修复的阻塞级交互 bug。

### 预期行为

无论小猫当前处于什么状态，只要用户通过右键菜单显式点击：

```text
向左走动
向右走动
```

都应该立即生效。

特别是以下状态必须支持：

```text
idle -> walk_left / walk_right
sleeping -> walk_left / walk_right
happy -> walk_left / walk_right
刚被 wake 后的 happy -> walk_left / walk_right
random behavior 运行间隙 -> walk_left / walk_right
```

右键菜单动作是显式用户意图，优先级应高于自动行为、睡眠、happy timer 和 inactivity timer。

---

## 重点诊断方向

Agent 不要盲修。必须检查以下可能原因：

```text
1. triggerHappy / triggerSleep / triggerWalkLeft / triggerWalkRight 之间 timer 没有正确清理。
2. wake 动作触发 happy 后，happyTimer 后续又把状态改回 idle，覆盖了 walk_left / walk_right。
3. sleeping 后某些 ref 仍然停留在 sleeping，导致 menu action 设置 state 后又被旧逻辑覆盖。
4. inactivityTimer 在 wake 后未正确 reset，导致刚触发 walk 又被 sleep 或 idle 覆盖。
5. useWalkingMovement 没有在 sleeping -> wake -> walk 这种状态转换后启动。
6. explicit menu action 没有统一走一个“强制状态切换”入口。
7. random behavior timer 在 menu action 后没有被 cooldown 阻止，可能与 menu action 抢状态。
8. 右键菜单 action 触发后，petState / petStateRef / enteredStateAtRef 不一致。
9. walking movement 完成或启动条件仍被某个旧状态保护阻断。
```

必须通过日志或代码审查明确根因，然后修复。

---

## Phase 11 总目标

Phase 11 需要完成：

```text
1. 新增完整设置面板。
2. 行为参数可配置化。
3. 自动走路独立开关。
4. 行为频率低 / 正常 / 高。
5. 重置位置。
6. 重置设置。
7. 开发模式下的轻量 debug 信息。
8. 修复 sleeping -> wake -> right-click walk 无反应 bug。
9. 回归测试所有状态切换和显式菜单动作。
```

---

## 禁止事项

本阶段不要实现：

```text
- 新动画素材
- 新 PetState，例如 eat / play / angry / curious
- AI 对话
- 音效系统
- 多宠物
- 多皮肤
- 外部窗口吸附 / Perch Mode
- 外部窗口检测
- 复杂物理系统
- 打包发布
```

必须保留：

```text
- manual dragging
- idle / dragging / happy / sleeping / walk_left / walk_right
- random behavior
- walking movement
- right-click menu
- tray menu
- size slider 或其升级后的设置面板
- settings persistence
- transparent frameless window
```

Electron 安全要求不变：

```text
contextIsolation: true
nodeIntegration: false
不要暴露 raw ipcRenderer
```

---

# Part A：修复 sleeping -> wake -> right-click walk 无反应 Bug

## A1. 建立显式用户动作优先级

右键菜单动作必须被视为最高优先级用户动作，仅低于正在进行的拖拽。

推荐优先级：

```text
1. dragging
2. explicit menu action
3. size panel interaction
4. user double-click happy
5. walking
6. sleeping
7. idle
8. random behavior
```

因此：

```text
右键“向左走动 / 向右走动”必须可以打断 sleeping。
右键“向左走动 / 向右走动”必须可以打断 happy。
右键“向左走动 / 向右走动”必须可以打断 wake 后的 happy timer。
右键“向左走动 / 向右走动”必须可以打断 random behavior timer。
```

---

## A2. 统一状态切换入口

当前可能有多个函数直接修改：

```text
petStateRef.current
setPetState(...)
happyTimerRef
inactivityTimerRef
enteredStateAtRef
lastInteractionAtRef
```

Phase 11 建议新增统一 helper：

```ts
function transitionToState(nextState: PetState, reason: string): void {
  // 统一更新 state/ref/entered time/debug log
}
```

或至少新增专门的 user action transition：

```ts
function forcePetStateFromUserAction(nextState: PetState, reason: string): void {
  // 用户显式菜单动作专用
}
```

该函数必须：

```text
1. 清理 happyTimer。
2. 必要时清理 bubbleTimer。
3. markUserInteraction。
4. 更新 petStateRef.current。
5. setPetState(nextState)。
6. 更新 enteredStateAtRef.current。
7. resetInactivityTimer 或暂停 inactivity timer。
8. 给 random behavior 设置 cooldown，防止马上覆盖用户动作。
```

---

## A3. 修正 triggerWalkLeft / triggerWalkRight

`triggerWalkLeft` 和 `triggerWalkRight` 必须可以从任何非 dragging 状态进入 walking。

要求：

```text
1. 如果当前是 sleeping，直接切换到 walk_left / walk_right。
2. 如果当前是 happy，取消 happyTimer，再切换到 walk。
3. 如果刚刚 wake 后处于 happy，也必须取消 wake happyTimer。
4. 如果当前是 idle，正常切换。
5. 如果当前正在 walk_left / walk_right，允许切换方向或重新开始 walking。
6. 如果 current is dragging，则不要强行切换，等待拖拽结束。
```

推荐实现：

```ts
const triggerWalkLeft = useCallback((reason = 'manual') => {
  if (petStateRef.current === 'dragging' || isDraggingRef.current) return;

  clearHappyTimer();
  clearOrResetInactivityTimerForActiveAction();
  markUserInteraction();
  petStateRef.current = 'walk_left';
  setPetState('walk_left');
  enteredStateAtRef.current = Date.now();
}, [markUserInteraction, ...]);
```

`triggerWalkRight` 同理。

---

## A4. 修正 wake 后 happy timer 覆盖 walking 的问题

如果用户执行：

```text
sleeping -> right-click wake -> happy
right-click walkRight -> walk_right
```

那么之前 wake 产生的 happy timer 不能在稍后执行：

```ts
setPetState('idle')
```

否则会覆盖 walking。

所以：

```text
triggerWalkLeft / triggerWalkRight 必须 clear happyTimerRef。
triggerHappy 的 timeout callback 执行前必须检查当前状态仍然是 happy。
```

推荐：

```ts
happyTimerRef.current = window.setTimeout(() => {
  if (petStateRef.current !== 'happy') return;
  petStateRef.current = 'idle';
  setPetState('idle');
  resetInactivityTimer();
}, HAPPY_DURATION_MS);
```

更好：

```text
每个 timed transition 都必须先检查当前状态是否仍是它负责的状态。
```

---

## A5. 修正 inactivity timer 覆盖 walking 的问题

右键 walk 后，inactivity timer 不应立即把小猫重新切回 sleeping。

要求：

```text
1. 用户右键 walk 时 markUserInteraction。
2. resetInactivityTimer。
3. inactivity timer callback 只允许在 petStateRef.current === 'idle' 时进入 sleeping。
4. 如果当前是 walk_left / walk_right，不允许 inactivity timer 切换到 sleeping。
```

如果已有逻辑是：

```ts
if (petStateRef.current === 'idle') setPetState('sleeping')
```

保留即可，但确认 ref 一致。

---

## A6. 修正 useWalkingMovement 启动条件

确认 `useWalkingMovement` 只依赖：

```text
petState
isDragging
isWindowVisible
onWalkComplete
```

当 `petState` 从 `happy` 或 `sleeping` 切换为 `walk_left / walk_right` 时，它必须启动。

如果存在保护条件导致从 sleeping/wake 后无法启动，删除或修正该条件。

---

## A7. 加入手动菜单动作测试日志

在 DEV 模式下加入可关闭日志：

```text
menu action received: wake
transition: sleeping -> happy
menu action received: walkRight
transition: happy -> walk_right
walking started
walking completed -> idle
```

默认生产环境不刷屏。

---

## A8. Bug 验收流程

必须按此流程测试：

```text
1. 启动 app。
2. 等待小猫自然进入 sleeping。
3. 右键 -> 唤醒猫猫。
4. 立即右键 -> 向右走动。
5. 预期：小猫立即进入 walk_right 并移动。
6. 再等待小猫 sleeping。
7. 右键 -> 唤醒猫猫。
8. 立即右键 -> 向左走动。
9. 预期：小猫立即进入 walk_left 并移动。
10. 不允许必须先拖动小猫才能走。
```

还要测试：

```text
sleeping -> right-click walkRight，不点 wake，是否可以直接走。
sleeping -> right-click walkLeft，不点 wake，是否可以直接走。
happy -> right-click walkRight 是否可以直接走。
happy -> right-click walkLeft 是否可以直接走。
walk_left -> right-click walkRight 是否可以切换方向。
walk_right -> right-click walkLeft 是否可以切换方向。
```

推荐行为：

```text
显式 walk action 可以直接唤醒 sleeping 并开始走。
```

---

# Part B：完整设置面板

## B1. 新增统一设置入口

当前项目已有尺寸 slider。Phase 11 应将它升级为完整设置面板。

右键菜单 / 托盘菜单中新增：

```text
设置...
```

点击后打开 React 设置面板。

不要在 Electron 原生菜单中塞复杂控件。复杂控件应在 renderer 中实现。

---

## B2. 设置面板包含的选项

设置面板至少包含：

```text
1. 宠物尺寸 slider
2. 始终置顶 toggle
3. 气泡开关 toggle
4. 随机行为开关 toggle
5. 自动走路开关 toggle
6. 行为频率：低 / 正常 / 高
7. 走路速度 slider
8. 睡觉等待时间选择
9. 重置位置按钮
10. 重置设置按钮
11. 关闭按钮
```

可以分组：

```text
外观
行为
窗口
调试
```

---

## B3. 设置面板组件建议

新增：

```text
src/components/SettingsPanel.tsx
```

可以替代或包含原来的：

```text
SizeSliderPanel
```

如果保留 `SizeSliderPanel`，设置面板中应复用它的逻辑，不要复制出两套尺寸状态。

---

## B4. 设置面板交互要求

```text
1. 面板应是小型浮层，不是新 BrowserWindow。
2. 面板应在透明窗口内显示。
3. 面板不应触发拖拽。
4. 面板内部 pointer/mouse event 必须 stopPropagation。
5. 按 Escape 可以关闭。
6. 点击关闭按钮可以关闭。
7. 改动设置应立即生效。
8. 改动设置应持久化到 settings.json。
```

---

# Part C：扩展 UserSettings

当前 settings 至少包含：

```ts
petSizePx: number;
alwaysOnTop: boolean;
speechBubbleEnabled: boolean;
randomBehaviorEnabled: boolean;
```

Phase 11 建议扩展：

```ts
interface UserSettings {
  petSizePx: number;
  alwaysOnTop: boolean;
  speechBubbleEnabled: boolean;
  randomBehaviorEnabled: boolean;

  autoWalkEnabled: boolean;
  behaviorFrequency: 'low' | 'normal' | 'high';
  walkingSpeedPxPerSecond: number;
  walkingDurationMinMs: number;
  walkingDurationMaxMs: number;
  sleepAfterIdleMs: number | null;
  happyDurationMs: number;
  bubbleDurationMs: number;
}
```

如果一次性改太多，最低必须新增：

```text
autoWalkEnabled
behaviorFrequency
walkingSpeedPxPerSecond
sleepAfterIdleMs
```

---

## C1. settings migration

必须兼容旧 settings.json。

如果旧 settings 缺少新字段：

```text
使用默认值补齐。
保存时写回新字段。
不要因为旧 settings 缺字段而崩溃。
```

默认建议：

```ts
autoWalkEnabled: true,
behaviorFrequency: 'normal',
walkingSpeedPxPerSecond: 35,
walkingDurationMinMs: 4000,
walkingDurationMaxMs: 6000,
sleepAfterIdleMs: import.meta.env.DEV ? 15000 : 5 * 60_000,
happyDurationMs: 2500,
bubbleDurationMs: 1800,
```

注意：

```text
main process 无法直接使用 import.meta.env.DEV 时，应使用项目现有环境判断方式。
```

---

# Part D：行为参数可配置化

## D1. autoWalkEnabled

`randomBehaviorEnabled` 是总开关：

```text
false -> 所有自动行为都关闭
```

`autoWalkEnabled` 是子开关：

```text
randomBehaviorEnabled = true
autoWalkEnabled = false
  -> 可以自动 happy / sleep / wake
  -> 不会自动 walk_left / walk_right
```

用户通过右键菜单显式点击 walkLeft / walkRight 不受 autoWalkEnabled 限制。autoWalkEnabled 只限制自动随机走路。

---

## D2. behaviorFrequency

提供三档：

```text
低
正常
高
```

内部映射由代码实现：

```text
low:
- random check delay 更长
- walk 概率更低
- happy 概率更低

normal:
- 当前默认

high:
- random check delay 更短
- walk / happy 概率更高
```

不要把大量毫秒参数暴露给普通用户。

---

## D3. walkingSpeedPxPerSecond

设置面板中提供 slider：

```text
20–60 px/s
默认 35 px/s
```

`useWalkingMovement` 不应再使用硬编码：

```ts
const WALK_SPEED_PX_PER_SEC = 35;
```

而应从 settings 获取。

---

## D4. walkingDurationMinMs / walkingDurationMaxMs

可先不直接暴露高级滑块，只通过 behaviorFrequency 控制。

如果暴露，必须保证：

```text
walkingDurationMinMs <= walkingDurationMaxMs
范围合理，例如 2000–9000 ms
```

---

## D5. sleepAfterIdleMs

设置面板提供简单选项：

```text
1 分钟
3 分钟
5 分钟
10 分钟
从不自动睡觉
```

如果选择“从不自动睡觉”：

```text
inactivity sleeping timer 不应触发 sleeping。
但用户仍可通过右键菜单让它睡觉。
```

---

# Part E：重置位置与重置设置

## E1. 重置位置

设置面板和/或右键菜单中新增：

```text
重置位置
```

行为：

```text
将宠物移动到当前显示器安全区域，例如右下角或屏幕中央。
```

需要 main process 提供或复用：

```text
window:get-work-area
window:set-position
window:get-bounds
```

推荐位置：

```text
x = workArea.x + workArea.width - windowWidth - 80
y = workArea.y + workArea.height - windowHeight - 120
```

确保：

```text
不会放到 Dock 后面。
不会放到屏幕外。
```

---

## E2. 重置设置

设置面板中新增：

```text
重置设置
```

行为：

```text
恢复 DEFAULT_SETTINGS。
保存到 settings.json。
立即更新 renderer UI。
```

需要确认：

```text
重置后尺寸、随机行为、气泡、自动走路、频率等都恢复默认。
```

---

# Part F：右键菜单 / 托盘菜单调整

右键菜单建议保留常用动作：

```text
摸摸猫猫
喂小鱼干
让它睡觉
唤醒猫猫
向左走动
向右走动
设置...
隐藏猫猫
退出
```

原来的：

```text
调整尺寸...
```

可以替换为：

```text
设置...
```

或者保留“调整尺寸...”但推荐统一进入设置面板。

托盘菜单也可加入：

```text
显示/隐藏猫猫
设置...
随机行为开关
退出
```

---

# Part G：开发模式 Debug 信息

设置面板中可在 dev 模式显示：

```text
当前状态
当前尺寸
随机行为 on/off
自动走路 on/off
行为频率
窗口位置
isWindowVisible
lastInteractionAt 距今时间
```

只在：

```ts
import.meta.env.DEV
```

下显示。

---

# Part H：完整验收标准

## H1. 新 bug 修复验收

```text
[ ] sleeping 后右键 wake，再右键 walkRight，立即生效。
[ ] sleeping 后右键 wake，再右键 walkLeft，立即生效。
[ ] sleeping 状态下不点 wake，直接右键 walkRight，也应生效。
[ ] sleeping 状态下不点 wake，直接右键 walkLeft，也应生效。
[ ] happy 状态下右键 walkRight，立即生效。
[ ] happy 状态下右键 walkLeft，立即生效。
[ ] walk_left 状态下右键 walkRight，可以切换方向。
[ ] walk_right 状态下右键 walkLeft，可以切换方向。
[ ] 不需要先拖动小猫才能走。
```

## H2. 设置面板验收

```text
[ ] 右键菜单可以打开“设置...”。
[ ] 托盘菜单可以打开“设置...”。
[ ] 设置面板可以修改尺寸。
[ ] 设置面板可以切换气泡开关。
[ ] 设置面板可以切换随机行为。
[ ] 设置面板可以切换自动走路。
[ ] 设置面板可以选择行为频率。
[ ] 设置面板可以修改走路速度。
[ ] 设置面板可以修改自动睡觉等待时间。
[ ] 设置面板可以重置位置。
[ ] 设置面板可以重置设置。
[ ] 设置修改立即生效。
[ ] 重启后设置保持。
```

## H3. 回归验收

```text
[ ] npm start 正常启动。
[ ] TypeScript 无错误。
[ ] idle / dragging / happy / sleeping / walk_left / walk_right 正常。
[ ] 拖拽正常。
[ ] 点击 / 双击正常。
[ ] 右键菜单正常。
[ ] 托盘正常。
[ ] walking movement 正常。
[ ] random behavior 正常。
[ ] randomBehaviorEnabled=false 后自动行为停止。
[ ] autoWalkEnabled=false 后自动走路停止，但手动 walk 仍可用。
[ ] speechBubbleEnabled=false 后不显示气泡。
[ ] alwaysOnTop 设置生效。
[ ] 透明窗口正常。
[ ] 没有吸附 / Perch Mode 运行时代码残留。
[ ] Renderer Console 无明显错误。
[ ] Main process terminal 无明显错误。
```

---

# Part I：Agent 执行 Prompt

```text
We need to implement MochiCat Phase 11: Settings Panel, Behavior Customization, and Post-Sleep Menu Walk Bug Fix.

Current project status:
- Phase 10 is complete.
- Window top-edge snap / Perch Mode has been fully removed.
- The app is a stable free desktop pet.
- Existing states:
  - idle
  - dragging
  - happy
  - sleeping
  - walk_left
  - walk_right
- Existing stable features:
  - manual dragging
  - double-click happy
  - right-click menu
  - tray menu
  - size slider
  - settings persistence
  - random behavior
  - walking movement
  - transparent frameless window

Critical bug to fix:
After the pet enters sleeping due to inactivity, the user can right-click and wake the cat. But immediately after that, right-clicking walk left or walk right does nothing. The user must drag the cat once, then right-click walk left/right, and only then walking works.

Required expected behavior:
Explicit right-click menu actions walkLeft and walkRight must work from any non-dragging state:
- idle -> walk
- sleeping -> walk
- sleeping -> wake -> walk
- happy -> walk
- wake/happy -> walk
- walk_left -> walk_right
- walk_right -> walk_left

Manual menu walk actions must have higher priority than sleeping, happy timer, random behavior, and inactivity timer.

Part 1 - Diagnose and fix the post-sleep menu walk bug:
- Inspect App.tsx triggerHappy, triggerSleep, triggerWalkLeft, triggerWalkRight.
- Inspect menu action handling.
- Inspect happyTimerRef, inactivityTimerRef, petStateRef, enteredStateAtRef, lastInteractionAtRef.
- Inspect useWalkingMovement startup conditions.
- Identify the exact cause before modifying.

Required fix:
- triggerWalkLeft / triggerWalkRight must cancel any pending happy timer.
- triggerWalkLeft / triggerWalkRight must be able to transition from sleeping or happy directly into walking.
- Timed callbacks from triggerHappy must check that current state is still happy before forcing idle.
- inactivity timer must only put the pet to sleep if current state is idle.
- menu actions must mark user interaction and reset/pause timers appropriately.
- explicit menu walk should not be blocked by autoWalkEnabled.
- autoWalkEnabled only controls random automatic walking.

Add dev-only logs for:
- menu action received
- state transition reason
- walking started
- walking completed

Part 2 - Add a full Settings Panel:
- Add a unified SettingsPanel React component.
- Open it from right-click menu and tray menu via “设置...”.
- It should include:
  - pet size slider
  - always on top toggle
  - speech bubble toggle
  - random behavior toggle
  - auto walk toggle
  - behavior frequency: low / normal / high
  - walking speed slider
  - sleep-after-idle setting
  - reset position button
  - reset settings button
  - close button
- The panel must not trigger pet dragging.
- Stop pointer/mouse propagation inside the panel.
- Escape should close the panel if practical.
- Settings changes must apply immediately and persist to settings.json.

Part 3 - Extend UserSettings:
Add:
- autoWalkEnabled
- behaviorFrequency: 'low' | 'normal' | 'high'
- walkingSpeedPxPerSecond
- walkingDurationMinMs
- walkingDurationMaxMs
- sleepAfterIdleMs
- happyDurationMs
- bubbleDurationMs

If doing all fields is too large, minimum required:
- autoWalkEnabled
- behaviorFrequency
- walkingSpeedPxPerSecond
- sleepAfterIdleMs

Implement settings migration:
- Old settings.json must still load.
- Missing fields should be filled with defaults.
- Save back the new structure safely.

Part 4 - Make behavior configurable:
- randomBehaviorEnabled remains the master switch.
- autoWalkEnabled controls only automatic random walking.
- Manual right-click walk always works even if autoWalkEnabled is false.
- behaviorFrequency controls random behavior delays and probabilities.
- walkingSpeedPxPerSecond should be used by useWalkingMovement.
- sleepAfterIdleMs should replace hardcoded inactivity timeout.
- If sleepAfterIdleMs is null or 0 for “never”, inactivity sleep should be disabled.

Part 5 - Reset position:
- Add a reset position action.
- Move the pet to a safe visible area on the current display, preferably lower-right or center.
- Use current workArea and actual window bounds.
- Do not place the pet off-screen.

Part 6 - Reset settings:
- Restore DEFAULT_SETTINGS.
- Persist to settings.json.
- Update renderer state immediately.

Part 7 - Menu updates:
- Right-click menu should include “设置...”.
- Tray menu should include “设置...”.
- Keep existing common actions:
  - pet
  - feed
  - sleep
  - wake
  - walkLeft
  - walkRight
  - hide
  - quit
- Replace or de-emphasize the old size-only panel if needed.

Part 8 - Confirm snap/perch remains removed:
Search for and remove runtime references to:
- useWindowPerchSnap
- PerchState
- PerchMovementBounds
- ExternalWindowBounds
- externalWindows
- getVisibleWindows
- trySnapToWindowTop
- detachFromPerch

Do not reintroduce external window detection.

Validation:
1. npm start works.
2. TypeScript has no errors.
3. sleeping -> wake -> walkRight works immediately.
4. sleeping -> wake -> walkLeft works immediately.
5. sleeping -> walkRight works directly.
6. sleeping -> walkLeft works directly.
7. happy -> walkRight works immediately.
8. happy -> walkLeft works immediately.
9. walk_left -> walk_right switches direction.
10. walk_right -> walk_left switches direction.
11. No need to drag the pet before right-click walking works.
12. Settings panel opens from right-click menu.
13. Settings panel opens from tray menu.
14. Settings changes apply immediately.
15. Settings persist after restart.
16. autoWalkEnabled=false disables only automatic random walking, not manual menu walking.
17. randomBehaviorEnabled=false disables all automatic random behavior.
18. reset position works.
19. reset settings works.
20. dragging still works.
21. double-click happy still works.
22. right-click menu still works.
23. tray still works.
24. transparent window remains correct.
25. No snap/perch runtime references remain.
26. Renderer console and main process terminal have no runtime errors.

Before coding:
1. Inspect App.tsx.
2. Inspect useWalkingMovement.ts.
3. Inspect useRandomBehavior.ts.
4. Inspect settings persistence code.
5. Inspect right-click menu and tray menu code.
6. Inspect preload/main IPC APIs.
7. List exact files to modify.
8. Explain root cause of sleeping -> wake -> walk bug.
9. Explain the settings migration plan.
10. Then implement.

After coding:
1. List changed files.
2. Explain the bug root cause and fix.
3. Explain how explicit menu walk actions now override sleeping/happy timers.
4. Explain new settings fields.
5. Explain how settings migration works.
6. Explain how autoWalkEnabled differs from randomBehaviorEnabled.
7. Explain how to test reset position and reset settings.
```

---

## Phase 11 完成后的建议提交

```bash
git status
git add .
git commit -m "feat: add settings panel and fix post-sleep walk actions"
```
