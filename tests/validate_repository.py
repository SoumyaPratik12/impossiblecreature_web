#!/usr/bin/env python3
"""Lightweight checks for the browser prototype repository."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "README.md",
    "docs/architecture/OVERVIEW.md",
    "docs/research/PORTING_FEASIBILITY.md",
    "docs/research/WEBGPU_SPIKE.md",
    "docs/decisions/ADR-0001-PORTING-STRATEGY.md",
    "prototype/index.html",
    "prototype/webgpu-test.html",
    "prototype/style.css",
    "prototype/src/main.js",
    "prototype/src/world-view.js",
    "prototype/src/webgpu-renderer.js",
    "prototype/src/webgpu-capability.js",
    "prototype/src/webgpu-test.js",
    "wasm/hello.c",
]

def main() -> int:
    missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
    if missing:
        print("Missing required files:")
        for path in missing:
            print(f" - {path}")
        return 1

    html = (ROOT / "prototype/index.html").read_text(encoding="utf-8")
    js = (ROOT / "prototype/src/main.js").read_text(encoding="utf-8")
    webgpu_html = (ROOT / "prototype/webgpu-test.html").read_text(encoding="utf-8")
    webgpu_js = (ROOT / "prototype/src/webgpu-test.js").read_text(encoding="utf-8")
    world_js = (ROOT / "prototype/src/world-view.js").read_text(encoding="utf-8")
    gpu_js = (ROOT / "prototype/src/webgpu-renderer.js").read_text(encoding="utf-8")
    css = (ROOT / "prototype/style.css").read_text(encoding="utf-8")

    if 'id="battlefield"' not in html:
        print("Prototype canvas element not found")
        return 1
    if not re.search(r'getElementById\(["\']battlefield["\']\)', js):
        print("JavaScript does not initialize the battlefield canvas")
        return 1
    if "CreatureWorldView" not in js or "worldView.zoomAt" not in js or "worldView.panBy" not in js:
        print("Camera controls are not integrated into the prototype")
        return 1
    if "drawTerrain" not in world_js or "screenToWorld" not in world_js:
        print("World terrain or coordinate conversion implementation missing")
        return 1
    if "\\ncanvas" in css or "#terrain-gpu" not in css or "#battlefield" not in css:
        print("Layered terrain canvas styles are invalid or incomplete")
        return 1
    if "createRenderPipeline" not in gpu_js or "writeBuffer" not in gpu_js or "gpuRenderer.render" not in js:
        print("Integrated WebGPU terrain renderer is incomplete")
        return 1
    if "localStorage" not in js:
        print("Expected prototype save/load implementation not found")
        return 1
    if 'id="webgpu-canvas"' not in webgpu_html or "webgpu-test.js" not in webgpu_html:
        print("Standalone WebGPU test page is not wired to its script")
        return 1
    if "createRenderPipeline" not in webgpu_js or "requestAdapter" not in webgpu_js:
        print("WebGPU test does not create an adapter and render pipeline")
        return 1

    print(f"Repository validation passed ({len(REQUIRED)} required files).")
    return 0

if __name__ == "__main__":
    sys.exit(main())
