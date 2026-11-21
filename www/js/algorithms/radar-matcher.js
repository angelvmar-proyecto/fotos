class RadarMatcher {
  constructor(){
    this.name='Cell Detector';
    this.color='#800080';
    this.minCellWidth=18;
    this.minCellHeight=12;
    this.sideSupport=0.22;
    this.borderSupport=0.55;
    this.echoRadarLines=null;
    this.tolerance=4;
  }

  setEchoRadarLines(lines){ this.echoRadarLines=lines; }

  async detect(imageData){
    logger.info('Iniciando Cell Detector (rejilla + validación cruzada con Echo Radar)...');
    const t0=Date.now();
    lineValidator.prepare(imageData);
    const w=lineValidator.w,h=lineValidator.h,bin=lineValidator.bin;
    
    let ys=this.peaks(lineValidator.rowSum, Math.max(5, Math.round(h/90)), 0.30);
    let xs=this.peaks(lineValidator.colSum, Math.max(4, Math.round(w/160)), 0.18);
    logger.info('  Filas candidatas: '+ys.length+' Columnas candidatas: '+xs.length);
    
    ys=ys.filter(y=>this.rowSupport(bin,w,y,xs)>=0.30);
    xs=xs.filter(x=>this.colSupport(bin,w,h,x,ys)>=0.55);
    ys=this.gapFilter(ys,this.minCellHeight);
    xs=this.gapFilter(xs,this.minCellWidth);
    logger.info('  Rejilla validada: '+ys.length+' filas x '+xs.length+' columnas');

    const borders=this.detectBorders(bin,w,h,ys,xs);
    if(borders.top!==null && (ys.length===0 || borders.top<ys[0])) ys.unshift(borders.top);
    if(borders.bottom!==null && (ys.length===0 || borders.bottom>ys[ys.length-1])) ys.push(borders.bottom);
    if(borders.left!==null && (xs.length===0 || borders.left<xs[0])) xs.unshift(borders.left);
    if(borders.right!==null && (xs.length===0 || borders.right>xs[xs.length-1])) xs.push(borders.right);
    
    if(borders.top!==null||borders.bottom!==null||borders.left!==null||borders.right!==null){
      logger.info('  Bordes exteriores detectados: T='+borders.top+' B='+borders.bottom+' L='+borders.left+' R='+borders.right);
    }

    const cells=[];
    let crossValidated=0;
    for(let r=0;r<ys.length-1;r++){
      for(let c=0;c<xs.length-1;c++){
        const y1=ys[r],y2=ys[r+1],x1=xs[c],x2=xs[c+1];
        if(x2-x1<this.minCellWidth||y2-y1<this.minCellHeight)continue;

        let sides=0;
        let topEvidence=this.segH(bin,w,x1,x2,y1)>=this.sideSupport;
        let bottomEvidence=this.segH(bin,w,x1,x2,y2)>=this.sideSupport;
        let leftEvidence=this.segV(bin,w,h,y1,y2,x1)>=this.sideSupport;
        let rightEvidence=this.segV(bin,w,h,y1,y2,x2)>=this.sideSupport;

        if(topEvidence)sides++;
        if(bottomEvidence)sides++;
        if(leftEvidence)sides++;
        if(rightEvidence)sides++;

        if(sides<3 && this.echoRadarLines){
          let crossSides=0;
          if(!topEvidence && this.hasEchoLine(y1,'h',x1,x2)){topEvidence=true;crossSides++;}
          if(!bottomEvidence && this.hasEchoLine(y2,'h',x1,x2)){bottomEvidence=true;crossSides++;}
          if(!leftEvidence && this.hasEchoLine(x1,'v',y1,y2)){leftEvidence=true;crossSides++;}
          if(!rightEvidence && this.hasEchoLine(x2,'v',y1,y2)){rightEvidence=true;crossSides++;}
          sides+=crossSides;
          if(crossSides>0)crossValidated++;
        }
        if(sides>=3)cells.push({x1:x1,y1:y1,x2:x2,y2:y2,sides:sides});
      }
    }
    logger.info('  Celdas detectadas: '+cells.length+' (validadas con Echo Radar: '+crossValidated+')');
    
    const usedR=new Set(),usedC=new Set();
    cells.forEach(c=>{usedR.add(c.y1);usedR.add(c.y2);usedC.add(c.x1);usedC.add(c.x2);});
    const rows=[...usedR].sort((a,b)=>a-b), cols=[...usedC].sort((a,b)=>a-b);
    const lines=[];
    if(cols.length){const x1=cols[0],x2=cols[cols.length-1]; rows.forEach(y=>lines.push({x1:x1,y1:y,x2:x2,y2:y,angle:0,length:x2-x1}));}
    if(rows.length){const y1=rows[0],y2=rows[rows.length-1]; cols.forEach(x=>lines.push({x1:x,y1:y1,x2:x,y2:y2,angle:90,length:y2-y1}));}
    
    const time=Date.now()-t0;
    logger.info('Cell Detector completado en '+time+'ms. Celdas: '+cells.length+', Lineas: '+lines.length);
    
    this.audit(rows, cols, w, h);
    return {algorithm:this.name,color:this.color,lines:lines,cells:cells,metrics:{totalLines:lines.length,executionTime:time,cellsDetected:cells.length,rows:rows.length,cols:cols.length,borders:borders,crossValidated:crossValidated}};
  }

  audit(rows, cols, w, h) {
    const fmt = a => a.length ? a.join(', ') : 'ninguna';
    if(rows.length) {
      const gaps = rows.slice(1).map((v, i) => v - rows[i]);
      logger.info('  [AUD-Cell-H] Y primero='+rows[0]+' ultimo='+rows[rows.length-1]+' (alto='+h+')');
      logger.info('  [AUD-Cell-H] primeras Y=['+fmt(rows.slice(0,4))+'] ultimas Y=['+fmt(rows.slice(-4))+']');
      logger.info('  [AUD-Cell-H] espaciados min='+Math.min(...gaps)+' max='+Math.max(...gaps)+' primeros gaps=['+fmt(gaps.slice(0,4))+']');
    }
    if(cols.length) {
      const gaps = cols.slice(1).map((v, i) => v - cols[i]);
      logger.info('  [AUD-Cell-V] X primero='+cols[0]+' ultimo='+cols[cols.length-1]+' (ancho='+w+')');
      logger.info('  [AUD-Cell-V] primeras X=['+fmt(cols.slice(0,4))+'] ultimas X=['+fmt(cols.slice(-4))+']');
      logger.info('  [AUD-Cell-V] espaciados min='+Math.min(...gaps)+' max='+Math.max(...gaps)+' primeros gaps=['+fmt(gaps.slice(0,4))+']');
    }
  }

  hasEchoLine(pos,orientation,x1,y1){
    if(!this.echoRadarLines)return false;
    const tol=this.tolerance;
    for(const line of this.echoRadarLines){
      if(orientation==='h'){
        const lineY=(line.y1+line.y2)/2;
        if(Math.abs(lineY-pos)<=tol){
          const lineX1=Math.min(line.x1,line.x2), lineX2=Math.max(line.x1,line.x2);
          if(lineX1<=x1+tol && lineX2>=x1-tol)return true;
        }
      }else{
        const lineX=(line.x1+line.x2)/2;
        if(Math.abs(lineX-pos)<=tol){
          const lineY1=Math.min(line.y1,line.y2), lineY2=Math.max(line.y1,line.y2);
          if(lineY1<=y1+tol && lineY2>=y1-tol)return true;
        }
      }
    }
    return false;
  }

  detectBorders(bin,w,h,ys,xs){
    const borders={top:null,bottom:null,left:null,right:null};
    if(!ys.length||!xs.length)return borders;
    const xMin=xs[0],xMax=xs[xs.length-1],yMin=ys[0],yMax=ys[ys.length-1];
    const tableW=xMax-xMin, tableH=yMax-yMin;
    if(tableW<50||tableH<50)return borders;
    for(let y=yMin-1;y>=Math.max(0,yMin-Math.round(tableH*0.15));y--){ if(this.segH(bin,w,xMin,xMax,y)>=this.borderSupport){borders.top=y;break;} }
    for(let y=yMax+1;y<=Math.min(h-1,yMax+Math.round(tableH*0.15));y++){ if(this.segH(bin,w,xMin,xMax,y)>=this.borderSupport){borders.bottom=y;break;} }
    for(let x=xMin-1;x>=Math.max(0,xMin-Math.round(tableW*0.15));x--){ if(this.segV(bin,w,h,yMin,yMax,x)>=this.borderSupport){borders.left=x;break;} }
    for(let x=xMax+1;x<=Math.min(w-1,xMax+Math.round(tableW*0.15));x++){ if(this.segV(bin,w,h,yMin,yMax,x)>=this.borderSupport){borders.right=x;break;} }
    return borders;
  }

  peaks(arr,minDist,ratio){
    const mx=Math.max(...arr); if(mx<=0)return [];
    const s=[...arr].sort((a,b)=>a-b), med=s[Math.floor(arr.length/2)];
    const th=med+(mx-med)*ratio; const out=[];
    // FIX: bucle inclusivo con vecino centinela
    for(let i=0; i<arr.length; i++){
      const prev = (i > 0) ? arr[i-1] : -1;
      const next = (i < arr.length - 1) ? arr[i+1] : -1;
      if(arr[i]>th && arr[i]>=prev && arr[i]>=next){
        let close=false;
        for(let j=0;j<out.length;j++){
          if(Math.abs(out[j]-i)<minDist){ if(arr[i]>arr[out[j]])out[j]=i; close=true; break; }
        }
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
      for(let dy=-2;dy<=2;dy++){const yy=y+dy; if(yy>=0 && yy<h && bin[yy*w+x]){hit++;break;}}} // FIX: yy<h
    return tot?hit/tot:0;
  }
  
  segV(bin,w,h,y1,y2,x){
    let hit=0,tot=0;
    for(let y=y1;y<=y2;y+=2){tot++;
      for(let dx=-2;dx<=2;dx++){const xx=x+dx; if(xx>=0 && xx<w && bin[y*w+xx]){hit++;break;}}}
    return tot?hit/tot:0;
  }
  
  rowSupport(bin,w,y,xs){
    if(!xs.length)return this.segH(bin,w,0,w-1,y);
    let ok=0; xs.forEach(x=>{for(let dy=-2;dy<=2;dy++){const yy=y+dy; if(yy>=0 && yy<h && bin[yy*w+x]){ok++;break;}}}); // FIX: yy<h
    return ok/xs.length;
  }
  
  colSupport(bin,w,h,x,ys){
    if(!ys.length)return this.segV(bin,w,h,0,h-1,x);
    let ok=0; ys.forEach(y=>{for(let dx=-2;dx<=2;dx++){const xx=x+dx; if(xx>=0 && xx<w && bin[y*w+xx]){ok++;break;}}});
    return ok/ys.length;
  }
}
window.RadarMatcher=RadarMatcher;
