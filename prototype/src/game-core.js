(() => {
  "use strict";
  const SAVE_VERSION = 1;
  const finite = Number.isFinite;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const DEFAULT_OBSTACLES = [
    {x:690,y:245,radius:38},{x:760,y:265,radius:30},{x:1110,y:430,radius:44},
    {x:1080,y:500,radius:30},{x:350,y:260,radius:34},{x:280,y:690,radius:42},
    {x:900,y:740,radius:36},{x:1420,y:650,radius:46}
  ];
  function createUnit(team,x,y,blueprint,id,world) {
    if (!["player","enemy"].includes(team)) throw new Error("Invalid team");
    const scale=team==="player"?1:0.85, r=blueprint.radius;
    return {id,team,x:clamp(x,r,world.width-r),y:clamp(y,r,world.height-r),radius:r,
      hp:blueprint.maxHp*scale,maxHp:blueprint.maxHp*scale,speed:blueprint.speed*scale,
      attack:blueprint.attack*scale,defense:blueprint.defense,targetX:x,targetY:y,
      moveOrder:false,attackCooldown:0,body:blueprint.body,head:blueprint.head,path:[],pathIndex:0};
  }
  function createInitialState(catalog,world) {
    let id=1;
    const make=(team,x,y)=>createUnit(team,x,y,catalog.compose("wolf","wolf"),id++,world);
    return {units:[make("player",420,430),make("player",510,560),make("player",390,720),
      make("enemy",1260,390),make("enemy",1340,600),make("enemy",1230,790)],nextId:id};
  }
  function pointBlocked(x,y,radius,world,obstacles=DEFAULT_OBSTACLES) {
    if(x<radius||y<radius||x>world.width-radius||y>world.height-radius)return true;
    return obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<radius+o.radius+3);
  }
  function findPath(start,end,world,obstacles=DEFAULT_OBSTACLES,cellSize=40,radius=16) {
    const cols=Math.ceil(world.width/cellSize),rows=Math.ceil(world.height/cellSize);
    const cell=(x,y)=>({x:clamp(Math.round(x/cellSize),0,cols-1),y:clamp(Math.round(y/cellSize),0,rows-1)});
    const key=(x,y)=>x+","+y, center=(x,y)=>({x:Math.min(world.width-radius,x*cellSize+cellSize/2),y:Math.min(world.height-radius,y*cellSize+cellSize/2)});
    let s=cell(start.x,start.y),g=cell(end.x,end.y);
    const blocked=(x,y)=>{const p=center(x,y);return pointBlocked(p.x,p.y,radius,world,obstacles);};
    if(blocked(g.x,g.y)){
      let best=null;
      for(let ring=1;ring<=5&&!best;ring++)for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++){
        const x=g.x+dx,y=g.y+dy;if(x<0||y<0||x>=cols||y>=rows||blocked(x,y))continue;
        if(!best||Math.hypot(x-g.x,y-g.y)<best.d)best={x,y,d:Math.hypot(x-g.x,y-g.y)};
      }
      if(!best)return[];g={x:best.x,y:best.y};
    }
    const open=[{x:s.x,y:s.y,g:0,f:Math.abs(g.x-s.x)+Math.abs(g.y-s.y)}],came=new Map(),scores=new Map([[key(s.x,s.y),0]]),closed=new Set();
    const dirs=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
    while(open.length){
      open.sort((a,b)=>a.f-b.f||a.g-b.g||a.y-b.y||a.x-b.x);
      const cur=open.shift(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;
      if(cur.x===g.x&&cur.y===g.y){
        const route=[];let k=ck;
        while(k!==key(s.x,s.y)){const [x,y]=k.split(",").map(Number);route.push(center(x,y));k=came.get(k);if(!k)break;}
        route.reverse();route.push({x:clamp(end.x,radius,world.width-radius),y:clamp(end.y,radius,world.height-radius)});
        return route;
      }
      closed.add(ck);
      for(const [dx,dy] of dirs){const x=cur.x+dx,y=cur.y+dy;if(x<0||y<0||x>=cols||y>=rows||closed.has(key(x,y))||blocked(x,y))continue;
        if(dx&&dy&&(blocked(cur.x+dx,cur.y)||blocked(cur.x,cur.y+dy)))continue;
        const nk=key(x,y),ng=cur.g+(dx&&dy?Math.SQRT2:1);if(ng>=(scores.get(nk)??Infinity))continue;
        scores.set(nk,ng);came.set(nk,ck);open.push({x,y,g:ng,f:ng+Math.hypot(g.x-x,g.y-y)});
      }
    }
    return [];
  }
  function issueMove(unit,x,y,world,obstacles=DEFAULT_OBSTACLES) {
    const destination={x:clamp(x,unit.radius,world.width-unit.radius),y:clamp(y,unit.radius,world.height-unit.radius)};
    const path=findPath(unit,destination,world,obstacles,40,unit.radius);
    unit.targetX=destination.x;unit.targetY=destination.y;unit.moveOrder=true;
    unit.path=path.length?path:[destination];unit.pathIndex=0;
    return {x:destination.x,y:destination.y,path:unit.path};
  }
  function formationOffsets(count,formation="compact",spacing=58) {
    const offsets=[];
    if(formation==="line"){for(let i=0;i<count;i++)offsets.push({x:(i-(count-1)/2)*spacing,y:0});}
    else if(formation==="column"){for(let i=0;i<count;i++)offsets.push({x:0,y:(i-(count-1)/2)*spacing});}
    else {const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);for(let i=0;i<count;i++)offsets.push({x:(i%cols-(Math.min(cols,count)-1)/2)*spacing,y:(Math.floor(i/cols)-(rows-1)/2)*spacing});}
    return offsets;
  }
  function issueFormationMove(units,x,y,world,formation="compact",obstacles=DEFAULT_OBSTACLES) {
    const offsets=formationOffsets(units.length,formation),assigned=[];
    units.forEach((u,i)=>{
      let p={x:x+offsets[i].x,y:y+offsets[i].y};
      p.x=clamp(p.x,u.radius,world.width-u.radius);p.y=clamp(p.y,u.radius,world.height-u.radius);
      if(pointBlocked(p.x,p.y,u.radius,world,obstacles)){
        const found=findPath({x,y},p,world,obstacles,40,u.radius);
        if(found.length)p=found[0];
      }
      issueMove(u,p.x,p.y,world,obstacles);assigned.push({x:u.targetX,y:u.targetY});
    });
    return assigned;
  }
  function findSpawn(units,x,y,radius,world) {
    const step=Math.max(28,radius*2+8);
    for(let ring=0;ring<=8;ring++) {
      const candidates=ring===0?[[0,0]]:[];
      if(ring>0) for(let dx=-ring;dx<=ring;dx++) for(let dy=-ring;dy<=ring;dy++)
        if(Math.max(Math.abs(dx),Math.abs(dy))===ring)candidates.push([dx,dy]);
      for(const [dx,dy] of candidates) {
        const px=clamp(x+dx*step,radius,world.width-radius),py=clamp(y+dy*step,radius,world.height-radius);
        if(!pointBlocked(px,py,radius,world)&&units.every(u=>distance({x:px,y:py},u)>=radius+u.radius+5))return{x:px,y:py};
      }
    }
    return null;
  }
  function update(state,dt,world,obstacles=DEFAULT_OBSTACLES) {
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
        if(target===destination&&distance(u,destination)<=3){u.moveOrder=false;u.path=[];continue;}
      } else {
        for(const e of units)if(e.team!==u.team&&e.hp>0&&(!target||distance(u,e)<distance(u,target)))target=e;
        if(!target||distance(u,target)>=125)continue;
      }
      if(target&&target.team&&distance(u,target)<=u.radius+target.radius+8){
        if(u.attackCooldown<=0){target.hp=Math.max(0,target.hp-Math.max(1,u.attack-target.defense));u.attackCooldown=0.8;}
        continue;
      }
      let waypoint=target;
      if(target&&!target.team&&u.moveOrder&&u.path?.length){
        while(u.pathIndex<u.path.length&&distance(u,u.path[u.pathIndex])<=Math.max(5,u.speed*dt))u.pathIndex++;
        waypoint=u.path[u.pathIndex]||target;
      }
      if(waypoint){
        const dx=waypoint.x-u.x,dy=waypoint.y-u.y,len=Math.hypot(dx,dy);
        if(len>0.001){const step=Math.min(len,u.speed*dt);u.x+=dx/len*step;u.y+=dy/len*step;}
        u.x=clamp(u.x,u.radius,world.width-u.radius);u.y=clamp(u.y,u.radius,world.height-u.radius);
        if(u.moveOrder&&distance(u,{x:u.targetX,y:u.targetY})<=3){u.moveOrder=false;u.path=[];}
      }
    }
    // Deterministic pairwise separation prevents overlap and reduces formation congestion.
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
      const a=units[i],b=units[j];if(a.hp<=0||b.hp<=0)continue;
      let dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),minimum=a.radius+b.radius+4;
      if(len>=minimum)continue;
      if(len<0.001){dx=((a.id+b.id)%2)?1:0;dy=dx?0:1;len=1;}
      const push=(minimum-len)/2,nx=dx/len,ny=dy/len;
      a.x=clamp(a.x-nx*push,a.radius,world.width-a.radius);a.y=clamp(a.y-ny*push,a.radius,world.height-a.radius);
      b.x=clamp(b.x+nx*push,b.radius,world.width-b.radius);b.y=clamp(b.y+ny*push,b.radius,world.height-b.radius);
    }
    state.units=units.filter(u=>u.hp>0);return state;
  }
  function snapshot(state,camera) {
    return {version:SAVE_VERSION,nextId:state.nextId,units:state.units.map(u=>({...u,path:(u.path||[]).map(p=>({...p}))})),camera:{...camera}};
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
        !catalog.bodies[u.body]||!catalog.heads[u.head]||typeof u.moveOrder!=="boolean"||
        (u.path!==undefined&&(!Array.isArray(u.path)||u.path.length>256||u.path.some(p=>!p||!finite(p.x)||!finite(p.y)||p.x<0||p.x>world.width||p.y<0||p.y>world.height)))||
        (u.pathIndex!==undefined&&(!Number.isInteger(u.pathIndex)||u.pathIndex<0||u.pathIndex>256)))
        throw new Error("Invalid unit in save");
      ids.add(u.id);return {...u,path:Array.isArray(u.path)?u.path.map(p=>({...p})):[],pathIndex:u.pathIndex||0};
    });
    if(raw.nextId<=Math.max(0,...ids))throw new Error("Invalid next unit ID");
    return {units,nextId:raw.nextId,camera:{x:raw.camera.x,y:raw.camera.y,zoom:raw.camera.zoom}};
  }
  window.CreatureGameCore={SAVE_VERSION,DEFAULT_OBSTACLES,createUnit,createInitialState,issueMove,issueFormationMove,formationOffsets,findPath,pointBlocked,findSpawn,update,snapshot,validateSave};
})();