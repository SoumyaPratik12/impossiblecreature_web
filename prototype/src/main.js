(() => {
  "use strict";
  const canvas = document.getElementById("battlefield");
  const ctx = canvas && canvas.getContext("2d", { alpha: false });
  if (!canvas || !ctx) return;

  const W = 960, H = 560;
  let pixelRatio = 1;
  function resizeCanvasForDisplay() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (ratio === pixelRatio && canvas.width === Math.round(W * ratio)) return;
    pixelRatio = ratio; canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
  }
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resizeCanvasForDisplay).observe(canvas.parentElement);
  window.addEventListener("resize", resizeCanvasForDisplay);
  const worldView = window.CreatureWorldView;
  const catalog = window.CreatureCatalog;
  const core = window.CreatureGameCore;
  const rts = window.CreatureRTS;
  if (!worldView || !catalog || !core || !rts) throw new Error("Game modules failed to load");
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
    resetView: el("reset-view"), formation: el("formation-select"), gather:el("gather-button"), turret:el("turret-button"), barracks:el("barracks-button"), train:el("train-button"), difficulty:el("difficulty-select"), economy:el("economy-status"), domain:el("domain-select"), workers:el("workers-button"), landLab:el("land-lab-button"), waterLab:el("water-lab-button"), airLab:el("air-lab-button"), storage:el("storage-button")
  };
  const STORAGE_KEY = "creature-command-prototype-v3";
  let units = [], selectedIds = new Set(), paused = false, nextId = 1, rtsState=rts.createState("normal"), unitById=new Map(), enemyThink=0;
  let lastTime = 0, accumulator = 0;
  const STEP = 1 / 60, MAX_FRAME = 0.1;
  let panPointer = null, dragState = null, selectionDrag = null, suppressClick = false, spaceDown = false;

  function createUnit(team,x,y,blueprint) { return core.createUnit(team,x,y,blueprint||catalog.compose("wolf","wolf"),nextId++,WORLD); }
  function reset() { const initial=core.createInitialState(catalog,WORLD);units=initial.units;nextId=initial.nextId;selectedIds.clear();paused=false;rtsState=rts.createState(ui.difficulty?.value||"normal");rts.assignWorkers(rtsState,"player");rts.assignWorkers(rtsState,"enemy");enemyThink=0;ui.pause.textContent="Pause";updatePanel(); }
  function selectedUnit() { return units.find(u=>selectedIds.has(u.id))||null; }
  function selectedUnits(){return units.filter(u=>selectedIds.has(u.id));}
  function selectOnly(u){selectedIds.clear();if(u)selectedIds.add(u.id);}
  function issueMoveSelection(x,y){const group=selectedUnits();if(!group.length)return;const formation=ui.formation?.value||"compact";core.issueFormationMove(group,x,y,WORLD,formation);ui.status.textContent=formation+" formation order issued to "+group.length+" creatures";draw();}
  function issueMove(unit,x,y) { core.issueMove(unit,x,y,WORLD); }
  let panelRefresh=0;
  function update(dt) {
    const s={units,nextId};core.update(s,dt,WORLD,core.DEFAULT_OBSTACLES);units=s.units;
    rts.update(rtsState,dt,units,WORLD);
    for(const spec of rts.drainSpawns(rtsState)){const p=core.findSpawn(units,spec.team==="player"?rtsState.bases.player.x+65:rtsState.bases.enemy.x-65,spec.team==="player"?450:450,catalog.compose(spec.body,spec.head,spec.domain).radius,WORLD);if(p){const unit=createUnit(spec.team,p.x,p.y,catalog.compose(spec.body,spec.head,spec.domain));units.push(unit);}}
    enemyThink+=dt;if(enemyThink>5){enemyThink=0;if(!rtsState.buildings.some(b=>b.team==="enemy"&&b.type==="barracks"))rts.build(rtsState,"enemy","barracks",rtsState.bases.enemy.x-125,450);else{if(!rtsState.buildings.some(b=>b.team==="enemy"&&b.type==="land_lab"))rts.build(rtsState,"enemy","land_lab",rtsState.bases.enemy.x-125,330);rts.queueCreature(rtsState,"enemy","wolf","wolf","land");if(rtsState.buildings.filter(b=>b.team==="enemy"&&b.type==="turret").length<2)rts.build(rtsState,"enemy","turret",rtsState.bases.enemy.x-150,450+(rtsState.buildings.length%2?115:-115));}}
    if(rtsState.result&&!paused){paused=true;ui.pause.textContent="Resume";ui.status.textContent=rtsState.result==="victory"?"Victory — enemy base destroyed":"Defeat — your base was destroyed";}
    for(const id of [...selectedIds])if(!units.some(u=>u.id===id))selectedIds.delete(id);
    for(const u of units)if(u.moveOrder)u.animPhase=(u.animPhase||0)+dt*10;
    panelRefresh+=dt;if(panelRefresh>=0.1){panelRefresh=0;updatePanel();}
  }
  function drawCreature(u) {
    const player=u.team==="player",base=player?"#55b9e8":"#e8796e";
    const moving=u.moveOrder;
    const bob=moving?Math.sin(u.animPhase||0)*1.8:0;
    const target=u.attackTargetId?unitById.get(u.attackTargetId):(u.moveOrder?{x:u.targetX,y:u.targetY}:null);
    const angle=target?Math.atan2(target.y-u.y,target.x-u.x):0;
    ctx.save();ctx.translate(u.x,u.y+bob);ctx.rotate(angle);
    ctx.fillStyle=base;ctx.strokeStyle=player?"#c8f0ff":"#ffd2c9";ctx.lineWidth=1.6;
    ctx.beginPath();
    if(u.body==="bear")ctx.ellipse(0,0,u.radius*1.12,u.radius*.88,0,0,Math.PI*2);
    else if(u.body==="eagle")ctx.ellipse(0,0,u.radius*1.2,u.radius*.56,0,0,Math.PI*2);
    else ctx.ellipse(0,0,u.radius*1.08,u.radius*.68,0,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    if(u.body==="eagle"){
      ctx.beginPath();ctx.moveTo(-u.radius*.25,-u.radius*.25);ctx.lineTo(-u.radius*.85,-u.radius*1.15);ctx.lineTo(u.radius*.35,-u.radius*.42);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(-u.radius*.25,u.radius*.25);ctx.lineTo(-u.radius*.85,u.radius*1.15);ctx.lineTo(u.radius*.35,u.radius*.42);ctx.closePath();ctx.fill();
    }
    const hx=u.radius*.58,hr=u.body==="bear"?u.radius*.58:u.radius*.48;
    ctx.fillStyle=player?"#9bdcf5":"#f5b0a5";ctx.beginPath();ctx.arc(hx,0,hr,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(u.head==="eagle"){
      ctx.fillStyle="#e7bd62";ctx.beginPath();ctx.moveTo(hx+hr*.72,0);ctx.lineTo(hx+hr*1.75,hr*.22);ctx.lineTo(hx+hr*.72,hr*.48);ctx.closePath();ctx.fill();
    }else{
      ctx.fillStyle=player?"#d8f5ff":"#ffe0d8";
      const snout=u.head==="bear"?hr*.52:hr*.9;
      ctx.beginPath();ctx.ellipse(hx+hr*.65,0,snout,hr*.38,0,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#15202a";ctx.beginPath();ctx.arc(hx+hr*.25,-hr*.2,Math.max(1.5,hr*.12),0,Math.PI*2);ctx.fill();
    ctx.restore();
    if(u.attackTargetId){ctx.save();ctx.strokeStyle=player?"rgba(126,213,255,.65)":"rgba(255,170,150,.65)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(u.x,u.y,u.radius+4,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    unitById=new Map(units.map(unit=>[unit.id,unit]));
    worldView.begin(ctx,W,H);
    worldView.drawTerrain(ctx);
    for(const node of rtsState.nodes){ctx.save();ctx.fillStyle=node.type==="timber"?"#8a633d":"#83939d";ctx.strokeStyle="#d5c9a6";ctx.lineWidth=2;ctx.beginPath();ctx.arc(node.x,node.y,15,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#f0e7d0";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(node.type==="timber"?"WOOD":"ORE",node.x,node.y-21);ctx.restore();}
    for(const team of ["player","enemy"]){const b=rtsState.bases[team];ctx.save();ctx.fillStyle=team==="player"?"#236b91":"#963f3a";ctx.strokeStyle="#d8e1e5";ctx.lineWidth=3;ctx.fillRect(b.x-34,b.y-32,68,64);ctx.strokeRect(b.x-34,b.y-32,68,64);ctx.fillStyle=team==="player"?"#9edcf2":"#f0a59b";ctx.fillRect(b.x-20,b.y-48,40,16);ctx.fillStyle="#f3e8c8";ctx.font="bold 12px system-ui";ctx.textAlign="center";ctx.fillText(team==="player"?"COMMAND":"ENEMY HQ",b.x,b.y+5);ctx.fillStyle="#111";ctx.fillRect(b.x-38,b.y-59,76,6);ctx.fillStyle="#6de0a1";ctx.fillRect(b.x-38,b.y-59,76*b.hp/b.maxHp,6);ctx.restore();}
    for(const b of rtsState.buildings){ctx.save();ctx.fillStyle=b.team==="player"?"#4c9cbd":"#b65d52";ctx.strokeStyle="#e2e7e9";ctx.lineWidth=2;const size=b.type==="turret"?28: b.type==="storage"?38:48;if(b.type==="turret"){ctx.fillRect(b.x-14,b.y-14,28,28);ctx.beginPath();ctx.arc(b.x,b.y,b.range,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.10)";ctx.stroke();}else{ctx.fillRect(b.x-size/2,b.y-size/2,size,size);ctx.fillStyle="#dce9e9";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.fillText(({barracks:"BARRACKS",land_lab:"LAND",water_lab:"WATER",air_lab:"AIR",storage:"STORE"})[b.type]||b.type,b.x,b.y+3);}ctx.strokeRect(b.x-size/2,b.y-size/2,size,size);ctx.restore();}\n    for(const w of rtsState.workers){ctx.save();ctx.fillStyle=w.team==="player"?"#d8e7ec":"#f0b5a7";ctx.strokeStyle=w.team==="player"?"#24566c":"#6d302c";ctx.lineWidth=2;ctx.beginPath();ctx.arc(w.x,w.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#18252b";ctx.beginPath();ctx.arc(w.x,w.y-2,2,0,Math.PI*2);ctx.fill();if(w.carrying>0){ctx.fillStyle="#e5c36b";ctx.fillRect(w.x+6,w.y-8,5,5);}ctx.restore();}
    for(const o of core.DEFAULT_OBSTACLES){ctx.save();ctx.fillStyle="#18251f";ctx.strokeStyle="#78836a";ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="rgba(190,196,157,.16)";ctx.beginPath();ctx.arc(o.x-o.radius*.25,o.y-o.radius*.25,o.radius*.38,0,Math.PI*2);ctx.fill();ctx.restore();}
    for (const u of units) {
      drawCreature(u);
      if (selectedIds.has(u.id)) {
        ctx.beginPath(); ctx.arc(u.x,u.y,u.radius+6,0,Math.PI*2);
        ctx.lineWidth=2.5; ctx.strokeStyle="#fff2a8"; ctx.stroke();
      }
      ctx.fillStyle="#0c171c"; ctx.fillRect(u.x-17,u.y-u.radius-12,34,5);
      ctx.fillStyle=u.team==="player"?"#6de0a1":"#f2a08f";
      ctx.fillRect(u.x-17,u.y-u.radius-12,34*Math.max(0,u.hp/u.maxHp),5);
    }
    for(const selected of selectedUnits())if(selected.moveOrder){ctx.save();ctx.strokeStyle="rgba(255,242,168,.95)";ctx.fillStyle="rgba(255,242,168,.12)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(selected.targetX,selected.targetY,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(selected.targetX-7,selected.targetY);ctx.lineTo(selected.targetX+7,selected.targetY);ctx.moveTo(selected.targetX,selected.targetY-7);ctx.lineTo(selected.targetX,selected.targetY+7);ctx.stroke();ctx.restore();}
    worldView.end(ctx);
    worldView.drawOverlay(ctx,W,H);
    if(selectionDrag){const a=worldView.worldToScreen(selectionDrag.x1,selectionDrag.y1,W,H),b=worldView.worldToScreen(selectionDrag.x2,selectionDrag.y2,W,H);ctx.save();ctx.fillStyle="rgba(91,190,232,.16)";ctx.strokeStyle="#8dd8ff";ctx.lineWidth=1.5;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();}
  }
  function updatePanel() {
    const selected=selectedUnits(),u=selected[0];
    ui.selection.textContent=selected.length>1?"Selected: "+selected.length+" player creatures":u?"Selected: "+u.team+" unit #"+u.id:"No unit selected";
    ui.name.textContent=selected.length>1?selected.length+" creatures selected":u?(u.team==="player"?"Player ":"Opponent ")+u.body+"-"+u.head+" #"+u.id:"—";
    ui.health.textContent=selected.length>1?selected.length+" creatures ready for group commands":u?Math.ceil(u.hp)+" / "+u.maxHp+" HP · Speed "+u.speed+" · Attack "+u.attack+" · Defence "+u.defense:"Select a player creature";
    ui.healthFill.style.width=u?`${Math.max(0,u.hp/u.maxHp)*100}%`:"0%";
    const playerCount=units.reduce((n,x)=>n+(x.team==="player"),0),enemyCount=units.length-playerCount;
    ui.status.textContent="Player: "+playerCount+" · Opponent: "+enemyCount+" · "+(rtsState.result||"Enemy strategy active");
    if(ui.economy){const p=rtsState.resources.player;ui.economy.textContent="Wood "+Math.floor(p.timber)+" · Ore "+Math.floor(p.ore)+" | Storage "+Math.floor(p.timber+p.ore)+"/"+rtsState.storage.player.capacity+" | Workers "+rtsState.workers.filter(w=>w.team==="player").length+" | Bases "+Math.ceil(rtsState.bases.player.hp)+"/"+rtsState.bases.player.maxHp+" : "+Math.ceil(rtsState.bases.enemy.hp)+"/"+rtsState.bases.enemy.maxHp+" | Queue "+rtsState.queues.player.length; }
    if(ui.preview){const c=catalog.compose(ui.body.value,ui.head.value,ui.domain?.value||"land");ui.preview.textContent=c.name+" · "+c.domain+" · "+" · "+c.maxHp+" HP · "+c.speed+" speed · "+c.attack+" attack · "+c.defense+" defence";}
  }
  function point(event){return worldView.screenToWorld(event,canvas,W,H);}
  function clampPoint(x,y,r){return{x:Math.max(r,Math.min(WORLD.width-r,x)),y:Math.max(r,Math.min(WORLD.height-r,y))};}
  function pointInSelection(p,b){return p.x>=Math.min(b.x1,b.x2)&&p.x<=Math.max(b.x1,b.x2)&&p.y>=Math.min(b.y1,b.y2)&&p.y<=Math.max(b.y1,b.y2);}
  function hitPlayer(p){return [...units].reverse().find(u=>u.team==="player"&&Math.hypot(u.x-p.x,u.y-p.y)<=u.radius+9)||null;}
  function hitEnemy(p){return [...units].reverse().find(u=>u.team==="enemy"&&Math.hypot(u.x-p.x,u.y-p.y)<=u.radius+9)||null;}

  canvas.addEventListener("pointerdown",(event)=>{
    if(event.button===1 || (event.button===0&&spaceDown)){
      panPointer={id:event.pointerId,x:event.clientX,y:event.clientY,button:event.button};
      canvas.setPointerCapture(event.pointerId); event.preventDefault(); return;
    }
    if(event.button!==0)return;
    const p=point(event), hit=hitPlayer(p);
    if(!hit){selectionDrag={id:event.pointerId,x1:p.x,y1:p.y,x2:p.x,y2:p.y,additive:event.shiftKey,moved:false,startX:event.clientX,startY:event.clientY};canvas.setPointerCapture(event.pointerId);event.preventDefault();draw();return;}
    if(hit){
      if(event.shiftKey){if(selectedIds.has(hit.id))selectedIds.delete(hit.id);else selectedIds.add(hit.id);}
      else selectOnly(hit);
      suppressClick=true;
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
    if(selectionDrag&&selectionDrag.id===event.pointerId&&(event.buttons&1)){const p=point(event);selectionDrag.x2=p.x;selectionDrag.y2=p.y;selectionDrag.moved=Math.hypot(event.clientX-selectionDrag.startX,event.clientY-selectionDrag.startY)>5;draw();return;}
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
    if(dragState&&dragState.id===event.pointerId){suppressClick=suppressClick||dragState.moved;dragState=null;}
    if(selectionDrag&&selectionDrag.id===event.pointerId){const b=selectionDrag;if(b.moved){if(!b.additive)selectedIds.clear();for(const u of units)if(u.team==="player"&&pointInSelection(u,b))selectedIds.add(u.id);suppressClick=true;}selectionDrag=null;updatePanel();draw();}
  }
  canvas.addEventListener("pointerup",finishPointer);
  canvas.addEventListener("pointercancel",finishPointer);
  canvas.addEventListener("lostpointercapture",finishPointer);
  canvas.addEventListener("click",(event)=>{
    if(suppressClick){suppressClick=false;return;}
    const hit=hitPlayer(point(event));
    if(hit){if(event.shiftKey){if(selectedIds.has(hit.id))selectedIds.delete(hit.id);else selectedIds.add(hit.id);}else selectOnly(hit);}
    else if(!event.shiftKey)selectOnly(null);
    updatePanel();draw();
  });
  canvas.addEventListener("contextmenu",(event)=>{
    event.preventDefault();if(!selectedIds.size)return;
    const p=point(event),target=hitEnemy(p);
    if(target){
      const attackers=selectedUnits();
      if(core.issueAttackTarget(attackers,target,WORLD,core.DEFAULT_OBSTACLES,units)){
        ui.status.textContent="Attack order issued to "+attackers.length+" creatures";draw();
      }
      return;
    }
    issueMoveSelection(p.x,p.y);
  });
  canvas.addEventListener("wheel",(event)=>{
    event.preventDefault(); const rect=canvas.getBoundingClientRect();
    worldView.zoomAt((event.clientX-rect.left)*W/rect.width,(event.clientY-rect.top)*H/rect.height,event.deltaY,W,H);
    draw();
  },{passive:false});
  window.addEventListener("keydown",(e)=>{if(e.code==="Space"&&!e.repeat){spaceDown=true;if(e.target===document.body)e.preventDefault();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="a"&&!["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)){e.preventDefault();selectedIds=new Set(units.filter(u=>u.team==="player").map(u=>u.id));updatePanel();draw();}if(e.key==="Escape"){selectOnly(null);updatePanel();draw();}});
  window.addEventListener("keyup",(e)=>{if(e.code==="Space")spaceDown=false;});
  window.addEventListener("blur",()=>{spaceDown=false;panPointer=null;dragState=null;selectionDrag=null;});

  ui.zoomIn.addEventListener("click",()=>{worldView.zoomBy(1.2,W/2,H/2,W,H);draw();});
  ui.zoomOut.addEventListener("click",()=>{worldView.zoomBy(1/1.2,W/2,H/2,W,H);draw();});
  ui.resetView.addEventListener("click",()=>{worldView.resetCamera(W,H);draw();});
  ui.pause.addEventListener("click",()=>{paused=!paused;ui.pause.textContent=paused?"Resume":"Pause";ui.status.textContent=paused?"Simulation paused":"Simulation running";});
  ui.body.addEventListener("change",updatePanel); ui.head.addEventListener("change",updatePanel); ui.domain?.addEventListener("change",updatePanel);
  ui.gather?.addEventListener("click",()=>{const count=rts.assignWorkers(rtsState,"player");ui.status.textContent=count?"Workers dispatched to gather and deliver resources":"No available resource deposits";});
  ui.turret?.addEventListener("click",()=>{const b=rts.build(rtsState,"player","turret",rtsState.bases.player.x+125, rtsState.bases.player.y+((rtsState.buildings.length%2)?95:-95));ui.status.textContent=b?"Defensive turret constructed":"Turret unavailable: check resources, range and spacing";updatePanel();draw();});
  ui.barracks?.addEventListener("click",()=>{const b=rts.build(rtsState,"player","barracks",rtsState.bases.player.x+125,rtsState.bases.player.y+((rtsState.buildings.length%2)?-110:110));ui.status.textContent=b?"Barracks constructed":"Barracks unavailable: check resources, range and spacing";updatePanel();draw();});
  ui.train?.addEventListener("click",()=>{const domain=ui.domain?.value||"land";const ok=rts.queueCreature(rtsState,"player",ui.body.value,ui.head.value,domain);ui.status.textContent=ok?domain.toUpperCase()+" creature added to production queue":"Build the matching laboratory and check queue/resources";updatePanel();});\n  ui.workers?.addEventListener("click",()=>{const count=rts.assignWorkers(rtsState,"player");ui.status.textContent=count+" workers assigned to resource logistics";});\n  for(const [button,type,dx,dy] of [[ui.landLab,"land_lab",125,-110],[ui.waterLab,"water_lab",190,0],[ui.airLab,"air_lab",125,110],[ui.storage,"storage",215,150]])button?.addEventListener("click",()=>{const b=rts.build(rtsState,"player",type,rtsState.bases.player.x+dx,rtsState.bases.player.y+dy);ui.status.textContent=b?type.replace("_"," ")+" constructed":"Cannot construct: insufficient resources or blocked placement";updatePanel();draw();});
  ui.difficulty?.addEventListener("change",()=>{rtsState=rts.createState(ui.difficulty.value);ui.status.textContent="New match started: "+ui.difficulty.value+" difficulty";});
  ui.spawn.addEventListener("click",()=>{
    const blueprint=catalog.compose(ui.body.value,ui.head.value);
    const position=core.findSpawn(units,Math.random()*WORLD.width,Math.random()*WORLD.height,blueprint.radius,WORLD);
    if(!position){ui.status.textContent="No safe spawn location available";return;}
    const u=createUnit("player",position.x,position.y,blueprint);
    units.push(u);selectOnly(u);updatePanel();draw();
  });
  ui.save.addEventListener("click",()=>{
    try { const saved=core.snapshot({units,nextId},worldView.cameraState());saved.selectedIds=[...selectedIds];localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));ui.status.textContent="Saved in this browser"; }
    catch(error) { ui.status.textContent="Save failed: "+error.message; }
  });
  ui.load.addEventListener("click",()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      const restored=core.validateSave(saved,WORLD,catalog);
      units=restored.units;nextId=restored.nextId;
      selectedIds=new Set(Array.isArray(saved.selectedIds)?saved.selectedIds.filter(id=>units.some(u=>u.id===id&&u.team==="player")):[]);
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
  worldView.resetCamera(W,H);reset();resizeCanvasForDisplay();requestAnimationFrame(frame);
  window.CreatureGameDebug={getUnits:()=>units.map(u=>({...u,path:(u.path||[]).map(p=>({...p}))})),getSelectedIds:()=>[...selectedIds],selectAll:()=>{selectedIds=new Set(units.filter(u=>u.team==="player"&&u.hp>0).map(u=>u.id));updatePanel();draw();},issueMoveSelection,worldToScreen:(x,y)=>worldView.worldToScreen(x,y,W,H)};
})();