(() => {
"use strict";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const RESOURCE_NODES=[
 {id:"timber-west",type:"timber",x:250,y:170,amount:180},
 {id:"ore-north",type:"ore",x:820,y:120,amount:160},
 {id:"timber-east",type:"timber",x:1450,y:330,amount:180},
 {id:"ore-south",type:"ore",x:980,y:790,amount:160}
];
const DIFFICULTIES={
 easy:{enemyGatherRate:.7,enemyThinkRate:1.35,enemyStartingResources:{timber:180,ore:150},turretDamage:7},
 normal:{enemyGatherRate:1,enemyThinkRate:1,enemyStartingResources:{timber:240,ore:200},turretDamage:9},
 hard:{enemyGatherRate:1.35,enemyThinkRate:.72,enemyStartingResources:{timber:320,ore:280},turretDamage:12}
};
const BUILDINGS={
 turret:{timber:100,ore:80,hp:260,range:230,damage:10,rate:.9},
 barracks:{timber:150,ore:110,hp:420},
 land_lab:{timber:190,ore:150,hp:360,domain:"land"},
 water_lab:{timber:210,ore:170,hp:340,domain:"water"},
 air_lab:{timber:230,ore:190,hp:330,domain:"air"},
 storage:{timber:90,ore:55,hp:300}
};
function createWorkers(team,base){return Array.from({length:3},(_,i)=>({id:team+"-worker-"+(i+1),team,x:base.x+(team==="player"?48:-48),y:base.y-52+i*48,role:i===0?"collector":i===1?"transporter":"engineer",state:"idle",nodeId:null,carrying:0,carryType:null,speed:64}));}
function createState(difficulty="normal"){
 const d=DIFFICULTIES[difficulty]||DIFFICULTIES.normal;
 const bases={player:{x:190,y:450,hp:900,maxHp:900},enemy:{x:1410,y:450,hp:900,maxHp:900}};
 return {difficulty,resources:{player:{timber:260,ore:220},enemy:{...d.enemyStartingResources}},
  storage:{player:{capacity:1000},enemy:{capacity:500}},workers:[...createWorkers("player",bases.player),...createWorkers("enemy",bases.enemy)],
  nodes:RESOURCE_NODES.map(n=>({...n})),bases,buildings:[],queues:{player:[],enemy:[]},
  elapsed:0,spawned:[],result:null,nextBuildingId:1,nextQueueId:1};
}
function canAfford(resources,cost){return resources.timber>=cost.timber&&resources.ore>=cost.ore;}
function spend(resources,cost){if(!canAfford(resources,cost))return false;resources.timber-=cost.timber;resources.ore-=cost.ore;return true;}
function assignWorkers(state,team,nodeId=null){
 const workers=state.workers.filter(w=>w.team===team);
 const nodes=state.nodes.filter(n=>n.amount>0&&(!nodeId||n.id===nodeId));
 if(!nodes.length)return 0;
 workers.forEach((w,i)=>{const n=nodeId?nodes[0]:nodes.slice().sort((a,b)=>Math.hypot(w.x-a.x,w.y-a.y)-Math.hypot(w.x-b.x,w.y-b.y))[i%nodes.length];w.nodeId=n.id;w.state="to-resource";});
 return workers.length;
}
function build(state,team,type,x,y){
 const spec=BUILDINGS[type],base=state.bases[team];if(!spec||!base||state.result||!canAfford(state.resources[team],spec))return null;
 const px=clamp(x,35,1565),py=clamp(y,35,865);
 if(Math.hypot(px-base.x,py-base.y)>460||state.buildings.some(b=>b.team===team&&Math.hypot(px-b.x,py-b.y)<70))return null;
 spend(state.resources[team],spec);
 const b={id:state.nextBuildingId++,team,type,x:px,y:py,hp:spec.hp,maxHp:spec.hp,range:spec.range||0,damage:spec.damage||0,rate:spec.rate||0,cooldown:0,domain:spec.domain||null,progress:0,complete:true};
 state.buildings.push(b);return b;
}
function queueCreature(state,team,body="wolf",head="wolf",domain="land",locomotion=null){
 const cost={timber:55,ore:35},queue=state.queues[team];
 const lab=state.buildings.find(b=>b.team===team&&b.type===domain+"_lab");
 if(!["land","water","air"].includes(domain)||state.result||queue.length>=5||!lab||!spend(state.resources[team],cost))return false;
 queue.push({id:state.nextQueueId++,body,head,domain,locomotion:locomotion||domain,remaining:8,cost});return true;
}
function moveWorker(w,target,dt){const dx=target.x-w.x,dy=target.y-w.y,d=Math.hypot(dx,dy);if(d<3)return true;const step=Math.min(d,w.speed*dt);w.x+=dx/d*step;w.y+=dy/d*step;return d<=step+2;}
function updateWorkers(state,dt,team,rate){
 for(const w of state.workers){
  if(w.state==="idle")continue;
  const base=state.bases[w.team],node=state.nodes.find(n=>n.id===w.nodeId);
  if(w.state==="to-resource"){
   if(!node||node.amount<=0){w.state="idle";w.nodeId=null;continue;}
   if(moveWorker(w,node,dt)){w.state="collecting";w.collectTimer=0;}
  }else if(w.state==="collecting"){
   if(!node||node.amount<=0||w.carrying>=25){w.state="to-storage";continue;}
   w.collectTimer=(w.collectTimer||0)+dt;
   if(w.collectTimer>=.5){const amount=Math.min(5,node.amount,25-w.carrying);node.amount-=amount;w.carrying+=amount;w.carryType=node.type;w.collectTimer=0;if(w.carrying>=25||node.amount<=0)w.state="to-storage";}
  }else if(w.state==="to-storage"){
   const storage=state.buildings.find(b=>b.team===w.team&&b.type==="storage")||base;
   if(moveWorker(w,storage,dt)){const res=state.resources[w.team],cap=state.storage[w.team].capacity;const room=Math.max(0,cap-res.timber-res.ore),delivered=Math.min(room,w.carrying);if(w.carryType)res[w.carryType]+=delivered;w.carrying=0;w.carryType=null;w.state=node&&node.amount>0?"to-resource":"idle";}
  }
 }
}
function update(state,dt,units,world){
 if(!Number.isFinite(dt)||dt<0||dt>1)throw new Error("Invalid RTS delta");if(state.result)return state;
 state.elapsed+=dt;const d=DIFFICULTIES[state.difficulty]||DIFFICULTIES.normal;
 state.resources.enemy.timber+=dt*1.8*d.enemyGatherRate;state.resources.enemy.ore+=dt*1.25*d.enemyGatherRate;
 updateWorkers(state,dt,"player",1);updateWorkers(state,dt,"enemy",d.enemyGatherRate);
 for(const u of units){if(u.hp<=0)continue;const targetBase=state.bases[u.team==="player"?"enemy":"player"];
  if(u.team==="enemy"&&!u.attackTargetId&&!u.moveOrder){u.targetX=targetBase.x;u.targetY=targetBase.y;u.moveOrder=true;u.path=[];u.pathIndex=0;}
  if(Math.hypot(u.x-targetBase.x,u.y-targetBase.y)<u.radius+42){u.baseAttackCooldown=Math.max(0,(u.baseAttackCooldown||0)-dt);if(u.baseAttackCooldown<=0){targetBase.hp=Math.max(0,targetBase.hp-Math.max(2,u.attack));u.baseAttackCooldown=1;}}
 }
 for(const b of state.buildings){if(b.type!=="turret")continue;b.cooldown=Math.max(0,b.cooldown-dt);if(b.cooldown>0)continue;
  const target=units.filter(u=>u.team!==b.team&&u.hp>0&&Math.hypot(u.x-b.x,u.y-b.y)<=b.range).sort((a,c)=>a.hp-c.hp||a.id-c.id)[0];
  if(target){target.hp=Math.max(0,target.hp-(b.team==="enemy"?d.turretDamage:b.damage));b.cooldown=b.rate;}
 }
 for(const team of ["player","enemy"]){const q=state.queues[team];if(q.length){q[0].remaining-=dt;if(q[0].remaining<=0){state.spawned.push({...q.shift(),team});}}}
 state.buildings=state.buildings.filter(b=>b.hp>0);
 if(state.bases.player.hp<=0)state.result="defeat";else if(state.bases.enemy.hp<=0)state.result="victory";
 return state;
}
function drainSpawns(state){return state.spawned.splice(0);}
window.CreatureRTS={DIFFICULTIES,RESOURCE_NODES,BUILDINGS,createState,canAfford,assignWorkers,build,queueCreature,update,drainSpawns};
})();