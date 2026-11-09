const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const server = spawn("python", ["-m", "http.server", "4173", "--directory", "."], { stdio: "ignore" });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch("http://127.0.0.1:4173/prototype/"); if (r.ok) { ready = true; break; } } catch {}
      await delay(250);
    }
    assert.ok(ready, "static server failed to start");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/prototype/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.CreatureGameDebug && window.CreatureWorldView);
    const canvas = page.locator("#battlefield"), box = await canvas.boundingBox();
    const units = await page.evaluate(() => window.CreatureGameDebug.getUnits().filter(u => u.team === "player").map(u => ({ id:u.id, ...window.CreatureGameDebug.worldToScreen(u.x,u.y) })));
    await page.mouse.click(box.x + units[0].x * box.width / 960, box.y + units[0].y * box.height / 560);
    let selected = await page.evaluate(() => window.CreatureGameDebug.getSelectedIds());
    assert.deepEqual(selected, [units[0].id], "click selects one unit");
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x + units[1].x * box.width / 960, box.y + units[1].y * box.height / 560);
    await page.keyboard.up("Shift");
    selected = await page.evaluate(() => window.CreatureGameDebug.getSelectedIds());
    assert.equal(selected.length, 2, "Shift-click adds a unit");
    await page.keyboard.press("Escape");
    selected = await page.evaluate(() => window.CreatureGameDebug.getSelectedIds());
    assert.equal(selected.length, 0, "Escape clears selection");
    await page.keyboard.press("Control+a");
    selected = await page.evaluate(() => window.CreatureGameDebug.getSelectedIds());
    assert.equal(selected.length, 3, "Ctrl+A selects every living friendly unit");
    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.9, { steps: 10 });
    await page.mouse.up();
    selected = await page.evaluate(() => window.CreatureGameDebug.getSelectedIds());
    assert.ok(selected.length >= 2, "drag box selects multiple units");
    await page.locator("#save-button").click();
    await page.locator("#reset-button").click();
    await page.locator("#load-button").click();
    selected = await page.evaluate(() => window.CreatureGameDebug.getSelectedIds());
    assert.ok(selected.length >= 2, "save/load restores selected units");
    await page.locator("#formation-select").selectOption("line");
    const target = await page.evaluate(() => window.CreatureGameDebug.worldToScreen(900, 450));
    await page.mouse.click(box.x + target.x * box.width / 960, box.y + target.y * box.height / 560, { button: "right" });
    const moved = await page.evaluate(() => window.CreatureGameDebug.getUnits().filter(u => window.CreatureGameDebug.getSelectedIds().includes(u.id)));
    assert.ok(moved.length >= 2 && moved.every(u => u.moveOrder && u.path.length > 0), "right-click issues path-based group movement");
    const a=moved[0],b=moved[1],dx=b.targetX-a.targetX,dy=b.targetY-a.targetY;
    assert.ok(moved.every(u => Math.abs(dx*(u.targetY-a.targetY)-dy*(u.targetX-a.targetX)) < 2),
      "line formation assigns collinear destinations in its travel direction");
    const size = await canvas.evaluate(el => ({ width:el.width, height:el.height }));
    assert.equal(size.width, 1920, "DPR=2 backing width");
    assert.equal(size.height, 1120, "DPR=2 backing height");
    assert.deepEqual(errors, [], "no uncaught browser errors");
    console.log("Browser tests passed: selection, drag-box, formation movement, save/load, high-DPI.");
  } finally { if (browser) await browser.close(); server.kill("SIGTERM"); }
})().catch(e => { console.error(e); process.exitCode = 1; });
