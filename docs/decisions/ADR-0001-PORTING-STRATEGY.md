# ADR-0001: Initial Porting Strategy

- **Status:** Accepted for initial milestone
- **Date:** 2026-11-09

## Context

The goal is to investigate a browser-playable version of *Impossible Creatures*. No installed game copy, original game files, or authorized source code are currently available. A Windows executable cannot be made browser-compatible merely by renaming or wrapping it as WebAssembly.

## Decision

Begin with an independently authored browser RTS sandbox using HTML, CSS, and JavaScript. In parallel, document the feasibility of three routes: source-level port, compatibility environment, and independent reimplementation.

Keep the initial prototype free of original game assets, executable files, proprietary source, and extracted content. Keep all project work and CI in this GitHub repository.

## Consequences

### Positive

- Provides a working browser development target without requiring proprietary files.
- Lets the project validate input, simulation, rendering, and save/load boundaries.
- Keeps technical assumptions visible and testable.
- Avoids accidentally publishing copyrighted game content.

### Negative

- The prototype is not the original game and does not establish gameplay fidelity.
- Some architecture may change after technical evidence becomes available.
- Full compatibility may prove infeasible or require permissions/materials that are unavailable.

## Revisit when

Reassess this decision when authorized source code or game materials are available, or when the WebAssembly/WebGPU spikes provide evidence that changes the engineering trade-offs.
