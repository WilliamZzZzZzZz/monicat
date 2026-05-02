# MochiCat Phase 13 Prompt：新增 Grooming 舔爪洗脸动作

## 任务标题

MochiCat Phase 13 - Add Grooming Action State

## 背景

当前 MochiCat 已经完成基础桌宠系统、行为稳定化、设置面板、walking 素材处理等阶段。下一阶段需要新增一个原地动作状态：

```text
grooming
```

该状态表现为：

```text
小猫坐着抬起前爪，舔爪子，然后用爪子轻轻擦脸，最后回到 idle。
```

用户已经将 4 张新的 grooming 图片素材放入项目最外层文件夹，命名为：

```text
grooming_000
grooming_001
grooming_002
grooming_003
```

注意：

```text
这 4 张素材大概率不是标准 true-transparent PNG。
必须先处理成真正背景透明、带 alpha 通道的标准 PNG，才能接入系统。
```

---

## 当前仓库关键事实

当前 `PetState` 只包含：

```ts
'idle' | 'dragging' | 'happy' | 'sleeping' | 'walk_right' | 'walk_left'
```

因此需要新增：

```ts
'grooming'
```

当前 `animationConfig.ts` 已经按状态组织图片素材，例如 idle、dragging、happy、sleeping、walk_right、walk_left。新增 grooming 时应保持相同结构。当前 `AnimationConfig` 是 `Record<PetState, AnimationDefinition>`，所以一旦 `PetState` 增加 grooming，`animationConfig` 必须同步增加 grooming 配置，否则 TypeScript 会报错。

当前 `useAnimation` 支持 `fps`、`loop`、`frames`。当 `loop: false` 时会停留在最后一帧，不会自动回调状态完成。因此 grooming 如果是一次性动作，需要在 App 层或状态控制层设置计时器，在动画播放结束后切回 idle。

---

## Phase 13 总目标

```text
1. 查找项目根目录中的 grooming_000 / grooming_001 / grooming_002 / grooming_003。
2. 将 4 张 grooming 素材处理为真正透明背景的 RGBA PNG。
3. 检查并清理白底、灰底、棋盘格假透明背景、渐变边界、顶部灰线等问题。
4. 将处理后的 4 张图片放入 src/assets/cat/grooming/。
5. 新增 PetState: grooming。
6. 新增 animationConfig.grooming。
7. 在系统中接入 grooming 状态。
8. 添加右键菜单动作“洗洗脸”或“舔爪洗脸”。
9. 可选：在随机行为中低频触发 grooming。
10. grooming 播放完成后自动回到 idle。
11. 不破坏已有 idle / dragging / happy / sleeping / walk_left / walk_right。
```

---

## 禁止事项

本阶段不要实现：

```text
- 新 walking 系统
- 新外部窗口吸附 / Perch Mode
- 新物理系统
- AI 对话
- 音效
- 多宠物
- 多皮肤
- 打包发布
- 新 BrowserWindow
```

不要破坏：

```text
- manual dragging
- click / double-click
- random behavior
- walking movement
- right-click menu
- tray menu
- settings panel
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

# Part A：处理 grooming 图片素材

## A1. 输入素材查找

Agent 必须在项目最外层文件夹查找：

```text
grooming_000.*
grooming_001.*
grooming_002.*
grooming_003.*
```

允许扩展名：

```text
.png
.jpg
.jpeg
.webp
```

但最终输出必须是：

```text
true RGBA PNG
```

不要覆盖或删除项目根目录的原始素材。

## A2. 透明背景检查

对每张 grooming 输入图片检查：

```text
1. 是否是 PNG。
2. 是否有 alpha 通道。
3. alpha 是否真正透明。
4. 是否存在白底、灰底、黑底。
5. 是否存在棋盘格假透明背景。
6. 是否存在顶部灰色渐变线或半透明矩形背景。
7. 是否存在边缘脏像素。
8. 是否小猫耳朵、尾巴、爪子、胡须被裁切。
```

如果不是标准透明背景，必须先处理成 true-transparent PNG。

## A3. 图片处理要求

新增或复用本地工具脚本，例如：

```text
tools/prepare_grooming_assets.py
```

可以基于项目已有 asset 处理工具实现，但必须满足：

```text
1. 不重绘小猫。
2. 不改变 grooming 动作姿态。
3. 不改变小猫颜色、风格、比例。
4. 只移除背景污染。
5. 保留耳朵、眼睛、胡须、爪子、尾巴、毛发边缘。
6. 输出 RGBA PNG。
7. 先输出到 processed_assets/cat/grooming/。
8. 验证通过后再复制到 src/assets/cat/grooming/。
```

不要使用在线服务。不要调用图片生成模型。使用本地程序化处理，例如 Python + Pillow。

## A4. 输出路径

处理完成后输出：

```text
src/assets/cat/grooming/grooming_000.png
src/assets/cat/grooming/grooming_001.png
src/assets/cat/grooming/grooming_002.png
src/assets/cat/grooming/grooming_003.png
```

## A5. 生成检查报告和预览

必须生成：

```text
processed_assets/grooming_asset_report.txt
```

报告包含：

```text
filename
source file path
output file path
image size
mode
has alpha
transparent pixel ratio
alpha bounding box
top / bottom / left / right margin
non-transparent pixels touching edge: yes/no
checkerboard suspected: yes/no
top gray band suspected: yes/no
pass/fail
```

同时生成预览：

```text
processed_assets/previews/grooming_on_black.png
processed_assets/previews/grooming_on_green.png
processed_assets/previews/grooming_on_magenta.png
processed_assets/previews/grooming_on_blue.png
```

预览要求：

```text
1. 四张 grooming 帧排列显示。
2. 使用纯色背景检查是否仍有白底、灰底、棋盘格、顶部灰线。
3. 每帧下方可标注文件名。
```

---

# Part B：新增 PetState grooming

## B1. 修改 `src/types/pet.ts`

当前类似：

```ts
export type PetState = 'idle' | 'dragging' | 'happy' | 'sleeping' | 'walk_right' | 'walk_left';
```

需要改为：

```ts
export type PetState =
  | 'idle'
  | 'dragging'
  | 'happy'
  | 'sleeping'
  | 'walk_right'
  | 'walk_left'
  | 'grooming';
```

同时更新：

```ts
PET_STATE_EMOJI
```

建议：

```ts
grooming: '🧼'
```

---

# Part C：新增 animationConfig.grooming

## C1. 修改 `src/animation/animationConfig.ts`

新增：

```ts
const grooming000 = new URL('../assets/cat/grooming/grooming_000.png', import.meta.url).href;
const grooming001 = new URL('../assets/cat/grooming/grooming_001.png', import.meta.url).href;
const grooming002 = new URL('../assets/cat/grooming/grooming_002.png', import.meta.url).href;
const grooming003 = new URL('../assets/cat/grooming/grooming_003.png', import.meta.url).href;
```

新增配置：

```ts
grooming: {
  fps: 5,
  loop: false,
  frames: [grooming000, grooming001, grooming002, grooming003],
},
```

推荐：

```text
fps: 5
loop: false
```

理由：

```text
grooming 是一次性动作，不应该无限舔爪。
播放一次后应自动回 idle。
```

---

# Part D：接入 grooming 状态控制

## D1. grooming 应是 non-locomotion one-shot action

grooming 不应移动窗口。grooming 不是 walking。grooming 是一次性原地动作。

行为规则：

```text
1. 用户右键点击 grooming 时，立即进入 grooming。
2. grooming 期间不移动窗口。
3. grooming 播放完成后自动回到 idle。
4. 如果用户拖拽，立即打断 grooming，进入 dragging。
5. 如果用户右键触发 sleep / walk / happy，应能打断 grooming。
6. random behavior 不应在 grooming 播放过程中打断它。
```

## D2. 新增 triggerGrooming

在 `App.tsx` 或当前状态控制文件中新增：

```ts
const GROOMING_DURATION_MS = Math.ceil((4 / 5) * 1000) + 300;
```

如果 fps 或帧数从 animationConfig 读取更好。MVP 可以使用常量。

新增：

```ts
const groomingTimerRef = useRef<number | null>(null);
```

新增清理函数：

```ts
function clearGroomingTimer() {
  if (groomingTimerRef.current !== null) {
    window.clearTimeout(groomingTimerRef.current);
    groomingTimerRef.current = null;
  }
}
```

新增触发函数，按现有 App 结构调整：

```ts
const triggerGrooming = useCallback((reason = 'manual') => {
  if (petStateRef.current === 'dragging' || isDraggingRef.current) return;

  clearHappyTimer();
  clearGroomingTimer();
  markUserInteraction();

  petStateRef.current = 'grooming';
  setPetState('grooming');
  enteredStateAtRef.current = Date.now();

  groomingTimerRef.current = window.setTimeout(() => {
    if (petStateRef.current !== 'grooming') return;
    petStateRef.current = 'idle';
    setPetState('idle');
    enteredStateAtRef.current = Date.now();
    resetInactivityTimer();
  }, GROOMING_DURATION_MS);
}, [...]);
```

关键点：

```text
timer callback 必须检查当前状态仍然是 grooming。
否则用户在 grooming 期间触发 sleep / walk / drag 时，旧 timer 会错误把状态改回 idle。
```

## D3. 清理 timer

在组件 unmount 时必须清理：

```text
groomingTimerRef
```

在以下用户动作发生时也应清理 grooming timer：

```text
dragging
happy
sleeping
walk_left
walk_right
reset state
hide window if needed
```

推荐：

```text
任何 force user action transition 都清理 groomingTimer。
```

## D4. 行为优先级

更新行为优先级：

```text
1. dragging
2. explicit menu action
3. size/settings panel interaction
4. walking
5. happy
6. grooming
7. sleeping
8. idle
9. random behavior
```

明确要求：

```text
random behavior 不允许打断 grooming。
inactivity sleep 不允许在 grooming 过程中触发 sleeping。
grooming 完成后回 idle，并重置 inactivity timer。
```

---

# Part E：右键菜单和托盘菜单接入

## E1. 右键菜单新增动作

在右键菜单中新增：

```text
洗洗脸
```

或：

```text
舔爪洗脸
```

对应 action：

```text
grooming
```

点击后调用：

```ts
triggerGrooming('context-menu')
```

菜单位置建议：

```text
摸摸猫猫
喂小鱼干
洗洗脸
让它睡觉
唤醒猫猫
向左走动
向右走动
设置...
隐藏猫猫
退出
```

## E2. 托盘菜单可选新增

如果托盘菜单已有行为动作，可以新增：

```text
洗洗脸
```

如果托盘菜单主要是显示/隐藏/设置/退出，则可以不加。右键菜单必须加入。

---

# Part F：随机行为可选接入 grooming

## F1. grooming 作为低频随机行为

如果当前 `useRandomBehavior` 已经支持 behaviorFrequency 和 cooldown，新增一个低频 grooming action。

要求：

```text
1. grooming 只能在 idle 状态下自动触发。
2. randomBehaviorEnabled=false 时不能自动 grooming。
3. grooming 不受 autoWalkEnabled 限制。
4. autoWalkEnabled 只控制自动 walk_left / walk_right。
5. grooming 应有 cooldown，不能过于频繁。
```

建议：

```text
groomingCooldownMs: 30_000 到 60_000
```

如果 agent 判断本阶段改动应更小，可以先只做右键菜单手动 grooming。最低完成标准：

```text
右键菜单可以触发 grooming。
grooming 播放完成自动回 idle。
```

---

# Part G：状态互斥与 bug 防护

必须确认：

```text
1. dragging 会打断 grooming。
2. walk_left / walk_right 会打断 grooming。
3. sleeping 会打断 grooming。
4. happy 会打断 grooming。
5. grooming timer 不会在其他状态下把 petState 改回 idle。
6. inactivity timer 不会在 grooming 中触发 sleeping。
7. random behavior 不会在 grooming 中触发其他状态。
8. right-click menu 在 grooming 中仍可打开并触发其他动作。
```

特别注意：

```text
之前出现过 sleeping -> wake -> walk 无反应 bug。
不要因为新增 grooming 再引入 timer 覆盖状态的问题。
所有 timed transition 必须检查当前状态。
```

---

# Part H：CSS 和显示要求

确保 grooming 图片显示规则与其他状态一致：

```text
.pet-sprite-image
object-fit: contain
transparent background
no clipped ears / tail / paws
no top gray gradient line
```

不要给 grooming 单独加 scale。不要让 grooming 变大导致裁切。不要引入灰色背景或阴影边界。

如果图片尺寸与其他状态不一致，应通过素材处理阶段加透明 padding 或统一画布，而不是用 CSS 强行拉伸。

---

# Part I：验收标准

## I1. 图片素材验收

```text
[ ] 项目根目录 grooming_000 / 001 / 002 / 003 被正确识别。
[ ] 四张 grooming 素材已处理为 true RGBA PNG。
[ ] 输出到 src/assets/cat/grooming/。
[ ] 没有白底、灰底、黑底。
[ ] 没有棋盘格假透明背景。
[ ] 没有顶部灰色渐变边界线。
[ ] 耳朵、尾巴、爪子、胡须没有被裁切。
[ ] 四张素材画布尺寸一致。
[ ] 四张素材小猫大小和位置基本一致。
```

## I2. 代码接入验收

```text
[ ] PetState 包含 grooming。
[ ] PET_STATE_EMOJI 包含 grooming。
[ ] animationConfig 包含 grooming。
[ ] grooming 使用 4 帧。
[ ] grooming fps 合理，建议 5。
[ ] grooming loop=false。
[ ] App 中存在 triggerGrooming。
[ ] grooming 播放完成后自动回 idle。
[ ] grooming timer 会在 unmount 和状态切换时清理。
[ ] timer callback 检查当前状态仍然是 grooming。
```

## I3. 交互验收

```text
[ ] 右键菜单出现“洗洗脸”或“舔爪洗脸”。
[ ] 点击后小猫进入 grooming。
[ ] grooming 动作播放自然。
[ ] grooming 完成后回 idle。
[ ] grooming 中拖拽小猫可以立即打断。
[ ] grooming 中右键让它睡觉可以切到 sleeping。
[ ] grooming 中右键向左/向右走动可以切到 walking。
[ ] grooming 中双击 happy 可以切到 happy。
[ ] random behavior 不会打断 grooming。
[ ] inactivity sleep 不会在 grooming 中触发。
```

## I4. 回归验收

```text
[ ] npm start 正常。
[ ] TypeScript 无错误。
[ ] idle 正常。
[ ] dragging 正常。
[ ] happy 正常。
[ ] sleeping 正常。
[ ] walk_left / walk_right 正常。
[ ] 右键菜单正常。
[ ] 托盘菜单正常。
[ ] 设置面板正常。
[ ] 随机行为正常。
[ ] settings persistence 正常。
[ ] 透明窗口正常。
[ ] Renderer console 无 runtime error。
[ ] Main process terminal 无 runtime error。
```

---

# Part J：Agent 执行 Prompt

```text
We need to implement MochiCat Phase 13: Add Grooming Action State.

Current context:
- The app is stable.
- Existing states:
  - idle
  - dragging
  - happy
  - sleeping
  - walk_left
  - walk_right
- New state to add:
  - grooming
- Grooming means the cat sits, raises one front paw, licks the paw, wipes its face, then returns to idle.

User has placed 4 new grooming source images in the project root:
- grooming_000
- grooming_001
- grooming_002
- grooming_003

These source images are likely not true transparent PNGs. They must be processed into standard transparent-background RGBA PNGs before integration.

Part 1 - Locate and process grooming assets:
- Find grooming_000.*, grooming_001.*, grooming_002.*, grooming_003.* in the project root.
- Allowed source extensions: png, jpg, jpeg, webp.
- Convert each to true RGBA PNG.
- Remove background if needed.
- Remove fake checkerboard / white / gray / black background if present.
- Remove any top gray gradient band or semi-transparent rectangular background.
- Preserve the cat, pose, color, style, proportions, whiskers, ears, paws, and tail.
- Do not redraw the cat.
- Do not overwrite root source files.
- Stage processed files under processed_assets/cat/grooming/.
- Then copy verified files to:
  src/assets/cat/grooming/grooming_000.png
  src/assets/cat/grooming/grooming_001.png
  src/assets/cat/grooming/grooming_002.png
  src/assets/cat/grooming/grooming_003.png

Generate:
- processed_assets/grooming_asset_report.txt
- processed_assets/previews/grooming_on_black.png
- processed_assets/previews/grooming_on_green.png
- processed_assets/previews/grooming_on_magenta.png
- processed_assets/previews/grooming_on_blue.png

Part 2 - Add PetState:
Update src/types/pet.ts:
- Add 'grooming' to PetState.
- Add grooming to PET_STATE_EMOJI.

Part 3 - Add animationConfig:
Update src/animation/animationConfig.ts:
- Add grooming000 / grooming001 / grooming002 / grooming003 URLs.
- Add:
  grooming: {
    fps: 5,
    loop: false,
    frames: [grooming000, grooming001, grooming002, grooming003],
  }

Part 4 - Add triggerGrooming:
In App.tsx or the current state controller:
- Add groomingTimerRef.
- Add clearGroomingTimer().
- Add triggerGrooming(reason).
- triggerGrooming should:
  - do nothing if currently dragging
  - clear happy timer
  - clear previous grooming timer
  - mark user interaction
  - set petStateRef.current = 'grooming'
  - setPetState('grooming')
  - update enteredStateAtRef
  - set a timer for the grooming duration
  - timer callback must check petStateRef.current === 'grooming' before returning to idle
  - after returning to idle, reset inactivity timer

Grooming duration:
- 4 frames at 5 fps = 800ms.
- Add a small buffer.
- Recommended GROOMING_DURATION_MS = 1100 to 1400ms.
- If you can compute from animationConfig, do that. Otherwise use a clear constant.

Part 5 - Timer cleanup and state safety:
- Clear grooming timer on unmount.
- Clear grooming timer when entering dragging, happy, sleeping, walk_left, walk_right, or other explicit user action.
- Inactivity timer must not force sleeping while petState is grooming.
- Random behavior must not interrupt grooming.
- Timed callbacks must never override a newer state.

Part 6 - Context menu:
Add a right-click menu item:
- “洗洗脸” or “舔爪洗脸”
It should send a menu action such as:
- grooming

Handle that action in renderer:
- call triggerGrooming('context-menu')

If tray menu contains action items, optionally add grooming there too. Context menu is required.

Part 7 - Optional random behavior:
If current random behavior is clean and configurable:
- Add grooming as a low-frequency random behavior.
- Only auto-trigger grooming when current state is idle.
- randomBehaviorEnabled=false disables automatic grooming.
- autoWalkEnabled must not affect grooming; autoWalkEnabled only controls automatic walking.
- Add a grooming cooldown so it does not occur too often.

If this makes the phase too large, implement manual context-menu grooming first and leave random grooming as optional.

Part 8 - Do not break existing features:
Preserve:
- manual dragging
- click / double-click happy
- sleeping / wake
- walk_left / walk_right
- random behavior
- walking movement
- context menu
- tray menu
- settings panel
- settings persistence
- transparent frameless window

Do not reintroduce:
- window snap
- Perch Mode
- external window detection

Validation:
1. npm start works.
2. TypeScript has no errors.
3. grooming assets are true RGBA PNG.
4. grooming assets have no fake background, checkerboard, white/gray/black background, or top gray line.
5. PetState includes grooming.
6. animationConfig includes grooming.
7. right-click menu shows “洗洗脸” or “舔爪洗脸”.
8. Selecting it plays grooming.
9. Grooming plays once and returns to idle.
10. Dragging during grooming interrupts grooming.
11. Right-click sleep during grooming switches to sleeping.
12. Right-click walk left/right during grooming switches to walking.
13. Double-click during grooming can trigger happy if current interaction design allows it.
14. Random behavior does not interrupt grooming.
15. Inactivity sleep does not interrupt grooming.
16. idle/happy/sleeping/walking still work.
17. settings panel still works.
18. tray and context menu still work.
19. renderer console has no runtime errors.
20. main process terminal has no runtime errors.

Before coding:
1. Inspect src/types/pet.ts.
2. Inspect src/animation/animationConfig.ts.
3. Inspect src/hooks/useAnimation.ts.
4. Inspect App.tsx state/timer handling.
5. Inspect context menu and tray menu action flow.
6. Locate root grooming_000/001/002/003 source files.
7. Explain the implementation plan.
8. Then implement.

After coding:
1. List processed grooming files.
2. Summarize grooming_asset_report.txt.
3. List changed code files.
4. Explain how grooming state is represented.
5. Explain how grooming returns to idle.
6. Explain how grooming timer avoids overriding newer states.
7. Confirm existing features still work.
```

---

## Phase 13 完成后的提交建议

```bash
git status
git add .
git commit -m "feat: add grooming action state"
```
