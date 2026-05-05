# MochiCat Phase 15 Prompt：自动化回归测试、工程质量基线与文档收口

## 任务标题

MochiCat Phase 15 - Testing, Regression Safety, and Developer Documentation

## 背景

当前 MochiCat 已经完成到 Phase 14，项目不再是早期原型，而是一个已经具备完整桌宠基线能力的 Electron + React + TypeScript macOS 桌面宠物应用。

当前已完成能力包括：

```text
- 透明 frameless always-on-top 桌宠窗口
- idle / dragging / happy / sleeping / walk_left / walk_right / grooming
- 帧动画系统
- 自定义拖拽
- 双击 happy
- inactivity sleeping
- 原生右键菜单
- 系统托盘菜单
- settings panel
- settings.json 持久化
- random behavior
- auto walking
- grooming 动作
- 统一 action orchestration / state machine controller
- 素材透明化处理脚本
- processed_assets 诊断报告与预览图
```

Phase 14 已完成动作系统统一化后，当前最需要补齐的不是新功能，而是：

```text
1. 自动化回归测试
2. 工程质量命令
3. 资产验证流程
4. 文档总入口
5. 抽象字段与遗留代码收口
```

Phase 15 的目标是把 MochiCat 从“功能完整、主要靠手测稳定”推进到“可持续迭代、可自动验证、不容易被后续 agent 改坏”的工程基线。

---

## 当前仓库关键事实

当前 `package.json` 已有：

```json
{
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "publish": "electron-forge publish",
    "lint": "eslint --ext .ts,.tsx ."
  }
}
```

但当前缺少稳定的：

```text
typecheck
test
test:assets
validate
```

当前仓库也未见完整自动化测试体系，例如：

```text
Vitest
Jest
React Testing Library
Playwright
Electron E2E
CI
```

当前 spec 很丰富，但缺少面向开发者的常驻入口文档，例如：

```text
README.md
docs/ARCHITECTURE.md
docs/ACTION_SYSTEM.md
docs/ASSET_PIPELINE.md
docs/TESTING.md
docs/REGRESSION_CHECKLIST.md
```

因此 Phase 15 应集中解决这些问题。

---

## Phase 15 总目标

```text
1. 建立可运行的自动化测试体系。
2. 为 action controller / random behavior / settings / walking / assets 建立核心回归测试。
3. 新增 npm scripts：typecheck / test / test:assets / validate。
4. 建立资产验证脚本，确保 runtime assets 真透明、存在、无顶部灰线、无假透明背景。
5. 收口 Phase 14 后遗留的抽象字段和旧组件。
6. 新增开发者文档，明确当前架构、运行方式、测试方式、素材流水线、动作系统、历史废弃功能。
7. 建立手动回归 checklist，便于后续每个 phase 修改后快速验证。
8. 不新增用户可见新功能，不新增新动画状态。
```

---

## 本阶段不要做什么

不要新增：

```text
- stretching / yawning / paw_raise / loaf
- 新图片素材
- AI 对话
- 音效
- 多宠物
- 多皮肤
- 外部窗口吸附 / Perch Mode
- 外部窗口检测
- 复杂物理
- 云同步
- 自动更新
```

不要破坏：

```text
- idle
- dragging
- happy
- sleeping
- walk_left
- walk_right
- grooming
- manual dragging
- double-click happy
- right-click menu
- tray menu
- settings panel
- random behavior
- walking movement
- settings persistence
- transparent frameless window
- asset processing scripts
```

Electron 安全要求保持不变：

```text
contextIsolation: true
nodeIntegration: false
不要暴露 raw ipcRenderer
```

---

# Part A：建立测试工具链

## A1. 选择测试框架

推荐使用：

```text
Vitest
```

理由：

```text
1. 当前项目已经使用 Vite。
2. Vitest 与 Vite / TypeScript / React 兼容性好。
3. 适合测试 hooks、纯函数、settings migration、action registry。
4. 比搭建 Electron E2E 更轻量，适合作为 Phase 15 的第一步。
```

如果需要测试 React 组件，可加入：

```text
@testing-library/react
@testing-library/jest-dom
jsdom
```

最低要求：

```text
先建立 Vitest + TypeScript 单元测试体系。
不要一开始就做复杂 Electron E2E。
```

## A2. 安装建议依赖

Agent 应根据当前 package manager 判断使用 npm / yarn / pnpm。当前可默认 npm。

建议：

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

如果暂时不做 React 组件测试，最低可只装：

```bash
npm install -D vitest
```

## A3. 新增配置

可新增：

```text
vitest.config.ts
```

建议配置：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

## A4. 新增 npm scripts

修改 `mochi-cat/package.json`。

建议新增：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:assets": "python ../tools/validate_runtime_assets.py",
    "validate": "npm run typecheck && npm run lint && npm run test && npm run test:assets"
  }
}
```

注意路径：

```text
package.json 位于 mochi-cat/
tools/ 位于项目根目录 tools/
所以从 mochi-cat 目录执行时，asset script 路径通常是 ../tools/...
```

Agent 必须确认实际仓库路径，不要盲写。

---

# Part B：测试 action registry 和 action controller

## B1. actionRegistry 测试

新增测试：

```text
src/actions/actionRegistry.test.ts
```

测试内容：

```text
1. 每个 PetState 都有 action definition。
2. 每个 action definition 的 state 与 key 一致。
3. idle / sleeping 是 persistent。
4. happy / grooming 是 oneShot。
5. walk_left / walk_right 是 locomotion。
6. dragging 是 interactionOverride。
7. oneShot action 必须有 defaultDurationMs 和 returnState。
8. locomotion action 不应有 oneShot duration。
9. dragging 不允许 random trigger。
```

## B2. usePetActionController 测试

新增测试：

```text
src/hooks/usePetActionController.test.tsx
```

重点测试状态机逻辑，而不是 UI。

需要使用 fake timers：

```ts
vi.useFakeTimers();
```

必须覆盖：

```text
1. 初始状态是 idle。
2. dispatch happy 后进入 happy。
3. happy timer 到期后回 idle。
4. dispatch grooming 后进入 grooming。
5. grooming timer 到期后回 idle。
6. happy -> grooming 时，旧 happy timer 不会覆盖 grooming。
7. grooming -> walk_right 时，旧 grooming timer 不会覆盖 walking。
8. walking completed 后回 idle。
9. inactivity timer 只能从 idle 进入 sleeping。
10. inactivity timer 不能打断 happy。
11. inactivity timer 不能打断 grooming。
12. inactivity timer 不能打断 walking。
13. dragging 时 random/menu 行为按设计被拒绝或 force 控制。
14. random action 不能打断 oneShot。
15. random action 不能打断 locomotion。
16. menu action 可以打断 oneShot/locomotion/sleeping，除 dragging 外。
```

## B3. action token stale timer 测试

这是 Phase 15 的重点。

必须验证：

```text
旧 timer 不会覆盖新状态。
```

测试场景：

```text
1. dispatch happy。
2. 在 happy timer 到期前 dispatch walk_right。
3. advanceTimers 到 happy duration 后。
4. 状态仍应是 walk_right，而不是 idle。

1. dispatch grooming。
2. 在 grooming timer 到期前 dispatch sleeping。
3. advanceTimers 到 grooming duration 后。
4. 状态仍应是 sleeping，而不是 idle。
```

这类测试必须存在。

---

# Part C：测试 random behavior

## C1. useRandomBehavior 测试

新增：

```text
src/hooks/useRandomBehavior.test.ts
```

如果 hook 难以直接测，可以将行为选择逻辑提取成纯函数：

```text
src/hooks/randomBehaviorPolicy.ts
```

测试纯函数：

```text
selectRandomBehavior(...)
canRunRandomBehavior(...)
getBehaviorWeights(...)
```

## C2. 必测逻辑

```text
1. randomBehaviorEnabled=false 时不触发任何随机行为。
2. autoWalkEnabled=false 时不选择 walk_left / walk_right。
3. autoWalkEnabled=false 不影响 happy / grooming / sleep / wake。
4. 设置面板打开时不触发随机行为。
5. 窗口隐藏时不触发随机行为。
6. 最近用户交互 cooldown 未结束时不触发。
7. manualActionCooldownUntilRef 未结束时不触发。
8. 当前状态是 happy/grooming/walking/dragging 时不触发随机行为。
9. sleeping 状态可以选择 wakeUp，但不能选择 walking。
10. idle 状态可以选择 happy/grooming/walking/sleep。
```

---

# Part D：测试 settings migration / clamp

## D1. 当前 settings 系统测试

新增：

```text
src/main/settings.test.ts
```

如果 main settings 模块与 Electron app path 强耦合，需要先提取纯函数，例如：

```text
normalizeSettings
clampSettings
migrateSettings
DEFAULT_SETTINGS
```

放在可测试文件中：

```text
src/main/settingsSchema.ts
```

或当前 settings 文件中导出纯函数。

## D2. 必测内容

```text
1. 旧 settings 只有 petSize 枚举时可以迁移到 petSizePx。
2. 缺少新字段时会补默认值。
3. petSizePx 被 clamp 到合法范围。
4. walkingSpeedPxPerSecond 被 clamp 到合法范围。
5. walkingDurationMinMs / MaxMs 范围正确。
6. walkingDurationMinMs <= walkingDurationMaxMs。
7. sleepAfterIdleMs 可以为 null 或 0 表示禁用。
8. behaviorFrequency 非法值会回到 normal。
9. alwaysOnTop / speechBubbleEnabled / randomBehaviorEnabled / autoWalkEnabled 类型错误时回默认值。
10. reset settings 返回 DEFAULT_SETTINGS。
```

---

# Part E：测试 walking movement 可测试部分

`useWalkingMovement` 涉及 Electron window IPC 和 requestAnimationFrame，不必一开始做完整 E2E，但应至少测试可提取的边界计算。

## E1. 提取纯函数

建议新增：

```text
src/hooks/walkingMovementPolicy.ts
```

包含：

```ts
computeWalkTarget(...)
clampToWorkArea(...)
shouldStopAtBoundary(...)
normalizeWalkingDuration(...)
```

## E2. 必测内容

```text
1. walk_right 不会超过 workArea right。
2. walk_left 不会超过 workArea left。
3. windowWidth 使用真实 bounds.width，而不是硬编码 300。
4. walkingDurationMinMs <= walkingDurationMaxMs。
5. duration 随机范围合法。
6. 速度小于等于 0 时使用默认值或 clamp。
```

---

# Part F：资产验证脚本

## F1. 新增 runtime asset validator

新增：

```text
tools/validate_runtime_assets.py
```

该脚本必须从 runtime 真相出发，而不是只扫 processed_assets。

它应检查：

```text
mochi-cat/src/assets/cat/
```

以及可选解析：

```text
mochi-cat/src/animation/animationConfig.ts
```

最低检查：

```text
1. 所有 animationConfig 引用的 PNG 文件真实存在。
2. 所有 runtime PNG 都是 RGBA 或带 alpha。
3. 不允许 checkerboard fake background。
4. 不允许白底 / 灰底 / 黑底大面积背景。
5. 不允许顶部横向灰色 band。
6. alpha bounding box 不应贴边。
7. 每个状态的帧尺寸应一致。
8. 每个状态至少 1 帧。
9. oneShot / loop 配置不在此脚本强制，但可以报告。
```

输出：

```text
processed_assets/runtime_asset_validation_report.txt
```

如果失败：

```text
脚本 exit code 必须非 0。
```

这使 `npm run test:assets` 能真正阻止坏素材进入运行时。

## F2. asset validation 报告字段

每个文件输出：

```text
state
filename
exists
image size
mode
has alpha
transparent pixel ratio
alpha bbox
edge touching
top band suspected
checkerboard suspected
large background suspected
pass/fail
```

最后输出 summary：

```text
total files
passed
failed
warnings
```

## F3. asset validation 不应破坏文件

此脚本只做检查，不做修改。清理素材仍由已有工具完成：

```text
clean_cat_asset_alpha.py
remove_checkerboard_background.py
replace_walking_assets.py
prepare_grooming_assets.py
```

---

# Part G：收口未使用或预留抽象字段

Phase 15 必须对以下字段做审计：

```text
PetActionRequest.force
PetActionDefinition.blocksRandomBehavior
ActionTriggerSource.tray
RandomBehaviorName
SizeSliderPanel
PET_STATE_EMOJI
DEBUG_STATE_MACHINE
DEBUG_ACTIONS
DEBUG_TIMERS
```

## G1. 处理原则

每一项必须选择一个结论：

```text
1. 已被运行时代码实际使用。
2. 应该删除。
3. 暂时保留，但必须在注释中说明 reserved for future use。
```

不要让字段处于“看起来有用，但实际无人消费”的状态。

## G2. force 字段

如果 `force` 的设计目标是让 menu/manual action 打断当前状态，则必须在 dispatcher 中明确消费。

例如：

```text
force=true:
- menu action 可以打断 oneShot / locomotion / sleeping
- 但不能打断 dragging
```

如果实际所有 menu action 都已经天然具备该行为，则可以删除 `force`，避免误导。

## G3. blocksRandomBehavior 字段

如果保留，应让 random behavior 判断读取 action registry：

```text
当前 state 的 actionDefinition.blocksRandomBehavior === true
=> random behavior 不触发
```

如果 random behavior 已经用硬编码状态列表实现，也可以改为读取 registry，减少重复定义。

---

# Part H：开发者文档

新增或更新以下文档。

## H1. README.md

位置：

```text
README.md
```

必须包含：

```text
1. MochiCat 是什么。
2. 当前技术栈。
3. 如何安装依赖。
4. 如何启动开发环境。
5. 如何运行 lint / typecheck / test / validate。
6. 如何添加新动作。
7. 如何处理新图片素材。
8. 当前支持的状态。
9. 明确 Perch Mode / window snap 是历史废弃方向，不是当前功能。
10. 项目目录说明。
```

## H2. docs/ARCHITECTURE.md

必须说明：

```text
1. Main / Preload / Renderer 三层职责。
2. IPC 安全边界。
3. settings persistence 流程。
4. menu / tray action flow。
5. renderer 如何控制状态但不直接使用 Node。
```

## H3. docs/ACTION_SYSTEM.md

必须说明：

```text
1. PetState。
2. ActionKind。
3. actionRegistry。
4. dispatchPetAction。
5. action token stale timer protection。
6. oneShot / locomotion / persistent / interactionOverride 的差异。
7. 如何新增 stretching 这类 oneShot action。
8. 如何新增新的 locomotion action。
```

## H4. docs/ASSET_PIPELINE.md

必须说明：

```text
1. 原始素材应放哪里。
2. processed_assets 是什么。
3. runtime assets 在哪里。
4. 如何处理新动作素材。
5. 如何处理 fake transparent background。
6. 如何运行 asset validation。
7. 如何生成多底色预览。
8. 不要直接把未经处理的图片放入 src/assets/cat/。
```

## H5. docs/TESTING.md

必须说明：

```text
1. 测试框架。
2. 如何运行 npm run test。
3. 如何运行 npm run test:assets。
4. 如何运行 npm run validate。
5. 哪些逻辑被单元测试覆盖。
6. 哪些仍需要手动测试。
```

## H6. docs/REGRESSION_CHECKLIST.md

必须列出手动验收清单：

```text
启动 app
拖拽
顶部区域拖拽
单击 / 双击
右键菜单
托盘菜单
settings panel
尺寸调整
always-on-top
speech bubble on/off
random behavior on/off
auto walk on/off
idle -> sleeping
sleeping -> wake
sleeping -> wake -> walk
happy -> grooming
grooming -> walk
walk_left -> walk_right
dragging 打断 oneShot
walking 边界
透明背景
顶部灰线
settings 持久化
重启后设置恢复
```

---

# Part I：package metadata 收口

当前 `package.json` 中：

```json
"description": "My Electron application description"
```

应改为真实描述，例如：

```json
"description": "A lightweight macOS desktop pet app featuring a custom animated cat."
```

也可以补充：

```json
"keywords": ["electron", "desktop-pet", "react", "typescript", "macos"]
```

不要改变 package name / productName，除非用户明确要求。

---

# Part J：可选 CI

如果项目还没有 CI，本阶段可以新增 GitHub Actions：

```text
.github/workflows/validate.yml
```

运行：

```text
npm ci
npm run validate
```

注意路径：

```text
如果 package.json 在 mochi-cat/，workflow 需要 working-directory: mochi-cat。
```

CI 是可选项。如果 agent 判断当前阶段过大，可以先不加 CI，但必须在文档中说明后续建议。

---

# Part K：验收标准

## K1. 命令验收

```text
[ ] npm run typecheck 可运行。
[ ] npm run lint 可运行。
[ ] npm run test 可运行。
[ ] npm run test:assets 可运行。
[ ] npm run validate 可运行。
[ ] validate 会串联 typecheck / lint / test / test:assets。
```

## K2. 测试验收

```text
[ ] actionRegistry 有测试。
[ ] usePetActionController 或其核心逻辑有测试。
[ ] stale timer 防护有测试。
[ ] random behavior policy 有测试。
[ ] settings migration / clamp 有测试。
[ ] walking movement policy 有测试或至少有可测试纯函数。
```

## K3. 资产验证验收

```text
[ ] validate_runtime_assets.py 存在。
[ ] test:assets 会运行该脚本。
[ ] 报告输出到 processed_assets/runtime_asset_validation_report.txt。
[ ] 如果 runtime PNG 不存在或非 true-transparent，脚本会 fail。
[ ] 如果检测到顶部灰线 / fake checkerboard，脚本会 fail 或至少 warning 并按规则返回非 0。
```

## K4. 文档验收

```text
[ ] README.md 存在并说明项目当前状态。
[ ] docs/ARCHITECTURE.md 存在。
[ ] docs/ACTION_SYSTEM.md 存在。
[ ] docs/ASSET_PIPELINE.md 存在。
[ ] docs/TESTING.md 存在。
[ ] docs/REGRESSION_CHECKLIST.md 存在。
[ ] 文档明确 Perch Mode / window snap 已废弃，不是当前功能。
```

## K5. 抽象字段收口验收

```text
[ ] force 字段已使用 / 删除 / 注释说明。
[ ] blocksRandomBehavior 已使用 / 删除 / 注释说明。
[ ] RandomBehaviorName 已使用 / 删除 / 注释说明。
[ ] SizeSliderPanel 遗留角色已清楚。
[ ] PET_STATE_EMOJI 是否保留有明确理由。
[ ] debug flags 已统一或清理。
```

## K6. 功能回归验收

```text
[ ] npm start 正常。
[ ] idle 正常。
[ ] dragging 正常。
[ ] happy 正常。
[ ] sleeping 正常。
[ ] grooming 正常。
[ ] walk_left / walk_right 正常。
[ ] random behavior 正常。
[ ] settings panel 正常。
[ ] right-click menu 正常。
[ ] tray menu 正常。
[ ] settings persistence 正常。
[ ] transparent window 正常。
[ ] renderer console 无 runtime error。
[ ] main process terminal 无 runtime error。
```

---

# Part L：Agent 执行 Prompt

```text
We need to implement MochiCat Phase 15: Testing, Regression Safety, and Developer Documentation.

Current context:
- Phase 14 is complete.
- The app has a mature runtime baseline:
  - idle
  - dragging
  - happy
  - sleeping
  - walk_left
  - walk_right
  - grooming
- The app has:
  - Electron + React + TypeScript + Vite
  - transparent frameless window
  - right-click menu
  - tray menu
  - settings panel
  - settings persistence
  - random behavior
  - walking movement
  - action registry
  - usePetActionController
  - asset processing scripts
- The main current weakness is lack of automated tests, validation scripts, developer documentation, and cleanup of a few reserved/unused abstraction fields.

Do not add new user-facing features.
Do not add new animation states.
Do not reintroduce Perch Mode / window snap.

Part 1 - Add testing framework:
- Add Vitest.
- Add jsdom if needed.
- Add Testing Library only if useful for hooks/components.
- Add vitest config.

Part 2 - Add package scripts:
Update mochi-cat/package.json:
- typecheck: tsc --noEmit
- test: vitest run
- test:watch: vitest
- test:assets: python ../tools/validate_runtime_assets.py
- validate: npm run typecheck && npm run lint && npm run test && npm run test:assets

Ensure paths are correct from mochi-cat/.

Part 3 - Test actionRegistry:
Add tests ensuring:
- every PetState has a definition
- action kind classifications are correct
- oneShot actions have defaultDurationMs and returnState
- dragging cannot be randomly triggered
- locomotion actions are walk_left/walk_right

Part 4 - Test usePetActionController or extracted core logic:
Add tests for:
- idle initial state
- happy -> idle after timer
- grooming -> idle after timer
- happy timer cannot override walking
- grooming timer cannot override sleeping/walking
- inactivity timer only sleeps from idle
- random actions cannot interrupt oneShot or locomotion
- menu/manual actions can interrupt oneShot/locomotion/sleeping except dragging
- sleeping -> wake -> walk still works
- dragging interrupts active actions

Use fake timers.

Part 5 - Test random behavior policy:
If useRandomBehavior is hard to test directly, extract pure policy functions.
Test:
- randomBehaviorEnabled=false disables automatic behavior
- autoWalkEnabled=false disables only automatic walking
- settings panel open disables random behavior
- hidden window disables random behavior
- recent interaction cooldown disables random behavior
- manual action cooldown disables random behavior
- current oneShot/locomotion/dragging blocks random behavior

Part 6 - Test settings migration and clamp:
Extract or test pure functions for settings normalization.
Test:
- old petSize enum migrates to petSizePx
- missing fields get defaults
- invalid behaviorFrequency returns normal
- petSizePx clamps
- walkingSpeed clamps
- walking duration min/max normalizes
- sleepAfterIdleMs supports disabled state
- reset returns default settings

Part 7 - Test walking movement policy:
Extract pure walking policy helpers if needed.
Test:
- walk_right target does not exceed right workArea boundary
- walk_left target does not exceed left boundary
- real window bounds width is used, not hardcoded 300
- duration and speed are clamped or normalized

Part 8 - Add runtime asset validation:
Create:
tools/validate_runtime_assets.py

It should inspect mochi-cat/src/assets/cat/ runtime assets and animationConfig references.

Validate:
- referenced files exist
- PNG has alpha
- no fake checkerboard background
- no large white/gray/black background
- no top gray horizontal band
- alpha bbox not touching edges
- frame dimensions are consistent per state

Output:
processed_assets/runtime_asset_validation_report.txt

On failure, exit non-zero.

Part 9 - Audit reserved/unused abstraction fields:
Audit:
- PetActionRequest.force
- PetActionDefinition.blocksRandomBehavior
- ActionTriggerSource.tray
- RandomBehaviorName
- SizeSliderPanel
- PET_STATE_EMOJI
- DEBUG_STATE_MACHINE / DEBUG_ACTIONS / DEBUG_TIMERS

For each:
- use it
- delete it
- or add a comment explaining it is intentionally reserved

Part 10 - Add developer documentation:
Create or update:
- README.md
- docs/ARCHITECTURE.md
- docs/ACTION_SYSTEM.md
- docs/ASSET_PIPELINE.md
- docs/TESTING.md
- docs/REGRESSION_CHECKLIST.md

README should explain:
- project purpose
- tech stack
- install
- start
- test
- validate
- current states
- how to add a new action
- how to process assets
- Perch Mode / window snap is historical and removed

Part 11 - Update package metadata:
Change placeholder description:
"My Electron application description"
to a real description.

Add useful keywords if appropriate.

Part 12 - Optional CI:
If time allows, add GitHub Actions workflow:
.github/workflows/validate.yml
Run npm ci and npm run validate with working-directory mochi-cat.
If skipped, mention CI as future work in docs.

Validation:
1. npm run typecheck works.
2. npm run lint works.
3. npm run test works.
4. npm run test:assets works.
5. npm run validate works.
6. action registry tests pass.
7. action controller tests pass or extracted core tests pass.
8. random behavior policy tests pass.
9. settings migration/clamp tests pass.
10. walking policy tests pass.
11. runtime asset validation report is generated.
12. README exists.
13. ARCHITECTURE doc exists.
14. ACTION_SYSTEM doc exists.
15. ASSET_PIPELINE doc exists.
16. TESTING doc exists.
17. REGRESSION_CHECKLIST doc exists.
18. Perch Mode is documented as removed/historical.
19. package description is no longer placeholder.
20. Existing app still starts and behaves normally.

Before coding:
1. Inspect package.json.
2. Inspect existing tsconfig/vite config.
3. Inspect actionRegistry/usePetActionController.
4. Inspect useRandomBehavior.
5. Inspect useWalkingMovement.
6. Inspect settings code.
7. Inspect tools directory.
8. Inspect docs/spec structure.
9. List files to create/modify.
10. Explain testing strategy.
11. Then implement.

After coding:
1. List changed files.
2. List new tests.
3. Explain how to run validation.
4. Summarize asset validation behavior.
5. Summarize documentation added.
6. Explain what abstraction fields were used/deleted/reserved.
7. Confirm all existing features still work.
```

---

## Phase 15 完成后的提交建议

```bash
git status
git add .
git commit -m "chore: add regression tests and developer documentation"
```
