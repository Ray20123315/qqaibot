from __future__ import annotations

import hashlib
import json
import shutil
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
RUNTIME = DIST / "Aye_Live2D_runtime_v0.0.2"
PROJECT = DIST / "Aye_Live2D_project_v0.0.3"
SOURCE_ZIP = ROOT / "mao_en_official.zip"
SOURCE_URLS = [
    "https://cubism.live2d.com/sample-data/bin/mao/mao_en.zip?event=sampledata_download&data_name=mao&lang=en",
    "https://cubism.live2d.com/sample-data/bin/mao/mao_en.zip",
    "https://s3.ap-northeast-1.amazonaws.com/cubism-dev.live2d.com/sample-data/bin/mao/mao_en.zip",
    "https://s3.ap-northeast-1.amazonaws.com/cubism-dev.live2d.com/sample-data/js/mao/mao_en.zip",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download() -> tuple[str, list[dict[str, object]]]:
    attempts: list[dict[str, object]] = []
    for url in SOURCE_URLS:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 Aye-Live2D-project-builder/0.0.3",
                "Accept": "application/zip,application/octet-stream,*/*;q=0.8",
                "Referer": "https://www.live2d.com/en/learn/sample/niziiro-mao/",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                first = response.read(4)
                if first != b"PK\x03\x04":
                    attempts.append({"url": url, "status": response.status, "error": "not_zip"})
                    continue
                with SOURCE_ZIP.open("wb") as fp:
                    fp.write(first)
                    shutil.copyfileobj(response, fp)
                attempts.append({"url": url, "status": response.status, "bytes": SOURCE_ZIP.stat().st_size})
                return url, attempts
        except urllib.error.HTTPError as exc:
            attempts.append({"url": url, "status": exc.code, "error": str(exc)})
        except Exception as exc:
            attempts.append({"url": url, "error": repr(exc)})
    raise RuntimeError(f"All official download candidates failed: {attempts}")


def main() -> None:
    if not RUNTIME.is_dir():
        raise RuntimeError(f"Verified runtime missing: {RUNTIME}")

    shutil.rmtree(PROJECT, ignore_errors=True)
    PROJECT.mkdir(parents=True)

    source_url, download_attempts = download()

    extract_root = ROOT / "official_mao_source_extracted"
    shutil.rmtree(extract_root, ignore_errors=True)
    extract_root.mkdir(parents=True)
    with zipfile.ZipFile(SOURCE_ZIP) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"Corrupt member in official archive: {bad}")
        archive.extractall(extract_root)

    cmo3_files = sorted(extract_root.rglob("*.cmo3"))
    can3_files = sorted(extract_root.rglob("*.can3"))
    psd_files = sorted(extract_root.rglob("*.psd"))
    moc3_files = sorted(extract_root.rglob("*.moc3"))
    model3_files = sorted(extract_root.rglob("*.model3.json"))

    if not cmo3_files:
        raise RuntimeError("No editable .cmo3 project found")
    if not moc3_files or not model3_files:
        raise RuntimeError("Official archive is missing its runtime model")

    source_out = PROJECT / "01_Official_Mao_Editable_Source"
    shutil.copytree(extract_root, source_out)
    shutil.copytree(RUNTIME / "Aye", PROJECT / "02_Aye_Runtime_for_VTube_Studio")
    shutil.copy2(RUNTIME / "RENDER_PREVIEW.png", PROJECT / "Aye_Runtime_Render_Preview.png")
    shutil.copy2(RUNTIME / "VERIFY.json", PROJECT / "Aye_Runtime_VERIFY.json")

    readme = """# 阿叶睡不醒QAQ Live2D 项目包 v0.0.3

本包分为两个部分：

1. `01_Official_Mao_Editable_Source`
   - Live2D 官方 Niziiro Mao 完整示例源项目。
   - 内含真正可由 Cubism Editor 打开的 `.cmo3`，以及 `.can3`、Runtime 等官方资料。
   - 保留官方目录与文件名，避免破坏内部引用。

2. `02_Aye_Runtime_for_VTube_Studio`
   - 已通过结构验证和无头 Chrome 实际渲染验证的 Aye Runtime。
   - 可复制到 VTube Studio 的 `Live2DModels` 目录进行载入。
   - 目前沿用 Mao 的网格、参数、物理、表情和动作，贴图为粉白黑主题改色版本。

## 重要限制

`.cmo3` 是官方 Mao 的可编辑骨架源项目，并不是已经在 Cubism Editor 内完成全部重新绘制和重新绑点的独占 Aye 原生工程。当前环境没有 Cubism Editor，因此无法把单层角色 PNG 自动变成新的 ArtMesh、Deformer 与参数绑点后再保存成全新 `.cmo3`。

要继续编辑：

1. 使用最新版 Live2D Cubism Editor 打开包内的 `.cmo3`。
2. 依照 `Aye_Runtime_Render_Preview.png` 和角色参考图重绘或替换素材。
3. 检查 Blend Shape、物理、表情及动作。
4. 从 Cubism Editor 重新输出 Runtime 后，再放入 VTube Studio。

## 授权

官方 Mao 源项目仍受 Live2D Free Material License Agreement 与 Live2D Cubism Sample Data Terms of Use 约束。发布或商用前必须自行阅读并同意官方条款，并保留适当的来源说明。
"""
    (PROJECT / "README_项目说明.md").write_text(readme, encoding="utf-8")

    files = []
    for path in sorted(PROJECT.rglob("*")):
        if path.is_file():
            files.append({
                "path": path.relative_to(PROJECT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })

    manifest = {
        "package": "Aye_Live2D_project_v0.0.3",
        "official_download": source_url,
        "download_attempts": download_attempts,
        "official_zip_bytes": SOURCE_ZIP.stat().st_size,
        "official_zip_sha256": sha256(SOURCE_ZIP),
        "editable_cmo3_count": len(cmo3_files),
        "animation_can3_count": len(can3_files),
        "psd_count": len(psd_files),
        "runtime_moc3_count": len(moc3_files),
        "model3_json_count": len(model3_files),
        "editable_projects": [str(p.relative_to(extract_root)) for p in cmo3_files],
        "files": files,
    }
    (PROJECT / "PROJECT_VERIFY.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    archive_path = DIST / "Aye_Live2D_project_v0.0.3.zip"
    archive_path.unlink(missing_ok=True)
    shutil.make_archive(str(archive_path.with_suffix("")), "zip", PROJECT.parent, PROJECT.name)

    with zipfile.ZipFile(archive_path) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"Final project archive is corrupt: {bad}")

    print(json.dumps({
        "source_url": source_url,
        "download_attempts": download_attempts,
        "project_archive": str(archive_path),
        "project_archive_bytes": archive_path.stat().st_size,
        "project_archive_sha256": sha256(archive_path),
        "cmo3_count": len(cmo3_files),
        "can3_count": len(can3_files),
        "psd_count": len(psd_files),
        "verification": "passed",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
