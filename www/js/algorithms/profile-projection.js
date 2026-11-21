class ProfileProjection {
  constructor() {
    this.name = 'Profile Projection';
    this.color = '#FFFF00';
    this.enhancer = new LineEnhancer();
  }

  async detect(imageData) {
    logger.info('Iniciando Profile Projection (con realce de líneas)...');
    const t0 = Date.now();
    
    // Realce de líneas
    const enhanced = this.enhancer.enhance(imageData);
    
    // Umbralización adaptativa
    lineValidator.prepare(enhanced);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    // Proyección horizontal
    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) hProj[y]++;
      }
    }
    
    // Detectar picos
    const threshold = Math.max(...hProj) * 0.3;
    const hLines = [];
    for (let y = 1; y < h - 1; y++) {
      if (hProj[y] > threshold && hProj[y] >= hProj[y-1] && hProj[y] >= hProj[y+1]) {
        let tooClose = false;
        for (const l of hLines) {
          if (Math.abs(l.y1 - y) < 8) { tooClose = true; break; }
        }
        if (!tooClose) {
          hLines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w });
        }
      }
    }
    
    // Proyección vertical
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (bin[y * w + x]) vProj[x]++;
      }
    }
    
    // Detectar picos verticales
    const vThreshold = Math.max(...vProj) * 0.3;
    const vLines = [];
    for (let x = 1; x < w - 1; x++) {
      if (vProj[x] > vThreshold && vProj[x] >= vProj[x-1] && vProj[x] >= vProj[x+1]) {
        let tooClose = false;
        for (const l of vLines) {
          if (Math.abs(l.x1 - x) < 8) { tooClose = true; break; }
        }
        if (!tooClose) {
          vLines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h });
        }
      }
    }
    
    const lines = hLines.concat(vLines);
    const time = Date.now() - t0;
    logger.info('Profile Projection completado en ' + time + 'ms. Lineas: ' + lines.length);
    
    return {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: {
        totalLines: lines.length,
        executionTime: time,
        hLines: hLines.length,
        vLines: vLines.length
      }
    };
  }
}
window.ProfileProjection = ProfileProjection;
