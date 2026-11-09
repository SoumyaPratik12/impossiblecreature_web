(() => {
  "use strict";

  const shaderCode = `
    struct View {
      camera: vec2f,
      zoom: f32,
      padding: f32,
      viewport: vec2f,
      world: vec2f,
    };
    @group(0) @binding(0) var<uniform> view: View;

    struct VertexOutput {
      @builtin(position) position: vec4f,
    };

    @vertex
    fn vertex_main(@builtin(vertex_index) index: u32) -> VertexOutput {
      var positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
      );
      var output: VertexOutput;
      output.position = vec4f(positions[index], 0.0, 1.0);
      return output;
    }

    fn hash2(p: vec2f) -> f32 {
      return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
    }

    @fragment
    fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
      let pixel = input.position.xy;
      let worldPos = view.camera + (pixel - view.viewport * 0.5) / view.zoom;
      let tile = floor(worldPos / 80.0);
      let noise = hash2(tile);
      let variation = (noise - 0.5) * 0.075;
      var terrain = vec3f(0.14, 0.23, 0.16) + variation;

      let pathY = 800.0 - worldPos.x * 0.40 - sin(worldPos.x * 0.006) * 140.0;
      let pathDistance = abs(worldPos.y - pathY);
      let path = 1.0 - smoothstep(31.0, 43.0, pathDistance);
      terrain = mix(terrain, vec3f(0.39, 0.34, 0.23), path * 0.78);

      let local = fract(worldPos / 160.0);
      let gridLine = max(
        1.0 - smoothstep(0.0, 0.012, min(local.x, 1.0 - local.x)),
        1.0 - smoothstep(0.0, 0.012, min(local.y, 1.0 - local.y))
      );
      terrain = mix(terrain, vec3f(0.31, 0.39, 0.30), gridLine * 0.12);

      let edge = min(min(worldPos.x, view.world.x - worldPos.x),
                     min(worldPos.y, view.world.y - worldPos.y));
      let border = 1.0 - smoothstep(0.0, 5.0, edge);
      terrain = mix(terrain, vec3f(0.65, 0.72, 0.57), border * 0.8);

      if (worldPos.x < 0.0 || worldPos.y < 0.0 ||
          worldPos.x > view.world.x || worldPos.y > view.world.y) {
        terrain = vec3f(0.035, 0.055, 0.06);
      }
      return vec4f(terrain, 1.0);
    }
  `;

  async function create(canvas) {
    if (!navigator.gpu) throw new Error("WebGPU is unavailable in this browser");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No compatible GPU adapter found");
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) throw new Error("Could not create WebGPU canvas context");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });

    const shader = device.createShaderModule({ label: "procedural terrain shader", code: shaderCode });
    const pipeline = device.createRenderPipeline({
      label: "procedural terrain pipeline",
      layout: "auto",
      vertex: { module: shader, entryPoint: "vertex_main" },
      fragment: { module: shader, entryPoint: "fragment_main", targets: [{ format }] },
      primitive: { topology: "triangle-list" }
    });
    const uniformBuffer = device.createBuffer({
      label: "camera and world uniforms",
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });
    let lost = false;
    device.lost.then(() => { lost = true; });
    return {
      render(camera, width, height, world) {
        if (lost) throw new Error("WebGPU device was lost");
        device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
          camera.x, camera.y, camera.zoom, 0,
          width, height, world.width, world.height
        ]));
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.055, b: 0.06, a: 1 },
            loadOp: "clear",
            storeOp: "store"
          }]
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);
      }
    };
  }

  window.CreatureWebGpu = { create };
})();
