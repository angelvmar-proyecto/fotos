class GaborFilters {
  constructor() {
    this.name = 'Gabor Filters';
    this.color = '#FF00FF';
    this.kernelSize = 9; // Reducido de 15 a 9
  }
  
  async detect(imageData) {
    logger.info('Iniciando Gabor Filters (optimizado)');
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
    
    const lines = [];
    const angles = [0, 90]; // Solo horizontal y vertical para velocidad
    const lambda = 8;
    const sigma = 2.5;
    const gamma = 0.3;
    const half = Math.floor(this.kernelSize / 2);
    
    for (const theta of angles) {
      const rad = theta * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const response = new Float32Array(sw * sh);
      
      for (let y = half; y < sh - half; y += 2) { // Paso 2 para velocidad
        for (let x = half; x < sw - half; x += 2) {
          let sum = 0;
          for (let ky = -half; ky <= half; ky++) {
            for (let kx = -half; kx <= half; kx++) {
              const xPrime = kx * cos + ky * sin;
              const yPrime = -kx * sin + ky * cos;
              const gabor = Math.exp(-(xPrime*xPrime + gamma*gamma*yPrime*yPrime) / (2*sigma*sigma)) * 
                           Math.cos(2 * Math.PI * xPrime / lambda);
              sum += gray[(y+ky) * sw + (x+kx)] * gabor;
            }
          }
          response[y * sw + x] = Math.abs(sum);
        }
      }
      
      const threshold = 40;
      for (let y = 1; y < sh - 1; y++) {
        for (let x = 1; x < sw - 1; x++) {
          if (response[y * sw + x] > threshold) {
            const isMax = response[y * sw + x] > response[(y-1) * sw + x] &&
                         response[y * sw + x] > response[(y+1) * sw + x];
            if (isMax && theta === 0) {
              const oy = Math.round(y / scale);
              lines.push({ x1: 0, y1: oy, x2: width-1, y2: oy, angle: 0, length: width });
            } else if (isMax && theta === 90) {
              const ox = Math.round(x / scale);
              lines.push({ x1: ox, y1: 0, x2: ox, y2: height-1, angle: 90, length: height });
            }
          }
        }
      }
    }
    
    const merged = this.mergeLines(lines, 8);
    const time = Date.now() - start;
    logger.info(`Gabor completado en ${time}ms. Líneas: ${merged.length}`);
    
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
window.GaborFilters = GaborFilters;
