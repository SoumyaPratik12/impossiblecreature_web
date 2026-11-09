# Porting Feasibility Research

## Current evidence

At project start, the repository owner has no installed copy or game files available for inspection. Therefore, no binary, asset, executable, or runtime compatibility assessment has been performed.

The initial deliverable is an original browser RTS sandbox. It is a way to validate interaction and application structure, not evidence of compatibility with *Impossible Creatures*.

## Possible technical routes

### Route A — Original source code and build environment

If legally authorized source code and dependencies become available, inventory the compiler/toolchain, platform APIs, graphics backend, audio stack, threading model, file I/O, and third-party libraries. Port portable modules first, then replace platform-specific services. Emscripten can compile supported C/C++ code to WebAssembly, but it does not automatically translate Windows APIs or Direct3D calls.

**Assessment:** potentially the cleanest route, but source availability and licensing are unknown.

### Route B — Compatibility environment

A compatibility layer would need to address the original CPU architecture/instruction set, Windows API behavior, filesystem semantics, input, audio, timing, and graphics API translation. Browser sandbox constraints and performance add substantial complexity.

**Assessment:** high uncertainty and likely a large engineering effort. A proof of concept must validate one narrow subsystem before this route is selected.

### Route C — Independent reimplementation

Reimplement game systems in a new browser-native engine while using only original code and assets created by this project, or content whose use is explicitly authorized. This is not a port of the original executable and must not imply compatibility or official affiliation.

**Assessment:** controllable technically, but gameplay fidelity requires substantial research and development. Intellectual-property review remains necessary.

## Critical unknowns

| Area | Questions to answer | Evidence required |
|---|---|---|
| CPU/runtime | Target architecture, compiler, assembly, threading? | Authorized binary/source analysis |
| Operating system | Which Win32 APIs and services are used? | Dependency inventory |
| Graphics | Direct3D version, fixed-function usage, shaders? | Render path documentation or controlled test |
| Audio | Codec, middleware, streaming, spatial audio? | Dependency inventory |
| Storage | Asset archives, compression, save formats? | Format documentation and authorized samples |
| Networking | Local-only, LAN, matchmaking, protocols? | Product documentation / controlled tests |
| Content | Which assets may be used and redistributed? | License and rights review |

## Staged experiments

1. **Repository prototype:** prove basic RTS selection, movement, combat, and save/load in a browser.
2. **WebAssembly toolchain spike:** compile a tiny original C module with Emscripten in CI; verify module loading and a function call from JavaScript.
3. **WebGPU spike:** detect support and render a simple triangle; retain a fallback path.
4. **Asset pipeline spike:** use generated placeholder textures and measure loading/memory behavior.
5. **Compatibility feasibility gate:** only proceed with authorized game materials and a documented API/dependency inventory.

## Go/no-go criteria

Do not select a full porting route until there is evidence for:
- lawful access to the materials needed for development and testing;
- a technically viable graphics and OS compatibility plan;
- acceptable browser performance on a defined target device;
- an asset distribution model that does not infringe third-party rights.

## Conclusion

The immediate, defensible path is to develop an original browser prototype and validate the browser technology stack. A true port remains an open research question until authorized game materials and technical evidence are available.
