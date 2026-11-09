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

  const unitShaderCode = `
    struct View { camera: vec2f, zoom: f32, padding: f32, viewport: vec2f, world: vec2f, };
    @group(0) @binding(0) var<uniform> view: View;
    struct UnitInput { @location(0) center: vec2f, @location(1) radius: f32, @location(2) color: vec4f, @location(3) health: f32, };
    struct UnitOutput { @builtin(position) position: vec4f, @location(0) color: vec4f, @location(1) local: vec2f, @location(2) health: f32, };
    @vertex fn unit_vertex(input: UnitInput, @builtin(vertex_index) vertex: u32) -> UnitOutput {
      var corners = array<vec2f, 6>(vec2f(-1.0,-1.0),vec2f(1.0,-1.0),vec2f(-1.0,1.0),vec2f(-1.0,1.0),vec2f(1.0,-1.0),vec2f(1.0,1.0));
      let local = corners[vertex]; let worldPos = input.center + local * input.radius;
      let pixel = (worldPos - view.camera) * view.zoom + view.viewport * 0.5;
      let clip = vec2f(pixel.x / view.viewport.x * 2.0 - 1.0, 1.0 - pixel.y / view.viewport.y * 2.0);
      var output: UnitOutput; output.position = vec4f(clip,0.0,1.0); output.color = input.color; output.local = local; output.health = input.health; return output;
    }
    @fragment fn unit_fragment(input: UnitOutput) -> @location(0) vec4f {
      if (dot(input.local,input.local) > 1.0) { discard; }
      let edge = smoothstep(0.82,1.0,dot(input.local,input.local));
      return vec4f(mix(input.color.rgb,vec3f(0.92,0.96,0.88),edge*0.65),1.0);
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
    const unitShader = device.createShaderModule({ label: "instanced creature shader", code: unitShaderCode });
    const unitPipeline = device.createRenderPipeline({
      label: "instanced creature pipeline", layout: "auto",
      vertex: { module: unitShader, entryPoint: "unit_vertex", buffers: [{ arrayStride: 32, stepMode: "instance", attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" }, { shaderLocation: 1, offset: 8, format: "float32" },
        { shaderLocation: 2, offset: 12, format: "float32x4" }, { shaderLocation: 3, offset: 28, format: "float32" }
      ]}] },
      fragment: { module: unitShader, entryPoint: "unit_fragment", targets: [{ format }] },
      primitive: { topology: "triangle-list" }
    });
    const unitBuffer = device.createBuffer({ label: "creature instance data", size: 32 * 512, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
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
      render(camera, width, height, world, units) {
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
        const living = (units || []).filter((unit) => unit.hp > 0).slice(0, 512);
        if (living.length) {
          const data = new Float32Array(living.length * 8);
          living.forEach((unit, i) => data.set([unit.x, unit.y, unit.radius, ...(unit.team === "player" ? [0.28,0.72,0.91,1] : [0.91,0.40,0.35,1]), unit.hp / unit.maxHp], i * 8));
          device.queue.writeBuffer(unitBuffer, 0, data);
          const unitPass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "load", storeOp: "store" }] });
          unitPass.setPipeline(unitPipeline); unitPass.setBindGroup(0, bindGroup); unitPass.setVertexBuffer(0, unitBuffer); unitPass.draw(6, living.length); unitPass.end();
        }
        device.queue.submit([encoder.finish()]);
      }
    };
  }

  window.CreatureWebGpu = { create };
})();
