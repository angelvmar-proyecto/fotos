class FrangiFilter {
  constructor() {
    this.name = 'Frangi Filter';
    this.color = '#00FFFF';
  }
  
  async detect(imageData) {
    logger.info('Iniciando Frangi Filter');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Float32Array(width * height);
    
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      gray[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    const scales = [1, 2, 3, 4, 5];
    const vesselness = new Float32Array(width * height);
    
    for (const sigma of scales) {
      const kernelSize = Math.ceil(6 * sigma) | 1;
      const half = Math.floor(kernelSize / 2);
      
      const dxx = new Float32Array(width * height);
      const dyy = new Float32Array(width * height);
      const dxy = new Float32Array(width * height);
      
      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          const gxx = (gray[y * width + (x+1)] - 2 * gray[y * width + x] + gray[y * width + (x-1)]) / (sigma * sigma);
          const gyy = (gray[(y+1) * width + x] - 2 * gray[y * width + x] + gray[(y-1) * width + x]) / (sigma * sigma);
          const gxy = (gray[(y+1) * width + (x+1)] - gray[(y+1) * width + (x-1)] - 
                      gray[(y-1) * width + (x+1)] + gray[(y-1) * width + (x-1)]) / (4 * sigma * sigma);
          
          dxx[y * width + x] = gxx;
          dyy[y * width + x] = gyy;
          dxy[y * width + x] = gxy;
        }
      }
      
      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          const idx = y * width + x;
          const a = dxx[idx];
          const b = dxy[idx];
          const d = dyy[idx];
          
          const trace = a + d;
          const det = a * d - b * b;
          const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
          const lambda2 = (trace - Math.sqrt(trace * trace - 4 * det)) / 2;
          
          const Rb = Math.abs(lambda2) / Math.max(Math.abs(lambda1), 1e-10);
          const S = Math.sqrt(lambda1 * lambda1 + lambda2 * lambda2);
          
          const alpha = 0.5;
          const beta = 0.5;
          const c = 15;
          
          const v = Math.exp(-Rb * Rb / (2 * beta * beta)) * (1 - Math.exp(-S * S / (2 * c * c)));
          vesselness[idx] = Math.max(vesselness[idx], v);
        }
      }
    }
    
    const lines = [];
    const threshold = 0.3;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (vesselness[y * width + x] > threshold) {
          const isMaxH = vesselness[y * width + x] > vesselness[(y-1) * width + x] &&
                        vesselness[y * width + x] > vesselness[(y+1) * width + x];
          const isMaxV = vesselness[y * width + x] > vesselness[y * width + (x-1)] &&
                        vesselness[y * width + x] > vesselness[y * width + (x+1)];
          
          if (isMaxH) lines.push({ x1: 0, y1: y, x2: width-1, y2: y, angle: 0, length: width });
          if (isMaxV) lines.push({ x1: x, y1: 0, x2: x, y2: height-1, angle: 90, length: height });
        }
      }
    }
    
    const merged = this.mergeLines(lines, 5);
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
