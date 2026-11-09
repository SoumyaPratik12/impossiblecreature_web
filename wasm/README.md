# WebAssembly toolchain spike

This directory contains a minimal, original C module to validate a future C/C++ to WebAssembly build path.

It does not contain or reproduce code from *Impossible Creatures*.

## Planned build

With Emscripten installed in a suitable environment:

```sh
emcc hello.c -O2 -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME=createRuntimeModule -s EXPORTED_FUNCTIONS='["_runtime_add","_runtime_version"]' -o runtime.js
```

The generated `runtime.js` and `runtime.wasm` are build outputs and should not be committed unless there is a specific reason to version generated artifacts.

## Validation target

The first test is to load the module in a browser and verify that `runtime_add(19, 23)` returns `42`. This only validates the compiler/runtime bridge; it says nothing about original-game compatibility or performance.

## Next step

Add an Emscripten build job to CI, then add a browser smoke test that instantiates the generated module. Keep the JavaScript simulation as the reference implementation until profiling justifies moving code to WASM.
