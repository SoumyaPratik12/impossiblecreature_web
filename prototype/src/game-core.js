(() => {
  "use strict";
  const SAVE_VERSION = 1;
  const finite = Number.isFinite;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function createUnit(team,x,y,blueprint,id,world) {
    if (!["player","enemy"].includes(team)) throw new Error("Invalid team");
    const scale=team==="player"?1:0.85, r=blueprint.radius;
    return {id,team,x:clamp(x,r,world.width-r),y:clamp(y,r,world.height-r),radius:r,
      hp:blueprint.maxHp*scale,maxHp:blueprint.maxHp*scale,speed:blueprint.speed*scale,
      attack:blueprint.attack*scale,defense:blueprint.defense,targetX:x,targetY:y,
      moveOrder:false,attackCooldown:0,body:blueprint.body,head:blueprint.head};
  }
  function createInitialState(catalog,world) {
    let id=1;
    const make=(team,x,y)=>createUnit(team,x,y,catalog.compose("wolf","wolf"),id++,world);
    return {units:[make("player",420,430),make("player",510,560),make("player",390,720),
      make("enemy",1260,390),make("enemy",1340,600),make("enemy",1230,790)],nextId:id};
  }
  function issueMove(unit,x,y,world) {
    unit.targetX=clamp(x,unit.radius,world.width-unit.radius);
    unit.targetY=clamp(y,unit.radius,world.height-unit.radius);
    unit.moveOrder=true;
  }
  function findSpawn(units,x,y,radius,world) {
    const step=Math.max(28,radius*2+8);
    for(let ring=0;ring<=8;ring++) {
      const candidates=ring===0?[[0,0]]:[];
      if(ring>0) for(let dx=-ring;dx<=ring;dx++) for(let dy=-ring;dy<=ring;dy++)
        if(Math.max(Math.abs(dx),Math.abs(dy))===ring)candidates.push([dx,dy]);
      for(const [dx,dy] of candidates) {
        const px=clamp(x+dx*step,radius,world.width-radius),py=clamp(y+dy*step,radius,world.height-radius);
        if(units.every(u=>distance({x:px,y:py},u)>=radius+u.radius+5))return{x:px,y:py};
      }
    }
    return null;
  }
  function update(state,dt,world) {
    if(!finite(dt)||dt<0||dt>1)throw new Error("Invalid simulation delta");
    const units=state.units;
    for(const u of units) {
      if(u.hp<=0)continue;
      u.attackCooldown=Math.max(0,u.attackCooldown-dt);
      let target=null;
      if(u.moveOrder) {
        const destination={x:u.targetX,y:u.targetY};
        for(const e of units)if(e.team!==u.team&&e.hp>0&&distance(u,e)<90&&(!target||distance(u,e)<distance(u,target)))target=e;
        if(!target)target=destination;
        if(target===destination&&distance(u,destination)<=3){u.moveOrder=false;continue;}
      } else {
        for(const e of units)if(e.team!==u.team&&e.hp>0&&(!target||distance(u,e)<distance(u,target)))target=e;
        if(!target||distance(u,target)>=125)continue;
      }
      if(target&&target.team&&distance(u,target)<=u.radius+target.radius+8){
        if(u.attackCooldown<=0){target.hp=Math.max(0,target.hp-Math.max(1,u.attack-target.defense));u.attackCooldown=0.8;}
        continue;
      }
      if(target) {
        const dx=target.x-u.x,dy=target.y-u.y,len=Math.hypot(dx,dy);
        if(len>0.001){const step=Math.min(len,u.speed*dt);u.x+=dx/len*step;u.y+=dy/len*step;}
        u.x=clamp(u.x,u.radius,world.width-u.radius);u.y=clamp(u.y,u.radius,world.height-u.radius);
        if(u.moveOrder&&distance(u,target)<=3)u.moveOrder=false;
      }
    }
    // Deterministic pairwise separation prevents units occupying the same point.
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
      const a=units[i],b=units[j];if(a.hp<=0||b.hp<=0)continue;
      let dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),minimum=a.radius+b.radius+2;
      if(len>=minimum)continue;
      if(len<0.001){dx=((a.id+b.id)%2)?1:0;dy=dx?0:1;len=1;}
      const push=(minimum-len)/2, nx=dx/len,ny=dy/len;
      a.x=clamp(a.x-nx*push,a.radius,world.width-a.radius);a.y=clamp(a.y-ny*push,a.radius,world.height-a.radius);
      b.x=clamp(b.x+nx*push,b.radius,world.width-b.radius);b.y=clamp(b.y+ny*push,b.radius,world.height-b.radius);
    }
    state.units=units.filter(u=>u.hp>0);
    return state;
  }
  function snapshot(state,camera) {
    return {version:SAVE_VERSION,nextId:state.nextId,units:state.units.map(u=>({...u})),camera:{...camera}};
  }
  function validateSave(raw,world,catalog) {
    if(!raw||raw.version!==SAVE_VERSION||!Array.isArray(raw.units)||raw.units.length>512||
      !Number.isInteger(raw.nextId)||raw.nextId<1||!raw.camera||
      ![raw.camera.x,raw.camera.y,raw.camera.zoom].every(finite))throw new Error("Unsupported or invalid save");
    const ids=new Set();
    const units=raw.units.map(u=>{
      if(!u||!Number.isInteger(u.id)||u.id<1||ids.has(u.id)||!["player","enemy"].includes(u.team)||
        ![u.x,u.y,u.hp,u.maxHp,u.speed,u.attack,u.defense,u.radius,u.targetX,u.targetY,u.attackCooldown].every(finite)||
        u.radius<5||u.radius>60||u.maxHp<=0||u.hp<=0||u.hp>u.maxHp||u.speed<1||u.speed>500||
        u.attack<0||u.attack>500||u.defense<0||u.defense>500||
        u.x<u.radius||u.x>world.width-u.radius||u.y<u.radius||u.y>world.height-u.radius||
        u.targetX<u.radius||u.targetX>world.width-u.radius||u.targetY<u.radius||u.targetY>world.height-u.radius||
        !catalog.bodies[u.body]||!catalog.heads[u.head]||typeof u.moveOrder!=="boolean")
        throw new Error("Invalid unit in save");
      ids.add(u.id);return {...u};
    });
    if(raw.nextId<=Math.max(0,...ids))throw new Error("Invalid next unit ID");
    return {units,nextId:raw.nextId,camera:{x:raw.camera.x,y:raw.camera.y,zoom:raw.camera.zoom}};
  }
  window.CreatureGameCore={SAVE_VERSION,createUnit,createInitialState,issueMove,findSpawn,update,snapshot,validateSave};
})();