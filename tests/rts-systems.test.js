const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const context={window:{}};vm.runInNewContext(require("node:fs").readFileSync("prototype/src/rts-systems.js","utf8"),context);
const rts=context.window.CreatureRTS;
test("resource gathering accumulates resources and depletes nodes",()=>{
 const s=rts.createState();assert.equal(rts.assignWorkers(s,"player","timber-west"),3);
 for(let i=0;i<100;i++)rts.update(s,.1,[],{width:1600,height:900});
 assert.ok(s.resources.player.timber>260);assert.ok(s.nodes.find(n=>n.id==="timber-west").amount<180);
});;