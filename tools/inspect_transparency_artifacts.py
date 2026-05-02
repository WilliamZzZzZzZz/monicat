#!/usr/bin/env python3
"""
Inspect MochiCat cat PNGs for transparency artifacts and generate preview sheets.

Outputs:
  processed_assets/visual_artifacts_report.txt
  processed_assets/previews/all_states_on_black.png
  processed_assets/previews/all_states_on_green.png
  processed_assets/previews/all_states_on_magenta.png
  processed_assets/previews/all_states_on_blue.png
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parent.parent
ASSET_ROOT = REPO_ROOT / "mochi-cat" / "src" / "assets" / "cat"
REPORT_PATH = REPO_ROOT / "processed_assets" / "visual_artifacts_report.txt"
PREVIEW_DIR = REPO_ROOT / "processed_assets" / "previews"
STATES = ["idle", "dragging", "happy", "sleeping", "walk_right", "walk_left"]
PREVIEW_BACKGROUNDS = {
    "black": (0, 0, 0),
    "green": (0, 190, 70),
    "magenta": (230, 0, 210),
    "blue": (0, 96, 220),
}


@dataclass
class Inspection:
    path: Path
    size: tuple[int, int]
    mode: str
    has_alpha: bool
    transparent_ratio: float
    semi_transparent_ratio: float
    bbox: tuple[int, int, int, int] | None
    margins: tuple[int, int, int, int] | None
    touches_top: bool
    touches_bottom: bool
    touches_left: bool
    touches_right: bool
    large_semi_transparent_rectangle: bool
    top_horizontal_band: bool
    checkerboard_likely_baked_in: bool
    passed: bool


def _alpha_bbox(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _border_rgb(rgb: np.ndarray, width: int = 8) -> np.ndarray:
    return np.concatenate([
        rgb[:width, :, :].reshape(-1, 3),
        rgb[-width:, :, :].reshape(-1, 3),
        rgb[:, :width, :].reshape(-1, 3),
        rgb[:, -width:, :].reshape(-1, 3),
    ], axis=0)


def _checkerboard_likely(img: Image.Image, alpha: np.ndarray) -> bool:
    rgb = np.array(img.convert("RGB"))
    border_alpha = np.concatenate([
        alpha[:8, :].ravel(),
        alpha[-8:, :].ravel(),
        alpha[:, :8].ravel(),
        alpha[:, -8:].ravel(),
    ])
    if float((border_alpha > 8).mean()) < 0.01:
        return False

    border = _border_rgb(rgb)
    ch_std = border.std(axis=1)
    neutral = ch_std < 10
    light = border.min(axis=1) > 215
    if float((neutral & light).mean()) < 0.75:
        return False

    rounded = (border // 8) * 8
    unique = np.unique(rounded[neutral & light], axis=0)
    return len(unique) >= 3


def inspect_file(path: Path) -> Inspection:
    raw = Image.open(path)
    rgba = raw.convert("RGBA")
    alpha = np.array(rgba.getchannel("A"))
    h, w = alpha.shape
    total = h * w
    has_alpha = raw.mode in {"RGBA", "LA"} or "transparency" in raw.info

    bbox = _alpha_bbox(alpha)
    margins = None
    if bbox is not None:
        left, top, right, bottom = bbox
        margins = (top, h - bottom, left, w - right)

    transparent_ratio = float((alpha == 0).sum()) / total
    semi = (alpha > 0) & (alpha < 255)
    semi_transparent_ratio = float(semi.sum()) / total

    edge_threshold = 8
    touches_top = bool((alpha[0, :] > edge_threshold).any())
    touches_bottom = bool((alpha[-1, :] > edge_threshold).any())
    touches_left = bool((alpha[:, 0] > edge_threshold).any())
    touches_right = bool((alpha[:, -1] > edge_threshold).any())

    top_rows = alpha[: min(30, h), :] > edge_threshold
    top_row_coverage = top_rows.mean(axis=1) if len(top_rows) else np.array([0])
    top_horizontal_band = bool((top_row_coverage > 0.20).any())

    low_alpha = (alpha > 0) & (alpha < 90)
    large_low_alpha_area = float(low_alpha.mean()) > 0.08
    edge_low_alpha = np.concatenate([
        low_alpha[:20, :].ravel(),
        low_alpha[-20:, :].ravel(),
        low_alpha[:, :20].ravel(),
        low_alpha[:, -20:].ravel(),
    ])
    large_semi_transparent_rectangle = large_low_alpha_area or float(edge_low_alpha.mean()) > 0.08

    checkerboard_likely_baked_in = _checkerboard_likely(raw, alpha)

    passed = (
        has_alpha
        and transparent_ratio > 0.20
        and not top_horizontal_band
        and not large_semi_transparent_rectangle
        and not checkerboard_likely_baked_in
        and not (touches_top or touches_bottom or touches_left or touches_right)
    )

    return Inspection(
        path=path,
        size=(w, h),
        mode=raw.mode,
        has_alpha=has_alpha,
        transparent_ratio=transparent_ratio,
        semi_transparent_ratio=semi_transparent_ratio,
        bbox=bbox,
        margins=margins,
        touches_top=touches_top,
        touches_bottom=touches_bottom,
        touches_left=touches_left,
        touches_right=touches_right,
        large_semi_transparent_rectangle=large_semi_transparent_rectangle,
        top_horizontal_band=top_horizontal_band,
        checkerboard_likely_baked_in=checkerboard_likely_baked_in,
        passed=passed,
    )


def scan_assets() -> list[Inspection]:
    results: list[Inspection] = []
    for state in STATES:
        state_dir = ASSET_ROOT / state
        if not state_dir.exists():
            continue
        for png in sorted(state_dir.glob("*.png")):
            results.append(inspect_file(png))
    return results


def write_report(results: list[Inspection]) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = [
        "MochiCat Visual Artifact Transparency Report",
        "=" * 72,
        "",
    ]

    for result in results:
        rel = result.path.relative_to(REPO_ROOT)
        lines.extend([
            f"filename: {rel}",
            f"image size: {result.size[0]}x{result.size[1]}",
            f"mode: {result.mode}",
            f"has alpha: {'yes' if result.has_alpha else 'no'}",
            f"transparent pixel ratio: {result.transparent_ratio:.4f}",
            f"semi-transparent pixel ratio: {result.semi_transparent_ratio:.4f}",
            f"alpha bounding box: {result.bbox}",
            f"top margin: {result.margins[0] if result.margins else 'n/a'}",
            f"bottom margin: {result.margins[1] if result.margins else 'n/a'}",
            f"left margin: {result.margins[2] if result.margins else 'n/a'}",
            f"right margin: {result.margins[3] if result.margins else 'n/a'}",
            f"non-transparent pixels touching top edge: {'yes' if result.touches_top else 'no'}",
            f"non-transparent pixels touching left edge: {'yes' if result.touches_left else 'no'}",
            f"non-transparent pixels touching right edge: {'yes' if result.touches_right else 'no'}",
            f"non-transparent pixels touching bottom edge: {'yes' if result.touches_bottom else 'no'}",
            f"large semi-transparent rectangle suspected: {'yes' if result.large_semi_transparent_rectangle else 'no'}",
            f"top horizontal band suspected: {'yes' if result.top_horizontal_band else 'no'}",
            f"checkerboard likely baked in: {'yes' if result.checkerboard_likely_baked_in else 'no'}",
            f"pass/fail: {'PASS' if result.passed else 'FAIL'}",
            "-" * 72,
        ])

    pass_count = sum(1 for result in results if result.passed)
    fail_count = len(results) - pass_count
    lines.extend([
        "",
        f"Summary: {pass_count} PASS / {fail_count} FAIL / {len(results)} total",
    ])
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def generate_previews(results: list[Inspection]) -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    frames = [result.path for result in results]
    labels = [str(result.path.relative_to(ASSET_ROOT)) for result in results]
    if not frames:
        return

    thumb_w = 150
    thumb_h = 188
    label_h = 30
    pad = 12
    cols = 6
    rows = (len(frames) + cols - 1) // cols
    sheet_w = cols * thumb_w + (cols + 1) * pad
    sheet_h = rows * (thumb_h + label_h) + (rows + 1) * pad
    font = ImageFont.load_default()

    for name, bg in PREVIEW_BACKGROUNDS.items():
        sheet = Image.new("RGB", (sheet_w, sheet_h), bg)
        draw = ImageDraw.Draw(sheet)
        label_fill = (255, 255, 255) if sum(bg) < 300 else (20, 20, 20)

        for idx, path in enumerate(frames):
            img = Image.open(path).convert("RGBA")
            img.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            col = idx % cols
            row = idx // cols
            cell_x = pad + col * (thumb_w + pad)
            cell_y = pad + row * (thumb_h + label_h + pad)
            x = cell_x + (thumb_w - img.width) // 2
            y = cell_y + (thumb_h - img.height) // 2
            patch = Image.new("RGBA", img.size, (*bg, 255))
            composed = Image.alpha_composite(patch, img)
            sheet.paste(composed.convert("RGB"), (x, y))
            draw.text((cell_x, cell_y + thumb_h + 3), labels[idx], fill=label_fill, font=font)

        sheet.save(PREVIEW_DIR / f"all_states_on_{name}.png", format="PNG")


def main() -> int:
    results = scan_assets()
    write_report(results)
    generate_previews(results)
    pass_count = sum(1 for result in results if result.passed)
    fail_count = len(results) - pass_count
    print(f"Wrote {REPORT_PATH.relative_to(REPO_ROOT)}")
    print(f"Wrote previews to {PREVIEW_DIR.relative_to(REPO_ROOT)}")
    print(f"Summary: {pass_count} PASS / {fail_count} FAIL / {len(results)} total")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
