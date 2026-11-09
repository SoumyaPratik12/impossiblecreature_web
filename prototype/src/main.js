(() => {
  "use strict";

  const canvas = document.getElementById("battlefield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.getElementById("runtime-status").textContent = "Canvas unavailable";
    return;
  }

  const W = canvas.width;
  const H = canvas.height;
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
    healthFill: document.getElementById("health-fill")
  };

  let units = [];
  let selectedId = null;
  let paused = false;
  let nextId = 1;
  let lastTime = 0;
  let accumulator = 0;
  const STEP = 1 / 60;
  const MAX_FRAME = 0.1;

  function createUnit(team, x, y) {
    return {
      id: nextId++, team, x, y, radius: 15, hp: 100, maxHp: 100,
      speed: team === "player" ? 105 : 72,
      targetX: x, targetY: y, attackCooldown: 0,
      color: team === "player" ? "#55b9e8" : "#e8796e"
    };
  }

  function reset() {
    units = [
      createUnit("player", 160, 190), createUnit("player", 220, 300),
      createUnit("player", 145, 410), createUnit("enemy", 730, 175),
      createUnit("enemy", 790, 300), createUnit("enemy", 700, 420)
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
          enemy.hp = Math.max(0, enemy.hp - 12);
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
    unit.x = Math.max(unit.radius, Math.min(W - unit.radius, unit.x));
    unit.y = Math.max(unit.radius, Math.min(H - unit.radius, unit.y));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#1b3028";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(173, 205, 180, .10)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Original decorative terrain features, generated at runtime.
    for (let i = 0; i < 18; i++) {
      const x = (i * 173 + 53) % W;
      const y = (i * 97 + 31) % H;
      ctx.fillStyle = "rgba(107, 145, 94, .14)";
      ctx.beginPath(); ctx.arc(x, y, 9 + (i % 4) * 3, 0, Math.PI * 2); ctx.fill();
    }

    for (const unit of units) {
      ctx.beginPath();
      ctx.fillStyle = unit.color;
      ctx.arc(unit.x, unit.y, unit.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = selectedId === unit.id ? 3 : 1.5;
      ctx.strokeStyle = selectedId === unit.id ? "#fff2a8" : "rgba(255,255,255,.65)";
      ctx.stroke();

      ctx.fillStyle = "#0c171c";
      ctx.fillRect(unit.x - 17, unit.y - 25, 34, 5);
      ctx.fillStyle = unit.team === "player" ? "#6de0a1" : "#f2a08f";
      ctx.fillRect(unit.x - 17, unit.y - 25, 34 * (unit.hp / unit.maxHp), 5);
    }

    const selected = selectedUnit();
    if (selected) {
      ctx.strokeStyle = "rgba(255, 242, 168, .65)";
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(selected.targetX, selected.targetY, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function updatePanel() {
    const unit = selectedUnit();
    ui.selection.textContent = unit ? `Selected: ${unit.team} unit #${unit.id}` : "No unit selected";
    ui.name.textContent = unit ? `${unit.team === "player" ? "Player" : "Opponent"} unit #${unit.id}` : "—";
    ui.health.textContent = unit ? `${Math.ceil(unit.hp)} / ${unit.maxHp} HP` : "No unit selected";
    ui.healthFill.style.width = unit ? `${(unit.hp / unit.maxHp) * 100}%` : "0%";
    const playerCount = units.filter((u) => u.team === "player").length;
    const enemyCount = units.filter((u) => u.team === "enemy").length;
    ui.status.textContent = `Player: ${playerCount} · Opponent: ${enemyCount}`;
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (W / rect.width),
      y: (event.clientY - rect.top) * (H / rect.height)
    };
  }

  canvas.addEventListener("click", (event) => {
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
    unit.targetX = Math.max(unit.radius, Math.min(W - unit.radius, point.x));
    unit.targetY = Math.max(unit.radius, Math.min(H - unit.radius, point.y));
  });

  ui.pause.addEventListener("click", () => {
    paused = !paused;
    ui.pause.textContent = paused ? "Resume" : "Pause";
    ui.status.textContent = paused ? "Simulation paused" : "Simulation running";
  });

  ui.spawn.addEventListener("click", () => {
    const unit = createUnit("player", 100 + Math.random() * 150, 100 + Math.random() * 350);
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
