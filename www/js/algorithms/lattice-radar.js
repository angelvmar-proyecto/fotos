class LatticeRadar {
  constructor(){ this.name='Lattice Radar'; this.color='#FF1493'; this.crossThreshold=0.85; this.maxStd=1.2; this.minGap=12; }
  async detect(imageData){
    logger.info('Iniciando Lattice Radar (cruces + espaciado regular)...');
    const t0=Date.now();
    lineValidator.prepare(imageData);
    const w=lineValidator.w,h=lineValidator.h,bin=lineValidator.bin;
    const ys=this.peaks(lineValidator.rowSum,Math.max(5,Math.round(h/90)),0.35);
    logger.info('  Horizontales base: '+ys.length);
    if(ys.length<4)return this.empty(t0);
    const cand=this.peaks(lineValidator.colSum,Math.max(4,Math.round(w/160)),0.20);
    logger.info('  Candidatas verticales: '+cand.length);
    const bands=16, bh=Math.ceil(h/bands);
    const ok=[];
    cand.forEach(x=>{
      const cs=this.crossScore(bin,w,h,x,ys);
      if(cs<this.crossThreshold)return;
      const st=this.stability(bin,w,h,x,bands,bh);
      if(st>this.maxStd&&cs<0.95)return;
      ok.push({x:x,cs:cs,st:st});
    });
    logger.info('  Verticales validadas por cruces: '+ok.length);
    const grid=this.regularGrid(ok);
    logger.info('  Verticales tras filtro de rejilla: '+grid.length);
    const y1=Math.max(0,ys[0]-2), y2=Math.min(h-1,ys[ys.length-1]+2);
    const lines=grid.map(g=>({x1:g.x,y1:y1,x2:g.x,y2:y2,angle:90,length:y2-y1}));
    const time=Date.now()-t0;
    logger.info('Lattice Radar completado en '+time+'ms. Lineas: '+lines.length);
    return {algorithm:this.name,color:this.color,lines:lines,metrics:{totalLines:lines.length,executionTime:time,hBase:ys.length}};
  }
  empty(t0){ return {algorithm:this.name,color:this.color,lines:[],metrics:{totalLines:0,executionTime:Date.now()-t0}}; }
  peaks(arr,minDist,ratio){
    const mx=Math.max(...arr); if(mx<=0)return [];
    const sorted=[...arr].sort((a,b)=>a-b), med=sorted[Math.floor(arr.length/2)];
    const th=med+(mx-med)*ratio; const out=[];
    for(let i=1;i<arr.length-1;i++){
      if(arr[i]>th&&arr[i]>=arr[i-1]&&arr[i]>=arr[i+1]){
        let close=false;
        for(let j=0;j<out.length;j++){if(Math.abs(out[j]-i)<minDist){if(arr[i]>arr[out[j]])out[j]=i;close=true;break;}}
        if(!close)out.push(i);
      }
    }
    return out.sort((a,b)=>a-b);
  }
  crossScore(bin,w,h,x,ys){
    let hit=0;
    for(const y of ys){
      let f=false;
      for(let dy=-2;dy<=2&&!f;dy++)for(let dx=-2;dx<=2&&!f;dx++){
        const xx=x+dx,yy=y+dy;
        if(xx>=0&&xx<w&&yy>=0&&yy<h&&bin[yy*w+xx])f=true;
      }
      if(f)hit++;
    }
    return hit/ys.length;
  }
  stability(bin,w,h,x,bands,bh){
    const ps=[];
    for(let b=0;b<bands;b++){
      const y0=b*bh,y1=Math.min(h,(b+1)*bh); if(y1-y0<5)continue;
      let bx=x,bc=-1;
      for(let xx=Math.max(0,x-6);xx<=Math.min(w-1,x+6);xx++){
        let c=0; for(let y=y0;y<y1;y++)if(bin[y*w+xx])c++;
        if(c>bc){bc=c;bx=xx;}
      }
      ps.push(bx);
    }
    if(ps.length<3)return 99;
    const m=ps.reduce((a,b)=>a+b,0)/ps.length;
    return Math.sqrt(ps.reduce((s,v)=>s+(v-m)*(v-m),0)/ps.length);
  }
  regularGrid(cands){
    if(cands.length<3)return cands.map(c=>({x:c.x}));
    const xs=cands.map(c=>c.x).sort((a,b)=>a-b);
    const gaps=[]; for(let i=1;i<xs.length;i++)gaps.push(xs[i]-xs[i-1]);
    const sg=[...gaps].sort((a,b)=>a-b);
    const step=sg[Math.floor(sg.length/2)];
    if(!step||step<this.minGap)return cands.filter(c=>c.cs>=0.95).map(c=>({x:c.x}));
    const buckets=new Map();
    cands.forEach(c=>{
      const k=Math.round(c.x/step);
      if(!buckets.has(k)||buckets.get(k).cs<c.cs)buckets.set(k,c);
    });
    const kept=[...buckets.values()].sort((a,b)=>a.x-b.x);
    const out=[];
    kept.forEach(c=>{ if(!out.length||c.x-out[out.length-1].x>=this.minGap)out.push({x:c.x}); });
    return out;
  }
}
window.LatticeRadar=LatticeRadar;
