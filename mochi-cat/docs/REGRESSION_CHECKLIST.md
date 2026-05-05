# Regression Checklist

Run this checklist manually after any significant code change, before merging, and before each release.

Mark each item ✅ or ❌ with a brief note if something is wrong.

---

## Startup

- [ ] `npm start` launches without errors in main process terminal
- [ ] Renderer console has no runtime errors
- [ ] Transparent frameless window appears on screen
- [ ] Cat is visible (idle animation cycling)
- [ ] Window is always-on-top of other windows

---

## Idle

- [ ] Idle animation plays smoothly (3 frames, loop)
- [ ] No gray line visible at top of window
- [ ] No white/gray background behind cat

---

## Dragging

- [ ] Click-and-hold then move — cat enters dragging state (slight scale + rotate)
- [ ] Window follows mouse correctly
- [ ] Releasing mouse — cat returns to idle
- [ ] Drag in top area of window works (not blocked by invisible controls)
- [ ] Drag threshold (4px) prevents accidental drag on click

---

## Clicking / Double-click

- [ ] Single click does nothing unexpected
- [ ] Double-click → happy state, speech bubble shows '喵～'
- [ ] Happy returns to idle after ~2.5s

---

## Right-click Menu

- [ ] Right-click opens native context menu
- [ ] "Pet" → happy state
- [ ] "Feed" → happy state
- [ ] "Grooming" → grooming state
- [ ] "Sleep" → sleeping state with 'Zzz...' bubble
- [ ] "Wake" (while sleeping) → idle
- [ ] "Walk Left" → walk_left animation, window moves left
- [ ] "Walk Right" → walk_right animation, window moves right
- [ ] "Open Settings" → settings panel appears inside window
- [ ] "Reset Position" → window snaps to center screen
- [ ] "Quit" → app exits cleanly

---

## Tray Menu

- [ ] Tray icon visible in macOS menu bar
- [ ] Tray menu opens on click
- [ ] Same actions work from tray as from right-click menu

---

## Settings Panel

- [ ] Settings panel opens and closes correctly
- [ ] Size slider adjusts cat size in real time (96–260 px)
- [ ] Speech bubble toggle shows/hides bubbles
- [ ] Random behavior toggle enables/disables autonomous actions
- [ ] Auto walk toggle enables/disables automatic walking
- [ ] Behavior frequency (low/normal/high) changes behavior rate
- [ ] Walking speed slider changes walk speed
- [ ] Sleep after idle dropdown changes sleep timer
- [ ] Always-on-top toggle works
- [ ] Reset position button works
- [ ] Reset settings button restores defaults
- [ ] Dev debug panel visible in DEV mode (petState, actionKind, etc.)

---

## Size Adjustment

- [ ] Size 96px (minimum) — cat is small, no clipping
- [ ] Size 260px (maximum) — cat is large, no overflow
- [ ] Default 220px looks correct

---

## Always-on-Top

- [ ] Cat stays above all other windows when alwaysOnTop is enabled
- [ ] Cat can be covered by other windows when alwaysOnTop is disabled

---

## Speech Bubble

- [ ] Bubble appears for happy/sleep states
- [ ] Bubble disappears when state changes
- [ ] Bubble does not appear when speechBubbleEnabled is false

---

## Random Behavior

- [ ] In idle, cat randomly triggers happy/grooming/walking/nap
- [ ] Random behavior stops when randomBehaviorEnabled is false
- [ ] Random walking stops when autoWalkEnabled is false
- [ ] Random behavior does not fire while settings panel is open
- [ ] Random behavior respects cooldown after manual action

---

## Inactivity / Sleeping

- [ ] After being idle for configured time, cat falls asleep (Zzz... bubble)
- [ ] Inactivity timer respects `sleepAfterIdleMs` setting
- [ ] No inactivity sleep when `sleepAfterIdleMs` is disabled

---

## Sleeping → Wake

- [ ] Sleeping cat shows sleep animation
- [ ] "Wake" from menu → returns to idle
- [ ] Sleeping → Wake → Walk (menu walkRight) works without error

---

## Grooming

- [ ] Grooming animation plays (4 frames, no loop)
- [ ] Returns to idle after all frames complete
- [ ] Grooming can be triggered from menu and randomly

---

## Walking

- [ ] Walk left — window moves left, walk_left animation plays
- [ ] Walk right — window moves right, walk_right animation plays
- [ ] Walking stops at screen boundary (left or right edge)
- [ ] Walking stops when dragging begins
- [ ] Walking completes and returns to idle

---

## Timer Stale-Token Protection

- [ ] Dispatching walk_right during happy does not cause happy to return to idle after duration
- [ ] Dispatching sleeping during grooming does not cause grooming to return to idle

---

## Settings Persistence

- [ ] Change a setting, quit, relaunch — setting is restored
- [ ] `settings.json` exists in `~/Library/Application Support/mochi-cat/`
- [ ] Corrupt or missing `settings.json` → app starts with defaults

---

## Transparent Background

- [ ] Window background is fully transparent
- [ ] No white/gray border around cat
- [ ] No drop-shadow artifact visible at top of sprite

---

## Asset Validation

- [ ] `npm run test:assets` passes (exit 0)
- [ ] `processed_assets/runtime_asset_validation_report.txt` shows all PASS

---

## Full Validate

- [ ] `npm run validate` exits 0
- [ ] TypeScript compile has no errors
- [ ] ESLint has no errors
- [ ] All unit tests pass
- [ ] All assets pass validation
