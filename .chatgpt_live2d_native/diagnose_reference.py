from __future__ import annotations

import json
from pathlib import Path

from moc3 import Moc3
from moc3._core import CountIdx, SECTION_LAYOUT

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist_minimal"
REFERENCE = ROOT / "reference_mao.moc3"

COUNT_NAMES = {
    CountIdx.PARTS: "parts",
    CountIdx.DEFORMERS: "deformers",
    CountIdx.WARP_DEFORMERS: "warp_deformers",
    CountIdx.ROTATION_DEFORMERS: "rotation_deformers",
    CountIdx.ART_MESHES: "art_meshes",
    CountIdx.PARAMETERS: "parameters",
    CountIdx.PART_KEYFORMS: "part_keyforms",
    CountIdx.WARP_DEFORMER_KEYFORMS: "warp_deformer_keyforms",
    CountIdx.ROTATION_DEFORMER_KEYFORMS: "rotation_deformer_keyforms",
    CountIdx.ART_MESH_KEYFORMS: "art_mesh_keyforms",
    CountIdx.KEYFORM_POSITIONS: "keyform_positions",
    CountIdx.KEYFORM_BINDING_INDICES: "keyform_binding_indices",
    CountIdx.KEYFORM_BINDING_BANDS: "keyform_binding_bands",
    CountIdx.KEYFORM_BINDINGS: "keyform_bindings",
    CountIdx.KEYS: "keys",
    CountIdx.UVS: "uvs",
    CountIdx.POSITION_INDICES: "position_indices",
    CountIdx.DRAWABLE_MASKS: "drawable_masks",
    CountIdx.DRAW_ORDER_GROUPS: "draw_order_groups",
    CountIdx.DRAW_ORDER_GROUP_OBJECTS: "draw_order_group_objects",
    CountIdx.GLUES: "glues",
    CountIdx.GLUE_INFOS: "glue_infos",
    CountIdx.GLUE_KEYFORMS: "glue_keyforms",
}


def preview(value):
    if isinstance(value, float):
        return round(value, 6)
    return value


def main() -> None:
    if not REFERENCE.is_file():
        raise FileNotFoundError(REFERENCE)

    moc = Moc3.from_file(REFERENCE)
    roundtrip = ROOT / "reference_mao.roundtrip.moc3"
    moc.to_file(roundtrip)

    sections = {}
    for entry in moc._layout:
        data = moc._sections.get(entry.name, [])
        if data:
            sections[entry.name] = {
                "length": len(data),
                "sample": [preview(v) for v in data[:16]],
            }

    report = {
        "reference_used_for_format_diagnostics_only": True,
        "reference_will_not_be_packaged": True,
        "version": int(moc.header.version),
        "canvas": {
            "pixels_per_unit": moc.canvas.pixels_per_unit,
            "origin_x": moc.canvas.origin_x,
            "origin_y": moc.canvas.origin_y,
            "width": moc.canvas.canvas_width,
            "height": moc.canvas.canvas_height,
            "flag": moc.canvas.canvas_flag,
        },
        "counts": {
            COUNT_NAMES.get(i, str(i)): value
            for i, value in enumerate(moc.counts)
        },
        "section_count": len(sections),
        "sections": sections,
        "roundtrip_identical": REFERENCE.read_bytes() == roundtrip.read_bytes(),
    }

    (DIST / "REFERENCE_FORMAT_DIAGNOSTIC.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
