class LSD {
  constructor() {
    this.name = 'LSD';
    this.color = '#00FF00';
    this.angleStep = 3; // Aumentado de 2 a 5 para velocidad
    this.minLength = 25; // Aumentado de 30 a 50
  }
  
  async detect(imageData) {
    logger.info('Iniciando LSD (optimizado para velocidad)');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Uint8ClampedArray(width * height);
    
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      gray[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    // Reescalar para velocidad
    const scale = Math.min(1, 800 / Math.max(width, height));
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);
    const scaled = new Uint8ClampedArray(sw * sh);
    
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const sx = Math.round(x / scale);
        const sy = Math.round(y / scale);
        scaled[y * sw + x] = gray[sy * width + sx];
      }
    }
    
    const lines = [];
    
    // Detección simplificada: buscar mínimos locales en proyecciones rotadas
    for (let angle = 0; angle < 180; angle += this.angleStep) {
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const projections = [];
      const maxR = Math.max(sw, sh);
      
      for (let r = -maxR; r < maxR; r += 2) {
        let sum = 0, count = 0;
        for (let t = -maxR; t < maxR; t += 3) {
          const x = Math.round(r * cos - t * sin);
          const y = Math.round(r * sin + t * cos);
          if (x >= 0 && x < sw && y >= 0 && y < sh) {
            sum += scaled[y * sw + x];
            count++;
          }
        }
        if (count > 0) projections.push({ r, avg: sum / count });
      }
      
      // Buscar mínimos locales
      for (let i = 1; i < projections.length - 1; i++) {
        const prev = projections[i-1].avg;
        const curr = projections[i].avg;
        const next = projections[i+1].avg;
        
        if (curr < prev && curr < next && curr < 150) {
          const r = projections[i].r;
          const x1 = Math.round((r * cos) / scale);
          const y1 = Math.round((r * sin) / scale);
          const x2 = Math.round((r * cos + 1000 * sin) / scale);
          const y2 = Math.round((r * sin - 1000 * cos) / scale);
          
          const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
          if (length > this.minLength) {
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
