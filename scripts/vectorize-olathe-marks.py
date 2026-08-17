"""Trace the official Olathe marks into self-contained SVG paths.

Why trace at all: the flyer templates are rasterised server-side by
@napi-rs/canvas, and that renderer silently DROPS nested <image> elements --
including base64 data URIs. A raster logo therefore renders correctly in a
browser preview and then disappears from the printed flyer, which is how a
previous pass shipped marks that vanished. Real vector paths are the only form
that survives the pipeline, so the official PNGs are converted to paths here.

These are official school and district marks. The trace has to be faithful, not
merely suggestive, so the settings below favour fidelity over file size.
"""

from pathlib import Path

import cv2
import numpy as np


ROOT = Path("public/templates/olathe")

# The marks ship at 300px. Tracing at that size turns every curve into visible
# stair-steps, so upscale first and trace the smooth version; the extra
# precision costs bytes but disappears into clean edges at print size.
SCALE = 4


def vectorize(source: Path, target: Path, colors: int = 8) -> None:
    image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"Could not read {source}")

    if image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)

    height, width = image.shape[:2]
    image = cv2.resize(
        image, (width * SCALE, height * SCALE), interpolation=cv2.INTER_LANCZOS4
    )

    rgb = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2RGB)
    alpha = image[:, :, 3]

    # Anti-aliased edges blend neighbouring colours into halo shades. Left in,
    # k-means spends its clusters describing those halos instead of the real
    # palette, which is what turned the owl into mud. A median blur collapses
    # them without softening the shapes themselves.
    rgb = cv2.medianBlur(rgb, 5)

    visible = alpha > 96
    pixels = rgb[visible].reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.25)
    _, labels, centers = cv2.kmeans(
        pixels,
        colors,
        None,
        criteria,
        8,
        cv2.KMEANS_PP_CENTERS,
    )
    centers = np.uint8(centers)

    quantized = np.zeros_like(rgb)
    quantized[visible] = centers[labels.flatten()]

    # Collect every region from every colour FIRST, then paint strictly
    # largest-area-first.
    #
    # The previous version painted light colours before dark ones. That is
    # backwards for a mascot: the white eye highlights are the lightest colour,
    # so they were laid down first and then buried under the navy that surrounds
    # them. Ordering by area instead means big shapes go down first and fine
    # detail always lands on top, which is also how the artwork was drawn.
    regions = []
    for color in centers.tolist():
        color_array = np.array(color, dtype=np.uint8)
        mask = np.all(quantized == color_array, axis=2).astype(np.uint8) * 255
        mask[~visible] = 0
        # Close pinholes left by the blur so shapes trace as solid regions.
        mask = cv2.morphologyEx(
            mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1
        )
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        hex_color = "#" + "".join(f"{component:02x}" for component in color)
        for contour in contours:
            area = cv2.contourArea(contour)
            # At 4x scale this drops only true speckle, not real detail.
            if area < 24:
                continue
            epsilon = max(0.6, 0.0006 * cv2.arcLength(contour, True))
            contour = cv2.approxPolyDP(contour, epsilon, True)
            points = contour.reshape((-1, 2))
            if len(points) < 3:
                continue
            path = "M" + " ".join(f"{x},{y}" for x, y in points) + "Z"
            regions.append((area, hex_color, path))

    regions.sort(key=lambda region: region[0], reverse=True)
    paths = [
        f'<path fill="{color}" d="{path}"/>' for _area, color, path in regions
    ]

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {width * SCALE} {height * SCALE}">'
        + "".join(paths)
        + "</svg>"
    )
    target.write_text(svg, encoding="utf-8")
    print(f"Wrote {target} ({len(paths)} paths)")


vectorize(ROOT / "olathe-west-official.png", ROOT / "olathe-west-official.svg", 8)
vectorize(
    ROOT / "olathe-public-schools-official.png",
    ROOT / "olathe-public-schools-official.svg",
    6,
)
