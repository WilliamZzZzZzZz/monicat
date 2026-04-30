# MochiCat Phase 6 开发文档：真实猫咪动画素材接入与基础设置持久化

版本：v0.1  
阶段：Phase 6  
前置条件：Phase 5 已完成；右键菜单和系统托盘已经可用；四种状态的真实猫咪连续帧图片已经生成，但目前只是放在工程最外层目录，尚未替换项目中的简陋占位图。  
目标：将真实猫咪连续帧图片正确接入动画系统，并在此基础上实现基础设置持久化。  
开发方式：VS Code + Codex + GitHub Copilot  
当前阶段原则：先完成真实素材替换与验证，再实现设置持久化。不要新增复杂功能，不要重构已稳定的 Phase 5 菜单和托盘系统。

---

## 1. Phase 6 的目标

Phase 6 分成两个子任务：

```text
Phase 6A：真实猫咪动画素材接入
Phase 6B：基础设置持久化
```

其中 Phase 6A 是当前最优先任务。

当前项目已经完成：

```text
Phase 0：Electron + React + TypeScript 工程初始化
Phase 1：透明无边框置顶窗口
Phase 2：自定义拖拽
Phase 3：基础状态机与交互反馈
Phase 4：帧动画系统
Phase 5：右键菜单与系统托盘
```

但当前真实猫咪图片只是放在工程最外层目录中，并没有进入正确的资源目录，也没有替换 `animationConfig` 中的占位资源。

Phase 6 首先要解决：

```text
把真实猫咪图片放到正确的 assets/cat/... 目录
按状态和帧编号命名
修改 animationConfig
删除或弃用原来的简陋占位图
确认四种状态播放真实猫咪连续帧
```

然后再做：

```text
保存基础用户设置
重启应用后恢复设置
```

---

## 2. 当前项目状态

当前项目应已具备：

```text
Electron + React + TypeScript + Vite 项目可以启动
窗口透明、无边框、置顶
宠物可以拖拽
宠物有四种状态：
- idle
- dragging
- happy
- sleeping

动画系统已经存在：
- animationConfig
- useAnimation
- PetSprite

菜单和托盘已经存在：
- 右键菜单
- 托盘图标
- 显示 / 隐藏
- 退出
- 菜单触发 happy / sleeping 等状态
```

当前问题：

```text
真实猫咪连续帧图片已经生成
但图片目前放在工程最外层目录
还没有移动到正确资源入口
还没有替换原来的简陋占位图
animationConfig 可能仍然引用旧资源
```

---

## 3. Phase 6 不做什么

本阶段禁止实现：

```text
新的动画状态
walk_left / walk_right
eat / play / angry / curious
复杂情绪值系统
复杂随机行为
多皮肤系统
AI 对话
云端同步
打包 dmg
自动更新
完整偏好设置界面
```

本阶段也不要重构：

```text
Phase 2 拖拽逻辑
Phase 4 动画 hook 核心逻辑
Phase 5 菜单和托盘逻辑
Electron 安全设置
```

除非现有代码存在明确 bug，否则不要大范围改动。

---

# Phase 6A：真实猫咪动画素材接入

---

## 4. Phase 6A 目标

Phase 6A 的核心目标是：

> 将工程最外层目录中的真实猫咪连续帧图片，整理到正确的资源目录，并让动画系统播放这些真实图片，而不是继续播放占位图。

完成后应满足：

```text
idle 状态播放真实 idle 三帧
dragging 状态播放真实 dragging 三帧
happy 状态播放真实 happy 三帧
sleeping 状态播放真实 sleeping 三帧
右键菜单触发状态后也播放真实图片
托盘菜单触发状态后也播放真实图片
```

---

## 5. 目标资源目录结构

请将真实猫咪图片整理为如下结构：

```text
src/assets/cat/
├── idle/
│   ├── idle_000.png
│   ├── idle_001.png
│   └── idle_002.png
├── dragging/
│   ├── dragging_000.png
│   ├── dragging_001.png
│   └── dragging_002.png
├── happy/
│   ├── happy_000.png
│   ├── happy_001.png
│   └── happy_002.png
└── sleeping/
    ├── sleeping_000.png
    ├── sleeping_001.png
    └── sleeping_002.png
```

如果当前项目资源目录不是 `src/assets/cat/`，Codex 应先检查现有 `animationConfig` 的资源引用方式，并选择与当前工程最一致的路径。

原则：

```text
1. 优先沿用 Phase 4 已经可用的资源目录。
2. 不要创造多个重复 assets 目录。
3. 不要把图片继续留在工程最外层作为运行资源。
4. 不要在 animationConfig 中引用杂乱路径。
```

---

## 6. 图片文件要求

真实猫咪图片应满足：

```text
格式：PNG
背景：透明
每个状态 3 张连续帧
单只猫完整入镜
同一画风
同一角色
同一画布尺寸或至少视觉尺寸一致
```

如果图片是 JPG、JPEG、WebP 或带棋盘格背景的 PNG，Codex 不应盲目接入。  
应该提示开发者这些图片不符合最终要求，或者先以临时测试方式接入。

### 6.1 透明背景检查

要确认：

```text
透明背景是真 alpha 通道
不是画在图片里的棋盘格
不是白底
不是灰底
```

如果接入后出现棋盘格、白色方块或灰色方块，说明图片不是正确透明图，需要重新导出或去背景。

---

## 7. 图片移动与重命名规则

如果工程最外层目录中的真实图片命名不规范，Codex 应将它们重命名为规范名称。

推荐映射：

```text
idle 第 1 帧 -> src/assets/cat/idle/idle_000.png
idle 第 2 帧 -> src/assets/cat/idle/idle_001.png
idle 第 3 帧 -> src/assets/cat/idle/idle_002.png

dragging 第 1 帧 -> src/assets/cat/dragging/dragging_000.png
dragging 第 2 帧 -> src/assets/cat/dragging/dragging_001.png
dragging 第 3 帧 -> src/assets/cat/dragging/dragging_002.png

happy 第 1 帧 -> src/assets/cat/happy/happy_000.png
happy 第 2 帧 -> src/assets/cat/happy/happy_001.png
happy 第 3 帧 -> src/assets/cat/happy/happy_002.png

sleeping 第 1 帧 -> src/assets/cat/sleeping/sleeping_000.png
sleeping 第 2 帧 -> src/assets/cat/sleeping/sleeping_001.png
sleeping 第 3 帧 -> src/assets/cat/sleeping/sleeping_002.png
```

重要：

```text
不要删除原始图片，除非用户明确要求。
可以先复制到 src/assets/cat/...，确认运行正常后再决定是否清理最外层原图。
```

---

## 8. animationConfig 替换规则

Phase 6A 需要修改 `animationConfig.ts`，让它引用真实猫咪 PNG。

推荐使用 Vite 的 `new URL(..., import.meta.url).href`。

示例：

```ts
const idle000 = new URL('../assets/cat/idle/idle_000.png', import.meta.url).href;
const idle001 = new URL('../assets/cat/idle/idle_001.png', import.meta.url).href;
const idle002 = new URL('../assets/cat/idle/idle_002.png', import.meta.url).href;

const dragging000 = new URL('../assets/cat/dragging/dragging_000.png', import.meta.url).href;
const dragging001 = new URL('../assets/cat/dragging/dragging_001.png', import.meta.url).href;
const dragging002 = new URL('../assets/cat/dragging/dragging_002.png', import.meta.url).href;

const happy000 = new URL('../assets/cat/happy/happy_000.png', import.meta.url).href;
const happy001 = new URL('../assets/cat/happy/happy_001.png', import.meta.url).href;
const happy002 = new URL('../assets/cat/happy/happy_002.png', import.meta.url).href;

const sleeping000 = new URL('../assets/cat/sleeping/sleeping_000.png', import.meta.url).href;
const sleeping001 = new URL('../assets/cat/sleeping/sleeping_001.png', import.meta.url).href;
const sleeping002 = new URL('../assets/cat/sleeping/sleeping_002.png', import.meta.url).href;
```

示例配置：

```ts
export const animationConfig: AnimationConfig = {
  idle: {
    fps: 4,
    loop: true,
    frames: [idle000, idle001, idle002],
  },
  dragging: {
    fps: 6,
    loop: true,
    frames: [dragging000, dragging001, dragging002],
  },
  happy: {
    fps: 6,
    loop: true,
    frames: [happy000, happy001, happy002],
  },
  sleeping: {
    fps: 3,
    loop: true,
    frames: [sleeping000, sleeping001, sleeping002],
  },
};
```

fps 可根据实际效果微调：

```text
idle: 3-5 fps
dragging: 5-8 fps
happy: 5-8 fps
sleeping: 2-4 fps
```

---

## 9. PetSprite 显示尺寸校准

真实图片接入后，可能出现：

```text
猫太大
猫太小
猫被裁切
猫在窗口中偏上 / 偏下
阴影太重
拖拽命中区域不舒服
```

Phase 6A 可以微调 CSS，但不要重构组件。

推荐检查：

```css
.pet-sprite-button {
  width: 220px;
  height: 220px;
}

.pet-sprite-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

如果真实图片主体较大，可以调整为：

```css
.pet-sprite-button {
  width: 240px;
  height: 240px;
}
```

如果窗口仍为 300 x 300，建议不要超过 260 x 260。

---

## 10. Phase 6A 验收标准

完成真实素材接入后，逐项检查：

```text
[ ] npm start 可以正常启动。
[ ] 桌面宠物仍然透明、无边框、置顶。
[ ] idle 状态播放真实猫咪 idle 三帧。
[ ] dragging 状态播放真实猫咪 dragging 三帧。
[ ] happy 状态播放真实猫咪 happy 三帧。
[ ] sleeping 状态播放真实猫咪 sleeping 三帧。
[ ] 双击触发 happy 时播放真实 happy 图片。
[ ] 拖拽时播放真实 dragging 图片。
[ ] 无操作进入 sleeping 时播放真实 sleeping 图片。
[ ] 右键菜单触发 happy / sleeping 时播放真实图片。
[ ] 托盘菜单触发状态时播放真实图片。
[ ] 没有白底、灰底、棋盘格背景。
[ ] 图片没有明显裁切。
[ ] 图片尺寸在 300 x 300 窗口中合适。
[ ] TypeScript 没有编译错误。
[ ] Console 没有图片加载 404。
```

---

# Phase 6B：基础设置持久化

---

## 11. Phase 6B 目标

在真实素材接入完成后，实现基础设置持久化。

目标：

```text
将用户基础设置保存到 Electron userData/settings.json
应用重启后读取 settings.json
根据设置恢复窗口和 UI 行为
```

本阶段只做基础设置，不做完整设置面板。

---

## 12. Phase 6B 要持久化的设置

建议先持久化以下字段：

```ts
export interface UserSettings {
  petSize: 'small' | 'medium' | 'large';
  alwaysOnTop: boolean;
  speechBubbleEnabled: boolean;
  randomBehaviorEnabled: boolean;
}
```

默认设置：

```ts
export const defaultSettings: UserSettings = {
  petSize: 'medium',
  alwaysOnTop: true,
  speechBubbleEnabled: true,
  randomBehaviorEnabled: true,
};
```

暂不持久化：

```text
clickThrough
launchAtLogin
theme
skin
audio
AI settings
```

这些放到后续阶段。

---

## 13. SettingsService 设计

建议在 main process 中新增：

```text
src/main/settings.ts
```

职责：

```text
1. 确定 settings.json 路径。
2. 读取 settings.json。
3. 如果文件不存在，返回 defaultSettings。
4. 如果文件损坏，返回 defaultSettings。
5. 保存 settings。
6. 合并 partial settings。
```

settings 文件路径：

```ts
path.join(app.getPath('userData'), 'settings.json')
```

SettingsService 接口建议：

```ts
class SettingsService {
  load(): UserSettings;
  save(settings: UserSettings): void;
  update(partial: Partial<UserSettings>): UserSettings;
  reset(): UserSettings;
}
```

---

## 14. Settings IPC 设计

新增 IPC channels：

```ts
export const IPC_CHANNELS = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',
} as const;
```

Main process handler：

```ts
ipcMain.handle('settings:get', () => {
  return settingsService.load();
});

ipcMain.handle('settings:update', (_event, partialSettings: Partial<UserSettings>) => {
  return settingsService.update(partialSettings);
});

ipcMain.handle('settings:reset', () => {
  return settingsService.reset();
});
```

---

## 15. Preload Settings API

在 preload 中暴露：

```ts
window.mochiCat.settings.get()
window.mochiCat.settings.update(partialSettings)
window.mochiCat.settings.reset()
```

示例：

```ts
settings: {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (partialSettings: Partial<UserSettings>) =>
    ipcRenderer.invoke('settings:update', partialSettings),
  reset: () => ipcRenderer.invoke('settings:reset'),
}
```

安全要求：

```text
不要暴露原始 ipcRenderer
不要允许 renderer 任意指定 channel
不要打开 nodeIntegration
不要关闭 contextIsolation
```

---

## 16. Renderer 应用设置

App 启动时：

```text
1. 调用 window.mochiCat.settings.get()
2. 将 settings 存入 React state
3. 根据 settings 控制 UI
```

需要影响：

```text
petSize -> PetSprite 显示尺寸 class
speechBubbleEnabled -> 是否显示气泡
randomBehaviorEnabled -> 如果当前已有随机行为，则控制随机行为；如果还没有，可以先保留字段
alwaysOnTop -> 调用 main process 更新窗口置顶
```

注意：

```text
Phase 6 不强制创建完整设置面板。
可以先通过右键菜单增加几个 toggle 项。
```

---

## 17. 右键菜单与设置联动

Phase 6 可以扩展 Phase 5 菜单，增加：

```text
尺寸
  小
  中
  大
---
气泡开关
始终置顶开关
```

建议菜单项：

```text
尺寸：小
尺寸：中
尺寸：大
显示气泡：开/关
始终置顶：开/关
```

行为：

```text
点击尺寸 -> settings:update({ petSize })
点击显示气泡 -> settings:update({ speechBubbleEnabled })
点击始终置顶 -> settings:update({ alwaysOnTop }) + mainWindow.setAlwaysOnTop(...)
```

如果本阶段想降低复杂度，可以先只持久化，不扩展菜单 UI。  
但建议至少做 `petSize` 和 `speechBubbleEnabled` 的菜单入口，方便验证设置是否生效。

---

## 18. petSize 显示规则

建议 CSS：

```css
.pet-window.size-small .pet-sprite-button {
  width: 180px;
  height: 180px;
}

.pet-window.size-medium .pet-sprite-button {
  width: 220px;
  height: 220px;
}

.pet-window.size-large .pet-sprite-button {
  width: 260px;
  height: 260px;
}
```

App 中：

```tsx
<main className={`pet-window size-${settings.petSize}`}>
  ...
</main>
```

如果设置尚未加载：

```text
使用 medium 作为默认值。
```

---

## 19. speechBubbleEnabled 规则

`showBubble(text)` 中应判断：

```ts
if (!settings.speechBubbleEnabled) return;
```

或者在 render 时判断：

```tsx
{settings.speechBubbleEnabled && (
  <SpeechBubble ... />
)}
```

推荐在 `showBubble` 中处理，避免状态无意义更新。

---

## 20. alwaysOnTop 规则

如果已有窗口置顶 IPC，可复用。  
如果没有，需要新增：

```text
window:set-always-on-top
```

Main process：

```ts
ipcMain.handle('window:set-always-on-top', (_event, enabled: boolean) => {
  mainWindow.setAlwaysOnTop(enabled, 'floating');
});
```

当 settings 更新 `alwaysOnTop` 时，应同步调用该逻辑。

---

## 21. Phase 6 完整 Codex 执行任务 Prompt

可以直接把以下内容交给 Codex：

```text
We have completed Phase 5 of MochiCat.

Current project status:
- Electron + React + TypeScript + Vite app is running.
- The app shows a transparent frameless always-on-top desktop pet window.
- The pet can be dragged.
- The app has four PetState values:
  - idle
  - dragging
  - happy
  - sleeping
- The frame-based animation system works.
- Native context menu and system tray are implemented.
- Real cat frame images for idle, dragging, happy, and sleeping have been generated, but they are currently placed in the project root / outer folder and have not yet replaced the placeholder images in the actual animation asset directories.

Current phase:
Phase 6 - Real Cat Asset Integration and Basic Settings Persistence

Primary goal:
First, correctly integrate the real cat animation frame images into the animation system. Then add basic settings persistence.

Part A - Real Cat Asset Integration:
1. Inspect the current project structure.
2. Locate the existing animationConfig and current placeholder asset paths.
3. Locate the real cat images currently placed in the project outer/root folder.
4. Copy the real images into the correct asset structure:
   src/assets/cat/idle/idle_000.png
   src/assets/cat/idle/idle_001.png
   src/assets/cat/idle/idle_002.png
   src/assets/cat/dragging/dragging_000.png
   src/assets/cat/dragging/dragging_001.png
   src/assets/cat/dragging/dragging_002.png
   src/assets/cat/happy/happy_000.png
   src/assets/cat/happy/happy_001.png
   src/assets/cat/happy/happy_002.png
   src/assets/cat/sleeping/sleeping_000.png
   src/assets/cat/sleeping/sleeping_001.png
   src/assets/cat/sleeping/sleeping_002.png
5. If the real images have different names, rename the copied files to match this convention.
6. Do not delete the original root-folder images unless explicitly asked.
7. Update animationConfig to reference the real PNG files.
8. Prefer new URL(..., import.meta.url).href for Vite asset paths.
9. Remove or stop referencing the old placeholder images.
10. Verify all four states use the real cat frames.
11. Preserve Phase 5 context menu and tray behavior.
12. Preserve Phase 2 dragging behavior.
13. Preserve Electron security settings.

Part B - Basic Settings Persistence:
1. Add a UserSettings type:
   - petSize: 'small' | 'medium' | 'large'
   - alwaysOnTop: boolean
   - speechBubbleEnabled: boolean
   - randomBehaviorEnabled: boolean
2. Add defaultSettings:
   - petSize: 'medium'
   - alwaysOnTop: true
   - speechBubbleEnabled: true
   - randomBehaviorEnabled: true
3. Implement SettingsService in the main process.
4. Store settings in Electron userData/settings.json.
5. Add IPC handlers:
   - settings:get
   - settings:update
   - settings:reset
6. Expose safe preload APIs:
   - window.mochiCat.settings.get()
   - window.mochiCat.settings.update(partialSettings)
   - window.mochiCat.settings.reset()
7. Do not expose raw ipcRenderer.
8. Load settings on renderer startup.
9. Apply petSize to PetSprite display size.
10. Apply speechBubbleEnabled so bubbles can be disabled.
11. Apply alwaysOnTop to BrowserWindow.
12. If practical, add simple context menu items for:
   - Size: small / medium / large
   - Toggle speech bubbles
   - Toggle always on top
13. Do not implement a full settings panel yet.
14. Do not implement click-through or launch-at-login yet.

Before writing code:
1. Inspect the current project structure.
2. List the files you will create or modify.
3. Explain the asset replacement plan.
4. Explain the settings persistence data flow.
5. Then implement the changes.

After implementation:
1. Explain how to run the app.
2. Explain how to verify real cat assets are correctly loaded.
3. Explain how to verify settings persistence works after restart.
4. List all files changed.
```

---

## 22. 推荐 Codex 修改步骤

Codex 应按以下顺序执行：

```text
1. 查看当前项目结构。
2. 找到真实猫咪图片所在的最外层目录。
3. 找到 Phase 4 的 animationConfig。
4. 找到当前占位图片资源目录。
5. 创建或确认 src/assets/cat/idle 等目录。
6. 复制真实图片到正确目录。
7. 按规范重命名真实图片。
8. 更新 animationConfig。
9. 运行 npm start，确认真实图片播放。
10. 如有尺寸问题，只微调 PetSprite CSS。
11. 再实现 SettingsService。
12. 增加 settings IPC。
13. 增加 preload settings API。
14. 增加 renderer settings state。
15. 应用 petSize / speechBubbleEnabled / alwaysOnTop。
16. 如果时间允许，扩展右键菜单设置项。
17. 重启应用验证设置持久化。
```

---

## 23. Phase 6 验收标准

### 23.1 真实素材接入验收

```text
[ ] 真实猫咪图片已复制到 src/assets/cat 对应目录。
[ ] 根目录原图没有被误删。
[ ] animationConfig 不再引用旧占位图。
[ ] idle 播放真实 idle 三帧。
[ ] dragging 播放真实 dragging 三帧。
[ ] happy 播放真实 happy 三帧。
[ ] sleeping 播放真实 sleeping 三帧。
[ ] 右键菜单触发状态时播放真实图片。
[ ] 托盘菜单触发状态时播放真实图片。
[ ] 无 404 图片加载错误。
[ ] 背景透明，没有白底或棋盘格。
[ ] 图片大小适合 300 x 300 窗口。
```

### 23.2 设置持久化验收

```text
[ ] settings.json 会在 Electron userData 目录生成。
[ ] 第一次启动时使用 defaultSettings。
[ ] 修改 petSize 后 UI 尺寸变化。
[ ] 重启应用后 petSize 保持修改后的值。
[ ] 修改 speechBubbleEnabled 后气泡开关生效。
[ ] 重启应用后 speechBubbleEnabled 保持。
[ ] 修改 alwaysOnTop 后窗口置顶行为变化。
[ ] 重启应用后 alwaysOnTop 保持。
[ ] TypeScript 无编译错误。
[ ] Renderer Console 无明显报错。
[ ] Main process 终端无明显报错。
```

---

## 24. 手动测试流程

### 24.1 启动应用

```bash
npm start
```

观察：

```text
桌面宠物是否显示真实猫咪图，而不是旧占位图。
```

### 24.2 测试四种状态真实图片

操作：

```text
等待 idle
按住拖拽
双击触发 happy
等待进入 sleeping
右键菜单触发 happy / sleeping
托盘菜单触发状态
```

预期：

```text
所有状态都播放真实猫咪连续帧。
```

### 24.3 测试设置持久化

操作：

```text
1. 修改尺寸为 large。
2. 关闭应用。
3. 重新 npm start。
```

预期：

```text
宠物仍然是 large。
```

再测试：

```text
1. 关闭 speech bubbles。
2. 触发 happy / sleep。
3. 重启应用。
4. 再触发状态。
```

预期：

```text
气泡仍然关闭。
```

---

## 25. 常见问题与处理

### 25.1 仍然显示占位图

可能原因：

```text
animationConfig 仍然引用旧路径
真实图片没有放到实际被引用的目录
Vite 缓存未刷新
文件名不匹配
```

处理：

```text
1. 检查 animationConfig。
2. 检查真实文件路径。
3. 检查大小写。
4. 重启 npm start。
```

---

### 25.2 图片加载 404

处理：

```text
1. 确认 new URL 的相对路径是否正确。
2. 确认文件真实存在。
3. 确认文件名大小写一致。
4. 查看 DevTools Network / Console。
```

---

### 25.3 图片有棋盘格背景

原因：

```text
图片不是透明 PNG，而是带棋盘格图案的普通图片。
```

处理：

```text
重新导出带 alpha 通道的透明 PNG。
不要在代码中尝试解决棋盘格问题。
```

---

### 25.4 设置文件未生成

可能原因：

```text
SettingsService 没有 save
settings:update 没有被调用
userData 路径没写入权限
main process handler 没注册
```

处理：

```text
1. 在 main process 打印 settings path。
2. 确认 settings:update 被触发。
3. 确认 fs.writeFileSync 或异步写入成功。
```

---

### 25.5 重启后设置丢失

可能原因：

```text
启动时没有 load settings
renderer 没有调用 settings:get
保存时只改了 React state，没有写 settings.json
```

处理：

```text
确保 main process 是设置的权威来源。
renderer 启动时从 main process 获取设置。
```

---

## 26. 代码质量要求

Phase 6 代码应满足：

```text
1. 真实素材资源路径清晰。
2. animationConfig 只引用规范 assets/cat 目录。
3. 不再引用旧占位图。
4. SettingsService 只在 main process 访问文件系统。
5. renderer 不直接访问 fs。
6. preload 只暴露受限 settings API。
7. 不打开 nodeIntegration。
8. 不关闭 contextIsolation。
9. 不破坏菜单和托盘。
10. 不破坏拖拽和动画系统。
```

---

## 27. Phase 6 完成后的 Git 提交建议

如果 Phase 6 验收通过，执行：

```bash
git status
git add .
git commit -m "feat: integrate real cat assets and persist settings"
```

---

## 28. 下一阶段预告

Phase 6 完成后建议进入：

```text
Phase 7 - Random Behavior and Lightweight Autonomy
```

Phase 7 可以实现：

```text
1. 每隔一段时间随机触发 happy / sleep / idle。
2. 如果 randomBehaviorEnabled 为 false，则关闭随机行为。
3. 后续再扩展 walk_left / walk_right。
4. 增加轻量“有生命感”的行为节奏。
```

在 Phase 7 之前，不建议新增更多图片状态。  
先确认真实素材接入和设置持久化完全稳定。
