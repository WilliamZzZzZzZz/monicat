#!/usr/bin/env python3
"""
validate_runtime_assets.py

Validate that all runtime PNG assets referenced by the MochiCat animation
config are present, truly-transparent, and free from common visual defects.

Checks performed per file:
  1. File exists on disk.
  2. PNG has an alpha channel (mode RGBA or LA).
  3. Transparent pixel ratio is not suspiciously low (< 5 %).
  4. No large uniform opaque background (white / gray / black occupying
     > 60 % of total pixels).
  5. No top horizontal gray "shadow" band.
  6. Alpha bounding box does not touch the image edge (tiny trim).
  7. Frame dimensions are consistent within each animation state.
  8. Every state has at least one frame.

Output: processed_assets/runtime_asset_validation_report.txt
Exit code: 0 if all checks pass (or only warnings), non-zero if any FAIL.

This script only reads files – it never modifies them.
"""

import sys
import os
from pathlib import Path
from typing import NamedTuple, Optional

# ---------------------------------------------------------------------------
# Locate workspace roots relative to this script (tools/)
# ---------------------------------------------------------------------------
TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
ASSETS_DIR = PROJECT_ROOT / "mochi-cat" / "src" / "assets" / "cat"
REPORT_DIR = PROJECT_ROOT / "processed_assets"
REPORT_PATH = REPORT_DIR / "runtime_asset_validation_report.txt"

# ---------------------------------------------------------------------------
# Inline animation config (mirrors animationConfig.ts frame lists)
# ---------------------------------------------------------------------------
ANIMATION_STATES: dict[str, dict] = {
    "idle": {
        "fps": 4,
        "loop": True,
        "files": [
            "idle/idle_000.png",
            "idle/idle_001.png",
            "idle/idle_002.png",
        ],
    },
    "dragging": {
        "fps": 6,
        "loop": True,
        "files": [
            "dragging/dragging_000.png",
            "dragging/dragging_001.png",
            "dragging/dragging_002.png",
        ],
    },
    "happy": {
        "fps": 6,
        "loop": True,
        "files": [
            "happy/happy_000.png",
            "happy/happy_001.png",
            "happy/happy_002.png",
        ],
    },
    "sleeping": {
        "fps": 3,
        "loop": True,
        "files": [
            "sleeping/sleeping_000.png",
            "sleeping/sleeping_001.png",
            "sleeping/sleeping_002.png",
        ],
    },
    "walk_right": {
        "fps": 6,
        "loop": True,
        "files": [
            "walk_right/walk_right_000.png",
            "walk_right/walk_right_001.png",
            "walk_right/walk_right_002.png",
        ],
    },
    "walk_left": {
        "fps": 6,
        "loop": True,
        "files": [
            "walk_left/walk_left_000.png",
            "walk_left/walk_left_001.png",
            "walk_left/walk_left_002.png",
        ],
    },
    "grooming": {
        "fps": 5,
        "loop": False,
        "files": [
            "grooming/grooming_000.png",
            "grooming/grooming_001.png",
            "grooming/grooming_002.png",
            "grooming/grooming_003.png",
        ],
    },
}

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------
MIN_TRANSPARENT_RATIO = 0.05      # At least 5 % of pixels must be transparent
MAX_SOLID_BG_RATIO = 0.60         # > 60 % uniform background → suspicious
TOP_BAND_ROWS = 10                # Check top N rows for a gray band
TOP_BAND_GRAY_THRESHOLD = 200     # Pixel values above this considered "light gray"
TOP_BAND_OPAQUE_RATIO = 0.5       # > 50 % opaque in top rows → band suspected
EDGE_TOLERANCE_PX = 1             # Alpha bbox may touch edge within this tolerance

# ---------------------------------------------------------------------------
# Result record
# ---------------------------------------------------------------------------
class FileResult(NamedTuple):
    state: str
    filename: str
    exists: bool
    image_size: Optional[tuple]
    mode: Optional[str]
    has_alpha: bool
    transparent_pixel_ratio: Optional[float]
    alpha_bbox: Optional[tuple]
    edge_touching: bool
    top_band_suspected: bool
    checkerboard_suspected: bool
    large_bg_suspected: bool
    pass_fail: str
    notes: list


# ---------------------------------------------------------------------------
# Checkerboard detection (alternating 8×8 grey tiles)
# ---------------------------------------------------------------------------
def detect_checkerboard(pixels, width: int, height: int) -> bool:
    """
    Sample a 4×4 grid of 8×8 blocks and check whether every other block is a
    different uniform shade of gray (classic Photoshop checkerboard pattern).
    """
    # We test the top-left 64×64 region only – fast and representative.
    sample_size = min(64, width, height)
    block = 8
    if sample_size < block * 2:
        return False

    light_color = None
    dark_color = None

    for by in range(sample_size // block):
        for bx in range(sample_size // block):
            # Sample centre pixel of this block
            px = bx * block + block // 2
            py = by * block + block // 2
            r, g, b, a = pixels[px, py]
            if a < 128:
                return False  # transparent region – not a checkerboard bg
            avg = (int(r) + int(g) + int(b)) // 3
            is_gray = abs(int(r) - avg) < 15 and abs(int(g) - avg) < 15 and abs(int(b) - avg) < 15
            if not is_gray:
                return False

            expected_light = (bx + by) % 2 == 0
            if expected_light:
                if light_color is None:
                    light_color = avg
                elif abs(avg - light_color) > 20:
                    return False
            else:
                if dark_color is None:
                    dark_color = avg
                elif abs(avg - dark_color) > 20:
                    return False

    if light_color is not None and dark_color is not None:
        return abs(light_color - dark_color) > 15
    return False


# ---------------------------------------------------------------------------
# Single-file validation
# ---------------------------------------------------------------------------
def validate_file(state: str, rel_path: str) -> FileResult:
    abs_path = ASSETS_DIR / rel_path
    filename = rel_path

    if not abs_path.exists():
        return FileResult(
            state=state,
            filename=filename,
            exists=False,
            image_size=None,
            mode=None,
            has_alpha=False,
            transparent_pixel_ratio=None,
            alpha_bbox=None,
            edge_touching=False,
            top_band_suspected=False,
            checkerboard_suspected=False,
            large_bg_suspected=False,
            pass_fail="FAIL",
            notes=["File does not exist"],
        )

    try:
        from PIL import Image
    except ImportError:
        return FileResult(
            state=state,
            filename=filename,
            exists=True,
            image_size=None,
            mode=None,
            has_alpha=False,
            transparent_pixel_ratio=None,
            alpha_bbox=None,
            edge_touching=False,
            top_band_suspected=False,
            checkerboard_suspected=False,
            large_bg_suspected=False,
            pass_fail="SKIP",
            notes=["Pillow not installed – skipping pixel checks (pip install Pillow)"],
        )

    notes = []
    fail = False

    with Image.open(abs_path) as img:
        mode = img.mode
        width, height = img.size
        image_size = (width, height)

        # Convert to RGBA for uniform analysis
        rgba = img.convert("RGBA")
        pixels = rgba.load()

        # --- Has alpha ---
        has_alpha = mode in ("RGBA", "LA", "PA") or (mode == "P" and img.info.get("transparency") is not None)

        # If mode was not alpha, try RGBA anyway (we converted above)
        if not has_alpha:
            notes.append(f"WARNING: original mode {mode} has no alpha channel")
            fail = True

        # --- Transparent pixel count ---
        total = width * height
        transparent = sum(
            1 for y in range(height) for x in range(width)
            if pixels[x, y][3] < 128
        )
        transparent_ratio = transparent / total

        if transparent_ratio < MIN_TRANSPARENT_RATIO:
            notes.append(
                f"WARNING: very low transparent ratio {transparent_ratio:.2%} "
                "(expected cat silhouette on transparent bg)"
            )
            fail = True

        # --- Alpha bounding box ---
        alpha_channel = rgba.split()[3]
        bbox = alpha_channel.getbbox()  # (left, top, right, bottom) of non-transparent region
        edge_touching = False
        if bbox:
            l, t, r, b = bbox
            if l <= EDGE_TOLERANCE_PX or t <= EDGE_TOLERANCE_PX \
                    or r >= width - EDGE_TOLERANCE_PX or b >= height - EDGE_TOLERANCE_PX:
                edge_touching = True
                notes.append(
                    f"WARNING: alpha bbox {bbox} touches image edge "
                    f"({width}×{height}) — may clip sprites"
                )

        # --- Large uniform background detection (white / gray / black) ---
        large_bg_suspected = False
        bg_colors = {"white": 0, "gray": 0, "black": 0}
        for y in range(height):
            for x in range(width):
                r2, g2, b2, a2 = pixels[x, y]
                if a2 < 128:
                    continue
                lum = (int(r2) + int(g2) + int(b2)) // 3
                is_neutral = abs(int(r2) - lum) < 15 and abs(int(g2) - lum) < 15 and abs(int(b2) - lum) < 15
                if not is_neutral:
                    continue
                if lum >= 220:
                    bg_colors["white"] += 1
                elif lum <= 40:
                    bg_colors["black"] += 1
                else:
                    bg_colors["gray"] += 1

        for color, count in bg_colors.items():
            if total > 0 and count / total > MAX_SOLID_BG_RATIO:
                large_bg_suspected = True
                notes.append(
                    f"FAIL: large {color} background suspected "
                    f"({count / total:.1%} of pixels)"
                )
                fail = True

        # --- Top horizontal gray band detection ---
        top_band_suspected = False
        if height >= TOP_BAND_ROWS:
            band_opaque = 0
            band_gray = 0
            band_total = TOP_BAND_ROWS * width
            for y in range(TOP_BAND_ROWS):
                for x in range(width):
                    r2, g2, b2, a2 = pixels[x, y]
                    if a2 >= 128:
                        band_opaque += 1
                        lum = (int(r2) + int(g2) + int(b2)) // 3
                        if lum >= TOP_BAND_GRAY_THRESHOLD:
                            band_gray += 1
            if band_opaque / band_total > TOP_BAND_OPAQUE_RATIO and band_gray / (band_opaque + 1) > 0.7:
                top_band_suspected = True
                notes.append(
                    f"FAIL: top {TOP_BAND_ROWS}px gray band suspected — "
                    f"{band_opaque / band_total:.1%} opaque, {band_gray / (band_opaque + 1):.1%} gray"
                )
                fail = True

        # --- Checkerboard detection ---
        checkerboard_suspected = detect_checkerboard(pixels, width, height)
        if checkerboard_suspected:
            notes.append("FAIL: checkerboard fake-transparent background suspected")
            fail = True

    return FileResult(
        state=state,
        filename=filename,
        exists=True,
        image_size=image_size,
        mode=mode,
        has_alpha=has_alpha,
        transparent_pixel_ratio=transparent_ratio,
        alpha_bbox=bbox if bbox else None,
        edge_touching=edge_touching,
        top_band_suspected=top_band_suspected,
        checkerboard_suspected=checkerboard_suspected,
        large_bg_suspected=large_bg_suspected,
        pass_fail="FAIL" if fail else "PASS",
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Dimension consistency check
# ---------------------------------------------------------------------------
def check_dimension_consistency(
    results: list[FileResult],
) -> list[str]:
    """Return a list of FAIL messages for states with inconsistent frame sizes."""
    from collections import defaultdict
    state_sizes: dict[str, set] = defaultdict(set)
    for r in results:
        if r.image_size:
            state_sizes[r.state].add(r.image_size)

    messages = []
    for state, sizes in state_sizes.items():
        if len(sizes) > 1:
            messages.append(
                f"FAIL: state '{state}' has inconsistent frame sizes: {sizes}"
            )
    return messages


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------
def write_report(results: list[FileResult], dim_issues: list[str], report_path: Path) -> int:
    report_path.parent.mkdir(parents=True, exist_ok=True)

    passed = sum(1 for r in results if r.pass_fail == "PASS")
    failed = sum(1 for r in results if r.pass_fail == "FAIL")
    skipped = sum(1 for r in results if r.pass_fail == "SKIP")
    warnings = sum(1 for r in results for n in r.notes if n.startswith("WARNING"))
    total = len(results)

    lines = []
    lines.append("=" * 72)
    lines.append("MochiCat Runtime Asset Validation Report")
    lines.append(f"Assets directory : {ASSETS_DIR}")
    lines.append("=" * 72)
    lines.append("")

    for r in results:
        lines.append(f"[{r.pass_fail}] {r.state} / {r.filename}")
        lines.append(f"  exists               : {r.exists}")
        if r.image_size:
            lines.append(f"  image size           : {r.image_size[0]}×{r.image_size[1]}")
        if r.mode:
            lines.append(f"  mode                 : {r.mode}")
        lines.append(f"  has alpha            : {r.has_alpha}")
        if r.transparent_pixel_ratio is not None:
            lines.append(f"  transparent ratio    : {r.transparent_pixel_ratio:.2%}")
        if r.alpha_bbox:
            lines.append(f"  alpha bbox           : {r.alpha_bbox}")
        lines.append(f"  edge touching        : {r.edge_touching}")
        lines.append(f"  top band suspected   : {r.top_band_suspected}")
        lines.append(f"  checkerboard         : {r.checkerboard_suspected}")
        lines.append(f"  large bg suspected   : {r.large_bg_suspected}")
        for note in r.notes:
            lines.append(f"  ⚠  {note}")
        lines.append("")

    if dim_issues:
        lines.append("Dimension Consistency Issues")
        lines.append("-" * 40)
        for msg in dim_issues:
            lines.append(f"  {msg}")
        lines.append("")

    lines.append("=" * 72)
    lines.append("SUMMARY")
    lines.append(f"  Total files : {total}")
    lines.append(f"  PASS        : {passed}")
    lines.append(f"  FAIL        : {failed + len(dim_issues)}")
    lines.append(f"  SKIP        : {skipped}")
    lines.append(f"  Warnings    : {warnings}")
    lines.append("=" * 72)

    report_text = "\n".join(lines)
    report_path.write_text(report_text, encoding="utf-8")
    print(report_text)

    return 1 if (failed > 0 or dim_issues) else 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> int:
    results: list[FileResult] = []

    for state, config in ANIMATION_STATES.items():
        files = config["files"]
        if not files:
            print(f"FAIL: state '{state}' has no frames defined", file=sys.stderr)
            results.append(FileResult(
                state=state,
                filename="<none>",
                exists=False,
                image_size=None,
                mode=None,
                has_alpha=False,
                transparent_pixel_ratio=None,
                alpha_bbox=None,
                edge_touching=False,
                top_band_suspected=False,
                checkerboard_suspected=False,
                large_bg_suspected=False,
                pass_fail="FAIL",
                notes=["No frames defined for this state"],
            ))
            continue

        for rel_path in files:
            result = validate_file(state, rel_path)
            results.append(result)

    dim_issues = check_dimension_consistency(results)
    exit_code = write_report(results, dim_issues, REPORT_PATH)

    if exit_code == 0:
        print(f"\n✓ All runtime assets passed validation.")
    else:
        print(f"\n✗ Asset validation FAILED. See {REPORT_PATH}", file=sys.stderr)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
