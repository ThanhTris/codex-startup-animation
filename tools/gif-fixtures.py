"""Generate synthetic benchmark inputs, without reading personal wallpaper images."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
palette = [component for i in range(256) for component in ((i * 3) % 256, (i * 5 + 30) % 256, (i * 7 + 90) % 256)]
manifest = []
for width, height in ((1280, 720), (1920, 1080)):
    yy, xx = np.indices((height, width), dtype=np.uint16)
    base = ((xx // 9 + yy // 7) % 224).astype(np.uint8)
    del xx, yy
    frames = []
    for index in range(24):
        frame = Image.fromarray((base.astype(np.uint16) + index * 3).astype(np.uint8)).convert("P")
        frame.putpalette(palette)
        draw = ImageDraw.Draw(frame)
        x = int((width - width // 4) * index / 23)
        draw.rounded_rectangle((x, height // 4, x + width // 4, height * 3 // 4), radius=height // 12, fill=240, outline=15, width=6)
        draw.text((30, 30), f"SYNTHETIC GIF TEST / {width}x{height} / FRAME {index}", fill=255)
        frames.append(frame)
    gif = destination / f"synthetic-{height}p.gif"
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=30, loop=0, disposal=2, optimize=False)
    if height == 1080:
        frames[0].convert("RGB").save(destination / "static-1080p.png")
    manifest.append({"file": gif.name, "width": width, "height": height, "frames": 24, "frame_delay_ms": 30, "bytes": gif.stat().st_size})
    for frame in frames:
        frame.close()
    del frames, base
(destination / "fixtures.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest))
