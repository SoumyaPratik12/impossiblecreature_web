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
function createState(difficulty="normal"){
 const d=DIFFICULTIES[difficulty]||DIFFICULTIES.normal;
 return {difficulty,resources:{player:{timber:260,ore:220},enemy:{...d.enemyStartingResources}},
  nodes:RESOURCE_NODES.map(n=>({...n})),
  bases:{player:{x:190,y:450,hp:900,maxHp:900},enemy:{x:1410,y:450,hp:900,maxHp:900}},
  buildings:[],queues:{player:[],enemy:[]},elapsed:0,enemyThink:0,spawned:[],result:null,nextBuildingId:1};
}
function canAfford(resources,cost){return resources.timber>=cost.timber&&resources.ore>=cost.ore;}
function spend(resources,cost){if(!canAfford(resources,cost))return false;resources.timber-=cost.timber;resources.ore-=cost.ore;return true;}
function assignGatherer(state,team,units,nodeId){
 const node=state.nodes.find(n=>n.id===nodeId&&n.amount>0);if(!node)return false;
 const unit=units.find(u=>u.team===team&&u.hp>0&&u.id);
 if(!unit)return false;unit.gatherNodeId=node.id;unit.moveOrder=false;unit.path=[];unit.attackTargetId=null;return true;
}
function build(state,team,type,x,y){
 const specs={turret:{timber:100,ore:80,hp:260,range:230,damage:10,rate:.9},barracks:{timber:150,ore:110,hp:420,range:0,damage:0,rate:0}};
 const spec=specs[type],base=state.bases[team];if(!spec||!base||state.result||!canAfford(state.resources[team],spec))return null;
 const px=clamp(x,35,1575),py=clamp(y,35,865);
 if(Math.hypot(px-base.x,py-base.y)>460)return null;
 if(state.buildings.some(b=>b.team===team&&Math.hypot(px-b.x,py-b.y)<70))return null;
 spend(state.resources[team],spec);
 const building={id:state.nextBuildingId++,team,type,x:px,y:py,hp:spec.hp,maxHp:spec.hp,range:spec.range,damage:spec.damage,rate:spec.rate,cooldown:0};
 state.buildings.push(building);return building;
}
function queueCreature(state,team,body="wolf",head="wolf"){
 const cost={timber:55,ore:35},queue=state.queues[team];
 if(state.result||queue.length>=5||!spend(state.resources[team],cost))return false;
 queue.push({body,head,remaining:8,cost});return true;
}
function update(state,dt,units,world){
 if(!Number.isFinite(dt)||dt<0||dt>1)throw new Error("Invalid RTS delta");
 if(state.result)return state;
 state.elapsed+=dt;const d=DIFFICULTIES[state.difficulty]||DIFFICULTIES.normal;
 state.resources.enemy.timber+=dt*1.8*d.enemyGatherRate;state.resources.enemy.ore+=dt*1.25*d.enemyGatherRate;
 for(const u of units){if(u.hp<=0)continue;const enemyBase=state.bases[u.team==="player"?"enemy":"player"];
  if(u.team==="enemy"&&!u.attackTargetId&&!u.moveOrder){u.targetX=enemyBase.x;u.targetY=enemyBase.y;u.moveOrder=true;u.path=[];u.pathIndex=0;}
  const targetBase=state.bases[u.team==="player"?"enemy":"player"];
  if(Math.hypot(u.x-targetBase.x,u.y-targetBase.y)<u.radius+42){u.baseAttackCooldown=Math.max(0,(u.baseAttackCooldown||0)-dt);if(u.baseAttackCooldown<=0){targetBase.hp=Math.max(0,targetBase.hp-Math.max(2,u.attack));u.baseAttackCooldown=1;}}
 }
 for(const u of units){
  if(u.hp<=0||!u.gatherNodeId)continue;
  const node=state.nodes.find(n=>n.id===u.gatherNodeId);
  if(!node||node.amount<=0){u.gatherNodeId=null;continue;}
  const dist=Math.hypot(u.x-node.x,u.y-node.y);
  if(dist>34){const dx=node.x-u.x,dy=node.y-u.y,len=Math.hypot(dx,dy)||1;u.x=clamp(u.x+dx/len*u.speed*dt,u.radius,world.width-u.radius);u.y=clamp(u.y+dy/len*u.speed*dt,u.radius,world.height-u.radius);}
  else {const amount=Math.min(node.amount,dt*4*(u.team==="enemy"?d.enemyGatherRate:1));node.amount-=amount;state.resources[u.team][node.type]+=amount;}
 }
 for(const team of ["player","enemy"]){
  const q=state.queues[team];if(q.length){q[0].remaining-=dt;if(q[0].remaining<=0){state.spawned.push({team,body:q[0].body,head:q[0].head});q.shift();}}
 }
 for(const b of state.buildings){
  if(b.type!=="turret")continue;b.cooldown=Math.max(0,b.cooldown-dt);if(b.cooldown>0)continue;
  const target=units.filter(u=>u.team!==(b.team)&&u.hp>0&&Math.hypot(u.x-b.x,u.y-b.y)<=b.range).sort((a,c)=>a.hp-c.hp||a.id-c.id)[0];
  if(target){target.hp=Math.max(0,target.hp-(b.team==="enemy"?d.turretDamage:b.damage));b.cooldown=b.rate;}
 }
 state.buildings=state.buildings.filter(b=>b.hp>0);
 if(state.bases.player.hp<=0)state.result="defeat";else if(state.bases.enemy.hp<=0)state.result="victory";
 return state;
}
function drainSpawns(state){const result=state.spawned.splice(0);return result;}
window.CreatureRTS={DIFFICULTIES,RESOURCE_NODES,createState,canAfford,assignGatherer,build,queueCreature,update,drainSpawns};
})();