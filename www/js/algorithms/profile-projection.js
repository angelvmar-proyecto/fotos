class ProfileProjection {
  constructor() {
    this.name = 'Profile Projection';
    this.color = '#FFFF00';
  }

  async detect(imageData) {
    logger.info('Iniciando Profile Projection (con filtros de calidad)...');
    const t0 = Date.now();
    
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    const minLengthH = w * 0.40;
    const minLengthV = h * 0.40;
    
    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) hProj[y]++;
      }
    }
    
    const threshold = Math.max(...hProj) * 0.35;
    const hLines = [];
    for (let y = 1; y < h - 1; y++) {
      if (hProj[y] > threshold && hProj[y] >= hProj[y-1] && hProj[y] >= hProj[y+1]) {
        let tooClose = false;
        for (const l of hLines) {
          if (Math.abs(l.y1 - y) < 8) { tooClose = true; break; }
        }
        if (!tooClose && w >= minLengthH) {
          hLines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w });
        }
      }
    }
    
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (bin[y * w + x]) vProj[x]++;
      }
    }
    
    const vThreshold = Math.max(...vProj) * 0.35;
    const vLines = [];
    for (let x = 1; x < w - 1; x++) {
      if (vProj[x] > vThreshold && vProj[x] >= vProj[x-1] && vProj[x] >= vProj[x+1]) {
        let tooClose = false;
        for (const l of vLines) {
          if (Math.abs(l.x1 - x) < 8) { tooClose = true; break; }
        }
        if (!tooClose && h >= minLengthV) {
          vLines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h });
        }
      }
    }
    
    const lines = hLines.concat(vLines);
    
    // AUDITORÍA DE COORDENADAS: Imprimir primeras y últimas líneas
    if (hLines.length > 0) {
      const first3 = hLines.slice(0, 3).map(l => l.y1).join(', ');
      const last3 = hLines.slice(-3).map(l => l.y1).join(', ');
      logger.info('  [AUDITORÍA] Horizontales: Primeras Y=[' + first3 + '] | Últimas Y=[' + last3 + '] (Alto imagen: ' + h + ')');
    }
    if (vLines.length > 0) {
      const first3 = vLines.slice(0, 3).map(l => l.x1).join(', ');
      const last3 = vLines.slice(-3).map(l => l.x1).join(', ');
      logger.info('  [AUDITORÍA] Verticales: Primeras X=[' + first3 + '] | Últimas X=[' + last3 + '] (Ancho imagen: ' + w + ')');
    }
    
    const result = {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: { totalLines: lines.length, executionTime: Date.now() - t0, hLines: hLines.length, vLines: vLines.length }
    };
    
    return lineValidator.filterResult(result);
  }
}
window.ProfileProjection = ProfileProjection;
