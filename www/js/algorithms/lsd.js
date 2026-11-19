class LSD {
  constructor() {
    this.name = 'LSD';
    this.color = '#00FF00';
  }
  
  async detect(imageData) {
    logger.info('Iniciando LSD (Line Segment Detector)');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Uint8ClampedArray(width * height);
    
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      gray[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    const lines = [];
    const angleStep = 2;
    const minLength = 30;
    
    for (let angle = 0; angle < 180; angle += angleStep) {
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const projections = [];
      for (let r = -Math.max(width, height); r < Math.max(width, height); r++) {
        let sum = 0, count = 0;
        for (let t = -Math.max(width, height); t < Math.max(width, height); t++) {
          const x = Math.round(r * cos - t * sin);
          const y = Math.round(r * sin + t * cos);
          if (x >= 0 && x < width && y >= 0 && y < height) {
            sum += gray[y * width + x];
            count++;
          }
        }
        if (count > 0) projections.push({ r, avg: sum / count });
      }
      
      for (let i = 1; i < projections.length - 1; i++) {
        const prev = projections[i-1].avg;
        const curr = projections[i].avg;
        const next = projections[i+1].avg;
        
        if (curr < prev && curr < next && curr < 150) {
          const r = projections[i].r;
          const x1 = Math.round(r * cos);
          const y1 = Math.round(r * sin);
          const x2 = Math.round(r * cos + 1000 * sin);
          const y2 = Math.round(r * sin - 1000 * cos);
          
          const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
          if (length > minLength) {
            lines.push({
              x1: Math.max(0, Math.min(width-1, x1)),
              y1: Math.max(0, Math.min(height-1, y1)),
              x2: Math.max(0, Math.min(width-1, x2)),
              y2: Math.max(0, Math.min(height-1, y2)),
              angle: angle,
              length: length
            });
          }
        }
      }
    }
    
    const time = Date.now() - start;
    logger.info(`LSD completado en ${time}ms. Líneas: ${lines.length}`);
    
    return {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: { totalLines: lines.length, executionTime: time }
    };
  }
}
window.LSD = LSD;
