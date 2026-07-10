"""Build the small, renamed OFL font loaded by the deterministic artwork renderer.

One-time dependency (kept outside the application):
  python -m pip install fonttools
"""

from __future__ import annotations

import os
import string
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE_FONT = Path(
    os.environ.get("CHIANGWAY_SOURCE_FONT", r"C:\Windows\Fonts\NotoSansTC-VF.ttf")
)
OUTPUT_FONTS = [
    (400, "Regular", ROOT / "public" / "fonts" / "ChiangwayArtworkSans-Regular-subset.ttf"),
    (700, "Bold", ROOT / "public" / "fonts" / "ChiangwayArtworkSans-Bold-subset.ttf"),
    (900, "Black", ROOT / "public" / "fonts" / "ChiangwayArtworkSans-Black-subset.ttf"),
]
TEXT_SOURCES = [
    ROOT / "src" / "lib" / "artifacts" / "productionArtwork.ts",
    ROOT / "src" / "lib" / "artifacts" / "productionArtworkRenderer.ts",
]


def collect_text() -> str:
    source_text = "\n".join(path.read_text(encoding="utf-8") for path in TEXT_SOURCES)
    return source_text + string.ascii_letters + string.digits + string.punctuation


def rename_font(font: TTFont, weight: int, style: str) -> None:
    names = font["name"]
    renamed_ids = {1, 2, 3, 4, 6, 16, 17}
    names.names = [record for record in names.names if record.nameID not in renamed_ids]

    values = {
        1: "Chiangway Artwork Sans",
        2: style,
        3: f"Chiangway Artwork Sans {style} 2026-07-10",
        4: f"Chiangway Artwork Sans {style}",
        6: f"ChiangwayArtworkSans-{style}",
        16: "Chiangway Artwork Sans",
        17: style,
    }
    for name_id, value in values.items():
        names.setName(value, name_id, 3, 1, 0x409)

    font["OS/2"].usWeightClass = weight
    font["OS/2"].fsSelection &= ~((1 << 5) | (1 << 6))
    if weight >= 700:
        font["OS/2"].fsSelection |= 1 << 5
        font["head"].macStyle |= 1
    else:
        font["OS/2"].fsSelection |= 1 << 6
        font["head"].macStyle &= ~1


def main() -> None:
    if not SOURCE_FONT.exists():
        raise SystemExit(
            f"Source font not found: {SOURCE_FONT}. Set CHIANGWAY_SOURCE_FONT to an OFL Noto Sans TC variable TTF."
        )

    OUTPUT_FONTS[0][2].parent.mkdir(parents=True, exist_ok=True)
    options = subset.Options()
    options.flavor = None
    options.layout_features = ["*"]
    options.name_IDs = [0, 5, 7, 8, 9, 10, 11, 12, 13, 14]
    options.name_languages = ["*"]
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True

    for weight, style, output_font in OUTPUT_FONTS:
        font = TTFont(SOURCE_FONT)
        instantiateVariableFont(font, {"wght": weight}, inplace=True)
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=collect_text())
        subsetter.subset(font)
        rename_font(font, weight, style)
        font.flavor = None
        font.save(output_font)
        print(
            f"Wrote {output_font.relative_to(ROOT)} "
            f"({output_font.stat().st_size} bytes, weight {weight})"
        )


if __name__ == "__main__":
    main()
