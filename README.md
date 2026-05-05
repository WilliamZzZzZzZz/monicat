# MochiCat 🐱

A lightweight macOS desktop pet app featuring a custom animated cat that lives on your screen.

---

## What is MochiCat?

MochiCat is a frameless, transparent, always-on-top macOS desktop pet built with:

- **Electron 41** — native macOS window, system tray, IPC
- **React 19 + TypeScript** — renderer-layer UI and state
- **Vite 5 + Electron Forge** — build pipeline and packaging

The cat animates through a set of states (idle, dragging, happy, sleeping, walking, grooming) controlled by a unified action state machine. All settings persist to disk in `~/Library/Application Support/mochi-cat/settings.json`.

---

## Current States

| State | Kind | Trigger |
|-------|------|---------|
| `idle` | persistent | default |
| `dragging` | interactionOverride | pointer drag |
| `happy` | oneShot | double-click, menu, random |
| `sleeping` | persistent | inactivity timer, menu, random |
| `walk_right` | locomotion | menu, random |
| `walk_left` | locomotion | menu, random |
| `grooming` | oneShot | menu, random |

---

## Project Structure

```
monicat/
  mochi-cat/          ← Electron app (npm project root)
    src/
      actions/        ← action registry + types
      animation/      ← frame-based animation config
      assets/cat/     ← runtime PNG assets
      behavior/       ← random behavior config + types
      components/     ← React UI components
      debug/          ← dev-only debug flags
      hooks/          ← business-logic hooks (state machine, walking, random)
      main/           ← Electron main process + settings service
      types/          ← shared TypeScript types
    docs/             ← developer documentation
  tools/              ← Python asset processing scripts
  processed_assets/   ← processed asset outputs + validation reports
  spec/               ← phase requirement documents
  image_src/          ← raw / source artwork (not shipped)
```

---

## Install & Run

```bash
cd mochi-cat
npm install
npm start
```

---

## Available Scripts

From the `mochi-cat/` directory:

| Command | Description |
|---------|-------------|
| `npm start` | Launch in development mode |
| `npm run typecheck` | TypeScript compile check (no emit) |
| `npm run lint` | ESLint (`.ts`, `.tsx`) |
| `npm run test` | Run unit tests (Vitest, single pass) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:assets` | Validate runtime PNG assets via Python |
| `npm run validate` | typecheck + lint + test + test:assets |
| `npm run make` | Build distributable (`.app` / `.zip`) |

---

## Adding a New Action

1. **Add assets** to `src/assets/cat/<state>/` following the asset pipeline (see [docs/ASSET_PIPELINE.md](mochi-cat/docs/ASSET_PIPELINE.md)).
2. **Add animation config** entry in `src/animation/animationConfig.ts`.
3. **Extend `PetState`** in `src/types/pet.ts`.
4. **Register the action** in `src/actions/actionRegistry.ts` with the correct `kind`, `defaultDurationMs`, etc.
5. **Wire triggers** in `src/App.tsx` (menu handler, double-click, etc.).
6. **Update `PET_STATE_EMOJI`** in `src/types/pet.ts`.
7. **Update** `validate_runtime_assets.py` `ANIMATION_STATES` dict.

See [docs/ACTION_SYSTEM.md](mochi-cat/docs/ACTION_SYSTEM.md) for full details.

---

## Processing New Assets

1. Place raw frames in `image_src/`.
2. Run the relevant cleaning script from `tools/`:
   - `python3 tools/clean_cat_asset_alpha.py` — general alpha cleanup
   - `python3 tools/remove_checkerboard_background.py` — remove Photoshop checkerboard
3. Copy cleaned PNGs to `mochi-cat/src/assets/cat/<state>/`.
4. Run `npm run test:assets` to validate.

See [docs/ASSET_PIPELINE.md](mochi-cat/docs/ASSET_PIPELINE.md) for full details.

---

## Historical Notes

**Perch Mode / Window Snap** was explored in Phase 9 and removed in Phase 10. It is NOT a current feature and should NOT be re-introduced without an explicit spec.

---

## Docs

- [docs/ARCHITECTURE.md](mochi-cat/docs/ARCHITECTURE.md) — Main / Preload / Renderer layers, IPC security
- [docs/ACTION_SYSTEM.md](mochi-cat/docs/ACTION_SYSTEM.md) — State machine, action registry, dispatch rules
- [docs/ASSET_PIPELINE.md](mochi-cat/docs/ASSET_PIPELINE.md) — Asset processing, validation, runtime path
- [docs/TESTING.md](mochi-cat/docs/TESTING.md) — Test framework, how to run tests
- [docs/REGRESSION_CHECKLIST.md](mochi-cat/docs/REGRESSION_CHECKLIST.md) — Manual QA checklist
