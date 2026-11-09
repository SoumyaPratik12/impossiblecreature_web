# Browser Runtime Architecture

## Status

Proposed architecture for research and prototype work. This document does not assert that the original game is currently runnable in a browser.

## Design principles

1. Keep the browser shell independent from the game simulation.
2. Treat WebAssembly as an optional compute/runtime component, not an executable converter.
3. Use browser-native APIs behind small interfaces so rendering and storage can evolve independently.
4. Keep original-game assets out of the repository unless redistribution rights are documented.
5. Make every technical assumption testable with a small spike before committing to a large implementation.

## Logical components

```text
Browser application
├── UI shell (HTML/CSS)
├── Input adapter
│   └── keyboard, pointer, touch
├── Game/session coordinator (JavaScript)
│   ├── simulation interface
│   │   ├── JS prototype implementation
│   │   └── future WebAssembly module
│   ├── renderer interface
│   │   ├── Canvas 2D prototype
│   │   └── future WebGPU renderer
│   └── persistence interface
│       └── IndexedDB / OPFS evaluation
└── diagnostics and capability checks
```

## Runtime responsibilities

### UI shell

Owns menus, status panels, accessibility labels, help text, and lifecycle events. It should not own simulation rules.

### Input adapter

Normalizes pointer, keyboard, and touch events into game commands. The prototype currently supports selecting units, issuing move orders, and toggling pause.

### Simulation

Owns entity state, movement, targeting, combat, and deterministic update order. The initial implementation is JavaScript for fast iteration. A future C/C++ core may be compiled with Emscripten only after profiling demonstrates a reason to move logic to WebAssembly.

### Renderer

The active prototype uses Canvas 2D for the visible terrain and unit scene. WebGPU terrain and instanced-unit code remain isolated experiments; they must pass real-browser shader, device-loss, rendering parity, and fallback tests before integration. WebGPU is not a direct replacement for legacy Direct3D APIs.

### Persistence

The active prototype uses versioned localStorage snapshots for small sessions. The game core validates the schema, unit IDs, teams, numeric ranges, world bounds, creature keys, and camera values before restoring. Larger sessions should move to IndexedDB or Origin Private File System after quota, lifecycle, and migration behavior are tested.

## Proposed interfaces

- `InputCommand`: select, move, attack, pause.
- `Simulation.update(deltaSeconds)`: advances simulation with a bounded time step.
- `Simulation.snapshot()`: returns serializable state for renderer/UI.
- `Renderer.render(snapshot)`: draws the current snapshot.
- `SaveStore.save(slot, state)` / `SaveStore.load(slot)`: persistence boundary.

## Performance strategy

- Use a fixed simulation step with an accumulator.
- Cap frame delta after tab suspension to avoid large catch-up updates.
- Keep rendering interpolated and independent of simulation frequency.
- Profile before moving code to WebAssembly.
- Avoid per-frame allocations in hot paths once entity counts increase.

## Security and distribution

Treat all imported assets and save files as untrusted input. Validate sizes and formats. Do not expose filesystem paths or credentials. Distribute only content the project is authorized to distribute.
