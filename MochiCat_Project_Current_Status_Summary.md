# MochiCat 项目当前状态总览

更新时间：2026-05-03

本文件基于当前仓库代码、spec 目录中的阶段文档、以及 processed_assets 下的资产检查报告整理而成。它的目标不是重复开发日志，而是提供一份可直接交给其他 LLM 继续做产品规划、技术评估、路线设计的高可信项目快照。

---

## 1. 一句话结论

MochiCat 当前已经不是一个早期原型，而是一个完成到 Phase 14 的、可运行的 macOS 桌面宠物应用基线：

- 使用 Electron + React + TypeScript + Vite。
- 已具备透明无边框置顶窗口、拖拽、帧动画、菜单与托盘、设置持久化、随机行为、自动走路、grooming 动作、统一动作调度等完整桌宠能力。
- 当前核心架构已经从早期的 App.tsx 直接堆叠状态，演进为“动作注册表 + 状态控制器 + 行为 hook”的形式。
- 历史上曾设计过窗口吸附 / Perch Mode，但该能力已在后续阶段被明确移除，当前运行时代码中不存在该功能。
- 项目最大的现实短板不是功能缺失，而是自动化测试、文档、以及少量“已预留但未完全消费”的抽象元数据仍不完善。

---

## 2. 项目定位与边界

### 2.1 当前产品定位

MochiCat 是一个面向 macOS 桌面的透明悬浮宠物应用。它使用真实猫咪素材生成的逐帧 PNG 动画，在桌面上长期驻留，并以低打扰、轻自主、可交互的方式模拟一只“会待机、会睡觉、会开心、会走路、会洗脸”的小猫。

### 2.2 当前已明确不在实现范围内的方向

以下能力在 spec 中多次被明确排除，当前仓库中也没有实现：

- LLM 聊天或 AI 对话系统
- 音效系统
- 多宠物系统
- 多皮肤 / 主题系统
- 复杂物理、碰撞、重力、路径规划
- 云同步、账号体系、自动更新
- 完整跨平台行为适配
- 外部窗口吸附 / Perch Mode 运行时代码

### 2.3 一个重要事实

初始规格曾把 Zustand 列为推荐技术路线的一部分，但当前真实实现并没有使用 Zustand 或其他全局状态库，主要依赖 React state、refs、hook 和 preload IPC 完成状态组织。这说明项目后续设计评估应以“当前代码事实”为准，而不是以最初技术建议为准。

---

## 3. 仓库结构与职责分层

当前工作区最外层目录可理解为“四层结构”：

### 3.1 运行时代码

`mochi-cat/`

这是 Electron 应用本体，包含主进程、预加载脚本、React 渲染层、运行时资源、配置文件。

### 3.2 原始输入素材

`image_src/`

用于保存更原始的图像来源，当前没有直接参与运行时加载。

### 3.3 处理中间产物与验证报告

`processed_assets/`

这是一个非常重要的“资产流水线输出区”，用于保存：

- 清理后的 PNG
- 老 walking 资产归档
- 透明度与边界检查报告
- 黑/绿/洋红/蓝底预览图

它不是运行时资源根目录，但对理解当前视觉质量状态非常关键。

### 3.4 规格与开发历史

`spec/`

这里按 Phase 0 到 Phase 14 保存了详细任务文档，同时还包含单独的 bug fix prompt。它是项目演进意图的历史档案，但不是当前功能真相的唯一来源。

### 3.5 资产处理工具

`tools/`

这里放了多份 Python 脚本，用于把根目录原始图片转换为真正可运行的透明 PNG，并生成诊断报告。

---

## 4. 实际技术栈

### 4.1 前端 / 桌面栈

- Electron 41.3.0
- React 19.2.x
- React DOM 19.2.x
- TypeScript 4.5.x
- Vite 5.4.x
- Electron Forge 7.11.x

### 4.2 打包与发布配置

当前 package.json 和 forge.config.ts 已配置：

- `electron-forge start`
- `electron-forge package`
- `electron-forge make`
- `electron-forge publish`
- maker-squirrel
- maker-zip
- maker-rpm
- maker-deb

这说明工程层面保留了多平台打包模板，但产品和规格的真实目标平台仍然是 macOS。也就是说，“构建配置支持多平台”不等于“产品行为已对多平台验证”。

### 4.3 代码质量与检查工具

- ESLint 已接入
- 规则较基础，主要覆盖 TypeScript 和 import
- 没有发现自动化测试文件
- 没有看到 CI、Vitest、Jest、Playwright 或 E2E 方案

### 4.4 资产处理工具链

Python 脚本依赖包括：

- Pillow
- NumPy
- SciPy

这些脚本主要用于透明背景清理、walking 替换、grooming 接入、边界检查和伪透明诊断。

---

## 5. 运行时架构总览

当前架构非常清晰，可归纳为三层：

```text
Electron Main Process
  ├─ 创建 BrowserWindow
  ├─ 管理 Tray 与原生 Menu
  ├─ 处理窗口拖拽 IPC 与位置查询
  ├─ 处理 settings.json 持久化
  └─ 将原生菜单动作广播给 Renderer

Electron Preload
  └─ 通过 contextBridge 暴露受限 API 到 window.mochiCat

React Renderer
  ├─ App.tsx 作为交互总装层
  ├─ usePetActionController 作为统一动作状态机
  ├─ useRandomBehavior 作为轻量自主行为调度器
  ├─ useWalkingMovement 作为窗口级移动执行器
  ├─ useAnimation 作为帧播放器
  ├─ PetSprite / SpeechBubble / SettingsPanel 作为 UI 层
  └─ animationConfig / actionRegistry / pet types 作为共享定义层
```

### 5.1 主进程职责

主进程不是宠物状态机本身，而是“窗口与系统壳层控制中心”。当前它负责：

- 创建 300 x 300 的透明、无边框、不可缩放、跳过任务栏、默认置顶窗口
- 设置 `contextIsolation: true` 和 `nodeIntegration: false`
- 管理系统托盘与托盘菜单
- 构建宠物右键原生菜单
- 保存与读取 settings.json
- 处理拖拽开始 / 移动 / 结束
- 提供窗口位置、工作区、边界查询
- 将设置变化和窗口可见性变化广播给渲染层

### 5.2 预加载层职责

预加载层很克制，当前只暴露四类安全 API：

- `window.mochiCat.window.*`
- `window.mochiCat.menu.*`
- `window.mochiCat.pet.*`
- `window.mochiCat.settings.*`

这意味着渲染层完全不直接接触 Electron 主进程对象，也不直接持有 raw ipcRenderer，安全边界是正确的。

### 5.3 渲染层职责

渲染层负责：

- 宠物状态与动作编排
- 用户输入事件处理
- 动画帧播放
- 气泡文本显示
- 设置面板 UI
- 随机行为调度
- walking 时的窗口移动触发

当前设计中，“主进程控制系统壳和窗口”，“渲染层控制宠物行为与视觉反馈”，边界是合理的。

---

## 6. 安全模型

当前项目在 Electron 安全模型上是合格的，关键点如下：

- `contextIsolation: true`
- `nodeIntegration: false`
- 通过 preload `contextBridge.exposeInMainWorld` 暴露白名单 API
- 渲染层通过全局类型声明得到 `window.mochiCat` 的强类型接口
- 没有把 `ipcRenderer` 原始对象直接暴露给前端

这意味着后续如果要加更多系统能力，建议延续当前模式，不要回退到在 renderer 中直接访问 Node.js。

---

## 7. 状态系统与动作编排

### 7.1 当前 PetState

当前运行时真实存在的宠物状态只有 7 个：

- `idle`
- `dragging`
- `happy`
- `sleeping`
- `walk_right`
- `walk_left`
- `grooming`

### 7.2 当前动作分类

Phase 14 之后，动作系统被明确分成四类：

- `persistent`
- `oneShot`
- `locomotion`
- `interactionOverride`

对应关系如下：

| 状态 | 类型 | 说明 |
| --- | --- | --- |
| idle | persistent | 默认待机 |
| sleeping | persistent | 睡眠，不自动结束 |
| happy | oneShot | 一次性动作，结束后回 idle |
| grooming | oneShot | 一次性动作，结束后回 idle |
| walk_left / walk_right | locomotion | 带窗口位移的动作 |
| dragging | interactionOverride | 用户拖拽中最高优先级状态 |

### 7.3 当前动作控制器的核心价值

`usePetActionController.ts` 是整个项目现阶段最重要的行为内核。它统一管理：

- 当前状态 `petState`
- 进入状态时间 `enteredStateAtRef`
- 最近交互时间 `lastInteractionAtRef`
- 显式用户动作冷却 `manualActionCooldownUntilRef`
- 动作 token `actionTokenRef`
- one-shot 动作 timer
- inactivity timer

它的真实作用不是“又一个 hook”，而是把早期散落在 App.tsx 中的大量状态切换、副作用和 timer，收敛成一套统一的动作派发入口。

### 7.4 当前 dispatch 规则

统一入口 `dispatchPetAction(request)` 目前已经承担：

- 拒绝拖拽期间的大多数外部动作
- 阻止随机行为打断交互 / locomotion / one-shot
- 用 action token 防止旧 timer 覆盖新状态
- 统一处理 default bubble、default duration、return state
- 统一在合适时机重置 inactivity timer
- 在 locomotion 开始时通知 walking 系统

这使得未来新增动作的成本明显下降。

### 7.5 当前状态系统里的现实设计债务

动作系统已成型，但并不是“所有抽象都 100% 落地”：

- `PetActionRequest.force` 字段已经存在，也被 App.tsx 多处传入，但当前控制器没有消费这个字段。
- `PetActionDefinition.blocksRandomBehavior` 已写进 action registry，但当前控制器和随机行为系统没有真正读取它。
- `ActionTriggerSource` 中包含 `tray`，但当前托盘触发的宠物动作仍是通过与菜单相同的通道间接进入渲染层，真实使用上并未形成独立 tray 来源分支。

因此，当前动作系统应被理解为“核心设计已完成，个别抽象字段仍是预留位”。

---

## 8. 用户交互与行为能力清单

### 8.1 已实现的直接交互

当前用户可以直接做的事情包括：

- 左键按住小猫拖动窗口
- 双击小猫触发 `happy`
- 右键小猫打开原生菜单
- 打开设置面板
- 调整宠物尺寸
- 打开或关闭气泡
- 开关随机行为
- 开关自动走路
- 设置行为频率
- 调整 walking 速度
- 选择自动入睡时间
- 开关 always-on-top
- 重置位置
- 重置设置

### 8.2 拖拽交互的当前实现特征

当前拖拽系统已经过专门 bug fix 强化，特点包括：

- 使用 Pointer Events 而不是旧式 mouse 事件
- 有 `4px` 的拖拽确认阈值，避免普通点击误判为拖拽
- pointer capture 保证光标移出元素后仍持续收到事件
- 拖拽坐标以屏幕坐标为主，主进程维护 dragState
- 通过主进程 `setPosition()` 移动窗口，避免 renderer 与系统坐标不一致
- blur 时会取消拖拽，避免状态悬挂

这说明拖拽链路已经不是实验代码，而是专门为可靠性做过修复。

### 8.3 已实现的轻量自主行为

当前随机行为系统已经支持：

- 自己开心一下 `happy`
- 自己 grooming
- 自己向左走动
- 自己向右走动
- idle 久了之后随机小睡
- sleeping 一段时间后随机醒来并进入 happy

而且已具备以下抑制条件：

- 用户刚操作过时不触发
- 显式用户动作冷却期间不触发
- 拖拽中不触发
- 设置面板打开时不触发
- 窗口隐藏时不触发
- 非 idle / sleeping 状态下不调度

### 8.4 walking 能力的当前实现特征

walking 不是单纯切换动画，而是真正驱动 Electron 窗口位置改变：

- `walk_left` / `walk_right` 时使用 `requestAnimationFrame`
- 起步前向主进程查询当前窗口位置、工作区、实际窗口宽度
- 根据速度和随机持续时间在工作区内平滑移动
- hit boundary 或达到时长后回到 idle
- 拖拽开始或窗口隐藏时立即取消 walking

这意味着 walking 是“动作 + 空间位移”的完整实现，不是假的视觉 walk。

### 8.5 气泡系统

当前气泡系统比较轻量，但已可用：

- 支持动作触发默认气泡
- 支持请求级自定义 bubbleText
- 由渲染层自己拥有 bubble timer
- 可在设置中开关
- 时长可持久化配置

---

## 9. 菜单、托盘与窗口行为

### 9.1 右键菜单

主进程当前提供的宠物右键菜单包含：

- 摸摸猫猫
- 喂小鱼干
- 洗洗脸
- 让它睡觉
- 唤醒猫猫
- 向左走动
- 向右走动
- 设置
- 重置位置
- 显示 / 隐藏猫猫
- 退出

### 9.2 托盘菜单

当前托盘菜单包含：

- 显示 / 隐藏猫猫
- 设置
- 摸摸猫猫
- 洗洗脸
- 让它睡觉
- 随机行为开关
- 退出

托盘左键点击会直接切换窗口显示状态，这一点是有意设计的。

### 9.3 窗口行为

当前 BrowserWindow 行为包括：

- 透明背景
- 无边框
- 不可缩放
- 无阴影
- always-on-top
- skipTaskbar
- 在所有工作区显示
- 可 show / hide
- 主进程向渲染层广播可见性变化

### 9.4 一个重要限制

窗口本体尺寸仍然固定为 `300 x 300`，但宠物视觉尺寸可在该窗口内部调整到 `96 ~ 260 px`。当前设计不是“窗口大小跟着宠物大小变化”，而是“固定舞台里改变主角大小”。

这对后续设计有两个含义：

- 视觉与 hit area 逻辑更稳定
- 若未来要做更大动作或更多 UI 覆盖层，300 x 300 的固定窗口可能成为上限约束

---

## 10. 设置系统与持久化

### 10.1 settings.json 真实保存的字段

当前 `UserSettings` 包含：

- `petSizePx`
- `alwaysOnTop`
- `speechBubbleEnabled`
- `randomBehaviorEnabled`
- `autoWalkEnabled`
- `behaviorFrequency`
- `walkingSpeedPxPerSecond`
- `walkingDurationMinMs`
- `walkingDurationMaxMs`
- `sleepAfterIdleMs`
- `happyDurationMs`
- `bubbleDurationMs`

### 10.2 默认行为

当前默认值总体上是“适中且可配置”的：

- 默认尺寸 220px
- 默认置顶
- 默认气泡开启
- 默认随机行为开启
- 默认自动走路开启
- 默认行为频率 `normal`
- 默认 walking 速度 `35 px/s`
- walking 时长默认 `4s ~ 6s`
- dev 模式默认 15 秒 idle 后入睡
- production 模式默认 5 分钟 idle 后入睡
- happy 默认 2.5 秒
- bubble 默认 1.8 秒

### 10.3 设置服务的成熟度

主进程设置服务已具备以下能力：

- 从 `app.getPath('userData')/settings.json` 读取
- 自动规范化和 clamp 数值范围
- 自动迁移旧版 `petSize` 枚举到 `petSizePx`
- reset 到默认值
- 配置变更后广播给渲染层
- `alwaysOnTop` 更新后立即应用到窗口

### 10.4 UI 层已暴露哪些设置

当前设置面板已暴露：

- 尺寸
- 气泡开关
- 随机行为开关
- 自动走路开关
- 行为频率
- walking 速度
- 自动睡觉时机
- 始终置顶
- 重置位置
- 重置设置

### 10.5 仍未直接暴露到设置面板的持久化字段

以下字段已被持久化系统支持，但当前 UI 没有直接调节控件：

- `walkingDurationMinMs`
- `walkingDurationMaxMs`
- `happyDurationMs`
- `bubbleDurationMs`

这意味着项目已经有更深的可配置空间，但还没有完全产品化暴露出来。

---

## 11. 动画与视觉系统

### 11.1 当前运行时动画资源状态

当前动画配置里真实接入的状态资源为：

- idle：3 帧
- dragging：3 帧
- happy：3 帧
- sleeping：3 帧
- walk_right：3 帧
- walk_left：3 帧
- grooming：4 帧

### 11.2 动画播放方式

当前不是 sprite sheet，也不是 GIF，而是：

- `animationConfig` 定义每个状态的帧列表、fps 和 loop
- `useAnimation` 用 `setInterval` 按 fps 切帧
- `PetSprite` 只负责渲染当前帧 `<img>`

这个方案简单、稳定、便于替换素材，是一个非常务实的桌宠实现方式。

### 11.3 各状态动画特性

- idle：循环
- dragging：循环
- happy：循环播放，但状态层用 timer 控制何时回 idle
- sleeping：循环
- walking：循环
- grooming：`loop: false`，动作控制器根据计算出的动画时长回 idle

### 11.4 视觉样式取向

当前 UI 风格是“极简桌宠”而非复杂应用 UI：

- 背景全透明
- 宠物主体在中心
- 只用极少量 CSS transform 表达状态差异
- 气泡轻量浮在顶部
- 设置面板以内嵌浮层形式覆盖在同一个窗口内

这符合桌宠应用的低侵入性目标。

---

## 12. 资产处理流水线与当前质量状态

这是项目的一个亮点：视觉资源并不是直接“扔进 src/assets 就完事”，而是有一套本地脚本 + 中间产物 + 检查报告的流水线。

### 12.1 主要脚本职责

#### `tools/clean_cat_asset_alpha.py`

用途：

- 从边缘像素估计背景色
- 只移除边缘连通的背景样像素
- 尽量保护猫毛、胡须、爪子等细节
- 输出真正 RGBA PNG

#### `tools/remove_checkerboard_background.py`

用途：

- 处理早期白底 / 浅灰 / 棋盘格伪透明素材
- 生成 `processed_assets/cat/*`
- 生成透明度验证报告与多底色预览

#### `tools/replace_walking_assets.py`

用途：

- 使用 `walking_new_000/001/002` 替换旧 walking 资产
- 归档旧 walking 到 `processed_assets/cat/archive/`
- 安装新的 `walk_right` 三帧
- 镜像生成新的 `walk_left` 三帧
- 删除运行时目录中的 `_003` 第四帧

#### `tools/prepare_grooming_assets.py`

用途：

- 将根目录的 `grooming_000 ~ 003` 处理成真透明 RGBA PNG
- 生成检查报告
- 生成多底色预览
- 复制到运行时 `src/assets/cat/grooming/`

#### `tools/inspect_asset_bounds.py`

用途：

- 扫描各帧 alpha bounding box
- 检查是否贴边、是否留有足够边距

#### `tools/inspect_transparency_artifacts.py`

用途：

- 检查顶部横带、半透明矩形、假透明棋盘格等伪影
- 输出 `visual_artifacts_report.txt`
- 输出多底色预览图

### 12.2 processed_assets 当前反映出的事实

从现有报告可以得出比较明确的结论：

- `asset_bounds_report.txt` 显示 idle / happy / sleeping / walk_left / walk_right / dragging 的当前运行时素材边距充足，全部 PASS。
- `visual_artifacts_report.txt` 显示上述六类运行时素材未检测到顶部横带、半透明矩形背景或 baked-in checkerboard，全部 PASS。
- `grooming_asset_report.txt` 显示四张 grooming 原始素材最初没有 alpha，且疑似带 checkerboard 与顶部灰带，但处理后的输出全部 PASS，并已复制到运行时资产目录。
- `transparency_report.txt` 保留了更早阶段的透明度检查结果，并包含历史上的四帧 walking 阶段结果，因此它是“历史流水线记录”，不完全等同于当前 runtime 配置。

### 12.3 一个细节：walking 报告与当前运行时的差异

当前运行时代码里，walking 每个方向只使用 3 帧；但某些 processed_assets 历史报告仍保留了旧四帧 walking 的检查结果。这不表示代码仍在引用第四帧，而是说明仓库保留了历史流水线痕迹。

因此，对下一位 LLM 来说：

- “当前运行时真相”请看 `animationConfig.ts`
- “资产演进历史”请看 `processed_assets/` 与 `tools/replace_walking_assets.py`

---

## 13. 规格演进时间线与当前落地状态

下面这张表把 spec 目录的历史与当前代码做了对齐。

| 阶段 | 主题 | 当前状态 |
| --- | --- | --- |
| Phase 0 | Electron + React + TS + Vite 初始化 | 已实现 |
| Phase 1 | 透明、无边框、置顶桌宠窗口 | 已实现 |
| Phase 2 | 自定义拖拽 | 已实现，且后续做过可靠性修复 |
| Phase 3 | 基础状态与交互反馈 | 已实现，但视觉上已升级为真实帧动画 |
| Phase 4 | 帧动画系统 | 已实现 |
| Phase 5 | 原生右键菜单与系统托盘 | 已实现，且后续扩展了菜单项 |
| Phase 6 | 真实猫咪素材接入 + 基础设置持久化 | 已实现 |
| Phase 7 | 随机行为与轻量自主系统 | 已实现，并在后续阶段继续扩展 |
| Phase 8 | walking 动画与移动行为 | 已实现 |
| Phase 9 | 外部窗口上沿吸附 / Perch Mode | 曾被设计，但不在当前运行时中 |
| Phase 9.1 | 增强 Perch 吸附 | 仅存在历史规格，不应视为现成功能 |
| Phase 10 | 稳定性修复、happy 裁切、拖拽可靠性 | 已实现，是当前基础的一部分 |
| Phase 11 | 完整设置面板、行为参数配置化、菜单 walking bug 修复 | 已实现 |
| Phase 12 | 视觉素材清理、walking 素材替换 | 已实现，当前 walking 为 3 帧版本 |
| Phase 13 | grooming 动作 | 已实现 |
| Phase 14 | 动作系统统一化与状态编排重构 | 已实现，构成当前核心架构 |

### 13.1 关于 Perch Mode 的最终判断

这是整个项目历史里最容易误判的一点：

- Phase 9 和 9.1 文档曾对窗口吸附写得很详细。
- 但 Phase 10、11、12、13、14 的文档都把吸附 / Perch Mode 列为禁止事项或已删除对象。
- 当前源码里也搜索不到对应运行时实现。

所以当前应当明确结论：

**Perch Mode 不是“半做完的现成功能”，而是“历史上试图设计过、随后被移除的方向”。**

如果未来要重启这条能力，应该把它当成一个新的功能分支重新设计，而不是假定仓库里还保留着可接入的现成实现。

---

## 14. 当前代码中最关键的入口文件

如果要继续开发，最值得优先读的文件如下：

- `mochi-cat/src/main.ts`
  - 主进程入口；窗口、菜单、托盘、设置 IPC、拖拽 IPC 都在这里
- `mochi-cat/src/preload.ts`
  - 安全桥层；决定 renderer 能做什么
- `mochi-cat/src/types/global.d.ts`
  - `window.mochiCat` 的强类型定义
- `mochi-cat/src/App.tsx`
  - 渲染层总装；连接输入、动作控制器、walking、随机行为、设置面板
- `mochi-cat/src/hooks/usePetActionController.ts`
  - 当前状态机 / 动作编排核心
- `mochi-cat/src/actions/actionRegistry.ts`
  - 状态到动作元数据的映射中心
- `mochi-cat/src/hooks/useRandomBehavior.ts`
  - 轻量自主行为调度器
- `mochi-cat/src/hooks/useWalkingMovement.ts`
  - walking 窗口移动执行器
- `mochi-cat/src/animation/animationConfig.ts`
  - 运行时素材与帧配置真相
- `mochi-cat/src/components/SettingsPanel.tsx`
  - 当前全部 UI 可配置项的集中位置
- `mochi-cat/src/main/settings.ts`
  - 设置持久化、迁移和 clamp 逻辑

---

## 15. 当前设计的优势

### 15.1 架构已经从“能跑”进化到“能扩展”

现在要新增一个类似 `stretching`、`yawning`、`paw_raise`、`loaf` 的动作，已经不需要像早期那样在 App.tsx 里复制一整套 timer 与状态切换逻辑。理论上只需要围绕以下几处扩展：

- `PetState`
- `animationConfig`
- `actionRegistry`
- 可能的菜单或随机行为候选

这说明项目已具备动作扩展的良好基础。

### 15.2 IPC 边界合理

主进程只管系统能力，渲染层只管宠物行为，这种边界为未来新增：

- 开机自启
- 菜单栏增强
- 系统通知
- 更多窗口能力

留下了清晰扩展位。

### 15.3 视觉资源治理是扎实的

这个仓库最大的非代码亮点之一，是素材治理相对严格：

- 有本地处理脚本
- 有历史中间产物
- 有自动检查报告
- 有多底色预览

这会大幅降低“看起来能跑，但素材边界脏、透明度假、阴影错误”的桌宠常见风险。

---

## 16. 当前风险、缺口与技术债

### 16.1 没有自动化测试

这是最现实的工程风险。当前项目复杂度已经不低，但没有看到：

- 单元测试
- hook 级测试
- renderer 交互测试
- Electron 集成测试
- 回归测试脚本

因此目前的稳定性更多依赖手测和阶段性 prompt 驱动开发，而不是可重复验证体系。

### 16.2 部分抽象字段处于“预留但未落地完全”的状态

前面已经提到：

- `force` 未被控制器消费
- `blocksRandomBehavior` 未被真正消费
- `RandomBehaviorName` 类型文件目前未被运行时代码引用

这说明当前架构方向是对的，但抽象清理还没完全收口。

### 16.3 存在少量遗留 / 非核心组件

当前仓库里：

- `SizeSliderPanel.tsx` 组件仍存在，但实际 UI 已主要由 `SettingsPanel` 承担，当前它更多被拿来复用尺寸常量。
- `PET_STATE_EMOJI` 已定义，但当前帧动画实现不依赖它。
- `DEBUG_STATE_MACHINE` 已定义，但未被其他模块消费。

这些都不构成功能 bug，但说明仓库里存在少量“从旧阶段遗留过来的壳”。

### 16.4 文档与元信息仍偏弱

虽然 spec 很丰富，但仓库本身缺少面向开发者的常驻总览文档。除此之外：

- package.json 的 `description` 仍是模板占位文案
- 没有 README 作为统一入口
- 没有把“当前真相 vs 历史 spec”做明确分层说明

本文件正是在补这个缺口。

### 16.5 产品级发布打磨仍不足

当前已有打包配置，但还没有看到明确的：

- 完整应用图标方案
- 开机自启
- 自动更新
- 崩溃上报
- 正式发布流程

因此它更像一个高完成度开发基线，而不是最终商业化交付态。

---

## 17. 面向下一位 LLM 的建议理解方式

如果你要基于本项目继续讨论“设计前景与发展方向”，建议遵守以下判断框架：

### 17.1 把当前基线视为“Phase 14 完成态”

不要把它当早期 MVP。它已经完成：

- 核心桌宠窗口
- 动画系统
- 交互系统
- 行为系统
- 设置系统
- 资产流水线
- 动作编排重构

### 17.2 讨论未来时要区分三种能力

请把未来方向分成三类：

1. **动作扩展型**
   - 新增 `stretching`、`loaf`、`yawn`、`paw_raise`
   - 这类能力最匹配当前架构，实施成本最低

2. **系统壳增强型**
   - 开机自启、通知、更多托盘能力、更多设置项
   - 需要扩展 main process / preload，但边界很清晰

3. **产品范式升级型**
   - AI 对话、长期记忆、情绪值、任务系统、多宠物、云同步
   - 这类方向已经超出当前桌宠基线，需要新增较大模块，不是“顺手加一点”

### 17.3 不要把 Perch Mode 当现成功能

如果后续规划中要重新讨论“吸附到其他窗口上沿”的能力，请明确写成：

- 新功能分支
- 历史上做过探索但已移除
- 需要重新评估 macOS 权限、外部窗口检测、状态模式与 walking 约束

而不是写成“已有代码只差接线”。那已经不是当前事实。

### 17.4 动作扩展的最佳切入口

若目标是增强猫的行为丰富度，当前最自然的切入点是：

- 继续扩展 `PetState`
- 在 `animationConfig` 中接入新素材
- 在 `actionRegistry` 中定义动作类型和默认规则
- 选择是否加入菜单入口
- 选择是否加入随机行为候选

这是当前代码最成熟、最不容易破坏现有系统的扩展方向。

---

## 18. 最终判断

MochiCat 当前处于一个很适合继续演进的阶段：

- 它不是只有演示效果的原型，而是一个行为、设置、视觉、系统交互都已经贯通的桌宠应用骨架。
- 其核心优势在于：动作编排已经统一、资源流水线已经落地、平台边界已经清晰。
- 其核心短板在于：自动化验证不足、少量抽象字段未完全消费、正式产品化打磨还没有收尾。

如果后续目标是“继续做一只更丰富、更聪明、更可定制的猫”，当前代码基础是合适的。

如果后续目标是“把它变成 AI 陪伴应用”或“做复杂跨应用窗口互动”，那将是下一阶段的架构升级，而不是小修小补。