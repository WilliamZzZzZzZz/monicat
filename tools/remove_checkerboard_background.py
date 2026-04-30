#!/usr/bin/env python3
"""
remove_checkerboard_background.py
----------------------------------
Removes baked-in checkerboard (near-white/light-gray) backgrounds from cat
frame PNGs and exports RGBA PNGs with true alpha transparency.

Algorithm
---------
1. Convert input RGB image to float32 RGBA.
2. Build a "candidate background" binary mask:
       all three channels > BG_LOW (225) AND channel std-dev < GRAY_STD (20)
   This captures near-gray/white pixels without flagging warm cat-fur colours.
3. Label connected components in the candidate mask (scipy.ndimage.label).
4. Mark only those components that TOUCH the image border as background.
   Internal white features (inner ears, whiskers, muzzle highlight) are NOT
   connected to the border and therefore stay opaque.
5. Build the raw alpha channel: 0 for border-connected background, 255 else.
6. Expand the background mask by ERODE_PX pixels inward (removes thin halos)
   then shrink back — net effect: erode fg edge slightly = cleaner boundary.
7. Apply a Gaussian feather (radius FEATHER_SIGMA) on the alpha boundary so
   the cat edge blends rather than being a hard jagged line.
8. Save as RGBA PNG.

Dependencies
------------
    pip3 install Pillow scipy numpy

Usage
-----
    python3 tools/remove_checkerboard_background.py
"""

import os
import sys
import math
import textwrap
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont
from scipy.ndimage import label as nd_label, binary_dilation

# ── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).resolve().parent.parent
SRC_DIR     = REPO_ROOT                               # original images live here
OUT_DIR     = REPO_ROOT / "processed_assets" / "cat"
PREVIEW_DIR = REPO_ROOT / "processed_assets" / "previews"
REPORT_PATH = REPO_ROOT / "processed_assets" / "transparency_report.txt"

STATES = {
    "idle":     ["idle_000.png",     "idle_001.png",     "idle_002.png"],
    "dragging": ["dragging_000.png", "dragging_001.png", "dragging_002.png"],
    "happy":    ["happy_000.png",    "happy_001.png",    "happy_002.png"],
    "sleeping": ["sleeping_000.png", "sleeping_001.png", "sleeping_002.png"],
}

# ── Tunable parameters ────────────────────────────────────────────────────────
BG_LOW       = 220   # pixels with all channels > this are "potentially background"
GRAY_STD     = 22    # max channel std-dev to qualify as gray/white (not warm fur)
BORDER_WIDTH = 3     # seed the flood-fill from this many pixels on each border
ERODE_PX     = 2     # shrink fg mask inward to eliminate 1-2px halos
FEATHER_SIGMA = 1.5  # Gaussian sigma for alpha edge feathering (pixels)

PREVIEW_COLORS = {
    "preview_black":   (0,   0,   0),
    "preview_green":   (0,   200, 60),
    "preview_magenta": (220, 0,   200),
}

# ── Core processing ───────────────────────────────────────────────────────────

def remove_background(img_path: Path) -> tuple[Image.Image, dict]:
    """
    Returns (rgba_image, stats_dict).
    stats_dict keys: width, height, transparent_ratio, semi_ratio, border_remnants
    """
    src = Image.open(img_path).convert("RGB")
    arr = np.array(src, dtype=np.float32)   # H x W x 3
    h, w = arr.shape[:2]

    # Step 1 ── candidate-background mask (near-gray/white pixels)
    ch_min = arr.min(axis=2)
    ch_max = arr.max(axis=2)
    ch_std = arr.std(axis=2)
    bg_candidate = (ch_min > BG_LOW) & (ch_std < GRAY_STD)

    # Step 2 ── connected components
    labeled, num_features = nd_label(bg_candidate)

    # Step 3 ── find labels that touch the image border
    border_labels = set()
    bw = BORDER_WIDTH
    for edge in [
        labeled[:bw, :], labeled[-bw:, :],
        labeled[:, :bw], labeled[:, -bw:],
    ]:
        border_labels.update(edge.ravel().tolist())
    border_labels.discard(0)  # 0 = non-background (labeled 0 by scipy)

    # Step 4 ── build binary background mask
    bg_mask = np.zeros((h, w), dtype=bool)
    for lbl in border_labels:
        bg_mask |= (labeled == lbl)

    # Step 5 ── erode foreground edge by ERODE_PX to kill thin halos
    if ERODE_PX > 0:
        struct = np.ones((ERODE_PX * 2 + 1, ERODE_PX * 2 + 1), dtype=bool)
        bg_mask = binary_dilation(bg_mask, structure=struct)

    # Step 6 ── build alpha channel (uint8)
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)

    # Step 7 ── Gaussian feather at the boundary
    # Use PIL filter on the alpha image
    alpha_img = Image.fromarray(alpha, mode="L")
    if FEATHER_SIGMA > 0:
        radius = max(1, int(round(FEATHER_SIGMA * 3)))
        blurred = alpha_img.filter(ImageFilter.GaussianBlur(radius=FEATHER_SIGMA))
        # Only apply blur near the boundary (within ~4px of edge)
        boundary = alpha_img.filter(ImageFilter.FIND_EDGES)
        boundary_arr = np.array(boundary) > 10
        # Dilate boundary to create a blend zone
        blend_zone = binary_dilation(boundary_arr,
                                     structure=np.ones((radius * 2 + 1,
                                                        radius * 2 + 1), bool))
        alpha_arr = np.array(alpha_img)
        blur_arr  = np.array(blurred)
        alpha_arr[blend_zone] = blur_arr[blend_zone]
        alpha_img = Image.fromarray(alpha_arr, mode="L")

    # Step 8 ── compose RGBA
    rgb = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    rgba = rgb.copy()
    rgba.putalpha(alpha_img)

    # ── Statistics ────────────────────────────────────────────────────────────
    final_alpha = np.array(alpha_img)
    total = h * w
    transparent_ratio = float((final_alpha == 0).sum()) / total
    semi_ratio        = float(((final_alpha > 0) & (final_alpha < 255)).sum()) / total

    # Check for checkerboard remnants near border (5px ring)
    ring = np.zeros((h, w), dtype=bool)
    ring[:5, :]  = True; ring[-5:, :] = True
    ring[:, :5]  = True; ring[:, -5:] = True
    ring_alpha = final_alpha[ring]
    # Remnants = non-transparent pixels in border ring after removal
    remnant_ratio = float((ring_alpha > 30).sum()) / ring_alpha.size

    stats = {
        "width":             w,
        "height":            h,
        "transparent_ratio": transparent_ratio,
        "semi_ratio":        semi_ratio,
        "border_remnants":   remnant_ratio,
    }
    return rgba, stats


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    all_results = []
    processed_images = {}   # filename -> PIL RGBA image (for preview)

    print("=" * 60)
    print("  MochiCat background removal")
    print("=" * 60)

    for state, filenames in STATES.items():
        out_state_dir = OUT_DIR / state
        out_state_dir.mkdir(parents=True, exist_ok=True)

        for fname in filenames:
            src_path = SRC_DIR / fname
            # Derive canonical output name: state_NNN.png  (fname already is)
            out_path = out_state_dir / fname

            if not src_path.exists():
                print(f"  [SKIP] {fname} not found at {src_path}")
                all_results.append({"file": str(out_path.relative_to(REPO_ROOT)),
                                    "status": "MISSING", "error": "source not found"})
                continue

            print(f"  Processing {fname} ...", end=" ", flush=True)
            try:
                rgba, stats = remove_background(src_path)
                rgba.save(out_path, format="PNG")

                # Pass/fail
                ok_transparent = stats["transparent_ratio"] > 0.30
                ok_no_remnants  = stats["border_remnants"]   < 0.10
                ok_alpha_exists = True  # we always create alpha

                status = "PASS" if (ok_transparent and ok_no_remnants) else "FAIL"
                all_results.append({
                    "file":              str(out_path.relative_to(REPO_ROOT)),
                    "status":            status,
                    "size":              f"{stats['width']}x{stats['height']}",
                    "mode":              "RGBA",
                    "alpha_exists":      True,
                    "transparent_ratio": f"{stats['transparent_ratio']*100:.1f}%",
                    "semi_ratio":        f"{stats['semi_ratio']*100:.2f}%",
                    "border_remnants":   f"{stats['border_remnants']*100:.1f}%",
                    "pass_transparent":  ok_transparent,
                    "pass_no_remnants":  ok_no_remnants,
                })
                processed_images[fname] = rgba
                print(status)
            except Exception as exc:
                print(f"ERROR: {exc}")
                all_results.append({"file": fname, "status": "ERROR", "error": str(exc)})

    # ── Write report ──────────────────────────────────────────────────────────
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w") as rpt:
        rpt.write("MochiCat Transparency Verification Report\n")
        rpt.write("=" * 60 + "\n\n")
        for r in all_results:
            rpt.write(f"File            : {r.get('file', '?')}\n")
            rpt.write(f"Status          : {r.get('status', '?')}\n")
            if "error" in r:
                rpt.write(f"Error           : {r['error']}\n")
            else:
                rpt.write(f"Size            : {r.get('size', '?')}\n")
                rpt.write(f"Mode            : {r.get('mode', '?')}\n")
                rpt.write(f"Alpha channel   : {r.get('alpha_exists', '?')}\n")
                rpt.write(f"Transparent px  : {r.get('transparent_ratio', '?')}\n")
                rpt.write(f"Semi-trans px   : {r.get('semi_ratio', '?')}\n")
                rpt.write(f"Border remnants : {r.get('border_remnants', '?')}\n")
                rpt.write(f"  [transparent>=30%] : {'✓' if r.get('pass_transparent') else '✗'}\n")
                rpt.write(f"  [remnants<10%]     : {'✓' if r.get('pass_no_remnants') else '✗'}\n")
            rpt.write("-" * 40 + "\n")

        pass_count = sum(1 for r in all_results if r.get("status") == "PASS")
        fail_count = sum(1 for r in all_results if r.get("status") != "PASS")
        rpt.write(f"\nSummary: {pass_count} PASS / {fail_count} FAIL  (total {len(all_results)})\n")

    print(f"\n  Report → {REPORT_PATH.relative_to(REPO_ROOT)}")

    # ── Generate preview sheets ───────────────────────────────────────────────
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    # Arrange: 4 columns (states) x 3 rows (frames), thumbnail 280px wide
    THUMB_W = 280
    COLS = 4
    ROWS = 3
    PAD = 12
    LABEL_H = 24

    all_imgs_ordered = []
    all_labels = []
    for state, filenames in STATES.items():
        for fname in filenames:
            all_imgs_ordered.append(processed_images.get(fname))
            all_labels.append(fname.replace(".png", ""))

    sheet_w = COLS * THUMB_W + (COLS + 1) * PAD
    sheet_h = ROWS * (THUMB_W + LABEL_H) + (ROWS + 1) * PAD + LABEL_H

    for color_name, bg_color in PREVIEW_COLORS.items():
        sheet = Image.new("RGB", (sheet_w, sheet_h), bg_color)
        for idx, (img, label) in enumerate(zip(all_imgs_ordered, all_labels)):
            col = idx // ROWS
            row = idx % ROWS
            x = PAD + col * (THUMB_W + PAD)
            y = PAD + LABEL_H + row * (THUMB_W + LABEL_H + PAD)
            if img is not None:
                # Scale keeping aspect
                thumb = img.copy()
                thumb.thumbnail((THUMB_W, THUMB_W), Image.LANCZOS)
                tw, th = thumb.size
                ox = x + (THUMB_W - tw) // 2
                oy = y + (THUMB_W - th) // 2
                # Composite over bg
                bg_patch = Image.new("RGBA", thumb.size, (*bg_color, 255))
                composed = Image.alpha_composite(bg_patch, thumb)
                sheet.paste(composed, (ox, oy))
            # Label
            draw = ImageDraw.Draw(sheet)
            lc = (255, 255, 255) if sum(bg_color) < 300 else (0, 0, 0)
            draw.text((x, y), label, fill=lc)

        out_preview = PREVIEW_DIR / f"{color_name}.png"
        sheet.save(out_preview, format="PNG")
        print(f"  Preview → {out_preview.relative_to(REPO_ROOT)}")

    # ── Final summary ─────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print(f"  PASS: {pass_count}   FAIL: {fail_count}")
    if fail_count == 0:
        print("  All files passed. Ready to copy into src/assets/cat/")
    else:
        print("  Some files failed — review report before copying.")
    print("=" * 60)

    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
