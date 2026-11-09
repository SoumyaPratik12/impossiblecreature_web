# WebGPU Renderer Spike

## Objective

Validate the browser WebGPU rendering lifecycle in isolation before replacing any part of the RTS Canvas 2D renderer.

## Test page

Open `prototype/webgpu-test.html` from a local static server or the deployed GitHub Pages site. The page:

1. Checks whether `navigator.gpu` exists.
2. Requests a GPU adapter and device.
3. Configures a WebGPU canvas context using the preferred canvas format.
4. Compiles a small WGSL vertex/fragment shader.
5. Creates a render pipeline and submits one triangle draw call.
6. Reports initialization errors or device loss in the page.

## Acceptance criteria

- On a WebGPU-capable browser/device, the page reports a successful triangle render.
- On unsupported browsers or unavailable adapters, it displays a readable status rather than breaking the main prototype.
- The main RTS prototype continues to use Canvas 2D until the renderer is proven and a migration plan is reviewed.

## Limitations

This spike does not yet implement sprites, textures, camera transforms, batching, terrain, lighting, animation, or GPU-side simulation. It does not establish compatibility with the original game's Direct3D renderer.

## Next renderer milestones

1. Add a resize-aware surface configuration.
2. Introduce a camera uniform and orthographic world coordinates.
3. Upload one generated placeholder texture and render a textured quad.
4. Add instanced unit sprites and measure draw-call behavior.
5. Compare results against Canvas 2D on defined desktop and mobile devices.
