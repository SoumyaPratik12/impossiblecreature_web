# WebGPU Renderer Spike

## Objective

Validate the WebGPU rendering lifecycle and progressively move the browser RTS prototype's terrain rendering to the GPU while retaining a Canvas 2D fallback for units and unsupported browsers.

## Integrated terrain renderer

The main prototype now attempts to initialize prototype/src/webgpu-renderer.js:

1. Requests a WebGPU adapter and device.
2. Configures a dedicated GPU canvas layered beneath the transparent Canvas 2D unit canvas.
3. Compiles a WGSL full-screen terrain shader.
4. Sends camera position, zoom, viewport size, and world dimensions through a uniform buffer.
5. Generates procedural ground variation, a winding path, grid lines, and world boundaries in the fragment shader.
6. Submits the terrain draw each frame using the current camera state.

The Canvas 2D layer continues to render units, health bars, selection markers, and UI overlays. If WebGPU initialization fails or the device is lost, the prototype switches back to its Canvas 2D terrain renderer.

## Isolated test page

Open prototype/webgpu-test.html from the deployed GitHub Pages site. The page independently checks navigator.gpu, requests an adapter and device, configures a WebGPU canvas, compiles a WGSL shader, creates a render pipeline, submits a triangle draw call, and reports errors or device loss.

## Acceptance criteria

- On a WebGPU-capable browser/device, the main prototype displays procedural terrain through WebGPU and keeps units interactive on the Canvas 2D overlay.
- On unsupported browsers or unavailable adapters, the main prototype remains playable using Canvas 2D.
- The isolated WebGPU page reports a successful triangle render where supported.
- CI checks JavaScript syntax and repository wiring; it does not replace real browser/GPU testing.

## Current limitations

The integrated renderer is an early procedural terrain pass, not a production renderer. It does not yet use terrain textures, sprite atlases, shadows, lighting, post-processing, GPU-side unit simulation, or instanced creature meshes. Its terrain path is a shader approximation. It does not establish compatibility with the original game's Direct3D renderer.

## Next renderer milestones

1. Add device-pixel-ratio-aware canvas resizing and surface reconfiguration.
2. Add a proper orthographic camera uniform and culling.
3. Introduce texture-backed terrain materials and terrain layers.
4. Add instanced unit/creature geometry with per-instance transforms and team colors.
5. Profile GPU and Canvas 2D paths on defined desktop and mobile devices.
