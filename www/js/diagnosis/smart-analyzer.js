class SmartAnalyzer {
  constructor(){ this.imageProfile=null; }
  analyzeImage(imageData){
    const t0=Date.now(), w=imageData.width, h=imageData.height, d=imageData.data;
    let sum=0,mn=255,mx=0;
    for(let i=0;i<d.length;i+=4){const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];sum+=g;if(g<mn)mn=g;if(g>mx)mx=g;}
    const mean=sum/(w*h), isDark=mean<128;
    let edges=0,seen=0;
    for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){const i=(y*w+x)*4;const gx=Math.abs(d[i]-d[i+4]),gy=Math.abs(d[i]-d[(y+1)*w*4+x*4]);seen++;if(Math.sqrt(gx*gx+gy*gy)>30)edges++;}
    const density=(edges/seen)*100;
    const hP=new Array(h).fill(0), vP=new Array(w).fill(0);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]<mean-25){hP[y]++;vP[x]++;}}
    const hPeaks=this.countPeaks(hP,Math.max(4,Math.round(h/120)));
    const vPeaks=this.countPeaks(vP,Math.max(4,Math.round(w/120)));
    const thick=this.thickness(hP,vP);
    const aspect=w/h;
    const type=this.classify({density,isDark,thick,aspect,hPeaks,vPeaks,mean});
    this.imageProfile={width:w,height:h,aspectRatio:aspect.toFixed(2),meanGray:Math.round(mean),contrast:mx-mn,edgeDensity:density.toFixed(2),isDark,hPeaks,vPeaks,avgLineThickness:thick.toFixed(2),imageType:type,analysisTime:Date.now()-t0};
    logger.info('=== ANALISIS DE IMAGEN ===');
    logger.info('Tamano: '+w+'x'+h+' (aspecto: '+aspect.toFixed(2)+')');
    logger.info('Brillo promedio: '+Math.round(mean)+(isDark?' (OSCURA)':' (CLARA)'));
    logger.info('Densidad de bordes: '+density.toFixed(2)+'%');
    logger.info('Lineas horizontales estimadas: '+hPeaks);
    logger.info('Lineas verticales estimadas: '+vPeaks);
    logger.info('Grosor promedio de linea: '+thick.toFixed(2)+'px');
    logger.info('Tipo de imagen: '+type);
    logger.info('Tiempo de analisis: '+(Date.now()-t0)+'ms');
    return this.imageProfile;
  }
  countPeaks(p,minDist){
    const n=p.length, s=new Array(n).fill(0);
    for(let i=0;i<n;i++){let a=0,c=0;for(let k=-2;k<=2;k++){const j=i+k;if(j>=0&&j<n){a+=p[j];c++;}}s[i]=a/c;}
    const sorted=[...s].sort((a,b)=>a-b);
    const med=sorted[Math.floor(n/2)], max=sorted[n-1];
    const th=med+(max-med)*0.35;
    const peaks=[];
    for(let i=1;i<n-1;i++){
      if(s[i]>th&&s[i]>=s[i-1]&&s[i]>=s[i+1]){
        let close=false;
        for(let j=0;j<peaks.length;j++){if(Math.abs(peaks[j]-i)<minDist){if(s[i]>s[peaks[j]])peaks[j]=i;close=true;break;}}
        if(!close)peaks.push(i);
      }
    }
    return peaks.length;
  }
  thickness(hP,vP){
    const wds=[];
    [hP,vP].forEach(p=>{const mx=Math.max(...p);if(mx<=0)return;const th=mx*0.5;let inp=false,st=0;
      for(let i=0;i<p.length;i++){if(p[i]>th){if(!inp){inp=true;st=i;}}else if(inp){wds.push(i-st);inp=false;}}});
    if(!wds.length)return 1;
    wds.sort((a,b)=>a-b);
    return Math.max(1,wds[Math.floor(wds.length/2)]);
  }
  classify(s){
    if(s.density<8&&s.hPeaks<4&&s.vPeaks<4)return 'FOTO_NATURAL';
    if(s.aspect>2.5&&!s.isDark)return 'TABLA_PANTALLA_PC';
    if(s.aspect>2.5)return 'TABLA_ANCHA_OSCURA';
    if(s.isDark)return s.thick>3?'TABLA_OSCURA_GRUESA':'TABLA_OSCURA_FINA';
    if(s.density>18)return s.thick>3?'TABLA_DENSA_GRUESA':'TABLA_DENSA_FINA';
    if(s.hPeaks>25&&s.vPeaks>12)return 'TABLA_COMPLEJA';
    return 'TABLA_SIMPLE';
  }
  suggestAlgorithms(p){
    const s={primary:[],secondary:[],avoid:[],params:{}};
    switch(p.imageType){
      case 'TABLA_PANTALLA_PC':
        s.primary=['Morphological','Cell Detector'];
        s.secondary=['Echo Radar','Profile Projection'];
        s.params={'Echo Radar':{minCoverage:0.45,minRunRatio:0.45,gapTolerance:4},'Morphological':{kernelSize:15}};
        break;
      case 'TABLA_ANCHA_OSCURA':
        s.primary=['Echo Radar','Cell Detector'];
        s.secondary=['Morphological','Fourier Analysis'];
        s.params={'Echo Radar':{minCoverage:0.4,minRunRatio:0.4,gapTolerance:5}};
        break;
      case 'TABLA_DENSA_FINA':
        s.primary=['Profile Projection','Morphological'];
        s.secondary=['Echo Radar','Fourier Analysis','Cell Detector'];
        s.params={'Echo Radar':{minCoverage:0.4,minRunRatio:0.4,gapTolerance:5},'Fourier Analysis':{minDistance:8}};
        break;
      case 'TABLA_DENSA_GRUESA':
        s.primary=['Morphological','Profile Projection'];
        s.secondary=['Echo Radar','Cell Detector'];
        s.params={'Echo Radar':{minCoverage:0.5,minRunRatio:0.5,gapTolerance:4}};
        break;
      case 'FOTO_NATURAL':
        s.primary=['Echo Radar','Profile Projection'];
        s.secondary=['Fourier Analysis'];
        s.params={'Echo Radar':{minCoverage:0.45,minRunRatio:0.45,gapTolerance:4}};
        break;
      default:
        s.primary=['Echo Radar','Profile Projection'];
        s.secondary=['Morphological','Fourier Analysis','Cell Detector'];
        s.params={'Echo Radar':{minCoverage:0.4,minRunRatio:0.4,gapTolerance:5}};
    }
    return s;
  }
  getRecommendation(){
    if(!this.imageProfile)return null;
    const s=this.suggestAlgorithms(this.imageProfile);
    logger.info('=== RECOMENDACIONES ===');
    logger.info('Algoritmos PRIMARIOS: '+s.primary.join(', '));
    logger.info('Algoritmos SECUNDARIOS: '+s.secondary.join(', '));
    Object.entries(s.params).forEach(([a,p])=>logger.info('Parametros '+a+': '+JSON.stringify(p)));
    return s;
  }
}
window.SmartAnalyzer=SmartAnalyzer;
