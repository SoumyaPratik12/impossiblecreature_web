(() => {
  "use strict";
  const canvas = document.getElementById("battlefield");
  const ctx = canvas && canvas.getContext("2d");
  if (!canvas || !ctx) return;

  const W = canvas.width, H = canvas.height;
  const worldView = window.CreatureWorldView;
  const catalog = window.CreatureCatalog;
  const core = window.CreatureGameCore;
  if (!worldView || !catalog || !core) throw new Error("Game modules failed to load");
  const WORLD = worldView.world;
  const status = document.getElementById("runtime-status");
  const gpuCanvas = document.getElementById("terrain-gpu");
  if (gpuCanvas) gpuCanvas.hidden = true;
  status.textContent = "Canvas renderer active · stable 2D scene";

  const el = (id) => document.getElementById(id);
  const ui = {
    pause: el("pause-button"), spawn: el("spawn-button"), save: el("save-button"),
    load: el("load-button"), reset: el("reset-button"), selection: el("selection-status"),
    status: el("game-status"), name: el("unit-name"), health: el("unit-health"),
    healthFill: el("health-fill"), body: el("body-select"), head: el("head-select"),
    preview: el("creature-preview"), zoomIn: el("zoom-in"), zoomOut: el("zoom-out"),
    resetView: el("reset-view")
  };
  const STORAGE_KEY = "creature-command-prototype-v3";
  let units = [], selectedId = null, paused = false, nextId = 1;
  let lastTime = 0, accumulator = 0;
  const STEP = 1 / 60, MAX_FRAME = 0.1;
  let panPointer = null, dragState = null, suppressClick = false, spaceDown = false;

  function createUnit(team,x,y,blueprint) { return core.createUnit(team,x,y,blueprint||catalog.compose("wolf","wolf"),nextId++,WORLD); }
  function reset() { const initial=core.createInitialState(catalog,WORLD);units=initial.units;nextId=initial.nextId;selectedId=null;paused=false;ui.pause.textContent="Pause";updatePanel(); }
  function selectedUnit() { return units.find((u) => u.id === selectedId) || null; }
  function issueMove(unit,x,y) { core.issueMove(unit,x,y,WORLD); }
  function update(dt) { const simulation={units,nextId};core.update(simulation,dt,WORLD);units=simulation.units;if(selectedId!==null&&!selectedUnit())selectedId=null;updatePanel(); }
  function draw() {
    ctx.clearRect(0,0,W,H);
    worldView.begin(ctx,W,H);
    worldView.drawTerrain(ctx);
    for (const u of units) {
      {
        ctx.beginPath(); ctx.fillStyle=u.team==="player"?"#55b9e8":"#e8796e"; ctx.arc(u.x,u.y,u.radius,0,Math.PI*2); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle="rgba(255,255,255,.65)"; ctx.stroke();
      }
      if (u.id===selectedId) {
        ctx.beginPath(); ctx.arc(u.x,u.y,u.radius+6,0,Math.PI*2);
        ctx.lineWidth=2.5; ctx.strokeStyle="#fff2a8"; ctx.stroke();
      }
      ctx.fillStyle="#0c171c"; ctx.fillRect(u.x-17,u.y-u.radius-12,34,5);
      ctx.fillStyle=u.team==="player"?"#6de0a1":"#f2a08f";
      ctx.fillRect(u.x-17,u.y-u.radius-12,34*Math.max(0,u.hp/u.maxHp),5);
    }
    const selected=selectedUnit();
    if (selected && selected.moveOrder) {
      ctx.save(); ctx.strokeStyle="rgba(255,242,168,.9)"; ctx.lineWidth=2;
      ctx.setLineDash([5,5]); ctx.beginPath(); ctx.arc(selected.targetX,selected.targetY,12,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    worldView.end(ctx);
    worldView.drawOverlay(ctx,W,H);
  }
  function updatePanel() {
    const u=selectedUnit();
    ui.selection.textContent=u?`Selected: ${u.team} unit #${u.id}`:"No unit selected";
    ui.name.textContent=u?(u.team==="player"?"Player ":"Opponent ")+u.body+"-"+u.head+" #"+u.id:"—";
    ui.health.textContent=u?Math.ceil(u.hp)+" / "+u.maxHp+" HP · Speed "+u.speed+" · Attack "+u.attack+" · Defence "+u.defense:"Select a player creature";
    ui.healthFill.style.width=u?`${Math.max(0,u.hp/u.maxHp)*100}%`:"0%";
    ui.status.textContent="Player: "+units.filter(x=>x.team==="player").length+" · Opponent: "+units.filter(x=>x.team==="enemy").length;
    if(ui.preview){const c=catalog.compose(ui.body.value,ui.head.value);ui.preview.textContent=c.name+" · "+c.maxHp+" HP · "+c.speed+" speed · "+c.attack+" attack · "+c.defense+" defence";}
  }
  function point(event){return worldView.screenToWorld(event,canvas,W,H);}
  function hitPlayer(p){return [...units].reverse().find(u=>u.team==="player"&&Math.hypot(u.x-p.x,u.y-p.y)<=u.radius+9)||null;}

  canvas.addEventListener("pointerdown",(event)=>{
    if(event.button===1 || (event.button===0&&(event.shiftKey||spaceDown))){
      panPointer={id:event.pointerId,x:event.clientX,y:event.clientY,button:event.button};
      canvas.setPointerCapture(event.pointerId); event.preventDefault(); return;
    }
    if(event.button!==0)return;
    const p=point(event), hit=hitPlayer(p);
    if(hit){
      selectedId=hit.id;
      dragState={id:event.pointerId,unit:hit,offsetX:hit.x-p.x,offsetY:hit.y-p.y,startX:event.clientX,startY:event.clientY,moved:false};
      canvas.setPointerCapture(event.pointerId); updatePanel(); draw();
    }
  });
  canvas.addEventListener("pointermove",(event)=>{
    if(panPointer&&panPointer.id===event.pointerId){
      const rect=canvas.getBoundingClientRect();
      worldView.panBy((event.clientX-panPointer.x)*W/rect.width,(event.clientY-panPointer.y)*H/rect.height,W,H);
      panPointer.x=event.clientX; panPointer.y=event.clientY; draw(); return;
    }
    if(dragState&&dragState.id===event.pointerId&&(event.buttons&1)){
      const p=point(event);
      if(Math.hypot(event.clientX-dragState.startX,event.clientY-dragState.startY)>3)dragState.moved=true;
      if(dragState.moved){
        const pos=clampPoint(p.x+dragState.offsetX,p.y+dragState.offsetY,dragState.unit.radius);
        dragState.unit.x=pos.x; dragState.unit.y=pos.y;
        dragState.unit.targetX=pos.x; dragState.unit.targetY=pos.y; dragState.unit.moveOrder=false;
        draw();
      }
    }
  });
  function finishPointer(event){
    if(panPointer&&panPointer.id===event.pointerId){if(panPointer.button===0)suppressClick=true;panPointer=null;}
    if(dragState&&dragState.id===event.pointerId){suppressClick=dragState.moved;dragState=null;}
  }
  canvas.addEventListener("pointerup",finishPointer);
  canvas.addEventListener("pointercancel",finishPointer);
  canvas.addEventListener("lostpointercapture",finishPointer);
  canvas.addEventListener("click",(event)=>{
    if(suppressClick){suppressClick=false;return;}
    const p=point(event), hit=hitPlayer(p);
    if(hit){selectedId=hit.id;updatePanel();draw();return;}
    const selected=selectedUnit();
    if(selected){issueMove(selected,p.x,p.y);ui.status.textContent="Move order issued";draw();}
    else {selectedId=null;updatePanel();draw();}
  });
  canvas.addEventListener("contextmenu",(event)=>{
    event.preventDefault(); const selected=selectedUnit(); if(!selected)return;
    const p=point(event); issueMove(selected,p.x,p.y); ui.status.textContent="Move order issued"; draw();
  });
  canvas.addEventListener("wheel",(event)=>{
    event.preventDefault(); const rect=canvas.getBoundingClientRect();
    worldView.zoomAt((event.clientX-rect.left)*W/rect.width,(event.clientY-rect.top)*H/rect.height,event.deltaY,W,H);
    draw();
  },{passive:false});
  window.addEventListener("keydown",(e)=>{if(e.code==="Space"&&!e.repeat){spaceDown=true;if(e.target===document.body)e.preventDefault();}});
  window.addEventListener("keyup",(e)=>{if(e.code==="Space")spaceDown=false;});
  window.addEventListener("blur",()=>{spaceDown=false;panPointer=null;dragState=null;});

  ui.zoomIn.addEventListener("click",()=>{worldView.zoomBy(1.2,W/2,H/2,W,H);draw();});
  ui.zoomOut.addEventListener("click",()=>{worldView.zoomBy(1/1.2,W/2,H/2,W,H);draw();});
  ui.resetView.addEventListener("click",()=>{worldView.resetCamera(W,H);draw();});
  ui.pause.addEventListener("click",()=>{paused=!paused;ui.pause.textContent=paused?"Resume":"Pause";ui.status.textContent=paused?"Simulation paused":"Simulation running";});
  ui.body.addEventListener("change",updatePanel); ui.head.addEventListener("change",updatePanel);
  ui.spawn.addEventListener("click",()=>{
    const blueprint=catalog.compose(ui.body.value,ui.head.value);
    const position=core.findSpawn(units,Math.random()*WORLD.width,Math.random()*WORLD.height,blueprint.radius,WORLD);
    if(!position){ui.status.textContent="No safe spawn location available";return;}
    const u=createUnit("player",position.x,position.y,blueprint);
    units.push(u);selectedId=u.id;updatePanel();draw();
  });
  ui.save.addEventListener("click",()=>{
    try { const saved=core.snapshot({units,nextId},worldView.cameraState());saved.selectedId=selectedId;localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));ui.status.textContent="Saved in this browser"; }
    catch(error) { ui.status.textContent="Save failed: "+error.message; }
  });
  ui.load.addEventListener("click",()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      const restored=core.validateSave(saved,WORLD,catalog);
      units=restored.units;nextId=restored.nextId;
      selectedId=units.some(u=>u.id===saved.selectedId&&u.team==="player")?saved.selectedId:null;
      worldView.setCamera(restored.camera,W,H);updatePanel();ui.status.textContent="Save loaded";draw();
    } catch(error) { ui.status.textContent="No valid save found · "+error.message; }
  });
  ui.reset.addEventListener("click",()=>{reset();worldView.resetCamera(W,H);ui.status.textContent="Arena reset";draw();});
  function frame(timestamp){
    if(!lastTime)lastTime=timestamp;
    const delta=Math.min((timestamp-lastTime)/1000,MAX_FRAME);lastTime=timestamp;
    if(!paused){accumulator+=delta;while(accumulator>=STEP){update(STEP);accumulator-=STEP;}}
    draw();requestAnimationFrame(frame);
  }
  worldView.resetCamera(W,H);reset();requestAnimationFrame(frame);
})();