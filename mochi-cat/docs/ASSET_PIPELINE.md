# Asset Pipeline

MochiCat uses a multi-stage asset pipeline to ensure runtime PNGs are truly transparent, free from visual artifacts, and correctly sized.

---

## Directory Roles

| Path | Purpose |
|------|---------|
| `image_src/` | Raw / source artwork (not shipped, not committed). Place original PNGs here. |
| `processed_assets/` | Processed frames + validation reports. Not shipped to users. |
| `mochi-cat/src/assets/cat/` | **Runtime assets** — only PNGs here are shipped in the app. |

**Never copy unprocessed images directly into `src/assets/cat/`.**

---

## Runtime Asset Layout

```
src/assets/cat/
  idle/         idle_000.png  idle_001.png  idle_002.png
  dragging/     dragging_000.png  ...
  happy/        happy_000.png  ...
  sleeping/     sleeping_000.png  ...
  walk_right/   walk_right_000.png  ...
  walk_left/    walk_left_000.png  ...
  grooming/     grooming_000.png  grooming_001.png  grooming_002.png  grooming_003.png
```

Each state has frames named `<state>_NNN.png`, zero-indexed.

---

## Processing New Assets

### Step 1 — Clean alpha

Remove fake-transparent checkerboard or solid backgrounds:

```bash
python3 tools/remove_checkerboard_background.py
# or
python3 tools/clean_cat_asset_alpha.py
```

### Step 2 — Prepare state-specific frames

For grooming or other multi-pose states:

```bash
python3 tools/prepare_grooming_assets.py
```

### Step 3 — Inspect bounds and transparency

```bash
python3 tools/inspect_asset_bounds.py
python3 tools/inspect_transparency_artifacts.py
```

### Step 4 — Copy to runtime

Copy the final cleaned PNGs to `mochi-cat/src/assets/cat/<state>/`.

### Step 5 — Validate

```bash
cd mochi-cat && npm run test:assets
```

This runs `tools/validate_runtime_assets.py`, which writes a report to `processed_assets/runtime_asset_validation_report.txt` and exits non-zero if any check fails.

---

## What validate_runtime_assets.py Checks

For each runtime frame:

- File exists on disk
- PNG has alpha channel (mode RGBA / LA)
- Transparent pixel ratio ≥ 5 %
- No large uniform white / gray / black background (> 60 % of pixels)
- No top horizontal gray band (common from drop-shadow CSS artifacts)
- Alpha bounding box does not touch the image edge (would clip the sprite)
- No Photoshop checkerboard pattern (fake transparency)
- Frame dimensions are consistent within each animation state

If any check fails, the report shows `FAIL` for that file and the script exits with a non-zero code.

---

## Generating Preview Images

Use the existing tool to generate previews on multiple background colors:

```bash
python3 tools/inspect_asset_bounds.py
```

Previews are written to `processed_assets/previews/`.

---

## Adding a New Action's Assets

1. Create `mochi-cat/src/assets/cat/<new_state>/` directory.
2. Name frames `<new_state>_000.png`, `<new_state>_001.png`, …
3. Process through the pipeline above.
4. Register frames in `src/animation/animationConfig.ts`.
5. Add the state to `ANIMATION_STATES` in `tools/validate_runtime_assets.py`.
6. Run `npm run test:assets` to confirm.

---

## Top Gray Line Fix

If an asset shows a 1px gray line at the top:
- The root cause was a CSS `filter: drop-shadow(…)` on `.pet-sprite-button`.
- This was fixed in Phase 12 by removing the drop-shadow CSS and re-cleaning the assets.
- Do not re-add `drop-shadow` to `.pet-sprite-button` without also updating the asset pipeline.
