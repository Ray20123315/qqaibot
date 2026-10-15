#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="v0.0.2"
OUT="$ROOT/dist/Aye_Live2D_runtime_${VERSION}"
MODEL="$OUT/Aye"
WEB="$ROOT/preview_web"
PORT=8765

rm -rf "$WEB"
mkdir -p "$WEB/vendor"
cp -a "$MODEL" "$WEB/Aye"

curl --fail --location --retry 3 --silent --show-error \
  'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js' \
  -o "$WEB/vendor/live2dcubismcore.min.js"
curl --fail --location --retry 3 --silent --show-error \
  'https://cdn.jsdelivr.net/npm/pixi.js@6.5.2/dist/browser/pixi.min.js' \
  -o "$WEB/vendor/pixi.min.js"
curl --fail --location --retry 3 --silent --show-error \
  'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js' \
  -o "$WEB/vendor/cubism4.min.js"

cat > "$WEB/index.html" <<'HTML'
<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<title>LOADING</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:linear-gradient(#ffeaf4,#f5cde1)}
canvas{display:block;width:100%;height:100%}
#status{position:fixed;z-index:10;left:16px;top:16px;padding:8px 12px;border-radius:8px;background:#fff;color:#222;font:16px/1.4 sans-serif}
</style>
<script src="./vendor/live2dcubismcore.min.js"></script>
<script src="./vendor/pixi.min.js"></script>
<script src="./vendor/cubism4.min.js"></script>
</head>
<body>
<div id="status">LOADING</div>
<canvas id="canvas"></canvas>
<script>
(async()=>{
  const status=document.getElementById('status');
  try {
    const app=new PIXI.Application({view:document.getElementById('canvas'),width:1280,height:720,backgroundAlpha:0,antialias:true});
    const model=await PIXI.live2d.Live2DModel.from('./Aye/Aye.model3.json',{autoInteract:false});
    app.stage.addChild(model);
    model.anchor.set(0.5,0.5);
    const scale=Math.min(680/model.height,1180/model.width);
    model.scale.set(scale);
    model.x=640;
    model.y=365;
    if(model.internalModel.motionManager.expressionManager){model.expression('exp_01');}
    status.textContent='READY';
    status.dataset.ready='true';
    document.title='READY';
    window.__MODEL_READY__=true;
  } catch(error) {
    status.textContent='ERROR: '+String(error);
    document.title='ERROR';
    window.__MODEL_ERROR__=String(error);
    console.error(error);
  }
})();
</script>
</body>
</html>
HTML

python3 -m http.server "$PORT" --directory "$WEB" > "$ROOT/preview_server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
if [[ -z "$CHROME" ]]; then
  echo "No Chrome/Chromium executable found" >&2
  exit 1
fi

set +e
timeout 25s "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1280,720 --virtual-time-budget=12000 \
  --screenshot="$OUT/RENDER_PREVIEW.png" \
  "http://127.0.0.1:${PORT}/index.html" > "$ROOT/chrome_preview.log" 2>&1
CHROME_STATUS=$?
set -e

if [[ $CHROME_STATUS -ne 0 && $CHROME_STATUS -ne 124 ]]; then
  cat "$ROOT/chrome_preview.log" >&2
  exit "$CHROME_STATUS"
fi

if [[ ! -s "$OUT/RENDER_PREVIEW.png" ]]; then
  echo "Preview screenshot was not created" >&2
  cat "$ROOT/chrome_preview.log" >&2
  exit 1
fi

# A separate DOM dump verifies that the asynchronous model loader reached READY.
set +e
timeout 25s "$CHROME" --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=12000 --dump-dom \
  "http://127.0.0.1:${PORT}/index.html" > "$OUT/RENDER_DOM.html" 2>> "$ROOT/chrome_preview.log"
DOM_STATUS=$?
set -e

if [[ $DOM_STATUS -ne 0 && $DOM_STATUS -ne 124 ]]; then
  cat "$ROOT/chrome_preview.log" >&2
  exit "$DOM_STATUS"
fi

if ! grep -q 'data-ready="true"' "$OUT/RENDER_DOM.html"; then
  echo "Rendered DOM did not report READY" >&2
  tail -100 "$OUT/RENDER_DOM.html" >&2 || true
  tail -100 "$ROOT/chrome_preview.log" >&2 || true
  exit 1
fi

echo "Live2D browser render verification passed"
