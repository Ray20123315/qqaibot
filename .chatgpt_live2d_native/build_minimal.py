from __future__ import annotations

import json
from pathlib import Path

from moc3 import Moc3
from moc3._core import CountIdx, MocVersion, SECTION_LAYOUT
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist_minimal"
DIST.mkdir(parents=True, exist_ok=True)


def main() -> None:
    moc = Moc3()
    moc.header.version = MocVersion.V3_00
    moc.header.endian = 0

    # Initialize every known V3.00 section explicitly. This avoids inheriting
    # any data from another model and makes the binary reproducible.
    for entry in SECTION_LAYOUT:
        moc[entry.name] = []

    moc.counts[CountIdx.PARTS] = 1
    moc.counts[CountIdx.ART_MESHES] = 1
    moc.counts[CountIdx.PART_KEYFORMS] = 1
    moc.counts[CountIdx.ART_MESH_KEYFORMS] = 1
    moc.counts[CountIdx.KEYFORM_POSITIONS] = 8  # four x/y pairs
    moc.counts[CountIdx.UVS] = 8                # four u/v pairs
    moc.counts[CountIdx.POSITION_INDICES] = 6   # two triangles

    moc.canvas.pixels_per_unit = 1.0
    moc.canvas.origin_x = 0.0
    moc.canvas.origin_y = 0.0
    moc.canvas.canvas_width = 2.0
    moc.canvas.canvas_height = 2.0
    moc.canvas.canvas_flag = 0

    moc["part.ids"] = ["PartAyeRoot"]
    moc["part.keyform_binding_band_indices"] = [-1]
    moc["part.keyform_begin_indices"] = [0]
    moc["part.keyform_counts"] = [1]
    moc["part.visibles"] = [True]
    moc["part.enables"] = [True]
    moc["part.parent_part_indices"] = [-1]

    moc["art_mesh.ids"] = ["ArtMeshAyeMinimal"]
    moc["art_mesh.keyform_binding_band_indices"] = [-1]
    moc["art_mesh.keyform_begin_indices"] = [0]
    moc["art_mesh.keyform_counts"] = [1]
    moc["art_mesh.visibles"] = [True]
    moc["art_mesh.enables"] = [True]
    moc["art_mesh.parent_part_indices"] = [0]
    moc["art_mesh.parent_deformer_indices"] = [-1]
    moc["art_mesh.texture_indices"] = [0]
    moc["art_mesh.drawable_flags"] = [0]
    moc["art_mesh.position_index_counts"] = [6]
    moc["art_mesh.uv_begin_indices"] = [0]
    moc["art_mesh.position_index_begin_indices"] = [0]
    moc["art_mesh.vertex_counts"] = [4]
    moc["art_mesh.mask_begin_indices"] = [0]
    moc["art_mesh.mask_counts"] = [0]

    moc["part_keyform.draw_orders"] = [0.0]
    moc["art_mesh_keyform.opacities"] = [1.0]
    moc["art_mesh_keyform.draw_orders"] = [0.0]
    moc["art_mesh_keyform.keyform_position_begin_indices"] = [0]

    # Counter-clockwise quad in model coordinates.
    moc["keyform_position.xys"] = [
        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,
        -1.0,  1.0,
    ]
    moc["uv.xys"] = [
        0.0, 1.0,
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,
    ]
    moc["position_index.indices"] = [0, 1, 2, 2, 3, 0]

    moc_path = DIST / "Aye_Minimal.moc3"
    moc.to_file(moc_path)

    # A procedural test texture is used only for the compiler gate; it is not
    # part of the final character model and contains no third-party artwork.
    texture = Image.new("RGBA", (256, 256), (255, 238, 246, 255))
    draw = ImageDraw.Draw(texture)
    draw.rectangle((16, 16, 239, 239), outline=(30, 24, 32, 255), width=8)
    draw.ellipse((72, 64, 184, 176), fill=(255, 180, 210, 255))
    texture.save(DIST / "texture_00.png")

    model3 = {
        "Version": 3,
        "FileReferences": {
            "Moc": "Aye_Minimal.moc3",
            "Textures": ["texture_00.png"],
        },
        "Groups": [],
        "HitAreas": [],
    }
    (DIST / "Aye_Minimal.model3.json").write_text(
        json.dumps(model3, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Round-trip through the same independent parser/writer before Core test.
    parsed = Moc3.from_file(moc_path)
    roundtrip_path = DIST / "Aye_Minimal.roundtrip.moc3"
    parsed.to_file(roundtrip_path)
    if moc_path.read_bytes() != roundtrip_path.read_bytes():
        raise RuntimeError("py-moc3 round-trip was not byte-identical")

    report = {
        "stage": "minimal-static-moc3",
        "uses_sample_model_data": False,
        "part_ids": parsed.part_ids,
        "art_mesh_ids": parsed.art_mesh_ids,
        "parameter_ids": parsed.parameter_ids,
        "moc3_bytes": moc_path.stat().st_size,
        "roundtrip_identical": True,
        "summary": parsed.summary(),
    }
    (DIST / "PY_MOC3_VERIFY.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
