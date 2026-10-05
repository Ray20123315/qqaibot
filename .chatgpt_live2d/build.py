from __future__ import annotations

import colorsys
import hashlib
import json
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

VERSION = "v0.0.2"
SOURCE_MODEL = "Mao"
SOURCE_LABEL = "Live2D official Niziiro Mao sample"
SOURCE_PAGE = "https://www.live2d.com/en/learn/sample/niziiro-mao/"
ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
OUT = DIST / f"Aye_Live2D_runtime_{VERSION}"
MODEL = OUT / "Aye"
SOURCE_ZIP = ROOT / "CubismWebSamples-develop.zip"
SOURCE_URL = "https://github.com/Live2D/CubismWebSamples/archive/refs/heads/develop.zip"


def download(url: str, dst: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Aye-Live2D-builder/0.0.2"})
    with urllib.request.urlopen(req, timeout=120) as response, dst.open("wb") as fp:
        shutil.copyfileobj(response, fp)


def recolor_texture(src: Path, dst: Path, original_copy: Path) -> None:
    image = Image.open(src).convert("RGBA")
    image.save(original_copy, optimize=True)
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue

            # Keep line art, facial shadows, and nearly neutral whites intact.
            if max(r, g, b) < 28:
                continue

            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)

            # Saturated orange/yellow hair and trims -> silver-white/lavender.
            if 0.035 <= h <= 0.17 and s >= 0.38 and v >= 0.32:
                luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
                base = int(max(170, min(250, 170 + luminance * 0.34)))
                pink_highlight = 13 if ((x * 3 + y * 2) % 420) < 55 else 0
                pixels[x, y] = (
                    min(255, base + pink_highlight),
                    min(250, base - 5),
                    min(255, base + 12 + pink_highlight // 2),
                    a,
                )
                continue

            # Deep blue/violet hat and outerwear -> black-charcoal with pink undertone.
            if (0.53 <= h <= 0.78) and s >= 0.25 and v <= 0.78:
                lum = int((r + g + b) / 3)
                pixels[x, y] = (
                    max(32, min(102, lum - 4)),
                    max(27, min(80, lum - 18)),
                    max(40, min(112, lum + 5)),
                    a,
                )
                continue

            # Bright cyan/blue magical accents and irises -> vivid rose pink.
            if 0.46 <= h <= 0.70 and s >= 0.45 and v > 0.58:
                shade = int(35 * (1.0 - v))
                pixels[x, y] = (244 - shade, 70 - shade // 3, 156 - shade // 2, a)
                continue

            # Existing reds/magentas -> coordinated pastel pink.
            if (h <= 0.03 or h >= 0.88) and s >= 0.28:
                lum = int((r + g + b) / 3)
                pixels[x, y] = (
                    min(255, 222 + lum // 8),
                    min(218, 105 + lum // 3),
                    min(232, 155 + lum // 4),
                    a,
                )
                continue

            # Green accents -> pink.
            if 0.20 <= h <= 0.46 and s >= 0.38:
                pixels[x, y] = (238, 95, 166, a)

    # Small non-rig-breaking paw motifs in otherwise opaque atlas areas.
    draw = ImageDraw.Draw(image, "RGBA")
    for cx, cy, scale in ((1320, 1725, 18), (1420, 1782, 14), (1510, 1708, 12)):
        color = (236, 91, 159, 150)
        draw.ellipse((cx - scale, cy - scale, cx + scale, cy + scale), fill=color)
        toe = max(5, scale // 2)
        for ox, oy in ((-scale, -scale), (0, -scale - 4), (scale, -scale)):
            draw.ellipse((cx + ox - toe, cy + oy - toe, cx + ox + toe, cy + oy + toe), fill=color)

    dst.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst, optimize=True)


def rewrite_model_json(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    refs = data["FileReferences"]
    refs["Moc"] = "Aye.moc3"
    refs["Textures"] = ["Aye.2048/texture_00.png"]
    mapping = {
        "Physics": "Aye.physics3.json",
        "Pose": "Aye.pose3.json",
        "UserData": "Aye.userdata3.json",
        "DisplayInfo": "Aye.cdi3.json",
    }
    for key, value in mapping.items():
        if key in refs:
            refs[key] = value
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def verify_model(model_dir: Path) -> dict[str, object]:
    model_json = model_dir / "Aye.model3.json"
    data = json.loads(model_json.read_text(encoding="utf-8"))
    refs = data["FileReferences"]

    referenced = [refs["Moc"], *refs["Textures"]]
    for optional in ("Physics", "UserData", "DisplayInfo", "Pose"):
        if optional in refs:
            referenced.append(refs[optional])
    for items in refs.get("Motions", {}).values():
        referenced.extend(item["File"] for item in items)
    for item in refs.get("Expressions", []):
        referenced.append(item["File"])

    missing = [item for item in referenced if not (model_dir / item).is_file()]
    if missing:
        raise RuntimeError(f"Missing referenced files: {missing}")

    moc_path = model_dir / refs["Moc"]
    if moc_path.read_bytes()[:4] != b"MOC3":
        raise RuntimeError("Invalid MOC3 magic header")

    texture_path = model_dir / refs["Textures"][0]
    with Image.open(texture_path) as texture:
        if texture.size != (2048, 2048):
            raise RuntimeError(f"Unexpected texture size: {texture.size}")
        texture_info = {"size": list(texture.size), "mode": texture.mode}

    expression_count = len(refs.get("Expressions", []))
    motion_count = sum(len(items) for items in refs.get("Motions", {}).values())
    if expression_count < 1 or motion_count < 1:
        raise RuntimeError("Expected a VTuber-ready model with expressions and motions")

    files = []
    for file in sorted(p for p in model_dir.rglob("*") if p.is_file()):
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        files.append({
            "path": file.relative_to(model_dir).as_posix(),
            "bytes": file.stat().st_size,
            "sha256": digest,
        })

    return {
        "model": "阿叶睡不醒QAQ",
        "version": VERSION,
        "base_skeleton": SOURCE_LABEL,
        "moc3_magic": "MOC3",
        "texture": texture_info,
        "expressions": expression_count,
        "motions": motion_count,
        "referenced_file_count": len(referenced),
        "missing_references": missing,
        "files": files,
    }


def main() -> None:
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir(parents=True)

    download(SOURCE_URL, SOURCE_ZIP)
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        shutil.unpack_archive(SOURCE_ZIP, temp)
        src_model = temp / "CubismWebSamples-develop" / "Samples" / "Resources" / SOURCE_MODEL
        if not src_model.is_dir():
            raise RuntimeError(f"Official {SOURCE_MODEL} model directory not found: {src_model}")
        shutil.copytree(src_model, MODEL)

    original_texture = MODEL / f"{SOURCE_MODEL}.2048" / "texture_00.png"
    recolored_texture = MODEL / "Aye.2048" / "texture_00.png"
    original_copy = OUT / "SOURCE_REFERENCE" / "Mao_original_texture_00.png"
    original_copy.parent.mkdir(parents=True, exist_ok=True)
    recolor_texture(original_texture, recolored_texture, original_copy)
    shutil.rmtree(MODEL / f"{SOURCE_MODEL}.2048")

    renames = {
        f"{SOURCE_MODEL}.moc3": "Aye.moc3",
        f"{SOURCE_MODEL}.model3.json": "Aye.model3.json",
        f"{SOURCE_MODEL}.physics3.json": "Aye.physics3.json",
        f"{SOURCE_MODEL}.pose3.json": "Aye.pose3.json",
        f"{SOURCE_MODEL}.userdata3.json": "Aye.userdata3.json",
        f"{SOURCE_MODEL}.cdi3.json": "Aye.cdi3.json",
    }
    for old, new in renames.items():
        old_path = MODEL / old
        if old_path.exists():
            old_path.rename(MODEL / new)

    rewrite_model_json(MODEL / "Aye.model3.json")

    notice = f"""# 阿叶睡不醒QAQ Live2D Runtime 模型包 {VERSION}

## 使用方式

1. 解压缩本资料夹。
2. 将整个 `Aye` 资料夹复制到 VTube Studio 的 `Live2DModels` 资料夹。
3. 在 VTube Studio 重新载入模型清单并选择 `Aye`。

## 模型性质

- 这是含真实 `.moc3`、贴图、物理、姿势、表情与动态的 Live2D Runtime 模型。
- 网格、参数与动作骨架来自 {SOURCE_LABEL}。
- 外观贴图已改为银白、粉色、黑色的可爱主播配色，并保留原 UV 与透明度以避免破坏绑定。
- 因为沿用官方示例骨架，它不是从零绑定的商业级独占模型；角色轮廓与可动范围仍受 Mao 骨架限制。
- 本包不包含可编辑 `.cmo3`。`.moc3` 是可供 VTube Studio/SDK 载入的 Runtime 数据，不是 Cubism Editor 工程。

## 授权与署名

使用前必须阅读并同意：

- Live2D Free Material License Agreement
- Terms of Use for Live2D Cubism Sample Data

Credit: `Live2D Inc. / Niziiro Mao sample model`
Official sample page: {SOURCE_PAGE}
"""
    (OUT / "README_使用说明.md").write_text(notice, encoding="utf-8")

    vtube = {
        "Name": "阿叶睡不醒QAQ",
        "ModelID": "Aye",
        "ModelVersion": VERSION,
        "Notes": "Derivative runtime using Live2D official Niziiro Mao sample skeleton.",
    }
    (MODEL / "Aye.vtube.json").write_text(
        json.dumps(vtube, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    manifest = verify_model(MODEL)
    (OUT / "VERIFY.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    archive = DIST / f"Aye_Live2D_runtime_{VERSION}.tar.gz"
    with tarfile.open(archive, "w:gz") as tf:
        tf.add(OUT, arcname=OUT.name)

    print(json.dumps({
        "archive": str(archive),
        "archive_bytes": archive.stat().st_size,
        "model_file_count": len(manifest["files"]),
        "expressions": manifest["expressions"],
        "motions": manifest["motions"],
        "verification": "passed",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
