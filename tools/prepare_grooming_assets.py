#!/usr/bin/env python3
"""
Prepare MochiCat grooming frames as true-transparent RGBA PNGs.

The input grooming frames currently use a baked light checkerboard background.
This script removes only edge-connected, background-like pixels, preserves the
cat artwork, writes verification metadata, generates color-background previews,
and copies validated PNGs into the renderer asset tree.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.ndimage import binary_dilation, label as nd_label


REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
FRAME_NAMES = [f"grooming_{idx:03d}" for idx in range(4)]

PROCESSED_DIR = REPO_ROOT / "processed_assets" / "cat" / "grooming"
FINAL_DIR = REPO_ROOT / "mochi-cat" / "src" / "assets" / "cat" / "grooming"
REPORT_PATH = REPO_ROOT / "processed_assets" / "grooming_asset_report.txt"
PREVIEW_DIR = REPO_ROOT / "processed_assets" / "previews"

PREVIEW_BACKGROUNDS = {
    "black": (0, 0, 0),
    "green": (0, 190, 70),
    "magenta": (230, 0, 210),
    "blue": (0, 96, 220),
}


@dataclass
class FrameReport:
    filename: str
    source_path: Path
    output_path: Path
    final_path: Path
    image_size: tuple[int, int]
    source_mode: str
    output_mode: str
    source_has_alpha: bool
    has_alpha: bool
    transparent_ratio: float
    semi_transparent_ratio: float
    alpha_bbox: tuple[int, int, int, int] | None
    margins: tuple[int, int, int, int] | None
    touches_edge: bool
    source_checkerboard_suspected: bool
    checkerboard_suspected: bool
    source_top_gray_band_suspected: bool
    top_gray_band_suspected: bool
    pass_fail: bool


def find_source(frame_name: str) -> Path:
    matches = [REPO_ROOT / f"{frame_name}{ext}" for ext in SOURCE_EXTENSIONS]
    existing = [path for path in matches if path.exists()]
    if not existing:
        allowed = ", ".join(f"{frame_name}{ext}" for ext in SOURCE_EXTENSIONS)
        raise FileNotFoundError(f"Missing grooming source. Expected one of: {allowed}")
    return existing[0]


def has_alpha_channel(img: Image.Image) -> bool:
    return img.mode in {"RGBA", "LA"} or "transparency" in img.info


def alpha_bbox(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def edge_connected(mask: np.ndarray, border_width: int = 3) -> np.ndarray:
    labeled, _ = nd_label(mask)
    edge_labels: set[int] = set()
    edge_labels.update(labeled[:border_width, :].ravel().tolist())
    edge_labels.update(labeled[-border_width:, :].ravel().tolist())
    edge_labels.update(labeled[:, :border_width].ravel().tolist())
    edge_labels.update(labeled[:, -border_width:].ravel().tolist())
    edge_labels.discard(0)

    connected = np.zeros(mask.shape, dtype=bool)
    for label_id in edge_labels:
        connected |= labeled == label_id
    return connected


def border_rgb(rgb: np.ndarray, width: int = 12) -> np.ndarray:
    return np.concatenate(
        [
            rgb[:width, :, :].reshape(-1, 3),
            rgb[-width:, :, :].reshape(-1, 3),
            rgb[:, :width, :].reshape(-1, 3),
            rgb[:, -width:, :].reshape(-1, 3),
        ],
        axis=0,
    )


def suspect_checkerboard(img: Image.Image) -> bool:
    rgba = img.convert("RGBA")
    alpha = np.array(rgba.getchannel("A"))
    border_alpha = np.concatenate(
        [
            alpha[:8, :].ravel(),
            alpha[-8:, :].ravel(),
            alpha[:, :8].ravel(),
            alpha[:, -8:].ravel(),
        ]
    )
    if float((border_alpha > 8).mean()) < 0.01:
        return False

    rgb = np.array(rgba.convert("RGB"))
    border = border_rgb(rgb, width=12)
    ch_min = border.min(axis=1)
    ch_std = border.std(axis=1)
    light_neutral = (ch_min > 225) & (ch_std < 10)
    if float(light_neutral.mean()) < 0.60:
        return False

    rounded = (border[light_neutral] // 4) * 4
    unique = np.unique(rounded, axis=0)
    return len(unique) >= 3


def suspect_top_gray_band(img: Image.Image) -> bool:
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    h = alpha.shape[0]
    top_h = min(36, h)

    top_alpha = alpha[:top_h, :] > 8
    if float(top_alpha.mean()) < 0.10:
        return False

    top_rgb = rgb[:top_h, :, :]
    ch_min = top_rgb.min(axis=2)
    ch_std = top_rgb.std(axis=2)
    neutral_gray = (ch_min > 190) & (ch_std < 14)
    row_coverage = neutral_gray.mean(axis=1)
    return bool((row_coverage > 0.45).any())


def clean_to_true_rgba(src_path: Path) -> Image.Image:
    src = Image.open(src_path)
    rgba = src.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3]

    if has_alpha_channel(src):
        border_alpha = np.concatenate(
            [
                alpha[:12, :].ravel(),
                alpha[-12:, :].ravel(),
                alpha[:, :12].ravel(),
                alpha[:, -12:].ravel(),
            ]
        )
        if float((border_alpha > 8).mean()) < 0.002 and float((alpha == 0).mean()) > 0.20:
            return rgba

    border = border_rgb(rgb, width=18)
    bg_color = np.median(border, axis=0)
    dist_from_bg = np.linalg.norm(rgb - bg_color, axis=2)
    ch_min = rgb.min(axis=2)
    ch_max = rgb.max(axis=2)
    ch_std = rgb.std(axis=2)
    ch_range = ch_max - ch_min

    # The fake transparency is very light and neutral. Include sampled border
    # colors plus generic white/gray candidates so subtle gradients are removed.
    near_sampled_bg = dist_from_bg <= 34
    light_neutral = (ch_min >= 226) & (ch_std <= 16)
    very_light = (ch_min >= 238) & (ch_range <= 28)
    background_candidate = near_sampled_bg | light_neutral | very_light

    # Protect warm/dark/textured cat pixels, then expand that protection just
    # enough to keep anti-aliased fur, whiskers, paw edges, and facial details.
    warm_fur_or_line = ((rgb[:, :, 0] - rgb[:, :, 2]) > 16) & (ch_max < 252)
    textured_or_dark = (ch_range > 24) | (ch_max < 222) | (dist_from_bg > 42)
    foreground_core = warm_fur_or_line | textured_or_dark
    protected = binary_dilation(foreground_core, structure=np.ones((5, 5), dtype=bool))
    background_candidate &= ~protected

    background = edge_connected(background_candidate, border_width=3)
    background = binary_dilation(background, structure=np.ones((3, 3), dtype=bool))

    new_alpha = np.where(background, 0, 255).astype(np.uint8)

    # Remove tiny source artifacts that survived as foreground on the canvas
    # edge. The actual cat has large margins in these frames, so only very
    # small edge-touching components are treated as dirt.
    foreground_labels, _ = nd_label(new_alpha > 8)
    edge_labels: set[int] = set()
    edge_labels.update(foreground_labels[0, :].ravel().tolist())
    edge_labels.update(foreground_labels[-1, :].ravel().tolist())
    edge_labels.update(foreground_labels[:, 0].ravel().tolist())
    edge_labels.update(foreground_labels[:, -1].ravel().tolist())
    edge_labels.discard(0)
    max_artifact_area = int(new_alpha.size * 0.002)
    for label_id in edge_labels:
        component = foreground_labels == label_id
        if int(component.sum()) <= max_artifact_area:
            new_alpha[component] = 0

    alpha_image = Image.fromarray(new_alpha, mode="L")
    edge_image = alpha_image.filter(ImageFilter.FIND_EDGES)
    edge = np.array(edge_image) > 10
    blend_zone = binary_dilation(edge, structure=np.ones((5, 5), dtype=bool))
    feathered = np.array(alpha_image.filter(ImageFilter.GaussianBlur(radius=0.9)))
    new_alpha[blend_zone] = feathered[blend_zone]

    out = arr.copy()
    out[:, :, 3] = new_alpha
    return Image.fromarray(out, mode="RGBA")


def inspect_output(
    filename: str,
    source_path: Path,
    output_path: Path,
    final_path: Path,
    source_mode: str,
    source_has_alpha: bool,
    source_checkerboard: bool,
    source_top_band: bool,
) -> FrameReport:
    img = Image.open(output_path)
    rgba = img.convert("RGBA")
    alpha = np.array(rgba.getchannel("A"))
    h, w = alpha.shape
    total = h * w

    bbox = alpha_bbox(alpha)
    margins = None
    if bbox is not None:
        left, top, right, bottom = bbox
        margins = (top, h - bottom, left, w - right)

    touches_edge = bool(
        (alpha[0, :] > 8).any()
        or (alpha[-1, :] > 8).any()
        or (alpha[:, 0] > 8).any()
        or (alpha[:, -1] > 8).any()
    )

    output_checkerboard = suspect_checkerboard(rgba)
    output_top_band = suspect_top_gray_band(rgba)
    transparent_ratio = float((alpha == 0).sum()) / total
    semi_transparent_ratio = float(((alpha > 0) & (alpha < 255)).sum()) / total
    output_has_alpha = has_alpha_channel(img)

    passed = (
        output_has_alpha
        and rgba.mode == "RGBA"
        and transparent_ratio > 0.20
        and bbox is not None
        and not touches_edge
        and not output_checkerboard
        and not output_top_band
    )

    return FrameReport(
        filename=filename,
        source_path=source_path,
        output_path=output_path,
        final_path=final_path,
        image_size=(w, h),
        source_mode=source_mode,
        output_mode=rgba.mode,
        source_has_alpha=source_has_alpha,
        has_alpha=output_has_alpha,
        transparent_ratio=transparent_ratio,
        semi_transparent_ratio=semi_transparent_ratio,
        alpha_bbox=bbox,
        margins=margins,
        touches_edge=touches_edge,
        source_checkerboard_suspected=source_checkerboard,
        checkerboard_suspected=output_checkerboard,
        source_top_gray_band_suspected=source_top_band,
        top_gray_band_suspected=output_top_band,
        pass_fail=passed,
    )


def process_frames() -> list[FrameReport]:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    FINAL_DIR.mkdir(parents=True, exist_ok=True)

    reports: list[FrameReport] = []
    for frame_name in FRAME_NAMES:
        source_path = find_source(frame_name)
        source = Image.open(source_path)
        source_mode = source.mode
        source_has_alpha = has_alpha_channel(source)
        source_checkerboard = suspect_checkerboard(source)
        source_top_band = suspect_top_gray_band(source)

        output_path = PROCESSED_DIR / f"{frame_name}.png"
        final_path = FINAL_DIR / f"{frame_name}.png"
        cleaned = clean_to_true_rgba(source_path)
        cleaned.save(output_path, format="PNG")

        report = inspect_output(
            filename=f"{frame_name}.png",
            source_path=source_path,
            output_path=output_path,
            final_path=final_path,
            source_mode=source_mode,
            source_has_alpha=source_has_alpha,
            source_checkerboard=source_checkerboard,
            source_top_band=source_top_band,
        )
        reports.append(report)

    if all(report.pass_fail for report in reports):
        for report in reports:
            shutil.copy2(report.output_path, report.final_path)

    return reports


def write_report(reports: list[FrameReport]) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "MochiCat Grooming Asset Report",
        "=" * 72,
        "",
    ]

    for report in reports:
        margins = report.margins
        lines.extend(
            [
                f"filename: {report.filename}",
                f"source file path: {report.source_path}",
                f"output file path: {report.output_path}",
                f"final asset path: {report.final_path}",
                f"image size: {report.image_size[0]}x{report.image_size[1]}",
                f"source mode: {report.source_mode}",
                f"mode: {report.output_mode}",
                f"source has alpha: {'yes' if report.source_has_alpha else 'no'}",
                f"has alpha: {'yes' if report.has_alpha else 'no'}",
                f"transparent pixel ratio: {report.transparent_ratio:.4f}",
                f"semi-transparent pixel ratio: {report.semi_transparent_ratio:.4f}",
                f"alpha bounding box: {report.alpha_bbox}",
                f"top margin: {margins[0] if margins else 'n/a'}",
                f"bottom margin: {margins[1] if margins else 'n/a'}",
                f"left margin: {margins[2] if margins else 'n/a'}",
                f"right margin: {margins[3] if margins else 'n/a'}",
                f"non-transparent pixels touching edge: {'yes' if report.touches_edge else 'no'}",
                f"source checkerboard suspected: {'yes' if report.source_checkerboard_suspected else 'no'}",
                f"checkerboard suspected: {'yes' if report.checkerboard_suspected else 'no'}",
                f"source top gray band suspected: {'yes' if report.source_top_gray_band_suspected else 'no'}",
                f"top gray band suspected: {'yes' if report.top_gray_band_suspected else 'no'}",
                f"pass/fail: {'PASS' if report.pass_fail else 'FAIL'}",
                "-" * 72,
            ]
        )

    pass_count = sum(1 for report in reports if report.pass_fail)
    fail_count = len(reports) - pass_count
    lines.extend(
        [
            "",
            f"Summary: {pass_count} PASS / {fail_count} FAIL / {len(reports)} total",
            (
                "Validated files copied to src/assets/cat/grooming."
                if fail_count == 0
                else "One or more files failed validation; final asset copy skipped."
            ),
        ]
    )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def generate_previews(reports: list[FrameReport]) -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    thumb_w = 210
    thumb_h = 260
    label_h = 24
    pad = 14
    cols = len(reports)
    sheet_w = cols * thumb_w + (cols + 1) * pad
    sheet_h = thumb_h + label_h + 2 * pad
    font = ImageFont.load_default()

    for name, bg in PREVIEW_BACKGROUNDS.items():
        sheet = Image.new("RGB", (sheet_w, sheet_h), bg)
        draw = ImageDraw.Draw(sheet)
        label_fill = (255, 255, 255) if sum(bg) < 300 else (20, 20, 20)

        for idx, report in enumerate(reports):
            img = Image.open(report.output_path).convert("RGBA")
            img.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            cell_x = pad + idx * (thumb_w + pad)
            cell_y = pad
            x = cell_x + (thumb_w - img.width) // 2
            y = cell_y + (thumb_h - img.height) // 2
            patch = Image.new("RGBA", img.size, (*bg, 255))
            composed = Image.alpha_composite(patch, img)
            sheet.paste(composed.convert("RGB"), (x, y))
            draw.text((cell_x, cell_y + thumb_h + 4), report.filename, fill=label_fill, font=font)

        sheet.save(PREVIEW_DIR / f"grooming_on_{name}.png", format="PNG")


def main() -> int:
    reports = process_frames()
    write_report(reports)
    generate_previews(reports)

    for report in reports:
        status = "PASS" if report.pass_fail else "FAIL"
        print(f"{report.filename}: {status}")
    print(f"report: {REPORT_PATH.relative_to(REPO_ROOT)}")
    print(f"previews: {PREVIEW_DIR.relative_to(REPO_ROOT)}/grooming_on_*.png")

    return 0 if all(report.pass_fail for report in reports) else 1


if __name__ == "__main__":
    raise SystemExit(main())
