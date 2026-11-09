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
 const before=u.x;core.update(s,0.1,world);assert.ok(u.x<before);
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
 const crowded=Array.from({length:512},(_,i)=>({x:800+(i%16),y:450+Math.floor(i/16),radius:100}));
 assert.equal(core.findSpawn(crowded,800,450,60,world),null);
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
 const hp=s.units[1].hp;core.update(s,1/60,world);assert.ok(s.units[1].hp<hp);
});
