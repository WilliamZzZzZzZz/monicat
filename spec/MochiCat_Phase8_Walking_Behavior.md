# MochiCat Phase 8 开发文档：左右走路动画与随机移动行为

版本：v0.1  
阶段：Phase 8  
前置条件：Phase 7 已完成；随机行为系统已经可用；`idle`、`dragging`、`happy`、`sleeping` 四种状态稳定；真实猫咪透明 PNG 素材已接入；右键菜单、托盘、设置持久化均可用。  
目标：接入 4 张 `walk_right` 走路帧素材，通过镜像生成 `walk_left`，并让小猫可以在桌面上自然左右走动，同时将走路纳入随机行为系统。  
开发方式：VS Code + Codex / Agent + GitHub Copilot  
当前阶段原则：只增加左右走路行为，不新增复杂物理系统，不做 AI 对话，不新增非走路类复杂状态。

---

## 1. Phase 8 的核心目标

Phase 8 的核心目标是：

> 使用当前工程最外层目录中的 4 张 walking 图片素材，生成左右走路动画，并让小猫在随机行为中可以自然地左右走动一小段距离。

当前系统已经支持：

```text
idle
dragging
happy
sleeping
```

Phase 8 需要新增：

```text
walk_right
walk_left
```

其中：

```text
walk_right 使用当前 4 张 walking 原图
walk_left 由 walk_right 水平镜像生成
```

完成后，小猫不仅会切换到走路动画，还应该真的在桌面上水平移动一小段距离。

---

## 2. 当前项目状态

当前项目已经完成：

```text
Phase 0：Electron + React + TypeScript 初始化
Phase 1：透明、无边框、置顶窗口
Phase 2：自定义拖拽
Phase 3：基础状态机
Phase 4：帧动画系统
Phase 5：右键菜单与系统托盘
Phase 6：真实猫咪素材接入与设置持久化
Phase 7：随机行为与轻量自主系统
```

当前已有状态：

```text
idle
dragging
happy
sleeping
```

当前已有能力：

```text
真实猫咪透明 PNG 动画帧播放
拖拽小猫
双击触发 happy
无操作进入 sleeping
右键菜单控制
系统托盘控制
尺寸滑动条设置
settings.json 持久化
randomBehaviorEnabled 控制随机行为
```

当前新增素材状态：

```text
4 张 walking 图片素材已经放在工程最外层目录中
这 4 张图片应被视为 walk_right 原始帧
```

---

## 3. Phase 8 不做什么

本阶段禁止实现：

```text
复杂物理系统
碰撞反弹系统
重力模拟
跳跃
奔跑
eat / play / angry / curious 等新状态
AI 聊天
音效系统
饥饿值 / 心情值 / 亲密度
多宠物系统
复杂路径规划
跨屏幕高级寻路
打包发布
```

本阶段也不要重构：

```text
已有拖拽逻辑
已有菜单和托盘逻辑
已有设置持久化系统
已有 idle / dragging / happy / sleeping 素材目录
已有 Phase 7 随机行为主结构
```

除非发现明确 bug，否则不要大范围重写稳定代码。

---

## 4. Phase 8 完成效果

完成后应满足：

```text
1. npm start 可以正常启动。
2. 原有 idle / dragging / happy / sleeping 状态仍然正常。
3. 新增 walk_right 状态。
4. 新增 walk_left 状态。
5. walk_right 播放 4 张 walking 原始帧。
6. walk_left 播放由 walk_right 镜像生成的 4 张帧。
7. 小猫处于 walk_right 时，窗口缓慢向右移动。
8. 小猫处于 walk_left 时，窗口缓慢向左移动。
9. 走路速度自然，不像滑行或瞬移。
10. 走路步幅和移动距离适中，符合正常自然规律。
11. 小猫不会走出屏幕边界。
12. 走路结束后返回 idle。
13. 随机行为系统会把 walk_left / walk_right 纳入候选行为。
14. randomBehaviorEnabled = false 时，不会自动走路。
15. 用户拖拽时，走路立即停止。
16. 右键菜单和托盘仍然正常。
17. TypeScript 无编译错误。
18. Renderer Console 和 Main Process 终端无明显报错。
```

---

## 5. Walking 图片素材接入要求

### 5.1 输入素材

当前工程最外层目录中有 4 张 walking 图片素材。

Agent 需要：

```text
1. 检查项目最外层目录。
2. 找到这 4 张 walking 图片。
3. 将它们视为 walk_right 帧。
4. 不要删除原始图片。
5. 不要覆盖原始图片。
```

如果文件名不规范，Agent 需要根据视觉顺序或文件创建顺序确认它们对应：

```text
walk_right_000
walk_right_001
walk_right_002
walk_right_003
```

如果无法可靠判断顺序，应停止并报告，而不是随意排序。

---

### 5.2 目标目录结构

最终应整理为：

```text
src/assets/cat/
├── walk_right/
│   ├── walk_right_000.png
│   ├── walk_right_001.png
│   ├── walk_right_002.png
│   └── walk_right_003.png
└── walk_left/
    ├── walk_left_000.png
    ├── walk_left_001.png
    ├── walk_left_002.png
    └── walk_left_003.png
```

原则：

```text
walk_right 使用原始 4 帧处理后的 PNG
walk_left 使用 walk_right 的水平镜像版本
```

---

## 6. 透明背景强制要求

### 6.1 Agent 必须检查 walking 图片是否是真透明

Agent 必须在接入前检查 4 张 walking 图片：

```text
1. 是否为 PNG。
2. 是否有 alpha 通道。
3. 是否存在透明像素。
4. 背景是否是真透明。
5. 是否有棋盘格被画进图片里。
6. 是否有白底、灰底、黑底或其他实色背景。
```

### 6.2 如果 walking 图片不是真透明背景

如果 Agent 发现这些 walking 图片不是透明背景素材，例如：

```text
棋盘格被画进图片
白底
灰底
黑底
没有 alpha 通道
alpha 通道存在但背景仍然不透明
```

Agent 必须先处理图片为正确透明 PNG 后再使用。

处理要求：

```text
1. 不要重新生成图片。
2. 不要重画猫。
3. 不要改变猫的动作、姿态、颜色、比例和风格。
4. 使用本地程序化图像处理去除背景。
5. 优先复用项目中已有的背景透明化处理脚本。
6. 如果已有 tools/remove_checkerboard_background.py 或类似脚本，应优先复用。
7. 如果没有，应新增或临时使用一个透明化处理脚本。
8. 输出真实 RGBA PNG。
9. 不要覆盖原图。
10. 将处理结果先输出到 staging 目录。
```

建议 staging 目录：

```text
processed_assets/cat/walk_right/
```

通过检查后再复制到：

```text
src/assets/cat/walk_right/
```

### 6.3 透明化处理要求

程序化背景处理应满足：

```text
1. 从边界区域识别背景。
2. 只移除与边界连通的背景区域。
3. 不要全局删除所有白色/灰色像素，以免损伤猫的胡须、毛色高光、下巴、耳朵内部。
4. 保留猫身体、耳朵、眼睛、胡须、尾巴、爪子。
5. 边缘可轻微 feather，避免锯齿和脏边。
6. 输出 RGBA PNG。
```

不允许：

```text
简单把所有白色像素设为透明
简单把所有灰色像素设为透明
直接覆盖原文件
跳过验证直接接入
```

### 6.4 透明背景验证报告

Agent 应生成或更新验证报告：

```text
processed_assets/transparency_report.txt
```

报告至少包含：

```text
filename
image size
mode
has alpha
transparent pixel ratio
semi-transparent pixel ratio
checkerboard likely remains near border: yes/no
pass/fail
```

如果项目已有类似报告机制，可复用。

---

## 7. walk_left 镜像生成要求

`walk_left` 不需要重新生成图片模型素材。  
Agent 应直接将 `walk_right` 处理后的透明 PNG 水平镜像。

要求：

```text
1. walk_left_000 = mirror(walk_right_000)
2. walk_left_001 = mirror(walk_right_001)
3. walk_left_002 = mirror(walk_right_002)
4. walk_left_003 = mirror(walk_right_003)
```

使用程序化处理，例如 Python Pillow：

```python
from PIL import Image, ImageOps

img = Image.open("walk_right_000.png").convert("RGBA")
mirrored = ImageOps.mirror(img)
mirrored.save("walk_left_000.png")
```

镜像后必须保持：

```text
相同尺寸
相同 alpha 透明背景
不压缩损坏
不裁切
```

---

## 8. PetState 扩展

将 PetState 扩展为：

```ts
export type PetState =
  | 'idle'
  | 'dragging'
  | 'happy'
  | 'sleeping'
  | 'walk_left'
  | 'walk_right';
```

要求：

```text
1. 不要删除已有状态。
2. 不要改名已有状态。
3. 只新增 walk_left 和 walk_right。
4. 所有 switch / Record<PetState, ...> 必须补齐新状态。
```

---

## 9. animationConfig 更新

需要在 `animationConfig.ts` 中加入：

```ts
const walkRight000 = new URL('../assets/cat/walk_right/walk_right_000.png', import.meta.url).href;
const walkRight001 = new URL('../assets/cat/walk_right/walk_right_001.png', import.meta.url).href;
const walkRight002 = new URL('../assets/cat/walk_right/walk_right_002.png', import.meta.url).href;
const walkRight003 = new URL('../assets/cat/walk_right/walk_right_003.png', import.meta.url).href;

const walkLeft000 = new URL('../assets/cat/walk_left/walk_left_000.png', import.meta.url).href;
const walkLeft001 = new URL('../assets/cat/walk_left/walk_left_001.png', import.meta.url).href;
const walkLeft002 = new URL('../assets/cat/walk_left/walk_left_002.png', import.meta.url).href;
const walkLeft003 = new URL('../assets/cat/walk_left/walk_left_003.png', import.meta.url).href;
```

配置建议：

```ts
walk_right: {
  fps: 7,
  loop: true,
  frames: [
    walkRight000,
    walkRight001,
    walkRight002,
    walkRight003,
  ],
},

walk_left: {
  fps: 7,
  loop: true,
  frames: [
    walkLeft000,
    walkLeft001,
    walkLeft002,
    walkLeft003,
  ],
},
```

fps 调整范围：

```text
6–8 fps
```

要求：

```text
不要让走路看起来像跑步。
不要让走路帧切换太慢导致卡顿。
```

---

## 10. Walking Movement 系统

### 10.1 走路不能只是播放动画

Phase 8 中，走路必须同时包含：

```text
1. 播放 walk_left / walk_right 动画。
2. 让 BrowserWindow 在桌面上缓慢水平移动。
```

如果只有腿动但窗口不动，会看起来像原地跑步。  
如果窗口移动太快，会看起来像滑行。

---

### 10.2 移动速度建议

推荐参数：

```text
walkingSpeedPxPerSecond: 25–45 px/s
walkingDurationMs: 3000–8000 ms
totalDistance: 100–300 px
```

禁止使用不自然值：

```text
200 px/s
瞬移
一次走完整个屏幕
每帧跳很多像素
```

### 10.3 自然规律要求

走路动作必须符合正常自然规律：

```text
1. 水平方向移动。
2. y 坐标默认保持不变。
3. 移动速度平稳。
4. 步幅中等，不夸张。
5. 不要突然加速或突然停顿。
6. 不要出现大幅跳跃。
7. 不要在走路中改变宠物尺寸。
```

---

## 11. useWalkingMovement Hook

建议新增：

```text
src/hooks/useWalkingMovement.ts
```

职责：

```text
1. 监听 petState。
2. 当 petState 为 walk_right 时向右移动窗口。
3. 当 petState 为 walk_left 时向左移动窗口。
4. petState 变化时停止移动。
5. 拖拽开始时停止移动。
6. 窗口隐藏时停止移动。
7. 走路完成后调用 onWalkComplete。
8. 组件卸载时清理 requestAnimationFrame 或 timer。
```

建议接口：

```ts
import type { PetState } from '../types/pet';

interface UseWalkingMovementParams {
  petState: PetState;
  isDragging: boolean;
  isWindowVisible: boolean;
  onWalkComplete: () => void;
}

export function useWalkingMovement(params: UseWalkingMovementParams): void;
```

`onWalkComplete` 通常执行：

```ts
triggerIdle();
```

---

## 12. BrowserWindow 位置控制

### 12.1 优先复用已有窗口位置 API

如果项目已经有：

```text
window.mochiCat.window.getPosition()
window.mochiCat.window.setPosition(x, y)
```

应优先复用。

如果没有，需要新增受限 IPC API。

### 12.2 必要 IPC

Renderer 需要能够：

```text
1. 获取当前窗口位置。
2. 设置当前窗口位置。
3. 获取当前显示器 workArea 边界。
```

示例 API：

```ts
window.mochiCat.window.getPosition(): Promise<[number, number]>
window.mochiCat.window.setPosition(x: number, y: number): Promise<void>
window.mochiCat.window.getWorkArea(): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}>
```

如果已有 API 不同，复用当前项目风格即可。

### 12.3 main process 中获取屏幕边界

使用 Electron `screen` API：

```ts
const bounds = mainWindow.getBounds();
const display = screen.getDisplayMatching(bounds);
return display.workArea;
```

### 12.4 边界限制

窗口 x 坐标必须 clamp：

```ts
x >= workArea.x
x <= workArea.x + workArea.width - windowWidth
```

y 坐标默认保持当前值。

如果接近边界：

```text
1. 可以停止走路并回到 idle。
2. 或者切换方向。
```

Phase 8 推荐：

```text
接近边界时停止走路并回到 idle
```

更复杂的自动转向可放后续阶段。

---

## 13. 随机行为系统接入

Phase 7 已有随机行为系统。  
Phase 8 需要将 walk_left / walk_right 纳入随机行为范围。

随机行为应包含：

```text
idle
happy
sleeping
wakeUp
walk_left
walk_right
```

### 13.1 idle 状态下的随机行为

当小猫处于 idle 一段时间后，可以随机选择：

```text
selfHappy
walkLeft
walkRight
nap
doNothing / reschedule
```

建议概率：

```text
selfHappy: 25%
walkLeft: 25%
walkRight: 25%
nap: 15%（仅在 idle 时间足够长之后）
doNothing: 10%
```

不要求完全精确，但走路应成为随机行为的一部分。

### 13.2 sleeping 状态下的随机行为

当小猫 sleeping 一段时间后：

```text
可能 wakeUp
wakeUp 后进入 happy
happy 短暂播放后回 idle
之后随机行为系统可能再次触发 walk_left / walk_right
```

不要让 sleeping 直接瞬间开始 walk。  
推荐流程：

```text
sleeping -> happy/wake -> idle -> 之后再可能 walk
```

---

## 14. RandomBehaviorName 扩展

如果项目中有行为名类型，扩展为：

```ts
export type RandomBehaviorName =
  | 'selfHappy'
  | 'nap'
  | 'wakeUp'
  | 'walkLeft'
  | 'walkRight';
```

映射关系：

```text
walkLeft -> walk_left
walkRight -> walk_right
```

---

## 15. 走路保护规则

自动走路不能在以下情况下触发或继续：

```text
1. 用户正在拖拽。
2. petState === 'dragging'。
3. petState === 'happy' 且是用户刚触发的反应。
4. 用户刚刚交互过。
5. 尺寸滑动条面板正在使用。
6. 右键菜单刚刚打开或菜单动作正在处理。
7. 窗口隐藏。
8. randomBehaviorEnabled === false。
```

如果走路过程中用户开始拖拽：

```text
1. 立即停止 walking movement。
2. 切换到 dragging。
3. 不要在拖拽结束后自动恢复之前的 walk。
4. 让随机调度器后续重新决定。
```

如果 randomBehaviorEnabled 被关闭：

```text
1. 立即停止新的随机走路。
2. 如果当前正在自动 walk，也应停止并回到 idle，或在当前 walk burst 完成后停止。
```

推荐更明确行为：

```text
关闭 randomBehaviorEnabled 时，立即停止 walking 并回到 idle。
```

---

## 16. 与现有 inactivity sleeping 的关系

如果项目已有“无操作进入 sleeping”的 timer，Phase 8 不要创建冲突逻辑。

推荐：

```text
1. 保留已有 inactivity sleeping。
2. 随机行为系统只在合适时间触发 walk / happy。
3. 如果 idle 很久，也可以随机 nap，但不要和已有 sleep timer 争抢。
```

如果发现冲突：

```text
优先保证不会出现状态来回抖动。
```

不要为了 walk 大幅重写 sleep 系统。

---

## 17. Context Menu / Tray 可选增强

本阶段主要目标是随机走路。

可选新增右键菜单项：

```text
走一走
```

行为：

```text
随机选择 walk_left 或 walk_right
触发一次短距离 walking burst
```

这不是硬性要求。  
如果实现会增加复杂度，可以不做。

不要破坏已有菜单项：

```text
摸摸猫猫
喂小鱼干
让它睡觉
唤醒猫猫
调整尺寸
随机行为开关
隐藏猫猫
退出
```

---

## 18. 动画与移动同步调参

走路动画和窗口移动必须匹配。

建议起始参数：

```text
walk animation fps: 7
movement speed: 35 px/s
walking duration: 4–6 seconds
```

如果视觉上像“滑行”：

```text
降低 movement speed
或提高/调整 animation fps
```

如果视觉上像“原地踏步”：

```text
提高 movement speed
或降低 animation fps
```

如果动作太快像跑步：

```text
降低 fps 到 6
降低 movement speed
```

---

## 19. 推荐文件变更

可能新增：

```text
src/hooks/useWalkingMovement.ts
```

可能修改：

```text
src/types/pet.ts
src/animation/animationConfig.ts
src/hooks/useRandomBehavior.ts
src/behavior/randomBehaviorTypes.ts
src/behavior/randomBehaviorConfig.ts
src/App.tsx
src/preload.ts 或 preload 相关文件
src/main.ts 或 main window IPC 文件
```

可能新增资源目录：

```text
src/assets/cat/walk_right/
src/assets/cat/walk_left/
processed_assets/cat/walk_right/   # 如果需要透明化处理
processed_assets/transparency_report.txt
```

Agent 必须先检查实际工程结构，不要盲目按示例路径创建重复文件。

---

## 20. Codex / Agent 执行任务 Prompt

可以直接将以下内容交给 Agent：

```text
We need to implement MochiCat Phase 8.

Current project status:
- Phase 7 is complete.
- The app already supports idle, dragging, happy, and sleeping.
- Real transparent PNG cat assets are already integrated for those states.
- Settings persistence is working.
- The pet can be dragged.
- Context menu and tray are working.
- Random behavior already controls idle / happy / sleeping behavior.
- I have placed 4 new walking frame images in the project root / outer folder.
- These 4 images should be treated as walk_right frames.
- The app should use these 4 frames to create both right-walking and left-walking behavior.

Goal:
Add natural left/right walking behavior using the 4 walking frame images, and include walking in the random autonomous behavior system.

Critical asset requirement:
Before integrating the 4 walking frames, verify whether they are true transparent PNG files.
If they are not true transparent PNGs, first process them into correct transparent PNGs before use.
Do not silently integrate fake-transparent images.

Part A - Walking asset verification and integration:
1. Inspect the project root and locate the 4 walking frame images.
2. Treat these 4 images as walk_right source frames.
3. Check each image:
   - PNG format
   - alpha channel exists
   - transparent pixels exist
   - no baked-in checkerboard background
   - no white/gray/black solid background
4. If any image is not true transparent:
   - use the existing background-removal script if available
   - otherwise create a local programmatic cleanup script
   - do not regenerate the images
   - do not redraw the cat
   - do not change the cat pose, style, color, or proportions
   - output real RGBA PNG files
   - do not overwrite the originals
5. Copy the verified/processed walk_right frames into:
   src/assets/cat/walk_right/walk_right_000.png
   src/assets/cat/walk_right/walk_right_001.png
   src/assets/cat/walk_right/walk_right_002.png
   src/assets/cat/walk_right/walk_right_003.png
6. Generate walk_left frames by horizontally mirroring the verified walk_right frames:
   src/assets/cat/walk_left/walk_left_000.png
   src/assets/cat/walk_left/walk_left_001.png
   src/assets/cat/walk_left/walk_left_002.png
   src/assets/cat/walk_left/walk_left_003.png
7. Do not delete or overwrite the original root-folder walking images.
8. Generate or update a transparency verification report if cleanup is needed.

Part B - State and animation integration:
1. Extend PetState with:
   - walk_left
   - walk_right
2. Update animationConfig to include walk_left and walk_right.
3. Use the 4 frames for each direction.
4. Recommended fps: 7.
5. Tune between 6 and 8 fps if needed.
6. Do not remove existing states or animations.

Part C - Walking movement:
1. Add a lightweight walking movement system.
2. When petState is walk_right:
   - play walk_right animation
   - move the BrowserWindow slowly to the right
3. When petState is walk_left:
   - play walk_left animation
   - move the BrowserWindow slowly to the left
4. Movement must be natural:
   - walking speed: 25–45 px/s
   - walking burst duration: 3–8 seconds
   - total distance: about 100–300 px
   - no teleportation
   - no fast sliding
   - no huge jumps
5. The y position should normally remain unchanged.
6. Clamp x position inside the display workArea.
7. If the pet reaches a screen edge, stop walking and return to idle.
8. Walking must stop if the user starts dragging.

Part D - Suggested hook:
Create:
   src/hooks/useWalkingMovement.ts

It should:
- observe petState
- move the window while petState is walk_left or walk_right
- stop when petState changes
- stop when dragging starts
- stop when window is hidden
- clean up requestAnimationFrame or timers
- call onWalkComplete when walking duration completes

Part E - IPC:
Use existing safe window position APIs if available.
If needed, add safe IPC APIs:
- getPosition
- setPosition
- getWorkArea

Do not expose raw ipcRenderer.
Do not disable contextIsolation.
Do not enable nodeIntegration.

Part F - Random behavior integration:
1. Update the random behavior system to include walking.
2. From idle, random behavior can choose:
   - selfHappy
   - walkLeft
   - walkRight
   - nap
   - doNothing/reschedule
3. Recommended probabilities:
   - selfHappy: 25%
   - walkLeft: 25%
   - walkRight: 25%
   - nap: 15% only after longer idle
   - doNothing: 10%
4. When sleeping for a while:
   - may wake up into happy
   - then return to idle
   - later may randomly walk
5. randomBehaviorEnabled must control walking too.
6. If randomBehaviorEnabled is false:
   - no autonomous walking
   - no autonomous happy
   - no autonomous sleeping
   - no autonomous wakeUp
7. Do not trigger walking while:
   - dragging
   - recently interacted
   - happy due to user interaction
   - size slider is being used
   - context menu interaction is active
   - window hidden

Part G - Validation:
After implementation verify:
1. npm start works.
2. idle / dragging / happy / sleeping still work.
3. walk_right plays the 4 right-walking frames.
4. walk_left plays the mirrored frames.
5. The pet actually moves right/left while walking.
6. Movement speed and distance are moderate and natural.
7. The pet does not walk off-screen.
8. Walking stops when the user drags the pet.
9. Walking completes and returns to idle.
10. randomBehaviorEnabled=false disables automatic walking.
11. Existing right-click menu and tray still work.
12. No TypeScript errors.
13. No renderer console errors.
14. No main process errors.
15. No white/gray/checkerboard background appears for walking frames.

Before writing code:
1. Inspect the current project structure.
2. Locate the 4 root-folder walking images.
3. Locate PetState type.
4. Locate animationConfig.
5. Locate useRandomBehavior.
6. Locate existing window position IPC.
7. List exactly which files will be created or modified.
8. Explain the walking asset verification and integration plan.
9. Explain the walking movement algorithm.
10. Then implement.

After implementation:
1. List all copied/generated walking asset files.
2. List all code files changed.
3. Explain how to manually observe walking.
4. Explain how random walking is scheduled.
5. Explain how walking is disabled when randomBehaviorEnabled is false.
6. Explain how screen bounds are enforced.

Final constraints:
- Do not regenerate images.
- Do not overwrite original walking images in the project root.
- If walking images are not true transparent PNGs, process them into true transparent PNGs before integration.
- Do not break existing idle / dragging / happy / sleeping behavior.
- Do not make the pet walk unrealistically fast.
- Do not allow the pet to walk off-screen.
- Do not implement complex physics in this phase.
- Do not implement AI chat, audio, hunger values, or new non-walking states.
```

---

## 21. 推荐 Agent 修改步骤

Agent 应按以下顺序执行：

```text
1. 查看项目结构。
2. 找到最外层目录中的 4 张 walking 图片。
3. 检查图片透明度。
4. 如不透明，先执行透明化处理。
5. 输出透明化验证报告。
6. 复制 walk_right 图片到 src/assets/cat/walk_right。
7. 镜像生成 walk_left 图片到 src/assets/cat/walk_left。
8. 扩展 PetState。
9. 更新 animationConfig。
10. 新增 useWalkingMovement。
11. 确认窗口位置 IPC 是否可用。
12. 如缺失，新增安全 IPC。
13. 在 App 中调用 useWalkingMovement。
14. 将走路纳入 useRandomBehavior。
15. 测试 walk_right / walk_left。
16. 测试随机走路。
17. 测试屏幕边界。
18. 测试拖拽打断走路。
19. 测试 randomBehaviorEnabled=false。
```

---

## 22. Phase 8 验收标准

### 22.1 素材验收

```text
[ ] 4 张 walk_right 图片已接入正确目录。
[ ] 4 张 walk_left 图片已由 walk_right 镜像生成。
[ ] 所有 walking 图片均为 PNG。
[ ] 所有 walking 图片均有 alpha 通道。
[ ] 所有 walking 图片背景透明。
[ ] 没有棋盘格被画进图片。
[ ] 没有白底、灰底、黑底。
[ ] 没有裁切耳朵、尾巴、爪子。
```

### 22.2 动画验收

```text
[ ] walk_right 状态可以播放。
[ ] walk_left 状态可以播放。
[ ] walk_right 动画帧顺序正确。
[ ] walk_left 镜像方向正确。
[ ] fps 自然，不像跑步，不明显卡顿。
```

### 22.3 移动验收

```text
[ ] walk_right 时窗口向右移动。
[ ] walk_left 时窗口向左移动。
[ ] 移动速度自然。
[ ] 移动距离适中。
[ ] 没有瞬移。
[ ] 没有大幅跳动。
[ ] y 坐标基本保持稳定。
[ ] 不会走出屏幕。
[ ] 触碰边界时安全停止。
[ ] 走路结束后返回 idle。
```

### 22.4 随机行为验收

```text
[ ] idle 时随机行为可能触发 walk_left。
[ ] idle 时随机行为可能触发 walk_right。
[ ] sleeping 一段时间后可以 wakeUp。
[ ] wakeUp 后回 idle，之后可能随机 walk。
[ ] randomBehaviorEnabled=false 时不会自动 walk。
[ ] 拖拽时不会触发或继续 walk。
[ ] 用户刚交互后不会立刻 walk。
```

---

## 23. 手动测试流程

### 23.1 启动

```bash
npm start
```

预期：

```text
应用正常启动，小猫显示正常。
```

### 23.2 观察随机走路

操作：

```text
1. 确认 randomBehaviorEnabled = true。
2. 不操作一段时间。
```

预期：

```text
小猫有概率自动进入 walk_left 或 walk_right。
窗口会自然水平移动。
走完后回到 idle。
```

### 23.3 拖拽打断

操作：

```text
小猫走路时按住拖拽。
```

预期：

```text
走路立即停止。
进入 dragging。
松开后回 idle。
```

### 23.4 边界测试

操作：

```text
把小猫拖到屏幕左边或右边附近。
等待随机走路。
```

预期：

```text
小猫不会走出屏幕。
接近边界时停止或避免继续向外走。
```

### 23.5 关闭随机行为

操作：

```text
关闭 randomBehaviorEnabled。
等待足够长时间。
```

预期：

```text
小猫不会自动 walk。
```

---

## 24. 常见问题与处理

### 24.1 walking 图片仍然显示棋盘格

原因：

```text
walking 原图不是透明 PNG，且没有经过正确透明化处理。
```

处理：

```text
运行或修复背景透明化脚本。
不要直接接入假透明图。
```

### 24.2 小猫走路像滑行

处理：

```text
1. 降低 walkingSpeedPxPerSecond。
2. 提高或调整 walk fps。
3. 检查 walk 帧是否步态差异过小。
```

### 24.3 小猫走路像跑步

处理：

```text
1. 降低 fps。
2. 降低移动速度。
3. 缩短每次 walk 距离。
```

### 24.4 小猫走出屏幕

处理：

```text
1. 检查 workArea 获取是否正确。
2. 检查 window width 是否参与 clamp。
3. 检查 setPosition 是否绕过边界限制。
```

### 24.5 拖拽后仍继续自动走

原因：

```text
walking loop 未清理。
```

处理：

```text
拖拽开始时 clear requestAnimationFrame / timer。
petState 变化时 cleanup。
```

---

## 25. 代码质量要求

Phase 8 代码应满足：

```text
1. Walking 图片资源路径清晰。
2. walk_left 由 walk_right 镜像生成。
3. 不覆盖原始图片。
4. PetState 扩展完整。
5. animationConfig 覆盖所有 PetState。
6. Walking movement 逻辑集中在 useWalkingMovement。
7. Random behavior 只负责选择行为，不直接写复杂窗口移动逻辑。
8. 所有 timer / requestAnimationFrame 可清理。
9. 不破坏拖拽、菜单、托盘、设置持久化。
10. 不关闭 Electron 安全配置。
```

---

## 26. Phase 8 完成后的 Git 提交建议

如果 Phase 8 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: add walking behavior"
```

---

## 27. 下一阶段预告

Phase 8 完成后，建议 Phase 9 进入：

```text
Phase 9 - Behavior Tuning and State Coordination
```

可做内容：

```text
1. 更精细的状态优先级。
2. 随机行为冷却时间优化。
3. 右键菜单手动触发“走一走”。
4. 屏幕边缘自动转向。
5. 多显示器边界优化。
6. 行为权重设置。
```

如果 Phase 8 的 walk 体验还不稳定，Phase 9 应优先做调参，而不是继续新增功能。
