#!/usr/bin/env python3
"""
Replace MochiCat walking frames with the three walking_new_* source images.

Pipeline:
  1. Locate walking_new_000/001/002 in the repository root.
  2. Clean each source into a true RGBA PNG under processed_assets/cat/walk_right_new/.
  3. Archive the old walking frames under processed_assets/cat/archive/.
  4. Copy the cleaned right-facing frames into src/assets/cat/walk_right/.
  5. Mirror those frames horizontally into src/assets/cat/walk_left/.
  6. Remove old *_003.png files from the runtime asset directories.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageOps

from clean_cat_asset_alpha import clean_asset_alpha


REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"]
PROCESSED_RIGHT = REPO_ROOT / "processed_assets" / "cat" / "walk_right_new"
ARCHIVE_ROOT = REPO_ROOT / "processed_assets" / "cat" / "archive"
ASSET_ROOT = REPO_ROOT / "mochi-cat" / "src" / "assets" / "cat"
WALK_RIGHT_DIR = ASSET_ROOT / "walk_right"
WALK_LEFT_DIR = ASSET_ROOT / "walk_left"


def locate_source(index: int) -> Path:
    stem = f"walking_new_{index:03d}"
    matches = [REPO_ROOT / f"{stem}{ext}" for ext in SOURCE_EXTENSIONS]
    existing = [path for path in matches if path.exists()]
    if not existing:
        allowed = ", ".join(path.name for path in matches)
        raise FileNotFoundError(f"Missing {stem}; tried {allowed}")
    return existing[0]


def archive_existing_walking_assets() -> list[Path]:
    archived: list[Path] = []
    for state_dir, archive_name in [
        (WALK_RIGHT_DIR, "walk_right_old"),
        (WALK_LEFT_DIR, "walk_left_old"),
    ]:
        archive_dir = ARCHIVE_ROOT / archive_name
        archive_dir.mkdir(parents=True, exist_ok=True)
        for png in sorted(state_dir.glob("*.png")):
            target = archive_dir / png.name
            shutil.copy2(png, target)
            archived.append(target)
    return archived


def main() -> int:
    sources = [locate_source(index) for index in range(3)]
    PROCESSED_RIGHT.mkdir(parents=True, exist_ok=True)
    WALK_RIGHT_DIR.mkdir(parents=True, exist_ok=True)
    WALK_LEFT_DIR.mkdir(parents=True, exist_ok=True)

    archived = archive_existing_walking_assets()
    print("Archived old walking assets:")
    for path in archived:
        print(f"  {path.relative_to(REPO_ROOT)}")

    processed: list[Path] = []
    print("\nProcessing new walking sources:")
    for index, source in enumerate(sources):
        staged = PROCESSED_RIGHT / f"walk_right_{index:03d}.png"
        stats = clean_asset_alpha(source, staged)
        processed.append(staged)
        print(
            f"  {source.name} -> {staged.relative_to(REPO_ROOT)} "
            f"mode={stats['source_mode']} size={stats['size']} "
            f"transparent={stats['transparent_ratio']:.3f} "
            f"semi={stats['semi_transparent_ratio']:.3f}"
        )

    print("\nInstalling walk_right and mirrored walk_left assets:")
    for index, staged in enumerate(processed):
        right_target = WALK_RIGHT_DIR / f"walk_right_{index:03d}.png"
        left_target = WALK_LEFT_DIR / f"walk_left_{index:03d}.png"
        shutil.copy2(staged, right_target)
        right_img = Image.open(staged).convert("RGBA")
        ImageOps.mirror(right_img).save(left_target, format="PNG")
        print(f"  {right_target.relative_to(REPO_ROOT)}")
        print(f"  {left_target.relative_to(REPO_ROOT)}")

    removed: list[Path] = []
    for path in [
        WALK_RIGHT_DIR / "walk_right_003.png",
        WALK_LEFT_DIR / "walk_left_003.png",
    ]:
        if path.exists():
            path.unlink()
            removed.append(path)

    if removed:
        print("\nRemoved runtime fourth walking frames:")
        for path in removed:
            print(f"  {path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
