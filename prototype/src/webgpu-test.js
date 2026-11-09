(() => {
  "use strict";

  const canvas = document.getElementById("webgpu-canvas");
  const status = document.getElementById("webgpu-status");
  if (!canvas || !status) return;

  async function start() {
    if (!navigator.gpu) {
      status.textContent = "WebGPU is not available in this browser. Use the Canvas 2D prototype.";
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("No compatible GPU adapter was found.");

      const device = await adapter.requestDevice();
      const context = canvas.getContext("webgpu");
      if (!context) throw new Error("Could not create a WebGPU canvas context.");

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: "opaque"
      });

      const shader = device.createShaderModule({
        label: "triangle shader",
        code: `
          @vertex
          fn vertex_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
            var positions = array<vec2f, 3>(
              vec2f(0.0, 0.68),
              vec2f(-0.68, -0.58),
              vec2f(0.68, -0.58)
            );
            return vec4f(positions[index], 0.0, 1.0);
          }

          @fragment
          fn fragment_main() -> @location(0) vec4f {
            return vec4f(0.22, 0.72, 0.88, 1.0);
          }
        `
      });

      const pipeline = device.createRenderPipeline({
        label: "triangle pipeline",
        layout: "auto",
        vertex: { module: shader, entryPoint: "vertex_main" },
        fragment: {
          module: shader,
          entryPoint: "fragment_main",
          targets: [{ format }]
        },
        primitive: { topology: "triangle-list" }
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.055, g: 0.09, b: 0.12, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }]
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);

      status.textContent = `WebGPU triangle rendered successfully · ${format}`;
      device.lost.then((info) => {
        status.textContent = `WebGPU device lost: ${info.message || info.reason}`;
      });
    } catch (error) {
      status.textContent = `WebGPU initialization failed: ${error.message}`;
    }
  }

  start();
})();
