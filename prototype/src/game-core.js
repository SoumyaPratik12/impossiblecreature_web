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
      moveOrder:false,attackCooldown:0,body:blueprint.body,head:blueprint.head,path:[],pathIndex:0,
      progressX:x,progressY:y,stuckTime:0,recoveryCount:0,recoverySide:0};
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
  function nearestWalkable(x,y,radius,world,obstacles=DEFAULT_OBSTACLES) {
    if(!pointBlocked(x,y,radius,world,obstacles))return{x,y};
    const step=40;
    for(let ring=1;ring<=8;ring++){
      let best=null;
      for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue;
        const px=clamp(Math.round(x/step)*step+dx*step+step/2,radius,world.width-radius);
        const py=clamp(Math.round(y/step)*step+dy*step+step/2,radius,world.height-radius);
        if(pointBlocked(px,py,radius,world,obstacles))continue;
        const d=Math.hypot(px-x,py-y);if(!best||d<best.d)best={x:px,y:py,d};
      }
      if(best)return{x:best.x,y:best.y};
    }
    return null;
  }
  function issueMove(unit,x,y,world,obstacles=DEFAULT_OBSTACLES) {
    const requested={x:clamp(x,unit.radius,world.width-unit.radius),y:clamp(y,unit.radius,world.height-unit.radius)};
    const destination=nearestWalkable(requested.x,requested.y,unit.radius,world,obstacles);
    if(!destination){unit.moveOrder=false;unit.path=[];return null;}
    const path=findPath(unit,destination,world,obstacles,40,unit.radius);
    if(!path.length&&distance(unit,destination)>4){unit.moveOrder=false;unit.path=[];return null;}
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
  function issueAttackTarget(units,targetId,world,obstacles=DEFAULT_OBSTACLES) {
    const target=units.find(u=>u.id===targetId&&u.hp>0);
    if(!target)return false;
    for(const unit of units){
      if(unit===target||unit.hp<=0||unit.team===target.team)continue;
      unit.attackTargetId=target.id;
      unit.moveOrder=true;
      unit.attackRepathTimer=0;
      unit.attackTargetX=NaN;unit.attackTargetY=NaN;
      unit.path=[];unit.pathIndex=0;unit.stuckTime=0;
    }
    return true;
  }
  function issueFormationMove(units,x,y,world,formation="compact",obstacles=DEFAULT_OBSTACLES) {
    const offsets=formationOffsets(units.length,formation),assigned=[];
    const center=units.reduce((p,u)=>({x:p.x+u.x/Math.max(1,units.length),y:p.y+u.y/Math.max(1,units.length)}),{x:0,y:0});
    const heading=Math.atan2(y-center.y,x-center.x),cos=Math.cos(heading),sin=Math.sin(heading);
    for(let i=0;i<units.length;i++){
      const u=units[i],o=offsets[i];
      const requested={x:clamp(x+o.x*cos-o.y*sin,u.radius,world.width-u.radius),
        y:clamp(y+o.x*sin+o.y*cos,u.radius,world.height-u.radius)};
      let slot=nearestWalkable(requested.x,requested.y,u.radius,world,obstacles);
      if(slot&&assigned.some(p=>p&&distance(p,slot)<u.radius*2+8)){
        slot=null;
        for(let ring=1;ring<=6&&!slot;ring++)for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++){
          if(Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue;
          const candidate=nearestWalkable(requested.x+dx*24,requested.y+dy*24,u.radius,world,obstacles);
          if(candidate&&!assigned.some(p=>p&&distance(p,candidate)<u.radius*2+8)){slot=candidate;break;}
        }
      }
      const order=slot?issueMove(u,slot.x,slot.y,world,obstacles):null;
      assigned.push(order?{x:order.x,y:order.y}:null);
    }
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
  function segmentClear(a,b,radius,world,obstacles) {
    const length=distance(a,b),samples=Math.max(1,Math.ceil(length/12));
    for(let i=1;i<=samples;i++){const t=i/samples,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      if(pointBlocked(x,y,radius,world,obstacles))return false;}
    return true;
  }
  function tryYieldForTraffic(unit,units,world,obstacles) {
    const dx=unit.targetX-unit.x,dy=unit.targetY-unit.y,len=Math.hypot(dx,dy);
    if(len<1)return false;
    const px=-dy/len,py=dx/len,side=(unit.yieldSide||((unit.id%2)?1:-1));
    const offset=Math.max(44,unit.radius*2+14);
    // In a true one-lane passage there may be no lateral room. The yielding
    // unit first backs up along its incoming route, then tries either shoulder.
    const candidates=[
      {x:unit.x-dx/len*offset,y:unit.y-dy/len*offset},
      {x:unit.x+px*offset*side,y:unit.y+py*offset*side},
      {x:unit.x-px*offset*side,y:unit.y-py*offset*side}
    ];
    for(const candidate of candidates){
      if(pointBlocked(candidate.x,candidate.y,unit.radius,world,obstacles))continue;
      if(units.some(other=>other!==unit&&other.hp>0&&distance(candidate,other)<unit.radius+other.radius+8))continue;
      if(!segmentClear(unit,candidate,unit.radius,world,obstacles))continue;
      const route=findPath(candidate,{x:unit.targetX,y:unit.targetY},world,obstacles,40,unit.radius);
      if(!route.length)continue;
      unit.path=[candidate,...route];unit.pathIndex=0;unit.yieldSide=-side;
      unit.yieldCount=(unit.yieldCount||0)+1;unit.yieldCooldown=2.5;unit.stuckTime=0;
      return true;
    }
    return false;
  }
  function recoverStalledUnit(unit,units,world,obstacles) {
    const target={x:unit.targetX,y:unit.targetY},dx=target.x-unit.x,dy=target.y-unit.y,len=Math.hypot(dx,dy);
    if(len<1)return false;
    const px=-dy/len,py=dx/len,side=unit.recoverySide||((unit.id%2)?1:-1);
    const offsets=[side,-side,side*2,-side*2];
    const base=Math.max(42,unit.radius*2+12);
    for(const multiplier of [1,1.5,2,2.5]){
      for(const sign of offsets){
        const candidate={x:unit.x+px*base*multiplier*sign,y:unit.y+py*base*multiplier*sign};
        if(pointBlocked(candidate.x,candidate.y,unit.radius,world,obstacles))continue;
        if(units.some(other=>other!==unit&&other.hp>0&&distance(candidate,other)<unit.radius+other.radius+10))continue;
        const route=findPath(candidate,target,world,obstacles,40,unit.radius);
        if(!route.length)continue;
        if(!segmentClear(unit,candidate,unit.radius,world,obstacles))continue;
        unit.path=[candidate,...route];unit.pathIndex=0;unit.recoverySide=-side;
        unit.recoveryCount=(unit.recoveryCount||0)+1;unit.stuckTime=0;
        return true;
      }
    }
    // A blocked side-step can be caused by the unit directly ahead. Re-route from
    // the current position; deterministic A* tie-breaking gives a stable alternate.
    const alternate=findPath(unit,target,world,obstacles,40,unit.radius);
    if(alternate.length>1){
      unit.path=alternate;unit.pathIndex=0;unit.recoveryCount=(unit.recoveryCount||0)+1;unit.stuckTime=0;
      return true;
    }
    return false;
  }
  function update(state,dt,world,obstacles=DEFAULT_OBSTACLES) {
    if(!finite(dt)||dt<0||dt>1)throw new Error("Invalid simulation delta");
    const units=state.units;
    for(const u of units) {
      if(u.hp<=0)continue;
      u.attackCooldown=Math.max(0,u.attackCooldown-dt);
      u.yieldCooldown=Math.max(0,(u.yieldCooldown||0)-dt);
      let enemy=units.find(e=>e.id===u.attackTargetId&&e.team!==u.team&&e.hp>0)||null;
      if(u.attackTargetId&&!enemy){u.attackTargetId=null;u.moveOrder=false;u.path=[];u.pathIndex=0;u.attackRepathTimer=0;}
      if(!enemy){
        for(const candidate of units){
          if(candidate.team===u.team||candidate.hp<=0)continue;
          if(distance(u,candidate)<125&&(!enemy||distance(u,candidate)<distance(u,enemy)))enemy=candidate;
        }
        if(enemy)u.attackTargetId=enemy.id;
      }
      let waypoint=null;
      if(enemy){
        const attackers=units.filter(other=>other.hp>0&&other.team===u.team&&other.attackTargetId===enemy.id).sort((a,b)=>a.id-b.id);
        const slot=Math.max(0,attackers.findIndex(other=>other.id===u.id));
        const angle=(slot/Math.max(1,attackers.length))*Math.PI*2+(u.id%7)*0.13;
        const approachRadius=u.radius+enemy.radius+9;
        const approach={x:clamp(enemy.x+Math.cos(angle)*approachRadius,u.radius,world.width-u.radius),
          y:clamp(enemy.y+Math.sin(angle)*approachRadius,u.radius,world.height-u.radius)};
        if(distance(u,enemy)<=u.radius+enemy.radius+8){
          if(u.attackCooldown<=0){enemy.hp=Math.max(0,enemy.hp-Math.max(1,u.attack-enemy.defense));u.attackCooldown=0.8;}
          u.path=[];u.pathIndex=0;
          continue;
        }
        u.moveOrder=true;
        const targetMoved=!finite(u.attackTargetX)||distance(approach,{x:u.attackTargetX,y:u.attackTargetY})>28;
        u.attackRepathTimer=Math.max(0,(u.attackRepathTimer||0)-dt);
        if(!u.path.length||targetMoved||u.attackRepathTimer<=0){
          const route=findPath(u,approach,world,obstacles,40,u.radius);
          if(route.length){u.path=route;u.pathIndex=0;}
          u.attackTargetX=approach.x;u.attackTargetY=approach.y;u.attackRepathTimer=0.55;
        }
        while(u.pathIndex<u.path.length&&distance(u,u.path[u.pathIndex])<=Math.max(6,u.speed*dt))u.pathIndex++;
        waypoint=u.path[u.pathIndex]||approach;
      } else if(u.moveOrder){
        if(!Array.isArray(u.path)||!u.path.length){const order=issueMove(u,u.targetX,u.targetY,world,obstacles);if(!order)continue;}
        while(u.pathIndex<u.path.length&&distance(u,u.path[u.pathIndex])<=Math.max(6,u.speed*dt))u.pathIndex++;
        waypoint=u.path[u.pathIndex]||{x:u.targetX,y:u.targetY};
      }
      if(!waypoint)continue;
      // Detect approaching head-on traffic before physical contact. Stable unit-ID
      // priority prevents both creatures from choosing to yield at the same time.
      if(u.moveOrder&&u.yieldCooldown<=0){
        const ux=u.targetX-u.x,uy=u.targetY-u.y,ul=Math.hypot(ux,uy)||1;
        const opposing=units.find(other=>other!==u&&other.hp>0&&other.moveOrder&&other.id<u.id&&
          distance(u,other)<u.radius+other.radius+Math.max(u.speed,other.speed)*0.9&&
          (((ux/ul)*((other.targetX-other.x)/(Math.hypot(other.targetX-other.x,other.targetY-other.y)||1)+0)+
            (uy/ul)*((other.targetY-other.y)/(Math.hypot(other.targetX-other.x,other.targetY-other.y)||1)))<-0.55));
        if(opposing&&tryYieldForTraffic(u,units,world,obstacles))continue;
      }
      const dx=waypoint.x-u.x,dy=waypoint.y-u.y,len=Math.hypot(dx,dy);
      if(len<=0.001)continue;
      const step=Math.min(len,u.speed*dt),nx=dx/len,ny=dy/len;
      let px=clamp(u.x+nx*step,u.radius,world.width-u.radius);
      let py=clamp(u.y+ny*step,u.radius,world.height-u.radius);
      // Replan if an obstacle was introduced after the order was issued.
      if(pointBlocked(px,py,u.radius,world,obstacles)){
        const replanned=findPath(u,{x:u.targetX,y:u.targetY},world,obstacles,40,u.radius);
        if(replanned.length){u.path=replanned;u.pathIndex=0;}
        const xOnly={x:px,y:u.y},yOnly={x:u.x,y:py};
        if(!pointBlocked(xOnly.x,xOnly.y,u.radius,world,obstacles)){px=xOnly.x;py=xOnly.y;}
        else if(!pointBlocked(yOnly.x,yOnly.y,u.radius,world,obstacles)){px=yOnly.x;py=yOnly.y;}
        else {px=u.x;py=u.y;}
      }
      // Reserve space in deterministic unit-ID order. A higher-ID unit yields
      // laterally when its next step would enter a lower-ID unit's clearance radius.
      const trafficBlocker=units.find(other=>other!==u&&other.hp>0&&
        distance({x:px,y:py},other)<u.radius+other.radius+7);
      if(trafficBlocker){
        if(u.id>trafficBlocker.id)tryYieldForTraffic(u,units,world,obstacles);
        px=u.x;py=u.y;
      }
      const beforeMove={x:u.x,y:u.y};
      u.x=px;u.y=py;
      if(u.moveOrder&&!u.attackTargetId){
        const moved=distance(beforeMove,u);
        const previousDistance=distance(beforeMove,{x:u.targetX,y:u.targetY});
        const currentDistance=distance(u,{x:u.targetX,y:u.targetY});
        const netProgress=previousDistance-currentDistance;
        if(netProgress>Math.max(0.4,u.speed*dt*0.12)){u.progressX=u.x;u.progressY=u.y;u.stuckTime=0;}
        else u.stuckTime=(u.stuckTime||0)+dt;
        if(u.stuckTime>=1.1){
          recoverStalledUnit(u,units,world,obstacles);
          u.stuckTime=0;u.progressX=u.x;u.progressY=u.y;
        }
      }
      if(u.moveOrder&&!u.attackTargetId&&distance(u,{x:u.targetX,y:u.targetY})<=Math.max(4,u.speed*dt)){u.x=u.targetX;u.y=u.targetY;u.moveOrder=false;u.path=[];u.pathIndex=0;u.stuckTime=0;}
    }
    // Resolve unit-to-unit crowding in bounded deterministic passes. Each pass also
    // checks terrain so separation cannot push a creature into a rock or outside the map.
    for(let pass=0;pass<4;pass++){
      let changed=false;
      for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
        const a=units[i],b=units[j];if(a.hp<=0||b.hp<=0)continue;
        let dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),minimum=a.radius+b.radius+5;
        if(len>=minimum)continue;
        if(len<0.001){const angle=((a.id*31+b.id*17)%360)*Math.PI/180;dx=Math.cos(angle);dy=Math.sin(angle);len=1;}
        const overlap=minimum-len,nx=dx/len,ny=dy/len;
        const aStep=overlap*0.5,bStep=overlap-aStep;
        const ax=clamp(a.x-nx*aStep,a.radius,world.width-a.radius),ay=clamp(a.y-ny*aStep,a.radius,world.height-a.radius);
        const bx=clamp(b.x+nx*bStep,b.radius,world.width-b.radius),by=clamp(b.y+ny*bStep,b.radius,world.height-b.radius);
        const aFree=!pointBlocked(ax,ay,a.radius,world,obstacles),bFree=!pointBlocked(bx,by,b.radius,world,obstacles);
        if(aFree){a.x=ax;a.y=ay;changed=true;}
        if(bFree){b.x=bx;b.y=by;changed=true;}
        if(!aFree&&!bFree){
          const alternatives=[[a.x-nx*overlap,a.y-ny*overlap],[a.x+ny*overlap,a.y-nx*overlap],
            [a.x-ny*overlap,a.y+nx*overlap]];
          for(const p of alternatives){const x=clamp(p[0],a.radius,world.width-a.radius),y=clamp(p[1],a.radius,world.height-a.radius);
            if(!pointBlocked(x,y,a.radius,world,obstacles)){a.x=x;a.y=y;changed=true;break;}}
        }
        // If terrain prevented the symmetric split, give the higher-ID unit a
        // deterministic lateral escape position. This is a bounded separation
        // correction, not a teleport, and must clear terrain and every third unit.
        if(distance(a,b)<minimum){
          const sideX=-ny,sideY=nx,escape=minimum+6;
          const candidates=[[b.x+sideX*escape,b.y+sideY*escape],[b.x-sideX*escape,b.y-sideY*escape]];
          for(const p of candidates){
            const x=clamp(p[0],b.radius,world.width-b.radius),y=clamp(p[1],b.radius,world.height-b.radius);
            if(pointBlocked(x,y,b.radius,world,obstacles))continue;
            if(units.some(other=>other!==a&&other!==b&&other.hp>0&&distance({x,y},other)<b.radius+other.radius+5))continue;
            if(distance(a,{x,y})>=minimum){b.x=x;b.y=y;changed=true;break;}
          }
        }
      }
      if(!changed)break;
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
      ids.add(u.id);return {...u,path:Array.isArray(u.path)?u.path.map(p=>({...p})):[],pathIndex:u.pathIndex||0,
        progressX:finite(u.progressX)?u.progressX:u.x,progressY:finite(u.progressY)?u.progressY:u.y,
        stuckTime:0,recoveryCount:Number.isInteger(u.recoveryCount)?u.recoveryCount:0,recoverySide:u.recoverySide===-1?-1:1};
    });
    if(raw.nextId<=Math.max(0,...ids))throw new Error("Invalid next unit ID");
    return {units,nextId:raw.nextId,camera:{x:raw.camera.x,y:raw.camera.y,zoom:raw.camera.zoom}};
  }
  window.CreatureGameCore={SAVE_VERSION,DEFAULT_OBSTACLES,createUnit,createInitialState,issueMove,issueAttackTarget,issueFormationMove,formationOffsets,findPath,pointBlocked,nearestWalkable,findSpawn,recoverStalledUnit,tryYieldForTraffic,update,snapshot,validateSave};
})();