(() => {
  "use strict";

  const world = Object.freeze({ width: 1600, height: 900, tileSize: 80 });
  const camera = { x: world.width / 2, y: world.height / 2, zoom: 1 };
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 2.2;

  function clampCamera(viewWidth, viewHeight) {
    const halfW = viewWidth / (2 * camera.zoom);
    const halfH = viewHeight / (2 * camera.zoom);
    camera.x = halfW * 2 >= world.width ? world.width / 2 :
      Math.max(halfW, Math.min(world.width - halfW, camera.x));
    camera.y = halfH * 2 >= world.height ? world.height / 2 :
      Math.max(halfH, Math.min(world.height - halfH, camera.y));
  }

  function begin(ctx, width, height) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
  }

  function end(ctx) { ctx.restore(); }

  function hash(x, y) {
    let n = Math.imul(x + 374761393, 668265263) + Math.imul(y + 1274126177, 2246822519);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function drawTerrain(ctx) {
    ctx.fillStyle = "#263d2d";
    ctx.fillRect(0, 0, world.width, world.height);

    const size = world.tileSize;
    for (let y = 0; y < world.height / size; y++) {
      for (let x = 0; x < world.width / size; x++) {
        const value = hash(x, y);
        const shade = Math.floor(35 + value * 18);
        ctx.fillStyle = `rgb(${shade}, ${shade + 17}, ${shade - 7})`;
        ctx.fillRect(x * size, y * size, size + 1, size + 1);

        if (value > 0.58) {
          ctx.fillStyle = "rgba(129, 153, 91, .12)";
          ctx.beginPath();
          ctx.ellipse(x * size + 40, y * size + 40, 18 + value * 17, 10 + value * 9, value * 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (value < 0.12) {
          ctx.fillStyle = "rgba(17, 31, 25, .20)";
          ctx.beginPath();
          ctx.arc(x * size + 40, y * size + 40, 13 + value * 25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // A winding, lighter dirt track gives the test map a readable landmark.
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(139, 119, 79, .34)";
    ctx.lineWidth = 76;
    ctx.beginPath();
    ctx.moveTo(120, 820);
    ctx.bezierCurveTo(430, 700, 520, 360, 780, 470);
    ctx.bezierCurveTo(1080, 560, 1180, 240, 1500, 180);
    ctx.stroke();
    ctx.strokeStyle = "rgba(191, 170, 119, .13)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // World-space grid and map boundary.
    ctx.strokeStyle = "rgba(206, 225, 194, .075)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= world.width; x += 160) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world.height); ctx.stroke();
    }
    for (let y = 0; y <= world.height; y += 160) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world.width, y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(210, 228, 205, .4)";
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, world.width - 4, world.height - 4);
  }

  function screenToWorld(event, canvas, width, height) {
    const rect = canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * (width / rect.width);
    const sy = (event.clientY - rect.top) * (height / rect.height);
    return {
      x: camera.x + (sx - width / 2) / camera.zoom,
      y: camera.y + (sy - height / 2) / camera.zoom
    };
  }

  function panBy(dx, dy, width, height) {
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    clampCamera(width, height);
  }

  function zoomAt(sx, sy, deltaY, width, height) {
    const beforeX = camera.x + (sx - width / 2) / camera.zoom;
    const beforeY = camera.y + (sy - height / 2) / camera.zoom;
    const factor = Math.exp(-deltaY * 0.0012);
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
    camera.x = beforeX - (sx - width / 2) / camera.zoom;
    camera.y = beforeY - (sy - height / 2) / camera.zoom;
    clampCamera(width, height);
  }

  function resetCamera(width, height) {
    camera.x = world.width / 2;
    camera.y = world.height / 2;
    camera.zoom = Math.min(1, width / 1100, height / 700);
    clampCamera(width, height);
  }

  function cameraState() { return { x: camera.x, y: camera.y, zoom: camera.zoom }; }

  function drawOverlay(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = "rgba(7, 14, 17, .72)";
    ctx.fillRect(12, height - 38, 250, 26);
    ctx.fillStyle = "#d5e5d5";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`WORLD  ${world.width} × ${world.height}   ZOOM  ${Math.round(camera.zoom * 100)}%`, 22, height - 21);
    ctx.restore();
  }

  window.CreatureWorldView = {
    world, begin, end, drawTerrain, screenToWorld, panBy, zoomAt, resetCamera, cameraState
  };
})();
