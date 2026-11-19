class GaborFilters {
  constructor() {
    this.name = 'Gabor Filters';
    this.color = '#FF00FF';
  }
  
  async detect(imageData) {
    logger.info('Iniciando Gabor Filters');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Float32Array(width * height);
    
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      gray[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    const lines = [];
    const angles = [0, 45, 90, 135];
    const lambda = 10;
    const sigma = 3;
    const gamma = 0.3;
    
    for (const theta of angles) {
      const rad = theta * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const response = new Float32Array(width * height);
      const kernelSize = 15;
      const half = Math.floor(kernelSize / 2);
      
      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          let sum = 0;
          for (let ky = -half; ky <= half; ky++) {
            for (let kx = -half; kx <= half; kx++) {
              const xPrime = kx * cos + ky * sin;
              const yPrime = -kx * sin + ky * cos;
              const gabor = Math.exp(-(xPrime*xPrime + gamma*gamma*yPrime*yPrime) / (2*sigma*sigma)) * 
                           Math.cos(2 * Math.PI * xPrime / lambda);
              sum += gray[(y+ky) * width + (x+kx)] * gabor;
            }
          }
          response[y * width + x] = Math.abs(sum);
        }
      }
      
      const threshold = 50;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (response[y * width + x] > threshold) {
            const isMax = response[y * width + x] > response[(y-1) * width + x] &&
                         response[y * width + x] > response[(y+1) * width + x];
            if (isMax && theta === 0) {
              lines.push({ x1: 0, y1: y, x2: width-1, y2: y, angle: 0, length: width });
            } else if (isMax && theta === 90) {
              lines.push({ x1: x, y1: 0, x2: x, y2: height-1, angle: 90, length: height });
            }
          }
        }
      }
    }
    
    const merged = this.mergeLines(lines, 5);
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
