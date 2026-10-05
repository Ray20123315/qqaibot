from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "official_source_discovery"
PAGE_URL = "https://www.live2d.com/en/learn/sample/niziiro-mao/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"


def fetch(url: str, timeout: int = 120) -> tuple[bytes, dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/javascript,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read(), dict(response.headers.items())


def urls_from_text(text: str, base: str) -> set[str]:
    candidates: set[str] = set()
    patterns = [
        r"https?://[^\s\"'<>\\]+",
        r"(?:src|href|action|data-url|data-download|download-url)\s*=\s*[\"']([^\"']+)[\"']",
        r"[\"']([^\"']+\.(?:zip|cmo3|moc3)(?:\?[^\"']*)?)[\"']",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = match.group(1) if match.lastindex else match.group(0)
            value = html.unescape(value).strip().rstrip(",);]")
            if value.startswith(("javascript:", "mailto:", "#", "data:")):
                continue
            candidates.add(urllib.parse.urljoin(base, value))
    return candidates


def score_url(url: str) -> int:
    lower = url.lower()
    score = 0
    for token, points in [
        ("niziiro", 15),
        ("mao", 12),
        ("sample", 5),
        ("download", 8),
        ("zip", 25),
        ("cmo3", 30),
        ("api", 4),
        ("wp-json", 8),
        ("ajax", 8),
    ]:
        if token in lower:
            score += points
    return score


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    page_bytes, page_headers = fetch(PAGE_URL)
    page_text = page_bytes.decode("utf-8", errors="replace")
    (OUT / "page.html").write_bytes(page_bytes)

    all_urls = urls_from_text(page_text, PAGE_URL)
    script_urls = sorted(
        url for url in all_urls
        if urllib.parse.urlparse(url).path.lower().endswith((".js", ".mjs"))
    )

    fetched_scripts = []
    script_errors = []
    for index, url in enumerate(script_urls[:80]):
        try:
            payload, headers = fetch(url, timeout=60)
            content_type = headers.get("Content-Type", "")
            text = payload.decode("utf-8", errors="replace")
            target = OUT / "scripts" / f"{index:03d}.js"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            discovered = urls_from_text(text, url)
            all_urls.update(discovered)
            fetched_scripts.append({
                "url": url,
                "bytes": len(payload),
                "content_type": content_type,
                "saved_as": target.relative_to(OUT).as_posix(),
                "interesting_lines": [
                    line.strip()[:1000]
                    for line in text.splitlines()
                    if any(term in line.lower() for term in (
                        "niziiro", "mao", ".zip", "download", "cmo3", "wp-json", "admin-ajax"
                    ))
                ][:200],
            })
        except Exception as exc:
            script_errors.append({"url": url, "error": repr(exc)})

    ranked = sorted(all_urls, key=lambda value: (-score_url(value), value))
    likely = [url for url in ranked if score_url(url) > 0]

    report = {
        "page_url": PAGE_URL,
        "page_bytes": len(page_bytes),
        "page_headers": page_headers,
        "script_count": len(script_urls),
        "scripts_fetched": fetched_scripts,
        "script_errors": script_errors,
        "likely_urls": likely[:500],
        "all_urls": ranked[:2000],
    }
    (OUT / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUT / "likely_urls.txt").write_text("\n".join(likely) + "\n", encoding="utf-8")

    print(json.dumps({
        "page_bytes": len(page_bytes),
        "scripts_found": len(script_urls),
        "scripts_fetched": len(fetched_scripts),
        "likely_url_count": len(likely),
        "top_likely_urls": likely[:30],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
