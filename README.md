# Impossible Creatures — Browser Porting Research & Prototype

This repository tracks a staged effort to investigate and build a browser-playable experience inspired by the 2003 real-time strategy game *Impossible Creatures*.

> **Current status:** research and original prototype scaffolding. This is not yet a port of the original game.

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
- `prototype/` — original browser RTS sandbox.
- `tests/` — repository and prototype checks.
- `.github/workflows/` — automated validation.

## Run the prototype

The prototype is static HTML, CSS, and JavaScript. Open `prototype/index.html` in a modern browser, or serve the repository root with any static HTTP server and visit `/prototype/`.

No local build step is required for the current prototype.

## Development phases

1. **Foundation:** repository structure, browser prototype, and automated checks.
2. **Runtime spike:** compile a small original C/C++ module to WebAssembly with Emscripten and define the JavaScript/WASM boundary.
3. **Rendering spike:** evaluate WebGPU capability and implement a minimal renderer with a fallback strategy.
4. **Systems research:** document original-game platform dependencies and assess compatibility/reimplementation options using legitimately obtained materials.
5. **Vertical slice:** only after feasibility and rights are established, implement a small end-to-end gameplay slice.

## Non-goals for the initial milestone

- Claiming compatibility with the original game.
- Shipping original game content or assets.
- Promising multiplayer, campaign support, or full feature parity before technical validation.

## License

Project-authored code and documentation will receive an explicit license once the ownership and distribution scope are decided. No license in this repository grants rights to the original *Impossible Creatures* game or its content.
