from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path

from moc3 import Moc3
from moc3._core import CountIdx, MocVersion, SECTION_LAYOUT
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist_minimal"
DIST.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Variant:
    name: str
    version: int
    corrected_mesh_counts: bool
    drawable_flag: int
    draw_order: float
    empty_binding_band: bool
    parameter_binding: bool


VARIANTS = [
    Variant("baseline_v3", MocVersion.V3_00, False, 0, 0.0, False, False),
    Variant("mesh_counts_v3", MocVersion.V3_00, True, 0, 0.0, False, False),
    Variant("mesh_flags_v3", MocVersion.V3_00, True, 4, 500.0, False, False),
    Variant("empty_band_v3", MocVersion.V3_00, True, 4, 500.0, True, False),
    Variant("parameter_band_v3", MocVersion.V3_00, True, 4, 500.0, True, True),
    Variant("empty_band_v402", MocVersion.V4_02, True, 4, 500.0, True, False),
    Variant("parameter_band_v402", MocVersion.V4_02, True, 4, 500.0, True, True),
]


def initialize_sections(moc: Moc3) -> None:
    for entry in SECTION_LAYOUT:
        moc[entry.name] = []
    # V3.03+ writer appends this section dynamically.
    moc["additional.quad_transforms"] = []


def build_variant(variant: Variant) -> tuple[Path, dict]:
    moc = Moc3()
    moc.header.version = variant.version
    moc.header.endian = 0
    initialize_sections(moc)

    moc.counts[CountIdx.PARTS] = 1
    moc.counts[CountIdx.ART_MESHES] = 1
    moc.counts[CountIdx.PART_KEYFORMS] = 1
    moc.counts[CountIdx.ART_MESH_KEYFORMS] = 1
    moc.counts[CountIdx.KEYFORM_POSITIONS] = 8
    moc.counts[CountIdx.UVS] = 8
    moc.counts[CountIdx.POSITION_INDICES] = 6

    if variant.empty_binding_band:
        moc.counts[CountIdx.KEYFORM_BINDING_BANDS] = 1
        moc["keyform_binding_band.begin_indices"] = [0]
        moc["keyform_binding_band.counts"] = [1 if variant.parameter_binding else 0]

    if variant.parameter_binding:
        moc.counts[CountIdx.PARAMETERS] = 1
        moc.counts[CountIdx.KEYFORM_BINDING_INDICES] = 1
        moc.counts[CountIdx.KEYFORM_BINDINGS] = 1
        moc.counts[CountIdx.KEYS] = 1

        moc["parameter.ids"] = ["ParamAyeTest"]
        moc["parameter.max_values"] = [1.0]
        moc["parameter.min_values"] = [-1.0]
        moc["parameter.default_values"] = [0.0]
        moc["parameter.repeats"] = [False]
        moc["parameter.decimal_places"] = [3]
        moc["parameter.keyform_binding_begin_indices"] = [0]
        moc["parameter.keyform_binding_counts"] = [1]

        moc["keyform_binding_index.indices"] = [0]
        moc["keyform_binding.keys_begin_indices"] = [0]
        moc["keyform_binding.keys_counts"] = [1]
        moc["keys.values"] = [0.0]

    moc.canvas.pixels_per_unit = 100.0
    moc.canvas.origin_x = 100.0
    moc.canvas.origin_y = 100.0
    moc.canvas.canvas_width = 200.0
    moc.canvas.canvas_height = 200.0
    moc.canvas.canvas_flag = 0

    band_index = 0 if variant.empty_binding_band else -1

    moc["part.ids"] = ["PartAyeRoot"]
    moc["part.keyform_binding_band_indices"] = [band_index]
    moc["part.keyform_begin_indices"] = [0]
    moc["part.keyform_counts"] = [1]
    moc["part.visibles"] = [True]
    moc["part.enables"] = [True]
    moc["part.parent_part_indices"] = [-1]

    moc["art_mesh.ids"] = [f"ArtMeshAye_{variant.name}"]
    moc["art_mesh.keyform_binding_band_indices"] = [band_index]
    moc["art_mesh.keyform_begin_indices"] = [0]
    moc["art_mesh.keyform_counts"] = [1]
    moc["art_mesh.visibles"] = [True]
    moc["art_mesh.enables"] = [True]
    moc["art_mesh.parent_part_indices"] = [0]
    moc["art_mesh.parent_deformer_indices"] = [-1]
    moc["art_mesh.texture_indices"] = [0]
    moc["art_mesh.drawable_flags"] = [variant.drawable_flag]

    # py-moc3's names are misleading: reference models show that
    # position_index_counts stores the number of vertices, while vertex_counts
    # stores the number of triangle indices.
    if variant.corrected_mesh_counts:
        moc["art_mesh.position_index_counts"] = [4]
        moc["art_mesh.vertex_counts"] = [6]
    else:
        moc["art_mesh.position_index_counts"] = [6]
        moc["art_mesh.vertex_counts"] = [4]

    moc["art_mesh.uv_begin_indices"] = [0]
    moc["art_mesh.position_index_begin_indices"] = [0]
    moc["art_mesh.mask_begin_indices"] = [0]
    moc["art_mesh.mask_counts"] = [0]

    moc["part_keyform.draw_orders"] = [variant.draw_order]
    moc["art_mesh_keyform.opacities"] = [1.0]
    moc["art_mesh_keyform.draw_orders"] = [variant.draw_order]
    moc["art_mesh_keyform.keyform_position_begin_indices"] = [0]

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

    path = DIST / f"Aye_Candidate_{variant.name}.moc3"
    moc.to_file(path)

    parsed = Moc3.from_file(path)
    roundtrip = DIST / f"Aye_Candidate_{variant.name}.roundtrip.moc3"
    parsed.to_file(roundtrip)

    return path, {
        "name": variant.name,
        "version": int(variant.version),
        "corrected_mesh_counts": variant.corrected_mesh_counts,
        "drawable_flag": variant.drawable_flag,
        "draw_order": variant.draw_order,
        "empty_binding_band": variant.empty_binding_band,
        "parameter_binding": variant.parameter_binding,
        "bytes": path.stat().st_size,
        "roundtrip_identical": path.read_bytes() == roundtrip.read_bytes(),
        "part_ids": parsed.part_ids,
        "art_mesh_ids": parsed.art_mesh_ids,
        "parameter_ids": parsed.parameter_ids,
        "summary": parsed.summary(),
    }


def main() -> None:
    # Remove stale outputs so the CI matrix cannot accidentally validate an old
    # candidate from an earlier attempt.
    for path in DIST.glob("Aye_Candidate_*.moc3"):
        path.unlink()
    for path in DIST.glob("Aye_Candidate_*.roundtrip.moc3"):
        path.unlink()

    results = []
    candidate_paths = []
    for variant in VARIANTS:
        path, report = build_variant(variant)
        candidate_paths.append(path)
        results.append(report)

    # Preserve the most complete original candidate under the stable name used
    # by model3.json. Core still decides whether it is actually valid.
    selected = DIST / "Aye_Candidate_parameter_band_v402.moc3"
    stable = DIST / "Aye_Minimal.moc3"
    shutil.copy2(selected, stable)
    shutil.copy2(
        DIST / "Aye_Candidate_parameter_band_v402.roundtrip.moc3",
        DIST / "Aye_Minimal.roundtrip.moc3",
    )

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

    report = {
        "stage": "minimal-static-moc3-candidate-matrix",
        "uses_sample_model_data": False,
        "candidate_count": len(results),
        "stable_candidate": selected.name,
        "candidates": results,
    }
    (DIST / "PY_MOC3_VERIFY.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (DIST / "CANDIDATE_FILES.txt").write_text(
        "\n".join(path.name for path in candidate_paths) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
