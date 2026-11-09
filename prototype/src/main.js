(() => {
  "use strict";

  const canvas = document.getElementById("battlefield");
  if (!canvas) return;
  const gpuCanvas = document.getElementById("terrain-gpu");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.getElementById("runtime-status").textContent = "Canvas unavailable";
    return;
  }

  const W = canvas.width;
  const H = canvas.height;
  const worldView = window.CreatureWorldView;
  if (!worldView) throw new Error("World view module failed to load");
  const WORLD = worldView.world;
  let gpuRenderer = null;
  if (gpuCanvas && window.CreatureWebGpu) {
    window.CreatureWebGpu.create(gpuCanvas).then((renderer) => {
      gpuRenderer = renderer;
      document.getElementById("runtime-status").textContent = "WebGPU terrain · Canvas unit overlay";
    }).catch((error) => {
      gpuCanvas.hidden = true;
      document.getElementById("runtime-status").textContent = "Canvas 2D fallback · " + error.message;
    });
  } else {
    if (gpuCanvas) gpuCanvas.hidden = true;
    document.getElementById("runtime-status").textContent = "Canvas 2D fallback · WebGPU unavailable";
  }
  const STORAGE_KEY = "creature-command-prototype-v1";
  const ui = {
    pause: document.getElementById("pause-button"),
    spawn: document.getElementById("spawn-button"),
    save: document.getElementById("save-button"),
    load: document.getElementById("load-button"),
    reset: document.getElementById("reset-button"),
    selection: document.getElementById("selection-status"),
    status: document.getElementById("game-status"),
    name: document.getElementById("unit-name"),
    health: document.getElementById("unit-health"),
    healthFill: document.getElementById("health-fill"),
    body: document.getElementById("body-select"), head: document.getElementById("head-select"), preview: document.getElementById("creature-preview")
  };

  let units = [];
  let selectedId = null;
  let paused = false;
  let nextId = 1;
  let lastTime = 0;
  let accumulator = 0;
  const STEP = 1 / 60;
  const MAX_FRAME = 0.1;

  function createUnit(team, x, y, blueprint) {
    const creature = blueprint || window.CreatureCatalog.compose("wolf", "wolf");
    const scale = team === "player" ? 1 : 0.85;
    return { id: nextId++, team, x, y, radius: creature.radius,
      hp: creature.maxHp * scale, maxHp: creature.maxHp * scale,
      speed: creature.speed * scale, attack: creature.attack * scale, defense: creature.defense,
      targetX: x, targetY: y, attackCooldown: 0, body: creature.body, head: creature.head,
      color: team === "player" ? "#55b9e8" : "#e8796e" };
  }

  function reset() {
    units = [
      createUnit("player", 420, 430), createUnit("player", 510, 560),
      createUnit("player", 390, 720), createUnit("enemy", 1260, 390),
      createUnit("enemy", 1340, 600), createUnit("enemy", 1230, 790)
    ];
    selectedId = null;
    updatePanel();
  }

  function selectedUnit() {
    return units.find((unit) => unit.id === selectedId) || null;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function update(dt) {
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
      const enemy = units
        .filter((other) => other.team !== unit.team && other.hp > 0)
        .sort((a, b) => distance(unit, a) - distance(unit, b))[0];

      if (enemy && distance(unit, enemy) < 125) {
        if (distance(unit, enemy) > unit.radius + enemy.radius + 8) {
          moveToward(unit, enemy.x, enemy.y, dt);
        } else if (unit.attackCooldown <= 0) {
          enemy.hp = Math.max(0, enemy.hp - Math.max(1, unit.attack - enemy.defense));
          unit.attackCooldown = 0.8;
        }
      } else {
        moveToward(unit, unit.targetX, unit.targetY, dt);
      }
    }
    units = units.filter((unit) => unit.hp > 0);
    if (selectedId !== null && !selectedUnit()) selectedId = null;
    updatePanel();
  }

  function moveToward(unit, x, y, dt) {
    const dx = x - unit.x;
    const dy = y - unit.y;
    const length = Math.hypot(dx, dy);
    if (length < 2) return;
    const step = Math.min(length, unit.speed * dt);
    unit.x += (dx / length) * step;
    unit.y += (dy / length) * step;
    unit.x = Math.max(unit.radius, Math.min(WORLD.width - unit.radius, unit.x));
    unit.y = Math.max(unit.radius, Math.min(WORLD.height - unit.radius, unit.y));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    worldView.begin(ctx, W, H);
    if (!gpuRenderer) worldView.drawTerrain(ctx);

    for (const unit of units) {
      if (!gpuRenderer) {
        ctx.beginPath();
        ctx.fillStyle = unit.color;
        ctx.arc(unit.x, unit.y, unit.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = selectedId === unit.id ? 3 : 1.5;
        ctx.strokeStyle = selectedId === unit.id ? "#fff2a8" : "rgba(255,255,255,.65)";
        ctx.stroke();
      }

      ctx.fillStyle = "#0c171c";
      ctx.fillRect(unit.x - 17, unit.y - 25, 34, 5);
      ctx.fillStyle = unit.team === "player" ? "#6de0a1" : "#f2a08f";
      ctx.fillRect(unit.x - 17, unit.y - 25, 34 * (unit.hp / unit.maxHp), 5);
    }

    const selected = selectedUnit();
    if (selected) {
      ctx.strokeStyle = "rgba(255, 242, 168, .75)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(selected.targetX, selected.targetY, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    worldView.end(ctx);
    worldView.drawOverlay(ctx, W, H);
    if (gpuRenderer) {
      try { gpuRenderer.render(worldView.cameraState(), W, H, WORLD, units); }
      catch (error) {
        gpuRenderer = null;
        gpuCanvas.hidden = true;
        document.getElementById("runtime-status").textContent = "Canvas 2D fallback · WebGPU device unavailable";
      }
    }
  }

  function updatePanel() {
    const unit = selectedUnit();
    ui.selection.textContent = unit ? `Selected: ${unit.team} unit #${unit.id}` : "No unit selected";
    ui.name.textContent = unit ? (unit.team === "player" ? "Player " : "Opponent ") + unit.body + "-" + unit.head + " #" + unit.id : "—";
    ui.health.textContent = unit ? Math.ceil(unit.hp) + " / " + unit.maxHp + " HP · Speed " + unit.speed + " · Attack " + unit.attack + " · Defence " + unit.defense : "No unit selected";
    ui.healthFill.style.width = unit ? `${(unit.hp / unit.maxHp) * 100}%` : "0%";
    const playerCount = units.filter((u) => u.team === "player").length;
    const enemyCount = units.filter((u) => u.team === "enemy").length;
    ui.status.textContent = `Player: ${playerCount} · Opponent: ${enemyCount}`;
    if (ui.preview) { const c = window.CreatureCatalog.compose(ui.body.value, ui.head.value); ui.preview.textContent = c.name + " · " + c.maxHp + " HP · " + c.speed + " speed · " + c.attack + " attack · " + c.defense + " defence"; }
  }

  function pointerPosition(event) {
    return worldView.screenToWorld(event, canvas, W, H);
  }

  let panPointer = null;
  let draggedUnit = null;
  let dragMoved = false;
  let suppressNextClick = false;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.button === 0) {
      const point = pointerPosition(event);
      const hit = [...units].reverse().find((unit) =>
        unit.team === "player" && Math.hypot(unit.x - point.x, unit.y - point.y) <= unit.radius + 8
      );
      if (hit) {
        draggedUnit = hit;
        dragMoved = false;
        canvas.setPointerCapture(event.pointerId);
      }
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (panPointer && panPointer.id === event.pointerId) {
      const rect = canvas.getBoundingClientRect();
      const dx = (event.clientX - panPointer.x) * (W / rect.width);
      const dy = (event.clientY - panPointer.y) * (H / rect.height);
      worldView.panBy(dx, dy, W, H);
      panPointer.x = event.clientX;
      panPointer.y = event.clientY;
      draw();
      return;
    }
    if (draggedUnit && event.buttons === 1) {
      const point = pointerPosition(event);
      if (Math.hypot(point.x - draggedUnit.x, point.y - draggedUnit.y) > 1) dragMoved = true;
      draggedUnit.x = Math.max(draggedUnit.radius, Math.min(WORLD.width - draggedUnit.radius, point.x));
      draggedUnit.y = Math.max(draggedUnit.radius, Math.min(WORLD.height - draggedUnit.radius, point.y));
      draggedUnit.targetX = draggedUnit.x;
      draggedUnit.targetY = draggedUnit.y;
      selectedId = draggedUnit.id;
      updatePanel();
      draw();
    }
  });
  function finishPointer(event) {
    if (panPointer && panPointer.id === event.pointerId) panPointer = null;
    if (draggedUnit) {
      suppressNextClick = dragMoved;
      draggedUnit = null;
      dragMoved = false;
    }
  }
  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * (W / rect.width);
    const sy = (event.clientY - rect.top) * (H / rect.height);
    worldView.zoomAt(sx, sy, event.deltaY, W, H);
    draw();
  }, { passive: false });

  canvas.addEventListener("click", (event) => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    const point = pointerPosition(event);
    const hit = [...units].reverse().find((unit) =>
      unit.team === "player" && Math.hypot(unit.x - point.x, unit.y - point.y) <= unit.radius + 5
    );
    selectedId = hit ? hit.id : null;
    updatePanel();
    draw();
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const unit = selectedUnit();
    if (!unit) return;
    const point = pointerPosition(event);
    unit.targetX = Math.max(unit.radius, Math.min(WORLD.width - unit.radius, point.x));
    unit.targetY = Math.max(unit.radius, Math.min(WORLD.height - unit.radius, point.y));
  });

  ui.pause.addEventListener("click", () => {
    paused = !paused;
    ui.pause.textContent = paused ? "Resume" : "Pause";
    ui.status.textContent = paused ? "Simulation paused" : "Simulation running";
  });

  ui.body.addEventListener("change", updatePanel);
  ui.head.addEventListener("change", updatePanel);
  ui.spawn.addEventListener("click", () => {
    const blueprint = window.CreatureCatalog.compose(ui.body.value, ui.head.value);
    const unit = createUnit("player", 300 + Math.random() * 450, 250 + Math.random() * 500, blueprint);
    units.push(unit);
    selectedId = unit.id;
    updatePanel();
  });

  ui.save.addEventListener("click", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ units, nextId }));
      ui.status.textContent = "Saved in this browser";
    } catch (error) {
      ui.status.textContent = "Save failed: browser storage unavailable";
    }
  });

  ui.load.addEventListener("click", () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { ui.status.textContent = "No saved state found"; return; }
      const state = JSON.parse(raw);
      if (!state || !Array.isArray(state.units) || !Number.isInteger(state.nextId)) {
        throw new Error("Invalid save format");
      }
      units = state.units.filter((u) =>
        u && Number.isFinite(u.x) && Number.isFinite(u.y) &&
        (u.team === "player" || u.team === "enemy") && Number.isFinite(u.hp)
      );
      nextId = state.nextId;
      selectedId = null;
      updatePanel();
      ui.status.textContent = "Save loaded";
    } catch (error) {
      ui.status.textContent = "Could not load saved state";
    }
  });

  ui.reset.addEventListener("click", () => {
    reset();
    worldView.resetCamera(W, H);
    ui.status.textContent = "Arena reset";
  });

  function frame(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min((timestamp - lastTime) / 1000, MAX_FRAME);
    lastTime = timestamp;
    if (!paused) {
      accumulator += delta;
      while (accumulator >= STEP) {
        update(STEP);
        accumulator -= STEP;
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
})();
