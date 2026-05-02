# MochiCat Phase 12 Prompt：视觉素材清理、顶部灰色阴影边界修复与 Walking 新素材替换

## 任务标题

MochiCat Phase 12 - Visual Asset Cleanup and Walking Frame Replacement

---

## 背景

当前 MochiCat 已经完成核心功能和 Phase 11 设置面板 / 行为配置化。下一阶段主要任务是修复两个与视觉素材和 walking 动画相关的 bug。

当前发现两个严重问题：

```text
Bug 1：
小猫在 dragging、idle、happy 等状态时，顶部出现一条渐变的灰色阴影边界线。
这条线像是图片顶部或窗口内部的一条横向阴影/背景边界。
这是不可接受的视觉 bug。
无论它来自图片素材、CSS filter/drop-shadow、透明背景处理错误，还是窗口/布局设计问题，都必须准确定位并修复。
修复后任何状态下都不允许再出现这条渐变灰色阴影边界线。

Bug 2：
小猫 walk_left / walk_right 连续帧播放非常不自然。
旧 walking 素材本身步态错误或连续性差。
现在用户已经重新制作了 3 张 walking 连续帧图片，并放在项目最外层文件夹：
- walking_new_000
- walking_new_001
- walking_new_002

需要用这 3 张新素材替换原来的 4 张旧 walking 素材。
这 3 张新素材大概率不是标准 true-transparent PNG，必须先处理成正确透明背景的 PNG，再接入 walk_right，并通过镜像生成 walk_left。
```

---

## 当前仓库关键事实

当前 `animationConfig.ts` 中 walking 仍然使用 4 帧：

```text
walk_right:
- walk_right_000
- walk_right_001
- walk_right_002
- walk_right_003

walk_left:
- walk_left_000
- walk_left_001
- walk_left_002
- walk_left_003
```

Phase 12 需要改为每个方向 3 帧：

```text
walk_right:
- walk_right_000
- walk_right_001
- walk_right_002

walk_left:
- walk_left_000
- walk_left_001
- walk_left_002
```

当前 CSS 中 `.pet-sprite-image` 有 drop-shadow：

```css
filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.18));
```

如果图片素材存在不正确的半透明矩形背景，这个 drop-shadow 会把整张图片矩形边界也显示出来，从而产生顶部灰色渐变线。  
因此必须同时检查：

```text
1. 图片素材 alpha 通道和像素内容。
2. CSS drop-shadow 是否放大了素材背景问题。
3. BrowserWindow / pet-window / body / #root 是否存在非透明背景或 overflow 裁切。
4. 是否所有状态图片都是真透明 cutout。
```

---

## Phase 12 总目标

本阶段目标：

```text
1. 准确找出顶部灰色渐变阴影边界线的根因。
2. 修复所有状态下的该灰色边界线 bug。
3. 检查并清理 idle / dragging / happy / sleeping / walk_left / walk_right 所有素材的透明背景。
4. 用项目根目录中的 walking_new_000 / walking_new_001 / walking_new_002 替换旧 walking 4 帧。
5. 将 walking 新素材处理成标准 true-transparent PNG。
6. 用 walk_right 新 3 帧镜像生成 walk_left 新 3 帧。
7. 更新 animationConfig 和相关类型/测试，使 walking 每方向使用 3 帧。
8. 确保 walking 播放更自然，旧 4 帧不再被引用。
9. 保持所有现有功能稳定。
```

---

## 禁止事项

本阶段不要实现：

```text
- 新 PetState
- 新随机行为系统
- 新设置面板功能
- 吸附 / Perch Mode
- 外部窗口检测
- AI 对话
- 音效
- 多宠物
- 复杂物理
- 打包发布
```

本阶段不要破坏：

```text
- idle / dragging / happy / sleeping / walk_left / walk_right
- manual dragging
- click / double click
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

# Part A：顶部灰色渐变阴影边界线 Bug 诊断与修复

## A1. 必须准确定位根因

Agent 必须先诊断，不要盲修。

需要检查：

```text
1. idle / dragging / happy / sleeping / walk_right / walk_left 所有 PNG 是否是真透明背景。
2. PNG 是否有非透明或半透明的大矩形背景。
3. PNG 顶部是否存在横向半透明灰白像素带。
4. PNG alpha 通道是否在整张画布中大面积非零。
5. PNG 是否包含假的棋盘格背景。
6. CSS drop-shadow 是否作用在错误的半透明矩形背景上。
7. .pet-window / body / #root 是否为 transparent。
8. BrowserWindow backgroundColor 是否为 transparent。
9. 是否某个状态素材画布顶部自带白/灰渐变。
10. 是否 happy / dragging / idle 三类素材共享同一种背景污染。
```

重点判断：

```text
如果 PNG 透明背景正确，drop-shadow 只会跟随猫的 alpha 轮廓，不应该出现横向矩形顶部边界。
如果出现横向矩形阴影线，大概率说明 PNG 内存在不可见但 alpha 非零的大块矩形背景，或者 CSS/布局中某个容器有背景/阴影。
```

---

## A2. 增加素材透明度诊断脚本

新增或复用脚本：

```text
tools/inspect_transparency_artifacts.py
```

它应扫描：

```text
src/assets/cat/idle/
src/assets/cat/dragging/
src/assets/cat/happy/
src/assets/cat/sleeping/
src/assets/cat/walk_right/
src/assets/cat/walk_left/
```

输出报告：

```text
processed_assets/visual_artifacts_report.txt
```

报告至少包含：

```text
filename
image size
mode
has alpha
transparent pixel ratio
semi-transparent pixel ratio
alpha bounding box
top margin
bottom margin
left margin
right margin
non-transparent pixels touching top edge: yes/no
non-transparent pixels touching left/right/bottom edge: yes/no
large semi-transparent rectangle suspected: yes/no
top horizontal band suspected: yes/no
checkerboard likely baked in: yes/no
pass/fail
```

检测逻辑建议：

```text
1. 读取 RGBA。
2. 分析 alpha > 0 的像素分布。
3. 检查顶端 5–30 px 是否存在横向连续 alpha 非零区域。
4. 检查整张图是否存在低 alpha 大面积矩形。
5. 检查边缘区域是否存在非透明像素。
6. 检查边缘颜色是否接近白/灰棋盘格。
```

不要只用肉眼判断。

---

## A3. 生成视觉预览图

必须生成强背景预览，用于人工确认灰线是否消失。

输出：

```text
processed_assets/previews/all_states_on_black.png
processed_assets/previews/all_states_on_green.png
processed_assets/previews/all_states_on_magenta.png
processed_assets/previews/all_states_on_blue.png
```

要求：

```text
1. 将所有状态的所有帧排列在纯色背景上。
2. 每张帧下面标注文件名。
3. 重点观察顶部是否仍有横向灰色边界线。
4. 如果灰线只在透明桌面上不明显，在黑/绿/洋红背景上也必须能验证干净。
```

---

## A4. 如果根因是图片素材背景污染

如果发现 PNG 里存在：

```text
半透明矩形背景
顶部横向灰色渐变线
假的白/灰透明背景
棋盘格被画进图片
alpha 通道不干净
```

必须执行程序化清理。

新增或复用：

```text
tools/clean_cat_asset_alpha.py
```

清理要求：

```text
1. 不重绘小猫。
2. 不改变小猫姿态、比例、颜色、风格。
3. 只移除背景污染和错误的半透明矩形区域。
4. 保留猫身体、耳朵、眼睛、尾巴、爪子、胡须。
5. 输出 true RGBA PNG。
6. 不覆盖原图，先输出到 processed_assets/cat/...
7. 通过报告和预览验证后，再替换 src/assets/cat/...。
```

技术建议：

```text
1. 从图像边界采样背景颜色和 alpha。
2. 识别边界连通背景区域。
3. 只移除与图像边界连通的背景区域。
4. 不要全局删除所有白/灰像素，以免损伤胡须、下巴、高光和耳朵。
5. 对边缘轻微 feather，避免锯齿。
6. 对低 alpha 大矩形背景进行特殊处理：如果某一区域大面积低 alpha 且不属于猫主体，应设为 alpha 0。
```

特别注意：

```text
白色胡须和浅色毛发不能被误删。
不能把小猫耳朵边缘抠坏。
不能因为清理背景导致猫变得残缺。
```

---

## A5. 如果根因是 CSS drop-shadow 放大问题

如果素材中有轻微 alpha 污染，而 CSS drop-shadow 使它明显化，应该：

```text
1. 优先修复素材 alpha。
2. 同时考虑将 drop-shadow 从 .pet-sprite-image 移到更安全的层级，或降低强度。
3. 不要简单删除所有阴影后假装修好了，因为污染素材仍会存在。
```

可选 CSS 调整：

```css
.pet-sprite-image {
  filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.14));
}
```

如果清理后仍有顶部线，可临时禁用：

```css
.pet-sprite-image {
  filter: none;
}
```

用于确认问题是否来自 drop-shadow。

最终要求：

```text
无论是否保留 drop-shadow，任何状态下都不能出现横向灰色渐变边界线。
```

---

## A6. 如果根因是容器/窗口背景

检查并确保：

```css
html,
body,
#root,
.pet-window {
  background: transparent;
}
```

检查 BrowserWindow：

```text
backgroundColor: '#00000000' 或等效 transparent
transparent: true
frame: false
```

如果有任何容器背景、box-shadow、border、filter 造成顶部线，必须移除。

---

## A7. 顶部灰线 Bug 验收

必须验证：

```text
[ ] idle 状态没有顶部灰色渐变边界线。
[ ] dragging 状态没有顶部灰色渐变边界线。
[ ] happy 状态没有顶部灰色渐变边界线。
[ ] sleeping 状态没有顶部灰色渐变边界线。
[ ] walk_right 状态没有顶部灰色渐变边界线。
[ ] walk_left 状态没有顶部灰色渐变边界线。
[ ] 黑色背景预览无灰线。
[ ] 绿色背景预览无灰线。
[ ] 洋红背景预览无灰线。
[ ] 实际 macOS 桌面上无灰线。
[ ] 保留小猫胡须、耳朵、尾巴、爪子细节。
[ ] 没有白边、灰边、棋盘格背景。
```

---

# Part B：替换 Walking 旧素材为 3 张新素材

## B1. 输入素材

用户已经将 3 张新 walking 素材放在项目最外层文件夹，文件名为：

```text
walking_new_000
walking_new_001
walking_new_002
```

Agent 必须自动查找它们，允许扩展名为：

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

---

## B2. 新素材必须先透明化处理

这三张新素材大概率不是真透明背景，因此必须先检查并处理。

检查内容：

```text
1. 是否为 PNG。
2. 是否有 alpha 通道。
3. 是否背景真透明。
4. 是否有白底、灰底、黑底。
5. 是否有棋盘格被画进图片。
6. 是否有顶部灰色渐变线。
7. 是否有大面积半透明背景。
```

如果不是标准透明背景：

```text
必须先处理成 true-transparent PNG。
```

处理要求：

```text
1. 不重新生成图片。
2. 不重画小猫。
3. 不改变三张 walking 的动作姿态。
4. 不改变颜色、画风、比例。
5. 移除背景，输出真实 RGBA PNG。
6. 不覆盖最外层原图。
7. 先输出到 processed_assets/cat/walk_right_new/。
```

---

## B3. 输出 walk_right 新三帧

处理完成后，输出：

```text
src/assets/cat/walk_right/walk_right_000.png
src/assets/cat/walk_right/walk_right_001.png
src/assets/cat/walk_right/walk_right_002.png
```

对应：

```text
walking_new_000 -> walk_right_000.png
walking_new_001 -> walk_right_001.png
walking_new_002 -> walk_right_002.png
```

旧的：

```text
walk_right_003.png
```

不应再被 animationConfig 引用。

可以选择：

```text
1. 删除旧 walk_right_003.png。
2. 或移动到 src/assets/cat/archive/walk_right_old/.
```

推荐：

```text
移动到 archive 或删除，但必须确保不再被引用。
```

---

## B4. 镜像生成 walk_left 新三帧

不要让图片模型重新生成 walk_left。

使用程序化水平镜像：

```text
walk_left_000 = mirror(walk_right_000)
walk_left_001 = mirror(walk_right_001)
walk_left_002 = mirror(walk_right_002)
```

输出：

```text
src/assets/cat/walk_left/walk_left_000.png
src/assets/cat/walk_left/walk_left_001.png
src/assets/cat/walk_left/walk_left_002.png
```

旧的：

```text
walk_left_003.png
```

不应再被引用。

镜像后必须保持：

```text
相同尺寸
相同 alpha
无背景
无灰线
无裁切
```

---

## B5. 更新 animationConfig

当前 walking 配置使用 4 帧。必须改为 3 帧。

将：

```ts
const walkRight003 = new URL('../assets/cat/walk_right/walk_right_003.png', import.meta.url).href;
const walkLeft003 = new URL('../assets/cat/walk_left/walk_left_003.png', import.meta.url).href;
```

删除或停用。

将：

```ts
walk_right: {
  fps: 7,
  loop: true,
  frames: [walkRight000, walkRight001, walkRight002, walkRight003],
}
```

改为：

```ts
walk_right: {
  fps: 6,
  loop: true,
  frames: [walkRight000, walkRight001, walkRight002],
}
```

将：

```ts
walk_left: {
  fps: 7,
  loop: true,
  frames: [walkLeft000, walkLeft001, walkLeft002, walkLeft003],
}
```

改为：

```ts
walk_left: {
  fps: 6,
  loop: true,
  frames: [walkLeft000, walkLeft001, walkLeft002],
}
```

fps 可在 5–7 之间微调。

推荐起始值：

```text
6 fps
```

理由：

```text
3 帧 walk cycle 如果 fps 太高会像抖动或跑步。
6 fps 通常更自然。
```

---

## B6. 更新任何依赖 walking 帧数量的逻辑

搜索：

```text
walk_right_003
walk_left_003
walkRight003
walkLeft003
walk_right frames 4
walk_left frames 4
```

确保：

```text
1. 没有任何旧第 4 帧引用。
2. animationConfig 只引用 3 帧。
3. 没有测试或文档要求 walking 必须 4 帧。
```

---

## B7. Walking 替换验收

必须验证：

```text
[ ] 项目根目录 walking_new_000 / 001 / 002 被正确识别。
[ ] 三张新素材已处理为 true RGBA PNG。
[ ] walk_right 使用新三帧。
[ ] walk_left 由新 walk_right 三帧镜像生成。
[ ] animationConfig 不再引用 walkRight003 / walkLeft003。
[ ] 旧 4 帧 walking 素材不再被使用。
[ ] walk_right 播放自然。
[ ] walk_left 播放自然。
[ ] walking 过程中没有顶部灰线。
[ ] walking 素材没有白底、灰底、棋盘格背景。
[ ] walking movement 仍然正常。
[ ] random walking 仍然正常。
[ ] 右键菜单手动 walk_left / walk_right 仍然正常。
```

---

# Part C：图片处理工具要求

Agent 可新增工具：

```text
tools/inspect_transparency_artifacts.py
tools/clean_cat_asset_alpha.py
tools/replace_walking_assets.py
```

或者合并成一个工具：

```text
tools/prepare_cat_assets.py
```

最低要求：

```text
1. 能检查所有资产是否 true-transparent。
2. 能清理 walking_new 三张图背景。
3. 能镜像生成 walk_left。
4. 能生成报告。
5. 能生成强背景预览。
```

不要使用在线服务。  
不要调用图片生成模型。  
使用本地程序化处理，例如：

```text
Python
Pillow
OpenCV if already available
```

如果依赖缺失，说明安装命令。

---

# Part D：运行时功能保持

完成视觉修复和 walking 替换后，必须确认：

```text
1. npm start 正常。
2. idle / dragging / happy / sleeping / walk_right / walk_left 都能显示。
3. 透明背景正常。
4. 没有顶部灰线。
5. 拖拽正常。
6. 点击 / 双击正常。
7. 右键菜单正常。
8. 托盘正常。
9. 设置面板正常。
10. 随机行为正常。
11. 自动 walking 正常。
12. 手动 walk_left / walk_right 正常。
13. TypeScript 无错误。
14. Renderer console 无 runtime error。
15. Main process terminal 无 runtime error。
```

---

# Part E：Agent 执行 Prompt

```text
We need to implement MochiCat Phase 12: Visual Asset Cleanup and Walking Frame Replacement.

Current project status:
- Phase 11 is complete.
- The app is stable.
- Window snap / Perch Mode has been removed.
- Existing states:
  - idle
  - dragging
  - happy
  - sleeping
  - walk_left
  - walk_right
- Existing features must remain stable:
  - manual dragging
  - click / double-click
  - random behavior
  - walking movement
  - right-click menu
  - tray menu
  - settings panel
  - settings persistence
  - transparent frameless window

Current bugs:
1. In dragging, idle, happy and possibly other states, there is a horizontal gradient gray shadow/border line near the top of the cat image/window. This is unacceptable. It must be fully removed from every state.
2. Current walking animation is unnatural. The old 4 walking frames must be replaced by 3 new walking frames placed in the project root:
   - walking_new_000
   - walking_new_001
   - walking_new_002

Important:
The new walking images are likely not true transparent PNGs. They must be processed into correct transparent-background RGBA PNGs before integration.

Part 1 - Diagnose the top gray gradient line:
Before modifying, inspect:
- all cat PNG assets under src/assets/cat/
- CSS in index.css
- .pet-sprite-image drop-shadow
- .pet-window / body / #root background and overflow
- BrowserWindow transparent/background settings

Determine whether the top gray line is caused by:
- dirty image alpha
- baked-in fake transparent background
- semi-transparent rectangular background
- CSS drop-shadow applied to a polluted rectangular alpha area
- container/window background or shadow
- asset canvas/padding issue

Do not guess. Produce a short root cause explanation.

Part 2 - Add asset artifact inspection:
Create or reuse a script that scans:
- src/assets/cat/idle/
- src/assets/cat/dragging/
- src/assets/cat/happy/
- src/assets/cat/sleeping/
- src/assets/cat/walk_right/
- src/assets/cat/walk_left/

Generate:
processed_assets/visual_artifacts_report.txt

Report for each file:
- filename
- image size
- mode
- has alpha
- transparent pixel ratio
- semi-transparent pixel ratio
- alpha bounding box
- top/left/right/bottom margins
- non-transparent pixels touching edges
- top horizontal band suspected
- large semi-transparent rectangle suspected
- baked-in checkerboard suspected
- pass/fail

Part 3 - Generate preview sheets:
Generate:
- processed_assets/previews/all_states_on_black.png
- processed_assets/previews/all_states_on_green.png
- processed_assets/previews/all_states_on_magenta.png
- processed_assets/previews/all_states_on_blue.png

Each preview should place all current/processed cat frames on solid backgrounds so gray lines and background artifacts are obvious.

Part 4 - Clean asset alpha if needed:
If any asset has dirty alpha, fake transparency, semi-transparent rectangle background, top horizontal gray band, or baked-in checkerboard:
- clean it programmatically
- do not redraw the cat
- do not change pose/style/color/proportions
- preserve whiskers, ears, paws, tail, and fur details
- output true RGBA PNG
- do not overwrite originals until verified
- stage outputs under processed_assets/cat/...
- replace src/assets/cat/... only after verification

If CSS drop-shadow amplifies the issue:
- first fix image alpha
- then reduce or adjust .pet-sprite-image drop-shadow if still necessary
- do not leave any gray horizontal top line in any state

Final requirement:
No state may show the top gradient gray border line:
- idle
- dragging
- happy
- sleeping
- walk_right
- walk_left

Part 5 - Locate new walking source images:
Find in project root:
- walking_new_000.*
- walking_new_001.*
- walking_new_002.*

Allowed extensions:
- png
- jpg
- jpeg
- webp

Do not overwrite or delete the root source files.

Part 6 - Process new walking images:
For each walking_new image:
- verify format
- convert to RGBA PNG
- remove background if not true transparent
- remove fake checkerboard / white / gray / black background
- remove any top gray gradient band if present
- keep the cat unchanged
- save staged files under:
  processed_assets/cat/walk_right_new/

Then copy verified outputs into:
- src/assets/cat/walk_right/walk_right_000.png
- src/assets/cat/walk_right/walk_right_001.png
- src/assets/cat/walk_right/walk_right_002.png

Mapping:
- walking_new_000 -> walk_right_000.png
- walking_new_001 -> walk_right_001.png
- walking_new_002 -> walk_right_002.png

Part 7 - Generate mirrored walk_left:
Create:
- src/assets/cat/walk_left/walk_left_000.png = mirror(walk_right_000.png)
- src/assets/cat/walk_left/walk_left_001.png = mirror(walk_right_001.png)
- src/assets/cat/walk_left/walk_left_002.png = mirror(walk_right_002.png)

The mirrored images must:
- preserve alpha
- preserve dimensions
- have no background
- have no gray top line
- not crop any body part

Part 8 - Remove old 4th walking frame references:
Update animationConfig.ts.

Remove:
- walkRight003
- walkLeft003
- walk_right_003 reference
- walk_left_003 reference

Change walk_right frames from 4 to 3:
frames: [walkRight000, walkRight001, walkRight002]

Change walk_left frames from 4 to 3:
frames: [walkLeft000, walkLeft001, walkLeft002]

Set walking fps to around 6:
walk_right: { fps: 6, loop: true, frames: [...] }
walk_left: { fps: 6, loop: true, frames: [...] }

Search the repo to confirm no references remain to:
- walk_right_003
- walk_left_003
- walkRight003
- walkLeft003

Part 9 - Archive or remove old walking assets:
Old fourth frame files should not be used.
Either delete them or move them to an archive folder.
Do not leave them referenced.

Part 10 - Validation:
Run:
- npm start
- TypeScript check if available

Verify:
1. idle has no top gray gradient line.
2. dragging has no top gray gradient line.
3. happy has no top gray gradient line.
4. sleeping has no top gray gradient line.
5. walk_right has no top gray gradient line.
6. walk_left has no top gray gradient line.
7. No white/gray/checkerboard fake background in any state.
8. New walk_right uses the 3 new walking frames.
9. New walk_left uses mirrored versions of the 3 new frames.
10. animationConfig no longer references old 4th walking frame.
11. walk_right animation plays.
12. walk_left animation plays.
13. manual right-click walk_left / walk_right works.
14. random automatic walking works.
15. dragging still works.
16. double-click happy still works.
17. settings panel still works.
18. tray and context menu still work.
19. renderer console has no runtime errors.
20. main process terminal has no runtime errors.

Before coding:
1. Inspect animationConfig.ts.
2. Inspect index.css.
3. Inspect current src/assets/cat directories.
4. Locate walking_new_000/001/002 in project root.
5. Explain the likely root cause of the gray top line.
6. Explain the asset cleanup strategy.
7. Explain the walking replacement plan.
8. List files to create/modify/delete.
9. Then implement.

After coding:
1. List all processed asset files.
2. List all replaced walking files.
3. List any archived/deleted old walking files.
4. Show summary from visual_artifacts_report.txt.
5. Explain whether the gray line was caused by dirty alpha, CSS, or both.
6. Explain how walking now uses 3 frames.
7. Confirm no state has the gray top line.
```

---

## Phase 12 完成后的提交建议

```bash
git status
git add .
git commit -m "fix: clean cat asset alpha and replace walking frames"
```
