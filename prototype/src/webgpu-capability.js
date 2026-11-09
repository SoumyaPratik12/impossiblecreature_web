(() => {
  "use strict";

  const status = document.getElementById("runtime-status");
  if (!status) return;

  if (!("gpu" in navigator)) {
    status.textContent = "Canvas 2D · WebGPU unavailable";
    status.title = "The prototype continues to use Canvas 2D.";
    return;
  }

  navigator.gpu.requestAdapter()
    .then((adapter) => {
      if (!adapter) {
        status.textContent = "Canvas 2D · No WebGPU adapter";
        return;
      }
      status.textContent = "Canvas 2D · WebGPU adapter detected";
      status.title = "WebGPU is available for a future renderer experiment; rendering remains Canvas 2D.";
    })
    .catch(() => {
      status.textContent = "Canvas 2D · WebGPU check failed";
    });
})();
