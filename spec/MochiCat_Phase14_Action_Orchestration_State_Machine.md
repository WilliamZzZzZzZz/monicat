# MochiCat Phase 14 Prompt：动作系统统一化与状态编排重构

## 任务标题

MochiCat Phase 14 - Action Orchestration and State Machine Refactor

## 背景

当前 MochiCat 已经具备这些稳定能力：

```text
idle / dragging / happy / sleeping / walk_left / walk_right / grooming
帧动画系统
自定义拖拽
双击 happy
inactivity sleeping
右键菜单动作
托盘菜单
settings panel
random behavior
walking movement
settings persistence
透明 frameless window
```

Phase 13 已经新增 `grooming`。当前 `PetState` 已包含：

```text
idle
dragging
happy
sleeping
walk_right
walk_left
grooming
```

当前 `animationConfig.ts` 也已经包含 `grooming`，并且 grooming 是 `loop: false` 的 one-shot 动作。

现在的问题是：项目中的状态控制逻辑已经开始变复杂。`App.tsx` 中集中管理了大量状态、timer、触发函数和菜单动作，例如：

```text
transitionToState
forcePetStateFromUserAction
triggerHappy
triggerSleep
triggerGrooming
triggerWalkLeft
triggerWalkRight
happyTimerRef
groomingTimerRef
bubbleTimerRef
inactivityTimerRef
petStateRef
enteredStateAtRef
manualActionCooldownUntilRef
lastInteractionAtRef
useRandomBehavior
useWalkingMovement
右键菜单 action handler
pointer dragging handler
```

Phase 14 的目标不是新增动作素材，而是将动作触发、状态切换、timer 清理、随机行为调度、右键菜单动作统一成更稳定、可扩展的 action orchestration 系统。

最终目标是：以后新增 `stretching / yawning / paw_raise / loaf` 等动作时，只需要注册动作 metadata 和素材配置，而不需要继续在 `App.tsx` 中复制一套新的 `triggerXxx + timerRef + clearTimer + menu action`。

---

## Phase 14 总目标

```text
1. 建立统一 Action System / State Machine Controller。
2. 将 persistent / oneShot / locomotion / interactionOverride 四类状态明确区分。
3. 用 action registry 描述每个 PetState 的行为规则。
4. 用统一 dispatchPetAction 处理菜单动作、随机动作、系统动作和交互动作。
5. 用统一 oneShot timer 处理 happy / grooming 这类一次性动作。
6. 用 action token 防止旧 timer 覆盖新状态。
7. 将 random behavior 改为“选择动作”，但通过 dispatcher 触发。
8. 将右键菜单动作改为通过 dispatcher 触发。
9. 将 walking 完成回 idle 改为通过 dispatcher 触发。
10. 保持 dragging 最高优先级，不破坏 Phase 10 的可靠拖拽。
11. 让 App.tsx 明显变薄，减少状态机和 timer 逻辑堆积。
```

---

## 本阶段不要做什么

不要新增：

```text
新图片素材
stretching / yawning / paw_raise / loaf
AI 对话
音效
多宠物
多皮肤
外部窗口吸附 / Perch Mode
外部窗口检测
复杂物理系统
打包发布
```

不要破坏：

```text
idle
dragging
happy
sleeping
walk_left
walk_right
grooming
manual dragging
double-click happy
right-click menu
tray menu
settings panel
random behavior
walking movement
settings persistence
transparent frameless window
```

Electron 安全要求不变：

```text
contextIsolation: true
nodeIntegration: false
不要暴露 raw ipcRenderer
```

---

# Part A：定义动作分类模型

新增或整理动作类型：

```ts
export type ActionKind =
  | 'persistent'
  | 'oneShot'
  | 'locomotion'
  | 'interactionOverride';
```

状态分类建议：

```text
idle        -> persistent
sleeping    -> persistent
happy       -> oneShot
grooming    -> oneShot
walk_left   -> locomotion
walk_right  -> locomotion
dragging    -> interactionOverride
```

含义：

```text
persistent:
长期状态，不需要自动完成。例如 idle / sleeping。

oneShot:
播放一次后自动回 idle。例如 happy / grooming。
未来 stretching / yawning / paw_raise 也属于这一类。

locomotion:
会驱动窗口移动，完成后回 idle。例如 walk_left / walk_right。

interactionOverride:
用户直接操作产生的最高优先级状态。例如 dragging。
```

---

# Part B：新增 action metadata / registry

建议新增：

```text
src/actions/actionTypes.ts
src/actions/actionRegistry.ts
```

建议类型：

```ts
import type { PetState } from '../types/pet';

export type ActionKind =
  | 'persistent'
  | 'oneShot'
  | 'locomotion'
  | 'interactionOverride';

export type ActionTriggerSource =
  | 'manual'
  | 'menu'
  | 'tray'
  | 'random'
  | 'interaction'
  | 'timer'
  | 'system';

export interface PetActionDefinition {
  state: PetState;
  kind: ActionKind;
  defaultDurationMs?: number;
  returnState?: PetState;
  canBeTriggeredRandomly: boolean;
  blocksRandomBehavior: boolean;
  resetsInactivityTimerOnStart: boolean;
  defaultBubble?: string;
}
```

建议 registry：

```ts
export const PET_ACTIONS: Record<PetState, PetActionDefinition> = {
  idle: {
    state: 'idle',
    kind: 'persistent',
    canBeTriggeredRandomly: true,
    blocksRandomBehavior: false,
    resetsInactivityTimerOnStart: true,
  },

  sleeping: {
    state: 'sleeping',
    kind: 'persistent',
    canBeTriggeredRandomly: true,
    blocksRandomBehavior: true,
    resetsInactivityTimerOnStart: false,
    defaultBubble: 'Zzz...',
  },

  happy: {
    state: 'happy',
    kind: 'oneShot',
    defaultDurationMs: 2500,
    returnState: 'idle',
    canBeTriggeredRandomly: true,
    blocksRandomBehavior: true,
    resetsInactivityTimerOnStart: true,
    defaultBubble: '喵～',
  },

  grooming: {
    state: 'grooming',
    kind: 'oneShot',
    defaultDurationMs: 1200,
    returnState: 'idle',
    canBeTriggeredRandomly: true,
    blocksRandomBehavior: true,
    resetsInactivityTimerOnStart: true,
  },

  walk_left: {
    state: 'walk_left',
    kind: 'locomotion',
    canBeTriggeredRandomly: true,
    blocksRandomBehavior: true,
    resetsInactivityTimerOnStart: true,
  },

  walk_right: {
    state: 'walk_right',
    kind: 'locomotion',
    canBeTriggeredRandomly: true,
    blocksRandomBehavior: true,
    resetsInactivityTimerOnStart: true,
  },

  dragging: {
    state: 'dragging',
    kind: 'interactionOverride',
    canBeTriggeredRandomly: false,
    blocksRandomBehavior: true,
    resetsInactivityTimerOnStart: true,
  },
};
```

Agent 可以根据当前代码结构调整字段，但必须保留核心思想：动作行为规则应集中定义，而不是散落在 `App.tsx` 中。

---

# Part C：新增统一状态控制 Hook

建议新增：

```text
src/hooks/usePetActionController.ts
```

它应集中管理：

```text
petState
petStateRef
enteredStateAtRef
lastInteractionAtRef
manualActionCooldownUntilRef
actionTokenRef
actionTimerRef
inactivityTimerRef
transitionToState
dispatchPetAction
resetInactivityTimer
markUserInteraction
```

建议输入：

```ts
interface UsePetActionControllerParams {
  settings: UserSettings;
  isWindowVisible: boolean;
  showBubble: (text: string) => void;
  clearBubble: () => void;
  onLocomotionActionStarted?: (state: 'walk_left' | 'walk_right') => void;
}
```

建议输出：

```ts
interface UsePetActionControllerResult {
  petState: PetState;
  petStateRef: React.MutableRefObject<PetState>;
  enteredStateAtRef: React.MutableRefObject<number>;
  lastInteractionAtRef: React.MutableRefObject<number>;
  manualActionCooldownUntilRef: React.MutableRefObject<number>;

  dispatchPetAction: (request: PetActionRequest) => boolean;
  markUserInteraction: (cooldownMs?: number) => void;
  resetInactivityTimer: (reason: string) => void;
}
```

Action request：

```ts
export interface PetActionRequest {
  state: PetState;
  source: ActionTriggerSource;
  reason: string;
  bubbleText?: string;
  force?: boolean;
}
```

---

# Part D：统一 dispatchPetAction 规则

所有状态切换都应通过：

```ts
dispatchPetAction(request)
```

规则：

```text
1. dragging 是最高优先级。
2. 当前正在 dragging 时，除 drag end / idle / dragging 相关动作外，拒绝其他动作。
3. menu / tray / manual / interaction 的优先级高于 random。
4. random action 不能打断 oneShot action。
5. random action 不能打断 locomotion action。
6. random action 不能打断 dragging。
7. oneShot action 启动时设置统一 actionTimer。
8. oneShot action 完成后回 returnState，通常是 idle。
9. locomotion action 启动时只切状态，窗口移动继续由 useWalkingMovement 负责。
10. locomotion 完成后由 useWalkingMovement 调用 dispatchPetAction 回 idle。
11. persistent state 不设置 oneShot timer。
12. 所有新 action 启动前应清理旧 actionTimer。
13. 所有 timer callback 必须检查 action token，不能覆盖新状态。
```

---

# Part E：Action token 防止旧 timer 覆盖新状态

新增：

```ts
const actionTokenRef = useRef(0);
```

每次进入新状态：

```ts
actionTokenRef.current += 1;
const token = actionTokenRef.current;
```

oneShot timer callback：

```ts
if (actionTokenRef.current !== token) return;
if (petStateRef.current !== expectedState) return;

dispatchPetAction({
  state: returnState,
  source: 'timer',
  reason: `${expectedState} completed`,
});
```

这是 Phase 14 的关键目标。

必须解决的风险：

```text
happy timer 不能覆盖 grooming / walking / sleeping。
grooming timer 不能覆盖 happy / walking / sleeping。
inactivity timer 不能在 grooming / happy / walking / dragging 中强制 sleeping。
旧 timer 必须因为 stale token 被忽略。
```

---

# Part F：从 App.tsx 中迁移触发函数

当前 `App.tsx` 中以下逻辑应被迁移到 `usePetActionController` 或变成 dispatcher 的薄包装：

```text
transitionToState
forcePetStateFromUserAction
triggerHappy
triggerSleep
triggerGrooming
triggerWalkLeft
triggerWalkRight
triggerIdle
clearHappyTimer
clearGroomingTimer
inactivityTimerRef
manualActionCooldownUntilRef
enteredStateAtRef
lastInteractionAtRef
```

目标：

```text
1. App.tsx 不再直接管理 happyTimer / groomingTimer。
2. App.tsx 不再维护多套 triggerXxx 业务逻辑。
3. App.tsx 只负责 UI、事件绑定、菜单 action 映射、settings panel。
4. 复杂状态规则集中在 usePetActionController。
```

如果一次性迁移风险太高，可以分阶段：

```text
第一步：保留薄 wrapper，例如 triggerHappy 内部只调用 dispatchPetAction。
第二步：确认回归测试通过后，再删除重复 wrapper。
```

---

# Part G：右键菜单统一走 dispatcher

右键菜单 action handler 应改成类似：

```ts
case 'pet':
  dispatchPetAction({
    state: 'happy',
    source: 'menu',
    reason: 'menu pet',
    bubbleText: '舒服～',
    force: true,
  });
  break;

case 'feed':
  dispatchPetAction({
    state: 'happy',
    source: 'menu',
    reason: 'menu feed',
    bubbleText: '小鱼干！',
    force: true,
  });
  break;

case 'grooming':
  dispatchPetAction({
    state: 'grooming',
    source: 'menu',
    reason: 'menu grooming',
    force: true,
  });
  break;

case 'sleep':
  dispatchPetAction({
    state: 'sleeping',
    source: 'menu',
    reason: 'menu sleep',
    bubbleText: 'Zzz...',
    force: true,
  });
  break;

case 'wake':
  dispatchPetAction({
    state: 'happy',
    source: 'menu',
    reason: 'menu wake',
    bubbleText: '醒啦！',
    force: true,
  });
  break;

case 'walkLeft':
  dispatchPetAction({
    state: 'walk_left',
    source: 'menu',
    reason: 'menu walkLeft',
    force: true,
  });
  break;

case 'walkRight':
  dispatchPetAction({
    state: 'walk_right',
    source: 'menu',
    reason: 'menu walkRight',
    force: true,
  });
  break;
```

要求：

```text
菜单动作是显式用户动作。
菜单动作可以打断 happy / grooming / sleeping / walking。
唯一例外是正在 dragging 时不应被菜单动作强行打断。
```

---

# Part H：random behavior 统一走 dispatcher

`useRandomBehavior` 应改为：

```ts
dispatchPetAction({
  state: selectedState,
  source: 'random',
  reason: 'random grooming',
});
```

而不是直接调用：

```text
triggerHappy
triggerSleep
triggerWalkLeft
triggerWalkRight
triggerGrooming
```

规则：

```text
1. randomBehaviorEnabled=false 时不触发任何自动动作。
2. autoWalkEnabled=false 时只禁止 random walk_left / walk_right。
3. autoWalkEnabled=false 不影响手动 walk。
4. autoWalkEnabled=false 不影响 random grooming / happy / sleep。
5. random action 不能打断 oneShot / locomotion / dragging。
6. random action 必须遵守 behaviorFrequency 和 cooldown。
```

`useRandomBehavior` 可以继续负责“选哪个行为”，但不要负责状态切换细节。

---

# Part I：walking movement 与 dispatcher 集成

`useWalkingMovement` 继续负责窗口移动，不要把窗口移动逻辑塞进 action controller。

walking 完成后：

```ts
dispatchPetAction({
  state: 'idle',
  source: 'system',
  reason: 'walking completed',
});
```

如果同一个 walking 状态被重复触发，需要仍然能重新开始 walking。可以继续保留：

```text
walkRunId
```

但 walkRunId 的更新应由 action accepted 时统一触发：

```text
如果 accepted state 是 walk_left / walk_right，则 walkRunId += 1。
```

---

# Part J：dragging 集成

保留 Phase 10 的可靠 pointer event 拖拽逻辑，不要回退到不可靠 mouse down 方案。

drag confirmed 时：

```ts
dispatchPetAction({
  state: 'dragging',
  source: 'interaction',
  reason: 'pointer drag confirmed',
  force: true,
});
```

drag end 时：

```ts
dispatchPetAction({
  state: 'idle',
  source: 'interaction',
  reason: 'drag ended',
  force: true,
});
```

要求：

```text
1. dragging 最高优先级。
2. dragging 会取消 oneShot timer。
3. dragging 会阻止 random behavior。
4. dragging 结束后回 idle。
5. 不破坏点击 / 双击 / 拖拽可靠性。
```

---

# Part K：inactivity sleep 统一管理

inactivity timer 应尽量迁移到 action controller 中。

规则：

```text
1. 只有当前状态是 idle 时，inactivity timer 才能进入 sleeping。
2. grooming / happy / walking / dragging 期间不能被 inactivity sleep 打断。
3. 显式菜单动作后重置 inactivity timer。
4. sleepAfterIdleMs = null 或 <= 0 时禁用自动睡觉。
5. 进入 idle 后重新启动 inactivity timer。
6. 进入 sleeping 后不需要继续 inactivity timer。
```

---

# Part L：Debug action logging

新增或增强：

```text
src/debug/debugFlags.ts
```

建议加入：

```ts
export const DEBUG_ACTIONS = import.meta.env.DEV && false;
export const DEBUG_TIMERS = import.meta.env.DEV && false;
```

日志内容：

```text
[action] request received
[action] accepted / rejected
[action] previousState -> nextState
[action] source / reason
[action] token
[timer] oneShot scheduled
[timer] oneShot ignored due to stale token
[timer] inactivity scheduled
[timer] inactivity skipped due to currentState
[random] selected action
[random] rejected due to blocking state
```

默认必须关闭，不要刷屏。

---

# Part M：可选设置面板 Debug 区域增强

如果 settings panel 已有 dev debug 区域，可以加入：

```text
currentState
actionKind
enteredStateAt
activeActionToken
lastInteractionAge
manualActionCooldownRemaining
randomBehaviorEnabled
autoWalkEnabled
isWindowVisible
isDragging
```

只在：

```ts
import.meta.env.DEV
```

下显示。

---

# Part N：建议文件变更

可能新增：

```text
src/actions/actionTypes.ts
src/actions/actionRegistry.ts
src/hooks/usePetActionController.ts
```

可能修改：

```text
src/App.tsx
src/hooks/useRandomBehavior.ts
src/hooks/useWalkingMovement.ts
src/debug/debugFlags.ts
src/components/SettingsPanel.tsx
```

不要盲目创建重复文件。必须先检查当前目录结构。

---

# Part O：迁移步骤

## Step 1：新增 action types / registry

先新增 metadata，不改变运行逻辑。

## Step 2：新增 usePetActionController

把当前 App 中的状态控制逻辑等价迁移进去。

## Step 3：App.tsx 改用 controller

移除或薄化 App 中的 trigger 函数。

## Step 4：菜单动作改为 dispatchPetAction

确认所有右键菜单动作仍可用。

## Step 5：random behavior 改为 dispatchPetAction

确认随机行为仍可用。

## Step 6：walking 完成回调改为 dispatchPetAction idle

确认 walking 完成后正常回 idle。

## Step 7：完整回归测试

确认行为没有倒退。

---

# Part P：验收标准

## P1. 代码结构验收

```text
[ ] 新增 action registry 或等价结构。
[ ] 新增统一 action dispatcher。
[ ] oneShot action 使用统一 timer。
[ ] happy 和 grooming 不再各自维护完全独立的 timer 模式。
[ ] App.tsx 明显变薄。
[ ] random behavior 通过 dispatcher 触发状态。
[ ] menu action 通过 dispatcher 触发状态。
[ ] walking completion 通过 dispatcher 回 idle。
[ ] inactivity sleep 统一管理。
[ ] 所有 timer callback 使用 action token 或等价 stale-check。
```

## P2. 功能回归验收

```text
[ ] npm start 正常。
[ ] TypeScript 无错误。
[ ] idle 正常。
[ ] dragging 正常。
[ ] happy 正常并能回 idle。
[ ] grooming 正常并能回 idle。
[ ] sleeping 正常。
[ ] walk_left 正常并能回 idle。
[ ] walk_right 正常并能回 idle。
[ ] 右键菜单所有动作正常。
[ ] 托盘菜单正常。
[ ] 设置面板正常。
[ ] random behavior 正常。
[ ] randomBehaviorEnabled=false 后无自动行为。
[ ] autoWalkEnabled=false 后无自动 walking，但手动 walking 仍可用。
[ ] settings persistence 正常。
[ ] transparent window 正常。
[ ] renderer console 无 runtime error。
[ ] main process terminal 无 runtime error。
```

## P3. Bug 防护验收

```text
[ ] happy timer 不会覆盖 grooming / walking / sleeping。
[ ] grooming timer 不会覆盖 happy / walking / sleeping。
[ ] inactivity timer 不会在 grooming / happy / walking / dragging 中触发 sleeping。
[ ] 旧 timer 因 stale token 被忽略。
[ ] random behavior 不会打断 oneShot action。
[ ] random behavior 不会打断 locomotion action。
[ ] menu action 可以打断 oneShot / locomotion / sleeping。
[ ] dragging 始终最高优先级。
[ ] sleeping -> wake -> walk 仍然正常。
[ ] grooming -> walk 正常。
[ ] happy -> grooming 正常。
[ ] walk_left -> walk_right 切换方向正常。
[ ] dragging 能打断 grooming / happy / walking。
```

---

# Part Q：Agent 执行 Prompt

```text
We need to implement MochiCat Phase 14: Action Orchestration and State Machine Refactor.

Current context:
- Phase 13 is complete.
- Existing PetState:
  - idle
  - dragging
  - happy
  - sleeping
  - walk_left
  - walk_right
  - grooming
- animationConfig includes grooming.
- App.tsx currently contains many state and timer functions:
  - transitionToState
  - forcePetStateFromUserAction
  - triggerHappy
  - triggerSleep
  - triggerGrooming
  - triggerWalkLeft
  - triggerWalkRight
  - happyTimerRef
  - groomingTimerRef
  - inactivityTimerRef
  - manualActionCooldownUntilRef
  - enteredStateAtRef
  - lastInteractionAtRef

Goal:
Refactor the action/state control into a unified action orchestration system so future one-shot actions like stretching, yawning, and paw_raise can be added by registration instead of duplicating trigger/timer logic.

Do not add new image states in this phase.
Do not add stretching/yawning/paw_raise yet.
Do not reintroduce window snap / Perch Mode.

Part 1 - Define action metadata:
Create action types and registry, for example:
- src/actions/actionTypes.ts
- src/actions/actionRegistry.ts

Classify states:
- idle: persistent
- sleeping: persistent
- happy: oneShot
- grooming: oneShot
- walk_left: locomotion
- walk_right: locomotion
- dragging: interactionOverride

Each action definition should describe:
- state
- kind
- defaultDurationMs if oneShot
- returnState if oneShot
- whether random can trigger it
- whether it blocks random behavior
- whether it resets inactivity timer
- default bubble text if needed

Part 2 - Create usePetActionController:
Create:
src/hooks/usePetActionController.ts

It should centralize:
- petState
- petStateRef
- enteredStateAtRef
- lastInteractionAtRef
- manualActionCooldownUntilRef
- actionTokenRef
- actionTimerRef
- inactivityTimerRef
- transition logic
- dispatchPetAction
- resetInactivityTimer
- markUserInteraction

Part 3 - Add action token safety:
Every state/action transition increments actionTokenRef.
Any oneShot timer callback must check:
- token is still current
- petStateRef.current is still expected state

This prevents old happy/grooming timers from overriding newer states.

Part 4 - Replace separate oneShot timers:
Remove separate happyTimerRef and groomingTimerRef from App.tsx if possible.
Happy and grooming should share the same oneShot action timer logic.

Part 5 - App.tsx integration:
Make App.tsx thinner.
It should call dispatchPetAction for menu, random, walking completion, and dragging transitions.
Do not keep duplicate triggerHappy / triggerGrooming / triggerWalkLeft / triggerWalkRight logic unless those are thin wrappers around dispatchPetAction.

Part 6 - Random behavior integration:
Update useRandomBehavior so it chooses behavior but triggers via dispatchPetAction.
Random actions must not interrupt:
- dragging
- oneShot action
- locomotion action
- recent manual action cooldown

randomBehaviorEnabled=false disables all automatic random actions.
autoWalkEnabled=false disables only automatic walk_left/walk_right.
Manual walk menu actions must still work.

Part 7 - Walking integration:
useWalkingMovement remains responsible for moving the window.
When walking completes, call:
dispatchPetAction({ state: 'idle', source: 'system', reason: 'walking completed' })

If the same walk state is triggered repeatedly, ensure walking movement restarts using walkRunId or equivalent.

Part 8 - Dragging integration:
Keep the reliable pointer event drag handling from Phase 10.
On drag confirmed:
dispatchPetAction({ state: 'dragging', source: 'interaction', reason: 'pointer drag confirmed', force: true })

On drag end:
dispatchPetAction({ state: 'idle', source: 'interaction', reason: 'drag ended', force: true })

Dragging must remain highest priority and must cancel oneShot timers.

Part 9 - Inactivity sleep:
Move inactivity sleep logic into the action controller if practical.
Rules:
- only idle can transition to sleeping via inactivity timer
- grooming/happy/walking/dragging cannot be interrupted by inactivity sleep
- sleepAfterIdleMs <= 0 or null disables inactivity sleep
- entering idle restarts inactivity timer

Part 10 - Debug logs:
Add dev-only debug flags:
- DEBUG_ACTIONS
- DEBUG_TIMERS

Default false.
Log action requests, accepted/rejected decisions, transitions, timer scheduling, stale timer skips.

Validation:
1. npm start works.
2. TypeScript has no errors.
3. idle works.
4. dragging works.
5. happy works and returns to idle.
6. grooming works and returns to idle.
7. sleeping works.
8. walk_left/walk_right work and return to idle.
9. right-click menu actions all work.
10. tray menu still works.
11. settings panel still works.
12. random behavior still works.
13. randomBehaviorEnabled=false disables automatic actions.
14. autoWalkEnabled=false disables only automatic walking.
15. manual walking still works when autoWalkEnabled=false.
16. happy timer cannot override grooming/walking/sleeping.
17. grooming timer cannot override happy/walking/sleeping.
18. inactivity timer cannot interrupt happy/grooming/walking/dragging.
19. dragging interrupts any active action.
20. sleeping -> wake -> walk still works.
21. grooming -> walk works.
22. happy -> grooming works.
23. walk_left -> walk_right direction switch works.
24. Renderer console has no runtime errors.
25. Main process terminal has no runtime errors.

Before coding:
1. Inspect App.tsx.
2. Inspect useRandomBehavior.ts.
3. Inspect useWalkingMovement.ts.
4. Inspect src/types/pet.ts.
5. Inspect src/animation/animationConfig.ts.
6. Inspect debugFlags.ts.
7. List files to create/modify.
8. Explain migration plan.
9. Then implement.

After coding:
1. List changed files.
2. Explain new action model.
3. Explain action token stale timer protection.
4. Explain how menu actions use dispatcher.
5. Explain how random behavior uses dispatcher.
6. Explain how walking completion returns to idle.
7. Explain how dragging priority is preserved.
8. Confirm all existing features still work.
```

---

## Phase 14 完成后的提交建议

```bash
git status
git add .
git commit -m "refactor: centralize pet action orchestration"
```
