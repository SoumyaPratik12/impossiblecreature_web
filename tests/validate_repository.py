#!/usr/bin/env python3
"""Repository structure and active runtime contract checks."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
REQUIRED=[
 "README.md","docs/architecture/OVERVIEW.md","docs/research/PORTING_FEASIBILITY.md",
 "docs/research/WEBGPU_SPIKE.md","docs/decisions/ADR-0001-PORTING-STRATEGY.md",
 "prototype/index.html","prototype/webgpu-test.html","prototype/style.css",
 "prototype/src/main.js","prototype/src/game-core.js","prototype/src/creature-catalog.js",
 "prototype/src/world-view.js","prototype/src/webgpu-renderer.js",
 "prototype/src/webgpu-capability.js","prototype/src/webgpu-test.js",
 "tests/game-core.test.js","wasm/hello.c"]
def main():
 missing=[p for p in REQUIRED if not (ROOT/p).is_file()]
 if missing:
  print("Missing required files:",*missing,sep="\n - ");return 1
 html=(ROOT/"prototype/index.html").read_text()
 main_js=(ROOT/"prototype/src/main.js").read_text()
 core=(ROOT/"prototype/src/game-core.js").read_text()
 world=(ROOT/"prototype/src/world-view.js").read_text()
 if 'id="battlefield"' not in html or 'src="./src/game-core.js' not in html:
  print("Battlefield or simulation core is not loaded");return 1
 if "core.update" not in main_js or "core.validateSave" not in main_js:
  print("Simulation or validated persistence is not integrated");return 1
 if "gpuRenderer.render" in main_js:
  print("Experimental WebGPU renderer must remain isolated until browser validation");return 1
 if "drawTerrain" not in world or "screenToWorld" not in world or "drawOverlay" not in world:
  print("World renderer/camera API is incomplete");return 1
 if "SAVE_VERSION" not in core or "findSpawn" not in core or "issueMove" not in core:
  print("Simulation core contracts are incomplete");return 1
 if "\\ncanvas" in (ROOT/"prototype/style.css").read_text():
  print("Invalid escaped newline in CSS");return 1
 print(f"Repository validation passed ({len(REQUIRED)} required files).")
 return 0
if __name__=="__main__":sys.exit(main())
