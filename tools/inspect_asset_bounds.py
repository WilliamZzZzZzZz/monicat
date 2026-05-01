#!/usr/bin/env python3
"""
inspect_asset_bounds.py
Scans cat animation PNG frames and reports alpha bounding boxes.
Requires: pip install Pillow
Output: processed_assets/asset_bounds_report.txt
"""
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).parent.parent
ASSET_ROOT = REPO_ROOT / "mochi-cat" / "src" / "assets" / "cat"
REPORT_PATH = REPO_ROOT / "processed_assets" / "asset_bounds_report.txt"

STATES = ["idle", "happy", "sleeping", "walk_left", "walk_right", "dragging"]
MARGIN_WARN = 2  # px — warn if content is this close to any edge


def main():
    lines = ["MochiCat Asset Bounds Report", "=" * 60, ""]
    any_fail = False

    for state in STATES:
        state_dir = ASSET_ROOT / state
        if not state_dir.exists():
            lines.append(f"[SKIP] {state}/ — directory not found")
            lines.append("")
            continue

        pngs = sorted(state_dir.glob("*.png"))
        if not pngs:
            lines.append(f"[SKIP] {state}/ — no PNG files found")
            lines.append("")
            continue

        lines.append(f"State: {state}")
        lines.append("-" * 40)

        for png in pngs:
            img = Image.open(png).convert("RGBA")
            w, h = img.size
            bbox = img.getbbox()

            if bbox is None:
                lines.append(f"  {png.name}: {w}x{h} — fully transparent (skip)")
                continue

            min_x, min_y = bbox[0], bbox[1]
            max_x, max_y = bbox[2] - 1, bbox[3] - 1
            top_margin    = min_y
            bottom_margin = h - 1 - max_y
            left_margin   = min_x
            right_margin  = w - 1 - max_x

            touches = []
            if top_margin    <= MARGIN_WARN: touches.append("TOP")
            if bottom_margin <= MARGIN_WARN: touches.append("BOTTOM")
            if left_margin   <= MARGIN_WARN: touches.append("LEFT")
            if right_margin  <= MARGIN_WARN: touches.append("RIGHT")

            if touches:
                any_fail = True

            status = "FAIL" if touches else "PASS"
            extra  = ("  TOUCHES: " + ",".join(touches)) if touches else ""
            lines.append(
                f"  {png.name}: {w}x{h}  bbox=({min_x},{min_y})-({max_x},{max_y})"
                f"  margins T={top_margin} B={bottom_margin} L={left_margin} R={right_margin}"
                f"  [{status}{extra}]"
            )

        lines.append("")

    lines.append("=" * 60)
    lines.append(
        "SUMMARY: " + (
            "Some assets touch edges — see FAIL entries above."
            if any_fail else
            "All assets have sufficient margins."
        )
    )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
