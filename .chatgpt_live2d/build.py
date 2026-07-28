from __future__ import annotations

import hashlib
import json
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image

VERSION = "v0.0.1"
ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
OUT = DIST / f"Aye_Live2D_runtime_{VERSION}"
MODEL = OUT / "Aye"
SOURCE_ZIP = ROOT / "CubismWebSamples-develop.zip"
SOURCE_URL = "https://github.com/Live2D/CubismWebSamples/archive/refs/heads/develop.zip"


def download(url: str, dst: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Aye-Live2D-builder/0.0.1"})
    with urllib.request.urlopen(req, timeout=120) as response, dst.open("wb") as fp:
        shutil.copyfileobj(response, fp)


def recolor_texture(src: Path, dst: Path) -> None:
    image = Image.open(src).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue

            # Preserve black line art and very dark details.
            if max(r, g, b) < 45:
                continue

            # Brown hair -> silver-white with cool lavender shadows and pink highlights.
            if 70 <= r <= 190 and 50 <= g <= 160 and 35 <= b <= 135 and r >= g >= b:
                lum = (r + g + b) / 3
                base = int(max(184, min(246, 188 + (lum - 70) * 0.48)))
                pink_band = 12 if (x + 2 * y) % 260 < 36 else 0
                pixels[x, y] = (
                    min(255, base + pink_band),
                    min(250, base - 4),
                    min(255, base + 10 + pink_band // 2),
                    a,
                )
                continue

            # Red jacket and sleeves -> pastel pink.
            if r > 185 and g < 145 and b < 165 and r > g * 1.45:
                shade = int((g + b) * 0.22)
                pixels[x, y] = (255, min(205, 132 + shade), min(224, 165 + shade), a)
                continue

            # Green irises / accents -> vivid pink-magenta.
            if g > 85 and g > r * 1.45 and g > b * 1.35:
                pixels[x, y] = (244, 73, 153, a)
                continue

            # Blue shorts -> charcoal/black with a pink undertone.
            if b > 80 and b > r * 1.35 and g > r * 1.15:
                pixels[x, y] = (59, 47, 65, a)
                continue

            # Dark blue-grey shoes -> near black with soft lavender highlights.
            if 35 <= r <= 130 and 35 <= g <= 140 and 45 <= b <= 175 and b >= r:
                avg = int((r + g + b) / 3)
                pixels[x, y] = (max(38, avg - 25), max(34, avg - 30), max(48, avg - 12), a)

    dst.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst, optimize=True)


def rewrite_model_json(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    refs = data["FileReferences"]
    refs["Moc"] = "Aye.moc3"
    refs["Textures"] = ["Aye.2048/texture_00.png"]
    if "Physics" in refs:
        refs["Physics"] = "Aye.physics3.json"
    if "UserData" in refs:
        refs["UserData"] = "Aye.userdata3.json"
    if "DisplayInfo" in refs:
        refs["DisplayInfo"] = "Aye.cdi3.json"
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
    with Image.open(texture_path) as image:
        if image.size != (2048, 2048):
            raise RuntimeError(f"Unexpected texture size: {image.size}")
        texture_info = {"size": list(image.size), "mode": image.mode}

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
        "base_skeleton": "Live2D official Mark-kun sample",
        "moc3_magic": "MOC3",
        "texture": texture_info,
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
        src_model = temp / "CubismWebSamples-develop" / "Samples" / "Resources" / "Mark"
        if not src_model.is_dir():
            raise RuntimeError(f"Official Mark model directory not found: {src_model}")

        shutil.copytree(src_model, MODEL)

    original_texture = MODEL / "Mark.2048" / "texture_00.png"
    recolored_texture = MODEL / "Aye.2048" / "texture_00.png"
    recolor_texture(original_texture, recolored_texture)
    shutil.rmtree(MODEL / "Mark.2048")

    renames = {
        "Mark.moc3": "Aye.moc3",
        "Mark.model3.json": "Aye.model3.json",
        "Mark.physics3.json": "Aye.physics3.json",
        "Mark.userdata3.json": "Aye.userdata3.json",
        "Mark.cdi3.json": "Aye.cdi3.json",
    }
    for old, new in renames.items():
        old_path = MODEL / old
        if old_path.exists():
            old_path.rename(MODEL / new)

    rewrite_model_json(MODEL / "Aye.model3.json")

    notice = """# 阿叶睡不醒QAQ Live2D Runtime 模型包

## 使用方式

1. 解压缩本资料夹。
2. 将整个 `Aye` 资料夹复制到 VTube Studio 的 `Live2DModels` 资料夹。
3. 在 VTube Studio 重新载入模型清单并选择 `Aye`。

## 模型性质

- 这是可载入的 Live2D Runtime 模型，不是空壳 JSON。
- `.moc3`、网格、参数与动作骨架来自 Live2D 官方 Mark-kun 示例。
- 外观贴图已重制为粉白、黑蝴蝶结风格。
- 因为沿用 Mark-kun 骨架，初版为简易 Q 版结构，不等同从零绘制与绑定的商业级独占模型。
- 本包不包含可编辑 `.cmo3`；编辑骨架需从 Live2D 官方示例页面另行下载并在 Cubism Editor 中打开。

## 授权与署名

使用前必须阅读并同意：

- Live2D Free Material License Agreement
- Terms of Use for Live2D Cubism Sample Data

Credit: `Live2D Inc. / Mark-kun sample model`
Official sample page: https://www.live2d.com/en/learn/sample/mark/
"""
    (OUT / "README_使用说明.md").write_text(notice, encoding="utf-8")

    vtube = {
        "Name": "阿叶睡不醒QAQ",
        "ModelID": "Aye",
        "ModelVersion": VERSION,
        "Notes": "Derivative runtime using Live2D official Mark-kun sample skeleton.",
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
        "verification": "passed",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
