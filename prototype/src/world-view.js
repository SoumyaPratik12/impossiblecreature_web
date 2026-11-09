(() => {
  "use strict";
  const world=Object.freeze({width:1600,height:900,tileSize:80});
  const camera={x:world.width/2,y:world.height/2,zoom:0.8};
  const MIN_ZOOM=0.4,MAX_ZOOM=3;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function clampCamera(w,h){
    const halfW=w/(2*camera.zoom),halfH=h/(2*camera.zoom);
    camera.x=halfW*2>=world.width?world.width/2:clamp(camera.x,halfW,world.width-halfW);
    camera.y=halfH*2>=world.height?world.height/2:clamp(camera.y,halfH,world.height-halfH);
  }
  function begin(ctx,w,h){ctx.save();ctx.translate(w/2,h/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);}
  function end(ctx){ctx.restore();}
  function hash(x,y){let n=Math.imul(x+374761393,668265263)+Math.imul(y+1274126177,2246822519);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
  function drawTerrain(ctx){
    ctx.fillStyle="#263d2d";ctx.fillRect(0,0,world.width,world.height);
    const s=world.tileSize;
    for(let y=0;y<world.height/s;y++)for(let x=0;x<world.width/s;x++){
      const v=hash(x,y),shade=Math.floor(35+v*18);ctx.fillStyle=`rgb(${shade}, ${shade+17}, ${shade-7})`;ctx.fillRect(x*s,y*s,s+1,s+1);
      if(v>.58){ctx.fillStyle="rgba(129,153,91,.12)";ctx.beginPath();ctx.ellipse(x*s+40,y*s+40,18+v*17,10+v*9,v*3,0,Math.PI*2);ctx.fill();}
      else if(v<.12){ctx.fillStyle="rgba(17,31,25,.20)";ctx.beginPath();ctx.arc(x*s+40,y*s+40,13+v*25,0,Math.PI*2);ctx.fill();}
    }
    ctx.lineCap="round";ctx.strokeStyle="rgba(139,119,79,.34)";ctx.lineWidth=76;ctx.beginPath();ctx.moveTo(120,820);ctx.bezierCurveTo(430,700,520,360,780,470);ctx.bezierCurveTo(1080,560,1180,240,1500,180);ctx.stroke();
    ctx.strokeStyle="rgba(191,170,119,.13)";ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle="rgba(206,225,194,.075)";ctx.lineWidth=1;
    for(let x=0;x<=world.width;x+=160){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.height);ctx.stroke();}
    for(let y=0;y<=world.height;y+=160){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(world.width,y);ctx.stroke();}
    ctx.strokeStyle="rgba(210,228,205,.4)";ctx.lineWidth=5;ctx.strokeRect(2,2,world.width-4,world.height-4);
  }
  function screenToWorld(event,canvas,w,h){
    const r=canvas.getBoundingClientRect(),sx=(event.clientX-r.left)*w/r.width,sy=(event.clientY-r.top)*h/r.height;
    return{x:camera.x+(sx-w/2)/camera.zoom,y:camera.y+(sy-h/2)/camera.zoom};
  }
  function panBy(dx,dy,w,h){camera.x-=dx/camera.zoom;camera.y-=dy/camera.zoom;clampCamera(w,h);}
  function zoomAt(sx,sy,deltaY,w,h){
    const beforeX=camera.x+(sx-w/2)/camera.zoom,beforeY=camera.y+(sy-h/2)/camera.zoom;
    camera.zoom=clamp(camera.zoom*Math.exp(-deltaY*.0015),MIN_ZOOM,MAX_ZOOM);
    camera.x=beforeX-(sx-w/2)/camera.zoom;camera.y=beforeY-(sy-h/2)/camera.zoom;clampCamera(w,h);
  }
  function zoomBy(factor,sx,sy,w,h){
    const beforeX=camera.x+(sx-w/2)/camera.zoom,beforeY=camera.y+(sy-h/2)/camera.zoom;
    camera.zoom=clamp(camera.zoom*factor,MIN_ZOOM,MAX_ZOOM);
    camera.x=beforeX-(sx-w/2)/camera.zoom;camera.y=beforeY-(sy-h/2)/camera.zoom;clampCamera(w,h);
  }
  function resetCamera(w,h){camera.x=world.width/2;camera.y=world.height/2;camera.zoom=clamp(Math.min(w/world.width,h/world.height)*1.15,MIN_ZOOM,1);clampCamera(w,h);}
  function setCamera(value,w,h){if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(value.zoom))return;camera.x=value.x;camera.y=value.y;camera.zoom=clamp(value.zoom,MIN_ZOOM,MAX_ZOOM);clampCamera(w,h);}
  function cameraState(){return{x:camera.x,y:camera.y,zoom:camera.zoom};}
  function drawOverlay(ctx,w,h){ctx.save();ctx.fillStyle="rgba(7,14,17,.72)";ctx.fillRect(12,h-38,250,26);ctx.fillStyle="#d5e5d5";ctx.font="12px system-ui,sans-serif";ctx.fillText(`WORLD ${world.width} × ${world.height}   ZOOM ${Math.round(camera.zoom*100)}%`,22,h-21);ctx.restore();}
  window.CreatureWorldView={world,begin,end,drawTerrain,screenToWorld,panBy,zoomAt,zoomBy,resetCamera,setCamera,cameraState};
})();