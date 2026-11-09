# WebAssembly Validation Spike

## Objective

Prove that an independently authored C function can be compiled to WebAssembly and called from browser JavaScript. This is a toolchain experiment only; it does not load or convert the original Windows executable.

## Minimal acceptance test

1. Compile `wasm/hello.c` with Emscripten.
2. Load the generated JavaScript module in a browser.
3. Call `runtime_add(19, 23)` and assert that the result is `42`.
4. Confirm that a normal browser refresh and a failed WASM load leave the Canvas 2D prototype usable.

## What this does not prove

- Windows API compatibility.
- Direct3D compatibility or graphics translation.
- Audio middleware compatibility.
- Original game asset or archive parsing.
- Original game logic or performance.

## Toolchain policy

Pin the Emscripten SDK version in CI once the first build is added. Do not commit generated WASM output by default; publish it as a CI artifact for reproducible testing.
