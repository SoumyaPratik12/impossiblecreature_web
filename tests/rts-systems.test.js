const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const context={window:{}};vm.runInNewContext(require("node:fs").readFileSync("prototype/src/rts-systems.js","utf8"),context);
const rts=context.window.CreatureRTS;
test("resource gathering accumulates resources and depletes nodes",()=>{
 const s=rts.createState(),u={id:1,team:"player",x:250,y:170,speed:50,radius:15,hp:100};
 assert.equal(rts.assignGatherer(s,"player",[u],"timber-west"),true);
 for(let i=0;i<50;i++)rts.update(s,.1,[u],{width:1600,height:900});
 assert.ok(s.resources.player.timber>260);assert.ok(s.nodes.find(n=>n.id==="timber-west").amount<180);
});
test("building placement enforces costs, range and spacing",()=>{
 const s=rts.createState();assert.equal(rts.build(s,"player","turret",900,450),null);
 const b=rts.build(s,"player","turret",260,450);assert.ok(b);assert.equal(s.resources.player.timber,160);
 assert.equal(rts.build(s,"player","turret",270,450),null);
});
test("production queues cap at five and emit completed units",()=>{
 const s=rts.createState();s.resources.player={timber:500,ore:300};assert.equal(rts.queueCreature(s,"player"),false);assert.ok(rts.build(s,"player","land_lab",260,450));for(let i=0;i<5;i++)assert.equal(rts.queueCreature(s,"player"),true);
 assert.equal(rts.queueCreature(s,"player"),false);
 for(let i=0;i<9;i++)rts.update(s,1,[],{width:1600,height:900});
 assert.equal(rts.drainSpawns(s).length,1);assert.equal(s.queues.player.length,4);
});
test("base destruction produces deterministic victory or defeat",()=>{
 const s=rts.createState();s.bases.enemy.hp=1;
 const attacker={id:1,team:"player",x:1410,y:450,hp:100,attack:8,radius:15};
 rts.update(s,1,[attacker],{width:1600,height:900});assert.equal(s.result,"victory");
 const loss=rts.createState();loss.bases.player.hp=1;
 const enemy={id:2,team:"enemy",x:190,y:450,hp:100,attack:8,radius:15};
 rts.update(loss,1,[enemy],{width:1600,height:900});assert.equal(loss.result,"defeat");
});
test("difficulty profiles change enemy economy and turret pressure",()=>{
 assert.ok(rts.DIFFICULTIES.hard.enemyGatherRate>rts.DIFFICULTIES.normal.enemyGatherRate);
 assert.ok(rts.DIFFICULTIES.easy.turretDamage<rts.DIFFICULTIES.hard.turretDamage);
});
test("human workers collect finite deposits and deliver resources to base storage",()=>{
 const s=rts.createState();assert.equal(rts.assignWorkers(s,"player"),3);
 const before=s.resources.player.timber+s.resources.player.ore;
 for(let i=0;i<240;i++)rts.update(s,.1,[],{width:1600,height:900});
 const after=s.resources.player.timber+s.resources.player.ore;
 assert.ok(after>before);assert.ok(s.workers.some(w=>w.team==="player"));
});
test("domain-specific laboratories gate matching creature production",()=>{
 const s=rts.createState();s.resources.player={timber:900,ore:900};
 assert.equal(rts.queueCreature(s,"player","bear","eagle","water"),false);
 assert.ok(rts.build(s,"player","water_lab",260,450));
 assert.equal(rts.queueCreature(s,"player","bear","eagle","water"),true);
 assert.equal(s.queues.player[0].domain,"water");
});
test("creature production preserves selected movement domain",()=>{
 const s=rts.createState();s.resources.player={timber:900,ore:900};
 assert.ok(rts.build(s,"player","air_lab",260,450));
 assert.equal(rts.queueCreature(s,"player","eagle","wolf","air"),true);
 for(let i=0;i<9;i++)rts.update(s,1,[],{width:1600,height:900});
 assert.equal(rts.drainSpawns(s)[0].domain,"air");
});