# MochiCat Phase 7 开发文档：随机行为与轻量自主系统

版本：v0.1  
阶段：Phase 7  
前置条件：Phase 6 已完成；真实猫咪透明 PNG 动画素材已正确接入；基础设置持久化已完成；右键菜单和系统托盘可用。  
目标：让 MochiCat 在用户不操作时具备轻量自主行为，使桌面宠物更有生命感。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：只复用已有状态 `idle`、`dragging`、`happy`、`sleeping`，不新增新图片状态，不引入走路系统，不引入复杂情绪值系统。

---

## 1. Phase 7 的核心目标

Phase 7 的目标是：

> 在不破坏现有交互逻辑的前提下，为 MochiCat 增加可控、低打扰、可关闭的随机自主行为。

当前 MochiCat 已经可以：

```text
用户拖拽 -> dragging
用户双击 -> happy
无操作一段时间 -> sleeping
右键菜单 -> happy / sleeping / wake
托盘菜单 -> 显示 / 隐藏 / 退出
```

Phase 7 完成后，MochiCat 应该可以：

```text
idle 一段时间后，偶尔自己开心一下
idle 更久后，可能自己睡觉
sleeping 一段时间后，可能自己醒来
randomBehaviorEnabled 关闭后，所有随机行为停止
用户正在操作时，不会被随机行为打断
```

本阶段不追求复杂 AI，只实现一个轻量随机行为调度器。

---

## 2. 当前项目状态

Phase 6 已完成后，项目应具备：

```text
Electron + React + TypeScript + Vite 应用可以运行
透明、无边框、置顶桌面宠物窗口
自定义拖拽
真实猫咪透明 PNG 帧动画
四种 PetState：
- idle
- dragging
- happy
- sleeping

帧动画系统：
- animationConfig
- useAnimation
- PetSprite

交互系统：
- 双击 happy
- 拖拽 dragging
- 无操作 sleeping
- speech bubble

控制系统：
- 右键菜单
- 系统托盘
- 显示 / 隐藏 / 退出

设置持久化：
- petSize
- alwaysOnTop
- speechBubbleEnabled
- randomBehaviorEnabled
```

Phase 7 需要正式使用 `randomBehaviorEnabled` 设置项。

---

## 3. Phase 7 不做什么

本阶段禁止实现：

```text
walk_left / walk_right
自动走路
屏幕边缘碰撞
物理运动系统
eat / play / angry / curious 等新 PetState
新动画图片生成
复杂情绪系统
饥饿值 / 亲密度 / 体力值
AI 聊天
音效系统
多皮肤系统
完整设置面板
插件系统
云同步
正式打包发布
```

原因：

```text
Phase 7 的重点是验证“自主行为调度”这条链路。
更复杂的行为系统应放到后续 Phase。
```

---

## 4. Phase 7 完成效果

完成后应满足：

```text
1. npm start 可以正常启动。
2. 真实猫咪透明 PNG 仍然正常显示。
3. idle / dragging / happy / sleeping 动画仍然正常播放。
4. 拖拽仍然正常。
5. 双击仍然触发 happy。
6. 右键菜单和托盘仍然正常。
7. settings.json 中的 randomBehaviorEnabled 生效。
8. randomBehaviorEnabled = true 时，空闲状态下会触发随机行为。
9. randomBehaviorEnabled = false 时，随机行为完全停止。
10. 用户正在拖拽时，不会触发随机行为。
11. 用户刚操作完的短时间内，不会触发随机行为。
12. happy 状态正在播放时，不会被随机行为打断。
13. 窗口隐藏时，随机行为暂停或不触发。
14. TypeScript 无编译错误。
15. Console 和 main process 终端无明显报错。
```

---

## 5. 随机行为设计

### 5.1 只复用现有 PetState

底层仍然只有：

```ts
export type PetState =
  | 'idle'
  | 'dragging'
  | 'happy'
  | 'sleeping';
```

不要新增：

```ts
'eat'
'petting'
'wake'
'lookAround'
'curious'
```

如果需要表达行为，可以使用行为名称，但它们最终映射到已有状态。

示例：

```text
selfHappy -> happy
nap -> sleeping
wakeUp -> happy -> idle
```

---

## 6. 推荐随机行为表

Phase 7 建议先实现 3 个行为。

### 6.1 行为 1：selfHappy

含义：

```text
小猫自己开心一下。
```

触发条件：

```text
当前状态是 idle
randomBehaviorEnabled = true
距离上次用户交互至少 15 秒
窗口可见
不在拖拽中
```

结果：

```text
进入 happy 状态
显示气泡：“喵？”
持续约 2 秒
自动回到 idle
```

建议概率：

```text
每次调度检查时 40% 概率
```

---

### 6.2 行为 2：nap

含义：

```text
小猫自己犯困睡觉。
```

触发条件：

```text
当前状态是 idle
randomBehaviorEnabled = true
距离上次用户交互至少 45 秒
窗口可见
不在拖拽中
```

结果：

```text
进入 sleeping 状态
显示气泡：“Zzz...”
```

建议概率：

```text
每次调度检查时 25% 概率
```

---

### 6.3 行为 3：wakeUp

含义：

```text
小猫睡一段时间后自己醒来。
```

触发条件：

```text
当前状态是 sleeping
randomBehaviorEnabled = true
sleeping 持续至少 60 秒
窗口可见
```

结果：

```text
进入 happy 状态
显示气泡：“醒啦～”
约 2 秒后回到 idle
```

建议概率：

```text
每次 sleeping 调度检查时 35% 概率
```

---

## 7. 时间参数建议

为方便开发和调试，建议集中定义常量。

```ts
export const RANDOM_BEHAVIOR_CONFIG = {
  minIdleDelayMs: 20_000,
  maxIdleDelayMs: 45_000,
  recentInteractionCooldownMs: 15_000,
  minNapIdleMs: 45_000,
  minSleepBeforeWakeMs: 60_000,
  happyDurationMs: 2_000,
} as const;
```

开发测试时可以临时缩短：

```ts
minIdleDelayMs: 5_000
maxIdleDelayMs: 10_000
recentInteractionCooldownMs: 3_000
minNapIdleMs: 10_000
minSleepBeforeWakeMs: 15_000
```

正式提交前应恢复到不太打扰用户的时间。

---

## 8. 推荐文件结构

建议新增：

```text
src/hooks/useRandomBehavior.ts
src/behavior/randomBehaviorTypes.ts
src/behavior/randomBehaviorConfig.ts
```

如果项目较小，也可以只新增：

```text
src/hooks/useRandomBehavior.ts
```

但推荐至少将配置拆出来，方便后续调参。

目标结构：

```text
src/
├── App.tsx
├── hooks/
│   ├── useAnimation.ts
│   └── useRandomBehavior.ts
├── behavior/
│   ├── randomBehaviorTypes.ts
│   └── randomBehaviorConfig.ts
├── animation/
│   ├── animationConfig.ts
│   └── animationTypes.ts
├── components/
│   ├── PetSprite.tsx
│   └── SpeechBubble.tsx
└── types/
    ├── pet.ts
    └── settings.ts
```

实际路径应以当前工程为准。Codex 应先检查现有结构，不要盲目创建重复目录。

---

## 9. 类型设计

### 9.1 RandomBehaviorName

```ts
export type RandomBehaviorName =
  | 'selfHappy'
  | 'nap'
  | 'wakeUp';
```

### 9.2 RandomBehaviorContext

```ts
import type { PetState } from '../types/pet';
import type { UserSettings } from '../types/settings';

export interface RandomBehaviorContext {
  petState: PetState;
  settings: UserSettings;
  isDragging: boolean;
  isWindowVisible: boolean;
  lastInteractionAt: number;
  enteredStateAt: number;
}
```

如果项目中没有 `enteredStateAt`，可以在 App 中新增一个 ref 或 state 记录每次 PetState 变化的时间。

---

## 10. `useRandomBehavior` Hook 设计

### 10.1 目标

新增 hook：

```text
src/hooks/useRandomBehavior.ts
```

职责：

```text
1. 根据当前状态和设置决定是否启用随机调度。
2. 在 idle 时定时随机触发 selfHappy 或 nap。
3. 在 sleeping 时定时随机触发 wakeUp。
4. 用户操作后重置调度。
5. 拖拽中暂停调度。
6. 窗口隐藏时暂停调度。
7. 组件卸载时清理 timer。
```

### 10.2 Hook 接口建议

```ts
import type { PetState } from '../types/pet';
import type { UserSettings } from '../types/settings';

interface UseRandomBehaviorParams {
  petState: PetState;
  settings: UserSettings;
  isDragging: boolean;
  isWindowVisible: boolean;
  lastInteractionAt: number;
  enteredStateAt: number;
  triggerHappy: (bubbleText?: string) => void;
  triggerSleep: (bubbleText?: string) => void;
  triggerIdle: () => void;
}

export function useRandomBehavior(params: UseRandomBehaviorParams): void;
```

如果当前 App 没有 `triggerIdle`，可以新增：

```ts
function triggerIdle() {
  setPetState('idle');
}
```

---

## 11. 调度策略

### 11.1 不要使用高频 interval

不建议每秒检查一次。  
推荐使用 `setTimeout` 随机安排下一次检查。

逻辑：

```text
当前状态允许随机行为
  -> 生成一个随机 delay
  -> setTimeout 到期
  -> 检查保护条件
  -> 如果通过，执行一个随机行为
  -> 然后重新安排下一次 timeout
```

这样比固定 interval 更自然，也更省资源。

### 11.2 随机 delay

```ts
function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min));
}
```

idle 状态：

```text
下一次检查延迟：20–45 秒
```

sleeping 状态：

```text
下一次检查延迟：30–60 秒
```

开发调试时可以临时缩短。

### 11.3 行为选择逻辑

idle 状态下：

```text
如果 idle 时间 < minNapIdleMs：
  只允许 selfHappy

如果 idle 时间 >= minNapIdleMs：
  selfHappy 和 nap 都可以
```

示例概率：

```ts
const roll = Math.random();

if (idleDuration >= minNapIdleMs && roll < 0.25) {
  triggerSleep('Zzz...');
} else if (roll < 0.65) {
  triggerHappy('喵？');
}
```

sleeping 状态下：

```ts
if (sleepDuration >= minSleepBeforeWakeMs && Math.random() < 0.35) {
  triggerHappy('醒啦～');
}
```

---

## 12. 保护条件

随机行为必须满足以下保护条件。

### 12.1 settings 保护

```ts
if (!settings.randomBehaviorEnabled) return;
```

### 12.2 拖拽保护

```ts
if (isDragging || petState === 'dragging') return;
```

### 12.3 用户近期操作保护

```ts
const now = Date.now();
if (now - lastInteractionAt < recentInteractionCooldownMs) return;
```

### 12.4 happy 状态保护

```ts
if (petState === 'happy') return;
```

原因：

```text
happy 通常是用户刚交互或菜单刚触发，不应被随机行为打断。
```

### 12.5 窗口隐藏保护

```ts
if (!isWindowVisible) return;
```

如果项目暂时没有窗口可见性状态，Phase 7 可先不实现这一项，但建议通过 preload / IPC 从 main process 获取或监听。

### 12.6 App 卸载清理

```ts
return () => {
  if (timerRef.current) {
    window.clearTimeout(timerRef.current);
  }
};
```

---

## 13. App 集成要求

### 13.1 记录用户交互时间

App 中需要维护：

```ts
const [lastInteractionAt, setLastInteractionAt] = useState(Date.now());
```

推荐封装：

```ts
function markUserInteraction() {
  setLastInteractionAt(Date.now());
}
```

在以下操作中调用：

```text
onMouseDown / 拖拽开始
拖拽结束
双击
右键菜单打开
菜单 action 触发
托盘菜单 action 触发
```

### 13.2 记录进入状态时间

```ts
const [enteredStateAt, setEnteredStateAt] = useState(Date.now());

useEffect(() => {
  setEnteredStateAt(Date.now());
}, [petState]);
```

用于判断：

```text
idle 已经持续多久
sleeping 已经持续多久
```

### 13.3 调用 useRandomBehavior

在 App 中：

```ts
useRandomBehavior({
  petState,
  settings,
  isDragging: petState === 'dragging',
  isWindowVisible,
  lastInteractionAt,
  enteredStateAt,
  triggerHappy,
  triggerSleep,
  triggerIdle,
});
```

如果当前没有 `isWindowVisible`，可以先传 `true`，并在后续小节实现窗口可见性同步。

---

## 14. 窗口可见性同步

Phase 5 已经实现了显示 / 隐藏。  
Phase 7 建议让 renderer 知道窗口当前是否可见。

### 14.1 Main process

新增或复用 IPC：

```text
window:visibility-changed
```

当窗口 hide/show 时：

```ts
mainWindow.on('show', () => {
  mainWindow.webContents.send('window:visibility-changed', true);
});

mainWindow.on('hide', () => {
  mainWindow.webContents.send('window:visibility-changed', false);
});
```

也可以在托盘 / 菜单 show/hide handler 中主动发送。

### 14.2 Preload

暴露：

```ts
window.mochiCat.window.onVisibilityChanged(callback)
```

示例：

```ts
onVisibilityChanged: (callback: (visible: boolean) => void) => {
  const listener = (_event, visible: boolean) => callback(visible);
  ipcRenderer.on('window:visibility-changed', listener);

  return () => {
    ipcRenderer.removeListener('window:visibility-changed', listener);
  };
}
```

### 14.3 Renderer

```ts
const [isWindowVisible, setIsWindowVisible] = useState(true);

useEffect(() => {
  return window.mochiCat.window.onVisibilityChanged(setIsWindowVisible);
}, []);
```

如果实现成本较高，可以暂时不做，但建议 Phase 7 完成这一点。

---

## 15. 设置菜单联动

Phase 6 已经实现 `randomBehaviorEnabled` 持久化。  
Phase 7 应在右键菜单或托盘菜单中加入开关：

```text
随机行为：开启 / 关闭
```

### 15.1 行为

点击菜单项：

```text
randomBehaviorEnabled: true -> false
randomBehaviorEnabled: false -> true
```

保存到 settings.json。

### 15.2 菜单显示

右键菜单中可显示：

```text
随机行为：开启
```

或使用 checkbox：

```text
[✓] 随机行为
```

建议 Electron Menu item 使用 `type: 'checkbox'`：

```ts
{
  label: '随机行为',
  type: 'checkbox',
  checked: settings.randomBehaviorEnabled,
  click: () => updateSettings({
    randomBehaviorEnabled: !settings.randomBehaviorEnabled,
  }),
}
```

实际实现需要结合 Phase 6 settings flow。  
如果 main process 是设置权威来源，菜单点击应走 settings:update，然后通知 renderer settings changed。

---

## 16. Settings Changed 同步

如果 Phase 6 已经实现 settings update 但没有 settings changed event，Phase 7 建议补上。

### 16.1 Main -> Renderer

```text
settings:changed
```

Main process 在 settings update 后：

```ts
mainWindow.webContents.send('settings:changed', updatedSettings);
```

### 16.2 Preload

```ts
window.mochiCat.settings.onChanged(callback)
```

### 16.3 Renderer

```ts
useEffect(() => {
  return window.mochiCat.settings.onChanged((nextSettings) => {
    setSettings(nextSettings);
  });
}, []);
```

如果 Phase 6 已经有类似机制，复用即可。

---

## 17. 气泡文案

随机行为可以使用以下轻量文案：

```text
selfHappy:
- “喵？”
- “喵～”
- “在看你”

nap:
- “Zzz...”
- “困了...”

wakeUp:
- “醒啦～”
- “喵？”
```

建议随机选择：

```ts
const idleBubbles = ['喵？', '喵～', '在看你'];
const napBubbles = ['Zzz...', '困了...'];
const wakeBubbles = ['醒啦～', '喵？'];
```

如果 `speechBubbleEnabled = false`，不显示气泡，但状态仍可切换。

---

## 18. 与现有 inactivity sleeping 的关系

当前项目可能已经有：

```text
长时间无操作 -> sleeping
```

Phase 7 需要避免两个系统冲突。

推荐处理方式：

```text
保留原有 inactivity sleeping。
useRandomBehavior 也可以触发 sleeping，但必须复用 triggerSleep。
不要创建第二套 sleep timer。
```

如果发现原有 inactivity timer 和 random behavior 重复触发，可以二选一：

### 方案 A：保留原有 inactivity timer

随机系统只做：

```text
selfHappy
wakeUp
```

### 方案 B：统一由 useRandomBehavior 管理

将原有 inactivity sleeping 合并到 random behavior 中。

Phase 7 推荐方案 A，风险更低。  
除非当前 inactivity 逻辑已经很混乱，否则不要在本阶段重构。

---

## 19. Codex 执行任务 Prompt

可以直接把以下内容交给 Codex：

```text
We have completed Phase 6 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The app has a transparent frameless always-on-top desktop pet window.
- Real cat transparent PNG animation frames are integrated and working.
- The pet can be dragged.
- The app has four PetState values:
  - idle
  - dragging
  - happy
  - sleeping
- The frame-based animation system works.
- Native context menu and system tray are implemented.
- Basic settings persistence is implemented.
- Settings include:
  - petSize
  - alwaysOnTop
  - speechBubbleEnabled
  - randomBehaviorEnabled

Current phase:
Phase 7 - Random Behavior and Lightweight Autonomy

Goal:
Add lightweight random autonomous behavior so the cat occasionally reacts by itself when the user is idle.

Requirements:
1. Do not add new PetState values.
2. Do not add new image assets.
3. Reuse existing states:
   - selfHappy -> happy
   - nap -> sleeping
   - wakeUp -> happy then idle
4. Add a useRandomBehavior hook or equivalent controller.
5. The random behavior system must respect settings.randomBehaviorEnabled.
6. If randomBehaviorEnabled is false, no random autonomous behavior should occur.
7. Random behavior must not trigger while dragging.
8. Random behavior must not interrupt happy state.
9. Random behavior must not trigger immediately after user interaction.
10. Track last user interaction time.
11. Track when the current PetState was entered.
12. In idle:
    - occasionally trigger happy with a light speech bubble such as “喵？”
    - after longer idle duration, possibly trigger sleeping
13. In sleeping:
    - after a minimum sleep duration, possibly wake up by triggering happy with “醒啦～”
14. Use setTimeout-based random scheduling, not high-frequency polling.
15. Clean up timers on component unmount or when dependencies change.
16. Preserve existing dragging behavior.
17. Preserve existing double-click behavior.
18. Preserve existing right-click context menu and tray behavior.
19. Preserve existing settings persistence.
20. Add or expose a menu/toggle for randomBehaviorEnabled if not already available.
21. If possible, pause random behavior when the window is hidden.
22. Do not implement walking, physics, emotion values, hunger values, audio, AI chat, or new animation states.

Suggested files:
- src/hooks/useRandomBehavior.ts
- src/behavior/randomBehaviorConfig.ts
- src/behavior/randomBehaviorTypes.ts

Implementation details:
- Add constants for timing:
  - minIdleDelayMs
  - maxIdleDelayMs
  - recentInteractionCooldownMs
  - minNapIdleMs
  - minSleepBeforeWakeMs
  - happyDurationMs
- Use random delay between behavior checks.
- Use conservative timings so the cat does not become annoying.
- For development, temporary shorter timings are allowed, but final code should use reasonable production timings.

Before writing code:
1. Inspect the current project structure.
2. Locate App state logic, triggerHappy, triggerSleep, settings, menu, and tray code.
3. List the files you will create or modify.
4. Explain the random behavior data flow.
5. Then implement.

After implementation:
1. Explain how to run the app.
2. Explain how to verify random behavior.
3. Explain how to turn random behavior off.
4. List all files changed.
```

---

## 20. 推荐 Codex 修改步骤

Codex 应按以下顺序执行：

```text
1. 查看当前项目结构。
2. 找到 App.tsx 中的 PetState 和 triggerHappy / triggerSleep 逻辑。
3. 找到 Phase 6 的 settings 类型和 settings state。
4. 确认 randomBehaviorEnabled 已存在。
5. 新增 randomBehaviorConfig.ts。
6. 新增 randomBehaviorTypes.ts。
7. 新增 useRandomBehavior.ts。
8. 在 App 中记录 lastInteractionAt。
9. 在 App 中记录 enteredStateAt。
10. 在用户操作入口调用 markUserInteraction。
11. 在 App 中调用 useRandomBehavior。
12. 确保 randomBehaviorEnabled = false 时没有随机行为。
13. 如当前菜单没有 randomBehaviorEnabled 开关，补充菜单项。
14. 如当前窗口 hide/show 未同步到 renderer，增加可见性同步。
15. 运行 npm start。
16. 测试 idle 自动 happy。
17. 测试 idle 自动 sleeping。
18. 测试 sleeping 自动 wake。
19. 测试拖拽中不触发。
20. 测试关闭 randomBehaviorEnabled 后不触发。
```

---

## 21. Phase 7 验收标准

### 21.1 基础运行

```text
[ ] npm start 可以正常启动。
[ ] 真实猫咪图片仍然正常显示。
[ ] idle / dragging / happy / sleeping 动画仍然正常。
[ ] 没有白底、灰底、棋盘格背景。
[ ] 拖拽仍然正常。
[ ] 右键菜单仍然正常。
[ ] 托盘菜单仍然正常。
[ ] 设置持久化仍然正常。
```

### 21.2 随机行为

```text
[ ] randomBehaviorEnabled = true 时，idle 一段时间后可能自动 happy。
[ ] 自动 happy 后能回到 idle。
[ ] idle 更久后可能进入 sleeping。
[ ] sleeping 一段时间后可能自动醒来。
[ ] wakeUp 使用 happy 短反应，然后回到 idle。
[ ] randomBehaviorEnabled = false 时，不触发任何随机行为。
[ ] 用户拖拽时不触发随机行为。
[ ] happy 状态不被随机行为打断。
[ ] 用户刚操作后不会立刻触发随机行为。
[ ] 组件卸载或状态切换后没有残留 timer。
```

### 21.3 设置联动

```text
[ ] 右键菜单或托盘菜单可以切换 randomBehaviorEnabled。
[ ] 切换后 settings.json 被更新。
[ ] 重启应用后 randomBehaviorEnabled 保持上次值。
[ ] 关闭随机行为后等待足够长时间仍不触发自动行为。
```

---

## 22. 手动测试流程

### 22.1 开发测试建议

为了快速验证，可以临时将时间参数设短：

```ts
minIdleDelayMs: 5_000
maxIdleDelayMs: 10_000
recentInteractionCooldownMs: 3_000
minNapIdleMs: 12_000
minSleepBeforeWakeMs: 15_000
```

测试通过后再恢复正式值。

### 22.2 测试 idle 自动 happy

操作：

```text
1. 启动应用。
2. 确认 randomBehaviorEnabled = true。
3. 不操作 10–30 秒。
```

预期：

```text
小猫有概率自动进入 happy。
显示“喵？”或类似气泡。
随后自动回到 idle。
```

### 22.3 测试 idle 自动 sleeping

操作：

```text
1. 保持 randomBehaviorEnabled = true。
2. 不操作更长时间。
```

预期：

```text
小猫有概率进入 sleeping。
```

### 22.4 测试 sleeping 自动 wake

操作：

```text
1. 让小猫进入 sleeping。
2. 不操作一段时间。
```

预期：

```text
小猫有概率自动醒来。
进入 happy，显示“醒啦～”。
随后回到 idle。
```

### 22.5 测试拖拽保护

操作：

```text
1. 按住拖拽小猫。
2. 或者频繁拖动小猫。
```

预期：

```text
拖拽过程中不触发随机 happy / sleeping / wake。
```

### 22.6 测试关闭随机行为

操作：

```text
1. 通过菜单关闭 randomBehaviorEnabled。
2. 等待足够长时间。
```

预期：

```text
不会出现自动 happy。
不会出现自动 sleeping。
sleeping 不会自动 wake。
```

---

## 23. 常见问题与处理方式

### 23.1 随机行为太频繁

处理：

```text
1. 增加 minIdleDelayMs / maxIdleDelayMs。
2. 增加 recentInteractionCooldownMs。
3. 降低 selfHappy / nap / wakeUp 概率。
```

### 23.2 随机行为完全不触发

检查：

```text
1. randomBehaviorEnabled 是否为 true。
2. useRandomBehavior 是否被 App 调用。
3. timer 是否被过早 clear。
4. petState 是否一直不是 idle 或 sleeping。
5. lastInteractionAt 是否被频繁更新。
6. 条件保护是否过严。
```

### 23.3 关闭随机行为后仍然触发

原因：

```text
已有 timer 没有清理。
```

处理：

```ts
useEffect(() => {
  if (!settings.randomBehaviorEnabled) {
    clearScheduledTimer();
    return;
  }
}, [settings.randomBehaviorEnabled]);
```

确保依赖变化时清理旧 timer。

### 23.4 happy 被随机行为打断

处理：

```text
随机调度执行前再次检查 petState。
不要只在设置 timer 时检查。
timer 到期时必须重新读取最新状态。
```

如果 hook 有闭包过期问题，使用 ref 保存最新状态。

### 23.5 与原有 sleeping timer 冲突

处理：

```text
不要新建第二套强制 sleep timer。
Phase 7 只在随机行为中触发 triggerSleep。
如果原本 inactivity timer 已能工作，保留即可。
```

### 23.6 菜单切换 randomBehaviorEnabled 后 UI 不更新

处理：

```text
确保 settings:update 后 main process 通知 renderer。
或者 renderer 主动重新 get settings。
```

推荐实现：

```text
settings:changed
```

---

## 24. 代码质量要求

Phase 7 代码应满足：

```text
1. 不新增 PetState。
2. 不新增图片资源。
3. 随机行为逻辑集中在 useRandomBehavior 或 controller 中。
4. 不把大量随机逻辑塞进 App.tsx。
5. 所有 timer 都能清理。
6. 不使用高频 polling。
7. 不破坏拖拽逻辑。
8. 不破坏菜单和托盘。
9. 不破坏设置持久化。
10. randomBehaviorEnabled 能完全关闭随机行为。
```

---

## 25. Phase 7 完成后的 Git 提交建议

如果 Phase 7 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add random pet behavior"
```

---

## 26. 下一阶段预告

Phase 7 完成后建议进入：

```text
Phase 8 - Walking and Screen Edge Movement
```

Phase 8 可以实现：

```text
1. 增加 walk_left / walk_right 状态。
2. 让小猫偶尔在桌面上移动。
3. 增加屏幕边缘检测。
4. 增加方向翻转。
5. 将随机行为升级为：
   idle -> walk -> idle -> sleep
```

但 Phase 8 需要新的图片素材：

```text
walk_left 三帧或六帧
walk_right 三帧或六帧
```

因此在 Phase 7 不要提前做走路逻辑。
