# Testing

MochiCat uses [Vitest](https://vitest.dev/) for unit and integration tests.

---

## Test Framework

| Package | Role |
|---------|------|
| `vitest` | Test runner + assertions |
| `jsdom` | Browser-like DOM environment for hooks |
| `@testing-library/react` | `renderHook` + `act` for React hook tests |
| `@testing-library/jest-dom` | Extended DOM matchers |

Config: `mochi-cat/vitest.config.ts`

---

## Running Tests

From the `mochi-cat/` directory:

```bash
# Single pass (CI / pre-commit)
npm run test

# Watch mode (development)
npm run test:watch

# Validate runtime PNG assets
npm run test:assets

# Full validation suite (typecheck + lint + test + test:assets)
npm run validate
```

---

## What Is Covered by Unit Tests

| Test File | What It Tests |
|-----------|--------------|
| `src/actions/actionRegistry.test.ts` | Registry completeness, ActionKind classification, oneShot/locomotion contract, random trigger policy, blocksRandomBehavior values |
| `src/hooks/usePetActionController.test.tsx` | Initial state, happy/grooming oneShot timers, stale timer protection (action tokens), inactivity timer, dragging lifecycle, random dispatch rules, menu interrupt rules, sleeping→wake→walk flow |
| `src/hooks/randomBehaviorPolicy.test.ts` | canRunRandomBehavior guards (disabled, hidden, panel open, wrong state, cooldowns), selectIdleBehavior (behavior selection, autoWalkEnabled, per-behavior cooldowns), selectSleepingBehavior |
| `src/main/settings.test.ts` | clampSize, clampNumber, normalizeBehaviorFrequency, normalizeSleepAfterIdle, normalizeSettings (range clamping, min≤max), migrateAndMerge (legacy enum migration, defaults, invalid values), DEFAULT_SETTINGS integrity |
| `src/hooks/walkingMovementPolicy.test.ts` | computeWalkXRange (boundary math, real windowWidth used not 300), clampToWorkArea, hasHitBoundary, computeTargetX, normalizeWalkingDuration (min≤max), safeWalkingSpeed |

---

## What Still Requires Manual Testing

The following cannot be easily automated without a full Electron E2E setup:

- Transparent window rendering (visual check)
- CSS-level animation (frame display, scale, rotation)
- Drag threshold behaviour (pointer capture, DRAG_START_THRESHOLD_PX)
- Walking RAF animation (smooth movement on screen)
- System tray icon and native menus
- Window `alwaysOnTop` behaviour across apps
- Settings persistence across app restarts
- `window:visibility-changed` push event handling
- Actual PNG asset rendering (no gray lines, no artifacts)

Use the manual checklist in [REGRESSION_CHECKLIST.md](REGRESSION_CHECKLIST.md) after every significant change.

---

## Asset Validation

`npm run test:assets` runs `tools/validate_runtime_assets.py`, which:

1. Checks that every runtime PNG referenced by `animationConfig.ts` exists.
2. Verifies each PNG has a true alpha channel.
3. Detects fake-transparent backgrounds (checkerboard, solid white/gray/black).
4. Detects top gray bands.
5. Checks alpha bounding box does not touch edges.
6. Verifies frame dimensions are consistent within each state.
7. Writes report to `processed_assets/runtime_asset_validation_report.txt`.
8. Exits non-zero on any failure, blocking `npm run validate`.

---

## CI

A GitHub Actions workflow at `.github/workflows/validate.yml` runs `npm run validate` on every push and pull request. This ensures typecheck, lint, unit tests, and asset validation all pass before merging.
