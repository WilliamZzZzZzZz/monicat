#!/usr/bin/env python3
"""
Clean MochiCat frame backgrounds into true RGBA PNGs.

The cleaner is intentionally conservative: it estimates the background from the
image border, removes only background-like regions connected to the image edge,
and keeps the cat pixels untouched. This is meant for white/gray/black/fake
transparent backgrounds, not for repainting or regenerating art.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import binary_dilation, label as nd_label


def _border_pixels(rgb: np.ndarray, width: int = 12) -> np.ndarray:
    top = rgb[:width, :, :]
    bottom = rgb[-width:, :, :]
    left = rgb[:, :width, :]
    right = rgb[:, -width:, :]
    return np.concatenate([
        top.reshape(-1, 3),
        bottom.reshape(-1, 3),
        left.reshape(-1, 3),
        right.reshape(-1, 3),
    ], axis=0)


def _edge_connected(mask: np.ndarray, border_width: int = 2) -> np.ndarray:
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


def clean_asset_alpha(src_path: Path, dst_path: Path) -> dict[str, object]:
    src = Image.open(src_path)
    original_mode = src.mode
    rgba = src.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    has_real_alpha = original_mode in {"RGBA", "LA"} or "transparency" in src.info
    border_alpha = np.concatenate([
        alpha[:12, :].ravel(),
        alpha[-12:, :].ravel(),
        alpha[:, :12].ravel(),
        alpha[:, -12:].ravel(),
    ])
    alpha_already_clean = has_real_alpha and float((border_alpha > 8).mean()) < 0.002

    if alpha_already_clean:
        cleaned = rgba
        removed_ratio = 0.0
    else:
        border = _border_pixels(rgb)
        bg_color = np.median(border, axis=0)
        dist = np.linalg.norm(rgb - bg_color, axis=2)
        ch_min = rgb.min(axis=2)
        ch_max = rgb.max(axis=2)
        ch_std = rgb.std(axis=2)

        near_sampled_bg = dist <= 30
        near_white_or_gray = (ch_min >= 232) & (ch_std <= 18)
        near_black = (ch_max <= 32) & (ch_std <= 18)
        background_candidate = near_sampled_bg | near_white_or_gray | near_black

        # Protect the cat body and edge details by expanding obvious foreground.
        foreground_core = (dist > 42) | ((ch_max - ch_min) > 28) | (ch_max < 220)
        protected = binary_dilation(foreground_core, structure=np.ones((5, 5), dtype=bool))
        background_candidate &= ~protected

        background = _edge_connected(background_candidate, border_width=3)
        background = binary_dilation(background, structure=np.ones((3, 3), dtype=bool))

        new_alpha = np.where(background, 0, 255).astype(np.uint8)
        alpha_image = Image.fromarray(new_alpha, mode="L")
        edge_image = alpha_image.filter(ImageFilter.FIND_EDGES)
        edge = np.array(edge_image) > 10
        blend_zone = binary_dilation(edge, structure=np.ones((5, 5), dtype=bool))
        feathered = np.array(alpha_image.filter(ImageFilter.GaussianBlur(radius=0.8)))
        new_alpha[blend_zone] = feathered[blend_zone]

        out = arr.copy()
        out[:, :, 3] = new_alpha
        cleaned = Image.fromarray(out, mode="RGBA")
        removed_ratio = float(background.mean())

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.save(dst_path, format="PNG")

    final_alpha = np.array(cleaned.getchannel("A"))
    bbox = cleaned.getbbox()
    return {
        "source": str(src_path),
        "output": str(dst_path),
        "source_mode": original_mode,
        "size": f"{w}x{h}",
        "had_alpha": has_real_alpha,
        "alpha_already_clean": alpha_already_clean,
        "removed_ratio": removed_ratio,
        "transparent_ratio": float((final_alpha == 0).mean()),
        "semi_transparent_ratio": float(((final_alpha > 0) & (final_alpha < 255)).mean()),
        "alpha_bbox": bbox,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean one cat asset into RGBA PNG.")
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    stats = clean_asset_alpha(args.source, args.output)
    for key, value in stats.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
