class AdaptiveDiagnosis {
  constructor(){ this.history=[]; this.complements=['Lattice Radar']; }
  axisOf(l){ return Math.abs(l.x2-l.x1)>=Math.abs(l.y2-l.y1)?'h':'v'; }
  posOf(l,a){ return a==='h'?(l.y1+l.y2)/2:(l.x1+l.x2)/2; }
  dedupe(lines){
    const out=[];
    const groups={h:[],v:[]};
    lines.forEach(l=>{const a=this.axisOf(l);groups[a].push({l:a==='h'?0:90,x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,pos:this.posOf(l,a)});});
    let dups=0;
    ['h','v'].forEach(a=>{
      const arr=groups[a].sort((p,q)=>p.pos-q.pos);
      arr.forEach(c=>{
        const prev=out.filter(o=>o.l===c.l).slice(-1)[0];
        if(prev&&Math.abs(prev.pos-c.pos)<4){dups++;return;}
        out.push(c);
      });
    });
    return {lines:out,dups:dups};
  }
  offsetOf(c,W,H){
    try{
      const arr=c.l==='h'?lineValidator.rowSum:lineValidator.colSum;
      if(!arr)return 0;
      const p=Math.round(c.pos); let best=p,bv=-1;
      for(let k=-8;k<=8;k++){const j=p+k;if(j>=0&&j<arr.length&&arr[j]>bv){bv=arr[j];best=j;}}
      return Math.abs(best-p);
    }catch(e){return 0;}
  }
  evidenceOf(c){
    try{
      if(!lineValidator.bin)return 1;
      const m=lineValidator.measureLine(c);
      return Math.max(0,Math.min(1,m.coverage));
    }catch(e){return 1;}
  }
  analyze(results,imageData){
    const W=imageData.width,H=imageData.height;
    try{lineValidator.prepare(imageData);}catch(e){}
    const pre=results.map(r=>{const d=this.dedupe(r.lines||[]);return {r:r,lines:d.lines,dups:d.dups};});
    const counts=pre.map(p=>p.lines.length).filter(n=>n>0).sort((a,b)=>a-b);
    const ref=counts.length?counts[Math.min(counts.length-1,Math.floor(counts.length*0.75))]:0;
    logger.info('=== DIAGNOSTICO DE CALIDAD VISUAL (sin velocidad) ===');
    logger.info('  Referencia de completitud: '+ref+' lineas');
    const ranking=pre.map(p=>{
      const L=p.lines, n=L.length;
      const hs=L.filter(c=>Math.abs(c.angle||0)<45||Math.abs(c.angle||0)>135), vs=L.filter(c=>Math.abs((c.angle||0)-90)<=45);
      let evid=0,ghosts=0,offs=0,supported=0;
      L.forEach(c=>{
        c.ev=this.evidenceOf(c); c.off=this.offsetOf(c,W,H);
        evid+=c.ev; offs+=c.off;
        let cross=0;
        if(Math.abs(c.angle||0)<45||Math.abs(c.angle||0)>135){
          vs.forEach(v=>{const x=(v.x1+v.x2)/2,y1=Math.min(v.y1,v.y2)-3,y2=Math.max(v.y1,v.y2)+3;
            if(x>=Math.min(c.x1,c.x2)-3&&x<=Math.max(c.x1,c.x2)+3&&c.pos>=y1&&c.pos<=y2)cross++;});
        }else{
          hs.forEach(q=>{const y=(q.y1+q.y2)/2,x1=Math.min(q.x1,q.x2)-3,x2=Math.max(q.x1,q.x2)+3;
            if(y>=Math.min(c.y1,c.y2)-3&&y<=Math.max(c.y1,c.y2)+3&&c.pos>=x1&&c.pos<=x2)cross++;});
        }
        c.cross=cross;
        if(cross>=2)supported++;
        if(c.ev<0.25||(cross===0&&c.ev<0.55))ghosts++;
      });
      const evidence=n?evid/n:0;
      const ghostRatio=n?ghosts/n:1;
      const support=n?supported/n:0;
      const meanOff=n?offs/n:8;
      const align=Math.max(0,1-meanOff/6);
      const complete=ref?Math.min(1,n/ref):0;
      const excess=ref?Math.max(0,(n-ref*1.35)/ref):0;
      const dupRatio=(n+p.dups)?p.dups/(n+p.dups):0;
      let score=0.30*evidence+0.22*support+0.18*align+0.17*complete+0.13*(1-ghostRatio);
      score-=0.30*excess+0.08*dupRatio;
      if(n<3)score*=0.35;
      score=Math.max(0,Math.min(1,score));
      const m=Object.assign({},p.r.metrics,{totalLines:n,hCount:hs.length,vCount:vs.length,ghosts:ghosts,meanOffset:meanOff.toFixed(1)});
      logger.info(p.r.algorithm+': Score='+score.toFixed(3)+(this.complements.indexOf(p.r.algorithm)>=0?' (complemento)':''));
      logger.info('  Evidencia='+evidence.toFixed(2)+' Soporte='+support.toFixed(2)+' Alineacion='+align.toFixed(2)+' Completitud='+complete.toFixed(2));
      logger.info('  Fantasmas='+ghosts+'/'+n+' Desfase medio='+meanOff.toFixed(1)+'px Duplicadas='+p.dups+' H='+hs.length+' V='+vs.length);
      return {algorithm:p.r.algorithm,score:score,metrics:m,lines:L,ghosts:ghosts,excess:excess,result:p.r};
    });
    const compete=ranking.filter(x=>this.complements.indexOf(x.algorithm)<0);
    compete.sort((a,b)=>b.score-a.score);
    ranking.sort((a,b)=>b.score-a.score);
    const best=compete[0]||ranking[0];
    const reasons=[];
    if(best){
      reasons.push('Evidencia real de linea: '+(best.metrics.totalLines-best.ghosts)+' de '+best.metrics.totalLines);
      reasons.push('Desfase medio: '+best.metrics.meanOffset+'px');
      reasons.push('Rejilla: '+best.metrics.hCount+'H / '+best.metrics.vCount+'V');
      if(best.ghosts>0)reasons.push('Fantasmas detectados: '+best.ghosts);
    }
    logger.info('🏆 Mejor: '+(best?best.algorithm+' ('+best.score.toFixed(3)+')':'n/a'));
    this.history.push({best:best?best.algorithm:null,score:best?best.score:0});
    return {best:best?best.best||best.algorithm:null,reasons:reasons,ranking:ranking,bestLines:best?best.lines:[]};
  }
}
window.AdaptiveDiagnosis=AdaptiveDiagnosis;
