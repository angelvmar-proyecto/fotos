class FrangiFilter {
  constructor() {
    this.name = 'Frangi Filter';
    this.color = '#00FFFF';
    this.scales = [2, 3]; // Reducido de [1,2,3,4,5] a [2,3]
  }
  
  async detect(imageData) {
    logger.info('Iniciando Frangi Filter (optimizado)');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    
    // Reescalar para velocidad
    const scale = Math.min(1, 600 / Math.max(width, height));
    const sw = Math.round(width * scale);
    const sh = Math.round(height * scale);
    const gray = new Float32Array(sw * sh);
    
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const sx = Math.round(x / scale);
        const sy = Math.round(y / scale);
        const idx = (sy * width + sx) * 4;
        gray[y * sw + x] = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx+1] + 0.114 * imageData.data[idx+2];
      }
    }
    
    const vesselness = new Float32Array(sw * sh);
    
    for (const sigma of this.scales) {
      const kernelSize = Math.min(11, Math.ceil(4 * sigma) | 1);
      const half = Math.floor(kernelSize / 2);
      
      for (let y = half; y < sh - half; y++) {
        for (let x = half; x < sw - half; x++) {
          const gxx = (gray[y * sw + (x+1)] - 2 * gray[y * sw + x] + gray[y * sw + (x-1)]) / (sigma * sigma);
          const gyy = (gray[(y+1) * sw + x] - 2 * gray[y * sw + x] + gray[(y-1) * sw + x]) / (sigma * sigma);
          const gxy = (gray[(y+1) * sw + (x+1)] - gray[(y+1) * sw + (x-1)] - 
                      gray[(y-1) * sw + (x+1)] + gray[(y-1) * sw + (x-1)]) / (4 * sigma * sigma);
          
          const trace = gxx + gyy;
          const det = gxx * gyy - gxy * gxy;
          const discriminant = Math.max(0, trace * trace - 4 * det);
          const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
          const lambda2 = (trace - Math.sqrt(discriminant)) / 2;
          
          const Rb = Math.abs(lambda2) / Math.max(Math.abs(lambda1), 1e-10);
          const S = Math.sqrt(lambda1 * lambda1 + lambda2 * lambda2);
          
          const v = Math.exp(-Rb * Rb / 0.5) * (1 - Math.exp(-S * S / 450));
          vesselness[y * sw + x] = Math.max(vesselness[y * sw + x], v);
        }
      }
    }
    
    const lines = [];
    const threshold = 0.3;
    
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        if (vesselness[y * sw + x] > threshold) {
          const isMaxH = vesselness[y * sw + x] > vesselness[(y-1) * sw + x] &&
                        vesselness[y * sw + x] > vesselness[(y+1) * sw + x];
          const isMaxV = vesselness[y * sw + x] > vesselness[y * sw + (x-1)] &&
                        vesselness[y * sw + x] > vesselness[y * sw + (x+1)];
          
          if (isMaxH) {
            const oy = Math.round(y / scale);
            lines.push({ x1: 0, y1: oy, x2: width-1, y2: oy, angle: 0, length: width });
          }
          if (isMaxV) {
            const ox = Math.round(x / scale);
            lines.push({ x1: ox, y1: 0, x2: ox, y2: height-1, angle: 90, length: height });
          }
        }
      }
    }
    
    const merged = this.mergeLines(lines, 8);
    const time = Date.now() - start;
    logger.info(`Frangi completado en ${time}ms. Líneas: ${merged.length}`);
    
    return {
      algorithm: this.name,
      color: this.color,
      lines: merged,
      metrics: { totalLines: merged.length, executionTime: time }
    };
  }
  
  mergeLines(lines, threshold) {
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      let current = lines[i];
      
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue;
        if (lines[j].angle === current.angle) {
          const dist = current.angle === 0 ? 
            Math.abs(current.y1 - lines[j].y1) : 
            Math.abs(current.x1 - lines[j].x1);
          
          if (dist < threshold) {
            if (current.angle === 0) {
              current.y1 = current.y2 = Math.floor((current.y1 + lines[j].y1) / 2);
            } else {
              current.x1 = current.x2 = Math.floor((current.x1 + lines[j].x1) / 2);
            }
            used.add(j);
          }
        }
      }
      merged.push(current);
      used.add(i);
    }
    return merged;
  }
}
window.FrangiFilter = FrangiFilter;
