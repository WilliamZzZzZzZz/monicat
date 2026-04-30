# MochiCat Dragging Boundary Bug Fix Prompt

## Task Title

Fix MochiCat manual dragging boundary bug: remove the invisible top-wall limitation.

---

## Background

MochiCat currently has a dragging bug on macOS.

When the user drags the desktop pet, the pet cannot be moved into approximately the top 20% of the desktop. It feels like an invisible horizontal wall blocks the pet from entering the upper part of the screen.

The required behavior is:

```text
The pet should be draggable across the entire visible desktop area.
```

This includes the upper desktop area near the macOS menu bar, as far as macOS allows a frameless Electron window to be positioned.

---

## Current Project Status

The project already includes:

```text
Electron + React + TypeScript + Vite
transparent frameless always-on-top pet window
custom pet dragging
real transparent PNG cat animation assets
states:
- idle
- dragging
- happy
- sleeping
- walk_left
- walk_right

frame animation system
right-click context menu
system tray
settings persistence
size slider panel
random behavior system
walking behavior system
```

Do not break any existing feature.

---

## Core Bug

Manual dragging currently has an incorrect boundary restriction.

Observed behavior:

```text
The pet cannot be dragged into the top ~20% of the desktop.
```

Expected behavior:

```text
The pet can be dragged freely across the whole desktop, including the top area.
```

---

## Important Constraints

Do not rewrite unrelated features.

Preserve:

```text
idle / dragging / happy / sleeping / walk_left / walk_right animations
real transparent PNG assets
pet dragging
right-click menu
tray menu
random behavior
walking behavior
size slider panel
settings persistence
transparent frameless window
```

Preserve Electron security:

```text
contextIsolation: true
nodeIntegration: false
do not expose raw ipcRenderer
```

---

## Investigation Requirements

Before modifying code, inspect the current implementation and identify exactly where the top boundary is introduced.

Check these areas:

```text
1. Renderer drag logic
   - mouse / pointer position calculations
   - drag offset calculation
   - setPosition(x, y)
   - clamp logic
   - use of window.innerHeight / screen.availHeight / display bounds

2. Main process window movement IPC
   - setPosition handler
   - getPosition handler
   - clampPosition helper
   - Electron screen API usage
   - use of display.workArea or display.bounds

3. Walking movement logic
   - ensure walking bounds are not incorrectly reused for manual dragging

4. Size slider / CSS scaling
   - ensure pet size scaling does not corrupt drag coordinates

5. macOS menu bar / Dock bounds
   - check whether workArea is incorrectly used for manual dragging
```

---

## Likely Root Cause

Electron display APIs include:

```text
display.bounds
display.workArea
```

Meaning:

```text
display.bounds:
full display bounds

display.workArea:
usable area excluding menu bar / Dock
```

The bug may be caused by manual dragging using `display.workArea` or an artificial clamp/margin, causing the top area to be blocked.

Manual dragging should be more permissive than autonomous walking.

---

## Required Design Decision

Use separate boundary policies:

```text
Manual user dragging:
- permissive
- allows movement across the whole desktop
- should not impose a large top clamp

Autonomous walking:
- bounded and safe
- should remain inside screen/workArea
- should not walk off-screen
```

Do not reuse strict autonomous walking bounds for manual dragging if those bounds block the upper desktop area.

---

## Correct Dragging Coordinate Model

Use screen/global coordinates for BrowserWindow movement.

Recommended pattern:

```text
On drag start:
1. Get current BrowserWindow position.
2. Get pointer screen coordinates.
3. Compute drag offset:

   offsetX = pointerScreenX - windowX
   offsetY = pointerScreenY - windowY

On pointer move:
1. Read current pointer screen coordinates.
2. Compute new window position:

   newWindowX = pointerScreenX - offsetX
   newWindowY = pointerScreenY - offsetY

3. Move BrowserWindow to:

   setPosition(newWindowX, newWindowY)
```

In the renderer, prefer:

```text
event.screenX
event.screenY
```

Avoid using:

```text
event.clientX
event.clientY
```

for absolute BrowserWindow position unless they are carefully converted.

---

## Possible Fix Option A: Full Display Bounds Clamp

If current code clamps manual drag with `display.workArea`, replace that manual drag clamp with `display.bounds`.

Example:

```ts
const display = screen.getDisplayMatching(mainWindow.getBounds());
const bounds = display.bounds;

const clampedX = Math.max(
  bounds.x,
  Math.min(x, bounds.x + bounds.width - windowWidth)
);

const clampedY = Math.max(
  bounds.y,
  Math.min(y, bounds.y + bounds.height - windowHeight)
);

mainWindow.setPosition(Math.round(clampedX), Math.round(clampedY));
```

This should remove the artificial top wall while still preventing the entire window from becoming inaccessible.

---

## Possible Fix Option B: Direct Manual Set Position

If a full clamp is unnecessary for manual dragging, allow direct positioning:

```ts
mainWindow.setPosition(Math.round(x), Math.round(y));
```

If using this approach, optionally keep only a minimal recovery clamp, but do not block the top 20% of the screen.

---

## What Not To Do

Do not introduce:

```text
arbitrary top margins
magic 20% offsets
large positive y clamp
menu-bar-based artificial padding
workArea-based manual drag boundary if it causes top blocking
```

Do not break autonomous walking bounds while fixing manual dragging.

---

## Multi-Display Guidance

If the project already supports multiple displays, use:

```text
screen.getDisplayMatching(...)
screen.getDisplayNearestPoint(...)
```

appropriately.

Do not assume the primary display if the current implementation already handles multiple displays.

If the app is currently single-display focused, keep the fix simple, but do not introduce new bugs.

---

## Validation Checklist

After fixing, manually verify:

```text
[ ] npm start works.
[ ] Pet can be dragged to the very top of the desktop.
[ ] Pet can be dragged near the macOS menu bar.
[ ] Pet can be dragged to the upper-left area.
[ ] Pet can be dragged to the upper-right area.
[ ] Pet can be dragged to lower-left and lower-right areas.
[ ] The invisible horizontal wall around the top 20% is gone.
[ ] Pet does not jump when dragging starts.
[ ] Dragging remains smooth.
[ ] Dropping and re-dragging still works.
[ ] Walking behavior still respects safe screen bounds.
[ ] Random behavior still works.
[ ] Right-click menu still opens.
[ ] Tray menu still works.
[ ] Size slider still works.
[ ] Size slider does not affect drag coordinates.
[ ] Transparent window remains transparent.
[ ] TypeScript has no errors.
[ ] Renderer console has no runtime errors.
[ ] Main process terminal has no runtime errors.
```

---

## Required Agent Workflow

Before writing code:

```text
1. Inspect current drag-related files.
2. Locate the exact boundary or coordinate calculation causing the top invisible wall.
3. List the files to modify.
4. Explain the root cause.
5. Explain the fix.
6. Then implement.
```

After implementation:

```text
1. List all changed files.
2. Explain how manual dragging coordinates are calculated now.
3. Explain whether manual dragging uses display.bounds, display.workArea, or direct setPosition.
4. Explain how autonomous walking bounds remain safe.
5. Confirm the top 20% invisible wall is removed.
```

---

## Final Agent Prompt

```text
We need to fix a manual dragging boundary bug in MochiCat.

Current bug:
When dragging the desktop pet on macOS, the pet cannot be moved into approximately the top 20% of the desktop. It behaves like an invisible horizontal wall blocks the pet from moving upward.

Goal:
Fix manual dragging so the pet can be dragged freely across the whole visible desktop area, including the upper desktop area near the macOS menu bar.

Do not rewrite unrelated features.
Do not break:
- idle / dragging / happy / sleeping / walk_left / walk_right animations
- real transparent PNG assets
- right-click menu
- tray menu
- random behavior
- walking behavior
- size slider panel
- settings persistence
- transparent frameless window

Keep Electron security:
- contextIsolation: true
- nodeIntegration: false
- do not expose raw ipcRenderer

Before changing code:
1. Inspect the current renderer drag logic.
2. Inspect the main process window movement IPC.
3. Inspect any clampPosition or screen bounds logic.
4. Inspect walking movement bounds logic.
5. Identify exactly where the top boundary is introduced.
6. List files to modify.
7. Explain the root cause and intended fix.

Likely issue:
Manual dragging may be using display.workArea or an artificial top clamp/margin. For manual dragging, use a more permissive boundary policy.

Manual dragging should use screen/global coordinates:
- on drag start, use pointer screen coordinates and BrowserWindow position to compute offset
- on pointer move, compute new window x/y from event.screenX/event.screenY minus the original offset
- do not rely on clientX/clientY for absolute BrowserWindow movement unless carefully converted

Manual dragging and autonomous walking should use different boundary policies:
- manual dragging: permissive, whole desktop
- autonomous walking: bounded and safe, should not walk off-screen

If there is manual drag clamp using display.workArea, replace it with display.bounds or remove the clamp for manual dragging.

Example full-display clamp:
const display = screen.getDisplayMatching(mainWindow.getBounds());
const bounds = display.bounds;

const clampedX = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - windowWidth));
const clampedY = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - windowHeight));

mainWindow.setPosition(Math.round(clampedX), Math.round(clampedY));

Alternatively, if safe in the current app, allow direct manual setPosition:
mainWindow.setPosition(Math.round(x), Math.round(y));

Do not introduce arbitrary top margins, magic offsets, or large y clamps.
Do not use display.workArea for manual dragging if it creates the top invisible wall.

After implementation, verify:
1. npm start works.
2. The pet can be dragged to the top of the desktop.
3. The pet can be dragged near the macOS menu bar.
4. The upper-left and upper-right desktop areas are reachable.
5. The invisible top wall is gone.
6. The pet does not jump when dragging starts.
7. Dragging remains smooth.
8. Walking still respects screen bounds.
9. Random behavior still works.
10. Right-click menu, tray menu, size slider, settings persistence, and animations still work.
11. TypeScript has no errors.
12. Renderer console and main process terminal have no runtime errors.

After finishing:
1. List all changed files.
2. Explain the final manual dragging coordinate calculation.
3. Explain whether manual drag uses display.bounds, display.workArea, or direct setPosition.
4. Explain how walking bounds remain safe.
5. Confirm the top 20% invisible wall is removed.
```
