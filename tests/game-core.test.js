const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const context={window:{}};
vm.runInNewContext(fs.readFileSync("prototype/src/creature-catalog.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("prototype/src/game-core.js","utf8"),context);
const catalog=context.window.CreatureCatalog,core=context.window.CreatureGameCore;
const world={width:1600,height:900};
test("initial state has unique IDs, both teams and bounded units",()=>{
 const s=core.createInitialState(catalog,world);
 assert.equal(s.units.length,6);assert.equal(new Set(s.units.map(u=>u.id)).size,6);
 assert.ok(s.units.some(u=>u.team==="player"));assert.ok(s.units.some(u=>u.team==="enemy"));
 for(const u of s.units){assert.ok(u.x>=u.radius&&u.x<=world.width-u.radius);assert.ok(u.y>=u.radius&&u.y<=world.height-u.radius);}
});
test("move order clamps destination and advances toward it",()=>{
 const s=core.createInitialState(catalog,world),u=s.units[0];
 core.issueMove(u,-100,9999,world);
 assert.equal(u.targetX,u.radius);assert.equal(u.targetY,world.height-u.radius);
 const before=Math.hypot(u.x-u.targetX,u.y-u.targetY);core.update(s,0.1,world);assert.ok(Math.hypot(u.x-u.targetX,u.y-u.targetY)<before);
});
test("simulation keeps units inside world and separates overlapping units",()=>{
 const s=core.createInitialState(catalog,world),a=s.units[0],b=s.units[1];
 b.x=a.x;b.y=a.y;core.update(s,1/60,world);
 assert.ok(a.x>=a.radius&&a.x<=world.width-a.radius);
 assert.ok(b.x>=b.radius&&b.x<=world.width-b.radius);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>0);
});
test("spawn search finds a non-overlapping position or returns null",()=>{
 const s=core.createInitialState(catalog,world),r=16;
 const p=core.findSpawn(s.units,800,450,r,world);assert.ok(p);
 assert.ok(s.units.every(u=>Math.hypot(p.x-u.x,p.y-u.y)>=r+u.radius+5));
});
test("snapshot round-trips and rejects malformed state",()=>{
 const s=core.createInitialState(catalog,world),camera={x:800,y:450,zoom:0.8};
 const raw=core.snapshot(s,camera),restored=core.validateSave(raw,world,catalog);
 assert.equal(restored.units.length,s.units.length);assert.equal(restored.nextId,s.nextId);
 assert.throws(()=>core.validateSave({...raw,version:99},world,catalog));
 assert.throws(()=>core.validateSave({...raw,units:[{...raw.units[0],hp:99999}]},world,catalog));
 assert.throws(()=>core.validateSave({...raw,units:[raw.units[0],raw.units[0]]},world,catalog));
});
test("combat reduces health and removes defeated units",()=>{
 const s={nextId:3,units:[
  {...core.createUnit("player",400,400,catalog.compose("bear","bear"),1,world),x:400,y:400,attackCooldown:0},
  {...core.createUnit("enemy",420,400,catalog.compose("wolf","wolf"),2,world),x:420,y:400,attackCooldown:0}
 ]};
 for(let i=0;i<300;i++)core.update(s,1/60,world);assert.equal(s.units.length,1);
});

test("all body and head combinations produce bounded positive stats",()=>{
 for(const body of Object.keys(catalog.bodies))for(const head of Object.keys(catalog.heads)){
  const c=catalog.compose(body,head);
  assert.equal(c.body,body);assert.equal(c.head,head);
  assert.ok(c.maxHp>=50&&c.speed>=35&&c.attack>=4&&c.defense>=0&&c.radius>0);
 }
});
test("camera zoom keeps the pointer anchor stable away from world edges",()=>{
 const viewContext={window:{}};
 vm.runInNewContext(fs.readFileSync("prototype/src/world-view.js","utf8"),viewContext);
 const view=viewContext.window.CreatureWorldView;view.resetCamera(960,560);
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:960,height:560})};
 const event={clientX:300,clientY:210};
 const before=view.screenToWorld(event,canvas,960,560);
 view.zoomAt(300,210,-120,960,560);
 const after=view.screenToWorld(event,canvas,960,560);
 assert.ok(Math.abs(before.x-after.x)<1e-8);assert.ok(Math.abs(before.y-after.y)<1e-8);
});
test("camera panning changes the camera without leaving world bounds",()=>{
 const viewContext={window:{}};
 vm.runInNewContext(fs.readFileSync("prototype/src/world-view.js","utf8"),viewContext);
 const view=viewContext.window.CreatureWorldView;view.resetCamera(960,560);
 const before=view.cameraState();view.panBy(40,25,960,560);const after=view.cameraState();
 assert.ok(after.x<before.x&&after.y<before.y);
 assert.ok(after.x>=0&&after.x<=1600&&after.y>=0&&after.y<=900);
});


test("attack-move engages nearby enemies without discarding the destination",()=>{
 const s={nextId:3,units:[
  {...core.createUnit("player",400,400,catalog.compose("bear","bear"),1,world),x:400,y:400},
  {...core.createUnit("enemy",455,400,catalog.compose("wolf","wolf"),2,world),x:455,y:400}
 ]};
 const u=s.units[0],enemy=s.units[1],destination={x:800,y:400};
 core.issueMove(u,destination.x,destination.y,world);
 const before=enemy.hp;for(let i=0;i<120;i++)core.update(s,1/60,world);
 assert.ok(enemy.hp<before,"moving unit should attack an enemy in engagement range");
 assert.equal(u.moveOrder,true,"attack-move should retain its destination");
 assert.equal(u.targetX,destination.x);
});
test("simulation rejects invalid time steps",()=>{
 const s=core.createInitialState(catalog,world);
 assert.throws(()=>core.update(s,-0.1,world));
 assert.throws(()=>core.update(s,1.1,world));
});
test("group movement destinations can be assigned without stacking units",()=>{
 const s=core.createInitialState(catalog,world),group=s.units.filter(u=>u.team==="player");
 const cols=Math.ceil(Math.sqrt(group.length)),spacing=54,rows=Math.ceil(group.length/cols),x=900,y=450;
 group.forEach((u,i)=>core.issueMove(u,x-((Math.min(cols,group.length)-1)*spacing)/2+(i%cols)*spacing,y-((rows-1)*spacing)/2+Math.floor(i/cols)*spacing,world));
 assert.equal(new Set(group.map(u=>u.targetX+":"+u.targetY)).size,group.length);
});


test("A* routes around blocking obstacles and keeps waypoints in world bounds",()=>{
 const obstacle={x:800,y:450,radius:65};
 const route=core.findPath({x:600,y:450},{x:1000,y:450},world,[obstacle],40,16);
 assert.ok(route.length>2,"route should detour around the obstacle");
 assert.ok(route.every(p=>p.x>=16&&p.x<=world.width-16&&p.y>=16&&p.y<=world.height-16));
 assert.ok(route.some(p=>Math.abs(p.y-450)>65),"route should leave the blocked direct line");
});
test("formation layouts produce distinct non-overlapping destination slots",()=>{
 for(const formation of ["line","column","compact"]){
  const slots=core.formationOffsets(8,formation,58);
  assert.equal(slots.length,8);
  assert.equal(new Set(slots.map(p=>p.x+":"+p.y)).size,8);
 }
 const line=core.formationOffsets(4,"line"),column=core.formationOffsets(4,"column");
 assert.ok(line.every(p=>p.y===0)&&column.every(p=>p.x===0));
});
test("formation move assigns bounded, distinct destinations and computes paths",()=>{
 const s=core.createInitialState(catalog,world),group=s.units.filter(u=>u.team==="player");
 const slots=core.issueFormationMove(group,900,450,world,"line");
 assert.equal(slots.length,group.length);
 assert.equal(new Set(group.map(u=>u.targetX+":"+u.targetY)).size,group.length);
 assert.ok(group.every(u=>u.moveOrder&&Array.isArray(u.path)&&u.path.length>0));
 assert.ok(group.every(u=>u.targetX>=u.radius&&u.targetX<=world.width-u.radius));
});
test("movement follows computed waypoints around an obstacle",()=>{
 const obstacle={x:800,y:450,radius:70};
 const s={units:[{...core.createUnit("player",600,450,catalog.compose("wolf","wolf"),1,world),x:600,y:450}],nextId:2};
 const u=s.units[0];core.issueMove(u,1000,450,world,[obstacle]);
 assert.ok(u.path.length>2);
 for(let i=0;i<600;i++)core.update(s,1/60,world,[obstacle]);
 assert.ok(Math.hypot(u.x-1000,u.y-450)<8,"unit should reach its destination");
});


test("blocked move destinations are relocated to the nearest walkable point",()=>{
 const obstacle={x:800,y:450,radius:60};
 const unit={...core.createUnit("player",600,450,catalog.compose("wolf","wolf"),1,world),x:600,y:450};
 const order=core.issueMove(unit,800,450,world,[obstacle]);
 assert.ok(order);
 assert.ok(Math.hypot(unit.targetX-obstacle.x,unit.targetY-obstacle.y)>=obstacle.radius+unit.radius+3);
});
