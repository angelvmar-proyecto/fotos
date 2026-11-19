class CFARDetector {
  constructor() {
    this.name = 'CFAR Detector';
    this.color = '#FFC0CB';
  }
  
  async detect(imageData) {
    logger.info('Iniciando CFAR Detector');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Float32Array(width * height);
    
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      gray[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    const lines = [];
    const guardCells = 2;
    const trainingCells = 5;
    const thresholdFactor = 2.5;
    
    const hDetection = new Uint8Array(width * height);
    for (let y = trainingCells + guardCells; y < height - trainingCells - guardCells; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let t = -trainingCells - guardCells; t <= trainingCells + guardCells; t++) {
          if (Math.abs(t) > guardCells) {
            const ty = y + t;
            if (ty >= 0 && ty < height) {
              sum += gray[ty * width + x];
              count++;
            }
          }
        }
        const avg = sum / count;
        const cellValue = gray[y * width + x];
        if (cellValue < avg * thresholdFactor) {
          hDetection[y * width + x] = 1;
        }
      }
    }
    
    const hLines = this.extractLines(hDetection, width, height, 'horizontal');
    lines.push(...hLines);
    
    const vDetection = new Uint8Array(width * height);
    for (let x = trainingCells + guardCells; x < width - trainingCells - guardCells; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0, count = 0;
        for (let t = -trainingCells - guardCells; t <= trainingCells + guardCells; t++) {
          if (Math.abs(t) > guardCells) {
            const tx = x + t;
            if (tx >= 0 && tx < width) {
              sum += gray[y * width + tx];
              count++;
            }
          }
        }
        const avg = sum / count;
        const cellValue = gray[y * width + x];
        if (cellValue < avg * thresholdFactor) {
          vDetection[y * width + x] = 1;
        }
      }
    }
    
    const vLines = this.extractLines(vDetection, width, height, 'vertical');
    lines.push(...vLines);
    
    const time = Date.now() - start;
    logger.info(`CFAR completado en ${time}ms. Líneas: ${lines.length}`);
    
    return {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: { totalLines: lines.length, executionTime: time }
    };
  }
  
  extractLines(detection, width, height, direction) {
    const lines = [];
    
    if (direction === 'horizontal') {
      for (let y = 0; y < height; y++) {
        let count = 0;
        for (let x = 0; x < width; x++) {
          if (detection[y * width + x]) count++;
        }
        if (count > width * 0.3) {
          lines.push({ x1: 0, y1: y, x2: width-1, y2: y, angle: 0, length: width });
        }
      }
    } else {
      for (let x = 0; x < width; x++) {
        let count = 0;
        for (let y = 0; y < height; y++) {
          if (detection[y * width + x]) count++;
        }
        if (count > height * 0.3) {
          lines.push({ x1: x, y1: 0, x2: x, y2: height-1, angle: 90, length: height });
        }
      }
    }
    
    return this.mergeLines(lines, 5);
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
window.CFARDetector = CFARDetector;
