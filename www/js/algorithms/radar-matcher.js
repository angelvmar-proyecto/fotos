class RadarMatcher {
  constructor(){ this.name='Cell Detector'; this.color='#800080'; this.minCellWidth=18; this.minCellHeight=12; this.sideSupport=0.22; }
  async detect(imageData){
    logger.info('Iniciando Cell Detector (rejilla completa por proyecciones)...');
    const t0=Date.now();
    lineValidator.prepare(imageData);
    const w=lineValidator.w,h=lineValidator.h,bin=lineValidator.bin;
    let ys=this.peaks(lineValidator.rowSum,Math.max(5,Math.round(h/90)),0.30);
    let xs=this.peaks(lineValidator.colSum,Math.max(4,Math.round(w/160)),0.18);
    logger.info('  Filas candidatas: '+ys.length+' Columnas candidatas: '+xs.length);
    ys=ys.filter(y=>this.rowSupport(bin,w,y,xs)>=0.30);
    xs=xs.filter(x=>this.colSupport(bin,w,h,x,ys)>=0.55);
    ys=this.gapFilter(ys,this.minCellHeight);
    xs=this.gapFilter(xs,this.minCellWidth);
    logger.info('  Rejilla validada: '+ys.length+' filas x '+xs.length+' columnas');
    const cells=[];
    for(let r=0;r<ys.length-1;r++){
      for(let c=0;c<xs.length-1;c++){
        const y1=ys[r],y2=ys[r+1],x1=xs[c],x2=xs[c+1];
        if(x2-x1<this.minCellWidth||y2-y1<this.minCellHeight)continue;
        let sides=0;
        if(this.segH(bin,w,x1,x2,y1)>=this.sideSupport)sides++;
        if(this.segH(bin,w,x1,x2,y2)>=this.sideSupport)sides++;
        if(this.segV(bin,w,h,y1,y2,x1)>=this.sideSupport)sides++;
        if(this.segV(bin,w,h,y1,y2,x2)>=this.sideSupport)sides++;
        if(sides>=3)cells.push({x1:x1,y1:y1,x2:x2,y2:y2,sides:sides});
      }
    }
    logger.info('  Celdas detectadas: '+cells.length);
    const usedR=new Set(),usedC=new Set();
    cells.forEach(c=>{usedR.add(c.y1);usedR.add(c.y2);usedC.add(c.x1);usedC.add(c.x2);});
    const rows=[...usedR].sort((a,b)=>a-b), cols=[...usedC].sort((a,b)=>a-b);
    const lines=[];
    if(cols.length){const x1=cols[0],x2=cols[cols.length-1];
      rows.forEach(y=>lines.push({x1:x1,y1:y,x2:x2,y2:y,angle:0,length:x2-x1}));}
    if(rows.length){const y1=rows[0],y2=rows[rows.length-1];
      cols.forEach(x=>lines.push({x1:x,y1:y1,x2:x,y2:y2,angle:90,length:y2-y1}));}
    const time=Date.now()-t0;
    logger.info('Cell Detector completado en '+time+'ms. Celdas: '+cells.length+', Lineas: '+lines.length);
    return {algorithm:this.name,color:this.color,lines:lines,cells:cells,metrics:{totalLines:lines.length,executionTime:time,cellsDetected:cells.length,rows:rows.length,cols:cols.length}};
  }
  peaks(arr,minDist,ratio){
    const mx=Math.max(...arr); if(mx<=0)return [];
    const s=[...arr].sort((a,b)=>a-b), med=s[Math.floor(arr.length/2)];
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
  gapFilter(arr,minGap){
    const out=[]; arr.forEach(v=>{ if(!out.length||v-out[out.length-1]>=minGap)out.push(v); }); return out;
  }
  segH(bin,w,x1,x2,y){
    let hit=0,tot=0;
    for(let x=x1;x<=x2;x+=2){tot++;
      for(let dy=-2;dy<=2;dy++){const yy=y+dy;if(yy>=0&&bin[yy*w+x]){hit++;break;}}}
    return tot?hit/tot:0;
  }
  segV(bin,w,h,y1,y2,x){
    let hit=0,tot=0;
    for(let y=y1;y<=y2;y+=2){tot++;
      for(let dx=-2;dx<=2;dx++){const xx=x+dx;if(xx>=0&&xx<w&&bin[y*w+xx]){hit++;break;}}}
    return tot?hit/tot:0;
  }
  rowSupport(bin,w,y,xs){
    if(!xs.length)return this.segH(bin,w,0,w-1,y);
    let ok=0; xs.forEach(x=>{for(let dy=-2;dy<=2;dy++){const yy=y+dy;if(yy>=0&&bin[yy*w+x]){ok++;break;}}});
    return ok/xs.length;
  }
  colSupport(bin,w,h,x,ys){
    if(!ys.length)return this.segV(bin,w,h,0,h-1,x);
    let ok=0; ys.forEach(y=>{for(let dx=-2;dx<=2;dx++){const xx=x+dx;if(xx>=0&&xx<w&&bin[y*w+xx]){ok++;break;}}});
    return ok/ys.length;
  }
}
window.RadarMatcher=RadarMatcher;
