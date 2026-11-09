# Impossible Creatures — Browser Porting Research & Prototype

This repository tracks a staged effort to investigate and build a browser-playable experience inspired by the 2003 real-time strategy game *Impossible Creatures*.

> **Current status:** a deployed original RTS sandbox using Canvas 2D for the active terrain and unit scene, with camera controls, basic movement/combat simulation, and a configurable creature stat-composition prototype. WebGPU remains an isolated experiment pending browser validation. This is not yet a port of the original game.

## Project goals

- Establish a browser runtime and rendering foundation.
- Evaluate feasible routes for running or reimplementing the original game's systems.
- Prototype RTS interaction loops independently of proprietary game code and assets.
- Keep source, documentation, tests, and CI in this GitHub repository.

## Important legal and technical boundaries

The repository must not contain the original game's executable, copyrighted assets, extracted audio, or proprietary source code unless there is clear authorization to redistribute them. Owning a copy of a game does not automatically grant redistribution rights.

A Windows executable cannot simply be converted into WebAssembly. A genuine port may require source-code access and recompilation, or a compatibility layer that addresses CPU instructions, Windows APIs, graphics, audio, input, storage, and timing. Direct3D-era rendering also needs a browser-compatible translation or replacement.

Until authorized game files and reliable technical documentation are available, development will use original placeholder assets and independently written code.

## Repository layout

- `docs/architecture/` — proposed runtime architecture.
- `docs/research/` — feasibility research and unknowns.
- `docs/decisions/` — architecture decision records.
- `prototype/` — original browser RTS sandbox using Canvas 2D for the active scene, a separate WebGPU experiment, and a body/head creature stat composer.
- `tests/` — repository and prototype checks.
- `.github/workflows/` — automated validation.

## Run the prototype

The prototype is static HTML, CSS, and JavaScript. Open `prototype/index.html` in a modern browser, or serve the repository root with any static HTTP server and visit `/prototype/`.

No local build step is required for the current prototype.

## Development phases

1. **Foundation:** repository structure, browser prototype, and automated checks.
2. **Runtime spike:** compile a small original C/C++ module to WebAssembly with Emscripten and define the JavaScript/WASM boundary.
3. **Rendering spike:** Canvas 2D is the active, validated rendering path. WebGPU terrain and instanced-unit rendering remain isolated experiments until tested across real browsers and devices.
4. **Systems research:** document original-game platform dependencies and assess compatibility/reimplementation options using legitimately obtained materials.
5. **Vertical slice:** only after feasibility and rights are established, implement a small end-to-end gameplay slice.

## Non-goals for the initial milestone

- Claiming compatibility with the original game.
- Shipping original game content or assets.
- Promising multiplayer, campaign support, or full feature parity before technical validation.

## License

Project-authored code and documentation will receive an explicit license once the ownership and distribution scope are decided. No license in this repository grants rights to the original *Impossible Creatures* game or its content.


## RTS prototype controls and movement

- Left-click selects a friendly creature; Shift-click adds or removes it; Ctrl+A selects all living friendly creatures.
- Left-drag empty ground to box-select. Space-drag or middle-mouse drag pans the camera.
- Choose **Compact**, **Line**, or **Column** in the battlefield toolbar, then right-click to issue a group movement order.
- Units use deterministic grid-based A* routing around marked rock obstacles. Blocked destinations are relocated to nearby walkable points; routes are recalculated when the obstacle map changes; and collision resolution checks both unit spacing and terrain before applying separation. Formation offsets rotate with the direction of travel.
- A destination marker is shown for each unit with an active movement order. Moving units automatically engage nearby enemies while retaining their movement destination.

The pathfinder supports changing circular obstacle maps and local collision-safe separation, and has automated 10-, 20-, and 50-unit stress coverage. It remains a grid-based prototype: terrain-weighted costs, navmesh routing, advanced velocity-obstacle steering, and formal deadlock-free guarantees in narrow passages are not implemented.


### Movement stress coverage

Automated simulation tests cover 10-, 20-, and 50-unit formation orders, obstacle-safe movement, dynamic obstacle insertion and route replanning, and crowded-unit separation. Browser interaction tests verify the formation selector and right-click group-order flow. These tests establish regression coverage for the current prototype; they are not a substitute for profiling on target hardware or a full RTS navigation benchmark.
