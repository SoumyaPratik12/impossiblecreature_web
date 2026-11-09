(() => {
  "use strict";
  const canvas = document.getElementById("battlefield");
  const gpuCanvas = document.getElementById("terrain-gpu");
  const ctx = canvas && canvas.getContext("2d");
  if (!canvas || !ctx) return;

  const W = canvas.width, H = canvas.height;
  const worldView = window.CreatureWorldView;
  const catalog = window.CreatureCatalog;
  if (!worldView || !catalog) throw new Error("Game modules failed to load");
  const WORLD = worldView.world;
  const status = document.getElementById("runtime-status");
  let gpuRenderer = null;

  if (gpuCanvas && window.CreatureWebGpu && navigator.gpu) {
    window.CreatureWebGpu.create(gpuCanvas).then((renderer) => {
      gpuRenderer = renderer;
      status.textContent = "WebGPU renderer active";
      draw();
    }).catch((error) => {
      gpuCanvas.hidden = true;
      status.textContent = "Canvas renderer · " + error.message;
    });
  } else {
    if (gpuCanvas) gpuCanvas.hidden = true;
    status.textContent = "Canvas renderer active";
  }

  const el = (id) => document.getElementById(id);
  const ui = {
    pause: el("pause-button"), spawn: el("spawn-button"), save: el("save-button"),
    load: el("load-button"), reset: el("reset-button"), selection: el("selection-status"),
    status: el("game-status"), name: el("unit-name"), health: el("unit-health"),
    healthFill: el("health-fill"), body: el("body-select"), head: el("head-select"),
    preview: el("creature-preview"), zoomIn: el("zoom-in"), zoomOut: el("zoom-out"),
    resetView: el("reset-view")
  };
  const STORAGE_KEY = "creature-command-prototype-v2";
  let units = [], selectedId = null, paused = false, nextId = 1;
  let lastTime = 0, accumulator = 0;
  const STEP = 1 / 60, MAX_FRAME = 0.1;
  let panPointer = null, dragState = null, suppressClick = false, spaceDown = false;

  function createUnit(team, x, y, blueprint) {
    const c = blueprint || catalog.compose("wolf", "wolf");
    const scale = team === "player" ? 1 : 0.85;
    return { id: nextId++, team, x, y, radius: c.radius, hp: c.maxHp * scale,
      maxHp: c.maxHp * scale, speed: c.speed * scale, attack: c.attack * scale,
      defense: c.defense, targetX: x, targetY: y, moveOrder: false, attackCooldown: 0,
      body: c.body, head: c.head, color: team === "player" ? "#55b9e8" : "#e8796e" };
  }
  function reset() {
    units = [createUnit("player",420,430),createUnit("player",510,560),createUnit("player",390,720),
      createUnit("enemy",1260,390),createUnit("enemy",1340,600),createUnit("enemy",1230,790)];
    selectedId = null;
    updatePanel();
  }
  function selectedUnit() { return units.find((u) => u.id === selectedId) || null; }
  function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
  function clampPoint(x,y,r=0) {
    return { x: Math.max(r,Math.min(WORLD.width-r,x)), y: Math.max(r,Math.min(WORLD.height-r,y)) };
  }
  function issueMove(unit,x,y) {
    const p=clampPoint(x,y,unit.radius);
    unit.targetX=p.x; unit.targetY=p.y; unit.moveOrder=true;
  }
  function update(dt) {
    for (const unit of units) {
      if (unit.hp<=0) continue;
      unit.attackCooldown=Math.max(0,unit.attackCooldown-dt);
      // Explicit player move orders take priority; nearby enemies cannot cancel the command.
      if (unit.moveOrder) {
        if (Math.hypot(unit.targetX-unit.x,unit.targetY-unit.y)>3) moveToward(unit,unit.targetX,unit.targetY,dt);
        else unit.moveOrder=false;
        continue;
      }
      const enemy=units.filter(o=>o.team!==unit.team&&o.hp>0)
        .sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
      if (enemy && distance(unit,enemy)<125) {
        if (distance(unit,enemy)>unit.radius+enemy.radius+8) moveToward(unit,enemy.x,enemy.y,dt);
        else if (unit.attackCooldown<=0) {
          enemy.hp=Math.max(0,enemy.hp-Math.max(1,unit.attack-enemy.defense));
          unit.attackCooldown=0.8;
        }
      }
    }
    units=units.filter(u=>u.hp>0);
    if (selectedId!==null&&!selectedUnit()) selectedId=null;
    updatePanel();
  }
  function moveToward(unit,x,y,dt) {
    const dx=x-unit.x,dy=y-unit.y,len=Math.hypot(dx,dy);
    if (len<0.5) return;
    const step=Math.min(len,unit.speed*dt);
    unit.x+=dx/len*step; unit.y+=dy/len*step;
    const p=clampPoint(unit.x,unit.y,unit.radius); unit.x=p.x; unit.y=p.y;
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    worldView.begin(ctx,W,H);
    if (!gpuRenderer) worldView.drawTerrain(ctx);
    for (const u of units) {
      if (!gpuRenderer) {
        ctx.beginPath(); ctx.fillStyle=u.color; ctx.arc(u.x,u.y,u.radius,0,Math.PI*2); ctx.fill();
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
    if (gpuRenderer) {
      try { gpuRenderer.render(worldView.cameraState(),W,H,WORLD,units); }
      catch (error) { gpuRenderer=null; gpuCanvas.hidden=true; status.textContent="Canvas fallback · GPU unavailable"; }
    }
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
    const u=createUnit("player",300+Math.random()*450,250+Math.random()*500,blueprint);
    units.push(u);selectedId=u.id;updatePanel();draw();
  });
  ui.save.addEventListener("click",()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({units,nextId,camera:worldView.cameraState()}));ui.status.textContent="Saved in this browser";}
    catch(e){ui.status.textContent="Save failed: browser storage unavailable";}
  });
  ui.load.addEventListener("click",()=>{
    try{
      const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(!s||!Array.isArray(s.units)||!Number.isInteger(s.nextId))throw new Error("Invalid save");
      units=s.units.filter(u=>u&&Number.isFinite(u.x)&&Number.isFinite(u.y)&&(u.team==="player"||u.team==="enemy")&&Number.isFinite(u.hp));
      nextId=s.nextId;selectedId=null;
      if(s.camera)worldView.setCamera(s.camera,W,H);
      updatePanel();ui.status.textContent="Save loaded";draw();
    }catch(e){ui.status.textContent="No valid saved state found";}
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